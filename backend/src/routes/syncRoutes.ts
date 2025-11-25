/**
 * @file syncRoutes.ts
 * @description API routes for manual sync triggers and status monitoring
 *
 * Endpoints:
 * - POST /api/sync/trigger - Manually trigger a sync for specific org
 * - GET /api/sync/status - Get sync status and recent logs
 * - GET /api/sync/worker-status - Get worker status (running, next run time)
 */

import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { getWorkerInstance } from '../workers/PemsSyncWorker';
import prisma from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/sync/trigger
 * Manually trigger a sync for a specific organization
 *
 * Body:
 * {
 *   organizationId: string (required)
 * }
 *
 * Response:
 * {
 *   success: true,
 *   batchId: string,
 *   message: string
 * }
 */
router.post('/trigger', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'organizationId is required'
      });
    }

    // Verify organization exists (try by ID first, then by code for legacy compatibility)
    let organization = await prisma.organization.findUnique({
      where: { id: organizationId }
    });

    if (!organization) {
      // Try by code (for legacy frontend that uses code as id)
      organization = await prisma.organization.findUnique({
        where: { code: organizationId }
      });
    }

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Organization not found'
      });
    }

    // Get worker instance
    const worker = getWorkerInstance();

    if (!worker) {
      return res.status(500).json({
        success: false,
        error: 'WORKER_NOT_INITIALIZED',
        message: 'Sync worker is not initialized'
      });
    }

    // Check if sync is already running
    if (worker.isCurrentlyRunning()) {
      return res.status(409).json({
        success: false,
        error: 'SYNC_IN_PROGRESS',
        message: 'A sync operation is already in progress. Please wait for it to complete.'
      });
    }

    // Trigger manual sync (use actual UUID id, not code)
    logger.info('[SyncAPI] Manual sync triggered', {
      organizationId: organization.id,
      organizationCode: organization.code,
      userId: (req as any).user?.userId
    });

    const batchId = await worker.triggerManualSync(organization.id);

    res.json({
      success: true,
      batchId,
      message: `Sync triggered for organization ${organization.code}`
    });

  } catch (error) {
    logger.error('[SyncAPI] Failed to trigger sync:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Failed to trigger sync'
    });
  }
});

/**
 * GET /api/sync/status
 * Get recent sync logs and status
 *
 * Query params:
 * - organizationId: string (optional) - Filter by organization
 * - limit: number (optional, default: 10) - Number of logs to return
 *
 * Response:
 * {
 *   success: true,
 *   logs: Array<SyncLog>,
 *   summary: {
 *     totalSyncs: number,
 *     successfulSyncs: number,
 *     failedSyncs: number,
 *     lastSync: Date
 *   }
 * }
 */
router.get('/status', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { organizationId, limit = '10' } = req.query;
    const limitNum = parseInt(limit as string, 10);

    // Build filter
    const where: any = {};
    if (organizationId) {
      where.organizationId = organizationId as string;
    }

    // Get recent sync logs
    const logs = await prisma.pfaSyncLog.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limitNum,
      include: {
        organization: {
          select: { code: true, name: true }
        },
        triggeredByUser: {
          select: { username: true }
        }
      }
    });

    // Get summary statistics
    const totalSyncs = await prisma.pfaSyncLog.count({ where });
    const successfulSyncs = await prisma.pfaSyncLog.count({
      where: { ...where, status: 'completed' }
    });
    const failedSyncs = await prisma.pfaSyncLog.count({
      where: { ...where, status: 'failed' }
    });
    const lastSyncLog = await prisma.pfaSyncLog.findFirst({
      where,
      orderBy: { startedAt: 'desc' }
    });

    res.json({
      success: true,
      logs: logs.map((log: any) => ({
        id: log.id,
        organizationId: log.organizationId,
        organizationCode: log.organization.code,
        organizationName: log.organization.name,
        syncType: log.syncType,
        syncDirection: log.syncDirection,
        status: log.status,
        recordsTotal: log.recordsTotal,
        recordsProcessed: log.recordsProcessed,
        recordsInserted: log.recordsInserted,
        recordsUpdated: log.recordsUpdated,
        recordsErrored: log.recordsErrored,
        startedAt: log.startedAt,
        completedAt: log.completedAt,
        durationMs: log.durationMs,
        errorMessage: log.errorMessage,
        triggeredBy: log.triggeredByUser?.username || 'system'
      })),
      summary: {
        totalSyncs,
        successfulSyncs,
        failedSyncs,
        lastSync: lastSyncLog?.startedAt || null
      }
    });

  } catch (error) {
    logger.error('[SyncAPI] Failed to get sync status:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Failed to get sync status'
    });
  }
});

/**
 * GET /api/sync/worker-status
 * Get background worker status
 *
 * Response:
 * {
 *   success: true,
 *   worker: {
 *     enabled: boolean,
 *     running: boolean,
 *     nextRun: Date | null
 *   }
 * }
 */
router.get('/worker-status', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const worker = getWorkerInstance();

    if (!worker) {
      return res.json({
        success: true,
        worker: {
          enabled: false,
          running: false,
          nextRun: null
        }
      });
    }

    const isRunning = worker.isCurrentlyRunning();
    const nextRun = worker.getNextRunTime();

    res.json({
      success: true,
      worker: {
        enabled: true,
        running: isRunning,
        nextRun
      }
    });

  } catch (error) {
    logger.error('[SyncAPI] Failed to get worker status:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Failed to get worker status'
    });
  }
});

export default router;
