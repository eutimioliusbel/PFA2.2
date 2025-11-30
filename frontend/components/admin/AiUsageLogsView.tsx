import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient';
import { Search, RefreshCw, TrendingUp, DollarSign, Clock, CheckCircle, Sparkles } from 'lucide-react';

interface AiUsageLog {
  id: string;
  userId: string;
  organizationId: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number | null;
  cached: boolean;
  success: boolean;
  errorMessage: string | null;
  queryHash: string | null;
  createdAt: string;
  user: {
    username: string;
    firstName: string | null;
    lastName: string | null;
  };
}

interface AiUsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageLatency: number;
  successRate: number;
}

interface AiUsageLogsViewProps {
  organizationId?: string;
}

export const AiUsageLogsView: React.FC<AiUsageLogsViewProps> = ({ organizationId }) => {
  const [logs, setLogs] = useState<AiUsageLog[]>([]);
  const [stats, setStats] = useState<AiUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const [logsData, statsData] = await Promise.all([
        apiClient.getAiUsageLogs(organizationId),
        apiClient.getAiUsageStats(organizationId),
      ]);
      setLogs(logsData.logs as unknown as AiUsageLog[]);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching AI usage logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [organizationId]);

  const filteredLogs = logs.filter((log) => {
    const search = searchTerm.toLowerCase();
    return (
      log.provider.toLowerCase().includes(search) ||
      log.model.toLowerCase().includes(search) ||
      log.user.username.toLowerCase().includes(search) ||
      log.organizationId.toLowerCase().includes(search)
    );
  });

  const formatUserName = (user: AiUsageLog['user']) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.username;
  };

  return (
    <div className="h-full flex flex-col bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header with Stats */}
      <div className="bg-slate-900 border-b border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <Sparkles className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                AI Usage Logs
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Track AI API usage, costs, and performance metrics
              </p>
            </div>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/30">
              <div className="flex items-center gap-2 text-blue-400 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Total Requests</span>
              </div>
              <p className="text-2xl font-bold text-slate-100">
                {stats.totalRequests.toLocaleString()}
              </p>
            </div>

            <div className="bg-violet-500/10 p-4 rounded-lg border border-violet-500/30">
              <div className="flex items-center gap-2 text-violet-400 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Total Tokens</span>
              </div>
              <p className="text-2xl font-bold text-slate-100">
                {stats.totalTokens.toLocaleString()}
              </p>
            </div>

            <div className="bg-green-500/10 p-4 rounded-lg border border-green-500/30">
              <div className="flex items-center gap-2 text-green-400 mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Total Cost</span>
              </div>
              <p className="text-2xl font-bold text-slate-100">
                ${stats.totalCost.toFixed(2)}
              </p>
            </div>

            <div className="bg-amber-500/10 p-4 rounded-lg border border-amber-500/30">
              <div className="flex items-center gap-2 text-amber-400 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Avg Latency</span>
              </div>
              <p className="text-2xl font-bold text-slate-100">
                {stats.averageLatency}ms
              </p>
            </div>

            <div className="bg-cyan-500/10 p-4 rounded-lg border border-cyan-500/30">
              <div className="flex items-center gap-2 text-cyan-400 mb-1">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Success Rate</span>
              </div>
              <p className="text-2xl font-bold text-slate-100">
                {stats.successRate.toFixed(1)}%
              </p>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="mt-6 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by provider, model, user, or organization..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-600 rounded-lg bg-slate-900 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 text-violet-400 animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Search className="w-12 h-12 mb-4 text-slate-600" />
            <p className="text-lg font-medium text-slate-300">No logs found</p>
            <p className="text-sm">Try adjusting your search or refresh the data</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-900 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider min-w-[180px]">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider min-w-[120px]">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider min-w-[120px]">
                  Provider
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider min-w-[150px]">
                  Model
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider min-w-[100px]">
                  Tokens
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider min-w-[100px]">
                  Cost
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider min-w-[100px]">
                  Latency
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider min-w-[80px]">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider min-w-[80px]">
                  Cached
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-800 divide-y divide-slate-700">
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-slate-700/50 transition-colors"
                >
                  <td className="px-6 py-4 text-slate-100 font-mono text-xs truncate">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-slate-300 text-sm truncate">
                    {formatUserName(log.user)}
                  </td>
                  <td className="px-6 py-4 text-slate-300 text-sm truncate">
                    {log.provider}
                  </td>
                  <td className="px-6 py-4 text-slate-300 text-sm truncate">
                    {log.model}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-300 font-mono text-sm">
                    {log.totalTokens.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-300 font-mono text-sm">
                    ${log.costUsd.toFixed(4)}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-300 font-mono text-sm">
                    {log.latencyMs ? `${log.latencyMs}ms` : '-'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {log.success ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                        Success
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                        Error
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {log.cached ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                        Yes
                      </span>
                    ) : (
                      <span className="text-slate-500 text-xs">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer with count */}
      <div className="bg-slate-900 border-t border-slate-700 px-6 py-3">
        <p className="text-sm text-slate-400">
          Showing {filteredLogs.length} of {logs.length} log entries
        </p>
      </div>
    </div>
  );
};
