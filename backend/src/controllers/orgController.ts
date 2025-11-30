import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { logger } from '../utils/logger';

/**
 * Get all organizations
 */
export const getOrganizations = async (_req: Request, res: Response): Promise<void> => {
  try {
    const organizations = await prisma.organizations.findMany({
      include: {
        user_organizations: {
          include: {
            users: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        },
        organization_ai_configs: true,
        api_configurations: {
          select: {
            firstSyncAt: true,
            lastSyncAt: true,
            lastSyncRecordCount: true,
            totalSyncRecordCount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to match frontend format
    const formattedOrgs = organizations.map((org) => {
      // Aggregate sync dates from all api_configurations for this org
      const syncDates = org.api_configurations
        ?.filter((c: { firstSyncAt: Date | null; lastSyncAt: Date | null }) => c.firstSyncAt || c.lastSyncAt)
        .map((c: { firstSyncAt: Date | null; lastSyncAt: Date | null }) => ({
          firstSyncAt: c.firstSyncAt,
          lastSyncAt: c.lastSyncAt,
        })) || [];

      // Get earliest firstSyncAt and latest lastSyncAt
      const firstSyncAt = syncDates.length > 0
        ? syncDates.reduce((earliest: Date | null, c: { firstSyncAt: Date | null }) => {
            if (!c.firstSyncAt) return earliest;
            if (!earliest) return c.firstSyncAt;
            return c.firstSyncAt < earliest ? c.firstSyncAt : earliest;
          }, null as Date | null)
        : null;

      const lastSyncAt = syncDates.length > 0
        ? syncDates.reduce((latest: Date | null, c: { lastSyncAt: Date | null }) => {
            if (!c.lastSyncAt) return latest;
            if (!latest) return c.lastSyncAt;
            return c.lastSyncAt > latest ? c.lastSyncAt : latest;
          }, null as Date | null)
        : null;

      // Sum up sync record counts
      const totalSyncRecordCount = org.api_configurations?.reduce(
        (sum: number, c: { totalSyncRecordCount: number | null }) => sum + (c.totalSyncRecordCount || 0),
        0
      ) || 0;

      return {
        id: org.id,
        code: org.code,
        name: org.name,
        description: org.description,
        logoUrl: org.logoUrl,
        headerConfig: org.headerConfig || { showLogo: true, showId: true, showName: false, showDescription: false },
        isActive: org.isActive,
        isExternal: org.isExternal,
        externalId: org.externalId,
        serviceStatus: org.serviceStatus,
        suspendedAt: org.suspendedAt,
        suspendedBy: org.suspendedBy,
        enableSync: org.enableSync,
        userCount: org.user_organizations?.length || 0,
        users: org.user_organizations?.map((uo: { users: { id: string; username: string; email: string | null }; role: string }) => ({
          id: uo.users.id,
          username: uo.users.username,
          email: uo.users.email,
          role: uo.role,
        })) || [],
        features: {
          ai: org.organization_ai_configs?.enabled ?? false,
          aiAccessLevel: org.organization_ai_configs?.accessLevel ?? 'disabled',
        },
        // Sync status fields (aggregated from api_configurations)
        firstSyncAt,
        lastSyncAt,
        totalSyncRecordCount,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
      };
    });

    res.json({ organizations: formattedOrgs });
  } catch (error) {
    logger.error('Error fetching organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
};

/**
 * Create a new organization
 */
export const createOrganization = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      code,
      name,
      description,
      logoUrl,
      headerConfig,
      serviceStatus,
      enableSync,
    } = req.body;

    if (!code || !name) {
      res.status(400).json({ error: 'Code and name are required' });
      return;
    }

    // Check if organization already exists
    const existingOrg = await prisma.organizations.findUnique({
      where: { code },
    });

    if (existingOrg) {
      res.status(400).json({ error: 'Organization code already exists' });
      return;
    }

    // Create organization (must provide id and updatedAt)
    const organization = await prisma.organizations.create({
      data: {
        id: randomUUID(),
        code,
        name,
        description: description || null,
        logoUrl: logoUrl || null,
        headerConfig: headerConfig || { showLogo: true, showId: true, showName: false, showDescription: false },
        isActive: true,
        isExternal: false,
        serviceStatus: serviceStatus || 'active',
        enableSync: enableSync ?? false,
        // AI features default to false, enabled via Admin UI
        ai_ChatAssistant: false,
        updatedAt: new Date(),
      },
    });

    // Audit log
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: (req as { user?: { userId: string } }).user?.userId || 'system',
        organizationId: organization.id,
        action: 'organization_created',
        resource: 'organization_management',
        method: 'POST',
        success: true,
        metadata: {
          organizationId: organization.id,
          organizationCode: code,
          organizationName: name,
          timestamp: new Date().toISOString(),
        },
      },
    });

    res.status(201).json({ success: true, organization });
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ error: 'Failed to create organization' });
  }
};

/**
 * Update an existing organization
 */
export const updateOrganization = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      logoUrl,
      headerConfig,
      isActive,
      aiRules,
      serviceStatus,
      enableSync,
    } = req.body;

    // Check if organization exists (try by id first, then by code)
    let existingOrg = await prisma.organizations.findUnique({
      where: { id },
    });

    if (!existingOrg) {
      existingOrg = await prisma.organizations.findUnique({
        where: { code: id },
      });
    }

    if (!existingOrg) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    // Build update data dynamically
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (headerConfig !== undefined) updateData.headerConfig = headerConfig;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (aiRules !== undefined) updateData.aiRules = aiRules;
    if (serviceStatus !== undefined) updateData.serviceStatus = serviceStatus;
    if (enableSync !== undefined) updateData.enableSync = enableSync;

    // Update organization
    const organization = await prisma.organizations.update({
      where: { id: existingOrg.id },
      data: updateData,
    });

    // Audit log
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: (req as { user?: { userId: string } }).user?.userId || 'system',
        organizationId: organization.id,
        action: 'organization_updated',
        resource: 'organization_management',
        method: 'PUT',
        success: true,
        metadata: {
          organizationId: organization.id,
          organizationCode: organization.code,
          changedFields: Object.keys(updateData),
          timestamp: new Date().toISOString(),
        },
      },
    });

    res.json({ success: true, organization });
  } catch (error) {
    console.error('Error updating organization:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
};

/**
 * Delete an organization
 */
export const deleteOrganization = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const organization = await prisma.organizations.findUnique({
      where: { id },
    });

    if (!organization) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    // Prevent deletion of PEMS organizations
    if (organization.isExternal) {
      res.status(400).json({
        error: 'Cannot delete PEMS organization',
        message: 'Organizations synced from PEMS cannot be deleted. Suspend or unlink them instead.',
      });
      return;
    }

    await prisma.organizations.delete({
      where: { id },
    });

    // Audit log (must provide id)
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: (req as { user?: { userId: string } }).user?.userId || 'system',
        organizationId: organization.id,
        action: 'organization_deleted',
        resource: 'organization_management',
        method: 'DELETE',
        success: true,
        metadata: {
          organizationId: id,
          organizationCode: organization.code,
          organizationName: organization.name,
          timestamp: new Date().toISOString(),
        },
      },
    });

    res.json({ success: true, message: 'Organization deleted successfully' });
  } catch (error) {
    logger.error('Error deleting organization:', error);
    res.status(500).json({ error: 'Failed to delete organization' });
  }
};

/**
 * Suspend an organization
 * POST /api/organizations/:id/suspend
 */
export const suspendOrganization = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const organization = await prisma.organizations.findUnique({
      where: { id },
    });

    if (!organization) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    if (organization.serviceStatus === 'suspended') {
      res.status(400).json({
        error: 'Organization already suspended',
        message: 'This organization is already suspended',
      });
      return;
    }

    // Update organization status
    const updatedOrg = await prisma.organizations.update({
      where: { id },
      data: {
        serviceStatus: 'suspended',
        suspendedAt: new Date(),
        suspendedBy: (req as { user?: { userId: string; username: string } }).user?.userId || null,
        isActive: false,
      },
    });

    // Create audit log (must provide id)
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: (req as { user?: { userId: string; username: string } }).user?.userId || 'system',
        organizationId: id,
        action: 'organization_suspended',
        resource: 'organization_management',
        method: 'POST',
        success: true,
        metadata: {
          organizationId: id,
          organizationCode: organization.code,
          organizationName: organization.name,
          reason: reason || 'No reason provided',
          suspendedBy: (req as { user?: { userId: string; username: string } }).user?.username || 'system',
          timestamp: new Date().toISOString(),
        },
      },
    });

    logger.info(`Organization suspended: ${organization.code} by ${(req as { user?: { userId: string; username: string } }).user?.username || 'system'}`, {
      organizationId: id,
      reason,
    });

    res.json({
      success: true,
      message: 'Organization suspended successfully',
      organization: updatedOrg,
    });
  } catch (error) {
    logger.error('Error suspending organization:', error);
    res.status(500).json({ error: 'Failed to suspend organization' });
  }
};

/**
 * Activate an organization
 * POST /api/organizations/:id/activate
 */
export const activateOrganization = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const organization = await prisma.organizations.findUnique({
      where: { id },
    });

    if (!organization) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    if (organization.serviceStatus === 'active') {
      res.status(400).json({
        error: 'Organization already active',
        message: 'This organization is already active',
      });
      return;
    }

    // Update organization status
    const updatedOrg = await prisma.organizations.update({
      where: { id },
      data: {
        serviceStatus: 'active',
        suspendedAt: null,
        suspendedBy: null,
        isActive: true,
      },
    });

    // Create audit log (must provide id)
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: (req as { user?: { userId: string; username: string } }).user?.userId || 'system',
        organizationId: id,
        action: 'organization_activated',
        resource: 'organization_management',
        method: 'POST',
        success: true,
        metadata: {
          organizationId: id,
          organizationCode: organization.code,
          organizationName: organization.name,
          activatedBy: (req as { user?: { userId: string; username: string } }).user?.username || 'system',
          previousStatus: organization.serviceStatus,
          timestamp: new Date().toISOString(),
        },
      },
    });

    logger.info(`Organization activated: ${organization.code} by ${(req as { user?: { userId: string; username: string } }).user?.username || 'system'}`, {
      organizationId: id,
    });

    res.json({
      success: true,
      message: 'Organization activated successfully',
      organization: updatedOrg,
    });
  } catch (error) {
    logger.error('Error activating organization:', error);
    res.status(500).json({ error: 'Failed to activate organization' });
  }
};

/**
 * Archive an organization
 * POST /api/organizations/:id/archive
 */
export const archiveOrganization = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const organization = await prisma.organizations.findUnique({
      where: { id },
    });

    if (!organization) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    if (organization.serviceStatus === 'archived') {
      res.status(400).json({
        error: 'Organization already archived',
        message: 'This organization is already archived',
      });
      return;
    }

    // Update organization status
    const updatedOrg = await prisma.organizations.update({
      where: { id },
      data: {
        serviceStatus: 'archived',
        isActive: false,
        enableSync: false, // Disable sync for archived orgs
      },
    });

    // Create audit log (must provide id)
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: (req as { user?: { userId: string; username: string } }).user?.userId || 'system',
        organizationId: id,
        action: 'organization_archived',
        resource: 'organization_management',
        method: 'POST',
        success: true,
        metadata: {
          organizationId: id,
          organizationCode: organization.code,
          organizationName: organization.name,
          reason: reason || 'No reason provided',
          archivedBy: (req as { user?: { userId: string; username: string } }).user?.username || 'system',
          timestamp: new Date().toISOString(),
        },
      },
    });

    logger.info(`Organization archived: ${organization.code} by ${(req as { user?: { userId: string; username: string } }).user?.username || 'system'}`, {
      organizationId: id,
      reason,
    });

    res.json({
      success: true,
      message: 'Organization archived successfully',
      organization: updatedOrg,
    });
  } catch (error) {
    logger.error('Error archiving organization:', error);
    res.status(500).json({ error: 'Failed to archive organization' });
  }
};

/**
 * Toggle sync for an organization
 * PATCH /api/organizations/:id/sync
 */
export const toggleSync = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { enableSync } = req.body;

    const organization = await prisma.organizations.findUnique({
      where: { id },
    });

    if (!organization) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    // Cannot enable sync for suspended or archived orgs
    if (enableSync && (organization.serviceStatus === 'suspended' || organization.serviceStatus === 'archived')) {
      res.status(400).json({
        error: 'Cannot enable sync',
        message: `Cannot enable sync for ${organization.serviceStatus} organizations`,
      });
      return;
    }

    // Update sync setting
    const updatedOrg = await prisma.organizations.update({
      where: { id },
      data: {
        enableSync,
      },
    });

    // Create audit log (must provide id)
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: (req as { user?: { userId: string; username: string } }).user?.userId || 'system',
        organizationId: id,
        action: enableSync ? 'sync_enabled' : 'sync_disabled',
        resource: 'organization_management',
        method: 'PATCH',
        success: true,
        metadata: {
          organizationId: id,
          organizationCode: organization.code,
          organizationName: organization.name,
          enableSync,
          modifiedBy: (req as { user?: { userId: string; username: string } }).user?.username || 'system',
          timestamp: new Date().toISOString(),
        },
      },
    });

    logger.info(`Sync ${enableSync ? 'enabled' : 'disabled'} for organization: ${organization.code}`, {
      organizationId: id,
    });

    res.json({
      success: true,
      message: `Sync ${enableSync ? 'enabled' : 'disabled'} successfully`,
      organization: updatedOrg,
    });
  } catch (error) {
    logger.error('Error toggling sync:', error);
    res.status(500).json({ error: 'Failed to toggle sync' });
  }
};

/**
 * Unlink PEMS organization
 * POST /api/organizations/:id/unlink
 */
export const unlinkOrganization = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const organization = await prisma.organizations.findUnique({
      where: { id },
    });

    if (!organization) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    if (!organization.isExternal) {
      res.status(400).json({
        error: 'Not a PEMS organization',
        message: 'Only PEMS organizations can be unlinked',
      });
      return;
    }

    // Unlink organization (mark as local)
    const updatedOrg = await prisma.organizations.update({
      where: { id },
      data: {
        isExternal: false,
        externalId: null,
        enableSync: false,
      },
    });

    // Create audit log (must provide id)
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: (req as { user?: { userId: string; username: string } }).user?.userId || 'system',
        organizationId: id,
        action: 'organization_unlinked',
        resource: 'organization_management',
        method: 'POST',
        success: true,
        metadata: {
          organizationId: id,
          organizationCode: organization.code,
          organizationName: organization.name,
          previousExternalId: organization.externalId,
          reason: reason || 'No reason provided',
          unlinkedBy: (req as { user?: { userId: string; username: string } }).user?.username || 'system',
          timestamp: new Date().toISOString(),
        },
      },
    });

    logger.info(`Organization unlinked from PEMS: ${organization.code} by ${(req as { user?: { userId: string; username: string } }).user?.username || 'system'}`, {
      organizationId: id,
      reason,
    });

    res.json({
      success: true,
      message: 'Organization unlinked successfully',
      organization: updatedOrg,
    });
  } catch (error) {
    logger.error('Error unlinking organization:', error);
    res.status(500).json({ error: 'Failed to unlink organization' });
  }
};
