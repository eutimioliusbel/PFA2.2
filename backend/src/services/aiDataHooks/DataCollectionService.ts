// backend/src/services/aiDataHooks/DataCollectionService.ts
/**
 * AI-Ready Data Collection Service
 *
 * Phase 6, Task 6.5 of ADR-005 Multi-Tenant Access Control
 *
 * Purpose: Capture metadata for AI training without logging PII
 *
 * Privacy Principles:
 * 1. Log user IDs, NOT usernames/emails (anonymization)
 * 2. Log action types, NOT actual values (e.g., "cost updated" NOT "$50000")
 * 3. Log timestamps for pattern analysis
 * 4. Log before/after states for rollback capability (with PII sanitized)
 *
 * Data Requirements for AI Use Cases:
 * - Permission Suggestions (UC #1): Historical permission grant/revoke decisions
 * - Anomaly Detection (UC #2): Baseline user activity patterns
 * - Financial Monitoring (UC #8): Financial access frequency (NOT actual costs)
 * - Audit Search (UC #18): Semantic event metadata (who/what/when/why)
 * - Role Drift Detection (UC #19): Permission overrides and role changes over time
 */

import { PrismaClient, audit_logs, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * Helper to convert objects to Prisma-compatible JSON
 */
function toJsonValue(obj: Record<string, any>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(obj)) as Prisma.InputJsonValue;
}

// ============================================================================
// Types
// ============================================================================

export interface PermissionChangeData {
  userId: string;
  actorUserId: string;
  organizationId: string;
  action: 'grant' | 'revoke';
  permissionField: string;
  permissionValue: boolean;
  beforeState: Record<string, any>;
  afterState: Record<string, any>;
  context?: AuditContext;
}

export interface ExternalEntitySyncData {
  userId: string;
  organizationId: string;
  action: 'created' | 'updated' | 'synced';
  entityType: 'User' | 'Organization' | 'PfaRecord';
  entityId: string;
  externalId: string;
  externalSystem: 'PEMS' | 'ESS' | 'Procurement';
  syncMetadata: {
    recordsProcessed: number;
    recordsInserted: number;
    recordsUpdated: number;
    recordsSkipped: number;
  };
}

export interface UserActivityData {
  userId: string;
  organizationId: string;
  actionType: string;
  resourceType?: string;
  recordCount?: number;
  context?: AuditContext;
}

export interface BulkOperationData {
  userId: string;
  organizationId: string;
  operation: 'update' | 'delete' | 'export';
  entityType: string;
  recordCount: number;
  affectedFields?: string[];
}

export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  organizationContext?: string;
}

export interface AITrainingDataOptions {
  startDate?: Date;
  endDate?: Date;
  actionTypes?: string[];
  limit?: number;
}

export interface AITrainingData {
  totalEvents: number;
  actionDistribution: Record<string, number>;
  hourlyDistribution: Record<number, number>;
  userActivitySummary: Record<string, { actions: number; lastSeen: Date }>;
  bulkOperations: number;
  permissionChanges: number;
}

// ============================================================================
// Sensitive Fields Configuration
// ============================================================================

/**
 * Fields that contain PII and must NEVER be logged
 */
const PII_FIELDS = [
  'password',
  'passwordHash',
  'email',
  'phone',
  'apiKey',
  'credentials',
  'authKeyEncrypted',
  'authValueEncrypted',
  'secretKey',
  'accessToken',
  'refreshToken',
  'firstName',
  'lastName',
  'fullName',
  'address',
  'ssn',
  'socialSecurityNumber',
];

/**
 * Financial fields that should be masked (log presence, not value)
 */
const FINANCIAL_FIELDS = [
  'cost',
  'monthlyRate',
  'purchasePrice',
  'totalCost',
  'budget',
  'amount',
  'price',
  'rate',
  'salary',
  'compensation',
];

// ============================================================================
// DataCollectionService
// ============================================================================

/**
 * AI-Ready Audit Logging Service
 *
 * All methods are non-blocking and add < 10ms overhead.
 * Uses fire-and-forget pattern to prevent audit logging from blocking main operations.
 */
export class DataCollectionService {
  /**
   * Log permission grant/revoke with full before/after state
   *
   * Used for:
   * - AI Permission Suggestions (learn from historical decisions)
   * - Role Drift Detection (track permission changes over time)
   * - Audit compliance (who changed what, when)
   */
  static async logPermissionChange(data: PermissionChangeData): Promise<audit_logs | null> {
    const startTime = Date.now();

    try {
      const auditLog = await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          userId: data.actorUserId,
          organizationId: data.organizationId,
          action: `permission:${data.action}`,
          resource: `user:${data.userId}`,
          method: 'PATCH',
          metadata: toJsonValue({
            permissionField: data.permissionField,
            permissionValue: data.permissionValue,
            targetUserId: data.userId,
            beforeState: this.sanitizeState(data.beforeState),
            afterState: this.sanitizeState(data.afterState),
            context: data.context || {},
            aiMetadata: {
              isPermissionChange: true,
              affectedUser: data.userId,
              changedBy: data.actorUserId,
              timestamp: new Date().toISOString(),
            },
          }),
          success: true,
        },
      });

      const duration = Date.now() - startTime;
      if (duration > 10) {
        logger.warn('Permission change logging exceeded 10ms', { duration, action: data.action });
      }

      return auditLog;
    } catch (error) {
      logger.error('Failed to log permission change', { error, data: { ...data, beforeState: '[REDACTED]', afterState: '[REDACTED]' } });
      return null;
    }
  }

  /**
   * Log external entity creation/update from PEMS sync
   *
   * Used for:
   * - Data lineage tracking (where did this data come from?)
   * - Sync anomaly detection (unusual sync patterns)
   * - External ID mapping (correlate local IDs with PEMS IDs)
   */
  static async logExternalEntitySync(data: ExternalEntitySyncData): Promise<audit_logs | null> {
    const startTime = Date.now();

    try {
      const auditLog = await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          userId: data.userId,
          organizationId: data.organizationId,
          action: `${data.entityType.toLowerCase()}:${data.action}`,
          resource: `${data.entityType}:${data.entityId}`,
          method: data.action === 'created' ? 'POST' : 'PUT',
          metadata: toJsonValue({
            externalId: data.externalId,
            externalSystem: data.externalSystem,
            syncMetadata: data.syncMetadata,
            aiMetadata: {
              isExternalSync: true,
              dataSource: data.externalSystem,
              entityType: data.entityType,
              timestamp: new Date().toISOString(),
            },
          }),
          success: true,
        },
      });

      const duration = Date.now() - startTime;
      if (duration > 10) {
        logger.warn('External sync logging exceeded 10ms', { duration, entityType: data.entityType });
      }

      return auditLog;
    } catch (error) {
      logger.error('Failed to log external entity sync', { error, entityType: data.entityType, entityId: data.entityId });
      return null;
    }
  }

  /**
   * Log user activity patterns (for anomaly detection baseline)
   *
   * Privacy-preserving: Only logs action type and timestamp
   * Used for:
   * - Baseline activity pattern establishment
   * - Anomaly detection (unusual access patterns)
   * - User behavior analytics (aggregate, not individual)
   */
  static async logUserActivity(data: UserActivityData): Promise<audit_logs | null> {
    const startTime = Date.now();

    try {
      const auditLog = await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          userId: data.userId,
          organizationId: data.organizationId,
          action: data.actionType,
          resource: data.resourceType || 'Activity',
          method: 'GET',
          metadata: toJsonValue({
            recordCount: data.recordCount,
            context: data.context || {},
            aiMetadata: {
              isUserActivity: true,
              timestamp: new Date().toISOString(),
              hour: new Date().getHours(),
              dayOfWeek: new Date().getDay(),
            },
          }),
          success: true,
        },
      });

      const duration = Date.now() - startTime;
      if (duration > 10) {
        logger.warn('User activity logging exceeded 10ms', { duration, actionType: data.actionType });
      }

      return auditLog;
    } catch (error) {
      logger.error('Failed to log user activity', { error, actionType: data.actionType });
      return null;
    }
  }

  /**
   * Log bulk operations (for exfiltration detection)
   *
   * Used for:
   * - Data exfiltration detection (large exports)
   * - Compliance monitoring (bulk deletions)
   * - Anomaly alerts (unusual bulk modifications)
   */
  static async logBulkOperation(data: BulkOperationData): Promise<audit_logs | null> {
    const startTime = Date.now();

    try {
      const auditLog = await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          userId: data.userId,
          organizationId: data.organizationId,
          action: `bulk:${data.operation}`,
          resource: data.entityType,
          method: data.operation === 'export' ? 'GET' : data.operation === 'delete' ? 'DELETE' : 'PATCH',
          metadata: toJsonValue({
            recordCount: data.recordCount,
            affectedFields: data.affectedFields || [],
            aiMetadata: {
              isBulkOperation: true,
              operationSize: data.recordCount,
              operationType: data.operation,
              timestamp: new Date().toISOString(),
              // Flag for potential anomaly review
              requiresReview: data.recordCount > 500,
            },
          }),
          success: true,
        },
      });

      const duration = Date.now() - startTime;
      if (duration > 10) {
        logger.warn('Bulk operation logging exceeded 10ms', { duration, operation: data.operation });
      }

      return auditLog;
    } catch (error) {
      logger.error('Failed to log bulk operation', { error, operation: data.operation, recordCount: data.recordCount });
      return null;
    }
  }

  /**
   * Log financial data access (for compliance)
   *
   * CRITICAL: Logs access frequency, NOT actual values
   * Used for:
   * - Financial access monitoring (who accessed sensitive data)
   * - Compliance reporting (audit trail for financial data)
   * - Anomaly detection (unusual access patterns)
   */
  static async logFinancialAccess(data: {
    userId: string;
    organizationId: string;
    action: 'view' | 'export' | 'modify';
    recordCount: number;
    fieldsAccessed: string[];
    includesRates?: boolean;
    includesCosts?: boolean;
    context?: AuditContext;
  }): Promise<audit_logs | null> {
    const startTime = Date.now();

    try {
      const auditLog = await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          userId: data.userId,
          organizationId: data.organizationId,
          action: `financial:${data.action}`,
          resource: 'PfaRecord',
          method: data.action === 'view' ? 'GET' : data.action === 'export' ? 'GET' : 'PATCH',
          metadata: toJsonValue({
            recordCount: data.recordCount,
            // Log which categories of fields were accessed, NOT values
            accessedFieldCategories: this.categorizeFields(data.fieldsAccessed),
            includesRates: data.includesRates || false,
            includesCosts: data.includesCosts || false,
            context: data.context || {},
            aiMetadata: {
              isFinancialAccess: true,
              accessType: data.action,
              timestamp: new Date().toISOString(),
              // Flag for compliance monitoring
              requiresAudit: data.action !== 'view' || data.recordCount > 100,
            },
          }),
          success: true,
        },
      });

      const duration = Date.now() - startTime;
      if (duration > 10) {
        logger.warn('Financial access logging exceeded 10ms', { duration, action: data.action });
      }

      return auditLog;
    } catch (error) {
      logger.error('Failed to log financial access', { error, action: data.action });
      return null;
    }
  }

  /**
   * Log login events (for security analysis)
   */
  static async logLogin(data: {
    userId: string;
    organizationId?: string;
    success: boolean;
    failureReason?: string;
    context?: AuditContext;
  }): Promise<audit_logs | null> {
    const startTime = Date.now();

    try {
      const auditLog = await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          userId: data.userId,
          organizationId: data.organizationId,
          action: 'user:login',
          resource: 'Session',
          method: 'POST',
          metadata: toJsonValue({
            context: data.context || {},
            failureReason: data.failureReason,
            aiMetadata: {
              isLoginEvent: true,
              timestamp: new Date().toISOString(),
              hour: new Date().getHours(),
              dayOfWeek: new Date().getDay(),
            },
          }),
          success: data.success,
          errorMessage: data.failureReason,
        },
      });

      const duration = Date.now() - startTime;
      if (duration > 10) {
        logger.warn('Login logging exceeded 10ms', { duration, success: data.success });
      }

      return auditLog;
    } catch (error) {
      logger.error('Failed to log login event', { error, userId: data.userId });
      return null;
    }
  }

  /**
   * Log organization switch events (for rapid switching detection)
   */
  static async logOrganizationSwitch(data: {
    userId: string;
    fromOrganizationId: string;
    toOrganizationId: string;
    context?: AuditContext;
  }): Promise<audit_logs | null> {
    const startTime = Date.now();

    try {
      const auditLog = await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          userId: data.userId,
          organizationId: data.toOrganizationId,
          action: 'organization:switch',
          resource: `Organization:${data.toOrganizationId}`,
          method: 'POST',
          metadata: toJsonValue({
            fromOrganizationId: data.fromOrganizationId,
            toOrganizationId: data.toOrganizationId,
            context: data.context || {},
            aiMetadata: {
              isOrgSwitch: true,
              timestamp: new Date().toISOString(),
            },
          }),
          success: true,
        },
      });

      const duration = Date.now() - startTime;
      if (duration > 10) {
        logger.warn('Organization switch logging exceeded 10ms', { duration });
      }

      return auditLog;
    } catch (error) {
      logger.error('Failed to log organization switch', { error, userId: data.userId });
      return null;
    }
  }

  // ============================================================================
  // AI Training Data Queries
  // ============================================================================

  /**
   * Query audit logs for AI training
   *
   * Returns aggregated statistics, NOT raw logs
   * Privacy-preserving: Only returns counts and patterns
   */
  static async getAITrainingData(
    organizationId: string,
    options?: AITrainingDataOptions
  ): Promise<AITrainingData> {
    const where: Prisma.audit_logsWhereInput = {
      organizationId,
      timestamp: {
        gte: options?.startDate,
        lte: options?.endDate,
      },
    };

    if (options?.actionTypes) {
      where.action = { in: options.actionTypes };
    }

    const logs = await prisma.audit_logs.findMany({
      where,
      select: {
        id: true,
        userId: true,
        action: true,
        resource: true,
        timestamp: true,
        metadata: true,
      },
      orderBy: { timestamp: 'desc' },
      take: options?.limit || 10000,
    });

    return {
      totalEvents: logs.length,
      actionDistribution: this.aggregateActions(logs),
      hourlyDistribution: this.aggregateByHour(logs),
      userActivitySummary: this.aggregateByUser(logs),
      bulkOperations: logs.filter(log => log.action.startsWith('bulk:')).length,
      permissionChanges: logs.filter(log => log.action.startsWith('permission:')).length,
    };
  }

  /**
   * Get permission change history for AI suggestions
   */
  static async getPermissionHistory(
    organizationId: string,
    options?: { limit?: number; userId?: string }
  ): Promise<Array<{
    timestamp: Date;
    actorId: string;
    targetUserId: string;
    permissionField: string;
    action: 'grant' | 'revoke';
  }>> {
    const where: Prisma.audit_logsWhereInput = {
      organizationId,
      action: { startsWith: 'permission:' },
    };

    if (options?.userId) {
      where.resource = `user:${options.userId}`;
    }

    const logs = await prisma.audit_logs.findMany({
      where,
      select: {
        timestamp: true,
        userId: true,
        resource: true,
        action: true,
        metadata: true,
      },
      orderBy: { timestamp: 'desc' },
      take: options?.limit || 1000,
    });

    return logs.map(log => {
      const metadata = log.metadata as Record<string, any> || {};
      return {
        timestamp: log.timestamp,
        actorId: log.userId,
        targetUserId: metadata.targetUserId || log.resource?.replace('user:', '') || '',
        permissionField: metadata.permissionField || '',
        action: log.action.includes('grant') ? 'grant' : 'revoke',
      };
    });
  }

  /**
   * Get user activity baseline for anomaly detection
   */
  static async getUserActivityBaseline(
    userId: string,
    organizationId: string,
    daysBack: number = 30
  ): Promise<{
    averageActionsPerDay: number;
    peakHours: number[];
    typicalActions: string[];
    bulkOperationFrequency: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const logs = await prisma.audit_logs.findMany({
      where: {
        userId,
        organizationId,
        timestamp: { gte: startDate },
      },
      select: {
        action: true,
        timestamp: true,
      },
    });

    // Calculate average actions per day
    const actionsByDay: Record<string, number> = {};
    logs.forEach(log => {
      const day = log.timestamp.toISOString().split('T')[0];
      actionsByDay[day] = (actionsByDay[day] || 0) + 1;
    });
    const activeDays = Object.keys(actionsByDay).length || 1;
    const averageActionsPerDay = logs.length / activeDays;

    // Calculate peak hours
    const hourCounts: Record<number, number> = {};
    logs.forEach(log => {
      const hour = log.timestamp.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const sortedHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    // Calculate typical actions
    const actionCounts: Record<string, number> = {};
    logs.forEach(log => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    });
    const typicalActions = Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([action]) => action);

    // Calculate bulk operation frequency
    const bulkOps = logs.filter(log => log.action.startsWith('bulk:'));
    const bulkOperationFrequency = bulkOps.length / activeDays;

    return {
      averageActionsPerDay,
      peakHours: sortedHours,
      typicalActions,
      bulkOperationFrequency,
    };
  }

  // ============================================================================
  // Privacy Utilities
  // ============================================================================

  /**
   * Sanitize state to remove PII before logging
   */
  private static sanitizeState(state: any): any {
    if (!state) return null;
    if (typeof state !== 'object') return state;

    const sanitized = { ...state };

    // Remove PII fields
    for (const field of PII_FIELDS) {
      if (field in sanitized) {
        delete sanitized[field];
      }
    }

    // Mask financial fields (keep presence, not value)
    for (const field of FINANCIAL_FIELDS) {
      if (field in sanitized && sanitized[field] !== undefined) {
        sanitized[`has${field.charAt(0).toUpperCase() + field.slice(1)}`] = true;
        delete sanitized[field];
      }
    }

    // Recursively sanitize nested objects
    for (const key of Object.keys(sanitized)) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null && !Array.isArray(sanitized[key])) {
        sanitized[key] = this.sanitizeState(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Categorize accessed fields for logging
   */
  private static categorizeFields(fields: string[]): string[] {
    const categories: Set<string> = new Set();

    for (const field of fields) {
      if (FINANCIAL_FIELDS.some(f => field.toLowerCase().includes(f.toLowerCase()))) {
        categories.add('financial');
      } else if (['forecastStart', 'forecastEnd', 'originalStart', 'originalEnd', 'actualStart', 'actualEnd'].includes(field)) {
        categories.add('timeline');
      } else if (['category', 'class', 'areaSilo'].includes(field)) {
        categories.add('classification');
      } else if (['equipment', 'manufacturer', 'model'].includes(field)) {
        categories.add('equipment');
      } else {
        categories.add('general');
      }
    }

    return Array.from(categories);
  }

  // ============================================================================
  // Aggregation Utilities
  // ============================================================================

  private static aggregateActions(logs: Array<{ action: string }>): Record<string, number> {
    const distribution: Record<string, number> = {};
    for (const log of logs) {
      distribution[log.action] = (distribution[log.action] || 0) + 1;
    }
    return distribution;
  }

  private static aggregateByHour(logs: Array<{ timestamp: Date }>): Record<number, number> {
    const hourDistribution: Record<number, number> = {};
    for (const log of logs) {
      const hour = new Date(log.timestamp).getHours();
      hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
    }
    return hourDistribution;
  }

  private static aggregateByUser(logs: Array<{ userId: string; timestamp: Date }>): Record<string, { actions: number; lastSeen: Date }> {
    const userActivity: Record<string, { actions: number; lastSeen: Date }> = {};
    for (const log of logs) {
      if (!userActivity[log.userId]) {
        userActivity[log.userId] = { actions: 0, lastSeen: log.timestamp };
      }
      userActivity[log.userId].actions += 1;
      if (log.timestamp > userActivity[log.userId].lastSeen) {
        userActivity[log.userId].lastSeen = log.timestamp;
      }
    }
    return userActivity;
  }
}

// Export singleton instance
export default DataCollectionService;
