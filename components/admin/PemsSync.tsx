/**
 * PEMS Data Synchronization Component
 *
 * Displays PEMS API configuration, allows testing connection,
 * and triggering data synchronization.
 */

import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, CheckCircle, XCircle, Loader2, Clock, AlertTriangle, Play, History } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';

interface SyncStatus {
  syncId: string;
  status: string;
  syncType: string;
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsDeleted: number;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
}

export const PemsSync: React.FC = () => {
  const { currentOrganizationId } = useAuth();
  const [configs, setConfigs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [activeSyncId, setActiveSyncId] = useState<string | null>(null);
  const [activeSyncStatus, setActiveSyncStatus] = useState<SyncStatus | null>(null);

  // Load PEMS configurations
  useEffect(() => {
    if (currentOrganizationId) {
      loadConfigs();
      loadSyncHistory();
    }
  }, [currentOrganizationId]);

  // Poll active sync status
  useEffect(() => {
    if (activeSyncId && activeSyncStatus?.status === 'in_progress') {
      const interval = setInterval(async () => {
        try {
          const status = await apiClient.getSyncStatus(activeSyncId);
          setActiveSyncStatus(status);

          if (status.status !== 'in_progress') {
            clearInterval(interval);
            loadSyncHistory(); // Refresh history
          }
        } catch (error) {
          console.error('Failed to fetch sync status:', error);
        }
      }, 2000); // Poll every 2 seconds

      return () => clearInterval(interval);
    }
  }, [activeSyncId, activeSyncStatus?.status]);

  const loadConfigs = async () => {
    if (!currentOrganizationId) return;

    try {
      setIsLoading(true);
      const result = await apiClient.getPemsConfigs(currentOrganizationId);
      setConfigs(result.configs);
    } catch (error) {
      console.error('Failed to load PEMS configs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSyncHistory = async () => {
    if (!currentOrganizationId) return;

    try {
      const result = await apiClient.getSyncHistory(currentOrganizationId, 5);
      setSyncHistory(result.history);
    } catch (error) {
      console.error('Failed to load sync history:', error);
    }
  };

  const handleTestConnection = async () => {
    if (!currentOrganizationId) return;

    try {
      setIsTesting(true);
      setTestResult(null);
      const result = await apiClient.testPemsConnection(currentOrganizationId);
      setTestResult(result);

      // Reload configs to see updated status
      await loadConfigs();
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || 'Connection test failed'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSync = async (syncType: 'full' | 'incremental' = 'full') => {
    if (!currentOrganizationId) return;

    try {
      setIsSyncing(true);
      const result = await apiClient.syncPemsData(currentOrganizationId, syncType);

      setActiveSyncId(result.syncId);

      // Immediately fetch sync status
      const status = await apiClient.getSyncStatus(result.syncId);
      setActiveSyncStatus(status);
    } catch (error: any) {
      alert('Failed to initiate sync: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'in_progress':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  const readConfig = configs.find(c => c.operationType === 'read');
  const writeConfig = configs.find(c => c.operationType === 'write');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-orange-500" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">PEMS Data Sync</h2>
            <p className="text-sm text-gray-500">Connect to PEMS API and synchronize PFA data</p>
          </div>
        </div>
      </div>

      {/* Configuration Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Read API */}
        <div className="p-4 border rounded-lg bg-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">Read API</h3>
            {readConfig && getStatusIcon(readConfig.status)}
          </div>
          {readConfig ? (
            <div className="space-y-1 text-sm">
              <div className="text-gray-600">Endpoint: <span className="font-mono text-xs">{readConfig.url}</span></div>
              <div className="text-gray-600">Status: <span className="font-medium">{readConfig.status}</span></div>
              {readConfig.lastChecked && (
                <div className="text-gray-500">Last checked: {new Date(readConfig.lastChecked).toLocaleString()}</div>
              )}
              {readConfig.lastError && (
                <div className="text-red-600 text-xs mt-2">{readConfig.lastError}</div>
              )}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">Not configured</div>
          )}
        </div>

        {/* Write API */}
        <div className="p-4 border rounded-lg bg-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">Write API</h3>
            {writeConfig && getStatusIcon(writeConfig.status)}
          </div>
          {writeConfig ? (
            <div className="space-y-1 text-sm">
              <div className="text-gray-600">Endpoint: <span className="font-mono text-xs">{writeConfig.url}</span></div>
              <div className="text-gray-600">Status: <span className="font-medium">{writeConfig.status}</span></div>
              {writeConfig.lastChecked && (
                <div className="text-gray-500">Last checked: {new Date(writeConfig.lastChecked).toLocaleString()}</div>
              )}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">Not configured</div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleTestConnection}
          disabled={isTesting || !readConfig}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          {isTesting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Test Connection
            </>
          )}
        </button>

        <button
          onClick={() => handleSync('full')}
          disabled={isSyncing || !readConfig || readConfig.status !== 'connected'}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          {isSyncing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Starting Sync...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Sync All Data
            </>
          )}
        </button>
      </div>

      {/* Test Result */}
      {testResult && (
        <div className={`p-4 border rounded-lg ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start gap-3">
            {testResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`font-medium ${testResult.success ? 'text-green-900' : 'text-red-900'}`}>
                {testResult.message}
              </p>
              {testResult.recordsFetched !== undefined && (
                <p className="text-sm text-green-700 mt-1">
                  Fetched {testResult.recordsFetched} test records in {testResult.latencyMs}ms
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active Sync Status */}
      {activeSyncStatus && (
        <div className={`p-4 border rounded-lg ${getSyncStatusColor(activeSyncStatus.status)}`}>
          <div className="flex items-start gap-3">
            {activeSyncStatus.status === 'in_progress' ? (
              <Loader2 className="w-5 h-5 animate-spin flex-shrink-0 mt-0.5" />
            ) : activeSyncStatus.status === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <h4 className="font-semibold mb-2">
                {activeSyncStatus.status === 'in_progress' ? 'Sync in Progress' :
                 activeSyncStatus.status === 'success' ? 'Sync Completed' : 'Sync Failed'}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="font-medium">Processed</div>
                  <div className="text-lg">{activeSyncStatus.recordsProcessed}</div>
                </div>
                <div>
                  <div className="font-medium">Inserted</div>
                  <div className="text-lg text-green-600">{activeSyncStatus.recordsInserted}</div>
                </div>
                <div>
                  <div className="font-medium">Updated</div>
                  <div className="text-lg text-blue-600">{activeSyncStatus.recordsUpdated}</div>
                </div>
                <div>
                  <div className="font-medium">Duration</div>
                  <div className="text-lg">{activeSyncStatus.durationMs ? `${(activeSyncStatus.durationMs / 1000).toFixed(1)}s` : '-'}</div>
                </div>
              </div>
              {activeSyncStatus.errorMessage && (
                <div className="mt-2 text-sm text-red-700">
                  Error: {activeSyncStatus.errorMessage}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sync History */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <History className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Recent Syncs</h3>
        </div>
        {syncHistory.length > 0 ? (
          <div className="space-y-2">
            {syncHistory.map((sync) => (
              <div key={sync.id} className={`p-3 border rounded-lg ${getSyncStatusColor(sync.status)}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{sync.syncType} sync</div>
                    <div className="text-xs opacity-75">{new Date(sync.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div>{sync.recordsProcessed} records</div>
                    <div className="text-xs">
                      +{sync.recordsInserted} / ~{sync.recordsUpdated}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No sync history available
          </div>
        )}
      </div>
    </div>
  );
};
