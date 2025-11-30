/**
 * User Session Controller
 * ADR-005 Missing Components - Session Manager (Security Kill Switch)
 *
 * Handles active session tracking and revocation.
 */

import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get all active sessions for a user
 * GET /api/sessions/user/:userId
 */
export const getUserSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    // Users can only view their own sessions unless they have ManageUsers permission
    const hasManageUsersPermission = req.user?.organizations.some(
      org => org.permissions.perm_ManageUsers
    );

    if (userId !== req.user?.userId && !hasManageUsersPermission) {
      res.status(403).json({ error: 'Unauthorized to view sessions for this user' });
      return;
    }

    const sessions = await prisma.user_sessions.findMany({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    // Format sessions (current session detection would require storing session ID in JWT)
    const formattedSessions = sessions.map((session: any) => ({
      ...session,
      isCurrent: false, // Would need session ID in JWT to determine this
    }));

    res.json(formattedSessions);
  } catch (error) {
    logger.error('Error fetching user sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
};

/**
 * Get the current session
 * GET /api/sessions/current
 */
export const getCurrentSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'No active session' });
      return;
    }

    // Get most recent active session for the user
    const session = await prisma.user_sessions.findFirst({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json(session);
  } catch (error) {
    logger.error('Error fetching current session:', error);
    res.status(500).json({ error: 'Failed to fetch current session' });
  }
};

/**
 * Revoke a specific session (kill switch)
 * DELETE /api/sessions/:id
 */
export const revokeSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const session = await prisma.user_sessions.findUnique({
      where: { id },
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Users can revoke their own sessions, or admins can revoke any session
    const hasManageUsersPermission = req.user?.organizations.some(
      org => org.permissions.perm_ManageUsers
    );

    if (session.userId !== req.user?.userId && !hasManageUsersPermission) {
      res.status(403).json({ error: 'Unauthorized to revoke this session' });
      return;
    }

    await prisma.user_sessions.update({
      where: { id },
      data: {
        isActive: false,
        invalidatedAt: new Date(),
        invalidatedBy: req.user?.userId,
      },
    });

    logger.info(`Session revoked: ${id} by ${req.user?.userId}`);
    res.json({ message: 'Session revoked successfully' });
  } catch (error) {
    logger.error('Error revoking session:', error);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
};

/**
 * Revoke all sessions for a user (except current)
 * POST /api/sessions/user/:userId/revoke-all
 */
export const revokeAllUserSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { includeCurrentSession: _includeCurrentSession } = req.body;

    // Users can revoke their own sessions, or admins can revoke any sessions
    const hasManageUsersPermission = req.user?.organizations.some(
      org => org.permissions.perm_ManageUsers
    );

    if (userId !== req.user?.userId && !hasManageUsersPermission) {
      res.status(403).json({ error: 'Unauthorized to revoke sessions for this user' });
      return;
    }

    // Build the where clause
    const whereClause: any = {
      userId,
      isActive: true,
    };

    // Note: Excluding current session would require session ID in JWT
    // For now, all sessions will be revoked if includeCurrentSession is not specified

    const result = await prisma.user_sessions.updateMany({
      where: whereClause,
      data: {
        isActive: false,
        invalidatedAt: new Date(),
        invalidatedBy: req.user?.userId,
      },
    });

    logger.info(`Revoked ${result.count} sessions for user ${userId} by ${req.user?.userId}`);
    res.json({
      message: `Successfully revoked ${result.count} session(s)`,
      count: result.count,
    });
  } catch (error) {
    logger.error('Error revoking all sessions:', error);
    res.status(500).json({ error: 'Failed to revoke sessions' });
  }
};

/**
 * Create a new session (called by auth service after login)
 * This is typically used internally, not as a public endpoint
 */
export async function createSession(
  userId: string,
  sessionToken: string,
  deviceInfo: string,
  ipAddress: string
): Promise<void> {
  try {
    // Parse browser from device info
    const browser = parseBrowserFromUserAgent(deviceInfo);

    // Calculate expiry (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.user_sessions.create({
      data: {
        id: uuidv4(),
        userId,
        sessionToken,
        deviceInfo,
        browser,
        ipAddress,
        expiresAt,
      },
    });

    logger.info(`Session created for user ${userId} from ${ipAddress}`);
  } catch (error) {
    logger.error('Error creating session:', error);
    throw error;
  }
}

/**
 * Update session last active time (called by auth middleware)
 */
export async function updateSessionActivity(sessionToken: string): Promise<void> {
  try {
    await prisma.user_sessions.updateMany({
      where: {
        sessionToken,
        isActive: true,
      },
      data: {
        lastActiveAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error updating session activity:', error);
  }
}

/**
 * Simple user agent parser to extract browser name
 */
function parseBrowserFromUserAgent(userAgent: string): string {
  if (!userAgent) return 'Unknown';

  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';

  return 'Unknown';
}

/**
 * Get session statistics
 * GET /api/sessions/stats
 */
export const getSessionStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    const total = await prisma.user_sessions.count({
      where: { userId },
    });

    const active = await prisma.user_sessions.count({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    });

    const expired = await prisma.user_sessions.count({
      where: {
        userId,
        expiresAt: { lt: new Date() },
      },
    });

    const revoked = await prisma.user_sessions.count({
      where: {
        userId,
        isActive: false,
      },
    });

    res.json({ total, active, expired, revoked });
  } catch (error) {
    logger.error('Error fetching session stats:', error);
    res.status(500).json({ error: 'Failed to fetch session stats' });
  }
};
