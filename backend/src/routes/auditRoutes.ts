/**
 * Audit Routes
 * Phase 5, Task 5.4 - Pre-Flight Transaction Ceremony
 */

import express from 'express';
import {
  logPreFlightReview,
  getPreFlightReviews,
  getPreFlightStats,
  getAuditLogs,
  getRevertPreview,
  revertTransaction,
  semanticSearch,
  getSemanticSearchCacheStats,
  clearSemanticSearchCache,
} from '../controllers/auditController';
import { authenticateJWT } from '../middleware/auth';
import { requirePermission } from '../middleware/requirePermission';

const router = express.Router();

// All audit routes require authentication
router.use(authenticateJWT);

/**
 * POST /api/audit/pre-flight-review
 * Log pre-flight review or bypass
 *
 * Required Permission: perm_EditForecast (for bulk operations)
 * Organization ID: Body field 'organizationId' (required)
 *
 * Request Body:
 * - operationType: string (required) - Type of bulk operation
 * - description: string (required) - Operation description
 * - affectedRecordCount: number (required) - Number of records affected
 * - organizations: string[] (optional) - Organization codes affected
 * - categories: string[] (optional) - Categories affected
 * - changes: array (optional) - Change preview
 * - estimatedImpact: object (optional) - Cost, duration, user impact
 * - comment: string (required for non-bypass) - Reason for operation
 * - confirmed: boolean (required) - User confirmation
 * - bypassedBy: string (optional) - User ID if bypassed
 * - organizationId: string (required) - Organization context
 *
 * Response: Audit log entry with ID
 */
router.post(
  '/pre-flight-review',
  requirePermission('perm_EditForecast'),
  logPreFlightReview
);

/**
 * GET /api/audit/pre-flight-reviews
 * Get pre-flight review history
 *
 * Required Permission: perm_Read
 * Organization ID: Query parameter 'organizationId' (optional)
 *
 * Query Parameters:
 * - organizationId: string (optional) - Filter by organization
 * - userId: string (optional) - Filter by user
 * - limit: number (optional, default: 50) - Max results
 * - offset: number (optional, default: 0) - Pagination offset
 *
 * Response: Array of pre-flight review logs with pagination
 */
router.get(
  '/pre-flight-reviews',
  requirePermission('perm_Read'),
  getPreFlightReviews
);

/**
 * GET /api/audit/pre-flight-stats
 * Get pre-flight statistics
 *
 * Required Permission: perm_Read
 * Organization ID: Query parameter 'organizationId' (optional)
 *
 * Query Parameters:
 * - organizationId: string (optional) - Filter by organization
 * - startDate: string (optional) - Filter start date
 * - endDate: string (optional) - Filter end date
 *
 * Response: Pre-flight statistics (total reviews, bypasses, affected records, operation types)
 */
router.get(
  '/pre-flight-stats',
  requirePermission('perm_Read'),
  getPreFlightStats
);

/**
 * GET /api/audit/logs
 * Get audit log history
 *
 * Required Permission: perm_Read
 * Organization ID: Query parameter 'organizationId' (optional)
 *
 * Query Parameters:
 * - organizationId: string (optional) - Filter by organization
 * - userId: string (optional) - Filter by user
 * - action: string (optional) - Filter by action type
 * - limit: number (optional, default: 100) - Max results
 * - offset: number (optional, default: 0) - Pagination offset
 * - orderBy: string (optional, default: 'timestamp_desc') - Sort order
 *
 * Response: Array of audit logs with pagination
 */
router.get(
  '/logs',
  requirePermission('perm_Read'),
  getAuditLogs
);

/**
 * GET /api/audit/revert/:transactionId/preview
 * Get revert preview for a transaction
 *
 * Required Permission: perm_ManageSettings (timeTravel capability)
 * Organization ID: Query parameter 'organizationId' (required)
 *
 * Path Parameters:
 * - transactionId: string (required) - Transaction ID to preview revert
 *
 * Response: Preview of changes that will be reverted
 */
router.get(
  '/revert/:transactionId/preview',
  requirePermission('perm_ManageSettings'),
  getRevertPreview
);

/**
 * POST /api/audit/revert/:transactionId
 * Revert a transaction (Time Travel)
 *
 * Required Permission: perm_ManageSettings (timeTravel capability)
 * Organization ID: Body field 'organizationId' (required)
 *
 * Path Parameters:
 * - transactionId: string (required) - Transaction ID to revert
 *
 * Request Body:
 * - comment: string (required, min 10 chars) - Reason for revert
 * - organizationId: string (required) - Organization context
 *
 * Response: Revert confirmation with new audit log entry
 */
router.post(
  '/revert/:transactionId',
  requirePermission('perm_ManageSettings'),
  revertTransaction
);

// ============================================================================
// Semantic Audit Search (Phase 7, Task 7.3)
// ============================================================================

/**
 * POST /api/audit/semantic-search
 * Search audit logs using natural language
 *
 * Required Permission: perm_Read (audit log viewing)
 * Organization ID: Body field 'organizationId' (optional, defaults to user's org)
 *
 * Request Body:
 * - query: string (required) - Natural language query (max 500 chars)
 * - contextId?: string (optional) - Previous query ID for multi-turn queries
 * - organizationId?: string (optional) - Organization context
 *
 * Response:
 * - queryId: string - For follow-up queries
 * - parsedQuery: object - Interpreted filters
 * - naturalLanguageSummary: string - Human-readable summary
 * - audit_logs: array - Matching audit log entries
 * - relatedEvents: array - External event correlations
 * - aiInsight: string - AI-generated insight
 * - confidence: number (0-1) - Parse confidence
 * - clarificationNeeded: boolean - True if query is ambiguous
 * - suggestions?: string[] - Clarification suggestions
 *
 * Examples:
 * - "Who modified crane duration last week?"
 * - "Show me permission changes yesterday"
 * - "Why did they do it?" (follow-up with contextId)
 */
router.post(
  '/semantic-search',
  requirePermission('perm_Read'),
  semanticSearch
);

/**
 * GET /api/audit/semantic-search/cache-stats
 * Get semantic search cache statistics
 *
 * Required Permission: perm_ManageSettings (admin only)
 *
 * Response:
 * - cache: { queryCache: number }
 */
router.get(
  '/semantic-search/cache-stats',
  requirePermission('perm_ManageSettings'),
  getSemanticSearchCacheStats
);

/**
 * POST /api/audit/semantic-search/clear-cache
 * Clear semantic search cache
 *
 * Required Permission: perm_ManageSettings (admin only)
 *
 * Response:
 * - success: boolean
 * - message: string
 */
router.post(
  '/semantic-search/clear-cache',
  requirePermission('perm_ManageSettings'),
  clearSemanticSearchCache
);

export default router;
