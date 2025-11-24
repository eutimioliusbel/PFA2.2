import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
  organizationIds: string[];
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

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
      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
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

  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
    return;
  }

  next();
};

/**
 * Require organization access
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

    // Admin has access to all orgs
    if (req.user.role === 'admin') {
      next();
      return;
    }

    // Check if user has access to this organization
    if (!req.user.organizationIds.includes(requestedOrgId as string)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'No access to this organization' });
      return;
    }

    next();
  };
};
