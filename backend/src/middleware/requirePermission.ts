/**
 * Permission Middleware
 * Phase 2, Task 2.1 - Granular permission checks with <50ms target
 *
 * Validates user has specific permission for requested organization
 * Logs permission denials for AI anomaly detection
 */

import { Response, NextFunction } from 'express';
import { AuthRequest, Permissions } from '../types/auth';
import { logger } from '../utils/logger';
import prisma from '../config/database';

/**
 * Require specific permission for organization
 *
 * Usage:
 * ```
 * router.post('/pfa', authenticateJWT, requirePermission('perm_EditForecast'), handler);
 * router.delete('/pfa/:id', authenticateJWT, requirePermission('perm_Delete', 'id'), handler);
 * ```
 *
 * @param permission - Permission key to check (e.g., 'perm_EditForecast')
 * @param organizationIdField - Field name containing organizationId (default: 'organizationId')
 * @returns Express middleware function
 */
export function requirePermission(
  permission: keyof Permissions,
  organizationIdField: string = 'organizationId'
) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();

    try {
      // Ensure user is authenticated
      if (!req.user) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      // Extract organization ID from request
      const orgId =
        req.body[organizationIdField] ||
        req.query[organizationIdField] ||
        req.params[organizationIdField];

      if (!orgId) {
        res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'Organization ID required',
          field: organizationIdField,
        });
        return;
      }

      // Find user's permission for this organization
      const userOrg = req.user.organizations.find(o => o.organizationId === orgId);

      if (!userOrg) {
        // User doesn't have access to this organization at all
        const elapsed = Date.now() - startTime;

        logger.warn('Organization access denied', {
          userId: req.user.userId,
          username: req.user.username,
          organizationId: orgId,
          endpoint: req.path,
          method: req.method,
          elapsed,
        });

        // Log permission denial for AI analysis
        await logPermissionDenial(
          req.user.userId,
          req.user.username,
          orgId,
          permission,
          req.path,
          req.method,
          'ORG_ACCESS_DENIED'
        );

        res.status(403).json({
          error: 'ORG_ACCESS_DENIED',
          message: `You don't have access to organization ${orgId}`,
          organizationId: orgId,
        });
        return;
      }

      // Check if user has the required permission
      if (!userOrg.permissions[permission]) {
        const elapsed = Date.now() - startTime;

        logger.warn('Permission denied', {
          userId: req.user.userId,
          username: req.user.username,
          organizationId: orgId,
          organizationCode: userOrg.organizationCode,
          permission,
          endpoint: req.path,
          method: req.method,
          elapsed,
        });

        // Log permission denial for AI analysis
        await logPermissionDenial(
          req.user.userId,
          req.user.username,
          orgId,
          permission,
          req.path,
          req.method,
          'PERMISSION_DENIED'
        );

        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: `Missing required permission: ${permission}`,
          permission,
          organizationId: orgId,
          organizationCode: userOrg.organizationCode,
        });
        return;
      }

      // Permission granted - attach organizationId to request for downstream use
      req.organizationId = orgId;

      const elapsed = Date.now() - startTime;

      // Warn if permission check exceeded target
      if (elapsed > 50) {
        logger.warn('Permission check exceeded 50ms target', {
          elapsed,
          permission,
          organizationId: orgId,
          endpoint: req.path,
        });
      }

      next();
    } catch (error) {
      const elapsed = Date.now() - startTime;

      logger.error('Permission middleware error', {
        error,
        permission,
        endpoint: req.path,
        elapsed,
      });

      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Permission check failed',
      });
    }
  };
}

/**
 * Require any of multiple permissions (OR logic)
 *
 * Usage:
 * ```
 * router.get('/pfa', authenticateJWT, requireAnyPermission(['perm_Read', 'perm_EditForecast']), handler);
 * ```
 *
 * @param permissions - Array of permission keys to check
 * @param organizationIdField - Field name containing organizationId (default: 'organizationId')
 * @returns Express middleware function
 */
export function requireAnyPermission(
  permissions: Array<keyof Permissions>,
  organizationIdField: string = 'organizationId'
) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();

    try {
      if (!req.user) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      const orgId =
        req.body[organizationIdField] ||
        req.query[organizationIdField] ||
        req.params[organizationIdField];

      if (!orgId) {
        res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'Organization ID required',
          field: organizationIdField,
        });
        return;
      }

      const userOrg = req.user.organizations.find(o => o.organizationId === orgId);

      if (!userOrg) {
        await logPermissionDenial(
          req.user.userId,
          req.user.username,
          orgId,
          permissions.join(','),
          req.path,
          req.method,
          'ORG_ACCESS_DENIED'
        );

        res.status(403).json({
          error: 'ORG_ACCESS_DENIED',
          message: `You don't have access to organization ${orgId}`,
          organizationId: orgId,
        });
        return;
      }

      // Check if user has ANY of the required permissions
      const hasAnyPermission = permissions.some(perm => userOrg.permissions[perm]);

      if (!hasAnyPermission) {
        const elapsed = Date.now() - startTime;

        logger.warn('Permission denied (any)', {
          userId: req.user.userId,
          username: req.user.username,
          organizationId: orgId,
          organizationCode: userOrg.organizationCode,
          permissions,
          endpoint: req.path,
          method: req.method,
          elapsed,
        });

        await logPermissionDenial(
          req.user.userId,
          req.user.username,
          orgId,
          permissions.join(','),
          req.path,
          req.method,
          'PERMISSION_DENIED'
        );

        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: `Missing required permissions: ${permissions.join(', ')}`,
          permissions,
          organizationId: orgId,
          organizationCode: userOrg.organizationCode,
        });
        return;
      }

      req.organizationId = orgId;

      const elapsed = Date.now() - startTime;

      if (elapsed > 50) {
        logger.warn('Permission check exceeded 50ms target', {
          elapsed,
          permissions,
          organizationId: orgId,
          endpoint: req.path,
        });
      }

      next();
    } catch (error) {
      logger.error('Permission middleware error (any)', { error });
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Permission check failed',
      });
    }
  };
}

/**
 * Require permission globally (not tied to specific organization)
 * Use for resources that are not organization-specific like field mappings
 *
 * Checks if user has the permission in ANY of their organizations.
 * Useful for admin-level operations or global resources.
 *
 * Usage:
 * ```
 * router.get('/mappings', authenticateJWT, requirePermissionGlobal('perm_Read'), handler);
 * ```
 *
 * @param permission - Permission key to check
 * @returns Express middleware function
 */
export function requirePermissionGlobal(permission: keyof Permissions) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();

    try {
      if (!req.user) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      // Check if user has permission in ANY organization
      const hasPermission = req.user.organizations.some(org => org.permissions[permission]);

      if (!hasPermission) {
        const elapsed = Date.now() - startTime;

        logger.warn('Permission denied (global)', {
          userId: req.user.userId,
          username: req.user.username,
          permission,
          endpoint: req.path,
          method: req.method,
          elapsed,
        });

        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: `You don't have ${permission.replace('perm_', '')} permission`,
          permission,
        });
        return;
      }

      const elapsed = Date.now() - startTime;
      logger.debug('Permission granted (global)', {
        userId: req.user.userId,
        permission,
        elapsed,
      });

      next();
    } catch (error) {
      const elapsed = Date.now() - startTime;
      logger.error('Permission check failed (global)', {
        error,
        permission,
        endpoint: req.path,
        elapsed,
      });

      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Permission check failed',
      });
    }
  };
}

/**
 * Log permission denial for AI anomaly detection
 * Stores in audit log for future AI analysis
 *
 * @param userId - User ID who was denied
 * @param username - Username for readability
 * @param organizationId - Organization ID they tried to access
 * @param permission - Permission that was checked
 * @param endpoint - API endpoint path
 * @param method - HTTP method
 * @param reason - Denial reason (ORG_ACCESS_DENIED or PERMISSION_DENIED)
 */
async function logPermissionDenial(
  userId: string,
  username: string,
  organizationId: string,
  permission: string,
  endpoint: string,
  method: string,
  reason: string
): Promise<void> {
  try {
    // Log to database for AI analysis
    try {
      await prisma.audit_logs.create({
        data: {
          id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          organizationId,
          action: 'permission_denied',
          resource: endpoint,
          method,
          success: false,
          metadata: {
            username,
            permission,
            reason,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (dbError) {
      // Log database error but don't fail the request
      logger.error('Failed to write to audit log', { error: dbError });
    }

    // Always log to application logger (for immediate visibility)
    logger.warn('PERMISSION_DENIAL', {
      userId,
      username,
      organizationId,
      permission,
      endpoint,
      method,
      reason,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to log permission denial', { error });
  }
}

/**
 * Check if user has permission for organization (non-blocking)
 * Used for conditional logic in handlers
 *
 * @param req - Express request with authenticated user
 * @param organizationId - Organization ID to check
 * @param permission - Permission to check
 * @returns boolean - true if user has permission, false otherwise
 */
export function hasPermission(
  req: AuthRequest,
  organizationId: string,
  permission: keyof Permissions
): boolean {
  if (!req.user) {
    return false;
  }

  const userOrg = req.user.organizations.find(o => o.organizationId === organizationId);

  if (!userOrg) {
    return false;
  }

  return userOrg.permissions[permission];
}
