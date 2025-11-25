import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Get all users with their organizations
 */
export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        organizations: {
          include: {
            organization: true,
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
      organizationId: user.organizations[0]?.organizationId || '',
      allowedOrganizationIds: user.organizations.map(org => org.organizationId),
      themePreference: 'system',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    res.json({ users: formattedUsers });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

/**
 * Create a new user
 */
export const createUser = async (req: Request, res: Response) => {
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
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        firstName,
        lastName,
        role,
        isActive: true,
      },
    });

    // Link user to organizations
    if (organizationIds.length > 0) {
      await Promise.all(
        organizationIds.map((orgId: string) =>
          prisma.userOrganization.create({
            data: {
              userId: user.id,
              organizationId: orgId,
              role: 'member',
            },
          })
        )
      );
    }

    res.status(201).json({ success: true, user });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

/**
 * Update an existing user
 */
export const updateUser = async (req: Request, res: Response) => {
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
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prepare update data
    const updateData: any = {
      username,
      email,
      firstName,
      lastName,
      avatarUrl,
      role,
      isActive,
    };

    // Only update password if provided
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    // Update user
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    // Update organization memberships if provided
    if (organizationIds) {
      // Remove existing memberships
      await prisma.userOrganization.deleteMany({
        where: { userId: id },
      });

      // Add new memberships
      if (organizationIds.length > 0) {
        await Promise.all(
          organizationIds.map((orgId: string) =>
            prisma.userOrganization.create({
              data: {
                userId: id,
                organizationId: orgId,
                role: 'member',
              },
            })
          )
        );
      }
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

/**
 * Delete a user
 */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await prisma.user.delete({
      where: { id },
    });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};
