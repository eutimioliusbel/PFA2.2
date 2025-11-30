/**
 * PEMS Write API Client
 *
 * Handles all write operations to external PEMS system.
 * Implements retry logic, error mapping, and proper timeout handling.
 *
 * Phase 2, Track A - Task 2A.1: PEMS Write API Client
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '../../utils/logger';
import { decrypt } from '../../utils/encryption';
import prisma from '../../config/database';

export interface PemsUpdateRequest {
  pfaId: string;
  organizationCode: string;
  changes: {
    forecastStart?: string;
    forecastEnd?: string;
    monthlyRate?: number;
    purchasePrice?: number;
    dor?: 'BEO' | 'PROJECT';
    category?: string;
    class?: string;
    source?: 'Rental' | 'Purchase';
    manufacturer?: string;
    model?: string;
    isDiscontinued?: boolean;
    isFundsTransferable?: boolean;
  };
  version: number;
  modifiedBy: string;
  changeReason?: string;
}

export interface PemsUpdateResponse {
  success: boolean;
  pfaId: string;
  newVersion?: number;
  updatedAt?: string;
  message?: string;
  error?: string;
  errorCode?: string;
  currentVersion?: number;
  expectedVersion?: number;
  conflictingFields?: string[];
}

export interface PemsDeleteRequest {
  pfaId: string;
  version: number;
  modifiedBy: string;
  reason: string;
}

export interface PemsDeleteResponse {
  success: boolean;
  pfaId: string;
  message?: string;
  error?: string;
  errorCode?: string;
}

export interface PemsHealthCheckResponse {
  healthy: boolean;
  latency: number;
  error?: string;
}

export class PemsWriteError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode: string,
    public retryable: boolean
  ) {
    super(message);
    this.name = 'PemsWriteError';
  }
}

export class PemsWriteApiClient {
  private axiosInstance: AxiosInstance;
  private readonly TIMEOUT_MS = 30000; // 30 seconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_BASE_MS = 5000; // 5 seconds base delay

  constructor(
    baseUrl: string,
    username: string,
    password: string,
    tenant: string,
    private organizationCode: string
  ) {
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      timeout: this.TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'tenant': tenant,
        'organization': organizationCode,
        'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
      }
    });

    // Add request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.info('PEMS Write API Request', {
          method: config.method,
          url: config.url,
          headers: { ...config.headers, Authorization: '[REDACTED]' }
        });
        return config;
      },
      (error) => {
        logger.error('PEMS Write API Request Error', { error });
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.info('PEMS Write API Response', {
          status: response.status,
          statusText: response.statusText
        });
        return response;
      },
      (error) => {
        logger.error('PEMS Write API Response Error', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Create client from API configuration in database
   */
  static async fromApiConfig(
    apiConfigId: string,
    organizationId: string
  ): Promise<PemsWriteApiClient> {
    const config = await prisma.api_configurations.findUnique({
      where: { id: apiConfigId }
    });

    if (!config) {
      throw new Error(`API Configuration ${apiConfigId} not found`);
    }

    // Get organization details
    const organization = await prisma.organizations.findUnique({
      where: { id: organizationId }
    });

    if (!organization) {
      throw new Error(`Organization ${organizationId} not found`);
    }

    // Decrypt credentials
    let username = '';
    let password = '';
    let tenant = '';

    if (config.authKeyEncrypted) {
      username = decrypt(config.authKeyEncrypted);
    }
    if (config.authValueEncrypted) {
      password = decrypt(config.authValueEncrypted);
    }

    // Parse custom headers for tenant
    if (config.customHeaders) {
      try {
        const headers = JSON.parse(config.customHeaders);
        const tenantHeader = headers.find((h: any) => h.key === 'tenant');
        if (tenantHeader) tenant = tenantHeader.value;
      } catch (e) {
        logger.error('Failed to parse customHeaders:', e);
      }
    }

    // Check for organization-specific credentials
    const orgCredentials = await prisma.organization_api_credentials.findUnique({
      where: {
        organizationId_apiConfigurationId: {
          organizationId: organizationId,
          apiConfigurationId: apiConfigId
        }
      }
    });

    let pemsOrganizationCode = organization.code;

    // Use org-specific organization code if available
    if (orgCredentials?.customHeaders) {
      try {
        const headers = JSON.parse(orgCredentials.customHeaders);
        const orgHeader = headers.find((h: any) => h.key === 'organization');
        if (orgHeader) {
          pemsOrganizationCode = orgHeader.value;
        }
      } catch (e) {
        logger.error('Failed to parse org-specific customHeaders:', e);
      }
    }

    if (!username || !password) {
      throw new Error('PEMS credentials not configured');
    }

    return new PemsWriteApiClient(
      config.url,
      username,
      password,
      tenant,
      pemsOrganizationCode
    );
  }

  /**
   * Update a PFA record in PEMS
   */
  async updatePfa(request: PemsUpdateRequest): Promise<PemsUpdateResponse> {
    logger.info('Updating PFA in PEMS', {
      pfaId: request.pfaId,
      version: request.version,
      fields: Object.keys(request.changes)
    });

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const response = await this.axiosInstance.put(
          `/api/pems/pfa/${request.pfaId}`,
          request
        );

        const result: PemsUpdateResponse = {
          success: true,
          pfaId: request.pfaId,
          newVersion: response.data.newVersion,
          updatedAt: response.data.updatedAt,
          message: response.data.message
        };

        logger.info('PFA updated successfully in PEMS', {
          pfaId: request.pfaId,
          newVersion: result.newVersion
        });

        return result;

      } catch (error) {
        const axiosError = error as AxiosError;
        lastError = error as Error;

        // Map error to our error structure
        const mappedError = this.mapError(axiosError);

        // Handle version conflict (409) - no retry
        if (axiosError.response?.status === 409) {
          const conflictData = axiosError.response.data as any;
          return {
            success: false,
            pfaId: request.pfaId,
            error: mappedError.message,
            errorCode: 'VERSION_CONFLICT',
            currentVersion: conflictData.currentVersion,
            expectedVersion: request.version,
            conflictingFields: conflictData.conflictingFields
          };
        }

        // Don't retry for client errors (400, 401, 404)
        if (!mappedError.retryable) {
          logger.error('Non-retryable error updating PFA', {
            pfaId: request.pfaId,
            error: mappedError.message,
            statusCode: mappedError.statusCode
          });

          return {
            success: false,
            pfaId: request.pfaId,
            error: mappedError.message,
            errorCode: mappedError.errorCode
          };
        }

        // Retry for server errors (5xx) or rate limit (429)
        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY_BASE_MS * Math.pow(2, attempt - 1); // Exponential backoff
          logger.warn(`Retrying PFA update (attempt ${attempt + 1}/${this.MAX_RETRIES}) after ${delay}ms`, {
            pfaId: request.pfaId,
            error: mappedError.message
          });
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    logger.error('Failed to update PFA after all retries', {
      pfaId: request.pfaId,
      error: lastError?.message
    });

    return {
      success: false,
      pfaId: request.pfaId,
      error: lastError?.message || 'Unknown error',
      errorCode: 'MAX_RETRIES_EXCEEDED'
    };
  }

  /**
   * Delete a PFA record in PEMS (soft delete - mark discontinued)
   */
  async deletePfa(request: PemsDeleteRequest): Promise<PemsDeleteResponse> {
    logger.info('Deleting PFA in PEMS', {
      pfaId: request.pfaId,
      version: request.version,
      reason: request.reason
    });

    // PEMS doesn't support hard delete - we mark as discontinued
    const updateRequest: PemsUpdateRequest = {
      pfaId: request.pfaId,
      organizationCode: this.organizationCode,
      changes: {
        isDiscontinued: true
      },
      version: request.version,
      modifiedBy: request.modifiedBy,
      changeReason: `Deleted: ${request.reason}`
    };

    const updateResult = await this.updatePfa(updateRequest);

    return {
      success: updateResult.success,
      pfaId: request.pfaId,
      message: updateResult.success
        ? `PFA marked as discontinued in PEMS`
        : updateResult.error,
      error: updateResult.error,
      errorCode: updateResult.errorCode
    };
  }

  /**
   * Health check for PEMS write endpoint
   */
  async healthCheck(): Promise<PemsHealthCheckResponse> {
    const startTime = Date.now();

    try {
      // Simple GET request to check if PEMS is reachable
      await this.axiosInstance.get('/api/pems/health', {
        timeout: 5000 // 5 second timeout for health check
      });

      const latency = Date.now() - startTime;

      return {
        healthy: true,
        latency
      };

    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.warn('PEMS health check failed', {
        error: errorMessage,
        latency
      });

      return {
        healthy: false,
        latency,
        error: errorMessage
      };
    }
  }

  /**
   * Map axios error to our error structure
   */
  private mapError(error: AxiosError): PemsWriteError {
    const status = error.response?.status || 500;
    const responseData = error.response?.data as any;

    switch (status) {
      case 400:
        return new PemsWriteError(
          responseData?.message || 'Invalid request',
          400,
          'INVALID_REQUEST',
          false
        );

      case 401:
        return new PemsWriteError(
          'Unauthorized - invalid credentials',
          401,
          'UNAUTHORIZED',
          false
        );

      case 404:
        return new PemsWriteError(
          'PFA record not found in PEMS',
          404,
          'NOT_FOUND',
          false
        );

      case 409:
        return new PemsWriteError(
          'Version conflict - record has been modified',
          409,
          'VERSION_CONFLICT',
          false
        );

      case 429:
        return new PemsWriteError(
          'Rate limit exceeded',
          429,
          'RATE_LIMIT',
          true // Retryable
        );

      case 500:
        return new PemsWriteError(
          'PEMS server error',
          500,
          'SERVER_ERROR',
          true // Retryable
        );

      case 503:
        return new PemsWriteError(
          'PEMS service unavailable',
          503,
          'SERVICE_UNAVAILABLE',
          true // Retryable
        );

      default:
        return new PemsWriteError(
          responseData?.message || error.message || 'Unknown error',
          status,
          'UNKNOWN_ERROR',
          status >= 500 // Retry on 5xx errors
        );
    }
  }

  /**
   * Sleep utility for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
