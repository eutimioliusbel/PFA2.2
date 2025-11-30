/**
 * @file SchemaDiffModal.tsx
 * @description Schema Drift & Version History Component - ADR-007 Task 5.7
 *
 * Provides two key features:
 * 1. Schema Drift Alert: Side-by-side diff view comparing baseline vs received schemas
 * 2. Mapping Version History: Timeline of mapping rule changes with restore capability
 *
 * User Flow:
 * - Yellow banner on Endpoint card when schema drift detected
 * - Click to open side-by-side diff view
 * - Auto-suggest new mappings for added fields
 * - View/restore historical mapping versions
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle,
  MinusCircle,
  PlusCircle,
  ArrowRight,
  History,
  Clock,
  Loader2,
  Sparkles,
  RotateCcw,
  Eye,
  Database
} from 'lucide-react';

// API Base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface SchemaDrift {
  hasDrift: boolean;
  missingFields: string[];
  newFields: string[];
  changedTypes: Record<string, { was: string; now: string }>;
  severity: 'low' | 'medium' | 'high';
  metrics: {
    baselineFieldCount: number;
    newFieldCount: number;
    missingPercent: number;
    addedCount: number;
    typeChangeCount: number;
  };
}

interface MappingSuggestion {
  sourceField: string;
  destinationField: string;
  confidence: number;
  reason: string;
}

interface MappingVersion {
  id: string;
  version: number;
  validFrom: string;
  validTo?: string;
  createdBy: string;
  changeDescription?: string;
  mappingCount: number;
  isActive: boolean;
}

interface FieldMapping {
  id: string;
  sourceField: string;
  destinationField: string;
  transformType: string;
  dataType: string;
  isActive: boolean;
}

interface SchemaDiffModalProps {
  isOpen: boolean;
  endpointId: string;
  endpointName: string;
  onClose: () => void;
  onMappingsUpdated?: () => void;
}

export function SchemaDiffModal({
  isOpen,
  endpointId,
  endpointName,
  onClose,
  onMappingsUpdated
}: SchemaDiffModalProps): React.ReactElement | null {
  // State
  const [activeTab, setActiveTab] = useState<'drift' | 'history'>('drift');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drift state
  const [drift, setDrift] = useState<SchemaDrift | null>(null);
  const [baselineFields, setBaselineFields] = useState<string[]>([]);
  const [receivedFields, setReceivedFields] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<MappingSuggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  // History state
  const [versions, setVersions] = useState<MappingVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [versionMappings, setVersionMappings] = useState<FieldMapping[]>([]);
  const [loadingVersion, setLoadingVersion] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Get auth token
  const getAuthToken = useCallback((): string | null => {
    return localStorage.getItem('pfa_auth_token');
  }, []);

  // Fetch drift data
  useEffect(() => {
    if (isOpen && endpointId) {
      fetchDriftData();
      fetchVersionHistory();
    }
  }, [isOpen, endpointId]);

  const fetchDriftData = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/endpoints/${endpointId}/schema-drift`,
        {
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch schema drift data');
      }

      const data = await response.json();
      setDrift(data.drift);
      setBaselineFields(data.baseline?.fields || []);
      setReceivedFields(data.received?.fields || []);
      setSuggestions(data.suggestions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schema drift');
    } finally {
      setLoading(false);
    }
  };

  const fetchVersionHistory = async (): Promise<void> => {
    setVersionsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/endpoints/${endpointId}/mapping-versions`,
        {
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions || []);
      }
    } catch (err) {
      console.error('Failed to fetch version history:', err);
    } finally {
      setVersionsLoading(false);
    }
  };

  // Fetch mappings for a specific version
  const fetchVersionMappings = async (versionId: string): Promise<void> => {
    setLoadingVersion(true);
    setSelectedVersion(versionId);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/endpoints/${endpointId}/mapping-versions/${versionId}`,
        {
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setVersionMappings(data.mappings || []);
      }
    } catch (err) {
      console.error('Failed to fetch version mappings:', err);
    } finally {
      setLoadingVersion(false);
    }
  };

  // Toggle suggestion selection
  const toggleSuggestion = (sourceField: string): void => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(sourceField)) {
        next.delete(sourceField);
      } else {
        next.add(sourceField);
      }
      return next;
    });
  };

  // Apply selected suggestions
  const applySuggestions = async (): Promise<void> => {
    if (selectedSuggestions.size === 0) return;

    setApplying(true);
    setError(null);

    try {
      const mappingsToCreate = suggestions
        .filter(s => selectedSuggestions.has(s.sourceField))
        .map(s => ({
          sourceField: s.sourceField,
          destinationField: s.destinationField,
          transformType: 'direct',
          dataType: 'string'
        }));

      const response = await fetch(
        `${API_BASE_URL}/api/endpoints/${endpointId}/mappings/batch`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ mappings: mappingsToCreate })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to apply mappings');
      }

      // Refresh data
      await fetchDriftData();
      await fetchVersionHistory();
      setSelectedSuggestions(new Set());

      if (onMappingsUpdated) {
        onMappingsUpdated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply suggestions');
    } finally {
      setApplying(false);
    }
  };

  // Restore historical version
  const restoreVersion = async (versionId: string): Promise<void> => {
    if (!confirm('Are you sure you want to restore this version? Current mappings will be replaced.')) {
      return;
    }

    setRestoring(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/endpoints/${endpointId}/mapping-versions/${versionId}/restore`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to restore version');
      }

      await fetchDriftData();
      await fetchVersionHistory();
      setSelectedVersion(null);
      setVersionMappings([]);

      if (onMappingsUpdated) {
        onMappingsUpdated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore version');
    } finally {
      setRestoring(false);
    }
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get severity color
  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'high':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'medium':
        return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
      default:
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Schema Analysis: {endpointName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('drift')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'drift'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <AlertTriangle className="w-4 h-4 inline mr-1" />
            Schema Drift
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <History className="w-4 h-4 inline mr-1" />
            Version History ({versions.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 animate-pulse">
              {/* Skeleton for drift summary */}
              <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>

              {/* Skeleton for side-by-side comparison */}
              <div className="grid grid-cols-2 gap-4">
                <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              </div>

              {/* Skeleton for suggestions */}
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
              <span className="text-red-600 dark:text-red-400">{error}</span>
              <button
                onClick={fetchDriftData}
                className="mt-4 px-4 py-2 text-sm text-blue-600 hover:underline"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* Schema Drift Tab */}
              {activeTab === 'drift' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Drift Summary */}
                  {drift && (
                    <div className={`p-4 rounded-lg border ${getSeverityColor(drift.severity)}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {drift.hasDrift ? (
                            <AlertTriangle className="w-5 h-5" />
                          ) : (
                            <CheckCircle className="w-5 h-5" />
                          )}
                          <span className="font-medium">
                            {drift.hasDrift
                              ? `Schema Drift Detected (${drift.severity.toUpperCase()})`
                              : 'No Schema Drift'}
                          </span>
                        </div>
                        <div className="text-xs">
                          {drift.metrics.missingPercent.toFixed(1)}% fields missing
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Side-by-Side Comparison */}
                  {drift?.hasDrift && (
                    <div className="grid grid-cols-2 gap-4">
                      {/* Baseline (Expected) */}
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Baseline (Expected)
                          </h3>
                          <p className="text-xs text-gray-500">
                            {baselineFields.length} fields
                          </p>
                        </div>
                        <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                          {baselineFields.map((field) => {
                            const isMissing = drift.missingFields.includes(field);
                            return (
                              <div
                                key={field}
                                className={`flex items-center gap-2 px-2 py-1 rounded text-sm ${
                                  isMissing
                                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                {isMissing && <MinusCircle className="w-4 h-4 text-red-500" />}
                                <span className="font-mono">{field}</span>
                                {isMissing && (
                                  <span className="ml-auto text-xs bg-red-100 dark:bg-red-800 px-1.5 py-0.5 rounded">
                                    MISSING
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Received (Actual) */}
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Received (Actual)
                          </h3>
                          <p className="text-xs text-gray-500">
                            {receivedFields.length} fields
                          </p>
                        </div>
                        <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                          {receivedFields.map((field) => {
                            const isNew = drift.newFields.includes(field);
                            return (
                              <div
                                key={field}
                                className={`flex items-center gap-2 px-2 py-1 rounded text-sm ${
                                  isNew
                                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                {isNew && <PlusCircle className="w-4 h-4 text-green-500" />}
                                <span className="font-mono">{field}</span>
                                {isNew && (
                                  <span className="ml-auto text-xs bg-green-100 dark:bg-green-800 px-1.5 py-0.5 rounded">
                                    NEW
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Type Changes */}
                  {drift?.hasDrift && Object.keys(drift.changedTypes).length > 0 && (
                    <div className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
                      <div className="bg-amber-50 dark:bg-amber-900/20 px-4 py-2 border-b border-amber-200 dark:border-amber-800">
                        <h3 className="text-sm font-medium text-amber-700 dark:text-amber-300">
                          Type Changes
                        </h3>
                      </div>
                      <div className="p-2 space-y-1">
                        {Object.entries(drift.changedTypes).map(([field, change]) => (
                          <div
                            key={field}
                            className="flex items-center gap-2 px-2 py-1 text-sm text-gray-700 dark:text-gray-300"
                          >
                            <span className="font-mono font-medium">{field}</span>
                            <span className="text-gray-400">:</span>
                            <span className="text-red-500">{change.was}</span>
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                            <span className="text-green-500">{change.now}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested Mappings */}
                  {suggestions.length > 0 && (
                    <div className="border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
                      <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-blue-500" />
                          <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            Suggested Mappings
                          </h3>
                        </div>
                        <span className="text-xs text-blue-600">
                          {selectedSuggestions.size} selected
                        </span>
                      </div>
                      <div className="p-2 space-y-1">
                        {suggestions.map((suggestion) => (
                          <label
                            key={suggestion.sourceField}
                            className="flex items-center gap-3 px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded cursor-pointer focus-within:ring-2 focus-within:ring-blue-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleSuggestion(suggestion.sourceField);
                              }
                            }}
                            tabIndex={0}
                            role="checkbox"
                            aria-checked={selectedSuggestions.has(suggestion.sourceField)}
                          >
                            <input
                              type="checkbox"
                              checked={selectedSuggestions.has(suggestion.sourceField)}
                              onChange={() => toggleSuggestion(suggestion.sourceField)}
                              className="h-4 w-4 text-blue-600 rounded border-gray-300"
                              tabIndex={-1}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-mono text-gray-700 dark:text-gray-300">
                                  {suggestion.sourceField}
                                </span>
                                <ArrowRight className="w-4 h-4 text-gray-400" />
                                <span className="font-mono text-blue-600 dark:text-blue-400">
                                  {suggestion.destinationField}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {suggestion.reason} ({Math.round(suggestion.confidence * 100)}% confidence)
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                      {selectedSuggestions.size > 0 && (
                        <div className="p-2 border-t border-blue-200 dark:border-blue-800">
                          <button
                            onClick={applySuggestions}
                            disabled={applying}
                            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2"
                          >
                            {applying ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Applying...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                Apply {selectedSuggestions.size} Mapping{selectedSuggestions.size > 1 ? 's' : ''}
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* No Drift */}
                  {drift && !drift.hasDrift && (
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
                      <p className="font-medium">Schema is stable</p>
                      <p className="text-sm mt-1">No drift detected between baseline and received schema</p>
                    </div>
                  )}
                </div>
              )}

              {/* Version History Tab */}
              {activeTab === 'history' && (
                <div className="flex-1 overflow-hidden flex">
                  {/* Version List */}
                  <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
                    {versionsLoading ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                        <span className="mt-2 text-sm text-gray-500">Loading versions...</span>
                      </div>
                    ) : versions.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No version history</p>
                      </div>
                    ) : (
                      <div className="p-2 space-y-1">
                        {versions.map((version) => (
                          <button
                            key={version.id}
                            onClick={() => fetchVersionMappings(version.id)}
                            className={`w-full text-left p-3 rounded-lg transition-colors ${
                              selectedVersion === version.id
                                ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                v{version.version}
                              </span>
                              {version.isActive && (
                                <span className="text-xs bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(version.validFrom)}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {version.mappingCount} mappings
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Version Detail */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {!selectedVersion ? (
                      <div className="text-center py-12 text-gray-500">
                        <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Select a version to view details</p>
                      </div>
                    ) : loadingVersion ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Version Actions */}
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Mappings ({versionMappings.length})
                          </h3>
                          {!versions.find(v => v.id === selectedVersion)?.isActive && (
                            <button
                              onClick={() => restoreVersion(selectedVersion)}
                              disabled={restoring}
                              className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg flex items-center gap-1"
                            >
                              {restoring ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3 h-3" />
                              )}
                              Restore Version
                            </button>
                          )}
                        </div>

                        {/* Mappings List */}
                        <div className="space-y-1">
                          {versionMappings.map((mapping) => (
                            <div
                              key={mapping.id}
                              className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-sm"
                            >
                              <span className="font-mono text-gray-600 dark:text-gray-400">
                                {mapping.sourceField}
                              </span>
                              <ArrowRight className="w-4 h-4 text-gray-400" />
                              <span className="font-mono text-gray-900 dark:text-gray-100">
                                {mapping.destinationField}
                              </span>
                              <span className="ml-auto text-xs text-gray-500 bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded">
                                {mapping.transformType}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default SchemaDiffModal;
