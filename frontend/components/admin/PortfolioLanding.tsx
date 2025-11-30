/**
 * Portfolio Landing Component
 * Phase 5, Task 5.7 - BEO Glass Mode
 *
 * Portfolio-level dashboard for Business Enterprise Overhead (BEO) users.
 * Shows cross-organization health metrics, priority items, and performance analytics.
 */

import { useState, useEffect } from 'react';
import {
  Building2,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  X,
  Mic,
  BookOpen,
  Repeat,
  BarChart3,
  Zap,
} from 'lucide-react';
import { HealthScoreBadge } from './HealthScoreBadge';
import { apiClient } from '../../services/apiClient';

interface PortfolioHealth {
  totalOrganizations: number;
  activeOrganizations?: number;
  healthScore: number;
  previousHealthScore?: number;
  totalBudget?: number;
  totalActual?: number;
  totalVariance: number;
  activeUsers: number;
  trends: {
    organizations: number;
    health: number;
    variance: number;
    users: number;
  };
  organizations: Array<{
    id: string;
    code: string;
    name: string;
    healthScore: number;
    previousHealthScore?: number;
    status?: string;
    variance: number;
    activeUsers: number;
    lastSyncAt: string;
    serviceStatus: string;
  }>;
}

interface PriorityItem {
  id: string;
  organizationId: string;
  organizationCode: string;
  severity: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  impactValue: string;
  impactLabel: string;
  affectedRecords: number;
  category: string;
}

interface PortfolioLandingProps {
  currentUser: any;
  onNavigateToOrganization?: (organizationId: string) => void;
  onNavigateToBeoTool?: (tool: 'voice-analyst' | 'narrative-reader' | 'arbitrage-opportunities' | 'vendor-pricing' | 'scenario-builder') => void;
}

export function PortfolioLanding({ currentUser, onNavigateToOrganization, onNavigateToBeoTool }: PortfolioLandingProps) {
  const [portfolioHealth, setPortfolioHealth] = useState<PortfolioHealth | null>(null);
  const [priorityItems, setPriorityItems] = useState<PriorityItem[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [dismissedItems, setDismissedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadPortfolioHealth(), loadPriorityItems()]);
    } catch (error) {
      console.error('Failed to load portfolio data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPortfolioHealth = async () => {
    try {
      const data = await apiClient.getPortfolioHealth();
      // Transform API response to match component interface
      const transformed: PortfolioHealth = {
        totalOrganizations: data.totalOrganizations,
        activeOrganizations: data.activeOrganizations,
        healthScore: data.healthScore,
        previousHealthScore: data.previousHealthScore,
        totalBudget: data.totalBudget,
        totalActual: data.totalActual,
        totalVariance: data.totalVariance,
        activeUsers: data.activeUsers,
        trends: {
          organizations: data.trends?.organizations || 0,
          health: data.trends?.healthScore || 0,
          variance: data.trends?.variance || 0,
          users: data.trends?.users || 0,
        },
        organizations: (data.organizations || []).map((org) => ({
          id: org.id,
          code: org.code,
          name: org.name,
          healthScore: org.healthScore,
          previousHealthScore: org.previousHealthScore,
          status: org.status,
          variance: org.variance || 0,
          activeUsers: org.activeUsers || 0,
          lastSyncAt: org.lastSyncAt || new Date().toISOString(),
          serviceStatus: org.status || 'active',
        })),
      };
      setPortfolioHealth(transformed);
    } catch (error) {
      console.error('Failed to load portfolio health:', error);
      setPortfolioHealth(null);
    }
  };

  const loadPriorityItems = async () => {
    try {
      const data = await apiClient.getPriorityItems();
      // API returns { items: [...] } - extract items array
      const items = data?.items || [];
      setPriorityItems(
        items.map((item) => ({
          id: item.id,
          organizationId: item.organizationId,
          organizationCode: item.organizationCode,
          severity: item.severity,
          title: item.title,
          description: item.description,
          impactValue: item.impactValue,
          impactLabel: item.impactLabel,
          affectedRecords: item.affectedRecords,
          category: item.category,
        }))
      );
    } catch (error) {
      console.error('Failed to load priority items:', error);
      setPriorityItems([]);
    }
  };

  const dismissItem = (itemId: string) => {
    setDismissedItems(new Set([...dismissedItems, itemId]));
  };

  const navigateToOrg = (organizationId: string) => {
    if (onNavigateToOrganization) {
      onNavigateToOrganization(organizationId);
    } else {
      console.warn('Navigation callback not provided');
    }
  };

  const formatCurrency = (value: number): string => {
    if (Math.abs(value) >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1_000) {
      return `$${(value / 1_000).toFixed(0)}K`;
    }
    return `$${value.toLocaleString()}`;
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-4 h-4" />;
      case 'high':
        return <AlertTriangle className="w-4 h-4" />;
      case 'medium':
        return <Clock className="w-4 h-4" />;
      default:
        return <CheckCircle2 className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-300 border-green-500/40';
      case 'suspended':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      case 'archived':
        return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    }
  };

  // Check if user is BEO user
  if (!currentUser?.isBeoUser && !currentUser?.permissions?.includes('perm_ManageSettings')) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950">
        <div className="text-center p-8 bg-slate-900 rounded-lg border border-slate-800 max-w-md">
          <AlertTriangle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-slate-200 mb-2">Access Denied</h2>
          <p className="text-slate-400 mb-4">
            You do not have permission to view the BEO Glass Mode dashboard.
            This feature is restricted to BEO users or users with ManageSettings permission.
          </p>
        </div>
      </div>
    );
  }

  // Check if user has permission to view financial details
  const canViewFinancials = currentUser?.permissions?.includes('perm_ViewFinancials') || false;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="text-slate-400">Loading portfolio data...</div>
      </div>
    );
  }

  if (!portfolioHealth) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="text-slate-400">No portfolio data available</div>
      </div>
    );
  }

  const filteredPriorityItems = (priorityItems || []).filter((item) => !dismissedItems.has(item.id));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-slate-200 mb-2">Portfolio Overview</h1>
        <p className="text-slate-400">
          Cross-organization health and performance metrics across your portfolio
        </p>
      </div>

      {/* Health Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Active Organizations */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <Building2 className="w-8 h-8 text-purple-400" />
            <div
              className={`text-sm font-medium ${
                portfolioHealth.trends.organizations > 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {portfolioHealth.trends.organizations > 0 ? (
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />+
                  {portfolioHealth.trends.organizations}
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <TrendingDown className="w-4 h-4" />
                  {portfolioHealth.trends.organizations}
                </div>
              )}
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-200 mb-1">
            {portfolioHealth.totalOrganizations}
          </div>
          <div className="text-sm text-slate-400">Active Organizations</div>
          <div className="text-xs text-slate-500 mt-2">
            {portfolioHealth.trends.organizations > 0 ? '+' : ''}
            {portfolioHealth.trends.organizations} this quarter
          </div>
        </div>

        {/* Portfolio Health */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle2
              className={`w-8 h-8 ${
                portfolioHealth.healthScore >= 80
                  ? 'text-green-400'
                  : portfolioHealth.healthScore >= 60
                  ? 'text-yellow-400'
                  : 'text-red-400'
              }`}
            />
            <div
              className={`text-sm font-medium ${
                portfolioHealth.trends.health >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {portfolioHealth.trends.health >= 0 ? (
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />+{portfolioHealth.trends.health.toFixed(1)}%
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <TrendingDown className="w-4 h-4" />
                  {portfolioHealth.trends.health.toFixed(1)}%
                </div>
              )}
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-200 mb-1">
            {portfolioHealth.healthScore}%
          </div>
          <div className="text-sm text-slate-400">Portfolio Health Score</div>
          <div className="text-xs text-slate-500 mt-2">
            {portfolioHealth.trends.health >= 0 ? '+' : ''}
            {portfolioHealth.trends.health.toFixed(1)}% from last month
          </div>
        </div>

        {/* Budget Variance */}
        {canViewFinancials && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8 text-orange-400" />
              <div
                className={`text-sm font-medium ${
                  portfolioHealth.totalVariance > 0 ? 'text-red-400' : 'text-green-400'
                }`}
              >
                {portfolioHealth.totalVariance > 0 ? (
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    Over
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <TrendingDown className="w-4 h-4" />
                    Under
                  </div>
                )}
              </div>
            </div>
            <div
              className={`text-3xl font-bold mb-1 ${
                portfolioHealth.totalVariance > 0 ? 'text-red-300' : 'text-green-300'
              }`}
            >
              {formatCurrency(Math.abs(portfolioHealth.totalVariance))}
            </div>
            <div className="text-sm text-slate-400">Budget Variance</div>
            <div className="text-xs text-slate-500 mt-2">
              {portfolioHealth.totalVariance > 0 ? '+' : '-'}
              {formatCurrency(Math.abs(portfolioHealth.totalVariance))} from plan
            </div>
          </div>
        )}

        {/* Active Users */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <Users className="w-8 h-8 text-blue-400" />
            <div
              className={`text-sm font-medium ${
                portfolioHealth.trends.users > 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {portfolioHealth.trends.users > 0 ? (
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />+{portfolioHealth.trends.users}
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <TrendingDown className="w-4 h-4" />
                  {portfolioHealth.trends.users}
                </div>
              )}
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-200 mb-1">
            {portfolioHealth.activeUsers}
          </div>
          <div className="text-sm text-slate-400">Active Users</div>
          <div className="text-xs text-slate-500 mt-2">
            {portfolioHealth.trends.users > 0 ? '+' : ''}
            {portfolioHealth.trends.users} this week
          </div>
        </div>
      </div>

      {/* Priority Attention Section */}
      {filteredPriorityItems.length > 0 && (
        <div>
          <div className="mb-4">
            <h2 className="text-2xl font-semibold text-slate-200 mb-2">Priority Attention</h2>
            <p className="text-slate-400">Items requiring immediate action across your portfolio</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredPriorityItems.map((item) => {
              const severityIcon = getSeverityIcon(item.severity);

              return (
                <div
                  key={item.id}
                  className={`bg-slate-900 border rounded-lg p-6 ${
                    item.severity === 'critical'
                      ? 'border-red-500/40'
                      : item.severity === 'high'
                      ? 'border-orange-500/40'
                      : 'border-yellow-500/40'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold uppercase ${
                          item.severity === 'critical'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : item.severity === 'high'
                            ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                            : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                        }`}
                      >
                        {severityIcon}
                        {item.severity}
                      </span>
                      <span className="text-sm font-medium text-slate-400">
                        {item.organizationCode}
                      </span>
                    </div>
                    <button
                      onClick={() => dismissItem(item.id)}
                      className="p-1 hover:bg-slate-800 rounded transition-colors"
                      title="Dismiss"
                    >
                      <X className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>

                  <h3 className="text-lg font-semibold text-slate-200 mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-400 mb-4">{item.description}</p>

                  <div className="flex items-center gap-6 mb-4">
                    <div>
                      <div className="text-2xl font-bold text-slate-200">{item.impactValue}</div>
                      <div className="text-xs text-slate-500">{item.impactLabel}</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-slate-200">
                        {item.affectedRecords.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-500">Affected Records</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => navigateToOrg(item.organizationId)}
                      className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BEO Intelligence Tools */}
      {onNavigateToBeoTool && (
        <div>
          <div className="mb-4">
            <h2 className="text-2xl font-semibold text-slate-200 mb-2">BEO Intelligence Tools</h2>
            <p className="text-slate-400">AI-powered analytics and scenario planning tools</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Voice Analyst */}
            <button
              onClick={() => onNavigateToBeoTool('voice-analyst')}
              className="group bg-gradient-to-br from-purple-900/30 to-slate-900 border border-purple-500/30 hover:border-purple-500/60 rounded-lg p-5 text-left transition-all hover:shadow-lg hover:shadow-purple-500/10"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors">
                  <Mic className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="font-semibold text-slate-200">Voice Analyst</h3>
              </div>
              <p className="text-sm text-slate-400">
                Ask questions using voice commands and get AI-powered insights
              </p>
            </button>

            {/* Narrative Reports */}
            <button
              onClick={() => onNavigateToBeoTool('narrative-reader')}
              className="group bg-gradient-to-br from-blue-900/30 to-slate-900 border border-blue-500/30 hover:border-blue-500/60 rounded-lg p-5 text-left transition-all hover:shadow-lg hover:shadow-blue-500/10"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                  <BookOpen className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="font-semibold text-slate-200">Narrative Reports</h3>
              </div>
              <p className="text-sm text-slate-400">
                AI-generated variance analysis with evidence-backed storytelling
              </p>
            </button>

            {/* Arbitrage Opportunities */}
            <button
              onClick={() => onNavigateToBeoTool('arbitrage-opportunities')}
              className="group bg-gradient-to-br from-green-900/30 to-slate-900 border border-green-500/30 hover:border-green-500/60 rounded-lg p-5 text-left transition-all hover:shadow-lg hover:shadow-green-500/10"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
                  <Repeat className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="font-semibold text-slate-200">Arbitrage Detector</h3>
              </div>
              <p className="text-sm text-slate-400">
                Cross-organization equipment optimization opportunities
              </p>
            </button>

            {/* Vendor Pricing */}
            <button
              onClick={() => onNavigateToBeoTool('vendor-pricing')}
              className="group bg-gradient-to-br from-orange-900/30 to-slate-900 border border-orange-500/30 hover:border-orange-500/60 rounded-lg p-5 text-left transition-all hover:shadow-lg hover:shadow-orange-500/10"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-orange-500/20 rounded-lg group-hover:bg-orange-500/30 transition-colors">
                  <BarChart3 className="w-5 h-5 text-orange-400" />
                </div>
                <h3 className="font-semibold text-slate-200">Vendor Watchdog</h3>
              </div>
              <p className="text-sm text-slate-400">
                AI-powered vendor pricing analysis and anomaly detection
              </p>
            </button>

            {/* Scenario Simulator */}
            <button
              onClick={() => onNavigateToBeoTool('scenario-builder')}
              className="group bg-gradient-to-br from-cyan-900/30 to-slate-900 border border-cyan-500/30 hover:border-cyan-500/60 rounded-lg p-5 text-left transition-all hover:shadow-lg hover:shadow-cyan-500/10"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-cyan-500/20 rounded-lg group-hover:bg-cyan-500/30 transition-colors">
                  <Zap className="w-5 h-5 text-cyan-400" />
                </div>
                <h3 className="font-semibold text-slate-200">Scenario Simulator</h3>
              </div>
              <p className="text-sm text-slate-400">
                What-if analysis with Monte Carlo risk modeling
              </p>
            </button>
          </div>
        </div>
      )}

      {/* Organization Health Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-200 mb-2">Organization Health</h2>
            <p className="text-slate-400">Performance metrics across all organizations</p>
          </div>
          <div>
            <select
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            >
              <option value="">All Organizations</option>
              {portfolioHealth.organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr className="text-left text-xs text-slate-400">
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 font-medium">Health Score</th>
                  {canViewFinancials && <th className="px-4 py-3 font-medium">Budget Variance</th>}
                  <th className="px-4 py-3 font-medium">Active Users</th>
                  <th className="px-4 py-3 font-medium">Last Sync</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {portfolioHealth.organizations
                  .filter((org) => !selectedOrg || org.id === selectedOrg)
                  .map((org) => (
                    <tr key={org.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <div className="text-sm font-medium text-slate-200">{org.code}</div>
                          <div className="text-xs text-slate-500">{org.name}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <HealthScoreBadge score={org.healthScore} size="sm" />
                      </td>
                      {canViewFinancials && (
                        <td className="px-4 py-3">
                          <span
                            className={`text-sm font-medium ${
                              org.variance > 0 ? 'text-red-300' : 'text-green-300'
                            }`}
                          >
                            {org.variance > 0 ? '+' : ''}
                            {formatCurrency(org.variance)}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-300">{org.activeUsers}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-400">
                          {formatTimestamp(org.lastSyncAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-1 rounded border font-medium capitalize ${getStatusColor(
                            org.serviceStatus
                          )}`}
                        >
                          {org.serviceStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigateToOrg(org.id)}
                          className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded text-sm transition-colors"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
