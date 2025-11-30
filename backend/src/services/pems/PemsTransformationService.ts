/**
 * PEMS Transformation Service - ADR-007
 *
 * Transforms Bronze layer records to Silver layer (PfaRecord) using
 * configurable field mappings.
 *
 * Key Principles:
 * - Bronze records are NEVER modified (immutable)
 * - Mapping rules are READ from database (not hardcoded)
 * - Data lineage tracks Bronze -> Silver transformation
 * - Time Travel: Uses mapping rules with validFrom/validTo matching Bronze.ingestedAt
 *
 * @see ADR-007-AGENT_WORKFLOW.md Phase 3
 */

import { bronze_records, api_field_mappings, pfa_records } from '@prisma/client';
import { format, parse, add, sub } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const jsonLogic = require('json-logic-js');
import { logger } from '../../utils/logger';
import prisma from '../../config/database';

/**
 * Result of a transformation batch operation
 */
export interface TransformationResult {
  success: boolean;
  syncBatchId: string;
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ recordId: string; error: string }>;
  duration: number;
  orphansDetected?: number;
}

/**
 * Progress tracking for UI polling
 */
export interface TransformationProgress {
  syncBatchId: string;
  status: 'running' | 'completed' | 'failed';
  totalRecords: number;
  processedRecords: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

/**
 * Options for transformation batch processing
 */
export interface TransformationOptions {
  /** Set true for full sync (triggers orphan detection) */
  fullSync?: boolean;
  /** Override date for Time Travel replay (uses mapping rules from that date) */
  replayDate?: Date;
  /** User ID performing transformation (for audit) */
  transformedBy?: string;
}

// In-memory progress tracker
const progressMap = new Map<string, TransformationProgress>();

export class PemsTransformationService {
  private readonly BATCH_SIZE = 1000;  // Records per transaction

  /**
   * Transform Bronze records to Silver layer (PfaRecord)
   * Applies field mappings from ApiFieldMapping table with Time Travel support
   *
   * @param syncBatchId - Bronze batch to process
   * @param options - Transformation options
   * @returns TransformationResult with statistics
   */
  async transformBatch(
    syncBatchId: string,
    options: TransformationOptions = {}
  ): Promise<TransformationResult> {
    const startTime = Date.now();
    const transformedBy = options.transformedBy || 'PemsTransformationService';

    logger.info(`[TRANSFORM] Starting transformation`, {
      syncBatchId,
      fullSync: options.fullSync,
      replayDate: options.replayDate?.toISOString()
    });

    try {
      // 1. Load batch metadata
      const batch = await prisma.bronze_batches.findUnique({
        where: { syncBatchId }
      });

      if (!batch) {
        throw new Error(`Bronze batch not found: ${syncBatchId}`);
      }

      // 2. Determine effective date for Time Travel
      const effectiveDate = options.replayDate || batch.ingestedAt;

      // 3. Load endpoint with active field mappings (Time Travel aware)
      const endpoint = await prisma.api_endpoints.findUnique({
        where: { id: batch.endpointId }
      });

      if (!endpoint) {
        throw new Error(`Endpoint not found: ${batch.endpointId}`);
      }

      // Load mappings active at effectiveDate (Time Travel Support)
      const mappings = await prisma.api_field_mappings.findMany({
        where: {
          endpointId: endpoint.id,
          isActive: true,
          validFrom: { lte: effectiveDate },
          OR: [
            { validTo: null },
            { validTo: { gte: effectiveDate } }
          ]
        }
      });

      if (mappings.length === 0) {
        logger.warn(`[TRANSFORM] No active mappings for endpoint ${endpoint.id}`, {
          syncBatchId,
          effectiveDate
        });
      }

      // 4. Initialize progress tracking
      const progress: TransformationProgress = {
        syncBatchId,
        status: 'running',
        totalRecords: batch.recordCount,
        processedRecords: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        startedAt: new Date()
      };
      progressMap.set(syncBatchId, progress);

      // 5. Process Bronze records in batches
      const results: TransformationResult = {
        success: true,
        syncBatchId,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [],
        duration: 0
      };

      let cursor: string | undefined = undefined;
      let processedCount = 0;

      while (true) {
        // Fetch next batch of Bronze records
        const bronzeRecords: bronze_records[] = await prisma.bronze_records.findMany({
          where: { syncBatchId },
          take: this.BATCH_SIZE,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          orderBy: { id: 'asc' }
        });

        if (bronzeRecords.length === 0) {
          break;
        }

        // Process batch within transaction
        await prisma.$transaction(async (tx) => {
          for (const bronze of bronzeRecords) {
            try {
              const rawJson = bronze.rawJson as Record<string, unknown>;

              // 5a. Apply Promotion Filters (Quality Gate)
              const promotionRules = endpoint.promotionRules;
              if (!this.passesPromotionRules(rawJson, promotionRules)) {
                results.skipped++;
                continue;
              }

              // 5b. Apply Field Mappings
              const mapped = this.applyFieldMappings(rawJson, mappings);

              // Ensure required fields
              if (!mapped.id || !mapped.pfaId) {
                results.skipped++;
                continue;
              }

              // 5c. Upsert to Silver (pfa_records)
              const existingRecord = await tx.pfa_records.findUnique({
                where: { id: mapped.id as string }
              });

              if (existingRecord) {
                await tx.pfa_records.update({
                  where: { id: mapped.id as string },
                  data: {
                    ...this.sanitizeForPfaRecord(mapped),
                    lastSeenAt: new Date(),
                    bronzeRecordId: bronze.id
                  }
                });
                results.updated++;
              } else {
                await tx.pfa_records.create({
                  data: {
                    ...this.sanitizeForPfaRecord(mapped),
                    id: mapped.id as string,
                    pfaId: mapped.pfaId as string,
                    organizationId: batch.organizationId,
                    lastSeenAt: new Date(),
                    bronzeRecordId: bronze.id,
                    updatedAt: new Date()
                  }
                });
                results.inserted++;
              }

              // 5d. Create/Update Data Lineage (AI Hook)
              await tx.data_lineage.upsert({
                where: { silverRecordId: mapped.id as string },
                create: {
                  id: uuidv4(),
                  silverRecordId: mapped.id as string,
                  silverModel: 'pfa_records',
                  bronzeRecordId: bronze.id,
                  mappingRules: mappings.map(m => ({
                    id: m.id,
                    sourceField: m.sourceField,
                    destinationField: m.destinationField,
                    transformType: m.transformType,
                    transformParams: m.transformParams
                  })),
                  transformedAt: new Date(),
                  transformedBy
                },
                update: {
                  bronzeRecordId: bronze.id,
                  mappingRules: mappings.map(m => ({
                    id: m.id,
                    sourceField: m.sourceField,
                    destinationField: m.destinationField,
                    transformType: m.transformType,
                    transformParams: m.transformParams
                  })),
                  transformedAt: new Date(),
                  transformedBy
                }
              });

            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              results.errors.push({
                recordId: bronze.id,
                error: errorMsg
              });

              logger.warn(`[TRANSFORM] Record error`, {
                syncBatchId,
                bronzeId: bronze.id,
                error: errorMsg
              });
            }
          }
        });

        // Update cursor and progress
        cursor = bronzeRecords[bronzeRecords.length - 1].id;
        processedCount += bronzeRecords.length;

        progress.processedRecords = processedCount;
        progress.inserted = results.inserted;
        progress.updated = results.updated;
        progress.skipped = results.skipped;
        progress.errors = results.errors.length;
        progressMap.set(syncBatchId, progress);

        logger.info(`[TRANSFORM] Processed batch`, {
          syncBatchId,
          processed: processedCount,
          total: batch.recordCount
        });
      }

      // 6. Orphan Detection (Full Sync Only)
      if (options.fullSync) {
        const orphanResult = await this.flagOrphanedRecords(
          batch.organizationId,
          syncBatchId
        );
        results.orphansDetected = orphanResult.flagged;

        logger.info(`[TRANSFORM] Orphan detection complete`, {
          syncBatchId,
          flagged: orphanResult.flagged,
          total: orphanResult.total
        });
      }

      // 7. Record Transformation Metrics
      await this.recordTransformationMetrics(syncBatchId, mappings, results);

      // 8. Finalize
      const duration = Date.now() - startTime;
      results.duration = duration;

      progress.status = 'completed';
      progress.completedAt = new Date();
      progressMap.set(syncBatchId, progress);

      logger.info(`[TRANSFORM] Completed`, {
        syncBatchId,
        inserted: results.inserted,
        updated: results.updated,
        skipped: results.skipped,
        errors: results.errors.length,
        duration
      });

      return results;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const duration = Date.now() - startTime;

      logger.error(`[TRANSFORM] Failed`, {
        syncBatchId,
        error: errorMessage,
        duration
      });

      // Update progress with error
      const progress = progressMap.get(syncBatchId);
      if (progress) {
        progress.status = 'failed';
        progress.completedAt = new Date();
        progress.error = errorMessage;
        progressMap.set(syncBatchId, progress);
      }

      return {
        success: false,
        syncBatchId,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [{ recordId: 'batch', error: errorMessage }],
        duration
      };
    }
  }

  /**
   * Get transformation progress by batch ID
   */
  getProgress(syncBatchId: string): TransformationProgress | null {
    return progressMap.get(syncBatchId) || null;
  }

  /**
   * Apply field mappings with transformations
   * Returns a mapped object with destination field names
   */
  applyFieldMappings(
    rawJson: Record<string, unknown>,
    mappings: api_field_mappings[]
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const mapping of mappings) {
      try {
        let value = rawJson[mapping.sourceField];

        // Apply default if missing
        if (value === null || value === undefined) {
          value = mapping.defaultValue ?? undefined;
        }

        // Skip if still no value
        if (value === null || value === undefined) {
          continue;
        }

        // Apply transformation
        if (mapping.transformType && mapping.transformType !== 'direct') {
          const params = (mapping.transformParams as Record<string, unknown>) || {};
          value = this.transform(value, mapping.transformType, params, rawJson);
        }

        // Cast data type
        value = this.castType(value, mapping.dataType);

        result[mapping.destinationField] = value;

      } catch (error) {
        logger.warn(`[TRANSFORM] Mapping error`, {
          sourceField: mapping.sourceField,
          destinationField: mapping.destinationField,
          error: error instanceof Error ? error.message : 'Unknown'
        });
      }
    }

    return result;
  }

  /**
   * Transform value based on transformType
   * Supports: direct, uppercase, lowercase, trim, replace, substring, concat,
   * multiply, divide, round, floor, ceil, date_format, date_add, date_subtract,
   * date_parse, default, map
   */
  private transform(
    value: unknown,
    type: string,
    params: Record<string, unknown>,
    fullRecord?: Record<string, unknown>
  ): unknown {
    switch (type) {
      // TEXT TRANSFORMS
      case 'direct':
        return value;

      case 'uppercase':
        return String(value).toUpperCase();

      case 'lowercase':
        return String(value).toLowerCase();

      case 'trim':
        return String(value).trim();

      case 'replace': {
        const pattern = String(params.pattern || '');
        const flags = String(params.flags || 'g');
        const replacement = String(params.replacement || '');
        return String(value).replace(new RegExp(pattern, flags), replacement);
      }

      case 'substring': {
        const start = Number(params.start) || 0;
        const end = params.end ? Number(params.end) : undefined;
        return String(value).substring(start, end);
      }

      case 'concat': {
        const fields = (params.fields as string[]) || [];
        const separator = String(params.separator || '');
        if (fullRecord && fields.length > 0) {
          return fields
            .map(fieldName => fullRecord[fieldName] || '')
            .join(separator);
        }
        return value;
      }

      // NUMBER TRANSFORMS
      case 'multiply': {
        const multiplier = Number(params.multiplier) || 1;
        return Number(value) * multiplier;
      }

      case 'divide': {
        const divisor = Number(params.divisor) || 1;
        return Number(value) / divisor;
      }

      case 'round': {
        const decimals = Number(params.decimals) || 0;
        const factor = Math.pow(10, decimals);
        return Math.round(Number(value) * factor) / factor;
      }

      case 'floor':
        return Math.floor(Number(value));

      case 'ceil':
        return Math.ceil(Number(value));

      // DATE TRANSFORMS
      case 'date_format': {
        const formatStr = String(params.format || 'yyyy-MM-dd');
        const dateValue = value instanceof Date ? value : new Date(value as string);
        return format(dateValue, formatStr);
      }

      case 'date_add': {
        const amount = Number(params.amount) || 0;
        const unit = String(params.unit || 'days');
        const dateValue = value instanceof Date ? value : new Date(value as string);
        return add(dateValue, { [unit]: amount });
      }

      case 'date_subtract': {
        const amount = Number(params.amount) || 0;
        const unit = String(params.unit || 'days');
        const dateValue = value instanceof Date ? value : new Date(value as string);
        return sub(dateValue, { [unit]: amount });
      }

      case 'date_parse': {
        const inputFormat = String(params.inputFormat || 'yyyy-MM-dd');
        return parse(String(value), inputFormat, new Date());
      }

      // CONDITIONAL TRANSFORMS
      case 'default':
        return value || params.defaultValue;

      case 'map': {
        const mapping = (params.mapping as Record<string, unknown>) || {};
        return mapping[String(value)] ?? value;
      }

      case 'lookup':
        // Future: External table lookup
        logger.warn(`[TRANSFORM] Lookup transform not yet implemented`);
        return value;

      default:
        return value;
    }
  }

  /**
   * Cast value to target data type
   */
  private castType(value: unknown, dataType: string): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    switch (dataType) {
      case 'string':
        return String(value);

      case 'number':
        return Number(value);

      case 'boolean':
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true' || value === '1';
        }
        return Boolean(value);

      case 'date':
        if (value instanceof Date) {
          return value;
        }
        return new Date(value as string);

      case 'json':
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        }
        return value;

      default:
        return value;
    }
  }

  /**
   * Check if record passes promotion filters (JsonLogic)
   * Empty rules = promote all records
   */
  private passesPromotionRules(
    record: Record<string, unknown>,
    rules: unknown
  ): boolean {
    // No rules = promote all
    if (!rules) {
      return true;
    }

    // Empty array = promote all
    if (Array.isArray(rules) && rules.length === 0) {
      return true;
    }

    // Empty object = promote all
    if (typeof rules === 'object' && Object.keys(rules as object).length === 0) {
      return true;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const result = jsonLogic.apply(rules, record);
      return Boolean(result);
    } catch (error) {
      logger.warn(`[TRANSFORM] JsonLogic evaluation error`, {
        error: error instanceof Error ? error.message : 'Unknown'
      });
      return true; // Default to promote on error
    }
  }

  /**
   * Sanitize mapped data for pfa_records model
   * Only include valid pfa_records fields
   */
  private sanitizeForPfaRecord(mapped: Record<string, unknown>): Partial<pfa_records> {
    const allowedFields = [
      'pfaId', 'areaSilo', 'category', 'forecastCategory', 'class', 'source',
      'dor', 'isActualized', 'isDiscontinued', 'isFundsTransferable',
      'monthlyRate', 'purchasePrice', 'manufacturer', 'model',
      'originalStart', 'originalEnd', 'hasPlan', 'forecastStart', 'forecastEnd',
      'actualStart', 'actualEnd', 'hasActuals', 'contract', 'equipment',
      'lastModified', 'lastModifiedBy', 'vendorName'
    ];

    const sanitized: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (field in mapped && mapped[field] !== undefined) {
        sanitized[field] = mapped[field];
      }
    }

    return sanitized as Partial<pfa_records>;
  }

  /**
   * Flag records not seen in this sync as orphaned
   * Called after full sync to detect deleted records in source
   */
  private async flagOrphanedRecords(
    organizationId: string,
    syncBatchId: string
  ): Promise<{ flagged: number; total: number }> {
    // Get batch ingestion time as cutoff
    const batch = await prisma.bronze_batches.findUnique({
      where: { syncBatchId },
      select: { ingestedAt: true }
    });

    if (!batch) {
      return { flagged: 0, total: 0 };
    }

    // Count current active records
    const totalActive = await prisma.pfa_records.count({
      where: {
        organizationId,
        isDiscontinued: false
      }
    });

    // Flag orphaned records (not seen in this sync)
    const result = await prisma.pfa_records.updateMany({
      where: {
        organizationId,
        lastSeenAt: { lt: batch.ingestedAt },
        isDiscontinued: false
      },
      data: {
        isDiscontinued: true
      }
    });

    logger.info(`[TRANSFORM] Orphan Detection`, {
      organizationId,
      flagged: result.count,
      totalActive
    });

    return {
      flagged: result.count,
      total: totalActive
    };
  }

  /**
   * Record transformation metrics for performance monitoring
   */
  private async recordTransformationMetrics(
    syncBatchId: string,
    mappings: api_field_mappings[],
    results: TransformationResult
  ): Promise<void> {
    try {
      const recordsProcessed = results.inserted + results.updated + results.skipped;

      // Create aggregate metric for the batch
      await prisma.transformation_metrics.create({
        data: {
          id: uuidv4(),
          mappingId: mappings[0]?.id || 'batch',
          batchId: syncBatchId,
          recordsProcessed,
          totalLatency: results.duration,
          avgLatency: recordsProcessed > 0 ? results.duration / recordsProcessed : 0,
          errorCount: results.errors.length
        }
      });

    } catch (error) {
      logger.warn(`[TRANSFORM] Failed to record metrics`, {
        syncBatchId,
        error: error instanceof Error ? error.message : 'Unknown'
      });
    }
  }

  /**
   * Replay transformation using historical mapping rules
   * Time Travel feature: Re-transform Bronze data using rules from replayDate
   *
   * @param startDate - Start of date range for batches to replay
   * @param endDate - End of date range for batches to replay
   * @param replayDate - Date to use for mapping rules (defaults to current)
   */
  async replayTransformations(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    replayDate?: Date
  ): Promise<{
    batchCount: number;
    recordCount: number;
    results: TransformationResult[];
  }> {
    logger.info(`[TRANSFORM] Starting replay`, {
      organizationId,
      startDate,
      endDate,
      replayDate
    });

    // Find batches in date range
    const batches = await prisma.bronze_batches.findMany({
      where: {
        organizationId,
        ingestedAt: {
          gte: startDate,
          lte: endDate
        },
        completedAt: { not: null }
      },
      orderBy: { ingestedAt: 'asc' }
    });

    const results: TransformationResult[] = [];
    let totalRecords = 0;

    for (const batch of batches) {
      const result = await this.transformBatch(batch.syncBatchId, {
        fullSync: false,
        replayDate,
        transformedBy: 'ReplayService'
      });

      results.push(result);
      totalRecords += result.inserted + result.updated;
    }

    logger.info(`[TRANSFORM] Replay complete`, {
      organizationId,
      batchCount: batches.length,
      totalRecords
    });

    return {
      batchCount: batches.length,
      recordCount: totalRecords,
      results
    };
  }

  /**
   * Calculate replay impact without executing
   * Used by UI to show user what will be affected
   */
  async calculateReplayImpact(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    batchCount: number;
    recordCount: number;
    silverRecordCount: number;
    dateRange: { start: Date; end: Date };
  }> {
    // Count batches
    const batchCount = await prisma.bronze_batches.count({
      where: {
        organizationId,
        ingestedAt: { gte: startDate, lte: endDate },
        completedAt: { not: null }
      }
    });

    // Count Bronze records
    const batches = await prisma.bronze_batches.findMany({
      where: {
        organizationId,
        ingestedAt: { gte: startDate, lte: endDate },
        completedAt: { not: null }
      },
      select: { syncBatchId: true }
    });

    const batchIds = batches.map((b: { syncBatchId: string }) => b.syncBatchId);

    const recordCount = await prisma.bronze_records.count({
      where: { syncBatchId: { in: batchIds } }
    });

    // Count affected Silver records
    const silverRecordCount = await prisma.data_lineage.count({
      where: { bronzeRecordId: { in: batchIds } }
    });

    return {
      batchCount,
      recordCount,
      silverRecordCount,
      dateRange: { start: startDate, end: endDate }
    };
  }
}

// Singleton export
export const pemsTransformationService = new PemsTransformationService();
