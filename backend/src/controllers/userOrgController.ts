/**
 * UserOrganization Controller
 * Phase 5, Task 5.3 - User-Organization Permission Manager
 *
 * Handles granular permission management for user-organization assignments.
 */

import { Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { DataCollectionService } from '../services/aiDataHooks/DataCollectionService';
import { AuthRequest } from '../types/auth';
import { randomUUID } from 'crypto';

/**
 * Role templates defining default permissions for each role
 */
const ROLE_TEMPLATES: Record<string, Partial<any>> = {
  viewer: {
    perm_Read: true,
    perm_Export: true,
    perm_ViewFinancials: false,
  },
  editor: {
    perm_Read: true,
    perm_EditForecast: true,
    perm_Import: true,
    perm_Export: true,
    perm_SaveDraft: true,
    perm_ViewFinancials: false,
  },
  admin: {
    perm_Read: true,
    perm_EditForecast: true,
    perm_EditActuals: true,
    perm_Delete: true,
    perm_Import: true,
    perm_RefreshData: true,
    perm_Export: true,
    perm_ViewFinancials: true,
    perm_SaveDraft: true,
    perm_Sync: true,
    perm_ManageUsers: true,
    perm_ManageSettings: true,
    perm_Viewaudit_log: true,
  },
  beo: {
    perm_Read: true,
    perm_EditForecast: true,
    perm_EditActuals: true,
    perm_Import: true,
    perm_Export: true,
    perm_ViewFinancials: true,
    perm_SaveDraft: true,
  },
};

/**
 * Get all organizations for a specific user
 * GET /api/users/:userId/organizations
 */
export const getUserOrganizations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const userOrgs = await prisma.user_organizations.findMany({
      where: { userId },
      include: {
        organizations: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            isExternal: true,
            externalId: true,
            serviceStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to include capability summary
    const formattedUserOrgs = userOrgs.map(uo => {
      // Extract all permission fields
      const permissions: Record<string, boolean> = {};
      Object.keys(uo).forEach(key => {
        if (key.startsWith('perm_')) {
          permissions[key] = (uo as any)[key] || false;
        }
      });

      // Get role template permissions
      const roleTemplate = ROLE_TEMPLATES[uo.role] || {};

      return {
        id: uo.id,
        userId: uo.userId,
        organizationId: uo.organizationId,
        role: uo.role,
        assignmentSource: uo.assignmentSource,
        externalRoleId: uo.externalRoleId,
        isCustom: uo.isCustom,
        organization: uo.organizations,
        permissions,
        roleTemplate,
        enabledCapabilitiesCount: Object.values(permissions).filter(Boolean).length,
        createdAt: uo.createdAt,
        modifiedAt: uo.modifiedAt,
      };
    });

    res.json({ userOrganizations: formattedUserOrgs });
  } catch (error) {
    logger.error('Error fetching user organizations:', error);
    res.status(500).json({ error: 'Failed to fetch user organizations' });
  }
};

/**
 * Update user-organization role
 * PUT /api/user-organizations/:id/role
 */
export const updateUserOrgRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      res.status(400).json({ error: 'Role is required' });
      return;
    }

    const userOrg = await prisma.user_organizations.findUnique({
      where: { id },
      include: {
        organizations: true,
        users: true,
      },
    });

    if (!userOrg) {
      res.status(404).json({ error: 'User-organization assignment not found' });
      return;
    }

    // Get role template permissions
    const roleTemplate = ROLE_TEMPLATES[role] || {};

    // Update role and apply template permissions (if not custom)
    const updateData: any = {
      role,
    };

    // If not custom, reset permissions to role template
    if (!userOrg.isCustom) {
      Object.assign(updateData, roleTemplate);
    }

    const updatedUserOrg = await prisma.user_organizations.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: req.user?.userId || 'system',
        organizationId: userOrg.organizationId,
        action: 'user_org_role_updated',
        resource: 'user_organization_management',
        method: 'PUT',
        success: true,
        metadata: {
          userOrgId: id,
          targetUserId: userOrg.userId,
          targetUsername: userOrg.users.username,
          organizationCode: userOrg.organizations.code,
          previousRole: userOrg.role,
          newRole: role,
          modifiedBy: req.user?.username,
          timestamp: new Date().toISOString(),
        },
      },
    });

    logger.info(`User-org role updated: ${userOrg.users.username} in ${userOrg.organizations.code}`, {
      userOrgId: id,
      previousRole: userOrg.role,
      newRole: role,
    });

    res.json({
      success: true,
      message: 'Role updated successfully',
      user_organization: updatedUserOrg,
    });
  } catch (error) {
    logger.error('Error updating user-org role:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
};

/**
 * Update specific capability for user-organization
 * PATCH /api/user-organizations/:id/capabilities
 */
export const updateUserOrgCapabilities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { capabilities } = req.body;

    if (!capabilities || typeof capabilities !== 'object') {
      res.status(400).json({ error: 'Capabilities object is required' });
      return;
    }

    const userOrg = await prisma.user_organizations.findUnique({
      where: { id },
      include: {
        organizations: true,
        users: true,
      },
    });

    if (!userOrg) {
      res.status(404).json({ error: 'User-organization assignment not found' });
      return;
    }

    // Filter only permission fields
    const permissionUpdates: any = {};
    Object.keys(capabilities).forEach(key => {
      if (key.startsWith('perm_')) {
        permissionUpdates[key] = capabilities[key];
      }
    });

    // Mark as custom if permissions differ from role template
    const roleTemplate = ROLE_TEMPLATES[userOrg.role] || {};
    const hasCustomPermissions = Object.keys(permissionUpdates).some(
      key => permissionUpdates[key] !== roleTemplate[key]
    );

    // Capture before state for AI data hooks
    const beforeState = {
      role: userOrg.role,
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
    };

    const updatedUserOrg = await prisma.user_organizations.update({
      where: { id },
      data: {
        ...permissionUpdates,
        isCustom: hasCustomPermissions || userOrg.isCustom,
      },
    });

    // AI Data Hooks: Log each permission change individually for AI training
    for (const [field, value] of Object.entries(permissionUpdates)) {
      if (field.startsWith('perm_') && (beforeState as any)[field] !== value) {
        // Fire and forget - don't block response
        DataCollectionService.logPermissionChange({
          userId: userOrg.userId,
          actorUserId: req.user?.userId || 'system',
          organizationId: userOrg.organizationId,
          action: value === true ? 'grant' : 'revoke',
          permissionField: field,
          permissionValue: value as boolean,
          beforeState,
          afterState: { ...beforeState, ...permissionUpdates },
          context: {
            ipAddress: req.ip || 'unknown',
            userAgent: req.get('user-agent') || 'unknown',
            sessionId: req.headers['x-session-id'] as string || 'unknown',
          },
        }).catch(err => logger.error('Failed to log permission change for AI', { error: err }));
      }
    }

    // Standard audit log (for compliance)
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: req.user?.userId || 'system',
        organizationId: userOrg.organizationId,
        action: 'user_org_capabilities_updated',
        resource: 'user_organization_management',
        method: 'PATCH',
        success: true,
        metadata: {
          userOrgId: id,
          targetUserId: userOrg.userId,
          targetUsername: userOrg.users.username,
          organizationCode: userOrg.organizations.code,
          updatedCapabilities: Object.keys(permissionUpdates),
          isCustom: hasCustomPermissions || userOrg.isCustom,
          modifiedBy: req.user?.username,
          timestamp: new Date().toISOString(),
        },
      },
    });

    logger.info(`User-org capabilities updated: ${userOrg.users.username} in ${userOrg.organizations.code}`, {
      userOrgId: id,
      updatedCapabilities: Object.keys(permissionUpdates),
    });

    res.json({
      success: true,
      message: 'Capabilities updated successfully',
      user_organization: updatedUserOrg,
    });
  } catch (error) {
    logger.error('Error updating user-org capabilities:', error);
    res.status(500).json({ error: 'Failed to update capabilities' });
  }
};

/**
 * Revoke user access to organization
 * DELETE /api/user-organizations/:id
 */
export const revokeUserOrganization = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const userOrg = await prisma.user_organizations.findUnique({
      where: { id },
      include: {
        organizations: true,
        users: true,
      },
    });

    if (!userOrg) {
      res.status(404).json({ error: 'User-organization assignment not found' });
      return;
    }

    // Prevent revoking PEMS assignments (only local overrides allowed)
    if (userOrg.assignmentSource === 'pems_sync' && !userOrg.isCustom) {
      res.status(400).json({
        error: 'Cannot revoke PEMS assignment',
        message: 'This assignment is managed by PEMS. You can only modify capabilities or mark as custom.',
      });
      return;
    }

    await prisma.user_organizations.delete({
      where: { id },
    });

    // Audit log
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: req.user?.userId || 'system',
        organizationId: userOrg.organizationId,
        action: 'user_org_access_revoked',
        resource: 'user_organization_management',
        method: 'DELETE',
        success: true,
        metadata: {
          userOrgId: id,
          targetUserId: userOrg.userId,
          targetUsername: userOrg.users.username,
          organizationCode: userOrg.organizations.code,
          previousRole: userOrg.role,
          assignmentSource: userOrg.assignmentSource,
          reason: reason || 'No reason provided',
          revokedBy: req.user?.username,
          timestamp: new Date().toISOString(),
        },
      },
    });

    logger.info(`User-org access revoked: ${userOrg.users.username} from ${userOrg.organizations.code}`, {
      userOrgId: id,
      reason,
    });

    res.json({
      success: true,
      message: 'Access revoked successfully',
    });
  } catch (error) {
    logger.error('Error revoking user-org access:', error);
    res.status(500).json({ error: 'Failed to revoke access' });
  }
};

/**
 * Assign user to organization
 * POST /api/users/:userId/organizations
 */
export const assignUserToOrganization = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { organizationId, role = 'viewer' } = req.body;

    if (!organizationId) {
      res.status(400).json({ error: 'Organization ID is required' });
      return;
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.user_organizations.findFirst({
      where: {
        userId,
        organizationId,
      },
    });

    if (existingAssignment) {
      res.status(400).json({
        error: 'Assignment already exists',
        message: 'User is already assigned to this organization',
      });
      return;
    }

    // Get role template permissions
    const roleTemplate = ROLE_TEMPLATES[role] || ROLE_TEMPLATES.viewer;

    // Create user-organization assignment
    const userOrg = await prisma.user_organizations.create({
      data: {
        id: randomUUID(),
        userId,
        organizationId,
        role,
        assignmentSource: 'local',
        modifiedAt: new Date(),
        ...roleTemplate,
      },
      include: {
        organizations: true,
        users: true,
      },
    });

    // Audit log
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: req.user?.userId || 'system',
        organizationId,
        action: 'user_org_assigned',
        resource: 'user_organization_management',
        method: 'POST',
        success: true,
        metadata: {
          userOrgId: userOrg.id,
          targetUserId: userId,
          targetUsername: userOrg.users.username,
          organizationCode: userOrg.organizations.code,
          role,
          assignedBy: req.user?.username,
          timestamp: new Date().toISOString(),
        },
      },
    });

    logger.info(`User assigned to organization: ${userOrg.users.username} to ${userOrg.organizations.code}`, {
      userOrgId: userOrg.id,
      role,
    });

    res.status(201).json({
      success: true,
      message: 'User assigned to organization successfully',
      user_organization: userOrg,
    });
  } catch (error) {
    logger.error('Error assigning user to organization:', error);
    res.status(500).json({ error: 'Failed to assign user to organization' });
  }
};

/**
 * Get role template
 * GET /api/role-templates/:role
 */
export const getRoleTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.params;

    const template = ROLE_TEMPLATES[role];

    if (!template) {
      res.status(404).json({ error: 'Role template not found' });
      return;
    }

    res.json({
      role,
      template,
      availableRoles: Object.keys(ROLE_TEMPLATES),
    });
  } catch (error) {
    logger.error('Error fetching role template:', error);
    res.status(500).json({ error: 'Failed to fetch role template' });
  }
};
