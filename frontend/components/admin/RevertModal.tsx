/**
 * Revert Modal Component
 * Phase 5, Task 5.5 - Time Travel Revert
 *
 * Shows transaction details and change preview before revert confirmation.
 * Requires mandatory comment for audit trail.
 */

import { useState, useEffect } from 'react';
import { X, AlertTriangle, RotateCcw, Loader2 } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface RevertModalProps {
  transaction: any;
  onConfirm: (transactionId: string, comment: string) => void;
  onCancel: () => void;
  organizationId: string;
  canRevert: boolean;
}

interface RevertPreview {
  changes: Array<{
    recordId: string;
    field: string;
    currentValue: any;
    revertValue: any;
  }>;
  affectedRecordCount: number;
  estimatedImpact?: {
    costDelta?: number;
    durationDelta?: number;
  };
}

export function RevertModal({
  transaction,
  onConfirm,
  onCancel,
  organizationId,
  canRevert,
}: RevertModalProps) {
  const [comment, setComment] = useState('');
  const [previewData, setPreviewData] = useState<RevertPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);

  useEffect(() => {
    loadRevertPreview();
  }, [transaction.id]);

  const loadRevertPreview = async () => {
    try {
      setLoadingPreview(true);
      const preview = await apiClient.getRevertPreview(transaction.id, organizationId);
      setPreviewData(preview);
    } catch (error) {
      console.error('Failed to load revert preview:', error);
      // Generate preview from transaction metadata if API fails
      generatePreviewFromMetadata();
    } finally {
      setLoadingPreview(false);
    }
  };

  const generatePreviewFromMetadata = () => {
    // Fallback: Generate preview from transaction metadata
    const metadata = transaction.metadata || {};
    const changes = metadata.changes || [];

    setPreviewData({
      changes: changes.map((change: any) => ({
        recordId: change.recordId || 'N/A',
        field: change.field || 'Unknown',
        currentValue: change.newValue || change.currentValue || 'N/A',
        revertValue: change.oldValue || change.revertValue || 'N/A',
      })),
      affectedRecordCount: metadata.affectedRecordCount || metadata.affectedCount || 0,
      estimatedImpact: metadata.estimatedImpact,
    });
  };

  const handleSubmit = () => {
    if (!comment.trim()) {
      alert('Please provide a reason for reverting this transaction');
      return;
    }

    if (comment.trim().length < 10) {
      alert('Comment must be at least 10 characters');
      return;
    }

    onConfirm(transaction.id, comment.trim());
  };

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

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toLocaleString();
    if (typeof value === 'object') {
      if (value instanceof Date) return formatTimestamp(value);
      return JSON.stringify(value);
    }
    return String(value);
  };

  const formatActionName = (action: string): string => {
    return action
      .replace('pfa:', '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getDaysSince = (timestamp: Date | string): number => {
    const txDate = new Date(timestamp);
    const now = new Date();
    return Math.floor((now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  const characterCount = comment.trim().length;
  const isCommentValid = characterCount >= 10;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <RotateCcw className="w-6 h-6 text-orange-500" />
            <h2 className="text-xl font-semibold text-slate-200">
              {canRevert ? 'Revert Transaction' : 'View Transaction Details'}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Warning Banner */}
          {canRevert && (
            <div className="bg-orange-500/10 border border-orange-500/40 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-orange-300 font-medium mb-1">Time Travel Revert</h4>
                <p className="text-orange-200/80 text-sm">
                  This will undo changes made on{' '}
                  <strong>{formatTimestamp(transaction.timestamp)}</strong> by{' '}
                  <strong>{transaction.user?.username || transaction.userId}</strong>.
                </p>
                <p className="text-orange-200/80 text-sm mt-1">
                  All affected records will be restored to their previous state.
                </p>
              </div>
            </div>
          )}

          {/* Transaction Details */}
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-medium text-slate-300 mb-3">Transaction Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500 mb-1">Action</div>
                <div className="text-sm text-slate-200">{formatActionName(transaction.action)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">User</div>
                <div className="text-sm text-slate-200">
                  {transaction.user?.username || transaction.userId}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Timestamp</div>
                <div className="text-sm text-slate-200">
                  {formatTimestamp(transaction.timestamp)}
                  <span className="ml-2 text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                    {getDaysSince(transaction.timestamp)}d ago
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Original Comment</div>
                <div className="text-sm text-slate-200">
                  {transaction.metadata?.comment || 'No comment provided'}
                </div>
              </div>
            </div>
          </div>

          {/* Revert Preview */}
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-medium text-slate-300 mb-3">
              Changes to be Reverted
            </h4>

            {loadingPreview ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                <span className="ml-2 text-slate-400">Loading preview...</span>
              </div>
            ) : previewData && previewData.changes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/50">
                    <tr className="text-left text-xs text-slate-400">
                      <th className="px-3 py-2 font-medium">Record ID</th>
                      <th className="px-3 py-2 font-medium">Field</th>
                      <th className="px-3 py-2 font-medium">Current Value</th>
                      <th className="px-3 py-2 font-medium">Will Revert To</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {previewData.changes.slice(0, 50).map((change, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-3 py-2 text-slate-300 font-mono text-xs">
                          {change.recordId}
                        </td>
                        <td className="px-3 py-2 text-slate-300">{change.field}</td>
                        <td className="px-3 py-2 text-slate-400">
                          {formatValue(change.currentValue)}
                        </td>
                        <td className="px-3 py-2 text-green-400 font-medium">
                          {formatValue(change.revertValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewData.changes.length > 50 && (
                  <div className="text-center text-xs text-slate-500 mt-3">
                    Showing first 50 of {previewData.changes.length} changes
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                No detailed changes available for preview
              </div>
            )}

            {/* Summary Stats */}
            {previewData && (
              <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Affected Records</div>
                  <div className="text-lg font-semibold text-slate-200">
                    {previewData.affectedRecordCount.toLocaleString()}
                  </div>
                </div>
                {previewData.estimatedImpact?.costDelta !== undefined && (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Cost Impact</div>
                    <div
                      className={`text-lg font-semibold ${
                        previewData.estimatedImpact.costDelta < 0
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}
                    >
                      {previewData.estimatedImpact.costDelta < 0 ? '-' : '+'}$
                      {Math.abs(previewData.estimatedImpact.costDelta).toLocaleString()}
                    </div>
                  </div>
                )}
                {previewData.estimatedImpact?.durationDelta !== undefined && (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Duration Impact</div>
                    <div className="text-lg font-semibold text-slate-200">
                      {previewData.estimatedImpact.durationDelta > 0 ? '+' : ''}
                      {previewData.estimatedImpact.durationDelta} days
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Revert Comment */}
          {canRevert && (
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
              <label className="block">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-300">
                    Reason for Revert <span className="text-red-400">*</span>
                  </span>
                  <span
                    className={`text-xs ${
                      isCommentValid
                        ? 'text-green-400'
                        : characterCount > 0
                        ? 'text-orange-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {characterCount} / 10 characters minimum
                  </span>
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Explain why this transaction is being reverted (e.g., 'User error - incorrect shift amount applied', 'Need to restore previous state due to...')"
                  rows={3}
                  required
                  className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 ${
                    isCommentValid
                      ? 'border-green-500/40 focus:ring-green-500/50'
                      : characterCount > 0
                      ? 'border-orange-500/40 focus:ring-orange-500/50'
                      : 'border-slate-700 focus:ring-purple-500/50'
                  }`}
                />
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-700 bg-slate-900/50">
          <div className="text-xs text-slate-500">
            {canRevert
              ? 'This action will be logged in the audit trail'
              : 'This transaction cannot be reverted'}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
            >
              {canRevert ? 'Cancel' : 'Close'}
            </button>
            {canRevert && (
              <button
                onClick={handleSubmit}
                disabled={!isCommentValid || loadingPreview}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Confirm Revert
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
