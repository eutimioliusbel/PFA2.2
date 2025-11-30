/**
 * @file ServerFormModal.tsx
 * @description Server creation/editing modal with security best practices
 * Implements: Write-only credentials, Test Connection, Impact Warning
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Server,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Shield,
  Eye,
  EyeOff
} from 'lucide-react';

// API Base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface ServerFormData {
  name: string;
  baseUrl: string;
  description?: string;
  tenant?: string;
  authType: 'basic' | 'bearer' | 'apiKey' | 'none';
  authKey?: string;
  authValue?: string;
  commonHeaders?: Record<string, string>;
  status?: 'active' | 'inactive' | 'maintenance';
}

interface ApiServer extends ServerFormData {
  id: string;
  organizationId: string;
  hasCredentials: boolean;
  healthStatus: string;
  healthScore: number;
  totalEndpoints: number;
  endpoints?: any[];
  createdAt: string;
  updatedAt: string;
}

interface ServerFormModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  server?: ApiServer | null;
  onClose: () => void;
  onSave: (data: ServerFormData) => Promise<void>;
}

export const ServerFormModal: React.FC<ServerFormModalProps> = ({
  isOpen,
  mode,
  server,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState<ServerFormData>({
    name: '',
    baseUrl: '',
    description: '',
    tenant: '',
    authType: 'basic',
    authKey: '',
    authValue: '',
    status: 'active'
  });

  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [connectionTested, setConnectionTested] = useState(false);
  const [showImpactWarning, setShowImpactWarning] = useState(false);
  const [criticalFieldsChanged, setCriticalFieldsChanged] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form data
  useEffect(() => {
    if (mode === 'edit' && server) {
      // Extract tenant from commonHeaders if it exists
      let tenant = '';
      if (server.commonHeaders) {
        try {
          const headers = typeof server.commonHeaders === 'string'
            ? JSON.parse(server.commonHeaders)
            : server.commonHeaders;
          tenant = headers.tenant || '';
        } catch (error) {
          console.error('Failed to parse commonHeaders:', error);
        }
      }

      setFormData({
        name: server.name,
        baseUrl: server.baseUrl,
        description: server.description || '',
        tenant: tenant,
        authType: server.authType,
        authKey: '', // Write-only: never populate with actual value
        authValue: '', // Write-only: never populate with actual value
        status: server.status || 'active'
      });
      setConnectionTested(true); // Existing server already tested
      setCriticalFieldsChanged(false);
    } else {
      setFormData({
        name: '',
        baseUrl: '',
        description: '',
        tenant: '',
        authType: 'basic',
        authKey: '',
        authValue: '',
        status: 'active'
      });
      setConnectionTested(false);
      setCriticalFieldsChanged(false);
    }
    setTestResult(null);
    setErrors({});
  }, [isOpen, mode, server]);

  // Track critical field changes
  const handleChange = (field: keyof ServerFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Critical fields that require connection test
    if (['baseUrl', 'authType', 'authKey', 'authValue'].includes(field)) {
      setConnectionTested(false);
      setCriticalFieldsChanged(true);
      setTestResult(null);
    }

    // Clear field error
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Server name is required';
    }

    if (!formData.baseUrl.trim()) {
      newErrors.baseUrl = 'Base URL is required';
    } else {
      try {
        new URL(formData.baseUrl);
      } catch {
        newErrors.baseUrl = 'Invalid URL format';
      }
    }

    if (formData.authType !== 'none') {
      if (mode === 'add') {
        if (!formData.authKey?.trim()) {
          newErrors.authKey = 'Username/Key is required';
        }
        if (!formData.authValue?.trim()) {
          newErrors.authValue = 'Password/Token is required';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Test Connection
  const handleTestConnection = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);

      const token = localStorage.getItem('pfa_auth_token');
      const response = await fetch(`${API_BASE_URL}/api/servers/test-connection`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          baseUrl: formData.baseUrl,
          authType: formData.authType,
          authKey: formData.authKey || undefined,
          authValue: formData.authValue || undefined
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setTestResult({
          success: true,
          message: 'Connection successful'
        });
        setConnectionTested(true);
      } else {
        setTestResult({
          success: false,
          message: result.message || 'Connection failed'
        });
        setConnectionTested(false);
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || 'Connection test failed'
      });
      setConnectionTested(false);
    } finally {
      setTesting(false);
    }
  };

  // Check if should show impact warning
  const shouldShowImpactWarning = (): boolean => {
    if (mode === 'add') return false;
    if (!server) return false;

    const hasMultipleEndpoints = (server.totalEndpoints || 0) > 3;
    const criticalChange = criticalFieldsChanged;

    return hasMultipleEndpoints && criticalChange;
  };

  // Handle Save
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    // Require connection test for critical changes
    if (criticalFieldsChanged && !connectionTested) {
      setErrors({ baseUrl: 'Please test the connection before saving' });
      return;
    }

    // Show impact warning if needed
    if (shouldShowImpactWarning()) {
      setShowImpactWarning(true);
      return;
    }

    await performSave();
  };

  // Perform actual save
  const performSave = async () => {
    try {
      setSaving(true);

      // Build common headers object (tenant is stored here, not as separate field)
      const commonHeaders: Record<string, string> = {};
      if (formData.tenant && formData.tenant.trim()) {
        commonHeaders['tenant'] = formData.tenant.trim();
      }

      // Build save data
      const saveData: ServerFormData = {
        name: formData.name,
        baseUrl: formData.baseUrl,
        description: formData.description,
        authType: formData.authType,
        status: formData.status,
        commonHeaders: Object.keys(commonHeaders).length > 0 ? commonHeaders : undefined
      };

      // Write-only pattern: Only include credentials if explicitly provided
      if (formData.authKey && formData.authKey.trim()) {
        saveData.authKey = formData.authKey;
      }
      if (formData.authValue && formData.authValue.trim()) {
        saveData.authValue = formData.authValue;
      }

      await onSave(saveData);
      onClose();
    } catch (error: any) {
      setErrors({ submit: error.message || 'Failed to save server' });
    } finally {
      setSaving(false);
      setShowImpactWarning(false);
    }
  };

  if (!isOpen) return null;

  // Impact Warning Modal (renders on top)
  if (showImpactWarning) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center space-x-3 text-amber-400 mb-4">
            <AlertTriangle className="w-6 h-6" />
            <h3 className="text-lg font-semibold text-slate-100">Confirm High-Risk Change</h3>
          </div>

          <div className="space-y-3 mb-6">
            <p className="text-slate-300">
              You are modifying <strong>{server?.name}</strong> which affects:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 text-sm">
              <li><strong>{server?.totalEndpoints || 0} endpoints</strong> that depend on this server</li>
              <li>Active data syncs and API operations</li>
              <li>Production integrations (PEMS, ESS, etc.)</li>
            </ul>
            <p className="text-slate-300 font-medium">
              Are you sure you want to continue?
            </p>
          </div>

          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={() => setShowImpactWarning(false)}
              className="px-4 py-2 text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={performSave}
              disabled={saving}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? (
                <span className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating...</span>
                </span>
              ) : (
                'Yes, Update Server'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main Form Modal
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Server className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-100">
              {mode === 'add' ? 'Add API Server' : 'Edit API Server'}
            </h2>
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
          {/* Server Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Server Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="PEMS Production"
              className={`w-full px-3 py-2 border rounded-lg bg-slate-900 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.name ? 'border-red-500/50' : 'border-slate-600'
              }`}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Base URL *
            </label>
            <input
              type="url"
              value={formData.baseUrl}
              onChange={(e) => handleChange('baseUrl', e.target.value)}
              placeholder="https://pems.example.com:443/axis/restservices"
              className={`w-full px-3 py-2 border rounded-lg bg-slate-900 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm ${
                errors.baseUrl ? 'border-red-500/50' : 'border-slate-600'
              }`}
            />
            {errors.baseUrl && (
              <p className="mt-1 text-sm text-red-400">{errors.baseUrl}</p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Endpoint paths will be appended to this base URL
            </p>
          </div>

          {/* Tenant */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Tenant
            </label>
            <input
              type="text"
              value={formData.tenant}
              onChange={(e) => handleChange('tenant', e.target.value)}
              placeholder="BECHTEL_DEV"
              className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-900 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-slate-400">
              Optional tenant identifier for multi-tenant APIs (e.g., PEMS tenant code)
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
              placeholder="Production PEMS server for Bechtel projects"
              rows={2}
              className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-900 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Auth Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Authentication Type *
            </label>
            <select
              value={formData.authType}
              onChange={(e) => handleChange('authType', e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-900 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="basic">Basic (Username/Password)</option>
              <option value="bearer">Bearer Token</option>
              <option value="apiKey">API Key</option>
              <option value="none">None</option>
            </select>
          </div>

          {/* Credentials (if auth type requires it) */}
          {formData.authType !== 'none' && (
            <div className="border border-slate-600 rounded-lg p-4 bg-slate-900 space-y-4">
              <div className="flex items-center space-x-2 text-slate-300">
                <Shield className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Credentials
                  {mode === 'edit' && server?.hasCredentials && (
                    <span className="ml-2 text-xs text-slate-400">(leave blank to keep existing)</span>
                  )}
                </span>
              </div>

              {/* Username/Key */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {formData.authType === 'basic' ? 'Username' :
                   formData.authType === 'bearer' ? 'Token' : 'API Key'}
                  {mode === 'add' && ' *'}
                </label>
                <input
                  type="text"
                  value={formData.authKey}
                  onChange={(e) => handleChange('authKey', e.target.value)}
                  placeholder={
                    mode === 'edit'
                      ? '[UNCHANGED]'
                      : formData.authType === 'basic' ? 'username' : 'key'
                  }
                  className={`w-full px-3 py-2 border rounded-lg bg-slate-800 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.authKey ? 'border-red-500/50' : 'border-slate-600'
                  }`}
                />
                {errors.authKey && (
                  <p className="mt-1 text-sm text-red-400">{errors.authKey}</p>
                )}
              </div>

              {/* Password/Value */}
              {formData.authType !== 'apiKey' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    {formData.authType === 'basic' ? 'Password' : 'Token Value'}
                    {mode === 'add' && ' *'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.authValue}
                      onChange={(e) => handleChange('authValue', e.target.value)}
                      placeholder={mode === 'edit' ? '[UNCHANGED]' : '••••••••'}
                      className={`w-full px-3 py-2 pr-10 border rounded-lg bg-slate-800 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.authValue ? 'border-red-500/50' : 'border-slate-600'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.authValue && (
                    <p className="mt-1 text-sm text-red-400">{errors.authValue}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-900 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          {/* Test Connection Section */}
          {criticalFieldsChanged && (
            <div className="border border-amber-500/40 bg-amber-500/10 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-200 mb-2">
                    Critical fields changed - Test connection before saving
                  </p>
                  <button
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="inline-flex items-center px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4 mr-2" />
                        Test Connection
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Test Result */}
              {testResult && (
                <div className={`mt-3 p-3 rounded-lg ${
                  testResult.success
                    ? 'bg-green-500/20 border border-green-500/40'
                    : 'bg-red-500/20 border border-red-500/40'
                }`}>
                  <div className="flex items-center space-x-2">
                    {testResult.success ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    )}
                    <span className={`text-sm font-medium ${
                      testResult.success ? 'text-green-200' : 'text-red-200'
                    }`}>
                      {testResult.message}
                    </span>
                  </div>
                </div>
              )}
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
            disabled={saving || (criticalFieldsChanged && !connectionTested)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </span>
            ) : (
              mode === 'add' ? 'Add Server' : 'Update Server'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServerFormModal;
