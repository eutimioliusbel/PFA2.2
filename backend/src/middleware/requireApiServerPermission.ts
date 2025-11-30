/**
 * API Server Authorization Middleware
 * Phase 2, Task 2.3 - API Server Authorization (ADR-006 Integration)
 *
 * Validates permissions for API Server Management operations:
 * - CREATE/UPDATE/DELETE: Requires perm_ManageSettings
 * - TEST: Any organization member can test
 * - GET: Filtered by user's organizations (handled in controller)
 *
 * Integrates with OrganizationValidationService to ensure:
 * - Organization is active for CREATE/UPDATE operations
 * - Suspended organizations cannot test API servers
 */

import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../types/auth';
import { OrganizationValidationService } from '../services/organizationValidation';
import { logger } from '../utils/logger';

/**
 * Authorization middleware for API Server Management
 *
 * Behavior by HTTP method:
 * - GET: No specific permission check (controller filters by user's orgs)
 * - POST: Requires perm_ManageSettings + active organization
 * - PATCH: Requires perm_ManageSettings (org extracted from existing server)
 * - DELETE: Requires perm_ManageSettings (org extracted from existing server)
 * - POST (test endpoint): Any org member can test
 */
export async function requireApiServerPermission(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user;
    const method = req.method;

    if (!user) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    // Extract organizationId based on HTTP method and endpoint
    let organizationId: string;
    let operation: string;

    // GET operations - no specific permission check (filtered in controller)
    if (method === 'GET') {
      // Controller will filter results by user's accessible organizations
      next();
      return;
    }

    // POST operations - could be create or test
    if (method === 'POST') {
      // Check if this is a test endpoint (path contains 'test')
      const isTestEndpoint = req.path.includes('/test');

      if (isTestEndpoint) {
        // Test endpoint - any org member can test
        // Extract organizationId from body or from server
        organizationId = req.body.organizationId;

        if (!organizationId) {
          // Try to get org from server ID in params
          const serverId = req.params.serverId;
          if (serverId) {
            const server = await prisma.api_servers.findUnique({
              where: { id: serverId },
              select: { organizationId: true },
            });

            if (!server) {
              res.status(404).json({
                error: 'NOT_FOUND',
                message: 'API server not found',
              });
              return;
            }

            organizationId = server.organizationId;
          } else {
            res.status(400).json({
              error: 'BAD_REQUEST',
              message: 'organizationId is required',
            });
            return;
          }
        }

        // Verify user has access to organization (any permission level)
        const hasAccess = user.organizations.some(o => o.organizationId === organizationId);

        if (!hasAccess) {
          logger.warn('API server test denied - no org access', {
            userId: user.userId,
            organizationId,
            endpoint: req.path,
          });

          res.status(403).json({
            error: 'ORG_ACCESS_DENIED',
            message: `You don't have access to organization ${organizationId}`,
            organizationId,
          });
          return;
        }

        // Validate organization is active (suspended orgs cannot test)
        try {
          await OrganizationValidationService.validateOrgActive(
            organizationId,
            'test API server'
          );
        } catch (error) {
          if (error instanceof Error && error.name === 'OrganizationInactiveException') {
            res.status(403).json({
              error: 'ORG_SUSPENDED',
              message: error.message,
              organizationId,
            });
            return;
          }
          throw error;
        }

        req.organizationId = organizationId;
        next();
        return;
      }

      // CREATE operation - requires perm_ManageSettings
      organizationId = req.body.organizationId;
      operation = 'create API server';

      if (!organizationId) {
        res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'organizationId is required',
        });
        return;
      }
    }
    // PATCH/PUT operations - update server
    else if (method === 'PATCH' || method === 'PUT') {
      const serverId = req.params.serverId || req.params.id;

      if (!serverId) {
        res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'Server ID is required',
        });
        return;
      }

      const server = await prisma.api_servers.findUnique({
        where: { id: serverId },
        select: { id: true, organizationId: true },
      });

      if (!server) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'API server not found',
        });
        return;
      }

      organizationId = server.organizationId;
      operation = 'update API server';
    }
    // DELETE operations
    else if (method === 'DELETE') {
      const serverId = req.params.serverId || req.params.id;

      if (!serverId) {
        res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'Server ID is required',
        });
        return;
      }

      const server = await prisma.api_servers.findUnique({
        where: { id: serverId },
        select: { id: true, organizationId: true },
      });

      if (!server) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'API server not found',
        });
        return;
      }

      organizationId = server.organizationId;
      operation = 'delete API server';
    } else {
      // Unsupported method
      res.status(405).json({
        error: 'METHOD_NOT_ALLOWED',
        message: `HTTP method ${method} not allowed`,
      });
      return;
    }

    // For CREATE/UPDATE/DELETE: Require perm_ManageSettings
    const userOrg = user.organizations.find(o => o.organizationId === organizationId);

    if (!userOrg) {
      logger.warn('API server operation denied - no org access', {
        userId: user.userId,
        username: user.username,
        organizationId,
        operation,
        method,
      });

      res.status(403).json({
        error: 'ORG_ACCESS_DENIED',
        message: `You don't have access to organization ${organizationId}`,
        organizationId,
      });
      return;
    }

    if (!userOrg.permissions.perm_ManageSettings) {
      logger.warn('API server operation denied - missing permission', {
        userId: user.userId,
        username: user.username,
        organizationId,
        organizationCode: userOrg.organizationCode,
        permission: 'perm_ManageSettings',
        operation,
        method,
      });

      // Log to audit log
      await logApiServerPermissionDenial(
        user.userId,
        user.username,
        organizationId,
        'perm_ManageSettings',
        req.path,
        method
      );

      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Requires perm_ManageSettings permission to manage API servers',
        permission: 'perm_ManageSettings',
        organizationId,
        organizationCode: userOrg.organizationCode,
      });
      return;
    }

    // Validate organization is active for CREATE/UPDATE operations
    if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
      try {
        await OrganizationValidationService.validateOrgActive(organizationId, operation);
      } catch (error) {
        if (error instanceof Error && error.name === 'OrganizationInactiveException') {
          res.status(403).json({
            error: 'ORG_INACTIVE',
            message: error.message,
            organizationId,
            organizationCode: userOrg.organizationCode,
          });
          return;
        }
        throw error;
      }
    }

    // Permission granted - attach organizationId to request
    req.organizationId = organizationId;

    logger.debug('API server operation authorized', {
      userId: user.userId,
      organizationId,
      operation,
      method,
    });

    next();
  } catch (error) {
    logger.error('API server permission middleware error', {
      error,
      path: req.path,
      method: req.method,
    });

    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Authorization check failed',
    });
  }
}

/**
 * Log API server permission denial to audit log
 */
async function logApiServerPermissionDenial(
  userId: string,
  username: string,
  organizationId: string,
  permission: string,
  endpoint: string,
  method: string
): Promise<void> {
  try {
    await prisma.audit_logs.create({
      data: {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        organizationId,
        action: 'api_server_permission_denied',
        resource: endpoint,
        method,
        success: false,
        metadata: {
          username,
          permission,
          reason: 'PERMISSION_DENIED',
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Failed to log API server permission denial', { error });
  }
}
