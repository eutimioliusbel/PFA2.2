// backend/src/controllers/aiAnomalyController.ts
/**
 * AI Anomaly Detection Controller
 *
 * Phase 6, Task 6.2 of ADR-005 Multi-Tenant Access Control
 *
 * Handles API endpoints for security anomaly detection and management.
 */

import { Request, Response } from 'express';
import anomalyDetectionService, { AlertType, RiskLevel } from '../services/ai/AnomalyDetectionService';
import { logger } from '../utils/logger';
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
 * GET /api/ai/anomalies
 *
 * Get list of security anomalies
 *
 * Query Parameters:
 * - organizationId: Filter by organization
 * - userId: Filter by user
 * - alertType: Filter by alert type
 * - risk: Filter by risk level
 * - acknowledged: Filter by acknowledgement status
 * - limit: Number of results (default 50)
 * - offset: Pagination offset
 */
export async function getAnomalies(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const requestingUser = req.user;

    if (!requestingUser) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    // Only admins or users with ManageUsers can view anomalies
    const canView = requestingUser.organizations.some(
      org => org.role === 'admin' || org.permissions?.perm_ManageUsers
    );

    if (!canView) {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Admin or ManageUsers permission required to view security anomalies',
      });
      return;
    }

    const { organizationId, userId, alertType, risk, acknowledged, limit, offset } = req.query;

    const result = await anomalyDetectionService.getAnomalies({
      organizationId: organizationId as string | undefined,
      userId: userId as string | undefined,
      alertType: alertType as AlertType | undefined,
      risk: risk as RiskLevel | undefined,
      acknowledged: acknowledged !== undefined ? acknowledged === 'true' : undefined,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });

    res.json({
      anomalies: result.anomalies,
      pagination: {
        total: result.total,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      },
    });
  } catch (error: unknown) {
      handleControllerError(error, res, 'AiAnomalyController.unknown');
    }
}

/**
 * GET /api/ai/anomalies/:id
 *
 * Get details of a specific anomaly
 */
export async function getAnomalyDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const requestingUser = req.user;

    if (!requestingUser) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    const result = await anomalyDetectionService.getAnomalies({
      limit: 1,
      offset: 0,
    });

    const anomaly = result.anomalies.find(a => a.id === id);

    if (!anomaly) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Anomaly not found',
      });
      return;
    }

    res.json({ anomaly });
  } catch (error: unknown) {
      handleControllerError(error, res, 'AiAnomalyController.unknown');
    }
}

/**
 * POST /api/ai/anomalies/:id/acknowledge
 *
 * Acknowledge a security anomaly
 *
 * Request Body:
 * {
 *   "action": "dismiss" | "investigate" | "resolve",
 *   "comment": "Optional comment"
 * }
 */
export async function acknowledgeAnomaly(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { action, comment } = req.body;
    const requestingUser = req.user;

    if (!requestingUser) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    if (!action || !['dismiss', 'investigate', 'resolve'].includes(action)) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'action must be one of: dismiss, investigate, resolve',
      });
      return;
    }

    // Only admins can acknowledge anomalies
    const isAdmin = requestingUser.organizations.some(
      org => org.role === 'admin' || org.permissions?.perm_ManageUsers
    );

    if (!isAdmin) {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Admin permission required to acknowledge anomalies',
      });
      return;
    }

    await anomalyDetectionService.acknowledgeAnomaly(
      id,
      requestingUser.userId,
      action,
      comment
    );

    logger.info('Anomaly acknowledged', {
      anomalyId: id,
      acknowledgedBy: requestingUser.userId,
      action,
    });

    res.json({
      success: true,
      message: `Anomaly ${action === 'dismiss' ? 'dismissed' : action === 'investigate' ? 'marked for investigation' : 'resolved'}`,
    });
  } catch (error: unknown) {
      handleControllerError(error, res, 'AiAnomalyController.unknown');
    }
}

/**
 * GET /api/ai/anomalies/summary
 *
 * Get summary statistics for security anomalies
 */
export async function getAnomalySummary(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const requestingUser = req.user;

    if (!requestingUser) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    const { organizationId } = req.query;

    // Get all anomalies for summary
    const result = await anomalyDetectionService.getAnomalies({
      organizationId: organizationId as string | undefined,
      limit: 1000,
      offset: 0,
    });

    // Calculate summary
    const summary = {
      total: result.total,
      byRisk: {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
      },
      byType: {} as Record<string, number>,
      unacknowledged: 0,
      last24Hours: 0,
      last7Days: 0,
    };

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    result.anomalies.forEach(anomaly => {
      // Count by risk
      summary.byRisk[anomaly.risk]++;

      // Count by type
      summary.byType[anomaly.alertType] = (summary.byType[anomaly.alertType] || 0) + 1;

      // Count unacknowledged
      if (!anomaly.acknowledged) {
        summary.unacknowledged++;
      }

      // Count by time
      const detectedTime = new Date(anomaly.detectedAt).getTime();
      if (detectedTime > oneDayAgo) {
        summary.last24Hours++;
      }
      if (detectedTime > sevenDaysAgo) {
        summary.last7Days++;
      }
    });

    res.json({ summary });
  } catch (error: unknown) {
      handleControllerError(error, res, 'AiAnomalyController.unknown');
    }
}

/**
 * POST /api/ai/anomalies/detect/login
 *
 * Manually trigger login anomaly detection (for testing)
 * In production, this is called automatically by auth middleware
 */
export async function detectLoginAnomaly(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { userId, loginEvent } = req.body;
    const requestingUser = req.user;

    if (!requestingUser) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    // Only admins can trigger manual detection
    const isAdmin = requestingUser.organizations.some(org => org.role === 'admin');

    if (!isAdmin) {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Admin permission required',
      });
      return;
    }

    const anomaly = await anomalyDetectionService.detectLoginAnomalies(
      userId || requestingUser.userId,
      loginEvent || {
        timestamp: new Date(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    res.json({
      detected: !!anomaly,
      anomaly,
    });
  } catch (error: unknown) {
      handleControllerError(error, res, 'AiAnomalyController.unknown');
    }
}
