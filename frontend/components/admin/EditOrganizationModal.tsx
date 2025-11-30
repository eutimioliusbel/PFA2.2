/**
 * EditOrganizationModal Component
 * Phase 5, Task 5.2 - Organization Service Status Controls
 *
 * Modal for editing organization details with:
 * - PEMS organization warnings (code is read-only)
 * - Service settings (can be modified locally)
 * - AI Features configuration
 * - Submit workflow settings
 * - Form validation
 */

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Save, Building2, Cpu, CloudLightning, Download, Sparkles, RefreshCw, Pause, Play, CheckCircle, Loader2 } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { ProviderBadge } from '../StatusBadge';
import { AiFeatures } from '../../types';
import { AiFeaturesSection, DEFAULT_AI_FEATURES, countEnabledAiFeatures, getTotalAiFeatures } from './AiFeaturesSection';

interface Organization {
  id: string;
  code: string;
  name: string;
  description?: string;
  logoUrl?: string;
  isExternal: boolean;
  externalId?: string;
  serviceStatus: string;
  enableSync: boolean;
  features?: {
    ai: boolean;
    aiAccessLevel?: 'full-access' | 'read-only';
    aiIconGeneration?: boolean;
  };
  aiFeatures?: Partial<AiFeatures>;
  aiConnectionId?: string | null;
  aiRules?: string[];
  submitMode?: 'api' | 'download';
  headerConfig?: {
    showLogo: boolean;
    showId: boolean;
    showName: boolean;
    showDescription: boolean;
  };
}

interface AiApiOption {
  id: string;
  name: string;
  provider?: string;
  type?: string;
}

interface EditOrganizationModalProps {
  organization?: Organization | null;
  onClose: () => void;
  onSave: () => void;
}

export function EditOrganizationModal({ organization, onClose, onSave }: EditOrganizationModalProps) {
  const isCreateMode = !organization;

  const [formData, setFormData] = useState({
    code: organization?.code || '',
    name: organization?.name || '',
    description: organization?.description || '',
    logoUrl: organization?.logoUrl || '',
    features: organization?.features || { ai: false, aiAccessLevel: 'full-access' as const, aiIconGeneration: false },
    aiFeatures: organization?.aiFeatures || { ...DEFAULT_AI_FEATURES },
    aiConnectionId: organization?.aiConnectionId || '',
    aiRules: organization?.aiRules || [],
    submitMode: organization?.submitMode || 'api' as const,
    headerConfig: organization?.headerConfig || { showLogo: true, showId: true, showName: false, showDescription: false },
    serviceStatus: organization?.serviceStatus || 'active',
    enableSync: organization?.enableSync ?? false,
  });
  const [logoPreviewError, setLogoPreviewError] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'workflow' | 'service'>('general');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableAiApis, setAvailableAiApis] = useState<AiApiOption[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  const isPemsOrg = organization?.isExternal ?? false;

  useEffect(() => {
    if (!isCreateMode && organization?.id) {
      loadAiApis();
    }
  }, [isCreateMode, organization?.id]);

  const loadAiApis = async () => {
    if (!organization?.id) return;
    try {
      const response = await apiClient.getApiConfigs(organization.id);
      const aiApis: AiApiOption[] = (response.configs || [])
        .filter((api) => {
          const providerLower = ((api as AiApiOption).provider || '').toLowerCase();
          const apiType = (api as AiApiOption).type || '';
          return (
            apiType === 'ai' ||
            providerLower.includes('ai') ||
            ['gemini', 'openai', 'anthropic', 'claude'].includes(providerLower)
          );
        })
        .map((api) => ({
          id: api.id,
          name: api.name,
          provider: (api as AiApiOption).provider,
          type: (api as AiApiOption).type,
        }));
      setAvailableAiApis(aiApis);
    } catch (err) {
      console.error('Failed to load AI APIs:', err);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
    if (field === 'logoUrl') {
      setLogoPreviewError(false);
    }
  };

  const handleFeatureChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      features: { ...prev.features, [field]: value },
    }));
    // Switch away from AI tab if AI is disabled while on that tab
    if (field === 'ai' && !value && activeTab === 'ai') {
      setActiveTab('general');
    }
  };

  const handleAiFeaturesChange = (features: Partial<AiFeatures>) => {
    setFormData((prev) => ({ ...prev, aiFeatures: features }));
  };

  const handleSyncNow = async () => {
    if (!organization?.id) return;

    // Check if sync can be triggered
    if (!formData.enableSync || formData.serviceStatus !== 'active') {
      setSyncResult({
        success: false,
        message: 'Cannot sync: Organization must be active with sync enabled'
      });
      return;
    }

    try {
      setSyncing(true);
      setSyncResult(null);
      const result = await apiClient.syncOrgApis(organization.id, 'full');
      setSyncResult({
        success: result.success,
        message: result.success
          ? `Sync initiated: ${result.syncs?.length || 0} endpoints queued`
          : result.message || 'Sync failed'
      });
    } catch (err: any) {
      setSyncResult({
        success: false,
        message: err.message || 'Failed to trigger sync'
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation for create mode
    if (isCreateMode) {
      if (!formData.code.trim()) {
        setError('Organization code is required');
        return;
      }
      if (!formData.name.trim()) {
        setError('Organization name is required');
        return;
      }
    }

    try {
      setSaving(true);

      if (isCreateMode) {
        await apiClient.createOrganization({
          code: formData.code.toUpperCase().trim(),
          name: formData.name.trim(),
          description: formData.description || undefined,
          logoUrl: formData.logoUrl || undefined,
          features: formData.features,
          aiFeatures: formData.aiFeatures,
          submitMode: formData.submitMode,
          headerConfig: formData.headerConfig,
          serviceStatus: formData.serviceStatus,
          enableSync: formData.enableSync,
        });
      } else if (organization) {
        await apiClient.updateOrganization(organization.id, {
          name: formData.name,
          description: formData.description,
          logoUrl: formData.logoUrl || null,
          features: formData.features,
          aiFeatures: formData.aiFeatures,
          aiConnectionId: formData.aiConnectionId || null,
          aiRules: formData.aiRules,
          submitMode: formData.submitMode,
          headerConfig: formData.headerConfig,
          serviceStatus: formData.serviceStatus,
          enableSync: formData.enableSync,
        });
      }
      onSave();
    } catch (err: any) {
      setError(err.message || `Failed to ${isCreateMode ? 'create' : 'update'} organization`);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-3xl w-full border border-slate-700 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 bg-slate-900">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className="text-xl font-bold text-slate-100">
                {isCreateMode ? 'Add Organization' : 'Edit Organization'}
              </h2>
              {!isCreateMode && organization && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-slate-400">{organization.code}</span>
                  {isPemsOrg && <ProviderBadge provider="pems" size="sm" />}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Banner */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/40 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* PEMS Organization Info */}
          {isPemsOrg && (
            <div className="bg-blue-500/20 border border-blue-500/40 text-blue-300 px-4 py-3 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold mb-1">PEMS Organization Notice</p>
                  <p>
                    This organization is managed by PEMS. The organization code is read-only.
                    Settings can be modified locally.
                  </p>
                  {organization?.externalId && (
                    <p className="mt-2 text-xs text-blue-400">
                      PEMS ID: {organization.externalId}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-slate-700">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === 'general'
                    ? 'bg-slate-700 text-slate-100 border-b-2 border-blue-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Building2 className="w-4 h-4 inline mr-2" />
                General
              </button>
              {formData.features.ai && (
                <button
                  type="button"
                  onClick={() => setActiveTab('ai')}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === 'ai'
                      ? 'bg-slate-700 text-slate-100 border-b-2 border-purple-500'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Sparkles className="w-4 h-4 inline mr-2" />
                  AI Features
                  <span className="ml-2 text-xs px-1.5 py-0.5 bg-purple-600/50 rounded">
                    {countEnabledAiFeatures(formData.aiFeatures)}/{getTotalAiFeatures()}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('workflow')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === 'workflow'
                    ? 'bg-slate-700 text-slate-100 border-b-2 border-blue-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <CloudLightning className="w-4 h-4 inline mr-2" />
                Workflow
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('service')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === 'service'
                    ? 'bg-slate-700 text-slate-100 border-b-2 border-blue-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <RefreshCw className="w-4 h-4 inline mr-2" />
                Service
              </button>
            </div>
          </div>

          {/* Tab Content: General */}
          {activeTab === 'general' && (
            <section className="space-y-4">
              {/* Organization Code */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Organization Code
                  {!isCreateMode && (
                    <span className="ml-2 text-xs text-slate-500">(Read-only)</span>
                  )}
                  {isCreateMode && (
                    <span className="ml-2 text-xs text-red-400">*</span>
                  )}
                </label>
                {isCreateMode ? (
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    placeholder="e.g., RIO, PORTARTHUR"
                    required
                  />
                ) : (
                  <input
                    type="text"
                    value={organization?.code || ''}
                    disabled
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 opacity-50 cursor-not-allowed"
                  />
                )}
                {isCreateMode && (
                  <p className="text-xs text-slate-500 mt-1">Unique identifier (uppercase, no spaces)</p>
                )}
              </div>

              {/* Organization Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Organization Name
                  {isPemsOrg && (
                    <span className="ml-2 text-xs text-slate-500">(Local override)</span>
                  )}
                  {isCreateMode && (
                    <span className="ml-2 text-xs text-red-400">*</span>
                  )}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  placeholder="Organization name"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  placeholder="Organization description"
                  rows={2}
                />
              </div>

              {/* Logo URL */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Logo URL
                </label>
                <div className="flex gap-3">
                  <input
                    type="url"
                    value={formData.logoUrl}
                    onChange={(e) => handleChange('logoUrl', e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    placeholder="https://example.com/logo.png"
                  />
                  {formData.logoUrl && (
                    <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-600">
                      {!logoPreviewError ? (
                        <img
                          src={formData.logoUrl}
                          alt="Logo preview"
                          className="w-full h-full object-cover"
                          onError={() => setLogoPreviewError(true)}
                        />
                      ) : (
                        <span className="text-slate-400 text-xs">Err</span>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Enter a URL to an image for the organization logo
                </p>
              </div>

              {/* Enable AI Features Toggle */}
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.features.ai}
                    onChange={(e) => handleFeatureChange('ai', e.target.checked)}
                    className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500 border-slate-600 bg-slate-800"
                  />
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <div>
                      <span className="text-sm font-medium text-slate-100 block">Enable AI Features</span>
                      <span className="text-xs text-slate-400">Allow AI-powered analytics, suggestions, and automation for this organization</span>
                    </div>
                  </div>
                </label>
              </div>

              {/* Header Display Configuration */}
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Header Display Settings
                </label>
                <p className="text-xs text-slate-500 mb-4">
                  Configure what information appears in the top header bar for this organization
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-slate-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.headerConfig.showLogo}
                      onChange={(e) => handleChange('headerConfig', { ...formData.headerConfig, showLogo: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-600 bg-slate-800"
                    />
                    <div>
                      <span className="text-sm text-slate-100 block">Show Logo</span>
                      <span className="text-[10px] text-slate-500">Display organization logo/icon</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-slate-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.headerConfig.showId}
                      onChange={(e) => handleChange('headerConfig', { ...formData.headerConfig, showId: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-600 bg-slate-800"
                    />
                    <div>
                      <span className="text-sm text-slate-100 block">Show Code/ID</span>
                      <span className="text-[10px] text-slate-500">Display organization code</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-slate-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.headerConfig.showName}
                      onChange={(e) => handleChange('headerConfig', { ...formData.headerConfig, showName: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-600 bg-slate-800"
                    />
                    <div>
                      <span className="text-sm text-slate-100 block">Show Name</span>
                      <span className="text-[10px] text-slate-500">Display organization name</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-slate-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.headerConfig.showDescription}
                      onChange={(e) => handleChange('headerConfig', { ...formData.headerConfig, showDescription: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-600 bg-slate-800"
                    />
                    <div>
                      <span className="text-sm text-slate-100 block">Show Description</span>
                      <span className="text-[10px] text-slate-500">Display organization description</span>
                    </div>
                  </label>
                </div>

                {/* Preview */}
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Preview</span>
                  {(() => {
                    const config = formData.headerConfig;
                    const textElementCount = [config.showName, config.showId, config.showDescription].filter(Boolean).length;
                    const hasLogo = config.showLogo;
                    const isOnlyElement = textElementCount === 1 && !hasLogo;
                    const isTwoElements = textElementCount === 2 && !hasLogo;

                    const nameSize = isOnlyElement ? 'text-sm' : isTwoElements ? 'text-xs' : 'text-[10px]';
                    const idSize = isOnlyElement ? 'text-xs' : isTwoElements ? 'text-[10px]' : 'text-[8px]';
                    const descSize = isOnlyElement ? 'text-[10px]' : 'text-[8px]';
                    const logoSize = textElementCount === 0 ? 'h-10' : 'h-8';
                    const logoIconSize = textElementCount === 0 ? 'w-8 h-8' : 'w-6 h-6';

                    return (
                      <div className="mt-2 bg-slate-800 rounded-lg p-3 flex flex-col items-center justify-center min-h-[60px]">
                        {config.showLogo && (
                          <div className={`mb-1 ${logoSize} flex items-center justify-center`}>
                            {formData.logoUrl && !logoPreviewError ? (
                              <img src={formData.logoUrl} alt="Logo" className="h-full w-auto max-w-[120px] object-contain" />
                            ) : (
                              <Building2 className={`${logoIconSize} text-slate-400`} />
                            )}
                          </div>
                        )}
                        <div className="flex flex-col items-center">
                          {config.showName && (
                            <span className={`${nameSize} font-bold text-white`}>{formData.name || 'Organization Name'}</span>
                          )}
                          {config.showId && (
                            <span className={`${idSize} font-mono text-slate-400 ${!config.showName ? 'font-semibold' : ''}`}>{formData.code || 'ORG_CODE'}</span>
                          )}
                          {config.showDescription && formData.description && (
                            <span className={`${descSize} text-slate-500 truncate max-w-[200px]`}>{formData.description}</span>
                          )}
                        </div>
                        {!config.showLogo && !config.showName && !config.showId && !config.showDescription && (
                          <span className="text-xs font-bold text-white">{formData.name || 'Organization Name'}</span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </section>
          )}

          {/* Tab Content: AI Features */}
          {activeTab === 'ai' && formData.features.ai && (
            <div className="space-y-6">
              {/* AI Configuration */}
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 space-y-4">
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <Cpu className="w-4 h-4" /> AI Configuration
                </h4>

                {/* AI Provider Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                    AI Service Provider
                  </label>
                  {availableAiApis.length > 0 ? (
                    <select
                      value={formData.aiConnectionId}
                      onChange={(e) => handleChange('aiConnectionId', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-purple-500"
                    >
                      <option value="">-- Select AI API --</option>
                      {availableAiApis.map((api) => (
                        <option key={api.id} value={api.id}>
                          {api.name} ({api.provider})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs text-yellow-400 bg-yellow-500/10 p-3 rounded border border-yellow-500/30">
                      No AI APIs configured. Set up an AI connection in API Connectivity first.
                    </div>
                  )}
                </div>

                {/* AI Access Level */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Access Level</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="aiAccessOrg"
                        checked={formData.features.aiAccessLevel === 'full-access'}
                        onChange={() => handleFeatureChange('aiAccessLevel', 'full-access')}
                        className="text-purple-600"
                      />
                      <span className="text-sm text-slate-300">Full Access (Read & Write)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="aiAccessOrg"
                        checked={formData.features.aiAccessLevel === 'read-only'}
                        onChange={() => handleFeatureChange('aiAccessLevel', 'read-only')}
                        className="text-purple-600"
                      />
                      <span className="text-sm text-slate-300">Read-Only (Q&A Only)</span>
                    </label>
                  </div>
                </div>

                {/* AI Rules */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                    Organization AI Rules
                  </label>
                  <textarea
                    value={formData.aiRules.join('\n')}
                    onChange={(e) => handleChange('aiRules', e.target.value.split('\n'))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 h-24 resize-none"
                    placeholder="e.g., 'Approvals over $10k need VP sign-off', 'Rental is preferred over Purchase for projects under 6 months'."
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Enter one rule per line. The AI will follow these guidelines when answering questions.
                  </p>
                </div>
              </div>

              {/* Granular AI Features */}
              <AiFeaturesSection
                features={formData.aiFeatures}
                onChange={handleAiFeaturesChange}
                context="organization"
                showHeader={true}
              />
            </div>
          )}

          {/* Tab Content: Workflow */}
          {activeTab === 'workflow' && (
            <section className="space-y-4">
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-3">Submit Action Mode</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleChange('submitMode', 'api')}
                    className={`flex-1 py-3 rounded-lg text-sm font-medium flex flex-col items-center gap-2 border transition-colors ${
                      formData.submitMode === 'api'
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <CloudLightning className="w-5 h-5" />
                    Direct API
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('submitMode', 'download')}
                    className={`flex-1 py-3 rounded-lg text-sm font-medium flex flex-col items-center gap-2 border transition-colors ${
                      formData.submitMode === 'download'
                        ? 'bg-green-500/20 border-green-500/50 text-green-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <Download className="w-5 h-5" />
                    Download CSV
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-3 text-center">
                  {formData.submitMode === 'download'
                    ? 'Users will download an Excel/CSV file of changes upon submit.'
                    : 'Changes will be sent directly to the configured PEMS API endpoint.'}
                </p>
              </div>
            </section>
          )}

          {/* Tab Content: Service Controls */}
          {activeTab === 'service' && (
            <section className="space-y-4">
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 space-y-4">
                {/* Service Status Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {formData.serviceStatus === 'active' ? (
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                        <Pause className="w-5 h-5 text-yellow-400" />
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-slate-100">Service Status</div>
                      <div className="text-xs text-slate-400">
                        {formData.serviceStatus === 'active' ? 'Organization is active and accessible' : 'Organization is suspended'}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleChange('serviceStatus', 'active')}
                      className={`px-3 py-1.5 text-xs rounded font-medium transition-colors ${
                        formData.serviceStatus === 'active'
                          ? 'bg-green-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      <Play className="w-3 h-3 inline mr-1" />
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChange('serviceStatus', 'suspended')}
                      className={`px-3 py-1.5 text-xs rounded font-medium transition-colors ${
                        formData.serviceStatus === 'suspended'
                          ? 'bg-yellow-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      <Pause className="w-3 h-3 inline mr-1" />
                      Suspended
                    </button>
                  </div>
                </div>

                <div className="h-px bg-slate-700"></div>

                {/* Sync Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${formData.enableSync ? 'bg-blue-500/20' : 'bg-slate-700'} flex items-center justify-center`}>
                      <RefreshCw className={`w-5 h-5 ${formData.enableSync ? 'text-blue-400' : 'text-slate-500'}`} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-100">PEMS Sync</div>
                      <div className="text-xs text-slate-400">
                        {formData.enableSync ? 'Automatic synchronization is enabled' : 'Sync is disabled for this organization'}
                      </div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.enableSync}
                      onChange={(e) => handleChange('enableSync', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="h-px bg-slate-700"></div>

                {/* Manual Sync Section */}
                {!isCreateMode && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${
                          formData.enableSync && formData.serviceStatus === 'active'
                            ? 'bg-cyan-500/20'
                            : 'bg-slate-700'
                        } flex items-center justify-center`}>
                          <Download className={`w-5 h-5 ${
                            formData.enableSync && formData.serviceStatus === 'active'
                              ? 'text-cyan-400'
                              : 'text-slate-500'
                          }`} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-100">Sync Now</div>
                          <div className="text-xs text-slate-400">
                            {formData.enableSync && formData.serviceStatus === 'active'
                              ? 'Manually trigger sync for all endpoints'
                              : 'Enable sync and set service to active to sync'}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleSyncNow}
                        disabled={syncing || !formData.enableSync || formData.serviceStatus !== 'active'}
                        className={`px-4 py-2 text-sm rounded font-medium flex items-center gap-2 transition-colors ${
                          formData.enableSync && formData.serviceStatus === 'active'
                            ? 'bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50'
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {syncing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            Sync All Endpoints
                          </>
                        )}
                      </button>
                    </div>

                    {/* Sync Result */}
                    {syncResult && (
                      <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                        syncResult.success
                          ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
                          : 'bg-red-500/20 border border-red-500/40 text-red-300'
                      }`}>
                        {syncResult.success ? (
                          <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        )}
                        {syncResult.message}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}
        </form>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-slate-700 bg-slate-900">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={saving}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded font-medium transition-colors ${
              saving
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                {isCreateMode ? 'Creating...' : 'Saving...'}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isCreateMode ? 'Create Organization' : 'Save Changes'}
              </>
            )}
          </button>
          <button
            type="button"
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
