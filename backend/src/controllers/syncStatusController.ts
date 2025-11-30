/**
 * Sync Status Controller
 * ADR-007, Phase 5, Task 5.4 - Sync Status Dashboard Component
 *
 * Provides real-time sync job status for Bronze ingestion + Silver transformation
 */

import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { handleControllerError } from '../utils/errorHandling';
import { RetryService } from '../services/pems/RetryService';

/**
 * Sync job status (mirrors the sync workflow states)
 */
export type SyncJobStatus = 'queued' | 'ingesting' | 'transforming' | 'completed' | 'failed';

/**
 * Sync job progress information
 */
interface SyncProgress {
  percentage: number;
  processed: number;
  total: number;
  inserted: number;
  updated: number;
  errors: number;
}

/**
 * Sync job timing information
 */
interface SyncTiming {
  startedAt: string;
  completedAt?: string;
  duration: string; // Human-readable (e.g., "2m 34s")
}

/**
 * Sync job information
 */
export interface SyncJob {
  syncBatchId: string;
  endpointName: string;
  organizationId: string;
  organizationName: string;
  status: SyncJobStatus;
  progress: SyncProgress;
  timing: SyncTiming;
  error?: string;
}

/**
 * Response format for GET /api/sync/status
 */
interface SyncStatusResponse {
  activeSyncs: SyncJob[];
  recentHistory: SyncJob[];
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;

  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

/**
 * Calculate progress percentage
 */
function calculatePercentage(processed: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(Math.round((processed / total) * 100), 100);
}

/**
 * Determine sync job status based on batch metadata
 */
function determineSyncStatus(batch: { completedAt: Date | null; _count?: { bronze_records?: number }; recordCount: number }, hasErrors: boolean): SyncJobStatus {
  if (batch.completedAt) {
    return hasErrors ? 'failed' : 'completed';
  }

  // Check if transformation has started (DataLineage records exist)
  const hasLineageRecords = batch._count?.bronze_records ? batch._count.bronze_records > 0 : false;

  if (hasLineageRecords) {
    return 'transforming';
  }

  // If Bronze records exist but no lineage, we're ingesting
  const hasBronzeRecords = batch.recordCount > 0;

  if (hasBronzeRecords) {
    return 'ingesting';
  }

  return 'queued';
}

/**
 * GET /api/sync/status
 * Get active and recent sync job statuses
 */
export const getSyncStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Fetching sync job statuses');

    // Fetch recent Bronze batches (last 10 completed + all active)
    const recentBatches = await prisma.bronze_batches.findMany({
      where: {
        ingestedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      include: {
        _count: {
          select: {
            bronze_records: true
          }
        }
      },
      orderBy: {
        ingestedAt: 'desc'
      },
      take: 20 // Fetch more than needed, filter below
    });

    logger.info(`Found ${recentBatches.length} recent sync batches`);

    // Build sync jobs
    const syncJobs: SyncJob[] = await Promise.all(
      recentBatches.map(async (batch) => {
        // Fetch organization and endpoint data
        const [organization, endpoint] = await Promise.all([
          prisma.organizations.findUnique({
            where: { id: batch.organizationId },
            select: { name: true }
          }),
          prisma.api_endpoints.findUnique({
            where: { id: batch.endpointId },
            select: { name: true }
          })
        ]);

        // Count transformed records (Silver layer)
        const transformedCount = await prisma.data_lineage.count({
          where: {
            bronzeRecordId: {
              in: (await prisma.bronze_records.findMany({
                where: { syncBatchId: batch.syncBatchId },
                select: { id: true }
              })).map(r => r.id)
            }
          }
        });

        const processed = transformedCount;
        const total = batch.recordCount;
        const inserted = batch.validRecordCount - transformedCount; // Records waiting to be transformed
        const updated = transformedCount;
        const errors = batch.invalidRecordCount;

        const hasErrors = errors > 0;

        // Calculate duration
        const startTime = batch.ingestedAt.getTime();
        const endTime = batch.completedAt?.getTime() || Date.now();
        const durationMs = endTime - startTime;

        const status = determineSyncStatus(batch, hasErrors);

        return {
          syncBatchId: batch.syncBatchId,
          endpointName: endpoint?.name || 'Unknown',
          organizationId: batch.organizationId,
          organizationName: organization?.name || 'Unknown',
          status,
          progress: {
            percentage: calculatePercentage(processed, total),
            processed,
            total,
            inserted,
            updated,
            errors
          },
          timing: {
            startedAt: batch.ingestedAt.toISOString(),
            completedAt: batch.completedAt?.toISOString(),
            duration: formatDuration(durationMs)
          },
          error: hasErrors ? `${errors} records failed validation` : undefined
        };
      })
    );

    // Split into active and completed
    const activeSyncs = syncJobs.filter(job =>
      job.status === 'queued' || job.status === 'ingesting' || job.status === 'transforming'
    );

    const recentHistory = syncJobs
      .filter(job => job.status === 'completed' || job.status === 'failed')
      .slice(0, 10); // Last 10 completed

    logger.info(`Active syncs: ${activeSyncs.length}, Recent history: ${recentHistory.length}`);

    const response: SyncStatusResponse = {
      activeSyncs,
      recentHistory
    };

    res.json(response);

  } catch (error: unknown) {
    handleControllerError(error, res, 'SyncStatusController.getSyncStatus');
  }
};

/**
 * POST /api/sync/cancel/:syncBatchId
 * Cancel a running sync job (if supported)
 */
export const cancelSync = async (req: Request, res: Response): Promise<void> => {
  try {
    const { syncBatchId } = req.params;

    logger.info(`Canceling sync job: ${syncBatchId}`);

    // Check if sync exists and is running
    const batch = await prisma.bronze_batches.findUnique({
      where: { syncBatchId }
    });

    if (!batch) {
      res.status(404).json({
        error: 'Sync job not found'
      });
      return;
    }

    if (batch.completedAt) {
      res.status(400).json({
        error: 'Sync job already completed'
      });
      return;
    }

    // Mark as cancelled (update completedAt with error metadata)
    await prisma.bronze_batches.update({
      where: { syncBatchId },
      data: {
        completedAt: new Date(),
        errors: [
          ...(Array.isArray(batch.errors) ? batch.errors : []),
          { message: 'Sync job cancelled by user', timestamp: new Date().toISOString() }
        ]
      }
    });

    logger.info(`Sync job ${syncBatchId} cancelled successfully`);

    res.json({
      success: true,
      message: 'Sync job cancelled successfully'
    });

  } catch (error: unknown) {
    handleControllerError(error, res, 'SyncStatusController.cancelSync');
  }
};

/**
 * POST /api/sync/retry/:syncBatchId
 * Retry a failed sync job with exponential backoff
 */
export const retrySync = async (req: Request, res: Response): Promise<void> => {
  try {
    const { syncBatchId } = req.params;
    const transformedBy = (req as any).user?.username || 'unknown';

    logger.info(`Retrying sync job: ${syncBatchId}`, { transformedBy });

    const retryService = new RetryService();
    const retryStatus = await retryService.queueRetry(syncBatchId, transformedBy);

    logger.info(`Sync job ${syncBatchId} queued for retry`, {
      attemptNumber: retryStatus.attemptNumber,
      totalAttempts: retryStatus.totalAttempts,
      nextRetryAt: retryStatus.nextRetryAt,
    });

    res.json({
      success: true,
      message: `Sync job queued for retry (attempt ${retryStatus.attemptNumber}/${retryStatus.totalAttempts})`,
      retryStatus,
    });

  } catch (error: unknown) {
    handleControllerError(error, res, 'SyncStatusController.retrySync');
  }
};

/**
 * GET /api/sync/retry/:syncBatchId/status
 * Get retry status for a sync job
 */
export const getRetryStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { syncBatchId } = req.params;

    const retryService = new RetryService();
    const retryStatus = await retryService.getRetryStatus(syncBatchId);

    if (!retryStatus) {
      res.status(404).json({
        error: 'Sync job not found',
      });
      return;
    }

    res.json(retryStatus);

  } catch (error: unknown) {
    handleControllerError(error, res, 'SyncStatusController.getRetryStatus');
  }
};

/**
 * DELETE /api/sync/retry/:syncBatchId
 * Cancel a pending retry
 */
export const cancelRetry = async (req: Request, res: Response): Promise<void> => {
  try {
    const { syncBatchId } = req.params;

    const retryService = new RetryService();
    await retryService.cancelRetry(syncBatchId);

    res.json({
      success: true,
      message: 'Retry cancelled successfully',
    });

  } catch (error: unknown) {
    handleControllerError(error, res, 'SyncStatusController.cancelRetry');
  }
};
