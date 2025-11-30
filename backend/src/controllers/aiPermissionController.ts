// backend/src/controllers/aiPermissionController.ts
/**
 * AI Permission Suggestion Controller
 *
 * Phase 6, Task 6.1 of ADR-005 Multi-Tenant Access Control
 *
 * Handles API endpoints for AI-powered permission suggestions.
 */

import { Request, Response } from 'express';
import permissionSuggestionService from '../services/ai/PermissionSuggestionService';
import prisma from '../config/database';
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
 * POST /api/ai/suggest-permissions
 *
 * Generate AI-powered permission suggestions for a user-organization assignment.
 *
 * Request Body:
 * {
 *   "userId": "user-123",
 *   "organizationId": "org-456",
 *   "role": "Project Manager",
 *   "department": "Construction"
 * }
 *
 * Response:
 * {
 *   "suggestedRole": "editor",
 *   "suggestedCapabilities": { ... },
 *   "confidence": 0.92,
 *   "reasoning": "...",
 *   "basedOnUsers": 150,
 *   "securityWarnings": [...]
 * }
 */
export async function suggestPermissions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { userId, organizationId, role, department } = req.body;
    const requestingUser = req.user;

    // Validate request
    if (!userId || !organizationId) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'userId and organizationId are required',
      });
      return;
    }

    if (!requestingUser) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    // Check if requesting user has permission to manage users in this organization
    const canManage = await checkCanManageUsers(requestingUser.userId, organizationId);

    if (!canManage) {
      logger.warn('Permission suggestion denied - user lacks perm_ManageUsers', {
        requestingUserId: requestingUser.userId,
        targetUserId: userId,
        organizationId,
      });

      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'You do not have permission to manage users in this organization',
        permission: 'perm_ManageUsers',
      });
      return;
    }

    // Generate AI suggestion
    const suggestion = await permissionSuggestionService.suggestPermissions({
      userId,
      organizationId,
      role,
      department,
    });

    logger.info('Permission suggestion generated', {
      requestingUserId: requestingUser.userId,
      targetUserId: userId,
      organizationId,
      suggestedRole: suggestion.suggestedRole,
      confidence: suggestion.confidence,
    });

    res.json(suggestion);
  } catch (error: unknown) {
    handleControllerError(error, res, 'AiPermissionController.suggestPermissions');
  }
}

/**
 * POST /api/ai/accept-suggestion
 *
 * Record when admin accepts/rejects AI suggestion (for training feedback loop)
 *
 * Request Body:
 * {
 *   "suggestionId": "log-123",
 *   "accepted": true,
 *   "actualPermissions": { ... }
 * }
 */
export async function acceptSuggestion(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { suggestionId, accepted, actualPermissions } = req.body;
    const requestingUser = req.user;

    if (!suggestionId) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'suggestionId is required',
      });
      return;
    }

    if (!requestingUser) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    // Record the outcome
    await permissionSuggestionService.recordSuggestionOutcome(
      suggestionId,
      accepted,
      actualPermissions
    );

    logger.info('Permission suggestion outcome recorded', {
      suggestionId,
      accepted,
      userId: requestingUser.userId,
    });

    res.json({ success: true });
  } catch (error: unknown) {
    handleControllerError(error, res, 'AiPermissionController.acceptSuggestion');
  }
}

/**
 * GET /api/ai/suggestion-stats
 *
 * Get AI suggestion acceptance statistics for quality monitoring
 *
 * Query Parameters:
 * - organizationId (optional): Filter by organization
 */
export async function getSuggestionStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { organizationId } = req.query;
    const requestingUser = req.user;

    if (!requestingUser) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    // Only admins can view stats
    const isAdmin = requestingUser.organizations.some(
      (org) => org.role === 'admin' || org.permissions?.perm_ManageUsers
    );

    if (!isAdmin) {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Admin access required to view suggestion statistics',
      });
      return;
    }

    const stats = await permissionSuggestionService.getSuggestionStats(
      organizationId as string | undefined
    );

    res.json(stats);
  } catch (error: unknown) {
    handleControllerError(error, res, 'AiPermissionController.getSuggestionStats');
  }
}

/**
 * GET /api/ai/role-templates
 *
 * Get predefined role templates with their default capabilities
 */
export async function getRoleTemplates(_req: AuthenticatedRequest, res: Response) {
  try {
    const templates = {
      viewer: {
        name: 'Viewer',
        description: 'Read-only access to PFA data',
        capabilities: {
          perm_Read: true,
          perm_EditForecast: false,
          perm_EditActuals: false,
          perm_Delete: false,
          perm_Import: false,
          perm_RefreshData: false,
          perm_Export: false,
          perm_ViewFinancials: false,
          perm_SaveDraft: false,
          perm_Sync: false,
          perm_ManageUsers: false,
          perm_ManageSettings: false,
          perm_ConfigureAlerts: false,
          perm_Impersonate: false,
        },
      },
      member: {
        name: 'Member',
        description: 'Basic read and export access',
        capabilities: {
          perm_Read: true,
          perm_EditForecast: false,
          perm_EditActuals: false,
          perm_Delete: false,
          perm_Import: false,
          perm_RefreshData: false,
          perm_Export: true,
          perm_ViewFinancials: false,
          perm_SaveDraft: false,
          perm_Sync: false,
          perm_ManageUsers: false,
          perm_ManageSettings: false,
          perm_ConfigureAlerts: false,
          perm_Impersonate: false,
        },
      },
      editor: {
        name: 'Editor',
        description: 'Can edit forecasts and manage drafts',
        capabilities: {
          perm_Read: true,
          perm_EditForecast: true,
          perm_EditActuals: false,
          perm_Delete: false,
          perm_Import: false,
          perm_RefreshData: true,
          perm_Export: true,
          perm_ViewFinancials: false,
          perm_SaveDraft: true,
          perm_Sync: false,
          perm_ManageUsers: false,
          perm_ManageSettings: false,
          perm_ConfigureAlerts: false,
          perm_Impersonate: false,
        },
      },
      beo: {
        name: 'BEO User',
        description: 'Business Executive Overhead - financial visibility',
        capabilities: {
          perm_Read: true,
          perm_EditForecast: false,
          perm_EditActuals: false,
          perm_Delete: false,
          perm_Import: false,
          perm_RefreshData: false,
          perm_Export: true,
          perm_ViewFinancials: true,
          perm_SaveDraft: false,
          perm_Sync: false,
          perm_ManageUsers: false,
          perm_ManageSettings: false,
          perm_ConfigureAlerts: true,
          perm_Impersonate: false,
        },
      },
      admin: {
        name: 'Admin',
        description: 'Full administrative access',
        capabilities: {
          perm_Read: true,
          perm_EditForecast: true,
          perm_EditActuals: true,
          perm_Delete: true,
          perm_Import: true,
          perm_RefreshData: true,
          perm_Export: true,
          perm_ViewFinancials: true,
          perm_SaveDraft: true,
          perm_Sync: true,
          perm_ManageUsers: true,
          perm_ManageSettings: true,
          perm_ConfigureAlerts: true,
          perm_Impersonate: false, // Never auto-grant
        },
      },
    };

    res.json({ templates });
  } catch (error: unknown) {
    handleControllerError(error, res, 'AiPermissionController.getRoleTemplates');
  }
}

/**
 * Helper function to check if user can manage users in an organization
 */
async function checkCanManageUsers(userId: string, organizationId: string): Promise<boolean> {
  const userOrg = await prisma.user_organizations.findUnique({
    where: {
      userId_organizationId: { userId, organizationId },
    },
    select: {
      perm_ManageUsers: true,
      role: true,
    },
  });

  // Admin role or explicit perm_ManageUsers permission
  return userOrg?.perm_ManageUsers || userOrg?.role === 'admin' || false;
}
