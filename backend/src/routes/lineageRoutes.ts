/**
 * Data Lineage Routes - ADR-007
 *
 * Provides API endpoints for tracing Bronze -> Silver data transformations.
 * Supports the Bronze Inspector UI and Data Lineage Explorer features.
 *
 * @see ADR-007-AGENT_WORKFLOW.md Task 3.4
 */

import express, { Request, Response, Router } from 'express';
import { requirePermission } from '../middleware/requirePermission';
import prisma from '../config/database';
import { logger } from '../utils/logger';

const router: Router = express.Router();

/**
 * GET /api/lineage/:silverRecordId
 * Get complete lineage for a Silver record (trace back to Bronze source)
 *
 * Returns:
 * - Silver record data
 * - Bronze source data (raw JSON)
 * - Transformation context (mapping rules at time of transformation)
 * - Batch context (ingestion metadata)
 */
router.get(
  '/api/lineage/:silverRecordId',
  requirePermission('perm_Read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { silverRecordId } = req.params;

      const lineage = await prisma.data_lineage.findUnique({
        where: { silverRecordId },
        include: {
          bronze_records: true,
          pfa_records: true
        }
      });

      if (!lineage) {
        res.status(404).json({
          success: false,
          error: 'Lineage not found for this record'
        });
        return;
      }

      // Get batch metadata
      const batch = await prisma.bronze_batches.findFirst({
        where: { syncBatchId: lineage.bronze_records.syncBatchId }
      });

      // Get endpoint info for context
      let endpointInfo = null;
      if (batch) {
        const endpoint = await prisma.api_endpoints.findUnique({
          where: { id: batch.endpointId },
          include: {
            api_servers: true
          }
        });
        if (endpoint) {
          endpointInfo = {
            name: endpoint.name,
            path: endpoint.path,
            serverName: endpoint.api_servers.name
          };
        }
      }

      res.json({
        success: true,
        lineage: {
          // Silver Layer (transformed data)
          silver: lineage.pfa_records,

          // Bronze Layer (raw source data)
          bronze: {
            id: lineage.bronze_records.id,
            rawJson: lineage.bronze_records.rawJson,
            ingestedAt: lineage.bronze_records.ingestedAt,
            schemaVersion: lineage.bronze_records.schemaVersion,
            entityType: lineage.bronze_records.entityType
          },

          // Transformation Context (mapping rules at transform time)
          transformation: {
            transformedAt: lineage.transformedAt,
            transformedBy: lineage.transformedBy,
            mappingRulesSnapshot: lineage.mappingRules
          },

          // Batch Context (ingestion metadata)
          batch: batch ? {
            syncBatchId: batch.syncBatchId,
            ingestedAt: batch.ingestedAt,
            completedAt: batch.completedAt,
            recordCount: batch.recordCount,
            syncType: batch.syncType,
            endpoint: endpointInfo,
            schemaFingerprint: batch.schemaFingerprint
          } : null
        }
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[LINEAGE] Failed to get lineage`, {
        silverRecordId: req.params.silverRecordId,
        error: errorMsg
      });

      res.status(500).json({
        success: false,
        error: errorMsg
      });
    }
  }
);

/**
 * GET /api/bronze/batches
 * List all Bronze batches for an organization with pagination
 *
 * Query params:
 * - organizationId: Required organization filter
 * - limit: Number of batches (default 20)
 * - offset: Skip batches (default 0)
 * - entityType: Filter by entity type (optional)
 */
router.get(
  '/api/bronze/batches',
  requirePermission('perm_Read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const organizationId = req.query.organizationId as string || user.organizationId;
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const offset = Number(req.query.offset) || 0;
      const entityType = req.query.entityType as string;

      const where = {
        organizationId,
        ...(entityType ? { entityType } : {})
      };

      const [batches, total] = await Promise.all([
        prisma.bronze_batches.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { ingestedAt: 'desc' }
        }),
        prisma.bronze_batches.count({ where })
      ]);

      // Get endpoint names for each batch
      const endpointIds = [...new Set(batches.map(b => b.endpointId))];
      const endpoints = await prisma.api_endpoints.findMany({
        where: { id: { in: endpointIds } },
        include: { api_servers: true }
      });
      const endpointMap = new Map(endpoints.map(e => [e.id, e]));

      const enrichedBatches = batches.map(batch => {
        const endpoint = endpointMap.get(batch.endpointId);
        return {
          ...batch,
          endpointName: endpoint?.name || 'Unknown',
          serverName: endpoint?.api_servers?.name || 'Unknown'
        };
      });

      res.json({
        success: true,
        batches: enrichedBatches,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + batches.length < total
        }
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[LINEAGE] Failed to list batches`, { error: errorMsg });

      res.status(500).json({
        success: false,
        error: errorMsg
      });
    }
  }
);

/**
 * GET /api/bronze/batches/:batchId/records
 * Get Bronze records for a specific batch (Bronze Inspector)
 *
 * Query params:
 * - limit: Number of records (default 100, max 1000)
 * - offset: Skip records (default 0)
 * - search: Search within rawJson (optional)
 */
router.get(
  '/api/bronze/batches/:batchId/records',
  requirePermission('perm_Read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { batchId } = req.params;
      const limit = Math.min(Number(req.query.limit) || 100, 1000);
      const offset = Number(req.query.offset) || 0;

      // Get batch first to verify it exists
      const batch = await prisma.bronze_batches.findFirst({
        where: { syncBatchId: batchId }
      });

      if (!batch) {
        res.status(404).json({
          success: false,
          error: 'Batch not found'
        });
        return;
      }

      // Get endpoint and server info
      const endpoint = await prisma.api_endpoints.findUnique({
        where: { id: batch.endpointId },
        include: { api_servers: true }
      });

      // Get records
      const [records, total] = await Promise.all([
        prisma.bronze_records.findMany({
          where: { syncBatchId: batchId },
          take: limit,
          skip: offset,
          orderBy: { ingestedAt: 'asc' }
        }),
        prisma.bronze_records.count({ where: { syncBatchId: batchId } })
      ]);

      res.json({
        success: true,
        batch: {
          syncBatchId: batch.syncBatchId,
          organizationId: batch.organizationId,
          entityType: batch.entityType,
          ingestedAt: batch.ingestedAt,
          completedAt: batch.completedAt,
          recordCount: batch.recordCount,
          syncType: batch.syncType,
          schemaFingerprint: batch.schemaFingerprint,
          warnings: batch.warnings,
          errors: batch.errors,
          serverName: endpoint?.api_servers?.name || 'Unknown',
          endpointName: endpoint?.name || 'Unknown',
          endpointPath: endpoint?.path || 'Unknown'
        },
        records: records.map(r => ({
          id: r.id,
          rawJson: r.rawJson,
          ingestedAt: r.ingestedAt,
          schemaVersion: r.schemaVersion
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + records.length < total
        }
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[LINEAGE] Failed to get batch records`, {
        batchId: req.params.batchId,
        error: errorMsg
      });

      res.status(500).json({
        success: false,
        error: errorMsg
      });
    }
  }
);

/**
 * GET /api/bronze/preview/:endpointId
 * Get sample Bronze data from most recent batch for an endpoint
 * Used by Mapping Studio to preview source fields
 */
router.get(
  '/api/bronze/preview/:endpointId',
  requirePermission('perm_Read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { endpointId } = req.params;
      const limit = Math.min(Number(req.query.limit) || 10, 100);

      // Get most recent completed batch for this endpoint
      const latestBatch = await prisma.bronze_batches.findFirst({
        where: {
          endpointId,
          completedAt: { not: null }
        },
        orderBy: { ingestedAt: 'desc' }
      });

      if (!latestBatch) {
        res.status(404).json({
          success: false,
          error: 'No synced data found for this endpoint'
        });
        return;
      }

      // Get sample records
      const records = await prisma.bronze_records.findMany({
        where: { syncBatchId: latestBatch.syncBatchId },
        take: limit,
        orderBy: { ingestedAt: 'asc' }
      });

      // Extract field names from sample
      const fieldSet = new Set<string>();
      records.forEach(r => {
        const json = r.rawJson as Record<string, unknown>;
        Object.keys(json).forEach(key => fieldSet.add(key));
      });

      res.json({
        success: true,
        batchId: latestBatch.syncBatchId,
        batchDate: latestBatch.ingestedAt,
        fields: Array.from(fieldSet).sort(),
        schemaFingerprint: latestBatch.schemaFingerprint,
        sample: records.map(r => r.rawJson),
        totalRecords: latestBatch.recordCount
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[LINEAGE] Failed to get Bronze preview`, {
        endpointId: req.params.endpointId,
        error: errorMsg
      });

      res.status(500).json({
        success: false,
        error: errorMsg
      });
    }
  }
);

/**
 * GET /api/sync/orphans/:organizationId
 * Get orphaned records (records flagged as discontinued due to missing in source)
 */
router.get(
  '/api/sync/orphans/:organizationId',
  requirePermission('perm_Read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const offset = Number(req.query.offset) || 0;

      const [orphans, total] = await Promise.all([
        prisma.pfa_records.findMany({
          where: {
            organizationId,
            isDiscontinued: true
          },
          select: {
            id: true,
            pfaId: true,
            category: true,
            class: true,
            source: true,
            monthlyRate: true,
            forecastStart: true,
            forecastEnd: true,
            lastSeenAt: true,
            updatedAt: true
          },
          take: limit,
          skip: offset,
          orderBy: { lastSeenAt: 'desc' }
        }),
        prisma.pfa_records.count({
          where: {
            organizationId,
            isDiscontinued: true
          }
        })
      ]);

      res.json({
        success: true,
        orphans,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + orphans.length < total
        }
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[LINEAGE] Failed to get orphans`, {
        organizationId: req.params.organizationId,
        error: errorMsg
      });

      res.status(500).json({
        success: false,
        error: errorMsg
      });
    }
  }
);

/**
 * POST /api/sync/orphans/:organizationId/restore
 * Restore orphaned records (mark as not discontinued)
 *
 * Body: { recordIds: string[] }
 */
router.post(
  '/api/sync/orphans/:organizationId/restore',
  requirePermission('perm_EditForecast'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const { recordIds } = req.body as { recordIds: string[] };

      if (!Array.isArray(recordIds) || recordIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'recordIds array required'
        });
        return;
      }

      const result = await prisma.pfa_records.updateMany({
        where: {
          id: { in: recordIds },
          organizationId,
          isDiscontinued: true
        },
        data: {
          isDiscontinued: false,
          lastSeenAt: new Date()
        }
      });

      logger.info(`[LINEAGE] Restored orphaned records`, {
        organizationId,
        restoredCount: result.count
      });

      res.json({
        success: true,
        restoredCount: result.count
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[LINEAGE] Failed to restore orphans`, {
        organizationId: req.params.organizationId,
        error: errorMsg
      });

      res.status(500).json({
        success: false,
        error: errorMsg
      });
    }
  }
);

export default router;
