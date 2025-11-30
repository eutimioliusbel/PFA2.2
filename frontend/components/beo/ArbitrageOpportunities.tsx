/**
 * Arbitrage Opportunities Component
 *
 * Displays AI-detected cross-organization asset arbitrage opportunities
 * with feasibility scores, distance calculations, and transfer proposals.
 *
 * Use Case 23: Asset Arbitrage Detector
 * Phase 8, Task 8.3 of ADR-005 Multi-Tenant Access Control
 */

import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  Calendar,
  Truck,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface Location {
  lat: number;
  lon: number;
  address: string;
}

interface ArbitrageOpportunity {
  id: string;
  type: 'idle_transfer' | 'duplicate_rental' | 'consolidation';
  sourceOrgId: string;
  sourceOrgCode: string;
  sourceOrgName: string;
  sourceLocation: Location | null;
  destOrgId: string;
  destOrgCode: string;
  destOrgName: string;
  destLocation: Location | null;
  equipmentCategory: string;
  equipmentClass: string | null;
  idlePeriod?: {
    start: Date;
    end: Date;
    days: number;
  };
  needPeriod: {
    start: Date;
    end: Date;
    days: number;
  };
  overlapPeriod: {
    start: Date;
    end: Date;
    days: number;
  };
  potentialSavings: number;
  transferCost: number;
  netSavings: number;
  feasibilityScore: number;
  feasibilityBreakdown: {
    compatibility: number;
    logistics: number;
    costSavings: number;
  };
  distance: number | null;
  pros: string[];
  cons: string[];
  isFeasible: boolean;
  status: 'detected' | 'approved' | 'rejected' | 'completed';
}

interface ArbitrageResponse {
  success: boolean;
  opportunities: ArbitrageOpportunity[];
  summary: {
    totalOpportunities: number;
    feasibleOpportunities: number;
    totalPotentialSavings: number;
    totalNetSavings: number;
  };
  metadata: {
    organizationsAnalyzed: number;
    latencyMs: number;
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export const ArbitrageOpportunities: React.FC = () => {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ArbitrageResponse['summary'] | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [proposing, setProposing] = useState<Set<string>>(new Set());

  // Fetch opportunities on mount
  useEffect(() => {
    fetchOpportunities();
  }, []);

  const fetchOpportunities = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('pfa_auth_token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/beo/arbitrage/opportunities', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch opportunities');
      }

      const data: ArbitrageResponse = await response.json();

      // Parse date strings to Date objects
      const parsedOpportunities = data.opportunities.map(opp => ({
        ...opp,
        idlePeriod: opp.idlePeriod
          ? {
              ...opp.idlePeriod,
              start: new Date(opp.idlePeriod.start),
              end: new Date(opp.idlePeriod.end),
            }
          : undefined,
        needPeriod: {
          ...opp.needPeriod,
          start: new Date(opp.needPeriod.start),
          end: new Date(opp.needPeriod.end),
        },
        overlapPeriod: {
          ...opp.overlapPeriod,
          start: new Date(opp.overlapPeriod.start),
          end: new Date(opp.overlapPeriod.end),
        },
      }));

      setOpportunities(parsedOpportunities);
      setSummary(data.summary);
    } catch (err) {
      console.error('Error fetching arbitrage opportunities:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const proposeTransfer = async (opportunityId: string) => {
    setProposing(new Set(proposing).add(opportunityId));

    try {
      const token = localStorage.getItem('pfa_auth_token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/beo/arbitrage/propose-transfer', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ opportunityId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to propose transfer');
      }

      const data = await response.json();
      alert(`Transfer proposal created successfully: ${data.proposalId}`);

      // Refresh opportunities
      await fetchOpportunities();
    } catch (err) {
      console.error('Error proposing transfer:', err);
      alert(err instanceof Error ? err.message : 'Failed to propose transfer');
    } finally {
      const newProposing = new Set(proposing);
      newProposing.delete(opportunityId);
      setProposing(newProposing);
    }
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const getFeasibilityColor = (score: number): string => {
    if (score >= 0.8) return 'bg-green-500';
    if (score >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getFeasibilityTextColor = (score: number): string => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        <span className="ml-3 text-lg text-slate-400">Detecting arbitrage opportunities...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-900/20 border border-red-800 rounded-lg">
        <div className="flex items-start">
          <XCircle className="w-6 h-6 text-red-500 mt-0.5" />
          <div className="ml-3">
            <h3 className="text-lg font-semibold text-red-400">Error</h3>
            <p className="text-red-300">{error}</p>
            <button
              onClick={fetchOpportunities}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Asset Arbitrage Detector</h1>
          <p className="text-slate-400 mt-1">
            AI-powered cross-organization equipment consolidation opportunities
          </p>
        </div>
        <button
          onClick={fetchOpportunities}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-800">
            <div className="text-sm text-blue-400 font-medium">Total Opportunities</div>
            <div className="text-3xl font-bold text-blue-300 mt-1">
              {summary.totalOpportunities}
            </div>
          </div>
          <div className="bg-green-900/20 p-4 rounded-lg border border-green-800">
            <div className="text-sm text-green-400 font-medium">Feasible</div>
            <div className="text-3xl font-bold text-green-300 mt-1">
              {summary.feasibleOpportunities}
            </div>
          </div>
          <div className="bg-purple-900/20 p-4 rounded-lg border border-purple-800">
            <div className="text-sm text-purple-400 font-medium">Potential Savings</div>
            <div className="text-3xl font-bold text-purple-300 mt-1">
              {formatCurrency(summary.totalPotentialSavings)}
            </div>
          </div>
          <div className="bg-indigo-900/20 p-4 rounded-lg border border-indigo-800">
            <div className="text-sm text-indigo-400 font-medium">Net Savings</div>
            <div className="text-3xl font-bold text-indigo-300 mt-1">
              {formatCurrency(summary.totalNetSavings)}
            </div>
          </div>
        </div>
      )}

      {/* Opportunities List */}
      {opportunities.length === 0 ? (
        <div className="text-center p-12 bg-slate-800 rounded-lg border border-slate-700">
          <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-300">No Opportunities Found</h3>
          <p className="text-slate-400 mt-2">
            No idle equipment or consolidation opportunities detected at this time.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {opportunities.map(opp => {
            const isExpanded = expandedIds.has(opp.id);
            const isProposing = proposing.has(opp.id);

            return (
              <div
                key={opp.id}
                className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden hover:border-slate-600 transition-colors"
              >
                {/* Card Header */}
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    {/* Left: Savings */}
                    <div className="flex-1">
                      <div className="flex items-baseline">
                        <span className="text-4xl font-bold text-green-400">
                          {formatCurrency(opp.netSavings)}
                        </span>
                        <span className="ml-2 text-sm text-slate-400">net savings</span>
                      </div>
                      <div className="mt-2 text-lg text-white font-medium">
                        Idle Equipment Transfer: {opp.sourceOrgCode} → {opp.destOrgCode}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">
                        {opp.equipmentCategory}
                        {opp.equipmentClass && ` - ${opp.equipmentClass}`}
                      </div>
                    </div>

                    {/* Right: Feasibility Score */}
                    <div className="text-right">
                      <div className="text-sm text-slate-400 mb-1">Feasibility</div>
                      <div className={`text-3xl font-bold ${getFeasibilityTextColor(opp.feasibilityScore)}`}>
                        {Math.round(opp.feasibilityScore * 100)}%
                      </div>
                      <div className="mt-2 w-32 bg-slate-700 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full ${getFeasibilityColor(opp.feasibilityScore)} transition-all`}
                          style={{ width: `${opp.feasibilityScore * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="mt-4 flex items-center gap-6 text-sm text-slate-400">
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 mr-1" />
                      {opp.distance !== null ? `${opp.distance} miles` : 'Distance unknown'}
                    </div>
                    <div className="flex items-center">
                      <Truck className="w-4 h-4 mr-1" />
                      {formatCurrency(opp.transferCost)} transport
                    </div>
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {opp.overlapPeriod.days} days
                    </div>
                  </div>

                  {/* Feasibility Breakdown */}
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="bg-blue-900/20 p-3 rounded-lg border border-blue-800">
                      <div className="text-xs text-blue-400 font-medium">Compatibility</div>
                      <div className="text-lg font-bold text-blue-300">
                        {Math.round(opp.feasibilityBreakdown.compatibility * 100)}%
                      </div>
                    </div>
                    <div className="bg-green-900/20 p-3 rounded-lg border border-green-800">
                      <div className="text-xs text-green-400 font-medium">Logistics</div>
                      <div className="text-lg font-bold text-green-300">
                        {Math.round(opp.feasibilityBreakdown.logistics * 100)}%
                      </div>
                    </div>
                    <div className="bg-purple-900/20 p-3 rounded-lg border border-purple-800">
                      <div className="text-xs text-purple-400 font-medium">Cost Savings</div>
                      <div className="text-lg font-bold text-purple-300">
                        {Math.round(opp.feasibilityBreakdown.costSavings * 100)}%
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={() => proposeTransfer(opp.id)}
                      disabled={!opp.isFeasible || isProposing}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center ${
                        opp.isFeasible
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {isProposing ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Proposing...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Propose Transfer
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => toggleExpanded(opp.id)}
                      className="px-4 py-2 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors flex items-center text-slate-300"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-4 h-4 mr-2" />
                          Hide Details
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4 mr-2" />
                          View Details
                        </>
                      )}
                    </button>
                    <button className="px-4 py-2 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors text-red-400">
                      Dismiss
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-700 bg-slate-900 p-6">
                    <div className="grid grid-cols-2 gap-6">
                      {/* Left: Pros */}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center">
                          <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                          Pros
                        </h4>
                        <ul className="space-y-2">
                          {opp.pros.map((pro, idx) => (
                            <li key={idx} className="text-sm text-slate-400 flex items-start">
                              <span className="text-green-500 mr-2">•</span>
                              {pro}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Right: Cons */}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center">
                          <XCircle className="w-4 h-4 text-red-500 mr-2" />
                          Cons
                        </h4>
                        <ul className="space-y-2">
                          {opp.cons.map((con, idx) => (
                            <li key={idx} className="text-sm text-slate-400 flex items-start">
                              <span className="text-red-500 mr-2">•</span>
                              {con}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Idle Period */}
                    {opp.idlePeriod && (
                      <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-800 rounded-lg">
                        <h4 className="text-sm font-semibold text-yellow-400 mb-2">
                          Idle Period ({opp.sourceOrgCode})
                        </h4>
                        <div className="text-sm text-yellow-300">
                          {formatDate(opp.idlePeriod.start)} - {formatDate(opp.idlePeriod.end)}
                          <span className="ml-2 text-yellow-400">
                            ({opp.idlePeriod.days} days idle)
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Need Period */}
                    <div className="mt-4 p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
                      <h4 className="text-sm font-semibold text-blue-400 mb-2">
                        Need Period ({opp.destOrgCode})
                      </h4>
                      <div className="text-sm text-blue-300">
                        {formatDate(opp.needPeriod.start)} - {formatDate(opp.needPeriod.end)}
                        <span className="ml-2 text-blue-400">
                          ({opp.needPeriod.days} days needed)
                        </span>
                      </div>
                    </div>

                    {/* Overlap Period */}
                    <div className="mt-4 p-4 bg-green-900/20 border border-green-800 rounded-lg">
                      <h4 className="text-sm font-semibold text-green-400 mb-2">
                        Overlap Window (Transfer Opportunity)
                      </h4>
                      <div className="text-sm text-green-300">
                        {formatDate(opp.overlapPeriod.start)} - {formatDate(opp.overlapPeriod.end)}
                        <span className="ml-2 text-green-400 font-semibold">
                          ({opp.overlapPeriod.days} days overlap)
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
