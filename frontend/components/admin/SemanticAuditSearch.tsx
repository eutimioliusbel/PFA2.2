// components/admin/SemanticAuditSearch.tsx
/**
 * Semantic Audit Search Component
 *
 * Phase 7, Task 7.3 of ADR-005 Multi-Tenant Access Control
 * AI Use Case 18: Natural Language Audit Log Queries
 *
 * Provides a natural language interface for searching audit logs.
 * Supports multi-turn queries with context preservation.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  Search,
  MessageSquare,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  ChevronDown,
  Loader2,
  RefreshCw,
  Info,
  CloudRain,
  Flag,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../services/apiClient';

// ============================================================================
// Types
// ============================================================================

interface ParsedFilters {
  resourceType?: string;
  action?: string[];
  userId?: string[];
  timeRange?: { start: string; end: string };
  changedFields?: string[];
  category?: string[];
  booleanOperator?: 'AND' | 'OR';
}

interface ParsedQuery {
  filters: ParsedFilters;
  confidence: number;
  interpretation: string;
}

interface AuditLogResult {
  id: string;
  userId: string;
  organizationId: string | null;
  action: string;
  resource: string | null;
  method: string | null;
  metadata: any;
  success: boolean;
  errorMessage: string | null;
  timestamp: string;
  user?: {
    id: string;
    username: string;
    email: string | null;
  };
}

interface ExternalEvent {
  type: 'weather_event' | 'project_milestone' | 'system_event';
  date: string;
  description: string;
  relevance: number;
}

interface SearchResult {
  queryId: string;
  parsedQuery: ParsedQuery;
  naturalLanguageSummary: string;
  auditLogs: AuditLogResult[];
  relatedEvents: ExternalEvent[];
  aiInsight: string;
  confidence: number;
  clarificationNeeded: boolean;
  suggestions?: string[];
  totalCount: number;
  cached: boolean;
}

interface QueryHistoryItem {
  query: string;
  queryId: string;
  timestamp: Date;
  resultCount: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getActionBadgeColor = (action: string): string => {
  if (action.includes('update') || action.includes('modify')) {
    return 'bg-blue-500/20 text-blue-400';
  }
  if (action.includes('create') || action.includes('add')) {
    return 'bg-green-500/20 text-green-400';
  }
  if (action.includes('delete') || action.includes('remove')) {
    return 'bg-red-500/20 text-red-400';
  }
  if (action.includes('permission') || action.includes('grant')) {
    return 'bg-purple-500/20 text-purple-400';
  }
  if (action.includes('login') || action.includes('logout')) {
    return 'bg-yellow-500/20 text-yellow-400';
  }
  return 'bg-slate-700 text-slate-300';
};

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getEventIcon = (type: string) => {
  switch (type) {
    case 'weather_event':
      return CloudRain;
    case 'project_milestone':
      return Flag;
    default:
      return Info;
  }
};

// ============================================================================
// Component
// ============================================================================

export const SemanticAuditSearch: React.FC = () => {
  const { user: _user, currentOrganizationId } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Current context ID for multi-turn queries
  const contextIdRef = useRef<string | null>(null);

  /**
   * Execute semantic search
   */
  const handleSearch = useCallback(async (searchQuery?: string, contextId?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<SearchResult>('/api/audit/semantic-search', {
        query: q,
        organizationId: currentOrganizationId,
        contextId: contextId || contextIdRef.current,
      });

      setResults(response);
      contextIdRef.current = response.queryId;

      // Add to history
      setQueryHistory(prev => [
        {
          query: q,
          queryId: response.queryId,
          timestamp: new Date(),
          resultCount: response.totalCount,
        },
        ...prev.slice(0, 9), // Keep last 10
      ]);
    } catch (err: any) {
      setError(err.message || 'Failed to execute search');
      console.error('Semantic search error:', err);
    } finally {
      setLoading(false);
    }
  }, [query, currentOrganizationId]);

  /**
   * Handle follow-up query
   */
  const handleFollowUp = useCallback((followUpQuery: string) => {
    setQuery(followUpQuery);
    handleSearch(followUpQuery, contextIdRef.current || undefined);
  }, [handleSearch]);

  /**
   * Clear search and start fresh
   */
  const handleClear = useCallback(() => {
    setQuery('');
    setResults(null);
    setError(null);
    contextIdRef.current = null;
    inputRef.current?.focus();
  }, []);

  /**
   * Use suggestion as query
   */
  const handleSuggestion = useCallback((suggestion: string) => {
    setQuery(suggestion);
    inputRef.current?.focus();
  }, []);

  /**
   * Toggle log details
   */
  const toggleLogDetails = useCallback((logId: string) => {
    setExpandedLogId(prev => prev === logId ? null : logId);
  }, []);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700 bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-violet-400" />
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Semantic Audit Search</h2>
              <p className="text-sm text-slate-400">Search audit logs using natural language</p>
            </div>
          </div>

          {queryHistory.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
            >
              <Clock className="w-4 h-4" />
              History
              {showHistory ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* History dropdown */}
        {showHistory && queryHistory.length > 0 && (
          <div className="mt-3 bg-slate-900 rounded border border-slate-600 max-h-48 overflow-y-auto">
            {queryHistory.map((item, index) => (
              <button
                key={index}
                onClick={() => handleSearch(item.query, item.queryId)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 border-b border-slate-700 last:border-0"
              >
                <p className="text-slate-100 truncate">{item.query}</p>
                <p className="text-xs text-slate-400">
                  {item.resultCount} results - {formatTimestamp(item.timestamp.toISOString())}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search Input */}
      <div className="px-6 py-4 border-b border-slate-700">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ask a question... (e.g., Who modified crane duration last week?)"
              className="w-full pl-10 pr-4 py-2 border border-slate-600 rounded-lg bg-slate-900 text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={loading || !query.trim()}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            Search
          </button>
          {(results || query) && (
            <button
              onClick={handleClear}
              className="px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Example queries */}
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            'Who modified PFA records yesterday?',
            'Show me permission changes last week',
            'Login activity today',
          ].map((example, index) => (
            <button
              key={index}
              onClick={() => handleSuggestion(example)}
              className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="px-6 py-4 bg-red-500/20 border-b border-red-500/40">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="divide-y divide-slate-700">
          {/* Clarification Needed */}
          {results.clarificationNeeded && (
            <div className="px-6 py-4 bg-yellow-500/10">
              <div className="flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-300">
                    Could you be more specific?
                  </p>
                  {results.suggestions && results.suggestions.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {results.suggestions.map((suggestion, index) => (
                        <li key={index} className="text-sm text-yellow-400">
                          - {suggestion}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          {results.naturalLanguageSummary && !results.clarificationNeeded && (
            <div className="px-6 py-4 bg-violet-500/10">
              <div className="flex items-start gap-3">
                <MessageSquare className="w-5 h-5 text-violet-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-violet-200">
                    {results.naturalLanguageSummary}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-violet-400">
                    <span>Confidence: {Math.round(results.confidence * 100)}%</span>
                    {results.cached && <span className="px-1.5 py-0.5 bg-violet-500/20 rounded">Cached</span>}
                    <span>{results.totalCount} total results</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Insight */}
          {results.aiInsight && (
            <div className="px-6 py-3 bg-blue-500/10 border-b border-blue-500/20">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-400" />
                <p className="text-sm text-blue-300">{results.aiInsight}</p>
              </div>
            </div>
          )}

          {/* Related Events */}
          {results.relatedEvents.length > 0 && (
            <div className="px-6 py-3 bg-slate-900 border-b border-slate-700">
              <p className="text-xs font-medium text-slate-400 uppercase mb-2">Related Events</p>
              <div className="flex flex-wrap gap-2">
                {results.relatedEvents.map((event, index) => {
                  const Icon = getEventIcon(event.type);
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-2 py-1 bg-slate-800 rounded border border-slate-600 text-xs"
                    >
                      <Icon className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-300">{event.description}</span>
                      <span className="text-slate-500">{event.date}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Parsed Query Debug */}
          {results.parsedQuery.interpretation && (
            <div className="px-6 py-2 bg-slate-900 border-b border-slate-700">
              <p className="text-xs text-slate-400">
                <span className="font-medium">Interpreted as:</span> {results.parsedQuery.interpretation}
              </p>
            </div>
          )}

          {/* Audit Logs */}
          <div className="max-h-96 overflow-y-auto">
            {results.auditLogs.length === 0 && !results.clarificationNeeded ? (
              <div className="px-6 py-8 text-center text-slate-400">
                <Search className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p>No audit logs found matching your query.</p>
              </div>
            ) : (
              results.auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="border-b border-slate-700 last:border-0 hover:bg-slate-700/50"
                >
                  {/* Log Header */}
                  <button
                    onClick={() => toggleLogDetails(log.id)}
                    className="w-full px-6 py-3 text-left flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {log.success ? (
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionBadgeColor(log.action)}`}>
                            {log.action}
                          </span>
                          {log.resource && (
                            <span className="text-xs text-slate-400">{log.resource}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                          <User className="w-3 h-3" />
                          <span>{log.user?.username || log.userId}</span>
                          <span className="text-slate-600">|</span>
                          <Clock className="w-3 h-3" />
                          <span>{formatTimestamp(log.timestamp)}</span>
                        </div>
                      </div>
                    </div>

                    {expandedLogId === log.id ? (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    )}
                  </button>

                  {/* Log Details (Expanded) */}
                  {expandedLogId === log.id && (
                    <div className="px-6 pb-4 space-y-2">
                      <div className="bg-slate-900 rounded p-3 text-xs">
                        <p className="font-medium text-slate-300 mb-2">Details</p>
                        <div className="grid grid-cols-2 gap-2 text-slate-400">
                          <div>
                            <span className="text-slate-500">User ID:</span>
                            <span className="ml-1 font-mono">{log.userId}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Organization:</span>
                            <span className="ml-1">{log.organizationId || 'Global'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Method:</span>
                            <span className="ml-1">{log.method || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Success:</span>
                            <span className="ml-1">{log.success ? 'Yes' : 'No'}</span>
                          </div>
                        </div>

                        {log.errorMessage && (
                          <div className="mt-2 text-red-400">
                            <span className="text-slate-500">Error:</span>
                            <span className="ml-1">{log.errorMessage}</span>
                          </div>
                        )}

                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div className="mt-2">
                            <span className="text-slate-500">Metadata:</span>
                            <pre className="mt-1 bg-slate-800 p-2 rounded overflow-x-auto text-xs text-slate-300">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Follow-up Query Suggestions */}
          {results.auditLogs.length > 0 && !results.clarificationNeeded && (
            <div className="px-6 py-4 bg-slate-900 border-t border-slate-700">
              <p className="text-xs font-medium text-slate-400 uppercase mb-2">Follow-up Questions</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleFollowUp('Why did they do it?')}
                  className="text-xs px-3 py-1.5 bg-slate-800 text-violet-400 border border-violet-500/40 rounded-full hover:bg-violet-500/20"
                >
                  Why did they do it?
                </button>
                <button
                  onClick={() => handleFollowUp('What else did they change?')}
                  className="text-xs px-3 py-1.5 bg-slate-800 text-violet-400 border border-violet-500/40 rounded-full hover:bg-violet-500/20"
                >
                  What else did they change?
                </button>
                <button
                  onClick={() => handleFollowUp('Show me their other activity')}
                  className="text-xs px-3 py-1.5 bg-slate-800 text-violet-400 border border-violet-500/40 rounded-full hover:bg-violet-500/20"
                >
                  Show me their other activity
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!results && !loading && !error && (
        <div className="px-6 py-12 text-center">
          <Search className="w-12 h-12 mx-auto mb-4 text-slate-600" />
          <p className="text-slate-400">
            Ask a question about audit logs in natural language.
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Examples: "Who modified crane records last week?" or "Show me permission changes yesterday"
          </p>
        </div>
      )}
    </div>
  );
};

export default SemanticAuditSearch;
