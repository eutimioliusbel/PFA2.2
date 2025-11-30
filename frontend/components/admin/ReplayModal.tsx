/**
 * @file ReplayModal.tsx
 * @description Time Machine (Replay) UI Component - ADR-007 Task 5.5
 *
 * Enables admins to replay transformation operations on historical Bronze batches
 * using current mapping rules. Supports date range selection, impact calculation,
 * and real-time progress tracking.
 *
 * User Flow:
 * 1. Admin selects date range in Sync History
 * 2. Clicks "Replay Transformation"
 * 3. Modal shows impact calculation (batches, records)
 * 4. Progress bar with real-time updates via polling
 * 5. Success/failure notification
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  History,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Database,
  RefreshCw,
  Calendar,
  StopCircle
} from 'lucide-react';

// API Base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface DateRange {
  start: Date;
  end: Date;
}

interface ReplayImpact {
  batchCount: number;
  recordCount: number;
  silverRecordCount: number;
  dateRange: {
    start: string;
    end: string;
  };
}

interface ReplayProgress {
  status: 'pending' | 'running' | 'completed' | 'failed';
  processedBatches: number;
  totalBatches: number;
  processedRecords: number;
  totalRecords: number;
  currentBatchId?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

interface ReplayResult {
  success: boolean;
  jobId: string;
  batchCount: number;
  recordCount: number;
  duration: number;
  results: Array<{
    syncBatchId: string;
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
  }>;
}

interface ReplayModalProps {
  isOpen: boolean;
  organizationId: string;
  dateRange: DateRange;
  onClose: () => void;
  onReplayComplete?: (result: ReplayResult) => void;
}

export function ReplayModal({
  isOpen,
  organizationId,
  dateRange,
  onClose,
  onReplayComplete
}: ReplayModalProps): React.ReactElement | null {
  // State
  const [impact, setImpact] = useState<ReplayImpact | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [progress, setProgress] = useState<ReplayProgress | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useCurrentRules, setUseCurrentRules] = useState(true);
  const [replayStartTime, setReplayStartTime] = useState<number | null>(null);

  // Refs
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Get auth token
  const getAuthToken = useCallback((): string | null => {
    return localStorage.getItem('pfa_auth_token');
  }, []);

  // Adaptive polling interval based on elapsed time
  const getPollingInterval = useCallback((elapsedMs: number): number => {
    if (elapsedMs < 10000) return 1000;   // First 10s: 1s
    if (elapsedMs < 60000) return 3000;   // Next 50s: 3s
    return 5000;                          // After 1min: 5s
  }, []);

  // Calculate ETA
  const calculateETA = useCallback((): string => {
    if (!progress || !replayStartTime || progress.processedRecords === 0) {
      return '—';
    }

    const elapsed = Date.now() - replayStartTime;
    const rate = progress.processedRecords / elapsed; // records/ms
    const remaining = progress.totalRecords - progress.processedRecords;
    const etaMs = remaining / rate;

    if (etaMs < 60000) {
      const seconds = Math.floor(etaMs / 1000);
      return `~${seconds}s remaining`;
    } else {
      const minutes = Math.floor(etaMs / 60000);
      const seconds = Math.floor((etaMs % 60000) / 1000);
      return `~${minutes}m ${seconds}s remaining`;
    }
  }, [progress, replayStartTime]);

  // Focus management and ESC key handler
  useEffect(() => {
    if (isOpen && modalRef.current) {
      // Focus modal on open
      modalRef.current.focus();

      // ESC key handler
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !replaying && !canceling) {
          onClose();
        }
      };

      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
    return undefined;
  }, [isOpen, replaying, canceling, onClose]);

  // Calculate impact when modal opens
  useEffect(() => {
    if (isOpen && !impact && !calculating) {
      calculateImpact();
    }
  }, [isOpen]);

  // Poll for progress when replaying with adaptive intervals
  useEffect(() => {
    let pollTimeout: NodeJS.Timeout | null = null;
    let pollStartTime = Date.now();

    const pollStatus = async () => {
      if (!replaying || !jobId) return;

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/sync/replay/${jobId}/status`,
          {
            headers: {
              'Authorization': `Bearer ${getAuthToken()}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          setProgress(data.progress);

          if (data.progress.status === 'completed' || data.progress.status === 'failed') {
            setReplaying(false);
            setCanceling(false);

            if (data.progress.status === 'completed' && onReplayComplete) {
              onReplayComplete(data.result);
            }
          } else if (replaying) {
            // Schedule next poll with adaptive interval
            const elapsed = Date.now() - pollStartTime;
            const interval = getPollingInterval(elapsed);
            pollTimeout = setTimeout(pollStatus, interval);
          }
        }
      } catch (err) {
        console.error('Failed to poll replay status:', err);
        // Retry after standard interval
        if (replaying) {
          pollTimeout = setTimeout(pollStatus, 3000);
        }
      }
    };

    if (replaying && jobId) {
      pollStatus();
    }

    return () => {
      if (pollTimeout) {
        clearTimeout(pollTimeout);
      }
    };
  }, [replaying, jobId, getAuthToken, onReplayComplete, getPollingInterval]);

  // Calculate impact
  const calculateImpact = async (): Promise<void> => {
    setCalculating(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/sync/replay/calculate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            organizationId,
            startDate: dateRange.start.toISOString(),
            endDate: dateRange.end.toISOString()
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to calculate impact');
      }

      const data = await response.json();
      setImpact(data.impact);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate impact');
    } finally {
      setCalculating(false);
    }
  };

  // Start replay
  const handleConfirmReplay = async (): Promise<void> => {
    setReplaying(true);
    setError(null);
    setReplayStartTime(Date.now());
    setProgress({
      status: 'pending',
      processedBatches: 0,
      totalBatches: impact?.batchCount || 0,
      processedRecords: 0,
      totalRecords: impact?.recordCount || 0
    });

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/sync/replay`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            organizationId,
            startDate: dateRange.start.toISOString(),
            endDate: dateRange.end.toISOString(),
            useCurrentRules
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start replay');
      }

      const data = await response.json();
      setJobId(data.jobId);
      setProgress(prev => prev ? { ...prev, status: 'running', startedAt: new Date().toISOString() } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start replay');
      setReplaying(false);
      setProgress(null);
      setReplayStartTime(null);
    }
  };

  // Cancel replay operation
  const handleCancelReplay = async (): Promise<void> => {
    if (!jobId || !confirm('Are you sure you want to cancel this replay? Progress will be lost.')) {
      return;
    }

    setCanceling(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/sync/replay/${jobId}/cancel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel replay');
      }

      setReplaying(false);
      setCanceling(false);
      setProgress(prev => prev ? { ...prev, status: 'failed', error: 'Canceled by user' } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel replay');
      setCanceling(false);
    }
  };

  // Format date for display
  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate progress percentage
  const progressPercent = progress
    ? Math.round((progress.processedRecords / progress.totalRecords) * 100)
    : 0;

  // Check if dataset is large (warning threshold)
  const isLargeDataset = impact && (impact.recordCount > 50000 || impact.batchCount > 100);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="replay-modal-title"
        aria-describedby="replay-modal-description"
        tabIndex={-1}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-500" aria-hidden="true" />
            <h2 id="replay-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Replay Transformation
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            disabled={replaying}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Close"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div id="replay-modal-description" className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Date Range Info */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <Calendar className="w-4 h-4 text-gray-500" aria-hidden="true" />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
            </span>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Error
                </p>
                <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}

          {/* Calculating State */}
          {calculating && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <span className="ml-3 text-gray-600 dark:text-gray-300">
                Calculating impact...
              </span>
            </div>
          )}

          {/* Impact Display */}
          {impact && !calculating && !replaying && (
            <>
              {/* Large Dataset Warning */}
              {isLargeDataset && (
                <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="text-sm">
                    <p className="font-medium text-orange-800 dark:text-orange-200">
                      Large Dataset Detected
                    </p>
                    <p className="mt-1 text-orange-700 dark:text-orange-300">
                      This replay will process {impact.recordCount.toLocaleString()} records.
                      Operation may take 10+ minutes. Consider using a smaller date range for faster results.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  You are about to re-process:
                </p>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-500" aria-hidden="true" />
                    <span>{impact.batchCount.toLocaleString()} batches</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-green-500" aria-hidden="true" />
                    <span>{impact.recordCount.toLocaleString()} Bronze records</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-purple-500" aria-hidden="true" />
                    <span>{impact.silverRecordCount.toLocaleString()} Silver records will be updated</span>
                  </li>
                </ul>
              </div>

              {/* Mapping Rules Option */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCurrentRules}
                    onChange={(e) => setUseCurrentRules(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Use current mapping rules
                    </span>
                    <p className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">
                      {useCurrentRules
                        ? 'Transformation will apply current (latest) mapping rules to all historical data'
                        : 'Transformation will use mapping rules that were active at each batch ingestion time'}
                    </p>
                  </div>
                </label>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Warning
                  </p>
                  <ul className="mt-1 text-amber-700 dark:text-amber-300 space-y-0.5">
                    <li>This operation cannot be undone</li>
                    <li>Silver records will be overwritten</li>
                    <li>Large date ranges may take several minutes</li>
                  </ul>
                </div>
              </div>
            </>
          )}

          {/* Progress Display */}
          {replaying && progress && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" aria-hidden="true" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {progress.status === 'pending' ? 'Starting replay...' : 'Replay in progress...'}
                  </span>
                </div>
                <button
                  onClick={handleCancelReplay}
                  disabled={canceling}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Cancel replay operation"
                >
                  <StopCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  {canceling ? 'Canceling...' : 'Cancel'}
                </button>
              </div>

              {/* Progress Bar with ARIA */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{progress.processedRecords.toLocaleString()} / {progress.totalRecords.toLocaleString()} records</span>
                  <span>{progressPercent}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Replay progress: ${progressPercent}% complete`}
                  className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {/* ARIA live region for screen readers */}
                <div aria-live="polite" aria-atomic="true" className="sr-only">
                  Replay {progressPercent}% complete. {progress.processedRecords.toLocaleString()} of {progress.totalRecords.toLocaleString()} records processed.
                  {replayStartTime && ` ${calculateETA()}`}
                </div>
              </div>

              {/* Batch Progress and ETA */}
              <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                <div>
                  <span>Batch {progress.processedBatches} of {progress.totalBatches}</span>
                  {progress.currentBatchId && (
                    <span className="ml-2 font-mono">({progress.currentBatchId})</span>
                  )}
                </div>
                {replayStartTime && progress.processedRecords > 0 && (
                  <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    <span>{calculateETA()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Completion State with Animation */}
          {progress?.status === 'completed' && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 animate-in fade-in zoom-in duration-300">
              <CheckCircle className="w-5 h-5 text-green-500 animate-bounce" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Replay Complete
                </p>
                <p className="text-xs text-green-600 dark:text-green-300">
                  {progress.processedRecords.toLocaleString()} records processed across {progress.processedBatches} batches
                </p>
              </div>
              {/* ARIA announcement for completion */}
              <div aria-live="assertive" aria-atomic="true" className="sr-only">
                Replay completed successfully. {progress.processedRecords.toLocaleString()} records processed.
              </div>
            </div>
          )}

          {/* Failure State */}
          {progress?.status === 'failed' && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Replay Failed
                </p>
                <p className="text-xs text-red-600 dark:text-red-300">
                  {progress.error || 'An unexpected error occurred'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          {!replaying && progress?.status !== 'completed' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                aria-label="Cancel and close modal"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReplay}
                disabled={calculating || !impact || impact.batchCount === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Confirm and start replay operation"
              >
                {calculating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Calculating...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" aria-hidden="true" />
                    <span>Confirm Replay</span>
                  </>
                )}
              </button>
            </>
          )}

          {(replaying || progress?.status === 'completed' || progress?.status === 'failed') && (
            <button
              onClick={onClose}
              disabled={(replaying && progress?.status === 'running' && !canceling) || canceling}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
              aria-label={progress?.status === 'completed' ? 'Close modal' : 'Close modal (replay in progress)'}
            >
              {progress?.status === 'completed' ? 'Done' : 'Close'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReplayModal;
