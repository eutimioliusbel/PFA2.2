/**
 * PreFlightModal Component
 * Phase 5, Task 5.4 - Pre-Flight Transaction Ceremony
 *
 * Mandatory review dialog before bulk operations:
 * - Shows operation summary and impact
 * - Displays change preview
 * - Requires comment for audit trail
 * - Confirmation checkbox
 */

import { useState, useMemo } from 'react';
import { X, AlertTriangle, Check } from 'lucide-react';

interface PreFlightChange {
  field: string;
  oldValue: string | number;
  newValue: string | number;
  recordCount?: number;
}

interface PreFlightOperation {
  type: string;
  description: string;
  changes: PreFlightChange[];
  estimatedImpact?: {
    costDelta?: number;
    durationDelta?: number;
    affectedUsers?: number;
  };
}

interface PreFlightMetadata {
  comment: string;
  timestamp: Date;
  bypassedBy?: string;
}

interface PreFlightModalProps {
  operation: PreFlightOperation;
  affectedRecords: any[];
  onConfirm: (metadata: PreFlightMetadata) => void;
  onCancel: () => void;
}

export function PreFlightModal({
  operation,
  affectedRecords,
  onConfirm,
  onCancel,
}: PreFlightModalProps) {
  const [comment, setComment] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  // Calculate statistics
  const statistics = useMemo(() => {
    const organizations = [...new Set(affectedRecords.map((r) => r.organization || r.organizationId))].filter(Boolean);
    const categories = [...new Set(affectedRecords.map((r) => r.category))].filter(Boolean);
    const totalCost = affectedRecords.reduce((sum, r) => sum + (r.totalCost || 0), 0);

    return {
      organizations,
      categories,
      totalCost,
      recordCount: affectedRecords.length,
    };
  }, [affectedRecords]);

  const handleConfirm = () => {
    if (!comment.trim()) {
      alert('Comment is required for audit trail');
      return;
    }

    if (comment.trim().length < 10) {
      alert('Comment must be at least 10 characters');
      return;
    }

    if (!confirmed) {
      alert('Please confirm that you understand the impact of this operation');
      return;
    }

    onConfirm({
      comment: comment.trim(),
      timestamp: new Date(),
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-5xl w-full border border-slate-700 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 bg-slate-900">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            <div>
              <h2 className="text-xl font-bold text-slate-100">Confirm Bulk Operation</h2>
              <p className="text-sm text-slate-400 mt-1">High-risk operation requiring review</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-slate-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Warning Banner */}
          <div className="bg-orange-500/20 border border-orange-500/40 text-orange-300 px-4 py-4 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" />
              <div className="text-sm space-y-2">
                <p className="font-semibold text-lg">High-Risk Operation Detected</p>
                <p>
                  This action will modify <strong>{statistics.recordCount}</strong> records across{' '}
                  <strong>{statistics.organizations.length}</strong> organization(s). Please review
                  carefully before proceeding.
                </p>
              </div>
            </div>
          </div>

          {/* Operation Summary */}
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Operation Summary</h3>
            <table className="w-full text-sm">
              <tbody className="space-y-2">
                <tr className="border-b border-slate-700">
                  <td className="py-2 text-slate-400 font-medium">Operation Type:</td>
                  <td className="py-2 text-slate-100 font-semibold">{operation.type}</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="py-2 text-slate-400 font-medium">Description:</td>
                  <td className="py-2 text-slate-100">{operation.description}</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="py-2 text-slate-400 font-medium">Affected Records:</td>
                  <td className="py-2 text-slate-100 font-semibold">
                    {statistics.recordCount.toLocaleString()}
                  </td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="py-2 text-slate-400 font-medium">Organizations:</td>
                  <td className="py-2 text-slate-100">
                    {statistics.organizations.length > 0
                      ? statistics.organizations.join(', ')
                      : 'Multiple'}
                  </td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="py-2 text-slate-400 font-medium">Categories:</td>
                  <td className="py-2 text-slate-100">
                    {statistics.categories.length > 0
                      ? statistics.categories.slice(0, 3).join(', ') +
                        (statistics.categories.length > 3
                          ? ` +${statistics.categories.length - 3} more`
                          : '')
                      : 'Multiple'}
                  </td>
                </tr>
                {operation.estimatedImpact && (
                  <>
                    {operation.estimatedImpact.costDelta !== undefined && (
                      <tr className="border-b border-slate-700">
                        <td className="py-2 text-slate-400 font-medium">Estimated Cost Impact:</td>
                        <td
                          className={`py-2 font-semibold ${
                            operation.estimatedImpact.costDelta > 0
                              ? 'text-red-400'
                              : operation.estimatedImpact.costDelta < 0
                              ? 'text-green-400'
                              : 'text-slate-100'
                          }`}
                        >
                          {operation.estimatedImpact.costDelta > 0 ? '+' : ''}
                          {formatCurrency(operation.estimatedImpact.costDelta)}
                        </td>
                      </tr>
                    )}
                    {operation.estimatedImpact.durationDelta !== undefined && (
                      <tr className="border-b border-slate-700">
                        <td className="py-2 text-slate-400 font-medium">Duration Impact:</td>
                        <td className="py-2 text-slate-100 font-semibold">
                          {operation.estimatedImpact.durationDelta > 0 ? '+' : ''}
                          {operation.estimatedImpact.durationDelta} days
                        </td>
                      </tr>
                    )}
                    {operation.estimatedImpact.affectedUsers !== undefined && (
                      <tr>
                        <td className="py-2 text-slate-400 font-medium">Affected Users:</td>
                        <td className="py-2 text-slate-100 font-semibold">
                          {operation.estimatedImpact.affectedUsers}
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Changes Preview */}
          {operation.changes.length > 0 && (
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-bold text-slate-100 mb-4">Changes Preview</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800 border-b border-slate-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">
                        Field
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">
                        Current Value
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">
                        New Value
                      </th>
                      {operation.changes.some((c) => c.recordCount) && (
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">
                          Records
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {operation.changes.map((change, i) => (
                      <tr key={i} className="hover:bg-slate-800/50">
                        <td className="px-4 py-2 text-slate-300 font-medium">{change.field}</td>
                        <td className="px-4 py-2 text-slate-400">{change.oldValue}</td>
                        <td className="px-4 py-2 text-green-400 font-semibold">
                          {change.newValue}
                        </td>
                        {change.recordCount !== undefined && (
                          <td className="px-4 py-2 text-slate-300">{change.recordCount}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mandatory Comment */}
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Reason for Change <span className="text-red-400">*</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Explain why this change is necessary (minimum 10 characters, required for audit trail)"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
              rows={3}
              required
            />
            <div className="flex items-center justify-between mt-2">
              <span
                className={`text-xs ${
                  comment.length >= 10 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {comment.length >= 10 ? (
                  <span className="flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Comment meets minimum length
                  </span>
                ) : (
                  `Minimum 10 characters (${comment.length}/10)`
                )}
              </span>
              <span className="text-xs text-slate-500">{comment.length} characters</span>
            </div>
            {!comment.trim() && (
              <p className="text-xs text-red-400 mt-1">
                Comment is required and will be logged in audit trail
              </p>
            )}
          </div>

          {/* Confirmation Checkbox */}
          <div className="bg-slate-900 border border-slate-700 rounded p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="w-5 h-5 bg-slate-800 border-slate-600 rounded mt-0.5 focus:ring-2 focus:ring-orange-500"
              />
              <span className="text-sm text-slate-300">
                I understand this action affects <strong>{statistics.recordCount}</strong> records
                and cannot be undone without using Time Travel Revert. I have reviewed the changes
                and provided a valid reason for this operation.
              </span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-slate-700 bg-slate-900">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!comment.trim() || comment.length < 10 || !confirmed}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded font-medium transition-colors ${
              !comment.trim() || comment.length < 10 || !confirmed
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-orange-600 hover:bg-orange-700 text-white'
            }`}
          >
            <Check className="w-4 h-4" />
            Confirm Operation
          </button>
        </div>
      </div>
    </div>
  );
}
