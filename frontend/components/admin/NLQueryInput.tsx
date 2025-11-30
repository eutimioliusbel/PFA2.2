// components/admin/NLQueryInput.tsx
/**
 * Natural Language Permission Query Input Component
 *
 * Phase 6, Task 6.4 of ADR-005 Multi-Tenant Access Control
 *
 * AI-powered natural language search for user permissions.
 * Features:
 * - Auto-complete query suggestions
 * - Real-time confidence score display
 * - Structured results with user/org details
 * - Query history
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, AlertCircle, CheckCircle, Info, Clock, TrendingUp } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

// ============================================================================
// Types
// ============================================================================

interface QueryResult {
  success: boolean;
  queryType: string;
  response: string;
  data: any;
  confidence: number;
  parsingMethod: 'llm' | 'regex' | 'fallback';
  structuredAnswer?: {
    users?: Array<{
      id: string;
      username: string;
      email?: string;
      permissions: string[];
      organizations: string[];
    }>;
    organizations?: Array<{
      id: string;
      code: string;
      name: string;
      userCount: number;
    }>;
    capabilities?: string[];
    summary?: string;
  };
  suggestedFollowUps?: string[];
  lowConfidenceWarning?: string;
}

interface QueryHistory {
  query: string;
  queryType: string;
  resultCount: number;
  timestamp: string;
}

// ============================================================================
// NL Query Input Component
// ============================================================================

export function NLQueryInput() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [history, setHistory] = useState<QueryHistory[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch suggestions on mount
  useEffect(() => {
    fetchSuggestions();
    fetchHistory();
  }, []);

  const fetchSuggestions = async () => {
    try {
      const response = await apiClient.get<{ suggestions: Array<{ category: string; queries: string[] }> }>('/api/ai/nl-query/suggestions');
      setSuggestions(response.suggestions || []);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await apiClient.get<{ history: QueryHistory[] }>('/api/ai/nl-query/history', { limit: '5' });
      setHistory(response.history || []);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!query.trim()) {
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await apiClient.post<QueryResult>('/api/ai/nl-query', { query });
      setResult(response);

      // Refresh history after successful query
      if (response.success) {
        fetchHistory();
      }
    } catch (error: any) {
      setResult({
        success: false,
        queryType: 'unknown',
        response: error.message || 'Failed to process query. Please try again.',
        data: null,
        confidence: 0,
        parsingMethod: 'fallback',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestedQuery: string) => {
    setQuery(suggestedQuery);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleHistoryClick = (historyItem: QueryHistory) => {
    setQuery(historyItem.query);
    handleSearch();
  };

  // Confidence badge color
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) {
      return { color: 'text-green-700 bg-green-50 border-green-200', label: 'High Confidence', icon: CheckCircle };
    } else if (confidence >= 0.7) {
      return { color: 'text-blue-700 bg-blue-50 border-blue-200', label: 'Good Confidence', icon: Info };
    } else if (confidence >= 0.5) {
      return { color: 'text-yellow-700 bg-yellow-50 border-yellow-200', label: 'Low Confidence', icon: AlertCircle };
    } else {
      return { color: 'text-red-700 bg-red-50 border-red-200', label: 'Very Low Confidence', icon: AlertCircle };
    }
  };

  const confidenceBadge = result ? getConfidenceBadge(result.confidence) : null;

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Natural Language Permission Search</h3>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder='Ask me: "Who can delete records in HOLNG?" or "What can john.doe do?"'
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Search
                  </>
                )}
              </button>
            </div>

            {/* Auto-complete Suggestions */}
            {showSuggestions && !result && !isLoading && (
              <div className="absolute z-10 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                <div className="p-2">
                  {suggestions.map((category, idx) => (
                    <div key={idx} className="mb-3 last:mb-0">
                      <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">
                        {category.category}
                      </div>
                      {category.queries.map((q: string, qIdx: number) => (
                        <button
                          key={qIdx}
                          type="button"
                          onClick={() => handleSuggestionClick(q)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded text-sm text-gray-700"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Info className="w-4 h-4" />
            <span>Powered by AI - Results may vary based on query clarity</span>
          </div>
        </form>
      </div>

      {/* Query Result */}
      {result && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
          {/* Confidence Badge */}
          {confidenceBadge && (
            <div className="flex items-center justify-between">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${confidenceBadge.color}`}>
                <confidenceBadge.icon className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {confidenceBadge.label} ({Math.round(result.confidence * 100)}%)
                </span>
              </div>

              <div className="text-xs text-gray-500">
                Parsing: {result.parsingMethod === 'llm' ? 'AI-Powered' : result.parsingMethod === 'regex' ? 'Pattern Matching' : 'Fallback'}
              </div>
            </div>
          )}

          {/* Low Confidence Warning */}
          {result.lowConfidenceWarning && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-800">Low Confidence Warning</p>
                  <p className="text-sm text-yellow-700 mt-1">{result.lowConfidenceWarning}</p>
                </div>
              </div>
            </div>
          )}

          {/* Response */}
          <div className="prose max-w-none">
            <div className="text-gray-700 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatMarkdown(result.response) }} />
          </div>

          {/* Structured Answer (if available) */}
          {result.structuredAnswer && (
            <div className="mt-4 border-t border-gray-200 pt-4">
              {result.structuredAnswer.summary && (
                <div className="text-sm font-medium text-gray-600 mb-3">
                  {result.structuredAnswer.summary}
                </div>
              )}

              {result.structuredAnswer.users && result.structuredAnswer.users.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700">Users</h4>
                  <div className="grid gap-2">
                    {result.structuredAnswer.users.map((user) => (
                      <div key={user.id} className="border border-gray-200 rounded p-3 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-gray-900">{user.username}</div>
                            {user.email && <div className="text-sm text-gray-500">{user.email}</div>}
                          </div>
                          <div className="text-xs text-gray-500">
                            {user.organizations.length} org{user.organizations.length !== 1 ? 's' : ''}
                          </div>
                        </div>

                        {user.organizations.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {user.organizations.map((org) => (
                              <span key={org} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                                {org}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Follow-up Suggestions */}
          {result.suggestedFollowUps && result.suggestedFollowUps.length > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Try these related queries:</div>
              <div className="flex flex-wrap gap-2">
                {result.suggestedFollowUps.map((followUp, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(followUp)}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg border border-gray-300"
                  >
                    {followUp}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Query History */}
      {history.length > 0 && !result && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-gray-400" />
            <h4 className="font-semibold text-gray-700">Recent Queries</h4>
          </div>

          <div className="space-y-2">
            {history.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleHistoryClick(item)}
                className="w-full text-left p-3 hover:bg-gray-50 rounded border border-gray-200 flex items-center justify-between group"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
                    {item.query}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {item.queryType} • {item.resultCount} results • {new Date(item.timestamp).toLocaleString()}
                  </div>
                </div>
                <TrendingUp className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to format markdown-like text
function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
    .replace(/\n/g, '<br/>'); // Line breaks
}
