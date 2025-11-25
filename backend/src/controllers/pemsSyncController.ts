/**
 * PEMS Sync Controller
 *
 * Handles API endpoints for syncing data from PEMS
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { pemsSyncService, SyncProgress } from '../services/pems/PemsSyncService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Store active syncs in memory (in production, use Redis or database)
const activeSyncs = new Map<string, SyncProgress>();

// Batch sync tracking
interface BatchSync {
  batchId: string;
  type: 'global-api' | 'org-all-apis';
  status: 'running' | 'completed' | 'failed' | 'partial';
  startedAt: Date;
  completedAt?: Date;
  syncs: Array<{
    syncId: string;
    organizationId: string;
    apiConfigId?: string;
    status: 'running' | 'completed' | 'failed';
  }>;
  totalSyncs: number;
  completedSyncs: number;
  failedSyncs: number;
}

const activeBatches = new Map<string, BatchSync>();

/**
 * POST /api/pems/sync
 * Start a PFA data sync from PEMS
 */
export const startSync = async (req: Request, res: Response) => {
  try {
    const { organizationId, syncType = 'full', apiConfigId } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'organizationId is required'
      });
    }

    if (!apiConfigId) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'apiConfigId is required'
      });
    }

    logger.info(`Sync request received for organization ${organizationId}`);

    // Check if sync is already running for this organization
    const existingSync = Array.from(activeSyncs.values()).find(
      sync => sync.organizationId === organizationId && sync.status === 'running'
    );

    if (existingSync) {
      return res.status(409).json({
        error: 'SYNC_IN_PROGRESS',
        message: 'A sync is already running for this organization',
        syncId: existingSync.syncId,
        progress: existingSync
      });
    }

    // Generate sync ID ONCE
    const syncId = `pfa-sync-${Date.now()}`;

    // Create initial sync entry IMMEDIATELY so polling can find it
    const initialProgress: SyncProgress = {
      syncId,
      status: 'running',
      organizationId,
      totalRecords: 0,
      processedRecords: 0,
      insertedRecords: 0,
      updatedRecords: 0,
      errorRecords: 0,
      startedAt: new Date(),
      currentBatch: 0,
      totalBatches: 0
    };
    activeSyncs.set(syncId, initialProgress);

    // Start sync in background (don't await)
    pemsSyncService.syncPfaData(organizationId, syncType, syncId, apiConfigId)
      .then(async (progress) => {
        // Update the sync entry with final results
        activeSyncs.set(progress.syncId, progress);
        logger.info(`Sync completed: ${progress.syncId}`);

        // Update API configuration with sync statistics
        if (progress.status === 'completed') {
          try {
            const config = await prisma.apiConfiguration.findUnique({
              where: { id: apiConfigId }
            });

            if (config) {
              const totalRecords = (config.totalSyncRecordCount || 0) + progress.insertedRecords + progress.updatedRecords;

              await prisma.apiConfiguration.update({
                where: { id: apiConfigId },
                data: {
                  firstSyncAt: config.firstSyncAt || progress.startedAt,
                  lastSyncAt: progress.completedAt,
                  lastSyncRecordCount: progress.insertedRecords + progress.updatedRecords,
                  totalSyncRecordCount: totalRecords
                }
              });

              logger.info(`Updated sync stats for ${apiConfigId}`, {
                lastSyncRecordCount: progress.insertedRecords + progress.updatedRecords,
                totalSyncRecordCount: totalRecords
              });
            }
          } catch (error) {
            logger.error('Failed to update API config sync stats:', error);
          }
        }
      })
      .catch(error => {
        logger.error('Sync failed:', error);
        // Update sync status to failed
        const failedProgress = activeSyncs.get(syncId);
        if (failedProgress) {
          failedProgress.status = 'failed';
          failedProgress.error = error instanceof Error ? error.message : 'Unknown error';
          activeSyncs.set(syncId, failedProgress);
        }
      });

    // Return immediately with sync started message
    res.json({
      success: true,
      message: 'PFA data sync started',
      syncId: syncId,
      status: 'running'
    });

  } catch (error) {
    logger.error('Failed to start sync:', error);
    res.status(500).json({
      error: 'SYNC_ERROR',
      message: error instanceof Error ? error.message : 'Failed to start sync'
    });
  }
};

/**
 * GET /api/pems/sync/:syncId
 * Get sync progress status
 */
export const getSyncStatus = async (req: Request, res: Response) => {
  try {
    const { syncId } = req.params;

    const sync = activeSyncs.get(syncId);

    if (!sync) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Sync not found'
      });
    }

    res.json({
      syncId: sync.syncId,
      status: sync.status,
      organizationId: sync.organizationId,
      progress: {
        total: sync.totalRecords,
        processed: sync.processedRecords,
        inserted: sync.insertedRecords,
        updated: sync.updatedRecords,
        errors: sync.errorRecords,
        percentage: sync.totalRecords > 0
          ? Math.round((sync.processedRecords / sync.totalRecords) * 100)
          : 0
      },
      batch: {
        current: sync.currentBatch,
        total: sync.totalBatches
      },
      timing: {
        startedAt: sync.startedAt,
        completedAt: sync.completedAt,
        duration: sync.completedAt
          ? sync.completedAt.getTime() - sync.startedAt.getTime()
          : Date.now() - sync.startedAt.getTime()
      },
      error: sync.error
    });

  } catch (error) {
    logger.error('Failed to get sync status:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to get sync status'
    });
  }
};

/**
 * GET /api/pems/sync/history
 * Get sync history for an organization
 */
export const getSyncHistory = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'organizationId is required'
      });
    }

    // Filter syncs by organization
    const history = Array.from(activeSyncs.values())
      .filter(sync => sync.organizationId === organizationId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, 10); // Return last 10 syncs

    res.json({
      organizationId,
      history: history.map(sync => ({
        syncId: sync.syncId,
        status: sync.status,
        totalRecords: sync.totalRecords,
        processedRecords: sync.processedRecords,
        insertedRecords: sync.insertedRecords,
        updatedRecords: sync.updatedRecords,
        errorRecords: sync.errorRecords,
        startedAt: sync.startedAt,
        completedAt: sync.completedAt,
        duration: sync.completedAt
          ? sync.completedAt.getTime() - sync.startedAt.getTime()
          : null
      }))
    });

  } catch (error) {
    logger.error('Failed to get sync history:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to get sync history'
    });
  }
};

/**
 * POST /api/pems/sync/:syncId/cancel
 * Cancel a running sync
 */
export const cancelSync = async (req: Request, res: Response) => {
  try {
    const { syncId } = req.params;

    const sync = activeSyncs.get(syncId);

    if (!sync) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Sync not found'
      });
    }

    if (sync.status !== 'running') {
      return res.status(400).json({
        error: 'INVALID_STATE',
        message: 'Sync is not running'
      });
    }

    // Mark as cancelled
    sync.status = 'cancelled';
    sync.completedAt = new Date();

    res.json({
      success: true,
      message: 'Sync cancelled',
      syncId: sync.syncId
    });

  } catch (error) {
    logger.error('Failed to cancel sync:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to cancel sync'
    });
  }
};

/**
 * POST /api/pems/sync-global
 * Sync a specific API for all organizations
 */
export const syncGlobalApi = async (req: Request, res: Response) => {
  try {
    const { apiConfigId, syncType = 'full' } = req.body;

    if (!apiConfigId) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'apiConfigId is required'
      });
    }

    logger.info(`Global sync request received for API ${apiConfigId}`);

    // Get all active organizations
    const organizations = await prisma.organization.findMany({
      where: { isActive: true }
    });

    if (organizations.length === 0) {
      return res.status(404).json({
        error: 'NO_ORGANIZATIONS',
        message: 'No active organizations found'
      });
    }

    // Generate batch ID
    const batchId = `batch-${Date.now()}`;

    // Create batch tracking entry
    const batch: BatchSync = {
      batchId,
      type: 'global-api',
      status: 'running',
      startedAt: new Date(),
      syncs: [],
      totalSyncs: organizations.length,
      completedSyncs: 0,
      failedSyncs: 0
    };

    // Start syncs for each organization
    for (const org of organizations) {
      const syncId = `pfa-sync-${Date.now()}-${org.id.substring(0, 8)}`;

      // Add to batch
      batch.syncs.push({
        syncId,
        organizationId: org.id,
        apiConfigId,
        status: 'running'
      });

      // Create initial sync entry
      const initialProgress: SyncProgress = {
        syncId,
        status: 'running',
        organizationId: org.id,
        totalRecords: 0,
        processedRecords: 0,
        insertedRecords: 0,
        updatedRecords: 0,
        errorRecords: 0,
        startedAt: new Date(),
        currentBatch: 0,
        totalBatches: 0
      };
      activeSyncs.set(syncId, initialProgress);

      // Start sync in background
      pemsSyncService.syncPfaData(org.id, syncType, syncId, apiConfigId)
        .then(async (progress) => {
          activeSyncs.set(progress.syncId, progress);

          // Update batch status
          const batchData = activeBatches.get(batchId);
          if (batchData) {
            const syncEntry = batchData.syncs.find(s => s.syncId === syncId);
            if (syncEntry) {
              syncEntry.status = progress.status === 'completed' ? 'completed' : 'failed';
            }
            batchData.completedSyncs++;

            // Check if batch is complete
            if (batchData.completedSyncs === batchData.totalSyncs) {
              batchData.status = batchData.failedSyncs > 0 ? 'partial' : 'completed';
              batchData.completedAt = new Date();
            }
            activeBatches.set(batchId, batchData);
          }

          logger.info(`Sync completed in batch ${batchId}: ${progress.syncId}`);
        })
        .catch(error => {
          logger.error(`Sync failed in batch ${batchId}:`, error);

          // Update sync status
          const failedProgress = activeSyncs.get(syncId);
          if (failedProgress) {
            failedProgress.status = 'failed';
            failedProgress.error = error instanceof Error ? error.message : 'Unknown error';
            activeSyncs.set(syncId, failedProgress);
          }

          // Update batch status
          const batchData = activeBatches.get(batchId);
          if (batchData) {
            const syncEntry = batchData.syncs.find(s => s.syncId === syncId);
            if (syncEntry) {
              syncEntry.status = 'failed';
            }
            batchData.completedSyncs++;
            batchData.failedSyncs++;

            if (batchData.completedSyncs === batchData.totalSyncs) {
              batchData.status = batchData.failedSyncs === batchData.totalSyncs ? 'failed' : 'partial';
              batchData.completedAt = new Date();
            }
            activeBatches.set(batchId, batchData);
          }
        });
    }

    // Store batch
    activeBatches.set(batchId, batch);

    // Return batch info
    res.json({
      success: true,
      message: `Started sync for ${organizations.length} organizations`,
      batchId,
      syncs: batch.syncs.map(s => ({
        syncId: s.syncId,
        organizationId: s.organizationId
      }))
    });

  } catch (error) {
    logger.error('Failed to start global sync:', error);
    res.status(500).json({
      error: 'SYNC_ERROR',
      message: error instanceof Error ? error.message : 'Failed to start global sync'
    });
  }
};

/**
 * POST /api/pems/sync-org
 * Sync all APIs with feeds for a specific organization
 */
export const syncOrgApis = async (req: Request, res: Response) => {
  try {
    const { organizationId, syncType = 'full' } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'organizationId is required'
      });
    }

    logger.info(`Organization sync request received for ${organizationId}`);

    // Get all API configurations with feeds
    const apiConfigs = await prisma.apiConfiguration.findMany({
      where: {
        feeds: { not: null },
        isActive: true
      }
    });

    if (apiConfigs.length === 0) {
      return res.status(404).json({
        error: 'NO_APIS',
        message: 'No APIs with feeds configuration found'
      });
    }

    // Generate batch ID
    const batchId = `batch-${Date.now()}`;

    // Create batch tracking entry
    const batch: BatchSync = {
      batchId,
      type: 'org-all-apis',
      status: 'running',
      startedAt: new Date(),
      syncs: [],
      totalSyncs: apiConfigs.length,
      completedSyncs: 0,
      failedSyncs: 0
    };

    // Start syncs for each API
    for (const apiConfig of apiConfigs) {
      const syncId = `pfa-sync-${Date.now()}-${apiConfig.id.substring(0, 8)}`;

      // Add to batch
      batch.syncs.push({
        syncId,
        organizationId,
        apiConfigId: apiConfig.id,
        status: 'running'
      });

      // Create initial sync entry
      const initialProgress: SyncProgress = {
        syncId,
        status: 'running',
        organizationId,
        totalRecords: 0,
        processedRecords: 0,
        insertedRecords: 0,
        updatedRecords: 0,
        errorRecords: 0,
        startedAt: new Date(),
        currentBatch: 0,
        totalBatches: 0
      };
      activeSyncs.set(syncId, initialProgress);

      // Start sync in background
      pemsSyncService.syncPfaData(organizationId, syncType, syncId, apiConfig.id)
        .then(async (progress) => {
          activeSyncs.set(progress.syncId, progress);

          // Update batch status
          const batchData = activeBatches.get(batchId);
          if (batchData) {
            const syncEntry = batchData.syncs.find(s => s.syncId === syncId);
            if (syncEntry) {
              syncEntry.status = progress.status === 'completed' ? 'completed' : 'failed';
            }
            batchData.completedSyncs++;

            // Check if batch is complete
            if (batchData.completedSyncs === batchData.totalSyncs) {
              batchData.status = batchData.failedSyncs > 0 ? 'partial' : 'completed';
              batchData.completedAt = new Date();
            }
            activeBatches.set(batchId, batchData);
          }

          logger.info(`Sync completed in batch ${batchId}: ${progress.syncId}`);
        })
        .catch(error => {
          logger.error(`Sync failed in batch ${batchId}:`, error);

          // Update sync status
          const failedProgress = activeSyncs.get(syncId);
          if (failedProgress) {
            failedProgress.status = 'failed';
            failedProgress.error = error instanceof Error ? error.message : 'Unknown error';
            activeSyncs.set(syncId, failedProgress);
          }

          // Update batch status
          const batchData = activeBatches.get(batchId);
          if (batchData) {
            const syncEntry = batchData.syncs.find(s => s.syncId === syncId);
            if (syncEntry) {
              syncEntry.status = 'failed';
            }
            batchData.completedSyncs++;
            batchData.failedSyncs++;

            if (batchData.completedSyncs === batchData.totalSyncs) {
              batchData.status = batchData.failedSyncs === batchData.totalSyncs ? 'failed' : 'partial';
              batchData.completedAt = new Date();
            }
            activeBatches.set(batchId, batchData);
          }
        });
    }

    // Store batch
    activeBatches.set(batchId, batch);

    // Return batch info
    res.json({
      success: true,
      message: `Started sync for ${apiConfigs.length} APIs`,
      batchId,
      syncs: batch.syncs.map(s => ({
        syncId: s.syncId,
        apiConfigId: s.apiConfigId
      }))
    });

  } catch (error) {
    logger.error('Failed to start organization sync:', error);
    res.status(500).json({
      error: 'SYNC_ERROR',
      message: error instanceof Error ? error.message : 'Failed to start organization sync'
    });
  }
};

/**
 * GET /api/pems/sync-batch/:batchId
 * Get batch sync status
 */
export const getBatchStatus = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;

    const batch = activeBatches.get(batchId);

    if (!batch) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Batch not found'
      });
    }

    // Get detailed progress for each sync
    const syncsWithProgress = batch.syncs.map(sync => {
      const progress = activeSyncs.get(sync.syncId);
      return {
        syncId: sync.syncId,
        organizationId: sync.organizationId,
        apiConfigId: sync.apiConfigId,
        status: sync.status,
        progress: progress ? {
          total: progress.totalRecords,
          processed: progress.processedRecords,
          inserted: progress.insertedRecords,
          updated: progress.updatedRecords,
          errors: progress.errorRecords,
          percentage: progress.totalRecords > 0
            ? Math.round((progress.processedRecords / progress.totalRecords) * 100)
            : 0
        } : null
      };
    });

    // Calculate aggregated stats
    const aggregated = {
      totalRecords: syncsWithProgress.reduce((sum, s) => sum + (s.progress?.total || 0), 0),
      processedRecords: syncsWithProgress.reduce((sum, s) => sum + (s.progress?.processed || 0), 0),
      insertedRecords: syncsWithProgress.reduce((sum, s) => sum + (s.progress?.inserted || 0), 0),
      updatedRecords: syncsWithProgress.reduce((sum, s) => sum + (s.progress?.updated || 0), 0),
      errorRecords: syncsWithProgress.reduce((sum, s) => sum + (s.progress?.errors || 0), 0)
    };

    res.json({
      batchId: batch.batchId,
      type: batch.type,
      status: batch.status,
      totalSyncs: batch.totalSyncs,
      completedSyncs: batch.completedSyncs,
      failedSyncs: batch.failedSyncs,
      timing: {
        startedAt: batch.startedAt,
        completedAt: batch.completedAt,
        duration: batch.completedAt
          ? batch.completedAt.getTime() - batch.startedAt.getTime()
          : Date.now() - batch.startedAt.getTime()
      },
      aggregated,
      syncs: syncsWithProgress
    });

  } catch (error) {
    logger.error('Failed to get batch status:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to get batch status'
    });
  }
};
