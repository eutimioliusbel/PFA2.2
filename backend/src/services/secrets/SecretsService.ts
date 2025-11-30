/**
 * AWS Secrets Manager Service
 *
 * P0-2: Credential Migration to AWS Secrets Manager
 * Securely retrieves sensitive credentials from AWS Secrets Manager
 * instead of storing them in .env files.
 *
 * Security Benefits:
 * - Centralized secret management
 * - Automatic rotation support
 * - Audit trail of secret access
 * - Encryption at rest and in transit
 * - No secrets in version control or file system
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  GetSecretValueCommandOutput,
} from '@aws-sdk/client-secrets-manager';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

interface SecretCacheEntry {
  value: string;
  expiresAt: number;
}

interface PemsCredentials {
  apiUrl: string;
  apiKey: string;
  username?: string;
  password?: string;
}

class SecretsService {
  private client: SecretsManagerClient;
  private cache: Map<string, SecretCacheEntry> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Initialize AWS Secrets Manager client
    this.client = new SecretsManagerClient({
      region: env.AWS_REGION || process.env.AWS_REGION || 'us-east-1',
      // AWS SDK automatically uses credentials from:
      // 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
      // 2. IAM role (when running in EC2/ECS/Lambda)
      // 3. AWS credentials file (~/.aws/credentials)
    });
  }

  /**
   * Retrieves secret value from AWS Secrets Manager with caching
   *
   * Implements 5-minute TTL cache to reduce API calls and costs.
   * Cache invalidation happens automatically on TTL expiry.
   *
   * @param secretName - Full secret name in AWS Secrets Manager
   * @returns Secret value as string
   */
  async getSecret(secretName: string): Promise<string> {
    // Check cache first (5-minute TTL)
    const cached = this.cache.get(secretName);
    if (cached && cached.expiresAt > Date.now()) {
      logger.debug('Secret retrieved from cache', { secretName });
      return cached.value;
    }

    try {
      logger.info('Retrieving secret from AWS Secrets Manager', { secretName });

      const command = new GetSecretValueCommand({
        SecretId: secretName,
      });

      const response: GetSecretValueCommandOutput = await this.client.send(command);

      if (!response.SecretString) {
        throw new Error(`Secret ${secretName} is empty or binary (not supported)`);
      }

      const secretValue = response.SecretString;

      // Cache for 5 minutes
      this.cache.set(secretName, {
        value: secretValue,
        expiresAt: Date.now() + this.CACHE_TTL_MS,
      });

      logger.info('Secret retrieved successfully', { secretName });
      return secretValue;
    } catch (error: any) {
      // Log error without exposing secret details
      logger.error('Failed to retrieve secret from AWS Secrets Manager', {
        secretName,
        errorCode: error.Code,
        errorMessage: error.message,
      });

      // Provide actionable error messages
      if (error.name === 'ResourceNotFoundException') {
        throw new Error(
          `Secret not found in AWS Secrets Manager: ${secretName}. ` +
          'Please create the secret using AWS CLI or Console.'
        );
      }

      if (error.name === 'AccessDeniedException') {
        throw new Error(
          `Access denied to secret: ${secretName}. ` +
          'Check IAM permissions for secretsmanager:GetSecretValue.'
        );
      }

      if (error.name === 'InvalidRequestException') {
        throw new Error(
          `Invalid request for secret: ${secretName}. ` +
          'Check secret name format and region.'
        );
      }

      throw new Error(`Failed to retrieve secret: ${secretName}`);
    }
  }

  /**
   * Retrieves PEMS API credentials for an organization
   *
   * Secret naming convention: pfa-vanguard/pems/{organizationId}
   *
   * Expected secret format (JSON):
   * {
   *   "apiUrl": "https://pems.example.com/api",
   *   "apiKey": "encrypted-key-here",
   *   "username": "optional-username",
   *   "password": "optional-password"
   * }
   *
   * @param organizationId - Organization UUID
   * @returns PEMS credentials object
   */
  async getPemsCredentials(organizationId: string): Promise<PemsCredentials> {
    const secretName = `pfa-vanguard/pems/${organizationId}`;

    try {
      const secretJson = await this.getSecret(secretName);
      const credentials = JSON.parse(secretJson) as PemsCredentials;

      // Validate required fields
      if (!credentials.apiUrl || !credentials.apiKey) {
        throw new Error(
          `Invalid PEMS credentials format in secret: ${secretName}. ` +
          'Required fields: apiUrl, apiKey'
        );
      }

      logger.info('PEMS credentials retrieved successfully', {
        organizationId,
        apiUrl: credentials.apiUrl, // Safe to log URL
      });

      return credentials;
    } catch (error: any) {
      logger.error('Failed to retrieve PEMS credentials', {
        organizationId,
        error: error.message,
      });

      throw new Error(
        `Failed to retrieve PEMS credentials for organization: ${organizationId}. ` +
        'Verify the secret exists and has correct format in AWS Secrets Manager.'
      );
    }
  }

  /**
   * Retrieves AI provider API key (Gemini, OpenAI, Anthropic)
   *
   * Secret naming convention: pfa-vanguard/ai/{provider}
   * Example: pfa-vanguard/ai/gemini
   *
   * @param provider - AI provider name (gemini, openai, anthropic)
   * @returns API key string
   */
  async getAiApiKey(provider: string): Promise<string> {
    const secretName = `pfa-vanguard/ai/${provider}`;

    try {
      const apiKey = await this.getSecret(secretName);

      if (!apiKey || apiKey.trim().length === 0) {
        throw new Error(`AI API key is empty for provider: ${provider}`);
      }

      logger.info('AI API key retrieved successfully', { provider });
      return apiKey.trim();
    } catch (error: any) {
      logger.error('Failed to retrieve AI API key', {
        provider,
        error: error.message,
      });

      throw new Error(
        `Failed to retrieve AI API key for provider: ${provider}. ` +
        'Verify the secret exists in AWS Secrets Manager.'
      );
    }
  }

  /**
   * Invalidates cached secret (forces refresh on next access)
   *
   * Use this when you know a secret has been rotated.
   *
   * @param secretName - Secret name to invalidate
   */
  invalidateCache(secretName: string): void {
    this.cache.delete(secretName);
    logger.info('Secret cache invalidated', { secretName });
  }

  /**
   * Clears entire secret cache
   *
   * Use this sparingly, typically during application shutdown
   * or after mass secret rotation.
   */
  clearCache(): void {
    const cacheSize = this.cache.size;
    this.cache.clear();
    logger.info('Entire secret cache cleared', { previousSize: cacheSize });
  }
}

// Export singleton instance
export const secretsService = new SecretsService();
