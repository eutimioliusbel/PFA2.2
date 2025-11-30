// backend/src/routes/financialRoutes.ts
/**
 * Financial Data Routes
 *
 * Phase 7, Task 7.2 of ADR-005 Multi-Tenant Access Control
 * AI Use Case 17: Financial Data Masking with Relative Indicators
 *
 * Routes for financial data access with automatic masking.
 * All routes require authentication.
 */

import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import {
  getMaskedPfaRecords,
  getPortfolioInsight,
  validateFinancialAccess,
  getCacheStats,
  clearCache,
  maskFinancialData,
} from '../controllers/financialMaskingController';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

/**
 * POST /api/financial/mask
 *
 * Mask financial data in provided PFA records.
 * This is a client-side masking endpoint that accepts records in the request body.
 *
 * Body:
 * {
 *   records: PfaRecord[],          // Array of PFA records with costs
 *   viewFinancialDetails: boolean  // User's capability
 * }
 *
 * Response:
 * {
 *   success: true,
 *   maskedRecords: MaskedPfaRecord[],
 *   portfolioInsight: PortfolioInsight
 * }
 */
router.post('/mask', maskFinancialData);

/**
 * GET /api/financial/masked-records
 *
 * Get PFA records with automatic financial masking based on user permissions.
 * Users without viewFinancialDetails receive masked costs with relative indicators.
 *
 * Query params:
 * - organizationId: string (required)
 * - category?: string[] (optional filter)
 * - limit?: number (default 100)
 * - offset?: number (default 0)
 *
 * Response:
 * {
 *   records: MaskedPfaRecord[],
 *   masked: boolean,
 *   portfolioInsight: PortfolioInsight,
 *   pagination: { total, limit, offset, hasMore }
 * }
 */
router.get('/masked-records', getMaskedPfaRecords);

/**
 * GET /api/financial/portfolio-insight
 *
 * Get portfolio-level budget impact insights without exposing actual costs.
 * Useful for dashboards and overview screens.
 *
 * Query params:
 * - organizationId: string (required)
 * - category?: string (optional filter by category)
 *
 * Response:
 * {
 *   insight: PortfolioInsight,
 *   totalRecords: number
 * }
 */
router.get('/portfolio-insight', getPortfolioInsight);

/**
 * POST /api/financial/validate-access
 *
 * Validate if user has financial data access and log bypass attempts.
 * Used for client-side permission checks before showing financial data.
 *
 * Body:
 * {
 *   organizationId: string,
 *   action: 'view' | 'export'
 * }
 *
 * Response:
 * {
 *   hasAccess: boolean,
 *   viewFinancialDetails: boolean,
 *   canExport: boolean
 * }
 */
router.post('/validate-access', validateFinancialAccess);

/**
 * GET /api/financial/cache-stats
 *
 * Get financial masking cache statistics (admin only).
 *
 * Response:
 * {
 *   cache: { size: number }
 * }
 */
router.get('/cache-stats', getCacheStats);

/**
 * POST /api/financial/cache/clear
 *
 * Clear the financial masking cache (admin only).
 *
 * Response:
 * {
 *   success: boolean,
 *   message: string
 * }
 */
router.post('/cache/clear', clearCache);

export default router;
