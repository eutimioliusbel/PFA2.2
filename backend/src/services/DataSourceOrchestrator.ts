/**
 * Data Source Orchestrator
 *
 * Manages configurable API-to-entity mapping and orchestrates sync operations.
 * This service decouples data entities from specific API implementations,
 * allowing flexible data source configuration with automatic fallback support.
 *
 * Key Features:
 * - Query active data source mappings by entity type
 * - Execute syncs using the configured primary API
 * - Automatic fallback to secondary APIs on failure
 * - Performance tracking (success/failure rates, response times)
 * - Organization-specific mapping overrides
 */

import { PrismaClient, ApiConfiguration, DataSourceMapping } from '@prisma/client';
import { PemsSyncService, SyncProgress } from './pems/PemsSyncService';
import { logger } from '../utils/logger';

export interface DataSourceInfo {
  mapping: DataSourceMapping;
  apiConfig: ApiConfiguration;
}

export class DataSourceOrchestrator {
  private prisma: PrismaClient;
  private pemsSyncService: PemsSyncService;

  constructor() {
    this.prisma = new PrismaClient();
    this.pemsSyncService = new PemsSyncService();
  }

  /**
   * Get the active API configuration for an entity type
   * @param entityType - The entity type to sync (pfa, organizations, asset_master, classifications)
   * @param organizationId - Optional org ID for org-specific overrides
   * @returns The highest priority active data source mapping and API config
   */
  async getActiveDataSource(
    entityType: string,
    organizationId?: string | null
  ): Promise<DataSourceInfo | null> {
    try {
      // First, try to find an organization-specific override (if orgId provided)
      if (organizationId) {
        const orgMapping = await this.prisma.dataSourceMapping.findFirst({
          where: {
            entityType,
            organizationId,
            isActive: true
          },
          orderBy: {
            priority: 'asc'
          },
          include: {
            apiConfig: true
          }
        });

        if (orgMapping) {
          logger.info(`Using org-specific mapping for ${entityType} (org: ${organizationId})`);
          return { mapping: orgMapping, apiConfig: orgMapping.apiConfig };
        }
      }

      // Fall back to global mapping (organizationId = null)
      const globalMapping = await this.prisma.dataSourceMapping.findFirst({
        where: {
          entityType,
          organizationId: null,
          isActive: true
        },
        orderBy: {
          priority: 'asc'
        },
        include: {
          apiConfig: true
        }
      });

      if (globalMapping) {
        logger.info(`Using global mapping for ${entityType}`);
        return { mapping: globalMapping, apiConfig: globalMapping.apiConfig };
      }

      logger.warn(`No active data source mapping found for entity type: ${entityType}`);
      return null;
    } catch (error) {
      logger.error('Error getting active data source:', error);
      throw error;
    }
  }

  /**
   * Get fallback API if primary fails
   * @param entityType - The entity type
   * @param organizationId - Optional org ID
   * @param excludeApiId - API ID that failed (skip this one)
   * @returns The next priority active data source mapping and API config
   */
  async getFallbackDataSource(
    entityType: string,
    organizationId: string | null,
    excludeApiId: string
  ): Promise<DataSourceInfo | null> {
    try {
      // Get the priority of the failed API
      const failedMapping = await this.prisma.dataSourceMapping.findFirst({
        where: {
          entityType,
          organizationId,
          apiConfigId: excludeApiId,
          isActive: true
        }
      });

      if (!failedMapping) {
        logger.warn(`Could not find failed mapping for fallback lookup`);
        return null;
      }

      // Find next priority active mapping (higher priority number = lower priority/fallback)
      const fallbackMapping = await this.prisma.dataSourceMapping.findFirst({
        where: {
          entityType,
          organizationId,
          isActive: true,
          priority: {
            gt: failedMapping.priority
          }
        },
        orderBy: {
          priority: 'asc'
        },
        include: {
          apiConfig: true
        }
      });

      if (fallbackMapping) {
        logger.info(`Using fallback mapping (priority ${fallbackMapping.priority}) for ${entityType}`);
        return { mapping: fallbackMapping, apiConfig: fallbackMapping.apiConfig };
      }

      logger.warn(`No fallback data source available for ${entityType}`);
      return null;
    } catch (error) {
      logger.error('Error getting fallback data source:', error);
      throw error;
    }
  }

  /**
   * Execute sync using the active data source
   * @param entityType - The entity type to sync
   * @param organizationId - Target organization
   * @param syncType - 'full' or 'incremental'
   * @param syncId - Optional sync ID for tracking
   * @returns Sync progress result
   */
  async executeSync(
    entityType: string,
    organizationId: string,
    syncType: 'full' | 'incremental' = 'full',
    syncId?: string
  ): Promise<SyncProgress> {
    const startTime = Date.now();
    const finalSyncId = syncId || `${entityType}-sync-${Date.now()}`;

    try {
      // Get active data source mapping
      const dataSource = await this.getActiveDataSource(entityType, organizationId);

      if (!dataSource) {
        logger.error(`No active data source configured for entity type: ${entityType}`);
        return {
          syncId: finalSyncId,
          status: 'failed',
          organizationId,
          totalRecords: 0,
          processedRecords: 0,
          insertedRecords: 0,
          updatedRecords: 0,
          errorRecords: 0,
          startedAt: new Date(),
          completedAt: new Date(),
          currentBatch: 0,
          totalBatches: 0,
          error: `No active data source mapping configured for ${entityType}`
        };
      }

      logger.info(`Executing ${syncType} sync for ${entityType} using API: ${dataSource.apiConfig.name}`);

      // Execute sync based on entity type
      let result: SyncProgress;
      try {
        result = await this.executeSyncForEntity(
          entityType,
          organizationId,
          syncType,
          finalSyncId,
          dataSource.apiConfig.id
        );

        // Record success metrics
        await this.recordSyncMetrics(
          dataSource.mapping.id,
          true,
          Date.now() - startTime
        );

        return result;
      } catch (syncError) {
        logger.error(`Sync failed with primary API (${dataSource.apiConfig.name}):`, syncError);

        // Record failure metrics
        await this.recordSyncMetrics(
          dataSource.mapping.id,
          false,
          Date.now() - startTime
        );

        // Try fallback if available
        const fallback = await this.getFallbackDataSource(
          entityType,
          dataSource.mapping.organizationId,
          dataSource.apiConfig.id
        );

        if (fallback) {
          logger.info(`Attempting fallback sync with: ${fallback.apiConfig.name}`);
          const fallbackStartTime = Date.now();

          try {
            result = await this.executeSyncForEntity(
              entityType,
              organizationId,
              syncType,
              finalSyncId,
              fallback.apiConfig.id
            );

            // Record fallback success
            await this.recordSyncMetrics(
              fallback.mapping.id,
              true,
              Date.now() - fallbackStartTime
            );

            return result;
          } catch (fallbackError) {
            logger.error(`Fallback sync also failed:`, fallbackError);

            // Record fallback failure
            await this.recordSyncMetrics(
              fallback.mapping.id,
              false,
              Date.now() - fallbackStartTime
            );

            throw fallbackError;
          }
        }

        // No fallback available, throw original error
        throw syncError;
      }
    } catch (error) {
      logger.error('Sync execution failed:', error);
      return {
        syncId: finalSyncId,
        status: 'failed',
        organizationId,
        totalRecords: 0,
        processedRecords: 0,
        insertedRecords: 0,
        updatedRecords: 0,
        errorRecords: 1,
        startedAt: new Date(),
        completedAt: new Date(),
        currentBatch: 0,
        totalBatches: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute sync for a specific entity type using the appropriate sync service method
   * @param entityType - The entity type to sync
   * @param organizationId - Target organization
   * @param syncType - 'full' or 'incremental'
   * @param syncId - Sync tracking ID
   * @param apiConfigId - API configuration ID to use
   * @returns Sync progress result
   */
  private async executeSyncForEntity(
    entityType: string,
    organizationId: string,
    syncType: 'full' | 'incremental',
    syncId: string,
    apiConfigId: string
  ): Promise<SyncProgress> {
    switch (entityType) {
      case 'pfa':
        return await this.pemsSyncService.syncPfaData(organizationId, syncType, syncId, apiConfigId);

      case 'organizations':
        return await this.pemsSyncService.syncOrganizationData(organizationId, syncType, syncId, apiConfigId);

      case 'asset_master':
        // TODO: Implement asset sync
        throw new Error('Asset master sync not yet implemented');

      case 'classifications':
        // TODO: Implement classification sync
        throw new Error('Classifications sync not yet implemented');

      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  /**
   * Record sync metrics for a mapping
   * @param mappingId - The data source mapping ID
   * @param success - Whether sync succeeded
   * @param responseTime - Sync duration in ms
   */
  async recordSyncMetrics(
    mappingId: string,
    success: boolean,
    responseTime: number
  ): Promise<void> {
    try {
      const mapping = await this.prisma.dataSourceMapping.findUnique({
        where: { id: mappingId }
      });

      if (!mapping) {
        logger.warn(`Mapping ${mappingId} not found for metrics recording`);
        return;
      }

      // Calculate new average response time
      const totalSyncs = mapping.successCount + mapping.failureCount;
      const currentAvg = mapping.avgResponseTime || 0;
      const newAvg = totalSyncs > 0
        ? Math.round((currentAvg * totalSyncs + responseTime) / (totalSyncs + 1))
        : responseTime;

      // Update metrics
      await this.prisma.dataSourceMapping.update({
        where: { id: mappingId },
        data: {
          lastUsedAt: new Date(),
          ...(success ? {
            lastSuccessAt: new Date(),
            successCount: { increment: 1 }
          } : {
            lastFailureAt: new Date(),
            failureCount: { increment: 1 }
          }),
          avgResponseTime: newAvg
        }
      });

      logger.info(`Recorded sync metrics for mapping ${mappingId}: ${success ? 'success' : 'failure'} (${responseTime}ms)`);
    } catch (error) {
      logger.error('Error recording sync metrics:', error);
      // Don't throw - metrics recording failure shouldn't break the sync
    }
  }

  /**
   * Get all data source mappings for an entity type
   * @param entityType - The entity type
   * @param organizationId - Optional org ID filter
   * @returns All mappings for the entity type
   */
  async getMappingsForEntity(
    entityType: string,
    organizationId?: string | null
  ): Promise<(DataSourceMapping & { apiConfig: ApiConfiguration })[]> {
    try {
      return await this.prisma.dataSourceMapping.findMany({
        where: {
          entityType,
          ...(organizationId !== undefined ? { organizationId } : {})
        },
        include: {
          apiConfig: true
        },
        orderBy: [
          { organizationId: 'asc' },
          { priority: 'asc' }
        ]
      });
    } catch (error) {
      logger.error('Error getting mappings for entity:', error);
      throw error;
    }
  }

  /**
   * Get performance metrics for a data source mapping
   * @param mappingId - The mapping ID
   * @returns Performance metrics
   */
  async getMappingMetrics(mappingId: string): Promise<{
    successRate: number;
    failureRate: number;
    totalSyncs: number;
    avgResponseTime: number;
    lastUsed: Date | null;
    lastSuccess: Date | null;
    lastFailure: Date | null;
  } | null> {
    try {
      const mapping = await this.prisma.dataSourceMapping.findUnique({
        where: { id: mappingId }
      });

      if (!mapping) {
        return null;
      }

      const totalSyncs = mapping.successCount + mapping.failureCount;
      const successRate = totalSyncs > 0 ? (mapping.successCount / totalSyncs) * 100 : 0;
      const failureRate = totalSyncs > 0 ? (mapping.failureCount / totalSyncs) * 100 : 0;

      return {
        successRate: Math.round(successRate * 100) / 100,
        failureRate: Math.round(failureRate * 100) / 100,
        totalSyncs,
        avgResponseTime: mapping.avgResponseTime || 0,
        lastUsed: mapping.lastUsedAt,
        lastSuccess: mapping.lastSuccessAt,
        lastFailure: mapping.lastFailureAt
      };
    } catch (error) {
      logger.error('Error getting mapping metrics:', error);
      throw error;
    }
  }

  /**
   * Cleanup - close database connection
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
