/**
 * Import Wizard Component
 * Phase 5, Task 5.6 - Intelligent Import Wizard
 *
 * Multi-step wizard for importing data with AI-assisted field mapping.
 * Integrated with Mapping Studio for entity-aware field definitions.
 */

import React, { useState, useEffect } from 'react';
import { Upload, Map, Eye, CheckCircle2, Database, AlertCircle } from 'lucide-react';
import { FileUploadStep } from './FileUploadStep';
import { FieldMappingStep } from './FieldMappingStep';
import { PreviewStep } from './PreviewStep';
import { ConfirmImportStep } from './ConfirmImportStep';
import { apiClient } from '../../services/apiClient';

type WizardStep = 'entity' | 'upload' | 'mapping' | 'preview' | 'confirm' | 'success';

interface ImportWizardProps {
  organizationId: string;
  onComplete?: () => void;
}

interface EntityOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  hasMappings: boolean;
  mappingCount: number;
}

const DEFAULT_ENTITIES: EntityOption[] = [
  {
    id: 'PFA',
    name: 'PFA Records',
    description: 'Procurement & Finance Assets - equipment forecasts, rentals, and purchases',
    icon: 'file-text',
    hasMappings: false,
    mappingCount: 0,
  },
  {
    id: 'Asset',
    name: 'Assets',
    description: 'Physical equipment inventory with serial numbers and locations',
    icon: 'package',
    hasMappings: false,
    mappingCount: 0,
  },
  {
    id: 'BEO',
    name: 'BEO Records',
    description: 'Budget Estimate Orders - project budgets and financial tracking',
    icon: 'dollar-sign',
    hasMappings: false,
    mappingCount: 0,
  },
];

export function ImportWizard({ organizationId, onComplete }: ImportWizardProps) {
  const [step, setStep] = useState<WizardStep>('entity');
  const [selectedEntity, setSelectedEntity] = useState<string>('PFA');
  const [entities, setEntities] = useState<EntityOption[]>(DEFAULT_ENTITIES);
  const [file, setFile] = useState<File | null>(null);
  const [mappingSuggestions, setMappingSuggestions] = useState<{
    suggestedMappings: Array<{
      sourceField: string;
      targetField: string;
      confidence: number;
      sampleValues: string[];
      transformation?: string;
    }>;
    dataQualityIssues: Array<{
      severity: 'critical' | 'high' | 'medium' | 'low';
      issue: string;
      recommendation: string;
      affectedColumn?: string;
      affectedRows?: number;
    }>;
    fileInfo: {
      totalRows: number;
      totalColumns: number;
      detectedFormat: string;
    };
  } | null>(null);
  const [finalMapping, setFinalMapping] = useState<Array<{
    sourceField: string;
    targetField: string;
    confidence: number;
    sampleValues: string[];
    transformation?: string;
  }>>([]);
  const [previewData, setPreviewData] = useState<{
    summary: {
      totalRows: number;
      validRows: number;
      errorRows: number;
      warningRows?: number;
    };
    rows?: Array<Record<string, unknown>>;
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    importedRows: number;
    skippedRows: number;
    durationMs?: number;
  } | null>(null);
  const [loadingEntities, setLoadingEntities] = useState(true);

  // Load entity mapping availability
  useEffect(() => {
    const fetchEntityMappings = async () => {
      setLoadingEntities(true);
      try {
        const response = await apiClient.get<{ configurations: Array<{ entity: string; mappingCount: number }> }>(
          '/api/mapping-templates?direction=import&isActive=true'
        );

        const configs = response.configurations || [];

        // Update entities with mapping availability
        const updatedEntities = DEFAULT_ENTITIES.map((entity) => {
          const config = configs.find((c) => c.entity === entity.id);
          return {
            ...entity,
            hasMappings: !!config,
            mappingCount: config?.mappingCount || 0,
          };
        });

        setEntities(updatedEntities);
      } catch (err) {
        console.error('Failed to load entity mappings:', err);
      } finally {
        setLoadingEntities(false);
      }
    };

    fetchEntityMappings();
  }, []);

  const handleEntitySelect = (entityId: string) => {
    setSelectedEntity(entityId);
    setStep('upload');
  };

  const handleFileUpload = async (uploadedFile: File) => {
    setFile(uploadedFile);

    // Call AI to analyze file and suggest mappings
    const analysis = await apiClient.analyzeImportFile(uploadedFile, organizationId, selectedEntity);

    setMappingSuggestions(analysis);
    setStep('mapping');
  };

  const handleConfirmMapping = async (mappings: Array<{
    sourceField: string;
    targetField: string;
    confidence: number;
    sampleValues: string[];
    transformation?: string;
  }>) => {
    setFinalMapping(mappings);

    // Generate preview with selected mappings
    const preview = await apiClient.previewImport({
      file: file!,
      mappings,
      organizationId,
      entity: selectedEntity,
    });

    setPreviewData(preview);
    setStep('preview');
  };

  const handleConfirmPreview = () => {
    setStep('confirm');
  };

  const handleConfirmImport = async () => {
    const result = await apiClient.importData({
      file: file!,
      mappings: finalMapping,
      organizationId,
      entity: selectedEntity,
      validateOnly: false,
    });

    setImportResult(result);
    setStep('success');

    // Call onComplete callback if provided
    if (onComplete) {
      setTimeout(onComplete, 3000);
    }
  };

  const resetWizard = () => {
    setStep('entity');
    setSelectedEntity('PFA');
    setFile(null);
    setMappingSuggestions(null);
    setFinalMapping([]);
    setPreviewData(null);
    setImportResult(null);
  };

  // Wizard step indicator
  const steps = [
    { id: 'entity', label: 'Select Entity', icon: Database },
    { id: 'upload', label: 'Upload File', icon: Upload },
    { id: 'mapping', label: 'Map Fields', icon: Map },
    { id: 'preview', label: 'Preview Data', icon: Eye },
    { id: 'confirm', label: 'Confirm Import', icon: CheckCircle2 },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === step);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Wizard Steps Indicator */}
      {step !== 'success' && (
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((wizardStep, index) => {
              const Icon = wizardStep.icon;
              const isActive = wizardStep.id === step;
              const isCompleted = index < currentStepIndex;

              return (
                <React.Fragment key={wizardStep.id}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-colors ${
                        isActive
                          ? 'bg-purple-500 text-white'
                          : isCompleted
                          ? 'bg-green-500 text-white'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span
                      className={`text-sm font-medium transition-colors ${
                        isActive
                          ? 'text-purple-300'
                          : isCompleted
                          ? 'text-green-300'
                          : 'text-slate-500'
                      }`}
                    >
                      {wizardStep.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-4 transition-colors ${
                        isCompleted ? 'bg-green-500' : 'bg-slate-700'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Wizard Content */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-8">
        {/* Entity Selection Step */}
        {step === 'entity' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-slate-200 mb-2">Select Data Type to Import</h3>
              <p className="text-slate-400 text-sm">
                Choose which type of data you want to import. The import wizard will use the
                appropriate field mappings from Mapping Studio.
              </p>
            </div>

            {loadingEntities ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-3 text-slate-400">Loading entity configurations...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {entities.map((entity) => (
                  <button
                    key={entity.id}
                    onClick={() => handleEntitySelect(entity.id)}
                    className={`p-6 rounded-lg border-2 text-left transition-all hover:border-purple-500 hover:bg-slate-700/50 ${
                      selectedEntity === entity.id
                        ? 'border-purple-500 bg-slate-700/50'
                        : 'border-slate-600 bg-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <Database className="w-8 h-8 text-purple-400" />
                      {entity.hasMappings ? (
                        <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {entity.mappingCount} mappings
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          No mappings
                        </span>
                      )}
                    </div>
                    <h4 className="text-lg font-semibold text-slate-200 mb-2">{entity.name}</h4>
                    <p className="text-sm text-slate-400">{entity.description}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Warning for entities without mappings */}
            {!loadingEntities && !entities.find((e) => e.id === selectedEntity)?.hasMappings && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/40 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-yellow-300 font-medium mb-1">No Import Mappings Configured</h4>
                  <p className="text-sm text-yellow-200/80">
                    The selected entity type has no import mappings configured in Mapping Studio.
                    You can still proceed with AI-suggested mappings, or configure mappings in
                    Mapping Studio first for more reliable imports.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'upload' && (
          <FileUploadStep
            onUpload={handleFileUpload}
            onBack={() => setStep('entity')}
            entityName={entities.find((e) => e.id === selectedEntity)?.name || selectedEntity}
          />
        )}

        {step === 'mapping' && mappingSuggestions && (
          <FieldMappingStep
            suggestions={mappingSuggestions}
            selectedEntity={selectedEntity}
            onConfirm={handleConfirmMapping}
            onBack={() => setStep('upload')}
          />
        )}

        {step === 'preview' && previewData && (
          <PreviewStep
            data={previewData}
            onConfirm={handleConfirmPreview}
            onBack={() => setStep('mapping')}
          />
        )}

        {step === 'confirm' && previewData && (
          <ConfirmImportStep
            summary={{
              totalRows: previewData.summary.totalRows,
              validRows: previewData.summary.validRows,
              errorRows: previewData.summary.errorRows,
              warningRows: previewData.summary.warningRows || 0,
              fileName: file?.name || 'Unknown',
              fileSize: file?.size || 0,
              mappedFields: finalMapping.filter((m) => m.targetField).length,
              estimatedDuration: Math.ceil(previewData.summary.validRows / 100),
            }}
            onConfirm={handleConfirmImport}
            onBack={() => setStep('preview')}
          />
        )}

        {step === 'success' && importResult && (
          <div className="text-center py-12 space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-slate-200 mb-2">Import Successful!</h3>
              <p className="text-slate-400">
                Successfully imported {importResult.importedRows.toLocaleString()} {selectedEntity} records
                into your database.
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-md mx-auto">
              <div className="grid grid-cols-2 gap-4 text-left">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Rows Imported</div>
                  <div className="text-lg font-semibold text-green-300">
                    {importResult.importedRows.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Rows Skipped</div>
                  <div className="text-lg font-semibold text-slate-300">
                    {importResult.skippedRows.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Duration</div>
                  <div className="text-lg font-semibold text-slate-300">
                    {importResult.durationMs
                      ? `${(importResult.durationMs / 1000).toFixed(1)}s`
                      : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Status</div>
                  <div className="text-lg font-semibold text-green-300">Complete</div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={resetWizard}
                className="px-6 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
              >
                Import Another File
              </button>
              {onComplete && (
                <button
                  onClick={onComplete}
                  className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
