import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get all organizations
 */
export const getOrganizations = async (req: Request, res: Response) => {
  try {
    const organizations = await prisma.organization.findMany({
      include: {
        users: {
          include: {
            user: true,
          },
        },
        aiConfig: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to match frontend format
    const formattedOrgs = organizations.map(org => ({
      id: org.code, // Frontend uses code as id
      code: org.code,
      name: org.name,
      description: org.description,
      logoUrl: org.logoUrl,
      status: org.isActive ? 'active' : 'inactive',
      aiRules: [],
      submitMode: 'api',
      features: {
        ai: org.aiConfig?.enabled || false,
        aiAccessLevel: org.aiConfig?.accessLevel || 'disabled',
        aiIconGeneration: false,
      },
      permissions: {
        viewTimeline: true,
        viewMatrix: true,
        viewGrid: true,
        canExport: true,
      },
      headerConfig: {
        showLogo: true,
        showId: true,
        showName: false,
        showDescription: false,
      },
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    }));

    res.json({ organizations: formattedOrgs });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
};

/**
 * Create a new organization
 */
export const createOrganization = async (req: Request, res: Response) => {
  try {
    const { code, name, description } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'Code and name are required' });
    }

    // Check if organization already exists
    const existingOrg = await prisma.organization.findUnique({
      where: { code },
    });

    if (existingOrg) {
      return res.status(400).json({ error: 'Organization code already exists' });
    }

    // Create organization
    const organization = await prisma.organization.create({
      data: {
        code,
        name,
        description,
        isActive: true,
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
export const updateOrganization = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { code, name, description, logoUrl, isActive } = req.body;

    // Check if organization exists (using code as id)
    const existingOrg = await prisma.organization.findUnique({
      where: { code: id },
    });

    if (!existingOrg) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Update organization
    const organization = await prisma.organization.update({
      where: { code: id },
      data: {
        name,
        description,
        logoUrl,
        isActive,
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
export const deleteOrganization = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const organization = await prisma.organization.findUnique({
      where: { code: id },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    await prisma.organization.delete({
      where: { code: id },
    });

    res.json({ success: true, message: 'Organization deleted successfully' });
  } catch (error) {
    console.error('Error deleting organization:', error);
    res.status(500).json({ error: 'Failed to delete organization' });
  }
};
