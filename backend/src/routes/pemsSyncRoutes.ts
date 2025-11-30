/**
 * PEMS Sync Routes
 *
 * Routes for syncing data from PEMS
 *
 * Security:
 * - All routes require JWT authentication
 * - Sync operations require perm_Sync permission
 * - Read sync status/history requires perm_Read permission
 */

import express from 'express';
import {
  startSync,
  getSyncStatus,
  getSyncHistory,
  cancelSync
} from '../controllers/pemsSyncController';
import { authenticateJWT } from '../middleware/auth';
import { requirePermission } from '../middleware/requirePermission';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateJWT);

/**
 * POST /api/pems/sync
 * Start a new sync operation
 *
 * Required Permission: perm_Sync
 * Organization ID: Body field 'organizationId' (required)
 *
 * Request Body:
 * - organizationId: string (required) - Organization to sync data for
 * - syncType: string (optional) - 'full' or 'incremental' (default: 'full')
 *
 * Response:
 * {
 *   success: true,
 *   syncId: string,
 *   message: string,
 *   status: 'running'
 * }
 */
router.post('/sync', requirePermission('perm_Sync'), startSync);

/**
 * GET /api/pems/sync/:syncId
 * Get sync status and progress
 *
 * Required Permission: perm_Read
 * Organization ID: Query parameter 'organizationId' (required)
 *
 * Query Parameters:
 * - organizationId: string (required) - Organization context
 *
 * Response:
 * {
 *   syncId: string,
 *   status: 'running' | 'completed' | 'failed',
 *   progress: { total, processed, inserted, updated, errors, percentage },
 *   ...
 * }
 */
router.get('/sync/:syncId', requirePermission('perm_Read'), getSyncStatus);

/**
 * GET /api/pems/sync/history
 * Get sync history for an organization
 *
 * Required Permission: perm_Read
 * Organization ID: Query parameter 'organizationId' (required)
 *
 * Query Parameters:
 * - organizationId: string (required) - Organization to get history for
 * - limit: number (optional) - Max results to return (default: 50)
 *
 * Response: Array of sync log entries
 */
router.get('/sync/history', requirePermission('perm_Read'), getSyncHistory);

/**
 * POST /api/pems/sync/:syncId/cancel
 * Cancel a running sync operation
 *
 * Required Permission: perm_Sync
 * Organization ID: Body field 'organizationId' (required)
 *
 * Request Body:
 * - organizationId: string (required) - Organization context
 *
 * Response:
 * {
 *   success: true,
 *   message: 'Sync cancelled',
 *   syncId: string
 * }
 */
router.post('/sync/:syncId/cancel', requirePermission('perm_Sync'), cancelSync);

export default router;
