/**
 * ConflictResolutionModal - Resolve sync conflicts between local and PEMS changes
 * ADR-008 Phase 2 Track B - Task 2B.2
 *
 * Features:
 * - Side-by-side comparison of conflicting changes
 * - Three resolution strategies: Use My Changes, Use PEMS, Merge
 * - Field-by-field selection in merge mode
 * - Keyboard navigation and accessibility
 */

import { useState, useMemo } from 'react';
import type { SyncConflict, ConflictResolutionStrategy } from '../mockData/syncMockData';
import { sanitizeHtml } from '../utils/sanitize';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: SyncConflict[];
  pfaId: string;
  jobId: string;
  onResolve: (
    jobId: string,
    resolutions: Array<{
      conflictId: string;
      strategy: ConflictResolutionStrategy;
      chosenValue?: unknown;
    }>
  ) => Promise<void>;
}

type MergeChoice = Record<string, 'local' | 'remote'>;

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

export function ConflictResolutionModal({
  isOpen,
  onClose,
  conflicts,
  pfaId,
  jobId,
  onResolve,
}: ConflictResolutionModalProps) {
  const [strategy, setStrategy] = useState<ConflictResolutionStrategy>('use_local');
  const [mergeChoices, setMergeChoices] = useState<MergeChoice>({});
  const [isResolving, setIsResolving] = useState(false);

  // P0-5: XSS Protection - Sanitize conflict data before rendering
  // Prevents malicious HTML/JavaScript injection through conflict field values
  const sanitizedConflicts = useMemo(() => {
    return conflicts.map(conflict => ({
      ...conflict,
      fieldName: sanitizeHtml(conflict.fieldName),
      localValue: typeof conflict.localValue === 'string'
        ? sanitizeHtml(conflict.localValue)
        : conflict.localValue,
      remoteValue: typeof conflict.remoteValue === 'string'
        ? sanitizeHtml(conflict.remoteValue)
        : conflict.remoteValue,
    }));
  }, [conflicts]);

  // Sanitize PFA ID to prevent XSS in title
  const sanitizedPfaId = useMemo(() => sanitizeHtml(pfaId), [pfaId]);

  if (!isOpen) return null;

  const handleStrategyChange = (newStrategy: ConflictResolutionStrategy) => {
    setStrategy(newStrategy);
    if (newStrategy !== 'merge') {
      setMergeChoices({});
    }
  };

  const handleMergeChoice = (fieldName: string, choice: 'local' | 'remote') => {
    setMergeChoices(prev => ({
      ...prev,
      [fieldName]: choice,
    }));
  };

  const handleResolve = async () => {
    setIsResolving(true);

    try {
      // Use original unsanitized conflicts for resolution (preserve actual values)
      const resolutions = conflicts.map(conflict => {
        let chosenValue: unknown;

        if (strategy === 'use_local') {
          chosenValue = conflict.localValue;
        } else if (strategy === 'use_remote') {
          chosenValue = conflict.remoteValue;
        } else {
          const choice = mergeChoices[conflict.fieldName];
          chosenValue = choice === 'local'
            ? conflict.localValue
            : conflict.remoteValue;
        }

        return {
          conflictId: conflict.id,
          strategy,
          chosenValue,
        };
      });

      await onResolve(jobId, resolutions);
      onClose();
    } catch (error) {
      console.error('Failed to resolve conflicts:', error);
    } finally {
      setIsResolving(false);
    }
  };

  const isMergeMode = strategy === 'merge';
  const allMergeChoicesMade = sanitizedConflicts.every(
    c => mergeChoices[c.fieldName] !== undefined
  );
  const canResolve = !isMergeMode || allMergeChoicesMade;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-modal-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2
            id="conflict-modal-title"
            className="text-xl font-semibold text-gray-900"
          >
            Resolve Sync Conflicts - {sanitizedPfaId}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {sanitizedConflicts.length} field{sanitizedConflicts.length !== 1 ? 's' : ''} have
            conflicting changes
          </p>
        </div>

        {/* Strategy Selection */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Resolution Strategy
          </label>
          <div className="space-y-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="strategy"
                value="use_local"
                checked={strategy === 'use_local'}
                onChange={() => handleStrategyChange('use_local')}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <div className="font-medium text-gray-900">Use My Changes</div>
                <div className="text-sm text-gray-600">
                  Override PEMS with your local modifications
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="strategy"
                value="use_remote"
                checked={strategy === 'use_remote'}
                onChange={() => handleStrategyChange('use_remote')}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <div className="font-medium text-gray-900">Use PEMS Changes</div>
                <div className="text-sm text-gray-600">
                  Discard your changes and accept PEMS data
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="strategy"
                value="merge"
                checked={strategy === 'merge'}
                onChange={() => handleStrategyChange('merge')}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <div className="font-medium text-gray-900">Merge (Manual)</div>
                <div className="text-sm text-gray-600">
                  Choose which value to keep for each field
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Conflicts List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {sanitizedConflicts.map(conflict => (
              <div
                key={conflict.id}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                <div className="bg-yellow-50 px-4 py-2 border-b border-yellow-200">
                  <h3 className="font-medium text-gray-900">
                    {conflict.fieldName}
                  </h3>
                </div>

                <div className="grid grid-cols-2 divide-x divide-gray-200">
                  {/* Local Changes */}
                  <div
                    className={`p-4 ${
                      isMergeMode && mergeChoices[conflict.fieldName] === 'local'
                        ? 'bg-blue-50 ring-2 ring-inset ring-blue-500'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-gray-700">
                        Your Changes
                      </div>
                      {isMergeMode && (
                        <button
                          type="button"
                          onClick={() =>
                            handleMergeChoice(conflict.fieldName, 'local')
                          }
                          className={`
                            px-2 py-1 text-xs rounded-md border
                            ${
                              mergeChoices[conflict.fieldName] === 'local'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }
                            focus:outline-none focus:ring-2 focus:ring-blue-500
                          `}
                          aria-label={`Use local value for ${conflict.fieldName}`}
                        >
                          {mergeChoices[conflict.fieldName] === 'local'
                            ? '✓ Selected'
                            : 'Select'}
                        </button>
                      )}
                    </div>
                    <div className="text-base font-semibold text-gray-900">
                      {formatValue(conflict.localValue)}
                    </div>
                  </div>

                  {/* Remote Changes */}
                  <div
                    className={`p-4 ${
                      isMergeMode && mergeChoices[conflict.fieldName] === 'remote'
                        ? 'bg-blue-50 ring-2 ring-inset ring-blue-500'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-gray-700">
                        PEMS Changes
                      </div>
                      {isMergeMode && (
                        <button
                          type="button"
                          onClick={() =>
                            handleMergeChoice(conflict.fieldName, 'remote')
                          }
                          className={`
                            px-2 py-1 text-xs rounded-md border
                            ${
                              mergeChoices[conflict.fieldName] === 'remote'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }
                            focus:outline-none focus:ring-2 focus:ring-blue-500
                          `}
                          aria-label={`Use PEMS value for ${conflict.fieldName}`}
                        >
                          {mergeChoices[conflict.fieldName] === 'remote'
                            ? '✓ Selected'
                            : 'Select'}
                        </button>
                      )}
                    </div>
                    <div className="text-base font-semibold text-gray-900">
                      {formatValue(conflict.remoteValue)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isResolving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300
                     rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleResolve}
            disabled={isResolving || !canResolve}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent
                     rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResolving ? 'Resolving...' : 'Apply Resolution'}
          </button>
        </div>
      </div>
    </div>
  );
}
