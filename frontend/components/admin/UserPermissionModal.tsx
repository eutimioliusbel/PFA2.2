// components/admin/UserPermissionModal.tsx
/**
 * User Permission Modal Component
 *
 * Phase 6, Task 6.1 of ADR-005 Multi-Tenant Access Control
 *
 * AI-powered permission assignment modal that:
 * - Fetches permission suggestions based on role/department
 * - Displays confidence indicator and reasoning
 * - Shows security warnings for sensitive permissions
 * - Allows manual override of AI suggestions
 */

import { useState, useCallback } from 'react';
import {
  Lightbulb,
  AlertTriangle,
  Shield,
  Users,
  Eye,
  Edit,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Save,
  Settings,
  Bell,
  UserCheck,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface UserPermissionModalProps {
  userId: string;
  username: string;
  organizationId: string;
  organizationName: string;
  existingPermissions?: Record<string, boolean>;
  existingRole?: string;
  onSave: (permissions: Record<string, boolean>, role: string) => void;
  onClose: () => void;
}

interface SecurityWarning {
  capability: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
}

interface AISuggestion {
  id?: string;
  suggestedRole: string;
  suggestedCapabilities: Record<string, boolean>;
  confidence: number;
  reasoning: string;
  basedOnUsers: number;
  securityWarnings: SecurityWarning[];
}

// Permission definitions with icons and descriptions
const PERMISSION_DEFINITIONS = [
  {
    key: 'perm_Read',
    label: 'Read Data',
    description: 'View PFA records and reports',
    icon: Eye,
    category: 'Data Scope',
    risk: 'LOW',
  },
  {
    key: 'perm_EditForecast',
    label: 'Edit Forecasts',
    description: 'Modify forecast dates and values',
    icon: Edit,
    category: 'Data Scope',
    risk: 'LOW',
  },
  {
    key: 'perm_EditActuals',
    label: 'Edit Actuals',
    description: 'Modify actualized data (affects billing)',
    icon: Edit,
    category: 'Data Scope',
    risk: 'MEDIUM',
  },
  {
    key: 'perm_Delete',
    label: 'Delete Records',
    description: 'Permanently remove PFA records',
    icon: Trash2,
    category: 'Data Scope',
    risk: 'HIGH',
  },
  {
    key: 'perm_Import',
    label: 'Import Data',
    description: 'Upload bulk data via CSV/Excel',
    icon: Upload,
    category: 'Operations',
    risk: 'MEDIUM',
  },
  {
    key: 'perm_RefreshData',
    label: 'Refresh Data',
    description: 'Trigger data refresh from source',
    icon: RefreshCw,
    category: 'Operations',
    risk: 'LOW',
  },
  {
    key: 'perm_Export',
    label: 'Export Data',
    description: 'Download data as CSV/Excel',
    icon: Download,
    category: 'Operations',
    risk: 'LOW',
  },
  {
    key: 'perm_ViewFinancials',
    label: 'View Financials',
    description: 'See cost data and financial details',
    icon: Shield,
    category: 'Financials',
    risk: 'MEDIUM',
  },
  {
    key: 'perm_SaveDraft',
    label: 'Save Drafts',
    description: 'Save changes as uncommitted drafts',
    icon: Save,
    category: 'Process',
    risk: 'LOW',
  },
  {
    key: 'perm_Sync',
    label: 'Sync to PEMS',
    description: 'Push changes to external PEMS system',
    icon: RefreshCw,
    category: 'Process',
    risk: 'MEDIUM',
  },
  {
    key: 'perm_ManageUsers',
    label: 'Manage Users',
    description: 'Add, edit, and remove users',
    icon: Users,
    category: 'Admin',
    risk: 'HIGH',
  },
  {
    key: 'perm_ManageSettings',
    label: 'Manage Settings',
    description: 'Configure organization settings',
    icon: Settings,
    category: 'Admin',
    risk: 'HIGH',
  },
  {
    key: 'perm_ConfigureAlerts',
    label: 'Configure Alerts',
    description: 'Set up monitoring and notifications',
    icon: Bell,
    category: 'Admin',
    risk: 'LOW',
  },
  {
    key: 'perm_Impersonate',
    label: 'Impersonate Users',
    description: 'Act as another user (audit logged)',
    icon: UserCheck,
    category: 'Admin',
    risk: 'CRITICAL',
  },
];

// Available roles
const ROLES = [
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
  { value: 'member', label: 'Member', description: 'Basic read and export' },
  { value: 'editor', label: 'Editor', description: 'Can edit forecasts' },
  { value: 'beo', label: 'BEO User', description: 'Financial visibility' },
  { value: 'admin', label: 'Admin', description: 'Full access' },
];

export function UserPermissionModal({
  userId,
  username,
  organizationId,
  organizationName,
  existingPermissions,
  existingRole,
  onSave,
  onClose,
}: UserPermissionModalProps) {
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [role, setRole] = useState(existingRole || '');
  const [department, setDepartment] = useState('');
  const [selectedRole, setSelectedRole] = useState(existingRole || 'viewer');
  const [permissions, setPermissions] = useState<Record<string, boolean>>(
    existingPermissions || {
      perm_Read: true,
      perm_EditForecast: false,
      perm_EditActuals: false,
      perm_Delete: false,
      perm_Import: false,
      perm_RefreshData: false,
      perm_Export: false,
      perm_ViewFinancials: false,
      perm_SaveDraft: false,
      perm_Sync: false,
      perm_ManageUsers: false,
      perm_ManageSettings: false,
      perm_ConfigureAlerts: false,
      perm_Impersonate: false,
    }
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  // Group permissions by category
  const permissionsByCategory = PERMISSION_DEFINITIONS.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, typeof PERMISSION_DEFINITIONS>);

  // Fetch AI suggestion when role/department changes
  const fetchSuggestion = useCallback(async () => {
    if (!role && !department) return;

    setLoadingSuggestion(true);
    setSuggestionError(null);

    try {
      const result = await apiClient.suggestPermissions({
        userId,
        organizationId,
        role: role || undefined,
        department: department || undefined,
      });
      setSuggestion(result);
    } catch (error: any) {
      console.error('Failed to fetch AI suggestion:', error);
      setSuggestionError(error.message || 'Failed to generate suggestion');
    } finally {
      setLoadingSuggestion(false);
    }
  }, [userId, organizationId, role, department]);

  // Apply AI suggestion
  const applySuggestion = useCallback(() => {
    if (!suggestion) return;

    setSelectedRole(suggestion.suggestedRole);
    setPermissions(suggestion.suggestedCapabilities);

    // Log suggestion acceptance
    if (suggestion.id) {
      apiClient.acceptSuggestion({
        suggestionId: suggestion.id,
        accepted: true,
        actualPermissions: suggestion.suggestedCapabilities,
      }).catch(err => console.error('Failed to log acceptance:', err));
    }
  }, [suggestion]);

  // Handle save
  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(permissions, selectedRole);
    } finally {
      setSaving(false);
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.85) return 'text-green-600 bg-green-50';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-50';
    return 'text-orange-600 bg-orange-50';
  };

  // Get risk badge color
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Assign Permissions
            </h2>
            <p className="text-sm text-gray-600">
              {username} - {organizationName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* User Info Inputs */}
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Role
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                onBlur={fetchSuggestion}
                placeholder="e.g., Project Manager"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                onBlur={fetchSuggestion}
                placeholder="e.g., Construction"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* AI Suggestion Loading */}
          {loadingSuggestion && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
                <span className="text-blue-700 font-medium">
                  Analyzing similar users...
                </span>
              </div>
            </div>
          )}

          {/* AI Suggestion Error */}
          {suggestionError && (
            <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <span className="text-red-700">{suggestionError}</span>
              </div>
            </div>
          )}

          {/* AI Suggestion Panel */}
          {suggestion && !loadingSuggestion && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-blue-900">
                      AI Suggestion
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${getConfidenceColor(
                        suggestion.confidence
                      )}`}
                    >
                      {(suggestion.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>

                  <p className="text-sm text-blue-700 mb-3">
                    {suggestion.reasoning}
                  </p>

                  <div className="mb-3">
                    <p className="text-xs text-blue-600 mb-2">
                      Recommended Role:{' '}
                      <span className="font-semibold capitalize">
                        {suggestion.suggestedRole}
                      </span>{' '}
                      (based on {suggestion.basedOnUsers} similar users)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(suggestion.suggestedCapabilities)
                        .filter(([_, value]) => value === true)
                        .map(([cap]) => (
                          <span
                            key={cap}
                            className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                          >
                            {cap.replace('perm_', '')}
                          </span>
                        ))}
                    </div>
                  </div>

                  {/* Security Warnings */}
                  {suggestion.securityWarnings.length > 0 && (
                    <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-yellow-800 mb-2">
                            Security Warnings:
                          </p>
                          <ul className="text-xs text-yellow-700 space-y-1">
                            {suggestion.securityWarnings.map((warning, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-xs font-medium ${getRiskColor(
                                    warning.risk
                                  )}`}
                                >
                                  {warning.risk}
                                </span>
                                <span>
                                  <strong>
                                    {warning.capability.replace('perm_', '')}
                                  </strong>
                                  : {warning.message}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={applySuggestion}
                    className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
                  >
                    Apply AI Suggestion
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Role Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role Template
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label} - {r.description}
                </option>
              ))}
            </select>
          </div>

          {/* Permission Checkboxes */}
          <div className="mb-4">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              Advanced Permissions ({Object.values(permissions).filter(Boolean).length} enabled)
            </button>
          </div>

          {showAdvanced && (
            <div className="space-y-6">
              {Object.entries(permissionsByCategory).map(
                ([category, perms]) => (
                  <div key={category}>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">
                      {category}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {perms.map((perm) => {
                        const Icon = perm.icon;
                        return (
                          <label
                            key={perm.key}
                            className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                              permissions[perm.key]
                                ? 'bg-blue-50 border-blue-300'
                                : 'bg-white border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={permissions[perm.key] || false}
                              onChange={(e) =>
                                setPermissions({
                                  ...permissions,
                                  [perm.key]: e.target.checked,
                                })
                              }
                              className="mt-1"
                            />
                            <Icon
                              className={`w-5 h-5 flex-shrink-0 ${
                                permissions[perm.key]
                                  ? 'text-blue-600'
                                  : 'text-gray-400'
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-gray-900">
                                  {perm.label}
                                </span>
                                {perm.risk !== 'LOW' && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-xs ${getRiskColor(
                                      perm.risk
                                    )}`}
                                  >
                                    {perm.risk}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {perm.description}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            )}
            Save Permissions
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserPermissionModal;
