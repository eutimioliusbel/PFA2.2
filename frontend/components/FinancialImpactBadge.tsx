// components/FinancialImpactBadge.tsx
/**
 * Financial Impact Badge Component
 *
 * Phase 7, Task 7.2 of ADR-005 Multi-Tenant Access Control
 * AI Use Case 17: Financial Data Masking with Relative Indicators
 *
 * Displays budget impact indicators for equipment costs without exposing
 * actual dollar amounts. Uses color-coded badges with progressive disclosure
 * tooltips showing percentile, comparison, and AI recommendations.
 */

import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, HelpCircle } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type ImpactLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface FinancialImpactBadgeProps {
  /** Impact level classification (LOW/MODERATE/HIGH/CRITICAL) */
  impactLevel: ImpactLevel;
  /** Percentile within category (0-100, where 95 = Top 5%) */
  percentile: number;
  /** Relative comparison string (e.g., "3.2x average") */
  relativeComparison: string;
  /** Impact description (e.g., "Top 5% of crane costs") */
  impactDescription: string;
  /** AI-generated recommendation (optional) */
  aiInsight?: string;
  /** Compact mode - show only badge without tooltip */
  compact?: boolean;
  /** Custom className */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getBadgeConfig = (impactLevel: ImpactLevel) => {
  switch (impactLevel) {
    case 'CRITICAL':
      return {
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        borderColor: 'border-red-200',
        icon: AlertCircle,
        label: 'Critical Impact',
        emoji: '🚨',
      };
    case 'HIGH':
      return {
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-800',
        borderColor: 'border-orange-200',
        icon: AlertTriangle,
        label: 'High Budget Impact',
        emoji: '⚠️',
      };
    case 'MODERATE':
      return {
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-800',
        borderColor: 'border-yellow-200',
        icon: Info,
        label: 'Moderate Impact',
        emoji: '',
      };
    case 'LOW':
    default:
      return {
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        borderColor: 'border-green-200',
        icon: CheckCircle,
        label: 'Within Budget',
        emoji: '',
      };
  }
};

// ============================================================================
// Component
// ============================================================================

export const FinancialImpactBadge: React.FC<FinancialImpactBadgeProps> = ({
  impactLevel,
  percentile,
  relativeComparison,
  impactDescription,
  aiInsight,
  compact = false,
  className = '',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const config = getBadgeConfig(impactLevel);
  const Icon = config.icon;

  // Tooltip content
  const tooltipContent = (
    <div className="max-w-xs space-y-3 p-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        <span className="font-semibold text-sm">Budget Impact Analysis</span>
      </div>

      {/* Metrics */}
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-600">Percentile:</span>
          <span className="font-medium">
            {percentile}th ({impactDescription})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Comparison:</span>
          <span className="font-medium">{relativeComparison}</span>
        </div>
      </div>

      {/* AI Insight */}
      {aiInsight && (impactLevel === 'HIGH' || impactLevel === 'CRITICAL') && (
        <div className="border-t pt-2 mt-2">
          <p className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
            <span>💡</span>
            <span>Recommendation:</span>
          </p>
          <p className="text-xs text-gray-600 leading-relaxed">{aiInsight}</p>
        </div>
      )}

      {/* Cost hidden notice */}
      <div className="border-t pt-2 text-xs text-gray-500 flex items-center gap-1">
        <HelpCircle className="w-3 h-3" />
        <span>Actual cost is hidden based on your access level</span>
      </div>
    </div>
  );

  if (compact) {
    // Compact mode - just the badge
    return (
      <span
        className={`
          inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
          ${config.bgColor} ${config.textColor} ${config.borderColor} border
          ${className}
        `}
      >
        <Icon className="w-3 h-3" />
        <span>{config.label}</span>
      </span>
    );
  }

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Badge */}
      <button
        type="button"
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium
          ${config.bgColor} ${config.textColor} ${config.borderColor} border
          cursor-help transition-all duration-150
          hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500
        `}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        aria-describedby="impact-tooltip"
      >
        {config.emoji && <span>{config.emoji}</span>}
        <Icon className="w-3.5 h-3.5" />
        <span>{config.label}</span>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div
          id="impact-tooltip"
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2"
        >
          <div className="bg-white rounded-lg shadow-lg border border-gray-200">
            {tooltipContent}
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -translate-y-1">
            <div className="w-2 h-2 bg-white border-r border-b border-gray-200 transform rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialImpactBadge;
