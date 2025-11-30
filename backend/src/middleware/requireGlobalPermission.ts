/**
 * Global Permission Middleware
 * ADR-005 - For admin operations that span multiple organizations
 *
 * Unlike requirePermission, this checks if user has the permission
 * in ANY organization (for global resources like role templates).
 */

import { Response, NextFunction } from 'express';
import { AuthRequest, Permissions } from '../types/auth';
import { logger } from '../utils/logger';

/**
 * Require specific permission in ANY organization (for global resources)
 *
 * Use this for admin screens that manage global resources like:
 * - Role templates
 * - System-wide settings
 * - Global API configurations
 *
 * Usage:
 * ```
 * router.get('/role-templates', authenticateJWT, requireGlobalPermission('perm_ManageUsers'), handler);
 * ```
 *
 * @param permission - Permission key to check (e.g., 'perm_ManageSettings')
 * @returns Express middleware function
 */
export function requireGlobalPermission(permission: keyof Permissions) {
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

      // Check if user has the permission in ANY organization
      const hasPermissionInAnyOrg = req.user.organizations.some(
        org => org.permissions[permission] === true
      );

      // Also allow if user is admin role (system admin)
      const isSystemAdmin = req.user.organizations.some(org => org.role === 'admin');

      if (!hasPermissionInAnyOrg && !isSystemAdmin) {
        const elapsed = Date.now() - startTime;

        logger.warn('Global permission denied', {
          userId: req.user.userId,
          username: req.user.username,
          permission,
          endpoint: req.path,
          method: req.method,
          elapsed,
        });

        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: `Missing required permission: ${permission}`,
          permission,
        });
        return;
      }

      const elapsed = Date.now() - startTime;

      if (elapsed > 50) {
        logger.warn('Global permission check exceeded 50ms target', {
          elapsed,
          permission,
          endpoint: req.path,
        });
      }

      next();
    } catch (error) {
      const elapsed = Date.now() - startTime;

      logger.error('Global permission middleware error', {
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
 * Require admin role (any organization) for system-wide operations
 *
 * Use this for operations that should only be accessible to system admins
 *
 * @returns Express middleware function
 */
export function requireAdminRole() {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
        return;
      }

      const isAdmin = req.user.organizations.some(org => org.role === 'admin');

      if (!isAdmin) {
        logger.warn('Admin role required', {
          userId: req.user.userId,
          username: req.user.username,
          endpoint: req.path,
          method: req.method,
        });

        res.status(403).json({
          error: 'ADMIN_REQUIRED',
          message: 'Admin role required for this operation',
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Admin role middleware error', { error });
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Role check failed',
      });
    }
  };
}
