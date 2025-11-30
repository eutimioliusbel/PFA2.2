/**
 * BEO Access Middleware
 * CVE-2024-BEO-002 Fix: Authorization for BEO Intelligence Routes
 *
 * Requires perm_ViewAllOrgs capability to access cross-organization analytics.
 * BEO routes allow users to see data across ALL organizations they have access to.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import { logger } from '../utils/logger';
import prisma from '../config/database';

/**
 * Require BEO access (perm_ViewAllOrgs) for cross-organization analytics
 *
 * Usage:
 * ```
 * router.get('/portfolio-health', requireBeoAccess, handler);
 * router.post('/query', requireBeoAccess, handler);
 * ```
 *
 * @returns Express middleware function
 */
export function requireBeoAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
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

    // Check if user has perm_ViewAllOrgs in ANY of their organizations
    const hasBeoAccess = req.user.organizations.some(
      org => org.permissions.perm_ViewAllOrgs === true
    );

    if (!hasBeoAccess) {
      const elapsed = Date.now() - startTime;

      logger.warn('BEO access denied - missing perm_ViewAllOrgs', {
        userId: req.user.userId,
        username: req.user.username,
        endpoint: req.path,
        method: req.method,
        elapsed,
      });

      // Log to audit for AI analysis
      logBeoAccessDenial(
        req.user.userId,
        req.user.username,
        req.path,
        req.method
      ).catch(err => logger.error('Failed to log BEO access denial', { error: err }));

      res.status(403).json({
        error: 'BEO_ACCESS_DENIED',
        message: 'BEO Intelligence features require perm_ViewAllOrgs permission',
        requiredPermission: 'perm_ViewAllOrgs',
        hint: 'Contact your administrator to request BEO access',
      });
      return;
    }

    const elapsed = Date.now() - startTime;

    logger.debug('BEO access granted', {
      userId: req.user.userId,
      endpoint: req.path,
      elapsed,
    });

    next();
  } catch (error) {
    const elapsed = Date.now() - startTime;

    logger.error('BEO access middleware error', {
      error,
      endpoint: req.path,
      elapsed,
    });

    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'BEO access check failed',
    });
  }
}

/**
 * Log BEO access denial for AI anomaly detection
 */
async function logBeoAccessDenial(
  userId: string,
  username: string,
  endpoint: string,
  method: string
): Promise<void> {
  try {
    await prisma.audit_logs.create({
      data: {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        action: 'beo_access_denied',
        resource: endpoint,
        method,
        success: false,
        metadata: {
          username,
          reason: 'MISSING_PERM_VIEW_ALL_ORGS',
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (dbError) {
    logger.error('Failed to write BEO access denial to audit log', { error: dbError });
  }
}

/**
 * Check if user has BEO access (non-blocking helper)
 *
 * @param req - Express request with authenticated user
 * @returns boolean - true if user has BEO access
 */
export function hasBeoAccess(req: AuthRequest): boolean {
  if (!req.user) {
    return false;
  }

  return req.user.organizations.some(
    org => org.permissions.perm_ViewAllOrgs === true
  );
}
