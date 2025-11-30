/**
 * Trash Can Controller
 * ADR-005 Missing Components - Data Recovery Console
 *
 * Handles soft-deleted items with restore and purge capabilities.
 */

import { Response } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { AuthRequest } from '../types/auth';

/**
 * Get all soft-deleted items
 * GET /api/trash
 */
export const getAllDeletedItems = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { entityType } = req.query;

    const where: any = {};
    if (entityType) {
      where.entityType = entityType;
    }

    const items = await prisma.soft_deleted_items.findMany({
      where: {
        ...where,
        permanentlyDeletedAt: null, // Only show items not permanently deleted
      },
      orderBy: { deletedAt: 'desc' },
    });

    res.json(items);
  } catch (error) {
    logger.error('Error fetching deleted items:', error);
    res.status(500).json({ error: 'Failed to fetch deleted items' });
  }
};

/**
 * Get a single deleted item by ID
 * GET /api/trash/:id
 */
export const getDeletedItemById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const item = await prisma.soft_deleted_items.findUnique({
      where: { id },
    });

    if (!item) {
      res.status(404).json({ error: 'Deleted item not found' });
      return;
    }

    res.json(item);
  } catch (error) {
    logger.error('Error fetching deleted item:', error);
    res.status(500).json({ error: 'Failed to fetch deleted item' });
  }
};

/**
 * Soft delete an entity (move to trash)
 * POST /api/trash
 */
export const softDeleteEntity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { entityType, entityId, entityData, dependencies } = req.body;

    if (!entityType || !entityId || !entityData) {
      res.status(400).json({
        error: 'entityType, entityId, and entityData are required',
      });
      return;
    }

    // Check if dependencies exist
    const canRestore = !dependencies || dependencies.length === 0;

    const deletedItem = await prisma.soft_deleted_items.create({
      data: {
        id: randomUUID(),
        entityType,
        entityId,
        entityData,
        deletedBy: req.user?.userId || 'unknown',
        canRestore,
        dependencies: dependencies ?? null,
      },
    });

    logger.info(`Entity soft deleted: ${entityType} ${entityId} by ${req.user?.userId}`);
    res.status(201).json(deletedItem);
  } catch (error) {
    logger.error('Error soft deleting entity:', error);
    res.status(500).json({ error: 'Failed to soft delete entity' });
  }
};

/**
 * Restore a soft-deleted item
 * POST /api/trash/:id/restore
 */
export const restoreDeletedItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const item = await prisma.soft_deleted_items.findUnique({
      where: { id },
    });

    if (!item) {
      res.status(404).json({ error: 'Deleted item not found' });
      return;
    }

    if (!item.canRestore) {
      res.status(400).json({
        error: 'Cannot restore this item due to dependencies',
        dependencies: item.dependencies,
      });
      return;
    }

    if (item.restoredAt) {
      res.status(400).json({ error: 'Item has already been restored' });
      return;
    }

    if (item.permanentlyDeletedAt) {
      res.status(400).json({ error: 'Item has been permanently deleted' });
      return;
    }

    // Restore the entity based on type
    let restored: any;
    switch (item.entityType) {
      case 'User':
        restored = await restoreUser(item.entityId, item.entityData);
        break;
      case 'Organization':
        restored = await restoreOrganization(item.entityId, item.entityData);
        break;
      case 'PfaRecord':
        restored = await restorePfaRecord(item.entityId, item.entityData);
        break;
      default:
        res.status(400).json({ error: `Unsupported entity type: ${item.entityType}` });
        return;
    }

    // Mark as restored
    await prisma.soft_deleted_items.update({
      where: { id },
      data: {
        restoredAt: new Date(),
        restoredBy: req.user?.userId || 'unknown',
      },
    });

    logger.info(`Entity restored: ${item.entityType} ${item.entityId} by ${req.user?.userId}`);
    res.json({
      message: 'Item restored successfully',
      restored,
    });
  } catch (error) {
    logger.error('Error restoring deleted item:', error);
    res.status(500).json({ error: 'Failed to restore item' });
  }
};

/**
 * Permanently delete an item (purge)
 * DELETE /api/trash/:id
 */
export const permanentlyDeleteItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const item = await prisma.soft_deleted_items.findUnique({
      where: { id },
    });

    if (!item) {
      res.status(404).json({ error: 'Deleted item not found' });
      return;
    }

    if (item.restoredAt) {
      res.status(400).json({ error: 'Cannot purge a restored item' });
      return;
    }

    // Mark as permanently deleted (keep the record for audit trail)
    await prisma.soft_deleted_items.update({
      where: { id },
      data: {
        permanentlyDeletedAt: new Date(),
        permanentlyDeletedBy: req.user?.userId || 'unknown',
      },
    });

    logger.info(`Entity permanently deleted: ${item.entityType} ${item.entityId} by ${req.user?.userId}`);
    res.json({ message: 'Item permanently deleted' });
  } catch (error) {
    logger.error('Error permanently deleting item:', error);
    res.status(500).json({ error: 'Failed to permanently delete item' });
  }
};

/**
 * Get trash statistics
 * GET /api/trash/stats
 */
export const getTrashStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const total = await prisma.soft_deleted_items.count({
      where: { permanentlyDeletedAt: null },
    });

    const canRestore = await prisma.soft_deleted_items.count({
      where: {
        canRestore: true,
        restoredAt: null,
        permanentlyDeletedAt: null,
      },
    });

    const restored = await prisma.soft_deleted_items.count({
      where: { restoredAt: { not: null } },
    });

    const purged = await prisma.soft_deleted_items.count({
      where: { permanentlyDeletedAt: { not: null } },
    });

    // Count by entity type
    const byType = await prisma.soft_deleted_items.groupBy({
      by: ['entityType'],
      where: { permanentlyDeletedAt: null },
      _count: true,
    });

    res.json({
      total,
      canRestore,
      restored,
      purged,
      byType: byType.map(item => ({
        type: item.entityType,
        count: item._count,
      })),
    });
  } catch (error) {
    logger.error('Error fetching trash stats:', error);
    res.status(500).json({ error: 'Failed to fetch trash stats' });
  }
};

// =============================================================================
// Helper functions for restoring specific entity types
// =============================================================================

async function restoreUser(userId: string, userData: any): Promise<any> {
  // Check if user already exists
  const existing = await prisma.users.findUnique({ where: { id: userId } });
  if (existing) {
    throw new Error('User already exists');
  }

  return await prisma.users.create({
    data: {
      id: userId,
      username: userData.username,
      email: userData.email,
      passwordHash: userData.passwordHash,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      isActive: true,
      updatedAt: new Date(),
    },
  });
}

async function restoreOrganization(orgId: string, orgData: any): Promise<any> {
  // Check if organization already exists
  const existing = await prisma.organizations.findUnique({ where: { id: orgId } });
  if (existing) {
    throw new Error('Organization already exists');
  }

  return await prisma.organizations.create({
    data: {
      id: orgId,
      code: orgData.code,
      name: orgData.name,
      description: orgData.description,
      isActive: true,
      updatedAt: new Date(),
    },
  });
}

async function restorePfaRecord(pfaId: string, pfaData: any): Promise<any> {
  // Check if PFA record already exists
  const existing = await prisma.pfa_records.findFirst({
    where: {
      organizationId: pfaData.organizationId,
      pfaId: pfaData.pfaId,
    },
  });
  if (existing) {
    throw new Error('PFA record already exists');
  }

  return await prisma.pfa_records.create({
    data: {
      id: pfaId,
      pfaId: pfaData.pfaId,
      organizationId: pfaData.organizationId,
      areaSilo: pfaData.areaSilo ?? null,
      category: pfaData.category ?? null,
      class: pfaData.class ?? null,
      source: pfaData.source ?? null,
      updatedAt: new Date(),
      // ... restore other fields as needed
    },
  });
}
