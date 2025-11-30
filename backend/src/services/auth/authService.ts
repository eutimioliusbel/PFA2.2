import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { users } from '@prisma/client';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { hashPassword, verifyPassword } from '../../utils/encryption';
import { logger } from '../../utils/logger';
import { JWTPayload, OrganizationContext, extractPermissions } from '../../types/auth';

interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    role: string;
    isBeoUser: boolean;
    permissions: string[];
    organizations: Array<{
      id: string;
      code: string;
      name: string;
      logoUrl: string | null;
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
      // Find user with organizations and permissions
      // Note: Model is 'users' (plural) and relation is 'user_organizations' (not 'organizations')
      const user = await prisma.users.findUnique({
        where: { username },
        include: {
          user_organizations: {
            where: {
              organizations: {
                isActive: true
              }
            }, // Only load active organization memberships
            include: {
              organizations: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  logoUrl: true,
                  serviceStatus: true,
                  isActive: true,
                },
              },
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

      // Check service status (suspended/locked)
      if (user.serviceStatus === 'suspended') {
        throw new Error('Account is suspended');
      }

      if (user.serviceStatus === 'locked') {
        throw new Error('Account is locked due to multiple failed login attempts');
      }

      // Verify password (only for local auth provider)
      if (user.authProvider === 'local') {
        if (!user.passwordHash) {
          throw new Error('Invalid credentials - no password set');
        }
        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
          throw new Error('Invalid credentials');
        }
      }

      // Build organizations array with permissions for JWT payload
      const organizations: OrganizationContext[] = user.user_organizations
        .filter(uo => uo.organizations.isActive && uo.organizations.serviceStatus === 'active')
        .map(uo => ({
          organizationId: uo.organizationId,
          organizationCode: uo.organizations.code,
          role: uo.role,
          permissions: extractPermissions(uo),
        }));

      // Generate enhanced JWT token with embedded permissions
      const payload = {
        userId: user.id,
        username: user.username,
        email: user.email,
        authProvider: user.authProvider as 'local' | 'pems',
        serviceStatus: user.serviceStatus as 'active' | 'suspended' | 'locked',
        organizations,
      };

      const token = jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
      });

      logger.info(`User logged in: ${username}`);

      // Collect all unique permissions across all organizations
      const allPermissions = new Set<string>();

      // Admin users get ALL permissions automatically (except AI features which require explicit setup)
      if (user.role === 'admin') {
        const ALL_PERMISSIONS = [
          'perm_Read', 'perm_EditForecast', 'perm_EditActuals', 'perm_Delete',
          'perm_Import', 'perm_RefreshData', 'perm_Export', 'perm_ViewFinancials',
          'perm_SaveDraft', 'perm_Sync', 'perm_ManageUsers', 'perm_ManageSettings',
          'perm_ConfigureAlerts', 'perm_Impersonate'
          // Note: perm_UseAiFeatures excluded - requires explicit AI API setup
        ];
        ALL_PERMISSIONS.forEach(p => allPermissions.add(p));

        // Also update organizations to have all permissions
        organizations.forEach(org => {
          ALL_PERMISSIONS.forEach(p => {
            (org.permissions as unknown as Record<string, boolean>)[p] = true;
          });
        });
      } else {
        organizations.forEach(org => {
          // Convert permissions object to array of permission names where value is true
          Object.entries(org.permissions).forEach(([key, value]) => {
            if (value === true) {
              allPermissions.add(key);
            }
          });
        });
      }

      // Check if user is a BEO user (admin role or has ManageSettings permission)
      const isBeoUser = user.role === 'admin' || allPermissions.has('perm_ManageSettings');

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          avatarUrl: user.avatarUrl,
          role: user.role,
          isBeoUser,
          permissions: Array.from(allPermissions),
          organizations: user.user_organizations.map(uo => ({
            id: uo.organizations.id,
            code: uo.organizations.code,
            name: uo.organizations.name,
            logoUrl: uo.organizations.logoUrl,
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
  }): Promise<users> {
    try {
      const passwordHash = await hashPassword(data.password);

      const user = await prisma.users.create({
        data: {
          id: randomUUID(),
          username: data.username,
          passwordHash,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role || 'user',
          authProvider: 'local',
          serviceStatus: 'active',
          isActive: true,
          updatedAt: new Date(),
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
  verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET) as JWTPayload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Get full user data by ID (for token verification)
   */
  async getUserById(userId: string): Promise<LoginResponse['user'] | null> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        include: {
          user_organizations: {
            where: {
              organizations: {
                isActive: true
              }
            },
            include: {
              organizations: true,
            },
          },
        },
      });

      if (!user) {
        return null;
      }

      // Collect all unique permissions across all organizations
      const allPermissions = new Set<string>();
      user.user_organizations.forEach(uo => {
        const permissions = extractPermissions(uo);
        Object.entries(permissions).forEach(([key, value]) => {
          if (value === true) {
            allPermissions.add(key);
          }
        });
      });

      // Check if user is a BEO user (admin role or has ManageSettings permission)
      const isBeoUser = user.role === 'admin' || allPermissions.has('perm_ManageSettings');

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        isBeoUser,
        permissions: Array.from(allPermissions),
        organizations: user.user_organizations.map(uo => ({
          id: uo.organizations.id,
          code: uo.organizations.code,
          name: uo.organizations.name,
          logoUrl: uo.organizations.logoUrl,
          role: uo.role,
        })),
      };
    } catch (error) {
      logger.error('Get user by ID error:', error);
      throw error;
    }
  }
}

export default new AuthService();
