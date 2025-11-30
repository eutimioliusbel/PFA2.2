/**
 * Bronze Layer Ingestion Controller (ADR-007 Phase 2)
 *
 * REST API endpoints for triggering PEMS data ingestion to Bronze layer.
 * Uses PemsIngestionService for "dumb courier" pattern (no transformation).
 *
 * Endpoints:
 * - POST /api/ingestion/ingest - Trigger ingestion for an endpoint
 * - GET /api/ingestion/:batchId/progress - Get real-time progress
 * - GET /api/ingestion/:batchId/status - Get batch status
 * - GET /api/ingestion/history - Get ingestion history
 */

import { Request, Response } from 'express';
import { PemsIngestionService } from '../services/pems/PemsIngestionService';
import { logger } from '../utils/logger';
import prisma from '../config/database';

const ingestionService = new PemsIngestionService();

/**
 * POST /api/ingestion/ingest
 *
 * Trigger Bronze layer ingestion for a specific API endpoint
 *
 * Body:
 * {
 *   "endpointId": "endpoint-uuid",
 *   "syncType": "full" | "delta"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "syncBatchId": "batch-xyz",
 *   "message": "Ingestion started"
 * }
 */
export const startIngestion = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { endpointId, syncType = 'full' } = req.body;

    // Validation
    if (!endpointId) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'endpointId is required'
      });
    }

    if (!['full', 'delta'].includes(syncType)) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'syncType must be "full" or "delta"'
      });
    }

    // Verify endpoint exists
    const endpoint = await prisma.api_endpoints.findUnique({
      where: { id: endpointId },
      include: { api_servers: true }
    });

    if (!endpoint) {
      return res.status(404).json({
        error: 'ENDPOINT_NOT_FOUND',
        message: `API endpoint not found: ${endpointId}`
      });
    }

    logger.info(`[INGESTION API] Starting ${syncType} ingestion`, {
      endpointId,
      endpointName: endpoint.name,
      organizationId: endpoint.api_servers.organizationId
    });

    // Trigger ingestion asynchronously
    ingestionService.ingestBatch(endpointId, syncType)
      .then(result => {
        if (result.success) {
          logger.info(`[INGESTION API] Completed ${syncType} ingestion`, {
            syncBatchId: result.syncBatchId,
            recordCount: result.recordCount,
            duration: result.duration
          });
        } else {
          logger.error(`[INGESTION API] Failed ${syncType} ingestion`, {
            syncBatchId: result.syncBatchId,
            error: result.error
          });
        }
      })
      .catch(error => {
        logger.error(`[INGESTION API] Ingestion error`, {
          endpointId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });

    // Return immediately with batch ID for progress tracking
    const syncBatchId = `batch-${Date.now()}-${endpointId.slice(0, 8)}`;

    return res.status(202).json({
      success: true,
      syncBatchId,
      endpointId,
      syncType,
      message: 'Ingestion started. Use GET /api/ingestion/:batchId/progress to track progress.'
    });

  } catch (error) {
    logger.error('[INGESTION API] Failed to start ingestion', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to start ingestion',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * GET /api/ingestion/:batchId/progress
 *
 * Get real-time progress for an active ingestion batch
 *
 * Response:
 * {
 *   "syncBatchId": "batch-xyz",
 *   "status": "running" | "completed" | "failed",
 *   "totalRecords": 10000,
 *   "processedRecords": 5000,
 *   "currentPage": 5,
 *   "totalPages": 10
 * }
 */
export const getIngestionProgress = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { batchId } = req.params;

    const progress = ingestionService.getProgress(batchId);

    if (!progress) {
      return res.status(404).json({
        error: 'BATCH_NOT_FOUND',
        message: `Ingestion batch not found: ${batchId}. It may have completed or never started.`
      });
    }

    return res.status(200).json(progress);

  } catch (error) {
    logger.error('[INGESTION API] Failed to get progress', {
      batchId: req.params.batchId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get ingestion progress'
    });
  }
};

/**
 * GET /api/ingestion/:batchId/status
 *
 * Get status and metadata for a completed ingestion batch
 *
 * Response:
 * {
 *   "syncBatchId": "batch-xyz",
 *   "organizationId": "org-1",
 *   "endpointId": "endpoint-1",
 *   "entityType": "PFA",
 *   "recordCount": 10000,
 *   "ingestedAt": "2025-11-28T10:00:00Z",
 *   "completedAt": "2025-11-28T10:05:00Z",
 *   "schemaFingerprint": {...}
 * }
 */
export const getIngestionStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { batchId } = req.params;

    const batch = await prisma.bronze_batches.findUnique({
      where: { syncBatchId: batchId }
    });

    if (!batch) {
      return res.status(404).json({
        error: 'BATCH_NOT_FOUND',
        message: `Ingestion batch not found: ${batchId}`
      });
    }

    return res.status(200).json({
      syncBatchId: batch.syncBatchId,
      organizationId: batch.organizationId,
      endpointId: batch.endpointId,
      entityType: batch.entityType,
      recordCount: batch.recordCount,
      validRecordCount: batch.validRecordCount,
      invalidRecordCount: batch.invalidRecordCount,
      ingestedAt: batch.ingestedAt,
      completedAt: batch.completedAt,
      syncType: batch.syncType,
      schemaFingerprint: batch.schemaFingerprint,
      warnings: batch.warnings,
      errors: batch.errors
    });

  } catch (error) {
    logger.error('[INGESTION API] Failed to get status', {
      batchId: req.params.batchId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get ingestion status'
    });
  }
};

/**
 * GET /api/ingestion/history
 *
 * Get ingestion history with pagination
 *
 * Query params:
 * - organizationId: Filter by organization
 * - endpointId: Filter by endpoint
 * - limit: Number of batches to return (default 20, max 100)
 * - offset: Pagination offset
 *
 * Response:
 * {
 *   "batches": [...],
 *   "total": 100,
 *   "limit": 20,
 *   "offset": 0
 * }
 */
export const getIngestionHistory = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      organizationId,
      endpointId,
      limit = '20',
      offset = '0'
    } = req.query;

    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offsetNum = parseInt(offset as string, 10);

    // Build filter
    const where: any = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }
    if (endpointId) {
      where.endpointId = endpointId;
    }

    // Get total count
    const total = await prisma.bronze_batches.count({ where });

    // Get batches
    const batches = await prisma.bronze_batches.findMany({
      where,
      orderBy: {
        ingestedAt: 'desc'
      },
      take: limitNum,
      skip: offsetNum
    });

    return res.status(200).json({
      batches,
      total,
      limit: limitNum,
      offset: offsetNum
    });

  } catch (error) {
    logger.error('[INGESTION API] Failed to get history', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get ingestion history'
    });
  }
};

/**
 * GET /api/ingestion/records/:syncBatchId
 *
 * Get Bronze records for a specific batch (for debugging)
 *
 * Query params:
 * - limit: Number of records to return (default 10, max 100)
 * - offset: Pagination offset
 *
 * Response:
 * {
 *   "records": [...],
 *   "total": 10000,
 *   "limit": 10,
 *   "offset": 0
 * }
 */
export const getBronzeRecords = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { syncBatchId } = req.params;
    const { limit = '10', offset = '0' } = req.query;

    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offsetNum = parseInt(offset as string, 10);

    // Verify batch exists
    const batch = await prisma.bronze_batches.findUnique({
      where: { syncBatchId }
    });

    if (!batch) {
      return res.status(404).json({
        error: 'BATCH_NOT_FOUND',
        message: `Batch not found: ${syncBatchId}`
      });
    }

    // Get total count
    const total = await prisma.bronze_records.count({
      where: { syncBatchId }
    });

    // Get records
    const records = await prisma.bronze_records.findMany({
      where: { syncBatchId },
      orderBy: {
        ingestedAt: 'asc'
      },
      take: limitNum,
      skip: offsetNum
    });

    return res.status(200).json({
      syncBatchId,
      records,
      total,
      limit: limitNum,
      offset: offsetNum
    });

  } catch (error) {
    logger.error('[INGESTION API] Failed to get Bronze records', {
      syncBatchId: req.params.syncBatchId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get Bronze records'
    });
  }
};
