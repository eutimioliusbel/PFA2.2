/**
 * History Tab Component
 * Phase 5, Task 5.5 - Time Travel Revert
 *
 * Displays transaction history with Time Travel revert capability.
 * Allows users with timeTravel permission to undo bulk operations within 7 days.
 */

import { useState, useEffect, useMemo } from 'react';
import { History, Lock, Search, Filter, Clock, RotateCcw, Eye } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { RevertModal } from './RevertModal';
import type { AuditLog } from '../../types';

interface HistoryTabProps {
  organizationId: string;
  currentUser: any;
}

export function HistoryTab({ organizationId, currentUser }: HistoryTabProps) {
  const [transactions, setTransactions] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<AuditLog | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  // Check if user has timeTravel capability
  const hasTimeTravel = useMemo(() => {
    // TimeTravel requires perm_ManageSettings permission
    return currentUser?.permissions?.includes('perm_ManageSettings') || false;
  }, [currentUser]);

  useEffect(() => {
    loadTransactionHistory();
  }, [organizationId]);

  const loadTransactionHistory = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getAuditLogs({
        organizationId,
        limit: 100,
        orderBy: 'timestamp_desc',
      });
      setTransactions(data.logs || []);
    } catch (error) {
      console.error('Failed to load transaction history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevert = async (transactionId: string, comment: string) => {
    try {
      await apiClient.revertTransaction(transactionId, { comment, organizationId });
      alert('Transaction reverted successfully');
      await loadTransactionHistory();
      setSelectedTx(null);
    } catch (error: any) {
      console.error('Failed to revert transaction:', error);
      alert(`Failed to revert: ${error.message || 'Unknown error'}`);
    }
  };

  // Check if transaction can be reverted
  const canRevert = (tx: AuditLog): boolean => {
    if (!hasTimeTravel) return false;
    if (!tx.success) return false;

    // Check if transaction is revertible action
    const revertibleActions = [
      'pfa:bulk_update',
      'pfa:bulk_shift_time',
      'pfa:bulk_adjust_duration',
      'pfa:bulk_change_category',
      'pfa:bulk_change_dor',
      'pre_flight_review',
    ];
    if (!revertibleActions.includes(tx.action)) return false;

    // Check 7-day restriction
    const txDate = new Date(tx.timestamp || tx.createdAt);
    const now = new Date();
    const daysDiff = (now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 7) return false;

    // Check if already reverted
    if (tx.metadata?.reverted === true) return false;

    return true;
  };

  // Check if transaction has been reverted
  const isReverted = (tx: AuditLog): boolean => {
    return tx.metadata?.reverted === true;
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesUser = tx.user?.username?.toLowerCase().includes(query);
        const matchesAction = tx.action?.toLowerCase().includes(query);
        const matchesComment = (tx.metadata?.comment as string | undefined)?.toLowerCase().includes(query);
        if (!matchesUser && !matchesAction && !matchesComment) return false;
      }

      // Action filter
      if (actionFilter && tx.action !== actionFilter) return false;

      return true;
    });
  }, [transactions, searchQuery, actionFilter]);

  // Format timestamp
  const formatTimestamp = (timestamp: Date | string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format action name
  const formatActionName = (action: string): string => {
    return action
      .replace('pfa:', '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // Get days since transaction
  const getDaysSince = (timestamp: Date | string): number => {
    const txDate = new Date(timestamp);
    const now = new Date();
    return Math.floor((now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  if (!hasTimeTravel) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-slate-900 rounded-lg border border-slate-700">
        <Lock className="w-16 h-16 text-slate-600 mb-4" />
        <h3 className="text-xl font-semibold text-slate-300 mb-2">Access Denied</h3>
        <p className="text-slate-400 text-center max-w-md">
          Time Travel Revert requires special permission.
        </p>
        <p className="text-slate-500 text-sm mt-2">
          Contact your administrator to request access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="w-6 h-6 text-purple-500" />
          <h3 className="text-xl font-semibold text-slate-200">Transaction History</h3>
        </div>
        <button
          onClick={loadTransactionHistory}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Alert Banner */}
      <div className="bg-purple-500/10 border border-purple-500/40 rounded-lg p-4 flex items-start gap-3">
        <Clock className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="text-purple-300 font-medium mb-1">Time Travel Revert Enabled</h4>
          <p className="text-purple-200/80 text-sm">
            You can revert bulk operations within 7 days. All reverts are logged for audit trail.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by user or action..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="pl-10 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 appearance-none cursor-pointer"
          >
            <option value="">All Actions</option>
            <option value="pfa:bulk_update">Bulk Updates</option>
            <option value="pfa:bulk_shift_time">Shift Time</option>
            <option value="pfa:bulk_adjust_duration">Adjust Duration</option>
            <option value="pfa:bulk_change_category">Change Category</option>
            <option value="pfa:bulk_change_dor">Change DOR</option>
            <option value="pre_flight_review">Pre-Flight Reviews</option>
            <option value="permission:grant">Permission Grants</option>
            <option value="org:suspend">Org Suspensions</option>
          </select>
        </div>
      </div>

      {/* Transaction Table */}
      {loading ? (
        <div className="flex items-center justify-center h-[400px] bg-slate-900 rounded-lg border border-slate-700">
          <div className="text-slate-400">Loading transaction history...</div>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[400px] bg-slate-900 rounded-lg border border-slate-700">
          <History className="w-12 h-12 text-slate-600 mb-3" />
          <p className="text-slate-400">No transactions found</p>
        </div>
      ) : (
        <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr className="text-left text-sm text-slate-400">
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Affected Records</th>
                  <th className="px-4 py-3 font-medium">Comment</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredTransactions.map((tx) => {
                  const daysSince = getDaysSince(tx.timestamp || tx.createdAt);
                  const revertEligible = canRevert(tx);
                  const reverted = isReverted(tx);

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-300">
                        <div className="flex items-center gap-2">
                          {formatTimestamp(tx.timestamp || tx.createdAt)}
                          {daysSince <= 7 && (
                            <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                              {daysSince}d ago
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {tx.user?.username || tx.userId}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                          {formatActionName(tx.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300 text-center">
                        {String(tx.metadata?.affectedRecordCount ?? tx.metadata?.affectedCount ?? '-')}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400 max-w-xs truncate">
                        {String(tx.metadata?.comment ?? '-')}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {reverted ? (
                          <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs">
                            Reverted
                          </span>
                        ) : tx.success ? (
                          <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs">
                            Success
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-xs">
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedTx(tx)}
                            className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {revertEligible && (
                            <button
                              onClick={() => setSelectedTx(tx)}
                              className="px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded transition-colors flex items-center gap-1.5 text-xs font-medium"
                              title="Revert Transaction"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Revert
                            </button>
                          )}
                          {!revertEligible && !reverted && daysSince > 7 && (
                            <span className="text-xs text-slate-500" title="Outside 7-day window">
                              Expired
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Revert Modal */}
      {selectedTx && (
        <RevertModal
          transaction={selectedTx}
          onConfirm={handleRevert}
          onCancel={() => setSelectedTx(null)}
          organizationId={organizationId}
          canRevert={canRevert(selectedTx)}
        />
      )}
    </div>
  );
}
