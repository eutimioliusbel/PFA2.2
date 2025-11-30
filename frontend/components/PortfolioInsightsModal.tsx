/**
 * Portfolio Insights Modal Component
 *
 * Phase 7, Task 7.2 of ADR-005 Multi-Tenant Access Control
 * AI Use Case 17: Financial Data Masking with Relative Indicators
 *
 * Displays portfolio-level budget impact insights without exposing actual costs.
 * Shows distribution of high-impact items and AI-powered recommendations for
 * budget optimization.
 *
 * SECURITY: This modal NEVER displays actual costs, only relative indicators
 * and aggregated statistics.
 */

import React, { useEffect, useState } from 'react';
import { X, TrendingUp, AlertCircle, AlertTriangle, Info, CheckCircle, Download, BarChart3, FileSpreadsheet, FileText } from 'lucide-react';
import DOMPurify from 'dompurify';
import { exportPortfolioInsights } from '../utils/portfolioExport';

// ============================================================================
// Types
// ============================================================================

export interface PortfolioInsight {
  totalItems: number;
  highImpactCount: number;
  moderateImpactCount: number;
  lowImpactCount: number;
  criticalImpactCount: number;
  summary: string; // AI-generated summary
  topCategoryByImpact?: string;
}

export interface PortfolioInsightsModalProps {
  portfolioInsight: PortfolioInsight;
  organizationId: string;
  organizationName?: string;
  onClose: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

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
 * Calculate percentage for impact distribution
 */
const calculatePercentage = (count: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
};

// ============================================================================
// Component
// ============================================================================

export const PortfolioInsightsModal: React.FC<PortfolioInsightsModalProps> = ({
  portfolioInsight,
  organizationId,
  organizationName,
  onClose,
}) => {
  const [_exportFormat, _setExportFormat] = useState<'csv' | 'excel'>('excel');
  const [showExportMenu, setShowExportMenu] = useState(false);
  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showExportMenu && !target.closest('.export-menu-container')) {
        setShowExportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  const sanitizedSummary = sanitizeAIText(portfolioInsight.summary);

  const impactData = [
    {
      label: 'Critical Impact',
      count: portfolioInsight.criticalImpactCount,
      percentage: calculatePercentage(portfolioInsight.criticalImpactCount, portfolioInsight.totalItems),
      color: 'bg-red-500',
      textColor: 'text-red-700 dark:text-red-300',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      icon: AlertCircle,
      emoji: '🚨',
    },
    {
      label: 'High Impact',
      count: portfolioInsight.highImpactCount,
      percentage: calculatePercentage(portfolioInsight.highImpactCount, portfolioInsight.totalItems),
      color: 'bg-orange-500',
      textColor: 'text-orange-700 dark:text-orange-300',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      icon: AlertTriangle,
      emoji: '⚠️',
    },
    {
      label: 'Moderate Impact',
      count: portfolioInsight.moderateImpactCount,
      percentage: calculatePercentage(portfolioInsight.moderateImpactCount, portfolioInsight.totalItems),
      color: 'bg-yellow-500',
      textColor: 'text-yellow-700 dark:text-yellow-300',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      icon: Info,
      emoji: 'ℹ️',
    },
    {
      label: 'Within Budget',
      count: portfolioInsight.lowImpactCount,
      percentage: calculatePercentage(portfolioInsight.lowImpactCount, portfolioInsight.totalItems),
      color: 'bg-green-500',
      textColor: 'text-green-700 dark:text-green-300',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      icon: CheckCircle,
      emoji: '✅',
    },
  ];

  const handleExportReport = (format: 'csv' | 'excel') => {
    try {
      exportPortfolioInsights(
        portfolioInsight,
        {
          organizationId,
          organizationName,
        },
        format
      );
      setShowExportMenu(false);
    } catch (error) {
      console.error('Failed to export portfolio insights:', error);
      alert('Failed to export report. Please try again.');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portfolio-insights-title"
      >
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 id="portfolio-insights-title" className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Portfolio Budget Insights
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Equipment</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {portfolioInsight.totalItems.toLocaleString()}
                </p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                <p className="text-xs text-red-600 dark:text-red-400 mb-1">Critical Items</p>
                <p className="text-3xl font-bold text-red-700 dark:text-red-300">
                  {portfolioInsight.criticalImpactCount}
                </p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                <p className="text-xs text-orange-600 dark:text-orange-400 mb-1">High Impact</p>
                <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">
                  {portfolioInsight.highImpactCount}
                </p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <p className="text-xs text-green-600 dark:text-green-400 mb-1">Within Budget</p>
                <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                  {portfolioInsight.lowImpactCount}
                </p>
              </div>
            </div>

            {/* Impact Distribution */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Budget Impact Distribution
              </h3>

              <div className="space-y-3">
                {impactData.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className={`${item.bgColor} rounded-lg p-4 border ${item.textColor.replace('text-', 'border-').replace('dark:text-', 'dark:border-')}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {item.emoji && <span className="text-lg">{item.emoji}</span>}
                          <Icon className="w-4 h-4" />
                          <span className={`font-semibold ${item.textColor}`}>{item.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-medium ${item.textColor}`}>
                            {item.count} items
                          </span>
                          <span className={`text-lg font-bold ${item.textColor}`}>
                            {item.percentage}%
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-white dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`${item.color} h-full transition-all duration-500`}
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Recommendation */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-5">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-3 flex items-center gap-2">
                <span>💡</span>
                <span>AI Recommendation</span>
              </h3>
              <p className="text-blue-800 dark:text-blue-300 leading-relaxed">
                {sanitizedSummary}
              </p>
              {portfolioInsight.topCategoryByImpact && (
                <div className="mt-4 p-3 bg-white dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-900">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>Top Category by Impact:</strong> {portfolioInsight.topCategoryByImpact}
                  </p>
                </div>
              )}
            </div>

            {/* Key Insights */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Key Insights
              </h3>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                {(portfolioInsight.criticalImpactCount + portfolioInsight.highImpactCount) > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500 mt-0.5">•</span>
                    <span>
                      Focus on reviewing the <strong>{portfolioInsight.criticalImpactCount + portfolioInsight.highImpactCount}</strong> critical
                      and high-impact items. Small optimizations here could yield significant budget savings.
                    </span>
                  </li>
                )}
                {portfolioInsight.moderateImpactCount > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">•</span>
                    <span>
                      <strong>{portfolioInsight.moderateImpactCount}</strong> items have moderate impact - consider
                      reviewing these for potential duration adjustments.
                    </span>
                  </li>
                )}
                {portfolioInsight.lowImpactCount > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">•</span>
                    <span>
                      <strong>{portfolioInsight.lowImpactCount}</strong> items are within budget - these are
                      performing as expected.
                    </span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>
                    For detailed cost analysis, contact your organization administrator to request
                    <strong> viewFinancialDetails</strong> permission.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="relative export-menu-container">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export Report</span>
              </button>

              {/* Export Format Dropdown */}
              {showExportMenu && (
                <div className="absolute bottom-full left-0 mb-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-10">
                  <div className="p-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 px-3 py-2 font-semibold">
                      Select Format
                    </p>
                    <button
                      onClick={() => handleExportReport('excel')}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-left"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Excel (.xls)</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Formatted with colors</p>
                      </div>
                    </button>
                    <button
                      onClick={() => handleExportReport('csv')}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-left"
                    >
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">CSV (.csv)</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Universal compatibility</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default PortfolioInsightsModal;
