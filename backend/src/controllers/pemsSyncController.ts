/**
 * PEMS Sync Controller
 *
 * Handles API endpoints for syncing data from PEMS
 */

import { Request, Response } from 'express';
import prisma from '../config/database';
import { pemsSyncService, SyncProgress } from '../services/pems/PemsSyncService';
import { logger } from '../utils/logger';

// Store active syncs in memory (in production, use Redis or database)
const activeSyncs = new Map<string, SyncProgress>();

/**
 * Helper: Check if mapping configuration exists for an API/entity
 * Returns { hasMappings, entityType, mappingCount }
 *
 * Supports both:
 * - New architecture: api_endpoints table (entity field directly on endpoint)
 * - Legacy architecture: api_configurations table (entity in feeds JSON)
 */
async function checkMappingConfiguration(apiConfigId: string): Promise<{
  hasMappings: boolean;
  entityType: string;
  mappingCount: number;
  details: string;
}> {
  let entityType = 'pfa'; // default

  // First, try the new api_endpoints table (preferred)
  const endpoint = await prisma.api_endpoints.findUnique({
    where: { id: apiConfigId }
  });

  if (endpoint) {
    entityType = endpoint.entity || 'pfa';
  } else {
    // Fallback to legacy api_configurations table
    const config = await prisma.api_configurations.findUnique({
      where: { id: apiConfigId }
    });

    if (!config) {
      return { hasMappings: false, entityType: 'unknown', mappingCount: 0, details: 'API configuration not found in api_endpoints or api_configurations' };
    }

    // Parse feeds to determine entity type (legacy)
    if (config.feeds) {
      try {
        const feeds = JSON.parse(config.feeds);
        if (feeds && feeds.length > 0) {
          entityType = feeds[0].entity;
        }
      } catch {
        // Keep default
      }
    }
  }

  // Check api_field_mappings table
  const fieldMappings = await prisma.api_field_mappings.findMany({
    where: { endpointId: apiConfigId }
  });

  // Check mapping_templates table (unified mapping system)
  const unifiedMappings = await prisma.mapping_templates.findMany({
    where: { entity: entityType.toUpperCase() }
  });

  const hasFieldMappings = fieldMappings.length > 0;
  const hasUnifiedMappings = unifiedMappings.length > 0;
  const hasMappings = hasFieldMappings || hasUnifiedMappings;
  const mappingCount = fieldMappings.length + unifiedMappings.length;

  return {
    hasMappings,
    entityType,
    mappingCount,
    details: hasMappings
      ? `Found ${mappingCount} mapping configuration(s)`
      : `No mapping configuration for entity ${entityType}`
  };
}

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

    // Check if mapping configuration exists for this API config/entity
    // Mappings are required for the sync to know how to transform external data
    const mappingCheck = await checkMappingConfiguration(apiConfigId);

    if (!mappingCheck.hasMappings) {
      logger.warn(`No mapping configuration found for API ${apiConfigId} entity ${mappingCheck.entityType}`, {
        organizationId,
        apiConfigId,
        entityType: mappingCheck.entityType
      });

      // Clean up the sync entry since we're not proceeding
      activeSyncs.delete(syncId);

      return res.status(400).json({
        error: 'MAPPING_REQUIRED',
        message: `Cannot sync ${mappingCheck.entityType} data: No field mapping configuration exists for this endpoint. Please configure field mappings in Mapping Studio before syncing.`,
        details: {
          apiConfigId,
          entity: mappingCheck.entityType,
          action: 'Navigate to Admin → Mapping Studio to create a mapping configuration for this endpoint'
        }
      });
    }

    logger.info(`Starting ${mappingCheck.entityType} sync for organization ${organizationId} using PEMS sync service`, {
      hasMappings: mappingCheck.hasMappings,
      mappingCount: mappingCheck.mappingCount
    });

    // Use PemsSyncService directly for all PEMS syncs
    const syncPromise = pemsSyncService.syncPfaData(organizationId, syncType, syncId, apiConfigId);

    // Start sync in background (don't await)
    syncPromise
      .then(async (progress) => {
        // Update the sync entry with final results
        activeSyncs.set(progress.syncId, progress);
        logger.info(`Sync completed: ${progress.syncId}`);

        // Update API configuration with sync statistics
        if (progress.status === 'completed') {
          try {
            const config = await prisma.api_configurations.findUnique({
              where: { id: apiConfigId }
            });

            if (config) {
              const totalRecords = (config.totalSyncRecordCount || 0) + progress.insertedRecords + progress.updatedRecords;

              await prisma.api_configurations.update({
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
    return res.json({
      success: true,
      message: 'PFA data sync started',
      syncId: syncId,
      status: 'running'
    });

  } catch (error) {
    logger.error('Failed to start sync:', error);
    return res.status(500).json({
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

    return res.json({
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
    return res.status(500).json({
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

    return res.json({
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
    return res.status(500).json({
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

    return res.json({
      success: true,
      message: 'Sync cancelled',
      syncId: sync.syncId
    });

  } catch (error) {
    logger.error('Failed to cancel sync:', error);
    return res.status(500).json({
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

    // Check if mapping configuration exists for this API
    const mappingCheck = await checkMappingConfiguration(apiConfigId);
    if (!mappingCheck.hasMappings) {
      logger.warn(`Global sync rejected - no mapping configuration for API ${apiConfigId}`, {
        entityType: mappingCheck.entityType
      });

      return res.status(400).json({
        error: 'MAPPING_REQUIRED',
        message: `Cannot sync ${mappingCheck.entityType} data: No field mapping configuration exists for this API. Please configure field mappings in Mapping Studio before syncing.`,
        details: {
          apiConfigId,
          entity: mappingCheck.entityType,
          action: 'Navigate to Admin → Mapping Studio to create a mapping configuration for this endpoint'
        }
      });
    }

    // Get all active organizations
    const organizations = await prisma.organizations.findMany({
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

      // Use PemsSyncService directly for all PEMS syncs
      const syncPromise = pemsSyncService.syncPfaData(org.id, syncType, syncId, apiConfigId);

      // Start sync in background
      syncPromise
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
    return res.json({
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
    return res.status(500).json({
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
    const apiConfigs = await prisma.api_configurations.findMany({
      where: {
        feeds: { not: null }
      }
    });

    if (apiConfigs.length === 0) {
      return res.status(404).json({
        error: 'NO_APIS',
        message: 'No APIs with feeds configuration found'
      });
    }

    // Check mapping configurations for each API - filter to only those with mappings
    const apisWithMappingStatus = await Promise.all(
      apiConfigs.map(async (apiConfig) => {
        const mappingCheck = await checkMappingConfiguration(apiConfig.id);
        return {
          apiConfig,
          mappingCheck
        };
      })
    );

    const apisWithMappings = apisWithMappingStatus.filter(a => a.mappingCheck.hasMappings);
    const apisWithoutMappings = apisWithMappingStatus.filter(a => !a.mappingCheck.hasMappings);

    if (apisWithMappings.length === 0) {
      logger.warn(`Organization sync rejected - no APIs have mapping configurations`, {
        organizationId,
        totalApis: apiConfigs.length,
        apisWithoutMappings: apisWithoutMappings.map(a => ({
          apiId: a.apiConfig.id,
          name: a.apiConfig.name,
          entity: a.mappingCheck.entityType
        }))
      });

      return res.status(400).json({
        error: 'MAPPING_REQUIRED',
        message: `Cannot sync: None of the ${apiConfigs.length} API(s) have field mapping configurations. Please configure field mappings in Mapping Studio before syncing.`,
        details: {
          totalApis: apiConfigs.length,
          apisWithoutMappings: apisWithoutMappings.map(a => ({
            apiId: a.apiConfig.id,
            name: a.apiConfig.name,
            entity: a.mappingCheck.entityType
          })),
          action: 'Navigate to Admin → Mapping Studio to create mapping configurations for each endpoint'
        }
      });
    }

    // Log if some APIs are being skipped
    if (apisWithoutMappings.length > 0) {
      logger.info(`Organization sync - skipping ${apisWithoutMappings.length} API(s) without mappings`, {
        organizationId,
        skippedApis: apisWithoutMappings.map(a => a.apiConfig.name)
      });
    }

    // Generate batch ID
    const batchId = `batch-${Date.now()}`;

    // Create batch tracking entry - only count APIs that have mappings
    const batch: BatchSync = {
      batchId,
      type: 'org-all-apis',
      status: 'running',
      startedAt: new Date(),
      syncs: [],
      totalSyncs: apisWithMappings.length,
      completedSyncs: 0,
      failedSyncs: 0
    };

    // Start syncs for each API that has mapping configuration
    for (const { apiConfig } of apisWithMappings) {
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

      // Use PemsSyncService directly for all PEMS syncs
      const syncPromise = pemsSyncService.syncPfaData(organizationId, syncType, syncId, apiConfig.id);

      // Start sync in background
      syncPromise
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
    return res.json({
      success: true,
      message: `Started sync for ${apisWithMappings.length} API(s)${apisWithoutMappings.length > 0 ? `, skipped ${apisWithoutMappings.length} without mappings` : ''}`,
      batchId,
      syncs: batch.syncs.map(s => ({
        syncId: s.syncId,
        apiConfigId: s.apiConfigId
      })),
      skippedApis: apisWithoutMappings.length > 0 ? apisWithoutMappings.map(a => ({
        apiId: a.apiConfig.id,
        name: a.apiConfig.name,
        entity: a.mappingCheck.entityType,
        reason: 'No mapping configuration'
      })) : undefined
    });

  } catch (error) {
    logger.error('Failed to start organization sync:', error);
    return res.status(500).json({
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

    return res.json({
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
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to get batch status'
    });
  }
};
