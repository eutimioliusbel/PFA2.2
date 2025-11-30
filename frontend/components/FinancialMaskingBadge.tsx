/**
 * Financial Masking Badge Component
 *
 * Phase 7, Task 7.2 of ADR-005 Multi-Tenant Access Control
 * AI Use Case 17: Financial Data Masking with Relative Indicators
 *
 * Replaces cost display with masked value + impact badge for users without
 * viewFinancialDetails capability. Provides progressive disclosure via tooltips
 * and modal for portfolio insights.
 *
 * SECURITY: This component NEVER displays actual costs for masked users.
 * All AI-generated text is sanitized with DOMPurify to prevent XSS.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Lock, TrendingUp, AlertCircle, AlertTriangle, Info, CheckCircle, ExternalLink } from 'lucide-react';
import DOMPurify from 'dompurify';
import { PfaRecord } from '../types';
import { apiClient } from '../services/apiClient';
import { PortfolioInsightsModal } from './PortfolioInsightsModal';

// ============================================================================
// Types
// ============================================================================

export type ImpactLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface MaskedPfaRecord {
  id: string;
  cost: '***masked***';
  monthlyRate?: '***masked***';
  purchasePrice?: '***masked***';
  impactLevel: ImpactLevel;
  percentile: number; // 0-100 (95 = Top 5%)
  relativeComparison: string; // "3.2x average"
  impactDescription: string; // "Top 5% of crane costs"
  aiInsight?: string; // AI-generated recommendation
}

export interface PortfolioInsight {
  totalItems: number;
  highImpactCount: number;
  moderateImpactCount: number;
  lowImpactCount: number;
  criticalImpactCount: number;
  summary: string;
  topCategoryByImpact?: string;
}

export interface FinancialMaskingBadgeProps {
  record: PfaRecord; // Raw record with cost
  viewFinancialDetails: boolean; // User's capability
  variant?: 'inline' | 'badge' | 'full'; // Display style
  className?: string;
  organizationId?: string; // For portfolio insights
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate cost for a PFA record
 */
const calculateCost = (record: PfaRecord): number => {
  if (record.source === 'Purchase' && record.purchasePrice) {
    return record.purchasePrice;
  }

  if (record.source === 'Rental' && record.monthlyRate) {
    const startDate = record.forecastStart || record.originalStart;
    const endDate = record.forecastEnd || record.originalEnd;
    const durationDays = startDate && endDate
      ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
      : 30; // Default to 30 days

    return (durationDays / 30.44) * record.monthlyRate;
  }

  return 0;
};

/**
 * Format currency with thousands separator
 */
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

/**
 * Sanitize AI-generated text to prevent XSS
 */
const sanitizeAIText = (text: string): string => {
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [], // Strip all HTML tags
    ALLOWED_ATTR: [], // Strip all attributes
  });
};

/**
 * Get badge configuration based on impact level
 */
const getImpactConfig = (impactLevel: ImpactLevel) => {
  switch (impactLevel) {
    case 'CRITICAL':
      return {
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        textColor: 'text-red-800 dark:text-red-300',
        borderColor: 'border-red-300 dark:border-red-700',
        icon: AlertCircle,
        label: 'Critical',
        emoji: '🚨',
      };
    case 'HIGH':
      return {
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
        textColor: 'text-orange-800 dark:text-orange-300',
        borderColor: 'border-orange-300 dark:border-orange-700',
        icon: AlertTriangle,
        label: 'High Budget',
        emoji: '⚠️',
      };
    case 'MODERATE':
      return {
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
        textColor: 'text-yellow-800 dark:text-yellow-300',
        borderColor: 'border-yellow-300 dark:border-yellow-700',
        icon: Info,
        label: 'Moderate',
        emoji: 'ℹ️',
      };
    case 'LOW':
    default:
      return {
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        textColor: 'text-green-800 dark:text-green-300',
        borderColor: 'border-green-300 dark:border-green-700',
        icon: CheckCircle,
        label: 'Within Budget',
        emoji: '✅',
      };
  }
};

// ============================================================================
// Component
// ============================================================================

export const FinancialMaskingBadge: React.FC<FinancialMaskingBadgeProps> = ({
  record,
  viewFinancialDetails,
  variant = 'inline',
  className = '',
  organizationId,
}) => {
  const [maskedData, setMaskedData] = useState<MaskedPfaRecord | null>(null);
  const [portfolioInsight, setPortfolioInsight] = useState<PortfolioInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [tooltipTimeout, setTooltipTimeout] = useState<NodeJS.Timeout | null>(null);

  // If user can view financial details, show actual cost
  if (viewFinancialDetails) {
    const cost = calculateCost(record);
    const displayValue = formatCurrency(cost);

    if (variant === 'badge') {
      return (
        <div className={`inline-flex items-center gap-1 px-2 py-1 ${className}`}>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {displayValue}
          </span>
        </div>
      );
    }

    if (variant === 'full') {
      return (
        <div className={`space-y-1 ${className}`}>
          <p className="text-xs text-gray-500 dark:text-gray-400">Cost Information</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{displayValue}</p>
          {record.source === 'Rental' && record.monthlyRate && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Rental: {formatCurrency(record.monthlyRate)}/month
            </p>
          )}
          {record.source === 'Purchase' && record.purchasePrice && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Purchase: {formatCurrency(record.purchasePrice)}
            </p>
          )}
        </div>
      );
    }

    // Default inline variant
    return (
      <span className={`font-semibold text-gray-900 dark:text-gray-100 ${className}`}>
        {displayValue}
      </span>
    );
  }

  // ============================================================================
  // Masked View - Fetch masked data from API
  // ============================================================================

  const fetchMaskedData = useCallback(async () => {
    if (!organizationId) {
      setError('Organization ID required for masking');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Call financial masking API
      const response = await apiClient.post<{
        success: boolean;
        records: MaskedPfaRecord[];
        masked: boolean;
        portfolioInsight?: PortfolioInsight;
      }>('/api/financial/mask', {
        records: [
          {
            id: record.id,
            description: record.manufacturer && record.model
              ? `${record.manufacturer} ${record.model}`
              : record.category || 'Equipment',
            category: record.category,
            class: record.class,
            source: record.source,
            cost: calculateCost(record),
            monthlyRate: record.monthlyRate,
            purchasePrice: record.purchasePrice,
          },
        ],
        viewFinancialDetails: false, // Always false for masked users
      });

      if (response.success && response.records.length > 0) {
        setMaskedData(response.records[0]);
        if (response.portfolioInsight) {
          setPortfolioInsight(response.portfolioInsight);
        }
      } else {
        setError('Failed to mask financial data');
      }
    } catch (err: any) {
      console.error('Financial masking error:', err);
      setError('Budget impact information unavailable');
    } finally {
      setLoading(false);
    }
  }, [record, organizationId]);

  // Fetch masked data on mount
  useEffect(() => {
    fetchMaskedData();
  }, [fetchMaskedData]);

  // Handle tooltip display with 300ms delay
  const handleMouseEnter = () => {
    const timeout = setTimeout(() => setShowTooltip(true), 300);
    setTooltipTimeout(timeout);
  };

  const handleMouseLeave = () => {
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout);
      setTooltipTimeout(null);
    }
    setShowTooltip(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setShowPortfolioModal(true);
    } else if (e.key === 'Escape') {
      setShowTooltip(false);
      setShowPortfolioModal(false);
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        {variant === 'badge' && (
          <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
        )}
        {variant === 'full' && (
          <div className="space-y-2">
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-8 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        )}
        {variant === 'inline' && (
          <div className="h-5 w-28 bg-gray-200 dark:bg-gray-700 rounded inline-block"></div>
        )}
      </div>
    );
  }

  // Error fallback
  if (error || !maskedData) {
    return (
      <span className={`text-gray-400 dark:text-gray-500 font-mono text-sm flex items-center gap-1 ${className}`}>
        <Lock className="w-3 h-3" />
        <span>***masked***</span>
      </span>
    );
  }

  const config = getImpactConfig(maskedData.impactLevel);
  const Icon = config.icon;

  // ============================================================================
  // Variant: Badge (Compact)
  // ============================================================================

  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <span className="text-gray-400 dark:text-gray-500 font-mono text-sm flex items-center gap-1">
          <Lock className="w-3 h-3" />
          <span>***</span>
        </span>
        <span
          className={`
            inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
            ${config.bgColor} ${config.textColor} ${config.borderColor} border
            cursor-help
          `}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
          tabIndex={0}
          role="button"
          aria-label={`Budget impact: ${config.label}`}
        >
          {config.emoji && <span>{config.emoji}</span>}
          <span>{config.label}</span>
        </span>
      </div>
    );
  }

  // ============================================================================
  // Variant: Full (Detail View)
  // ============================================================================

  if (variant === 'full') {
    const sanitizedInsight = maskedData.aiInsight ? sanitizeAIText(maskedData.aiInsight) : '';

    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <Icon className="w-5 h-5" />
          <h3 className="font-semibold">Cost Information</h3>
        </div>

        {/* Masked cost */}
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-400 dark:text-gray-500 font-mono flex items-center gap-2">
            <Lock className="w-5 h-5" />
            <span>***masked***</span>
          </span>
        </div>

        {/* Impact badge */}
        <div
          className={`
            inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
            ${config.bgColor} ${config.textColor} ${config.borderColor} border
          `}
        >
          {config.emoji && <span className="text-lg">{config.emoji}</span>}
          <Icon className="w-4 h-4" />
          <span>Impact Level: {config.label}</span>
        </div>

        {/* Relative indicators */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3 border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Percentile:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              Top {100 - maskedData.percentile}%
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Comparison:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {maskedData.relativeComparison}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-gray-600 dark:text-gray-400">Impact:</span>
            <p className="font-medium text-gray-900 dark:text-gray-100 mt-1">
              {maskedData.impactDescription}
            </p>
          </div>
        </div>

        {/* AI Insight */}
        {sanitizedInsight && (maskedData.impactLevel === 'HIGH' || maskedData.impactLevel === 'CRITICAL') && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-1">
              <span>💡</span>
              <span>AI Insight:</span>
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
              {sanitizedInsight}
            </p>
          </div>
        )}

        {/* Portfolio insights button */}
        {organizationId && (
          <button
            onClick={() => setShowPortfolioModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors w-full justify-center"
          >
            <TrendingUp className="w-4 h-4" />
            <span>View Portfolio Insights</span>
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  // ============================================================================
  // Variant: Inline (Default)
  // ============================================================================

  const sanitizedInsight = maskedData.aiInsight ? sanitizeAIText(maskedData.aiInsight) : '';

  return (
    <div className={`inline-flex items-center gap-2 relative ${className}`}>
      {/* Masked cost */}
      <span className="text-gray-400 dark:text-gray-500 font-mono text-sm flex items-center gap-1">
        <Lock className="w-3 h-3" />
        <span>***masked***</span>
      </span>

      {/* Impact badge with tooltip */}
      <button
        type="button"
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium
          ${config.bgColor} ${config.textColor} ${config.borderColor} border
          cursor-help transition-all duration-150
          hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500
        `}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        onClick={() => setShowPortfolioModal(true)}
        onKeyDown={handleKeyDown}
        aria-label={`Budget impact: ${config.label}. Press Enter to view details.`}
        tabIndex={0}
      >
        {config.emoji && <span>{config.emoji}</span>}
        <Icon className="w-3.5 h-3.5" />
        <span>{config.label}</span>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
              <Icon className="w-4 h-4" />
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                Budget Impact
              </span>
            </div>

            {/* Metrics */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Impact:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {config.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Comparison:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {maskedData.relativeComparison}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Percentile:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  Top {100 - maskedData.percentile}%
                </span>
              </div>
            </div>

            {/* AI Insight */}
            {sanitizedInsight && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                  <span>💡</span>
                  <span>AI Insight:</span>
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  {sanitizedInsight}
                </p>
              </div>
            )}

            {/* Learn more */}
            <button
              onClick={() => setShowPortfolioModal(true)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-2"
            >
              <span>Learn More</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -translate-y-1">
            <div className="w-2 h-2 bg-white dark:bg-gray-800 border-r border-b border-gray-200 dark:border-gray-700 transform rotate-45" />
          </div>
        </div>
      )}

      {/* Portfolio Insights Modal */}
      {showPortfolioModal && portfolioInsight && organizationId && (
        <PortfolioInsightsModal
          portfolioInsight={portfolioInsight}
          organizationId={organizationId}
          onClose={() => setShowPortfolioModal(false)}
        />
      )}
    </div>
  );
};

export default FinancialMaskingBadge;
