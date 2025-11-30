import { CronJob } from 'cron';
import { logger } from '../../utils/logger';
import { BronzePruningService } from './BronzePruningService';
import { pemsWriteSyncWorker } from '../pems/PemsWriteSyncWorker';

/**
 * Cron Job Scheduler
 *
 * Manages all scheduled tasks:
 * - Bronze layer pruning (daily at 2 AM)
 * - PEMS write sync worker (every 1 minute)
 * - Health checks (configurable)
 * - Data quality audits (future)
 *
 * Uses node-cron for scheduling
 */

let bronzePruningJob: CronJob | null = null;
let pemsWriteSyncJob: CronJob | null = null;

export interface CronConfig {
  enableBronzePruning: boolean;
  bronzePruningSchedule: string;
  bronzeRetentionDays: number;
  enableArchival: boolean;
  enablePemsWriteSync: boolean;
  pemsWriteSyncSchedule: string;
}

/**
 * Initialize all cron jobs based on config
 */
export function initializeCronJobs(config?: Partial<CronConfig>): void {
  const finalConfig: CronConfig = {
    enableBronzePruning: config?.enableBronzePruning ?? true,
    bronzePruningSchedule: config?.bronzePruningSchedule ?? '0 2 * * *', // Daily at 2 AM
    bronzeRetentionDays: config?.bronzeRetentionDays ?? 90,
    enableArchival: config?.enableArchival ?? false,
    enablePemsWriteSync: config?.enablePemsWriteSync ?? true,
    pemsWriteSyncSchedule: config?.pemsWriteSyncSchedule ?? '* * * * *', // Every 1 minute
  };

  logger.info('[CronScheduler] Initializing cron jobs', finalConfig);

  // Initialize Bronze Pruning Job
  if (finalConfig.enableBronzePruning) {
    bronzePruningJob = new CronJob(
      finalConfig.bronzePruningSchedule,
      async () => {
        logger.info('[CronJob] Starting Bronze pruning job');
        const pruningService = new BronzePruningService({
          retentionDays: finalConfig.bronzeRetentionDays,
          enableArchival: finalConfig.enableArchival,
          dryRun: false,
        });

        try {
          const result = await pruningService.pruneBronzeRecords();
          logger.info('[CronJob] Bronze pruning complete', result);
        } catch (error) {
          logger.error('[CronJob] Bronze pruning failed', { error });
        }
      },
      null, // onComplete
      true, // start immediately
      'America/New_York' // timezone
    );

    logger.info(`[CronScheduler] Bronze pruning job scheduled: ${finalConfig.bronzePruningSchedule}`);
  } else {
    logger.info('[CronScheduler] Bronze pruning job disabled');
  }

  // Initialize PEMS Write Sync Job (ADR-008 Phase 2, Track A)
  if (finalConfig.enablePemsWriteSync) {
    pemsWriteSyncJob = new CronJob(
      finalConfig.pemsWriteSyncSchedule,
      async () => {
        logger.debug('[CronJob] Starting PEMS write sync job');

        try {
          await pemsWriteSyncWorker.start();
          logger.debug('[CronJob] PEMS write sync job complete');
        } catch (error) {
          logger.error('[CronJob] PEMS write sync job failed', { error });
        }
      },
      null, // onComplete
      true, // start immediately
      'America/New_York' // timezone
    );

    logger.info(`[CronScheduler] PEMS write sync job scheduled: ${finalConfig.pemsWriteSyncSchedule}`);
  } else {
    logger.info('[CronScheduler] PEMS write sync job disabled');
  }
}

/**
 * Stop all cron jobs gracefully
 */
export function stopCronJobs(): void {
  logger.info('[CronScheduler] Stopping cron jobs');

  if (bronzePruningJob) {
    bronzePruningJob.stop();
    logger.info('[CronScheduler] Bronze pruning job stopped');
  }

  if (pemsWriteSyncJob) {
    pemsWriteSyncJob.stop();
    logger.info('[CronScheduler] PEMS write sync job stopped');
  }
}

/**
 * Get status of all cron jobs
 */
export function getCronJobStatus(): {
  bronzePruning: {
    enabled: boolean;
    nextRun: Date | null;
  };
  pemsWriteSync: {
    enabled: boolean;
    nextRun: Date | null;
  };
} {
  return {
    bronzePruning: {
      enabled: bronzePruningJob !== null,
      nextRun: bronzePruningJob ? bronzePruningJob.nextDate().toJSDate() : null,
    },
    pemsWriteSync: {
      enabled: pemsWriteSyncJob !== null,
      nextRun: pemsWriteSyncJob ? pemsWriteSyncJob.nextDate().toJSDate() : null,
    },
  };
}
