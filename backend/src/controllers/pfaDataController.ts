/**
 * @file pfaDataController.ts
 * @description PFA Data Controller - Live Merge API (Phase 3)
 *
 * Implements real-time merging of PfaMirror (baseline from PEMS) with PfaModification (user drafts)
 * using PostgreSQL JSONB operators for high-performance queries.
 *
 * Architecture:
 * - GET  /api/pfa/:orgId              - Get merged data (mirror || modifications)
 * - POST /api/pfa/:orgId/draft        - Save draft modifications (upsert to PfaModification)
 * - POST /api/pfa/:orgId/commit       - Commit drafts to PEMS (trigger sync worker)
 * - POST /api/pfa/:orgId/discard      - Delete draft records
 * - GET  /api/pfa/:orgId/stats        - KPI aggregations (cost variance, etc.)
 *
 * JSONB Merge Logic:
 * - Base query: SELECT mir.data || COALESCE(mod.delta, '{}') AS merged_data
 * - Handles cases: mirror only, mirror + modification, modification only (new records)
 * - Performance: Uses indexes on (organizationId, syncState) and generated columns
 *
 * Security:
 * - All endpoints require authentication
 * - Organization isolation enforced via middleware
 * - Multi-tenant safe with user ID tracking
 */

import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import pfaMirrorService from '../services/pfa/PfaMirrorService';

const prisma = new PrismaClient();

// ============================================================================
// Types & Interfaces
// ============================================================================

interface DraftModification {
  pfaId: string;
  delta: Record<string, any>;
  changeReason?: string;
}

// ============================================================================
// GET /api/pfa/:orgId - Get merged PFA data
// ============================================================================

/**
 * Get merged PFA data (mirror + modifications) with filtering and pagination
 *
 * Query supports:
 * - Multi-value filters (category, class, DOR, source, etc.)
 * - Date range filtering
 * - Status flags (isActualized, isDiscontinued, etc.)
 * - Full-text search on searchText
 * - Pagination and sorting
 *
 * Returns:
 * - Merged records with sync state indicators
 * - Total count for pagination
 * - Performance metadata
 */
export const getMergedPfaData = async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  const { orgId } = req.params;
  const userId = req.user?.userId;

  logger.info(`[PfaDataController] GET /api/pfa/${orgId}`, { userId });

  try {
    // Extract filters from query params
    const category = req.query.category as string;
    const classFilter = req.query.class as string;
    const dor = req.query.dor as string;
    const source = req.query.source as string;
    const searchText = req.query.searchText as string;

    // Extract pagination params
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 100;
    const offset = (page - 1) * pageSize;

    // Call PfaMirrorService to get merged views
    const mergedRecords = await pfaMirrorService.getMergedViews(
      orgId,
      userId,
      {
        category,
        class: classFilter,
        dor,
        source,
        search: searchText,
        limit: pageSize,
        offset
      }
    );

    // Get total count using efficient count query
    const totalCount = await pfaMirrorService.getCount(orgId, {
      category,
      class: classFilter,
      source,
      dor,
      search: searchText
    });

    const duration = Date.now() - startTime;
    logger.info(`[PfaDataController] Merge query completed`, {
      orgId,
      recordsReturned: mergedRecords.length,
      duration: `${duration}ms`,
    });

    return res.json({
      success: true,
      data: mergedRecords,
      pagination: {
        page,
        pageSize,
        totalRecords: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
      metadata: {
        queryTime: duration,
      },
    });
  } catch (error) {
    logger.error('[PfaDataController] Failed to get merged PFA data:', error);
    return res.status(500).json({
      error: 'QUERY_FAILED',
      message: error instanceof Error ? error.message : 'Failed to retrieve PFA data',
    });
  }
};

// ============================================================================
// POST /api/pfa/:orgId/draft - Save draft modifications
// ============================================================================

/**
 * Save draft modifications (upsert to PfaModification table)
 *
 * Supports:
 * - Bulk upsert (multiple modifications in one request)
 * - Optimistic locking with version control
 * - Audit trail (userId, changeReason)
 * - sessionId for grouping related changes
 *
 * Request body:
 * {
 *   sessionId: string (optional),
 *   modifications: [{ pfaId, delta, changeReason }]
 * }
 */
export const saveDraftModifications = async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  const { orgId } = req.params;
  const userId = req.user?.userId;
  const { sessionId, modifications } = req.body as {
    sessionId?: string;
    modifications: DraftModification[];
  };

  logger.info(`[PfaDataController] POST /api/pfa/${orgId}/draft`, {
    userId,
    sessionId,
    modificationsCount: modifications?.length,
  });

  try {
    // Validation
    if (!modifications || !Array.isArray(modifications) || modifications.length === 0) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'modifications array is required and must not be empty',
      });
    }

    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User ID not found in token',
      });
    }

    const finalSessionId = sessionId || `session-${Date.now()}-${userId}`;
    const savedModifications: any[] = [];
    const errors: any[] = [];

    // Process each modification using PfaMirrorService
    for (const mod of modifications) {
      try {
        await pfaMirrorService.saveDraft({
          organizationId: orgId,
          userId,
          pfaId: mod.pfaId,
          delta: mod.delta,
          sessionId: finalSessionId,
          changeReason: mod.changeReason
        });

        savedModifications.push({
          pfaId: mod.pfaId
        });
      } catch (error) {
        logger.error(`[PfaDataController] Failed to save modification for ${mod.pfaId}:`, error);
        errors.push({
          pfaId: mod.pfaId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`[PfaDataController] Draft modifications saved`, {
      orgId,
      sessionId: finalSessionId,
      saved: savedModifications.length,
      errors: errors.length,
      duration: `${duration}ms`,
    });

    return res.json({
      success: true,
      message: `Saved ${savedModifications.length} modifications`,
      sessionId: finalSessionId,
      saved: savedModifications,
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        saveTime: duration,
      },
    });
  } catch (error) {
    logger.error('[PfaDataController] Failed to save draft modifications:', error);
    return res.status(500).json({
      error: 'SAVE_FAILED',
      message: error instanceof Error ? error.message : 'Failed to save modifications',
    });
  }
};

// ============================================================================
// POST /api/pfa/:orgId/commit - Commit drafts to PEMS
// ============================================================================

/**
 * Commit draft modifications to PEMS (trigger sync worker)
 *
 * Flow:
 * 1. Find all draft modifications for session/user
 * 2. Update syncState to 'pending_sync'
 * 3. Trigger PemsSyncWorker write sync
 * 4. Return sync job ID for progress tracking
 *
 * Request body:
 * {
 *   sessionId: string (optional - if not provided, commits all user drafts)
 * }
 */
export const commitDraftModifications = async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  const { orgId } = req.params;
  const userId = req.user?.userId;
  const { sessionId } = req.body as { sessionId?: string };

  logger.info(`[PfaDataController] POST /api/pfa/${orgId}/commit`, {
    userId,
    sessionId,
  });

  try {
    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User ID not found in token',
      });
    }

    // Find draft modifications to commit
    const whereClause: any = {
      organizationId: orgId,
      userId: userId,
      syncState: 'draft',
    };

    if (sessionId) {
      whereClause.sessionId = sessionId;
    }

    const drafts = await prisma.pfa_modification.findMany({
      where: whereClause,
    });

    if (drafts.length === 0) {
      return res.status(404).json({
        error: 'NO_DRAFTS',
        message: 'No draft modifications found to commit',
      });
    }

    // Update syncState to 'committed' and set committedAt timestamp
    await prisma.pfa_modification.updateMany({
      where: whereClause,
      data: {
        syncState: 'committed',
        committedAt: new Date(),
      },
    });

    logger.info(`[PfaDataController] Committed ${drafts.length} modifications`, {
      orgId,
      userId,
      sessionId,
    });

    // const worker = getWorkerInstance();
    // const syncId = await worker?.triggerWriteSync(orgId, drafts);

    const duration = Date.now() - startTime;

    return res.json({
      success: true,
      message: `Committed ${drafts.length} modifications`,
      committedCount: drafts.length,
      // syncId: syncId, // Will be available in Phase 4
      note: 'Write sync to PEMS will be implemented in Phase 4',
      metadata: {
        commitTime: duration,
      },
    });
  } catch (error) {
    logger.error('[PfaDataController] Failed to commit modifications:', error);
    return res.status(500).json({
      error: 'COMMIT_FAILED',
      message: error instanceof Error ? error.message : 'Failed to commit modifications',
    });
  }
};

// ============================================================================
// POST /api/pfa/:orgId/discard - Discard draft modifications
// ============================================================================

/**
 * Discard draft modifications (delete from PfaModification table)
 *
 * Request body:
 * {
 *   sessionId?: string,      // Discard specific session
 *   pfaIds?: string[],       // Discard specific PFA records
 *   discardAll?: boolean     // Discard all user drafts
 * }
 */
export const discardDraftModifications = async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  const { orgId } = req.params;
  const userId = req.user?.userId;
  const { sessionId, pfaIds, discardAll } = req.body as {
    sessionId?: string;
    pfaIds?: string[];
    discardAll?: boolean;
  };

  logger.info(`[PfaDataController] POST /api/pfa/${orgId}/discard`, {
    userId,
    sessionId,
    pfaIdsCount: pfaIds?.length,
    discardAll,
  });

  try {
    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User ID not found in token',
      });
    }

    // Build WHERE clause based on discard criteria
    const whereClause: any = {
      organizationId: orgId,
      userId: userId,
      syncState: 'draft',
    };

    if (sessionId) {
      whereClause.sessionId = sessionId;
    }

    if (pfaIds && pfaIds.length > 0) {
      // Get mirror IDs for the specified pfaIds
      const mirrors = await prisma.pfa_mirror.findMany({
        where: {
          organizationId: orgId,
          pfaId: { in: pfaIds },
        },
        select: { id: true },
      });

      whereClause.mirrorId = { in: mirrors.map(m => m.id) };
    }

    // Validate that at least one discard criteria is provided
    if (!sessionId && !pfaIds && !discardAll) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Must specify sessionId, pfaIds, or discardAll=true',
      });
    }

    // Delete draft modifications
    const result = await prisma.pfa_modification.deleteMany({
      where: whereClause,
    });

    const duration = Date.now() - startTime;
    logger.info(`[PfaDataController] Discarded ${result.count} modifications`, {
      orgId,
      userId,
      sessionId,
      discardedCount: result.count,
    });

    return res.json({
      success: true,
      message: `Discarded ${result.count} draft modifications`,
      discardedCount: result.count,
      metadata: {
        discardTime: duration,
      },
    });
  } catch (error) {
    logger.error('[PfaDataController] Failed to discard modifications:', error);
    return res.status(500).json({
      error: 'DISCARD_FAILED',
      message: error instanceof Error ? error.message : 'Failed to discard modifications',
    });
  }
};

// ============================================================================
// GET /api/pfa/:orgId/stats - Get KPI statistics
// ============================================================================

/**
 * Get KPI statistics with cost variance calculations
 *
 * Returns:
 * - Total Plan Cost
 * - Total Forecast Cost
 * - Total Actual Cost
 * - Variance (Forecast vs Plan, Actual vs Plan)
 * - Record counts by status
 * - Breakdown by category, DOR, source
 */
export const getKpiStatistics = async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  const { orgId } = req.params;

  logger.info(`[PfaDataController] GET /api/pfa/${orgId}/stats`);

  try {
    // Execute aggregation query using PostgreSQL JSONB operators
    // This will be optimized with materialized views in production
    const stats = await executeKpiQuery(orgId);

    const duration = Date.now() - startTime;
    logger.info(`[PfaDataController] KPI query completed`, {
      orgId,
      duration: `${duration}ms`,
    });

    return res.json({
      success: true,
      data: stats,
      metadata: {
        queryTime: duration,
        note: 'Consider using materialized views for sub-100ms performance',
      },
    });
  } catch (error) {
    logger.error('[PfaDataController] Failed to get KPI statistics:', error);
    return res.status(500).json({
      error: 'STATS_FAILED',
      message: error instanceof Error ? error.message : 'Failed to retrieve statistics',
    });
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Execute KPI aggregation query
 *
 * TODO: Replace with materialized view for sub-100ms performance
 */
async function executeKpiQuery(orgId: string): Promise<any> {
  // Simplified KPI query using JSONB operators
  // In production, this should use a materialized view refreshed every 5-15 minutes
  const query = `
    SELECT
      COUNT(*) as total_records,
      SUM(CASE WHEN m."isActualized" THEN 1 ELSE 0 END) as actualized_count,
      SUM(CASE WHEN m."isDiscontinued" THEN 1 ELSE 0 END) as discontinued_count,
      SUM(CASE WHEN mod."syncState" = 'draft' THEN 1 ELSE 0 END) as draft_count,

      -- Cost aggregations (simplified - needs proper calculation based on source type)
      SUM((merged_data->>'monthlyRate')::numeric) FILTER (WHERE merged_data->>'source' = 'Rental') as total_monthly_rental,
      SUM((merged_data->>'purchasePrice')::numeric) FILTER (WHERE merged_data->>'source' = 'Purchase') as total_purchase_cost,

      -- Category breakdown
      json_object_agg(
        m.category,
        COUNT(*)
      ) FILTER (WHERE m.category IS NOT NULL) as category_breakdown

    FROM (
      SELECT
        m.*,
        COALESCE(m.data, '{}'::jsonb) || COALESCE(mod.delta, '{}'::jsonb) AS merged_data,
        mod."syncState"
      FROM pfa_mirror m
      LEFT JOIN pfa_modification mod
        ON m.id = mod."mirrorId"
        AND mod."syncState" IN ('draft', 'committed', 'syncing')
      WHERE m."organizationId" = '${orgId}'
    ) AS merged_view
    JOIN pfa_mirror m ON merged_view.id = m.id
    LEFT JOIN pfa_modification mod ON m.id = mod."mirrorId"
  `;

  const result = await prisma.$queryRawUnsafe<any[]>(query);
  return result[0] || {};
}
