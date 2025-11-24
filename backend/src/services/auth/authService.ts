import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { hashPassword, verifyPassword } from '../../utils/encryption';
import { logger } from '../../utils/logger';

interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    role: string;
    organizations: Array<{
      id: string;
      code: string;
      name: string;
      role: string;
    }>;
  };
}

export class AuthService {
  /**
   * Authenticate user and generate JWT token
   */
  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      // Find user with organizations
      const user = await prisma.user.findUnique({
        where: { username },
        include: {
          organizations: {
            include: {
              organization: true,
            },
          },
        },
      });

      if (!user) {
        throw new Error('Invalid credentials');
      }

      if (!user.isActive) {
        throw new Error('Account is inactive');
      }

      // Verify password
      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        throw new Error('Invalid credentials');
      }

      // Get organization IDs
      const organizationIds = user.organizations.map(uo => uo.organizationId);

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.id,
          username: user.username,
          role: user.role,
          organizationIds,
        },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN }
      );

      logger.info(`User logged in: ${username}`);

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organizations: user.organizations.map(uo => ({
            id: uo.organization.id,
            code: uo.organization.code,
            name: uo.organization.name,
            role: uo.role,
          })),
        },
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Create new user (admin only)
   */
  async createUser(data: {
    username: string;
    password: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  }): Promise<User> {
    try {
      const passwordHash = await hashPassword(data.password);

      const user = await prisma.user.create({
        data: {
          username: data.username,
          passwordHash,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role || 'user',
        },
      });

      logger.info(`User created: ${user.username}`);
      return user;
    } catch (error) {
      logger.error('Create user error:', error);
      throw error;
    }
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, env.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}

export default new AuthService();
