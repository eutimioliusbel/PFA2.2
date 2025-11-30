/**
 * Sync Statistics Controller
 * Phase 3, Task 3.3 - Sync Health Dashboard
 *
 * Provides sync health metrics for admin dashboard:
 * - Organization sync status (active, suspended, skipped)
 * - Last sync timestamps
 * - Skip reasons and counts
 * - Sync success/failure statistics
 */

import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { handleControllerError } from '../utils/errorHandling';

/**
 * Organization sync statistics
 */
interface OrganizationSyncStats {
  id: string;
  code: string;
  name: string;
  serviceStatus: string;
  enableSync: boolean;
  syncEnabled: boolean; // Derived: serviceStatus === 'active' && enableSync
  skipReason?: string;
  lastSyncAt?: string;
  lastSyncStatus?: 'completed' | 'failed' | 'running';
  lastSyncRecordCount?: number;
  lastSyncSkippedCount?: number;
  lastSyncErrorCount?: number;
  skipReasonBreakdown?: Record<string, number>;
}

/**
 * Overall sync health statistics
 */
interface SyncHealthStats {
  totalOrganizations: number;
  activeOrgs: number; // serviceStatus === 'active'
  syncing: number; // serviceStatus === 'active' && enableSync === true
  skipped: number; // serviceStatus !== 'active' OR enableSync === false
  suspended: number; // serviceStatus === 'suspended'
  archived: number; // serviceStatus === 'archived'
  syncDisabled: number; // enableSync === false
  organizations: OrganizationSyncStats[];
  lastUpdated: string;
}

/**
 * Get sync health statistics for all organizations
 * GET /api/sync/health
 */
export const getSyncHealthStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Fetching sync health statistics');

    // Fetch all external organizations (those that can be synced)
    const organizations = await prisma.organizations.findMany({
      where: {
        isExternal: true
      },
      orderBy: {
        code: 'asc'
      }
    });

    logger.info(`Found ${organizations.length} external organizations`);

    // Build statistics for each organization
    const orgStats: OrganizationSyncStats[] = await Promise.all(
      organizations.map(async (org): Promise<OrganizationSyncStats> => {
        const syncEnabled = org.serviceStatus === 'active' && org.enableSync;

        // Determine skip reason if not syncing
        let skipReason: string | undefined;
        if (!syncEnabled) {
          if (org.serviceStatus === 'suspended') {
            skipReason = 'Suspended';
          } else if (org.serviceStatus === 'archived') {
            skipReason = 'Archived';
          } else if (!org.enableSync) {
            skipReason = 'Sync Disabled';
          } else {
            skipReason = `Status: ${org.serviceStatus}`;
          }
        }

        // Get last sync audit log
        const lastSync = await prisma.audit_logs.findFirst({
          where: {
            organizationId: org.id,
            resource: { in: ['pfa_sync', 'all_organizations_sync'] },
            action: { in: ['sync_skipped', 'user_sync_completed', 'user_sync_failed'] }
          },
          orderBy: {
            timestamp: 'desc'
          }
        });

        let lastSyncAt: string | undefined;
        let lastSyncStatus: 'completed' | 'failed' | 'running' | undefined;
        let lastSyncRecordCount: number | undefined;
        let lastSyncSkippedCount: number | undefined;
        let lastSyncErrorCount: number | undefined;
        let skipReasonBreakdown: Record<string, number> | undefined;

        if (lastSync) {
          lastSyncAt = lastSync.timestamp.toISOString();

          if (lastSync.action === 'sync_skipped') {
            lastSyncStatus = 'failed';
            skipReason = (typeof lastSync.metadata === 'object' && lastSync.metadata !== null && 'reason' in lastSync.metadata ? lastSync.metadata.reason as string : undefined) || skipReason;
          } else if (lastSync.action === 'user_sync_completed') {
            lastSyncStatus = 'completed';
            if (typeof lastSync.metadata === 'object' && lastSync.metadata !== null) {
              lastSyncRecordCount = 'syncedUsers' in lastSync.metadata ? lastSync.metadata.syncedUsers as number : undefined;
              lastSyncSkippedCount = 'skippedUsers' in lastSync.metadata ? lastSync.metadata.skippedUsers as number : undefined;
              lastSyncErrorCount = 'errorUsers' in lastSync.metadata ? lastSync.metadata.errorUsers as number : undefined;
              skipReasonBreakdown = 'skipReasons' in lastSync.metadata ? lastSync.metadata.skipReasons as Record<string, number> : undefined;
            }
          } else if (lastSync.action === 'user_sync_failed') {
            lastSyncStatus = 'failed';
          }
        }

        return {
          id: org.id,
          code: org.code,
          name: org.name,
          serviceStatus: org.serviceStatus || 'unknown',
          enableSync: org.enableSync,
          syncEnabled,
          skipReason,
          lastSyncAt,
          lastSyncStatus,
          lastSyncRecordCount,
          lastSyncSkippedCount,
          lastSyncErrorCount,
          skipReasonBreakdown
        };
      })
    );

    // Calculate overall statistics
    const stats: SyncHealthStats = {
      totalOrganizations: organizations.length,
      activeOrgs: organizations.filter(o => o.serviceStatus === 'active').length,
      syncing: organizations.filter(o => o.serviceStatus === 'active' && o.enableSync).length,
      skipped: organizations.filter(o => o.serviceStatus !== 'active' || !o.enableSync).length,
      suspended: organizations.filter(o => o.serviceStatus === 'suspended').length,
      archived: organizations.filter(o => o.serviceStatus === 'archived').length,
      syncDisabled: organizations.filter(o => !o.enableSync).length,
      organizations: orgStats,
      lastUpdated: new Date().toISOString()
    };

    logger.info('Sync health statistics compiled', {
      totalOrgs: stats.totalOrganizations,
      syncing: stats.syncing,
      skipped: stats.skipped
    });

    res.json(stats);

  } catch (error: unknown) {
    handleControllerError(error, res, 'SyncStatsController.getSyncHealth');
  }
};

/**
 * Get detailed sync history for a specific organization
 * GET /api/sync/health/:organizationId/history
 */
export const getOrganizationSyncHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    logger.info(`Fetching sync history for organization ${organizationId}`);

    // Verify organization exists
    const organization = await prisma.organizations.findUnique({
      where: { id: organizationId }
    });

    if (!organization) {
      res.status(404).json({
        error: 'Organization not found'
      });
      return;
    }

    // Fetch sync audit logs
    const syncLogs = await prisma.audit_logs.findMany({
      where: {
        organizationId,
        resource: { in: ['pfa_sync', 'all_organizations_sync', 'pems_user_sync'] },
        action: {
          in: [
            'sync_skipped',
            'user_sync_started',
            'user_sync_completed',
            'user_sync_failed'
          ]
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limit
    });

    logger.info(`Found ${syncLogs.length} sync history entries`);

    // Format history entries
    const history = syncLogs.map((log): {
      id: string;
      action: string;
      resource: string | null;
      timestamp: string;
      success: boolean;
      metadata: unknown;
    } => ({
      id: log.id,
      action: log.action,
      resource: log.resource,
      timestamp: log.timestamp.toISOString(),
      success: log.success,
      metadata: log.metadata
    }));

    res.json({
      organizationId,
      organizationCode: organization.code,
      organizationName: organization.name,
      historyCount: syncLogs.length,
      history
    });

  } catch (error: unknown) {
    handleControllerError(error, res, 'SyncStatsController.getOrganizationSyncHistory');
  }
};

/**
 * Get skip reason summary across all organizations
 * GET /api/sync/health/skip-reasons
 */
export const getSkipReasonSummary = async (_req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Fetching skip reason summary');

    // Get all recent sync_skipped and user_sync_completed audit logs
    const skipLogs = await prisma.audit_logs.findMany({
      where: {
        action: { in: ['sync_skipped', 'user_sync_completed'] },
        timestamp: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    logger.info(`Found ${skipLogs.length} skip-related logs in last 30 days`);

    // Aggregate skip reasons
    const skipReasons: Record<string, number> = {};
    const orgSkipReasons: Record<string, Record<string, number>> = {};

    for (const log of skipLogs) {
      if (log.action === 'sync_skipped') {
        // Organization-level skip
        const reason = (typeof log.metadata === 'object' && log.metadata !== null && 'reason' in log.metadata ? log.metadata.reason as string : undefined) || 'Unknown';
        skipReasons[reason] = (skipReasons[reason] || 0) + 1;

        // Track per organization
        if (log.organizationId) {
          if (!orgSkipReasons[log.organizationId]) {
            orgSkipReasons[log.organizationId] = {};
          }
          orgSkipReasons[log.organizationId][reason] = (orgSkipReasons[log.organizationId][reason] || 0) + 1;
        }
      } else if (log.action === 'user_sync_completed') {
        // User-level skip reasons
        const skipBreakdown = (typeof log.metadata === 'object' && log.metadata !== null && 'skipReasons' in log.metadata ? log.metadata.skipReasons as Record<string, number> : undefined);
        if (skipBreakdown) {
          for (const [reason, count] of Object.entries(skipBreakdown)) {
            skipReasons[reason] = (skipReasons[reason] || 0) + (count as number);
          }
        }
      }
    }

    // Get organization names
    const orgIds = Object.keys(orgSkipReasons);
    const organizations = await prisma.organizations.findMany({
      where: {
        id: { in: orgIds }
      },
      select: {
        id: true,
        code: true,
        name: true
      }
    });

    const orgMap = new Map(organizations.map((o): [string, { id: string; code: string; name: string }] => [o.id, o]));

    // Format per-organization skip reasons
    const orgSkipSummary = Object.entries(orgSkipReasons).map(([orgId, reasons]): {
      organizationId: string;
      organizationCode: string;
      organizationName: string;
      skipReasons: Record<string, number>;
      totalSkipped: number;
    } => ({
      organizationId: orgId,
      organizationCode: orgMap.get(orgId)?.code || 'Unknown',
      organizationName: orgMap.get(orgId)?.name || 'Unknown',
      skipReasons: reasons,
      totalSkipped: Object.values(reasons).reduce((sum: number, count: number): number => sum + count, 0)
    }));

    res.json({
      period: 'Last 30 days',
      totalSkipReasons: Object.keys(skipReasons).length,
      totalSkipped: Object.values(skipReasons).reduce((sum: number, count: number): number => sum + count, 0),
      skipReasonsSummary: skipReasons,
      organizationSkipSummary: orgSkipSummary,
      lastUpdated: new Date().toISOString()
    });

  } catch (error: unknown) {
    handleControllerError(error, res, 'SyncStatsController.getSkipReasonSummary');
  }
};
