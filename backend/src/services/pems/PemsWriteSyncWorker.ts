/**
 * PEMS Write Sync Worker
 *
 * Background worker that processes the write queue and syncs changes to PEMS.
 * Handles batching, rate limiting, conflict detection, and error recovery.
 *
 * Phase 2, Track A - Task 2A.5: Write Sync Worker
 */

import prisma from '../../config/database';
import { logger } from '../../utils/logger';
import { PemsWriteApiClient } from './PemsWriteApiClient';
import { conflictDetectionService } from './ConflictDetectionService';
import { pfaValidationService } from '../pfa/PfaValidationService';

export interface WorkerStats {
  batchId: string;
  startedAt: Date;
  completedAt?: Date;
  totalProcessed: number;
  successful: number;
  failed: number;
  conflicts: number;
  skipped: number;
}

export class PemsWriteSyncWorker {
  private readonly BATCH_SIZE = 100;
  private readonly MAX_CONCURRENT_REQUESTS = 10; // Rate limit: 10 req/sec
  private isRunning = false;
  private currentBatchId: string | null = null;

  /**
   * Start the worker (called by cron job)
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Worker already running, skipping');
      return;
    }

    this.isRunning = true;
    logger.info('PEMS Write Sync Worker started');

    try {
      await this.processQueue();
    } catch (error) {
      logger.error('Worker error', { error });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process pending items in the write queue
   */
  private async processQueue(): Promise<WorkerStats> {
    const batchId = `batch-${Date.now()}`;
    this.currentBatchId = batchId;

    const stats: WorkerStats = {
      batchId,
      startedAt: new Date(),
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      conflicts: 0,
      skipped: 0
    };

    logger.info('Processing write queue', { batchId });

    try {
      // Get pending items (oldest first, up to batch size)
      const pendingItems = await prisma.pfa_write_queue.findMany({
        where: {
          status: { in: ['pending', 'queued'] },
          scheduledAt: { lte: new Date() }
        },
        orderBy: [
          { priority: 'desc' }, // High priority first
          { scheduledAt: 'asc' } // Oldest first
        ],
        take: this.BATCH_SIZE,
        include: {
          modification: {
            include: {
              pfa_mirror: true,
              users: true
            }
          }
        }
      });

      if (pendingItems.length === 0) {
        logger.info('No pending items in write queue');
        stats.completedAt = new Date();
        return stats;
      }

      logger.info(`Processing ${pendingItems.length} items`, { batchId });

      // Group items by organization for API client reuse
      const itemsByOrg = new Map<string, typeof pendingItems>();
      for (const item of pendingItems) {
        const orgId = item.organizationId;
        if (!itemsByOrg.has(orgId)) {
          itemsByOrg.set(orgId, []);
        }
        itemsByOrg.get(orgId)!.push(item);
      }

      // Process each organization's items
      for (const [orgId, items] of itemsByOrg.entries()) {
        logger.info(`Processing ${items.length} items for organization ${orgId}`);

        try {
          // Get organization's API configuration
          const organization = await prisma.organizations.findUnique({
            where: { id: orgId },
            include: {
              api_servers: {
                where: { isActive: true },
                include: {
                  api_endpoints: {
                    where: {
                      entity: 'PFA',
                      operationType: 'write',
                      isActive: true
                    }
                  }
                }
              }
            }
          });

          if (!organization) {
            logger.error(`Organization ${orgId} not found`);
            await this.markItemsFailed(items, 'Organization not found');
            stats.failed += items.length;
            continue;
          }

          // Find write-enabled API server
          const writeServer = organization.api_servers.find(
            (server: any) => server.api_endpoints.length > 0
          );

          if (!writeServer) {
            logger.warn(`No write API configured for organization ${organization.code}`);
            await this.markItemsSkipped(items, 'No write API configured');
            stats.skipped += items.length;
            continue;
          }

          // Create API client
          const apiClient = await PemsWriteApiClient.fromApiConfig(
            writeServer.id,
            orgId
          );

          // Process items with rate limiting
          await this.processItemsWithRateLimit(items, apiClient, stats);

        } catch (error) {
          logger.error(`Failed to process items for organization ${orgId}`, { error });
          await this.markItemsFailed(items, error instanceof Error ? error.message : 'Unknown error');
          stats.failed += items.length;
        }
      }

      stats.totalProcessed = pendingItems.length;
      stats.completedAt = new Date();

      logger.info('Write queue processing completed', {
        batchId,
        stats
      });

      return stats;

    } catch (error) {
      logger.error('Failed to process write queue', { error });
      stats.completedAt = new Date();
      return stats;
    }
  }

  /**
   * Process queue items with rate limiting
   */
  private async processItemsWithRateLimit(
    items: any[],
    apiClient: PemsWriteApiClient,
    stats: WorkerStats
  ): Promise<void> {
    // Process in chunks to respect rate limit (10 req/sec)
    const chunkSize = this.MAX_CONCURRENT_REQUESTS;

    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);

      // Process chunk in parallel
      await Promise.all(
        chunk.map(item => this.processQueueItem(item, apiClient, stats))
      );

      // Wait 1 second before next chunk (rate limiting)
      if (i + chunkSize < items.length) {
        await this.sleep(1000);
      }
    }
  }

  /**
   * Process a single queue item
   */
  private async processQueueItem(
    item: any,
    apiClient: PemsWriteApiClient,
    stats: WorkerStats
  ): Promise<void> {
    logger.info('Processing queue item', {
      queueItemId: item.id,
      pfaId: item.pfaId,
      operation: item.operation
    });

    try {
      // Mark as processing
      await prisma.pfa_write_queue.update({
        where: { id: item.id },
        data: {
          status: 'processing',
          lastAttemptAt: new Date()
        }
      });

      // Broadcast processing event via WebSocket
      this.broadcastSyncEvent({
        type: 'SYNC_PROCESSING',
        pfaId: item.pfaId,
        organizationId: item.organizationId,
        timestamp: new Date()
      });

      const modification = item.modification;
      const mirror = modification.pfa_mirror;

      // Detect conflicts BEFORE attempting write
      const conflictResult = await conflictDetectionService.detectConflict(
        modification.id
      );

      if (conflictResult.hasConflict) {
        logger.warn('Conflict detected, skipping sync', {
          queueItemId: item.id,
          conflictId: conflictResult.conflict?.id
        });

        await prisma.pfa_write_queue.update({
          where: { id: item.id },
          data: {
            status: 'failed',
            lastError: 'Version conflict detected - user resolution required',
            completedAt: new Date()
          }
        });

        // Broadcast conflict event via WebSocket
        this.broadcastSyncEvent({
          type: 'SYNC_CONFLICT',
          pfaId: item.pfaId,
          organizationId: item.organizationId,
          timestamp: new Date(),
          details: {
            conflictId: conflictResult.conflict?.id,
            conflictingFields: conflictResult.conflict?.conflictFields
          }
        });

        stats.conflicts++;
        return;
      }

      // Validate modification data
      const validation = pfaValidationService.validateModification(item.payload);
      if (!validation.valid) {
        logger.error('Validation failed', {
          queueItemId: item.id,
          errors: validation.errors
        });

        await prisma.pfa_write_queue.update({
          where: { id: item.id },
          data: {
            status: 'failed',
            lastError: `Validation failed: ${validation.errors.map((e: any) => e.message).join(', ')}`,
            completedAt: new Date()
          }
        });

        stats.failed++;
        return;
      }

      // Perform write operation
      const result = await apiClient.updatePfa({
        pfaId: item.pfaId,
        organizationCode: mirror.data.organization || '',
        changes: item.payload,
        version: mirror.version,
        modifiedBy: modification.users.username,
        changeReason: modification.changeReason || undefined
      });

      if (result.success) {
        // Success - update modification and mirror
        await prisma.$transaction(async (tx) => {
          // Update modification as synced
          await tx.pfa_modification.update({
            where: { id: modification.id },
            data: {
              syncStatus: 'synced',
              syncedAt: new Date(),
              pemsVersion: result.newVersion
            }
          });

          // Update mirror with new PEMS version
          if (result.newVersion) {
            // Archive current mirror version
            await tx.pfa_mirror_history.create({
              data: {
                id: `${mirror.id}-${Date.now()}`,
                pfa_mirror: { connect: { id: mirror.id } },
                version: mirror.version,
                organizationId: mirror.organizationId,
                data: mirror.data,
                pfaId: mirror.pfaId,
                category: mirror.category,
                class: mirror.class,
                source: mirror.source,
                dor: mirror.dor,
                areaSilo: mirror.areaSilo,
                manufacturer: mirror.manufacturer,
                model: mirror.model,
                monthlyRate: mirror.monthlyRate,
                purchasePrice: mirror.purchasePrice,
                forecastStart: mirror.forecastStart,
                forecastEnd: mirror.forecastEnd,
                originalStart: mirror.originalStart,
                originalEnd: mirror.originalEnd,
                actualStart: mirror.actualStart,
                actualEnd: mirror.actualEnd,
                isActualized: mirror.isActualized,
                isDiscontinued: mirror.isDiscontinued,
                isFundsTransferable: mirror.isFundsTransferable,
                hasPlan: mirror.hasPlan,
                hasActuals: mirror.hasActuals,
                pemsVersion: mirror.pemsVersion,
                syncBatchId: mirror.syncBatchId,
                changedBy: modification.users.username,
                changeReason: modification.changeReason || 'Write sync to PEMS'
              }
            });

            // Apply changes to mirror
            const updatedData = { ...mirror.data, ...item.payload };

            await tx.pfa_mirror.update({
              where: { id: mirror.id },
              data: {
                data: updatedData,
                version: result.newVersion,
                pemsVersion: result.updatedAt,
                lastSyncedAt: new Date(),
                // Update indexed fields
                ...this.extractIndexedFields(updatedData)
              }
            });
          }

          // Mark queue item as completed
          await tx.pfa_write_queue.update({
            where: { id: item.id },
            data: {
              status: 'completed',
              completedAt: new Date()
            }
          });
        });

        logger.info('Queue item processed successfully', {
          queueItemId: item.id,
          pfaId: item.pfaId,
          newVersion: result.newVersion
        });

        // Broadcast success event via WebSocket
        this.broadcastSyncEvent({
          type: 'SYNC_SUCCESS',
          pfaId: item.pfaId,
          organizationId: item.organizationId,
          timestamp: new Date(),
          details: { newVersion: result.newVersion }
        });

        stats.successful++;

      } else {
        // Handle failure
        const shouldRetry = this.shouldRetry(item, result);

        if (shouldRetry) {
          // Increment retry count and reschedule
          const nextRetry = new Date(
            Date.now() + this.calculateRetryDelay(item.retryCount)
          );

          await prisma.pfa_write_queue.update({
            where: { id: item.id },
            data: {
              status: 'pending',
              retryCount: item.retryCount + 1,
              lastError: result.error || 'Unknown error',
              scheduledAt: nextRetry
            }
          });

          logger.warn('Queue item failed, will retry', {
            queueItemId: item.id,
            retryCount: item.retryCount + 1,
            nextRetry
          });

        } else {
          // Max retries exceeded or non-retryable error
          await prisma.pfa_write_queue.update({
            where: { id: item.id },
            data: {
              status: 'failed',
              lastError: result.error || 'Unknown error',
              completedAt: new Date()
            }
          });

          // Update modification status
          await prisma.pfa_modification.update({
            where: { id: modification.id },
            data: {
              syncStatus: 'sync_error',
              syncError: result.error
            }
          });

          logger.error('Queue item failed permanently', {
            queueItemId: item.id,
            pfaId: item.pfaId,
            error: result.error
          });

          // Broadcast failure event via WebSocket
          this.broadcastSyncEvent({
            type: 'SYNC_FAILED',
            pfaId: item.pfaId,
            organizationId: item.organizationId,
            timestamp: new Date(),
            details: {
              error: result.error,
              retryCount: item.retryCount
            }
          });

          stats.failed++;
        }
      }

    } catch (error) {
      logger.error('Error processing queue item', {
        queueItemId: item.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Mark as failed if max retries exceeded
      if (item.retryCount >= item.maxRetries) {
        await prisma.pfa_write_queue.update({
          where: { id: item.id },
          data: {
            status: 'failed',
            lastError: error instanceof Error ? error.message : 'Unknown error',
            completedAt: new Date()
          }
        });
        stats.failed++;
      } else {
        // Retry
        await prisma.pfa_write_queue.update({
          where: { id: item.id },
          data: {
            status: 'pending',
            retryCount: item.retryCount + 1,
            lastError: error instanceof Error ? error.message : 'Unknown error',
            scheduledAt: new Date(Date.now() + this.calculateRetryDelay(item.retryCount))
          }
        });
      }
    }
  }

  /**
   * Determine if a failed item should be retried
   */
  private shouldRetry(item: any, result: any): boolean {
    // Max retries exceeded
    if (item.retryCount >= item.maxRetries) {
      return false;
    }

    // Non-retryable errors (400, 401, 404, 409)
    const nonRetryableErrors = [
      'INVALID_REQUEST',
      'UNAUTHORIZED',
      'NOT_FOUND',
      'VERSION_CONFLICT'
    ];

    if (result.errorCode && nonRetryableErrors.includes(result.errorCode)) {
      return false;
    }

    // Retry for server errors and rate limits
    return true;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = 5000; // 5 seconds
    return baseDelay * Math.pow(2, retryCount);
  }

  /**
   * Extract indexed fields from JSONB data for mirror table
   */
  private extractIndexedFields(data: any): any {
    return {
      category: data.category || null,
      class: data.class || null,
      source: data.source || null,
      dor: data.dor || null,
      areaSilo: data.areaSilo || null,
      manufacturer: data.manufacturer || null,
      model: data.model || null,
      monthlyRate: data.monthlyRate || null,
      purchasePrice: data.purchasePrice || null,
      forecastStart: data.forecastStart ? new Date(data.forecastStart) : null,
      forecastEnd: data.forecastEnd ? new Date(data.forecastEnd) : null,
      originalStart: data.originalStart ? new Date(data.originalStart) : null,
      originalEnd: data.originalEnd ? new Date(data.originalEnd) : null,
      actualStart: data.actualStart ? new Date(data.actualStart) : null,
      actualEnd: data.actualEnd ? new Date(data.actualEnd) : null,
      isActualized: data.isActualized || false,
      isDiscontinued: data.isDiscontinued || false,
      isFundsTransferable: data.isFundsTransferable || false,
      hasPlan: data.hasPlan || false,
      hasActuals: data.hasActuals || false
    };
  }

  /**
   * Mark items as failed
   */
  private async markItemsFailed(items: any[], error: string): Promise<void> {
    await prisma.pfa_write_queue.updateMany({
      where: {
        id: { in: items.map(i => i.id) }
      },
      data: {
        status: 'failed',
        lastError: error,
        completedAt: new Date()
      }
    });
  }

  /**
   * Mark items as skipped
   */
  private async markItemsSkipped(items: any[], reason: string): Promise<void> {
    await prisma.pfa_write_queue.updateMany({
      where: {
        id: { in: items.map(i => i.id) }
      },
      data: {
        status: 'failed',
        lastError: `Skipped: ${reason}`,
        completedAt: new Date()
      }
    });
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Broadcast sync event via WebSocket
   */
  private broadcastSyncEvent(event: {
    type: 'SYNC_QUEUED' | 'SYNC_PROCESSING' | 'SYNC_SUCCESS' | 'SYNC_CONFLICT' | 'SYNC_FAILED';
    pfaId: string;
    organizationId: string;
    timestamp: Date;
    details?: any;
  }): void {
    try {
      // Access WebSocket server from global
      const syncWebSocketServer = (global as any).syncWebSocketServer;
      if (syncWebSocketServer) {
        syncWebSocketServer.broadcast(event.organizationId, event);
      }
    } catch (error) {
      logger.error('Failed to broadcast sync event', { error, event });
    }
  }

  /**
   * Get current worker status
   */
  getStatus(): { isRunning: boolean; currentBatchId: string | null } {
    return {
      isRunning: this.isRunning,
      currentBatchId: this.currentBatchId
    };
  }
}

export const pemsWriteSyncWorker = new PemsWriteSyncWorker();
