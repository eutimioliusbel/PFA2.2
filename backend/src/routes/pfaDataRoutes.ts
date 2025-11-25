/**
 * @file pfaDataRoutes.ts
 * @description PFA Data API Routes - Live Merge Endpoints (Phase 3)
 *
 * Routes:
 * - GET  /api/pfa/:orgId              - Get merged data (mirror + deltas)
 * - POST /api/pfa/:orgId/draft        - Save draft modifications
 * - POST /api/pfa/:orgId/commit       - Commit drafts to PEMS
 * - POST /api/pfa/:orgId/discard      - Discard draft records
 * - GET  /api/pfa/:orgId/stats        - KPI aggregations
 *
 * Security:
 * - All routes require JWT authentication (authenticateJWT middleware)
 * - Organization access control (requireOrgAccess middleware)
 * - User ID tracked for all modifications
 */

import { Router } from 'express';
import {
  getMergedPfaData,
  saveDraftModifications,
  commitDraftModifications,
  discardDraftModifications,
  getKpiStatistics,
} from '../controllers/pfaDataController';
import { authenticateJWT, requireOrgAccess } from '../middleware/auth';

const router = Router();

// ============================================================================
// Middleware: All routes require authentication
// ============================================================================

router.use(authenticateJWT);

// ============================================================================
// Routes: PFA Data Operations
// ============================================================================

/**
 * GET /api/pfa/:orgId
 * Get merged PFA data (mirror + modifications)
 *
 * Query Parameters:
 * - category: string | string[]        - Filter by category
 * - class: string | string[]           - Filter by class
 * - dor: string | string[]             - Filter by DOR (BEO, PROJECT)
 * - source: string | string[]          - Filter by source (Rental, Purchase)
 * - areaSilo: string | string[]        - Filter by area/silo
 * - manufacturer: string | string[]    - Filter by manufacturer
 * - model: string | string[]           - Filter by model
 * - dateRangeStart: string             - Filter forecast start >= date
 * - dateRangeEnd: string               - Filter forecast end <= date
 * - isActualized: boolean              - Filter by actualized status
 * - isDiscontinued: boolean            - Filter by discontinued status
 * - isFundsTransferable: boolean       - Filter by funds transferable status
 * - syncState: string | string[]       - Filter by sync state (draft, committed, pristine)
 * - searchText: string                 - Full-text search
 * - page: number                       - Page number (default: 1)
 * - pageSize: number                   - Records per page (default: 100)
 * - sortBy: string                     - Sort column (default: forecastStart)
 * - sortOrder: 'asc' | 'desc'          - Sort direction (default: asc)
 *
 * Response:
 * {
 *   success: true,
 *   data: MergedPfaRecord[],
 *   pagination: { page, pageSize, totalRecords, totalPages },
 *   metadata: { queryTime, filters }
 * }
 */
router.get('/:orgId', requireOrgAccess('orgId'), getMergedPfaData);

/**
 * POST /api/pfa/:orgId/draft
 * Save draft modifications (upsert to PfaModification table)
 *
 * Request Body:
 * {
 *   sessionId?: string,
 *   modifications: [
 *     {
 *       pfaId: string,
 *       delta: { forecastStart: '2025-12-01', forecastEnd: '2025-12-15', ... },
 *       changeReason?: string
 *     }
 *   ]
 * }
 *
 * Response:
 * {
 *   success: true,
 *   message: 'Saved N modifications',
 *   sessionId: string,
 *   saved: [{ pfaId, modificationId, version }],
 *   errors?: [{ pfaId, error }]
 * }
 */
router.post('/:orgId/draft', requireOrgAccess('orgId'), saveDraftModifications);

/**
 * POST /api/pfa/:orgId/commit
 * Commit draft modifications to PEMS (trigger sync worker)
 *
 * Request Body:
 * {
 *   sessionId?: string  // Optional: commit specific session only
 * }
 *
 * Response:
 * {
 *   success: true,
 *   message: 'Committed N modifications',
 *   committedCount: number,
 *   syncId?: string     // Will be available in Phase 4
 * }
 */
router.post('/:orgId/commit', requireOrgAccess('orgId'), commitDraftModifications);

/**
 * POST /api/pfa/:orgId/discard
 * Discard draft modifications (delete from PfaModification table)
 *
 * Request Body:
 * {
 *   sessionId?: string,      // Discard specific session
 *   pfaIds?: string[],       // Discard specific PFA records
 *   discardAll?: boolean     // Discard all user drafts
 * }
 *
 * Response:
 * {
 *   success: true,
 *   message: 'Discarded N modifications',
 *   discardedCount: number
 * }
 */
router.post('/:orgId/discard', requireOrgAccess('orgId'), discardDraftModifications);

/**
 * GET /api/pfa/:orgId/stats
 * Get KPI statistics with cost variance calculations
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     totalRecords: number,
 *     actualizedCount: number,
 *     discontinuedCount: number,
 *     draftCount: number,
 *     totalMonthlyRental: number,
 *     totalPurchaseCost: number,
 *     categoryBreakdown: { [category: string]: number }
 *   }
 * }
 */
router.get('/:orgId/stats', requireOrgAccess('orgId'), getKpiStatistics);

export default router;
