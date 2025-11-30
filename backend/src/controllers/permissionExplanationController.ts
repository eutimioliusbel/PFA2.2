// backend/src/controllers/permissionExplanationController.ts
/**
 * Permission Explanation Controller
 *
 * Phase 7, Task 7.1 of ADR-005 Multi-Tenant Access Control
 * AI Use Case 16: Context-Aware Access Explanation
 *
 * Handles API endpoints for permission explanations.
 */

import { Request, Response } from 'express';
import permissionExplanationService from '../services/ai/PermissionExplanationService';
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
 * POST /api/permissions/explain
 *
 * Explain why a user is denied permission for a specific action
 *
 * Request Body:
 * {
 *   "userId": "user-uuid",
 *   "organizationId": "org-uuid",
 *   "action": "perm_Sync" | "pems:sync" | etc.
 * }
 *
 * Response (if denied):
 * {
 *   "allowed": false,
 *   "explanation": {
 *     "summary": "You cannot sync data because...",
 *     "reasons": ["Reason 1", "Reason 2"],
 *     "resolveActions": [{ "action": "...", "contact": "...", "eta": "..." }],
 *     "confidence": 0.95,
 *     "permissionChain": [...],
 *     "cached": true,
 *     "generationTimeMs": 12
 *   }
 * }
 *
 * Response (if allowed):
 * {
 *   "allowed": true,
 *   "explanation": null
 * }
 */
export async function explainPermissionDenial(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const requestingUser = req.user;

    if (!requestingUser) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    const { userId, organizationId, action } = req.body;

    // Validate inputs
    if (!userId || !organizationId || !action) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: userId, organizationId, action',
      });
      return;
    }

    // Security check: Users can only query their own permissions unless they're admin
    const isAdmin = requestingUser.organizations.some(
      org => org.role === 'admin' || org.permissions?.perm_ManageUsers
    );

    if (!isAdmin && userId !== requestingUser.userId) {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'You can only query your own permissions',
      });
      return;
    }

    // Generate explanation
    const explanation = await permissionExplanationService.explainPermissionDenial({
      userId,
      organizationId,
      action,
    });

    if (!explanation) {
      // User has permission (no denial to explain)
      res.status(200).json({
        allowed: true,
        explanation: null,
      });
      return;
    }

    // User is denied (return explanation)
    logger.info('Permission explanation generated', {
      userId,
      organizationId,
      action,
      cached: explanation.cached,
      generationTimeMs: explanation.generationTimeMs,
      confidence: explanation.confidence,
    });

    res.status(200).json({
      allowed: false,
      explanation,
    });
  } catch (error: unknown) {
      handleControllerError(error, res, 'PermissionExplanationController.unknown');
    }
}

/**
 * GET /api/permissions/explain/cache-stats
 *
 * Get cache statistics (admin only)
 */
export async function getCacheStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const requestingUser = req.user;

    if (!requestingUser) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    // Only admins can view cache stats
    const isAdmin = requestingUser.organizations.some(
      org => org.role === 'admin' || org.permissions?.perm_ManageSettings
    );

    if (!isAdmin) {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Admin permission required',
      });
      return;
    }

    const stats = permissionExplanationService.getCacheStats();

    res.json({
      success: true,
      cache: stats,
    });
  } catch (error: unknown) {
      handleControllerError(error, res, 'PermissionExplanationController.unknown');
    }
}

/**
 * POST /api/permissions/explain/cache/clear
 *
 * Clear the explanation cache (admin only)
 */
export async function clearCache(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const requestingUser = req.user;

    if (!requestingUser) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    // Only admins can clear cache
    const isAdmin = requestingUser.organizations.some(
      org => org.role === 'admin' || org.permissions?.perm_ManageSettings
    );

    if (!isAdmin) {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Admin permission required',
      });
      return;
    }

    permissionExplanationService.clearCache();

    logger.info('Permission explanation cache cleared', {
      clearedBy: requestingUser.userId,
    });

    res.json({
      success: true,
      message: 'Cache cleared successfully',
    });
  } catch (error: unknown) {
      handleControllerError(error, res, 'PermissionExplanationController.unknown');
    }
}

/**
 * POST /api/permissions/explain/batch
 *
 * Batch explain multiple permission denials at once
 * Useful for UI components that need to check multiple actions
 */
export async function explainBatchPermissions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const requestingUser = req.user;

    if (!requestingUser) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    const { userId, organizationId, actions } = req.body;

    // Validate inputs
    if (!userId || !organizationId || !Array.isArray(actions) || actions.length === 0) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: userId, organizationId, actions (array)',
      });
      return;
    }

    // Limit batch size
    if (actions.length > 20) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Maximum 20 actions per batch',
      });
      return;
    }

    // Security check
    const isAdmin = requestingUser.organizations.some(
      org => org.role === 'admin' || org.permissions?.perm_ManageUsers
    );

    if (!isAdmin && userId !== requestingUser.userId) {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'You can only query your own permissions',
      });
      return;
    }

    // Generate explanations for each action
    const results: Record<string, { allowed: boolean; explanation: any }> = {};

    await Promise.all(
      actions.map(async (action: string) => {
        try {
          const explanation = await permissionExplanationService.explainPermissionDenial({
            userId,
            organizationId,
            action,
          });

          results[action] = {
            allowed: explanation === null,
            explanation,
          };
        } catch (error) {
          logger.error(`Batch explanation error for action ${action}:`, error);
          results[action] = {
            allowed: false,
            explanation: {
              summary: 'Unable to determine permission status',
              reasons: ['Error checking permission'],
              resolveActions: [],
              confidence: 0,
              permissionChain: [],
              cached: false,
              generationTimeMs: 0,
            },
          };
        }
      })
    );

    res.json({
      success: true,
      results,
    });
  } catch (error: unknown) {
      handleControllerError(error, res, 'PermissionExplanationController.unknown');
    }
}
