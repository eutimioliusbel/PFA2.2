/**
 * Vendor Pricing Dashboard Component
 *
 * AI-powered vendor pricing analysis dashboard that displays:
 * - Pricing anomaly alerts (vendors charging >15% above market)
 * - Vendor comparison tables sorted by price competitiveness
 * - Vendor performance scorecards with rankings
 * - Month-over-month rate change tracking
 *
 * Use Case 24: Vendor Pricing Watchdog
 * Phase 8, Task 8.4 of ADR-005 Multi-Tenant Access Control
 */

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  Award,
  BarChart3,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface PricingAnomaly {
  id: string;
  type: 'overpriced' | 'suspicious_increase' | 'market_shift';
  severity: 'high' | 'medium' | 'low';
  vendorName: string;
  category: string;
  organizationId: string;
  currentRate: number;
  marketRate: number;
  deviationPercent: number;
  recommendation: string;
  status: 'active' | 'resolved' | 'dismissed';
  detectedAt: string;
}

interface VendorCategoryData {
  vendorName: string;
  category: string;
  avgMonthlyRate: number;
  equipmentCount: number;
  organizationIds: string[];
}

interface MarketData {
  category: string;
  marketAvgRate: number;
  vendors: VendorCategoryData[];
}

interface VendorScorecard {
  vendorName: string;
  priceCompetitiveness: number; // 0-1
  rateStability: number; // 0-1
  equipmentCoverage: number; // 0-1
  overallScore: number; // 0-1
  rank: number;
  categories: string[];
}

interface PricingAnalysis {
  marketData: MarketData[];
  anomalies: PricingAnomaly[];
  vendorScorecards: VendorScorecard[];
  summary: {
    totalVendors: number;
    totalCategories: number;
    anomaliesDetected: number;
    avgDeviationPercent: number;
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export const VendorPricingDashboard: React.FC = () => {
  const [analysis, setAnalysis] = useState<PricingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'rank' | 'price' | 'stability' | 'coverage'>('rank');
  const [expandedAnomalies, setExpandedAnomalies] = useState<Set<string>>(new Set());

  // Load pricing analysis on mount
  useEffect(() => {
    loadPricingAnalysis();
  }, []);

  const loadPricingAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/beo/vendor-pricing/analysis', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('pfa_auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load pricing analysis');
      }

      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const dismissAnomaly = async (anomalyId: string) => {
    try {
      const response = await fetch(`/api/beo/vendor-pricing/dismiss-anomaly/${anomalyId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('pfa_auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to dismiss anomaly');
      }

      // Reload analysis
      loadPricingAnalysis();
    } catch (err) {
      console.error('Error dismissing anomaly:', err);
    }
  };

  const toggleAnomalyExpansion = (anomalyId: string) => {
    setExpandedAnomalies(prev => {
      const next = new Set(prev);
      if (next.has(anomalyId)) {
        next.delete(anomalyId);
      } else {
        next.add(anomalyId);
      }
      return next;
    });
  };

  // Filter market data by selected category
  const filteredMarketData = selectedCategory === 'all'
    ? analysis?.marketData || []
    : analysis?.marketData.filter(m => m.category === selectedCategory) || [];

  // Sort vendor scorecards
  const sortedScorecards = [...(analysis?.vendorScorecards || [])].sort((a, b) => {
    if (sortBy === 'rank') return a.rank - b.rank;
    if (sortBy === 'price') return b.priceCompetitiveness - a.priceCompetitiveness;
    if (sortBy === 'stability') return b.rateStability - a.rateStability;
    if (sortBy === 'coverage') return b.equipmentCoverage - a.equipmentCoverage;
    return 0;
  });

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-slate-400">Analyzing vendor pricing...</span>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
        <div className="flex items-center">
          <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
          <span className="text-red-400">{error}</span>
        </div>
        <button
          onClick={loadPricingAnalysis}
          className="mt-3 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-md text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!analysis) return null;

  // Get top 3 anomalies
  const topAnomalies = analysis.anomalies
    .filter(a => a.status === 'active')
    .sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity] || b.deviationPercent - a.deviationPercent;
    })
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Vendor Pricing Watchdog</h2>
          <p className="text-slate-400 mt-1">
            AI-powered vendor pricing analysis across {analysis.summary.totalVendors} vendors
          </p>
        </div>
        <button
          onClick={loadPricingAnalysis}
          className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Analysis
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Vendors</p>
              <p className="text-2xl font-bold text-white">{analysis.summary.totalVendors}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Categories</p>
              <p className="text-2xl font-bold text-white">{analysis.summary.totalCategories}</p>
            </div>
            <Award className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Anomalies Detected</p>
              <p className="text-2xl font-bold text-red-400">{analysis.summary.anomaliesDetected}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Avg Deviation</p>
              <p className="text-2xl font-bold text-white">
                {analysis.summary.avgDeviationPercent.toFixed(1)}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Pricing Anomaly Alerts */}
      {topAnomalies.length > 0 && (
        <div className="bg-red-900/20 border-l-4 border-red-500 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="ml-3 flex-1">
              <h3 className="text-lg font-semibold text-red-400 mb-3">
                Pricing Anomalies Detected
              </h3>
              <div className="space-y-3">
                {topAnomalies.map(anomaly => (
                  <div key={anomaly.id} className="bg-slate-800 border border-red-800 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            anomaly.severity === 'high' ? 'bg-red-600 text-white' :
                            anomaly.severity === 'medium' ? 'bg-orange-500 text-white' :
                            'bg-yellow-500 text-white'
                          }`}>
                            {anomaly.severity.toUpperCase()}
                          </span>
                          <span className="text-sm font-semibold text-white">
                            {anomaly.vendorName} - {anomaly.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mb-2">
                          <div>
                            <span className="text-xs text-slate-400">Current Rate:</span>
                            <span className="ml-1 text-sm font-bold text-red-400">
                              ${anomaly.currentRate.toLocaleString()}/mo
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-slate-400">Market Avg:</span>
                            <span className="ml-1 text-sm font-semibold text-slate-300">
                              ${anomaly.marketRate.toLocaleString()}/mo
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-slate-400">Deviation:</span>
                            <span className="ml-1 text-sm font-bold text-red-400">
                              +{anomaly.deviationPercent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        {expandedAnomalies.has(anomaly.id) && (
                          <div className="mt-2 p-2 bg-slate-900 rounded">
                            <p className="text-sm text-slate-300">{anomaly.recommendation}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => toggleAnomalyExpansion(anomaly.id)}
                          className="p-1 hover:bg-slate-700 rounded"
                        >
                          {expandedAnomalies.has(anomaly.id) ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        <button
                          onClick={() => dismissAnomaly(anomaly.id)}
                          className="p-1 hover:bg-red-900/30 rounded transition-colors"
                          title="Dismiss anomaly"
                        >
                          <X className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Scorecard */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Vendor Performance Scorecard</h3>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1 border border-slate-600 rounded-lg text-sm bg-slate-700 text-white"
            >
              <option value="rank">Overall Rank</option>
              <option value="price">Price Competitiveness</option>
              <option value="stability">Rate Stability</option>
              <option value="coverage">Equipment Coverage</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Rank</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Vendor</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Price Score</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Rate Stability</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Coverage</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Overall Score</th>
              </tr>
            </thead>
            <tbody>
              {sortedScorecards.map(scorecard => (
                <tr key={scorecard.vendorName} className="border-b border-slate-700 hover:bg-slate-700">
                  <td className="py-3 px-4">
                    <div className="flex items-center">
                      {scorecard.rank === 1 && (
                        <Award className="w-5 h-5 text-yellow-500 mr-2" />
                      )}
                      {scorecard.rank === 2 && (
                        <Award className="w-5 h-5 text-gray-400 mr-2" />
                      )}
                      {scorecard.rank === 3 && (
                        <Award className="w-5 h-5 text-orange-400 mr-2" />
                      )}
                      <span className="font-semibold text-white">#{scorecard.rank}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <div className="font-semibold text-white">{scorecard.vendorName}</div>
                      <div className="text-xs text-slate-400">
                        {scorecard.categories.length} categories
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500"
                          style={{ width: `${scorecard.priceCompetitiveness * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-slate-300">
                        {(scorecard.priceCompetitiveness * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            scorecard.rateStability > 0.8 ? 'bg-green-500' :
                            scorecard.rateStability > 0.6 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${scorecard.rateStability * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-slate-300">
                        {(scorecard.rateStability * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${scorecard.equipmentCoverage * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-slate-300">
                        {(scorecard.equipmentCoverage * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-white">
                      {(scorecard.overallScore * 100).toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vendor Comparison by Category */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Vendor Comparison by Category</h3>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-slate-600 rounded-lg bg-slate-700 text-white"
          >
            <option value="all">All Categories</option>
            {analysis.marketData.map(market => (
              <option key={market.category} value={market.category}>
                {market.category}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-6">
          {filteredMarketData.map(market => (
            <div key={market.category} className="border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-white">{market.category}</h4>
                <div className="text-sm text-slate-400">
                  Market Avg: <span className="font-semibold text-slate-300">${market.marketAvgRate.toLocaleString()}/mo</span>
                </div>
              </div>

              <div className="space-y-2">
                {market.vendors
                  .sort((a, b) => a.avgMonthlyRate - b.avgMonthlyRate)
                  .map((vendor, index) => {
                    const deviation = ((vendor.avgMonthlyRate - market.marketAvgRate) / market.marketAvgRate) * 100;
                    const isOverpriced = deviation > 15;

                    return (
                      <div
                        key={vendor.vendorName}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          isOverpriced ? 'bg-red-900/20 border border-red-800' : 'bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {index === 0 && <Award className="w-5 h-5 text-yellow-500" />}
                          <div>
                            <div className="font-semibold text-white">{vendor.vendorName}</div>
                            <div className="text-xs text-slate-400">
                              {vendor.equipmentCount} equipment items
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="font-bold text-white">
                              ${vendor.avgMonthlyRate.toLocaleString()}/mo
                            </div>
                            <div className={`text-sm ${
                              deviation > 0 ? 'text-red-400' : 'text-green-400'
                            }`}>
                              {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}% vs market
                            </div>
                          </div>
                          {isOverpriced && (
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
