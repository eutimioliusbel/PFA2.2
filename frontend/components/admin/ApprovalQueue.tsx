/**
 * ApprovalQueue Component
 *
 * Phase 5, Task 5.4 - Pre-Flight Transaction Ceremony
 * ADR-005: Manager Approval Workflow
 *
 * Features:
 * - View audit log of bulk operations
 * - Filter by organization, action type, and risk level
 * - Statistics dashboard for operation tracking
 *
 * Theme: Dark slate (consistent with app)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Building2,
  Calendar,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Eye,
  Loader2,
  BarChart3,
  Shield,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../services/apiClient';
import type { AuditReview, AuditStats } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface FilterState {
  actionType: string;
  risk: string;
  dateRange: 'today' | 'week' | 'month' | 'all';
}

// ============================================================================
// Utility Functions
// ============================================================================

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getRiskColor = (risk: string): string => {
  switch (risk) {
    case 'high':
      return 'text-red-400 bg-red-500/20 border-red-500/40';
    case 'medium':
      return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/40';
    case 'low':
      return 'text-green-400 bg-green-500/20 border-green-500/40';
    default:
      return 'text-slate-400 bg-slate-500/20 border-slate-500/40';
  }
};

const getActionIcon = (action: string): React.ReactNode => {
  const iconClass = 'w-4 h-4';
  const lowerAction = action.toLowerCase();
  if (lowerAction.includes('create') || lowerAction.includes('insert')) {
    return <CheckCircle className={iconClass} />;
  }
  if (lowerAction.includes('delete') || lowerAction.includes('remove')) {
    return <XCircle className={iconClass} />;
  }
  if (lowerAction.includes('update') || lowerAction.includes('modify')) {
    return <Calendar className={iconClass} />;
  }
  if (lowerAction.includes('warning') || lowerAction.includes('error')) {
    return <AlertTriangle className={iconClass} />;
  }
  return <Clock className={iconClass} />;
};

// ============================================================================
// Sub-Components
// ============================================================================

interface ReviewDetailModalProps {
  review: AuditReview;
  onClose: () => void;
}

const ReviewDetailModal: React.FC<ReviewDetailModalProps> = ({ review, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full border border-slate-700 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 bg-slate-900">
          <div className="flex items-center gap-3">
            {getActionIcon(review.action)}
            <div>
              <h2 className="text-xl font-bold text-slate-100">{review.action}</h2>
              <p className="text-sm text-slate-400">Entity: {review.entityType}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium border ${getRiskColor(review.risk)}`}
            >
              {review.risk.toUpperCase()} RISK
            </span>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded transition-colors"
            >
              <XCircle className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary */}
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Operation Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Summary:</span>
                <span className="text-slate-100">{review.summary}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Action Type:</span>
                <span className="text-slate-100 font-medium">{review.action}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Entity Type:</span>
                <span className="text-slate-100">{review.entityType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Organization:</span>
                <span className="text-slate-100">{review.organizationId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">User ID:</span>
                <span className="text-slate-100">{review.userId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Timestamp:</span>
                <span className="text-slate-100">{formatDate(review.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Risk Assessment */}
          <div className={`rounded-lg p-4 border ${getRiskColor(review.risk)}`}>
            <div className="flex items-center gap-2 mb-2">
              {review.risk === 'high' ? (
                <AlertCircle className="w-5 h-5" />
              ) : review.risk === 'medium' ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              <span className="font-medium">
                {review.risk === 'high'
                  ? 'High Risk Operation'
                  : review.risk === 'medium'
                  ? 'Medium Risk Operation'
                  : 'Low Risk Operation'}
              </span>
            </div>
            <p className="text-sm opacity-80">
              {review.risk === 'high'
                ? 'This operation has significant impact and requires careful review.'
                : review.risk === 'medium'
                ? 'This operation has moderate impact.'
                : 'This operation has minimal impact.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-slate-700 bg-slate-900">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ApprovalQueue: React.FC = () => {
  const { currentOrganizationId } = useAuth();
  const [reviews, setReviews] = useState<AuditReview[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReview, setSelectedReview] = useState<AuditReview | null>(null);
  const [expandedRiskLevels, setExpandedRiskLevels] = useState<Set<string>>(new Set(['high', 'medium']));

  const [filters, setFilters] = useState<FilterState>({
    actionType: 'all',
    risk: 'all',
    dateRange: 'week',
  });

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [reviewsResponse, statsResponse] = await Promise.all([
        apiClient.getPreFlightReviews({
          organizationId: currentOrganizationId || undefined,
          limit: 100,
        }),
        apiClient.getPreFlightStats({
          organizationId: currentOrganizationId || undefined,
        }),
      ]);

      if (reviewsResponse?.reviews) {
        setReviews(reviewsResponse.reviews);
      }
      if (statsResponse?.stats) {
        setStats(statsResponse.stats);
      }
    } catch (error) {
      console.error('Failed to load approval queue data:', error);
    }
  }, [currentOrganizationId]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    };
    init();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Filter reviews
  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => {
      if (filters.actionType !== 'all' && review.action !== filters.actionType) return false;
      if (filters.risk !== 'all' && review.risk !== filters.risk) return false;

      // Date range filter
      const reviewDate = new Date(review.createdAt);
      const now = new Date();
      switch (filters.dateRange) {
        case 'today':
          if (reviewDate.toDateString() !== now.toDateString()) return false;
          break;
        case 'week': {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (reviewDate < weekAgo) return false;
          break;
        }
        case 'month': {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (reviewDate < monthAgo) return false;
          break;
        }
      }

      return true;
    });
  }, [reviews, filters]);

  // Group reviews by risk level
  const groupedReviews = useMemo(() => {
    const groups: Record<string, AuditReview[]> = {
      high: [],
      medium: [],
      low: [],
    };

    filteredReviews.forEach((review) => {
      if (groups[review.risk]) {
        groups[review.risk].push(review);
      }
    });

    return groups;
  }, [filteredReviews]);

  // Get unique action types for filter
  const actionTypes = useMemo(() => {
    const types = new Set(reviews.map((r) => r.action));
    return Array.from(types);
  }, [reviews]);

  const toggleRiskLevel = (risk: string) => {
    setExpandedRiskLevels((prev) => {
      const next = new Set(prev);
      if (next.has(risk)) {
        next.delete(risk);
      } else {
        next.add(risk);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Audit Queue</h1>
            <p className="text-sm text-slate-400">
              Review bulk operations and audit trail
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <BarChart3 className="w-5 h-5" />
              <span className="text-sm font-medium">Total Actions</span>
            </div>
            <p className="text-2xl font-bold text-slate-100">{stats.totalActions}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">High Risk</span>
            </div>
            <p className="text-2xl font-bold text-slate-100">{groupedReviews.high.length}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-400 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm font-medium">Medium Risk</span>
            </div>
            <p className="text-2xl font-bold text-slate-100">{groupedReviews.medium.length}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Low Risk</span>
            </div>
            <p className="text-2xl font-bold text-slate-100">{groupedReviews.low.length}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">Filters</span>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Action Type</label>
            <select
              value={filters.actionType}
              onChange={(e) => setFilters((prev) => ({ ...prev, actionType: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Types</option>
              {actionTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Risk Level</label>
            <select
              value={filters.risk}
              onChange={(e) => setFilters((prev) => ({ ...prev, risk: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Levels</option>
              <option value="high">High Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="low">Low Risk</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Date Range</label>
            <select
              value={filters.dateRange}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  dateRange: e.target.value as FilterState['dateRange'],
                }))
              }
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() =>
                setFilters({
                  actionType: 'all',
                  risk: 'all',
                  dateRange: 'week',
                })
              }
              className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-sm font-medium transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Review List */}
      <div className="space-y-4">
        {(['high', 'medium', 'low'] as const).map((risk) => {
          const riskReviews = groupedReviews[risk] || [];
          const isExpanded = expandedRiskLevels.has(risk);

          return (
            <div key={risk} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
              {/* Risk Header */}
              <button
                onClick={() => toggleRiskLevel(risk)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${getRiskColor(risk)}`}
                  >
                    {risk.toUpperCase()} RISK
                  </span>
                  <span className="text-slate-300 font-medium">
                    {riskReviews.length} operation{riskReviews.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {risk === 'high' && riskReviews.length > 0 && (
                  <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-medium">
                    Requires Review
                  </span>
                )}
              </button>

              {/* Reviews */}
              {isExpanded && riskReviews.length > 0 && (
                <div className="border-t border-slate-700 divide-y divide-slate-700">
                  {riskReviews.map((review) => (
                    <div
                      key={review.id}
                      className="flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-slate-900 rounded-lg">
                          {getActionIcon(review.action)}
                        </div>
                        <div>
                          <p className="text-slate-100 font-medium">{review.action}</p>
                          <p className="text-sm text-slate-400">{review.summary}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {review.userId}
                            </span>
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {review.organizationId}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(review.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">{review.entityType}</span>
                        <button
                          onClick={() => setSelectedReview(review)}
                          className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-5 h-5 text-slate-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {isExpanded && riskReviews.length === 0 && (
                <div className="p-8 text-center text-slate-500 border-t border-slate-700">
                  No {risk} risk operations found
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Detail Modal */}
      {selectedReview && (
        <ReviewDetailModal
          review={selectedReview}
          onClose={() => setSelectedReview(null)}
        />
      )}
    </div>
  );
};

export default ApprovalQueue;
