/**
 * PEMS Write Sync Controller
 *
 * Handles bi-directional sync from PostgreSQL to PEMS.
 * Manages write queue, conflict resolution, and sync status.
 *
 * Phase 2, Track A - Task 2A.2: Write Sync Controller
 */

import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { conflictDetectionService } from '../services/pems/ConflictDetectionService';
import { pfaValidationService } from '../services/pfa/PfaValidationService';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// Request validation schemas
const TriggerWriteSyncSchema = z.object({
  organizationId: z.string().uuid(),
  modificationIds: z.array(z.string().uuid()).optional(),
  priority: z.number().int().min(0).max(10).optional().default(0)
});

const ResolveConflictSchema = z.object({
  resolution: z.enum(['use_local', 'use_pems', 'merge']),
  mergedData: z.any().optional()
});

/**
 * POST /api/pems/write-sync
 * Trigger manual write sync to PEMS
 */
export const triggerWriteSync = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { organizationId, modificationIds, priority } = TriggerWriteSyncSchema.parse(req.body);

    logger.info('Triggering write sync to PEMS', {
      userId: req.user?.userId,
      organizationId,
      modificationIds: modificationIds?.length || 'all',
      priority
    });

    // Verify user has access to organization
    const hasAccess = req.user?.organizations.some(
      org => org.organizationId === organizationId
    );

    if (!hasAccess) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'No access to this organization'
      });
      return;
    }

    // Verify user has Sync permission
    const orgPermissions = req.user?.organizations.find(
      org => org.organizationId === organizationId
    )?.permissions;

    if (!orgPermissions?.perm_Sync) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Sync permission required'
      });
      return;
    }

    // Build query for pending modifications
    const whereClause: any = {
      organizationId,
      syncState: 'pending_sync'
    };

    if (modificationIds && modificationIds.length > 0) {
      whereClause.id = { in: modificationIds };
    }

    // Get pending modifications
    const modifications = await prisma.pfa_modification.findMany({
      where: whereClause,
      include: {
        pfa_mirror: true,
        users: {
          select: {
            id: true,
            username: true
          }
        }
      },
      orderBy: {
        updatedAt: 'asc' // Oldest first
      }
    });

    if (modifications.length === 0) {
      res.status(200).json({
        success: true,
        message: 'No pending modifications to sync',
        queuedCount: 0
      });
      return;
    }

    // Validate all modifications
    const validationErrors: { modificationId: string; errors: any[] }[] = [];

    for (const modification of modifications) {
      const validation = pfaValidationService.validateModification(modification.delta);
      if (!validation.valid) {
        validationErrors.push({
          modificationId: modification.id,
          errors: validation.errors
        });
      }
    }

    if (validationErrors.length > 0) {
      logger.warn('Validation failed for some modifications', { validationErrors });
      res.status(400).json({
        error: 'VALIDATION_FAILED',
        message: 'Some modifications failed validation',
        validationErrors
      });
      return;
    }

    // Queue modifications for sync
    const queueItems = modifications.map((mod: any) => ({
      id: uuidv4(),
      modificationId: mod.id,
      pfaId: mod.pfa_mirror.pfaId || 'UNKNOWN',
      organizationId: mod.organizationId,
      operation: 'update' as const,
      payload: mod.delta,
      priority: priority || 0,
      scheduledAt: new Date()
    }));

    await prisma.pfa_write_queue.createMany({
      data: queueItems,
      skipDuplicates: true // Prevent duplicate queue entries
    });

    // Update modifications to 'queued' state
    await prisma.pfa_modification.updateMany({
      where: {
        id: { in: modifications.map((m: any) => m.id) }
      },
      data: {
        syncStatus: 'queued'
      }
    });

    // Generate job ID for tracking
    const jobId = `write-sync-${Date.now()}-${organizationId}`;

    // Estimate completion time (100 items per minute)
    const estimatedCompletionTime = new Date(
      Date.now() + (modifications.length / 100) * 60 * 1000
    );

    logger.info('Write sync queued successfully', {
      jobId,
      queuedCount: modifications.length,
      estimatedCompletionTime
    });

    res.status(200).json({
      success: true,
      jobId,
      queuedCount: modifications.length,
      estimatedCompletionTime: estimatedCompletionTime.toISOString()
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: error.errors
      });
      return;
    }

    logger.error('Failed to trigger write sync', { error });
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to trigger write sync'
    });
  }
};

/**
 * GET /api/pems/sync-status
 * Query sync metrics and status
 */
export const getSyncStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { organizationId, status, startDate, endDate } = req.query;

    if (!organizationId) {
      res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'organizationId is required'
      });
      return;
    }

    // Verify user has access
    const hasAccess = req.user?.organizations.some(
      org => org.organizationId === organizationId
    );

    if (!hasAccess) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'No access to this organization'
      });
      return;
    }

    // Build where clause
    const whereClause: any = {
      organizationId: organizationId as string
    };

    if (status) {
      whereClause.status = status;
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate as string);
      if (endDate) whereClause.createdAt.lte = new Date(endDate as string);
    }

    // Get queue metrics
    const [
      totalQueued,
      processing,
      completed,
      failed
    ] = await Promise.all([
      prisma.pfa_write_queue.count({
        where: { ...whereClause, status: { in: ['pending', 'queued'] } }
      }),
      prisma.pfa_write_queue.count({
        where: { ...whereClause, status: 'processing' }
      }),
      prisma.pfa_write_queue.count({
        where: { ...whereClause, status: 'completed' }
      }),
      prisma.pfa_write_queue.count({
        where: { ...whereClause, status: 'failed' }
      })
    ]);

    // Calculate average sync time (for completed items in last 24 hours)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCompleted = await prisma.pfa_write_queue.findMany({
      where: {
        organizationId: organizationId as string,
        status: 'completed',
        completedAt: { gte: last24Hours }
      },
      select: {
        createdAt: true,
        completedAt: true
      }
    });

    let avgSyncTime = null;
    if (recentCompleted.length > 0) {
      const totalTime = recentCompleted.reduce((sum: number, item: any) => {
        const duration = item.completedAt!.getTime() - item.createdAt.getTime();
        return sum + duration;
      }, 0);
      avgSyncTime = Math.round(totalTime / recentCompleted.length);
    }

    // Get last sync timestamp
    const lastSync = await prisma.pfa_write_queue.findFirst({
      where: {
        organizationId: organizationId as string,
        status: 'completed'
      },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true }
    });

    // Calculate next sync (queue is processed every 60 seconds)
    const nextSyncAt = new Date(Date.now() + 60 * 1000);

    // Calculate health score (0-100)
    const totalItems = totalQueued + processing + completed + failed;
    const successRate = totalItems > 0 ? (completed / totalItems) * 100 : 100;
    const health = successRate >= 95 ? 'healthy' : successRate >= 80 ? 'degraded' : 'unhealthy';

    res.status(200).json({
      totalQueued,
      processing,
      completed,
      failed,
      avgSyncTime,
      lastSyncAt: lastSync?.completedAt?.toISOString() || null,
      nextSyncAt: nextSyncAt.toISOString(),
      health,
      successRate: Math.round(successRate)
    });

  } catch (error) {
    logger.error('Failed to get sync status', { error });
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get sync status'
    });
  }
};

/**
 * POST /api/pems/conflicts/:conflictId/resolve
 * Resolve a sync conflict
 */
export const resolveConflict = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { conflictId } = req.params;
    const { resolution, mergedData } = ResolveConflictSchema.parse(req.body);

    logger.info('Resolving conflict', {
      conflictId,
      resolution,
      userId: req.user?.userId
    });

    // Get conflict
    const conflict = await prisma.pfa_sync_conflict.findUnique({
      where: { id: conflictId }
    });

    if (!conflict) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Conflict not found'
      });
      return;
    }

    // Verify user has access to organization
    const hasAccess = req.user?.organizations.some(
      org => org.organizationId === conflict.organizationId
    );

    if (!hasAccess) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'No access to this organization'
      });
      return;
    }

    // Verify user has Sync permission
    const orgPermissions = req.user?.organizations.find(
      org => org.organizationId === conflict.organizationId
    )?.permissions;

    if (!orgPermissions?.perm_Sync) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Sync permission required'
      });
      return;
    }

    // Validate merged data if resolution is 'merge'
    if (resolution === 'merge') {
      if (!mergedData) {
        res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'mergedData is required for merge resolution'
        });
        return;
      }

      const validation = pfaValidationService.validateModification(mergedData);
      if (!validation.valid) {
        res.status(400).json({
          error: 'VALIDATION_FAILED',
          message: 'Merged data failed validation',
          errors: validation.errors
        });
        return;
      }
    }

    // Resolve conflict
    await conflictDetectionService.resolveConflict(
      conflictId,
      resolution,
      mergedData,
      req.user?.userId
    );

    res.status(200).json({
      success: true,
      conflictId,
      resolvedAt: new Date().toISOString(),
      appliedChanges: resolution === 'use_pems' ? null : (mergedData || conflict.localData)
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: error.errors
      });
      return;
    }

    logger.error('Failed to resolve conflict', { error });
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to resolve conflict'
    });
  }
};

/**
 * GET /api/pems/conflicts
 * List conflicts for an organization
 */
export const listConflicts = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { organizationId, status } = req.query;

    if (!organizationId) {
      res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'organizationId is required'
      });
      return;
    }

    // Verify user has access
    const hasAccess = req.user?.organizations.some(
      org => org.organizationId === organizationId
    );

    if (!hasAccess) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'No access to this organization'
      });
      return;
    }

    // Build where clause
    const whereClause: any = {
      organizationId: organizationId as string
    };

    if (status) {
      whereClause.status = status;
    }

    // Get conflicts
    const conflicts = await prisma.pfa_sync_conflict.findMany({
      where: whereClause,
      include: {
        modification: {
          include: {
            users: {
              select: {
                id: true,
                username: true,
                email: true
              }
            },
            pfa_mirror: {
              select: {
                pfaId: true,
                category: true,
                class: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedConflicts = conflicts.map((conflict: any) => ({
      id: conflict.id,
      pfaId: conflict.pfaId,
      pfaDetails: {
        category: conflict.modification.pfa_mirror.category,
        class: conflict.modification.pfa_mirror.class
      },
      localVersion: conflict.localVersion,
      pemsVersion: conflict.pemsVersion,
      conflictFields: conflict.conflictFields,
      localData: conflict.localData,
      pemsData: conflict.pemsData,
      status: conflict.status,
      resolution: conflict.resolution,
      mergedData: conflict.mergedData,
      createdAt: conflict.createdAt,
      resolvedAt: conflict.resolvedAt,
      resolvedBy: conflict.resolvedBy,
      modifiedBy: {
        id: conflict.modification.users.id,
        username: conflict.modification.users.username,
        email: conflict.modification.users.email
      }
    }));

    res.status(200).json({
      conflicts: formattedConflicts,
      total: formattedConflicts.length
    });

  } catch (error) {
    logger.error('Failed to list conflicts', { error });
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to list conflicts'
    });
  }
};
