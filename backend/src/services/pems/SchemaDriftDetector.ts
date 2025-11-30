/**
 * Schema Drift Detector - ADR-007 Task 2.3
 *
 * Detects schema changes between PEMS API responses to alert admins
 * when field mappings may need updating.
 *
 * Critical Use Case:
 * PEMS changes field names without warning (e.g., 'udf_char_01' -> 'category'),
 * breaking field mappings silently. This detector compares schema fingerprints
 * between batches and alerts when significant changes are detected.
 *
 * Severity Thresholds:
 * - HIGH: >20% fields missing OR >5 new fields
 * - MEDIUM: >10% fields missing OR >2 new fields
 * - LOW: Minor changes
 *
 * @see ADR-007-AGENT_WORKFLOW.md Phase 2, Task 2.3
 */

import prisma from '../../config/database';
import { logger } from '../../utils/logger';
import { SchemaFingerprint } from './PemsIngestionService';

/**
 * Result of schema drift analysis
 */
export interface SchemaDrift {
  hasDrift: boolean;
  missingFields: string[];
  newFields: string[];
  changedTypes: Record<string, { was: string; now: string }>;
  severity: 'low' | 'medium' | 'high';
  metrics: {
    baselineFieldCount: number;
    newFieldCount: number;
    missingPercent: number;
    addedCount: number;
    typeChangeCount: number;
  };
}

/**
 * Schema drift alert for storage in BronzeBatch
 */
export interface SchemaDriftAlert {
  type: 'SCHEMA_DRIFT';
  severity: 'low' | 'medium' | 'high';
  message: string;
  details: SchemaDrift;
  timestamp: string;
}

export class SchemaDriftDetector {
  /**
   * Detect schema drift between baseline (last batch) and new batch
   *
   * @param endpointId - API endpoint ID to check
   * @param newFingerprint - Schema fingerprint from new batch
   * @returns Drift analysis result
   */
  async detectDrift(
    endpointId: string,
    newFingerprint: SchemaFingerprint
  ): Promise<SchemaDrift> {
    logger.info(`[SCHEMA DRIFT] Analyzing schema drift for endpoint ${endpointId}`);

    // 1. Get baseline fingerprint (from most recent completed batch)
    const baseline = await this.getBaselineFingerprint(endpointId);

    if (!baseline) {
      // First sync - no drift possible, this becomes the baseline
      logger.info(`[SCHEMA DRIFT] No baseline found for ${endpointId}, setting new fingerprint as baseline`);
      return {
        hasDrift: false,
        missingFields: [],
        newFields: [],
        changedTypes: {},
        severity: 'low',
        metrics: {
          baselineFieldCount: 0,
          newFieldCount: newFingerprint.fields.length,
          missingPercent: 0,
          addedCount: newFingerprint.fields.length,
          typeChangeCount: 0
        }
      };
    }

    // 2. Compare field lists
    const baselineFields = new Set(baseline.fields);
    const currentFields = new Set(newFingerprint.fields);

    const missingFields = baseline.fields.filter(f => !currentFields.has(f));
    const addedFields = newFingerprint.fields.filter(f => !baselineFields.has(f));

    // 3. Compare field types for common fields
    const changedTypes: Record<string, { was: string; now: string }> = {};
    for (const field of baseline.fields) {
      if (currentFields.has(field)) {
        const oldType = baseline.types[field];
        const newType = newFingerprint.types[field];
        if (oldType && newType && oldType !== newType) {
          changedTypes[field] = { was: oldType, now: newType };
        }
      }
    }

    // 4. Calculate metrics
    const baselineFieldCount = baseline.fields.length;
    const missingPercent = baselineFieldCount > 0
      ? (missingFields.length / baselineFieldCount) * 100
      : 0;
    const addedCount = addedFields.length;
    const typeChangeCount = Object.keys(changedTypes).length;

    // 5. Calculate severity based on thresholds
    let severity: 'low' | 'medium' | 'high' = 'low';

    if (missingPercent > 20 || addedCount > 5 || typeChangeCount > 3) {
      severity = 'high'; // Critical change - may break mappings
    } else if (missingPercent > 10 || addedCount > 2 || typeChangeCount > 1) {
      severity = 'medium'; // Moderate change - review recommended
    }

    // 6. Check for critical field removals
    const criticalFields = ['id', 'pfa_id', 'organization_id', 'cost', 'rate'];
    const missingCriticalFields = missingFields.filter(f =>
      criticalFields.some(cf => f.toLowerCase().includes(cf))
    );
    if (missingCriticalFields.length > 0) {
      severity = 'high'; // Any missing critical field is high severity
      logger.error(`[SCHEMA DRIFT] Critical fields missing: ${missingCriticalFields.join(', ')}`);
    }

    const hasDrift = missingFields.length > 0 || addedFields.length > 0 || typeChangeCount > 0;

    if (hasDrift) {
      logger.warn(`[SCHEMA DRIFT] Detected ${severity} drift for ${endpointId}`, {
        missingFields,
        addedFields,
        changedTypes,
        metrics: { missingPercent, addedCount, typeChangeCount }
      });
    }

    return {
      hasDrift,
      missingFields,
      newFields: addedFields,
      changedTypes,
      severity,
      metrics: {
        baselineFieldCount,
        newFieldCount: newFingerprint.fields.length,
        missingPercent: Math.round(missingPercent * 100) / 100,
        addedCount,
        typeChangeCount
      }
    };
  }

  /**
   * Get baseline schema fingerprint from the most recent completed batch
   */
  private async getBaselineFingerprint(endpointId: string): Promise<SchemaFingerprint | null> {
    const lastBatch = await prisma.bronze_batches.findFirst({
      where: {
        endpointId,
        completedAt: { not: null }
      },
      orderBy: { ingestedAt: 'desc' },
      select: { schemaFingerprint: true }
    });

    if (!lastBatch?.schemaFingerprint) {
      return null;
    }

    // Parse the JSON fingerprint
    const fingerprint = lastBatch.schemaFingerprint as {
      fields?: string[];
      types?: Record<string, string>;
      sampleSize?: number;
    };

    return {
      fields: fingerprint.fields || [],
      types: fingerprint.types || {},
      sampleSize: fingerprint.sampleSize || 0
    };
  }

  /**
   * Create a schema drift alert and store it in the batch warnings
   *
   * @param endpointId - API endpoint ID
   * @param drift - Drift analysis result
   * @param syncBatchId - Batch ID to attach alert to
   */
  async createAlert(
    endpointId: string,
    drift: SchemaDrift,
    syncBatchId: string
  ): Promise<void> {
    if (!drift.hasDrift || drift.severity === 'low') {
      return; // No alert needed for low severity
    }

    // Get endpoint details for the alert message
    const endpoint = await prisma.api_endpoints.findUnique({
      where: { id: endpointId },
      select: { name: true, path: true }
    });

    const endpointName = endpoint?.name || endpointId;
    const message = this.buildAlertMessage(endpointName, drift);

    // Create the alert object
    const alert: SchemaDriftAlert = {
      type: 'SCHEMA_DRIFT',
      severity: drift.severity,
      message,
      details: drift,
      timestamp: new Date().toISOString()
    };

    // Get current warnings and append new alert
    const batch = await prisma.bronze_batches.findUnique({
      where: { syncBatchId },
      select: { warnings: true }
    });

    const currentWarnings = Array.isArray(batch?.warnings) ? batch.warnings : [];
    const updatedWarnings = [...currentWarnings, alert];

    // Store alert in BronzeBatch warnings
    // Cast to any to work around Prisma's strict JSON type checking
    await prisma.bronze_batches.update({
      where: { syncBatchId },
      data: {
        warnings: updatedWarnings as object
      }
    });

    logger.warn(`[SCHEMA DRIFT ALERT] ${message}`, {
      endpointId,
      syncBatchId,
      severity: drift.severity
    });
  }

  /**
   * Build human-readable alert message
   */
  private buildAlertMessage(endpointName: string, drift: SchemaDrift): string {
    const parts: string[] = [];

    if (drift.missingFields.length > 0) {
      const fieldList = drift.missingFields.slice(0, 5).join(', ');
      const more = drift.missingFields.length > 5 ? ` +${drift.missingFields.length - 5} more` : '';
      parts.push(`${drift.missingFields.length} fields missing: [${fieldList}${more}]`);
    }

    if (drift.newFields.length > 0) {
      const fieldList = drift.newFields.slice(0, 5).join(', ');
      const more = drift.newFields.length > 5 ? ` +${drift.newFields.length - 5} more` : '';
      parts.push(`${drift.newFields.length} new fields: [${fieldList}${more}]`);
    }

    if (Object.keys(drift.changedTypes).length > 0) {
      const changes = Object.entries(drift.changedTypes)
        .slice(0, 3)
        .map(([field, { was, now }]) => `${field}: ${was} -> ${now}`)
        .join(', ');
      parts.push(`Type changes: ${changes}`);
    }

    const severityEmoji = drift.severity === 'high' ? '[CRITICAL]' : drift.severity === 'medium' ? '[WARNING]' : '[INFO]';

    return `${severityEmoji} Schema Drift on "${endpointName}": ${parts.join(' | ')}`;
  }

  /**
   * Get schema drift history for an endpoint
   */
  async getDriftHistory(endpointId: string, limit: number = 10): Promise<{
    batchId: string;
    ingestedAt: Date;
    alerts: SchemaDriftAlert[];
  }[]> {
    const batches = await prisma.bronze_batches.findMany({
      where: {
        endpointId,
        completedAt: { not: null }
      },
      orderBy: { ingestedAt: 'desc' },
      take: limit,
      select: {
        syncBatchId: true,
        ingestedAt: true,
        warnings: true
      }
    });

    return batches.map((batch: any) => {
      const warnings = (batch.warnings as unknown[]) || [];
      const driftAlerts = warnings.filter(
        (w): w is SchemaDriftAlert =>
          w !== null &&
          typeof w === 'object' &&
          'type' in w &&
          (w as { type: string }).type === 'SCHEMA_DRIFT'
      );

      return {
        batchId: batch.syncBatchId,
        ingestedAt: batch.ingestedAt,
        alerts: driftAlerts
      };
    });
  }

  /**
   * Check if an endpoint has active schema drift alerts
   */
  async hasActiveDrift(endpointId: string): Promise<{
    hasDrift: boolean;
    latestSeverity: 'low' | 'medium' | 'high' | null;
    alertCount: number;
  }> {
    const recentBatches = await prisma.bronze_batches.findMany({
      where: {
        endpointId,
        completedAt: { not: null }
      },
      orderBy: { ingestedAt: 'desc' },
      take: 5,
      select: { warnings: true }
    });

    let highestSeverity: 'low' | 'medium' | 'high' | null = null;
    let alertCount = 0;

    for (const batch of recentBatches) {
      const warnings = (batch.warnings as unknown[]) || [];
      const driftAlerts = warnings.filter(
        (w): w is SchemaDriftAlert =>
          w !== null &&
          typeof w === 'object' &&
          'type' in w &&
          (w as { type: string }).type === 'SCHEMA_DRIFT'
      );

      alertCount += driftAlerts.length;

      for (const alert of driftAlerts) {
        if (!highestSeverity || this.compareSeverity(alert.severity, highestSeverity) > 0) {
          highestSeverity = alert.severity;
        }
      }
    }

    return {
      hasDrift: alertCount > 0,
      latestSeverity: highestSeverity,
      alertCount
    };
  }

  /**
   * Compare severity levels: high > medium > low
   */
  private compareSeverity(a: 'low' | 'medium' | 'high', b: 'low' | 'medium' | 'high'): number {
    const order = { low: 0, medium: 1, high: 2 };
    return order[a] - order[b];
  }
}

// Singleton export
export const schemaDriftDetector = new SchemaDriftDetector();
