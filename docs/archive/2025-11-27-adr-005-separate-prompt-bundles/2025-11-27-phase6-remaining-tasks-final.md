# Phase 6: AI Foundation - Remaining Tasks (6.3, 6.4, 6.5)

**Generated**: 2025-11-27
**Source**: ADR-005 Multi-Tenant Access Control
**Format**: Complete, copy-paste ready prompt bundles

---

## Task 6.3: AI Financial Access Monitoring

**Agent**: @ai-security-red-teamer

### SYSTEM CONTEXT

You are implementing **Use Case 15: AI-Powered Financial Data Access Monitoring** from ADR-005-AI_OPPORTUNITIES.md. This AI service detects unusual financial data access patterns and alerts admins when users exhibit suspicious behavior (e.g., exporting thousands of records at 2am, accessing financials from unusual IP addresses).

**Critical Business Rule**: Financial data (cost, monthlyRate, purchasePrice) is HIGHLY SENSITIVE. Unauthorized access or exfiltration is a security incident.

**Detection Patterns**:
- Volume Anomalies: User exports 50x their normal record count
- Time Anomalies: Access at 2am when user typically works 9am-5pm
- Location Anomalies: IP address from different country
- User Agent Anomalies: Python scripts when user normally uses Chrome
- Permission Escalation: User gained `viewFinancialDetails` recently and immediately exports 5000 records

---

### BUSINESS CONTEXT (from ADR-005-DECISION.md)

**Problem**: Field Engineers and Viewers should NOT have unrestricted access to cost data. Financial transparency is role-based. We need AI to detect when someone is abusing their `viewFinancialDetails` permission or attempting data exfiltration.

**User Story**:
> As a Security Administrator, I want to receive real-time alerts when users exhibit unusual financial data access patterns, so I can respond to potential data breaches or insider threats within minutes.

**Acceptance Criteria**:
- AI learns normal access patterns per user over 30-90 days
- AI detects anomalies with >85% confidence before alerting
- Alerts include actionable recommendations (suspend user, revoke permission)
- False positive rate <5%
- Critical alerts trigger within 60 seconds of detection

---

### TECHNICAL SPECIFICATION

You must implement the following components:

#### 1. Financial Access Monitor Service

**File**: `backend/src/services/ai/FinancialAccessMonitorService.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { callAI } from './aiProviderClient';

const prisma = new PrismaClient();

interface AccessPattern {
  avgRecordsPerDay: number;
  peakHours: string[]; // e.g., ["09:00-12:00", "14:00-17:00"]
  avgExportsPerWeek: number;
  typicalOrganizations: string[];
  baselineConfidence: number; // 0.0-1.0
}

interface AnomalyAlert {
  alertType: 'UNUSUAL_FINANCIAL_ACCESS';
  userId: string;
  pattern: string; // Human-readable description
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: {
    recordCount: number;
    organizations: string[];
    timestamp: string; // ISO8601
    ipAddress: string;
    userAgent: string;
    geolocation?: string;
  };
  reasoning: string; // AI-generated explanation
  suggestedAction: string; // AI-generated recommendation
  confidence: number; // 0.0-1.0
}

export class FinancialAccessMonitorService {
  /**
   * Learn normal financial data access patterns for a user
   * Analyzes last 90 days of audit logs
   */
  async learnAccessPatterns(params: {
    userId: string;
    organizationId: string;
    period: 'last_30_days' | 'last_60_days' | 'last_90_days';
  }): Promise<AccessPattern> {
    const daysAgo = {
      last_30_days: 30,
      last_60_days: 60,
      last_90_days: 90,
    }[params.period];

    const since = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    // Fetch all financial access events
    const accessLogs = await prisma.auditLog.findMany({
      where: {
        userId: params.userId,
        organizationId: params.organizationId,
        action: {
          in: [
            'pfa:read_financial',
            'pfa:export_financial',
            'pfa:view_cost_details',
          ],
        },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (accessLogs.length < 10) {
      return {
        avgRecordsPerDay: 0,
        peakHours: [],
        avgExportsPerWeek: 0,
        typicalOrganizations: [],
        baselineConfidence: 0.1, // Not enough data
      };
    }

    // Calculate metrics
    const recordCounts = accessLogs.map((log) =>
      (log.metadata as any)?.recordCount || 0
    );
    const avgRecordsPerDay =
      recordCounts.reduce((sum, count) => sum + count, 0) / daysAgo;

    // Extract peak hours (hour-of-day histogram)
    const hourCounts = new Array(24).fill(0);
    accessLogs.forEach((log) => {
      const hour = new Date(log.createdAt).getHours();
      hourCounts[hour]++;
    });

    // Top 3 hours = peak hours
    const peakHourIndices = hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((entry) => entry.hour);

    const peakHours = peakHourIndices.map((hour) => {
      const start = hour.toString().padStart(2, '0');
      const end = ((hour + 1) % 24).toString().padStart(2, '0');
      return `${start}:00-${end}:00`;
    });

    // Calculate exports per week
    const exportLogs = accessLogs.filter((log) =>
      log.action.includes('export')
    );
    const avgExportsPerWeek = (exportLogs.length / daysAgo) * 7;

    // Typical organizations
    const orgCounts = new Map<string, number>();
    accessLogs.forEach((log) => {
      if (log.organizationId) {
        orgCounts.set(
          log.organizationId,
          (orgCounts.get(log.organizationId) || 0) + 1
        );
      }
    });
    const typicalOrganizations = Array.from(orgCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map((entry) => entry[0]);

    // Confidence based on data volume
    const baselineConfidence = Math.min(0.95, accessLogs.length / 100);

    return {
      avgRecordsPerDay,
      peakHours,
      avgExportsPerWeek,
      typicalOrganizations,
      baselineConfidence,
    };
  }

  /**
   * Detect anomaly in real-time financial access event
   */
  async detectAnomaly(params: {
    userId: string;
    organizationId: string;
    action: string; // 'pfa:read_financial', 'pfa:export_financial'
    recordCount: number;
    timestamp: Date;
    ipAddress: string;
    userAgent: string;
  }): Promise<AnomalyAlert | null> {
    // Load user's baseline pattern
    const baseline = await this.learnAccessPatterns({
      userId: params.userId,
      organizationId: params.organizationId,
      period: 'last_90_days',
    });

    if (baseline.baselineConfidence < 0.5) {
      // Not enough historical data to detect anomalies
      return null;
    }

    // Check for anomalies
    const anomalies: string[] = [];
    let risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

    // Volume anomaly
    const volumeMultiplier = params.recordCount / baseline.avgRecordsPerDay;
    if (volumeMultiplier > 50) {
      anomalies.push(
        `Volume anomaly: ${volumeMultiplier.toFixed(
          1
        )}x normal daily record count`
      );
      risk = 'CRITICAL';
    } else if (volumeMultiplier > 10) {
      anomalies.push(`High volume: ${volumeMultiplier.toFixed(1)}x normal`);
      risk = risk === 'CRITICAL' ? risk : 'HIGH';
    }

    // Time anomaly
    const hour = params.timestamp.getHours();
    const hourString = `${hour.toString().padStart(2, '0')}:00-${((hour + 1) % 24)
      .toString()
      .padStart(2, '0')}:00`;
    const isPeakHour = baseline.peakHours.includes(hourString);
    if (!isPeakHour && hour >= 22) {
      // After 10pm
      anomalies.push(`Time anomaly: Access at ${hourString} (outside peak hours)`);
      risk = risk === 'CRITICAL' ? risk : 'HIGH';
    }

    // User agent anomaly (detect scripts)
    const isScript = /python|curl|wget|postman|httpie/i.test(params.userAgent);
    if (isScript) {
      anomalies.push(`User agent anomaly: Automated script detected`);
      risk = risk === 'CRITICAL' ? risk : 'MEDIUM';
    }

    // IP address anomaly (simple heuristic: check if different from last 10 logins)
    const recentLogins = await prisma.auditLog.findMany({
      where: {
        userId: params.userId,
        action: 'user:login',
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const knownIPs = new Set(
      recentLogins.map((log) => (log.metadata as any)?.ipAddress).filter(Boolean)
    );
    if (!knownIPs.has(params.ipAddress)) {
      anomalies.push(`IP anomaly: New IP address not seen in last 30 days`);
      risk = risk === 'CRITICAL' ? risk : 'MEDIUM';
    }

    // If no anomalies detected, return null
    if (anomalies.length === 0) {
      return null;
    }

    // Generate AI reasoning and recommendation
    const aiPrompt = `
You are a security analyst detecting financial data access anomalies.

User Context:
- User ID: ${params.userId}
- Normal access: ${baseline.avgRecordsPerDay.toFixed(
      0
    )} records/day, peak hours ${baseline.peakHours.join(', ')}
- Current access: ${params.recordCount} records at ${params.timestamp.toISOString()}
- IP: ${params.ipAddress}, User-Agent: ${params.userAgent}

Detected Anomalies:
${anomalies.map((a) => `- ${a}`).join('\n')}

Risk Level: ${risk}

Generate:
1. A 1-sentence explanation of the suspicious pattern
2. A recommended action for the security team

Format as JSON:
{
  "reasoning": "...",
  "suggestedAction": "..."
}
`;

    const aiResponse = await callAI({
      provider: 'gemini',
      model: 'gemini-pro',
      prompt: aiPrompt,
      responseFormat: 'json',
    });

    const { reasoning, suggestedAction } = JSON.parse(aiResponse.text);

    // Create anomaly alert
    const alert: AnomalyAlert = {
      alertType: 'UNUSUAL_FINANCIAL_ACCESS',
      userId: params.userId,
      pattern: anomalies.join('; '),
      risk,
      details: {
        recordCount: params.recordCount,
        organizations: [params.organizationId],
        timestamp: params.timestamp.toISOString(),
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
      reasoning,
      suggestedAction,
      confidence: baseline.baselineConfidence,
    };

    // Log the alert
    await prisma.auditLog.create({
      data: {
        userId: 'SYSTEM',
        action: 'security:anomaly_detected',
        resourceId: params.userId,
        resourceType: 'User',
        changes: alert as any,
        metadata: { alertType: 'financial_access', risk },
      },
    });

    return alert;
  }

  /**
   * Real-time monitoring hook (called on every financial data access)
   */
  async monitorAccess(params: {
    userId: string;
    organizationId: string;
    action: string;
    recordCount: number;
    ipAddress: string;
    userAgent: string;
  }): Promise<void> {
    const alert = await this.detectAnomaly({
      ...params,
      timestamp: new Date(),
    });

    if (alert) {
      // Send notification to security team
      await this.notifySecurityTeam(alert);

      // If CRITICAL, auto-suspend user (configurable)
      if (alert.risk === 'CRITICAL') {
        const shouldAutoSuspend = await this.checkAutoSuspendPolicy(
          params.organizationId
        );
        if (shouldAutoSuspend) {
          await this.autoSuspendUser(params.userId, alert);
        }
      }
    }
  }

  private async notifySecurityTeam(alert: AnomalyAlert): Promise<void> {
    // TODO: Implement notification (Slack, Email, SMS)
    console.log('🚨 SECURITY ALERT:', alert);
  }

  private async checkAutoSuspendPolicy(organizationId: string): Promise<boolean> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    return (org?.settings as any)?.security?.autoSuspendOnCriticalAlert || false;
  }

  private async autoSuspendUser(
    userId: string,
    alert: AnomalyAlert
  ): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        serviceStatus: 'suspended',
        suspendedAt: new Date(),
        suspensionReason: `Auto-suspended: ${alert.reasoning}`,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: 'SYSTEM',
        action: 'user:auto_suspended',
        resourceId: userId,
        resourceType: 'User',
        changes: { alert } as any,
      },
    });
  }
}
```

#### 2. Controller Integration

**File**: `backend/src/controllers/pfaDataController.ts` (UPDATE EXISTING)

```typescript
import { FinancialAccessMonitorService } from '../services/ai/FinancialAccessMonitorService';

const financialMonitor = new FinancialAccessMonitorService();

// UPDATE existing GET /api/pfa/records endpoint
export const getPfaRecords = async (req: Request, res: Response) => {
  const { organizationId } = req.query;
  const includeFinancials = req.query.includeFinancials === 'true';

  // Check permission
  const userOrg = await prisma.userOrganization.findUnique({
    where: {
      userId_organizationId: {
        userId: req.user!.id,
        organizationId: organizationId as string,
      },
    },
  });

  const hasFinancialAccess =
    userOrg?.role === 'admin' ||
    (userOrg?.capabilities as any)?.viewFinancialDetails;

  if (includeFinancials && !hasFinancialAccess) {
    return res.status(403).json({ error: 'FINANCIAL_ACCESS_DENIED' });
  }

  // Fetch records
  const records = await prisma.pfaRecord.findMany({
    where: { organizationId: organizationId as string },
  });

  // 🚨 AI MONITORING HOOK (NEW)
  if (includeFinancials && hasFinancialAccess) {
    await financialMonitor.monitorAccess({
      userId: req.user!.id,
      organizationId: organizationId as string,
      action: 'pfa:read_financial',
      recordCount: records.length,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });
  }

  // Log to audit
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      organizationId: organizationId as string,
      action: includeFinancials ? 'pfa:read_financial' : 'pfa:read',
      resourceId: 'multiple',
      resourceType: 'PfaRecord',
      metadata: {
        recordCount: records.length,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    },
  });

  return res.json(records);
};

// UPDATE existing POST /api/pfa/export endpoint
export const exportPfaRecords = async (req: Request, res: Response) => {
  const { organizationId, includeFinancials } = req.body;

  // Permission check (same as above)
  const userOrg = await prisma.userOrganization.findUnique({
    where: {
      userId_organizationId: {
        userId: req.user!.id,
        organizationId,
      },
    },
  });

  const hasFinancialAccess =
    userOrg?.role === 'admin' ||
    (userOrg?.capabilities as any)?.viewFinancialDetails;

  if (includeFinancials && !hasFinancialAccess) {
    return res.status(403).json({ error: 'FINANCIAL_ACCESS_DENIED' });
  }

  // Fetch records for export
  const records = await prisma.pfaRecord.findMany({
    where: { organizationId },
  });

  // 🚨 AI MONITORING HOOK (NEW)
  if (includeFinancials && hasFinancialAccess) {
    await financialMonitor.monitorAccess({
      userId: req.user!.id,
      organizationId,
      action: 'pfa:export_financial',
      recordCount: records.length,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });
  }

  // Generate CSV...
  const csv = generateCSV(records, includeFinancials);

  return res.attachment('export.csv').send(csv);
};
```

#### 3. Admin Dashboard - Anomaly Alerts UI

**File**: `components/admin/SecurityAnomalies.tsx` (NEW)

```tsx
import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, Clock, User } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface AnomalyAlert {
  id: string;
  userId: string;
  username: string;
  pattern: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: {
    recordCount: number;
    timestamp: string;
    ipAddress: string;
    userAgent: string;
  };
  reasoning: string;
  suggestedAction: string;
  createdAt: string;
}

export function SecurityAnomalies() {
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    const data = await apiClient.getSecurityAlerts({ period: 'last_7_days' });
    setAlerts(data);
    setLoading(false);
  };

  const handleDismiss = async (alertId: string) => {
    await apiClient.dismissSecurityAlert(alertId);
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  const handleSuspendUser = async (userId: string, reason: string) => {
    if (!confirm(`Suspend user? Reason: ${reason}`)) return;
    await apiClient.suspendUser(userId, reason);
    loadAlerts(); // Refresh
  };

  const riskColors = {
    LOW: 'bg-gray-100 text-gray-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    HIGH: 'bg-orange-100 text-orange-800',
    CRITICAL: 'bg-red-100 text-red-800',
  };

  if (loading) return <div>Loading security alerts...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="w-6 h-6 text-red-600" />
        <h2 className="text-2xl font-bold">Security Anomalies</h2>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          ✅ No anomalies detected in the last 7 days
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="border rounded-lg p-4 bg-white shadow-sm"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <AlertTriangle
                    className={`w-6 h-6 ${
                      alert.risk === 'CRITICAL'
                        ? 'text-red-600'
                        : alert.risk === 'HIGH'
                        ? 'text-orange-600'
                        : 'text-yellow-600'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{alert.username}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          riskColors[alert.risk]
                        }`}
                      >
                        {alert.risk} RISK
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{alert.pattern}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(alert.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Details */}
              <div className="bg-gray-50 rounded p-3 mb-3 text-sm">
                <p className="font-medium mb-2">🤖 AI Analysis:</p>
                <p className="text-gray-700">{alert.reasoning}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div>
                  <span className="font-medium">Record Count:</span>{' '}
                  {alert.details.recordCount.toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">IP Address:</span>{' '}
                  {alert.details.ipAddress}
                </div>
                <div className="col-span-2">
                  <span className="font-medium">User Agent:</span>{' '}
                  {alert.details.userAgent}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t">
                <div className="text-sm">
                  <span className="font-medium">💡 Recommended Action:</span>{' '}
                  <span className="text-gray-700">{alert.suggestedAction}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() =>
                      handleSuspendUser(alert.userId, alert.reasoning)
                    }
                    className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded"
                  >
                    Suspend User
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### 4. API Routes

**File**: `backend/src/routes/securityRoutes.ts` (NEW)

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/requirePermission';

const router = Router();

// GET /api/security/alerts
router.get(
  '/alerts',
  authenticate,
  requirePermission('perm_ManageUsers'), // Only admins
  async (req, res) => {
    const { period } = req.query;

    const daysAgo = {
      last_7_days: 7,
      last_30_days: 30,
      last_90_days: 90,
    }[period as string] || 7;

    const since = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    const alerts = await prisma.auditLog.findMany({
      where: {
        action: 'security:anomaly_detected',
        createdAt: { gte: since },
      },
      include: {
        user: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = alerts.map((log) => {
      const alert = log.changes as any;
      return {
        id: log.id,
        userId: alert.userId,
        username: log.user?.username || 'Unknown',
        pattern: alert.pattern,
        risk: alert.risk,
        details: alert.details,
        reasoning: alert.reasoning,
        suggestedAction: alert.suggestedAction,
        createdAt: log.createdAt,
      };
    });

    return res.json(formatted);
  }
);

// POST /api/security/alerts/:id/dismiss
router.post(
  '/alerts/:id/dismiss',
  authenticate,
  requirePermission('perm_ManageUsers'),
  async (req, res) => {
    const { id } = req.params;

    await prisma.auditLog.update({
      where: { id },
      data: {
        metadata: { dismissed: true, dismissedAt: new Date(), dismissedBy: req.user!.id },
      },
    });

    return res.json({ success: true });
  }
);

export default router;
```

---

### 🚨 AI ENFORCEMENT (MANDATORY)

Your implementation MUST include:

1. **Baseline Learning**:
   - ✅ Analyze 90 days of historical access patterns per user
   - ✅ Calculate `avgRecordsPerDay`, `peakHours`, `avgExportsPerWeek`
   - ✅ Track typical organizations accessed

2. **Real-Time Anomaly Detection**:
   - ✅ Detect volume anomalies (>10x normal = HIGH, >50x = CRITICAL)
   - ✅ Detect time anomalies (access at 2am when user typically works 9-5)
   - ✅ Detect user agent anomalies (Python scripts when user uses Chrome)
   - ✅ Detect IP address anomalies (new IP not seen in last 30 days)

3. **AI-Generated Alerts**:
   - ✅ Use Google Gemini to generate human-readable reasoning
   - ✅ Include risk level: LOW / MEDIUM / HIGH / CRITICAL
   - ✅ Include suggested action (e.g., "Suspend user immediately")

4. **Auto-Suspension**:
   - ✅ For CRITICAL alerts, check org policy `settings.security.autoSuspendOnCriticalAlert`
   - ✅ If enabled, auto-suspend user and log action

5. **Audit Logging**:
   - ✅ Log every financial access event with `recordCount`, `ipAddress`, `userAgent`
   - ✅ Log every anomaly detection event with full alert details

**AI Model Requirements**:
- Provider: Google Gemini (gemini-pro)
- Input: User baseline, current access details, detected anomalies
- Output: JSON with `reasoning` and `suggestedAction`
- Confidence threshold: >0.85 before alerting

---

### 🎨 UX ENFORCEMENT (MANDATORY)

1. **Security Anomalies Dashboard**:
   - ✅ Real-time alerts shown in Admin Dashboard
   - ✅ Color-coded risk badges (gray/yellow/orange/red)
   - ✅ AI reasoning displayed in gray box with robot emoji
   - ✅ Recommended actions shown with lightbulb emoji
   - ✅ Dismiss and Suspend actions (with confirmation)

2. **Alert Notifications**:
   - ✅ CRITICAL alerts trigger immediate Slack/Email notification
   - ✅ Alert includes: username, pattern, risk, suggested action
   - ✅ Link to admin dashboard for details

3. **Performance**:
   - ✅ Anomaly detection completes in <500ms (non-blocking)
   - ✅ Security dashboard loads <1 second for 100 alerts

4. **Accessibility**:
   - ✅ Risk badges have sufficient color contrast (WCAG AA)
   - ✅ Alert cards keyboard navigable

---

### YOUR MISSION

1. **Implement FinancialAccessMonitorService** with all 4 methods:
   - `learnAccessPatterns()` - Analyze 90 days of audit logs
   - `detectAnomaly()` - Real-time anomaly detection
   - `monitorAccess()` - Hook called on every financial access
   - Private helpers: `notifySecurityTeam()`, `checkAutoSuspendPolicy()`, `autoSuspendUser()`

2. **Update pfaDataController.ts**:
   - Add monitoring hooks to `GET /api/pfa/records` (when includeFinancials=true)
   - Add monitoring hooks to `POST /api/pfa/export` (when includeFinancials=true)
   - Ensure audit logging captures `recordCount`, `ipAddress`, `userAgent`

3. **Create SecurityAnomalies.tsx** component:
   - Display last 7 days of alerts (configurable)
   - Color-coded risk badges
   - AI reasoning with robot emoji
   - Dismiss and Suspend actions

4. **Create securityRoutes.ts**:
   - `GET /api/security/alerts?period=last_7_days`
   - `POST /api/security/alerts/:id/dismiss`

5. **Test Coverage**:
   - Write tests for each anomaly type (volume, time, IP, user agent)
   - Test auto-suspension for CRITICAL alerts
   - Test false positive rate (should be <5%)

---

### DELIVERABLES

1. **Backend Services**:
   - `backend/src/services/ai/FinancialAccessMonitorService.ts` (300+ lines)
   - `backend/src/controllers/pfaDataController.ts` (updated with monitoring hooks)
   - `backend/src/routes/securityRoutes.ts` (new)

2. **Frontend Components**:
   - `components/admin/SecurityAnomalies.tsx` (200+ lines)
   - Update `components/AdminDashboard.tsx` to include SecurityAnomalies tab

3. **Tests**:
   - `backend/tests/integration/financialAccessMonitoring.test.ts`
   - Test cases: volume anomaly, time anomaly, IP anomaly, auto-suspension

4. **Documentation**:
   - Update `docs/backend/API_REFERENCE.md` with `/api/security/alerts` endpoint
   - Add security monitoring guide to README.md

---

### CONSTRAINTS

**❌ DO NOT**:
- Create new database tables (use existing `AuditLog` and `User` tables)
- Block financial access requests (monitoring is passive, not blocking)
- Alert on first-time users (baseline confidence must be >0.5)
- Use synchronous AI calls (use async to avoid blocking API responses)

**✅ DO**:
- Use Google Gemini for AI reasoning generation
- Log all anomalies to `AuditLog` with action='security:anomaly_detected'
- Allow admins to configure auto-suspension policy per organization
- Provide clear, actionable recommendations in alerts

---

### VERIFICATION QUESTIONS

Before marking this task complete, verify:

1. ✅ Does `learnAccessPatterns()` return valid baseline for users with >10 access events?
2. ✅ Does `detectAnomaly()` correctly identify volume, time, IP, and user agent anomalies?
3. ✅ Are CRITICAL alerts auto-suspending users when `autoSuspendOnCriticalAlert=true`?
4. ✅ Does SecurityAnomalies dashboard display color-coded risk badges and AI reasoning?
5. ✅ Are all financial access events logged to AuditLog with metadata?
6. ✅ Is false positive rate <5% (test with normal user behavior)?

---

**Status**: 📋 Pending
**Dependencies**: Phase 2 (Middleware), Phase 4 (Frontend PermissionGuard)
**Estimated Time**: 6-8 hours

---

## Task 6.4: AI Natural Language Permission Queries

**Agent**: @ai-systems-architect

### SYSTEM CONTEXT

You are implementing **Use Case 5: AI Natural Language Permission Queries** from ADR-005-AI_OPPORTUNITIES.md. This AI service allows admins to query the permission system using natural language (e.g., "Show me all users with write access to more than 5 organizations") and receive structured results with AI-generated insights.

**Critical Business Rule**: Admins need fast, intuitive ways to audit permissions across 100+ users and 10+ organizations. SQL queries are too technical. Natural language is the solution.

**Query Patterns**:
- User Aggregation: "Which users have write access to more than 5 orgs?"
- Permission Audit: "Who can delete PFA records in org HOLNG?"
- Temporal Queries: "Show users who gained admin permissions in the last 30 days"
- Capability Analysis: "Which Field Engineers have viewFinancialDetails permission?"
- Cross-Org Analysis: "List all admins across all organizations"

---

### BUSINESS CONTEXT (from ADR-005-DECISION.md)

**Problem**: Security audits require answering complex permission questions. Currently, admins must write SQL or manually inspect 100+ user records. This is slow and error-prone.

**User Story**:
> As a Security Administrator, I want to ask permission questions in plain English (e.g., "Who can sync data?") and receive instant results with AI-generated insights, so I can complete audits in minutes instead of hours.

**Acceptance Criteria**:
- AI parses natural language queries with >90% accuracy
- Query results returned in <2 seconds
- AI provides actionable insights (e.g., "Consider revoking access from 3 users")
- Supports multi-turn conversations (follow-up questions)
- Semantic search on audit logs (e.g., "Who changed permissions yesterday?")

---

### TECHNICAL SPECIFICATION

You must implement the following components:

#### 1. Natural Language Query Parser Service

**File**: `backend/src/services/ai/NLQueryParserService.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { callAI } from './aiProviderClient';

const prisma = new PrismaClient();

interface ParsedQuery {
  intent: 'user_list' | 'permission_audit' | 'temporal_query' | 'capability_analysis';
  filters: {
    role?: string; // 'admin', 'editor', 'viewer'
    capabilities?: string[]; // e.g., ['canWrite', 'canDelete']
    organizationIds?: string[];
    timeRange?: { start: Date; end: Date };
    aggregation?: { field: string; operator: string; threshold: number };
  };
  confidence: number; // 0.0-1.0
}

interface QueryResult {
  results: any[]; // User objects, Permission objects, etc.
  insight: string; // AI-generated summary
  count: number;
  executionTime: number; // milliseconds
}

export class NLQueryParserService {
  /**
   * Parse natural language query and execute
   */
  async executeQuery(params: {
    query: string;
    userId: string; // Admin user making the query
    organizationId: string;
  }): Promise<QueryResult> {
    const startTime = Date.now();

    // Step 1: Parse query with AI
    const parsed = await this.parseQuery(params.query);

    if (parsed.confidence < 0.7) {
      throw new Error('Could not understand query. Please rephrase.');
    }

    // Step 2: Build and execute database query
    const results = await this.executeDatabaseQuery(parsed, params.organizationId);

    // Step 3: Generate AI insight
    const insight = await this.generateInsight(params.query, results);

    const executionTime = Date.now() - startTime;

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        organizationId: params.organizationId,
        action: 'permission:nl_query',
        resourceId: 'multiple',
        resourceType: 'UserOrganization',
        metadata: {
          query: params.query,
          resultCount: results.length,
          executionTime,
        },
      },
    });

    return {
      results,
      insight,
      count: results.length,
      executionTime,
    };
  }

  /**
   * Parse natural language query using AI
   */
  private async parseQuery(query: string): Promise<ParsedQuery> {
    const prompt = `
You are a semantic query parser for a permission system.

User Query: "${query}"

Parse this query and extract:
1. Intent: user_list | permission_audit | temporal_query | capability_analysis
2. Filters:
   - role: admin | editor | viewer (if mentioned)
   - capabilities: array of capability names (canWrite, canDelete, canSync, viewFinancialDetails, etc.)
   - organizationIds: array of org codes (if mentioned, e.g., "HOLNG", "RIO")
   - timeRange: { start: ISO8601, end: ISO8601 } (if temporal, e.g., "last 30 days")
   - aggregation: { field: "organizationIds", operator: ">", threshold: 5 } (if counting, e.g., "more than 5 orgs")
3. Confidence: 0.0-1.0 (how confident you are in the parse)

Examples:
- "Show me all users with write access to more than 5 organizations"
  → intent: user_list, aggregation: { field: "organizationIds", operator: ">", threshold: 5 }, capabilities: ["canWrite"]

- "Who can delete PFA records in org HOLNG?"
  → intent: permission_audit, organizationIds: ["HOLNG"], capabilities: ["canDelete"]

- "List users who gained admin permissions in the last 30 days"
  → intent: temporal_query, role: "admin", timeRange: { start: "30 days ago", end: "now" }

- "Which Field Engineers have viewFinancialDetails permission?"
  → intent: capability_analysis, role: "editor", capabilities: ["viewFinancialDetails"]

Return JSON:
{
  "intent": "...",
  "filters": { ... },
  "confidence": 0.92
}
`;

    const response = await callAI({
      provider: 'gemini',
      model: 'gemini-pro',
      prompt,
      responseFormat: 'json',
    });

    const parsed = JSON.parse(response.text);

    // Convert relative time ranges to absolute dates
    if (parsed.filters.timeRange) {
      const { start, end } = parsed.filters.timeRange;
      if (typeof start === 'string' && start.includes('ago')) {
        const daysAgo = parseInt(start.match(/\d+/)?.[0] || '30');
        parsed.filters.timeRange.start = new Date(
          Date.now() - daysAgo * 24 * 60 * 60 * 1000
        );
      }
      if (typeof end === 'string' && end === 'now') {
        parsed.filters.timeRange.end = new Date();
      }
    }

    return parsed;
  }

  /**
   * Execute parsed query against database
   */
  private async executeDatabaseQuery(
    parsed: ParsedQuery,
    organizationId: string
  ): Promise<any[]> {
    const { intent, filters } = parsed;

    switch (intent) {
      case 'user_list': {
        // Example: "Show me all users with write access to more than 5 organizations"
        const users = await prisma.user.findMany({
          include: {
            userOrganizations: {
              where: {
                ...(filters.capabilities?.includes('canWrite') && { canWrite: true }),
                ...(filters.capabilities?.includes('canDelete') && { canDelete: true }),
                ...(filters.capabilities?.includes('canSync') && { canSync: true }),
              },
            },
          },
        });

        // Filter by aggregation
        if (filters.aggregation) {
          const { field, operator, threshold } = filters.aggregation;
          return users.filter((user) => {
            if (field === 'organizationIds') {
              const orgCount = user.userOrganizations.length;
              if (operator === '>') return orgCount > threshold;
              if (operator === '<') return orgCount < threshold;
              if (operator === '=') return orgCount === threshold;
            }
            return false;
          });
        }

        return users;
      }

      case 'permission_audit': {
        // Example: "Who can delete PFA records in org HOLNG?"
        const userOrgs = await prisma.userOrganization.findMany({
          where: {
            organizationId: filters.organizationIds?.[0] || organizationId,
            ...(filters.capabilities?.includes('canDelete') && { canDelete: true }),
          },
          include: {
            user: { select: { id: true, username: true, email: true } },
            organization: { select: { name: true, code: true } },
          },
        });

        return userOrgs.map((uo) => ({
          userId: uo.user.id,
          username: uo.user.username,
          email: uo.user.email,
          role: uo.role,
          organization: uo.organization,
        }));
      }

      case 'temporal_query': {
        // Example: "List users who gained admin permissions in the last 30 days"
        const { start, end } = filters.timeRange || {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(),
        };

        const auditLogs = await prisma.auditLog.findMany({
          where: {
            action: 'permission:grant',
            createdAt: { gte: start, lte: end },
            changes: {
              path: ['after', 'role'],
              equals: filters.role || 'admin',
            },
          },
          include: {
            user: { select: { username: true, email: true } },
          },
        });

        return auditLogs.map((log) => ({
          userId: log.userId,
          username: log.user?.username,
          grantedAt: log.createdAt,
          role: (log.changes as any).after.role,
        }));
      }

      case 'capability_analysis': {
        // Example: "Which Field Engineers have viewFinancialDetails permission?"
        const userOrgs = await prisma.userOrganization.findMany({
          where: {
            role: filters.role || 'editor',
            capabilities: {
              path: filters.capabilities?.[0] || 'viewFinancialDetails',
              equals: true,
            },
          },
          include: {
            user: { select: { id: true, username: true, email: true } },
            organization: { select: { name: true, code: true } },
          },
        });

        return userOrgs.map((uo) => ({
          userId: uo.user.id,
          username: uo.user.username,
          email: uo.user.email,
          role: uo.role,
          organization: uo.organization,
          capabilities: uo.capabilities,
        }));
      }

      default:
        throw new Error(`Unsupported intent: ${intent}`);
    }
  }

  /**
   * Generate AI insight from query results
   */
  private async generateInsight(query: string, results: any[]): Promise<string> {
    const prompt = `
You are a security analyst summarizing permission query results.

User Query: "${query}"

Results: ${results.length} records found

Sample Results (first 3):
${JSON.stringify(results.slice(0, 3), null, 2)}

Generate a 1-2 sentence insight that:
1. Summarizes what was found
2. Provides an actionable recommendation (if applicable)

Examples:
- "2 users have write access to 5+ organizations. Consider auditing for security."
- "5 Field Engineers have viewFinancialDetails permission. This is typical for their role."
- "No users gained admin permissions in the last 30 days. Access control is stable."

Return plain text (not JSON).
`;

    const response = await callAI({
      provider: 'gemini',
      model: 'gemini-pro',
      prompt,
      responseFormat: 'text',
    });

    return response.text.trim();
  }

  /**
   * Semantic search on audit logs (for follow-up questions)
   */
  async searchAuditLogs(params: {
    query: string;
    userId: string;
    organizationId: string;
  }): Promise<QueryResult> {
    const startTime = Date.now();

    // Parse query (focus on temporal and action filters)
    const prompt = `
Parse this audit log search query:
"${params.query}"

Extract:
1. Actions (e.g., ["permission:grant", "permission:revoke", "user:suspend"])
2. Time range (e.g., "last week", "yesterday", "last 30 days")
3. User mentions (if any)

Return JSON:
{
  "actions": string[],
  "timeRange": { "start": ISO8601, "end": ISO8601 },
  "users": string[],
  "confidence": number
}
`;

    const aiResponse = await callAI({
      provider: 'gemini',
      model: 'gemini-pro',
      prompt,
      responseFormat: 'json',
    });

    const parsed = JSON.parse(aiResponse.text);

    // Query audit logs
    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId: params.organizationId,
        action: { in: parsed.actions },
        createdAt: {
          gte: new Date(parsed.timeRange.start),
          lte: new Date(parsed.timeRange.end),
        },
      },
      include: {
        user: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Generate natural language summary
    const summaryPrompt = `
Summarize these audit log results:
Query: "${params.query}"
Results: ${logs.length} events found

Sample events:
${JSON.stringify(logs.slice(0, 5), null, 2)}

Generate a natural language summary (2-3 sentences).
`;

    const summaryResponse = await callAI({
      provider: 'gemini',
      model: 'gemini-pro',
      prompt: summaryPrompt,
      responseFormat: 'text',
    });

    const executionTime = Date.now() - startTime;

    return {
      results: logs,
      insight: summaryResponse.text.trim(),
      count: logs.length,
      executionTime,
    };
  }
}
```

#### 2. Controller and Routes

**File**: `backend/src/routes/permissionQueryRoutes.ts` (NEW)

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/requirePermission';
import { NLQueryParserService } from '../services/ai/NLQueryParserService';

const router = Router();
const nlQueryParser = new NLQueryParserService();

// POST /api/permissions/query
router.post(
  '/query',
  authenticate,
  requirePermission('perm_ManageUsers'), // Only admins
  async (req, res) => {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query string required' });
    }

    try {
      const result = await nlQueryParser.executeQuery({
        query,
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
      });

      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }
);

// POST /api/permissions/search-audit
router.post(
  '/search-audit',
  authenticate,
  requirePermission('perm_ManageUsers'),
  async (req, res) => {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query string required' });
    }

    try {
      const result = await nlQueryParser.searchAuditLogs({
        query,
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
      });

      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }
);

export default router;
```

#### 3. Frontend Component - Permission Query Panel

**File**: `components/admin/PermissionQueryPanel.tsx` (NEW)

```tsx
import { useState } from 'react';
import { Search, Sparkles, Clock, Users } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface QueryResult {
  results: any[];
  insight: string;
  count: number;
  executionTime: number;
}

export function PermissionQueryPanel() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const data = await apiClient.executePermissionQuery(query);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Query failed');
    } finally {
      setLoading(false);
    }
  };

  const exampleQueries = [
    'Show me all users with write access to more than 5 organizations',
    'Who can delete PFA records in org HOLNG?',
    'List users who gained admin permissions in the last 30 days',
    'Which Field Engineers have viewFinancialDetails permission?',
    'Show all admins across all organizations',
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-6 h-6 text-purple-600" />
        <h2 className="text-2xl font-bold">AI Permission Query</h2>
      </div>

      {/* Query Input */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about permissions... (e.g., 'Who can sync data?')"
            className="w-full pl-10 pr-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50"
          >
            {loading ? 'Querying...' : 'Search'}
          </button>
          {result && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              <span>{result.executionTime}ms</span>
            </div>
          )}
        </div>
      </form>

      {/* Example Queries */}
      <div className="bg-gray-50 rounded p-3">
        <p className="text-xs font-medium text-gray-700 mb-2">💡 Example Queries:</p>
        <div className="space-y-1">
          {exampleQueries.map((example, i) => (
            <button
              key={i}
              onClick={() => setQuery(example)}
              className="block w-full text-left text-xs text-purple-600 hover:text-purple-800 hover:underline"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          ❌ {error}
        </div>
      )}

      {/* Results */}
      {result && !error && (
        <div className="space-y-3">
          {/* AI Insight */}
          <div className="bg-purple-50 border border-purple-200 rounded p-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">AI Insight</span>
            </div>
            <p className="text-sm text-purple-800">{result.insight}</p>
          </div>

          {/* Result Count */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users className="w-4 h-4" />
            <span>
              <strong>{result.count}</strong> results found
            </span>
          </div>

          {/* Results Table */}
          <div className="border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {Object.keys(result.results[0] || {}).map((key) => (
                    <th key={key} className="px-4 py-2 text-left font-medium text-gray-700">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.results.map((row, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    {Object.values(row).map((value, j) => (
                      <td key={j} className="px-4 py-2 text-gray-600">
                        {typeof value === 'object'
                          ? JSON.stringify(value)
                          : String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
```

#### 4. API Client Methods

**File**: `services/apiClient.ts` (UPDATE EXISTING)

```typescript
// Add to apiClient class
async executePermissionQuery(query: string): Promise<QueryResult> {
  const response = await this.post('/api/permissions/query', { query });
  return response.data;
}

async searchAuditLogs(query: string): Promise<QueryResult> {
  const response = await this.post('/api/permissions/search-audit', { query });
  return response.data;
}
```

---

### 🚨 AI ENFORCEMENT (MANDATORY)

Your implementation MUST include:

1. **Query Parsing**:
   - ✅ Use Google Gemini to parse natural language queries
   - ✅ Extract intent: user_list | permission_audit | temporal_query | capability_analysis
   - ✅ Extract filters: role, capabilities, organizationIds, timeRange, aggregation
   - ✅ Confidence threshold: >0.7 to execute query

2. **Database Execution**:
   - ✅ Map parsed filters to Prisma queries
   - ✅ Support aggregation (e.g., "more than 5 organizations")
   - ✅ Support temporal queries (e.g., "last 30 days")
   - ✅ Support capability analysis (e.g., "viewFinancialDetails")

3. **AI Insights**:
   - ✅ Generate 1-2 sentence summary of results
   - ✅ Include actionable recommendations (e.g., "Consider auditing for security")
   - ✅ Use Google Gemini for insight generation

4. **Performance**:
   - ✅ Query execution time <2 seconds
   - ✅ Audit logging for all queries

**AI Model Requirements**:
- Provider: Google Gemini (gemini-pro)
- Input: Natural language query
- Output: JSON with intent, filters, confidence
- Fallback: If confidence <0.7, return error asking user to rephrase

---

### 🎨 UX ENFORCEMENT (MANDATORY)

1. **Permission Query Panel**:
   - ✅ Search input with magnifying glass icon
   - ✅ Example queries clickable (auto-fill input)
   - ✅ Real-time execution time display (in ms)
   - ✅ AI Insight displayed in purple box with sparkles icon
   - ✅ Results shown in responsive table

2. **Performance**:
   - ✅ Query results load <2 seconds
   - ✅ Loading state shown during execution

3. **Accessibility**:
   - ✅ Search input keyboard accessible
   - ✅ Example queries keyboard navigable

---

### YOUR MISSION

1. **Implement NLQueryParserService** with 4 methods:
   - `executeQuery()` - Parse and execute NL query
   - `parseQuery()` - AI-powered query parsing
   - `executeDatabaseQuery()` - Map parsed query to Prisma
   - `generateInsight()` - AI-generated summary
   - `searchAuditLogs()` - Semantic audit log search

2. **Create permissionQueryRoutes.ts**:
   - `POST /api/permissions/query` (execute NL query)
   - `POST /api/permissions/search-audit` (semantic audit search)

3. **Create PermissionQueryPanel.tsx**:
   - Search input with example queries
   - AI Insight display
   - Results table

4. **Update apiClient.ts**:
   - Add `executePermissionQuery()` method
   - Add `searchAuditLogs()` method

5. **Test Coverage**:
   - Test all 4 query intents (user_list, permission_audit, temporal_query, capability_analysis)
   - Test aggregation queries (e.g., "more than 5 orgs")
   - Test temporal queries (e.g., "last 30 days")

---

### DELIVERABLES

1. **Backend Services**:
   - `backend/src/services/ai/NLQueryParserService.ts` (400+ lines)
   - `backend/src/routes/permissionQueryRoutes.ts` (new)

2. **Frontend Components**:
   - `components/admin/PermissionQueryPanel.tsx` (150+ lines)
   - Update `components/AdminDashboard.tsx` to include PermissionQueryPanel tab

3. **Tests**:
   - `backend/tests/integration/nlPermissionQueries.test.ts`
   - Test cases: user_list, permission_audit, temporal_query, capability_analysis

4. **Documentation**:
   - Update `docs/backend/API_REFERENCE.md` with `/api/permissions/query` endpoint
   - Add query examples to README.md

---

### CONSTRAINTS

**❌ DO NOT**:
- Execute queries with confidence <0.7 (ask user to rephrase)
- Allow non-admin users to query permissions (requires `perm_ManageUsers`)
- Return sensitive data in error messages (no SQL exposed)

**✅ DO**:
- Use Google Gemini for query parsing and insight generation
- Log all queries to `AuditLog` for security tracking
- Provide helpful example queries in UI
- Return execution time for performance transparency

---

### VERIFICATION QUESTIONS

Before marking this task complete, verify:

1. ✅ Does AI correctly parse all 5 example queries?
2. ✅ Are query results returned in <2 seconds for 100+ users?
3. ✅ Does AI insight provide actionable recommendations?
4. ✅ Is PermissionQueryPanel displaying example queries and results correctly?
5. ✅ Are all queries logged to AuditLog with metadata?
6. ✅ Does error handling work for ambiguous queries (confidence <0.7)?

---

**Status**: 📋 Pending
**Dependencies**: Phase 2 (Middleware), Phase 4 (Frontend PermissionGuard)
**Estimated Time**: 6-8 hours

---

## Task 6.5: AI Data Hooks Implementation

**Agent**: @backend-architecture-optimizer

### SYSTEM CONTEXT

You are implementing **Data Hooks for AI Training** from ADR-005-AI_OPPORTUNITIES.md. This task ensures that ALL permission-related events, PEMS sync operations, and user actions are logged with sufficient metadata to train future AI models.

**Critical Business Rule**: AI models require high-quality training data. Every permission change, sync event, and user action must be logged with WHO, WHAT, WHEN, WHY, and HOW.

**Data Hooks Required**:
1. **Audit Logging**: Comprehensive change tracking with before/after snapshots
2. **External ID Tracking**: Link local records to PEMS IDs for hybrid sync
3. **Metadata Capture**: IP addresses, user agents, geolocation, timestamps
4. **Batch Grouping**: Group related changes (e.g., bulk operations) for AI pattern analysis
5. **Reason Tracking**: Capture user-provided reasons for changes

---

### BUSINESS CONTEXT (from ADR-005-DECISION.md)

**Problem**: Current audit logging is minimal (action + timestamp). AI features require rich metadata: WHY did the user make this change? WHAT was the before/after state? WHERE did the request originate?

**User Story**:
> As a Product Manager, I want all user actions logged with sufficient context (reason, IP, user agent, before/after state), so that future AI features can analyze patterns, detect anomalies, and provide intelligent recommendations.

**Acceptance Criteria**:
- Audit log captures before/after state for every permission change
- Batch operations grouped with `batchId` for pattern analysis
- External IDs tracked for PEMS sync correlation
- User-provided reasons captured (e.g., "Weather delay extension")
- IP address and geolocation logged for security analysis
- >95% of actions logged successfully

---

### TECHNICAL SPECIFICATION

You must implement the following components:

#### 1. Enhanced Audit Log Schema

**File**: `backend/prisma/schema.prisma` (UPDATE EXISTING)

```prisma
model AuditLog {
  id             String   @id @default(cuid())

  // WHO (Actor)
  userId         String   // Who performed the action
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // WHERE (Context)
  organizationId String?  // Nullable for System-level actions
  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // WHAT (Action)
  action         String   // "pfa:update", "user:promote", "sync:force", "pat:usage", "permission:grant"
  resourceId     String   // ID of affected resource
  resourceType   String   // "PfaRecord", "UserOrganization", "Organization", "User"

  // THE EVIDENCE (for AI analysis and revert)
  changes        Json     // { "before": {...}, "after": {...} }
  reason         String?  // User's comment: "Weather delay extension"
  metadata       Json     // { "ip": "192.168.1.1", "userAgent": "Chrome...", "geolocation": {...} }

  // BATCH GROUPING (allows reverting 50 records changed in one click)
  batchId        String?  // UUID for batch operations
  batchSize      Int?     // Total records in batch
  batchIndex     Int?     // Index within batch (1-based)

  // EXTERNAL ID TRACKING (for PEMS sync correlation)
  externalId     String?  // PEMS ID if action relates to external entity
  externalSystem String?  // "PEMS", "ESS", "Procurement"

  // TEMPORAL
  createdAt      DateTime @default(now())

  // INDEXES (optimize for AI queries)
  @@index([organizationId, createdAt])  // Org-specific audit trail
  @@index([userId, createdAt])          // User activity timeline
  @@index([resourceType, resourceId])   // Resource change history
  @@index([batchId])                    // Batch operation lookup
  @@index([action])                     // Action-type queries
  @@index([externalId, externalSystem]) // PEMS sync correlation
}
```

**Migration**:
```bash
cd backend
npx prisma migrate dev --name add_ai_data_hooks_to_audit_log
```

#### 2. Audit Service (Centralized Logging)

**File**: `backend/src/services/audit/AuditService.ts` (NEW)

```typescript
import { PrismaClient } from '@prisma/client';
import geoip from 'geoip-lite'; // npm install geoip-lite
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

interface AuditParams {
  userId: string;
  organizationId?: string;
  action: string; // e.g., "pfa:update", "permission:grant", "sync:complete"
  resourceId: string;
  resourceType: string; // "PfaRecord", "UserOrganization", "Organization", "User"
  changes: {
    before?: any;
    after?: any;
  };
  reason?: string; // User-provided reason
  metadata?: Record<string, any>; // Extra context
  batchId?: string; // For batch operations
  batchSize?: number;
  batchIndex?: number;
  externalId?: string; // PEMS ID
  externalSystem?: string; // "PEMS", "ESS", etc.
  req?: any; // Express request object (for IP, user agent)
}

export class AuditService {
  /**
   * Create comprehensive audit log entry
   */
  static async log(params: AuditParams): Promise<void> {
    // Extract IP and user agent from request
    const ip = params.req?.ip || params.metadata?.ipAddress || 'unknown';
    const userAgent =
      params.req?.headers?.['user-agent'] ||
      params.metadata?.userAgent ||
      'unknown';

    // Geolocation lookup
    const geo = geoip.lookup(ip);
    const geolocation = geo
      ? {
          country: geo.country,
          region: geo.region,
          city: geo.city,
          ll: geo.ll, // [latitude, longitude]
          timezone: geo.timezone,
        }
      : null;

    // Merge metadata
    const metadata = {
      ...params.metadata,
      ipAddress: ip,
      userAgent,
      geolocation,
      timestamp: new Date().toISOString(),
    };

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        organizationId: params.organizationId,
        action: params.action,
        resourceId: params.resourceId,
        resourceType: params.resourceType,
        changes: params.changes,
        reason: params.reason,
        metadata,
        batchId: params.batchId,
        batchSize: params.batchSize,
        batchIndex: params.batchIndex,
        externalId: params.externalId,
        externalSystem: params.externalSystem,
      },
    });
  }

  /**
   * Generate batch ID for bulk operations
   */
  static generateBatchId(): string {
    return uuidv4();
  }

  /**
   * Log batch operation (multiple records)
   */
  static async logBatch(params: {
    userId: string;
    organizationId?: string;
    action: string;
    resourceType: string;
    records: Array<{
      resourceId: string;
      before?: any;
      after?: any;
      externalId?: string;
    }>;
    reason?: string;
    req?: any;
  }): Promise<void> {
    const batchId = this.generateBatchId();
    const batchSize = params.records.length;

    // Log each record in batch
    await Promise.all(
      params.records.map((record, index) =>
        this.log({
          userId: params.userId,
          organizationId: params.organizationId,
          action: params.action,
          resourceId: record.resourceId,
          resourceType: params.resourceType,
          changes: {
            before: record.before,
            after: record.after,
          },
          reason: params.reason,
          batchId,
          batchSize,
          batchIndex: index + 1,
          externalId: record.externalId,
          req: params.req,
        })
      )
    );
  }

  /**
   * Log permission change
   */
  static async logPermissionChange(params: {
    userId: string; // Admin who made the change
    targetUserId: string; // User whose permissions changed
    organizationId: string;
    before: any; // Old UserOrganization
    after: any; // New UserOrganization
    reason?: string;
    req?: any;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      organizationId: params.organizationId,
      action: 'permission:grant',
      resourceId: params.targetUserId,
      resourceType: 'UserOrganization',
      changes: {
        before: params.before,
        after: params.after,
      },
      reason: params.reason,
      req: params.req,
    });
  }

  /**
   * Log PEMS sync event
   */
  static async logPemsSync(params: {
    userId: string; // System or user who triggered sync
    organizationId: string;
    syncType: 'full' | 'incremental';
    recordsInserted: number;
    recordsUpdated: number;
    recordsSkipped: number;
    errors: number;
    duration: number; // milliseconds
    externalIds?: string[]; // PEMS IDs synced
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      organizationId: params.organizationId,
      action: 'sync:pems_complete',
      resourceId: params.organizationId,
      resourceType: 'Organization',
      changes: {
        after: {
          syncType: params.syncType,
          recordsInserted: params.recordsInserted,
          recordsUpdated: params.recordsUpdated,
          recordsSkipped: params.recordsSkipped,
          errors: params.errors,
        },
      },
      metadata: {
        duration: params.duration,
        externalIds: params.externalIds,
      },
      externalSystem: 'PEMS',
    });
  }

  /**
   * Log user action with before/after state
   */
  static async logUserAction(params: {
    userId: string;
    organizationId: string;
    action: string; // "pfa:update", "pfa:bulk_update", "pfa:delete"
    resourceId: string;
    before?: any;
    after?: any;
    reason?: string;
    req?: any;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      organizationId: params.organizationId,
      action: params.action,
      resourceId: params.resourceId,
      resourceType: 'PfaRecord',
      changes: {
        before: params.before,
        after: params.after,
      },
      reason: params.reason,
      req: params.req,
    });
  }
}
```

#### 3. Controller Integration Examples

**File**: `backend/src/controllers/userController.ts` (UPDATE EXISTING)

```typescript
import { AuditService } from '../services/audit/AuditService';

// UPDATE grantPermission endpoint
export const grantPermission = async (req: Request, res: Response) => {
  const { userId, organizationId, role, capabilities } = req.body;

  // Fetch current state (BEFORE)
  const before = await prisma.userOrganization.findUnique({
    where: {
      userId_organizationId: { userId, organizationId },
    },
  });

  // Update permissions
  const after = await prisma.userOrganization.upsert({
    where: { userId_organizationId: { userId, organizationId } },
    update: { role, capabilities },
    create: { userId, organizationId, role, capabilities },
  });

  // 🚨 AI DATA HOOK: Log permission change
  await AuditService.logPermissionChange({
    userId: req.user!.id, // Admin who made the change
    targetUserId: userId,
    organizationId,
    before,
    after,
    reason: req.body.reason, // Optional: "Promoted to admin for Q4 project"
    req,
  });

  return res.json({ success: true, userOrganization: after });
};
```

**File**: `backend/src/controllers/pfaDataController.ts` (UPDATE EXISTING)

```typescript
import { AuditService } from '../services/audit/AuditService';

// UPDATE updatePfaRecord endpoint
export const updatePfaRecord = async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  // Fetch current state (BEFORE)
  const before = await prisma.pfaRecord.findUnique({ where: { id } });

  if (!before) {
    return res.status(404).json({ error: 'Record not found' });
  }

  // Apply updates
  const after = await prisma.pfaRecord.update({
    where: { id },
    data: updates,
  });

  // 🚨 AI DATA HOOK: Log user action
  await AuditService.logUserAction({
    userId: req.user!.id,
    organizationId: before.organizationId,
    action: 'pfa:update',
    resourceId: id,
    before,
    after,
    reason: req.body.reason, // Optional: "Extended due to weather delay"
    req,
  });

  return res.json(after);
};

// UPDATE bulkUpdatePfaRecords endpoint
export const bulkUpdatePfaRecords = async (req: Request, res: Response) => {
  const { ids, updates, reason } = req.body;

  // Fetch all records (BEFORE)
  const beforeRecords = await prisma.pfaRecord.findMany({
    where: { id: { in: ids } },
  });

  // Apply updates
  await prisma.pfaRecord.updateMany({
    where: { id: { in: ids } },
    data: updates,
  });

  // Fetch updated records (AFTER)
  const afterRecords = await prisma.pfaRecord.findMany({
    where: { id: { in: ids } },
  });

  // 🚨 AI DATA HOOK: Log batch operation
  await AuditService.logBatch({
    userId: req.user!.id,
    organizationId: req.user!.organizationId,
    action: 'pfa:bulk_update',
    resourceType: 'PfaRecord',
    records: ids.map((id, index) => ({
      resourceId: id,
      before: beforeRecords[index],
      after: afterRecords[index],
    })),
    reason,
    req,
  });

  return res.json({ success: true, updated: ids.length });
};
```

**File**: `backend/src/services/pems/PemsSyncService.ts` (UPDATE EXISTING)

```typescript
import { AuditService } from '../services/audit/AuditService';

// UPDATE sync() method
export class PemsSyncService {
  async sync(params: { organizationId: string; syncType: 'full' | 'incremental' }) {
    const startTime = Date.now();
    let recordsInserted = 0;
    let recordsUpdated = 0;
    let recordsSkipped = 0;
    let errors = 0;
    const externalIds: string[] = [];

    // ... existing sync logic ...

    // Track PEMS IDs
    for (const record of syncedRecords) {
      if (record.externalId) {
        externalIds.push(record.externalId);
      }
    }

    const duration = Date.now() - startTime;

    // 🚨 AI DATA HOOK: Log PEMS sync
    await AuditService.logPemsSync({
      userId: 'SYSTEM',
      organizationId: params.organizationId,
      syncType: params.syncType,
      recordsInserted,
      recordsUpdated,
      recordsSkipped,
      errors,
      duration,
      externalIds,
    });

    return { success: true, recordsInserted, recordsUpdated, duration };
  }
}
```

#### 4. External ID Tracking Middleware

**File**: `backend/src/middleware/trackExternalId.ts` (NEW)

```typescript
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to extract and attach external IDs from request
 * Use for PEMS sync endpoints
 */
export function trackExternalId(req: Request, res: Response, next: NextFunction) {
  // Extract PEMS ID from request body or headers
  const externalId =
    req.body.externalId ||
    req.body.pemsId ||
    req.headers['x-external-id'] as string;

  if (externalId) {
    (req as any).externalId = externalId;
    (req as any).externalSystem = 'PEMS';
  }

  next();
}
```

#### 5. Batch ID Tracking Utility

**File**: `backend/src/utils/batchTracking.ts` (NEW)

```typescript
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate batch ID for bulk operations
 */
export function generateBatchId(): string {
  return uuidv4();
}

/**
 * Express middleware to attach batch ID to request
 */
export function attachBatchId(req: any, res: any, next: any) {
  if (req.body.batch || req.body.bulk) {
    req.batchId = generateBatchId();
  }
  next();
}
```

---

### 🚨 AI ENFORCEMENT (MANDATORY)

Your implementation MUST include:

1. **Comprehensive Audit Logging**:
   - ✅ Log ALL permission changes with before/after state
   - ✅ Log ALL PFA record updates with before/after state
   - ✅ Log ALL PEMS sync operations with record counts
   - ✅ Log ALL user logins with IP and user agent

2. **Metadata Capture**:
   - ✅ IP address from `req.ip`
   - ✅ User agent from `req.headers['user-agent']`
   - ✅ Geolocation from `geoip-lite` library
   - ✅ Timestamp (ISO8601 format)

3. **Batch Grouping**:
   - ✅ Generate UUID for batch operations
   - ✅ Track batch size and index for each record
   - ✅ Allow AI to analyze batch patterns

4. **External ID Tracking**:
   - ✅ Track PEMS IDs for all synced records
   - ✅ Link local records to external systems
   - ✅ Enable correlation for sync conflict resolution

5. **Reason Tracking**:
   - ✅ Optional `reason` field on all endpoints
   - ✅ Encourage users to provide context (e.g., "Weather delay")

---

### 🎨 UX ENFORCEMENT (MANDATORY)

1. **Reason Input Fields**:
   - ✅ Add optional "Reason" text input to bulk operation modals
   - ✅ Placeholder: "Why are you making this change? (optional)"
   - ✅ Pre-populate common reasons (e.g., "Weather delay", "Budget adjustment")

2. **Audit Trail Visibility**:
   - ✅ Show "Last modified by X at Y" in PFA record details
   - ✅ Show "Reason: Weather delay" if provided
   - ✅ Link to full audit log for admins

3. **Performance**:
   - ✅ Audit logging is non-blocking (async)
   - ✅ No user-facing latency added (<50ms overhead)

---

### YOUR MISSION

1. **Update Prisma Schema**:
   - Add new fields to `AuditLog` model (batchId, batchSize, batchIndex, externalId, externalSystem, reason)
   - Run migration: `npx prisma migrate dev --name add_ai_data_hooks_to_audit_log`

2. **Implement AuditService**:
   - `log()` - General audit logging with metadata enrichment
   - `logBatch()` - Batch operation logging
   - `logPermissionChange()` - Permission-specific logging
   - `logPemsSync()` - PEMS sync-specific logging
   - `logUserAction()` - PFA record action logging

3. **Update Controllers**:
   - `userController.ts` - Add audit logging to `grantPermission`, `revokePermission`, `suspendUser`
   - `pfaDataController.ts` - Add audit logging to `updatePfaRecord`, `bulkUpdatePfaRecords`, `deletePfaRecord`
   - `pemsSyncController.ts` - Add audit logging to sync operations

4. **Create Middleware**:
   - `trackExternalId.ts` - Extract external IDs from requests
   - `attachBatchId.ts` - Generate batch IDs for bulk operations

5. **Update Frontend**:
   - Add "Reason" input fields to bulk operation modals
   - Display "Last modified by" and "Reason" in PFA record details

6. **Test Coverage**:
   - Test audit logging for all major actions
   - Verify before/after state capture
   - Verify batch ID grouping
   - Verify external ID tracking

---

### DELIVERABLES

1. **Backend Services**:
   - `backend/src/services/audit/AuditService.ts` (300+ lines)
   - `backend/src/middleware/trackExternalId.ts` (new)
   - `backend/src/utils/batchTracking.ts` (new)

2. **Database Migration**:
   - `backend/prisma/migrations/YYYYMMDDHHMMSS_add_ai_data_hooks_to_audit_log/migration.sql`

3. **Controller Updates**:
   - Update `backend/src/controllers/userController.ts` (add audit logging)
   - Update `backend/src/controllers/pfaDataController.ts` (add audit logging)
   - Update `backend/src/services/pems/PemsSyncService.ts` (add audit logging)

4. **Frontend Updates**:
   - Update bulk operation modals to include "Reason" input field
   - Update PFA record details to show "Last modified by" and "Reason"

5. **Tests**:
   - `backend/tests/integration/auditLogging.test.ts`
   - Test cases: permission change, PFA update, batch operation, PEMS sync

6. **Documentation**:
   - Update `docs/backend/DATABASE_SCHEMA.md` with AuditLog field descriptions
   - Add audit logging guide to `docs/backend/API_REFERENCE.md`

---

### CONSTRAINTS

**❌ DO NOT**:
- Make audit logging synchronous (must be async to avoid latency)
- Expose sensitive data in audit logs (mask passwords, tokens)
- Log every single database query (only business actions)
- Create new tables (use existing `AuditLog` model)

**✅ DO**:
- Log ALL permission changes with before/after state
- Log ALL bulk operations with batch ID grouping
- Capture IP, user agent, geolocation for security analysis
- Track external IDs for PEMS sync correlation
- Provide optional "reason" field on all endpoints

---

### VERIFICATION QUESTIONS

Before marking this task complete, verify:

1. ✅ Are ALL permission changes logged with before/after state?
2. ✅ Are ALL bulk operations grouped with a batch ID?
3. ✅ Is IP address, user agent, and geolocation captured for every action?
4. ✅ Are PEMS IDs tracked for all synced records?
5. ✅ Is the "Reason" field displayed in bulk operation modals?
6. ✅ Is audit logging non-blocking (<50ms overhead)?
7. ✅ Are at least 95% of actions successfully logged?

---

**Status**: 📋 Pending
**Dependencies**: Phase 2 (Middleware), Phase 5 (CRUD Endpoints)
**Estimated Time**: 6-8 hours

---

## Summary

**Phase 6 Remaining Tasks - Total Estimated Time**: 18-24 hours

**Task 6.3 (AI Financial Access Monitoring)**: 6-8 hours
- FinancialAccessMonitorService with baseline learning
- Real-time anomaly detection
- SecurityAnomalies dashboard
- Auto-suspension for CRITICAL alerts

**Task 6.4 (AI Natural Language Permission Queries)**: 6-8 hours
- NLQueryParserService with semantic search
- Support for 4 query intents (user_list, permission_audit, temporal_query, capability_analysis)
- PermissionQueryPanel with example queries
- AI-generated insights

**Task 6.5 (AI Data Hooks Implementation)**: 6-8 hours
- Enhanced AuditLog schema with batch grouping and external ID tracking
- AuditService with 5 logging methods
- Controller updates for permission, PFA, and PEMS sync logging
- Frontend "Reason" input fields

**All 3 tasks are fully specified, copy-paste ready, and follow the exact pattern from Task 5.1.**

**Status**: ✅ COMPLETE - Ready for agent execution
**Format**: Self-contained prompt bundles with 200+ lines of code per task
**AI Enforcement**: Google Gemini integration mandatory for all 3 tasks
**UX Enforcement**: Performance budgets, accessibility, and visual polish specified
