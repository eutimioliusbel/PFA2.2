/**
 * Data Source Mapping Controller
 *
 * REST API endpoints for managing data source mappings
 */

import { Request, Response } from 'express';
import { DataSourceOrchestrator } from '../services/DataSourceOrchestrator';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
const orchestrator = new DataSourceOrchestrator();

/**
 * GET /api/data-sources/mappings
 * Get all data source mappings
 */
export const getAllMappings = async (req: Request, res: Response) => {
  try {
    const { organizationId, entityType } = req.query;

    const mappings = await prisma.dataSourceMapping.findMany({
      where: {
        ...(organizationId ? { organizationId: organizationId as string } : {}),
        ...(entityType ? { entityType: entityType as string } : {})
      },
      include: {
        apiConfig: {
          select: {
            id: true,
            name: true,
            url: true,
            status: true
          }
        }
      },
      orderBy: [
        { entityType: 'asc' },
        { organizationId: 'asc' },
        { priority: 'asc' }
      ]
    });

    res.json(mappings);
  } catch (error) {
    logger.error('Error fetching data source mappings:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to fetch data source mappings'
    });
  }
};

/**
 * GET /api/data-sources/mappings/:id
 * Get a specific data source mapping
 */
export const getMapping = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const mapping = await prisma.dataSourceMapping.findUnique({
      where: { id },
      include: {
        apiConfig: true
      }
    });

    if (!mapping) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Data source mapping not found'
      });
    }

    res.json(mapping);
  } catch (error) {
    logger.error('Error fetching data source mapping:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to fetch data source mapping'
    });
  }
};

/**
 * GET /api/data-sources/mappings/:id/metrics
 * Get performance metrics for a mapping
 */
export const getMappingMetrics = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const metrics = await orchestrator.getMappingMetrics(id);

    if (!metrics) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Mapping not found'
      });
    }

    res.json(metrics);
  } catch (error) {
    logger.error('Error fetching mapping metrics:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to fetch mapping metrics'
    });
  }
};

/**
 * POST /api/data-sources/mappings
 * Create a new data source mapping
 */
export const createMapping = async (req: Request, res: Response) => {
  try {
    const {
      entityType,
      organizationId,
      apiConfigId,
      priority,
      isActive
    } = req.body;

    // Validation
    if (!entityType || !apiConfigId) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'entityType and apiConfigId are required'
      });
    }

    // Check if API config exists
    const apiConfig = await prisma.apiConfiguration.findUnique({
      where: { id: apiConfigId }
    });

    if (!apiConfig) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'API configuration not found'
      });
    }

    // Check for existing mapping with same priority
    const existing = await prisma.dataSourceMapping.findFirst({
      where: {
        entityType,
        organizationId: organizationId || null,
        priority: priority || 1
      }
    });

    if (existing) {
      return res.status(409).json({
        error: 'DUPLICATE_PRIORITY',
        message: `A mapping already exists for ${entityType} at priority ${priority || 1}`
      });
    }

    // Create mapping
    const mapping = await prisma.dataSourceMapping.create({
      data: {
        entityType,
        organizationId: organizationId || null,
        apiConfigId,
        priority: priority || 1,
        isActive: isActive !== undefined ? isActive : true
      },
      include: {
        apiConfig: true
      }
    });

    logger.info(`Created data source mapping: ${entityType} -> ${apiConfig.name} (priority ${mapping.priority})`);

    res.status(201).json(mapping);
  } catch (error) {
    logger.error('Error creating data source mapping:', error);
    res.status(500).json({
      error: 'CREATE_FAILED',
      message: 'Failed to create data source mapping'
    });
  }
};

/**
 * PATCH /api/data-sources/mappings/:id
 * Update a data source mapping
 */
export const updateMapping = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      priority,
      isActive,
      apiConfigId
    } = req.body;

    // Check if mapping exists
    const existing = await prisma.dataSourceMapping.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Data source mapping not found'
      });
    }

    // If changing priority, check for conflicts
    if (priority !== undefined && priority !== existing.priority) {
      const conflict = await prisma.dataSourceMapping.findFirst({
        where: {
          entityType: existing.entityType,
          organizationId: existing.organizationId,
          priority,
          id: { not: id }
        }
      });

      if (conflict) {
        return res.status(409).json({
          error: 'DUPLICATE_PRIORITY',
          message: `Another mapping already exists at priority ${priority}`
        });
      }
    }

    // Update mapping
    const mapping = await prisma.dataSourceMapping.update({
      where: { id },
      data: {
        ...(priority !== undefined ? { priority } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(apiConfigId ? { apiConfigId } : {})
      },
      include: {
        apiConfig: true
      }
    });

    logger.info(`Updated data source mapping: ${mapping.id}`);

    res.json(mapping);
  } catch (error) {
    logger.error('Error updating data source mapping:', error);
    res.status(500).json({
      error: 'UPDATE_FAILED',
      message: 'Failed to update data source mapping'
    });
  }
};

/**
 * DELETE /api/data-sources/mappings/:id
 * Delete a data source mapping
 */
export const deleteMapping = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if mapping exists
    const existing = await prisma.dataSourceMapping.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Data source mapping not found'
      });
    }

    // Delete mapping
    await prisma.dataSourceMapping.delete({
      where: { id }
    });

    logger.info(`Deleted data source mapping: ${id} (${existing.entityType})`);

    res.json({
      success: true,
      message: 'Data source mapping deleted'
    });
  } catch (error) {
    logger.error('Error deleting data source mapping:', error);
    res.status(500).json({
      error: 'DELETE_FAILED',
      message: 'Failed to delete data source mapping'
    });
  }
};

/**
 * GET /api/data-sources/entity-types/:entityType/active
 * Get the active data source for an entity type
 */
export const getActiveDataSource = async (req: Request, res: Response) => {
  try {
    const { entityType } = req.params;
    const { organizationId } = req.query;

    const dataSource = await orchestrator.getActiveDataSource(
      entityType,
      organizationId as string | undefined
    );

    if (!dataSource) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: `No active data source configured for ${entityType}`
      });
    }

    res.json(dataSource);
  } catch (error) {
    logger.error('Error getting active data source:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get active data source'
    });
  }
};

/**
 * GET /api/data-sources/entity-types/:entityType/mappings
 * Get all mappings for an entity type
 */
export const getMappingsForEntity = async (req: Request, res: Response) => {
  try {
    const { entityType } = req.params;
    const { organizationId } = req.query;

    const mappings = await orchestrator.getMappingsForEntity(
      entityType,
      organizationId as string | undefined
    );

    res.json(mappings);
  } catch (error) {
    logger.error('Error getting mappings for entity:', error);
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: 'Failed to get mappings for entity'
    });
  }
};

/**
 * POST /api/data-sources/sync
 * Test endpoint to sync data for an entity type through the orchestrator
 */
export const syncEntityData = async (req: Request, res: Response) => {
  try {
    const { entityType, organizationId, syncType = 'full' } = req.body;

    if (!entityType || !organizationId) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'entityType and organizationId are required'
      });
    }

    logger.info(`Starting sync for entity type: ${entityType}, org: ${organizationId}`);

    // Execute sync through orchestrator
    const result = await orchestrator.executeSync(
      entityType,
      organizationId,
      syncType
    );

    res.json({
      success: result.status === 'completed',
      syncId: result.syncId,
      message: `Sync ${result.status}`,
      result
    });
  } catch (error) {
    logger.error('Error syncing entity data:', error);
    res.status(500).json({
      error: 'SYNC_FAILED',
      message: error instanceof Error ? error.message : 'Sync failed'
    });
  }
};
