/**
 * PEMS Ingestion Service - ADR-007
 *
 * "Dumb Courier" pattern: Fetch raw data from PEMS and store in Bronze layer
 * without any transformation or validation.
 *
 * Key Principles:
 * - NO data transformation (that's Transformation Service - Phase 3)
 * - NO validation at ingestion (accept all records)
 * - FAST bulk insert (10K records per API call, <30s total)
 * - Delta sync support (only fetch records since last sync)
 * - AI Hooks: Schema fingerprinting for drift detection
 *
 * @see ADR-007-AGENT_WORKFLOW.md Phase 2
 */

import { api_endpoints, api_servers, bronze_batches } from '@prisma/client';
import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger';
import prisma from '../../config/database';
import { SchemaDriftDetector } from './SchemaDriftDetector';
import { pemsSyncServiceV2 } from './PemsSyncServiceV2';

/**
 * Result of an ingestion batch operation
 */
export interface IngestionResult {
  success: boolean;
  syncBatchId: string;
  organizationId: string;
  endpointId: string;
  entityType: string;
  recordCount: number;
  duration: number;
  schemaFingerprint: SchemaFingerprint | null;
  error?: string;
}

/**
 * Schema fingerprint for AI anomaly detection
 */
export interface SchemaFingerprint {
  fields: string[];
  types: Record<string, string>;
  sampleSize: number;
}

/**
 * Ingestion progress for real-time tracking
 */
export interface IngestionProgress {
  syncBatchId: string;
  status: 'running' | 'completed' | 'failed';
  organizationId: string;
  endpointId: string;
  entityType: string;
  totalRecords: number;
  processedRecords: number;
  currentPage: number;
  totalPages: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

// In-memory progress tracker (for polling by frontend)
const progressMap = new Map<string, IngestionProgress>();

export class PemsIngestionService {
  private readonly PAGE_SIZE = 10000;  // 10K records per API call (PEMS limit)
  private readonly BATCH_SIZE = 1000;   // 1K records per DB transaction

  /**
   * Ingest data from PEMS endpoint to Bronze layer
   * No transformation, no validation - just dump raw JSON
   *
   * @param endpointId - api_endpoints ID to sync from
   * @param syncType - "full" (all records) or "delta" (since last sync)
   * @returns IngestionResult with batch metadata
   */
  async ingestBatch(
    endpointId: string,
    syncType: 'full' | 'delta' = 'full'
  ): Promise<IngestionResult> {
    const startTime = Date.now();
    const syncBatchId = `batch-${Date.now()}-${endpointId.slice(0, 8)}`;

    logger.info(`[INGESTION] Starting ${syncType} ingestion`, {
      syncBatchId,
      endpointId
    });

    try {
      // 1. Load endpoint and server configuration
      const endpoint = await this.loadEndpointConfig(endpointId);
      if (!endpoint) {
        throw new Error(`Endpoint not found: ${endpointId}`);
      }

      const server = await this.loadServerConfig(endpoint.serverId);
      if (!server) {
        throw new Error(`Server not found: ${endpoint.serverId}`);
      }

      // 2. Initialize progress tracking
      const progress: IngestionProgress = {
        syncBatchId,
        status: 'running',
        organizationId: server.organizationId,
        endpointId: endpoint.id,
        entityType: endpoint.entity,
        totalRecords: 0,
        processedRecords: 0,
        currentPage: 0,
        totalPages: 0,
        startedAt: new Date()
      };
      progressMap.set(syncBatchId, progress);

      // 3. Calculate delta timestamp (if delta sync)
      let lastSyncTime: Date | null = null;
      if (syncType === 'delta' && endpoint.supportsDelta) {
        lastSyncTime = await this.getLastSyncTime(endpointId);
        logger.info(`[INGESTION] Delta sync from ${lastSyncTime?.toISOString() || 'beginning'}`, {
          syncBatchId
        });
      }

      // 4. Fetch all records from PEMS (paginated)
      const records: unknown[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        progress.currentPage = page;
        progressMap.set(syncBatchId, progress);

        const pageResult = await this.fetchPage(server, endpoint, page, this.PAGE_SIZE, lastSyncTime);
        records.push(...pageResult.data);

        logger.info(`[INGESTION] Fetched page ${page}`, {
          syncBatchId,
          pageSize: pageResult.data.length,
          totalFetched: records.length
        });

        hasMore = pageResult.hasMore;
        page++;

        // Update progress
        progress.totalRecords = records.length;
      }

      progress.totalPages = page - 1;
      progress.totalRecords = records.length;
      progressMap.set(syncBatchId, progress);

      // 5. Create BronzeBatch first (for foreign key constraint)
      const schemaFingerprint = this.computeSchemaFingerprint(records);

      await prisma.bronze_batches.create({
        data: {
          id: randomUUID(),
          syncBatchId,
          organizationId: server.organizationId,
          endpointId: endpoint.id,
          entityType: endpoint.entity,
          recordCount: records.length,
          validRecordCount: records.length, // All records valid at ingestion (validation happens in transform)
          invalidRecordCount: 0,
          schemaFingerprint: schemaFingerprint as object,
          syncType,
          deltaFromBatchId: syncType === 'delta' ? await this.getPreviousBatchId(endpointId) : null,
          warnings: [],
          errors: []
        }
      });

      // 6. Bulk insert to BronzeRecord in batches (NO TRANSFORMATION)
      const totalBatches = Math.ceil(records.length / this.BATCH_SIZE);

      for (let i = 0; i < records.length; i += this.BATCH_SIZE) {
        const batch = records.slice(i, i + this.BATCH_SIZE);
        const batchNumber = Math.floor(i / this.BATCH_SIZE) + 1;

        await prisma.bronze_records.createMany({
          data: batch.map((rawJson) => ({
            id: randomUUID(),
            syncBatchId,
            organizationId: server.organizationId,
            entityType: endpoint.entity,
            rawJson: rawJson as object,
            schemaVersion: this.computeSchemaHash(rawJson as object)
          }))
        });

        // Update progress
        progress.processedRecords = Math.min(i + this.BATCH_SIZE, records.length);
        progressMap.set(syncBatchId, progress);

        logger.info(`[INGESTION] Wrote batch ${batchNumber}/${totalBatches}`, {
          syncBatchId,
          processed: progress.processedRecords,
          total: records.length
        });
      }

      // 7. Update batch completion time
      await prisma.bronze_batches.update({
        where: { syncBatchId },
        data: { completedAt: new Date() }
      });

      // 7b. Detect Schema Drift (AI Hook for field mapping intelligence)
      const driftDetector = new SchemaDriftDetector();
      const drift = await driftDetector.detectDrift(endpoint.id, schemaFingerprint);

      if (drift.hasDrift) {
        await driftDetector.createAlert(endpoint.id, drift, syncBatchId);
        logger.warn(`[INGESTION] Schema drift detected`, {
          syncBatchId,
          severity: drift.severity,
          missingFields: drift.missingFields.length,
          newFields: drift.newFields.length
        });
      }

      // 8. Update endpoint last sync time
      await prisma.api_endpoints.update({
        where: { id: endpointId },
        data: { lastSyncAt: new Date() }
      });

      // 9. Finalize progress
      const duration = Date.now() - startTime;
      progress.status = 'completed';
      progress.completedAt = new Date();
      progressMap.set(syncBatchId, progress);

      logger.info(`[INGESTION] Completed ${syncType} ingestion`, {
        syncBatchId,
        recordCount: records.length,
        durationMs: duration
      });

      return {
        success: true,
        syncBatchId,
        organizationId: server.organizationId,
        endpointId: endpoint.id,
        entityType: endpoint.entity,
        recordCount: records.length,
        duration,
        schemaFingerprint
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const duration = Date.now() - startTime;

      logger.error(`[INGESTION] Failed`, {
        syncBatchId,
        endpointId,
        error: errorMessage,
        durationMs: duration
      });

      // Update progress with error
      const progress = progressMap.get(syncBatchId);
      if (progress) {
        progress.status = 'failed';
        progress.completedAt = new Date();
        progress.error = errorMessage;
        progressMap.set(syncBatchId, progress);
      }

      // Try to update batch with error
      try {
        await prisma.bronze_batches.update({
          where: { syncBatchId },
          data: {
            completedAt: new Date(),
            errors: [{ message: errorMessage, timestamp: new Date().toISOString() }]
          }
        });
      } catch {
        // Batch may not exist yet
      }

      return {
        success: false,
        syncBatchId,
        organizationId: '',
        endpointId,
        entityType: '',
        recordCount: 0,
        duration,
        schemaFingerprint: null,
        error: errorMessage
      };
    }
  }

  /**
   * Get ingestion progress by batch ID
   */
  getProgress(syncBatchId: string): IngestionProgress | null {
    return progressMap.get(syncBatchId) || null;
  }

  /**
   * Load endpoint configuration
   */
  private async loadEndpointConfig(endpointId: string): Promise<api_endpoints | null> {
    return await prisma.api_endpoints.findUnique({
      where: { id: endpointId }
    });
  }

  /**
   * Load server configuration with decrypted credentials
   */
  private async loadServerConfig(serverId: string): Promise<api_servers | null> {
    return await prisma.api_servers.findUnique({
      where: { id: serverId }
    });
  }

  /**
   * Get last successful sync timestamp for delta sync
   */
  private async getLastSyncTime(endpointId: string): Promise<Date | null> {
    const lastBatch = await prisma.bronze_batches.findFirst({
      where: {
        endpointId,
        completedAt: { not: null }
      },
      orderBy: { ingestedAt: 'desc' },
      select: { ingestedAt: true }
    });
    return lastBatch?.ingestedAt || null;
  }

  /**
   * Get previous batch ID for delta sync lineage
   */
  private async getPreviousBatchId(endpointId: string): Promise<string | null> {
    const lastBatch = await prisma.bronze_batches.findFirst({
      where: {
        endpointId,
        completedAt: { not: null }
      },
      orderBy: { ingestedAt: 'desc' },
      select: { syncBatchId: true }
    });
    return lastBatch?.syncBatchId || null;
  }

  /**
   * Fetch a single page of records from PEMS API
   * Uses PemsSyncServiceV2 unified fetch layer (supports both Grid API and REST API)
   */
  private async fetchPage(
    server: api_servers,
    endpoint: api_endpoints,
    page: number,
    pageSize: number,
    lastSyncTime: Date | null
  ): Promise<{ data: unknown[]; hasMore: boolean }> {
    // Get organization code from server's organizationId
    const organization = await prisma.organizations.findUnique({
      where: { id: server.organizationId },
      select: { code: true }
    });

    if (!organization) {
      throw new Error(`Organization not found for server ${server.id}`);
    }

    // Convert page-based to offset-based pagination
    const offset = (page - 1) * pageSize;

    // Log delta sync warning (not yet supported in unified fetch)
    if (lastSyncTime) {
      logger.info(`[INGESTION] Delta sync requested from ${lastSyncTime.toISOString()}`, {
        endpointId: endpoint.id,
        note: 'Delta filtering will be applied post-fetch if endpoint.deltaField is configured'
      });
    }

    // Use unified fetch layer (handles both Grid API and REST API)
    const result = await pemsSyncServiceV2.fetchRawData(
      server.id,
      endpoint.id,
      organization.code,
      {
        limit: pageSize,
        offset,
        includeRawResponse: false
      }
    );

    if (!result.success) {
      throw new Error(`PEMS API error: ${result.error}`);
    }

    // Determine if there are more records
    // hasMore = true if we fetched a full page AND there are more records in total
    const totalFetched = offset + result.data.length;
    const hasMore = result.data.length === pageSize && totalFetched < result.totalRecords;

    logger.info(`[INGESTION] Fetched page via unified layer`, {
      endpointId: endpoint.id,
      entity: endpoint.entity,
      page,
      pageSize,
      recordsReturned: result.data.length,
      totalRecords: result.totalRecords,
      hasMore
    });

    return { data: result.data, hasMore };
  }

  /**
   * Compute schema fingerprint for AI anomaly detection
   * Samples first 100 records to determine field names and types
   */
  private computeSchemaFingerprint(records: unknown[]): SchemaFingerprint {
    const sample = records.slice(0, 100);
    const fieldSet = new Set<string>();
    const types: Record<string, string> = {};

    sample.forEach((record) => {
      if (record && typeof record === 'object') {
        Object.entries(record as object).forEach(([key, value]) => {
          fieldSet.add(key);

          // Track the most common type for each field
          const valueType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
          if (!(key in types)) {
            types[key] = valueType;
          }
        });
      }
    });

    return {
      fields: Array.from(fieldSet).sort(),
      types,
      sampleSize: sample.length
    };
  }

  /**
   * Compute schema hash for individual record versioning
   * Used to detect when record schema changes between syncs
   */
  private computeSchemaHash(record: object): string {
    const fields = Object.keys(record).sort();
    return fields.join(',');
  }

  // =============================================================================
  // DELTA SYNC METHODS - Task 2.2
  // =============================================================================

  /**
   * Determine the optimal sync strategy for an endpoint
   * Returns "full" if first sync or delta not supported, "delta" otherwise
   */
  async determineSyncStrategy(endpointId: string): Promise<'full' | 'delta'> {
    const endpoint = await this.loadEndpointConfig(endpointId);
    if (!endpoint) {
      throw new Error(`Endpoint not found: ${endpointId}`);
    }

    // Check if endpoint supports delta
    if (!endpoint.supportsDelta || !endpoint.deltaField) {
      logger.info(`[DELTA] Endpoint ${endpointId} does not support delta sync`);
      return 'full';
    }

    // Check if we've synced before
    const lastBatch = await this.getLastBatch(endpointId);
    if (!lastBatch) {
      logger.info(`[DELTA] No previous sync found for ${endpointId}, using full sync`);
      return 'full'; // First sync must be full
    }

    logger.info(`[DELTA] Delta sync available for ${endpointId}`, {
      lastSyncAt: lastBatch.ingestedAt,
      strategy: endpoint.deltaStrategy
    });
    return 'delta';
  }

  /**
   * Get the last successful batch for an endpoint
   */
  private async getLastBatch(endpointId: string): Promise<bronze_batches | null> {
    return await prisma.bronze_batches.findFirst({
      where: {
        endpointId,
        completedAt: { not: null }
      },
      orderBy: { ingestedAt: 'desc' }
    });
  }

  /**
   * Build delta filter parameters based on endpoint strategy
   */
  buildDeltaParams(endpoint: api_endpoints, lastSyncTime: Date, maxId?: number): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    switch (endpoint.deltaStrategy) {
      case 'timestamp':
        // Timestamp-based delta: fetch records updated since last sync
        params[endpoint.deltaField as string] = lastSyncTime.toISOString();
        params['filter'] = 'gte'; // greater than or equal
        break;

      case 'id':
        // ID-based delta: fetch records with ID > max ID from last batch
        if (maxId === undefined) {
          throw new Error('maxId required for ID-based delta strategy');
        }
        params[endpoint.deltaField as string] = maxId;
        params['filter'] = 'gt'; // greater than
        break;

      case 'cursor':
        // Cursor-based delta: use cursor from previous response
        // Implementation depends on API specifics
        logger.warn(`[DELTA] Cursor strategy not yet implemented for ${endpoint.id}`);
        break;

      default:
        throw new Error(`Unsupported delta strategy: ${endpoint.deltaStrategy}`);
    }

    return params;
  }

  /**
   * Get the maximum ID from the last batch (for ID-based delta sync)
   */
  async getMaxIdFromLastBatch(endpointId: string, idField: string = 'id'): Promise<number> {
    const lastBatch = await this.getLastBatch(endpointId);
    if (!lastBatch) {
      return 0;
    }

    // Query bronze records from last batch and find max ID
    const records = await prisma.bronze_records.findMany({
      where: { syncBatchId: lastBatch.syncBatchId },
      select: { rawJson: true }
    });

    let maxId = 0;
    for (const record of records) {
      const rawData = record.rawJson as Record<string, unknown>;
      const recordId = Number(rawData[idField]) || 0;
      if (recordId > maxId) {
        maxId = recordId;
      }
    }

    logger.info(`[DELTA] Max ID from last batch: ${maxId}`, {
      endpointId,
      batchId: lastBatch.syncBatchId
    });

    return maxId;
  }

  /**
   * Validate delta sync results
   * Ensures all records in batch have timestamps >= expected min timestamp
   */
  async validateDeltaSync(
    syncBatchId: string,
    expectedMinTimestamp: Date,
    timestampField: string = 'updated_at'
  ): Promise<{ valid: boolean; invalidCount: number; sample: string[] }> {
    const records = await prisma.bronze_records.findMany({
      where: { syncBatchId },
      select: { rawJson: true },
      take: 100 // Sample first 100 records
    });

    const invalidRecords: string[] = [];

    for (const record of records) {
      const rawData = record.rawJson as Record<string, unknown>;

      // Try multiple common timestamp field names
      const timestamp = rawData[timestampField] ||
                       rawData['updatedAt'] ||
                       rawData['updated_at'] ||
                       rawData['lastModified'] ||
                       rawData['last_modified'];

      if (timestamp) {
        const recordTimestamp = new Date(timestamp as string);
        if (recordTimestamp < expectedMinTimestamp) {
          invalidRecords.push(`Record timestamp ${recordTimestamp.toISOString()} < expected ${expectedMinTimestamp.toISOString()}`);
        }
      }
    }

    if (invalidRecords.length > 0) {
      logger.warn(`[DELTA] Validation found ${invalidRecords.length} records with old timestamps`, {
        syncBatchId,
        sample: invalidRecords.slice(0, 5)
      });
    }

    return {
      valid: invalidRecords.length === 0,
      invalidCount: invalidRecords.length,
      sample: invalidRecords.slice(0, 5)
    };
  }

  /**
   * Get delta sync statistics for monitoring
   */
  async getDeltaSyncStats(endpointId: string): Promise<{
    totalFullSyncs: number;
    totalDeltaSyncs: number;
    avgFullSyncRecords: number;
    avgDeltaSyncRecords: number;
    deltaSyncRatio: number;
  }> {
    const batches = await prisma.bronze_batches.findMany({
      where: {
        endpointId,
        completedAt: { not: null }
      },
      select: {
        syncType: true,
        recordCount: true
      }
    });

    const fullSyncs = batches.filter((b: { syncType: string }) => b.syncType === 'full');
    const deltaSyncs = batches.filter((b: { syncType: string }) => b.syncType === 'delta');

    const avgFullRecords = fullSyncs.length > 0
      ? fullSyncs.reduce((sum: number, b: { recordCount: number }) => sum + b.recordCount, 0) / fullSyncs.length
      : 0;

    const avgDeltaRecords = deltaSyncs.length > 0
      ? deltaSyncs.reduce((sum: number, b: { recordCount: number }) => sum + b.recordCount, 0) / deltaSyncs.length
      : 0;

    return {
      totalFullSyncs: fullSyncs.length,
      totalDeltaSyncs: deltaSyncs.length,
      avgFullSyncRecords: Math.round(avgFullRecords),
      avgDeltaSyncRecords: Math.round(avgDeltaRecords),
      deltaSyncRatio: batches.length > 0 ? deltaSyncs.length / batches.length : 0
    };
  }

  /**
   * Auto-ingest with automatic strategy selection
   * Convenience method that determines best sync strategy and executes
   */
  async autoIngest(endpointId: string): Promise<IngestionResult> {
    const strategy = await this.determineSyncStrategy(endpointId);

    logger.info(`[INGESTION] Auto-selected ${strategy} sync for endpoint ${endpointId}`);

    return this.ingestBatch(endpointId, strategy);
  }
}

// Singleton export
export const pemsIngestionService = new PemsIngestionService();
