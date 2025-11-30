/**
 * System Dictionary Controller
 * ADR-005 Missing Components - System Dictionary Editor
 *
 * Handles dynamic dropdown options for future-proofing.
 */

import { Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { AuthRequest } from '../types/auth';
import { randomUUID } from 'crypto';

/**
 * Get all dictionary categories
 * GET /api/dictionary/categories
 */
export const getCategories = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categories = await prisma.system_dictionary_entries.findMany({
      select: {
        category: true,
      },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    const categoryList = categories.map(c => c.category);
    res.json(categoryList);
  } catch (error) {
    logger.error('Error fetching dictionary categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

/**
 * Get all entries for a specific category
 * GET /api/dictionary/:category
 */
export const getEntriesByCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category } = req.params;
    const { includeInactive } = req.query;

    const where: { category: string; isActive?: boolean } = { category };
    if (!includeInactive) {
      where.isActive = true;
    }

    const entries = await prisma.system_dictionary_entries.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { label: 'asc' },
      ],
    });

    res.json(entries);
  } catch (error) {
    logger.error('Error fetching dictionary entries:', error);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
};

/**
 * Get a single dictionary entry by ID
 * GET /api/dictionary/entry/:id
 */
export const getEntryById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const entry = await prisma.system_dictionary_entries.findUnique({
      where: { id },
    });

    if (!entry) {
      res.status(404).json({ error: 'Dictionary entry not found' });
      return;
    }

    res.json(entry);
  } catch (error) {
    logger.error('Error fetching dictionary entry:', error);
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
};

/**
 * Create a new dictionary entry
 * POST /api/dictionary
 */
export const createEntry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const {
      category,
      value,
      label,
      sortOrder,
      metadata,
    } = req.body;

    if (!category || !value || !label) {
      res.status(400).json({
        error: 'Category, value, and label are required',
      });
      return;
    }

    // Check for duplicate
    const existing = await prisma.system_dictionary_entries.findUnique({
      where: {
        category_value: { category, value },
      },
    });

    if (existing) {
      res.status(400).json({
        error: 'Entry with this category and value already exists',
      });
      return;
    }

    const entry = await prisma.system_dictionary_entries.create({
      data: {
        id: randomUUID(),
        category,
        value,
        label,
        sortOrder: sortOrder ?? 0,
        metadata: metadata ?? null,
        createdBy: userId ?? 'system',
        updatedAt: new Date(),
      },
    });

    logger.info(`Dictionary entry created: ${category}.${value} by ${userId ?? 'unknown'}`);
    res.status(201).json(entry);
  } catch (error) {
    logger.error('Error creating dictionary entry:', error);
    res.status(500).json({ error: 'Failed to create entry' });
  }
};

/**
 * Update a dictionary entry
 * PUT /api/dictionary/:id
 */
export const updateEntry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      label,
      sortOrder,
      isActive,
      metadata,
    } = req.body;

    const existing = await prisma.system_dictionary_entries.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ error: 'Dictionary entry not found' });
      return;
    }

    const updated = await prisma.system_dictionary_entries.update({
      where: { id },
      data: {
        label: label ?? existing.label,
        sortOrder: sortOrder ?? existing.sortOrder,
        isActive: isActive ?? existing.isActive,
        metadata: metadata !== undefined ? metadata : existing.metadata,
      },
    });

    logger.info(`Dictionary entry updated: ${updated.category}.${updated.value}`);
    res.json(updated);
  } catch (error) {
    logger.error('Error updating dictionary entry:', error);
    res.status(500).json({ error: 'Failed to update entry' });
  }
};

/**
 * Delete a dictionary entry
 * DELETE /api/dictionary/:id
 */
export const deleteEntry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const entry = await prisma.system_dictionary_entries.findUnique({
      where: { id },
    });

    if (!entry) {
      res.status(404).json({ error: 'Dictionary entry not found' });
      return;
    }

    await prisma.system_dictionary_entries.delete({
      where: { id },
    });

    logger.info(`Dictionary entry deleted: ${entry.category}.${entry.value}`);
    res.json({ message: 'Dictionary entry deleted successfully' });
  } catch (error) {
    logger.error('Error deleting dictionary entry:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
};

/**
 * Reorder entries within a category
 * POST /api/dictionary/:category/reorder
 */
export const reorderEntries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category } = req.params;
    const { orderedIds } = req.body; // Array of IDs in new order

    if (!Array.isArray(orderedIds)) {
      res.status(400).json({ error: 'orderedIds must be an array' });
      return;
    }

    // Update each entry's sortOrder
    const promises = orderedIds.map((id: string, index: number) =>
      prisma.system_dictionary_entries.updateMany({
        where: {
          id,
          category, // Ensure entry belongs to this category
        },
        data: {
          sortOrder: index,
        },
      })
    );

    await Promise.all(promises);

    logger.info(`Reordered ${orderedIds.length} entries in category ${category}`);
    res.json({ message: 'Entries reordered successfully' });
  } catch (error) {
    logger.error('Error reordering dictionary entries:', error);
    res.status(500).json({ error: 'Failed to reorder entries' });
  }
};

/**
 * Bulk create entries from CSV import
 * POST /api/dictionary/bulk-import
 */
export const bulkImportEntries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { entries } = req.body; // Array of {category, value, label, sortOrder?, metadata?}

    if (!Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ error: 'Entries array is required' });
      return;
    }

    // Validate all entries
    for (const entry of entries) {
      if (!entry.category || !entry.value || !entry.label) {
        res.status(400).json({
          error: 'Each entry must have category, value, and label',
        });
        return;
      }
    }

    // Create entries
    const created = await prisma.system_dictionary_entries.createMany({
      data: entries.map((entry: { category: string; value: string; label: string; sortOrder?: number; metadata?: any }) => ({
        id: randomUUID(),
        category: entry.category,
        value: entry.value,
        label: entry.label,
        sortOrder: entry.sortOrder ?? 0,
        metadata: entry.metadata ?? null,
        createdBy: userId ?? 'system',
        updatedAt: new Date(),
      })),
      skipDuplicates: true, // Skip existing category/value pairs
    });

    logger.info(`Bulk imported ${created.count} dictionary entries by ${userId ?? 'unknown'}`);
    res.status(201).json({
      message: `Successfully imported ${created.count} entries`,
      count: created.count,
    });
  } catch (error) {
    logger.error('Error bulk importing dictionary entries:', error);
    res.status(500).json({ error: 'Failed to bulk import entries' });
  }
};
