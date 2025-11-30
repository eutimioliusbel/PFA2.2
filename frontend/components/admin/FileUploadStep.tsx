/**
 * File Upload Step Component
 * Phase 5, Task 5.6 - Intelligent Import Wizard
 *
 * First step of import wizard: file upload with drag-and-drop support.
 * Entity-aware for different data types (PFA, Asset, BEO).
 */

import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';

interface FileUploadStepProps {
  onUpload: (file: File) => Promise<void>;
  onBack?: () => void;
  entityName?: string;
}

export function FileUploadStep({ onUpload, onBack, entityName = 'PFA' }: FileUploadStepProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file type
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls)$/i)) {
      return { valid: false, error: 'Invalid file type. Please upload CSV or Excel file.' };
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return { valid: false, error: 'File size exceeds 10MB limit.' };
    }

    // Check file name
    if (file.name.length > 255) {
      return { valid: false, error: 'File name too long (max 255 characters).' };
    }

    return { valid: true };
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const uploadedFile = e.dataTransfer.files[0];
      const validation = validateFile(uploadedFile);

      if (!validation.valid) {
        setError(validation.error || 'Invalid file');
        return;
      }

      setFile(uploadedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const uploadedFile = e.target.files[0];
      const validation = validateFile(uploadedFile);

      if (!validation.valid) {
        setError(validation.error || 'Invalid file');
        return;
      }

      setFile(uploadedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      await onUpload(file);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to upload file';
      setError(message);
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-semibold text-slate-200 mb-2">Upload Import File</h3>
        <p className="text-slate-400 text-sm">
          Upload a CSV or Excel file containing <span className="text-purple-300 font-medium">{entityName}</span> data.
          Our AI will analyze the file and suggest field mappings.
        </p>
      </div>

      {/* Drag and Drop Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-12 transition-colors ${
          dragActive
            ? 'border-purple-500 bg-purple-500/10'
            : 'border-slate-700 bg-slate-900 hover:border-slate-600'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
        />

        {!file ? (
          <div className="flex flex-col items-center justify-center text-center">
            <Upload
              className={`w-12 h-12 mb-4 ${
                dragActive ? 'text-purple-400' : 'text-slate-500'
              }`}
            />
            <p className="text-slate-300 font-medium mb-2">
              Drag and drop your file here, or click to browse
            </p>
            <p className="text-slate-500 text-sm mb-4">
              Supported formats: CSV, Excel (.xlsx, .xls) - Max file size: 10MB
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
            >
              Browse Files
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <FileSpreadsheet className="w-10 h-10 text-green-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-slate-200 font-medium">{file.name}</h4>
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
              <div className="text-sm text-slate-400 space-y-1">
                <p>Size: {formatFileSize(file.size)}</p>
                <p>Type: {file.type || 'Unknown'}</p>
                <p>Last Modified: {new Date(file.lastModified).toLocaleDateString()}</p>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setError(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="mt-3 text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                Choose a different file
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-red-300 font-medium mb-1">Upload Error</h4>
            <p className="text-red-200/80 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/40 rounded-lg p-4">
        <h4 className="text-blue-300 font-medium mb-2">What happens next?</h4>
        <ul className="text-blue-200/80 text-sm space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">1.</span>
            <span>Our AI will analyze your file structure and column names</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">2.</span>
            <span>Field mapping suggestions will be provided with confidence scores</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">3.</span>
            <span>If you have saved mappings in Mapping Studio, you can apply them</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">4.</span>
            <span>Data quality issues will be detected and highlighted</span>
          </li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-700">
        {onBack ? (
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Entity Selection
          </button>
        ) : (
          <div></div>
        )}
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="px-6 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing File...
            </>
          ) : (
            <>
              Continue to Field Mapping
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
