import prisma from '../../config/database';
import { subDays } from 'date-fns';
import { logger } from '../../utils/logger';
import { IArchivalBackend } from './archival/IArchivalBackend';

export interface PruningResult {
  archived: number;
  deleted: number;
  errors: number;
  duration: number;
}

export interface PruningConfig {
  retentionDays: number;
  batchSize: number;
  enableArchival: boolean;
  dryRun: boolean;
}

/**
 * Bronze Layer Pruning Service
 *
 * Manages lifecycle of Bronze records (raw ingestion data):
 * - Archives records older than retention period
 * - Deletes from database after archival
 * - Maintains immutability of Bronze layer
 * - Provides compliance audit trail
 *
 * Architecture Notes:
 * - Bronze layer is append-only during normal ops
 * - Pruning only occurs via scheduled job
 * - Archival destination configurable (S3, Glacier, filesystem)
 */
export class BronzePruningService {
  private config: PruningConfig;
  private archivalBackend?: IArchivalBackend;

  constructor(config?: Partial<PruningConfig>, archivalBackend?: IArchivalBackend) {
    this.config = {
      retentionDays: config?.retentionDays ?? 90,
      batchSize: config?.batchSize ?? 1000,
      enableArchival: config?.enableArchival ?? false,
      dryRun: config?.dryRun ?? false,
    };
    this.archivalBackend = archivalBackend;

    if (this.config.enableArchival && !this.archivalBackend) {
      logger.warn('[BronzePruning] Archival enabled but no backend configured');
    }
  }

  /**
   * Main pruning operation
   * Finds old Bronze records, archives if enabled, then deletes
   */
  async pruneBronzeRecords(): Promise<PruningResult> {
    const startTime = Date.now();
    const cutoffDate = subDays(new Date(), this.config.retentionDays);

    logger.info(`[BronzePruning] Starting pruning job`, {
      cutoffDate,
      retentionDays: this.config.retentionDays,
      dryRun: this.config.dryRun,
    });

    const result: PruningResult = {
      archived: 0,
      deleted: 0,
      errors: 0,
      duration: 0,
    };

    try {
      // 1. Count records to be pruned
      const totalRecords = await prisma.bronze_records.count({
        where: {
          ingestedAt: { lt: cutoffDate },
        },
      });

      logger.info(`[BronzePruning] Found ${totalRecords} records to prune`);

      if (totalRecords === 0) {
        logger.info('[BronzePruning] No records to prune');
        result.duration = Date.now() - startTime;
        return result;
      }

      // 2. Process in batches to avoid memory issues
      let processedCount = 0;
      while (processedCount < totalRecords) {
        const batch = await prisma.bronze_records.findMany({
          where: {
            ingestedAt: { lt: cutoffDate },
          },
          take: this.config.batchSize,
          orderBy: {
            ingestedAt: 'asc',
          },
        });

        if (batch.length === 0) break;

        // 3. Archive to cold storage if enabled
        if (this.config.enableArchival && !this.config.dryRun) {
          try {
            await this.archiveBatch(batch);
            result.archived += batch.length;
          } catch (error) {
            logger.error('[BronzePruning] Archival failed for batch', { error });
            result.errors += batch.length;
            // Don't delete if archival fails
            processedCount += batch.length;
            continue;
          }
        }

        // 4. Delete from database
        if (!this.config.dryRun) {
          const batchIds = batch.map(r => r.id);
          const deleteResult = await prisma.bronze_records.deleteMany({
            where: {
              id: { in: batchIds },
            },
          });
          result.deleted += deleteResult.count;
        } else {
          // Dry run: just count
          result.deleted += batch.length;
        }

        processedCount += batch.length;
        logger.info(`[BronzePruning] Processed ${processedCount}/${totalRecords} records`);
      }

      result.duration = Date.now() - startTime;

      logger.info('[BronzePruning] Pruning complete', {
        archived: result.archived,
        deleted: result.deleted,
        errors: result.errors,
        durationMs: result.duration,
      });

      return result;
    } catch (error) {
      logger.error('[BronzePruning] Fatal error during pruning', { error });
      result.duration = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Archive batch to cold storage using configured backend
   */
  private async archiveBatch(records: any[]): Promise<void> {
    if (!this.archivalBackend) {
      logger.warn('[BronzePruning] No archival backend configured, skipping archival');
      return;
    }

    try {
      const metadata = await this.archivalBackend.archiveBatch(records);

      logger.info(`[BronzePruning] Successfully archived batch`, {
        archiveId: metadata.archiveId,
        recordCount: metadata.recordCount,
        compressedSize: metadata.compressedSize,
        compressionRatio: `${((1 - metadata.compressedSize / metadata.uncompressedSize) * 100).toFixed(1)}%`,
      });
    } catch (error) {
      logger.error('[BronzePruning] Archival backend failed', { error });
      throw error;
    }
  }

  /**
   * Get pruning statistics without executing
   */
  async getPruningStats(): Promise<{
    eligibleForPruning: number;
    totalBronzeRecords: number;
    oldestRecord: Date | null;
    newestRecord: Date | null;
  }> {
    const cutoffDate = subDays(new Date(), this.config.retentionDays);

    const [eligibleForPruning, totalBronzeRecords, oldestRecord, newestRecord] = await Promise.all([
      prisma.bronze_records.count({
        where: {
          ingestedAt: { lt: cutoffDate },
        },
      }),
      prisma.bronze_records.count(),
      prisma.bronze_records.findFirst({
        orderBy: { ingestedAt: 'asc' },
        select: { ingestedAt: true },
      }),
      prisma.bronze_records.findFirst({
        orderBy: { ingestedAt: 'desc' },
        select: { ingestedAt: true },
      }),
    ]);

    return {
      eligibleForPruning,
      totalBronzeRecords,
      oldestRecord: oldestRecord?.ingestedAt ?? null,
      newestRecord: newestRecord?.ingestedAt ?? null,
    };
  }
}
