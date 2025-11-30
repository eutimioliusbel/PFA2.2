// backend/src/controllers/roleDriftController.ts
/**
 * Role Drift Controller
 *
 * Phase 7, Task 7.4 of ADR-005 Multi-Tenant Access Control
 * AI Use Case 19: Role Drift Detection and Role Template Suggestions
 *
 * API endpoints for detecting role drift patterns and applying
 * role refactoring suggestions.
 */

import { Request, Response } from 'express';
import { roleDriftDetectionService, DriftPattern } from '../services/ai/RoleDriftDetectionService';
import { logger } from '../utils/logger';
import { handleControllerError } from '../utils/errorHandling';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Controllers
// ============================================================================

/**
 * POST /api/roles/detect-drift
 *
 * Detect role drift patterns in an organization.
 * Analyzes user permission overrides to find common patterns.
 *
 * Request body:
 * - organizationId: string (required)
 *
 * Response:
 * - driftDetected: boolean
 * - patterns: array of drift patterns
 * - recommendations: array of recommended actions
 * - summary: analysis summary
 */
export async function detectRoleDrift(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    const { organizationId } = req.body;

    if (!organizationId || typeof organizationId !== 'string') {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Missing required field: organizationId',
      });
      return;
    }

    // Verify user has access to this organization
    const userOrg = user.organizations.find(org => org.organizationId === organizationId);
    if (!userOrg) {
      res.status(403).json({
        error: 'ACCESS_DENIED',
        message: 'You do not have access to this organization',
      });
      return;
    }

    // Check if user has permission to manage users/settings
    if (!userOrg.permissions?.perm_ManageUsers && !userOrg.permissions?.perm_ManageSettings) {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'You need ManageUsers or ManageSettings permission to detect role drift',
      });
      return;
    }

    const result = await roleDriftDetectionService.detectRoleDrift({ organizationId });

    logger.info('Role drift detection completed', {
      userId: user.userId,
      organizationId,
      driftDetected: result.driftDetected,
      patternsCount: result.patterns.length,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
      handleControllerError(error, res, 'RoleDriftController.unknown');
    }
}

/**
 * POST /api/roles/apply-refactor
 *
 * Apply a role refactor suggestion - create new role and migrate users.
 *
 * Request body:
 * - organizationId: string (required)
 * - pattern: DriftPattern (required)
 * - customRoleName?: string (optional override for suggested name)
 *
 * Response:
 * - success: boolean
 * - newRoleCreated: boolean
 * - newRoleId: string
 * - newRoleName: string
 * - usersMigrated: number
 * - overridesRemoved: number
 * - rollbackId: string
 * - rollbackAvailable: boolean
 * - rollbackExpiresAt: string
 */
export async function applyRoleRefactor(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    const { organizationId, pattern, customRoleName } = req.body;

    if (!organizationId || typeof organizationId !== 'string') {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Missing required field: organizationId',
      });
      return;
    }

    if (!pattern || !pattern.id) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Missing required field: pattern',
      });
      return;
    }

    // Verify user has access to this organization
    const userOrg = user.organizations.find(org => org.organizationId === organizationId);
    if (!userOrg) {
      res.status(403).json({
        error: 'ACCESS_DENIED',
        message: 'You do not have access to this organization',
      });
      return;
    }

    // Check if user has permission to manage users (required for role refactoring)
    if (!userOrg.permissions?.perm_ManageUsers) {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'ManageUsers permission required to apply role refactors',
      });
      return;
    }

    const result = await roleDriftDetectionService.applyRoleRefactor({
      pattern: pattern as DriftPattern,
      adminUserId: user.userId,
      organizationId,
      customRoleName,
    });

    if (!result.success) {
      res.status(400).json({
        error: 'REFACTOR_FAILED',
        message: result.error || 'Failed to apply role refactor',
      });
      return;
    }

    logger.info('Role refactor applied', {
      userId: user.userId,
      organizationId,
      patternId: pattern.id,
      newRoleId: result.newRoleId,
      usersMigrated: result.usersMigrated,
    });

    // result already contains 'success' field, so spread it directly
    res.status(200).json(result);
  } catch (error: unknown) {
      handleControllerError(error, res, 'RoleDriftController.unknown');
    }
}

/**
 * POST /api/roles/rollback-refactor
 *
 * Rollback a role refactor within the 7-day window.
 *
 * Request body:
 * - organizationId: string (required)
 * - rollbackId: string (required)
 *
 * Response:
 * - success: boolean
 * - error?: string
 */
export async function rollbackRefactor(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    const { organizationId, rollbackId } = req.body;

    if (!organizationId || typeof organizationId !== 'string') {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Missing required field: organizationId',
      });
      return;
    }

    if (!rollbackId || typeof rollbackId !== 'string') {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Missing required field: rollbackId',
      });
      return;
    }

    // Verify user has access to this organization
    const userOrg = user.organizations.find(org => org.organizationId === organizationId);
    if (!userOrg) {
      res.status(403).json({
        error: 'ACCESS_DENIED',
        message: 'You do not have access to this organization',
      });
      return;
    }

    // Check if user has permission to manage users (required for rollback)
    if (!userOrg.permissions?.perm_ManageUsers) {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'ManageUsers permission required to rollback role refactors',
      });
      return;
    }

    const result = await roleDriftDetectionService.rollbackRefactor({
      rollbackId,
      adminUserId: user.userId,
      organizationId,
    });

    if (!result.success) {
      res.status(400).json({
        error: 'ROLLBACK_FAILED',
        message: result.error || 'Failed to rollback refactor',
      });
      return;
    }

    logger.info('Role refactor rolled back', {
      userId: user.userId,
      organizationId,
      rollbackId,
    });

    res.status(200).json({
      success: true,
      message: 'Role refactor rolled back successfully',
    });
  } catch (error: unknown) {
      handleControllerError(error, res, 'RoleDriftController.unknown');
    }
}
