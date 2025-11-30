/**
 * Retry Service
 * Enhancement: Automatic retry with exponential backoff for failed syncs
 *
 * Implements retry logic for transformation failures with:
 * - Exponential backoff (2^attempt * baseDelay)
 * - Maximum retry attempts (default: 3)
 * - Persistent retry tracking in database
 */

import prisma from '../../config/database';
import { logger } from '../../utils/logger';
import { PemsTransformationService } from './PemsTransformationService';

export interface RetryConfig {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export interface RetryStatus {
  syncBatchId: string;
  attemptNumber: number;
  totalAttempts: number;
  nextRetryAt: Date | null;
  status: 'pending' | 'retrying' | 'succeeded' | 'failed';
  lastError?: string;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  baseDelayMs: 5000, // 5 seconds
  maxDelayMs: 300000, // 5 minutes
};

export class RetryService {
  private transformationService: PemsTransformationService;
  private config: Required<RetryConfig>;

  constructor(config: RetryConfig = {}) {
    this.transformationService = new PemsTransformationService();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate delay for next retry using exponential backoff
   */
  private calculateDelay(attemptNumber: number): number {
    const delay = this.config.baseDelayMs * Math.pow(2, attemptNumber - 1);
    return Math.min(delay, this.config.maxDelayMs);
  }

  /**
   * Queue a sync batch for retry
   */
  async queueRetry(syncBatchId: string, transformedBy?: string): Promise<RetryStatus> {
    logger.info(`[RETRY] Queuing sync batch for retry`, { syncBatchId });

    const batch = await prisma.bronze_batches.findUnique({
      where: { syncBatchId },
    });

    if (!batch) {
      throw new Error(`Sync batch not found: ${syncBatchId}`);
    }

    if (!batch.completedAt) {
      throw new Error('Cannot retry a sync job that is still running');
    }

    if (batch.invalidRecordCount === 0) {
      throw new Error('No errors to retry');
    }

    // Check current retry metadata
    const metadata = (batch.metadata as any) || {};
    const currentAttempt = (metadata.retryAttempt || 0) + 1;

    if (currentAttempt > this.config.maxAttempts) {
      throw new Error(`Maximum retry attempts (${this.config.maxAttempts}) exceeded`);
    }

    const delay = this.calculateDelay(currentAttempt);
    const nextRetryAt = new Date(Date.now() + delay);

    // Update batch with retry metadata
    await prisma.bronze_batches.update({
      where: { syncBatchId },
      data: {
        metadata: {
          ...metadata,
          retryAttempt: currentAttempt,
          retryScheduledAt: nextRetryAt.toISOString(),
          retryStatus: 'pending',
          retryTriggeredBy: transformedBy || 'system',
        },
      },
    });

    logger.info(`[RETRY] Scheduled retry attempt ${currentAttempt}/${this.config.maxAttempts}`, {
      syncBatchId,
      nextRetryAt,
      delayMs: delay,
    });

    // Schedule the retry
    setTimeout(() => {
      this.executeRetry(syncBatchId, transformedBy).catch((error) => {
        logger.error(`[RETRY] Failed to execute retry`, { syncBatchId, error });
      });
    }, delay);

    return {
      syncBatchId,
      attemptNumber: currentAttempt,
      totalAttempts: this.config.maxAttempts,
      nextRetryAt,
      status: 'pending',
    };
  }

  /**
   * Execute retry for a sync batch
   */
  private async executeRetry(syncBatchId: string, transformedBy?: string): Promise<void> {
    logger.info(`[RETRY] Executing retry`, { syncBatchId });

    try {
      // Update status to retrying
      await prisma.bronze_batches.update({
        where: { syncBatchId },
        data: {
          metadata: {
            ...((await prisma.bronze_batches.findUnique({ where: { syncBatchId } }))?.metadata as any),
            retryStatus: 'retrying',
            retryStartedAt: new Date().toISOString(),
          },
        },
      });

      // Re-run transformation
      const result = await this.transformationService.transformBatch(syncBatchId, {
        transformedBy: transformedBy || 'RetryService',
      });

      if (result.success && result.errors.length === 0) {
        // Success - clear retry metadata
        await prisma.bronze_batches.update({
          where: { syncBatchId },
          data: {
            metadata: {
              ...((await prisma.bronze_batches.findUnique({ where: { syncBatchId } }))?.metadata as any),
              retryStatus: 'succeeded',
              retryCompletedAt: new Date().toISOString(),
            },
          },
        });

        logger.info(`[RETRY] Successfully recovered sync batch`, { syncBatchId, result });
      } else {
        // Still has errors - may retry again if under max attempts
        const batch = await prisma.bronze_batches.findUnique({ where: { syncBatchId } });
        const metadata = (batch?.metadata as any) || {};
        const currentAttempt = metadata.retryAttempt || 0;

        if (currentAttempt < this.config.maxAttempts) {
          logger.warn(`[RETRY] Retry failed, will attempt again`, {
            syncBatchId,
            attempt: currentAttempt,
            errors: result.errors.length,
          });
          // Queue another retry
          await this.queueRetry(syncBatchId, transformedBy);
        } else {
          // Max attempts reached
          await prisma.bronze_batches.update({
            where: { syncBatchId },
            data: {
              metadata: {
                ...metadata,
                retryStatus: 'failed',
                retryCompletedAt: new Date().toISOString(),
                finalError: 'Maximum retry attempts exceeded',
              },
            },
          });

          logger.error(`[RETRY] Maximum retry attempts exceeded`, {
            syncBatchId,
            attempts: this.config.maxAttempts,
          });
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[RETRY] Retry execution failed`, { syncBatchId, error: errorMessage });

      // Update with failure
      await prisma.bronze_batches.update({
        where: { syncBatchId },
        data: {
          metadata: {
            ...((await prisma.bronze_batches.findUnique({ where: { syncBatchId } }))?.metadata as any),
            retryStatus: 'failed',
            retryCompletedAt: new Date().toISOString(),
            lastError: errorMessage,
          },
        },
      });
    }
  }

  /**
   * Get retry status for a sync batch
   */
  async getRetryStatus(syncBatchId: string): Promise<RetryStatus | null> {
    const batch = await prisma.bronze_batches.findUnique({
      where: { syncBatchId },
    });

    if (!batch) {
      return null;
    }

    const metadata = (batch.metadata as any) || {};
    const attemptNumber = metadata.retryAttempt || 0;
    const status = metadata.retryStatus || 'pending';
    const nextRetryAt = metadata.retryScheduledAt ? new Date(metadata.retryScheduledAt) : null;

    return {
      syncBatchId,
      attemptNumber,
      totalAttempts: this.config.maxAttempts,
      nextRetryAt,
      status,
      lastError: metadata.lastError,
    };
  }

  /**
   * Cancel pending retry
   */
  async cancelRetry(syncBatchId: string): Promise<void> {
    const batch = await prisma.bronze_batches.findUnique({
      where: { syncBatchId },
    });

    if (!batch) {
      throw new Error(`Sync batch not found: ${syncBatchId}`);
    }

    const metadata = (batch.metadata as any) || {};

    await prisma.bronze_batches.update({
      where: { syncBatchId },
      data: {
        metadata: {
          ...metadata,
          retryStatus: 'cancelled',
          retryCancelledAt: new Date().toISOString(),
        },
      },
    });

    logger.info(`[RETRY] Cancelled retry for sync batch`, { syncBatchId });
  }
}
