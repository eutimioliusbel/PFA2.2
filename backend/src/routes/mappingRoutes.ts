/**
 * @file mappingRoutes.ts
 * @description API Field Mapping routes - ADR-007 Task 5.2
 * Endpoints for Mapping Studio drag-and-drop configuration
 */

import { Router, Request, Response } from 'express';
import { requirePermissionGlobal } from '../middleware/requirePermission';
import prisma from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/mappings/preview
 * Preview field mapping transformation on sample Bronze data
 *
 * Body:
 * - endpointId: string - Endpoint to preview
 * - mappings: Array<{ sourceField, destinationField, transformType, transformParams? }>
 */
router.post(
  '/api/mappings/preview',
  requirePermissionGlobal('perm_Read'),
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { endpointId, mappings } = req.body;

      if (!endpointId || !mappings || !Array.isArray(mappings)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'endpointId and mappings array required'
        });
      }

      // Get sample Bronze records
      const latestBatch = await prisma.bronze_batches.findFirst({
        where: {
          endpointId,
          completedAt: { not: null }
        },
        orderBy: { ingestedAt: 'desc' }
      });

      if (!latestBatch) {
        return res.status(404).json({
          success: false,
          error: 'NO_DATA',
          message: 'No synced data found for this endpoint. Run ingestion first.'
        });
      }

      const bronzeRecords = await prisma.bronze_records.findMany({
        where: { syncBatchId: latestBatch.syncBatchId },
        take: 5,
        orderBy: { ingestedAt: 'asc' }
      });

      // Apply mappings to sample data
      const mappedData = bronzeRecords.map((record: any) => {
        const raw = record.rawJson as Record<string, any>;
        const mapped: Record<string, any> = { _bronzeId: record.id };

        mappings.forEach((mapping: any) => {
          const { sourceField, destinationField, transformType } = mapping;

          if (raw[sourceField] !== undefined) {
            // Apply transformation (simple preview - for full transforms see PemsTransformationService)
            try {
              const value = raw[sourceField];
              // Direct mapping for preview (real transforms happen in Silver layer)
              if (transformType === 'direct' || !transformType) {
                mapped[destinationField] = value;
              } else {
                // For preview, show the transform type that will be applied
                mapped[destinationField] = `[Will apply ${transformType}: ${value}]`;
              }
            } catch (error) {
              mapped[destinationField] = `[Transform Error: ${error instanceof Error ? error.message : 'Unknown'}]`;
            }
          } else {
            mapped[destinationField] = null;
          }
        });

        return {
          original: raw,
          mapped
        };
      });

      res.json({
        success: true,
        batchId: latestBatch.syncBatchId,
        recordCount: mappedData.length,
        preview: mappedData
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[MAPPING_PREVIEW] Preview failed', { error: errorMsg });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: errorMsg
      });
    }
  }
);

/**
 * POST /api/mappings/bulk
 * Save multiple field mappings for an endpoint
 *
 * Body:
 * - endpointId: string - Target endpoint
 * - mappings: Array<{sourceField, destinationField, dataType?, transformType?, transformParams?, defaultValue?}>
 */
router.post(
  '/api/mappings/bulk',
  requirePermissionGlobal('perm_ManageSettings'),
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { endpointId, mappings } = req.body;
      const user = (req as any).user;

      if (!endpointId || !mappings || !Array.isArray(mappings)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'endpointId and mappings array required'
        });
      }

      // Verify endpoint exists
      const endpoint = await prisma.api_endpoints.findUnique({
        where: { id: endpointId }
      });

      if (!endpoint) {
        return res.status(404).json({
          success: false,
          error: 'ENDPOINT_NOT_FOUND',
          message: `Endpoint ${endpointId} not found`
        });
      }

      // Delete existing mappings for this endpoint
      await prisma.api_field_mappings.deleteMany({
        where: { endpointId }
      });

      // Insert new mappings
      const createdMappings = await Promise.all(
        mappings.map((mapping: any) => {
          const mappingId = `${endpointId}_${mapping.sourceField}_${mapping.destinationField}_${Date.now()}`;
          return prisma.api_field_mappings.create({
            data: {
              id: mappingId,
              endpointId,
              sourceField: mapping.sourceField,
              destinationField: mapping.destinationField,
              dataType: mapping.dataType || 'string',
              transformType: mapping.transformType || 'direct',
              transformParams: mapping.transformParams || {},
              defaultValue: mapping.defaultValue,
              updatedAt: new Date(),
              createdBy: user.id
            }
          });
        })
      );

      logger.info('[MAPPING_BULK] Mappings saved', {
        endpointId,
        count: createdMappings.length,
        userId: user.id
      });

      res.status(201).json({
        success: true,
        message: `${createdMappings.length} mappings saved`,
        mappings: createdMappings
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[MAPPING_BULK] Bulk save failed', { error: errorMsg });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: errorMsg
      });
    }
  }
);

/**
 * GET /api/mappings/:endpointId
 * Get existing field mappings for an endpoint
 */
router.get(
  '/api/mappings/:endpointId',
  requirePermissionGlobal('perm_Read'),
  async (req: Request, res: Response) => {
    try {
      const { endpointId } = req.params;

      const mappings = await prisma.api_field_mappings.findMany({
        where: {
          endpointId,
          isActive: true
        },
        orderBy: { createdAt: 'asc' }
      });

      res.json({
        success: true,
        endpointId,
        count: mappings.length,
        mappings
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[MAPPING_GET] Get mappings failed', { error: errorMsg });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: errorMsg
      });
    }
  }
);

export default router;
