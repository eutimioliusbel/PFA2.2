/**
 * @file EndpointFormModal.tsx
 * @description Endpoint creation/editing modal
 * Simpler than ServerFormModal since endpoint changes have lower blast radius
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  Loader2,
  AlertTriangle,
  Plus,
  Trash2,
  Shield
} from 'lucide-react';
import { PromotionRulesEditor } from './PromotionRulesEditor';

interface EndpointFormData {
  name: string;
  path: string;
  description?: string;
  entity: string;
  operationType: string;
  method?: string;
  customHeaders?: Record<string, string>;
  defaultParams?: Record<string, string>;
  promotionRules?: any;
  isActive?: boolean;
  refreshFrequencyMinutes?: number;
  autoRefreshEnabled?: boolean;
}

interface ApiEndpoint extends EndpointFormData {
  id: string;
  serverId: string;
  status: string;
  testCount: number;
  successCount: number;
  failureCount: number;
  avgResponseTimeMs?: number;
  lastErrorMessage?: string;
}

interface EndpointFormModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  serverId: string;
  serverName?: string;
  endpoint?: ApiEndpoint | null;
  onClose: () => void;
  onSave: (data: EndpointFormData) => Promise<void>;
}

// Common entity types
const ENTITY_OPTIONS = [
  { value: 'asset_master', label: 'Asset Master' },
  { value: 'users', label: 'Users' },
  { value: 'categories', label: 'Categories' },
  { value: 'organizations', label: 'Organizations' },
  { value: 'manufacturers', label: 'Manufacturers' },
  { value: 'pfa', label: 'PFA Records' },
  { value: 'work_orders', label: 'Work Orders' },
  { value: 'other', label: 'Other' }
];

// Common operation types
const OPERATION_OPTIONS = [
  { value: 'read', label: 'Read (GET)' },
  { value: 'write', label: 'Write (POST/PUT)' },
  { value: 'delete', label: 'Delete (DELETE)' },
  { value: 'sync', label: 'Sync (Bidirectional)' }
];

export const EndpointFormModal: React.FC<EndpointFormModalProps> = ({
  isOpen,
  mode,
  serverId: _serverId,
  serverName,
  endpoint,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState<EndpointFormData>({
    name: '',
    path: '',
    description: '',
    entity: 'asset_master',
    operationType: 'read',
    method: 'GET',
    isActive: true,
    refreshFrequencyMinutes: undefined,
    autoRefreshEnabled: false,
    defaultParams: {},
    promotionRules: {}
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Custom headers management (as array of {key, value} for UI)
  const [customHeaders, setCustomHeaders] = useState<Array<{key: string; value: string}>>([]);

  // Default params management (as array of {key, value} for UI)
  const [defaultParams, setDefaultParams] = useState<Array<{key: string; value: string}>>([]);

  // Promotion rules editor modal
  const [showPromotionRulesEditor, setShowPromotionRulesEditor] = useState(false);

  // Initialize form data
  useEffect(() => {
    if (mode === 'edit' && endpoint) {
      setFormData({
        name: endpoint.name,
        path: endpoint.path,
        description: endpoint.description || '',
        entity: endpoint.entity,
        operationType: endpoint.operationType,
        method: endpoint.method || 'GET',
        isActive: endpoint.isActive,
        refreshFrequencyMinutes: endpoint.refreshFrequencyMinutes,
        autoRefreshEnabled: endpoint.autoRefreshEnabled || false,
        promotionRules: endpoint.promotionRules || {}
      });

      // Convert customHeaders Record to Array for UI
      if (endpoint.customHeaders) {
        try {
          // Parse JSON string if needed
          const headers = typeof endpoint.customHeaders === 'string'
            ? JSON.parse(endpoint.customHeaders)
            : endpoint.customHeaders;

          setCustomHeaders(
            Object.entries(headers).map(([key, value]) => ({ key, value: String(value) }))
          );
        } catch (error) {
          console.error('Failed to parse customHeaders:', error);
          setCustomHeaders([]);
        }
      } else {
        setCustomHeaders([]);
      }

      // Convert defaultParams Record to Array for UI
      if (endpoint.defaultParams) {
        try {
          // Parse JSON if needed
          const params = typeof endpoint.defaultParams === 'string'
            ? JSON.parse(endpoint.defaultParams)
            : endpoint.defaultParams;

          setDefaultParams(
            Object.entries(params).map(([key, value]) => ({ key, value: String(value) }))
          );
        } catch (error) {
          console.error('Failed to parse defaultParams:', error);
          setDefaultParams([]);
        }
      } else {
        setDefaultParams([]);
      }
    } else {
      setFormData({
        name: '',
        path: '',
        description: '',
        entity: 'asset_master',
        operationType: 'read',
        method: 'GET',
        isActive: true,
        refreshFrequencyMinutes: undefined,
        autoRefreshEnabled: false,
        defaultParams: {},
        promotionRules: {}
      });
      setCustomHeaders([]);
      setDefaultParams([]);
    }
    setErrors({});
  }, [isOpen, mode, endpoint]);

  // Handle field changes
  const handleChange = (field: keyof EndpointFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  // Custom header management functions
  const addHeader = () => {
    setCustomHeaders([...customHeaders, { key: '', value: '' }]);
  };

  const removeHeader = (index: number) => {
    setCustomHeaders(customHeaders.filter((_, i) => i !== index));
  };

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customHeaders];
    updated[index][field] = value;
    setCustomHeaders(updated);
  };

  // Default params management functions
  const addParam = () => {
    setDefaultParams([...defaultParams, { key: '', value: '' }]);
  };

  const removeParam = (index: number) => {
    setDefaultParams(defaultParams.filter((_, i) => i !== index));
  };

  const updateParam = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...defaultParams];
    updated[index][field] = value;
    setDefaultParams(updated);
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Endpoint name is required';
    }

    if (!formData.path.trim()) {
      newErrors.path = 'Endpoint path is required';
    } else {
      // Validate path format
      if (!formData.path.startsWith('/')) {
        newErrors.path = 'Path must start with /';
      }
      // Check for path traversal attempts
      if (formData.path.includes('..')) {
        newErrors.path = 'Path traversal not allowed';
      }
    }

    if (!formData.entity) {
      newErrors.entity = 'Entity type is required';
    }

    if (!formData.operationType) {
      newErrors.operationType = 'Operation type is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle Save
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);

      // Convert custom headers array to Record<string, string>
      const headersObj: Record<string, string> = {};
      customHeaders.forEach(({ key, value }) => {
        if (key.trim() && value.trim()) {
          headersObj[key.trim()] = value.trim();
        }
      });

      // Convert default params array to Record<string, string>
      const paramsObj: Record<string, string> = {};
      defaultParams.forEach(({ key, value }) => {
        if (key.trim() && value.trim()) {
          paramsObj[key.trim()] = value.trim();
        }
      });

      await onSave({
        ...formData,
        customHeaders: Object.keys(headersObj).length > 0 ? headersObj : undefined,
        defaultParams: Object.keys(paramsObj).length > 0 ? paramsObj : undefined
      });
      onClose();
    } catch (error: any) {
      setErrors({ submit: error.message || 'Failed to save endpoint' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Database className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-100">
                {mode === 'add' ? 'Add Endpoint' : 'Edit Endpoint'}
              </h2>
              {serverName && (
                <p className="text-sm text-slate-400 mt-0.5">Server: {serverName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Endpoint Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Endpoint Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Assets"
              className={`w-full px-3 py-2 border rounded-lg bg-slate-900 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.name ? 'border-red-500/50' : 'border-slate-600'
              }`}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Endpoint Path */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Endpoint Path *
            </label>
            <input
              type="text"
              value={formData.path}
              onChange={(e) => handleChange('path', e.target.value)}
              placeholder="/assets"
              className={`w-full px-3 py-2 border rounded-lg bg-slate-900 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm ${
                errors.path ? 'border-red-500/50' : 'border-slate-600'
              }`}
            />
            {errors.path && (
              <p className="mt-1 text-sm text-red-400">{errors.path}</p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Path will be appended to server base URL. Must start with /
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Retrieves asset master data from PEMS"
              rows={2}
              className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-900 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Entity Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Entity Type *
            </label>
            <select
              value={formData.entity}
              onChange={(e) => handleChange('entity', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg bg-slate-900 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.entity ? 'border-red-500/50' : 'border-slate-600'
              }`}
            >
              {ENTITY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.entity && (
              <p className="mt-1 text-sm text-red-400">{errors.entity}</p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Used for Data Source Mappings and UI display
            </p>
          </div>

          {/* Operation Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Operation Type *
            </label>
            <select
              value={formData.operationType}
              onChange={(e) => handleChange('operationType', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg bg-slate-900 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.operationType ? 'border-red-500/50' : 'border-slate-600'
              }`}
            >
              {OPERATION_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.operationType && (
              <p className="mt-1 text-sm text-red-400">{errors.operationType}</p>
            )}
          </div>

          {/* Custom Headers */}
          <div className="border border-slate-600 rounded-lg p-4 bg-slate-900/50">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Custom Headers
                </label>
                <p className="mt-1 text-xs text-slate-400">
                  Endpoint-specific headers (e.g., gridId, gridCode for PEMS)
                </p>
              </div>
              <button
                type="button"
                onClick={addHeader}
                className="inline-flex items-center px-3 py-1.5 text-sm bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Header
              </button>
            </div>

            {customHeaders.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-2">
                No custom headers defined
              </p>
            ) : (
              <div className="space-y-2">
                {customHeaders.map((header, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={header.key}
                      onChange={(e) => updateHeader(index, 'key', e.target.value)}
                      placeholder="Header name (e.g., gridId)"
                      className="flex-1 px-3 py-2 border border-slate-600 rounded-lg bg-slate-800 text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="text"
                      value={header.value}
                      onChange={(e) => updateHeader(index, 'value', e.target.value)}
                      placeholder="Value (e.g., 100541)"
                      className="flex-1 px-3 py-2 border border-slate-600 rounded-lg bg-slate-800 text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => removeHeader(index)}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                      title="Remove header"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Source Filters (Default Params) */}
          <div className="border border-cyan-500/40 rounded-lg p-4 bg-cyan-500/10">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Source Filters (Query Parameters)
                </label>
                <p className="mt-1 text-xs text-slate-400">
                  Filters applied at PEMS source to reduce bandwidth (e.g., status=ACTIVE)
                </p>
              </div>
              <button
                type="button"
                onClick={addParam}
                className="inline-flex items-center px-3 py-1.5 text-sm bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Parameter
              </button>
            </div>

            {defaultParams.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-2">
                No source filters defined
              </p>
            ) : (
              <div className="space-y-2">
                {defaultParams.map((param, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={param.key}
                      onChange={(e) => updateParam(index, 'key', e.target.value)}
                      placeholder="Parameter name (e.g., status)"
                      className="flex-1 px-3 py-2 border border-slate-600 rounded-lg bg-slate-800 text-slate-100 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                    <input
                      type="text"
                      value={param.value}
                      onChange={(e) => updateParam(index, 'value', e.target.value)}
                      placeholder="Value (e.g., ACTIVE)"
                      className="flex-1 px-3 py-2 border border-slate-600 rounded-lg bg-slate-800 text-slate-100 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => removeParam(index)}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                      title="Remove parameter"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Promotion Rules (Quality Gate) */}
          <div className="border border-purple-500/40 rounded-lg p-4 bg-purple-500/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-purple-400" />
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Promotion Rules (Quality Gate)
                  </label>
                  <p className="mt-1 text-xs text-slate-400">
                    Define rules to filter Bronze → Silver promotion
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPromotionRulesEditor(true)}
                className="inline-flex items-center px-3 py-1.5 text-sm bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
              >
                <Shield className="w-4 h-4 mr-1" />
                Configure Rules
              </button>
            </div>
            {formData.promotionRules && Object.keys(formData.promotionRules).length > 0 ? (
              <div className="mt-3 p-2 bg-slate-800 rounded border border-purple-500/40">
                <p className="text-xs text-slate-400 font-mono">
                  {JSON.stringify(formData.promotionRules)}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400 italic">
                No promotion rules configured (all records will be promoted)
              </p>
            )}
          </div>

          {/* HTTP Method */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              HTTP Method
            </label>
            <select
              value={formData.method}
              onChange={(e) => handleChange('method', e.target.value)}
              className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-900 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>

          {/* Active Status */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => handleChange('isActive', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-slate-600 rounded focus:ring-blue-500 bg-slate-800"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-slate-300">
              Endpoint is active
            </label>
          </div>

          {/* Refresh Frequency */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Refresh Frequency (minutes)
            </label>
            <select
              value={formData.refreshFrequencyMinutes || ''}
              onChange={(e) => handleChange('refreshFrequencyMinutes', e.target.value ? Number(e.target.value) : undefined)}
              className="w-full p-2 border border-slate-600 rounded-lg bg-slate-900 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Manual Only</option>
              <option value="5">Every 5 minutes</option>
              <option value="15">Every 15 minutes</option>
              <option value="30">Every 30 minutes</option>
              <option value="60">Every hour</option>
              <option value="240">Every 4 hours</option>
              <option value="1440">Daily</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">
              How often this endpoint should be refreshed automatically
            </p>
          </div>

          {/* Auto-Refresh Toggle */}
          {formData.refreshFrequencyMinutes && (
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="autoRefreshEnabled"
                checked={formData.autoRefreshEnabled}
                onChange={(e) => handleChange('autoRefreshEnabled', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-slate-600 rounded focus:ring-blue-500 bg-slate-800"
              />
              <label htmlFor="autoRefreshEnabled" className="text-sm font-medium text-slate-300">
                Enable automatic refresh
              </label>
            </div>
          )}

          {/* Path Validation Warning */}
          {formData.path && (formData.path.includes('..') || !formData.path.startsWith('/')) && (
            <div className="bg-red-500/20 border border-red-500/40 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" />
                <div className="text-sm text-red-300">
                  <p className="font-medium">Invalid path format</p>
                  <p className="mt-1">
                    {!formData.path.startsWith('/') && 'Path must start with /. '}
                    {formData.path.includes('..') && 'Path traversal (../) is not allowed for security reasons.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-500/20 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg">
              <p className="text-sm">{errors.submit}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-700 bg-slate-900">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </span>
            ) : (
              mode === 'add' ? 'Add Endpoint' : 'Update Endpoint'
            )}
          </button>
        </div>
      </div>

      {/* Promotion Rules Editor Modal */}
      {showPromotionRulesEditor && endpoint && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <PromotionRulesEditor
                endpoint={{
                  id: endpoint.id,
                  name: formData.name,
                  entity: formData.entity,
                  promotionRules: formData.promotionRules
                }}
                onSave={async (updatedEndpoint) => {
                  setFormData(prev => ({
                    ...prev,
                    promotionRules: updatedEndpoint.promotionRules
                  }));
                  setShowPromotionRulesEditor(false);
                }}
                onClose={() => setShowPromotionRulesEditor(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EndpointFormModal;
