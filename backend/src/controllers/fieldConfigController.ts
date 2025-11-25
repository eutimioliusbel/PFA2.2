import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get all field configurations (optionally filtered by organization)
 */
export const getFieldConfigurations = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.query;

    const configs = await prisma.fieldConfiguration.findMany({
      where: organizationId ? { organizationId: organizationId as string } : {},
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.json(configs);
  } catch (error) {
    console.error('Error fetching field configurations:', error);
    res.status(500).json({ error: 'Failed to fetch field configurations' });
  }
};

/**
 * Get a single field configuration by ID
 */
export const getFieldConfiguration = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const config = await prisma.fieldConfiguration.findUnique({
      where: { id }
    });

    if (!config) {
      return res.status(404).json({ error: 'Field configuration not found' });
    }

    res.json(config);
  } catch (error) {
    console.error('Error fetching field configuration:', error);
    res.status(500).json({ error: 'Failed to fetch field configuration' });
  }
};

/**
 * Create a new field configuration
 */
export const createFieldConfiguration = async (req: Request, res: Response) => {
  try {
    const {
      organizationId,
      name,
      description,
      isDefault,
      fieldMappings,
      includeHeaders,
      dateFormat,
      delimiter,
      encoding
    } = req.body;

    // Validate required fields
    if (!name || !fieldMappings) {
      return res.status(400).json({ error: 'Name and field mappings are required' });
    }

    // Convert fieldMappings to JSON string if it's an object
    const fieldMappingsString = typeof fieldMappings === 'string'
      ? fieldMappings
      : JSON.stringify(fieldMappings);

    // If this is marked as default, unset other defaults for the same org
    if (isDefault) {
      await prisma.fieldConfiguration.updateMany({
        where: {
          organizationId: organizationId || null,
          isDefault: true
        },
        data: { isDefault: false }
      });
    }

    const config = await prisma.fieldConfiguration.create({
      data: {
        organizationId: organizationId || null,
        name,
        description: description || null,
        isDefault: isDefault || false,
        fieldMappings: fieldMappingsString,
        includeHeaders: includeHeaders !== undefined ? includeHeaders : true,
        dateFormat: dateFormat || 'YYYY-MM-DD',
        delimiter: delimiter || ',',
        encoding: encoding || 'UTF-8'
      }
    });

    res.status(201).json(config);
  } catch (error) {
    console.error('Error creating field configuration:', error);
    res.status(500).json({ error: 'Failed to create field configuration' });
  }
};

/**
 * Update an existing field configuration
 */
export const updateFieldConfiguration = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      isDefault,
      fieldMappings,
      includeHeaders,
      dateFormat,
      delimiter,
      encoding
    } = req.body;

    // Check if config exists
    const existing = await prisma.fieldConfiguration.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Field configuration not found' });
    }

    // If this is marked as default, unset other defaults for the same org
    if (isDefault) {
      await prisma.fieldConfiguration.updateMany({
        where: {
          organizationId: existing.organizationId,
          isDefault: true,
          id: { not: id }
        },
        data: { isDefault: false }
      });
    }

    // Convert fieldMappings to JSON string if it's an object
    const fieldMappingsString = fieldMappings && typeof fieldMappings !== 'string'
      ? JSON.stringify(fieldMappings)
      : fieldMappings;

    const config = await prisma.fieldConfiguration.update({
      where: { id },
      data: {
        name: name || existing.name,
        description: description !== undefined ? description : existing.description,
        isDefault: isDefault !== undefined ? isDefault : existing.isDefault,
        fieldMappings: fieldMappingsString || existing.fieldMappings,
        includeHeaders: includeHeaders !== undefined ? includeHeaders : existing.includeHeaders,
        dateFormat: dateFormat || existing.dateFormat,
        delimiter: delimiter || existing.delimiter,
        encoding: encoding || existing.encoding
      }
    });

    res.json(config);
  } catch (error) {
    console.error('Error updating field configuration:', error);
    res.status(500).json({ error: 'Failed to update field configuration' });
  }
};

/**
 * Delete a field configuration
 */
export const deleteFieldConfiguration = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const config = await prisma.fieldConfiguration.findUnique({
      where: { id }
    });

    if (!config) {
      return res.status(404).json({ error: 'Field configuration not found' });
    }

    await prisma.fieldConfiguration.delete({
      where: { id }
    });

    res.json({ message: 'Field configuration deleted successfully' });
  } catch (error) {
    console.error('Error deleting field configuration:', error);
    res.status(500).json({ error: 'Failed to delete field configuration' });
  }
};
