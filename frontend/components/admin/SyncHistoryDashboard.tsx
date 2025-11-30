/**
 * SyncHistoryDashboard - View and manage sync job history
 * ADR-008 Phase 2 Track B - Task 2B.3
 *
 * Features:
 * - Filterable sync job list
 * - Real-time status updates via WebSocket
 * - Expandable job details with error logs
 * - Bulk conflict resolution
 * - Skeleton loading states
 */

import { useState, useEffect } from 'react';
import { ConflictResolutionModal } from '../ConflictResolutionModal';
import type {
  SyncJob,
  SyncJobStatus,
} from '../../mockData/syncMockData';

interface SyncHistoryDashboardProps {
  organizationId: string;
  onRefresh?: () => void;
}

interface FilterState {
  status: SyncJobStatus | 'all';
  dateFrom: string;
  dateTo: string;
}

function SyncJobCard({
  job,
  onExpand,
  isExpanded,
  onResolveConflict,
}: {
  job: SyncJob;
  onExpand: () => void;
  isExpanded: boolean;
  onResolveConflict: (jobId: string) => void;
}) {
  const statusColors: Record<SyncJobStatus, string> = {
    queued: 'bg-gray-100 text-gray-700 border-gray-300',
    syncing: 'bg-blue-100 text-blue-700 border-blue-300 animate-pulse',
    success: 'bg-green-100 text-green-700 border-green-300',
    conflict: 'bg-orange-100 text-orange-700 border-orange-300',
    failed: 'bg-red-100 text-red-700 border-red-300',
  };

  const statusIcons: Record<SyncJobStatus, string> = {
    queued: '⏳',
    syncing: '↻',
    success: '✓',
    conflict: '⚠️',
    failed: '✗',
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onExpand}
        className="w-full px-4 py-3 bg-white hover:bg-gray-50 text-left
                 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <span
              className={`px-3 py-1 rounded-md border text-sm font-medium ${
                statusColors[job.status]
              }`}
            >
              {statusIcons[job.status]} {job.status.toUpperCase()}
            </span>
            <div>
              <div className="font-medium text-gray-900">Job #{job.id}</div>
              <div className="text-sm text-gray-600">
                {job.userName} • {job.totalRecords} record
                {job.totalRecords !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {job.status === 'syncing' && (
              <div className="text-sm text-gray-600">
                <div className="mb-1">{job.progressPercent}% complete</div>
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${job.progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {job.conflicts.length > 0 && (
              <span className="text-sm font-medium text-orange-600">
                {job.conflicts.length} conflict{job.conflicts.length !== 1 ? 's' : ''}
              </span>
            )}

            <div className="text-sm text-gray-500">
              {new Date(job.startedAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </div>

            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 space-y-3">
          {/* Progress Details */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Synced</div>
              <div className="font-medium text-gray-900">
                {job.syncedRecords} / {job.totalRecords}
              </div>
            </div>
            <div>
              <div className="text-gray-600">Duration</div>
              <div className="font-medium text-gray-900">
                {job.completedAt
                  ? `${Math.round(
                      (new Date(job.completedAt).getTime() -
                        new Date(job.startedAt).getTime()) /
                        1000
                    )}s`
                  : 'In progress...'}
              </div>
            </div>
            <div>
              <div className="text-gray-600">Retries</div>
              <div className="font-medium text-gray-900">{job.retryCount}</div>
            </div>
          </div>

          {/* PFA IDs */}
          <div>
            <div className="text-sm text-gray-600 mb-1">PFA Records</div>
            <div className="flex flex-wrap gap-2">
              {job.pfaIds.map(pfaId => (
                <span
                  key={pfaId}
                  className="px-2 py-1 bg-white border border-gray-200 rounded text-xs
                           font-mono text-gray-700"
                >
                  {pfaId}
                </span>
              ))}
            </div>
          </div>

          {/* Conflicts */}
          {job.conflicts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-900">
                  Conflicts ({job.conflicts.length})
                </div>
                <button
                  type="button"
                  onClick={() => onResolveConflict(job.id)}
                  className="px-3 py-1 text-sm font-medium text-white bg-orange-600
                           border border-transparent rounded-md hover:bg-orange-700
                           focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  Resolve Conflicts
                </button>
              </div>
              <div className="space-y-2">
                {job.conflicts.map(conflict => (
                  <div
                    key={conflict.id}
                    className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded text-sm"
                  >
                    <span className="font-medium">{conflict.fieldName}</span>
                    {conflict.resolved && (
                      <span className="ml-2 text-green-600">✓ Resolved</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {job.errors.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-900 mb-2">
                Errors ({job.errors.length})
              </div>
              <div className="space-y-2">
                {job.errors.map((error, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-2 bg-red-50 border border-red-200 rounded text-sm"
                  >
                    <div className="font-medium text-red-900">{error.pfaId}</div>
                    <div className="text-red-700 mt-1">{error.message}</div>
                    <div className="text-red-600 text-xs mt-1">
                      {new Date(error.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="w-24 h-8 bg-gray-200 rounded" />
          <div>
            <div className="w-32 h-5 bg-gray-200 rounded mb-2" />
            <div className="w-48 h-4 bg-gray-200 rounded" />
          </div>
        </div>
        <div className="w-24 h-4 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

export function SyncHistoryDashboard({
  organizationId,
  onRefresh: _onRefresh,
}: SyncHistoryDashboardProps) {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [conflictJobId, setConflictJobId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    dateFrom: '',
    dateTo: '',
  });

  // Mock API call - replace in Phase 3
  useEffect(() => {
    loadJobs();
  }, [organizationId, filters]);

  const loadJobs = async () => {
    setIsLoading(true);
    try {
      // Mock import - will be replaced with actual service
      const { mockFetchSyncJobs } = await import('../../mockData/syncMockData');

      const filterParams = {
        organizationId,
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.dateFrom && { dateFrom: new Date(filters.dateFrom) }),
        ...(filters.dateTo && { dateTo: new Date(filters.dateTo) }),
      };

      const data = await mockFetchSyncJobs(filterParams);
      setJobs(data);
    } catch (error) {
      console.error('Failed to load sync jobs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolveConflicts = async (
    jobId: string,
    resolutions: Array<{
      conflictId: string;
      strategy: any;
      chosenValue?: unknown;
    }>
  ) => {
    // Mock resolution - replace in Phase 3
    const { mockResolveConflict } = await import('../../mockData/syncMockData');

    for (const resolution of resolutions) {
      await mockResolveConflict({
        jobId,
        conflictId: resolution.conflictId,
        strategy: resolution.strategy,
        chosenValue: resolution.chosenValue,
      });
    }

    await loadJobs();
  };

  const conflictJob = jobs.find(j => j.id === conflictJobId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Sync History</h2>
          <p className="text-sm text-gray-600 mt-1">
            View and manage PEMS synchronization jobs
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadJobs()}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300
                   rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filters.status}
              onChange={e =>
                setFilters(prev => ({
                  ...prev,
                  status: e.target.value as FilterState['status'],
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="syncing">Syncing</option>
              <option value="success">Success</option>
              <option value="conflict">Conflict</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From Date
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={e =>
                setFilters(prev => ({ ...prev, dateFrom: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To Date
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={e =>
                setFilters(prev => ({ ...prev, dateTo: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="space-y-3">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
            <div className="text-gray-400 text-4xl mb-2">📋</div>
            <div className="text-gray-600">No sync jobs found</div>
            <div className="text-sm text-gray-500 mt-1">
              Try adjusting your filters
            </div>
          </div>
        ) : (
          jobs.map(job => (
            <SyncJobCard
              key={job.id}
              job={job}
              isExpanded={expandedJobId === job.id}
              onExpand={() =>
                setExpandedJobId(prev => (prev === job.id ? null : job.id))
              }
              onResolveConflict={setConflictJobId}
            />
          ))
        )}
      </div>

      {/* Conflict Resolution Modal */}
      {conflictJob && (
        <ConflictResolutionModal
          isOpen={conflictJobId !== null}
          onClose={() => setConflictJobId(null)}
          conflicts={conflictJob.conflicts}
          pfaId={conflictJob.pfaIds[0]}
          jobId={conflictJob.id}
          onResolve={handleResolveConflicts}
        />
      )}
    </div>
  );
}
