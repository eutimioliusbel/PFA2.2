/**
 * ExportView Component
 * Phase 5 - Data Export with Mapping Studio Integration
 *
 * Handles CSV export operations using mapping configurations from Mapping Studio.
 * Theme: Dark slate (consistent with UserManagement)
 */

import React, { useState, useEffect } from 'react';
import { Asset } from '../types';
import {
  FileDown,
  FileSpreadsheet,
  Download,
  TrendingDown,
  Settings,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';

interface MappingConfiguration {
  id: string;
  name: string;
  description?: string;
  entity: string;
  direction: 'import' | 'export';
  isActive: boolean;
  mappingCount: number;
}

interface FieldMapping {
  id: string;
  sourceField: string;
  destinationField: string;
  transform?: string;
  isRequired?: boolean;
  displayOrder?: number;
}

interface ExportViewProps {
  assets: Asset[];
  baselineAssets?: Asset[];
  organizationId?: string;
}

export const ExportView: React.FC<ExportViewProps> = ({
  assets,
  baselineAssets = [],
  organizationId: _organizationId,
}) => {
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [mappingConfigs, setMappingConfigs] = useState<MappingConfiguration[]>([]);
  const [selectedMapping, setSelectedMapping] = useState<string | null>(null);
  const [mappingFields, setMappingFields] = useState<FieldMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMappingDropdown, setShowMappingDropdown] = useState(false);

  // Load available export mapping configurations
  useEffect(() => {
    const fetchMappingConfigs = async () => {
      setLoading(true);
      try {
        const response = await apiClient.get<{ configurations: MappingConfiguration[] }>(
          '/api/mapping-templates?direction=export&isActive=true'
        );

        const configs = response.configurations || [];
        setMappingConfigs(configs);

        // Auto-select first PFA export mapping if available
        const pfaExport = configs.find(c => c.entity === 'PFA' && c.direction === 'export');
        if (pfaExport) {
          setSelectedMapping(pfaExport.id);
        }
      } catch (err) {
        console.error('Failed to load mapping configurations:', err);
        setError('Failed to load mapping configurations');
      } finally {
        setLoading(false);
      }
    };

    fetchMappingConfigs();
  }, []);

  // Load fields for selected mapping
  useEffect(() => {
    const fetchMappingFields = async () => {
      if (!selectedMapping) {
        setMappingFields([]);
        return;
      }

      try {
        const response = await apiClient.get<{ mappings: FieldMapping[] }>(
          `/api/mapping-templates/${selectedMapping}/fields`
        );
        setMappingFields(response.mappings || []);
      } catch (err) {
        console.error('Failed to load mapping fields:', err);
        setMappingFields([]);
      }
    };

    fetchMappingFields();
  }, [selectedMapping]);

  const isDifferent = (val1: unknown, val2: unknown): boolean => {
    if (val1 instanceof Date && val2 instanceof Date) {
      return val1.getTime() !== val2.getTime();
    }
    return val1 != val2;
  };

  const applyTransform = (value: unknown, transform?: string): string => {
    if (value === undefined || value === null) return '';

    let strVal = String(value);

    if (!transform) {
      if (value instanceof Date) return value.toISOString().split('T')[0];
      if (typeof value === 'boolean') return value ? '1' : '0';
      return strVal;
    }

    switch (transform) {
      case 'uppercase':
        return strVal.toUpperCase();
      case 'lowercase':
        return strVal.toLowerCase();
      case 'date_format':
        if (value instanceof Date) return value.toISOString().split('T')[0];
        return strVal;
      case 'boolean_yn':
        return value ? 'Y' : 'N';
      case 'boolean_10':
        return value ? '1' : '0';
      default:
        return strVal;
    }
  };

  const generateCSV = (dataToExport: Asset[]) => {
    if (mappingFields.length === 0) return null;

    // Sort fields by display order
    const sortedFields = [...mappingFields].sort((a, b) =>
      (a.displayOrder || 0) - (b.displayOrder || 0)
    );

    // Generate headers from destination field names
    const headers = sortedFields.map(f => f.destinationField).join(',');

    // Generate rows
    const rows = dataToExport.map((asset) => {
      return sortedFields
        .map((field) => {
          const key = field.sourceField as keyof Asset;
          const val = asset[key];
          const transformedVal = applyTransform(val, field.transform);

          // Escape commas
          if (transformedVal.includes(',')) return `"${transformedVal}"`;
          return transformedVal;
        })
        .join(',');
    });

    return [headers, ...rows].join('\n');
  };

  const handleExport = (type: 'changes' | 'full') => {
    if (!selectedMapping) {
      setError('Please select a mapping configuration first');
      return;
    }

    if (mappingFields.length === 0) {
      setError('Selected mapping has no field configurations. Please configure fields in Mapping Studio.');
      return;
    }

    setIsExporting(type);
    setError(null);

    setTimeout(() => {
      let changedAssets: Asset[] = [];
      const selectedConfig = mappingConfigs.find(c => c.id === selectedMapping);
      const entityName = selectedConfig?.entity || 'PFA';

      if (type === 'full' || baselineAssets.length === 0) {
        changedAssets = assets;
      } else {
        changedAssets = assets.filter((current) => {
          const baseline = baselineAssets.find((b) => b.id === current.id);
          if (!baseline) return true;

          const hasDiff = mappingFields.some((f) => {
            const key = f.sourceField as keyof Asset;
            return isDifferent(current[key], baseline[key]);
          });

          return hasDiff;
        });
      }

      let finalExportData = changedAssets;
      let filePrefix = type === 'full' ? `${entityName}_full` : `${entityName}_changes`;

      if (type === 'changes' && changedAssets.length === 0) {
        const confirmFull = window.confirm(
          'No changes detected based on the selected mapping configuration.\n\nDo you want to export the complete list instead?'
        );
        if (confirmFull) {
          finalExportData = assets;
          filePrefix = `${entityName}_full`;
        } else {
          setIsExporting(null);
          return;
        }
      }

      const csvContent = generateCSV(finalExportData);

      if (csvContent) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute(
          'download',
          `${filePrefix}_${new Date().toISOString().split('T')[0]}.csv`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setIsExporting(null);
    }, 800);
  };

  const selectedConfig = mappingConfigs.find(c => c.id === selectedMapping);

  return (
    <div className="flex flex-col h-full p-8 bg-slate-900 overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <FileDown className="w-8 h-8 text-blue-500" /> Data Export
          </h2>
          <p className="text-slate-400 mt-2">
            Download system data using configured field mappings from Mapping Studio.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/40 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-red-300">{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <span className="ml-3 text-slate-400">Loading mapping configurations...</span>
          </div>
        )}

        {!loading && (
          <>
            {/* Mapping Configuration Selector */}
            <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-slate-400" />
                <h3 className="text-lg font-semibold text-slate-200">Export Configuration</h3>
              </div>

              {mappingConfigs.length === 0 ? (
                <div className="p-6 bg-slate-700/50 rounded-lg text-center">
                  <AlertCircle className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
                  <p className="text-slate-300 mb-2">No Export Mappings Configured</p>
                  <p className="text-sm text-slate-400">
                    Please create an export mapping configuration in Mapping Studio first.
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setShowMappingDropdown(!showMappingDropdown)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-left flex items-center justify-between hover:bg-slate-600 transition-colors"
                  >
                    <div>
                      {selectedConfig ? (
                        <>
                          <span className="text-slate-200 font-medium">{selectedConfig.name}</span>
                          <span className="ml-3 px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded">
                            {selectedConfig.entity}
                          </span>
                          <span className="ml-2 text-slate-400 text-sm">
                            ({selectedConfig.mappingCount} fields)
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">Select a mapping configuration...</span>
                      )}
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showMappingDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showMappingDropdown && (
                    <div className="absolute z-10 mt-2 w-full bg-slate-700 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                      {mappingConfigs.map((config) => (
                        <button
                          key={config.id}
                          onClick={() => {
                            setSelectedMapping(config.id);
                            setShowMappingDropdown(false);
                          }}
                          className={`w-full px-4 py-3 text-left hover:bg-slate-600 transition-colors border-b border-slate-600 last:border-b-0 ${
                            selectedMapping === config.id ? 'bg-slate-600' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-slate-200 font-medium">{config.name}</span>
                              <span className="ml-3 px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded">
                                {config.entity}
                              </span>
                            </div>
                            <span className="text-slate-400 text-sm">
                              {config.mappingCount} fields
                            </span>
                          </div>
                          {config.description && (
                            <p className="text-sm text-slate-400 mt-1">{config.description}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Field Preview */}
              {selectedMapping && mappingFields.length > 0 && (
                <div className="mt-4 p-4 bg-slate-700/50 rounded-lg">
                  <div className="text-sm text-slate-400 mb-2">Fields to export:</div>
                  <div className="flex flex-wrap gap-2">
                    {mappingFields.map((field) => (
                      <span
                        key={field.id}
                        className="px-2 py-1 bg-slate-600 text-slate-300 text-xs rounded"
                      >
                        {field.destinationField}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Export Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Changes Export Card */}
              <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-xl flex flex-col items-center text-center hover:border-blue-500 transition-colors group">
                <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <FileSpreadsheet className="w-10 h-10 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-100 mb-2">Export Changes Only</h3>
                <p className="text-sm text-slate-400 mb-8">
                  Export only records that have changed from baseline. Uses the selected mapping
                  configuration to compare values.
                </p>
                <button
                  onClick={() => handleExport('changes')}
                  disabled={!!isExporting || !selectedMapping}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
                >
                  {isExporting === 'changes' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" /> Export Changes
                    </>
                  )}
                </button>
              </div>

              {/* Full Export Card */}
              <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-xl flex flex-col items-center text-center hover:border-orange-500 transition-colors group">
                <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <TrendingDown className="w-10 h-10 text-orange-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-100 mb-2">Export Full Dataset</h3>
                <p className="text-sm text-slate-400 mb-8">
                  Export all records regardless of changes. Useful for full data backups or
                  system migrations.
                </p>
                <button
                  onClick={() => handleExport('full')}
                  disabled={!!isExporting || !selectedMapping}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {isExporting === 'full' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" /> Export All
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Export Summary */}
            {selectedMapping && (
              <div className="mt-6 p-4 bg-slate-800 border border-slate-700 rounded-lg">
                <div className="flex items-center gap-2 text-slate-300">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span>Ready to export <strong>{assets.length.toLocaleString()}</strong> records using <strong>{selectedConfig?.name}</strong> configuration</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
