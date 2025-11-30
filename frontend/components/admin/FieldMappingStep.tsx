/**
 * Field Mapping Step Component
 * Phase 5, Task 5.6 - Intelligent Import Wizard
 *
 * Second step: AI-suggested field mappings with dynamic entity fields from Mapping Studio.
 * Supports selecting existing mapping configurations or creating ad-hoc mappings.
 */

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Sparkles,
  ArrowRight,
  Settings,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface FieldMapping {
  sourceField: string;
  targetField: string;
  confidence: number;
  sampleValues: string[];
  transformation?: string;
}

interface DataQualityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  issue: string;
  recommendation: string;
  affectedColumn?: string;
  affectedRows?: number;
}

interface MappingConfiguration {
  id: string;
  name: string;
  description?: string;
  entity: string;
  direction: 'import' | 'export';
  isActive: boolean;
  mappingCount: number;
}

interface EntityFieldDefinition {
  name: string;
  label: string;
  type: string;
  category: string;
  required?: boolean;
}

interface FieldMappingStepProps {
  suggestions: {
    suggestedMappings: FieldMapping[];
    dataQualityIssues: DataQualityIssue[];
    fileInfo: {
      totalRows: number;
      totalColumns: number;
      detectedFormat: string;
    };
  };
  selectedEntity?: string;
  onConfirm: (mappings: FieldMapping[]) => void;
  onBack: () => void;
}

// Default entity field groups (fallback if API fails)
const DEFAULT_ENTITY_FIELDS: Record<string, EntityFieldDefinition[]> = {
  PFA: [
    { name: 'pfaId', label: 'PFA ID', type: 'string', category: 'Identification', required: true },
    { name: 'equipmentCode', label: 'Equipment Code', type: 'string', category: 'Identification' },
    { name: 'contract', label: 'Contract', type: 'string', category: 'Identification' },
    { name: 'equipmentDescription', label: 'Equipment Description', type: 'string', category: 'Description' },
    { name: 'manufacturer', label: 'Manufacturer', type: 'string', category: 'Description' },
    { name: 'model', label: 'Model', type: 'string', category: 'Description' },
    { name: 'category', label: 'Category', type: 'string', category: 'Classification' },
    { name: 'forecastCategory', label: 'Forecast Category', type: 'string', category: 'Classification' },
    { name: 'class', label: 'Class', type: 'string', category: 'Classification' },
    { name: 'areaSilo', label: 'Area/Silo', type: 'string', category: 'Classification' },
    { name: 'originalStart', label: 'Plan Start Date', type: 'date', category: 'Dates' },
    { name: 'originalEnd', label: 'Plan End Date', type: 'date', category: 'Dates' },
    { name: 'forecastStart', label: 'Forecast Start Date', type: 'date', category: 'Dates' },
    { name: 'forecastEnd', label: 'Forecast End Date', type: 'date', category: 'Dates' },
    { name: 'actualStart', label: 'Actual Start Date', type: 'date', category: 'Dates' },
    { name: 'actualEnd', label: 'Actual End Date', type: 'date', category: 'Dates' },
    { name: 'source', label: 'Source (Rental/Purchase)', type: 'string', category: 'Financial' },
    { name: 'dor', label: 'DOR (BEO/PROJECT)', type: 'string', category: 'Financial' },
    { name: 'monthlyRate', label: 'Monthly Rate', type: 'number', category: 'Financial' },
    { name: 'purchasePrice', label: 'Purchase Price', type: 'number', category: 'Financial' },
    { name: 'isActualized', label: 'Is Actualized', type: 'boolean', category: 'Status' },
    { name: 'isDiscontinued', label: 'Is Discontinued', type: 'boolean', category: 'Status' },
    { name: 'isFundsTransferable', label: 'Is Funds Transferable', type: 'boolean', category: 'Status' },
  ],
  Asset: [
    { name: 'assetId', label: 'Asset ID', type: 'string', category: 'Identification', required: true },
    { name: 'serialNumber', label: 'Serial Number', type: 'string', category: 'Identification' },
    { name: 'description', label: 'Description', type: 'string', category: 'Description' },
    { name: 'status', label: 'Status', type: 'string', category: 'Status' },
    { name: 'location', label: 'Location', type: 'string', category: 'Location' },
  ],
  BEO: [
    { name: 'beoNumber', label: 'BEO Number', type: 'string', category: 'Identification', required: true },
    { name: 'description', label: 'Description', type: 'string', category: 'Description' },
    { name: 'budget', label: 'Budget', type: 'number', category: 'Financial' },
    { name: 'spent', label: 'Spent', type: 'number', category: 'Financial' },
    { name: 'remaining', label: 'Remaining', type: 'number', category: 'Financial' },
  ],
};

export function FieldMappingStep({ suggestions, selectedEntity = 'PFA', onConfirm, onBack }: FieldMappingStepProps) {
  const [mappings, setMappings] = useState<FieldMapping[]>(suggestions.suggestedMappings);
  const [entityFields, setEntityFields] = useState<EntityFieldDefinition[]>([]);
  const [mappingConfigs, setMappingConfigs] = useState<MappingConfiguration[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);
  const [showConfigDropdown, setShowConfigDropdown] = useState(false);
  const [loadingFields, setLoadingFields] = useState(true);
  const [useExistingConfig, setUseExistingConfig] = useState(false);

  // Load entity field definitions and existing mapping configs
  useEffect(() => {
    const fetchData = async () => {
      setLoadingFields(true);
      try {
        // Fetch entity schema fields
        const schemaResponse = await apiClient.get<{ fields: EntityFieldDefinition[] }>(
          `/api/system-dictionary/entity-schema/${selectedEntity}`
        );
        if (schemaResponse.fields && schemaResponse.fields.length > 0) {
          setEntityFields(schemaResponse.fields);
        } else {
          // Fallback to defaults
          setEntityFields(DEFAULT_ENTITY_FIELDS[selectedEntity] || DEFAULT_ENTITY_FIELDS.PFA);
        }

        // Fetch existing import mapping configurations
        const configResponse = await apiClient.get<{ configurations: MappingConfiguration[] }>(
          `/api/mapping-templates?direction=import&entity=${selectedEntity}&isActive=true`
        );
        setMappingConfigs(configResponse.configurations || []);
      } catch (err) {
        console.error('Failed to load entity fields:', err);
        // Fallback to defaults
        setEntityFields(DEFAULT_ENTITY_FIELDS[selectedEntity] || DEFAULT_ENTITY_FIELDS.PFA);
      } finally {
        setLoadingFields(false);
      }
    };

    fetchData();
  }, [selectedEntity]);

  // Apply existing mapping configuration
  const applyMappingConfig = async (configId: string) => {
    try {
      const response = await apiClient.get<{ mappings: Array<{ sourceField: string; destinationField: string; transform?: string }> }>(
        `/api/mapping-templates/${configId}/fields`
      );

      if (response.mappings) {
        // Merge config mappings with detected source fields
        const configuredMappings = mappings.map((m) => {
          const configMapping = response.mappings.find(
            (cm) => cm.sourceField.toLowerCase() === m.sourceField.toLowerCase()
          );
          if (configMapping) {
            return {
              ...m,
              targetField: configMapping.destinationField,
              transformation: configMapping.transform,
              confidence: 1.0, // High confidence for configured mappings
            };
          }
          return m;
        });
        setMappings(configuredMappings);
      }
    } catch (err) {
      console.error('Failed to apply mapping configuration:', err);
    }
  };

  const updateMapping = (index: number, field: 'targetField' | 'transformation', value: string) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], [field]: value };
    setMappings(updated);
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) {
      return (
        <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs font-medium flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {(confidence * 100).toFixed(0)}% High
        </span>
      );
    }
    if (confidence >= 0.7) {
      return (
        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-xs font-medium flex items-center gap-1">
          <Info className="w-3 h-3" />
          {(confidence * 100).toFixed(0)}% Medium
        </span>
      );
    }
    return (
      <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs font-medium flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        {(confidence * 100).toFixed(0)}% Low
      </span>
    );
  };

  const getSeverityColor = (severity: 'critical' | 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'critical':
        return 'text-purple-300 bg-purple-500/20 border-purple-500/40';
      case 'high':
        return 'text-red-300 bg-red-500/20 border-red-500/40';
      case 'medium':
        return 'text-yellow-300 bg-yellow-500/20 border-yellow-500/40';
      case 'low':
        return 'text-blue-300 bg-blue-500/20 border-blue-500/40';
    }
  };

  const unmappedFields = mappings.filter((m) => !m.targetField).length;
  const lowConfidenceFields = mappings.filter((m) => m.confidence < 0.7).length;

  // Group entity fields by category
  const fieldsByCategory = entityFields.reduce<Record<string, EntityFieldDefinition[]>>((acc, field) => {
    const category = field.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(field);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-semibold text-slate-200 mb-2">Map CSV Columns to {selectedEntity} Fields</h3>
        <p className="text-slate-400 text-sm">
          Review AI-suggested mappings and make adjustments as needed. You can also use an existing
          mapping configuration from Mapping Studio.
        </p>
      </div>

      {/* File Info */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-slate-500 mb-1">Total Rows</div>
            <div className="text-lg font-semibold text-slate-200">
              {suggestions.fileInfo.totalRows.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Total Columns</div>
            <div className="text-lg font-semibold text-slate-200">
              {suggestions.fileInfo.totalColumns}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Format</div>
            <div className="text-lg font-semibold text-slate-200">
              {suggestions.fileInfo.detectedFormat}
            </div>
          </div>
        </div>
      </div>

      {/* Mapping Configuration Selection */}
      {mappingConfigs.length > 0 && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-5 h-5 text-slate-400" />
            <h4 className="text-slate-200 font-medium">Use Existing Configuration</h4>
            <label className="flex items-center gap-2 ml-auto cursor-pointer">
              <input
                type="checkbox"
                checked={useExistingConfig}
                onChange={(e) => setUseExistingConfig(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500"
              />
              <span className="text-sm text-slate-400">Apply saved mapping</span>
            </label>
          </div>

          {useExistingConfig && (
            <div className="relative">
              <button
                onClick={() => setShowConfigDropdown(!showConfigDropdown)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-left flex items-center justify-between hover:bg-slate-700 transition-colors"
              >
                <div>
                  {selectedConfig ? (
                    <>
                      <span className="text-slate-200 font-medium">
                        {mappingConfigs.find((c) => c.id === selectedConfig)?.name}
                      </span>
                      <span className="ml-3 text-slate-400 text-sm">
                        ({mappingConfigs.find((c) => c.id === selectedConfig)?.mappingCount} fields)
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-400">Select a mapping configuration...</span>
                  )}
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 transition-transform ${showConfigDropdown ? 'rotate-180' : ''}`}
                />
              </button>

              {showConfigDropdown && (
                <div className="absolute z-10 mt-2 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {mappingConfigs.map((config) => (
                    <button
                      key={config.id}
                      onClick={() => {
                        setSelectedConfig(config.id);
                        setShowConfigDropdown(false);
                        applyMappingConfig(config.id);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-b-0 ${
                        selectedConfig === config.id ? 'bg-slate-700' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-slate-200 font-medium">{config.name}</span>
                        <span className="text-slate-400 text-sm">{config.mappingCount} fields</span>
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
        </div>
      )}

      {/* AI Analysis Banner */}
      <div className="bg-purple-500/10 border border-purple-500/40 rounded-lg p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="text-purple-300 font-medium mb-1">AI Analysis Complete</h4>
          <p className="text-purple-200/80 text-sm">
            Our AI has analyzed your file and suggested field mappings based on column names and
            sample data. You can accept these suggestions or modify them manually.
          </p>
        </div>
      </div>

      {/* Data Quality Issues */}
      {suggestions.dataQualityIssues.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/40 rounded-lg p-4">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-orange-300 font-medium mb-1">Data Quality Issues Detected</h4>
              <p className="text-orange-200/80 text-sm">
                {suggestions.dataQualityIssues.length} issue(s) found. Please review before
                proceeding.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {suggestions.dataQualityIssues.map((issue, i) => (
              <div key={i} className={`rounded-lg p-3 border ${getSeverityColor(issue.severity)}`}>
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase px-2 py-0.5 bg-black/20 rounded">
                    {issue.severity}
                  </span>
                  {issue.affectedColumn && (
                    <span className="text-xs font-mono px-2 py-0.5 bg-black/20 rounded">
                      {issue.affectedColumn}
                    </span>
                  )}
                </div>
                <p className="text-sm mb-2">
                  <strong>Issue:</strong> {issue.issue}
                </p>
                <p className="text-sm">
                  <strong>Recommendation:</strong> {issue.recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mapping Warnings */}
      {(unmappedFields > 0 || lowConfidenceFields > 0) && (
        <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-lg p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            {unmappedFields > 0 && (
              <p className="text-yellow-200/80 mb-1">
                <strong>{unmappedFields}</strong> column(s) are not mapped to any field.
              </p>
            )}
            {lowConfidenceFields > 0 && (
              <p className="text-yellow-200/80">
                <strong>{lowConfidenceFields}</strong> mapping(s) have low confidence scores.
                Please review.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Mapping Table */}
      {loadingFields ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          <span className="ml-3 text-slate-400">Loading entity fields...</span>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr className="text-left text-xs text-slate-400">
                  <th className="px-4 py-3 font-medium">CSV Column</th>
                  <th className="px-4 py-3 font-medium">Sample Values</th>
                  <th className="px-4 py-3 font-medium">Maps To</th>
                  <th className="px-4 py-3 font-medium">Confidence</th>
                  <th className="px-4 py-3 font-medium">Transformation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {mappings.map((mapping, i) => (
                  <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-slate-200 font-mono">
                        {mapping.sourceField}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-slate-400 font-mono max-w-xs truncate">
                        {mapping.sampleValues.slice(0, 3).join(', ')}
                        {mapping.sampleValues.length > 3 && '...'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={mapping.targetField}
                        onChange={(e) => updateMapping(i, 'targetField', e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      >
                        <option value="">-- Not Mapped --</option>
                        {Object.entries(fieldsByCategory).map(([category, fields]) => (
                          <optgroup key={category} label={category}>
                            {fields.map((field) => (
                              <option key={field.name} value={field.name}>
                                {field.label}
                                {field.required ? ' *' : ''}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">{getConfidenceBadge(mapping.confidence)}</td>
                    <td className="px-4 py-3">
                      <select
                        value={mapping.transformation || ''}
                        onChange={(e) => updateMapping(i, 'transformation', e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      >
                        <option value="">None</option>
                        <option value="uppercase">UPPERCASE</option>
                        <option value="lowercase">lowercase</option>
                        <option value="trim">Trim whitespace</option>
                        <option value="date_format">Date format</option>
                        <option value="boolean_yn">Y/N to Boolean</option>
                        <option value="boolean_10">1/0 to Boolean</option>
                        <option value="number_parse">Parse as number</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-700">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
        >
          Back to Upload
        </button>
        <button
          onClick={() => onConfirm(mappings)}
          className="px-6 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          Continue to Preview
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
