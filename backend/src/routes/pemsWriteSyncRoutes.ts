/**
 * PEMS Write Sync Routes
 *
 * Routes for bi-directional PEMS sync (PostgreSQL → PEMS)
 * Phase 2, Track A - Task 2A.6: Routes Configuration
 */

import { Router } from 'express';
import {
  triggerWriteSync,
  getSyncStatus,
  resolveConflict,
  listConflicts
} from '../controllers/pemsWriteSyncController';
import { authenticateJWT } from '../middleware/auth';
import { requirePermission } from '../middleware/requirePermission';
import { requireOrganization } from '../middleware/requireOrganization';
import { validateRequest } from '../middleware/validateRequest';
import { syncRateLimiter } from '../middleware/perUserRateLimiter';
import {
  getSyncStatusSchema,
  writeSyncSchema,
  resolveConflictSchema,
  listConflictsSchema
} from '../validation/syncSchemas';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

/**
 * POST /api/pems/write-sync
 * Trigger manual sync of pending modifications to PEMS
 *
 * Request:
 * {
 *   "organizationId": "uuid",
 *   "modificationIds": ["uuid1", "uuid2"], // optional - sync specific mods
 *   "priority": 5 // optional - queue priority (0-10)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "jobId": "write-sync-1234567890-orgId",
 *   "queuedCount": 42,
 *   "estimatedCompletionTime": "2025-11-28T11:00:00Z"
 * }
 */
router.post(
  '/write-sync',
  syncRateLimiter,
  validateRequest(writeSyncSchema),
  requireOrganization,
  requirePermission('perm_Sync'),
  triggerWriteSync
);

/**
 * GET /api/pems/sync-status
 * Query sync metrics and queue status
 *
 * Query params:
 * - organizationId (required)
 * - status (optional): pending | processing | completed | failed
 * - startDate (optional): ISO date
 * - endDate (optional): ISO date
 *
 * Response:
 * {
 *   "totalQueued": 10,
 *   "processing": 2,
 *   "completed": 150,
 *   "failed": 3,
 *   "avgSyncTime": 2500, // milliseconds
 *   "lastSyncAt": "2025-11-28T10:30:00Z",
 *   "nextSyncAt": "2025-11-28T10:31:00Z",
 *   "health": "healthy", // healthy | degraded | unhealthy
 *   "successRate": 98 // percentage
 * }
 */
router.get(
  '/sync-status',
  syncRateLimiter,
  validateRequest(getSyncStatusSchema),
  requireOrganization,
  requirePermission('perm_Read'),
  getSyncStatus
);

/**
 * POST /api/pems/conflicts/:conflictId/resolve
 * Resolve a sync conflict
 *
 * Request:
 * {
 *   "resolution": "use_local" | "use_pems" | "merge",
 *   "mergedData": { ... } // required if resolution is "merge"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "conflictId": "uuid",
 *   "resolvedAt": "2025-11-28T10:35:00Z",
 *   "appliedChanges": { ... }
 * }
 */
router.post(
  '/conflicts/:conflictId/resolve',
  validateRequest(resolveConflictSchema),
  requirePermission('perm_Sync'),
  resolveConflict
);

/**
 * GET /api/pems/conflicts
 * List conflicts for an organization
 *
 * Query params:
 * - organizationId (required)
 * - status (optional): unresolved | resolved
 *
 * Response:
 * {
 *   "conflicts": [
 *     {
 *       "id": "uuid",
 *       "pfaId": "PFA-12345",
 *       "pfaDetails": {
 *         "category": "Excavators",
 *         "class": "Large"
 *       },
 *       "localVersion": 3,
 *       "pemsVersion": 5,
 *       "conflictFields": ["forecastStart", "monthlyRate"],
 *       "localData": { ... },
 *       "pemsData": { ... },
 *       "status": "unresolved",
 *       "createdAt": "2025-11-28T10:00:00Z",
 *       "modifiedBy": {
 *         "id": "uuid",
 *         "username": "john.doe",
 *         "email": "john.doe@example.com"
 *       }
 *     }
 *   ],
 *   "total": 5
 * }
 */
router.get(
  '/conflicts',
  validateRequest(listConflictsSchema),
  requireOrganization,
  requirePermission('perm_Read'),
  listConflicts
);

export default router;
