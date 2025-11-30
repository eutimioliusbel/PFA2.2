import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, Clock, XCircle, Loader2, Building2, Calendar, Database } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface OrganizationSyncStats {
  id: string;
  code: string;
  name: string;
  serviceStatus: string;
  enableSync: boolean;
  syncEnabled: boolean;
  skipReason?: string;
  lastSyncAt?: string;
  lastSyncStatus?: 'completed' | 'failed' | 'running';
  lastSyncRecordCount?: number;
  lastSyncSkippedCount?: number;
  lastSyncErrorCount?: number;
  skipReasonBreakdown?: Record<string, number>;
}

interface SyncHealthStats {
  totalOrganizations: number;
  activeOrgs: number;
  syncing: number;
  skipped: number;
  suspended: number;
  archived: number;
  syncDisabled: number;
  organizations: OrganizationSyncStats[];
  lastUpdated: string;
}

export const SyncHealthDashboard: React.FC = () => {
  const [healthStats, setHealthStats] = useState<SyncHealthStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadHealthStats = async () => {
    try {
      setError(null);
      const data = await apiClient.getSyncHealthStats();
      setHealthStats(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sync health statistics';
      setError(errorMessage);
      console.error('Failed to load sync health stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHealthStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadHealthStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadHealthStats();
  };

  const getStatusColor = (org: OrganizationSyncStats) => {
    if (!org.syncEnabled || org.serviceStatus === 'suspended' || org.serviceStatus === 'archived') {
      return 'text-slate-400 bg-slate-100 dark:bg-slate-800';
    }
    if (org.skipReason) {
      return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
    }
    if (org.lastSyncStatus === 'failed') {
      return 'text-red-600 bg-red-50 dark:bg-red-900/20';
    }
    if (org.lastSyncStatus === 'running') {
      return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
    }
    if (org.lastSyncStatus === 'completed') {
      return 'text-green-600 bg-green-50 dark:bg-green-900/20';
    }
    return 'text-slate-400 bg-slate-100 dark:bg-slate-800';
  };

  const getStatusIcon = (org: OrganizationSyncStats) => {
    if (!org.syncEnabled || org.serviceStatus === 'suspended' || org.serviceStatus === 'archived') {
      return <XCircle className="w-4 h-4" />;
    }
    if (org.skipReason) {
      return <AlertCircle className="w-4 h-4" />;
    }
    if (org.lastSyncStatus === 'failed') {
      return <XCircle className="w-4 h-4" />;
    }
    if (org.lastSyncStatus === 'running') {
      return <Loader2 className="w-4 h-4 animate-spin" />;
    }
    if (org.lastSyncStatus === 'completed') {
      return <CheckCircle className="w-4 h-4" />;
    }
    return <Clock className="w-4 h-4" />;
  };

  const getStatusLabel = (org: OrganizationSyncStats) => {
    if (org.serviceStatus === 'suspended') return 'Suspended';
    if (org.serviceStatus === 'archived') return 'Archived';
    if (!org.syncEnabled) return 'Sync Disabled';
    if (org.skipReason) return `Skipped: ${org.skipReason}`;
    if (org.lastSyncStatus === 'running') return 'Syncing...';
    if (org.lastSyncStatus === 'failed') return 'Failed';
    if (org.lastSyncStatus === 'completed') return 'Syncing';
    return 'Never Synced';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatNumber = (num?: number) => {
    if (num === undefined || num === null) return '—';
    return num.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading sync health statistics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Failed to Load</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">{error}</p>
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

  if (!healthStats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Database className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">No sync health data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sync Health Dashboard</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Monitor organization synchronization status and skip reasons
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">Total Organizations</span>
            <Building2 className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {healthStats.totalOrganizations}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {healthStats.activeOrgs} active
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">Syncing</span>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
            {healthStats.syncing}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Successfully syncing
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">Skipped</span>
            <AlertCircle className="w-5 h-5 text-yellow-500" />
          </div>
          <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
            {healthStats.skipped}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Sync skipped for various reasons
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">Suspended/Archived</span>
            <XCircle className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-3xl font-bold text-red-600 dark:text-red-400">
            {healthStats.suspended + healthStats.archived}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {healthStats.suspended} suspended, {healthStats.archived} archived
          </div>
        </div>
      </div>

      {/* Organizations Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Organization Sync Status</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Last Sync
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Records
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Skipped
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Errors
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {healthStats.organizations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    No organizations found
                  </td>
                </tr>
              ) : (
                healthStats.organizations.map((org) => (
                  <tr
                    key={org.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Organization */}
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {org.name}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {org.code}
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${getStatusColor(org)}`}>
                        {getStatusIcon(org)}
                        {getStatusLabel(org)}
                      </div>
                    </td>

                    {/* Last Sync */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {formatDate(org.lastSyncAt)}
                      </div>
                    </td>

                    {/* Records */}
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {formatNumber(org.lastSyncRecordCount)}
                      </span>
                    </td>

                    {/* Skipped */}
                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-semibold ${org.lastSyncSkippedCount ? 'text-yellow-600 dark:text-yellow-400' : 'text-slate-400'}`}>
                        {formatNumber(org.lastSyncSkippedCount)}
                      </span>
                    </td>

                    {/* Errors */}
                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-semibold ${org.lastSyncErrorCount ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                        {formatNumber(org.lastSyncErrorCount)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-center text-sm text-slate-500 dark:text-slate-400">
        Last updated: {formatDate(healthStats.lastUpdated)}
      </div>
    </div>
  );
};
