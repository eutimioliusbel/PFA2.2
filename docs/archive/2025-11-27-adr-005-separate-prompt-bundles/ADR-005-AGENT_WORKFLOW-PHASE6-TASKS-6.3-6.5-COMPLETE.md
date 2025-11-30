# ADR-005 Agent Workflow - Phase 6 Complete Prompt Bundles (Tasks 6.3-6.5)

**Related**: ADR-005 (Multi-Tenant Access Control)
**Status**: Ready for Execution
**Created**: 2025-11-26

---

## 📋 Overview

This document contains complete, self-contained prompt bundles for the remaining 3 tasks in **Phase 6: AI Foundation (Use Cases 1-5 + Data Hooks)**:

- **Task 6.3**: AI Financial Access Monitoring (ai-security-red-teamer)
- **Task 6.4**: AI Natural Language Permission Queries (ai-systems-architect)
- **Task 6.5**: AI Data Hooks Implementation (backend-architecture-optimizer)

Each bundle is a **copy-paste executable meta-prompt** that contains all context, code, and constraints needed for the assigned agent to execute the task independently.

---

## 🛠️ Task 6.3: AI Financial Access Monitoring

**Agent**: `ai-security-red-teamer`

**Input Dependencies**:
- ✅ Phase 4 complete (audit logging infrastructure)
- ✅ Task 6.2 complete (SecurityAlert table and AnomalyDetectionService exist)

**Output Deliverables**:
- 📄 FinancialAccessMonitor.ts (baseline learning + anomaly detection)
- 📄 API endpoint: GET /api/ai/financial-anomalies
- 📄 Background job: Baseline profiling
- 📄 Integration tests: bypass detection

**Acceptance Criteria**:
- ✅ Learns normal financial access patterns per user
- ✅ Detects unusual financial query attempts
- ✅ Never logs actual cost values (privacy-preserving)
- ✅ Alerts on exfiltration patterns (<1 second detection)

---

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@ai-security-red-teamer

**SYSTEM CONTEXT**:
You are executing Phase 6, Task 6.3 of ADR-005.
Phase 4 complete (audit logging exists).
Task 6.2 complete (SecurityAlert table and AnomalyDetectionService exist).

**BUSINESS CONTEXT** (from AI_OPPORTUNITIES.md):
Use Case #8: "AI Financial Access Monitoring - Track which users typically access financial data and flag unusual financial data access patterns."

**SECURITY THREAT MODEL**:
Attack Scenarios:
1. **Credential Compromise**: Attacker gains access to Field Engineer account without `viewFinancialDetails` permission, attempts to bypass masking via direct API calls
2. **Insider Threat**: User with `viewFinancialDetails` suddenly exports 10,000+ cost records when baseline is 50/day
3. **Exfiltration**: User iterates through all PFA records, extracting financial data via repeated API calls
4. **Privilege Escalation**: User modifies frontend code to bypass permission checks client-side
5. **Role Abuse**: New admin grants themselves `viewFinancialDetails`, then exports entire financial dataset

**Detection Metrics**:
- **Baseline Learning Window**: 30 days of normal activity
- **Anomaly Threshold**: 2.5 standard deviations from baseline
- **Critical Alert Threshold**: 5x baseline access rate
- **Privacy Requirement**: NEVER log actual cost values, only access patterns

**TECHNICAL SPECIFICATION**:

```typescript
// File: backend/src/services/ai/FinancialAccessMonitor.ts

import { prisma } from '../../config/database';
import { SecurityAlertService } from './SecurityAlertService';

interface FinancialAccessProfile {
  userId: string;
  avgDailyFinancialRecords: number;
  maxDailyFinancialRecords: number;
  avgRecordsPerQuery: number;
  typicalHours: number[]; // Hours of day user typically accesses financial data
  daysWithActivity: number; // Number of days with financial access in last 30 days
  lastUpdated: Date;
}

export class FinancialAccessMonitor {
  /**
   * Step 1: Learn baseline financial access patterns for a user
   * Analyzes audit logs from last 30 days
   *
   * Privacy-Preserving: Only logs access patterns, NEVER actual cost values
   */
  static async learnBaselineProfile(userId: string): Promise<FinancialAccessProfile> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Query audit logs for financial data access
    const financialAccessLogs = await prisma.auditLog.findMany({
      where: {
        userId,
        action: { in: ['pfa:read', 'pfa:export', 'pfa:query'] },
        createdAt: { gte: thirtyDaysAgo },
        metadata: {
          path: { contains: 'includeFinancials=true' } // Only count financial queries
        }
      },
      select: {
        createdAt: true,
        metadata: true, // Contains recordCount, NOT actual costs
      },
      orderBy: { createdAt: 'asc' }
    });

    if (financialAccessLogs.length === 0) {
      // User has never accessed financial data
      return {
        userId,
        avgDailyFinancialRecords: 0,
        maxDailyFinancialRecords: 0,
        avgRecordsPerQuery: 0,
        typicalHours: [],
        daysWithActivity: 0,
        lastUpdated: new Date()
      };
    }

    // Group by day and calculate statistics
    const dailyActivity = new Map<string, number>();
    const hourDistribution = new Map<number, number>();
    const recordCounts: number[] = [];

    for (const log of financialAccessLogs) {
      const day = log.createdAt.toISOString().split('T')[0];
      const hour = log.createdAt.getHours();
      const recordCount = log.metadata?.recordCount || 0;

      // Track daily totals
      dailyActivity.set(day, (dailyActivity.get(day) || 0) + recordCount);

      // Track hour-of-day distribution
      hourDistribution.set(hour, (hourDistribution.get(hour) || 0) + 1);

      // Track record counts per query
      if (recordCount > 0) {
        recordCounts.push(recordCount);
      }
    }

    // Calculate statistics
    const dailyTotals = Array.from(dailyActivity.values());
    const avgDailyRecords = dailyTotals.reduce((sum, val) => sum + val, 0) / dailyTotals.length;
    const maxDailyRecords = Math.max(...dailyTotals);
    const avgRecordsPerQuery = recordCounts.reduce((sum, val) => sum + val, 0) / recordCounts.length;

    // Identify typical access hours (hours with >20% of activity)
    const totalHourlyAccess = Array.from(hourDistribution.values()).reduce((sum, val) => sum + val, 0);
    const threshold = totalHourlyAccess * 0.2;
    const typicalHours = Array.from(hourDistribution.entries())
      .filter(([_, count]) => count >= threshold)
      .map(([hour, _]) => hour);

    return {
      userId,
      avgDailyFinancialRecords: Math.round(avgDailyRecords),
      maxDailyFinancialRecords: maxDailyRecords,
      avgRecordsPerQuery: Math.round(avgRecordsPerQuery),
      typicalHours,
      daysWithActivity: dailyActivity.size,
      lastUpdated: new Date()
    };
  }

  /**
   * Step 2: Detect anomalous financial access in real-time
   * Called by middleware on every financial data query
   */
  static async detectAnomalousAccess(
    userId: string,
    organizationId: string,
    requestMetadata: {
      recordCount: number;
      endpoint: string;
      queryParams: string;
      userAgent: string;
      ipAddress: string;
    }
  ): Promise<{
    isAnomalous: boolean;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reason: string;
    shouldAlert: boolean;
  }> {
    // Get user's baseline profile
    const baseline = await this.learnBaselineProfile(userId);

    const anomalies: string[] = [];
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

    // Check 1: User has no baseline (first financial access ever)
    if (baseline.avgDailyFinancialRecords === 0) {
      anomalies.push('First-time financial data access');
      severity = 'MEDIUM';
    }

    // Check 2: Excessively large query (>5x baseline)
    if (baseline.avgRecordsPerQuery > 0 && requestMetadata.recordCount > baseline.avgRecordsPerQuery * 5) {
      anomalies.push(`Querying ${requestMetadata.recordCount} records (baseline: ${baseline.avgRecordsPerQuery})`);
      severity = 'HIGH';
    }

    // Check 3: Query during unusual hours
    const currentHour = new Date().getHours();
    if (baseline.typicalHours.length > 0 && !baseline.typicalHours.includes(currentHour)) {
      anomalies.push(`Access at ${currentHour}:00 (typical: ${baseline.typicalHours.join(', ')}:00)`);
      severity = severity === 'HIGH' ? 'HIGH' : 'MEDIUM';
    }

    // Check 4: Daily access limit exceeded (get today's count)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayFinancialAccess = await prisma.auditLog.count({
      where: {
        userId,
        action: { in: ['pfa:read', 'pfa:export', 'pfa:query'] },
        createdAt: { gte: todayStart },
        metadata: { path: { contains: 'includeFinancials=true' } }
      }
    });

    if (baseline.avgDailyFinancialRecords > 0 && todayFinancialAccess > baseline.avgDailyFinancialRecords * 3) {
      anomalies.push(`${todayFinancialAccess} financial queries today (baseline: ${baseline.avgDailyFinancialRecords}/day)`);
      severity = 'CRITICAL';
    }

    // Check 5: Suspicious query patterns (API bypass attempt)
    if (requestMetadata.queryParams.includes('includeFinancials=true') &&
        requestMetadata.endpoint !== '/api/pfa/records') {
      anomalies.push('Direct API call with financial flag (possible bypass attempt)');
      severity = 'CRITICAL';
    }

    const isAnomalous = anomalies.length > 0;

    // Log anomaly (privacy-preserving: NO actual cost values)
    if (isAnomalous) {
      await prisma.auditLog.create({
        data: {
          userId,
          organizationId,
          action: 'financial_access.anomaly_detected',
          entityType: 'FinancialData',
          metadata: {
            severity,
            anomalies,
            baseline: {
              avgDailyRecords: baseline.avgDailyFinancialRecords,
              avgRecordsPerQuery: baseline.avgRecordsPerQuery
            },
            request: {
              recordCount: requestMetadata.recordCount,
              endpoint: requestMetadata.endpoint,
              hour: currentHour,
              userAgent: requestMetadata.userAgent,
              ipAddress: requestMetadata.ipAddress
            }
          }
        }
      });
    }

    return {
      isAnomalous,
      severity,
      reason: anomalies.join('; '),
      shouldAlert: severity === 'CRITICAL' || severity === 'HIGH'
    };
  }

  /**
   * Step 3: Create security alert if anomaly detected
   * Integrates with SecurityAlertService from Task 6.2
   */
  static async createFinancialAccessAlert(
    userId: string,
    organizationId: string,
    anomalyResult: Awaited<ReturnType<typeof FinancialAccessMonitor.detectAnomalousAccess>>
  ) {
    if (!anomalyResult.shouldAlert) {
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, role: true }
    });

    await SecurityAlertService.createAlert({
      organizationId,
      userId,
      alertType: 'FINANCIAL_DATA_EXFILTRATION',
      severity: anomalyResult.severity,
      description: `Unusual financial data access detected for ${user?.username} (${user?.role})`,
      details: {
        reason: anomalyResult.reason,
        userRole: user?.role,
        detectionTimestamp: new Date().toISOString()
      },
      actionRequired: anomalyResult.severity === 'CRITICAL' ?
        'Suspend user and investigate immediately' :
        'Review user activity and confirm legitimacy',
      autoResolve: false
    });
  }

  /**
   * Step 4: Background job to update all user baselines daily
   * Run via cron job at 2 AM daily
   */
  static async updateAllBaselines() {
    const activeUsers = await prisma.user.findMany({
      where: { serviceStatus: 'active' },
      select: { id: true }
    });

    console.log(`[FinancialAccessMonitor] Updating baselines for ${activeUsers.length} users`);

    for (const user of activeUsers) {
      try {
        const profile = await this.learnBaselineProfile(user.id);

        // Store profile in database (create UserFinancialProfile table)
        await prisma.userFinancialProfile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            ...profile
          },
          update: profile
        });
      } catch (error) {
        console.error(`[FinancialAccessMonitor] Failed to update baseline for user ${user.id}:`, error);
      }
    }
  }

  /**
   * Admin API: Get financial access anomalies
   */
  static async getRecentAnomalies(organizationId: string, limit: number = 50) {
    const anomalyLogs = await prisma.auditLog.findMany({
      where: {
        organizationId,
        action: 'financial_access.anomaly_detected'
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return anomalyLogs.map(log => ({
      id: log.id,
      timestamp: log.createdAt,
      user: log.user,
      severity: log.metadata.severity,
      anomalies: log.metadata.anomalies,
      baseline: log.metadata.baseline,
      request: log.metadata.request
    }));
  }
}
```

**Database Migration** (add UserFinancialProfile table):

```prisma
// File: backend/prisma/schema.prisma (add to existing schema)

model UserFinancialProfile {
  id                       String   @id @default(cuid())
  userId                   String   @unique
  avgDailyFinancialRecords Int
  maxDailyFinancialRecords Int
  avgRecordsPerQuery       Int
  typicalHours             String   // JSON array: [9,10,11,14,15,16]
  daysWithActivity         Int
  lastUpdated              DateTime @updatedAt

  user                     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

**API Controller**:

```typescript
// File: backend/src/controllers/financialMonitorController.ts

import { Request, Response } from 'express';
import { FinancialAccessMonitor } from '../services/ai/FinancialAccessMonitor';

/**
 * GET /api/ai/financial-anomalies
 * Get recent financial access anomalies for organization
 *
 * Authorization: perm_ManageUsers (admin only)
 */
export async function getFinancialAnomalies(req: Request, res: Response) {
  const { organizationId } = req.user;
  const limit = parseInt(req.query.limit as string) || 50;

  const anomalies = await FinancialAccessMonitor.getRecentAnomalies(organizationId, limit);

  res.json({
    anomalies,
    totalCount: anomalies.length
  });
}

/**
 * GET /api/ai/financial-baseline/:userId
 * Get financial access baseline for specific user
 *
 * Authorization: perm_ManageUsers
 */
export async function getUserFinancialBaseline(req: Request, res: Response) {
  const { userId } = req.params;

  const baseline = await FinancialAccessMonitor.learnBaselineProfile(userId);

  res.json(baseline);
}
```

**Middleware Integration** (detect on every financial query):

```typescript
// File: backend/src/middleware/financialAccessMonitoring.ts

import { Request, Response, NextFunction } from 'express';
import { FinancialAccessMonitor } from '../services/ai/FinancialAccessMonitor';

export async function monitorFinancialAccess(req: Request, res: Response, next: NextFunction) {
  const userId = req.user.id;
  const organizationId = req.user.organizationId;

  // Only monitor if query includes financial data
  if (req.query.includeFinancials === 'true' || req.body.includeFinancials === true) {

    // Detect anomaly (non-blocking)
    setImmediate(async () => {
      try {
        const anomaly = await FinancialAccessMonitor.detectAnomalousAccess(
          userId,
          organizationId,
          {
            recordCount: parseInt(req.query.limit as string) || 100,
            endpoint: req.path,
            queryParams: JSON.stringify(req.query),
            userAgent: req.headers['user-agent'] || 'unknown',
            ipAddress: req.ip
          }
        );

        if (anomaly.shouldAlert) {
          await FinancialAccessMonitor.createFinancialAccessAlert(userId, organizationId, anomaly);
        }
      } catch (error) {
        console.error('[FinancialAccessMonitoring] Error detecting anomaly:', error);
      }
    });
  }

  next(); // Don't block request
}
```

**AI ENFORCEMENT**:
🚨 **MANDATORY**: NEVER log actual cost values, only access patterns (recordCount, time, frequency).
🚨 **MANDATORY**: Detect anomalies in <1 second (non-blocking background process).
🚨 **MANDATORY**: Create CRITICAL alerts for exfiltration attempts (5x baseline).

**UX ENFORCEMENT** (from UX_SPEC.md):
🚨 **MANDATORY**: Admin dashboard shows real-time financial anomalies.
🚨 **MANDATORY**: Alerts include actionable recommendations ("Suspend user", "Review activity").
🚨 **MANDATORY**: Baseline profiles visible to admins (transparency).

**YOUR MISSION**:

**Step 1**: Create FinancialAccessMonitor.ts with 4 core methods (baseline learning, anomaly detection, alert creation, background job)
**Step 2**: Add UserFinancialProfile table to Prisma schema
**Step 3**: Create API endpoints (GET /financial-anomalies, GET /financial-baseline/:userId)
**Step 4**: Integrate monitoring middleware into PFA read routes
**Step 5**: Write integration tests for bypass detection

**DELIVERABLES**:
1. backend/src/services/ai/FinancialAccessMonitor.ts (300+ lines)
2. backend/prisma/schema.prisma (UserFinancialProfile model)
3. backend/src/controllers/financialMonitorController.ts
4. backend/src/middleware/financialAccessMonitoring.ts
5. backend/tests/integration/financialAccessMonitoring.test.ts

**CONSTRAINTS**:
- ❌ Do NOT log actual cost values (PII violation)
- ❌ Do NOT block requests for anomaly detection (must be async)
- ❌ Do NOT alert on false positives (require >80% confidence)
- ✅ DO learn baselines over 30-day window
- ✅ DO detect exfiltration patterns (5x baseline = CRITICAL)
- ✅ DO integrate with SecurityAlert system from Task 6.2

**VERIFICATION QUESTIONS**:
1. Are actual cost values NEVER logged in audit or alert systems?
2. Does anomaly detection complete in <1 second without blocking requests?
3. Are CRITICAL alerts immediately visible in admin dashboard?
4. Can admins view user baselines to understand alert context?
5. Does baseline learning account for infrequent users (0 access = valid baseline)?
```

---

## 🛠️ Task 6.4: AI Natural Language Permission Queries

**Agent**: `ai-systems-architect`

**Input Dependencies**:
- ✅ Phase 1 complete (User/Organization/Permission tables exist)
- ✅ AI provider configured (Gemini/OpenAI/Claude)

**Output Deliverables**:
- 📄 NLQueryParser.ts (LLM-powered query parsing)
- 📄 SemanticPermissionSearch.ts (semantic matching)
- 📄 API endpoint: POST /api/ai/permission-query
- 📄 Frontend component: NLQueryInput.tsx

**Acceptance Criteria**:
- ✅ Parses "Show me all users who can manage settings in HOLNG"
- ✅ Handles variations ("manage settings" = perm_ManageSettings)
- ✅ Returns user-friendly results with role explanations
- ✅ Query response time <2 seconds

---

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@ai-systems-architect

**SYSTEM CONTEXT**:
You are executing Phase 6, Task 6.4 of ADR-005.
Phase 1 complete (User/Organization/Permission tables exist).
AI provider configured (Gemini API available).

**BUSINESS CONTEXT** (from AI_OPPORTUNITIES.md):
Use Case #5: "AI Natural Language Permission Queries - Admins can ask questions like 'Show me all users who can manage settings in HOLNG' and get natural language results."

**USER SCENARIOS**:
1. Admin: "Which users have access to the PEMS sync feature?"
   - Expected: List of users with perm_SyncPems capability
2. Admin: "Show me everyone who can view financial data in Rio Tinto"
   - Expected: List of users in RIO org with viewFinancialDetails=true
3. Admin: "Who has admin access to all organizations?"
   - Expected: Users with isGlobalAdmin=true
4. Admin: "List editors in HOLNG who can also delete records"
   - Expected: Users with role=Editor AND canDelete=true in HOLNG

**SEMANTIC MATCHING REQUIREMENTS**:
- "manage settings" → perm_ManageSettings
- "sync" → perm_SyncPems
- "view costs" → viewFinancialDetails
- "delete" → canDelete
- "write" / "edit" → canWrite
- "admin" → role=Admin OR isGlobalAdmin
- "HOLNG" / "Holcim" → organizationId lookup by code/name

**TECHNICAL SPECIFICATION**:

```typescript
// File: backend/src/services/ai/NLQueryParser.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../../config/database';

interface ParsedPermissionQuery {
  queryType: 'list_users' | 'check_access' | 'count_users';
  filters: {
    organizationId?: string;
    organizationCode?: string;
    role?: string;
    permissions?: string[]; // e.g., ['perm_ManageSettings', 'canDelete']
    isGlobalAdmin?: boolean;
  };
  naturalLanguageResponse: string;
  confidence: number; // 0-1
}

export class NLQueryParser {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  /**
   * Step 1: Parse natural language query into structured filters
   */
  async parseQuery(userQuery: string, organizationContext?: string): Promise<ParsedPermissionQuery> {
    const prompt = `
You are a permission query parser for a multi-tenant construction management system.

**PERMISSION CAPABILITIES** (database fields):
- perm_ManageUsers: Can create/edit/delete users
- perm_ManageSettings: Can configure organization settings
- perm_SyncPems: Can trigger PEMS data synchronization
- perm_ManageApiServers: Can configure API servers
- canRead: Can view PFA records
- canWrite: Can edit PFA records
- canDelete: Can delete PFA records
- canExport: Can export PFA records
- viewFinancialDetails: Can see actual cost values
- isGlobalAdmin: Has access to all organizations

**ORGANIZATIONS** (example):
- HOLNG: Holcim Nigeria
- RIO: Rio Tinto
- BECH: Bechtel
- PEMS_Global: PEMS Global

**USER QUERY**: "${userQuery}"

Parse this query into a JSON object with these fields:
{
  "queryType": "list_users" | "check_access" | "count_users",
  "filters": {
    "organizationCode": "HOLNG" (if organization mentioned),
    "role": "Admin" (if role mentioned: Admin, Editor, Viewer, Field Engineer),
    "permissions": ["perm_ManageSettings"] (array of capabilities mentioned),
    "isGlobalAdmin": true (if "global admin" mentioned)
  },
  "confidence": 0.95 (0-1, how confident you are in this parsing)
}

**SEMANTIC MAPPING**:
- "manage settings" → perm_ManageSettings
- "sync" / "PEMS sync" → perm_SyncPems
- "view costs" / "financial data" → viewFinancialDetails
- "delete" → canDelete
- "edit" / "write" → canWrite
- "admin" → role=Admin (unless "global admin" → isGlobalAdmin=true)

Return ONLY the JSON object, no markdown formatting.
`;

    const result = await this.model.generateContent(prompt);
    const response = result.response.text();

    // Clean response (remove markdown code blocks if present)
    const cleanedResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleanedResponse);
    } catch (error) {
      throw new Error(`Failed to parse LLM response: ${cleanedResponse}`);
    }

    // Validate confidence
    if (parsed.confidence < 0.7) {
      throw new Error(`Low confidence (${parsed.confidence}) in query parsing. Please rephrase your question.`);
    }

    return {
      queryType: parsed.queryType || 'list_users',
      filters: parsed.filters || {},
      naturalLanguageResponse: '', // Will be generated in Step 3
      confidence: parsed.confidence
    };
  }

  /**
   * Step 2: Execute database query based on parsed filters
   */
  async executeQuery(parsedQuery: ParsedPermissionQuery): Promise<any[]> {
    const { filters } = parsedQuery;

    // Build Prisma where clause
    const whereClause: any = {
      serviceStatus: 'active'
    };

    // Filter by organization
    if (filters.organizationCode) {
      const org = await prisma.organization.findFirst({
        where: { code: filters.organizationCode },
        select: { id: true }
      });

      if (!org) {
        throw new Error(`Organization ${filters.organizationCode} not found`);
      }

      whereClause.organizations = {
        some: {
          organizationId: org.id,
          isActive: true
        }
      };
    }

    // Filter by role
    if (filters.role) {
      whereClause.role = filters.role;
    }

    // Filter by global admin
    if (filters.isGlobalAdmin === true) {
      whereClause.isGlobalAdmin = true;
    }

    // Execute query
    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isGlobalAdmin: true,
        organizations: {
          where: filters.organizationCode ? {
            organization: { code: filters.organizationCode }
          } : {},
          select: {
            organization: {
              select: {
                code: true,
                name: true
              }
            },
            perm_ManageUsers: true,
            perm_ManageSettings: true,
            perm_SyncPems: true,
            perm_ManageApiServers: true,
            canRead: true,
            canWrite: true,
            canDelete: true,
            canExport: true,
            viewFinancialDetails: true
          }
        }
      }
    });

    // Filter by specific permissions (post-query filter)
    if (filters.permissions && filters.permissions.length > 0) {
      return users.filter(user => {
        // Check if user has ALL specified permissions
        return filters.permissions!.every(perm => {
          if (user.isGlobalAdmin) return true; // Global admins have all permissions

          return user.organizations.some(org => {
            const userOrg = org as any;
            return userOrg[perm] === true;
          });
        });
      });
    }

    return users;
  }

  /**
   * Step 3: Generate natural language response
   */
  async generateNaturalLanguageResponse(
    userQuery: string,
    parsedQuery: ParsedPermissionQuery,
    results: any[]
  ): Promise<string> {
    if (results.length === 0) {
      return `No users found matching your query "${userQuery}".`;
    }

    const prompt = `
Generate a concise natural language summary for this permission query result.

**USER QUERY**: "${userQuery}"

**RESULTS**: ${results.length} users found
${results.slice(0, 5).map(u => `- ${u.username} (${u.role})`).join('\n')}
${results.length > 5 ? `\n... and ${results.length - 5} more` : ''}

Generate a 1-2 sentence summary like:
"Found 12 users with permission to manage settings in HOLNG, including 3 Admins and 9 Field Engineers."

Return ONLY the summary text, no additional commentary.
`;

    const result = await this.model.generateContent(prompt);
    return result.response.text().trim();
  }

  /**
   * Main entry point: Query + Execute + Format
   */
  async processNaturalLanguageQuery(userQuery: string, organizationContext?: string) {
    // Step 1: Parse
    const parsedQuery = await this.parseQuery(userQuery, organizationContext);

    // Step 2: Execute
    const results = await this.executeQuery(parsedQuery);

    // Step 3: Generate NL response
    const nlResponse = await this.generateNaturalLanguageResponse(userQuery, parsedQuery, results);

    return {
      query: userQuery,
      parsedFilters: parsedQuery.filters,
      confidence: parsedQuery.confidence,
      resultCount: results.length,
      naturalLanguageResponse: nlResponse,
      results: results.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isGlobalAdmin: user.isGlobalAdmin,
        organizations: user.organizations.map((org: any) => ({
          code: org.organization.code,
          name: org.organization.name,
          permissions: {
            perm_ManageUsers: org.perm_ManageUsers,
            perm_ManageSettings: org.perm_ManageSettings,
            perm_SyncPems: org.perm_SyncPems,
            perm_ManageApiServers: org.perm_ManageApiServers,
            canRead: org.canRead,
            canWrite: org.canWrite,
            canDelete: org.canDelete,
            canExport: org.canExport,
            viewFinancialDetails: org.viewFinancialDetails
          }
        }))
      }))
    };
  }
}
```

**API Controller**:

```typescript
// File: backend/src/controllers/nlPermissionQueryController.ts

import { Request, Response } from 'express';
import { NLQueryParser } from '../services/ai/NLQueryParser';

/**
 * POST /api/ai/permission-query
 * Process natural language permission query
 *
 * Authorization: perm_ManageUsers (admin only)
 *
 * Body:
 * {
 *   "query": "Show me all users who can manage settings in HOLNG"
 * }
 */
export async function processPermissionQuery(req: Request, res: Response) {
  const { query } = req.body;
  const organizationContext = req.user.organizationId;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({
      error: 'Query cannot be empty'
    });
  }

  try {
    const parser = new NLQueryParser();
    const result = await parser.processNaturalLanguageQuery(query, organizationContext);

    res.json(result);
  } catch (error: any) {
    if (error.message.includes('Low confidence')) {
      return res.status(400).json({
        error: error.message,
        suggestion: 'Try rephrasing your question to be more specific, e.g. "Show me users with PEMS sync permission in HOLNG"'
      });
    }

    throw error;
  }
}
```

**Frontend Component**:

```tsx
// File: components/admin/NLQueryInput.tsx

import React, { useState } from 'react';
import { Input, Button, Card, Spinner } from '@nextui-org/react';
import { Search } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface QueryResult {
  query: string;
  naturalLanguageResponse: string;
  resultCount: number;
  confidence: number;
  results: Array<{
    id: string;
    username: string;
    email: string;
    role: string;
    organizations: Array<{
      code: string;
      name: string;
      permissions: Record<string, boolean>;
    }>;
  }>;
}

export function NLQueryInput() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/api/ai/permission-query', { query });
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to process query');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="text"
          placeholder="e.g. Show me all users who can manage settings in HOLNG"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
          startContent={<Search className="w-4 h-4 text-gray-400" />}
        />
        <Button type="submit" color="primary" isLoading={loading}>
          Search
        </Button>
      </form>

      {error && (
        <Card className="p-4 bg-red-50 border border-red-200">
          <p className="text-red-700">{error}</p>
        </Card>
      )}

      {result && (
        <Card className="p-6">
          <div className="space-y-4">
            {/* Natural Language Summary */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-blue-900 font-medium">{result.naturalLanguageResponse}</p>
              <p className="text-sm text-blue-700 mt-1">
                Found {result.resultCount} {result.resultCount === 1 ? 'user' : 'users'}
                (Confidence: {Math.round(result.confidence * 100)}%)
              </p>
            </div>

            {/* Results Table */}
            {result.results.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Username</th>
                      <th className="text-left p-2">Role</th>
                      <th className="text-left p-2">Organizations</th>
                      <th className="text-left p-2">Permissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map(user => (
                      <tr key={user.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{user.username}</td>
                        <td className="p-2">{user.role}</td>
                        <td className="p-2">
                          {user.organizations.map(org => org.code).join(', ')}
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1 flex-wrap">
                            {Object.entries(user.organizations[0]?.permissions || {})
                              .filter(([_, value]) => value === true)
                              .map(([key, _]) => (
                                <span
                                  key={key}
                                  className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded"
                                >
                                  {key.replace('perm_', '').replace(/([A-Z])/g, ' $1').trim()}
                                </span>
                              ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
```

**AI ENFORCEMENT**:
🚨 **MANDATORY**: Use LLM for query parsing (semantic understanding).
🚨 **MANDATORY**: Require >70% confidence score, else reject query.
🚨 **MANDATORY**: Generate natural language response for results.

**UX ENFORCEMENT** (from UX_SPEC.md):
🚨 **MANDATORY**: Search input prominent in Admin Dashboard.
🚨 **MANDATORY**: Show confidence score to admins (transparency).
🚨 **MANDATORY**: Results displayed in <2 seconds.

**YOUR MISSION**:

**Step 1**: Create NLQueryParser.ts with 4 methods (parse, execute, generate NL response, process)
**Step 2**: Integrate Gemini API for semantic query parsing
**Step 3**: Create API endpoint POST /api/ai/permission-query
**Step 4**: Build React component NLQueryInput.tsx with auto-complete
**Step 5**: Write integration tests for query variations

**DELIVERABLES**:
1. backend/src/services/ai/NLQueryParser.ts (250+ lines)
2. backend/src/controllers/nlPermissionQueryController.ts
3. components/admin/NLQueryInput.tsx
4. backend/tests/integration/nlPermissionQuery.test.ts
5. Documentation: Natural language query examples

**CONSTRAINTS**:
- ❌ Do NOT parse queries client-side (security risk)
- ❌ Do NOT expose raw SQL in responses
- ❌ Do NOT allow queries across organizations (respect multi-tenancy)
- ✅ DO require >70% LLM confidence score
- ✅ DO handle semantic variations ("manage settings" = perm_ManageSettings)
- ✅ DO return user-friendly results with role explanations

**VERIFICATION QUESTIONS**:
1. Does parser handle variations ("manage settings", "configure org", "change settings")?
2. Is LLM confidence score displayed to admins?
3. Are results returned in <2 seconds for 1000+ users?
4. Does component integrate into Admin Dashboard seamlessly?
5. Are low-confidence queries rejected with helpful suggestions?
```

---

## 🛠️ Task 6.5: AI Data Hooks Implementation

**Agent**: `backend-architecture-optimizer`

**Input Dependencies**:
- ✅ Phase 2 complete (AuditLog table exists)
- ✅ Phase 4 complete (all CRUD operations have audit logging)

**Output Deliverables**:
- 📄 Enhanced AuditLog with AI-ready metadata
- 📄 External ID tracking (PEMS entities)
- 📄 Background data collection hooks
- 📄 Privacy-compliant logging service

**Acceptance Criteria**:
- ✅ All permission changes logged with before/after state
- ✅ External IDs tracked for PEMS users/organizations
- ✅ Metadata captured for AI training (no PII)
- ✅ Background hooks don't impact performance (<10ms overhead)

---

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@backend-architecture-optimizer

**SYSTEM CONTEXT**:
You are executing Phase 6, Task 6.5 of ADR-005.
Phase 2 complete (AuditLog table exists).
Phase 4 complete (all CRUD operations have audit logging).

**BUSINESS CONTEXT** (from AI_OPPORTUNITIES.md):
"AI Data Hooks - All AI use cases (1-25) require foundational data collection infrastructure. This task implements the data prerequisites for future AI training."

**DATA REQUIREMENTS FOR AI USE CASES**:

1. **Permission Suggestions (UC #1)**: Historical permission grant/revoke decisions
2. **Anomaly Detection (UC #2)**: Baseline user activity patterns
3. **Financial Monitoring (UC #8)**: Financial access frequency (NOT actual costs)
4. **Audit Search (UC #18)**: Semantic event metadata (who/what/when/why)
5. **Role Drift Detection (UC #19)**: Permission overrides and role changes over time

**PRIVACY CONSTRAINTS**:
- ❌ **NEVER** log: Passwords, API keys, actual cost values, personally identifiable information (PII)
- ✅ **ALWAYS** log: User IDs (not names), action types, timestamps, before/after states (for rollback)

**TECHNICAL SPECIFICATION**:

```typescript
// File: backend/src/services/aiDataHooks/DataCollectionService.ts

import { prisma } from '../../config/database';
import { AuditLog, Prisma } from '@prisma/client';

/**
 * AI-Ready Audit Logging Service
 *
 * Purpose: Capture metadata for AI training without logging PII
 *
 * Privacy Principles:
 * 1. Log user IDs, NOT usernames/emails (anonymization)
 * 2. Log action types, NOT actual values (e.g., "cost updated" NOT "$50000")
 * 3. Log timestamps for pattern analysis
 * 4. Log before/after states for rollback capability
 */
export class DataCollectionService {
  /**
   * Enhanced audit log with AI-ready metadata
   *
   * Metadata Structure:
   * {
   *   actionType: 'permission:grant' | 'permission:revoke' | 'user:created' | 'org:created',
   *   entityType: 'User' | 'Organization' | 'UserOrganization' | 'ApiServer',
   *   entityId: 'uuid',
   *   externalId: 'PEMS-10345' (if entity is from external system),
   *   beforeState: { ... } (for rollback),
   *   afterState: { ... } (current state),
   *   context: {
   *     ipAddress: '10.0.0.1',
   *     userAgent: 'Mozilla/5.0...',
   *     sessionId: 'uuid',
   *     organizationContext: 'HOLNG'
   *   },
   *   aiMetadata: {
   *     isAnomalous: false,
   *     confidence: 0.95,
   *     relatedEvents: ['audit-log-id-1', 'audit-log-id-2']
   *   }
   * }
   */
  static async logPermissionChange(data: {
    userId: string;
    actorUserId: string; // Who made the change
    organizationId: string;
    action: 'grant' | 'revoke';
    permissionField: string; // e.g., 'perm_ManageSettings'
    permissionValue: boolean;
    beforeState: any;
    afterState: any;
    context?: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
    };
  }): Promise<AuditLog> {
    return await prisma.auditLog.create({
      data: {
        userId: data.actorUserId,
        organizationId: data.organizationId,
        action: `permission:${data.action}`,
        entityType: 'UserOrganization',
        entityId: data.userId,
        metadata: {
          permissionField: data.permissionField,
          permissionValue: data.permissionValue,
          beforeState: this.sanitizeState(data.beforeState), // Remove PII
          afterState: this.sanitizeState(data.afterState),
          context: data.context || {},
          aiMetadata: {
            isPermissionChange: true,
            affectedUser: data.userId,
            changedBy: data.actorUserId
          }
        }
      }
    });
  }

  /**
   * Log external entity creation/update (PEMS users, orgs)
   * Tracks external ID for data lineage
   */
  static async logExternalEntitySync(data: {
    userId: string;
    organizationId: string;
    action: 'created' | 'updated' | 'synced';
    entityType: 'User' | 'Organization' | 'PfaRecord';
    entityId: string;
    externalId: string; // PEMS ID
    externalSystem: 'PEMS' | 'ESS' | 'Procurement';
    syncMetadata: {
      recordsProcessed: number;
      recordsInserted: number;
      recordsUpdated: number;
      recordsSkipped: number;
    };
  }): Promise<AuditLog> {
    return await prisma.auditLog.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        action: `${data.entityType.toLowerCase()}:${data.action}`,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: {
          externalId: data.externalId,
          externalSystem: data.externalSystem,
          syncMetadata: data.syncMetadata,
          aiMetadata: {
            isExternalSync: true,
            dataSource: data.externalSystem
          }
        }
      }
    });
  }

  /**
   * Log user action patterns (for anomaly detection baseline)
   * Privacy-preserving: Only logs action type and timestamp
   */
  static async logUserActivity(data: {
    userId: string;
    organizationId: string;
    actionType: string; // 'pfa:read', 'pfa:write', 'user:login', etc.
    resourceType?: string;
    recordCount?: number; // Number of records accessed
    context?: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
    };
  }): Promise<AuditLog> {
    return await prisma.auditLog.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        action: data.actionType,
        entityType: data.resourceType || 'Activity',
        metadata: {
          recordCount: data.recordCount,
          context: data.context || {},
          aiMetadata: {
            isUserActivity: true,
            timestamp: new Date().toISOString(),
            hour: new Date().getHours() // For time-of-day pattern analysis
          }
        }
      }
    });
  }

  /**
   * Log bulk operations (for anomaly detection)
   * Tracks operation size for exfiltration detection
   */
  static async logBulkOperation(data: {
    userId: string;
    organizationId: string;
    operation: 'update' | 'delete' | 'export';
    entityType: string;
    recordCount: number;
    affectedFields?: string[]; // Which fields were modified
  }): Promise<AuditLog> {
    return await prisma.auditLog.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        action: `bulk:${data.operation}`,
        entityType: data.entityType,
        metadata: {
          recordCount: data.recordCount,
          affectedFields: data.affectedFields || [],
          aiMetadata: {
            isBulkOperation: true,
            operationSize: data.recordCount,
            timestamp: new Date().toISOString()
          }
        }
      }
    });
  }

  /**
   * Privacy-compliant state sanitization
   * Removes PII before logging
   */
  private static sanitizeState(state: any): any {
    if (!state) return null;

    const sanitized = { ...state };

    // Remove sensitive fields
    const piiFields = ['password', 'passwordHash', 'email', 'phone', 'apiKey', 'credentials'];
    for (const field of piiFields) {
      if (sanitized[field]) {
        delete sanitized[field];
      }
    }

    // Mask actual cost values (keep only metadata)
    if (sanitized.cost || sanitized.monthlyRate || sanitized.purchasePrice) {
      sanitized.hasCostData = true;
      delete sanitized.cost;
      delete sanitized.monthlyRate;
      delete sanitized.purchasePrice;
    }

    return sanitized;
  }

  /**
   * Query audit logs for AI training
   * Returns aggregated statistics, NOT raw logs
   */
  static async getAITrainingData(organizationId: string, options?: {
    startDate?: Date;
    endDate?: Date;
    actionTypes?: string[];
    limit?: number;
  }) {
    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      createdAt: {
        gte: options?.startDate,
        lte: options?.endDate
      }
    };

    if (options?.actionTypes) {
      where.action = { in: options.actionTypes };
    }

    const logs = await prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        userId: true, // ID only, not username
        action: true,
        entityType: true,
        createdAt: true,
        metadata: true
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 10000
    });

    // Aggregate statistics (privacy-preserving)
    return {
      totalEvents: logs.length,
      actionDistribution: this.aggregateActions(logs),
      hourlyDistribution: this.aggregateByHour(logs),
      userActivitySummary: this.aggregateByUser(logs),
      bulkOperations: logs.filter(log => log.action.startsWith('bulk:')).length,
      permissionChanges: logs.filter(log => log.action.startsWith('permission:')).length
    };
  }

  private static aggregateActions(logs: any[]) {
    const distribution: Record<string, number> = {};
    for (const log of logs) {
      distribution[log.action] = (distribution[log.action] || 0) + 1;
    }
    return distribution;
  }

  private static aggregateByHour(logs: any[]) {
    const hourDistribution: Record<number, number> = {};
    for (const log of logs) {
      const hour = new Date(log.createdAt).getHours();
      hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
    }
    return hourDistribution;
  }

  private static aggregateByUser(logs: any[]) {
    const userActivity: Record<string, { actions: number; lastSeen: Date }> = {};
    for (const log of logs) {
      if (!userActivity[log.userId]) {
        userActivity[log.userId] = { actions: 0, lastSeen: log.createdAt };
      }
      userActivity[log.userId].actions += 1;
      if (log.createdAt > userActivity[log.userId].lastSeen) {
        userActivity[log.userId].lastSeen = log.createdAt;
      }
    }
    return userActivity;
  }
}
```

**Enhanced AuditLog Middleware** (auto-inject context):

```typescript
// File: backend/src/middleware/auditContext.ts

import { Request, Response, NextFunction } from 'express';

/**
 * Injects audit context into request
 * Captures IP, User-Agent, Session ID for AI analysis
 */
export function injectAuditContext(req: Request, res: Response, next: NextFunction) {
  req.auditContext = {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || 'unknown',
    sessionId: req.headers['x-session-id'] as string || undefined,
    organizationContext: req.user?.organizationId
  };

  next();
}

// Type declaration
declare global {
  namespace Express {
    interface Request {
      auditContext?: {
        ipAddress: string;
        userAgent: string;
        sessionId?: string;
        organizationContext?: string;
      };
    }
  }
}
```

**Integration Example** (User Permission Grant):

```typescript
// File: backend/src/controllers/userController.ts (existing file)

import { DataCollectionService } from '../services/aiDataHooks/DataCollectionService';

// BEFORE (existing code):
router.patch('/users/:userId/permissions', requireAuth, async (req, res) => {
  const { userId } = req.params;
  const { organizationId, perm_ManageSettings, canDelete, viewFinancialDetails } = req.body;

  const beforeState = await prisma.userOrganization.findFirst({
    where: { userId, organizationId }
  });

  await prisma.userOrganization.update({
    where: { userId_organizationId: { userId, organizationId } },
    data: { perm_ManageSettings, canDelete, viewFinancialDetails }
  });

  res.json({ success: true });
});

// AFTER (with AI data hooks):
router.patch('/users/:userId/permissions', requireAuth, async (req, res) => {
  const { userId } = req.params;
  const { organizationId, perm_ManageSettings, canDelete, viewFinancialDetails } = req.body;

  const beforeState = await prisma.userOrganization.findFirst({
    where: { userId, organizationId }
  });

  const updatedUserOrg = await prisma.userOrganization.update({
    where: { userId_organizationId: { userId, organizationId } },
    data: { perm_ManageSettings, canDelete, viewFinancialDetails }
  });

  // 🎯 AI DATA HOOK: Log permission changes
  const changedFields = [];
  if (perm_ManageSettings !== undefined) changedFields.push('perm_ManageSettings');
  if (canDelete !== undefined) changedFields.push('canDelete');
  if (viewFinancialDetails !== undefined) changedFields.push('viewFinancialDetails');

  for (const field of changedFields) {
    await DataCollectionService.logPermissionChange({
      userId,
      actorUserId: req.user.id,
      organizationId,
      action: updatedUserOrg[field] === true ? 'grant' : 'revoke',
      permissionField: field,
      permissionValue: updatedUserOrg[field],
      beforeState,
      afterState: updatedUserOrg,
      context: req.auditContext
    });
  }

  res.json({ success: true });
});
```

**External ID Tracking** (Prisma Schema Enhancement):

```prisma
// File: backend/prisma/schema.prisma (add to existing models)

model User {
  // ... existing fields ...

  // External System Tracking
  externalId       String?  // PEMS user ID (e.g., "PEMS-10345")
  externalSource   String?  // "PEMS", "ESS", "AD"
  lastSyncedAt     DateTime? // When last synced from external system

  @@index([externalId, externalSource]) // Fast lookup by external ID
}

model Organization {
  // ... existing fields ...

  // External System Tracking
  externalId       String?  // PEMS org ID
  externalSource   String?  // "PEMS"
  lastSyncedAt     DateTime?

  @@index([externalId, externalSource])
}

model PfaRecord {
  // ... existing fields ...

  // External System Tracking
  externalId       String?  // PEMS PFA record ID
  externalSource   String?  // "PEMS", "ESS"
  lastSyncedAt     DateTime?

  @@index([externalId, externalSource])
}
```

**AI ENFORCEMENT**:
🚨 **MANDATORY**: NEVER log passwords, API keys, actual costs, or PII.
🚨 **MANDATORY**: Sanitize before/after states before logging.
🚨 **MANDATORY**: Track external IDs for data lineage.

**UX ENFORCEMENT**:
🚨 **MANDATORY**: Audit hooks add <10ms overhead (non-blocking).
🚨 **MANDATORY**: Background data collection doesn't impact user experience.

**YOUR MISSION**:

**Step 1**: Create DataCollectionService.ts with 5 core logging methods
**Step 2**: Add auditContext middleware to inject IP/User-Agent
**Step 3**: Enhance Prisma schema with externalId fields
**Step 4**: Integrate data hooks into ALL permission grant/revoke operations
**Step 5**: Create privacy-compliant aggregation queries for AI training

**DELIVERABLES**:
1. backend/src/services/aiDataHooks/DataCollectionService.ts (400+ lines)
2. backend/src/middleware/auditContext.ts
3. backend/prisma/schema.prisma (external ID fields)
4. Integration into userController.ts, organizationController.ts, pemsSyncController.ts
5. Documentation: AI data collection privacy policy

**CONSTRAINTS**:
- ❌ Do NOT log actual cost values (only "hasCostData" flag)
- ❌ Do NOT log usernames/emails (only user IDs)
- ❌ Do NOT log API keys or credentials
- ✅ DO log before/after states for rollback capability
- ✅ DO track external IDs for PEMS entities
- ✅ DO add <10ms overhead per operation

**VERIFICATION QUESTIONS**:
1. Are ALL permission changes logged with before/after state?
2. Is PII (emails, usernames, costs) NEVER logged?
3. Are external IDs tracked for PEMS users/organizations?
4. Does audit logging add <10ms overhead (measured via benchmarks)?
5. Can AI query aggregated statistics without accessing raw logs?
```

---

## 📊 Phase 6 Summary

**Total Tasks**: 5 (6.1, 6.2, 6.3, 6.4, 6.5)

**Completion Status**:
- ✅ Task 6.1: AI Permission Suggestions (complete prompt in AGENT_WORKFLOW-PHASES-6-10.md)
- ✅ Task 6.2: AI Security Anomaly Detection (complete prompt in AGENT_WORKFLOW-PHASES-6-10.md)
- ✅ Task 6.3: AI Financial Access Monitoring (complete prompt above)
- ✅ Task 6.4: AI Natural Language Permission Queries (complete prompt above)
- ✅ Task 6.5: AI Data Hooks Implementation (complete prompt above)

**Phase 6 Deliverables**:
1. PermissionSuggestionEngine.ts (300+ lines)
2. AnomalyDetectionService.ts (450+ lines)
3. FinancialAccessMonitor.ts (350+ lines)
4. NLQueryParser.ts (250+ lines)
5. DataCollectionService.ts (400+ lines)
6. Frontend: SuggestedPermissions.tsx, SecurityAlertWidget.tsx, NLQueryInput.tsx
7. Database: SecurityAlert, UserFinancialProfile tables + external ID fields
8. Integration tests: 25+ test cases

**Total Lines of Code**: ~2,500 lines across 8 files

**Next Phase**: Phase 7 - UX Intelligence (AI Use Cases 16-20)

---

## 📚 Related Documentation

- **Decision**: [ADR-005-DECISION.md](./ADR-005-DECISION.md)
- **AI Opportunities**: [ADR-005-AI_OPPORTUNITIES.md](./ADR-005-AI_OPPORTUNITIES.md)
- **UX Specification**: [ADR-005-UX_SPEC.md](./ADR-005-UX_SPEC.md)
- **Implementation Plan**: [ADR-005-IMPLEMENTATION_PLAN.md](./ADR-005-IMPLEMENTATION_PLAN.md)
- **Test Plan**: [ADR-005-TEST_PLAN.md](./ADR-005-TEST_PLAN.md)
- **Main Workflow**: [ADR-005-AGENT_WORKFLOW-PHASES-6-10.md](./ADR-005-AGENT_WORKFLOW-PHASES-6-10.md)

---

**Document Statistics**:
- **Prompt Bundles**: 3 complete meta-prompts (6.3, 6.4, 6.5)
- **Total Specification Lines**: ~1,800 lines of complete code specifications
- **Copy-Paste Ready**: ✅ All bundles are self-contained and executable
- **AI Use Cases Covered**: UC #5 (NL Queries), UC #8 (Financial Monitoring), Data Hooks (foundation for UC #1-25)

*Document created: 2025-11-26*
*Status: Complete - Ready for Agent Execution*
