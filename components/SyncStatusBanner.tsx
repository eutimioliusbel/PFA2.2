/**
 * SyncStatusBanner Component
 *
 * Displays sync state information at the top of the application.
 * Shows counts of modified, pending sync, and error records with visual indicators.
 */

import React from 'react';
import { RefreshCw, AlertCircle, CheckCircle, PencilIcon } from 'lucide-react';
import { PfaSyncState } from '../types';

interface SyncStatusBannerProps {
  syncState: PfaSyncState;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const SyncStatusBanner: React.FC<SyncStatusBannerProps> = ({
  syncState,
  onRefresh,
  isLoading = false,
}) => {
  const { modifiedCount, pendingSyncCount, errorCount, pristineCount } = syncState;

  // Don't show banner if everything is pristine
  if (modifiedCount === 0 && pendingSyncCount === 0 && (errorCount || 0) === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200 dark:from-slate-800 dark:to-slate-900 dark:border-slate-700">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Status Indicators */}
          <div className="flex items-center gap-6">
            {/* Modified Count */}
            {modifiedCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 border border-yellow-300 rounded-md dark:bg-yellow-900/30 dark:border-yellow-700">
                  <PencilIcon className="w-4 h-4 text-yellow-700 dark:text-yellow-400" />
                  <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                    {modifiedCount} unsaved {modifiedCount === 1 ? 'change' : 'changes'}
                  </span>
                </div>
              </div>
            )}

            {/* Pending Sync Count */}
            {pendingSyncCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 border border-blue-300 rounded-md dark:bg-blue-900/30 dark:border-blue-700">
                  <RefreshCw className="w-4 h-4 text-blue-700 dark:text-blue-400 animate-spin" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                    Syncing {pendingSyncCount} {pendingSyncCount === 1 ? 'record' : 'records'}
                  </span>
                </div>
              </div>
            )}

            {/* Error Count */}
            {errorCount && errorCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 border border-red-300 rounded-md dark:bg-red-900/30 dark:border-red-700">
                  <AlertCircle className="w-4 h-4 text-red-700 dark:text-red-400" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-400">
                    {errorCount} sync {errorCount === 1 ? 'error' : 'errors'}
                  </span>
                </div>
              </div>
            )}

            {/* Pristine Count (Success State) */}
            {pristineCount > 0 && modifiedCount === 0 && pendingSyncCount === 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 border border-green-300 rounded-md dark:bg-green-900/30 dark:border-green-700">
                  <CheckCircle className="w-4 h-4 text-green-700 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    All changes synced
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
