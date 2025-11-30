/**
 * @file AiProviderHelper.ts
 * @description Shared utility for checking AI provider availability from database
 *
 * All AI services should use this helper instead of hardcoding env var checks.
 * Providers are configured via the UI and stored in the ai_providers table.
 */

import prisma from '../../config/database';
import { decrypt } from '../../utils/encryption';
import { logger } from '../../utils/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AiProviderConfig {
  id: string;
  type: 'gemini' | 'openai' | 'anthropic' | 'azure-openai';
  name: string;
  apiKey: string;
  apiEndpoint?: string;
  defaultModel: string;
}

/**
 * Check if any AI provider is configured and enabled in the database
 */
export async function hasAnyAiProvider(): Promise<boolean> {
  try {
    const provider = await prisma.ai_providers.findFirst({
      where: {
        enabled: true,
        apiKeyEncrypted: { not: null },
      },
      select: { id: true },
    });
    return !!provider;
  } catch (error) {
    logger.error('[AiProviderHelper] Error checking for AI providers:', error);
    return false;
  }
}

/**
 * Get the first available AI provider configuration
 * Returns null if no providers are configured
 */
export async function getFirstAvailableProvider(): Promise<AiProviderConfig | null> {
  try {
    const provider = await prisma.ai_providers.findFirst({
      where: {
        enabled: true,
        apiKeyEncrypted: { not: null },
      },
      orderBy: { createdAt: 'asc' }, // Prefer oldest (first configured)
    });

    if (!provider || !provider.apiKeyEncrypted) {
      return null;
    }

    const apiKey = decrypt(provider.apiKeyEncrypted);
    if (!apiKey) {
      logger.warn(`[AiProviderHelper] Failed to decrypt API key for provider ${provider.id}`);
      return null;
    }

    return {
      id: provider.id,
      type: provider.type as AiProviderConfig['type'],
      name: provider.name,
      apiKey,
      apiEndpoint: provider.apiEndpoint || undefined,
      defaultModel: provider.defaultModel,
    };
  } catch (error) {
    logger.error('[AiProviderHelper] Error getting AI provider:', error);
    return null;
  }
}

/**
 * Get a Google Generative AI client from database-configured provider
 * Falls back to env var only as a last resort for backwards compatibility
 */
export async function getGoogleAiClient(): Promise<GoogleGenerativeAI | null> {
  // First, try to get from database
  const provider = await getFirstAvailableProvider();

  if (provider && provider.type === 'gemini') {
    return new GoogleGenerativeAI(provider.apiKey);
  }

  // Fallback to env var for backwards compatibility
  const envApiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (envApiKey) {
    return new GoogleGenerativeAI(envApiKey);
  }

  return null;
}

/**
 * Lazy AI client wrapper - checks database on first use
 * Use this for services that need deferred initialization
 */
export class LazyAiClient {
  private client: GoogleGenerativeAI | null = null;
  private initialized = false;
  private unavailableLogged = false;

  async getClient(): Promise<GoogleGenerativeAI | null> {
    if (!this.initialized) {
      this.client = await getGoogleAiClient();
      this.initialized = true;

      if (!this.client && !this.unavailableLogged) {
        logger.info('[LazyAiClient] No AI provider configured - AI features will use rule-based fallbacks');
        this.unavailableLogged = true;
      }
    }
    return this.client;
  }

  isAvailable(): boolean {
    return this.initialized && this.client !== null;
  }

  /**
   * Reset the client (call after provider config changes)
   */
  reset(): void {
    this.client = null;
    this.initialized = false;
  }
}

// Singleton instance for shared use
export const lazyAiClient = new LazyAiClient();
