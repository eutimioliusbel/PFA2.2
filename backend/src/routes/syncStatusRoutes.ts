/**
 * Sync Status Routes
 * ADR-007, Phase 5, Task 5.4 - Sync Status Dashboard Component
 *
 * Routes:
 * - GET /api/sync/status - Get active and recent sync job statuses
 * - POST /api/sync/cancel/:syncBatchId - Cancel a running sync job
 * - POST /api/sync/retry/:syncBatchId - Retry a failed sync job
 * - GET /api/sync/retry/:syncBatchId/status - Get retry status
 * - DELETE /api/sync/retry/:syncBatchId - Cancel a pending retry
 */

import express from 'express';
import {
  getSyncStatus,
  cancelSync,
  retrySync,
  getRetryStatus,
  cancelRetry
} from '../controllers/syncStatusController';
import { authenticateJWT } from '../middleware/auth';
import { requirePermission } from '../middleware/requirePermission';

const router = express.Router();

/**
 * All sync status routes require authentication
 */
router.use(authenticateJWT);

/**
 * GET /api/sync/status
 * Get active and recent sync job statuses
 * Requires: perm_RefreshData (permission to view sync operations)
 */
router.get('/status', requirePermission('perm_RefreshData'), getSyncStatus);

/**
 * POST /api/sync/cancel/:syncBatchId
 * Cancel a running sync job
 * Requires: perm_RefreshData (permission to manage sync operations)
 */
router.post('/cancel/:syncBatchId', requirePermission('perm_RefreshData'), cancelSync);

/**
 * POST /api/sync/retry/:syncBatchId
 * Retry a failed sync job
 * Requires: perm_RefreshData (permission to manage sync operations)
 */
router.post('/retry/:syncBatchId', requirePermission('perm_RefreshData'), retrySync);

/**
 * GET /api/sync/retry/:syncBatchId/status
 * Get retry status for a sync job
 * Requires: perm_RefreshData (permission to view sync operations)
 */
router.get('/retry/:syncBatchId/status', requirePermission('perm_RefreshData'), getRetryStatus);

/**
 * DELETE /api/sync/retry/:syncBatchId
 * Cancel a pending retry
 * Requires: perm_RefreshData (permission to manage sync operations)
 */
router.delete('/retry/:syncBatchId', requirePermission('perm_RefreshData'), cancelRetry);

export default router;
