/**
 * PEMS User Sync Controller
 *
 * Handles API endpoints for syncing users from PEMS with selective filtering.
 * Implements 4-tier filtering strategy:
 * 1. Active users only (ISACTIVE = '+')
 * 2. Allowed user groups (PROJECT_MANAGERS, COST_ENGINEERS, etc.)
 * 3. Required organizations (BECH, HOLNG, RIO)
 * 4. PFA Access Flag (UDFCHAR01 = 'Y')
 *
 * @see docs/PEMS_USER_SYNC_FILTERING.md for filtering rules
 */

import { Request, Response } from 'express';
import { PemsUserSyncService, UserSyncProgress } from '../services/pems/PemsUserSyncService';
import { logger } from '../utils/logger';
import { handleControllerError } from '../utils/errorHandling';

// Store active user syncs in memory (in production, use Redis or database)
const activeUserSyncs = new Map<string, UserSyncProgress>();

/**
 * POST /api/pems/users/sync
 * Start a user sync from PEMS with filtering
 *
 * Body:
 *   - organizationId: string (required)
 *   - apiConfigId: string (required) - ID of PEMS User Sync API config
 *   - filters: UserSyncFilters (optional) - Custom filter overrides
 */
export const startUserSync = async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId, apiConfigId, filters } = req.body;

    // Validate required parameters
    if (!organizationId) {
      res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'organizationId is required'
      });
      return;
    }

    if (!apiConfigId) {
      res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'apiConfigId is required'
      });
      return;
    }

    logger.info(`User sync request received for organization ${organizationId}`, {
      apiConfigId,
      hasCustomFilters: !!filters
    });

    // Check if user sync is already running for this organization
    const existingSync = Array.from(activeUserSyncs.values()).find(
      sync => sync.organizationId === organizationId && sync.status === 'running'
    );

    if (existingSync) {
      res.status(409).json({
        error: 'SYNC_IN_PROGRESS',
        message: 'A user sync is already running for this organization',
        syncId: existingSync.syncId,
        progress: existingSync
      });
      return;
    }

    // Generate sync ID
    const syncId = `user-sync-${Date.now()}`;

    // Create initial sync entry
    const initialProgress: UserSyncProgress = {
      syncId,
      status: 'running',
      organizationId,
      totalUsers: 0,
      processedUsers: 0,
      syncedUsers: 0,
      skippedUsers: 0,
      errorUsers: 0,
      startedAt: new Date(),
      currentPage: 0
    };
    activeUserSyncs.set(syncId, initialProgress);

    // Start sync in background (non-blocking)
    logger.info(`Starting user sync ${syncId} in background`);

    // Run sync asynchronously
    (async () => {
      try {
        // Create service instance with optional custom filters
        const userSyncService = new PemsUserSyncService(filters);

        // Run sync
        const progress = await userSyncService.syncUsers(
          organizationId,
          apiConfigId,
          syncId
        );

        // Update stored progress
        activeUserSyncs.set(syncId, progress);

        logger.info(`User sync ${syncId} completed`, {
          totalUsers: progress.totalUsers,
          syncedUsers: progress.syncedUsers,
          skippedUsers: progress.skippedUsers
        });

      } catch (error: unknown) {
        logger.error(`User sync ${syncId} failed:`, error);

        // Update stored progress with error
        const failedProgress = activeUserSyncs.get(syncId);
        if (failedProgress) {
          failedProgress.status = 'failed';
          failedProgress.completedAt = new Date();
          failedProgress.error = error instanceof Error ? error.message : 'Unknown error';
          activeUserSyncs.set(syncId, failedProgress);
        }
      }
    })();

    // Return immediately with sync ID
    res.status(202).json({
      success: true,
      syncId,
      message: 'User sync started',
      status: 'running',
      progress: initialProgress
    });

  } catch (error: unknown) {
    handleControllerError(error, res, 'PemsUserSyncController.startUserSync');
  }
};

/**
 * GET /api/pems/users/sync/:syncId
 * Get user sync progress
 */
export const getUserSyncProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const { syncId } = req.params;

    const progress = activeUserSyncs.get(syncId);

    if (!progress) {
      res.status(404).json({
        error: 'SYNC_NOT_FOUND',
        message: `User sync ${syncId} not found`
      });
      return;
    }

    res.json(progress);

  } catch (error: unknown) {
    handleControllerError(error, res, 'PemsUserSyncController.getUserSyncProgress');
  }
};

/**
 * GET /api/pems/users/sync/:syncId/skipped
 * Get list of skipped users with reasons
 */
export const getSkippedUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { syncId } = req.params;

    const progress = activeUserSyncs.get(syncId);

    if (!progress) {
      res.status(404).json({
        error: 'SYNC_NOT_FOUND',
        message: `User sync ${syncId} not found`
      });
      return;
    }

    // NOTE: This requires storing skipped users in the progress object
    // For now, return a message that this feature is in development
    res.json({
      syncId,
      message: 'Skipped users are logged in backend logs. Check server console for details.',
      skippedCount: progress.skippedUsers
    });

  } catch (error: unknown) {
    handleControllerError(error, res, 'PemsUserSyncController.getSkippedUsers');
  }
};

/**
 * GET /api/pems/users/active-syncs
 * Get all active user syncs
 */
export const getActiveUserSyncs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.query;

    let syncs = Array.from(activeUserSyncs.values());

    // Filter by organization if provided
    if (organizationId) {
      syncs = syncs.filter(sync => sync.organizationId === organizationId);
    }

    res.json({
      syncs,
      count: syncs.length
    });

  } catch (error: unknown) {
    handleControllerError(error, res, 'PemsUserSyncController.getActiveUserSyncs');
  }
};

/**
 * DELETE /api/pems/users/sync/:syncId
 * Cancel a running user sync
 */
export const cancelUserSync = async (req: Request, res: Response): Promise<void> => {
  try {
    const { syncId } = req.params;

    const progress = activeUserSyncs.get(syncId);

    if (!progress) {
      res.status(404).json({
        error: 'SYNC_NOT_FOUND',
        message: `User sync ${syncId} not found`
      });
      return;
    }

    if (progress.status !== 'running') {
      res.status(400).json({
        error: 'INVALID_STATE',
        message: `Cannot cancel sync with status: ${progress.status}`
      });
      return;
    }

    // Mark as cancelled
    progress.status = 'cancelled';
    progress.completedAt = new Date();
    activeUserSyncs.set(syncId, progress);

    logger.info(`User sync ${syncId} cancelled`);

    res.json({
      success: true,
      message: 'User sync cancelled',
      syncId,
      progress
    });

  } catch (error: unknown) {
    handleControllerError(error, res, 'PemsUserSyncController.cancelUserSync');
  }
};
