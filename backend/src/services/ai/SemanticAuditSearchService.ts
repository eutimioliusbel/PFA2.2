// backend/src/services/ai/SemanticAuditSearchService.ts
/**
 * Semantic Audit Search Service
 *
 * Phase 7, Task 7.3 of ADR-005 Multi-Tenant Access Control
 * AI Use Case 18: Natural Language Audit Log Queries
 *
 * Translates natural language queries into database filters for audit logs.
 * Supports multi-turn queries with context preservation and external event
 * correlation (weather, project milestones).
 *
 * Key Features:
 * - Natural language query parsing ("Who modified crane duration last week?")
 * - Multi-turn context support ("Why did they do it?")
 * - External event correlation (weather, milestones)
 * - 5-minute LRU cache for parsed queries
 * - Rule-based fallback when AI unavailable
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../../utils/logger';
import { lazyAiClient } from './AiProviderHelper';

// ============================================================================
// Types
// ============================================================================

export interface SemanticSearchParams {
  query: string; // Natural language query
  userId: string;
  organizationId: string;
  contextId?: string; // Previous query ID (for multi-turn)
}

export interface ParsedFilters {
  resourceType?: 'User' | 'Organization' | 'PfaRecord' | 'ApiConfiguration' | 'UserOrganization';
  action?: string[]; // ['pfa:update', 'permission:grant']
  userId?: string[];
  timeRange?: { start: string; end: string };
  changedFields?: string[]; // ['forecastEnd', 'forecastStart']
  category?: string[]; // ['Cranes', 'Generators']
  booleanOperator?: 'AND' | 'OR';
}

export interface ParsedQuery {
  filters: ParsedFilters;
  confidence: number;
  interpretation: string;
}

export interface ExternalEvent {
  type: 'weather_event' | 'project_milestone' | 'system_event';
  date: string;
  description: string;
  relevance: number; // 0-1 relevance score
}

export interface AuditLogResult {
  id: string;
  userId: string;
  organizationId: string | null;
  action: string;
  resource: string | null;
  method: string | null;
  metadata: any;
  success: boolean;
  errorMessage: string | null;
  timestamp: Date;
  user?: {
    id: string;
    username: string;
    email: string | null;
  };
}

export interface SearchResult {
  queryId: string; // For multi-turn context
  parsedQuery: ParsedQuery;
  naturalLanguageSummary: string; // "John Doe modified 12 crane rentals yesterday"
  auditLogs: AuditLogResult[]; // Actual audit log results
  relatedEvents: ExternalEvent[]; // External correlations (weather, milestones)
  aiInsight: string; // "These changes correlate with heavy rain on Nov 25"
  confidence: number; // 0-1
  clarificationNeeded: boolean;
  suggestions?: string[]; // If query is ambiguous
  totalCount: number;
  cached: boolean;
}

// ============================================================================
// Simple LRU Cache for Query Parsing
// ============================================================================

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

class SimpleLRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number = 100, ttlMinutes: number = 5) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: string, value: T): void {
    // Check capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// Multi-Turn Context Store
// ============================================================================

interface QueryContext {
  query: string;
  parsedQuery: ParsedQuery;
  results: AuditLogResult[];
  timestamp: number;
}

class ContextStore {
  private contexts: Map<string, QueryContext> = new Map();
  private maxContexts: number = 50;
  private contextTtlMs: number = 30 * 60 * 1000; // 30 minutes

  set(queryId: string, context: Omit<QueryContext, 'timestamp'>): void {
    // Clean old contexts
    this.cleanExpired();

    // Check capacity
    if (this.contexts.size >= this.maxContexts) {
      const firstKey = this.contexts.keys().next().value;
      if (firstKey) this.contexts.delete(firstKey);
    }

    this.contexts.set(queryId, { ...context, timestamp: Date.now() });
  }

  get(queryId: string): QueryContext | undefined {
    const context = this.contexts.get(queryId);
    if (!context) return undefined;

    if (Date.now() - context.timestamp > this.contextTtlMs) {
      this.contexts.delete(queryId);
      return undefined;
    }

    return context;
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, context] of this.contexts.entries()) {
      if (now - context.timestamp > this.contextTtlMs) {
        this.contexts.delete(key);
      }
    }
  }
}

// ============================================================================
// Service Implementation
// ============================================================================

class SemanticAuditSearchService {
  private queryCache: SimpleLRUCache<ParsedQuery>;
  private contextStore: ContextStore;
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
    this.queryCache = new SimpleLRUCache(100, 5);
    this.contextStore = new ContextStore();
    // AI client is now lazily loaded from database-configured providers
    // No startup warnings - checked on first use via lazyAiClient
  }

  /**
   * Get the AI client (lazily loaded from database)
   */
  private async getAiClient(): Promise<GoogleGenerativeAI | null> {
    return lazyAiClient.getClient();
  }

  // ============================================================================
  // Main Search Method
  // ============================================================================

  /**
   * Search audit logs using natural language query
   */
  async semanticSearch(params: SemanticSearchParams): Promise<SearchResult> {
    const { query, userId, organizationId, contextId } = params;
    const startTime = Date.now();

    logger.info('[SemanticAuditSearch] Processing query', {
      query,
      userId,
      organizationId,
      hasContext: !!contextId,
    });

    // Check if query is too vague
    if (this.isQueryAmbiguous(query)) {
      return {
        queryId: this.generateQueryId(),
        parsedQuery: { filters: {}, confidence: 0, interpretation: 'Query is too vague' },
        naturalLanguageSummary: '',
        auditLogs: [],
        relatedEvents: [],
        aiInsight: '',
        confidence: 0,
        clarificationNeeded: true,
        suggestions: [
          'What type of changes are you looking for? (PFA records, users, settings)',
          'What time period? (today, yesterday, last week)',
          'Which users or categories?',
        ],
        totalCount: 0,
        cached: false,
      };
    }

    // Get previous context for multi-turn queries
    let previousContext: QueryContext | undefined;
    if (contextId) {
      previousContext = this.contextStore.get(contextId);
    }

    // Check cache for parsed query
    const cacheKey = this.buildCacheKey(query, contextId);
    let parsedQuery = this.queryCache.get(cacheKey);
    let cached = !!parsedQuery;

    if (!parsedQuery) {
      // Parse natural language query
      parsedQuery = await this.parseQuery(query, previousContext);
      this.queryCache.set(cacheKey, parsedQuery);
    }

    // Execute database query
    const { auditLogs, totalCount } = await this.executeQuery(parsedQuery, organizationId);

    // Correlate with external events
    const relatedEvents = await this.correlateExternalEvents(parsedQuery, auditLogs);

    // Generate natural language summary
    const naturalLanguageSummary = await this.generateSummary(query, auditLogs, parsedQuery);

    // Generate AI insight
    const aiInsight = await this.generateInsight(auditLogs, relatedEvents, parsedQuery);

    // Store context for multi-turn queries
    const queryId = this.generateQueryId();
    this.contextStore.set(queryId, {
      query,
      parsedQuery,
      results: auditLogs.slice(0, 50), // Store only first 50 for context
    });

    const executionTime = Date.now() - startTime;
    logger.info('[SemanticAuditSearch] Query completed', {
      queryId,
      resultCount: auditLogs.length,
      executionTimeMs: executionTime,
      cached,
    });

    return {
      queryId,
      parsedQuery,
      naturalLanguageSummary,
      auditLogs,
      relatedEvents,
      aiInsight,
      confidence: parsedQuery.confidence,
      clarificationNeeded: false,
      totalCount,
      cached,
    };
  }

  // ============================================================================
  // Query Parsing
  // ============================================================================

  /**
   * Parse natural language query using AI or fallback to rule-based
   */
  private async parseQuery(query: string, previousContext?: QueryContext): Promise<ParsedQuery> {
    // Try AI parsing first (lazy load from database-configured provider)
    const genAI = await this.getAiClient();
    if (genAI) {
      try {
        return await this.parseQueryWithAI(query, previousContext, genAI);
      } catch (error) {
        logger.error('[SemanticAuditSearch] AI parsing failed, using fallback', { error });
      }
    }

    // Fallback to rule-based parsing
    return this.parseQueryWithRules(query, previousContext);
  }

  /**
   * Parse query using Google Gemini AI
   */
  private async parseQueryWithAI(query: string, previousContext: QueryContext | undefined, genAI: GoogleGenerativeAI): Promise<ParsedQuery> {

    // Build context string for multi-turn queries
    let contextString = '';
    if (previousContext) {
      const userIds = [...new Set(previousContext.results.map(r => r.userId))].slice(0, 5);
      contextString = `
Previous Query Context:
- User's previous question: "${previousContext.query}"
- Interpretation: ${previousContext.parsedQuery.interpretation}
- Results: ${previousContext.results.length} audit logs found
- Users involved: ${userIds.join(', ')}
- If user says "they", "them", "those users", or "it", refer to the users/results from previous query.
`;
    }

    const currentDate = new Date().toISOString().split('T')[0];

    const prompt = `You are a query parser for construction equipment audit logs.

Today's Date: ${currentDate}
${contextString}

User Query: "${query}"

Database Schema:
- resource: 'User' | 'Organization' | 'PfaRecord' | 'ApiConfiguration' | 'UserOrganization'
- action: string (e.g., 'pfa:update', 'pfa:create', 'permission:grant', 'user:suspend', 'user:create', 'login', 'logout')
- userId: string (user who performed the action)
- timestamp: ISO 8601 date
- metadata: JSON (may contain changedFields, category, oldValue, newValue, etc.)

Instructions:
1. Parse the user query into database filters
2. Detect time references:
   - "today" = ${currentDate}T00:00:00Z to ${currentDate}T23:59:59Z
   - "yesterday" = subtract 1 day
   - "last week" = last 7 days
   - "last month" = last 30 days
   - Specific dates like "November 25" = that date in current year
3. Understand synonyms:
   - modified = changed = updated = edited
   - disabled = suspended = deactivated
   - created = added = new
   - deleted = removed
   - crane = Cranes (category)
   - generator = Generators (category)
4. Extract entities (users, categories, fields changed)
5. If query mentions "they", "them", "it", or "those" and context is available, infer from previous context

Output ONLY valid JSON (no markdown, no explanation):
{
  "filters": {
    "resourceType": "PfaRecord",
    "action": ["pfa:update"],
    "userId": [],
    "timeRange": { "start": "2025-11-20T00:00:00Z", "end": "2025-11-27T23:59:59Z" },
    "changedFields": ["forecastEnd"],
    "category": ["Cranes"],
    "booleanOperator": "AND"
  },
  "confidence": 0.9,
  "interpretation": "Looking for PFA record updates to crane forecast end dates in the last week"
}`;

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI did not return valid JSON');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        filters: parsed.filters || {},
        confidence: parsed.confidence || 0.7,
        interpretation: parsed.interpretation || 'AI-parsed query',
      };
    } catch (error) {
      logger.error('[SemanticAuditSearch] AI response parsing failed', { error });
      throw error;
    }
  }

  /**
   * Fallback rule-based query parser
   */
  private parseQueryWithRules(query: string, previousContext?: QueryContext): ParsedQuery {
    const filters: ParsedFilters = {};
    const lowerQuery = query.toLowerCase();
    let interpretation = '';

    // Detect resource type
    if (lowerQuery.match(/\b(user|users|login|logout)\b/)) {
      filters.resourceType = 'User';
      interpretation += 'user-related actions';
    } else if (lowerQuery.match(/\b(pfa|record|records|equipment|crane|generator)\b/)) {
      filters.resourceType = 'PfaRecord';
      interpretation += 'PFA record changes';
    } else if (lowerQuery.match(/\b(org|organization|company)\b/)) {
      filters.resourceType = 'Organization';
      interpretation += 'organization changes';
    } else if (lowerQuery.match(/\b(api|config|configuration|setting)\b/)) {
      filters.resourceType = 'ApiConfiguration';
      interpretation += 'API configuration changes';
    } else if (lowerQuery.match(/\b(permission|role|access)\b/)) {
      filters.resourceType = 'UserOrganization';
      interpretation += 'permission changes';
    }

    // Detect action
    if (lowerQuery.match(/\b(modified|changed|updated|edited)\b/)) {
      filters.action = ['pfa:update', 'update'];
      interpretation += ', modifications';
    } else if (lowerQuery.match(/\b(suspended|disabled|deactivated)\b/)) {
      filters.action = ['user:suspend', 'suspend'];
      interpretation += ', suspensions';
    } else if (lowerQuery.match(/\b(created|added|new)\b/)) {
      filters.action = ['create', 'pfa:create', 'user:create'];
      interpretation += ', creations';
    } else if (lowerQuery.match(/\b(deleted|removed)\b/)) {
      filters.action = ['delete', 'pfa:delete'];
      interpretation += ', deletions';
    } else if (lowerQuery.match(/\b(permission|granted|revoked)\b/)) {
      filters.action = ['permission:grant', 'permission:revoke'];
      interpretation += ', permission changes';
    } else if (lowerQuery.match(/\b(login|logged in)\b/)) {
      filters.action = ['login'];
      interpretation += ', logins';
    } else if (lowerQuery.match(/\b(logout|logged out)\b/)) {
      filters.action = ['logout'];
      interpretation += ', logouts';
    }

    // Detect time range
    const now = new Date();
    if (lowerQuery.match(/\b(today)\b/)) {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      filters.timeRange = {
        start: todayStart.toISOString(),
        end: todayEnd.toISOString(),
      };
      interpretation += ' today';
    } else if (lowerQuery.match(/\b(yesterday)\b/)) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(23, 59, 59, 999);
      filters.timeRange = {
        start: yesterday.toISOString(),
        end: yesterdayEnd.toISOString(),
      };
      interpretation += ' yesterday';
    } else if (lowerQuery.match(/\b(last\s*week|past\s*week)\b/)) {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filters.timeRange = {
        start: weekAgo.toISOString(),
        end: now.toISOString(),
      };
      interpretation += ' in the last week';
    } else if (lowerQuery.match(/\b(last\s*month|past\s*month)\b/)) {
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      filters.timeRange = {
        start: monthAgo.toISOString(),
        end: now.toISOString(),
      };
      interpretation += ' in the last month';
    }

    // Detect categories
    if (lowerQuery.match(/\b(crane|cranes)\b/)) {
      filters.category = ['Cranes', 'CRANES', 'crane'];
      interpretation += ', crane category';
    } else if (lowerQuery.match(/\b(generator|generators)\b/)) {
      filters.category = ['Generators', 'GENERATORS', 'generator'];
      interpretation += ', generator category';
    }

    // Detect changed fields
    if (lowerQuery.match(/\b(duration|days)\b/)) {
      filters.changedFields = ['forecastStart', 'forecastEnd', 'actualStart', 'actualEnd'];
      interpretation += ', duration fields';
    } else if (lowerQuery.match(/\b(cost|price|rate)\b/)) {
      filters.changedFields = ['monthlyRate', 'purchasePrice'];
      interpretation += ', cost fields';
    }

    // Handle context references ("they", "them")
    if (previousContext && lowerQuery.match(/\b(they|them|those|it)\b/)) {
      const previousUserIds = [...new Set(previousContext.results.map(r => r.userId))];
      if (previousUserIds.length > 0) {
        filters.userId = previousUserIds;
        interpretation += `, referring to ${previousUserIds.length} users from previous query`;
      }
    }

    filters.booleanOperator = 'AND';

    return {
      filters,
      confidence: Object.keys(filters).length > 2 ? 0.7 : 0.5,
      interpretation: interpretation || 'General audit log search',
    };
  }

  // ============================================================================
  // Database Query Execution
  // ============================================================================

  /**
   * Execute parsed query against database
   */
  private async executeQuery(
    parsedQuery: ParsedQuery,
    organizationId: string
  ): Promise<{ auditLogs: AuditLogResult[]; totalCount: number }> {
    const { filters } = parsedQuery;

    // Build where clause
    const where: any = {};

    // Organization filter (optional - some logs may be global)
    if (organizationId) {
      where.OR = [
        { organizationId },
        { organizationId: null }, // Include global logs
      ];
    }

    if (filters.resourceType) {
      where.resource = filters.resourceType;
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
        lte: new Date(filters.timeRange.end),
      };
    }

    // Note: changedFields and category would require JSON filtering
    // which depends on your database's JSON support

    try {
      const [auditLogs, totalCount] = await Promise.all([
        this.prisma.audit_logs.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: 100,
        }),
        this.prisma.audit_logs.count({ where }),
      ]);

      // Fetch user information separately
      const userIds = [...new Set(auditLogs.map(l => l.userId))];
      const users = await this.prisma.users.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, email: true },
      });
      const userMap = new Map(users.map(u => [u.id, u]));

      return {
        auditLogs: auditLogs.map(log => ({
          id: log.id,
          userId: log.userId,
          organizationId: log.organizationId,
          action: log.action,
          resource: log.resource,
          method: log.method,
          metadata: log.metadata,
          success: log.success,
          errorMessage: log.errorMessage,
          timestamp: log.timestamp,
          user: userMap.get(log.userId) || undefined,
        })),
        totalCount,
      };
    } catch (error) {
      logger.error('[SemanticAuditSearch] Database query failed', { error, where });
      return { auditLogs: [], totalCount: 0 };
    }
  }

  // ============================================================================
  // External Event Correlation
  // ============================================================================

  /**
   * Correlate audit logs with external events (weather, milestones)
   */
  private async correlateExternalEvents(
    parsedQuery: ParsedQuery,
    auditLogs: AuditLogResult[]
  ): Promise<ExternalEvent[]> {
    const relatedEvents: ExternalEvent[] = [];

    if (!parsedQuery.filters.timeRange || auditLogs.length === 0) {
      return relatedEvents;
    }

    const { start, end } = parsedQuery.filters.timeRange;
    const startDate = new Date(start);
    const endDate = new Date(end);

    // Example weather events (in production, query weather API)
    const weatherEvents: ExternalEvent[] = [
      {
        type: 'weather_event',
        date: '2025-11-22',
        description: 'Heavy rain (3 inches), wind gusts 45 mph',
        relevance: 0.9,
      },
      {
        type: 'weather_event',
        date: '2025-11-25',
        description: 'Temperature drop to 28°F, frost advisory',
        relevance: 0.7,
      },
    ];

    // Example project milestones (in production, query project management system)
    const milestones: ExternalEvent[] = [
      {
        type: 'project_milestone',
        date: '2025-11-20',
        description: 'Silo 4 foundation pour completed',
        relevance: 0.8,
      },
      {
        type: 'project_milestone',
        date: '2025-11-26',
        description: 'Quarterly equipment review deadline',
        relevance: 0.85,
      },
    ];

    // Filter events within query time range
    [...weatherEvents, ...milestones].forEach(event => {
      const eventDate = new Date(event.date);
      if (eventDate >= startDate && eventDate <= endDate) {
        relatedEvents.push(event);
      }
    });

    // Sort by relevance
    relatedEvents.sort((a, b) => b.relevance - a.relevance);

    return relatedEvents.slice(0, 5); // Return top 5 most relevant
  }

  // ============================================================================
  // Summary and Insight Generation
  // ============================================================================

  /**
   * Generate natural language summary of results
   */
  private async generateSummary(
    _query: string,
    auditLogs: AuditLogResult[],
    parsedQuery: ParsedQuery
  ): Promise<string> {
    if (auditLogs.length === 0) {
      return 'No audit logs found matching your query.';
    }

    // Group by user
    const userCounts: Record<string, { count: number; username: string }> = {};
    auditLogs.forEach(log => {
      const userId = log.userId;
      const username = log.user?.username || userId;
      if (!userCounts[userId]) {
        userCounts[userId] = { count: 0, username };
      }
      userCounts[userId].count++;
    });

    // Find top user
    const topUsers = Object.entries(userCounts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 3);

    // Group by action
    const actionCounts: Record<string, number> = {};
    auditLogs.forEach(log => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    });

    const topAction = Object.entries(actionCounts)
      .sort(([, a], [, b]) => b - a)[0];

    // Build summary
    let summary = '';

    if (topUsers.length === 1) {
      summary = `${topUsers[0][1].username} made ${topUsers[0][1].count} ${topAction?.[0] || 'action'}${topUsers[0][1].count !== 1 ? 's' : ''}.`;
    } else if (topUsers.length > 1) {
      const userList = topUsers.map(([, data]) => `${data.username} (${data.count})`).join(', ');
      summary = `Top users: ${userList}. ${auditLogs.length} total audit logs found.`;
    } else {
      summary = `${auditLogs.length} audit logs found matching your query.`;
    }

    if (parsedQuery.interpretation) {
      summary += ` Searching for: ${parsedQuery.interpretation}.`;
    }

    return summary;
  }

  /**
   * Generate AI insight based on results and external events
   */
  private async generateInsight(
    auditLogs: AuditLogResult[],
    relatedEvents: ExternalEvent[],
    _parsedQuery: ParsedQuery
  ): Promise<string> {
    if (auditLogs.length === 0) {
      return '';
    }

    // Check for weather correlation
    const weatherEvent = relatedEvents.find(e => e.type === 'weather_event');
    if (weatherEvent && weatherEvent.relevance >= 0.7) {
      return `These changes may correlate with ${weatherEvent.description} on ${weatherEvent.date}. Weather events often cause equipment schedule adjustments.`;
    }

    // Check for milestone correlation
    const milestone = relatedEvents.find(e => e.type === 'project_milestone');
    if (milestone && milestone.relevance >= 0.7) {
      return `These changes may be related to: "${milestone.description}" (${milestone.date}).`;
    }

    // Generate basic pattern insight
    if (auditLogs.length >= 10) {
      // Check if most changes happened in a short window
      const timestamps = auditLogs.map(l => new Date(l.timestamp).getTime()).sort((a, b) => a - b);
      const timeSpan = (timestamps[timestamps.length - 1] - timestamps[0]) / (1000 * 60 * 60); // hours

      if (timeSpan < 2 && auditLogs.length >= 10) {
        return `${auditLogs.length} changes occurred within a ${Math.round(timeSpan * 60)} minute window. This may indicate a bulk operation or urgent adjustment.`;
      }
    }

    return '';
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Check if query is too ambiguous to process
   */
  private isQueryAmbiguous(query: string): boolean {
    const trimmed = query.trim().toLowerCase();
    const vagueQueries = [
      'show me',
      'changes',
      'stuff',
      'things',
      'everything',
      'all',
      'help',
      'what',
    ];

    // Check if query is just a vague word
    if (vagueQueries.includes(trimmed)) {
      return true;
    }

    // Check if query is too short
    if (trimmed.length < 5) {
      return true;
    }

    return false;
  }

  /**
   * Generate unique query ID for multi-turn context
   */
  private generateQueryId(): string {
    return `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Build cache key for parsed query
   */
  private buildCacheKey(query: string, contextId?: string): string {
    return `${query.toLowerCase().trim()}:${contextId || 'no-context'}`;
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Get cache statistics
   */
  getCacheStats(): { queryCache: number } {
    return {
      queryCache: this.queryCache.size,
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.queryCache.clear();
    logger.info('[SemanticAuditSearchService] Cache cleared');
  }
}

// Export singleton instance
export const semanticAuditSearchService = new SemanticAuditSearchService();
