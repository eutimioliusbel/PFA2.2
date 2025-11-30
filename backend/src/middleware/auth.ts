import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { JWTPayload, AuthRequest } from '../types/auth';

// Legacy JWT payload for backward compatibility
// New code should use JWTPayload from types/auth.ts
export interface LegacyJwtPayload {
  userId: string;
  username: string;
  role: string;
  organizationIds: string[];
}

// Re-export AuthRequest for backward compatibility
export type { AuthRequest };

/**
 * Verify JWT token and attach user to request
 */
export const authenticateJWT = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
      req.user = decoded;
      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({ error: 'TOKEN_EXPIRED', message: 'Token has expired' });
      } else if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({ error: 'INVALID_TOKEN', message: 'Invalid token' });
      } else {
        res.status(401).json({ error: 'AUTHENTICATION_FAILED', message: 'Authentication failed' });
      }
    }
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Authentication error' });
  }
};

/**
 * Require admin role
 * Note: This checks the legacy 'role' field on User model
 * For granular permissions, use requirePermission() instead
 */
export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Not authenticated' });
    return;
  }

  // Check if user has perm_Impersonate in ANY organization (de facto admin)
  const hasAdminPermission = req.user.organizations.some(
    org => org.permissions.perm_Impersonate || org.permissions.perm_ManageUsers
  );

  if (!hasAdminPermission) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
    return;
  }

  next();
};

/**
 * Require organization access (basic check)
 * For permission-specific checks, use requirePermission() instead
 *
 * @param orgIdParam - Parameter name containing organization ID
 * @returns Express middleware function
 */
export const requireOrgAccess = (orgIdParam: string = 'orgId') => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Not authenticated' });
      return;
    }

    const requestedOrgId = req.params[orgIdParam] || req.query[orgIdParam] || req.body.organizationId;

    if (!requestedOrgId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Organization ID required' });
      return;
    }

    // Check if user has access to this organization
    const hasAccess = req.user.organizations.some(org => org.organizationId === requestedOrgId);

    if (!hasAccess) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'No access to this organization' });
      return;
    }

    // Attach organizationId to request for downstream use
    req.organizationId = requestedOrgId as string;

    next();
  };
};
