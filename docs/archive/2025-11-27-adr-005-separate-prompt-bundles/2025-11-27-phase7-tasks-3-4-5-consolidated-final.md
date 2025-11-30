# Phase 7, Tasks 7.3-7.5: UX Intelligence Features (Consolidated)

**Agent**: @ai-systems-architect + @ux-technologist
**Estimated Duration**: 6 days total (2 days per task)
**Phase**: 7 (UX Intelligence)
**Dependencies**: Phase 4 Complete (Frontend Permission Enforcement)
**Status**: Ready to Execute

---

## OVERVIEW

This document contains **3 complete prompt bundles** for the remaining UX Intelligence features:

1. **Task 7.3**: Semantic Audit Search (AI Use Case 18)
2. **Task 7.4**: Role Drift Detection (AI Use Case 19)
3. **Task 7.5**: Behavioral Quiet Mode (AI Use Case 20)

Each task follows the same structure as Tasks 7.1-7.2 (600-1500 lines per bundle).

---

# TASK 7.3: SEMANTIC AUDIT SEARCH (AI USE CASE 18)

**Agent**: @ai-systems-architect
**Duration**: 2 days

## SYSTEM CONTEXT

**The Problem**: Admins need to query audit logs but must use complex SQL filters. Natural language queries like "Who changed crane duration last week?" are not supported.

**The Solution**: AI-powered semantic search that:
- Parses natural language queries ("Who modified PFA records yesterday?")
- Translates to SQL filters (resourceType = 'PfaRecord', timestamp > '2025-11-25')
- Understands context ("they" refers to users from previous query)
- Correlates with external data (weather events, project milestones)

**Business Value**:
- **80% faster audit investigations** (2 minutes vs. 10 minutes)
- **Non-technical users can audit** (no SQL knowledge required)
- **Complex multi-turn queries** ("Why did they do it?" remembers context)

---

## TECHNICAL SPECIFICATION

### Backend AI Service

**File**: `backend/src/services/ai/SemanticAuditSearchService.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LRUCache } from 'lru-cache';

interface SemanticSearchParams {
  query: string; // Natural language query
  userId: string;
  organizationId: string;
  context?: string; // Previous query ID (for multi-turn)
}

interface ParsedQuery {
  filters: {
    resourceType?: 'User' | 'Organization' | 'PfaRecord' | 'ApiConfiguration';
    action?: string[]; // ['pfa:update', 'permission:grant']
    userId?: string[];
    timeRange?: { start: string; end: string };
    changedFields?: string[]; // ['forecastEnd', 'forecastStart']
    category?: string[]; // ['Cranes', 'Generators']
    booleanOperator?: 'AND' | 'OR';
  };
}

interface SearchResult {
  queryId: string; // For multi-turn context
  parsedQuery: ParsedQuery;
  naturalLanguageSummary: string; // "John Doe modified 12 crane rentals yesterday"
  auditLogs: any[]; // Actual audit log results
  relatedEvents: any[]; // External correlations (weather, milestones)
  aiInsight: string; // "These changes correlate with heavy rain on Nov 25"
  confidence: number; // 0-1
  clarificationNeeded: boolean;
  suggestions?: string[]; // If query is ambiguous
}

export class SemanticAuditSearchService {
  private prisma: PrismaClient;
  private genAI: GoogleGenerativeAI;
  private queryCache: LRUCache<string, ParsedQuery>;
  private contextStore: Map<string, { query: string; results: any[] }>; // Multi-turn context

  constructor() {
    this.prisma = new PrismaClient();
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
    this.queryCache = new LRUCache({ max: 100, ttl: 1000 * 60 * 5 }); // 5 min cache
    this.contextStore = new Map();
  }

  /**
   * Search audit logs using natural language query
   */
  async semanticAuditSearch(params: SemanticSearchParams): Promise<SearchResult> {
    const { query, userId, organizationId, context } = params;

    // Check if query is too vague
    if (this.isQueryAmbiguous(query)) {
      return {
        queryId: this.generateQueryId(),
        parsedQuery: { filters: {} },
        naturalLanguageSummary: '',
        auditLogs: [],
        relatedEvents: [],
        aiInsight: '',
        confidence: 0,
        clarificationNeeded: true,
        suggestions: [
          'What type of changes are you looking for? (PFA records, users, settings)',
          'What time period? (today, yesterday, last week)',
          'Which users or categories?'
        ]
      };
    }

    // Parse natural language query using AI
    const parsedQuery = await this.parseQuery(query, context);

    // Execute database query
    const auditLogs = await this.executeQuery(parsedQuery, organizationId);

    // Correlate with external events (optional)
    const relatedEvents = await this.correlateExternalEvents(parsedQuery, auditLogs);

    // Generate natural language summary
    const naturalLanguageSummary = await this.generateSummary(query, auditLogs);

    // Generate AI insight
    const aiInsight = await this.generateInsight(auditLogs, relatedEvents);

    // Store context for multi-turn queries
    const queryId = this.generateQueryId();
    this.contextStore.set(queryId, { query, results: auditLogs });

    return {
      queryId,
      parsedQuery,
      naturalLanguageSummary,
      auditLogs,
      relatedEvents,
      aiInsight,
      confidence: 0.9,
      clarificationNeeded: false
    };
  }

  /**
   * Parse natural language query using AI
   */
  private async parseQuery(query: string, contextId?: string): Promise<ParsedQuery> {
    // Check cache
    const cacheKey = `${query}:${contextId || 'no-context'}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached) return cached;

    // Get previous context if multi-turn query
    let previousContext = '';
    if (contextId) {
      const ctx = this.contextStore.get(contextId);
      if (ctx) {
        previousContext = `Previous query: "${ctx.query}"\nResults: ${ctx.results.length} audit logs`;
      }
    }

    const prompt = `
You are a query parser for construction equipment audit logs.

${previousContext ? `Context from previous query:\n${previousContext}\n\n` : ''}

User Query: "${query}"

Database Schema:
- resourceType: 'User' | 'Organization' | 'PfaRecord' | 'ApiConfiguration'
- action: string (e.g., 'pfa:update', 'permission:grant', 'user:suspend')
- userId: string
- timestamp: ISO 8601 date
- metadata: JSON (contains changedFields, category, etc.)

Instructions:
1. Parse the user query into database filters
2. Detect time references (today, yesterday, last week, November storm)
3. Understand synonyms (modified = changed = updated, disabled = suspended)
4. Extract entities (users, categories, fields changed)
5. If query mentions "they" or "it", infer from previous context

Output Format (JSON):
{
  "filters": {
    "resourceType": "PfaRecord",
    "action": ["pfa:update"],
    "userId": ["user-123"],
    "timeRange": { "start": "2025-11-19T00:00:00Z", "end": "2025-11-26T23:59:59Z" },
    "changedFields": ["forecastEnd"],
    "category": ["Cranes"],
    "booleanOperator": "AND"
  }
}
`;

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI did not return valid JSON');

      const parsed = JSON.parse(jsonMatch[0]);

      // Cache result
      this.queryCache.set(cacheKey, parsed);

      return parsed;
    } catch (error) {
      console.error('[SemanticAuditSearch] Query parsing failed:', error);

      // Fallback: Simple keyword extraction
      return this.fallbackQueryParser(query);
    }
  }

  /**
   * Execute parsed query against database
   */
  private async executeQuery(parsedQuery: ParsedQuery, organizationId: string): Promise<any[]> {
    const { filters } = parsedQuery;

    const where: any = { organizationId };

    if (filters.resourceType) {
      where.resourceType = filters.resourceType;
    }

    if (filters.action && filters.action.length > 0) {
      where.action = { in: filters.action };
    }

    if (filters.userId && filters.userId.length > 0) {
      where.userId = { in: filters.userId };
    }

    if (filters.timeRange) {
      where.timestamp = {
        gte: new Date(filters.timeRange.start),
        lte: new Date(filters.timeRange.end)
      };
    }

    if (filters.changedFields && filters.changedFields.length > 0) {
      // Use JSON contains filter
      where.metadata = {
        path: ['changedFields'],
        array_contains: filters.changedFields
      };
    }

    return await this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 100 // Limit results
    });
  }

  /**
   * Correlate audit logs with external events (weather, milestones)
   */
  private async correlateExternalEvents(
    parsedQuery: ParsedQuery,
    auditLogs: any[]
  ): Promise<any[]> {
    // Placeholder: In production, query external APIs (weather, project milestones)
    const relatedEvents: any[] = [];

    // Example: Detect "November storm" in query
    if (parsedQuery.filters.timeRange) {
      const start = new Date(parsedQuery.filters.timeRange.start);
      if (start >= new Date('2025-11-20') && start <= new Date('2025-11-25')) {
        relatedEvents.push({
          type: 'weather_event',
          date: '2025-11-22',
          description: 'Heavy rain (3 inches), wind gusts 45 mph'
        });
      }
    }

    return relatedEvents;
  }

  /**
   * Generate natural language summary
   */
  private async generateSummary(query: string, auditLogs: any[]): Promise<string> {
    if (auditLogs.length === 0) {
      return 'No audit logs found matching your query.';
    }

    // Group by user
    const userCounts = auditLogs.reduce((acc, log) => {
      acc[log.userId] = (acc[log.userId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topUser = Object.entries(userCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))[0];

    return `${topUser[0]} made ${topUser[1]} changes matching your query. ${auditLogs.length} total audit logs found.`;
  }

  /**
   * Generate AI insight
   */
  private async generateInsight(auditLogs: any[], relatedEvents: any[]): Promise<string> {
    if (relatedEvents.length > 0) {
      const weatherEvent = relatedEvents.find(e => e.type === 'weather_event');
      if (weatherEvent) {
        return `These changes correlate with ${weatherEvent.description} on ${weatherEvent.date}.`;
      }
    }

    return '';
  }

  /**
   * Fallback query parser (rule-based)
   */
  private fallbackQueryParser(query: string): ParsedQuery {
    const filters: any = {};

    // Detect resource type
    if (query.match(/\b(user|users)\b/i)) filters.resourceType = 'User';
    if (query.match(/\b(pfa|record|records)\b/i)) filters.resourceType = 'PfaRecord';
    if (query.match(/\b(org|organization)\b/i)) filters.resourceType = 'Organization';

    // Detect action
    if (query.match(/\b(modified|changed|updated)\b/i)) filters.action = ['pfa:update'];
    if (query.match(/\b(suspended|disabled)\b/i)) filters.action = ['user:suspend'];
    if (query.match(/\b(permission|granted)\b/i)) filters.action = ['permission:grant'];

    // Detect time range
    const now = new Date();
    if (query.match(/\b(today)\b/i)) {
      filters.timeRange = {
        start: new Date(now.setHours(0, 0, 0, 0)).toISOString(),
        end: new Date(now.setHours(23, 59, 59, 999)).toISOString()
      };
    } else if (query.match(/\b(yesterday)\b/i)) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      filters.timeRange = {
        start: new Date(yesterday.setHours(0, 0, 0, 0)).toISOString(),
        end: new Date(yesterday.setHours(23, 59, 59, 999)).toISOString()
      };
    } else if (query.match(/\b(last week)\b/i)) {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filters.timeRange = {
        start: weekAgo.toISOString(),
        end: now.toISOString()
      };
    }

    return { filters };
  }

  /**
   * Check if query is too ambiguous
   */
  private isQueryAmbiguous(query: string): boolean {
    const vague = ['show me', 'changes', 'stuff', 'things'];
    return vague.some(v => query.toLowerCase() === v);
  }

  /**
   * Generate unique query ID
   */
  private generateQueryId(): string {
    return `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### Frontend Component

**File**: `components/admin/SemanticAuditSearch.tsx`

```typescript
import React, { useState } from 'react';
import { Input, Button, Card, Spinner } from '@nextui-org/react';
import { Search } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

export const SemanticAuditSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await apiClient.post('/api/audit/semantic-search', {
        query,
        userId: currentUser.id,
        organizationId: currentUser.organizationId
      });

      setResults(response.data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <Input
          placeholder="Ask a question... (e.g., Who modified crane duration last week?)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button auto onClick={handleSearch} disabled={loading}>
          {loading ? <Spinner size="sm" /> : <Search size={18} />}
        </Button>
      </div>

      {results && (
        <Card>
          <Card.Header>
            <p className="text-sm font-semibold">{results.naturalLanguageSummary}</p>
          </Card.Header>
          <Card.Body>
            {results.auditLogs.map((log: any) => (
              <div key={log.id} className="border-b py-2">
                <p className="text-xs text-gray-600">{log.action}</p>
                <p className="text-xs">{new Date(log.timestamp).toLocaleString()}</p>
              </div>
            ))}
          </Card.Body>
        </Card>
      )}
    </div>
  );
};
```

---

## YOUR MISSION (Task 7.3)

**7 Steps**:

1. **Backend Service** (5 hours): Create `SemanticAuditSearchService.ts`
2. **API Endpoint** (2 hours): Create `/api/audit/semantic-search`
3. **Frontend Component** (4 hours): Create `SemanticAuditSearch.tsx`
4. **Multi-Turn Context** (2 hours): Implement context store for follow-up queries
5. **External Correlation** (2 hours): Add weather/milestone correlation
6. **Testing** (3 hours): Test query parsing, DB execution, multi-turn
7. **Documentation** (1 hour): Update API docs

**Success Criteria**:
- ✅ AI parses 90%+ of natural language queries correctly
- ✅ Multi-turn queries remember context ("Why did they do it?")
- ✅ Query execution completes in <2 seconds
- ✅ External event correlation works (weather, milestones)

---

# TASK 7.4: ROLE DRIFT DETECTION (AI USE CASE 19)

**Agent**: @ai-systems-architect
**Duration**: 2 days

## SYSTEM CONTEXT

**The Problem**: Over time, users accumulate custom capability overrides. When 5+ users have identical overrides, it signals the need for a new role template.

**The Solution**: AI analyzes user-role-capability patterns weekly and alerts admins:
- "5 Field Engineers have identical overrides (canManageUsers, canManageSettings, viewFinancialDetails)"
- "Suggest creating 'Senior Field Engineer' role"
- "One-click migration: Move 5 users to new role, remove overrides"

**Business Value**:
- **Cleaner permission model** (fewer custom overrides)
- **Faster user onboarding** (assign role instead of 10 individual capabilities)
- **Audit compliance** (role-based > individual overrides)

---

## TECHNICAL SPECIFICATION

### Backend AI Service

**File**: `backend/src/services/ai/RoleDriftDetectionService.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface DriftPattern {
  id: string;
  driftType: 'CONSISTENT_OVERRIDES' | 'EXCESSIVE_OVERRIDES' | 'ROLE_MISMATCH';
  baseRole: string; // 'Field Engineer'
  commonOverrides: Record<string, boolean>; // { canManageUsers: true, ... }
  affectedUsers: string[]; // User IDs
  frequency: string; // "5 out of 12 Field Engineers (42%)"
  suggestedNewRole: {
    name: string; // "Senior Field Engineer"
    inheritsFrom: string; // "Field Engineer"
    additionalCapabilities: Record<string, boolean>;
  };
}

interface DriftDetectionResult {
  driftDetected: boolean;
  patterns: DriftPattern[];
  recommendations: {
    patternId: string;
    action: 'CREATE_NEW_ROLE' | 'NORMALIZE_OVERRIDES' | 'REVIEW_MANUALLY';
    impact: string; // "Affects 5 users, removes 15 custom overrides"
    confidence: number;
  }[];
}

export class RoleDriftDetectionService {
  private prisma: PrismaClient;
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.prisma = new PrismaClient();
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  }

  /**
   * Detect role drift patterns across organization
   */
  async detectRoleDrift(params: { organizationId: string }): Promise<DriftDetectionResult> {
    const { organizationId } = params;

    // Fetch all user-org relationships with overrides
    const userOrgs = await this.prisma.userOrganization.findMany({
      where: { organizationId },
      include: { role: true, user: true }
    });

    // Group by role
    const roleGroups = userOrgs.reduce((acc, uo) => {
      const roleName = uo.role?.name || 'No Role';
      if (!acc[roleName]) acc[roleName] = [];
      acc[roleName].push(uo);
      return acc;
    }, {} as Record<string, any[]>);

    // Detect drift patterns
    const patterns: DriftPattern[] = [];

    for (const [roleName, users] of Object.entries(roleGroups)) {
      // Find users with overrides
      const usersWithOverrides = users.filter(u =>
        Object.keys(u.capabilityOverrides || {}).length > 0
      );

      if (usersWithOverrides.length < 3) continue; // Need at least 3 for pattern

      // Find common overrides
      const overrideCombinations = usersWithOverrides.map(u => u.capabilityOverrides);
      const commonPattern = this.findCommonOverrides(overrideCombinations);

      if (commonPattern && Object.keys(commonPattern).length >= 2) {
        // Found drift pattern
        const affectedUserIds = usersWithOverrides
          .filter(u => this.hasOverrides(u.capabilityOverrides, commonPattern))
          .map(u => u.userId);

        const frequency = `${affectedUserIds.length} out of ${users.length} ${roleName}s (${Math.round((affectedUserIds.length / users.length) * 100)}%)`;

        patterns.push({
          id: `pattern-${Date.now()}-${roleName}`,
          driftType: 'CONSISTENT_OVERRIDES',
          baseRole: roleName,
          commonOverrides: commonPattern,
          affectedUsers: affectedUserIds,
          frequency,
          suggestedNewRole: {
            name: `Senior ${roleName}`,
            inheritsFrom: roleName,
            additionalCapabilities: commonPattern
          }
        });
      }
    }

    // Generate recommendations
    const recommendations = patterns.map(pattern => ({
      patternId: pattern.id,
      action: 'CREATE_NEW_ROLE' as const,
      impact: `Affects ${pattern.affectedUsers.length} users, removes ${Object.keys(pattern.commonOverrides).length * pattern.affectedUsers.length} custom overrides`,
      confidence: 0.9
    }));

    return {
      driftDetected: patterns.length > 0,
      patterns,
      recommendations
    };
  }

  /**
   * Find common overrides across users
   */
  private findCommonOverrides(overrides: any[]): Record<string, boolean> | null {
    if (overrides.length < 3) return null;

    // Count frequency of each override
    const overrideCounts: Record<string, number> = {};

    overrides.forEach(override => {
      Object.keys(override).forEach(key => {
        overrideCounts[key] = (overrideCounts[key] || 0) + 1;
      });
    });

    // Find overrides present in 60%+ of users
    const threshold = Math.ceil(overrides.length * 0.6);
    const commonOverrides: Record<string, boolean> = {};

    Object.entries(overrideCounts).forEach(([key, count]) => {
      if (count >= threshold) {
        // Use most common value (true or false)
        const values = overrides.map(o => o[key]).filter(v => v !== undefined);
        const trueCount = values.filter(v => v === true).length;
        commonOverrides[key] = trueCount > values.length / 2;
      }
    });

    return Object.keys(commonOverrides).length >= 2 ? commonOverrides : null;
  }

  /**
   * Check if user has specific overrides
   */
  private hasOverrides(
    userOverrides: any,
    targetOverrides: Record<string, boolean>
  ): boolean {
    return Object.entries(targetOverrides).every(
      ([key, value]) => userOverrides[key] === value
    );
  }

  /**
   * Apply role refactor (create new role, migrate users)
   */
  async applyRoleRefactor(params: {
    patternId: string;
    approve: boolean;
    adminUserId: string;
  }): Promise<{
    newRoleCreated: boolean;
    usersMigrated: number;
    overridesRemoved: number;
    rollbackAvailable: boolean;
  }> {
    // Implementation: Create new role, migrate users, log for rollback
    // (See TEST_PLAN.md lines 1529-1543 for details)

    return {
      newRoleCreated: true,
      usersMigrated: 5,
      overridesRemoved: 15,
      rollbackAvailable: true
    };
  }
}
```

### Frontend Component

**File**: `components/admin/RoleDriftAlerts.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { Card, Button, Badge } from '@nextui-org/react';
import { apiClient } from '@/services/apiClient';

export const RoleDriftAlerts: React.FC = () => {
  const [driftResult, setDriftResult] = useState<any>(null);

  useEffect(() => {
    const fetchDrift = async () => {
      const response = await apiClient.post('/api/roles/detect-drift', {
        organizationId: currentUser.organizationId
      });
      setDriftResult(response.data);
    };

    fetchDrift();
  }, []);

  const handleApplyRefactor = async (patternId: string) => {
    const confirmed = confirm('Create new role and migrate users?');
    if (!confirmed) return;

    await apiClient.post('/api/roles/apply-refactor', {
      patternId,
      approve: true,
      adminUserId: currentUser.id
    });

    alert('Role refactor complete!');
  };

  if (!driftResult || !driftResult.driftDetected) {
    return <p className="text-sm text-gray-600">No role drift detected.</p>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">⚠️ Role Drift Detected</h3>

      {driftResult.patterns.map((pattern: any) => (
        <Card key={pattern.id}>
          <Card.Header>
            <div className="flex justify-between items-center w-full">
              <p className="font-semibold">{pattern.frequency}</p>
              <Badge color="warning">Drift Detected</Badge>
            </div>
          </Card.Header>
          <Card.Body>
            <p className="text-sm mb-2">
              <strong>Base Role:</strong> {pattern.baseRole}
            </p>
            <p className="text-sm mb-2">
              <strong>Common Overrides:</strong>
            </p>
            <ul className="list-disc list-inside text-xs">
              {Object.entries(pattern.commonOverrides).map(([key, value]) => (
                <li key={key}>{key}: {value ? '✅' : '❌'}</li>
              ))}
            </ul>

            <p className="text-sm mt-4">
              <strong>Suggested New Role:</strong> {pattern.suggestedNewRole.name}
            </p>
          </Card.Body>
          <Card.Footer>
            <Button auto size="sm" onClick={() => handleApplyRefactor(pattern.id)}>
              Apply Refactor
            </Button>
          </Card.Footer>
        </Card>
      ))}
    </div>
  );
};
```

---

## YOUR MISSION (Task 7.4)

**7 Steps**:

1. **Backend Service** (4 hours): Create `RoleDriftDetectionService.ts`
2. **Common Override Detection** (3 hours): Implement `findCommonOverrides()`
3. **API Endpoints** (2 hours): `/detect-drift`, `/apply-refactor`
4. **Frontend Component** (3 hours): Create `RoleDriftAlerts.tsx`
5. **Rollback System** (2 hours): Store refactor history for 7-day rollback
6. **Testing** (3 hours): Test drift detection, refactor, rollback
7. **Documentation** (1 hour): Update admin guide

**Success Criteria**:
- ✅ Detects drift when 3+ users have 60%+ identical overrides
- ✅ One-click refactor creates new role and migrates users
- ✅ Rollback works within 7 days
- ✅ False positive rate <10%

---

# TASK 7.5: BEHAVIORAL QUIET MODE (AI USE Case 20)

**Agent**: @ux-technologist
**Duration**: 2 days

## SYSTEM CONTEXT

**The Problem**: Users receive 25+ notifications/day at random times, disrupting focus. Urgent alerts interrupt deep work, routine notifications during meetings.

**The Solution**: AI learns user engagement patterns over 4 months:
- Peak attention hours: 14:00-16:00 (user clicks notifications within 15 min)
- Quiet hours: 08:00-12:00 (user ignores notifications for 4+ hours)
- Urgent alerts: Send immediately via Slack
- Routine notifications: Defer to 14:00, batch into digest

**Business Value**:
- **30% reduction in interruptions** (8 fewer notifications during focus time)
- **Higher engagement rate** (65% click-through vs. 40% baseline)
- **User satisfaction** (notifications feel helpful, not spammy)

---

## TECHNICAL SPECIFICATION

### Backend AI Service

**File**: `backend/src/services/ai/NotificationTimingService.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface EngagementProfile {
  userId: string;
  peakAttentionHours: string[]; // ["14:00-16:00"]
  quietHours: string[]; // ["08:00-12:00"]
  preferredChannels: {
    urgent: 'slack' | 'email' | 'in_app';
    routine: 'slack' | 'email' | 'in_app';
  };
  notificationSaturation: {
    status: 'HEALTHY' | 'MODERATE' | 'OVERLOADED';
    dailyCount: number;
    recommendation: string; // "Reduce routine notifications by 60%"
  };
  confidence: number; // How confident are we in this profile? (0-1)
}

interface RoutingDecision {
  action: 'SEND_NOW' | 'DEFER' | 'BATCH_DIGEST';
  deferUntil?: string; // ISO 8601 timestamp
  channel: 'slack' | 'email' | 'in_app';
  reasoning: string; // "User typically engages with urgent notifications in Slack within 15 min"
}

export class NotificationTimingService {
  private prisma: PrismaClient;
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.prisma = new PrismaClient();
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  }

  /**
   * Learn user notification preferences from engagement data
   */
  async learnNotificationPreferences(params: {
    userId: string;
  }): Promise<{ engagementProfile: EngagementProfile }> {
    const { userId } = params;

    // Fetch 4 months of notification engagement data
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);

    const notifications = await this.prisma.notification.findMany({
      where: {
        userId,
        sentAt: { gte: fourMonthsAgo }
      },
      orderBy: { sentAt: 'desc' }
    });

    // Analyze engagement patterns
    const hourlyEngagement = this.analyzeHourlyEngagement(notifications);
    const peakHours = this.findPeakHours(hourlyEngagement);
    const quietHours = this.findQuietHours(hourlyEngagement);

    // Analyze channel preferences
    const preferredChannels = this.analyzeChannelPreferences(notifications);

    // Detect notification saturation
    const saturation = this.detectSaturation(notifications);

    return {
      engagementProfile: {
        userId,
        peakAttentionHours: peakHours,
        quietHours: quietHours,
        preferredChannels,
        notificationSaturation: saturation,
        confidence: 0.85
      }
    };
  }

  /**
   * Route notification based on user behavior patterns
   */
  async routeNotification(params: {
    userId: string;
    notification: { type: string; urgency: 'urgent' | 'routine' };
    timestamp: string;
  }): Promise<{ routingDecision: RoutingDecision }> {
    const { userId, notification, timestamp } = params;

    // Get user engagement profile
    const { engagementProfile } = await this.learnNotificationPreferences({ userId });

    // Urgent notifications: Send immediately
    if (notification.urgency === 'urgent') {
      return {
        routingDecision: {
          action: 'SEND_NOW',
          channel: engagementProfile.preferredChannels.urgent,
          reasoning: 'Urgent notification: Send immediately via preferred channel'
        }
      };
    }

    // Routine notifications: Check if in quiet hours
    const hour = new Date(timestamp).getHours();
    const inQuietHours = engagementProfile.quietHours.some(range => {
      const [start, end] = range.split('-').map(h => parseInt(h.split(':')[0]));
      return hour >= start && hour < end;
    });

    if (inQuietHours) {
      // Defer to peak attention hours
      const peakHour = engagementProfile.peakAttentionHours[0]?.split('-')[0] || '14:00';
      const deferDate = new Date(timestamp);
      deferDate.setHours(parseInt(peakHour.split(':')[0]), 0, 0, 0);

      return {
        routingDecision: {
          action: 'DEFER',
          deferUntil: deferDate.toISOString(),
          channel: engagementProfile.preferredChannels.routine,
          reasoning: `User is in quiet hours (${hour}:00). Defer to peak attention time (${peakHour}).`
        }
      };
    }

    // Not in quiet hours: Send now
    return {
      routingDecision: {
        action: 'SEND_NOW',
        channel: engagementProfile.preferredChannels.routine,
        reasoning: 'Outside quiet hours, send immediately'
      }
    };
  }

  /**
   * Analyze hourly engagement (click-through rate by hour)
   */
  private analyzeHourlyEngagement(notifications: any[]): Record<number, number> {
    const hourlyData: Record<number, { sent: number; clicked: number }> = {};

    notifications.forEach(notif => {
      const hour = new Date(notif.sentAt).getHours();
      if (!hourlyData[hour]) hourlyData[hour] = { sent: 0, clicked: 0 };

      hourlyData[hour].sent += 1;
      if (notif.clickedAt) hourlyData[hour].clicked += 1;
    });

    // Calculate click-through rate (CTR) for each hour
    const hourlyCtr: Record<number, number> = {};
    Object.entries(hourlyData).forEach(([hour, data]) => {
      hourlyCtr[parseInt(hour)] = data.clicked / data.sent;
    });

    return hourlyCtr;
  }

  /**
   * Find peak attention hours (top 25% CTR)
   */
  private findPeakHours(hourlyCtr: Record<number, number>): string[] {
    const sorted = Object.entries(hourlyCtr)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6); // Top 6 hours

    return sorted.map(([hour]) => `${hour}:00-${parseInt(hour) + 1}:00`);
  }

  /**
   * Find quiet hours (bottom 25% CTR)
   */
  private findQuietHours(hourlyCtr: Record<number, number>): string[] {
    const sorted = Object.entries(hourlyCtr)
      .sort(([, a], [, b]) => a - b)
      .slice(0, 4); // Bottom 4 hours

    return sorted.map(([hour]) => `${hour}:00-${parseInt(hour) + 1}:00`);
  }

  /**
   * Analyze channel preferences (Slack vs. Email vs. In-App)
   */
  private analyzeChannelPreferences(notifications: any[]): {
    urgent: 'slack' | 'email' | 'in_app';
    routine: 'slack' | 'email' | 'in_app';
  } {
    // Group by urgency and channel
    const urgentChannels = notifications.filter(n => n.urgency === 'urgent');
    const routineChannels = notifications.filter(n => n.urgency === 'routine');

    const getPreferredChannel = (notifs: any[]): 'slack' | 'email' | 'in_app' => {
      const channelEngagement: Record<string, { sent: number; avgResponseTime: number }> = {};

      notifs.forEach(n => {
        if (!channelEngagement[n.channel]) {
          channelEngagement[n.channel] = { sent: 0, avgResponseTime: 0 };
        }

        channelEngagement[n.channel].sent += 1;
        if (n.clickedAt) {
          const responseTime = new Date(n.clickedAt).getTime() - new Date(n.sentAt).getTime();
          channelEngagement[n.channel].avgResponseTime += responseTime;
        }
      });

      // Sort by fastest avg response time
      const sorted = Object.entries(channelEngagement)
        .map(([channel, data]) => ({
          channel,
          avgResponseTime: data.avgResponseTime / data.sent
        }))
        .sort((a, b) => a.avgResponseTime - b.avgResponseTime);

      return sorted[0]?.channel as 'slack' | 'email' | 'in_app' || 'in_app';
    };

    return {
      urgent: getPreferredChannel(urgentChannels),
      routine: getPreferredChannel(routineChannels)
    };
  }

  /**
   * Detect notification saturation (too many notifications)
   */
  private detectSaturation(notifications: any[]): {
    status: 'HEALTHY' | 'MODERATE' | 'OVERLOADED';
    dailyCount: number;
    recommendation: string;
  } {
    // Calculate average daily notifications
    const days = Math.max(1, (Date.now() - new Date(notifications[notifications.length - 1]?.sentAt).getTime()) / (1000 * 60 * 60 * 24));
    const dailyCount = Math.round(notifications.length / days);

    if (dailyCount > 20) {
      return {
        status: 'OVERLOADED',
        dailyCount,
        recommendation: 'Reduce routine notifications by 60%. User is receiving too many notifications.'
      };
    }

    if (dailyCount > 10) {
      return {
        status: 'MODERATE',
        dailyCount,
        recommendation: 'Consider batching routine notifications into a daily digest.'
      };
    }

    return {
      status: 'HEALTHY',
      dailyCount,
      recommendation: 'Notification volume is healthy.'
    };
  }
}
```

### Frontend Component

**File**: `components/settings/NotificationPreferences.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { Card, Switch, Button } from '@nextui-org/react';
import { apiClient } from '@/services/apiClient';

export const NotificationPreferences: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const response = await apiClient.post('/api/notifications/learn-preferences', {
        userId: currentUser.id
      });
      setProfile(response.data.engagementProfile);
    };

    fetchProfile();
  }, []);

  if (!profile) return <p>Loading...</p>;

  return (
    <Card>
      <Card.Header>
        <h3 className="text-lg font-semibold">🔔 Smart Notification Timing</h3>
      </Card.Header>
      <Card.Body>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold">Peak Attention Hours</p>
            <p className="text-xs text-gray-600">{profile.peakAttentionHours.join(', ')}</p>
          </div>

          <div>
            <p className="text-sm font-semibold">Quiet Hours</p>
            <p className="text-xs text-gray-600">{profile.quietHours.join(', ')}</p>
          </div>

          <div>
            <p className="text-sm font-semibold">Notification Saturation</p>
            <p className="text-xs text-gray-600">
              {profile.notificationSaturation.dailyCount} notifications/day ({profile.notificationSaturation.status})
            </p>
            {profile.notificationSaturation.status !== 'HEALTHY' && (
              <p className="text-xs text-yellow-600 mt-1">
                💡 {profile.notificationSaturation.recommendation}
              </p>
            )}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};
```

---

## YOUR MISSION (Task 7.5)

**7 Steps**:

1. **Backend Service** (5 hours): Create `NotificationTimingService.ts`
2. **Engagement Analysis** (3 hours): Implement `analyzeHourlyEngagement()`
3. **Routing Logic** (2 hours): Implement `routeNotification()`
4. **API Endpoints** (2 hours): `/learn-preferences`, `/route-notification`
5. **Frontend Component** (3 hours): Create `NotificationPreferences.tsx`
6. **Testing** (3 hours): Test engagement analysis, routing decisions
7. **Documentation** (1 hour): Update user guide

**Success Criteria**:
- ✅ AI learns peak/quiet hours after 4 months of data
- ✅ Routine notifications deferred during quiet hours
- ✅ Urgent notifications sent immediately
- ✅ Notification digest batches 10+ deferred notifications
- ✅ User engagement rate increases by 20%+

---

## DELIVERABLES (All 3 Tasks)

**Task 7.3 (Semantic Audit Search)**:
1. `backend/src/services/ai/SemanticAuditSearchService.ts` (400+ lines)
2. `backend/src/controllers/semanticAuditController.ts` (80+ lines)
3. `components/admin/SemanticAuditSearch.tsx` (150+ lines)
4. `backend/tests/integration/semanticAuditSearch.test.ts` (200+ lines)

**Task 7.4 (Role Drift Detection)**:
1. `backend/src/services/ai/RoleDriftDetectionService.ts` (350+ lines)
2. `backend/src/controllers/roleDriftController.ts` (100+ lines)
3. `components/admin/RoleDriftAlerts.tsx` (120+ lines)
4. `backend/tests/integration/roleDriftDetection.test.ts` (180+ lines)

**Task 7.5 (Behavioral Quiet Mode)**:
1. `backend/src/services/ai/NotificationTimingService.ts` (450+ lines)
2. `backend/src/controllers/notificationTimingController.ts` (90+ lines)
3. `components/settings/NotificationPreferences.tsx` (140+ lines)
4. `backend/tests/integration/notificationTiming.test.ts` (220+ lines)

---

## CONSTRAINTS (All Tasks)

### ❌ Do NOT
1. ❌ Store sensitive data in AI prompts (costs, internal IDs)
2. ❌ Call AI service synchronously on every request (use cache)
3. ❌ Skip fallback logic (AI service may be unavailable)
4. ❌ Ignore performance (AI calls must complete in <2s)

### ✅ Do ENFORCE
1. ✅ Cache AI results (LRU cache, 5-15 min TTL)
2. ✅ Validate AI response schema before using
3. ✅ Use rule-based fallback if AI fails
4. ✅ Log AI errors for debugging

---

## VERIFICATION QUESTIONS (All Tasks)

**Task 7.3 (Semantic Audit Search)**:
1. Does AI parse 90%+ of natural language queries correctly?
2. Do multi-turn queries remember context?
3. Does external event correlation work?
4. Is query execution <2 seconds?

**Task 7.4 (Role Drift Detection)**:
1. Does AI detect drift when 3+ users have 60%+ identical overrides?
2. Does one-click refactor create new role and migrate users?
3. Does rollback work within 7 days?
4. Is false positive rate <10%?

**Task 7.5 (Behavioral Quiet Mode)**:
1. Does AI learn peak/quiet hours after 4 months?
2. Are routine notifications deferred during quiet hours?
3. Are urgent notifications sent immediately?
4. Does notification digest batch 10+ deferred notifications?
5. Does user engagement rate increase by 20%+?

---

**END OF CONSOLIDATED PROMPT BUNDLE**

Total Lines: ~2,800 lines (3 tasks combined)
