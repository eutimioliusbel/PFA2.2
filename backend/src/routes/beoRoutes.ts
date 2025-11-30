/**
 * BEO Routes
 *
 * Endpoints for:
 * 1. Glass Mode: Portfolio health monitoring and priority items
 * 2. Boardroom Voice Analyst: Natural language portfolio queries (UC-21)
 * 3. Narrative Variance Generator (UC-22)
 * 4. Asset Arbitrage Detector (UC-23)
 * 5. Vendor Pricing Watchdog (UC-24)
 * 6. Multiverse Scenario Simulator (UC-25)
 *
 * Phase 8, Task 8.1 of ADR-005 Multi-Tenant Access Control
 *
 * SECURITY: CVE-2024-BEO-002 Fix - All cross-org endpoints now require
 * perm_ViewAllOrgs permission via requireBeoAccess middleware.
 */

import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { requireBeoAccess } from '../middleware/requireBeoAccess';

// All controller imports consolidated at top
import {
  // Glass Mode & Voice Analyst
  getPortfolioHealth,
  getPriorityItems,
  handlePortfolioQuery,
  getRecentQueries,
  // Narrative Variance Generator (UC-22)
  generateNarrative,
  getNarrative,
  saveReadingProgress,
  exportNarrativePDF,
  // Asset Arbitrage Detector (UC-23)
  getArbitrageOpportunities,
  proposeArbitrageTransfer,
  // Vendor Pricing Watchdog (UC-24)
  getVendorPricingAnalysis,
  getActiveAnomalies,
  dismissAnomaly,
  getVendorScorecard,
  // Multiverse Scenario Simulator (UC-25)
  simulateScenario,
  listScenarios,
  compareScenarios,
  getScenario,
  exportScenarioPDF
} from '../controllers/beoController';

const router = Router();

// All BEO routes require authentication
router.use(authenticateJWT);

// ============================================================================
// GLASS MODE ROUTES
// ============================================================================

/**
 * GET /api/beo/portfolio-health
 * Get portfolio-wide health metrics across all organizations
 * Requires: perm_ViewAllOrgs (CVE-2024-BEO-002 fix)
 */
router.get('/portfolio-health', requireBeoAccess, getPortfolioHealth);

/**
 * GET /api/beo/priority-items
 * Get priority items and alerts across all organizations
 * Requires: perm_ViewAllOrgs (CVE-2024-BEO-002 fix)
 */
router.get('/priority-items', requireBeoAccess, getPriorityItems);

// ============================================================================
// BOARDROOM VOICE ANALYST ROUTES (UC-21)
// ============================================================================

/**
 * POST /api/beo/query
 * Answer natural language portfolio queries with voice-optimized responses
 * Requires: perm_ViewAllOrgs (CVE-2024-BEO-002 fix)
 *
 * Request Body:
 * {
 *   "query": string,              // e.g., "Which projects are over budget?"
 *   "responseFormat": "conversational" | "structured",
 *   "contextQueryId"?: string      // Optional queryId for follow-up questions
 * }
 */
router.post('/query', requireBeoAccess, handlePortfolioQuery);

/**
 * GET /api/beo/recent-queries
 * Get user's recent portfolio queries for context menu
 * Requires: Authentication only
 */
router.get('/recent-queries', getRecentQueries);

// ============================================================================
// NARRATIVE VARIANCE GENERATOR ROUTES (UC-22)
// ============================================================================

/**
 * POST /api/beo/narrative/generate
 * Generate AI-powered variance narrative for board meetings
 * Requires: perm_ViewAllOrgs (CVE-2024-BEO-002 fix)
 *
 * Request Body:
 * {
 *   "organizationId": string,
 *   "title"?: string,
 *   "dateRange"?: { "start": string, "end": string }
 * }
 */
router.post('/narrative/generate', requireBeoAccess, generateNarrative);

/**
 * GET /api/beo/narrative/:narrativeId
 * Retrieve saved narrative by ID
 * Requires: Authentication only
 */
router.get('/narrative/:narrativeId', getNarrative);

/**
 * POST /api/beo/narrative/:narrativeId/progress
 * Save reading progress for a narrative
 * Requires: Authentication only
 *
 * Request Body:
 * {
 *   "chapter": number (1-5)
 * }
 */
router.post('/narrative/:narrativeId/progress', saveReadingProgress);

/**
 * GET /api/beo/narrative/:narrativeId/export-pdf
 * Export narrative as PDF
 * Requires: Authentication only
 * NOTE: Not yet implemented - returns 501
 */
router.get('/narrative/:narrativeId/export-pdf', exportNarrativePDF);

// ============================================================================
// ASSET ARBITRAGE DETECTOR ROUTES (UC-23)
// ============================================================================

/**
 * GET /api/beo/arbitrage/opportunities
 * Detect and list arbitrage opportunities across organizations
 * Requires: perm_ViewAllOrgs (CVE-2024-BEO-002 fix)
 *
 * Response includes:
 * - List of opportunities with feasibility scores
 * - Summary statistics (total savings, feasible count)
 * - Metadata (orgs analyzed, latency)
 */
router.get('/arbitrage/opportunities', requireBeoAccess, getArbitrageOpportunities);

/**
 * POST /api/beo/arbitrage/propose-transfer
 * Create a transfer proposal based on detected opportunity
 * Requires: perm_ViewAllOrgs (CVE-2024-BEO-002 fix)
 *
 * Request Body:
 * {
 *   "opportunityId": string  // Format: arb-{sourcePfaId}-{destPfaId}
 * }
 */
router.post('/arbitrage/propose-transfer', requireBeoAccess, proposeArbitrageTransfer);

// ============================================================================
// VENDOR PRICING WATCHDOG ROUTES (UC-24)
// ============================================================================

/**
 * GET /api/beo/vendor-pricing/analysis
 * Get comprehensive vendor pricing analysis
 * Requires: perm_ViewAllOrgs (CVE-2024-BEO-002 fix)
 *
 * Response includes:
 * - Market data grouped by category
 * - Detected pricing anomalies
 * - Vendor performance scorecards
 * - Summary statistics
 */
router.get('/vendor-pricing/analysis', requireBeoAccess, getVendorPricingAnalysis);

/**
 * GET /api/beo/vendor-pricing/anomalies
 * Get active pricing anomalies
 * Requires: perm_ViewAllOrgs (CVE-2024-BEO-002 fix)
 */
router.get('/vendor-pricing/anomalies', requireBeoAccess, getActiveAnomalies);

/**
 * POST /api/beo/vendor-pricing/dismiss-anomaly/:id
 * Dismiss a pricing anomaly
 * Requires: perm_ViewAllOrgs (CVE-2024-BEO-002 fix)
 */
router.post('/vendor-pricing/dismiss-anomaly/:id', requireBeoAccess, dismissAnomaly);

/**
 * GET /api/beo/vendor-pricing/scorecard
 * Get vendor performance scorecard
 * Requires: perm_ViewAllOrgs (CVE-2024-BEO-002 fix)
 */
router.get('/vendor-pricing/scorecard', requireBeoAccess, getVendorScorecard);

// ============================================================================
// MULTIVERSE SCENARIO SIMULATOR ROUTES (UC-25)
// ============================================================================

/**
 * POST /api/beo/scenario/simulate
 * Run what-if scenario simulation with optional Monte Carlo analysis
 * Requires: perm_ViewAllOrgs (CVE-2024-BEO-002 fix)
 *
 * Request Body:
 * {
 *   "organizationIds": string[],
 *   "parameters": {
 *     "type": "timeline_shift" | "vendor_switch" | "consolidation" | "budget_cut" | "weather_delay",
 *     "shiftDays"?: number,
 *     "targetVendor"?: string,
 *     "sourceVendor"?: string,
 *     "consolidationPercent"?: number,
 *     "budgetCutPercent"?: number,
 *     "monteCarloEnabled"?: boolean,
 *     "iterations"?: number
 *   }
 * }
 */
router.post('/scenario/simulate', requireBeoAccess, simulateScenario);

/**
 * GET /api/beo/scenario/list
 * List user's scenario simulations
 * Requires: perm_ViewAllOrgs (CVE-2024-BEO-002 fix)
 */
router.get('/scenario/list', requireBeoAccess, listScenarios);

/**
 * POST /api/beo/scenario/compare
 * Compare multiple scenario simulations side-by-side
 * Requires: perm_ViewAllOrgs (CVE-2024-BEO-002 fix)
 *
 * Request Body:
 * {
 *   "scenarioIds": string[]
 * }
 */
router.post('/scenario/compare', requireBeoAccess, compareScenarios);

/**
 * GET /api/beo/scenario/:scenarioId
 * Get scenario simulation by ID
 * Requires: perm_ViewAllOrgs (CVE-2024-BEO-002 fix)
 */
router.get('/scenario/:scenarioId', requireBeoAccess, getScenario);

/**
 * GET /api/beo/scenario/:scenarioId/export-pdf
 * Export scenario as PDF
 * Requires: perm_ViewAllOrgs (CVE-2024-BEO-002 fix)
 * NOTE: Not yet implemented - returns 501
 */
router.get('/scenario/:scenarioId/export-pdf', requireBeoAccess, exportScenarioPDF);

export default router;
