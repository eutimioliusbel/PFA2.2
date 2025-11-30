/**
 * Organization Access Control Middleware
 *
 * P0-3: IDOR (Insecure Direct Object Reference) Protection
 * Prevents users from accessing resources of organizations they don't belong to
 * by verifying organization ownership before allowing access.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import prisma from '../config/database';
import { logger } from '../utils/logger';

/**
 * Verifies user has access to the requested organization
 *
 * Extracts organizationId from query/params/body and validates that the
 * authenticated user has a UserOrganization record with perm_Read = true.
 *
 * Prevents IDOR attacks like:
 * - User A accessing User B's organization data
 * - Tampering with organizationId in URL/body to access unauthorized data
 *
 * @returns Express middleware function
 */
export async function requireOrganization(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId;
    const organizationId =
      req.query.organizationId ||
      req.body.organizationId ||
      req.params.organizationId ||
      req.validatedData?.organizationId;

    // Authentication check
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    // Organization ID presence check
    if (!organizationId) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Organization ID is required',
      });
      return;
    }

    // CRITICAL SECURITY CHECK: Verify user has access to this organization
    // This prevents IDOR attacks by ensuring the user actually belongs to the org
    const userOrg = await prisma.user_organizations.findFirst({
      where: {
        userId,
        organizationId: organizationId as string,
        perm_Read: true, // Minimum permission required
      },
      include: {
        organizations: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    if (!userOrg) {
      // Log potential IDOR attack attempt
      logger.warn('IDOR attempt detected: User tried to access unauthorized organization', {
        userId,
        requestedOrgId: organizationId,
        userAuthorizedOrgs: req.user?.organizations.map(o => o.organizationId),
        ip: req.ip,
        path: req.path,
        method: req.method,
      });

      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'You do not have access to this organization',
      });
      return;
    }

    // Verify organization is active
    if (!userOrg.organizations.isActive) {
      res.status(403).json({
        success: false,
        error: 'ORGANIZATION_INACTIVE',
        message: 'This organization is not active',
      });
      return;
    }

    // Attach verified organization data to request for downstream use
    req.organizationId = organizationId as string;
    req.userOrganization = {
      id: userOrg.id,
      organizationId: userOrg.organizationId,
      organizationName: userOrg.organizations.name,
      permissions: {
        perm_Read: userOrg.perm_Read,
        perm_EditForecast: userOrg.perm_EditForecast,
        perm_EditActuals: userOrg.perm_EditActuals,
        perm_Delete: userOrg.perm_Delete,
        perm_Import: userOrg.perm_Import,
        perm_RefreshData: userOrg.perm_RefreshData,
        perm_Export: userOrg.perm_Export,
        perm_ViewFinancials: userOrg.perm_ViewFinancials,
        perm_SaveDraft: userOrg.perm_SaveDraft,
        perm_Sync: userOrg.perm_Sync,
        perm_ManageUsers: userOrg.perm_ManageUsers,
        perm_ManageSettings: userOrg.perm_ManageSettings,
        perm_ConfigureAlerts: userOrg.perm_ConfigureAlerts,
        perm_Impersonate: userOrg.perm_Impersonate,
      },
    };

    next();
  } catch (error) {
    logger.error('requireOrganization middleware error', { error });
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to verify organization access',
    });
  }
}

/**
 * Verifies user has specific permission within the organization
 *
 * Must be used AFTER requireOrganization middleware.
 * Checks that user has the specified permission flag set to true.
 *
 * @param permission - Permission name (e.g., 'Sync', 'EditForecast')
 * @returns Express middleware function
 */
export function requireOrgPermission(permission: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userOrganization) {
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'requireOrganization must be called before requireOrgPermission',
      });
      return;
    }

    const permKey = `perm_${permission}` as keyof typeof req.userOrganization.permissions;
    const hasPermission = req.userOrganization.permissions[permKey];

    if (!hasPermission) {
      logger.warn('Permission denied within organization', {
        userId: req.user?.userId,
        organizationId: req.organizationId,
        requiredPermission: permission,
        path: req.path,
      });

      res.status(403).json({
        success: false,
        error: 'PERMISSION_DENIED',
        message: `${permission} permission required for this operation`,
      });
      return;
    }

    next();
  };
}

// Extend Express Request type to include organization context
declare global {
  namespace Express {
    interface Request {
      organizationId?: string;
      userOrganization?: {
        id: string;
        organizationId: string;
        organizationName: string;
        permissions: {
          perm_Read: boolean;
          perm_EditForecast: boolean;
          perm_EditActuals: boolean;
          perm_Delete: boolean;
          perm_Import: boolean;
          perm_RefreshData: boolean;
          perm_Export: boolean;
          perm_ViewFinancials: boolean;
          perm_SaveDraft: boolean;
          perm_Sync: boolean;
          perm_ManageUsers: boolean;
          perm_ManageSettings: boolean;
          perm_ConfigureAlerts: boolean;
          perm_Impersonate: boolean;
        };
      };
    }
  }
}
