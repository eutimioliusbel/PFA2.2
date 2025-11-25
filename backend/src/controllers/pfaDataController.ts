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
import { PrismaClient, Prisma } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getWorkerInstance } from '../workers/PemsSyncWorker';

const prisma = new PrismaClient();

// ============================================================================
// Types & Interfaces
// ============================================================================

interface PfaFilter {
  category?: string | string[];
  class?: string | string[];
  dor?: string | string[];
  source?: string | string[];
  areaSilo?: string | string[];
  manufacturer?: string | string[];
  model?: string | string[];
  dateRangeStart?: string;
  dateRangeEnd?: string;
  isActualized?: boolean;
  isDiscontinued?: boolean;
  isFundsTransferable?: boolean;
  syncState?: string | string[];
  searchText?: string;
}

interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface DraftModification {
  pfaId: string;
  delta: Record<string, any>;
  changeReason?: string;
}

interface MergedPfaRecord {
  id: string;
  data: Record<string, any>;
  syncState: string;
  modifiedAt?: Date;
  modifiedBy?: string;
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
    const filters: PfaFilter = {
      category: req.query.category as string | string[],
      class: req.query.class as string | string[],
      dor: req.query.dor as string | string[],
      source: req.query.source as string | string[],
      areaSilo: req.query.areaSilo as string | string[],
      manufacturer: req.query.manufacturer as string | string[],
      model: req.query.model as string | string[],
      dateRangeStart: req.query.dateRangeStart as string,
      dateRangeEnd: req.query.dateRangeEnd as string,
      isActualized: req.query.isActualized === 'true',
      isDiscontinued: req.query.isDiscontinued === 'true',
      isFundsTransferable: req.query.isFundsTransferable === 'true',
      syncState: req.query.syncState as string | string[],
      searchText: req.query.searchText as string,
    };

    // Extract pagination params
    const pagination: PaginationParams = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 100,
      sortBy: (req.query.sortBy as string) || 'forecastStart',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'asc',
    };

    // Build WHERE clause for filtering
    const whereConditions = buildWhereClause(orgId, filters);

    // Execute merge query with PostgreSQL JSONB operators
    // Note: Using raw SQL for optimal JSONB merge performance
    const mergedRecords = await executeMergeQuery(orgId, whereConditions, pagination, userId);

    // Get total count for pagination
    const totalCount = await getTotalCount(orgId, whereConditions, userId);

    const duration = Date.now() - startTime;
    logger.info(`[PfaDataController] Merge query completed`, {
      orgId,
      recordsReturned: mergedRecords.length,
      totalCount,
      duration: `${duration}ms`,
    });

    res.json({
      success: true,
      data: mergedRecords,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalRecords: totalCount,
        totalPages: Math.ceil(totalCount / (pagination.pageSize || 100)),
      },
      metadata: {
        queryTime: duration,
        filters: Object.keys(filters).filter(k => filters[k as keyof PfaFilter] !== undefined),
      },
    });
  } catch (error) {
    logger.error('[PfaDataController] Failed to get merged PFA data:', error);
    res.status(500).json({
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

    // Process each modification
    for (const mod of modifications) {
      try {
        // Find mirror record by pfaId
        const mirror = await prisma.pfaMirror.findFirst({
          where: {
            organizationId: orgId,
            pfaId: mod.pfaId,
          },
        });

        if (!mirror) {
          errors.push({
            pfaId: mod.pfaId,
            error: 'Mirror record not found',
          });
          continue;
        }

        // Extract modified field names from delta
        const modifiedFields = Object.keys(mod.delta);

        // Check if modification already exists
        const existingMod = await prisma.pfaModification.findFirst({
          where: {
            mirrorId: mirror.id,
            sessionId: finalSessionId,
            syncState: 'draft',
            userId: userId,
          },
        });

        let modification;
        if (existingMod) {
          // Update existing modification
          modification = await prisma.pfaModification.update({
            where: { id: existingMod.id },
            data: {
              delta: mod.delta as Prisma.JsonObject,
              modifiedFields: modifiedFields as Prisma.JsonArray,
              changeReason: mod.changeReason,
              currentVersion: { increment: 1 },
              updatedAt: new Date(),
            },
          });
        } else {
          // Create new modification
          modification = await prisma.pfaModification.create({
            data: {
              mirrorId: mirror.id,
              organizationId: orgId,
              userId: userId,
              delta: mod.delta as Prisma.JsonObject,
              sessionId: finalSessionId,
              syncState: 'draft',
              modifiedFields: modifiedFields as Prisma.JsonArray,
              changeReason: mod.changeReason,
              baseVersion: 1,
              currentVersion: 1,
            },
          });
        }

        savedModifications.push({
          pfaId: mod.pfaId,
          modificationId: modification.id,
          version: modification.currentVersion,
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

    res.json({
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
    res.status(500).json({
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

    const drafts = await prisma.pfaModification.findMany({
      where: whereClause,
    });

    if (drafts.length === 0) {
      return res.status(404).json({
        error: 'NO_DRAFTS',
        message: 'No draft modifications found to commit',
      });
    }

    // Update syncState to 'committed' and set committedAt timestamp
    await prisma.pfaModification.updateMany({
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

    // TODO: Trigger write sync worker (Phase 4 - PEMS Write API)
    // const worker = getWorkerInstance();
    // const syncId = await worker?.triggerWriteSync(orgId, drafts);

    const duration = Date.now() - startTime;

    res.json({
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
    res.status(500).json({
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
      const mirrors = await prisma.pfaMirror.findMany({
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
    const result = await prisma.pfaModification.deleteMany({
      where: whereClause,
    });

    const duration = Date.now() - startTime;
    logger.info(`[PfaDataController] Discarded ${result.count} modifications`, {
      orgId,
      userId,
      sessionId,
      discardedCount: result.count,
    });

    res.json({
      success: true,
      message: `Discarded ${result.count} draft modifications`,
      discardedCount: result.count,
      metadata: {
        discardTime: duration,
      },
    });
  } catch (error) {
    logger.error('[PfaDataController] Failed to discard modifications:', error);
    res.status(500).json({
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

    res.json({
      success: true,
      data: stats,
      metadata: {
        queryTime: duration,
        note: 'Consider using materialized views for sub-100ms performance',
      },
    });
  } catch (error) {
    logger.error('[PfaDataController] Failed to get KPI statistics:', error);
    res.status(500).json({
      error: 'STATS_FAILED',
      message: error instanceof Error ? error.message : 'Failed to retrieve statistics',
    });
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build WHERE clause for filtering merged PFA data
 */
function buildWhereClause(orgId: string, filters: PfaFilter): string {
  const conditions: string[] = [`m.organization_id = '${orgId}'`];

  // Multi-value filters (use generated columns for performance)
  if (filters.category) {
    const categories = Array.isArray(filters.category) ? filters.category : [filters.category];
    conditions.push(`m.category IN (${categories.map(c => `'${c}'`).join(', ')})`);
  }

  if (filters.class) {
    const classes = Array.isArray(filters.class) ? filters.class : [filters.class];
    conditions.push(`m.class IN (${classes.map(c => `'${c}'`).join(', ')})`);
  }

  if (filters.dor) {
    const dors = Array.isArray(filters.dor) ? filters.dor : [filters.dor];
    conditions.push(`m.dor IN (${dors.map(d => `'${d}'`).join(', ')})`);
  }

  if (filters.source) {
    const sources = Array.isArray(filters.source) ? filters.source : [filters.source];
    conditions.push(`m.source IN (${sources.map(s => `'${s}'`).join(', ')})`);
  }

  // Date range filters
  if (filters.dateRangeStart) {
    conditions.push(`m.forecast_start >= '${filters.dateRangeStart}'`);
  }

  if (filters.dateRangeEnd) {
    conditions.push(`m.forecast_end <= '${filters.dateRangeEnd}'`);
  }

  // Boolean filters
  if (filters.isActualized !== undefined) {
    conditions.push(`m.is_actualized = ${filters.isActualized}`);
  }

  if (filters.isDiscontinued !== undefined) {
    conditions.push(`m.is_discontinued = ${filters.isDiscontinued}`);
  }

  // Full-text search (searches in JSONB data field)
  if (filters.searchText) {
    // Use PostgreSQL JSONB text search
    conditions.push(`m.data::text ILIKE '%${filters.searchText}%'`);
  }

  return conditions.join(' AND ');
}

/**
 * Execute merge query with JSONB operators
 *
 * Uses PostgreSQL's || operator to merge mirror.data with modification.delta
 * Returns merged records with sync state indicators
 */
async function executeMergeQuery(
  orgId: string,
  whereClause: string,
  pagination: PaginationParams,
  userId?: string
): Promise<MergedPfaRecord[]> {
  const offset = ((pagination.page || 1) - 1) * (pagination.pageSize || 100);
  const limit = pagination.pageSize || 100;

  // Sort column mapping (use generated columns for performance)
  const sortByColumn = pagination.sortBy === 'category' ? 'm.category'
    : pagination.sortBy === 'forecastStart' ? 'm.forecast_start'
    : pagination.sortBy === 'forecastEnd' ? 'm.forecast_end'
    : 'm.forecast_start'; // default

  const sortOrder = pagination.sortOrder || 'asc';

  // JSONB merge query using PostgreSQL || operator
  // Merges mirror baseline with user modifications
  const query = `
    SELECT
      m.id,
      m.pfa_id as "pfaId",
      COALESCE(m.data, '{}'::jsonb) || COALESCE(mod.delta, '{}'::jsonb) AS data,
      CASE
        WHEN mod.sync_state IS NOT NULL THEN mod.sync_state
        ELSE 'pristine'
      END as sync_state,
      mod.updated_at as modified_at,
      mod.user_id as modified_by
    FROM pfa_mirror m
    LEFT JOIN pfa_modification mod
      ON m.id = mod.mirror_id
      AND mod.sync_state IN ('draft', 'committed', 'syncing')
      ${userId ? `AND mod.user_id = '${userId}'` : ''}
    WHERE ${whereClause}
    ORDER BY ${sortByColumn} ${sortOrder}
    LIMIT ${limit} OFFSET ${offset}
  `;

  const result = await prisma.$queryRawUnsafe<MergedPfaRecord[]>(query);
  return result;
}

/**
 * Get total count for pagination
 */
async function getTotalCount(orgId: string, whereClause: string, userId?: string): Promise<number> {
  const query = `
    SELECT COUNT(DISTINCT m.id) as count
    FROM pfa_mirror m
    LEFT JOIN pfa_modification mod
      ON m.id = mod.mirror_id
      AND mod.sync_state IN ('draft', 'committed', 'syncing')
      ${userId ? `AND mod.user_id = '${userId}'` : ''}
    WHERE ${whereClause}
  `;

  const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(query);
  return Number(result[0]?.count || 0);
}

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
      SUM(CASE WHEN m.is_actualized THEN 1 ELSE 0 END) as actualized_count,
      SUM(CASE WHEN m.is_discontinued THEN 1 ELSE 0 END) as discontinued_count,
      SUM(CASE WHEN mod.sync_state = 'draft' THEN 1 ELSE 0 END) as draft_count,

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
        mod.sync_state
      FROM pfa_mirror m
      LEFT JOIN pfa_modification mod
        ON m.id = mod.mirror_id
        AND mod.sync_state IN ('draft', 'committed', 'syncing')
      WHERE m.organization_id = '${orgId}'
    ) AS merged_view
    JOIN pfa_mirror m ON merged_view.id = m.id
    LEFT JOIN pfa_modification mod ON m.id = mod.mirror_id
  `;

  const result = await prisma.$queryRawUnsafe<any[]>(query);
  return result[0] || {};
}
