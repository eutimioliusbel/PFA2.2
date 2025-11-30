// backend/src/services/ai/AnomalyDetectionService.ts
/**
 * AI Security Anomaly Detection Service
 *
 * Phase 6, Task 6.2 of ADR-005 Multi-Tenant Access Control
 *
 * Monitors user access patterns and detects anomalies in real-time:
 * - Login anomalies (unusual location, time, device)
 * - Permission escalation patterns
 * - Data access anomalies (bulk exports, unusual queries)
 * - Sync failure spikes
 */

import prisma from '../../config/database';
import { GeminiAdapter } from './GeminiAdapter';
import { logger } from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export type AlertType =
  | 'LOGIN_ANOMALY'
  | 'PERMISSION_ESCALATION'
  | 'DATA_ACCESS_ANOMALY'
  | 'SYNC_FAILURE_SPIKE'
  | 'UNUSUAL_BULK_OPERATION'
  | 'OFF_HOURS_ACCESS'
  | 'RAPID_ORG_SWITCHING'
  | 'FINANCIAL_DATA_ACCESS';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AnomalyAlert {
  id?: string;
  alertType: AlertType;
  userId: string;
  username?: string;
  organizationId?: string;
  risk: RiskLevel;
  anomaly: string;
  details: Record<string, any>;
  reasoning: string;
  suggestedAction: string;
  confidence: number;
  detectedAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

interface LoginPattern {
  peakHours: number[];
  locations: string[];
  devices: string[];
  avgLoginsPerDay: number;
  typicalIpRanges: string[];
}

interface AccessPattern {
  avgRecordsPerExport: number;
  peakAccessHours: number[];
  financialAccessFrequency: number;
  typicalOrgCount: number;
}

// ============================================================================
// Anomaly Detection Service
// ============================================================================

export class AnomalyDetectionService {
  // @ts-expect-error - Reserved for future AI-powered anomaly analysis
  private _aiAdapter: GeminiAdapter | null = null;

  /**
   * Analyze a login event for anomalies
   */
  async detectLoginAnomalies(userId: string, loginEvent: {
    timestamp: Date;
    ipAddress?: string;
    userAgent?: string;
    location?: { city?: string; country?: string; region?: string };
  }): Promise<AnomalyAlert | null> {
    try {
      // Get user's login history (last 90 days)
      const loginHistory = await prisma.audit_logs.findMany({
        where: {
          userId,
          action: 'user_login',
          timestamp: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 500,
      });

      if (loginHistory.length < 5) {
        // Not enough history to detect anomalies
        return null;
      }

      // Calculate normal login pattern
      const normalPattern = this.calculateLoginPattern(loginHistory);

      // Check for anomalies
      const anomalies: string[] = [];
      let riskLevel: RiskLevel = 'LOW';

      // 1. Check time anomaly
      const loginHour = loginEvent.timestamp.getHours();
      if (!normalPattern.peakHours.includes(loginHour)) {
        // Off-hours login
        const isNightTime = loginHour < 6 || loginHour > 22;
        if (isNightTime) {
          anomalies.push(`Login at unusual hour (${loginHour}:00)`);
          riskLevel = 'MEDIUM';
        }
      }

      // 2. Check location anomaly
      if (loginEvent.location?.country) {
        const locationKey = `${loginEvent.location.country}`;
        if (!normalPattern.locations.includes(locationKey)) {
          anomalies.push(`Login from new location: ${loginEvent.location.city || 'Unknown'}, ${loginEvent.location.country}`);
          riskLevel = 'HIGH';
        }
      }

      // 3. Check device anomaly
      if (loginEvent.userAgent) {
        const deviceType = this.extractDeviceType(loginEvent.userAgent);
        if (!normalPattern.devices.includes(deviceType)) {
          anomalies.push(`Login from new device type: ${deviceType}`);
          if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
        }
      }

      // 4. Check for rapid login attempts
      const recentLogins = loginHistory.filter(
        l => new Date(l.timestamp).getTime() > Date.now() - 5 * 60 * 1000
      );
      if (recentLogins.length > 5) {
        anomalies.push(`Rapid login activity: ${recentLogins.length} logins in 5 minutes`);
        riskLevel = 'HIGH';
      }

      if (anomalies.length === 0) {
        return null;
      }

      // Get user info
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { username: true },
      });

      // Create alert
      const alert: AnomalyAlert = {
        alertType: 'LOGIN_ANOMALY',
        userId,
        username: user?.username,
        risk: riskLevel,
        anomaly: anomalies.join('; '),
        details: {
          loginEvent,
          normalPattern,
          anomalies,
        },
        reasoning: `Detected ${anomalies.length} anomalies compared to user's normal login pattern from last 90 days.`,
        suggestedAction: this.getSuggestedAction(riskLevel, 'LOGIN_ANOMALY'),
        confidence: this.calculateConfidence(loginHistory.length, anomalies.length),
        detectedAt: new Date(),
        acknowledged: false,
      };

      // Log the anomaly
      const loggedAlert = await this.logAnomaly(alert);
      alert.id = loggedAlert.id;

      // Auto-action for CRITICAL risk (Note: Currently max is HIGH, CRITICAL removed from RiskLevel type)
      // if (riskLevel === 'CRITICAL') {
      //   await this.autoSuspendUser(userId, alert.anomaly);
      // }

      return alert;
    } catch (error) {
      logger.error('Login anomaly detection error:', error);
      return null;
    }
  }

  /**
   * Detect permission escalation patterns
   */
  async detectPermissionEscalation(userId: string): Promise<AnomalyAlert | null> {
    try {
      // Get permission changes in last 7 days
      const permissionChanges = await prisma.audit_logs.findMany({
        where: {
          resource: 'user_organization',
          action: { in: ['permission_grant', 'role_change', 'capability_update'] },
          timestamp: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { timestamp: 'desc' },
      });

      // Filter changes related to this user
      const userChanges = permissionChanges.filter(change => {
        const metadata = change.metadata as any;
        return metadata?.targetUserId === userId || metadata?.userId === userId;
      });

      if (userChanges.length < 2) {
        return null;
      }

      // Extract granted capabilities
      const highRiskCapabilities = [
        'perm_ManageUsers',
        'perm_ManageSettings',
        'perm_ViewFinancials',
        'perm_Delete',
        'perm_Impersonate',
      ];

      const capabilitiesGranted: string[] = [];
      userChanges.forEach((change) => {
        const metadata = change.metadata as any;
        if (metadata?.changes) {
          Object.entries(metadata.changes).forEach(([key, value]) => {
            if (value === true && highRiskCapabilities.includes(key)) {
              capabilitiesGranted.push(key);
            }
          });
        }
      });

      // Check for rapid escalation
      if (capabilitiesGranted.length >= 2 && userChanges.length >= 3) {
        const user = await prisma.users.findUnique({
          where: { id: userId },
          select: { username: true },
        });

        // Get unique grantors
        const grantors = [...new Set(userChanges.map(c => c.userId))];

        const alert: AnomalyAlert = {
          alertType: 'PERMISSION_ESCALATION',
          userId,
          username: user?.username,
          risk: 'HIGH',
          anomaly: `User granted ${capabilitiesGranted.length} high-risk capabilities in ${userChanges.length} permission changes over 7 days`,
          details: {
            capabilitiesGranted: [...new Set(capabilitiesGranted)],
            permissionChangeCount: userChanges.length,
            timeSpan: '7 days',
            grantedBy: grantors,
          },
          reasoning: 'Rapid accumulation of high-risk capabilities is unusual and may indicate compromised admin account or insider threat.',
          suggestedAction: 'Review with admins who granted these capabilities. Verify user identity and business justification.',
          confidence: 0.85,
          detectedAt: new Date(),
          acknowledged: false,
        };

        const loggedAlert = await this.logAnomaly(alert);
        alert.id = loggedAlert.id;

        return alert;
      }

      return null;
    } catch (error) {
      logger.error('Permission escalation detection error:', error);
      return null;
    }
  }

  /**
   * Detect unusual data access patterns
   */
  async detectDataAccessAnomaly(userId: string, accessEvent: {
    action: string;
    recordCount?: number;
    includesFinancials?: boolean;
    organizationId?: string;
  }): Promise<AnomalyAlert | null> {
    try {
      // Get user's data access history (last 30 days)
      const accessHistory = await prisma.audit_logs.findMany({
        where: {
          userId,
          action: { in: ['pfa_records_export', 'pfa_records_view', 'financial_data_access'] },
          timestamp: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });

      if (accessHistory.length < 5) {
        return null;
      }

      // Calculate normal pattern
      const normalPattern = this.calculateAccessPattern(accessHistory);
      const anomalies: string[] = [];
      let riskLevel: RiskLevel = 'LOW';

      // 1. Check for bulk export anomaly
      if (accessEvent.recordCount) {
        if (accessEvent.recordCount > normalPattern.avgRecordsPerExport * 5) {
          anomalies.push(`Bulk export: ${accessEvent.recordCount} records (avg: ${Math.round(normalPattern.avgRecordsPerExport)})`);
          riskLevel = 'HIGH';
        }
      }

      // 2. Check for off-hours financial access
      const currentHour = new Date().getHours();
      if (accessEvent.includesFinancials && (currentHour < 6 || currentHour > 22)) {
        anomalies.push(`Financial data access at ${currentHour}:00 (off-hours)`);
        riskLevel = 'HIGH';
      }

      // 3. Check for unusual financial access frequency
      if (accessEvent.includesFinancials) {
        const recentFinancialAccess = accessHistory.filter(h => {
          const metadata = h.metadata as any;
          return metadata?.includesFinancials &&
            new Date(h.timestamp).getTime() > Date.now() - 60 * 60 * 1000;
        });

        if (recentFinancialAccess.length > 10) {
          anomalies.push(`High financial data access frequency: ${recentFinancialAccess.length} times in last hour`);
          riskLevel = 'CRITICAL';
        }
      }

      if (anomalies.length === 0) {
        return null;
      }

      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { username: true },
      });

      const alert: AnomalyAlert = {
        alertType: accessEvent.includesFinancials ? 'FINANCIAL_DATA_ACCESS' : 'DATA_ACCESS_ANOMALY',
        userId,
        username: user?.username,
        organizationId: accessEvent.organizationId,
        risk: riskLevel,
        anomaly: anomalies.join('; '),
        details: {
          accessEvent,
          normalPattern,
          anomalies,
        },
        reasoning: `Detected unusual data access pattern compared to user's normal behavior over last 30 days.`,
        suggestedAction: this.getSuggestedAction(riskLevel, 'DATA_ACCESS_ANOMALY'),
        confidence: this.calculateConfidence(accessHistory.length, anomalies.length),
        detectedAt: new Date(),
        acknowledged: false,
      };

      const loggedAlert = await this.logAnomaly(alert);
      alert.id = loggedAlert.id;

      return alert;
    } catch (error) {
      logger.error('Data access anomaly detection error:', error);
      return null;
    }
  }

  /**
   * Detect rapid organization switching
   */
  async detectRapidOrgSwitching(userId: string, newOrgId: string): Promise<AnomalyAlert | null> {
    try {
      // Get recent org switches
      const recentSwitches = await prisma.audit_logs.findMany({
        where: {
          userId,
          action: 'org_context_switch',
          timestamp: {
            gte: new Date(Date.now() - 10 * 60 * 1000), // Last 10 minutes
          },
        },
        orderBy: { timestamp: 'desc' },
      });

      const uniqueOrgs = new Set(recentSwitches.map(s => {
        const metadata = s.metadata as any;
        return metadata?.organizationId;
      }));
      uniqueOrgs.add(newOrgId);

      // Alert if user accessed 5+ orgs in 10 minutes
      if (uniqueOrgs.size >= 5) {
        const user = await prisma.users.findUnique({
          where: { id: userId },
          select: { username: true },
        });

        const alert: AnomalyAlert = {
          alertType: 'RAPID_ORG_SWITCHING',
          userId,
          username: user?.username,
          risk: 'MEDIUM',
          anomaly: `User accessed ${uniqueOrgs.size} organizations in 10 minutes`,
          details: {
            organizationIds: [...uniqueOrgs],
            switchCount: recentSwitches.length + 1,
            timeWindow: '10 minutes',
          },
          reasoning: 'Rapid organization switching may indicate data harvesting or account compromise.',
          suggestedAction: 'Monitor user activity and verify if this behavior is expected for their role.',
          confidence: 0.75,
          detectedAt: new Date(),
          acknowledged: false,
        };

        const loggedAlert = await this.logAnomaly(alert);
        alert.id = loggedAlert.id;

        return alert;
      }

      return null;
    } catch (error) {
      logger.error('Rapid org switching detection error:', error);
      return null;
    }
  }

  /**
   * Detect sync failure spikes
   */
  async detectSyncFailureSpike(organizationId: string): Promise<AnomalyAlert | null> {
    try {
      // Get recent sync logs
      const recentSyncs = await prisma.sync_logs.findMany({
        where: {
          organizationId,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (recentSyncs.length < 3) {
        return null;
      }

      const failedSyncs = recentSyncs.filter((s: any) => s.status === 'error');
      const failureRate = failedSyncs.length / recentSyncs.length;

      // Alert if failure rate >20%
      if (failureRate > 0.2) {
        const org = await prisma.organizations.findUnique({
          where: { id: organizationId },
          select: { code: true, name: true },
        });

        const alert: AnomalyAlert = {
          alertType: 'SYNC_FAILURE_SPIKE',
          userId: 'system',
          organizationId,
          risk: failureRate > 0.5 ? 'HIGH' : 'MEDIUM',
          anomaly: `Sync failure rate: ${(failureRate * 100).toFixed(1)}% (${failedSyncs.length}/${recentSyncs.length} syncs failed)`,
          details: {
            organization: org?.code,
            failureRate,
            failedCount: failedSyncs.length,
            totalCount: recentSyncs.length,
            lastErrors: failedSyncs.slice(0, 3).map((s: any) => s.errorMessage),
          },
          reasoning: 'Elevated sync failure rate may indicate API issues, credential problems, or system compromise.',
          suggestedAction: 'Check PEMS API connectivity and credentials. Review error logs for patterns.',
          confidence: 0.9,
          detectedAt: new Date(),
          acknowledged: false,
        };

        const loggedAlert = await this.logAnomaly(alert);
        alert.id = loggedAlert.id;

        return alert;
      }

      return null;
    } catch (error) {
      logger.error('Sync failure spike detection error:', error);
      return null;
    }
  }

  /**
   * Get all anomalies (for dashboard)
   */
  async getAnomalies(params: {
    organizationId?: string;
    userId?: string;
    alertType?: AlertType;
    risk?: RiskLevel;
    acknowledged?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ anomalies: AnomalyAlert[]; total: number }> {
    const where: any = {
      action: 'security_anomaly',
    };

    if (params.organizationId) {
      where.organizationId = params.organizationId;
    }
    if (params.userId) {
      where.userId = params.userId;
    }

    const logs = await prisma.audit_logs.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: params.limit || 50,
      skip: params.offset || 0,
    });

    const total = await prisma.audit_logs.count({ where });

    const anomalies: AnomalyAlert[] = logs.map(log => {
      const metadata = log.metadata as any;
      return {
        id: log.id,
        alertType: metadata.alertType,
        userId: log.userId,
        username: metadata.username,
        organizationId: log.organizationId || undefined,
        risk: metadata.risk,
        anomaly: metadata.anomaly,
        details: metadata.details,
        reasoning: metadata.reasoning,
        suggestedAction: metadata.suggestedAction,
        confidence: metadata.confidence,
        detectedAt: log.timestamp,
        acknowledged: metadata.acknowledged || false,
        acknowledgedBy: metadata.acknowledgedBy,
        acknowledgedAt: metadata.acknowledgedAt ? new Date(metadata.acknowledgedAt) : undefined,
      };
    });

    // Filter by additional params if needed
    let filtered = anomalies;
    if (params.alertType) {
      filtered = filtered.filter(a => a.alertType === params.alertType);
    }
    if (params.risk) {
      filtered = filtered.filter(a => a.risk === params.risk);
    }
    if (params.acknowledged !== undefined) {
      filtered = filtered.filter(a => a.acknowledged === params.acknowledged);
    }

    return { anomalies: filtered, total };
  }

  /**
   * Acknowledge an anomaly
   */
  async acknowledgeAnomaly(anomalyId: string, acknowledgedBy: string, action: string, comment?: string): Promise<void> {
    try {
      const log = await prisma.audit_logs.findUnique({
        where: { id: anomalyId },
      });

      if (!log) {
        throw new Error('Anomaly not found');
      }

      const metadata = log.metadata as any;
      await prisma.audit_logs.update({
        where: { id: anomalyId },
        data: {
          metadata: {
            ...metadata,
            acknowledged: true,
            acknowledgedBy,
            acknowledgedAt: new Date().toISOString(),
            acknowledgeAction: action,
            acknowledgeComment: comment,
          },
        },
      });
    } catch (error) {
      logger.error('Acknowledge anomaly error:', error);
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private calculateLoginPattern(history: any[]): LoginPattern {
    const hours: number[] = [];
    const locations: string[] = [];
    const devices: string[] = [];

    history.forEach(log => {
      const timestamp = new Date(log.timestamp);
      hours.push(timestamp.getHours());

      const metadata = log.metadata as any;
      if (metadata?.location?.country) {
        locations.push(metadata.location.country);
      }
      if (metadata?.userAgent) {
        devices.push(this.extractDeviceType(metadata.userAgent));
      }
    });

    // Get peak hours (hours with >10% of logins)
    const hourCounts = hours.reduce((acc, h) => {
      acc[h] = (acc[h] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const threshold = history.length * 0.1;
    const peakHours = Object.entries(hourCounts)
      .filter(([_, count]) => count >= threshold)
      .map(([hour]) => parseInt(hour));

    return {
      peakHours: peakHours.length > 0 ? peakHours : [9, 10, 11, 14, 15, 16], // Default business hours
      locations: [...new Set(locations)],
      devices: [...new Set(devices)],
      avgLoginsPerDay: history.length / 90,
      typicalIpRanges: [],
    };
  }

  private calculateAccessPattern(history: any[]): AccessPattern {
    const recordCounts: number[] = [];
    const hours: number[] = [];
    let financialAccessCount = 0;
    const orgIds = new Set<string>();

    history.forEach(log => {
      const metadata = log.metadata as any;
      if (metadata?.recordCount) {
        recordCounts.push(metadata.recordCount);
      }
      hours.push(new Date(log.timestamp).getHours());
      if (metadata?.includesFinancials) {
        financialAccessCount++;
      }
      if (log.organizationId) {
        orgIds.add(log.organizationId);
      }
    });

    const avgRecords = recordCounts.length > 0
      ? recordCounts.reduce((a, b) => a + b, 0) / recordCounts.length
      : 100;

    return {
      avgRecordsPerExport: avgRecords,
      peakAccessHours: [...new Set(hours)],
      financialAccessFrequency: financialAccessCount / history.length,
      typicalOrgCount: orgIds.size,
    };
  }

  private extractDeviceType(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'mobile';
    }
    if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'tablet';
    }
    if (ua.includes('windows')) return 'windows';
    if (ua.includes('mac')) return 'macos';
    if (ua.includes('linux')) return 'linux';
    return 'unknown';
  }

  private getSuggestedAction(risk: RiskLevel, alertType: AlertType): string {
    const actions: Record<RiskLevel, Record<AlertType, string>> = {
      CRITICAL: {
        LOGIN_ANOMALY: 'Immediately suspend user account and require MFA re-authentication. Contact user via phone to verify identity.',
        PERMISSION_ESCALATION: 'Revoke recently granted permissions. Investigate admin accounts that granted access.',
        DATA_ACCESS_ANOMALY: 'Suspend user account. Review and potentially revoke all exports from this session.',
        SYNC_FAILURE_SPIKE: 'Disable sync for this organization. Investigate potential API key compromise.',
        UNUSUAL_BULK_OPERATION: 'Suspend user account and audit all recent bulk operations.',
        OFF_HOURS_ACCESS: 'Suspend user account and verify identity before reactivating.',
        RAPID_ORG_SWITCHING: 'Suspend user account and audit all accessed organizations.',
        FINANCIAL_DATA_ACCESS: 'Suspend user account and audit all financial data access.',
      },
      HIGH: {
        LOGIN_ANOMALY: 'Require MFA verification on next login. Notify user via email about suspicious activity.',
        PERMISSION_ESCALATION: 'Review with admins who granted permissions. Verify business justification.',
        DATA_ACCESS_ANOMALY: 'Flag user for monitoring. Review export history.',
        SYNC_FAILURE_SPIKE: 'Check API credentials and connectivity. Review sync logs.',
        UNUSUAL_BULK_OPERATION: 'Review operation details and verify business justification.',
        OFF_HOURS_ACCESS: 'Notify user and require confirmation of activity.',
        RAPID_ORG_SWITCHING: 'Monitor user activity and verify if expected for role.',
        FINANCIAL_DATA_ACCESS: 'Review access justification and notify manager.',
      },
      MEDIUM: {
        LOGIN_ANOMALY: 'Monitor user activity. Consider requiring password change.',
        PERMISSION_ESCALATION: 'Log for review. No immediate action required.',
        DATA_ACCESS_ANOMALY: 'Log for review. Monitor for patterns.',
        SYNC_FAILURE_SPIKE: 'Monitor sync status. Check for transient issues.',
        UNUSUAL_BULK_OPERATION: 'Log for review.',
        OFF_HOURS_ACCESS: 'Log for review.',
        RAPID_ORG_SWITCHING: 'Log for review.',
        FINANCIAL_DATA_ACCESS: 'Log for review.',
      },
      LOW: {
        LOGIN_ANOMALY: 'No action required. Log for reference.',
        PERMISSION_ESCALATION: 'No action required.',
        DATA_ACCESS_ANOMALY: 'No action required.',
        SYNC_FAILURE_SPIKE: 'No action required.',
        UNUSUAL_BULK_OPERATION: 'No action required.',
        OFF_HOURS_ACCESS: 'No action required.',
        RAPID_ORG_SWITCHING: 'No action required.',
        FINANCIAL_DATA_ACCESS: 'No action required.',
      },
    };

    return actions[risk]?.[alertType] || 'Review and take appropriate action based on context.';
  }

  private calculateConfidence(historySize: number, anomalyCount: number): number {
    // Base confidence on history size
    let confidence = Math.min(0.5 + (historySize / 200), 0.95);

    // Adjust for anomaly count (more anomalies = higher confidence something is wrong)
    confidence = Math.min(confidence + (anomalyCount * 0.05), 0.98);

    return Math.round(confidence * 100) / 100;
  }

  private async logAnomaly(alert: AnomalyAlert): Promise<{ id: string }> {
    const log = await prisma.audit_logs.create({
      data: {
        id: `anomaly_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
        userId: alert.userId,
        organizationId: alert.organizationId,
        action: 'security_anomaly',
        resource: 'user',
        method: 'DETECTION',
        success: true,
        metadata: {
          alertType: alert.alertType,
          username: alert.username,
          risk: alert.risk,
          anomaly: alert.anomaly,
          details: alert.details,
          reasoning: alert.reasoning,
          suggestedAction: alert.suggestedAction,
          confidence: alert.confidence,
          acknowledged: false,
        },
      },
    });

    logger.warn('Security anomaly detected', {
      alertId: log.id,
      alertType: alert.alertType,
      userId: alert.userId,
      risk: alert.risk,
      anomaly: alert.anomaly,
    });

    return { id: log.id };
  }

  // @ts-expect-error - Reserved for CRITICAL risk auto-actions (currently disabled)
  private async _autoSuspendUser(userId: string, reason: string): Promise<void> {
    try {
      await prisma.users.update({
        where: { id: userId },
        data: {
          serviceStatus: 'suspended',
          suspendedAt: new Date(),
        },
      });

      await prisma.audit_logs.create({
        data: {
          id: `suspend_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
          userId,
          action: 'auto_suspend',
          resource: 'user',
          method: 'SYSTEM',
          success: true,
          metadata: {
            reason: `Auto-suspended due to security anomaly: ${reason}`,
            triggeredBy: 'AnomalyDetectionService',
          },
        },
      });

      logger.warn('User auto-suspended due to security anomaly', { userId, reason });
    } catch (error) {
      logger.error('Failed to auto-suspend user:', error);
    }
  }
}

export default new AnomalyDetectionService();
