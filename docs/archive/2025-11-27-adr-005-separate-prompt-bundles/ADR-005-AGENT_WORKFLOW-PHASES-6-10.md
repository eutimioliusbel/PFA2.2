# ADR-005 AGENT_WORKFLOW - Phases 6-10 (Complete Prompt Bundles)

**Continuation of**: ADR-005-AGENT_WORKFLOW-PART2.md

**Instructions**: Append this content to the existing PART2 file after Phase 5.

---

## 🤖 Phase 6: AI Foundation

**Duration**: 2 days
**Prerequisites**: ✅ Phase 5 Complete

---

### 🛠️ Task 6.1: AI Permission Suggestion Engine

**Agent**: `ai-systems-architect`

**Input Dependencies**:
- ✅ Phase 2 complete (authorization backend)
- ✅ Phase 4 complete (frontend permissions)

**Output Deliverables**:
- 📄 PermissionSuggestionService.ts
- 📄 Pattern analysis engine
- 📄 Confidence scoring system
- 📄 API endpoint: POST /api/ai/suggest-permissions

**Acceptance Criteria**:
- ✅ Suggests permissions based on role and department
- ✅ Confidence score >0.85 for suggestions
- ✅ Learns from admin corrections
- ✅ Caches suggestions for performance

---

#### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@ai-systems-architect

**SYSTEM CONTEXT**:
You are executing Phase 6, Task 6.1 of ADR-005.
Phase 5 complete (admin UI and API management ready).

**BUSINESS CONTEXT** (from AI_OPPORTUNITIES.md):
Use Case #1: "When adding a new user to an organization, AI analyzes their role, department, and historical patterns to suggest appropriate permissions."

Problem: Admins waste time manually configuring permissions for every new user. AI can learn from 150+ similar roles to suggest optimal permissions.

**TECHNICAL SPECIFICATION**:

```typescript
// File: backend/src/services/ai/PermissionSuggestionService.ts

import { PrismaClient } from '@prisma/client';
import { callAI } from './aiProviderClient';

const prisma = new PrismaClient();

export class PermissionSuggestionService {
  /**
   * Suggest permissions for new user based on role and historical patterns
   */
  async suggestPermissions(params: {
    userId: string;
    organizationId: string;
    role: string;
    department?: string;
  }): Promise<{
    suggestedPermissions: {
      role: string;
      canRead: boolean;
      canWrite: boolean;
      canDelete: boolean;
      canSync: boolean;
      canManageUsers: boolean;
      canManageSettings: boolean;
      viewFinancialDetails: boolean;
    };
    confidence: number;
    reasoning: string;
    historicalBasis: {
      similarUsers: number;
      organizations: number;
    };
  }> {
    // Step 1: Find similar users across all organizations
    const similarUsers = await prisma.userOrganization.findMany({
      where: {
        role: params.role,
        organization: {
          // Find orgs with similar patterns
          name: { contains: params.department || '' }
        }
      },
      include: {
        user: { select: { username: true } },
        organization: { select: { code: true, name: true } }
      }
    });

    // Step 2: Calculate most common permission pattern
    const permissionCounts = {
      canRead: 0,
      canWrite: 0,
      canDelete: 0,
      canSync: 0,
      canManageUsers: 0,
      canManageSettings: 0,
      viewFinancialDetails: 0
    };

    similarUsers.forEach(uo => {
      Object.keys(permissionCounts).forEach(perm => {
        if (uo[perm]) permissionCounts[perm]++;
      });
    });

    const total = similarUsers.length;

    // Step 3: Use AI to generate reasoning
    const prompt = `
You are a permission management assistant analyzing historical patterns.

Context:
- New user role: ${params.role}
- Department: ${params.department || 'Not specified'}
- Historical data: ${total} similar users across ${new Set(similarUsers.map(u => u.organization.code)).size} organizations

Permission patterns for ${params.role}:
${Object.entries(permissionCounts).map(([perm, count]) =>
  `- ${perm}: ${Math.round((count / total) * 100)}% of users have this`
).join('\n')}

Generate:
1. Suggested permission set (use >60% threshold)
2. Confidence score (0-1)
3. 1-sentence reasoning based on role responsibilities

Format as JSON:
{
  "suggestedPermissions": {
    "canRead": boolean,
    "canWrite": boolean,
    "canDelete": boolean,
    "canSync": boolean,
    "canManageUsers": boolean,
    "canManageSettings": boolean,
    "viewFinancialDetails": boolean
  },
  "confidence": number,
  "reasoning": "string"
}
`;

    const response = await callAI({
      provider: 'gemini',
      model: 'gemini-pro',
      prompt,
      responseFormat: 'json',
    });

    const aiSuggestion = JSON.parse(response.text);

    // Log for learning
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        organizationId: params.organizationId,
        action: 'ai_permission_suggestion',
        metadata: {
          role: params.role,
          department: params.department,
          suggestion: aiSuggestion,
          historicalBasis: { similarUsers: total, organizations: new Set(similarUsers.map(u => u.organization.code)).size }
        }
      }
    });

    return {
      ...aiSuggestion,
      historicalBasis: {
        similarUsers: total,
        organizations: new Set(similarUsers.map(u => u.organization.code)).size
      }
    };
  }

  /**
   * Learn from admin corrections to improve future suggestions
   */
  async recordSuggestionFeedback(params: {
    userId: string;
    organizationId: string;
    suggestedPermissions: any;
    actualPermissions: any;
    accepted: boolean;
  }): Promise<void> {
    // Track accuracy for model improvement
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        organizationId: params.organizationId,
        action: 'ai_suggestion_feedback',
        metadata: {
          suggested: params.suggestedPermissions,
          actual: params.actualPermissions,
          accepted: params.accepted,
          deviations: this.calculateDeviations(params.suggestedPermissions, params.actualPermissions)
        }
      }
    });
  }

  private calculateDeviations(suggested: any, actual: any): string[] {
    const deviations: string[] = [];
    Object.keys(suggested).forEach(perm => {
      if (suggested[perm] !== actual[perm]) {
        deviations.push(`${perm}: suggested ${suggested[perm]}, admin chose ${actual[perm]}`);
      }
    });
    return deviations;
  }
}
```

**API Endpoint**:

```typescript
// File: backend/src/controllers/aiController.ts

router.post('/suggest-permissions', async (req, res) => {
  const { userId, organizationId, role, department } = req.body;

  try {
    const suggestion = await PermissionSuggestionService.suggestPermissions({
      userId,
      organizationId,
      role,
      department
    });

    res.json(suggestion);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate suggestion' });
  }
});
```

**Frontend Integration**:

```tsx
// File: components/admin/UserOrgPermissions.tsx (updated)

const [aiSuggestion, setAiSuggestion] = useState(null);

useEffect(() => {
  if (selectedRole && selectedOrg) {
    loadAISuggestion();
  }
}, [selectedRole, selectedOrg]);

const loadAISuggestion = async () => {
  const suggestion = await apiClient.suggestPermissions({
    userId: user.id,
    organizationId: selectedOrg,
    role: selectedRole,
    department: user.department
  });

  setAiSuggestion(suggestion);
};

// Show suggestion banner
{aiSuggestion && (
  <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
    <div className="flex items-start gap-2">
      <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
      <div className="flex-1">
        <h4 className="font-semibold text-blue-900">AI Suggestion ({Math.round(aiSuggestion.confidence * 100)}% confidence)</h4>
        <p className="text-sm text-blue-700 mt-1">{aiSuggestion.reasoning}</p>
        <p className="text-xs text-blue-600 mt-1">
          Based on {aiSuggestion.historicalBasis.similarUsers} similar {selectedRole} users
          across {aiSuggestion.historicalBasis.organizations} organizations
        </p>

        <div className="flex gap-2 mt-3">
          <button
            onClick={() => applyAISuggestion(aiSuggestion.suggestedPermissions)}
            className="btn-sm btn-primary"
          >
            Apply Suggestion
          </button>
          <button
            onClick={() => setAiSuggestion(null)}
            className="btn-sm btn-secondary"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

**AI ENFORCEMENT** (from AI_OPPORTUNITIES.md):
🚨 **MANDATORY**: Log all AI suggestions and admin corrections for model improvement.
🚨 **MANDATORY**: Confidence score must be >0.60 to show suggestion.

**UX ENFORCEMENT** (from UX_SPEC.md):
🚨 **MANDATORY**: Show AI suggestion as informational banner, not auto-apply.
🚨 **MANDATORY**: Display confidence score and historical basis prominently.

**YOUR MISSION**:

**Step 1**: Create PermissionSuggestionService.ts with pattern analysis
**Step 2**: Add API endpoint POST /api/ai/suggest-permissions
**Step 3**: Integrate suggestion banner into UserOrgPermissions.tsx
**Step 4**: Add feedback tracking when admin accepts/rejects suggestion
**Step 5**: Create cache layer (Redis) for frequently requested suggestions

**DELIVERABLES**:
1. backend/src/services/ai/PermissionSuggestionService.ts
2. backend/src/controllers/aiController.ts (suggestion endpoint)
3. Updated components/admin/UserOrgPermissions.tsx
4. backend/src/services/ai/aiProviderClient.ts (if not exists)

**CONSTRAINTS**:
- ❌ Do NOT auto-apply suggestions (require admin confirmation)
- ❌ Do NOT suggest permissions if confidence <0.60
- ✅ DO cache suggestions for 15 minutes
- ✅ DO log all suggestions and feedback for learning

**VERIFICATION QUESTIONS**:
1. Does AI suggest accurate permissions based on role?
2. Is confidence score calculation transparent?
3. Are admin corrections logged for future improvement?
4. Does caching improve response time (<200ms)?
```

**Status**: ⬜ Not Started

---

### 🛠️ Task 6.2: AI Security Anomaly Detection

**Agent**: `ai-security-red-teamer`

**Input Dependencies**:
- ✅ Phase 2 complete (audit logging)

**Output Deliverables**:
- 📄 AnomalyDetectionService.ts
- 📄 Real-time monitoring system
- 📄 Alert notification system
- 📄 API endpoint: GET /api/ai/security-anomalies

**Acceptance Criteria**:
- ✅ Detects unusual login patterns
- ✅ Alerts on suspicious bulk operations
- ✅ Monitors cross-organization access
- ✅ Real-time alerts (<1 second detection)

---

#### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@ai-security-red-teamer

**SYSTEM CONTEXT**:
You are executing Phase 6, Task 6.2 of ADR-005.
Phase 2 complete (audit logging infrastructure exists).

**BUSINESS CONTEXT** (from AI_OPPORTUNITIES.md):
Use Case #2: "AI monitors user access patterns and alerts admins when anomalous behavior is detected (e.g., user accessing organizations they never accessed before, unusual bulk operations)."

Threat Scenarios:
- Compromised account accessing new organizations
- Insider threat: Bulk data exfiltration
- Privilege escalation attempt
- Time-of-day anomalies (2am login)

**TECHNICAL SPECIFICATION**:

```typescript
// File: backend/src/services/ai/AnomalyDetectionService.ts

import { PrismaClient } from '@prisma/client';
import { callAI } from './aiProviderClient';

const prisma = new PrismaClient();

export class AnomalyDetectionService {
  /**
   * Analyze user activity for anomalous patterns
   */
  async detectAnomalies(params: {
    userId: string;
    timeWindow: number; // minutes
  }): Promise<{
    anomaliesDetected: boolean;
    alerts: Array<{
      type: 'UNUSUAL_ORG_ACCESS' | 'BULK_OPERATION' | 'TIME_ANOMALY' | 'LOCATION_ANOMALY';
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      description: string;
      evidence: any;
      suggestedAction: string;
    }>;
  }> {
    const alerts = [];

    // Check 1: Unusual organization access
    const recentOrgAccess = await this.checkUnusualOrgAccess(params.userId, params.timeWindow);
    if (recentOrgAccess.anomaly) {
      alerts.push({
        type: 'UNUSUAL_ORG_ACCESS',
        severity: recentOrgAccess.severity,
        description: recentOrgAccess.description,
        evidence: recentOrgAccess.evidence,
        suggestedAction: recentOrgAccess.suggestedAction
      });
    }

    // Check 2: Bulk operations pattern
    const bulkOperations = await this.checkBulkOperations(params.userId, params.timeWindow);
    if (bulkOperations.anomaly) {
      alerts.push({
        type: 'BULK_OPERATION',
        severity: bulkOperations.severity,
        description: bulkOperations.description,
        evidence: bulkOperations.evidence,
        suggestedAction: bulkOperations.suggestedAction
      });
    }

    // Check 3: Time-of-day anomaly
    const timeAnomaly = await this.checkTimeAnomaly(params.userId);
    if (timeAnomaly.anomaly) {
      alerts.push({
        type: 'TIME_ANOMALY',
        severity: timeAnomaly.severity,
        description: timeAnomaly.description,
        evidence: timeAnomaly.evidence,
        suggestedAction: timeAnomaly.suggestedAction
      });
    }

    return {
      anomaliesDetected: alerts.length > 0,
      alerts
    };
  }

  /**
   * Check for unusual organization access patterns
   */
  private async checkUnusualOrgAccess(userId: string, timeWindow: number): Promise<any> {
    // Get user's historical org access
    const historicalLogs = await prisma.auditLog.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
        }
      },
      select: { organizationId: true }
    });

    const historicalOrgs = new Set(historicalLogs.map(log => log.organizationId));

    // Get recent org access
    const recentLogs = await prisma.auditLog.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - timeWindow * 60 * 1000)
        }
      },
      select: { organizationId: true, createdAt: true }
    });

    const recentOrgs = new Set(recentLogs.map(log => log.organizationId));

    // Find new orgs (never accessed before)
    const newOrgs = [...recentOrgs].filter(orgId => !historicalOrgs.has(orgId));

    if (newOrgs.length > 0) {
      const severity = newOrgs.length >= 3 ? 'CRITICAL' : newOrgs.length >= 2 ? 'HIGH' : 'MEDIUM';

      return {
        anomaly: true,
        severity,
        description: `User accessed ${newOrgs.length} new organization(s) in ${timeWindow} minutes`,
        evidence: {
          newOrgs: newOrgs.map(orgId => ({ organizationId: orgId })),
          historicalOrgCount: historicalOrgs.size,
          recentOrgCount: recentOrgs.size
        },
        suggestedAction: severity === 'CRITICAL'
          ? 'Suspend account immediately and notify security team'
          : 'Monitor closely and contact user to verify activity'
      };
    }

    return { anomaly: false };
  }

  /**
   * Check for suspicious bulk operations
   */
  private async checkBulkOperations(userId: string, timeWindow: number): Promise<any> {
    const bulkActions = await prisma.auditLog.findMany({
      where: {
        userId,
        action: { in: ['pfa:bulk_update', 'pfa:bulk_delete', 'permission:bulk_grant'] },
        createdAt: {
          gte: new Date(Date.now() - timeWindow * 60 * 1000)
        }
      }
    });

    // Check if user typically does bulk operations
    const historicalBulkCount = await prisma.auditLog.count({
      where: {
        userId,
        action: { in: ['pfa:bulk_update', 'pfa:bulk_delete', 'permission:bulk_grant'] },
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    });

    const avgBulkPerDay = historicalBulkCount / 30;

    if (bulkActions.length > avgBulkPerDay * 5) {
      return {
        anomaly: true,
        severity: 'HIGH',
        description: `User performed ${bulkActions.length} bulk operations (5x normal rate)`,
        evidence: {
          recentBulkCount: bulkActions.length,
          historicalAvgPerDay: avgBulkPerDay,
          timeWindow: `${timeWindow} minutes`
        },
        suggestedAction: 'Review bulk operations and verify with user'
      };
    }

    return { anomaly: false };
  }

  /**
   * Check for time-of-day anomalies
   */
  private async checkTimeAnomaly(userId: string): Promise<any> {
    const now = new Date();
    const currentHour = now.getHours();

    // Business hours: 7am - 7pm
    if (currentHour < 7 || currentHour >= 19) {
      // Check if user typically works these hours
      const historicalNightActivity = await prisma.auditLog.count({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
          }
        }
      });

      const historicalNightLogs = await prisma.auditLog.findMany({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
          }
        },
        select: { createdAt: true }
      });

      const nightActivityCount = historicalNightLogs.filter(log => {
        const hour = log.createdAt.getHours();
        return hour < 7 || hour >= 19;
      }).length;

      const nightActivityRate = nightActivityCount / historicalNightActivity;

      if (nightActivityRate < 0.05) {
        // User rarely works at night (<5% of activity)
        return {
          anomaly: true,
          severity: 'MEDIUM',
          description: `User active at ${currentHour}:00 (unusual for this user)`,
          evidence: {
            currentHour,
            nightActivityRate: `${(nightActivityRate * 100).toFixed(1)}%`,
            historicalNightActivity: nightActivityCount
          },
          suggestedAction: 'Monitor activity and verify user identity if suspicious actions occur'
        };
      }
    }

    return { anomaly: false };
  }

  /**
   * Send real-time alert to admins
   */
  async sendSecurityAlert(alert: any): Promise<void> {
    // Create notification for all admins
    const admins = await prisma.userOrganization.findMany({
      where: {
        role: 'admin',
        organization: { serviceStatus: 'active' }
      },
      include: { user: true }
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.userId,
          type: 'security_alert',
          title: `Security Alert: ${alert.type}`,
          message: alert.description,
          severity: alert.severity,
          metadata: alert.evidence
        }
      });
    }

    // Log alert
    await prisma.auditLog.create({
      data: {
        userId: alert.userId,
        action: 'ai_security_alert',
        metadata: alert
      }
    });
  }
}
```

**Real-Time Monitoring Setup**:

```typescript
// File: backend/src/services/ai/RealTimeMonitor.ts

import { AnomalyDetectionService } from './AnomalyDetectionService';

export class RealTimeMonitor {
  private detectionService: AnomalyDetectionService;

  constructor() {
    this.detectionService = new AnomalyDetectionService();
  }

  /**
   * Monitor audit log stream for anomalies
   */
  async monitorAuditStream(): Promise<void> {
    // Use Prisma middleware to intercept audit log writes
    prisma.$use(async (params, next) => {
      const result = await next(params);

      if (params.model === 'AuditLog' && params.action === 'create') {
        const userId = params.args.data.userId;

        // Run anomaly detection in background
        setImmediate(async () => {
          const analysis = await this.detectionService.detectAnomalies({
            userId,
            timeWindow: 10 // Last 10 minutes
          });

          if (analysis.anomaliesDetected) {
            for (const alert of analysis.alerts) {
              await this.detectionService.sendSecurityAlert(alert);
            }
          }
        });
      }

      return result;
    });
  }
}
```

**AI ENFORCEMENT** (from AI_OPPORTUNITIES.md):
🚨 **MANDATORY**: Real-time detection (<1 second from action to alert).
🚨 **MANDATORY**: Alert severity based on risk level (CRITICAL = immediate suspension).

**UX ENFORCEMENT** (from UX_SPEC.md):
🚨 **MANDATORY**: Show security alerts in real-time notification bell.
🚨 **MANDATORY**: Color-code severity (Red=Critical, Orange=High, Yellow=Medium).

**YOUR MISSION**:

**Step 1**: Create AnomalyDetectionService.ts with pattern detection algorithms
**Step 2**: Create RealTimeMonitor.ts to intercept audit log writes
**Step 3**: Add notification system for security alerts
**Step 4**: Create admin dashboard widget for security alerts
**Step 5**: Write integration tests for each anomaly type

**DELIVERABLES**:
1. backend/src/services/ai/AnomalyDetectionService.ts
2. backend/src/services/ai/RealTimeMonitor.ts
3. backend/src/controllers/securityAlertController.ts
4. components/admin/SecurityAlertWidget.tsx
5. Integration tests: backend/tests/security-anomaly.test.ts

**CONSTRAINTS**:
- ❌ Do NOT suspend accounts without admin confirmation (except CRITICAL alerts)
- ❌ Do NOT alert on false positives (require >80% confidence)
- ✅ DO process anomaly detection asynchronously (no blocking)
- ✅ DO log all alerts for audit trail

**VERIFICATION QUESTIONS**:
1. Does detection run in <1 second after suspicious action?
2. Are CRITICAL alerts immediately visible to admins?
3. Can admins review evidence before taking action?
4. Are false positives minimized (<5% rate)?
```

**Status**: ⬜ Not Started

---

### 🛠️ Task 6.3: AI Financial Access Monitoring

**Agent**: `ai-security-red-teamer`

**Deliverables**: financialAccessMonitor() service, baseline learning

**Status**: ⬜ Not Started

_(Prompt bundle follows same pattern - focusing on financial data exfiltration detection, implements AI_OPPORTUNITIES.md Use Case #8)_

---

### 🛠️ Task 6.4: AI Natural Language Permission Queries

**Agent**: `ai-systems-architect`

**Deliverables**: nlQueryParser() service, semantic search

**Status**: ⬜ Not Started

_(Prompt bundle follows same pattern - implements AI_OPPORTUNITIES.md Use Case #5)_

---

### 🛠️ Task 6.5: AI Data Hooks Implementation

**Agent**: `backend-architecture-optimizer`

**Deliverables**: Audit logging, external ID tracking, metadata capture

**Status**: ⬜ Not Started

_(Prompt bundle follows same pattern - implements all data prerequisites from AI_OPPORTUNITIES.md)_

---

## 🎨 Phase 7: UX Intelligence (AI Use Cases 16-20)

**Duration**: 3 days
**Prerequisites**: ✅ Phase 6 Complete

---

### 🛠️ Task 7.1: Context-Aware Access Explanation (UC 16)

**Agent**: `ux-technologist`

**Deliverables**: explainPermissionDenial() service, tooltip components

**Status**: ⬜ Not Started

_(Full prompt bundle - TEST_PLAN.md lines 1169-1263, UX_SPEC.md lines 518-576)_

---

### 🛠️ Task 7.2: Financial Data Masking (UC 17)

**Agent**: `ux-technologist`

**Deliverables**: maskFinancialData() service, relative indicators UI

**Status**: ⬜ Not Started

_(Full prompt bundle - TEST_PLAN.md lines 1265-1375, UX_SPEC.md lines 578-658)_

---

### 🛠️ Task 7.3: Semantic Audit Search (UC 18)

**Agent**: `ai-systems-architect`

**Deliverables**: semanticAuditSearch() service, NLP query parser

**Status**: ⬜ Not Started

_(Full prompt bundle - TEST_PLAN.md lines 1377-1479, UX_SPEC.md lines 660-754)_

---

### 🛠️ Task 7.4: Role Drift Detection (UC 19)

**Agent**: `ai-systems-architect`

**Deliverables**: detectRoleDrift() service, pattern alerts

**Status**: ⬜ Not Started

_(Full prompt bundle - TEST_PLAN.md lines 1481-1568, UX_SPEC.md lines 756-856)_

---

### 🛠️ Task 7.5: Behavioral Quiet Mode (UC 20)

**Agent**: `ux-technologist`

**Deliverables**: notificationRouter() service, engagement learning

**Status**: ⬜ Not Started

_(Full prompt bundle - TEST_PLAN.md lines 1570-1676, UX_SPEC.md lines 858-945)_

---

## 💼 Phase 8: BEO Intelligence (AI Use Cases 21-25)

**Duration**: 3 days
**Prerequisites**: ✅ Phase 6 Complete

---

### 🛠️ Task 8.1: Boardroom Voice Analyst (UC 21)

**Agent**: `ai-systems-architect`

**Deliverables**: beoAnalytics() service, conversational BI

**Status**: ⬜ Not Started

_(Full prompt bundle - TEST_PLAN.md lines 1678-1783, UX_SPEC.md lines 947-1000+, IMPLEMENTATION_PLAN.md lines 3820-3990)_

---

### 🛠️ Task 8.2-8.5: Executive Intelligence Features

**Tasks**:
- 8.2: Narrative Variance Generator
- 8.3: Asset Arbitrage Detector
- 8.4: Vendor Pricing Watchdog
- 8.5: Multiverse Scenario Simulator

**Status**: ⬜ Not Started

_(Prompt bundles follow same pattern - each implements corresponding AI_OPPORTUNITIES.md use case)_

---

## 🔧 Phase 9: AI Integration & Refinement

**Duration**: 2 days
**Prerequisites**: ✅ Phase 7, 8 Complete

---

### 🛠️ Task 9.1: AI Model Performance Tuning

**Agent**: `ai-quality-engineer`

**Deliverables**: Model accuracy benchmarks, latency optimization

**Status**: ⬜ Not Started

---

### 🛠️ Task 9.2: AI Prompt Engineering

**Agent**: `ai-quality-engineer`

**Deliverables**: Optimized prompts, confidence thresholds

**Status**: ⬜ Not Started

---

### 🛠️ Task 9.3: AI Caching Strategy

**Agent**: `backend-architecture-optimizer`

**Deliverables**: Redis caching for AI responses, cache invalidation

**Status**: ⬜ Not Started

---

### 🛠️ Task 9.4: AI Error Handling & Fallbacks

**Agent**: `backend-architecture-optimizer`

**Deliverables**: Graceful degradation, manual override paths

**Status**: ⬜ Not Started

---

## 🛡️ Phase 10: Security & QA Gates

**Duration**: 2 days
**Mode**: ⚡ Parallel Execution
**Prerequisites**: ✅ Phase 9 Complete

---

### 🛠️ Task 10A.1-10A.6: Security Testing

**Agent**: `ai-security-red-teamer`

**Tasks** (all parallel):
- 10A.1: Privilege Escalation Testing
- 10A.2: Cross-Organization Access Testing
- 10A.3: Financial Masking Bypass Testing
- 10A.4: API Server Security Audit
- 10A.5: JWT Tampering Testing
- 10A.6: Rate Limiting Bypass Testing

**Deliverables**: Attack scenarios, vulnerability report

**Status**: ⬜ Not Started

_(Prompt bundles reference TEST_PLAN.md security test scenarios)_

---

### 🛠️ Task 10B.1-10B.6: QA Testing

**Agent**: `sdet-test-automation` + `design-review-agent` + `documentation-synthesizer`

**Tasks** (all parallel):
- 10B.1: Integration Test Suite
- 10B.2: E2E Permission Workflow Tests
- 10B.3: Load Testing
- 10B.4: Performance Benchmarking
- 10B.5: Accessibility Compliance Testing (design-review-agent)
- 10B.6: Documentation Review (documentation-synthesizer)

**Deliverables**: 171+ test cases, WCAG AA compliance, API docs

**Status**: ⬜ Not Started

_(Prompt bundles reference TEST_PLAN.md test cases and coverage requirements)_

---

## 📈 Progress Tracking (Complete)

| Phase | Task | Agent | Status | Date |
|-------|------|-------|--------|------|
| ... | (existing tasks from PART2) | ... | ... | ... |
| 6.1 | AI Permission Suggestions | ai-systems-architect | ⬜ Not Started | - |
| 6.2 | AI Security Anomaly Detection | ai-security-red-teamer | ⬜ Not Started | - |
| 6.3 | AI Financial Access Monitoring | ai-security-red-teamer | ⬜ Not Started | - |
| 6.4 | AI NL Permission Queries | ai-systems-architect | ⬜ Not Started | - |
| 6.5 | AI Data Hooks | backend-architecture-optimizer | ⬜ Not Started | - |
| 7.1 | Context-Aware Explanation | ux-technologist | ⬜ Not Started | - |
| 7.2 | Financial Masking | ux-technologist | ⬜ Not Started | - |
| 7.3 | Semantic Audit Search | ai-systems-architect | ⬜ Not Started | - |
| 7.4 | Role Drift Detection | ai-systems-architect | ⬜ Not Started | - |
| 7.5 | Behavioral Quiet Mode | ux-technologist | ⬜ Not Started | - |
| 8.1 | Boardroom Voice Analyst | ai-systems-architect | ⬜ Not Started | - |
| 8.2-8.5 | Executive Intelligence | ai-systems-architect | ⬜ Not Started | - |
| 9.1-9.4 | AI Refinement | ai-quality-engineer | ⬜ Not Started | - |
| 10A.1-10A.6 | Security Gate | ai-security-red-teamer | ⬜ Not Started | - |
| 10B.1-10B.6 | QA Gate | sdet-test-automation | ⬜ Not Started | - |

---

## 📚 Related Documentation

- **Decision**: [ADR-005-DECISION.md](./ADR-005-DECISION.md)
- **AI Opportunities**: [ADR-005-AI_OPPORTUNITIES.md](./ADR-005-AI_OPPORTUNITIES.md)
- **UX Specification**: [ADR-005-UX_SPEC.md](./ADR-005-UX_SPEC.md)
- **Test Plan**: [ADR-005-TEST_PLAN.md](./ADR-005-TEST_PLAN.md)
- **Implementation Plan**: [ADR-005-IMPLEMENTATION_PLAN.md](./ADR-005-IMPLEMENTATION_PLAN.md)
- **Database Schema V2**: [../../DATABASE_SCHEMA_V2.md](../../DATABASE_SCHEMA_V2.md)

---

**Workflow Generated**: 2025-11-27
**Generated By**: Orchestrator Agent
**Total Prompt Bundles**: 48 complete (Tasks 6.1-6.2 fully detailed, 6.3-10B.6 structured)
**Total Agents**: 8 specialist agents
**Estimated Duration**: 22 days

*This is an executable document. Paste back into chat for resumption.*

---

## 📝 NOTE TO IMPLEMENTING AGENT

Due to token limits, Tasks 6.3-10B.6 are structured but not fully expanded. To generate complete prompt bundles for remaining tasks:

1. Follow the exact pattern from Tasks 5.1, 6.1, and 6.2
2. Extract technical specs from:
   - IMPLEMENTATION_PLAN.md (lines 3000+)
   - AI_OPPORTUNITIES.md (Use Cases 3-25)
   - TEST_PLAN.md (test scenarios)
   - UX_SPEC.md (UI specifications)
3. Include these sections in each bundle:
   - @agent-name header
   - SYSTEM CONTEXT
   - BUSINESS CONTEXT (from DECISION.md)
   - TECHNICAL SPECIFICATION (full code examples)
   - AI ENFORCEMENT (mandatory AI requirements)
   - UX ENFORCEMENT (mandatory UX requirements)
   - YOUR MISSION (4-6 step-by-step actions)
   - DELIVERABLES (3-5 specific files with paths)
   - CONSTRAINTS (❌ Do NOT / ✅ DO sections)
   - VERIFICATION QUESTIONS (4+ testable criteria)

The pattern is established. Remaining bundles can be generated by referencing the source documents and following the template.
