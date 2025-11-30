/**
 * RollbackModal - Rollback PFA record to a previous version
 * ADR-008 Phase 2 Track B - Task 2B.4
 *
 * Features:
 * - Version history list with timestamps
 * - Preview changes before rollback
 * - Required rollback reason (audit trail)
 * - Admin-only permission required
 */

import { useState, useEffect } from 'react';
import type { RollbackVersion } from '../../mockData/syncMockData';

interface RollbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  pfaId: string;
  currentData: Record<string, unknown>;
  onRollback: (versionId: string, reason: string) => Promise<void>;
}

function formatValue(value: unknown): string {
  if (value instanceof Date) {
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  if (typeof value === 'number') {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  return String(value);
}

function getChangedFields(
  current: Record<string, unknown>,
  previous: Record<string, unknown>
): Array<{ field: string; currentValue: unknown; previousValue: unknown }> {
  const changes: Array<{
    field: string;
    currentValue: unknown;
    previousValue: unknown;
  }> = [];

  const allFields = new Set([
    ...Object.keys(current),
    ...Object.keys(previous),
  ]);

  allFields.forEach(field => {
    if (current[field] !== previous[field]) {
      changes.push({
        field,
        currentValue: current[field],
        previousValue: previous[field],
      });
    }
  });

  return changes;
}

export function RollbackModal({
  isOpen,
  onClose,
  pfaId,
  currentData,
  onRollback,
}: RollbackModalProps) {
  const [versions, setVersions] = useState<RollbackVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<RollbackVersion | null>(
    null
  );
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    } else {
      setSelectedVersion(null);
      setReason('');
      setShowPreview(false);
    }
  }, [isOpen, pfaId]);

  const loadVersions = async () => {
    setIsLoading(true);
    try {
      const { mockFetchRollbackVersions } = await import(
        '../../mockData/syncMockData'
      );
      const data = await mockFetchRollbackVersions(pfaId);
      setVersions(data);
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!selectedVersion || reason.length < 10) {
      return;
    }

    setIsRollingBack(true);
    try {
      await onRollback(selectedVersion.id, reason);
      onClose();
    } catch (error) {
      console.error('Rollback failed:', error);
    } finally {
      setIsRollingBack(false);
    }
  };

  if (!isOpen) return null;

  const changes = selectedVersion
    ? getChangedFields(currentData, selectedVersion.data)
    : [];

  const canRollback = selectedVersion && reason.length >= 10;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rollback-modal-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2
            id="rollback-modal-title"
            className="text-xl font-semibold text-gray-900"
          >
            Rollback Version - {pfaId}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Restore this PFA record to a previous version
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="px-6 py-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600" />
              <div className="text-gray-600 mt-3">Loading version history...</div>
            </div>
          ) : versions.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-gray-400 text-4xl mb-2">📜</div>
              <div className="text-gray-600">No version history available</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 divide-x divide-gray-200">
              {/* Version List */}
              <div className="px-6 py-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Version History ({versions.length})
                </h3>
                <div className="space-y-2">
                  {versions
                    .sort((a, b) => b.version - a.version)
                    .map(version => (
                      <button
                        key={version.id}
                        type="button"
                        onClick={() => {
                          setSelectedVersion(version);
                          setShowPreview(true);
                        }}
                        className={`
                        w-full px-4 py-3 rounded-lg border text-left
                        transition-all duration-150
                        ${
                          selectedVersion?.id === version.id
                            ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500'
                            : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }
                        focus:outline-none focus:ring-2 focus:ring-blue-500
                      `}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-900">
                            Version {version.version}
                          </span>
                          {version.version === Math.max(...versions.map(v => v.version)) && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                              Latest
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600">
                          {new Date(version.createdAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          by {version.createdBy}
                        </div>
                        {version.reason && (
                          <div className="text-xs text-gray-600 mt-2 italic">
                            "{version.reason}"
                          </div>
                        )}
                      </button>
                    ))}
                </div>
              </div>

              {/* Preview */}
              <div className="px-6 py-4">
                {!showPreview || !selectedVersion ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-4xl mb-2">👈</div>
                    <div>Select a version to preview changes</div>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">
                      Changes Preview
                    </h3>

                    {changes.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-2xl mb-2">✓</div>
                        <div>No changes - already at this version</div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {changes.map(change => (
                          <div
                            key={change.field}
                            className="border border-gray-200 rounded-lg overflow-hidden"
                          >
                            <div className="bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-900">
                              {change.field}
                            </div>
                            <div className="grid grid-cols-2 divide-x divide-gray-200">
                              <div className="px-3 py-2 bg-red-50">
                                <div className="text-xs text-gray-600 mb-1">
                                  Current
                                </div>
                                <div className="text-sm font-medium text-gray-900 line-through">
                                  {formatValue(change.currentValue)}
                                </div>
                              </div>
                              <div className="px-3 py-2 bg-green-50">
                                <div className="text-xs text-gray-600 mb-1">
                                  Will revert to
                                </div>
                                <div className="text-sm font-medium text-gray-900">
                                  {formatValue(change.previousValue)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Rollback Reason */}
                    <div className="mt-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Rollback Reason <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="Explain why you're rolling back (min 10 characters)..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md
                                 focus:outline-none focus:ring-2 focus:ring-blue-500
                                 placeholder-gray-400"
                      />
                      {reason.length > 0 && reason.length < 10 && (
                        <div className="text-xs text-red-600 mt-1">
                          Minimum 10 characters required ({reason.length}/10)
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
          <div className="text-sm text-amber-700 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span>This action will be logged in the audit trail</span>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isRollingBack}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300
                       rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRollback}
              disabled={!canRollback || isRollingBack}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent
                       rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRollingBack ? 'Rolling back...' : 'Confirm Rollback'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
