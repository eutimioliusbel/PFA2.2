import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient';
import { Search, RefreshCw, Database, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import type { SyncLog, SyncStats } from '../../types';

interface SyncLogsViewProps {
  organizationId?: string;
}

export const SyncLogsView: React.FC<SyncLogsViewProps> = ({ organizationId }) => {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const [logsData, statsData] = await Promise.all([
        apiClient.getSyncLogs(organizationId),
        apiClient.getSyncStats(organizationId),
      ]);
      setLogs(logsData.logs);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching sync logs:', error);
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
      log.syncType.toLowerCase().includes(search) ||
      log.status.toLowerCase().includes(search) ||
      log.organizationId.toLowerCase().includes(search) ||
      (log.triggeredBy && log.triggeredBy.toLowerCase().includes(search))
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'success':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
            Success
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
            Error
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
            In Progress
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header with Stats */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              Data Sync Logs
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Track data synchronization operations and performance
            </p>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                <Database className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Total Syncs</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.totalSyncs.toLocaleString()}
              </p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-800">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Success Rate</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.successRate.toFixed(1)}%
              </p>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-100 dark:border-purple-800">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Records Processed</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.totalRecordsProcessed.toLocaleString()}
              </p>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-100 dark:border-orange-800">
              <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Avg Duration</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {(stats.averageDuration / 1000).toFixed(1)}s
              </p>
            </div>
          </div>
        )}

        {/* Additional Stats Row */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-teal-50 dark:bg-teal-900/20 p-3 rounded-lg border border-teal-100 dark:border-teal-800">
              <div className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase mb-1">
                Records Inserted
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {stats.totalRecordsInserted.toLocaleString()}
              </p>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800">
              <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase mb-1">
                Records Updated
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {stats.totalRecordsUpdated.toLocaleString()}
              </p>
            </div>

            <div className="bg-pink-50 dark:bg-pink-900/20 p-3 rounded-lg border border-pink-100 dark:border-pink-800">
              <div className="text-xs font-semibold text-pink-600 dark:text-pink-400 uppercase mb-1">
                Records Deleted
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {stats.totalRecordsDeleted.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="mt-6 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by sync type, status, organization, or triggered by..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <p className="text-lg font-medium">No logs found</p>
            <p className="text-sm">Try adjusting your search or refresh the data</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider min-w-[180px]">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">
                  Sync Type
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider min-w-[100px]">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider min-w-[100px]">
                  Processed
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider min-w-[100px]">
                  Inserted
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider min-w-[100px]">
                  Updated
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider min-w-[100px]">
                  Deleted
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider min-w-[100px]">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">
                  Triggered By
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <td className="px-6 py-4 text-gray-900 dark:text-gray-100 font-mono text-xs truncate">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-sm truncate">
                    {log.syncType}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getStatusBadge(log.status)}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-300 font-mono text-sm">
                    {log.recordsProcessed.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-300 font-mono text-sm">
                    {log.recordsInserted.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-300 font-mono text-sm">
                    {log.recordsUpdated.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-300 font-mono text-sm">
                    {log.recordsDeleted.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-300 font-mono text-sm">
                    {log.durationMs ? `${(log.durationMs / 1000).toFixed(2)}s` : '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-sm truncate">
                    {log.triggeredBy || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer with count */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredLogs.length} of {logs.length} log entries
        </p>
      </div>
    </div>
  );
};
