/**
 * Sync Statistics Routes
 * Phase 3, Task 3.3 - Sync Health Dashboard
 *
 * Routes:
 * - GET /api/sync/health - Overall sync health statistics
 * - GET /api/sync/health/:organizationId/history - Sync history for specific org
 * - GET /api/sync/health/skip-reasons - Skip reason summary across all orgs
 */

import express from 'express';
import {
  getSyncHealthStats,
  getOrganizationSyncHistory,
  getSkipReasonSummary
} from '../controllers/syncStatsController';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

/**
 * All sync stats routes require authentication
 */
router.use(authenticateJWT);

/**
 * GET /api/sync/health
 * Get overall sync health statistics for all organizations
 */
router.get('/health', getSyncHealthStats);

/**
 * GET /api/sync/health/skip-reasons
 * Get skip reason summary across all organizations
 * IMPORTANT: This route must be before /:organizationId/history to avoid route conflict
 */
router.get('/health/skip-reasons', getSkipReasonSummary);

/**
 * GET /api/sync/health/:organizationId/history
 * Get detailed sync history for a specific organization
 */
router.get('/health/:organizationId/history', getOrganizationSyncHistory);

export default router;
