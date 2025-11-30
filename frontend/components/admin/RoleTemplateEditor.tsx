/**
 * RoleTemplateEditor Component (ADR-005)
 *
 * Permission matrix editor for role templates.
 * Features:
 * - 14 permission toggles organized by category
 * - Capability manager (JSONB editor)
 * - Bulk update modal for existing users
 * - System vs custom role distinction
 */

import { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  AlertCircle,
  Save,
  X,
  Users,
  CheckCircle,
  Settings,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { RoleTemplate, Permissions, PermissionKey, AiFeatures, ScreenKey, ScreenPermissions, SCREEN_CATEGORIES, SCREEN_LABELS } from '../../types';
import { AiFeaturesSection, DEFAULT_AI_FEATURES, countEnabledAiFeatures, getTotalAiFeatures } from './AiFeaturesSection';
import { Monitor } from 'lucide-react';

const PERMISSION_CATEGORIES = {
  'Data Scope': ['perm_Read', 'perm_EditForecast', 'perm_EditActuals', 'perm_Delete'] as PermissionKey[],
  'Data Operations': ['perm_Import', 'perm_RefreshData', 'perm_Export'] as PermissionKey[],
  'Financials': ['perm_ViewFinancials'] as PermissionKey[],
  'Process': ['perm_SaveDraft', 'perm_Sync'] as PermissionKey[],
  'Admin': ['perm_ManageUsers', 'perm_ManageSettings', 'perm_ConfigureAlerts', 'perm_Impersonate', 'perm_UseAiFeatures'] as PermissionKey[],
};

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  perm_Read: 'View PFA Records',
  perm_EditForecast: 'Modify Forecast Dates/Costs',
  perm_EditActuals: 'Modify Actual Dates/Costs',
  perm_Delete: 'Soft Delete PFA Records',
  perm_Import: 'CSV Import',
  perm_RefreshData: 'Trigger PEMS Sync',
  perm_Export: 'Excel Export',
  perm_ViewFinancials: 'See Cost/Budget Data',
  perm_SaveDraft: 'Save Uncommitted Changes',
  perm_Sync: 'Push Changes to PEMS',
  perm_ManageUsers: 'User/Org Management',
  perm_ManageSettings: 'System Configuration',
  perm_ConfigureAlerts: 'Notification Rules',
  perm_Impersonate: '"View As" Other Users',
  perm_UseAiFeatures: 'Use AI Features',
};

export function RoleTemplateEditor() {
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<RoleTemplate | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [bulkUpdateTemplate, setBulkUpdateTemplate] = useState<RoleTemplate | null>(null);
  const [bulkUpdateMode, setBulkUpdateMode] = useState<'all' | 'preserve'>('preserve');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getRoleTemplates();
      setTemplates(response.templates);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load role templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async (template: Partial<RoleTemplate> & { applyToUsers?: boolean }) => {
    try {
      if (selectedTemplate?.id) {
        await apiClient.updateRoleTemplate(selectedTemplate.id, {
          name: template.name,
          description: template.description,
          permissions: template.permissions as Record<string, boolean> | undefined,
          capabilities: template.capabilities,
          applyToUsers: template.applyToUsers,
        });
      } else {
        await apiClient.createRoleTemplate({
          name: template.name!,
          description: template.description,
          permissions: template.permissions as unknown as Record<string, boolean>,
          capabilities: template.capabilities || {},
        });
      }
      setShowEditor(false);
      setSelectedTemplate(null);
      await loadTemplates();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      alert(`Failed to save template: ${message}`);
    }
  };

  const handleDeleteTemplate = async (template: RoleTemplate) => {
    if (template.isSystem) {
      alert('Cannot delete system role templates');
      return;
    }

    if (!confirm(`Delete role template "${template.name}"?`)) {
      return;
    }

    try {
      await apiClient.deleteRoleTemplate(template.id);
      await loadTemplates();
    } catch (err: any) {
      alert(`Failed to delete template: ${err.message}`);
    }
  };

  const handleBulkUpdate = async () => {
    if (!bulkUpdateTemplate) return;

    try {
      await apiClient.updateRoleTemplate(bulkUpdateTemplate.id, {
        applyToUsers: bulkUpdateMode === 'all',
      });
      setShowBulkUpdateModal(false);
      setBulkUpdateTemplate(null);
      alert(`Template updated. ${bulkUpdateMode === 'all' ? 'All users updated.' : 'Individual overrides preserved.'}`);
    } catch (err: any) {
      alert(`Failed to apply bulk update: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-purple-500" />
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Roles</h2>
            <p className="text-sm text-slate-400 mt-1">
              Configure permission matrices and capabilities
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadTemplates}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => {
              setSelectedTemplate(null);
              setShowEditor(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Role
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/40 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Summary */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center gap-2 text-slate-300">
          <Shield className="w-5 h-5 text-purple-400" />
          <span className="font-semibold">
            Total Templates: <span className="text-purple-400">{templates.length}</span>
          </span>
          <span className="mx-2 text-slate-600">|</span>
          <span className="font-semibold">
            System: <span className="text-blue-400">{templates.filter(t => t.isSystem).length}</span>
          </span>
          <span className="mx-2 text-slate-600">|</span>
          <span className="font-semibold">
            Custom: <span className="text-green-400">{templates.filter(t => !t.isSystem).length}</span>
          </span>
        </div>
      </div>

      {/* Templates Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Template
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Permissions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {templates.map((template) => (
                <tr
                  key={template.id}
                  className="hover:bg-slate-700/50 transition-colors cursor-pointer"
                  onDoubleClick={() => {
                    setSelectedTemplate(template);
                    setShowEditor(true);
                  }}
                  title="Double-click to edit"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-slate-100">{template.name}</div>
                        {template.description && (
                          <div className="text-sm text-slate-400">{template.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {template.isSystem ? (
                      <span className="px-2 py-1 text-xs font-medium bg-blue-500/20 text-blue-400 rounded">
                        System
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-green-500/20 text-green-400 rounded">
                        Custom
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1 max-w-md">
                      {(Object.keys(template.permissions) as PermissionKey[])
                        .filter((key) => template.permissions[key])
                        .slice(0, 5)
                        .map((key) => (
                          <span
                            key={key}
                            className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded"
                          >
                            {key.replace('perm_', '')}
                          </span>
                        ))}
                      {(Object.keys(template.permissions) as PermissionKey[])
                        .filter((key) => template.permissions[key]).length > 5 && (
                          <span className="text-xs px-2 py-1 bg-slate-600 text-slate-400 rounded">
                            +{(Object.keys(template.permissions) as PermissionKey[])
                              .filter((key) => template.permissions[key]).length - 5} more
                          </span>
                        )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedTemplate(template);
                          setShowEditor(true);
                        }}
                        className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                        title="Edit Template"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {!template.isSystem && (
                        <>
                          <button
                            onClick={() => {
                              setBulkUpdateTemplate(template);
                              setShowBulkUpdateModal(true);
                            }}
                            className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition-colors"
                            title="Apply to Users"
                          >
                            <Users className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template)}
                            className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
                            title="Delete Template"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <RoleTemplateEditorModal
          template={selectedTemplate}
          onSave={handleSaveTemplate}
          onClose={() => {
            setShowEditor(false);
            setSelectedTemplate(null);
          }}
        />
      )}

      {/* Bulk Update Modal */}
      {showBulkUpdateModal && bulkUpdateTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-md w-full border border-slate-700">
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-100">Apply Template to Users</h3>
              <p className="text-sm text-slate-300">
                How should this template update affect existing users with this role?
              </p>

              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 bg-slate-900 rounded cursor-pointer hover:bg-slate-700 transition-colors">
                  <input
                    type="radio"
                    name="bulkMode"
                    checked={bulkUpdateMode === 'preserve'}
                    onChange={() => setBulkUpdateMode('preserve')}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-slate-100">Preserve Individual Overrides</div>
                    <div className="text-sm text-slate-400">
                      Only update users who have not been individually customized
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-slate-900 rounded cursor-pointer hover:bg-slate-700 transition-colors">
                  <input
                    type="radio"
                    name="bulkMode"
                    checked={bulkUpdateMode === 'all'}
                    onChange={() => setBulkUpdateMode('all')}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-slate-100">Update All Users</div>
                    <div className="text-sm text-slate-400">
                      Override all individual customizations
                    </div>
                  </div>
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleBulkUpdate}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium transition-colors"
                >
                  Apply Changes
                </button>
                <button
                  onClick={() => {
                    setShowBulkUpdateModal(false);
                    setBulkUpdateTemplate(null);
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface RoleTemplateEditorModalProps {
  template: RoleTemplate | null;
  onSave: (template: Partial<RoleTemplate>) => void;
  onClose: () => void;
}

function RoleTemplateEditorModal({ template, onSave, onClose }: RoleTemplateEditorModalProps) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [activeTab, setActiveTab] = useState<'permissions' | 'screens' | 'ai' | 'capabilities'>('permissions');
  const [permissions, setPermissions] = useState<Permissions>(
    template?.permissions || {
      perm_Read: false,
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
      perm_UseAiFeatures: false,
    }
  );
  const [aiFeatures, setAiFeatures] = useState<Partial<AiFeatures>>(
    template?.aiFeatures || { ...DEFAULT_AI_FEATURES }
  );
  const [aiAccessLevel, setAiAccessLevel] = useState<'full-access' | 'read-only'>(
    template?.aiAccessLevel || 'full-access'
  );
  const [aiRules, setAiRules] = useState<string[]>(
    template?.aiRules || []
  );
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>(
    template?.capabilities || {}
  );
  const [screenAccess, setScreenAccess] = useState<ScreenPermissions>(
    template?.screenAccess || {}
  );
  const [newCapabilityKey, setNewCapabilityKey] = useState('');

  const handleTogglePermission = (key: PermissionKey) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Auto-switch away from AI tab if permission is unchecked
  useEffect(() => {
    if (activeTab === 'ai' && !permissions.perm_UseAiFeatures) {
      setActiveTab('permissions');
    }
  }, [activeTab, permissions.perm_UseAiFeatures]);

  const handleToggleScreenAccess = (key: ScreenKey) => {
    setScreenAccess((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggleAllScreensInCategory = (screens: ScreenKey[], enabled: boolean) => {
    setScreenAccess((prev) => {
      const updated = { ...prev };
      screens.forEach((screen) => {
        updated[screen] = enabled;
      });
      return updated;
    });
  };

  const countEnabledScreens = () => {
    return Object.values(screenAccess).filter(Boolean).length;
  };

  const getTotalScreens = () => {
    return Object.values(SCREEN_CATEGORIES).reduce((sum, cat) => sum + cat.screens.length, 0);
  };

  const handleAddCapability = () => {
    if (newCapabilityKey.trim()) {
      setCapabilities((prev) => ({ ...prev, [newCapabilityKey.trim()]: true }));
      setNewCapabilityKey('');
    }
  };

  const handleRemoveCapability = (key: string) => {
    const newCaps = { ...capabilities };
    delete newCaps[key];
    setCapabilities(newCaps);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      alert('Template name is required');
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      permissions,
      screenAccess,
      aiFeatures,
      aiAccessLevel,
      aiRules,
      capabilities,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-4xl w-full border border-slate-700 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 bg-slate-900">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-purple-500" />
            <h2 className="text-xl font-bold text-slate-100">
              {template ? 'Edit' : 'New'} Role
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Template Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Project Manager, Viewer, Admin"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this role's purpose"
                rows={2}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-slate-700">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('permissions')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === 'permissions'
                    ? 'bg-slate-700 text-slate-100 border-b-2 border-purple-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <CheckCircle className="w-4 h-4 inline mr-2" />
                Permissions
              </button>
              <button
                onClick={() => setActiveTab('screens')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === 'screens'
                    ? 'bg-slate-700 text-slate-100 border-b-2 border-purple-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Monitor className="w-4 h-4 inline mr-2" />
                Screen Access
                <span className="ml-2 text-xs px-1.5 py-0.5 bg-slate-600 rounded">
                  {countEnabledScreens()}/{getTotalScreens()}
                </span>
              </button>
              {permissions.perm_UseAiFeatures && (
                <button
                  onClick={() => setActiveTab('ai')}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === 'ai'
                      ? 'bg-slate-700 text-slate-100 border-b-2 border-purple-500'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Sparkles className="w-4 h-4 inline mr-2" />
                  AI Features
                  <span className="ml-2 text-xs px-1.5 py-0.5 bg-slate-600 rounded">
                    {countEnabledAiFeatures(aiFeatures)}/{getTotalAiFeatures()}
                  </span>
                </button>
              )}
              <button
                onClick={() => setActiveTab('capabilities')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === 'capabilities'
                    ? 'bg-slate-700 text-slate-100 border-b-2 border-purple-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Settings className="w-4 h-4 inline mr-2" />
                Capabilities
              </button>
            </div>
          </div>

          {/* Tab Content: Permissions */}
          {activeTab === 'permissions' && (
            <div className="space-y-4">
              {Object.entries(PERMISSION_CATEGORIES).map(([category, perms]) => (
                <div key={category} className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {category}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {perms.map((perm) => (
                      <label
                        key={perm}
                        className="flex items-center gap-3 p-3 bg-slate-900 rounded cursor-pointer hover:bg-slate-700 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={permissions[perm]}
                          onChange={() => handleTogglePermission(perm)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-slate-300">{PERMISSION_LABELS[perm]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab Content: Screen Access */}
          {activeTab === 'screens' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400 mb-4">
                Configure which screens users with this role can access in the navigation menu.
              </p>
              {Object.entries(SCREEN_CATEGORIES).map(([categoryKey, { label, screens }]) => {
                const enabledInCategory = screens.filter((s) => screenAccess[s]).length;
                const allEnabled = enabledInCategory === screens.length;
                const noneEnabled = enabledInCategory === 0;
                return (
                  <div key={categoryKey} className="bg-slate-900 rounded-lg p-4 border border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Monitor className="w-4 h-4" />
                        {label}
                        <span className="text-xs font-normal normal-case px-1.5 py-0.5 bg-slate-700 rounded">
                          {enabledInCategory}/{screens.length}
                        </span>
                      </h4>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleAllScreensInCategory(screens, true)}
                          className={`text-xs px-2 py-1 rounded transition-colors ${
                            allEnabled
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                          }`}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleAllScreensInCategory(screens, false)}
                          className={`text-xs px-2 py-1 rounded transition-colors ${
                            noneEnabled
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                          }`}
                        >
                          None
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {screens.map((screen) => (
                        <label
                          key={screen}
                          className="flex items-center gap-3 p-2 bg-slate-800 rounded cursor-pointer hover:bg-slate-700 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={!!screenAccess[screen]}
                            onChange={() => handleToggleScreenAccess(screen)}
                            className="w-4 h-4 rounded border-slate-500 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="text-sm text-slate-300">{SCREEN_LABELS[screen]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab Content: AI Features (only if permission is enabled) */}
          {activeTab === 'ai' && permissions.perm_UseAiFeatures && (
            <div className="space-y-6">
              {/* AI Access Level */}
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 space-y-4">
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> AI Access Configuration
                </h4>

                {/* AI Access Level */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Access Level</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="aiAccessRole"
                        checked={aiAccessLevel === 'full-access'}
                        onChange={() => setAiAccessLevel('full-access')}
                        className="text-purple-600"
                      />
                      <span className="text-sm text-slate-300">Full Access (Read & Write)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="aiAccessRole"
                        checked={aiAccessLevel === 'read-only'}
                        onChange={() => setAiAccessLevel('read-only')}
                        className="text-purple-600"
                      />
                      <span className="text-sm text-slate-300">Read-Only (Q&A Only)</span>
                    </label>
                  </div>
                </div>

                {/* AI Rules */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                    Role AI Rules
                  </label>
                  <textarea
                    value={aiRules.join('\n')}
                    onChange={(e) => setAiRules(e.target.value.split('\n').filter((r) => r.trim()))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 h-24 resize-none"
                    placeholder="e.g., 'Can only view forecasts', 'Cannot modify financial data'."
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Enter one rule per line. These rules define AI behavior for this role.
                  </p>
                </div>
              </div>

              {/* Granular AI Features */}
              <AiFeaturesSection
                features={aiFeatures}
                onChange={setAiFeatures}
                context="role"
                showHeader={true}
              />
            </div>
          )}

          {/* Tab Content: Capabilities */}
          {activeTab === 'capabilities' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Additional feature flags (e.g., export_pdf, bulk_operations)
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCapabilityKey}
                  onChange={(e) => setNewCapabilityKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCapability()}
                  placeholder="capability_name"
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleAddCapability}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {Object.keys(capabilities).map((key) => (
                  <span
                    key={key}
                    className="flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-400 rounded"
                  >
                    {key}
                    <button
                      onClick={() => handleRemoveCapability(key)}
                      className="hover:text-red-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {Object.keys(capabilities).length === 0 && (
                  <p className="text-sm text-slate-500 italic">No additional capabilities defined</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-6 border-t border-slate-700 bg-slate-900">
          <button
            onClick={handleSubmit}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Template
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
