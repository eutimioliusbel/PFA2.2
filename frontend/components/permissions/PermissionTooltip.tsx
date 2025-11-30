// components/permissions/PermissionTooltip.tsx
/**
 * PermissionTooltip Component
 *
 * Phase 7, Task 7.1 of ADR-005 Multi-Tenant Access Control
 * AI Use Case 16: Context-Aware Access Explanation
 *
 * Provides AI-powered tooltips that explain WHY a user is denied access
 * and HOW to resolve it. Uses progressive disclosure:
 * - Level 1: Hover - Short summary
 * - Level 2: Click "Learn More" - Full explanation modal
 * - Level 3: Admin Debug Mode - Technical permission chain details
 *
 * Performance Targets:
 * - <300ms for cached explanations
 * - <500ms for AI-generated explanations
 * - >80% cache hit rate expected
 */

import React, { useState, useCallback, useRef, useEffect, ReactElement } from 'react';
import { Info, ExternalLink, X, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../services/apiClient';

// ============================================================================
// Types
// ============================================================================

interface PermissionChainCheck {
  check: string;
  result: boolean;
  reason: string;
}

interface ResolveAction {
  action: string;
  contact: string;
  eta: string;
}

interface PermissionExplanation {
  summary: string;
  reasons: string[];
  resolveActions: ResolveAction[];
  confidence: number;
  permissionChain: PermissionChainCheck[];
  cached?: boolean;
  generationTimeMs?: number;
}

interface PermissionTooltipProps {
  /**
   * The action being attempted (e.g., 'perm_Sync', 'pems:sync', 'pfa:update')
   */
  action: string;

  /**
   * The child element to wrap (usually a disabled button)
   */
  children: ReactElement;

  /**
   * Custom organization ID (defaults to currentOrganizationId from AuthContext)
   */
  organizationId?: string;

  /**
   * Show admin debug mode (technical details)
   */
  debugMode?: boolean;

  /**
   * Disable tooltip (useful when permission is granted)
   */
  disabled?: boolean;

  /**
   * Custom tooltip placement
   */
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

// ============================================================================
// Client-side cache for explanations
// ============================================================================

interface CacheEntry {
  explanation: PermissionExplanation;
  timestamp: number;
}

const explanationCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function getCachedExplanation(key: string): PermissionExplanation | null {
  const entry = explanationCache.get(key);
  if (!entry) return null;

  // Check if expired
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    explanationCache.delete(key);
    return null;
  }

  return entry.explanation;
}

function setCachedExplanation(key: string, explanation: PermissionExplanation): void {
  explanationCache.set(key, {
    explanation,
    timestamp: Date.now(),
  });

  // Limit cache size to 100 entries
  if (explanationCache.size > 100) {
    const oldestKey = explanationCache.keys().next().value;
    if (oldestKey) {
      explanationCache.delete(oldestKey);
    }
  }
}

// ============================================================================
// PermissionTooltip Component
// ============================================================================

export const PermissionTooltip: React.FC<PermissionTooltipProps> = ({
  action,
  children,
  organizationId,
  debugMode = false,
  disabled = false,
  placement = 'top',
}) => {
  const { user, currentOrganizationId } = useAuth();
  const [explanation, setExplanation] = useState<PermissionExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showFullModal, setShowFullModal] = useState(false);
  const [showDebugDetails, setShowDebugDetails] = useState(false);

  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const orgId = organizationId || currentOrganizationId;

  /**
   * Fetch explanation from backend API
   */
  const fetchExplanation = useCallback(async () => {
    if (!user || !orgId || disabled) return;

    // Check client-side cache first
    const cacheKey = `${user.id}:${orgId}:${action}`;
    const cached = getCachedExplanation(cacheKey);
    if (cached) {
      setExplanation({ ...cached, cached: true });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<{
        allowed: boolean;
        explanation: PermissionExplanation | null;
      }>('/api/permissions/explain', {
        userId: user.id,
        organizationId: orgId,
        action,
      });

      if (response.allowed) {
        // User has permission - no tooltip needed
        setExplanation(null);
      } else if (response.explanation) {
        // User is denied - show explanation
        setExplanation(response.explanation);
        setCachedExplanation(cacheKey, response.explanation);
      }
    } catch (err) {
      console.error('[PermissionTooltip] Error fetching explanation:', err);
      setError('Unable to load explanation');

      // Provide fallback explanation
      setExplanation({
        summary: 'You do not have permission to perform this action.',
        reasons: ['Permission denied by system policy'],
        resolveActions: [{
          action: 'Contact your organization administrator',
          contact: 'admin@example.com',
          eta: '1 business day',
        }],
        confidence: 0.5,
        permissionChain: [],
        cached: false,
      });
    } finally {
      setLoading(false);
    }
  }, [user, orgId, action, disabled]);

  /**
   * Handle mouse enter with 300ms delay
   */
  const handleMouseEnter = useCallback(() => {
    if (disabled) return;

    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
    }

    // Delay tooltip appearance by 300ms
    hoverTimeoutRef.current = window.setTimeout(() => {
      setShowTooltip(true);
      if (!explanation && !loading) {
        fetchExplanation();
      }
    }, 300);
  }, [disabled, explanation, loading, fetchExplanation]);

  /**
   * Handle mouse leave
   */
  const handleMouseLeave = useCallback(() => {
    // Clear hover timeout
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // Hide tooltip after short delay (allows moving to tooltip)
    setTimeout(() => {
      if (!tooltipRef.current?.matches(':hover')) {
        setShowTooltip(false);
      }
    }, 100);
  }, []);

  /**
   * Open full explanation modal
   */
  const handleLearnMore = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowFullModal(true);
    setShowTooltip(false);
  }, []);

  /**
   * Close full modal
   */
  const handleCloseModal = useCallback(() => {
    setShowFullModal(false);
    setShowDebugDetails(false);
  }, []);

  /**
   * Send access request email
   */
  const handleRequestAccess = useCallback(() => {
    if (!explanation || explanation.resolveActions.length === 0) return;

    const firstAction = explanation.resolveActions[0];
    const subject = encodeURIComponent(`Access Request: ${action}`);
    const body = encodeURIComponent(
      `Hi,\n\nI would like to request access to "${action}".\n\nReason: ${explanation.summary}\n\nPlease let me know the next steps.\n\nThank you,\n${user?.username || 'User'}`
    );

    window.location.href = `mailto:${firstAction.contact}?subject=${subject}&body=${body}`;
  }, [explanation, action, user]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Close modal on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showFullModal) {
        handleCloseModal();
      }
    };

    if (showFullModal) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [showFullModal, handleCloseModal]);

  /**
   * Get tooltip position styles
   */
  const getTooltipPosition = () => {
    const positions = {
      top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
      bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
      left: 'right-full top-1/2 -translate-y-1/2 mr-2',
      right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    };
    return positions[placement];
  };

  /**
   * Render tooltip content (summary)
   */
  const renderTooltipContent = () => {
    if (loading) {
      return (
        <div className="flex items-center space-x-2 text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Analyzing permissions...</span>
        </div>
      );
    }

    if (error && !explanation) {
      return (
        <div className="flex items-center space-x-2 text-red-500">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      );
    }

    if (!explanation) {
      return null;
    }

    return (
      <div className="space-y-2">
        <div className="flex items-start space-x-2">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
          <p className="text-sm text-gray-700">{explanation.summary}</p>
        </div>

        <button
          onClick={handleLearnMore}
          className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center space-x-1 transition-colors"
        >
          <span>Learn More</span>
          <ExternalLink className="w-3 h-3" />
        </button>

        {explanation.cached && (
          <p className="text-xs text-gray-400">Cached response</p>
        )}
      </div>
    );
  };

  /**
   * Render full explanation modal
   */
  const renderFullModal = () => {
    if (!showFullModal || !explanation) return null;

    const actionDisplayName = action.includes(':')
      ? action.split(':')[1]
      : action.replace('perm_', '');

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={handleCloseModal}
      >
        <div
          className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold flex items-center space-x-2">
              <span className="text-xl">🤖</span>
              <span>Why can't I {actionDisplayName}?</span>
            </h3>
            <button
              onClick={handleCloseModal}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {/* Summary */}
            <div>
              <h4 className="font-medium text-gray-700 mb-2">
                You cannot {actionDisplayName} because:
              </h4>
              <ul className="space-y-1 ml-1">
                {explanation.reasons.map((reason, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start">
                    <span className="mr-2">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resolution Steps */}
            {explanation.resolveActions.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-700 mb-2 flex items-center">
                  <span className="mr-2">💡</span>
                  <span>How to resolve:</span>
                </h4>
                <div className="space-y-2">
                  {explanation.resolveActions.map((resolveAction, i) => (
                    <div
                      key={i}
                      className="bg-blue-50 p-3 rounded-lg border border-blue-100"
                    >
                      <p className="text-sm font-medium text-blue-900">
                        {i + 1}. {resolveAction.action}
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Contact: {resolveAction.contact}
                      </p>
                      <p className="text-xs text-blue-600">
                        ETA: {resolveAction.eta}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Debug Mode */}
            {debugMode && explanation.permissionChain.length > 0 && (
              <div className="border-t pt-4">
                <button
                  onClick={() => setShowDebugDetails(!showDebugDetails)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <h4 className="font-medium text-gray-700 flex items-center">
                    <span className="mr-2">🔧</span>
                    <span>Admin Debug Info</span>
                  </h4>
                  {showDebugDetails ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>

                {showDebugDetails && (
                  <div className="mt-3 bg-gray-50 p-3 rounded-lg space-y-2 font-mono text-xs">
                    <p className="text-gray-700 font-semibold">Permission Chain Analysis:</p>
                    {explanation.permissionChain.map((check, i) => (
                      <div key={i} className="ml-2">
                        <span className="mr-1">
                          {i + 1}. {check.result ? '✅' : '❌'}
                        </span>
                        <span className={check.result ? 'text-green-700' : 'text-red-700'}>
                          {check.check}
                        </span>
                        <br />
                        <span className="text-gray-500 ml-4">→ {check.reason}</span>
                      </div>
                    ))}
                    <div className="mt-3 pt-2 border-t border-gray-200 text-gray-600">
                      <p>AI Confidence: {(explanation.confidence * 100).toFixed(0)}%</p>
                      {explanation.cached && <p>Source: Cached</p>}
                      {explanation.generationTimeMs !== undefined && (
                        <p>Generation Time: {explanation.generationTimeMs}ms</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-4 border-t bg-gray-50">
            <button
              onClick={handleCloseModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Dismiss
            </button>
            {explanation.resolveActions.length > 0 && (
              <button
                onClick={handleRequestAccess}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                Request Access
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        ref={triggerRef}
        className="relative inline-block"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}

        {/* Tooltip */}
        {showTooltip && (explanation || loading || error) && (
          <div
            ref={tooltipRef}
            className={`absolute z-40 ${getTooltipPosition()}`}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 max-w-xs">
              {renderTooltipContent()}
            </div>
            {/* Arrow */}
            <div
              className={`absolute w-2 h-2 bg-white border transform rotate-45 ${
                placement === 'top'
                  ? 'top-full left-1/2 -translate-x-1/2 -translate-y-1/2 border-t-0 border-l-0'
                  : placement === 'bottom'
                  ? 'bottom-full left-1/2 -translate-x-1/2 translate-y-1/2 border-b-0 border-r-0'
                  : placement === 'left'
                  ? 'left-full top-1/2 -translate-x-1/2 -translate-y-1/2 border-l-0 border-b-0'
                  : 'right-full top-1/2 translate-x-1/2 -translate-y-1/2 border-r-0 border-t-0'
              } border-gray-200`}
            />
          </div>
        )}
      </div>

      {/* Full Explanation Modal */}
      {renderFullModal()}
    </>
  );
};

export default PermissionTooltip;
