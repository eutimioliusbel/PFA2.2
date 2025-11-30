// backend/src/routes/permissionRoutes.ts
/**
 * Permission Explanation Routes
 *
 * Phase 7, Task 7.1 of ADR-005 Multi-Tenant Access Control
 * AI Use Case 16: Context-Aware Access Explanation
 *
 * Routes for AI-powered permission explanations.
 */

import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import {
  explainPermissionDenial,
  getCacheStats,
  clearCache,
  explainBatchPermissions,
} from '../controllers/permissionExplanationController';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

/**
 * POST /api/permissions/explain
 *
 * Explain why a user is denied permission for a specific action
 *
 * Body: { userId, organizationId, action }
 * Returns: { allowed: boolean, explanation: PermissionExplanation | null }
 */
router.post('/explain', explainPermissionDenial);

/**
 * POST /api/permissions/explain/batch
 *
 * Batch explain multiple permission denials
 *
 * Body: { userId, organizationId, actions: string[] }
 * Returns: { results: Record<action, { allowed, explanation }> }
 */
router.post('/explain/batch', explainBatchPermissions);

/**
 * GET /api/permissions/explain/cache-stats
 *
 * Get explanation cache statistics (admin only)
 */
router.get('/explain/cache-stats', getCacheStats);

/**
 * POST /api/permissions/explain/cache/clear
 *
 * Clear the explanation cache (admin only)
 */
router.post('/explain/cache/clear', clearCache);

export default router;
