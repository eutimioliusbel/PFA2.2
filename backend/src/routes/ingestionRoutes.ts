/**
 * Bronze Layer Ingestion Routes (ADR-007 Phase 2)
 *
 * REST API routes for PEMS data ingestion to Bronze layer.
 */

import { Router } from 'express';
import {
  startIngestion,
  getIngestionProgress,
  getIngestionStatus,
  getIngestionHistory,
  getBronzeRecords
} from '../controllers/ingestionController';
import { requirePermission } from '../middleware/requirePermission';

const router = Router();

/**
 * POST /api/ingestion/ingest
 *
 * Trigger Bronze layer ingestion for a specific API endpoint.
 * Requires perm_Sync permission.
 *
 * Body:
 * {
 *   "endpointId": "endpoint-uuid",
 *   "syncType": "full" | "delta"  // default: "full"
 * }
 *
 * Returns: 202 Accepted with batch ID for progress tracking
 */
router.post('/ingest', requirePermission('perm_Sync'), startIngestion);

/**
 * GET /api/ingestion/:batchId/progress
 *
 * Get real-time progress for an active ingestion batch.
 * Requires perm_Read permission.
 *
 * Returns: Current ingestion progress (status, records processed, etc.)
 */
router.get('/:batchId/progress', requirePermission('perm_Read'), getIngestionProgress);

/**
 * GET /api/ingestion/:batchId/status
 *
 * Get status and metadata for a completed ingestion batch.
 * Requires perm_Read permission.
 *
 * Returns: Batch metadata (record count, schema fingerprint, errors, etc.)
 */
router.get('/:batchId/status', requirePermission('perm_Read'), getIngestionStatus);

/**
 * GET /api/ingestion/history
 *
 * Get ingestion history with optional filtering and pagination.
 * Requires perm_Read permission.
 *
 * Query params:
 * - organizationId: Filter by organization
 * - endpointId: Filter by endpoint
 * - limit: Number of batches (default 20, max 100)
 * - offset: Pagination offset (default 0)
 *
 * Returns: Array of batch metadata
 */
router.get('/history', requirePermission('perm_Read'), getIngestionHistory);

/**
 * GET /api/ingestion/records/:syncBatchId
 *
 * Get Bronze records for a specific batch (for debugging).
 * Requires perm_Read permission.
 *
 * Query params:
 * - limit: Number of records (default 10, max 100)
 * - offset: Pagination offset (default 0)
 *
 * Returns: Array of raw Bronze records
 */
router.get('/records/:syncBatchId', requirePermission('perm_Read'), getBronzeRecords);

export default router;
