// components/admin/RoleDriftAlerts.tsx
/**
 * Role Drift Alerts Component
 *
 * Phase 7, Task 7.4 of ADR-005 Multi-Tenant Access Control
 * AI Use Case 19: Role Drift Detection and Role Template Suggestions
 *
 * Displays detected role drift patterns and allows administrators to
 * apply one-click role refactoring with rollback support.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Users,
  Shield,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Undo2,
  Settings,
  Info,
  Loader2,
  Clock,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../services/apiClient';

// ============================================================================
// Types
// ============================================================================

interface DriftPattern {
  id: string;
  driftType: 'CONSISTENT_OVERRIDES' | 'EXCESSIVE_OVERRIDES' | 'ROLE_MISMATCH';
  baseRole: string;
  baseRoleId: string | null;
  commonOverrides: Record<string, boolean>;
  affectedUsers: Array<{
    userId: string;
    username: string;
    email: string | null;
    overrides: Record<string, boolean>;
  }>;
  frequency: string;
  suggestedNewRole: {
    name: string;
    inheritsFrom: string;
    additionalCapabilities: Record<string, boolean>;
  };
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  detectedAt: string;
}

interface DriftRecommendation {
  patternId: string;
  action: 'CREATE_NEW_ROLE' | 'NORMALIZE_OVERRIDES' | 'REVIEW_MANUALLY';
  impact: string;
  confidence: number;
  reasoning: string;
}

interface DriftDetectionResult {
  driftDetected: boolean;
  patterns: DriftPattern[];
  recommendations: DriftRecommendation[];
  summary: {
    totalUsersAnalyzed: number;
    usersWithOverrides: number;
    patternsDetected: number;
    estimatedOverridesToRemove: number;
  };
  lastAnalyzedAt: string;
}

interface RefactorResult {
  success: boolean;
  newRoleCreated: boolean;
  newRoleId?: string;
  newRoleName?: string;
  usersMigrated: number;
  overridesRemoved: number;
  rollbackId: string;
  rollbackAvailable: boolean;
  rollbackExpiresAt: string;
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'HIGH':
      return 'bg-red-500/20 text-red-400 border-red-500/40';
    case 'MEDIUM':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    case 'LOW':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    default:
      return 'bg-slate-700 text-slate-300 border-slate-600';
  }
};

const getDriftTypeLabel = (driftType: string): string => {
  switch (driftType) {
    case 'CONSISTENT_OVERRIDES':
      return 'Consistent Overrides';
    case 'EXCESSIVE_OVERRIDES':
      return 'Excessive Overrides';
    case 'ROLE_MISMATCH':
      return 'Role Mismatch';
    default:
      return driftType;
  }
};

const formatPermissionName = (perm: string): string => {
  return perm
    .replace('perm_', '')
    .replace(/([A-Z])/g, ' $1')
    .trim();
};

// ============================================================================
// Component
// ============================================================================

export const RoleDriftAlerts: React.FC = () => {
  const { currentOrganizationId } = useAuth();
  const [_loading, _setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DriftDetectionResult | null>(null);
  const [expandedPatternId, setExpandedPatternId] = useState<string | null>(null);
  const [applyingRefactor, setApplyingRefactor] = useState<string | null>(null);
  const [recentRefactors, setRecentRefactors] = useState<Array<{
    patternId: string;
    rollbackId: string;
    newRoleName: string;
    usersMigrated: number;
    rollbackExpiresAt: string;
  }>>([]);

  /**
   * Detect role drift patterns
   */
  const detectDrift = useCallback(async () => {
    if (!currentOrganizationId) return;

    setDetecting(true);
    setError(null);

    try {
      const response = await apiClient.post<DriftDetectionResult & { success: boolean }>(
        '/api/roles/detect-drift',
        { organizationId: currentOrganizationId }
      );

      setResult(response);
    } catch (err: any) {
      setError(err.message || 'Failed to detect role drift');
      console.error('Role drift detection error:', err);
    } finally {
      setDetecting(false);
    }
  }, [currentOrganizationId]);

  /**
   * Apply role refactor
   */
  const handleApplyRefactor = useCallback(async (pattern: DriftPattern) => {
    if (!currentOrganizationId) return;

    const confirmed = window.confirm(
      `Create new role "${pattern.suggestedNewRole.name}" and migrate ${pattern.affectedUsers.length} users?\n\n` +
      `This action is reversible within 7 days.`
    );

    if (!confirmed) return;

    setApplyingRefactor(pattern.id);

    try {
      const response = await apiClient.post<RefactorResult & { success: boolean }>(
        '/api/roles/apply-refactor',
        {
          organizationId: currentOrganizationId,
          pattern,
        }
      );

      if (response.success) {
        // Store rollback info
        setRecentRefactors(prev => [
          {
            patternId: pattern.id,
            rollbackId: response.rollbackId,
            newRoleName: response.newRoleName || pattern.suggestedNewRole.name,
            usersMigrated: response.usersMigrated,
            rollbackExpiresAt: response.rollbackExpiresAt,
          },
          ...prev,
        ]);

        // Remove pattern from results
        setResult(prev => prev ? {
          ...prev,
          patterns: prev.patterns.filter(p => p.id !== pattern.id),
          recommendations: prev.recommendations.filter(r => r.patternId !== pattern.id),
        } : null);

        alert(
          `Success!\n\n` +
          `- Created role: ${response.newRoleName}\n` +
          `- Users migrated: ${response.usersMigrated}\n` +
          `- Overrides removed: ${response.overridesRemoved}\n\n` +
          `You can rollback within 7 days if needed.`
        );
      } else {
        throw new Error(response.error || 'Refactor failed');
      }
    } catch (err: any) {
      alert(`Failed to apply refactor: ${err.message}`);
      console.error('Role refactor error:', err);
    } finally {
      setApplyingRefactor(null);
    }
  }, [currentOrganizationId]);

  /**
   * Rollback a refactor
   */
  const handleRollback = useCallback(async (rollbackId: string, _patternId: string) => {
    if (!currentOrganizationId) return;

    const confirmed = window.confirm(
      'Are you sure you want to rollback this refactor?\n\n' +
      'Users will be restored to their previous roles and permission overrides.'
    );

    if (!confirmed) return;

    try {
      await apiClient.post('/api/roles/rollback-refactor', {
        organizationId: currentOrganizationId,
        rollbackId,
      });

      // Remove from recent refactors
      setRecentRefactors(prev => prev.filter(r => r.rollbackId !== rollbackId));

      alert('Rollback successful! Users have been restored to their previous roles.');

      // Re-detect to show the pattern again
      detectDrift();
    } catch (err: any) {
      alert(`Failed to rollback: ${err.message}`);
      console.error('Rollback error:', err);
    }
  }, [currentOrganizationId, detectDrift]);

  // Initial detection on mount
  useEffect(() => {
    if (currentOrganizationId) {
      detectDrift();
    }
  }, [currentOrganizationId, detectDrift]);

  /**
   * Toggle pattern expansion
   */
  const togglePattern = useCallback((patternId: string) => {
    setExpandedPatternId(prev => prev === patternId ? null : patternId);
  }, []);

  /**
   * Get recommendation for a pattern
   */
  const getRecommendation = useCallback((patternId: string): DriftRecommendation | undefined => {
    return result?.recommendations.find(r => r.patternId === patternId);
  }, [result]);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700 bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <Shield className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Role Drift Detection</h2>
              <p className="text-sm text-slate-400">Detect and fix permission override patterns</p>
            </div>
          </div>

          <button
            onClick={detectDrift}
            disabled={detecting}
            className="flex items-center gap-2 px-3 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 disabled:opacity-50 transition-colors"
          >
            {detecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {detecting ? 'Analyzing...' : 'Re-analyze'}
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="px-6 py-4 bg-red-500/20 border-b border-red-500/40">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Summary */}
      {result && (
        <div className="px-6 py-4 bg-slate-900/50 border-b border-slate-700">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="bg-slate-800 rounded-lg p-3">
              <p className="text-2xl font-bold text-slate-100">{result.summary.totalUsersAnalyzed}</p>
              <p className="text-xs text-slate-400">Users Analyzed</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-3">
              <p className="text-2xl font-bold text-amber-400">{result.summary.usersWithOverrides}</p>
              <p className="text-xs text-slate-400">With Overrides</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-3">
              <p className="text-2xl font-bold text-orange-400">{result.summary.patternsDetected}</p>
              <p className="text-xs text-slate-400">Patterns Found</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-3">
              <p className="text-2xl font-bold text-red-400">{result.summary.estimatedOverridesToRemove}</p>
              <p className="text-xs text-slate-400">Can Be Removed</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 text-center mt-3">
            Last analyzed: {new Date(result.lastAnalyzedAt).toLocaleString()}
          </p>
        </div>
      )}

      {/* Recent Refactors (Rollback Available) */}
      {recentRefactors.length > 0 && (
        <div className="px-6 py-4 bg-green-500/10 border-b border-green-500/30">
          <p className="text-sm font-medium text-green-400 mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Recent Refactors (Rollback Available)
          </p>
          <div className="space-y-2">
            {recentRefactors.map((refactor) => (
              <div
                key={refactor.rollbackId}
                className="flex items-center justify-between bg-slate-800 rounded-lg p-3 text-sm"
              >
                <div>
                  <span className="font-medium text-slate-100">{refactor.newRoleName}</span>
                  <span className="text-slate-400 ml-2">({refactor.usersMigrated} users)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Expires {new Date(refactor.rollbackExpiresAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleRollback(refactor.rollbackId, refactor.patternId)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-orange-400 hover:bg-orange-500/20 rounded transition-colors"
                  >
                    <Undo2 className="w-3 h-3" />
                    Rollback
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Drift Detected */}
      {result && !result.driftDetected && (
        <div className="px-6 py-12 text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
          <p className="text-lg font-medium text-slate-100">No Role Drift Detected</p>
          <p className="text-sm text-slate-400 mt-2">
            Permission overrides are well-managed. No patterns requiring attention.
          </p>
        </div>
      )}

      {/* Drift Patterns */}
      {result && result.patterns.length > 0 && (
        <div className="divide-y divide-slate-700">
          {result.patterns.map((pattern) => {
            const recommendation = getRecommendation(pattern.id);
            const isExpanded = expandedPatternId === pattern.id;
            const isApplying = applyingRefactor === pattern.id;

            return (
              <div key={pattern.id} className="border-b border-slate-700 last:border-0">
                {/* Pattern Header */}
                <button
                  onClick={() => togglePattern(pattern.id)}
                  className="w-full px-6 py-4 text-left hover:bg-slate-700/50 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={`w-5 h-5 ${
                      pattern.severity === 'HIGH' ? 'text-red-400' :
                      pattern.severity === 'MEDIUM' ? 'text-amber-400' : 'text-blue-400'
                    }`} />

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-100">{pattern.frequency}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${getSeverityColor(pattern.severity)}`}>
                          {pattern.severity}
                        </span>
                        <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded-full">
                          {getDriftTypeLabel(pattern.driftType)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1">
                        Base role: <span className="font-medium text-slate-300">{pattern.baseRole}</span>
                        {' | '}
                        {Object.keys(pattern.commonOverrides).length} common overrides
                      </p>
                    </div>
                  </div>

                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-6 pb-4 space-y-4">
                    {/* Common Overrides */}
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                      <p className="text-sm font-medium text-slate-200 mb-2 flex items-center gap-2">
                        <Settings className="w-4 h-4 text-slate-400" />
                        Common Permission Overrides
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(pattern.commonOverrides).map(([key, value]) => (
                          <span
                            key={key}
                            className={`px-2 py-1 text-xs rounded-full ${
                              value
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {formatPermissionName(key)}: {value ? 'Yes' : 'No'}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Affected Users */}
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                      <p className="text-sm font-medium text-slate-200 mb-2 flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        Affected Users ({pattern.affectedUsers.length})
                      </p>
                      <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                        {pattern.affectedUsers.map((user) => (
                          <div
                            key={user.userId}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span className="w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center text-xs font-medium text-slate-300">
                              {user.username.charAt(0).toUpperCase()}
                            </span>
                            <span className="text-slate-300">{user.username}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Suggested Action */}
                    <div className="bg-violet-500/10 rounded-lg p-4 border border-violet-500/30">
                      <p className="text-sm font-medium text-violet-300 mb-2 flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        Suggested Action
                      </p>
                      <p className="text-sm text-violet-200 mb-2">
                        Create new role: <span className="font-semibold">{pattern.suggestedNewRole.name}</span>
                      </p>
                      {recommendation && (
                        <>
                          <p className="text-xs text-violet-400 mb-1">
                            Impact: {recommendation.impact}
                          </p>
                          <p className="text-xs text-violet-400">
                            Confidence: {Math.round(recommendation.confidence * 100)}%
                          </p>
                        </>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleApplyRefactor(pattern)}
                        disabled={isApplying}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 disabled:opacity-50 transition-colors"
                      >
                        {isApplying ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        {isApplying ? 'Applying...' : 'Apply Refactor'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Loading State */}
      {detecting && !result && (
        <div className="px-6 py-12 text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-4 text-violet-400 animate-spin" />
          <p className="text-slate-400">Analyzing role patterns...</p>
        </div>
      )}
    </div>
  );
};

export default RoleDriftAlerts;
