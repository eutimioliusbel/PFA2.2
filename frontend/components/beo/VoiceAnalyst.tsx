/**
 * Voice Analyst Component
 *
 * Phase 8, Task 8.1 of ADR-005 Multi-Tenant Access Control
 * UC-21: Boardroom Voice Analyst
 *
 * Features:
 * - Natural language portfolio queries (text input)
 * - Executive persona detection (CFO vs. COO responses)
 * - Follow-up question context preservation
 * - Voice-optimized output (TTS-ready)
 * - Recent queries sidebar
 * - Response confidence indicator
 *
 * Theme: Dark slate (consistent with app)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Mic,
  Send,
  MessageSquare,
  Clock,
  History,
  ChevronRight,
  Loader2,
  Volume2,
  VolumeX,
  RefreshCw,
  Sparkles,
  Building2,
  BarChart3,
  X,
} from 'lucide-react';

const API_BASE_URL =
  (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ||
  'http://localhost:3001';

// ============================================================================
// Types
// ============================================================================

interface PortfolioQueryResponse {
  queryId: string;
  response: string;
  voiceResponse?: string;
  confidence: number;
  queryType: string;
  data?: Record<string, unknown>;
  metadata: {
    organizationsAnalyzed: number;
    recordsAnalyzed: number;
    userPersona?: string;
    modelUsed: string;
    latencyMs: number;
    cached: boolean;
  };
}

interface RecentQuery {
  id: string;
  query: string;
  queryType: string;
  timestamp: Date;
  preview: string;
}

interface VoiceAnalystProps {
  onClose?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const VoiceAnalyst: React.FC<VoiceAnalystProps> = ({ onClose }) => {
  // State
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<PortfolioQueryResponse | null>(null);
  const [recentQueries, setRecentQueries] = useState<RecentQuery[]>([]);
  const [contextQueryId, setContextQueryId] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showRecentQueries, setShowRecentQueries] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseFormat, setResponseFormat] = useState<'conversational' | 'structured'>('conversational');

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Fetch recent queries on mount
  useEffect(() => {
    fetchRecentQueries();
  }, []);

  const fetchRecentQueries = async () => {
    try {
      const token = localStorage.getItem('pfa_auth_token');
      const res = await fetch(`${API_BASE_URL}/api/beo/recent-queries`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setRecentQueries(data.queries || []);
      }
    } catch (err) {
      console.error('Failed to fetch recent queries:', err);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    stopSpeaking();

    try {
      const token = localStorage.getItem('pfa_auth_token');
      const res = await fetch(`${API_BASE_URL}/api/beo/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: query.trim(),
          responseFormat,
          contextQueryId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Query failed');
      }

      const data: PortfolioQueryResponse = await res.json();
      setResponse(data);
      setContextQueryId(data.queryId);

      // Add to recent queries
      setRecentQueries(prev => [{
        id: data.queryId,
        query: query.trim(),
        queryType: data.queryType,
        timestamp: new Date(),
        preview: data.response.substring(0, 100) + '...',
      }, ...prev.slice(0, 9)]);

      setQuery('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process query');
    } finally {
      setIsLoading(false);
    }
  }, [query, responseFormat, contextQueryId, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const speakResponse = useCallback(() => {
    if (!response?.voiceResponse && !response?.response) return;

    stopSpeaking();

    const text = response.voiceResponse || response.response;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    speechSynthesisRef.current = utterance;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [response]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const handleRecentQueryClick = (recent: RecentQuery) => {
    setQuery(recent.query);
    setShowRecentQueries(false);
    inputRef.current?.focus();
  };

  const startNewConversation = () => {
    setContextQueryId(null);
    setResponse(null);
    setQuery('');
    inputRef.current?.focus();
  };

  const getQueryTypeIcon = (queryType: string) => {
    switch (queryType) {
      case 'budget_variance':
        return <BarChart3 className="w-4 h-4" />;
      case 'schedule_analysis':
        return <Clock className="w-4 h-4" />;
      case 'equipment_status':
        return <Building2 className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-emerald-400';
    if (confidence >= 0.6) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="flex h-full bg-slate-900 text-white">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Boardroom Voice Analyst</h1>
              <p className="text-xs text-slate-400">Natural language portfolio intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRecentQueries(!showRecentQueries)}
              className={`p-2 rounded-lg transition-colors ${
                showRecentQueries ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-400'
              }`}
              title="Recent Queries"
            >
              <History className="w-5 h-5" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Response Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {!response && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="p-4 bg-slate-800 rounded-full mb-4">
                <Sparkles className="w-8 h-8 text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Ask About Your Portfolio</h2>
              <p className="text-slate-400 max-w-md mb-6">
                Ask questions in natural language about budget variances, schedule delays,
                equipment status, or vendor rates across all your organizations.
              </p>

              {/* Suggested Questions */}
              <div className="space-y-2 w-full max-w-lg">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Try asking:</p>
                {[
                  'Which projects are over budget this quarter?',
                  "What's our total equipment spend variance?",
                  'Show me schedule delays across all sites',
                  'Which vendors have the highest rates?',
                ].map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuery(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="w-full text-left px-4 py-3 bg-slate-800 hover:bg-slate-750 rounded-lg text-sm text-slate-300 transition-colors flex items-center gap-2"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-4" />
              <p className="text-slate-400">Analyzing portfolio data...</p>
            </div>
          )}

          {response && !isLoading && (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Response Card */}
              <div className="bg-slate-800 rounded-xl p-6">
                {/* Response Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {getQueryTypeIcon(response.queryType)}
                    <span className="text-sm text-slate-400 capitalize">
                      {response.queryType.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs ${getConfidenceColor(response.confidence)}`}>
                      {Math.round(response.confidence * 100)}% confidence
                    </span>
                    <button
                      onClick={isSpeaking ? stopSpeaking : speakResponse}
                      className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                      title={isSpeaking ? 'Stop speaking' : 'Read aloud'}
                    >
                      {isSpeaking ? (
                        <VolumeX className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Response Text */}
                <div className="prose prose-invert prose-sm max-w-none">
                  <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {response.response}
                  </p>
                </div>

                {/* Metadata */}
                <div className="mt-4 pt-4 border-t border-slate-700 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {response.metadata.organizationsAnalyzed} orgs analyzed
                  </span>
                  <span className="flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" />
                    {response.metadata.recordsAnalyzed} records
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {response.metadata.latencyMs}ms
                  </span>
                  {response.metadata.cached && (
                    <span className="text-emerald-400">Cached</span>
                  )}
                  {response.metadata.userPersona && (
                    <span className="text-blue-400">
                      Tailored for {response.metadata.userPersona}
                    </span>
                  )}
                </div>
              </div>

              {/* Follow-up Indicator */}
              {contextQueryId && (
                <div className="flex items-center justify-between px-4 py-2 bg-slate-800/50 rounded-lg">
                  <span className="text-xs text-slate-400">
                    Continue the conversation with follow-up questions
                  </span>
                  <button
                    onClick={startNewConversation}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    New conversation
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="max-w-lg mx-auto bg-red-900/30 border border-red-800 rounded-lg p-4 text-center">
              <p className="text-red-300">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-2 text-sm text-red-400 hover:text-red-300"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="px-6 py-4 border-t border-slate-700 bg-slate-900">
          <div className="max-w-3xl mx-auto">
            {/* Format Toggle */}
            <div className="flex items-center gap-4 mb-3">
              <span className="text-xs text-slate-500">Response format:</span>
              <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
                <button
                  onClick={() => setResponseFormat('conversational')}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    responseFormat === 'conversational'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Conversational
                </button>
                <button
                  onClick={() => setResponseFormat('structured')}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    responseFormat === 'structured'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Structured
                </button>
              </div>
            </div>

            {/* Input */}
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your portfolio..."
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-500"
                  rows={1}
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={!query.trim() || isLoading}
                className="p-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-xl transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>

            <p className="text-xs text-slate-600 mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>

      {/* Recent Queries Sidebar */}
      {showRecentQueries && (
        <div className="w-72 border-l border-slate-700 flex flex-col bg-slate-850">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-medium">Recent Queries</h3>
            <button
              onClick={fetchRecentQueries}
              className="p-1 hover:bg-slate-800 rounded"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {recentQueries.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-sm">
                No recent queries
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {recentQueries.map((recent) => (
                  <button
                    key={recent.id}
                    onClick={() => handleRecentQueryClick(recent)}
                    className="w-full text-left p-3 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {getQueryTypeIcon(recent.queryType)}
                      <span className="text-xs text-slate-500 capitalize">
                        {recent.queryType.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 line-clamp-2">
                      {recent.query}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      {new Date(recent.timestamp).toLocaleTimeString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceAnalyst;
