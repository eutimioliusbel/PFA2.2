/**
 * Data Source Manager
 *
 * Manages configurable API-to-entity mappings with performance tracking.
 * Allows admins to view, create, edit, and prioritize data source mappings.
 */

import React, { useState, useEffect } from 'react';
import {
  Database, Layers, Building2, Tags, CheckCircle, XCircle,
  Settings, Plus, Trash2, RefreshCw, Loader2, Network, X, Edit2
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';

interface DataSourceMapping {
  id: string;
  entityType: string;
  organizationId: string | null;
  apiConfigId: string;
  apiConfig: {
    id: string;
    name: string;
    url: string;
    status: string;
  };
  priority: number;
  isActive: boolean;
  lastUsedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  successCount: number;
  failureCount: number;
  avgResponseTime: number | null;
}

interface ApiConfig {
  id: string;
  name: string;
  type: string;
  url: string;
  status: string;
}

interface MappingForm {
  entityType: string;
  organizationId: string | null;
  apiConfigId: string;
  priority: number;
  isActive: boolean;
}

const ENTITY_TYPES = [
  { type: 'pfa', label: 'PFA Records', icon: Database },
  { type: 'organizations', label: 'Organizations', icon: Building2 },
  { type: 'asset_master', label: 'Asset Master', icon: Tags },
  { type: 'classifications', label: 'Classifications', icon: Layers },
];

export const DataSourceManager: React.FC = () => {
  const { currentOrganizationId } = useAuth();
  const [mappings, setMappings] = useState<DataSourceMapping[]>([]);
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<DataSourceMapping | null>(null);
  const [formData, setFormData] = useState<MappingForm>({
    entityType: 'pfa',
    organizationId: null,
    apiConfigId: '',
    priority: 1,
    isActive: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadMappings();
    loadApiConfigs();
  }, []);

  const loadMappings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient.getDataSourceMappings();
      setMappings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error loading mappings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadApiConfigs = async () => {
    try {
      if (!currentOrganizationId) return;
      const response = await apiClient.getApiConfigs(currentOrganizationId);
      setApiConfigs(response.configs || []);
    } catch (err) {
      console.error('Error loading API configs:', err);
    }
  };

  const toggleMappingStatus = async (mappingId: string, currentStatus: boolean) => {
    try {
      await apiClient.updateDataSourceMapping(mappingId, { isActive: !currentStatus });
      await loadMappings();
    } catch (err) {
      console.error('Error toggling mapping status:', err);
      alert('Failed to update mapping status');
    }
  };

  const handleAddMapping = () => {
    setSelectedMapping(null);
    setFormData({
      entityType: 'pfa',
      organizationId: null,
      apiConfigId: '',
      priority: 1,
      isActive: true,
    });
    setShowModal(true);
  };

  const handleEditMapping = (mapping: DataSourceMapping) => {
    setSelectedMapping(mapping);
    setFormData({
      entityType: mapping.entityType,
      organizationId: mapping.organizationId,
      apiConfigId: mapping.apiConfigId,
      priority: mapping.priority,
      isActive: mapping.isActive,
    });
    setShowModal(true);
  };

  const handleSaveMapping = async () => {
    try {
      setIsSaving(true);

      if (!formData.apiConfigId) {
        alert('Please select an API configuration');
        return;
      }

      if (selectedMapping) {
        // Update existing mapping
        await apiClient.updateDataSourceMapping(selectedMapping.id, {
          apiConfigId: formData.apiConfigId,
          priority: formData.priority,
          isActive: formData.isActive,
        });
      } else {
        // Create new mapping
        await apiClient.createDataSourceMapping({
          entityType: formData.entityType,
          organizationId: formData.organizationId || undefined,
          apiConfigId: formData.apiConfigId,
          priority: formData.priority,
          isActive: formData.isActive,
        });
      }

      setShowModal(false);
      await loadMappings();
    } catch (err) {
      console.error('Error saving mapping:', err);
      alert(err instanceof Error ? err.message : 'Failed to save mapping');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!confirm('Are you sure you want to delete this mapping?')) return;

    try {
      await apiClient.deleteDataSourceMapping(mappingId);
      await loadMappings();
    } catch (err) {
      console.error('Error deleting mapping:', err);
      alert('Failed to delete mapping');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getEntityLabel = (entityType: string) => {
    const entity = ENTITY_TYPES.find(e => e.type === entityType);
    return entity?.label || entityType;
  };

  const getEntityIcon = (entityType: string) => {
    const entity = ENTITY_TYPES.find(e => e.type === entityType);
    return entity?.icon || Database;
  };

  const getSuccessRate = (mapping: DataSourceMapping) => {
    const total = mapping.successCount + mapping.failureCount;
    if (total === 0) return 0;
    return Math.round((mapping.successCount / total) * 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading data source mappings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center">
          <X className="w-6 h-6 text-red-600 dark:text-red-400 mr-3" />
          <div>
            <h3 className="font-semibold text-red-900 dark:text-red-200">Failed to Load Mappings</h3>
            <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={loadMappings}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Network className="w-6 h-6 text-orange-500" />
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Data Source Mappings</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure which APIs provide data for each entity type. Supports priority-based fallback and performance tracking.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleAddMapping}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
            title="Add new data source mapping"
          >
            <Plus className="w-4 h-4" />
            Add Mapping
          </button>
          <button
            onClick={loadMappings}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Mappings Table */}
      {mappings.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Entity Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  API Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Scope
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Success Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Last Used
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {mappings.map((mapping) => {
                const Icon = getEntityIcon(mapping.entityType);
                const successRate = getSuccessRate(mapping);

                return (
                  <tr
                    key={mapping.id}
                    onDoubleClick={() => handleEditMapping(mapping)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    title="Double-click to edit"
                  >
                    {/* Entity Type */}
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <Icon className="w-5 h-5 text-orange-500 mr-2" />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {getEntityLabel(mapping.entityType)}
                        </span>
                      </div>
                    </td>

                    {/* API Source */}
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {mapping.apiConfig.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                          {mapping.apiConfig.url}
                        </div>
                      </div>
                    </td>

                    {/* Scope */}
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        mapping.organizationId
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {mapping.organizationId ? 'Organization' : 'Global'}
                      </span>
                    </td>

                    {/* Priority */}
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        mapping.priority === 1
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      }`}>
                        {mapping.priority === 1 ? 'Primary' : `Fallback ${mapping.priority}`}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 text-center">
                      {mapping.isActive ? (
                        <div className="flex items-center justify-center text-green-600 dark:text-green-400">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          <span className="text-xs font-medium">Active</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center text-gray-400 dark:text-gray-500">
                          <XCircle className="w-4 h-4 mr-1" />
                          <span className="text-xs font-medium">Inactive</span>
                        </div>
                      )}
                    </td>

                    {/* Success Rate */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center">
                        {mapping.successCount + mapping.failureCount > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  successRate >= 90 ? 'bg-green-500' :
                                  successRate >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${successRate}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              {successRate}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">No data</span>
                        )}
                      </div>
                    </td>

                    {/* Last Used */}
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(mapping.lastUsedAt)}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditMapping(mapping);
                          }}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                          title="Edit mapping"
                        >
                          <Edit2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMappingStatus(mapping.id, mapping.isActive);
                          }}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            mapping.isActive
                              ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300'
                              : 'bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900 dark:hover:bg-green-800 dark:text-green-300'
                          }`}
                        >
                          {mapping.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMapping(mapping.id);
                          }}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                          title="Delete mapping"
                        >
                          <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
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
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Database className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Data Source Mappings</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Configure API-to-entity mappings to enable data synchronization
          </p>
          <button
            onClick={handleAddMapping}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Your First Mapping
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {selectedMapping ? 'Edit Data Source Mapping' : 'Add New Data Source Mapping'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Entity Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Entity Type
                </label>
                <select
                  value={formData.entityType}
                  onChange={(e) => setFormData({ ...formData, entityType: e.target.value })}
                  disabled={!!selectedMapping}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                >
                  {ENTITY_TYPES.map(entity => (
                    <option key={entity.type} value={entity.type}>{entity.label}</option>
                  ))}
                </select>
                {selectedMapping && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Entity type cannot be changed for existing mappings
                  </p>
                )}
              </div>

              {/* API Configuration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Configuration
                </label>
                <select
                  value={formData.apiConfigId}
                  onChange={(e) => setFormData({ ...formData, apiConfigId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="">Select API Configuration...</option>
                  {apiConfigs.map(api => (
                    <option key={api.id} value={api.id}>
                      {api.name} ({api.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Priority
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  placeholder="1"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  1 = Primary source, 2+ = Fallback sources (lower priority number = higher priority)
                </p>
              </div>

              {/* Organization Scope */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Scope
                </label>
                <select
                  value={formData.organizationId || 'global'}
                  onChange={(e) => setFormData({ ...formData, organizationId: e.target.value === 'global' ? null : e.target.value })}
                  disabled={!!selectedMapping}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                >
                  <option value="global">Global (All Organizations)</option>
                  <option value={currentOrganizationId || ''}>Current Organization Only</option>
                </select>
                {selectedMapping && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Scope cannot be changed for existing mappings
                  </p>
                )}
              </div>

              {/* Is Active */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Active
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                disabled={isSaving}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMapping}
                disabled={isSaving || !formData.apiConfigId}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {selectedMapping ? 'Update Mapping' : 'Create Mapping'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
