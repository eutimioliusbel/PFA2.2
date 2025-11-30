/**
 * AiFeaturesSection Component
 *
 * Reusable component for managing granular AI feature flags.
 * Used in:
 * - EditOrganizationModal (organization-level AI features)
 * - RoleTemplateEditor (role template defaults)
 * - CapabilityEditorModal (user-level overrides)
 */

import React from 'react';
import { Sparkles, Bot, Shield, Brain, TrendingUp, Bell, Info } from 'lucide-react';
import { AiFeatureKey, AiFeatures } from '../../types';

// AI Feature definitions organized by category
export const AI_FEATURE_GROUPS: Record<string, {
  icon: React.ReactNode;
  features: Array<{
    key: AiFeatureKey;
    label: string;
    description: string;
  }>;
}> = {
  'Core AI': {
    icon: <Bot className="w-4 h-4" />,
    features: [
      {
        key: 'ai_ChatAssistant',
        label: 'Chat Assistant',
        description: 'Interactive chat interface for data queries and analysis',
      },
      {
        key: 'ai_VoiceMode',
        label: 'Voice Mode',
        description: 'Voice input and text-to-speech for hands-free interaction',
      },
    ],
  },
  'Permission Intelligence': {
    icon: <Shield className="w-4 h-4" />,
    features: [
      {
        key: 'ai_PermissionSuggestions',
        label: 'Permission Suggestions',
        description: 'AI-powered role and permission recommendations',
      },
      {
        key: 'ai_PermissionExplanations',
        label: 'Permission Explanations',
        description: 'Natural language explanations for access decisions',
      },
      {
        key: 'ai_RoleDriftDetection',
        label: 'Role Drift Detection',
        description: 'Detect unusual permission patterns and access anomalies',
      },
      {
        key: 'ai_NaturalLanguageQueries',
        label: 'Natural Language Queries',
        description: 'Query permissions using natural language',
      },
    ],
  },
  'Security & Compliance': {
    icon: <Brain className="w-4 h-4" />,
    features: [
      {
        key: 'ai_AnomalyDetection',
        label: 'Anomaly Detection',
        description: 'Detect unusual access patterns and behaviors',
      },
      {
        key: 'ai_FinancialMonitoring',
        label: 'Financial Monitoring',
        description: 'Monitor financial data access for compliance',
      },
      {
        key: 'ai_SemanticAuditSearch',
        label: 'Semantic Audit Search',
        description: 'Natural language search through audit logs',
      },
    ],
  },
  'Financial Intelligence': {
    icon: <TrendingUp className="w-4 h-4" />,
    features: [
      {
        key: 'ai_FinancialMasking',
        label: 'Financial Masking',
        description: 'AI-powered sensitive data masking',
      },
      {
        key: 'ai_VendorPricingWatchdog',
        label: 'Vendor Pricing Watchdog',
        description: 'Monitor and alert on vendor pricing anomalies',
      },
    ],
  },
  'BEO Analytics': {
    icon: <Sparkles className="w-4 h-4" />,
    features: [
      {
        key: 'ai_BeoVoiceAnalyst',
        label: 'BEO Voice Analyst',
        description: 'Voice-powered BEO portfolio analysis',
      },
      {
        key: 'ai_NarrativeVariance',
        label: 'Narrative Variance',
        description: 'AI-generated variance explanations',
      },
      {
        key: 'ai_AssetArbitrage',
        label: 'Asset Arbitrage',
        description: 'Identify cost optimization opportunities',
      },
      {
        key: 'ai_ScenarioSimulator',
        label: 'Scenario Simulator',
        description: 'What-if analysis for portfolio decisions',
      },
    ],
  },
  'Operations': {
    icon: <Bell className="w-4 h-4" />,
    features: [
      {
        key: 'ai_SmartNotifications',
        label: 'Smart Notifications',
        description: 'AI-optimized notification timing and grouping',
      },
    ],
  },
};

// Default empty AI features (all false)
export const DEFAULT_AI_FEATURES: AiFeatures = {
  ai_ChatAssistant: false,
  ai_VoiceMode: false,
  ai_PermissionSuggestions: false,
  ai_PermissionExplanations: false,
  ai_RoleDriftDetection: false,
  ai_NaturalLanguageQueries: false,
  ai_AnomalyDetection: false,
  ai_FinancialMonitoring: false,
  ai_SemanticAuditSearch: false,
  ai_FinancialMasking: false,
  ai_VendorPricingWatchdog: false,
  ai_BeoVoiceAnalyst: false,
  ai_NarrativeVariance: false,
  ai_AssetArbitrage: false,
  ai_ScenarioSimulator: false,
  ai_SmartNotifications: false,
};

interface AiFeaturesSectionProps {
  features: Partial<AiFeatures>;
  onChange: (features: Partial<AiFeatures>) => void;
  disabled?: boolean;
  showHeader?: boolean;
  compact?: boolean;
  // For user-level: show which features come from role template
  roleTemplateFeatures?: Partial<AiFeatures>;
  // For user-level: show which features come from organization
  orgFeatures?: Partial<AiFeatures>;
  // Context label for info banner
  context?: 'organization' | 'role' | 'user';
}

export function AiFeaturesSection({
  features,
  onChange,
  disabled = false,
  showHeader = true,
  compact = false,
  roleTemplateFeatures,
  orgFeatures,
  context = 'organization',
}: AiFeaturesSectionProps) {
  const handleToggle = (key: AiFeatureKey) => {
    if (disabled) return;
    onChange({
      ...features,
      [key]: !features[key],
    });
  };

  const isEnabled = (key: AiFeatureKey): boolean => {
    return features[key] || false;
  };

  const isFromRoleTemplate = (key: AiFeatureKey): boolean => {
    return roleTemplateFeatures?.[key] === true;
  };

  const isBlockedByOrg = (key: AiFeatureKey): boolean => {
    // If org features are provided and the feature is disabled at org level,
    // the user/role can't enable it
    return orgFeatures !== undefined && orgFeatures[key] === false;
  };

  const isCustomOverride = (key: AiFeatureKey): boolean => {
    if (!roleTemplateFeatures) return false;
    return features[key] !== roleTemplateFeatures[key];
  };

  const getContextInfo = () => {
    switch (context) {
      case 'organization':
        return 'These settings control which AI features are available to all users in this organization.';
      case 'role':
        return 'These settings define the default AI features for users assigned this role.';
      case 'user':
        return 'These settings override the role defaults for this specific user.';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-slate-100">AI Features</h3>
        </div>
      )}

      {/* Context Info */}
      {context && (
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-400">{getContextInfo()}</p>
        </div>
      )}

      {/* Legend for user context */}
      {roleTemplateFeatures && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500/20 border border-blue-500/40 rounded"></div>
              <span className="text-slate-400">From Role</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500/20 border border-orange-500/40 rounded"></div>
              <span className="text-slate-400">Custom Override</span>
            </div>
            {orgFeatures && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500/20 border border-red-500/40 rounded"></div>
                <span className="text-slate-400">Blocked by Org</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feature Groups */}
      <div className={compact ? 'space-y-3' : 'space-y-6'}>
        {Object.entries(AI_FEATURE_GROUPS).map(([groupName, group]) => (
          <div key={groupName} className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              {group.icon}
              {groupName}
            </h4>
            <div className={compact ? 'space-y-1' : 'space-y-2'}>
              {group.features.map((feature) => {
                const enabled = isEnabled(feature.key);
                const fromRole = isFromRoleTemplate(feature.key);
                const blockedByOrg = isBlockedByOrg(feature.key);
                const isCustom = isCustomOverride(feature.key);
                const isDisabled = disabled || blockedByOrg;

                return (
                  <label
                    key={feature.key}
                    className={`flex items-start gap-3 ${compact ? 'p-2' : 'p-3'} rounded-lg border transition-all ${
                      isDisabled
                        ? 'cursor-not-allowed opacity-50'
                        : 'cursor-pointer'
                    } ${
                      blockedByOrg
                        ? 'bg-red-500/5 border-red-500/20'
                        : enabled
                          ? isCustom
                            ? 'bg-orange-500/10 border-orange-500/40'
                            : fromRole
                              ? 'bg-blue-500/10 border-blue-500/40'
                              : 'bg-purple-500/10 border-purple-500/40'
                          : 'bg-slate-900 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => handleToggle(feature.key)}
                      disabled={isDisabled}
                      className="w-4 h-4 bg-slate-800 border-slate-600 rounded mt-0.5 focus:ring-2 focus:ring-purple-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium ${compact ? 'text-sm' : 'text-sm'} text-slate-100`}>
                          {feature.label}
                        </span>
                        {fromRole && !isCustom && (
                          <span className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">
                            From Role
                          </span>
                        )}
                        {isCustom && (
                          <span className="text-xs px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded">
                            Custom
                          </span>
                        )}
                        {blockedByOrg && (
                          <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">
                            Disabled by Org
                          </span>
                        )}
                      </div>
                      {!compact && (
                        <p className="text-xs text-slate-400 mt-1">{feature.description}</p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper to count enabled AI features
export function countEnabledAiFeatures(features: Partial<AiFeatures>): number {
  return Object.values(features).filter(Boolean).length;
}

// Helper to get total AI features count
export function getTotalAiFeatures(): number {
  return Object.keys(DEFAULT_AI_FEATURES).length;
}
