/**
 * API Connectivity Manager (New Architecture)
 *
 * PEMS APIs: Global configurations (admin-managed, test-only for orgs)
 * AI Providers: Global templates (orgs configure their own credentials)
 */

import React, { useState, useEffect } from 'react';
import {
  Database, Brain, RefreshCw, CheckCircle, XCircle, Loader2,
  AlertTriangle, Play, Key, Server, Layers, Sparkles, Settings,
  Trash2, X, Eye, EyeOff
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';

interface ApiConfig {
  id: string;
  type: string;
  name: string;
  url: string;
  authType: string;
  operationType?: string;
  status: 'connected' | 'error' | 'untested' | 'unconfigured';
  lastChecked?: string;
  hasOrgCredentials?: boolean;
  orgCredentials?: {
    id: string;
    status: string;
  };
  username?: string;
  password?: string;
  apiKey?: string;
  tenant?: string;
  organization?: string;
  gridCode?: string;
  gridId?: string;
  isPEMS?: boolean;
  feeds?: string; // JSON array: [{ entity: 'pfa', views: ['Timeline Lab', ...] }]
  firstSyncAt?: string;
  lastSyncAt?: string;
  lastSyncRecordCount?: number;
  totalSyncRecordCount?: number;
}

interface SyncProgress {
  syncId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  organizationId: string;
  totalRecords: number;
  processedRecords: number;
  insertedRecords: number;
  updatedRecords: number;
  errorRecords: number;
  startedAt: string;
  completedAt?: string;
  currentBatch: number;
  totalBatches: number;
  error?: string;
}

interface CredentialsForm {
  username?: string;
  password?: string;
  apiKey?: string;
  tenant?: string;
}

const PEMS_API_TYPES = [
  { usage: 'PEMS_PFA_READ', label: 'PFA Data (Read)', icon: Database, color: 'blue' },
  { usage: 'PEMS_PFA_WRITE', label: 'PFA Data (Write)', icon: Database, color: 'green' },
  { usage: 'PEMS_ASSETS', label: 'Asset Master', icon: Server, color: 'purple' },
  { usage: 'PEMS_CLASSES', label: 'Classes & Categories', icon: Layers, color: 'indigo' },
];

const AI_PROVIDER_TYPES = [
  { usage: 'AI_GEMINI', label: 'Google Gemini', icon: Sparkles, color: 'orange' },
  { usage: 'AI_OPENAI', label: 'OpenAI GPT', icon: Brain, color: 'emerald' },
  { usage: 'AI_ANTHROPIC', label: 'Anthropic Claude', icon: Brain, color: 'violet' },
  { usage: 'AI_AZURE', label: 'Azure OpenAI', icon: Brain, color: 'sky' },
  { usage: 'AI_GROK', label: 'xAI Grok', icon: Sparkles, color: 'rose' },
];

export const ApiConnectivity: React.FC = () => {
  const { currentOrganizationId } = useAuth();
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<ApiConfig | null>(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [credentialsForm, setCredentialsForm] = useState<CredentialsForm>({});
  const [editForm, setEditForm] = useState<Partial<ApiConfig>>({});
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  // Sync state
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Batch sync state
  const [batchProgress, setBatchProgress] = useState<any | null>(null);
  const [isBatchSync, setIsBatchSync] = useState(false);

  useEffect(() => {
    if (currentOrganizationId) {
      loadConfigs();
    }
  }, [currentOrganizationId]);

  const loadConfigs = async () => {
    if (!currentOrganizationId) return;

    try {
      setIsLoading(true);
      const result = await apiClient.getApiConfigs(currentOrganizationId);
      setConfigs(result.configs as ApiConfig[]);
    } catch (error) {
      console.error('Failed to load configs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async (config: ApiConfig) => {
    if (!currentOrganizationId) return;

    try {
      setIsTesting(config.id);
      setTestResults(prev => ({ ...prev, [config.id]: null }));

      const result = await apiClient.testApiConfig(config.id, currentOrganizationId);
      setTestResults(prev => ({ ...prev, [config.id]: result }));

      // Reload configs to get updated status
      await loadConfigs();
    } catch (error: any) {
      setTestResults(prev => ({
        ...prev,
        [config.id]: {
          success: false,
          message: error.message || 'Connection test failed'
        }
      }));
    } finally {
      setIsTesting(null);
    }
  };

  const handleSyncData = async (config: ApiConfig) => {
    // Parse feeds to check if sync is supported
    if (!config.feeds) {
      alert('This API does not have feeds configured for data synchronization.');
      return;
    }

    try {
      const feeds = JSON.parse(config.feeds);
      const feedsInfo = feeds.map((f: any) => `${f.entity} (${f.views?.join(', ')})`).join(', ');

      if (!confirm(`Start GLOBAL data synchronization for ${config.name}?\n\nThis will sync data for ALL ORGANIZATIONS: ${feedsInfo}\n\nThis operation may take several minutes for large datasets.`)) {
        return;
      }

      setIsSyncing(true);
      setShowSyncModal(true);
      setSyncProgress(null);
      setBatchProgress(null);
      setIsBatchSync(true);

      // Start global sync (sync this API for all organizations)
      const data = await apiClient.syncGlobalApi(config.id, 'full');

      console.log('Global sync started successfully:', data);

      // Start polling for batch progress
      pollBatchProgress(data.batchId);

    } catch (error: any) {
      console.error('Sync error:', error);
      alert('Failed to start sync: ' + error.message);
      setIsSyncing(false);
      setShowSyncModal(false);
      setIsBatchSync(false);
    }
  };

  const pollSyncProgress = async (syncId: string) => {
    const poll = async () => {
      try {
        // Use apiClient service for authenticated request
        const data = await apiClient.getSyncStatus(syncId);

        // Map the response to match our interface
        const progress: SyncProgress = {
          syncId: data.syncId,
          status: data.status,
          organizationId: data.organizationId,
          totalRecords: data.progress.total,
          processedRecords: data.progress.processed,
          insertedRecords: data.progress.inserted,
          updatedRecords: data.progress.updated,
          errorRecords: data.progress.errors,
          startedAt: data.timing.startedAt,
          completedAt: data.timing.completedAt,
          currentBatch: data.batch.current,
          totalBatches: data.batch.total,
          error: data.error
        };

        setSyncProgress(progress);

        // Continue polling if still running
        if (progress.status === 'running') {
          setTimeout(() => poll(), 2000); // Poll every 2 seconds
        } else {
          setIsSyncing(false);
          if (progress.status === 'completed') {
            setTimeout(() => {
              setShowSyncModal(false);
              setSyncProgress(null);
            }, 5000); // Auto-close after 5 seconds on success
          }
        }
      } catch (error: any) {
        console.error('Polling error:', error);
        setSyncProgress(prev => prev ? { ...prev, error: error.message, status: 'failed' } : null);
        setIsSyncing(false);
      }
    };

    poll();
  };

  const pollBatchProgress = async (batchId: string) => {
    const poll = async () => {
      try {
        const data = await apiClient.getBatchStatus(batchId);

        setBatchProgress(data);

        // Continue polling if still running
        if (data.status === 'running') {
          setTimeout(() => poll(), 2000); // Poll every 2 seconds
        } else {
          setIsSyncing(false);
          setIsBatchSync(false);
          if (data.status === 'completed' || data.status === 'partial') {
            setTimeout(async () => {
              setShowSyncModal(false);
              setBatchProgress(null);
              // Reload configs to show updated sync stats
              await loadConfigs();
            }, 5000); // Auto-close after 5 seconds on success
          }
        }
      } catch (error: any) {
        console.error('Batch polling error:', error);
        setBatchProgress(prev => prev ? { ...prev, error: error.message, status: 'failed' } : null);
        setIsSyncing(false);
        setIsBatchSync(false);
      }
    };

    poll();
  };

  const handleConfigureCredentials = (config: ApiConfig) => {
    setSelectedConfig(config);
    setCredentialsForm({});
    setShowPassword(false);
    setShowCredentialsModal(true);
  };

  const togglePasswordVisibility = (configId: string) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(configId)) {
        newSet.delete(configId);
      } else {
        newSet.add(configId);
      }
      return newSet;
    });
  };

  const handleSaveCredentials = async () => {
    if (!selectedConfig || !currentOrganizationId) return;

    try {
      await apiClient.upsertOrgCredentials(selectedConfig.id, {
        organizationId: currentOrganizationId,
        ...credentialsForm
      });

      setShowCredentialsModal(false);
      setSelectedConfig(null);
      setCredentialsForm({});
      await loadConfigs();
    } catch (error: any) {
      alert('Failed to save credentials: ' + error.message);
    }
  };

  const handleDeleteCredentials = async (config: ApiConfig) => {
    if (!currentOrganizationId) return;

    if (!confirm(`Remove your organization's credentials for ${config.name}?`)) {
      return;
    }

    try {
      await apiClient.deleteOrgCredentials(config.id, currentOrganizationId);
      await loadConfigs();
    } catch (error: any) {
      alert('Failed to delete credentials: ' + error.message);
    }
  };

  const handleEditConfig = (config: ApiConfig) => {
    setSelectedConfig(config);
    setEditForm({
      type: config.type,
      name: config.name,
      url: config.url,
      authType: config.authType,
      operationType: config.operationType,
      username: config.username,
      password: config.password,
      apiKey: config.apiKey,
      tenant: config.tenant,
      organization: config.organization,
      gridCode: (config as any).gridCode,
      gridId: (config as any).gridId,
    } as any);
    setShowEditModal(true);
  };

  const handleAddNewConfig = () => {
    setSelectedConfig(null);
    setEditForm({
      type: 'PEMS_CUSTOM', // Default to PEMS, user can change in modal
      name: '',
      url: '',
      authType: 'basic',
      operationType: 'read',
    });
    setShowEditModal(true);
  };

  const handleSaveConfig = async () => {
    if (!currentOrganizationId) return;

    try {
      if (selectedConfig) {
        // Update existing
        await apiClient.updateApiConfig(selectedConfig.id, {
          name: editForm.name,
          url: editForm.url,
          authType: editForm.authType,
          operationType: editForm.operationType,
          username: (editForm as any).username,
          password: (editForm as any).password,
          apiKey: (editForm as any).apiKey,
          tenant: (editForm as any).tenant,
          organization: (editForm as any).organization,
          gridCode: (editForm as any).gridCode,
          gridId: (editForm as any).gridId,
        });
      } else {
        // Create new
        await apiClient.createApiConfig({
          organizationId: currentOrganizationId,
          type: editForm.type!,
          name: editForm.name!,
          url: editForm.url!,
          authType: editForm.authType!,
          operationType: editForm.operationType,
          username: (editForm as any).username,
          password: (editForm as any).password,
          apiKey: (editForm as any).apiKey,
          tenant: (editForm as any).tenant,
          organization: (editForm as any).organization,
          gridCode: (editForm as any).gridCode,
          gridId: (editForm as any).gridId,
        });
      }

      // Reload configs to get updated data
      await loadConfigs();

      // If we were editing (not creating), refresh the form with updated data
      if (selectedConfig) {
        // Fetch the updated config
        const response = await apiClient.getApiConfigs(currentOrganizationId);
        const updatedConfig = response.configs.find((c: any) => c.id === selectedConfig.id);

        if (updatedConfig) {
          setSelectedConfig(updatedConfig);
          setEditForm({
            type: updatedConfig.type,
            name: updatedConfig.name,
            url: updatedConfig.url,
            authType: updatedConfig.authType,
            operationType: updatedConfig.operationType,
            username: updatedConfig.username,
            password: updatedConfig.password,
            apiKey: updatedConfig.apiKey,
            tenant: updatedConfig.tenant,
            organization: updatedConfig.organization,
            gridCode: updatedConfig.gridCode,
            gridId: updatedConfig.gridId,
          } as any);
        }
      } else {
        // For new configs, close the modal after successful creation
        setShowEditModal(false);
        setEditForm({});
        setShowPassword(false);
      }

      // Show success message
      alert('Saved successfully!');
    } catch (error: any) {
      alert('Failed to save configuration: ' + error.message);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'unconfigured':
        return <AlertTriangle className="w-5 h-5 text-gray-400" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      connected: 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200',
      error: 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200',
      untested: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200',
      unconfigured: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status as keyof typeof styles] || styles.untested}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  // Show all configs in one unified list
  const allConfigs = configs;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server className="w-6 h-6 text-orange-500" />
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">API Connectivity</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage PEMS and AI provider connections. Double-click a row to view/edit details.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleAddNewConfig}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
            title="Add new API configuration"
          >
            <Server className="w-4 h-4" />
            Add New API
          </button>
          <button
            onClick={() => loadConfigs()}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* API Configurations Table */}
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        </div>
      ) : allConfigs.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Endpoint
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Username
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  First Sync
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Last Sync
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Last Pull
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Total Records
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {allConfigs.map((config) => {
                const isPEMS = config.type.startsWith('PEMS_');
                const typeList = isPEMS ? PEMS_API_TYPES : AI_PROVIDER_TYPES;
                const typeInfo = typeList.find(t => t.usage === config.type) || typeList[0];
                const Icon = typeInfo.icon;

                return (
                  <tr
                    key={config.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 bg-${typeInfo.color}-100 dark:bg-${typeInfo.color}-900/20 rounded-lg`}>
                          <Icon className={`w-4 h-4 text-${typeInfo.color}-600 dark:text-${typeInfo.color}-400`} />
                        </div>
                        <div className="text-sm text-gray-900 dark:text-white font-medium">
                          {isPEMS ? 'PEMS' : 'AI'}
                        </div>
                      </div>
                    </td>
                    <td
                      className="px-6 py-4 cursor-pointer"
                      onDoubleClick={() => handleEditConfig(config)}
                      title="Double-click to view/edit details"
                    >
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">{config.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{typeInfo.label}</div>
                      </div>
                    </td>
                    <td
                      className="px-6 py-4 cursor-pointer"
                      onDoubleClick={() => handleEditConfig(config)}
                      title="Double-click to view/edit details"
                    >
                      <div className="font-mono text-sm text-gray-600 dark:text-gray-300 max-w-md truncate" title={config.url}>
                        {config.url}
                      </div>
                    </td>
                    <td
                      className="px-6 py-4 cursor-pointer"
                      onDoubleClick={() => handleEditConfig(config)}
                      title="Double-click to view/edit details"
                    >
                      <div className="font-mono text-sm text-gray-900 dark:text-white">
                        {config.username || <span className="text-gray-400 italic">Not set</span>}
                      </div>
                    </td>
                    <td
                      className="px-6 py-4 cursor-pointer"
                      onDoubleClick={() => handleEditConfig(config)}
                      title="Double-click to view/edit details"
                    >
                      {getStatusBadge(config.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {config.feeds && config.firstSyncAt
                          ? new Date(config.firstSyncAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : <span className="text-gray-400 italic">Never</span>
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {config.feeds && config.lastSyncAt
                          ? new Date(config.lastSyncAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : <span className="text-gray-400 italic">Never</span>
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-right font-medium text-gray-900 dark:text-white">
                        {config.feeds && config.lastSyncRecordCount !== undefined && config.lastSyncRecordCount !== null
                          ? config.lastSyncRecordCount.toLocaleString()
                          : <span className="text-gray-400 italic">—</span>
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-right font-bold text-blue-600 dark:text-blue-400">
                        {config.feeds && config.totalSyncRecordCount !== undefined && config.totalSyncRecordCount !== null
                          ? config.totalSyncRecordCount.toLocaleString()
                          : <span className="text-gray-400 italic">—</span>
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditConfig(config);
                          }}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                          title="Edit"
                        >
                          <Settings className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm(`Delete ${config.name}? This cannot be undone.`)) {
                              try {
                                await apiClient.deleteApiConfig(config.id);
                                await loadConfigs();
                              } catch (error: any) {
                                alert('Failed to delete API: ' + error.message);
                              }
                            }
                          }}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          <Server className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 mb-3">
            No API connections configured
          </p>
          <button
            onClick={handleAddNewConfig}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
          >
            <Server className="w-4 h-4" />
            Add Your First API
          </button>
        </div>
      )}

      {/* Credentials Modal */}
      {showCredentialsModal && selectedConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Configure {selectedConfig.name}
              </h3>
              <button
                onClick={() => setShowCredentialsModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {selectedConfig.authType === 'basic' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={credentialsForm.username || ''}
                      onChange={(e) => setCredentialsForm({ ...credentialsForm, username: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      placeholder="Enter username"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={credentialsForm.password || ''}
                        onChange={(e) => setCredentialsForm({ ...credentialsForm, password: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        placeholder="Enter password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={credentialsForm.apiKey || ''}
                      onChange={(e) => setCredentialsForm({ ...credentialsForm, apiKey: e.target.value })}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
                      placeholder="Enter API key"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Your API key is encrypted and stored securely
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCredentialsModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCredentials}
                disabled={selectedConfig.authType === 'apiKey' ? !credentialsForm.apiKey : !credentialsForm.username || !credentialsForm.password}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                Save Credentials
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit API Configuration Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {selectedConfig ? 'Edit API Configuration' : 'Add New API Configuration'}
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    API Type
                  </label>
                  <select
                    value={editForm.type || 'PEMS_CUSTOM'}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value } as any)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    <optgroup label="PEMS APIs">
                      {PEMS_API_TYPES.map(type => (
                        <option key={type.usage} value={type.usage}>{type.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="AI Providers">
                      {AI_PROVIDER_TYPES.map(type => (
                        <option key={type.usage} value={type.usage}>{type.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    placeholder="Enter API name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  URL
                </label>
                <input
                  type="text"
                  value={editForm.url || ''}
                  onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
                  placeholder="https://api.example.com/endpoint"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Auth Type
                  </label>
                  <select
                    value={editForm.authType || 'apiKey'}
                    onChange={(e) => setEditForm({ ...editForm, authType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    <option value="apiKey">API Key</option>
                    <option value="basic">Basic Auth</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Operation Type
                  </label>
                  <select
                    value={editForm.operationType || 'read'}
                    onChange={(e) => setEditForm({ ...editForm, operationType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    <option value="read">Read</option>
                    <option value="write">Write</option>
                    <option value="read-write">Read/Write</option>
                  </select>
                </div>
              </div>

              {/* Credentials Section */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Authentication Credentials
                </h4>

                {editForm.authType === 'basic' ? (
                  <>
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Username
                      </label>
                      <input
                        type="text"
                        value={(editForm as any).username || ''}
                        onChange={(e) => setEditForm({ ...editForm, username: e.target.value } as any)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        placeholder="Enter username"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={(editForm as any).password || ''}
                          onChange={(e) => setEditForm({ ...editForm, password: e.target.value } as any)}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                          placeholder="Enter password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={(editForm as any).apiKey || ''}
                        onChange={(e) => setEditForm({ ...editForm, apiKey: e.target.value } as any)}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
                        placeholder="Enter API key"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Your API key is encrypted and stored securely
                    </p>
                  </div>
                )}

                {/* Optional Tenant field (for PEMS, Azure, etc.) */}
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tenant <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={(editForm as any).tenant || ''}
                    onChange={(e) => setEditForm({ ...editForm, tenant: e.target.value } as any)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
                    placeholder="Enter tenant (e.g., BECHTEL_DEV)"
                  />
                </div>

                {/* Optional Organization field (for PEMS) */}
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Organization <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={(editForm as any).organization || ''}
                    onChange={(e) => setEditForm({ ...editForm, organization: e.target.value } as any)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
                    placeholder="Enter organization (for PEMS)"
                  />
                </div>

                {/* Grid Code/ID fields (required for PEMS PFA Read) */}
                {editForm.type === 'PEMS_PFA_READ' && (
                  <>
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Grid Code <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={(editForm as any).gridCode || ''}
                        onChange={(e) => setEditForm({ ...editForm, gridCode: e.target.value } as any)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
                        placeholder="e.g., CUPFAG, WSJOBS"
                        required
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Grid code (GRID_NAME) for the PEMS grid. Either Grid Code or Grid ID is required.
                      </p>
                    </div>
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Grid ID <span className="text-gray-400">(optional, can use instead of Grid Code)</span>
                      </label>
                      <input
                        type="text"
                        value={(editForm as any).gridId || ''}
                        onChange={(e) => setEditForm({ ...editForm, gridId: e.target.value } as any)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
                        placeholder="e.g., 100541"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Numeric Grid ID (GRID_ID). Can be used instead of or in addition to Grid Code.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Test Result in Modal */}
            {selectedConfig && testResults[selectedConfig.id] && (
              <div className={`p-4 rounded-lg mb-4 ${
                testResults[selectedConfig.id]?.success
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}>
                <p className={`text-sm font-semibold ${
                  testResults[selectedConfig.id]?.success
                    ? 'text-green-900 dark:text-green-100'
                    : 'text-red-900 dark:text-red-100'
                }`}>
                  {testResults[selectedConfig.id]?.message}
                </p>
                {testResults[selectedConfig.id]?.latencyMs && (
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                    Latency: {testResults[selectedConfig.id]?.latencyMs}ms
                  </p>
                )}
                {!testResults[selectedConfig.id]?.success && testResults[selectedConfig.id]?.details && (
                  <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
                    <p className="text-xs font-semibold text-red-800 dark:text-red-200 mb-2">Error Details:</p>
                    <pre className="text-xs bg-red-100 dark:bg-red-950 p-2 rounded overflow-x-auto text-red-900 dark:text-red-100 whitespace-pre-wrap break-words">
                      {testResults[selectedConfig.id]?.details}
                    </pre>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <div className="flex gap-3">
                {selectedConfig && (
                  <>
                    <button
                      onClick={() => handleTestConnection(selectedConfig)}
                      disabled={isTesting === selectedConfig.id}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      {isTesting === selectedConfig.id ? (
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
                    {selectedConfig.feeds && (
                      <button
                        onClick={() => handleSyncData(selectedConfig)}
                        disabled={isSyncing}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                      >
                        {isSyncing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4" />
                            Sync Data
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={handleSaveConfig}
                  disabled={!editForm.name || !editForm.url}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  {selectedConfig ? 'Save Changes' : 'Create API'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync Progress Modal */}
      {showSyncModal && (isBatchSync ? batchProgress : syncProgress) && (() => {
        const currentProgress = isBatchSync ? batchProgress : syncProgress;
        const isRunning = currentProgress.status === 'running';
        const totalRecords = isBatchSync ? currentProgress.aggregated.totalRecords : currentProgress.totalRecords;
        const processedRecords = isBatchSync ? currentProgress.aggregated.processedRecords : currentProgress.processedRecords;
        const insertedRecords = isBatchSync ? currentProgress.aggregated.insertedRecords : currentProgress.insertedRecords;
        const updatedRecords = isBatchSync ? currentProgress.aggregated.updatedRecords : currentProgress.updatedRecords;
        const errorRecords = isBatchSync ? currentProgress.aggregated.errorRecords : currentProgress.errorRecords;
        const percentComplete = totalRecords > 0 ? Math.round((processedRecords / totalRecords) * 100) : 0;

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <RefreshCw className={`w-5 h-5 ${isRunning ? 'animate-spin text-blue-500' : ''}`} />
                  {isBatchSync ? 'Global Data Synchronization' : 'Data Synchronization'}
                </h3>
                {!isRunning && (
                  <button
                    onClick={() => {
                      setShowSyncModal(false);
                      setSyncProgress(null);
                      setBatchProgress(null);
                      setIsBatchSync(false);
                    }}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                )}
              </div>

              {/* Batch Info */}
              {isBatchSync && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    Syncing across <span className="font-bold">{currentProgress.totalSyncs}</span> organizations •
                    Completed: <span className="font-bold">{currentProgress.completedSyncs}</span> •
                    Failed: <span className="font-bold">{currentProgress.failedSyncs}</span>
                  </div>
                </div>
              )}

              {/* Status Badge */}
              <div className="mb-4">
                {currentProgress.status === 'running' && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Syncing...
                  </span>
                )}
                {currentProgress.status === 'completed' && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
                    <CheckCircle className="w-4 h-4" />
                    Completed
                  </span>
                )}
                {(currentProgress.status === 'partial' && isBatchSync) && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full text-sm font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    Partially Completed
                  </span>
                )}
                {currentProgress.status === 'failed' && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-sm font-medium">
                    <XCircle className="w-4 h-4" />
                    Failed
                  </span>
                )}
                {currentProgress.status === 'cancelled' && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    Cancelled
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <span>Progress</span>
                  <span>{percentComplete}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${
                      currentProgress.status === 'completed' ? 'bg-green-500' :
                      currentProgress.status === 'partial' ? 'bg-yellow-500' :
                      currentProgress.status === 'failed' ? 'bg-red-500' :
                      'bg-blue-500'
                    }`}
                    style={{
                      width: `${percentComplete}%`
                    }}
                  />
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Records</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalRecords.toLocaleString()}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Processed</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{processedRecords.toLocaleString()}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Inserted</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{insertedRecords.toLocaleString()}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Updated</div>
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{updatedRecords.toLocaleString()}</div>
                </div>
                {errorRecords > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 col-span-2">
                    <div className="text-sm text-red-500 dark:text-red-400 mb-1">Errors</div>
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{errorRecords.toLocaleString()}</div>
                  </div>
                )}
              </div>

              {/* Batch Progress (for single sync) */}
              {!isBatchSync && syncProgress && (
                <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  Batch {syncProgress.currentBatch} of {syncProgress.totalBatches}
                </div>
              )}

              {/* Error Message */}
              {currentProgress.error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="text-sm text-red-600 dark:text-red-400">{currentProgress.error}</div>
                </div>
              )}

              {/* Actions */}
              {(currentProgress.status === 'completed' || currentProgress.status === 'partial') && (
                <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
                  This dialog will close automatically in 5 seconds...
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
