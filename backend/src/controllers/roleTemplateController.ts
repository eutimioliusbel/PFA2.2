/**
 * Role Template Controller
 * ADR-005 Missing Components - Role Template Editor
 *
 * Handles CRUD operations for role templates with 14 permission flags.
 */

import { Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { AuthRequest } from '../types/auth';

/**
 * Get all role templates
 * GET /api/roles
 */
export const getAllRoleTemplates = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const templates = await prisma.role_templates.findMany({
      orderBy: [
        { isSystem: 'desc' },
        { name: 'asc' },
      ],
    });

    // Transform to frontend expected format with permissions object
    const transformedTemplates = templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      isSystem: t.isSystem,
      permissions: {
        perm_Read: t.perm_Read,
        perm_EditForecast: t.perm_EditForecast,
        perm_EditActuals: t.perm_EditActuals,
        perm_Delete: t.perm_Delete,
        perm_Import: t.perm_Import,
        perm_RefreshData: t.perm_RefreshData,
        perm_Export: t.perm_Export,
        perm_ViewFinancials: t.perm_ViewFinancials,
        perm_SaveDraft: t.perm_SaveDraft,
        perm_Sync: t.perm_Sync,
        perm_ManageUsers: t.perm_ManageUsers,
        perm_ManageSettings: t.perm_ManageSettings,
        perm_ConfigureAlerts: t.perm_ConfigureAlerts,
        perm_Impersonate: t.perm_Impersonate,
        perm_UseAiFeatures: t.perm_UseAiFeatures,
      },
      capabilities: t.capabilities as Record<string, boolean> || {},
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      createdBy: t.createdBy,
    }));

    res.json({ templates: transformedTemplates });
  } catch (error) {
    logger.error('Error fetching role templates:', error);
    res.status(500).json({ error: 'Failed to fetch role templates' });
  }
};

/**
 * Get a single role template by ID
 * GET /api/roles/:id
 */
export const getRoleTemplateById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const template = await prisma.role_templates.findUnique({
      where: { id },
    });

    if (!template) {
      res.status(404).json({ error: 'Role template not found' });
      return;
    }

    res.json(template);
  } catch (error) {
    logger.error('Error fetching role template:', error);
    res.status(500).json({ error: 'Failed to fetch role template' });
  }
};

/**
 * Create a new role template
 * POST /api/roles
 */
export const createRoleTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, description, permissions, capabilities } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    // Check if role with same name exists
    const existing = await prisma.role_templates.findUnique({
      where: { name },
    });

    if (existing) {
      res.status(400).json({ error: 'Role template with this name already exists' });
      return;
    }

    const template = await prisma.role_templates.create({
      data: {
        id: crypto.randomUUID(),
        name,
        description,
        createdBy: req.user.userId,
        updatedAt: new Date(),
        perm_Read: permissions?.perm_Read ?? true,
        perm_EditForecast: permissions?.perm_EditForecast ?? false,
        perm_EditActuals: permissions?.perm_EditActuals ?? false,
        perm_Delete: permissions?.perm_Delete ?? false,
        perm_Import: permissions?.perm_Import ?? false,
        perm_RefreshData: permissions?.perm_RefreshData ?? false,
        perm_Export: permissions?.perm_Export ?? false,
        perm_ViewFinancials: permissions?.perm_ViewFinancials ?? false,
        perm_SaveDraft: permissions?.perm_SaveDraft ?? false,
        perm_Sync: permissions?.perm_Sync ?? false,
        perm_ManageUsers: permissions?.perm_ManageUsers ?? false,
        perm_ManageSettings: permissions?.perm_ManageSettings ?? false,
        perm_ConfigureAlerts: permissions?.perm_ConfigureAlerts ?? false,
        perm_Impersonate: permissions?.perm_Impersonate ?? false,
        perm_UseAiFeatures: permissions?.perm_UseAiFeatures ?? false,
        capabilities: capabilities ?? {},
      },
    });

    // Return in frontend expected format
    const response = {
      success: true,
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        isSystem: template.isSystem,
        permissions: {
          perm_Read: template.perm_Read,
          perm_EditForecast: template.perm_EditForecast,
          perm_EditActuals: template.perm_EditActuals,
          perm_Delete: template.perm_Delete,
          perm_Import: template.perm_Import,
          perm_RefreshData: template.perm_RefreshData,
          perm_Export: template.perm_Export,
          perm_ViewFinancials: template.perm_ViewFinancials,
          perm_SaveDraft: template.perm_SaveDraft,
          perm_Sync: template.perm_Sync,
          perm_ManageUsers: template.perm_ManageUsers,
          perm_ManageSettings: template.perm_ManageSettings,
          perm_ConfigureAlerts: template.perm_ConfigureAlerts,
          perm_Impersonate: template.perm_Impersonate,
          perm_UseAiFeatures: template.perm_UseAiFeatures,
        },
        capabilities: template.capabilities as Record<string, boolean> || {},
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
        createdBy: template.createdBy,
      },
    };

    logger.info(`Role template created: ${template.name} by ${req.user.userId}`);
    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating role template:', error);
    res.status(500).json({ error: 'Failed to create role template' });
  }
};

/**
 * Update a role template
 * PUT /api/roles/:id
 */
export const updateRoleTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { name, description, permissions, capabilities, applyToUsers } = req.body;

    // Check if template exists
    const existing = await prisma.role_templates.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ error: 'Role template not found' });
      return;
    }

    // System roles cannot be deleted, but can be modified
    if (existing.isSystem && req.body.isSystem === false) {
      res.status(400).json({ error: 'Cannot demote system role to custom role' });
      return;
    }

    // Update the template
    const updated = await prisma.role_templates.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        description: description ?? existing.description,
        updatedAt: new Date(),
        perm_Read: permissions?.perm_Read ?? existing.perm_Read,
        perm_EditForecast: permissions?.perm_EditForecast ?? existing.perm_EditForecast,
        perm_EditActuals: permissions?.perm_EditActuals ?? existing.perm_EditActuals,
        perm_Delete: permissions?.perm_Delete ?? existing.perm_Delete,
        perm_Import: permissions?.perm_Import ?? existing.perm_Import,
        perm_RefreshData: permissions?.perm_RefreshData ?? existing.perm_RefreshData,
        perm_Export: permissions?.perm_Export ?? existing.perm_Export,
        perm_ViewFinancials: permissions?.perm_ViewFinancials ?? existing.perm_ViewFinancials,
        perm_SaveDraft: permissions?.perm_SaveDraft ?? existing.perm_SaveDraft,
        perm_Sync: permissions?.perm_Sync ?? existing.perm_Sync,
        perm_ManageUsers: permissions?.perm_ManageUsers ?? existing.perm_ManageUsers,
        perm_ManageSettings: permissions?.perm_ManageSettings ?? existing.perm_ManageSettings,
        perm_ConfigureAlerts: permissions?.perm_ConfigureAlerts ?? existing.perm_ConfigureAlerts,
        perm_Impersonate: permissions?.perm_Impersonate ?? existing.perm_Impersonate,
        perm_UseAiFeatures: permissions?.perm_UseAiFeatures ?? existing.perm_UseAiFeatures,
        capabilities: capabilities ?? existing.capabilities,
      },
    });

    // Apply bulk update to users if requested
    if (applyToUsers) {
      await prisma.user_organizations.updateMany({
        where: {
          role: existing.name,
          isCustom: false,
        },
        data: {
          perm_Read: updated.perm_Read,
          perm_EditForecast: updated.perm_EditForecast,
          perm_EditActuals: updated.perm_EditActuals,
          perm_Delete: updated.perm_Delete,
          perm_Import: updated.perm_Import,
          perm_RefreshData: updated.perm_RefreshData,
          perm_Export: updated.perm_Export,
          perm_ViewFinancials: updated.perm_ViewFinancials,
          perm_SaveDraft: updated.perm_SaveDraft,
          perm_Sync: updated.perm_Sync,
          perm_ManageUsers: updated.perm_ManageUsers,
          perm_ManageSettings: updated.perm_ManageSettings,
          perm_ConfigureAlerts: updated.perm_ConfigureAlerts,
          perm_Impersonate: updated.perm_Impersonate,
          perm_UseAiFeatures: updated.perm_UseAiFeatures,
          modifiedBy: req.user.userId,
          modifiedAt: new Date(),
        },
      });
      logger.info(`Bulk updated all users with role ${existing.name}`);
    }

    // Return in frontend expected format
    const response = {
      success: true,
      template: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        isSystem: updated.isSystem,
        permissions: {
          perm_Read: updated.perm_Read,
          perm_EditForecast: updated.perm_EditForecast,
          perm_EditActuals: updated.perm_EditActuals,
          perm_Delete: updated.perm_Delete,
          perm_Import: updated.perm_Import,
          perm_RefreshData: updated.perm_RefreshData,
          perm_Export: updated.perm_Export,
          perm_ViewFinancials: updated.perm_ViewFinancials,
          perm_SaveDraft: updated.perm_SaveDraft,
          perm_Sync: updated.perm_Sync,
          perm_ManageUsers: updated.perm_ManageUsers,
          perm_ManageSettings: updated.perm_ManageSettings,
          perm_ConfigureAlerts: updated.perm_ConfigureAlerts,
          perm_Impersonate: updated.perm_Impersonate,
          perm_UseAiFeatures: updated.perm_UseAiFeatures,
        },
        capabilities: updated.capabilities as Record<string, boolean> || {},
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        createdBy: updated.createdBy,
      },
    };

    logger.info(`Role template updated: ${updated.name} by ${req.user.userId}`);
    res.json(response);
  } catch (error) {
    logger.error('Error updating role template:', error);
    res.status(500).json({ error: 'Failed to update role template' });
  }
};

/**
 * Delete a role template
 * DELETE /api/roles/:id
 */
export const deleteRoleTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if template exists
    const template = await prisma.role_templates.findUnique({
      where: { id },
    });

    if (!template) {
      res.status(404).json({ error: 'Role template not found' });
      return;
    }

    // System roles cannot be deleted
    if (template.isSystem) {
      res.status(400).json({ error: 'Cannot delete system role template' });
      return;
    }

    // Check if any users are using this role
    const usersCount = await prisma.user_organizations.count({
      where: { role: template.name },
    });

    if (usersCount > 0) {
      res.status(400).json({
        error: `Cannot delete role template. ${usersCount} user(s) are assigned to this role.`,
      });
      return;
    }

    await prisma.role_templates.delete({
      where: { id },
    });

    logger.info(`Role template deleted: ${template.name}`);
    res.json({ message: 'Role template deleted successfully' });
  } catch (error) {
    logger.error('Error deleting role template:', error);
    res.status(500).json({ error: 'Failed to delete role template' });
  }
};

/**
 * Get usage statistics for a role template
 * GET /api/roles/:id/usage
 */
export const getRoleTemplateUsage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const template = await prisma.role_templates.findUnique({
      where: { id },
    });

    if (!template) {
      res.status(404).json({ error: 'Role template not found' });
      return;
    }

    const users = await prisma.user_organizations.findMany({
      where: { role: template.name },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        organizations: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    const customizedCount = users.filter(u => u.isCustom).length;
    const standardCount = users.length - customizedCount;

    res.json({
      totalUsers: users.length,
      standardCount,
      customizedCount,
      users,
    });
  } catch (error) {
    logger.error('Error fetching role template usage:', error);
    res.status(500).json({ error: 'Failed to fetch role template usage' });
  }
};
