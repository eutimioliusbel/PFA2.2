/**
 * CapabilityEditorModal Component
 * Phase 5, Task 5.3 - User-Organization Permission Manager
 *
 * Modal for editing granular capabilities:
 * - Toggle individual permissions
 * - Show role template vs. custom overrides
 * - PEMS sync warnings
 * - Optimistic UI updates
 */

import { useState } from 'react';
import { X, AlertTriangle, Save, Shield, Info, CheckCircle, Sparkles } from 'lucide-react';
import { AiFeatures } from '../../types';
import { AiFeaturesSection, DEFAULT_AI_FEATURES, countEnabledAiFeatures, getTotalAiFeatures } from './AiFeaturesSection';

interface UserOrganization {
  id: string;
  role: string;
  assignmentSource?: 'local' | 'pems_sync';
  isCustom?: boolean;
  organization?: {
    code: string;
    name: string;
    isExternal?: boolean;
    aiFeatures?: Partial<AiFeatures>;
    aiAccessLevel?: 'full-access' | 'read-only';
  };
  permissions: Record<string, boolean>;
  aiFeatures?: Partial<AiFeatures>;
  aiAccessLevel?: 'full-access' | 'read-only';
  aiRules?: string[];
  roleTemplate?: Record<string, boolean>;
  roleTemplateAiFeatures?: Partial<AiFeatures>;
  roleTemplateAiAccessLevel?: 'full-access' | 'read-only';
  roleTemplateAiRules?: string[];
}

interface CapabilityEditorModalProps {
  userOrg: UserOrganization;
  onClose: () => void;
  onSave: (
    capabilities: Record<string, boolean>,
    aiFeatures?: Partial<AiFeatures>,
    aiAccessLevel?: 'full-access' | 'read-only',
    aiRules?: string[]
  ) => Promise<void>;
}

// Permission categories and descriptions (ADR-005 compliant)
const PERMISSION_GROUPS = {
  'Data Scope': [
    { key: 'perm_Read', label: 'View PFA Records', description: 'View PFA records and reports' },
    {
      key: 'perm_EditForecast',
      label: 'Modify Forecast Dates/Costs',
      description: 'Edit forecast dates, costs, and planning data',
    },
    {
      key: 'perm_EditActuals',
      label: 'Modify Actual Dates/Costs',
      description: 'Edit actual dates and costs (rare - billing reality)',
    },
    { key: 'perm_Delete', label: 'Soft Delete PFA Records', description: 'Mark PFA records as deleted' },
  ],
  'Data Operations': [
    { key: 'perm_Import', label: 'CSV Import', description: 'Import data from CSV files' },
    {
      key: 'perm_RefreshData',
      label: 'Trigger PEMS Sync',
      description: 'Refresh data from PEMS system',
    },
    { key: 'perm_Export', label: 'Excel Export', description: 'Export data to Excel/CSV' },
  ],
  Financials: [
    {
      key: 'perm_ViewFinancials',
      label: 'See Cost/Budget Data',
      description: 'View financial data including costs, rates, and budgets (compliance)',
    },
  ],
  Process: [
    {
      key: 'perm_SaveDraft',
      label: 'Save Uncommitted Changes',
      description: 'Save work-in-progress changes as draft',
    },
    { key: 'perm_Sync', label: 'Push Changes to PEMS', description: 'Sync local changes back to PEMS' },
  ],
  Admin: [
    { key: 'perm_ManageUsers', label: 'User/Org Management', description: 'Create, edit, and manage users and organizations' },
    {
      key: 'perm_ManageSettings',
      label: 'System Configuration',
      description: 'Configure system settings and preferences',
    },
    { key: 'perm_ConfigureAlerts', label: 'Notification Rules', description: 'Configure alert rules and notification preferences' },
    {
      key: 'perm_Impersonate',
      label: '"View As" Other Users',
      description: 'Impersonate other users for debugging/support',
    },
    {
      key: 'perm_UseAiFeatures',
      label: 'Use AI Features (Master)',
      description: 'Master toggle for access to AI-powered features',
    },
  ],
};

export function CapabilityEditorModal({ userOrg, onClose, onSave }: CapabilityEditorModalProps) {
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>(
    userOrg.permissions || {}
  );
  const [aiFeatures, setAiFeatures] = useState<Partial<AiFeatures>>(
    userOrg.aiFeatures || { ...DEFAULT_AI_FEATURES }
  );
  const [aiAccessLevel, setAiAccessLevel] = useState<'full-access' | 'read-only'>(
    userOrg.aiAccessLevel || userOrg.roleTemplateAiAccessLevel || 'full-access'
  );
  const [aiRules, setAiRules] = useState<string[]>(
    userOrg.aiRules || userOrg.roleTemplateAiRules || []
  );
  const [activeTab, setActiveTab] = useState<'permissions' | 'ai'>('permissions');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = (capability: string) => {
    setCapabilities((prev) => ({
      ...prev,
      [capability]: !prev[capability],
    }));
    setError(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(capabilities, aiFeatures, aiAccessLevel, aiRules);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save capabilities';
      setError(message);
      setSaving(false);
    }
  };

  const isFromRoleTemplate = (capability: string): boolean => {
    return userOrg.roleTemplate?.[capability] === true;
  };

  const hasChanges = (): boolean => {
    const permChanged = Object.keys(capabilities).some(
      (key) => capabilities[key] !== userOrg.permissions[key]
    );
    const aiChanged = Object.keys(aiFeatures).some(
      (key) => aiFeatures[key as keyof AiFeatures] !== (userOrg.aiFeatures?.[key as keyof AiFeatures] ?? false)
    );
    const accessLevelChanged = aiAccessLevel !== (userOrg.aiAccessLevel || userOrg.roleTemplateAiAccessLevel || 'full-access');
    const rulesChanged = JSON.stringify(aiRules) !== JSON.stringify(userOrg.aiRules || userOrg.roleTemplateAiRules || []);
    return permChanged || aiChanged || accessLevelChanged || rulesChanged;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-4xl w-full border border-slate-700 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className="text-xl font-bold text-slate-100">Manage Capabilities</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-slate-400">
                  {userOrg.organization?.code || 'Unknown'} - {userOrg.organization?.name || ''}
                </span>
                <span className="text-xs text-slate-500">•</span>
                <span className="text-sm text-slate-400">Role: {userOrg.role}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error Banner */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/40 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* PEMS Sync Warning */}
          {userOrg.assignmentSource === 'pems_sync' && !userOrg.isCustom && (
            <div className="bg-blue-500/20 border border-blue-500/40 text-blue-300 px-4 py-4 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="w-6 h-6 flex-shrink-0 mt-0.5" />
                <div className="text-sm space-y-2">
                  <p className="font-semibold text-lg">PEMS-Managed Assignment</p>
                  <p>
                    This assignment is managed by PEMS. Custom capability overrides will be
                    preserved during future syncs.
                  </p>
                  <p className="text-xs text-blue-400 mt-2">
                    Making changes will mark this assignment as "Custom" and allow local
                    capability management.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-slate-700">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('permissions')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === 'permissions'
                    ? 'bg-slate-700 text-slate-100 border-b-2 border-blue-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <CheckCircle className="w-4 h-4 inline mr-2" />
                Permissions
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === 'ai'
                    ? 'bg-slate-700 text-slate-100 border-b-2 border-blue-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Sparkles className="w-4 h-4 inline mr-2" />
                AI Features
                <span className="ml-2 text-xs px-1.5 py-0.5 bg-slate-600 rounded">
                  {countEnabledAiFeatures(aiFeatures)}/{getTotalAiFeatures()}
                </span>
              </button>
            </div>
          </div>

          {/* Tab Content: Permissions */}
          {activeTab === 'permissions' && (
            <>
              {/* Legend */}
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                <div className="flex items-start gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500/20 border border-blue-500/40 rounded"></div>
                    <span className="text-slate-400">From Role Template</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-orange-500/20 border border-orange-500/40 rounded"></div>
                    <span className="text-slate-400">Custom Override</span>
                  </div>
                </div>
              </div>

              {/* Capability Groups */}
              {Object.entries(PERMISSION_GROUPS).map(([groupName, permissions]) => (
                <div key={groupName} className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                    {groupName}
                  </h3>
                  <div className="space-y-2">
                    {permissions.map((perm) => {
                      const isEnabled = capabilities[perm.key] || false;
                      const isFromRole = isFromRoleTemplate(perm.key);
                      const isCustom = isEnabled !== (userOrg.roleTemplate?.[perm.key] || false);

                      return (
                        <label
                          key={perm.key}
                          className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                            isEnabled
                              ? isCustom
                                ? 'bg-orange-500/10 border-orange-500/40'
                                : 'bg-blue-500/10 border-blue-500/40'
                              : 'bg-slate-900 border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => handleToggle(perm.key)}
                            className="w-5 h-5 bg-slate-800 border-slate-600 rounded mt-0.5 focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-100">{perm.label}</span>
                              {isFromRole && !isCustom && (
                                <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-400 rounded">
                                  From Role
                                </span>
                              )}
                              {isCustom && (
                                <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded">
                                  Custom
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-400 mt-1">{perm.description}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Tab Content: AI Features */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              {/* Access Level Configuration */}
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Access Level</h4>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="aiAccessLevel"
                      value="full-access"
                      checked={aiAccessLevel === 'full-access'}
                      onChange={() => setAiAccessLevel('full-access')}
                      className="w-4 h-4 text-blue-500 bg-slate-800 border-slate-600"
                    />
                    <span className="text-slate-200">Full Access</span>
                    <span className="text-xs text-slate-500">(Can use all enabled AI features)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="aiAccessLevel"
                      value="read-only"
                      checked={aiAccessLevel === 'read-only'}
                      onChange={() => setAiAccessLevel('read-only')}
                      className="w-4 h-4 text-blue-500 bg-slate-800 border-slate-600"
                    />
                    <span className="text-slate-200">Read Only</span>
                    <span className="text-xs text-slate-500">(Can view AI suggestions, cannot execute)</span>
                  </label>
                </div>
                {userOrg.roleTemplateAiAccessLevel && aiAccessLevel !== userOrg.roleTemplateAiAccessLevel && (
                  <p className="text-xs text-orange-400 mt-2">
                    Overriding role template default: {userOrg.roleTemplateAiAccessLevel}
                  </p>
                )}
              </div>

              {/* AI Rules Configuration */}
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-2">User AI Rules</h4>
                <p className="text-xs text-slate-500 mb-3">
                  Custom rules that guide AI behavior for this user. One rule per line.
                </p>
                <textarea
                  value={aiRules.join('\n')}
                  onChange={(e) => setAiRules(e.target.value.split('\n').filter(r => r.trim()))}
                  placeholder="Enter custom AI rules for this user..."
                  rows={4}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-slate-200 placeholder-slate-500 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {userOrg.roleTemplateAiRules && userOrg.roleTemplateAiRules.length > 0 && (
                  <div className="mt-2 text-xs text-slate-500">
                    <span className="font-medium">Inherited from role template:</span>
                    <ul className="list-disc list-inside mt-1">
                      {userOrg.roleTemplateAiRules.slice(0, 3).map((rule, i) => (
                        <li key={i} className="truncate">{rule}</li>
                      ))}
                      {userOrg.roleTemplateAiRules.length > 3 && (
                        <li>...and {userOrg.roleTemplateAiRules.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              {/* AI Features Section */}
              <AiFeaturesSection
                features={aiFeatures}
                onChange={setAiFeatures}
                context="user"
                showHeader={false}
                roleTemplateFeatures={userOrg.roleTemplateAiFeatures}
                orgFeatures={userOrg.organization?.aiFeatures}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-slate-700 bg-slate-900 sticky bottom-0">
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges()}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded font-medium transition-colors ${
              saving || !hasChanges()
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Capabilities
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
