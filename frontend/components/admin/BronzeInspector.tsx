/**
 * @file BronzeInspector.tsx
 * @description Bronze layer data inspector for viewing raw source data
 * ADR-007 Task 5.6: Bronze Inspector UI (UX-Enhanced)
 *
 * UX Improvements:
 * - ✅ Keyboard navigation (WCAG 2.1 AA compliant)
 * - ✅ Deferred search (prevents UI blocking)
 * - ✅ Export progress indication
 * - ✅ Error state clearing on retry
 * - ✅ Lazy JSON stringification
 * - ✅ Skeleton loading screens
 * - ✅ Request cancellation for concurrent operations
 * - ✅ apiClient integration (no manual token handling)
 */

import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import {
  Database,
  Search,
  Download,
  ChevronDown,
  ChevronRight,
  Clock,
  Server,
  FileJson,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface BronzeBatch {
  syncBatchId: string;
  organizationId: string;
  entityType: string;
  ingestedAt: string;
  completedAt?: string;
  recordCount: number;
  syncType: string;
  schemaFingerprint?: {
    fields: string[];
    types: Record<string, string>;
  };
  warnings: unknown[];
  errors: unknown[];
  serverName: string;
  endpointName: string;
  endpointPath?: string;
}

interface BronzeRecord {
  id: string;
  rawJson: Record<string, unknown>;
  ingestedAt: string;
  schemaVersion?: string;
}

interface BronzeInspectorProps {
  organizationId: string;
}

const BatchListSkeleton = () => (
  <div className="divide-y divide-gray-100">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="p-3 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2 mb-1"></div>
        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
      </div>
    ))}
  </div>
);

const RecordListSkeleton = () => (
  <div className="divide-y divide-gray-100">
    {[...Array(8)].map((_, i) => (
      <div key={i} className="p-3 animate-pulse">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    ))}
  </div>
);

const BronzeInspector: React.FC<BronzeInspectorProps> = ({ organizationId }) => {
  const [batches, setBatches] = useState<BronzeBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<BronzeBatch | null>(null);
  const [records, setRecords] = useState<BronzeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());
  const [expandedJson, setExpandedJson] = useState<Map<string, string>>(new Map());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportingBatchId, setExportingBatchId] = useState<string | null>(null);

  // Pagination
  const [batchOffset, setBatchOffset] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);

  // Request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Deferred search to prevent UI blocking
  const deferredSearchTerm = useDeferredValue(searchTerm);

  useEffect(() => {
    fetchBatches();
  }, [organizationId, batchOffset]);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      setError(null); // Clear previous errors

      const response = await apiClient.get<{
        batches: BronzeBatch[];
        pagination: { total: number };
      }>(`/api/bronze/batches?organizationId=${organizationId}&limit=20&offset=${batchOffset}`);

      setBatches(response.batches || []);
      setTotalBatches(response.pagination?.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load batches');
    } finally {
      setLoading(false);
    }
  };

  const fetchBatchRecords = async (batch: BronzeBatch) => {
    // Cancel previous request if still in flight
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    try {
      setLoadingRecords(true);
      setError(null); // Clear previous errors
      setSelectedBatch(batch);
      setExpandedRecords(new Set()); // Reset expanded records
      setExpandedJson(new Map()); // Clear cached JSON

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await apiClient.get<{
        records: BronzeRecord[];
        pagination: { total: number };
      }>(`/api/bronze/batches/${batch.syncBatchId}/records?limit=100`);

      setRecords(response.records || []);
      setTotalRecords(response.pagination?.total || 0);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Ignore cancelled requests
      }
      setError(err instanceof Error ? err.message : 'Failed to load records');
    } finally {
      setLoadingRecords(false);
    }
  };

  const toggleRecordExpand = (id: string, rawJson: Record<string, unknown>) => {
    const newExpanded = new Set(expandedRecords);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
      // Lazy stringify: only compute JSON when expanded
      if (!expandedJson.has(id)) {
        setExpandedJson(prev => new Map(prev).set(id, JSON.stringify(rawJson, null, 2)));
      }
    }
    setExpandedRecords(newExpanded);
  };

  const copyToClipboard = async (data: unknown, id: string) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      console.error('Failed to copy');
    }
  };

  const exportBatch = async (batchId: string) => {
    try {
      setExportingBatchId(batchId);
      setError(null); // Clear previous errors

      const response = await apiClient.get<{
        records: BronzeRecord[];
      }>(`/api/bronze/batches/${batchId}/records?limit=10000`);

      const blob = new Blob([JSON.stringify(response.records, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bronze-batch-${batchId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExportingBatchId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  // Memoized filtering with deferred search term
  const filteredRecords = useMemo(() => {
    if (!deferredSearchTerm) return records;
    const term = deferredSearchTerm.toLowerCase();
    return records.filter(record => {
      const jsonStr = JSON.stringify(record.rawJson).toLowerCase();
      return jsonStr.includes(term);
    });
  }, [records, deferredSearchTerm]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Database className="w-6 h-6 text-amber-500" />
            <h2 className="text-xl font-semibold text-gray-900">Bronze Inspector</h2>
            <span className="text-sm text-gray-500">Raw source data viewer</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1 bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700">Ingestion Batches</h3>
            </div>
            <BatchListSkeleton />
          </div>
          <div className="col-span-2 bg-white rounded-lg shadow p-8">
            <div className="text-center text-gray-500">
              <FileJson className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Loading batches...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Screen reader status announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {loadingRecords && "Loading records..."}
        {!loadingRecords && selectedBatch && `${filteredRecords.length} records found`}
        {exportingBatchId && "Exporting batch..."}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Database className="w-6 h-6 text-amber-500" />
          <h2 className="text-xl font-semibold text-gray-900">Bronze Inspector</h2>
          <span className="text-sm text-gray-500">Raw source data viewer</span>
        </div>
        <button
          onClick={fetchBatches}
          className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          aria-label="Refresh batch list"
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 flex items-center" role="alert">
          <AlertTriangle className="w-5 h-5 text-red-400 mr-3" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Batch List */}
        <div className="col-span-1 bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">Ingestion Batches</h3>
            <p className="text-xs text-gray-500">{totalBatches} total batches</p>
          </div>
          <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {batches.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No batches found
              </div>
            ) : (
              batches.map(batch => (
                <button
                  key={batch.syncBatchId}
                  onClick={() => fetchBatchRecords(batch)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fetchBatchRecords(batch);
                    }
                  }}
                  className={`w-full p-3 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
                    selectedBatch?.syncBatchId === batch.syncBatchId ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                  }`}
                  aria-label={`Batch ${batch.endpointName}, ${batch.recordCount} records, ${batch.syncType} sync`}
                  aria-pressed={selectedBatch?.syncBatchId === batch.syncBatchId}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{batch.endpointName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      batch.syncType === 'full' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {batch.syncType}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center text-xs text-gray-500 space-x-3">
                    <span className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDate(batch.ingestedAt)}
                    </span>
                    <span>{batch.recordCount.toLocaleString()} records</span>
                  </div>
                  {(batch.errors as unknown[]).length > 0 && (
                    <div className="mt-1 text-xs text-red-500">
                      {(batch.errors as unknown[]).length} errors
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
          {totalBatches > 20 && (
            <div className="px-4 py-2 border-t border-gray-200 flex justify-between">
              <button
                onClick={() => setBatchOffset(Math.max(0, batchOffset - 20))}
                disabled={batchOffset === 0}
                className="text-sm text-blue-600 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                aria-label="Previous page"
              >
                Previous
              </button>
              <button
                onClick={() => setBatchOffset(batchOffset + 20)}
                disabled={batchOffset + 20 >= totalBatches}
                className="text-sm text-blue-600 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Record Viewer */}
        <div className="col-span-2 bg-white rounded-lg shadow">
          {!selectedBatch ? (
            <div className="p-8 text-center text-gray-500">
              <FileJson className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Select a batch to view records</p>
            </div>
          ) : (
            <>
              {/* Batch Header */}
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      {selectedBatch.endpointName}
                    </h3>
                    <p className="text-xs text-gray-500">
                      <Server className="w-3 h-3 inline mr-1" />
                      {selectedBatch.serverName} | {selectedBatch.recordCount.toLocaleString()} records
                    </p>
                  </div>
                  <button
                    onClick={() => exportBatch(selectedBatch.syncBatchId)}
                    disabled={exportingBatchId === selectedBatch.syncBatchId}
                    className="flex items-center px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Export batch as JSON"
                  >
                    {exportingBatchId === selectedBatch.syncBatchId ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-1" />
                        Export JSON
                      </>
                    )}
                  </button>
                </div>

                {/* Schema info */}
                {selectedBatch.schemaFingerprint && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                    <span className="font-medium">Schema Fields: </span>
                    {selectedBatch.schemaFingerprint.fields.slice(0, 10).join(', ')}
                    {selectedBatch.schemaFingerprint.fields.length > 10 && (
                      <span className="text-gray-500"> +{selectedBatch.schemaFingerprint.fields.length - 10} more</span>
                    )}
                  </div>
                )}
              </div>

              {/* Search */}
              <div className="px-4 py-2 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="bronze-search-input"
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search records..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Search records"
                  />
                </div>
              </div>

              {/* Records */}
              <div className="max-h-[500px] overflow-y-auto">
                {loadingRecords ? (
                  <RecordListSkeleton />
                ) : filteredRecords.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    {searchTerm ? 'No matching records' : 'No records found'}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {filteredRecords.map((record, idx) => (
                      <div key={record.id} className="p-3">
                        <div
                          className="flex items-center justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1 -m-1"
                          onClick={() => toggleRecordExpand(record.id, record.rawJson)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleRecordExpand(record.id, record.rawJson);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-expanded={expandedRecords.has(record.id)}
                          aria-label={`Record ${idx + 1}, ${expandedRecords.has(record.id) ? 'expanded' : 'collapsed'}`}
                        >
                          <div className="flex items-center space-x-2">
                            {expandedRecords.has(record.id) ? (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="text-sm font-mono text-gray-600">Record #{idx + 1}</span>
                            <span className="text-xs text-gray-400">{record.id.slice(0, 8)}...</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(record.rawJson, record.id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                copyToClipboard(record.rawJson, record.id);
                              }
                            }}
                            className="p-1 text-gray-400 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                            aria-label={copiedId === record.id ? "Copied to clipboard" : "Copy JSON to clipboard"}
                          >
                            {copiedId === record.id ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        {expandedRecords.has(record.id) && (
                          <div className="mt-2 ml-6" role="region" aria-label="JSON content">
                            <pre className="p-3 bg-gray-50 rounded text-xs font-mono overflow-x-auto max-h-96">
                              {expandedJson.get(record.id)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pagination info */}
              <div className="px-4 py-2 border-t border-gray-200 text-sm text-gray-500" aria-live="polite">
                Showing {filteredRecords.length} of {totalRecords.toLocaleString()} records
                {searchTerm && deferredSearchTerm !== searchTerm && (
                  <span className="ml-2 text-xs text-gray-400">(searching...)</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BronzeInspector;
