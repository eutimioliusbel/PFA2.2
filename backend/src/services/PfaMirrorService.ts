/**
 * @file PfaMirrorService.ts
 * @description Service layer for Mirror + Delta architecture
 * @author PFA Vanguard Team
 *
 * This service provides high-level methods for interacting with the
 * Mirror + Delta architecture, abstracting away the complexity of
 * JSONB queries and materialized view refreshes.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface PfaMergedRecord {
  mirror_id: string;
  organization_id: string;
  pfa_id: string;
  data: any; // JSONB merged data
  category?: string;
  class?: string;
  source?: string;
  dor?: string;
  is_actualized?: boolean;
  is_discontinued?: boolean;
  forecast_start?: Date;
  forecast_end?: Date;
  modification_id?: string;
  sync_state?: string;
  session_id?: string;
  modified_at?: Date;
}

interface KpiSummary {
  organization_id: string;
  category: string;
  source: string;
  dor: string;
  total_plan_cost: number;
  total_forecast_cost: number;
  total_actual_cost: number;
  total_variance: number;
  record_count: number;
  actualized_count: number;
}

interface TimelineBounds {
  organization_id: string;
  plan_start: Date;
  plan_end: Date;
  forecast_start: Date;
  forecast_end: Date;
  actual_start?: Date;
  actual_end?: Date;
  total_records: number;
  actualized_records: number;
}

interface FilterOptions {
  organizationId: string;
  category?: string | string[];
  class?: string | string[];
  source?: string | string[];
  dor?: string | string[];
  areaSilo?: string | string[];
  isActualized?: boolean;
  isDiscontinued?: boolean;
  forecastStartFrom?: Date;
  forecastStartTo?: Date;
  forecastEndFrom?: Date;
  forecastEndTo?: Date;
  search?: string; // Full-text search
  limit?: number;
  offset?: number;
  sessionId?: string; // Filter by user session (for sandbox mode)
}

interface DraftChange {
  mirrorId: string;
  userId: string;
  sessionId?: string;
  delta: Record<string, any>;
  modifiedFields: string[];
  changeReason?: string;
}

interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  errors: string[];
}

// ============================================================================
// PFA MIRROR SERVICE
// ============================================================================

export class PfaMirrorService {
  /**
   * Get merged PFA records with filters
   * Uses pfa_merged_live view for real-time merging
   */
  async getMergedRecords(
    options: FilterOptions
  ): Promise<PfaMergedRecord[]> {
    const {
      organizationId,
      category,
      class: classType,
      source,
      dor,
      areaSilo,
      isActualized,
      isDiscontinued = false,
      forecastStartFrom,
      forecastStartTo,
      forecastEndFrom,
      forecastEndTo,
      search,
      limit = 1000,
      offset = 0,
      sessionId,
    } = options;

    // Build dynamic WHERE clause
    const conditions: string[] = [
      `organization_id = ${Prisma.sql`${organizationId}`}`,
    ];

    if (category) {
      if (Array.isArray(category)) {
        conditions.push(
          `category = ANY(${Prisma.sql`${category}`}::text[])`
        );
      } else {
        conditions.push(`category = ${Prisma.sql`${category}`}`);
      }
    }

    if (classType) {
      if (Array.isArray(classType)) {
        conditions.push(
          `class = ANY(${Prisma.sql`${classType}`}::text[])`
        );
      } else {
        conditions.push(`class = ${Prisma.sql`${classType}`}`);
      }
    }

    if (source) {
      if (Array.isArray(source)) {
        conditions.push(`source = ANY(${Prisma.sql`${source}`}::text[])`);
      } else {
        conditions.push(`source = ${Prisma.sql`${source}`}`);
      }
    }

    if (dor) {
      conditions.push(`dor = ${Prisma.sql`${dor}`}`);
    }

    if (areaSilo) {
      if (Array.isArray(areaSilo)) {
        conditions.push(
          `area_silo = ANY(${Prisma.sql`${areaSilo}`}::text[])`
        );
      } else {
        conditions.push(`area_silo = ${Prisma.sql`${areaSilo}`}`);
      }
    }

    if (typeof isActualized === 'boolean') {
      conditions.push(`is_actualized = ${isActualized}`);
    }

    if (typeof isDiscontinued === 'boolean') {
      conditions.push(`is_discontinued = ${isDiscontinued}`);
    }

    if (forecastStartFrom) {
      conditions.push(
        `forecast_start >= ${Prisma.sql`${forecastStartFrom}`}::DATE`
      );
    }

    if (forecastStartTo) {
      conditions.push(
        `forecast_start <= ${Prisma.sql`${forecastStartTo}`}::DATE`
      );
    }

    if (forecastEndFrom) {
      conditions.push(
        `forecast_end >= ${Prisma.sql`${forecastEndFrom}`}::DATE`
      );
    }

    if (forecastEndTo) {
      conditions.push(
        `forecast_end <= ${Prisma.sql`${forecastEndTo}`}::DATE`
      );
    }

    if (sessionId) {
      conditions.push(`session_id = ${Prisma.sql`${sessionId}`}`);
    }

    if (search) {
      // Full-text search using GIN index
      conditions.push(
        `data @> ${Prisma.sql`${JSON.stringify({ search })}`}::jsonb`
      );
    }

    const whereClause = conditions.join(' AND ');

    // Execute query
    const query = Prisma.sql`
      SELECT * FROM pfa_merged_live
      WHERE ${Prisma.raw(whereClause)}
      ORDER BY forecast_start
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return prisma.$queryRaw<PfaMergedRecord[]>(query);
  }

  /**
   * Get KPI summary (pre-computed aggregations)
   * Uses pfa_kpi_summary materialized view
   */
  async getKpiSummary(organizationId: string): Promise<KpiSummary[]> {
    return prisma.$queryRaw<KpiSummary[]>`
      SELECT * FROM pfa_kpi_summary
      WHERE organization_id = ${organizationId}
      ORDER BY total_forecast_cost DESC
    `;
  }

  /**
   * Get timeline bounds (min/max dates)
   * Uses pfa_timeline_bounds materialized view
   */
  async getTimelineBounds(
    organizationId: string
  ): Promise<TimelineBounds | null> {
    const results = await prisma.$queryRaw<TimelineBounds[]>`
      SELECT * FROM pfa_timeline_bounds
      WHERE organization_id = ${organizationId}
    `;

    return results.length > 0 ? results[0] : null;
  }

  /**
   * Refresh materialized views
   * Call after bulk operations or on schedule
   */
  async refreshMaterializedViews(): Promise<void> {
    await prisma.$executeRaw`SELECT refresh_pfa_materialized_views()`;
  }

  /**
   * Create draft modification (sandbox mode)
   * Stores only changed fields in delta
   */
  async createDraft(draft: DraftChange): Promise<string> {
    const { mirrorId, userId, sessionId, delta, modifiedFields, changeReason } =
      draft;

    // Get mirror record to capture base version
    const mirrorRecord = await prisma.pfa_mirror.findUnique({
      where: { id: mirrorId },
    });

    if (!mirrorRecord) {
      throw new Error(`Mirror record not found: ${mirrorId}`);
    }

    // Check if draft already exists for this mirror + session
    const existingDraft = await prisma.pfa_modification.findFirst({
      where: {
        mirrorId,
        userId,
        sessionId: sessionId || null,
        syncState: 'draft',
      },
    });

    if (existingDraft) {
      // Update existing draft (merge deltas)
      const mergedDelta = { ...(existingDraft.delta as Record<string, any>), ...delta };
      const mergedFields = Array.from(
        new Set([
          ...(Array.isArray(existingDraft.modifiedFields)
            ? existingDraft.modifiedFields
            : []),
          ...modifiedFields,
        ])
      );

      await prisma.pfa_modification.update({
        where: { id: existingDraft.id },
        data: {
          delta: mergedDelta,
          modifiedFields: mergedFields,
          currentVersion: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      return existingDraft.id;
    } else {
      // Create new draft
      const newDraft = await prisma.pfa_modification.create({
        data: {
          id: `mod_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          mirrorId,
          organizationId: mirrorRecord.organizationId,
          userId,
          sessionId,
          delta,
          modifiedFields,
          changeReason,
          syncState: 'draft',
          updatedAt: new Date(),
        },
      });

      return newDraft.id;
    }
  }

  /**
   * Commit all drafts in a session
   * Changes state from 'draft' to 'committed'
   */
  async commitSession(userId: string, sessionId: string): Promise<number> {
    const result = await prisma.pfa_modification.updateMany({
      where: {
        userId,
        sessionId,
        syncState: 'draft',
      },
      data: {
        syncState: 'committed',
        committedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Discard all drafts in a session
   * Deletes modifications in 'draft' state
   */
  async discardSession(userId: string, sessionId: string): Promise<number> {
    const result = await prisma.pfa_modification.deleteMany({
      where: {
        userId,
        sessionId,
        syncState: 'draft',
      },
    });

    return result.count;
  }

  /**
   * Get pending changes for write sync to PEMS
   * Returns modifications in 'committed' state
   */
  async getPendingSyncChanges(
    organizationId: string
  ): Promise<PfaMergedRecord[]> {
    return prisma.$queryRaw<PfaMergedRecord[]>`
      SELECT
        mod.id AS modification_id,
        mod.mirror_id,
        m.pfa_id,
        m.organization_id,
        mod.delta,
        mod.modified_fields,
        mod.committed_at,
        m.pems_version
      FROM pfa_modification mod
      JOIN pfa_mirror m ON mod.mirror_id = m.id
      WHERE mod.organization_id = ${organizationId}
        AND mod.sync_state = 'committed'
      ORDER BY mod.committed_at
    `;
  }

  /**
   * Mark modifications as synced
   * Updates state from 'committed' to 'synced'
   */
  async markAsSynced(modificationIds: string[]): Promise<void> {
    await prisma.pfa_modification.updateMany({
      where: {
        id: { in: modificationIds },
      },
      data: {
        syncState: 'synced',
        syncedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Sync PFA data from PEMS (Read)
   * Bulk insert/update mirror records
   */
  async syncFromPems(
    organizationId: string,
    records: any[],
    syncBatchId: string
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      errors: [],
    };

    const BATCH_SIZE = 1000;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      try {
        await prisma.$transaction(async (tx): Promise<void> => {
          for (const record of batch) {
            const jsonbData = {
              pfaId: record.pfaId,
              category: record.category,
              class: record.class,
              source: record.source,
              dor: record.dor,
              areaSilo: record.areaSilo,
              isActualized: record.isActualized,
              isDiscontinued: record.isDiscontinued,
              isFundsTransferable: record.isFundsTransferable,
              monthlyRate: record.monthlyRate,
              purchasePrice: record.purchasePrice,
              manufacturer: record.manufacturer,
              model: record.model,
              originalStart: record.originalStart,
              originalEnd: record.originalEnd,
              forecastStart: record.forecastStart,
              forecastEnd: record.forecastEnd,
              actualStart: record.actualStart,
              actualEnd: record.actualEnd,
              hasActuals: record.hasActuals,
              hasPlan: record.hasPlan,
              contract: record.contract,
              equipment: record.equipment,
            };

            {
              const existingMirror = await tx.pfa_mirror.findUnique({
                where: {
                  organizationId_pfaId: {
                    organizationId,
                    pfaId: record.pfaId,
                  },
                },
              });

              if (existingMirror) {
                await tx.pfa_mirror_history.create({
                  data: {
                    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                    mirrorId: existingMirror.id,
                    version: existingMirror.version,
                    organizationId: existingMirror.organizationId,
                    data: existingMirror.data as any,
                    pfaId: existingMirror.pfaId,
                    category: existingMirror.category,
                    class: existingMirror.class,
                    source: existingMirror.source,
                    dor: existingMirror.dor,
                    areaSilo: existingMirror.areaSilo,
                    manufacturer: existingMirror.manufacturer,
                    model: existingMirror.model,
                    monthlyRate: existingMirror.monthlyRate,
                    purchasePrice: existingMirror.purchasePrice,
                    forecastStart: existingMirror.forecastStart,
                    forecastEnd: existingMirror.forecastEnd,
                    originalStart: existingMirror.originalStart,
                    originalEnd: existingMirror.originalEnd,
                    actualStart: existingMirror.actualStart,
                    actualEnd: existingMirror.actualEnd,
                    isActualized: existingMirror.isActualized,
                    isDiscontinued: existingMirror.isDiscontinued,
                    isFundsTransferable: existingMirror.isFundsTransferable,
                    hasPlan: existingMirror.hasPlan,
                    hasActuals: existingMirror.hasActuals,
                    pemsVersion: existingMirror.pemsVersion,
                    syncBatchId: existingMirror.syncBatchId,
                    changedBy: 'CSV_IMPORT',
                    changeReason: 'CSV bulk import update'
                  }
                });

                await tx.pfa_mirror.update({
                  where: { id: existingMirror.id },
                  data: {
                    data: jsonbData,
                    pemsVersion: record.lastModified,
                    version: existingMirror.version + 1,
                    lastSyncedAt: new Date(),
                    syncBatchId,
                    updatedAt: new Date(),
                  },
                });
              } else {
                await tx.pfa_mirror.create({
                  data: {
                    id: `mirror_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                    organizationId,
                    data: jsonbData,
                    pemsVersion: record.lastModified,
                    version: 1,
                    lastSyncedAt: new Date(),
                    syncBatchId,
                    updatedAt: new Date(),
                  },
                });
              }
            }
          }
        });

        result.recordsProcessed += batch.length;
        // Note: Prisma doesn't return insert vs update counts
        result.recordsInserted += batch.length;
      } catch (error) {
        result.success = false;
        result.errors.push(
          `Batch ${i / BATCH_SIZE + 1} failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return result;
  }

  /**
   * Analyze query performance
   * Returns execution time for common queries
   */
  async analyzePerformance(
    organizationId: string,
    category?: string,
    source?: string
  ): Promise<any[]> {
    return prisma.$queryRaw<any[]>`
      SELECT * FROM analyze_pfa_query_performance(
        ${organizationId},
        ${category || null},
        ${source || null}
      )
    `;
  }

  /**
   * Get table sizes and index usage
   * Useful for monitoring database health
   */
  async getDatabaseStats(): Promise<any[]> {
    return prisma.$queryRaw<any[]>`
      SELECT
        tablename,
        pg_size_pretty(pg_total_relation_size(tablename::regclass)) AS total_size,
        pg_size_pretty(pg_relation_size(tablename::regclass)) AS table_size,
        pg_size_pretty(pg_indexes_size(tablename::regclass)) AS indexes_size
      FROM pg_tables
      WHERE tablename LIKE 'pfa_%'
      ORDER BY pg_total_relation_size(tablename::regclass) DESC
    `;
  }
}

// Export singleton instance
export const pfaMirrorService = new PfaMirrorService();
