/**
 * Confirm Import Step Component
 * Phase 5, Task 5.6 - Intelligent Import Wizard
 *
 * Fourth step: Final confirmation with import summary.
 */

import { useState } from 'react';
import { CheckCircle2, AlertTriangle, FileSpreadsheet, Clock, Loader2 } from 'lucide-react';

interface ConfirmImportStepProps {
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    warningRows: number;
    fileName: string;
    fileSize: number;
    mappedFields: number;
    estimatedDuration: number;
  };
  onConfirm: () => Promise<void>;
  onBack: () => void;
}

export function ConfirmImportStep({ summary, onConfirm, onBack }: ConfirmImportStepProps) {
  const [importing, setImporting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = async () => {
    if (!confirmed) {
      alert('Please confirm that you understand the import operation');
      return;
    }

    try {
      setImporting(true);
      await onConfirm();
    } catch (error) {
      console.error('Import failed:', error);
      setImporting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-semibold text-slate-200 mb-2">Confirm Import</h3>
        <p className="text-slate-400 text-sm">
          Review the import summary and confirm to proceed. This action cannot be undone.
        </p>
      </div>

      {/* Import Summary */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 space-y-6">
        {/* File Information */}
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-purple-400" />
            File Information
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-500 mb-1">File Name</div>
              <div className="text-sm text-slate-200 font-medium">{summary.fileName}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">File Size</div>
              <div className="text-sm text-slate-200">{formatFileSize(summary.fileSize)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Mapped Fields</div>
              <div className="text-sm text-slate-200">{summary.mappedFields} fields</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Estimated Duration</div>
              <div className="text-sm text-slate-200 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {formatDuration(summary.estimatedDuration)}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-6">
          {/* Import Statistics */}
          <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            Import Statistics
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="text-xs text-slate-500 mb-1">Total Rows in File</div>
              <div className="text-2xl font-semibold text-slate-200">
                {summary.totalRows.toLocaleString()}
              </div>
            </div>
            <div className="bg-green-500/10 border border-green-500/40 rounded-lg p-4">
              <div className="text-xs text-green-400 mb-1">Rows to Import</div>
              <div className="text-2xl font-semibold text-green-300">
                {summary.validRows.toLocaleString()}
              </div>
              <div className="text-xs text-green-400/70 mt-1">
                {((summary.validRows / summary.totalRows) * 100).toFixed(1)}% of total
              </div>
            </div>
            {summary.warningRows > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-lg p-4">
                <div className="text-xs text-yellow-400 mb-1">Warnings</div>
                <div className="text-2xl font-semibold text-yellow-300">
                  {summary.warningRows.toLocaleString()}
                </div>
                <div className="text-xs text-yellow-400/70 mt-1">
                  Will be imported with warnings
                </div>
              </div>
            )}
            {summary.errorRows > 0 && (
              <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-4">
                <div className="text-xs text-red-400 mb-1">Errors (Skipped)</div>
                <div className="text-2xl font-semibold text-red-300">
                  {summary.errorRows.toLocaleString()}
                </div>
                <div className="text-xs text-red-400/70 mt-1">
                  {((summary.errorRows / summary.totalRows) * 100).toFixed(1)}% of total
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Warning Banners */}
      {summary.errorRows > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/40 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-orange-300 font-medium mb-1">Rows with Errors Will Be Skipped</h4>
            <p className="text-orange-200/80 text-sm">
              <strong>{summary.errorRows.toLocaleString()}</strong> row(s) have validation errors
              and will not be imported. Only <strong>{summary.validRows.toLocaleString()}</strong>{' '}
              valid row(s) will be added to the database.
            </p>
          </div>
        </div>
      )}

      <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="text-red-300 font-medium mb-1">This Action Cannot Be Undone</h4>
          <p className="text-red-200/80 text-sm mb-3">
            Once imported, the data will be added to your organization's PFA records. Make sure you
            have reviewed the preview and are satisfied with the field mappings.
          </p>
          <p className="text-red-200/80 text-sm">
            <strong>Important:</strong> Duplicate records (based on PFA ID or Equipment Code) will
            be skipped. Existing records will not be overwritten.
          </p>
        </div>
      </div>

      {/* Confirmation Checkbox */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-2 focus:ring-purple-500/50"
          />
          <div className="text-sm">
            <p className="text-slate-200 font-medium mb-1">
              I confirm that I want to import this data
            </p>
            <p className="text-slate-400 text-xs">
              I understand that {summary.validRows.toLocaleString()} row(s) will be added to the
              database
              {summary.errorRows > 0 &&
                ` and ${summary.errorRows.toLocaleString()} row(s) with errors will be skipped`}
              . This action cannot be undone.
            </p>
          </div>
        </label>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-700">
        <button
          onClick={onBack}
          disabled={importing}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back to Preview
        </button>
        <button
          onClick={handleConfirm}
          disabled={!confirmed || importing}
          className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {importing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Importing {summary.validRows.toLocaleString()} rows...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Confirm Import
            </>
          )}
        </button>
      </div>
    </div>
  );
}
