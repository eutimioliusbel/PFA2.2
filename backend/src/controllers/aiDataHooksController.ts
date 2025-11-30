// backend/src/controllers/aiDataHooksController.ts
/**
 * AI Data Hooks Controller
 *
 * Phase 6, Task 6.5 of ADR-005 Multi-Tenant Access Control
 *
 * Handles API endpoints for AI training data and analytics.
 * All endpoints require authentication and admin/ManageUsers permission.
 */

import { Request, Response } from 'express';
import { DataCollectionService } from '../services/aiDataHooks/DataCollectionService';
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
 * GET /api/ai/data-hooks/training-data
 *
 * Get aggregated AI training data for an organization
 * Returns privacy-preserving statistics, NOT raw logs
 */
export async function getAITrainingData(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const requestingUser = req.user;

    if (!requestingUser) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    // Only admins can access AI training data
    const isAdmin = requestingUser.organizations.some(
      org => org.role === 'admin' || org.permissions?.perm_ManageUsers
    );

    if (!isAdmin) {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Admin or ManageUsers permission required to access AI training data',
      });
      return;
    }

    const { organizationId, startDate, endDate, actionTypes, limit } = req.query;

    const effectiveOrgId = organizationId as string || requestingUser.organizations[0]?.organizationId;

    if (!effectiveOrgId) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'organizationId is required',
      });
      return;
    }

    const trainingData = await DataCollectionService.getAITrainingData(effectiveOrgId, {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      actionTypes: actionTypes ? (actionTypes as string).split(',') : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      organizationId: effectiveOrgId,
      data: trainingData,
    });
  } catch (error: unknown) {
      handleControllerError(error, res, 'AiDataHooksController.unknown');
    }
}

/**
 * GET /api/ai/data-hooks/permission-history
 *
 * Get permission change history for AI suggestions training
 */
export async function getPermissionHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const requestingUser = req.user;

    if (!requestingUser) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    const isAdmin = requestingUser.organizations.some(
      org => org.role === 'admin' || org.permissions?.perm_ManageUsers
    );

    if (!isAdmin) {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Admin or ManageUsers permission required',
      });
      return;
    }

    const { organizationId, userId, limit } = req.query;

    const effectiveOrgId = organizationId as string || requestingUser.organizations[0]?.organizationId;

    if (!effectiveOrgId) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'organizationId is required',
      });
      return;
    }

    const history = await DataCollectionService.getPermissionHistory(effectiveOrgId, {
      userId: userId as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      organizationId: effectiveOrgId,
      history,
    });
  } catch (error: unknown) {
      handleControllerError(error, res, 'AiDataHooksController.unknown');
    }
}

/**
 * GET /api/ai/data-hooks/user-baseline
 *
 * Get user activity baseline for anomaly detection
 */
export async function getUserActivityBaseline(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const requestingUser = req.user;

    if (!requestingUser) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    const isAdmin = requestingUser.organizations.some(
      org => org.role === 'admin' || org.permissions?.perm_ManageUsers
    );

    if (!isAdmin) {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Admin or ManageUsers permission required',
      });
      return;
    }

    const { userId, organizationId, daysBack } = req.query;

    if (!userId) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'userId is required',
      });
      return;
    }

    const effectiveOrgId = organizationId as string || requestingUser.organizations[0]?.organizationId;

    if (!effectiveOrgId) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'organizationId is required',
      });
      return;
    }

    const baseline = await DataCollectionService.getUserActivityBaseline(
      userId as string,
      effectiveOrgId,
      daysBack ? parseInt(daysBack as string) : undefined
    );

    res.json({
      success: true,
      userId,
      organizationId: effectiveOrgId,
      baseline,
    });
  } catch (error: unknown) {
      handleControllerError(error, res, 'AiDataHooksController.unknown');
    }
}

/**
 * GET /api/ai/data-hooks/privacy-policy
 *
 * Get the AI data collection privacy policy
 */
export async function getPrivacyPolicy(_req: AuthenticatedRequest, res: Response) {
  try {
    const policy = {
      version: '1.0.0',
      lastUpdated: '2025-11-27',
      principles: [
        {
          id: 'anonymization',
          title: 'User Anonymization',
          description: 'User IDs are logged instead of usernames or emails. No PII is ever stored in AI training data.',
        },
        {
          id: 'value_masking',
          title: 'Value Masking',
          description: 'Financial values (costs, rates, prices) are never logged. Only the presence of financial data is tracked.',
        },
        {
          id: 'aggregation',
          title: 'Aggregated Statistics',
          description: 'AI training queries return aggregated statistics, not individual audit records.',
        },
        {
          id: 'purpose_limitation',
          title: 'Purpose Limitation',
          description: 'Data is collected only for: permission suggestions, anomaly detection, financial access monitoring, and audit search.',
        },
        {
          id: 'retention',
          title: 'Data Retention',
          description: 'Audit logs are retained for 90 days by default. Organizations can configure shorter retention periods.',
        },
      ],
      sensitiveFields: {
        neverLogged: [
          'passwords',
          'password hashes',
          'API keys',
          'credentials',
          'email addresses',
          'phone numbers',
          'personal addresses',
        ],
        masked: [
          'cost values (logged as "hasCostData: true")',
          'monthly rates (logged as "hasMonthlyRate: true")',
          'purchase prices (logged as "hasPurchasePrice: true")',
        ],
      },
      dataTypes: {
        permissionChanges: {
          description: 'Records of permission grants and revocations',
          purpose: 'Train AI to suggest appropriate permissions based on role/department',
          retention: '90 days',
        },
        userActivity: {
          description: 'Action types, timestamps, and record counts',
          purpose: 'Establish baseline patterns for anomaly detection',
          retention: '30 days',
        },
        financialAccess: {
          description: 'Financial data access events (without values)',
          purpose: 'Compliance monitoring and audit reporting',
          retention: '365 days',
        },
        bulkOperations: {
          description: 'Large-scale data operations (export, delete, update)',
          purpose: 'Data exfiltration detection',
          retention: '90 days',
        },
      },
    };

    res.json({
      success: true,
      policy,
    });
  } catch (error: unknown) {
      handleControllerError(error, res, 'AiDataHooksController.unknown');
    }
}
