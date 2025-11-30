/**
 * Field Mapping Routes
 *
 * CRUD operations for api_field_mappings table.
 * Used by MappingStudio UI to configure PEMS -> PFA field transformations.
 */

import { Router, Request, Response } from 'express';
import { requirePermissionGlobal } from '../middleware/requirePermission';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';
import { getDefaultPfaMappings, createMappingsForEndpoint } from '../services/FieldMappingService';

const router = Router();

/**
 * GET /api/field-mappings/endpoint/:endpointId
 * Get all field mappings for an endpoint
 */
router.get(
  '/api/field-mappings/endpoint/:endpointId',
  requirePermissionGlobal('perm_Read'),
  async (req: Request, res: Response) => {
    try {
      const { endpointId } = req.params;

      const mappings = await prisma.api_field_mappings.findMany({
        where: { endpointId },
        orderBy: { destinationField: 'asc' }
      });

      res.json({
        success: true,
        mappings,
        count: mappings.length
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[FIELD_MAPPING] Failed to get mappings', { error: errorMsg });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: errorMsg
      });
    }
  }
);

/**
 * GET /api/field-mappings/defaults
 * Get default PFA field mappings (for new endpoints)
 */
router.get(
  '/api/field-mappings/defaults',
  requirePermissionGlobal('perm_Read'),
  async (_req: Request, res: Response) => {
    try {
      const defaults = getDefaultPfaMappings();

      res.json({
        success: true,
        mappings: defaults
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[FIELD_MAPPING] Failed to get defaults', { error: errorMsg });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: errorMsg
      });
    }
  }
);

/**
 * POST /api/field-mappings/endpoint/:endpointId/initialize
 * Initialize default mappings for an endpoint
 */
router.post(
  '/api/field-mappings/endpoint/:endpointId/initialize',
  requirePermissionGlobal('perm_ManageSettings'),
  async (req: Request, res: Response) => {
    try {
      const { endpointId } = req.params;
      const user = (req as any).user;

      // Check endpoint exists
      const endpoint = await prisma.api_endpoints.findUnique({
        where: { id: endpointId }
      });

      if (!endpoint) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Endpoint not found'
        });
      }

      const created = await createMappingsForEndpoint(endpointId, user.id);

      logger.info('[FIELD_MAPPING] Initialized mappings', {
        endpointId,
        created,
        userId: user.id
      });

      return res.status(201).json({
        success: true,
        created,
        message: `Created ${created} field mappings for endpoint`
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[FIELD_MAPPING] Failed to initialize', { error: errorMsg });

      return res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: errorMsg
      });
    }
  }
);

/**
 * POST /api/field-mappings
 * Create a new field mapping
 */
router.post(
  '/api/field-mappings',
  requirePermissionGlobal('perm_ManageSettings'),
  async (req: Request, res: Response) => {
    try {
      const {
        endpointId,
        sourceField,
        destinationField,
        dataType = 'string',
        transformType = 'direct',
        transformParams = {},
        defaultValue = null
      } = req.body;
      const user = (req as any).user;

      if (!endpointId || !sourceField || !destinationField) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'endpointId, sourceField, and destinationField are required'
        });
      }

      const mapping = await prisma.api_field_mappings.create({
        data: {
          id: `afm_${randomUUID()}`,
          endpointId,
          sourceField,
          destinationField,
          dataType,
          transformType,
          transformParams,
          defaultValue,
          isActive: true,
          validFrom: new Date(),
          createdBy: user.id,
          updatedAt: new Date()
        }
      });

      logger.info('[FIELD_MAPPING] Created mapping', {
        mappingId: mapping.id,
        sourceField,
        destinationField,
        userId: user.id
      });

      return res.status(201).json({
        success: true,
        mapping
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[FIELD_MAPPING] Failed to create', { error: errorMsg });

      return res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: errorMsg
      });
    }
  }
);

/**
 * PUT /api/field-mappings/:id
 * Update a field mapping
 */
router.put(
  '/api/field-mappings/:id',
  requirePermissionGlobal('perm_ManageSettings'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        sourceField,
        destinationField,
        dataType,
        transformType,
        transformParams,
        defaultValue,
        isActive
      } = req.body;

      const mapping = await prisma.api_field_mappings.update({
        where: { id },
        data: {
          ...(sourceField && { sourceField }),
          ...(destinationField && { destinationField }),
          ...(dataType && { dataType }),
          ...(transformType !== undefined && { transformType }),
          ...(transformParams !== undefined && { transformParams }),
          ...(defaultValue !== undefined && { defaultValue }),
          ...(isActive !== undefined && { isActive }),
          updatedAt: new Date()
        }
      });

      logger.info('[FIELD_MAPPING] Updated mapping', {
        mappingId: id,
        changes: Object.keys(req.body)
      });

      res.json({
        success: true,
        mapping
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[FIELD_MAPPING] Failed to update', { error: errorMsg });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: errorMsg
      });
    }
  }
);

/**
 * DELETE /api/field-mappings/:id
 * Delete a field mapping
 */
router.delete(
  '/api/field-mappings/:id',
  requirePermissionGlobal('perm_ManageSettings'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      await prisma.api_field_mappings.delete({
        where: { id }
      });

      logger.info('[FIELD_MAPPING] Deleted mapping', { mappingId: id });

      res.json({
        success: true,
        message: 'Mapping deleted'
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[FIELD_MAPPING] Failed to delete', { error: errorMsg });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: errorMsg
      });
    }
  }
);

/**
 * POST /api/field-mappings/bulk
 * Bulk create/update field mappings for an endpoint
 */
router.post(
  '/api/field-mappings/bulk',
  requirePermissionGlobal('perm_ManageSettings'),
  async (req: Request, res: Response) => {
    try {
      const { endpointId, mappings } = req.body;
      const user = (req as any).user;

      if (!endpointId || !Array.isArray(mappings)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'endpointId and mappings array required'
        });
      }

      let created = 0;
      let updated = 0;

      for (const m of mappings) {
        const mappingId = m.id || `afm_${endpointId}_${m.sourceField}_${m.destinationField}`.substring(0, 64);

        try {
          await prisma.api_field_mappings.upsert({
            where: {
              endpointId_sourceField_destinationField: {
                endpointId,
                sourceField: m.sourceField,
                destinationField: m.destinationField
              }
            },
            update: {
              dataType: m.dataType || 'string',
              transformType: m.transformType || 'direct',
              transformParams: m.transformParams || {},
              defaultValue: m.defaultValue,
              isActive: m.isActive !== false,
              updatedAt: new Date()
            },
            create: {
              id: mappingId,
              endpointId,
              sourceField: m.sourceField,
              destinationField: m.destinationField,
              dataType: m.dataType || 'string',
              transformType: m.transformType || 'direct',
              transformParams: m.transformParams || {},
              defaultValue: m.defaultValue,
              isActive: true,
              validFrom: new Date(),
              createdBy: user.id,
              updatedAt: new Date()
            }
          });

          if (m.id) {
            updated++;
          } else {
            created++;
          }
        } catch (err) {
          logger.warn(`Failed to upsert mapping ${m.sourceField}:`, err);
        }
      }

      logger.info('[FIELD_MAPPING] Bulk operation complete', {
        endpointId,
        created,
        updated,
        userId: user.id
      });

      return res.json({
        success: true,
        created,
        updated,
        total: created + updated
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[FIELD_MAPPING] Bulk operation failed', { error: errorMsg });

      return res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: errorMsg
      });
    }
  }
);

export default router;
