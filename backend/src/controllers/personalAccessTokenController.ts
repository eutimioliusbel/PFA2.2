/**
 * Personal Access Token Controller
 * ADR-005 Missing Components - Developer Settings (PAT Management)
 *
 * Handles API token generation, listing, and revocation.
 */

import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import { logger } from '../utils/logger';

const SALT_ROUNDS = 10;

/**
 * Generate a cryptographically secure random token
 */
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Get all personal access tokens for the authenticated user
 * GET /api/tokens
 */
export const getUserTokens = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const tokens = await prisma.personal_access_tokens.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        lastUsedIp: true,
        createdAt: true,
        // Never return the token hash
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(tokens);
  } catch (error) {
    logger.error('Error fetching personal access tokens:', error);
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
};

/**
 * Create a new personal access token
 * POST /api/tokens
 *
 * Returns the raw token ONLY ONCE - it will not be shown again.
 */
export const createToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, scopes, expiresInDays } = req.body;

    if (!name || !scopes || !Array.isArray(scopes)) {
      res.status(400).json({ error: 'Name and scopes array required' });
      return;
    }

    // Generate raw token
    const rawToken = generateToken();
    const tokenHash = await bcrypt.hash(rawToken, SALT_ROUNDS);

    // Calculate expiry date
    let expiresAt: Date | undefined;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    const token = await prisma.personal_access_tokens.create({
      data: {
        id: randomUUID(),
        userId,
        name,
        tokenHash,
        scopes,
        expiresAt,
      },
    });

    logger.info(`Personal access token created: ${name} for user ${userId}`);

    // Return the raw token ONLY in the creation response
    res.status(201).json({
      id: token.id,
      name: token.name,
      scopes: token.scopes,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
      token: rawToken, // ⚠️ This will only be shown once!
    });
  } catch (error) {
    logger.error('Error creating personal access token:', error);
    res.status(500).json({ error: 'Failed to create token' });
  }
};

/**
 * Revoke a personal access token
 * DELETE /api/tokens/:id
 */
export const revokeToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { reason } = req.body;

    // Verify the token belongs to the user
    const token = await prisma.personal_access_tokens.findUnique({
      where: { id },
    });

    if (!token) {
      res.status(404).json({ error: 'Token not found' });
      return;
    }

    if (token.userId !== userId) {
      res.status(403).json({ error: 'Unauthorized to revoke this token' });
      return;
    }

    await prisma.personal_access_tokens.update({
      where: { id },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedBy: userId,
        revokedReason: reason,
      },
    });

    logger.info(`Personal access token revoked: ${token.name} by ${userId}`);
    res.json({ message: 'Token revoked successfully' });
  } catch (error) {
    logger.error('Error revoking personal access token:', error);
    res.status(500).json({ error: 'Failed to revoke token' });
  }
};

/**
 * Validate a personal access token (used by auth middleware)
 * This is an internal function, not an API endpoint
 */
export async function validatePersonalAccessToken(token: string): Promise<{
  valid: boolean;
  userId?: string;
  scopes?: string[];
}> {
  try {
    // Find all active tokens
    const tokens = await prisma.personal_access_tokens.findMany({
      where: {
        isActive: true,
      },
    });

    // Check each token hash (brute force, but PATs are rare)
    for (const storedToken of tokens) {
      const matches = await bcrypt.compare(token, storedToken.tokenHash);

      if (matches) {
        // Check expiry
        if (storedToken.expiresAt && storedToken.expiresAt < new Date()) {
          return { valid: false };
        }

        // Update last used timestamp
        await prisma.personal_access_tokens.update({
          where: { id: storedToken.id },
          data: {
            lastUsedAt: new Date(),
            // lastUsedIp can be set by the middleware
          },
        });

        return {
          valid: true,
          userId: storedToken.userId,
          scopes: storedToken.scopes as string[],
        };
      }
    }

    return { valid: false };
  } catch (error) {
    logger.error('Error validating personal access token:', error);
    return { valid: false };
  }
}

/**
 * Get token statistics for admin view
 * GET /api/tokens/stats
 */
export const getTokenStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const total = await prisma.personal_access_tokens.count({
      where: { userId },
    });

    const active = await prisma.personal_access_tokens.count({
      where: {
        userId,
        isActive: true,
      },
    });

    const expired = await prisma.personal_access_tokens.count({
      where: {
        userId,
        isActive: true,
        expiresAt: { lt: new Date() },
      },
    });

    const revoked = await prisma.personal_access_tokens.count({
      where: {
        userId,
        isActive: false,
      },
    });

    res.json({ total, active, expired, revoked });
  } catch (error) {
    logger.error('Error fetching token stats:', error);
    res.status(500).json({ error: 'Failed to fetch token stats' });
  }
};
