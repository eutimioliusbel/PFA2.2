import prisma from '../../config/database';
import { GeminiAdapter } from './GeminiAdapter';
import { OpenAIAdapter } from './OpenAIAdapter';
import { AnthropicAdapter } from './AnthropicAdapter';
import { AzureOpenAIAdapter } from './AzureOpenAIAdapter';
import { IAiProvider, AiChatRequest, AiResponse } from './types';
import { logger } from '../../utils/logger';
import { decrypt } from '../../utils/encryption';
import { env } from '../../config/env';

export class AiService {
  /**
   * Get AI provider for organization
   */
  private async getProvider(organizationId: string): Promise<IAiProvider> {
    try {
      // Get organization's AI configuration
      const aiConfig = await prisma.organization_ai_configs.findUnique({
        where: { organizationId },
      });

      if (!aiConfig || !aiConfig.enabled) {
        throw new Error('AI is not enabled for this organization');
      }

      if (aiConfig.accessLevel === 'disabled') {
        throw new Error('AI access is disabled for this organization');
      }

      // Get primary provider
      let providerId = aiConfig.primaryProviderId;

      if (!providerId) {
        // Default to system-wide Gemini if no org-specific provider
        if (env.GEMINI_API_KEY) {
          return new GeminiAdapter(env.GEMINI_API_KEY);
        }
        throw new Error('No AI provider configured');
      }

      // Load provider from database
      const provider = await prisma.ai_providers.findUnique({
        where: { id: providerId },
      });

      if (!provider || !provider.enabled) {
        throw new Error('AI provider not found or disabled');
      }

      // Decrypt API key
      const apiKey = provider.apiKeyEncrypted
        ? decrypt(provider.apiKeyEncrypted)
        : env.GEMINI_API_KEY; // Fallback to env

      if (!apiKey) {
        throw new Error('No API key configured for provider');
      }

      // Instantiate provider
      switch (provider.type) {
        case 'gemini':
          return new GeminiAdapter(apiKey, provider.defaultModel, {
            input: provider.pricingInput,
            output: provider.pricingOutput,
          });

        case 'openai':
          return new OpenAIAdapter(apiKey, provider.defaultModel, {
            input: provider.pricingInput,
            output: provider.pricingOutput,
          });

        case 'anthropic':
          return new AnthropicAdapter(apiKey, provider.defaultModel, {
            input: provider.pricingInput,
            output: provider.pricingOutput,
          });

        case 'azure-openai':
          if (!provider.apiEndpoint) {
            throw new Error('Azure OpenAI requires apiEndpoint');
          }
          return new AzureOpenAIAdapter(
            apiKey,
            provider.apiEndpoint,
            provider.defaultModel, // Use defaultModel as deployment name
            provider.defaultModel,
            {
              input: provider.pricingInput,
              output: provider.pricingOutput,
            }
          );

        default:
          throw new Error(`Unsupported provider type: ${provider.type}`);
      }
    } catch (error) {
      logger.error('Get provider error:', error);
      throw error;
    }
  }

  /**
   * Send chat request to AI provider
   */
  async chat(request: AiChatRequest): Promise<AiResponse> {
    const startTime = Date.now();

    try {
      // Check budget before making request
      await this.checkBudget(request.organizationId);

      // Get provider
      const provider = await this.getProvider(request.organizationId);

      // Make API call
      const response = await provider.chat(request);

      // Log usage
      await this.logUsage({
        userId: request.userId,
        organizationId: request.organizationId,
        provider: response.provider,
        model: response.model,
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
        costUsd: response.cost || 0,
        latencyMs: response.latencyMs,
        cached: response.cached || false,
        success: true,
      });

      return response;
    } catch (error: unknown) {
      logger.error('AI chat error:', error);

      // Log failed attempt
      await this.logUsage({
        userId: request.userId,
        organizationId: request.organizationId,
        provider: 'unknown',
        model: 'unknown',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        latencyMs: Date.now() - startTime,
        cached: false,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Check if organization has budget remaining
   */
  private async checkBudget(organizationId: string): Promise<void> {
    const config = await prisma.organization_ai_configs.findUnique({
      where: { organizationId },
    });

    if (!config) return;

    // Get today's spend
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailySpend = await prisma.ai_usage_logs.aggregate({
      where: {
        organizationId,
        createdAt: { gte: today },
        success: true,
      },
      _sum: { costUsd: true },
    });

    const todaySpend = dailySpend._sum.costUsd || 0;

    if (todaySpend >= config.dailyLimitUsd) {
      throw new Error(`Daily AI budget exceeded: $${todaySpend.toFixed(2)} / $${config.dailyLimitUsd}`);
    }

    // Get monthly spend
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const monthlySpend = await prisma.ai_usage_logs.aggregate({
      where: {
        organizationId,
        createdAt: { gte: monthStart },
        success: true,
      },
      _sum: { costUsd: true },
    });

    const monthSpend = monthlySpend._sum.costUsd || 0;

    if (monthSpend >= config.monthlyLimitUsd) {
      throw new Error(`Monthly AI budget exceeded: $${monthSpend.toFixed(2)} / $${config.monthlyLimitUsd}`);
    }
  }

  /**
   * Log AI usage for cost tracking
   */
  private async logUsage(data: {
    userId: string;
    organizationId: string;
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
    latencyMs: number;
    cached: boolean;
    success: boolean;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await prisma.ai_usage_logs.create({
        data: {
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
          userId: data.userId,
          organizationId: data.organizationId,
          provider: data.provider,
          model: data.model,
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          totalTokens: data.totalTokens,
          costUsd: data.costUsd,
          latencyMs: data.latencyMs,
          cached: data.cached,
          success: data.success,
          errorMessage: data.errorMessage,
        },
      });
    } catch (error) {
      logger.error('Log usage error:', error);
      // Don't throw - logging failure shouldn't block AI requests
    }
  }

  /**
   * Get usage statistics for organization
   */
  async getUsageStats(organizationId: string, timeRange: 'day' | 'week' | 'month' = 'month') {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case 'day':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const logs = await prisma.ai_usage_logs.findMany({
      where: {
        organizationId,
        createdAt: { gte: startDate },
        success: true,
      },
    });

    const totalCost = logs.reduce((sum: number, log) => sum + log.costUsd, 0);
    const totalRequests = logs.length;
    const cacheHits = logs.filter((log) => log.cached).length;
    const cacheHitRate = totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;

    // Group by provider
    const byProvider = logs.reduce((acc: Record<string, { requests: number; tokens: number; cost: number }>, log) => {
      if (!acc[log.provider]) {
        acc[log.provider] = { requests: 0, tokens: 0, cost: 0 };
      }
      acc[log.provider].requests++;
      acc[log.provider].tokens += log.totalTokens;
      acc[log.provider].cost += log.costUsd;
      return acc;
    }, {} as Record<string, { requests: number; tokens: number; cost: number }>);

    return {
      totalCost,
      totalRequests,
      cacheHitRate: cacheHitRate.toFixed(1),
      byProvider: Object.entries(byProvider).map(([provider, stats]) => ({
        provider,
        providerName: provider.charAt(0).toUpperCase() + provider.slice(1),
        requests: stats.requests,
        tokens: stats.tokens,
        cost: stats.cost,
      })),
    };
  }
}

export default new AiService();
