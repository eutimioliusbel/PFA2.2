/**
 * PEMS API Controller
 *
 * Handles PEMS API configuration, testing, and data synchronization
 */

import { Request, Response } from 'express';
import { getPrismaClient } from '../config/database';
import { PemsApiService } from '../services/pems/PemsApiService';
import { PemsSyncService } from '../services/pems/PemsSyncService';
import { logger } from '../utils/logger';

const prisma = getPrismaClient();

/**
 * Get all PEMS API configurations for an organization
 */
export const getPemsConfigs = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.query;

    if (!organizationId || typeof organizationId !== 'string') {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'organizationId is required'
      });
    }

    const configs = await prisma.apiConfiguration.findMany({
      where: {
        organizationId,
        usage: 'PFA'
      },
      select: {
        id: true,
        name: true,
        usage: true,
        url: true,
        authType: true,
        operationType: true,
        status: true,
        lastChecked: true,
        lastError: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({ configs });
  } catch (error) {
    logger.error('Error fetching PEMS configs:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch PEMS configurations'
    });
  }
};

/**
 * Test PEMS API connection
 */
export const testPemsConnection = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'organizationId is required'
      });
    }

    // Get organization code
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { code: true }
    });

    if (!org) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Organization not found'
      });
    }

    // Get API configuration to use same credentials as sync
    const apiConfig = await prisma.apiConfiguration.findFirst({
      where: {
        usage: 'PEMS_PFA_READ',
        operationType: 'read'
      }
    });

    if (!apiConfig) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'PEMS PFA Read API configuration not found'
      });
    }

    const pemsSync = new PemsSyncService();
    const startTime = Date.now();

    try {
      // Use syncPfaData to test (it will use database credentials)
      const result = await pemsSync.syncPfaData(organizationId, 'full', `test-${Date.now()}`, apiConfig.id);
      const latencyMs = Date.now() - startTime;

      // Update config status
      await prisma.apiConfiguration.updateMany({
        where: {
          id: apiConfig.id
        },
        data: {
          status: 'connected',
          lastChecked: new Date(),
          lastError: null
        }
      });

      res.json({
        success: true,
        status: 'connected',
        recordsFetched: result.totalRecords,
        latencyMs,
        message: `Successfully connected to PEMS API. Retrieved ${result.totalRecords} test records.`
      });
    } catch (error: any) {
      // Update config with error
      await prisma.apiConfiguration.updateMany({
        where: {
          organizationId,
          usage: 'PFA',
          operationType: 'read'
        },
        data: {
          status: 'error',
          lastChecked: new Date(),
          lastError: error.message
        }
      });

      res.status(500).json({
        success: false,
        status: 'error',
        message: error.message || 'Connection test failed'
      });
    }
  } catch (error) {
    logger.error('Error testing PEMS connection:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to test PEMS connection'
    });
  }
};

/**
 * Trigger PEMS data synchronization
 */
export const syncPemsData = async (req: Request, res: Response) => {
  try {
    const { organizationId, syncType = 'full' } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'organizationId is required'
      });
    }

    // Get organization
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { code: true }
    });

    if (!org) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Organization not found'
      });
    }

    // Create sync log entry
    const syncLog = await prisma.syncLog.create({
      data: {
        organizationId,
        syncType,
        status: 'in_progress',
        triggeredBy: (req as any).user?.userId || 'system'
      }
    });

    // Start sync in background (don't await)
    performSync(syncLog.id, organizationId, org.code, syncType).catch(error => {
      logger.error('Background sync failed:', error);
    });

    res.json({
      success: true,
      syncId: syncLog.id,
      message: 'Sync initiated. Check status for progress.',
      status: 'in_progress'
    });
  } catch (error) {
    logger.error('Error initiating PEMS sync:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to initiate data sync'
    });
  }
};

/**
 * Get sync status
 */
export const getSyncStatus = async (req: Request, res: Response) => {
  try {
    const { syncId } = req.params;

    const syncLog = await prisma.syncLog.findUnique({
      where: { id: syncId }
    });

    if (!syncLog) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Sync log not found'
      });
    }

    res.json({
      syncId: syncLog.id,
      status: syncLog.status,
      syncType: syncLog.syncType,
      recordsProcessed: syncLog.recordsProcessed,
      recordsInserted: syncLog.recordsInserted,
      recordsUpdated: syncLog.recordsUpdated,
      recordsDeleted: syncLog.recordsDeleted,
      durationMs: syncLog.durationMs,
      errorMessage: syncLog.errorMessage,
      createdAt: syncLog.createdAt
    });
  } catch (error) {
    logger.error('Error fetching sync status:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch sync status'
    });
  }
};

/**
 * Get sync history for an organization
 */
export const getSyncHistory = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.query;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!organizationId || typeof organizationId !== 'string') {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'organizationId is required'
      });
    }

    const history = await prisma.syncLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    res.json({ history });
  } catch (error) {
    logger.error('Error fetching sync history:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch sync history'
    });
  }
};

/**
 * Background sync worker
 */
async function performSync(
  syncLogId: string,
  organizationId: string,
  orgCode: string,
  syncType: string
): Promise<void> {
  const startTime = Date.now();
  let recordsProcessed = 0;
  let recordsInserted = 0;
  let recordsUpdated = 0;

  try {
    logger.info(`Starting ${syncType} sync for organization ${orgCode}`);

    const pemsService = new PemsApiService();

    // Fetch all PFA data from PEMS
    const pemsData = await pemsService.fetchAllPfaData(orgCode);
    recordsProcessed = pemsData.length;

    logger.info(`Fetched ${recordsProcessed} records from PEMS`);

    // Process records in batches
    const batchSize = 100;
    for (let i = 0; i < pemsData.length; i += batchSize) {
      const batch = pemsData.slice(i, i + batchSize);

      for (const record of batch) {
        const pfaId = record.PFA_ID;

        // Check if record exists
        const existing = await prisma.pfaRecord.findUnique({
          where: {
            organizationId_pfaId: {
              organizationId,
              pfaId
            }
          }
        });

        const pfaData = {
          pfaId,
          organizationId,
          areaSilo: record.AREA_SILO || null,
          category: record.CATEGORY || null,
          forecastCategory: record.FORECAST_CATEGORY || null,
          class: record.CLASS_DESC || null,
          source: record.SOURCE || null,
          dor: record.DOR || null,
          isActualized: record.IS_ACTUALIZED === 'Y',
          isDiscontinued: record.IS_DISCONTINUED === 'Y',
          isFundsTransferable: record.IS_FUNDS_TRANSFERABLE === 'Y',
          monthlyRate: record.MONTHLY_RATE ? parseFloat(record.MONTHLY_RATE) : null,
          purchasePrice: record.PURCHASE_PRICE ? parseFloat(record.PURCHASE_PRICE) : null,
          manufacturer: record.MANUFACTURER || null,
          model: record.MODEL || null,
          originalStart: record.ORIGINAL_START ? new Date(record.ORIGINAL_START) : null,
          originalEnd: record.ORIGINAL_END ? new Date(record.ORIGINAL_END) : null,
          hasPlan: !!record.ORIGINAL_START,
          forecastStart: record.FORECAST_START ? new Date(record.FORECAST_START) : null,
          forecastEnd: record.FORECAST_END ? new Date(record.FORECAST_END) : null,
          actualStart: record.ACTUAL_START ? new Date(record.ACTUAL_START) : null,
          actualEnd: record.ACTUAL_END ? new Date(record.ACTUAL_END) : null,
          hasActuals: !!record.ACTUAL_START,
          contract: record.CONTRACT || null,
          equipment: record.EQUIPMENT || null,
          lastModified: record.LAST_MODIFIED ? new Date(record.LAST_MODIFIED) : null,
          lastModifiedBy: record.LAST_MODIFIED_BY || null
        };

        if (existing) {
          // Update existing record
          await prisma.pfaRecord.update({
            where: { id: existing.id },
            data: pfaData
          });
          recordsUpdated++;
        } else {
          // Insert new record
          await prisma.pfaRecord.create({
            data: {
              id: `pfa-${organizationId}-${pfaId}`,
              ...pfaData
            }
          });
          recordsInserted++;
        }
      }

      // Update progress
      await prisma.syncLog.update({
        where: { id: syncLogId },
        data: {
          recordsProcessed: i + batch.length,
          recordsInserted,
          recordsUpdated
        }
      });
    }

    const durationMs = Date.now() - startTime;

    // Mark sync as complete
    await prisma.syncLog.update({
      where: { id: syncLogId },
      data: {
        status: 'success',
        recordsProcessed,
        recordsInserted,
        recordsUpdated,
        durationMs
      }
    });

    logger.info(`Sync completed successfully in ${durationMs}ms`);
  } catch (error: any) {
    const durationMs = Date.now() - startTime;

    // Mark sync as failed
    await prisma.syncLog.update({
      where: { id: syncLogId },
      data: {
        status: 'error',
        errorMessage: error.message,
        durationMs,
        recordsProcessed,
        recordsInserted,
        recordsUpdated
      }
    });

    logger.error('Sync failed:', error);
  }
}
