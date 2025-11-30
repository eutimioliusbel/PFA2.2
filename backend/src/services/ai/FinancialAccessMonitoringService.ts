// backend/src/services/ai/FinancialAccessMonitoringService.ts
/**
 * AI Financial Access Monitoring Service
 *
 * Phase 6, Task 6.3 of ADR-005 Multi-Tenant Access Control
 *
 * Monitors and alerts on financial data access patterns:
 * - Tracks who accesses financial data
 * - Detects unusual financial data exports
 * - Provides compliance reporting
 * - Generates alerts for sensitive data access
 */

import prisma from '../../config/database';
import { logger } from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface FinancialAccessEvent {
  userId: string;
  organizationId: string;
  action: 'view' | 'export' | 'modify';
  recordCount: number;
  fieldsAccessed: string[];
  includesRates?: boolean;
  includesCosts?: boolean;
  timestamp: Date;
  sessionId?: string;
}

export interface FinancialAccessAlert {
  id?: string;
  type: 'BULK_EXPORT' | 'OFF_HOURS_ACCESS' | 'HIGH_FREQUENCY' | 'UNAUTHORIZED_ATTEMPT' | 'EXPORT_WITH_RATES';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId: string;
  username?: string;
  organizationId: string;
  message: string;
  details: Record<string, any>;
  detectedAt: Date;
  acknowledged: boolean;
}

export interface FinancialAccessReport {
  summary: {
    totalAccesses: number;
    uniqueUsers: number;
    exportCount: number;
    anomalyCount: number;
    totalRecordsExported: number;
  };
  userAccess: Array<{
    userId: string;
    username: string;
    accessCount: number;
    lastAccess: Date;
    hasExported: boolean;
    exportCount: number;
    totalRecordsExported: number;
  }>;
  recentActivity: Array<{
    userId: string;
    username: string;
    action: string;
    timestamp: Date;
    recordCount?: number;
    fieldsAccessed?: string[];
  }>;
  alerts: FinancialAccessAlert[];
}

// ============================================================================
// Financial Access Monitoring Service
// ============================================================================

export class FinancialAccessMonitoringService {
  private readonly SENSITIVE_FIELDS = [
    'monthlyRate',
    'purchasePrice',
    'cost',
    'totalCost',
    'variance',
    'budget',
  ];

  private readonly BULK_THRESHOLD = 500; // Records
  private readonly HIGH_FREQUENCY_THRESHOLD = 20; // Accesses per hour

  /**
   * Log a financial data access event
   */
  async logFinancialAccess(event: FinancialAccessEvent): Promise<void> {
    try {
      // Determine if this includes sensitive financial fields
      const includesSensitive = this.SENSITIVE_FIELDS.some(
        field => event.fieldsAccessed.includes(field)
      );

      await prisma.audit_logs.create({
        data: {
          id: `fin_access_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
          userId: event.userId,
          organizationId: event.organizationId,
          action: `financial_data_${event.action}`,
          resource: 'pfa_records',
          method: event.action === 'view' ? 'GET' : event.action === 'export' ? 'GET' : 'PATCH',
          success: true,
          metadata: {
            recordCount: event.recordCount,
            fieldsAccessed: event.fieldsAccessed,
            includesRates: event.includesRates,
            includesCosts: event.includesCosts,
            includesSensitive,
            sessionId: event.sessionId,
          },
        },
      });

      // Check for anomalies
      await this.checkForAnomalies(event);
    } catch (error) {
      logger.error('Failed to log financial access:', error);
    }
  }

  /**
   * Check financial access event for anomalies
   */
  private async checkForAnomalies(event: FinancialAccessEvent): Promise<void> {
    const anomalies: FinancialAccessAlert[] = [];

    // 1. Check for bulk export
    if (event.action === 'export' && event.recordCount > this.BULK_THRESHOLD) {
      anomalies.push({
        type: 'BULK_EXPORT',
        severity: event.recordCount > 5000 ? 'high' : 'medium',
        userId: event.userId,
        organizationId: event.organizationId,
        message: `Bulk financial data export: ${event.recordCount} records`,
        details: {
          recordCount: event.recordCount,
          fieldsAccessed: event.fieldsAccessed,
        },
        detectedAt: new Date(),
        acknowledged: false,
      });
    }

    // 2. Check for off-hours access
    const hour = event.timestamp.getHours();
    if ((hour < 6 || hour > 22) && (event.includesRates || event.includesCosts)) {
      anomalies.push({
        type: 'OFF_HOURS_ACCESS',
        severity: 'medium',
        userId: event.userId,
        organizationId: event.organizationId,
        message: `Financial data access at ${hour}:00 (off-hours)`,
        details: {
          hour,
          action: event.action,
          recordCount: event.recordCount,
        },
        detectedAt: new Date(),
        acknowledged: false,
      });
    }

    // 3. Check for high-frequency access
    const recentAccesses = await prisma.audit_logs.count({
      where: {
        userId: event.userId,
        action: { startsWith: 'financial_data_' },
        timestamp: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      },
    });

    if (recentAccesses > this.HIGH_FREQUENCY_THRESHOLD) {
      anomalies.push({
        type: 'HIGH_FREQUENCY',
        severity: 'high',
        userId: event.userId,
        organizationId: event.organizationId,
        message: `High financial data access frequency: ${recentAccesses} times in last hour`,
        details: {
          accessCount: recentAccesses,
          threshold: this.HIGH_FREQUENCY_THRESHOLD,
        },
        detectedAt: new Date(),
        acknowledged: false,
      });
    }

    // 4. Check for export with sensitive rate data
    if (event.action === 'export' && event.includesRates) {
      anomalies.push({
        type: 'EXPORT_WITH_RATES',
        severity: 'medium',
        userId: event.userId,
        organizationId: event.organizationId,
        message: `Export includes monthly rates for ${event.recordCount} records`,
        details: {
          recordCount: event.recordCount,
          includesRates: true,
          includesCosts: event.includesCosts,
        },
        detectedAt: new Date(),
        acknowledged: false,
      });
    }

    // Log all detected anomalies
    for (const alert of anomalies) {
      await this.logAlert(alert);
    }
  }

  /**
   * Log a financial access alert
   */
  private async logAlert(alert: FinancialAccessAlert): Promise<void> {
    try {
      // Get username
      const user = await prisma.users.findUnique({
        where: { id: alert.userId },
        select: { username: true },
      });

      alert.username = user?.username;

      await prisma.audit_logs.create({
        data: {
          id: `fin_access_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
          userId: alert.userId,
          organizationId: alert.organizationId,
          action: 'financial_access_alert',
          resource: 'pfa_records',
          method: 'DETECTION',
          success: true,
          metadata: {
            alertType: alert.type,
            severity: alert.severity,
            username: alert.username,
            message: alert.message,
            details: alert.details,
            acknowledged: false,
          },
        },
      });

      logger.warn('Financial access alert', {
        type: alert.type,
        severity: alert.severity,
        userId: alert.userId,
        message: alert.message,
      });
    } catch (error) {
      logger.error('Failed to log financial access alert:', error);
    }
  }

  /**
   * Get financial access report for an organization
   */
  async getFinancialAccessReport(params: {
    organizationId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<FinancialAccessReport> {
    const { organizationId, startDate, endDate, limit = 100 } = params;

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = startDate;
    }
    if (endDate) {
      dateFilter.lte = endDate;
    }

    // Get financial access logs
    const accessLogs = await prisma.audit_logs.findMany({
      where: {
        action: { startsWith: 'financial_data_' },
        ...(organizationId && { organizationId }),
        ...(Object.keys(dateFilter).length > 0 && { timestamp: dateFilter }),
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    // Get alerts
    const alertLogs = await prisma.audit_logs.findMany({
      where: {
        action: 'financial_access_alert',
        ...(organizationId && { organizationId }),
        ...(Object.keys(dateFilter).length > 0 && { timestamp: dateFilter }),
      },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    // Aggregate by user
    const userAccessMap = new Map<string, {
      accessCount: number;
      lastAccess: Date;
      hasExported: boolean;
      exportCount: number;
      totalRecordsExported: number;
    }>();

    let totalRecordsExported = 0;
    let exportCount = 0;

    accessLogs.forEach(log => {
      const existing = userAccessMap.get(log.userId) || {
        accessCount: 0,
        lastAccess: log.timestamp,
        hasExported: false,
        exportCount: 0,
        totalRecordsExported: 0,
      };

      existing.accessCount++;
      if (log.timestamp > existing.lastAccess) {
        existing.lastAccess = log.timestamp;
      }

      const metadata = log.metadata as any;
      if (log.action === 'financial_data_export') {
        existing.hasExported = true;
        existing.exportCount++;
        existing.totalRecordsExported += metadata?.recordCount || 0;
        exportCount++;
        totalRecordsExported += metadata?.recordCount || 0;
      }

      userAccessMap.set(log.userId, existing);
    });

    // Get usernames
    const userIds = [...userAccessMap.keys()];
    const users = await prisma.users.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true },
    });
    const usernameMap = new Map(users.map((u: any) => [u.id, u.username as string]));

    // Build user access list
    const userAccess = Array.from(userAccessMap.entries()).map(([userId, data]) => ({
      userId,
      username: usernameMap.get(userId) || 'Unknown',
      ...data,
    }));

    // Build recent activity
    const recentActivity = accessLogs.slice(0, 20).map(log => {
      const metadata = log.metadata as any;
      return {
        userId: log.userId,
        username: usernameMap.get(log.userId) || 'Unknown',
        action: log.action.replace('financial_data_', ''),
        timestamp: log.timestamp,
        recordCount: metadata?.recordCount,
        fieldsAccessed: metadata?.fieldsAccessed,
      };
    });

    // Build alerts
    const alerts: FinancialAccessAlert[] = alertLogs.map(log => {
      const metadata = log.metadata as any;
      return {
        id: log.id,
        type: metadata.alertType,
        severity: metadata.severity,
        userId: log.userId,
        username: metadata.username,
        organizationId: log.organizationId || '',
        message: metadata.message,
        details: metadata.details,
        detectedAt: log.timestamp,
        acknowledged: metadata.acknowledged || false,
      };
    });

    return {
      summary: {
        totalAccesses: accessLogs.length,
        uniqueUsers: userAccessMap.size,
        exportCount,
        anomalyCount: alertLogs.length,
        totalRecordsExported,
      },
      userAccess,
      recentActivity,
      alerts,
    };
  }

  /**
   * Get financial access alerts
   */
  async getFinancialAccessAlerts(params: {
    organizationId?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    limit?: number;
  }): Promise<{
    alerts: FinancialAccessAlert[];
    summary: { critical: number; high: number; medium: number; low: number };
  }> {
    const { organizationId, severity, limit = 50 } = params;

    const alertLogs = await prisma.audit_logs.findMany({
      where: {
        action: 'financial_access_alert',
        ...(organizationId && { organizationId }),
      },
      orderBy: { timestamp: 'desc' },
      take: limit * 4, // Get more for filtering
    });

    let alerts: FinancialAccessAlert[] = alertLogs.map(log => {
      const metadata = log.metadata as any;
      return {
        id: log.id,
        type: metadata.alertType,
        severity: metadata.severity,
        userId: log.userId,
        username: metadata.username,
        organizationId: log.organizationId || '',
        message: metadata.message,
        details: metadata.details,
        detectedAt: log.timestamp,
        acknowledged: metadata.acknowledged || false,
      };
    });

    // Filter by severity if specified
    if (severity) {
      alerts = alerts.filter(a => a.severity === severity);
    }

    // Calculate summary
    const summary = {
      critical: alertLogs.filter(l => (l.metadata as any)?.severity === 'critical').length,
      high: alertLogs.filter(l => (l.metadata as any)?.severity === 'high').length,
      medium: alertLogs.filter(l => (l.metadata as any)?.severity === 'medium').length,
      low: alertLogs.filter(l => (l.metadata as any)?.severity === 'low').length,
    };

    return {
      alerts: alerts.slice(0, limit),
      summary,
    };
  }

  /**
   * Check if user has financial data access permission
   */
  async checkFinancialAccess(userId: string, organizationId: string): Promise<{
    hasAccess: boolean;
    reason?: string;
  }> {
    const userOrg = await prisma.user_organizations.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
      select: {
        perm_ViewFinancials: true,
        role: true,
      },
    });

    if (!userOrg) {
      // Log unauthorized attempt
      await prisma.audit_logs.create({
        data: {
          id: `fin_access_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
          userId,
          organizationId,
          action: 'financial_access_denied',
          resource: 'pfa_records',
          method: 'GET',
          success: false,
          errorMessage: 'User not assigned to organization',
          metadata: {
            reason: 'NO_ORG_ACCESS',
          },
        },
      });

      return {
        hasAccess: false,
        reason: 'User not assigned to this organization',
      };
    }

    if (!userOrg.perm_ViewFinancials && userOrg.role !== 'admin') {
      // Log unauthorized attempt
      await prisma.audit_logs.create({
        data: {
          id: `fin_access_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
          userId,
          organizationId,
          action: 'financial_access_denied',
          resource: 'pfa_records',
          method: 'GET',
          success: false,
          errorMessage: 'Permission denied: perm_ViewFinancials required',
          metadata: {
            reason: 'NO_FINANCIAL_PERMISSION',
            currentRole: userOrg.role,
          },
        },
      });

      return {
        hasAccess: false,
        reason: 'Financial data access permission required',
      };
    }

    return { hasAccess: true };
  }

  /**
   * Get compliance report for financial data access
   */
  async getComplianceReport(params: {
    organizationId?: string;
    startDate: Date;
    endDate: Date;
  }): Promise<{
    period: { start: Date; end: Date };
    summary: {
      totalUsers: number;
      totalAccesses: number;
      totalExports: number;
      alertsGenerated: number;
      unauthorizedAttempts: number;
    };
    userBreakdown: Array<{
      userId: string;
      username: string;
      role: string;
      accessCount: number;
      exportCount: number;
      lastAccess: Date;
    }>;
    alertBreakdown: Array<{
      type: string;
      count: number;
      severity: string;
    }>;
    recommendations: string[];
  }> {
    const { organizationId, startDate, endDate } = params;

    // Get all financial access logs in period
    const accessLogs = await prisma.audit_logs.findMany({
      where: {
        action: { startsWith: 'financial_' },
        ...(organizationId && { organizationId }),
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    // Separate by type
    const accesses = accessLogs.filter(l => l.action.startsWith('financial_data_'));
    const alerts = accessLogs.filter(l => l.action === 'financial_access_alert');
    const denied = accessLogs.filter(l => l.action === 'financial_access_denied');

    // Aggregate by user
    const userMap = new Map<string, {
      accessCount: number;
      exportCount: number;
      lastAccess: Date;
    }>();

    accesses.forEach(log => {
      const existing = userMap.get(log.userId) || {
        accessCount: 0,
        exportCount: 0,
        lastAccess: log.timestamp,
      };

      existing.accessCount++;
      if (log.action.includes('export')) {
        existing.exportCount++;
      }
      if (log.timestamp > existing.lastAccess) {
        existing.lastAccess = log.timestamp;
      }

      userMap.set(log.userId, existing);
    });

    // Get user details
    const userIds = [...userMap.keys()];
    const users = await prisma.users.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, role: true },
    });
    const userDetailsMap = new Map(users.map((u: any) => [u.id, u]));

    // Build user breakdown
    const userBreakdown = Array.from(userMap.entries()).map(([userId, data]) => {
      const user = userDetailsMap.get(userId);
      return {
        userId,
        username: user?.username || 'Unknown',
        role: user?.role || 'Unknown',
        ...data,
      };
    });

    // Aggregate alerts by type
    const alertTypeMap = new Map<string, { count: number; severity: string }>();
    alerts.forEach(log => {
      const metadata = log.metadata as any;
      const key = metadata.alertType;
      const existing = alertTypeMap.get(key) || { count: 0, severity: metadata.severity };
      existing.count++;
      alertTypeMap.set(key, existing);
    });

    const alertBreakdown = Array.from(alertTypeMap.entries()).map(([type, data]) => ({
      type,
      ...data,
    }));

    // Generate recommendations
    const recommendations: string[] = [];

    if (denied.length > 10) {
      recommendations.push('High number of unauthorized access attempts. Review user permissions and access policies.');
    }

    if (alerts.filter(l => (l.metadata as any)?.severity === 'high' || (l.metadata as any)?.severity === 'critical').length > 5) {
      recommendations.push('Multiple high-severity alerts detected. Consider implementing additional access controls.');
    }

    const bulkExports = accesses.filter(l => {
      const metadata = l.metadata as any;
      return l.action.includes('export') && metadata?.recordCount > 1000;
    });
    if (bulkExports.length > 3) {
      recommendations.push('Frequent bulk exports detected. Review export policies and consider implementing export limits.');
    }

    if (recommendations.length === 0) {
      recommendations.push('No significant concerns. Continue monitoring financial data access patterns.');
    }

    return {
      period: { start: startDate, end: endDate },
      summary: {
        totalUsers: userMap.size,
        totalAccesses: accesses.length,
        totalExports: accesses.filter(l => l.action.includes('export')).length,
        alertsGenerated: alerts.length,
        unauthorizedAttempts: denied.length,
      },
      userBreakdown,
      alertBreakdown,
      recommendations,
    };
  }
}

export default new FinancialAccessMonitoringService();
