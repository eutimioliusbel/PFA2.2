/**
 * Sync Status Dashboard Component
 * ADR-007, Phase 5, Task 5.4
 *
 * Displays real-time sync job progress for Bronze ingestion + Silver transformation
 * Polls every 3 seconds to update active sync jobs automatically
 */

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Database,
  Clock,
  RotateCcw,
  X
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';

/**
 * Sync job status
 */
type SyncJobStatus = 'queued' | 'ingesting' | 'transforming' | 'completed' | 'failed';

/**
 * Sync job data structure
 */
interface SyncJob {
  syncBatchId: string;
  endpointName: string;
  organizationId: string;
  organizationName: string;
  status: SyncJobStatus;
  progress: {
    percentage: number;
    processed: number;
    total: number;
    inserted: number;
    updated: number;
    errors: number;
  };
  timing: {
    startedAt: string;
    completedAt?: string;
    duration: string;
  };
  error?: string;
}

/**
 * React Query hook for sync status (polls every 3 seconds)
 */
function useSyncStatus() {
  return useQuery({
    queryKey: ['sync-status'],
    queryFn: () => apiClient.getSyncDashboard(),
    refetchInterval: 3000, // Poll every 3 seconds
    refetchIntervalInBackground: false,
    staleTime: 2000 // Consider data stale after 2 seconds
  });
}

/**
 * Get status badge color
 */
function getStatusColor(status: SyncJobStatus): string {
  switch (status) {
    case 'queued':
      return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600';
    case 'ingesting':
      return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700';
    case 'transforming':
      return 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700';
    case 'completed':
      return 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700';
    case 'failed':
      return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-300';
  }
}

/**
 * Get status icon
 */
function getStatusIcon(status: SyncJobStatus) {
  switch (status) {
    case 'queued':
      return <Clock className="w-4 h-4" />;
    case 'ingesting':
      return <Loader2 className="w-4 h-4 animate-spin" />;
    case 'transforming':
      return <Loader2 className="w-4 h-4 animate-spin" />;
    case 'completed':
      return <CheckCircle className="w-4 h-4" />;
    case 'failed':
      return <XCircle className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
}

/**
 * Get status label
 */
function getStatusLabel(status: SyncJobStatus): string {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'ingesting':
      return 'Ingesting from PEMS';
    case 'transforming':
      return 'Transforming to Silver';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return 'Unknown';
  }
}

/**
 * Format date to readable string
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Format number with commas
 */
function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Progress bar component
 */
interface ProgressBarProps {
  percentage: number;
  status: SyncJobStatus;
}

function ProgressBar({ percentage, status }: ProgressBarProps) {
  const getBarColor = () => {
    if (status === 'failed') return 'bg-red-600 dark:bg-red-500';
    if (status === 'completed') return 'bg-green-600 dark:bg-green-500';
    return 'bg-blue-600 dark:bg-blue-500';
  };

  return (
    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
      <div
        className={`${getBarColor()} h-full rounded-full transition-all duration-300 ease-out`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

/**
 * Sync Job Card Component
 */
interface SyncJobCardProps {
  job: SyncJob;
  onRetry: (syncBatchId: string) => void;
  onCancel: (syncBatchId: string) => void;
  isRetrying: boolean;
  isCancelling: boolean;
}

function SyncJobCard({ job, onRetry, onCancel, isRetrying, isCancelling }: SyncJobCardProps) {
  const isActive = job.status === 'queued' || job.status === 'ingesting' || job.status === 'transforming';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 dark:text-white truncate">
            {job.endpointName}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
            {job.organizationName}
          </p>
        </div>
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${getStatusColor(job.status)}`}>
          {getStatusIcon(job.status)}
          {getStatusLabel(job.status)}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400">Progress</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {job.progress.percentage}%
          </span>
        </div>
        <ProgressBar percentage={job.progress.percentage} status={job.status} />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Processed
          </div>
          <div className="text-lg font-semibold text-slate-900 dark:text-white">
            {formatNumber(job.progress.processed)} / {formatNumber(job.progress.total)}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Inserted
          </div>
          <div className="text-lg font-semibold text-green-600 dark:text-green-400">
            {formatNumber(job.progress.inserted)}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Errors
          </div>
          <div className={`text-lg font-semibold ${job.progress.errors > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
            {formatNumber(job.progress.errors)}
          </div>
        </div>
      </div>

      {/* Timing */}
      <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <Clock className="w-4 h-4" />
          <span>{formatDate(job.timing.startedAt)}</span>
        </div>
        <div className="font-semibold text-slate-900 dark:text-white">
          {job.timing.duration}
        </div>
      </div>

      {/* Error Message */}
      {job.error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{job.error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        {job.status === 'failed' && (
          <button
            onClick={() => onRetry(job.syncBatchId)}
            disabled={isRetrying}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            Retry
          </button>
        )}
        {isActive && (
          <button
            onClick={() => onCancel(job.syncBatchId)}
            disabled={isCancelling}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Main Sync Status Dashboard Component
 */
export const SyncStatusDashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch, isFetching } = useSyncStatus();

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: (syncBatchId: string) => apiClient.retrySync(syncBatchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    }
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: (syncBatchId: string) => apiClient.cancelSync(syncBatchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    }
  });

  const handleRefresh = () => {
    refetch();
  };

  const handleRetry = (syncBatchId: string) => {
    retryMutation.mutate(syncBatchId);
  };

  const handleCancel = (syncBatchId: string) => {
    cancelMutation.mutate(syncBatchId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading sync status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            Failed to Load
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            {error instanceof Error ? error.message : 'An error occurred'}
          </p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const activeSyncs = data?.activeSyncs || [];
  const recentHistory = data?.recentHistory || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Sync Status Dashboard
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Monitor Bronze ingestion and Silver transformation jobs in real-time
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Active Syncs */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Active Syncs
          </h2>
          {activeSyncs.length > 0 && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-semibold rounded-full">
              {activeSyncs.length}
            </span>
          )}
        </div>

        {activeSyncs.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-12 text-center">
            <Database className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              No Active Syncs
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              All sync jobs have completed. Start a new sync from the API Connectivity page.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeSyncs.map((job) => (
              <SyncJobCard
                key={job.syncBatchId}
                job={job}
                onRetry={handleRetry}
                onCancel={handleCancel}
                isRetrying={retryMutation.isPending}
                isCancelling={cancelMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent History */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Recent History
          </h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            (Last 10 completed)
          </span>
        </div>

        {recentHistory.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-12 text-center">
            <Clock className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              No History
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              No completed sync jobs in the last 24 hours.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Endpoint
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Organization
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Records
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Errors
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Completed
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {recentHistory.map((job) => (
                    <tr
                      key={job.syncBatchId}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900 dark:text-white truncate max-w-xs">
                          {job.endpointName}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-xs">
                          {job.organizationName}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(job.status)}`}>
                          {getStatusIcon(job.status)}
                          {getStatusLabel(job.status)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {formatNumber(job.progress.total)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-sm font-semibold ${job.progress.errors > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                          {formatNumber(job.progress.errors)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {job.timing.duration}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {job.timing.completedAt ? formatDate(job.timing.completedAt) : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Auto-refresh indicator */}
      <div className="text-center text-sm text-slate-500 dark:text-slate-400">
        Auto-refreshing every 3 seconds
      </div>
    </div>
  );
};
