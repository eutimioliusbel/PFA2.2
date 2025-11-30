/**
 * Preview Step Component
 * Phase 5, Task 5.6 - Intelligent Import Wizard
 *
 * Third step: Preview import data with validation errors highlighted.
 */

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, XCircle, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';

interface ValidationError {
  rowNumber: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

interface PreviewRow {
  rowNumber: number;
  data: Record<string, any>;
  hasError: boolean;
  errors?: ValidationError[];
}

interface PreviewStepProps {
  data: {
    summary: {
      totalRows: number;
      validRows: number;
      errorRows: number;
      warningRows?: number;
    };
    validationErrors?: ValidationError[];
    previewRows?: PreviewRow[];
    rows?: Array<Record<string, unknown>>;
  };
  onConfirm: () => void;
  onBack: () => void;
}

export function PreviewStep({ data, onConfirm, onBack }: PreviewStepProps) {
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRowExpansion = (rowNumber: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowNumber)) {
      newExpanded.delete(rowNumber);
    } else {
      newExpanded.add(rowNumber);
    }
    setExpandedRows(newExpanded);
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toLocaleString();
    if (typeof value === 'object') {
      if (value instanceof Date) return value.toLocaleDateString();
      return JSON.stringify(value);
    }
    return String(value);
  };

  const validationErrors = data.validationErrors || [];
  const previewRows: PreviewRow[] = data.previewRows || [];
  const displayedErrors = showAllErrors
    ? validationErrors
    : validationErrors.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-semibold text-slate-200 mb-2">Preview Import Data</h3>
        <p className="text-slate-400 text-sm">
          Review the data before importing. Rows with validation errors will be skipped.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
          <div className="text-sm text-slate-500 mb-1">Total Rows</div>
          <div className="text-2xl font-semibold text-slate-200">
            {data.summary.totalRows.toLocaleString()}
          </div>
        </div>
        <div className="bg-green-500/10 border border-green-500/40 rounded-lg p-4">
          <div className="text-sm text-green-400 mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" />
            Valid Rows
          </div>
          <div className="text-2xl font-semibold text-green-300">
            {data.summary.validRows.toLocaleString()}
          </div>
        </div>
        {(data.summary.warningRows || 0) > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-lg p-4">
            <div className="text-sm text-yellow-400 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              Warnings
            </div>
            <div className="text-2xl font-semibold text-yellow-300">
              {(data.summary.warningRows || 0).toLocaleString()}
            </div>
          </div>
        )}
        <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-4">
          <div className="text-sm text-red-400 mb-1 flex items-center gap-1">
            <XCircle className="w-4 h-4" />
            Errors
          </div>
          <div className="text-2xl font-semibold text-red-300">
            {data.summary.errorRows.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-4">
          <div className="flex items-start gap-3 mb-3">
            <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-red-300 font-medium mb-1">Validation Errors Found</h4>
              <p className="text-red-200/80 text-sm mb-3">
                {validationErrors.length} error(s) detected. These rows will be skipped during
                import.
              </p>
            </div>
          </div>
          <div className="bg-red-900/20 rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
            {displayedErrors.map((error, i) => (
              <div
                key={i}
                className="flex items-start gap-3 text-sm bg-red-950/30 rounded p-2 border border-red-500/20"
              >
                <span className="text-red-400 font-semibold flex-shrink-0">Row {error.rowNumber}:</span>
                <div className="flex-1">
                  <span className="text-red-300 font-medium">{error.field}</span>
                  <span className="text-red-200/80"> — {error.message}</span>
                </div>
              </div>
            ))}
            {validationErrors.length > 10 && !showAllErrors && (
              <button
                onClick={() => setShowAllErrors(true)}
                className="text-sm text-red-300 hover:text-red-200 transition-colors flex items-center gap-1"
              >
                <ChevronDown className="w-4 h-4" />
                Show {validationErrors.length - 10} more errors
              </button>
            )}
            {showAllErrors && (
              <button
                onClick={() => setShowAllErrors(false)}
                className="text-sm text-red-300 hover:text-red-200 transition-colors flex items-center gap-1"
              >
                <ChevronUp className="w-4 h-4" />
                Show less
              </button>
            )}
          </div>
        </div>
      )}

      {/* Data Preview Table */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700">
          <h4 className="text-sm font-medium text-slate-300">Data Preview (First 50 rows)</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr className="text-left text-xs text-slate-400">
                <th className="px-4 py-3 font-medium w-16">Row</th>
                <th className="px-4 py-3 font-medium">Equipment Code</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Start Date</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Cost</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {previewRows.slice(0, 50).map((row) => (
                <React.Fragment key={row.rowNumber}>
                  <tr
                    className={`transition-colors ${
                      row.hasError
                        ? 'bg-red-500/5 hover:bg-red-500/10'
                        : 'hover:bg-slate-800/30'
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-slate-400">{row.rowNumber}</td>
                    <td className="px-4 py-3 text-sm text-slate-300 font-mono">
                      {formatValue(row.data.equipmentCode || row.data.pfaId)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300 max-w-xs truncate">
                      {formatValue(row.data.equipmentDescription)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {formatValue(row.data.category)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {formatValue(row.data.originalStart || row.data.forecastStart)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {formatValue(row.data.source)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      ${formatValue(row.data.monthlyRate || row.data.purchasePrice)}
                    </td>
                    <td className="px-4 py-3">
                      {row.hasError ? (
                        <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs font-medium flex items-center gap-1 w-fit">
                          <XCircle className="w-3 h-3" />
                          Error
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs font-medium flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" />
                          Valid
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.hasError && row.errors && row.errors.length > 0 && (
                        <button
                          onClick={() => toggleRowExpansion(row.rowNumber)}
                          className="p-1 hover:bg-slate-700 rounded transition-colors"
                        >
                          {expandedRows.has(row.rowNumber) ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                  {row.hasError && row.errors && expandedRows.has(row.rowNumber) && (
                    <tr className="bg-red-950/20">
                      <td colSpan={9} className="px-4 py-3">
                        <div className="space-y-2">
                          {row.errors.map((error: ValidationError, i: number) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-sm text-red-300 bg-red-950/30 rounded p-2 border border-red-500/20"
                            >
                              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <div>
                                <span className="font-medium">{error.field}:</span>{' '}
                                {error.message}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {previewRows.length > 50 && (
          <div className="px-4 py-3 bg-slate-800/50 border-t border-slate-700 text-center text-sm text-slate-500">
            Showing first 50 of {previewRows.length} rows
          </div>
        )}
      </div>

      {/* Continue Warning */}
      {data.summary.errorRows > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="text-yellow-200/80">
              <strong>{data.summary.errorRows}</strong> row(s) have validation errors and will be
              skipped. Only <strong>{data.summary.validRows}</strong> valid row(s) will be
              imported.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-700">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
        >
          Back to Mapping
        </button>
        <button
          onClick={onConfirm}
          disabled={data.summary.validRows === 0}
          className="px-6 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          Continue to Confirm
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
