// backend/src/controllers/aiFinancialController.ts
/**
 * AI Financial Access Monitoring Controller
 *
 * Phase 6, Task 6.3 of ADR-005 Multi-Tenant Access Control
 *
 * Handles API endpoints for financial data access monitoring and reporting.
 */

import { Request, Response } from 'express';
import financialAccessService from '../services/ai/FinancialAccessMonitoringService';
import { logger as _logger } from '../utils/logger';
import { handleControllerError } from '../utils/errorHandling';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
    organizations: Array<{
      organizationId: string;
      organizationCode: string;
      role: string;
      permissions: Record<string, boolean>;
    }>;
  };
}

/**
 * GET /api/ai/financial-access
 *
 * Get financial access report for organization
 *
 * Query Parameters:
 * - organizationId: Filter by organization
 * - startDate: Start of date range (ISO string)
 * - endDate: End of date range (ISO string)
 */
export async function getFinancialAccessReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const requestingUser = req.user;

    if (!requestingUser) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    // Only admins or users with ManageUsers can view financial access reports
    const canView = requestingUser.organizations.some(
      org => org.role === 'admin' || org.permissions?.perm_ManageUsers
    );

    if (!canView) {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Admin or ManageUsers permission required to view financial access reports',
      });
      return;
    }

    const { organizationId, startDate, endDate } = req.query;

    const report = await financialAccessService.getFinancialAccessReport({
      organizationId: organizationId as string | undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json(report);
  } catch (error: unknown) {
      handleControllerError(error, res, 'AiFinancialController.unknown');
    }
}

/**
 * GET /api/ai/financial-access/alerts
 *
 * Get financial access alerts
 *
 * Query Parameters:
 * - organizationId: Filter by organization
 * - severity: Filter by severity (low, medium, high, critical)
 * - limit: Number of results
 */
export async function getFinancialAccessAlerts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const requestingUser = req.user;

    if (!requestingUser) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    // Only admins can view financial alerts
    const isAdmin = requestingUser.organizations.some(
      org => org.role === 'admin' || org.permissions?.perm_ManageUsers
    );

    if (!isAdmin) {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Admin permission required to view financial alerts',
      });
      return;
    }

    const { organizationId, severity, limit } = req.query;

    const result = await financialAccessService.getFinancialAccessAlerts({
      organizationId: organizationId as string | undefined,
      severity: severity as 'low' | 'medium' | 'high' | 'critical' | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json(result);
  } catch (error: unknown) {
      handleControllerError(error, res, 'AiFinancialController.unknown');
    }
}

/**
 * GET /api/ai/financial-access/compliance
 *
 * Get financial access compliance report
 *
 * Query Parameters:
 * - organizationId: Filter by organization
 * - startDate: Start of reporting period (required)
 * - endDate: End of reporting period (required)
 */
export async function getComplianceReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const requestingUser = req.user;

    if (!requestingUser) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    // Only admins can view compliance reports
    const isAdmin = requestingUser.organizations.some(
      org => org.role === 'admin' || org.permissions?.perm_ManageSettings
    );

    if (!isAdmin) {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Admin permission required to view compliance reports',
      });
      return;
    }

    const { organizationId, startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'startDate and endDate are required',
      });
      return;
    }

    const report = await financialAccessService.getComplianceReport({
      organizationId: organizationId as string | undefined,
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
    });

    res.json(report);
  } catch (error: unknown) {
      handleControllerError(error, res, 'AiFinancialController.unknown');
    }
}

/**
 * POST /api/ai/financial-access/check
 *
 * Check if user has financial data access permission
 *
 * Request Body:
 * {
 *   "userId": "user-id",
 *   "organizationId": "org-id"
 * }
 */
export async function checkFinancialAccess(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const requestingUser = req.user;

    if (!requestingUser) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    const { userId, organizationId } = req.body;

    if (!userId || !organizationId) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'userId and organizationId are required',
      });
      return;
    }

    const result = await financialAccessService.checkFinancialAccess(userId, organizationId);

    res.json(result);
  } catch (error: unknown) {
      handleControllerError(error, res, 'AiFinancialController.unknown');
    }
}

/**
 * POST /api/ai/financial-access/log
 *
 * Log a financial data access event (called by other services)
 *
 * Request Body:
 * {
 *   "userId": "user-id",
 *   "organizationId": "org-id",
 *   "action": "view" | "export" | "modify",
 *   "recordCount": 100,
 *   "fieldsAccessed": ["monthlyRate", "purchasePrice"],
 *   "includesRates": true,
 *   "includesCosts": true
 * }
 */
export async function logFinancialAccess(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const requestingUser = req.user;

    if (!requestingUser) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    const { userId, organizationId, action, recordCount, fieldsAccessed, includesRates, includesCosts, sessionId } = req.body;

    if (!userId || !organizationId || !action) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'userId, organizationId, and action are required',
      });
      return;
    }

    await financialAccessService.logFinancialAccess({
      userId,
      organizationId,
      action,
      recordCount: recordCount || 0,
      fieldsAccessed: fieldsAccessed || [],
      includesRates,
      includesCosts,
      timestamp: new Date(),
      sessionId,
    });

    res.json({ success: true });
  } catch (error: unknown) {
      handleControllerError(error, res, 'AiFinancialController.unknown');
    }
}
