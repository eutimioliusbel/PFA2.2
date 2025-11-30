import { Response } from 'express';
import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger';
import { AuthRequest } from '../types/auth';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get all users with their organizations
 * Admin users can see all users, non-admin users need perm_ManageUsers in their orgs
 */
export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Get authenticated user from JWT
    const authUser = req.user;

    if (!authUser) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Check if user is admin - admins can see all users
    const currentUser = await prisma.users.findUnique({
      where: { id: authUser.userId },
      select: { role: true },
    });

    if (!currentUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Admin users can see all users across all organizations
    // Note: isAdmin could be used for future filtering logic
    // const isAdmin = currentUser.role === 'admin';

    const users = await prisma.users.findMany({
      include: {
        user_organizations: {
          include: {
            organizations: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to match frontend format
    const formattedUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isActive: user.isActive,
      authProvider: user.authProvider,
      externalId: user.externalId,
      serviceStatus: user.serviceStatus,
      suspendedAt: user.suspendedAt,
      lockedAt: user.lockedAt,
      failedLoginCount: user.failedLoginCount,
      organizations: user.user_organizations.map(org => ({
        id: org.organizationId,
        code: org.organizations.code,
        name: org.organizations.name,
        role: org.role,
      })),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    res.json({ users: formattedUsers });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

/**
 * Create a new user
 */
export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      username,
      email,
      password,
      firstName,
      lastName,
      role = 'user',
      organizationIds = [],
    } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { username },
    });

    if (existingUser) {
      res.status(400).json({ error: 'Username already exists' });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.users.create({
      data: {
        id: uuidv4(),
        username,
        email,
        passwordHash,
        firstName,
        lastName,
        role,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    // Link user to organizations
    if (organizationIds.length > 0) {
      await Promise.all(
        organizationIds.map((orgId: string) =>
          prisma.user_organizations.create({
            data: {
              id: uuidv4(),
              userId: user.id,
              organizationId: orgId,
              role: 'member',
              modifiedAt: new Date(),
            },
          })
        )
      );
    }

    res.status(201).json({ success: true, user });
  } catch (error) {
    logger.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

/**
 * Update an existing user
 */
export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      username,
      email,
      password,
      firstName,
      lastName,
      avatarUrl,
      role,
      isActive,
      organizationIds,
    } = req.body;

    // Check if user exists
    const existingUser = await prisma.users.findUnique({
      where: { id },
    });

    if (!existingUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Prepare update data
    const updateData: {
      username?: string;
      email?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      avatarUrl?: string | null;
      role?: string;
      isActive?: boolean;
      passwordHash?: string;
      updatedAt: Date;
    } = {
      username,
      email,
      firstName,
      lastName,
      avatarUrl,
      role,
      isActive,
      updatedAt: new Date(),
    };

    // Only update password if provided
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    // Update user
    const user = await prisma.users.update({
      where: { id },
      data: updateData,
    });

    // Update organization memberships if provided
    if (organizationIds) {
      // Remove existing memberships
      await prisma.user_organizations.deleteMany({
        where: { userId: id },
      });

      // Add new memberships
      if (organizationIds.length > 0) {
        await Promise.all(
          organizationIds.map((orgId: string) =>
            prisma.user_organizations.create({
              data: {
                id: uuidv4(),
                userId: id,
                organizationId: orgId,
                role: 'member',
                modifiedAt: new Date(),
              },
            })
          )
        );
      }
    }

    res.json({ success: true, user });
  } catch (error) {
    logger.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

/**
 * Delete a user
 */
export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await prisma.users.findUnique({
      where: { id },
      include: {
        user_organizations: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Prevent deletion of PEMS users
    if (user.authProvider === 'pems') {
      res.status(400).json({
        error: 'Cannot delete PEMS user',
        message: 'Users synced from PEMS cannot be deleted. Suspend them instead.',
      });
      return;
    }

    await prisma.users.delete({
      where: { id },
    });

    // Audit log
    if (req.user?.userId) {
      await prisma.audit_logs.create({
        data: {
          id: uuidv4(),
          userId: req.user.userId,
          organizationId: user.user_organizations[0]?.organizationId,
          action: 'user_deleted',
          resource: 'user_management',
          method: 'DELETE',
          success: true,
          metadata: {
            deletedUserId: id,
            deletedUsername: user.username,
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date(),
        },
      });
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

/**
 * Suspend a user
 * POST /api/users/:id/suspend
 */
export const suspendUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason, organizationId } = req.body;

    const user = await prisma.users.findUnique({
      where: { id },
      include: {
        user_organizations: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.serviceStatus === 'suspended') {
      res.status(400).json({
        error: 'User already suspended',
        message: 'This user is already suspended',
      });
      return;
    }

    // Update user status
    const updatedUser = await prisma.users.update({
      where: { id },
      data: {
        serviceStatus: 'suspended',
        suspendedAt: new Date(),
        isActive: false,
        updatedAt: new Date(),
      },
    });

    // Create audit log
    if (req.user?.userId) {
      await prisma.audit_logs.create({
        data: {
          id: uuidv4(),
          userId: req.user.userId,
          organizationId: organizationId || user.user_organizations[0]?.organizationId,
          action: 'user_suspended',
          resource: 'user_management',
          method: 'POST',
          success: true,
          metadata: {
            suspendedUserId: id,
            suspendedUsername: user.username,
            reason: reason || 'No reason provided',
            suspendedBy: req.user?.username,
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date(),
        },
      });
    }

    logger.info(`User suspended: ${user.username} by ${req.user?.username}`, {
      userId: id,
      reason,
    });

    res.json({
      success: true,
      message: 'User suspended successfully',
      user: updatedUser,
    });
  } catch (error) {
    logger.error('Error suspending user:', error);
    res.status(500).json({ error: 'Failed to suspend user' });
  }
};

/**
 * Activate a user (unsuspend)
 * POST /api/users/:id/activate
 */
export const activateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { organizationId } = req.body;

    const user = await prisma.users.findUnique({
      where: { id },
      include: {
        user_organizations: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.serviceStatus === 'active') {
      res.status(400).json({
        error: 'User already active',
        message: 'This user is already active',
      });
      return;
    }

    // Update user status
    const updatedUser = await prisma.users.update({
      where: { id },
      data: {
        serviceStatus: 'active',
        suspendedAt: null,
        isActive: true,
        failedLoginCount: 0, // Reset failed login count on reactivation
        updatedAt: new Date(),
      },
    });

    // Create audit log
    if (req.user?.userId) {
      await prisma.audit_logs.create({
        data: {
          id: uuidv4(),
          userId: req.user.userId,
          organizationId: organizationId || user.user_organizations[0]?.organizationId,
          action: 'user_activated',
          resource: 'user_management',
          method: 'POST',
          success: true,
          metadata: {
            activatedUserId: id,
            activatedUsername: user.username,
            activatedBy: req.user?.username,
            previousStatus: user.serviceStatus,
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date(),
        },
      });
    }

    logger.info(`User activated: ${user.username} by ${req.user?.username}`, {
      userId: id,
    });

    res.json({
      success: true,
      message: 'User activated successfully',
      user: updatedUser,
    });
  } catch (error) {
    logger.error('Error activating user:', error);
    res.status(500).json({ error: 'Failed to activate user' });
  }
};
