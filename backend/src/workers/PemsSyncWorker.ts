/**
 * @file PemsSyncWorker.ts
 * @description Background worker for syncing PFA data from PEMS to Mirror tables
 *
 * Implements Phase 2 of Mirror + Delta Architecture:
 * - Cron-based automatic sync (default: every 15 minutes)
 * - Manual trigger support for admin UI
 * - Batch processing with progress tracking
 * - Error recovery and retry logic
 * - Multi-organization support
 *
 * Architecture:
 * - Fetches data from PEMS using PemsSyncService
 * - Upserts to pfa_mirror table in batches of 1000
 * - Logs sync operations to pfa_sync_log table
 * - Refreshes materialized views after sync (planned)
 */

import { CronJob } from 'cron';
import prisma from '../config/database';
import { PemsSyncService } from '../services/pems/PemsSyncService';
import { logger } from '../utils/logger';

export interface WorkerConfig {
  syncInterval: string; // Cron expression (default: '*/15 * * * *')
  enabled: boolean;
  organizations: string[]; // Which orgs to sync (empty = all active orgs)
}

export class PemsSyncWorker {
  private job: CronJob | null = null;
  private isRunning: boolean = false;
  private syncService: PemsSyncService;

  constructor(private config: WorkerConfig) {
    this.syncService = new PemsSyncService();
  }

  /**
   * Start the background worker
   */
  start(): void {
    if (!this.config.enabled) {
      logger.info('[PemsSyncWorker] Sync worker disabled in config');
      return;
    }

    logger.info(`[PemsSyncWorker] Starting with interval: ${this.config.syncInterval}`);

    try {
      this.job = new CronJob(
        this.config.syncInterval,
        () => {
          this.runSync().catch(error => {
            logger.error('[PemsSyncWorker] Error in cron job:', error);
          });
        },
        null, // onComplete
        true, // start immediately
        'America/Chicago' // timezone
      );
      logger.info('[PemsSyncWorker] Cron job started successfully');
    } catch (error) {
      logger.error('[PemsSyncWorker] Failed to start cron job:', error);
    }
  }

  /**
   * Stop the background worker
   */
  stop(): void {
    if (this.job) {
      this.job.stop();
      logger.info('[PemsSyncWorker] Sync worker stopped');
    }
  }

  /**
   * Manually trigger a sync (for admin UI)
   * @param organizationId - Optional: sync specific organization only
   * @returns syncId for tracking progress
   */
  async triggerManualSync(organizationId?: string): Promise<string> {
    logger.info('[PemsSyncWorker] Manual sync triggered', { organizationId });
    return await this.runSync(organizationId);
  }

  /**
   * Trigger write sync to PEMS (commit user modifications)
   * NOTE: This is a placeholder for Phase 4 implementation
   *
   * @param organizationId - Organization to sync
   * @param modifications - Committed modifications to sync to PEMS
   * @returns syncId for tracking progress
   */
  async triggerWriteSync(organizationId: string, modifications: any[]): Promise<string> {
    logger.info('[PemsSyncWorker] Write sync triggered (Phase 4 - Not Yet Implemented)', {
      organizationId,
      modificationsCount: modifications.length
    });

    // 1. Get PEMS Write API configuration
    // 2. Transform modifications to PEMS format
    // 3. Batch POST to PEMS Write API
    // 4. Update syncState to 'synced' on success
    // 5. Update syncState to 'sync_error' on failure
    // 6. Log sync results to pfa_sync_log

    const syncId = `write-sync-${Date.now()}`;

    // Create placeholder sync log
    await prisma.pfa_sync_log.create({
      data: {
        id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        organizationId,
        syncType: 'manual',
        syncDirection: 'write',
        batchId: syncId,
        status: 'completed',
        recordsTotal: modifications.length,
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        errorMessage: 'Write sync not yet implemented - Phase 4',
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 0
      }
    });

    logger.warn('[PemsSyncWorker] Write sync placeholder created - implementation pending in Phase 4');
    return syncId;
  }

  /**
   * Main sync execution
   * @param specificOrgId - Optional: sync specific organization only
   * @returns syncId for tracking progress
   */
  private async runSync(specificOrgId?: string): Promise<string> {
    if (this.isRunning) {
      logger.warn('[PemsSyncWorker] Sync already running, skipping this cycle');
      return '';
    }

    this.isRunning = true;
    const startTime = Date.now();
    const batchId = `batch-${Date.now()}`;

    try {
      // Determine which orgs to sync
      const orgsToSync = await this.getOrganizationsToSync(specificOrgId);

      logger.info(`[PemsSyncWorker] Starting sync for ${orgsToSync.length} organizations`, {
        batchId,
        organizations: orgsToSync.map(o => o.code)
      });

      // Sync each organization
      for (const org of orgsToSync) {
        await this.syncOrganization(org.id, org.code, batchId);
      }

      // Refresh materialized views (if any exist)
      await this.refreshMaterializedViews();

      const duration = Date.now() - startTime;
      logger.info(`[PemsSyncWorker] Batch sync completed`, {
        batchId,
        duration: `${duration}ms`,
        organizations: orgsToSync.length
      });

      return batchId;

    } catch (error) {
      logger.error('[PemsSyncWorker] Batch sync failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get organizations to sync based on config
   */
  private async getOrganizationsToSync(specificOrgId?: string): Promise<Array<{ id: string; code: string }>> {
    if (specificOrgId) {
      // Sync specific organization
      const org = await prisma.organizations.findUnique({
        where: { id: specificOrgId },
        select: { id: true, code: true }
      });
      return org ? [org] : [];
    }

    if (this.config.organizations.length > 0) {
      // Sync configured organizations
      return await prisma.organizations.findMany({
        where: {
          code: { in: this.config.organizations },
          isActive: true
        },
        select: { id: true, code: true }
      });
    }

    // Sync all active organizations
    return await prisma.organizations.findMany({
      where: { isActive: true },
      select: { id: true, code: true }
    });
  }

  /**
   * Sync a single organization
   */
  private async syncOrganization(
    organizationId: string,
    organizationCode: string,
    batchId: string
  ): Promise<void> {
    const syncId = `sync-${organizationCode}-${Date.now()}`;
    const startTime = new Date();

    logger.info(`[PemsSyncWorker] Starting sync for organization ${organizationCode}`, {
      syncId,
      organizationId,
      batchId
    });

    // Create sync log entry
    const syncLog = await prisma.pfa_sync_log.create({
      data: {
        id: syncId,
        organizationId,
        syncType: 'incremental',
        syncDirection: 'read',
        batchId,
        status: 'running',
        startedAt: startTime
      }
    });

    try {
      // Find PEMS Read API configuration
      const apiConfig = await this.getPemsReadConfig(organizationId);

      if (!apiConfig) {
        logger.warn(`[PemsSyncWorker] No PEMS Read API configured for ${organizationCode}, skipping`);
        await prisma.pfa_sync_log.update({
          where: { id: syncLog.id },
          data: {
            status: 'failed',
            errorMessage: 'No PEMS Read API configuration found',
            completedAt: new Date(),
            durationMs: Date.now() - startTime.getTime()
          }
        });
        return;
      }

      // Execute sync using PemsSyncService
      const progress = await this.syncService.syncPfaData(
        organizationId,
        'incremental',
        syncId,
        apiConfig.id
      );

      // Update sync log with results
      const completedAt = new Date();
      await prisma.pfa_sync_log.update({
        where: { id: syncLog.id },
        data: {
          status: progress.status === 'completed' ? 'completed' : 'failed',
          recordsTotal: progress.totalRecords,
          recordsProcessed: progress.processedRecords,
          recordsInserted: progress.insertedRecords,
          recordsUpdated: progress.updatedRecords,
          recordsErrored: progress.errorRecords,
          errorMessage: progress.error,
          completedAt,
          durationMs: completedAt.getTime() - startTime.getTime()
        }
      });

      // Update API configuration sync tracking
      if (progress.status === 'completed') {
        const isFirstSync = !apiConfig.firstSyncAt;
        await prisma.api_configurations.update({
          where: { id: apiConfig.id },
          data: {
            firstSyncAt: isFirstSync ? completedAt : apiConfig.firstSyncAt,
            lastSyncAt: completedAt,
            lastSyncRecordCount: progress.insertedRecords + progress.updatedRecords,
            totalSyncRecordCount: isFirstSync
              ? progress.insertedRecords + progress.updatedRecords
              : (apiConfig.totalSyncRecordCount || 0) + progress.insertedRecords
          }
        });
      }

      logger.info(`[PemsSyncWorker] Completed sync for ${organizationCode}`, {
        syncId,
        status: progress.status,
        records: {
          total: progress.totalRecords,
          processed: progress.processedRecords,
          inserted: progress.insertedRecords,
          updated: progress.updatedRecords,
          errors: progress.errorRecords
        },
        duration: `${completedAt.getTime() - startTime.getTime()}ms`
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[PemsSyncWorker] Failed to sync ${organizationCode}:`, error);

      // Update sync log with error
      await prisma.pfa_sync_log.update({
        where: { id: syncLog.id },
        data: {
          status: 'failed',
          errorMessage,
          errorDetails: error instanceof Error ? { stack: error.stack } : undefined,
          completedAt: new Date(),
          durationMs: Date.now() - startTime.getTime()
        }
      });

      // Don't throw - continue with next organization
    }
  }

  /**
   * Get PEMS Read API configuration for an organization
   */
  private async getPemsReadConfig(organizationId: string): Promise<any> {
    // First check for global PEMS Read API
    const globalConfig = await prisma.api_configurations.findFirst({
      where: {
        organizationId: null,
        usage: 'PEMS_PFA',
        operationType: 'read'
      }
    });

    if (globalConfig) {
      return globalConfig;
    }

    // Fallback to org-specific config
    return await prisma.api_configurations.findFirst({
      where: {
        organizationId,
        usage: 'PEMS_PFA',
        operationType: 'read'
      }
    });
  }

  /**
   * Refresh materialized views after sync
   * NOTE: Materialized views will be created in Phase 3
   */
  private async refreshMaterializedViews(): Promise<void> {
    try {
      // Phase 3: Add materialized view refresh logic
      // await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY pfa_forecast_summary');
      logger.info('[PemsSyncWorker] Materialized views refresh (skipped - Phase 3)');
    } catch (error) {
      logger.error('[PemsSyncWorker] Failed to refresh materialized views:', error);
      // Don't throw - materialized views are optional optimization
    }
  }

  /**
   * Get current sync status
   */
  isCurrentlyRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get next scheduled run time
   */
  getNextRunTime(): Date | null {
    return this.job ? this.job.nextDate().toJSDate() : null;
  }
}

// Export singleton instance (will be initialized in server.ts)
let workerInstance: PemsSyncWorker | null = null;

export function initializeWorker(config: WorkerConfig): PemsSyncWorker {
  workerInstance = new PemsSyncWorker(config);
  return workerInstance;
}

export function getWorkerInstance(): PemsSyncWorker | null {
  return workerInstance;
}
