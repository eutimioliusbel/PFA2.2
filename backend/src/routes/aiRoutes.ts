// backend/src/routes/aiRoutes.ts
/**
 * AI Routes
 *
 * Phase 6 of ADR-005 Multi-Tenant Access Control
 *
 * Routes for AI-powered features including:
 * - Chat (existing)
 * - Usage stats (existing)
 * - Permission suggestions (Task 6.1)
 * - Security anomaly detection (Task 6.2)
 * - Financial access monitoring (Task 6.3)
 * - Natural language permission queries (Task 6.4)
 *
 * AI Feature Enforcement (Three-tier):
 * - Organization level: Must have feature enabled
 * - Role template level: Defines default capabilities
 * - User level: Can override role template settings
 */

import { Router } from 'express';
import aiController from '../controllers/aiController';
import { authenticateJWT } from '../middleware/auth';
import { aiRateLimiter } from '../middleware/rateLimiter';
import { requireAiFeature, requireAiAccess } from '../middleware/requireAiFeature';
import {
  suggestPermissions,
  acceptSuggestion,
  getSuggestionStats,
  getRoleTemplates,
} from '../controllers/aiPermissionController';
import {
  getAnomalies,
  getAnomalyDetails,
  acknowledgeAnomaly,
  getAnomalySummary,
  detectLoginAnomaly,
} from '../controllers/aiAnomalyController';
import {
  getFinancialAccessReport,
  getFinancialAccessAlerts,
  getComplianceReport,
  checkFinancialAccess,
  logFinancialAccess,
} from '../controllers/aiFinancialController';
import {
  processNaturalLanguageQuery,
  getQuerySuggestions,
  getQueryHistory,
} from '../controllers/aiNLPermissionController';
import {
  getAITrainingData,
  getPermissionHistory,
  getUserActivityBaseline,
  getPrivacyPolicy,
} from '../controllers/aiDataHooksController';

const router = Router();

// All AI routes require authentication and stricter rate limiting
router.use(authenticateJWT);
router.use(aiRateLimiter);

// ============================================================================
// Existing Routes - Chat requires ai_ChatAssistant feature
// ============================================================================

router.post('/chat', requireAiFeature('ai_ChatAssistant'), aiController.chat);
router.get('/usage', aiController.getUsage); // Usage stats don't require specific feature

// ============================================================================
// Permission Suggestion Routes (Phase 6, Task 6.1)
// Requires: ai_PermissionSuggestions feature
// ============================================================================

/**
 * POST /api/ai/suggest-permissions
 *
 * Generate AI-powered permission suggestions for user-org assignment
 * Requires: perm_ManageUsers on the target organization + ai_PermissionSuggestions
 */
router.post('/suggest-permissions', requireAiFeature('ai_PermissionSuggestions'), suggestPermissions);

/**
 * POST /api/ai/accept-suggestion
 *
 * Record suggestion acceptance/rejection for AI training
 */
router.post('/accept-suggestion', requireAiFeature('ai_PermissionSuggestions'), acceptSuggestion);

/**
 * GET /api/ai/suggestion-stats
 *
 * Get AI suggestion quality statistics (admin only)
 */
router.get('/suggestion-stats', requireAiFeature('ai_PermissionSuggestions'), getSuggestionStats);

/**
 * GET /api/ai/role-templates
 *
 * Get predefined role templates with capabilities
 */
router.get('/role-templates', getRoleTemplates); // Public within authenticated users

// ============================================================================
// Security Anomaly Detection Routes (Phase 6, Task 6.2)
// Requires: ai_AnomalyDetection feature
// ============================================================================

/**
 * GET /api/ai/anomalies
 *
 * Get list of security anomalies
 */
router.get('/anomalies', requireAiFeature('ai_AnomalyDetection'), getAnomalies);

/**
 * GET /api/ai/anomalies/summary
 *
 * Get anomaly summary statistics
 */
router.get('/anomalies/summary', requireAiFeature('ai_AnomalyDetection'), getAnomalySummary);

/**
 * GET /api/ai/anomalies/:id
 *
 * Get details of a specific anomaly
 */
router.get('/anomalies/:id', requireAiFeature('ai_AnomalyDetection'), getAnomalyDetails);

/**
 * POST /api/ai/anomalies/:id/acknowledge
 *
 * Acknowledge a security anomaly
 */
router.post('/anomalies/:id/acknowledge', requireAiFeature('ai_AnomalyDetection', 'full-access'), acknowledgeAnomaly);

/**
 * POST /api/ai/anomalies/detect/login
 *
 * Manually trigger login anomaly detection (for testing)
 */
router.post('/anomalies/detect/login', requireAiFeature('ai_AnomalyDetection', 'full-access'), detectLoginAnomaly);

// ============================================================================
// Financial Access Monitoring Routes (Phase 6, Task 6.3)
// Requires: ai_FinancialMonitoring feature
// ============================================================================

/**
 * GET /api/ai/financial-access
 *
 * Get financial access report for organization
 */
router.get('/financial-access', requireAiFeature('ai_FinancialMonitoring'), getFinancialAccessReport);

/**
 * GET /api/ai/financial-access/alerts
 *
 * Get financial access alerts
 */
router.get('/financial-access/alerts', requireAiFeature('ai_FinancialMonitoring'), getFinancialAccessAlerts);

/**
 * GET /api/ai/financial-access/compliance
 *
 * Get compliance report for financial data access
 */
router.get('/financial-access/compliance', requireAiFeature('ai_FinancialMonitoring'), getComplianceReport);

/**
 * POST /api/ai/financial-access/check
 *
 * Check if user has financial data access permission
 */
router.post('/financial-access/check', requireAiFeature('ai_FinancialMonitoring'), checkFinancialAccess);

/**
 * POST /api/ai/financial-access/log
 *
 * Log a financial data access event
 */
router.post('/financial-access/log', requireAiFeature('ai_FinancialMonitoring'), logFinancialAccess);

// ============================================================================
// Natural Language Permission Query Routes (Phase 6, Task 6.4)
// Requires: ai_NaturalLanguageQueries feature
// ============================================================================

/**
 * POST /api/ai/nl-query
 *
 * Process a natural language permission query
 * Examples:
 * - "What can john.doe do?"
 * - "Who has access to HOLNG?"
 * - "Who can delete records?"
 * - "Who has access to multiple organizations?"
 */
router.post('/nl-query', requireAiFeature('ai_NaturalLanguageQueries'), processNaturalLanguageQuery);

/**
 * GET /api/ai/nl-query/suggestions
 *
 * Get suggested queries based on user context
 */
router.get('/nl-query/suggestions', requireAiFeature('ai_NaturalLanguageQueries'), getQuerySuggestions);

/**
 * GET /api/ai/nl-query/history
 *
 * Get user's recent permission query history
 */
router.get('/nl-query/history', requireAiFeature('ai_NaturalLanguageQueries'), getQueryHistory);

// ============================================================================
// AI Data Hooks Routes (Phase 6, Task 6.5)
// Requires: AI master access (perm_UseAiFeatures)
// ============================================================================

/**
 * GET /api/ai/data-hooks/training-data
 *
 * Get aggregated AI training data for an organization
 * Returns privacy-preserving statistics, NOT raw logs
 */
router.get('/data-hooks/training-data', requireAiAccess(), getAITrainingData);

/**
 * GET /api/ai/data-hooks/permission-history
 *
 * Get permission change history for AI suggestions training
 */
router.get('/data-hooks/permission-history', requireAiAccess(), getPermissionHistory);

/**
 * GET /api/ai/data-hooks/user-baseline
 *
 * Get user activity baseline for anomaly detection
 */
router.get('/data-hooks/user-baseline', requireAiAccess(), getUserActivityBaseline);

/**
 * GET /api/ai/data-hooks/privacy-policy
 *
 * Get the AI data collection privacy policy (public within authenticated users)
 */
router.get('/data-hooks/privacy-policy', getPrivacyPolicy);

export default router;
