// components/MaskedCostField.tsx
/**
 * Masked Cost Field Component
 *
 * Phase 7, Task 7.2 of ADR-005 Multi-Tenant Access Control
 * AI Use Case 17: Financial Data Masking with Relative Indicators
 *
 * Displays cost fields with automatic masking based on user permissions.
 * Shows "***masked***" with relative impact indicators for users without
 * viewFinancialDetails capability.
 */

import React from 'react';
import { Lock } from 'lucide-react';
import { FinancialImpactBadge, ImpactLevel } from './FinancialImpactBadge';

// ============================================================================
// Types
// ============================================================================

export interface MaskedCostFieldProps {
  /** The cost value - either a number (if visible) or '***masked***' string */
  cost: string | number;
  /** Impact level for masked costs */
  impactLevel?: ImpactLevel;
  /** Percentile within category (0-100) */
  percentile?: number;
  /** Relative comparison string (e.g., "3.2x average") */
  relativeComparison?: string;
  /** Impact description (e.g., "Top 5% of crane costs") */
  impactDescription?: string;
  /** AI-generated recommendation */
  aiInsight?: string;
  /** Currency symbol (default: $) */
  currency?: string;
  /** Number formatting locale (default: en-US) */
  locale?: string;
  /** Show label before value */
  label?: string;
  /** Display variant */
  variant?: 'inline' | 'block' | 'compact';
  /** Custom className */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a number as currency
 */
const formatCurrency = (
  value: number,
  currency: string = '$',
  locale: string = 'en-US'
): string => {
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

  return `${currency}${formatted}`;
};

/**
 * Check if the cost value is masked
 */
const isMasked = (cost: string | number): boolean => {
  return typeof cost === 'string' && cost.includes('masked');
};

// ============================================================================
// Component
// ============================================================================

export const MaskedCostField: React.FC<MaskedCostFieldProps> = ({
  cost,
  impactLevel,
  percentile,
  relativeComparison,
  impactDescription,
  aiInsight,
  currency = '$',
  locale = 'en-US',
  label,
  variant = 'inline',
  className = '',
}) => {
  const masked = isMasked(cost);

  // If not masked, show actual value
  if (!masked) {
    const displayValue = typeof cost === 'number' ? formatCurrency(cost, currency, locale) : cost;

    if (variant === 'compact') {
      return (
        <span className={`font-medium text-gray-900 ${className}`}>
          {label && <span className="text-gray-500 mr-1">{label}:</span>}
          {displayValue}
        </span>
      );
    }

    if (variant === 'block') {
      return (
        <div className={`${className}`}>
          {label && <p className="text-xs text-gray-500 mb-1">{label}</p>}
          <p className="text-lg font-semibold text-gray-900">{displayValue}</p>
        </div>
      );
    }

    // Default inline variant
    return (
      <span className={`font-medium text-gray-900 ${className}`}>
        {label && <span className="text-gray-500 mr-1">{label}:</span>}
        {displayValue}
      </span>
    );
  }

  // Masked view
  const hasRelativeIndicators = impactLevel && percentile !== undefined;

  if (variant === 'compact') {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        {label && <span className="text-gray-500">{label}:</span>}
        <span className="text-gray-400 font-mono text-sm flex items-center gap-1">
          <Lock className="w-3 h-3" />
          <span>***</span>
        </span>
        {hasRelativeIndicators && (
          <FinancialImpactBadge
            impactLevel={impactLevel}
            percentile={percentile}
            relativeComparison={relativeComparison || ''}
            impactDescription={impactDescription || ''}
            aiInsight={aiInsight}
            compact
          />
        )}
      </span>
    );
  }

  if (variant === 'block') {
    return (
      <div className={`space-y-2 ${className}`}>
        {label && <p className="text-xs text-gray-500">{label}</p>}

        {/* Masked value with lock icon */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 font-mono flex items-center gap-1">
            <Lock className="w-4 h-4" />
            <span>***masked***</span>
          </span>
        </div>

        {/* Impact badge and details */}
        {hasRelativeIndicators && (
          <div className="space-y-2">
            <FinancialImpactBadge
              impactLevel={impactLevel}
              percentile={percentile}
              relativeComparison={relativeComparison || ''}
              impactDescription={impactDescription || ''}
              aiInsight={aiInsight}
            />

            {/* Additional context for high-impact items */}
            {(impactLevel === 'HIGH' || impactLevel === 'CRITICAL') && (
              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                <p className="font-medium mb-1">
                  {impactDescription}
                </p>
                {aiInsight && (
                  <p className="text-gray-500 mt-1">
                    💡 {aiInsight}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Default inline variant with badge
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {label && <span className="text-gray-500">{label}:</span>}

      <span className="text-gray-400 font-mono text-sm flex items-center gap-1">
        <Lock className="w-3 h-3" />
        <span>***masked***</span>
      </span>

      {hasRelativeIndicators && (
        <FinancialImpactBadge
          impactLevel={impactLevel}
          percentile={percentile}
          relativeComparison={relativeComparison || ''}
          impactDescription={impactDescription || ''}
          aiInsight={aiInsight}
        />
      )}
    </span>
  );
};

export default MaskedCostField;
