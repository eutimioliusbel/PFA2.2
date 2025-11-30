/**
 * Impersonation Controller
 * ADR-005 Implementation: "View As" / Impersonation Functionality
 *
 * Allows users with perm_Impersonate to view the application as another user.
 * All actions during impersonation are logged with impersonatedBy field.
 * Sessions auto-expire after 15 minutes.
 */

import { Response } from 'express';
import { AuthRequest, JWTPayload, extractPermissions } from '../types/auth';
import { logger } from '../utils/logger';
import prisma from '../config/database';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const IMPERSONATION_EXPIRY_MINUTES = 15;

/**
 * POST /api/auth/impersonate/:userId
 * Start impersonating another user
 *
 * Requires: perm_Impersonate permission
 * Returns: New JWT token with impersonation context
 */
export async function startImpersonation(req: AuthRequest, res: Response): Promise<void> {
  const startTime = Date.now();

  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    const { userId: targetUserId } = req.params;

    // Validate target user ID
    if (!targetUserId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Target user ID required' });
      return;
    }

    // Check if impersonator has perm_Impersonate in ANY organization
    const canImpersonate = req.user.organizations.some(
      org => org.permissions.perm_Impersonate === true
    );

    if (!canImpersonate) {
      logger.warn('Impersonation denied - missing permission', {
        impersonatorId: req.user.userId,
        targetUserId,
      });

      // Log to audit
      await logImpersonationAttempt(
        req.user.userId,
        targetUserId,
        'DENIED',
        'Missing perm_Impersonate permission'
      );

      res.status(403).json({
        error: 'IMPERSONATION_DENIED',
        message: 'You do not have permission to impersonate other users',
        requiredPermission: 'perm_Impersonate',
      });
      return;
    }

    // Prevent impersonating yourself
    if (targetUserId === req.user.userId) {
      res.status(400).json({
        error: 'INVALID_TARGET',
        message: 'Cannot impersonate yourself',
      });
      return;
    }

    // Fetch target user with their organizations
    const targetUser = await prisma.users.findUnique({
      where: { id: targetUserId },
      include: {
        user_organizations: {
          include: {
            organizations: true,
          },
        },
      },
    });

    if (!targetUser) {
      res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'Target user not found',
      });
      return;
    }

    // Check target user is active
    if (!targetUser.isActive || targetUser.serviceStatus !== 'active') {
      res.status(400).json({
        error: 'USER_INACTIVE',
        message: 'Cannot impersonate inactive or suspended users',
      });
      return;
    }

    // Build organization contexts for target user
    const organizationContexts = targetUser.user_organizations.map(uo => ({
      organizationId: uo.organizationId,
      organizationCode: uo.organizations.code,
      role: uo.role,
      permissions: extractPermissions(uo),
    }));

    // Create impersonation JWT payload
    const impersonationPayload: JWTPayload & { impersonatedBy: string; impersonationExpiresAt: number } = {
      userId: targetUser.id,
      username: targetUser.username,
      email: targetUser.email,
      authProvider: targetUser.authProvider as 'local' | 'pems',
      serviceStatus: targetUser.serviceStatus as 'active' | 'suspended' | 'locked',
      organizations: organizationContexts,
      impersonatedBy: req.user.userId,
      impersonationExpiresAt: Date.now() + IMPERSONATION_EXPIRY_MINUTES * 60 * 1000,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + IMPERSONATION_EXPIRY_MINUTES * 60,
    };

    // Sign the impersonation token
    const impersonationToken = jwt.sign(impersonationPayload, JWT_SECRET);

    // Log successful impersonation start
    await logImpersonationAttempt(
      req.user.userId,
      targetUserId,
      'STARTED',
      `Impersonation session started, expires in ${IMPERSONATION_EXPIRY_MINUTES} minutes`
    );

    // Create audit log entry
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: req.user.userId,
        action: 'impersonation_started',
        resource: 'user',
        method: 'POST',
        success: true,
        metadata: {
          targetUserId,
          targetUsername: targetUser.username,
          expiresAt: new Date(impersonationPayload.impersonationExpiresAt).toISOString(),
        },
      },
    });

    const elapsed = Date.now() - startTime;

    logger.info('Impersonation started', {
      impersonatorId: req.user.userId,
      impersonatorUsername: req.user.username,
      targetUserId,
      targetUsername: targetUser.username,
      expiresInMinutes: IMPERSONATION_EXPIRY_MINUTES,
      elapsed,
    });

    res.json({
      success: true,
      token: impersonationToken,
      impersonating: {
        userId: targetUser.id,
        username: targetUser.username,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        email: targetUser.email,
        role: targetUser.role,
        organizations: organizationContexts.map(oc => ({
          id: oc.organizationId,
          code: oc.organizationCode,
          role: oc.role,
        })),
      },
      expiresAt: new Date(impersonationPayload.impersonationExpiresAt).toISOString(),
      expiresInMinutes: IMPERSONATION_EXPIRY_MINUTES,
      message: `You are now viewing as ${targetUser.firstName || targetUser.username}. Session expires in ${IMPERSONATION_EXPIRY_MINUTES} minutes.`,
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;

    logger.error('Impersonation error', {
      error,
      userId: req.user?.userId,
      targetUserId: req.params.userId,
      elapsed,
    });

    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to start impersonation',
    });
  }
}

/**
 * POST /api/auth/end-impersonation
 * End impersonation and return to original user
 *
 * Requires: Active impersonation session
 * Returns: Original user's JWT token
 */
export async function endImpersonation(req: AuthRequest, res: Response): Promise<void> {
  const startTime = Date.now();

  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    // Check if this is an impersonation session
    const impersonatedBy = (req.user as any).impersonatedBy;

    if (!impersonatedBy) {
      res.status(400).json({
        error: 'NOT_IMPERSONATING',
        message: 'You are not currently impersonating another user',
      });
      return;
    }

    // Fetch the original user (impersonator)
    const originalUser = await prisma.users.findUnique({
      where: { id: impersonatedBy },
      include: {
        user_organizations: {
          include: {
            organizations: true,
          },
        },
      },
    });

    if (!originalUser) {
      res.status(404).json({
        error: 'ORIGINAL_USER_NOT_FOUND',
        message: 'Original user session could not be restored',
      });
      return;
    }

    // Build organization contexts for original user
    const organizationContexts = originalUser.user_organizations.map(uo => ({
      organizationId: uo.organizationId,
      organizationCode: uo.organizations.code,
      role: uo.role,
      permissions: extractPermissions(uo),
    }));

    // Create new JWT for original user (standard expiry)
    const originalPayload: JWTPayload = {
      userId: originalUser.id,
      username: originalUser.username,
      email: originalUser.email,
      authProvider: originalUser.authProvider as 'local' | 'pems',
      serviceStatus: originalUser.serviceStatus as 'active' | 'suspended' | 'locked',
      organizations: organizationContexts,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    };

    const originalToken = jwt.sign(originalPayload, JWT_SECRET);

    // Log impersonation end
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: impersonatedBy,
        action: 'impersonation_ended',
        resource: 'user',
        method: 'POST',
        success: true,
        metadata: {
          impersonatedUserId: req.user.userId,
          impersonatedUsername: req.user.username,
        },
      },
    });

    const elapsed = Date.now() - startTime;

    logger.info('Impersonation ended', {
      originalUserId: impersonatedBy,
      originalUsername: originalUser.username,
      impersonatedUserId: req.user.userId,
      impersonatedUsername: req.user.username,
      elapsed,
    });

    res.json({
      success: true,
      token: originalToken,
      user: {
        userId: originalUser.id,
        username: originalUser.username,
        firstName: originalUser.firstName,
        lastName: originalUser.lastName,
        email: originalUser.email,
        role: originalUser.role,
        organizations: organizationContexts.map(oc => ({
          id: oc.organizationId,
          code: oc.organizationCode,
          role: oc.role,
        })),
      },
      message: 'Impersonation session ended. You are now logged in as yourself.',
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;

    logger.error('End impersonation error', {
      error,
      userId: req.user?.userId,
      elapsed,
    });

    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to end impersonation',
    });
  }
}

/**
 * GET /api/auth/impersonation-status
 * Check current impersonation status
 */
export async function getImpersonationStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    const impersonatedBy = (req.user as any).impersonatedBy;
    const impersonationExpiresAt = (req.user as any).impersonationExpiresAt;

    if (!impersonatedBy) {
      res.json({
        isImpersonating: false,
      });
      return;
    }

    // Fetch impersonator details
    const impersonator = await prisma.users.findUnique({
      where: { id: impersonatedBy },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
      },
    });

    const remainingMs = impersonationExpiresAt ? impersonationExpiresAt - Date.now() : 0;
    const remainingMinutes = Math.max(0, Math.floor(remainingMs / 60000));

    res.json({
      isImpersonating: true,
      impersonatedBy: impersonator
        ? {
            userId: impersonator.id,
            username: impersonator.username,
            name: `${impersonator.firstName || ''} ${impersonator.lastName || ''}`.trim() || impersonator.username,
          }
        : { userId: impersonatedBy },
      expiresAt: impersonationExpiresAt ? new Date(impersonationExpiresAt).toISOString() : null,
      remainingMinutes,
      currentUser: {
        userId: req.user.userId,
        username: req.user.username,
      },
    });
  } catch (error) {
    logger.error('Get impersonation status error', { error });
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get impersonation status',
    });
  }
}

/**
 * Log impersonation attempt for audit trail
 */
async function logImpersonationAttempt(
  impersonatorId: string,
  targetUserId: string,
  status: 'STARTED' | 'ENDED' | 'DENIED',
  details: string
): Promise<void> {
  try {
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: impersonatorId,
        action: `impersonation_${status.toLowerCase()}`,
        resource: 'user',
        method: 'POST',
        success: status !== 'DENIED',
        metadata: {
          targetUserId,
          status,
          details,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Failed to log impersonation attempt', { error });
  }
}
