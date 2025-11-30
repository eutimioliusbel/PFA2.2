/**
 * @file FormulaBuilder.tsx
 * @description KPI Formula Builder with autocomplete, validation, and testing
 * ADR-007 Task 5.3: Formula Builder Component
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Calculator,
  Play,
  Save,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Clock,
  TrendingUp,
  Code,
  HelpCircle
} from 'lucide-react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { kpiCalculator } from '../../services/kpiCalculator';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface KpiDefinition {
  id: string;
  name: string;
  description?: string;
  formula: string;
  formulaType: string;
  format: string;
  colorScale: boolean;
  sortOrder: number;
  executionCount: number;
  avgExecutionTime?: number;
  lastExecutedAt?: string;
}

interface FormulaBuilderProps {
  organizationId: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  variables?: string[];
  duration?: number;
}

// Helper: Validate KPI input before save
const validateKpiInput = (
  name: string,
  formula: string,
  validationResult: ValidationResult | null
): void => {
  if (!name.trim() || !formula.trim()) {
    throw new Error('Name and formula are required');
  }
  if (!validationResult?.valid) {
    throw new Error('Please fix formula errors before saving');
  }
};

// Helper: Sanitize KPI name (remove HTML tags)
const sanitizeName = (name: string): string =>
  name.replace(/<[^>]*>/g, '').trim();

// Helper: Build KPI payload for API
const buildKpiPayload = (
  name: string,
  formula: string,
  description: string,
  format: string,
  organizationId: string
) => ({
  name: sanitizeName(name),
  formula,
  description,
  format,
  organizationId
});

// Helper: Make API call to save KPI
const saveKpiToApi = async (
  url: string,
  method: string,
  payload: object,
  token: string
): Promise<void> => {
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to save KPI');
  }
};

// Custom hook: Debounced value
const useDebouncedValue = <T,>(value: T, delay: number = 300): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

const FormulaBuilder: React.FC<FormulaBuilderProps> = ({ organizationId }) => {
  const [kpis, setKpis] = useState<KpiDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [editingKpi, setEditingKpi] = useState<KpiDefinition | null>(null);
  const [newKpiName, setNewKpiName] = useState('');
  const [newKpiFormula, setNewKpiFormula] = useState('');
  const [newKpiDescription, setNewKpiDescription] = useState('');
  const [newKpiFormat, setNewKpiFormat] = useState('number');

  // Validation and testing
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; value?: number; error?: string } | null>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [_autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [showTestInputs, setShowTestInputs] = useState(false);
  const [testCost, setTestCost] = useState('1000');
  const [testMonthlyRate, setTestMonthlyRate] = useState('500');
  const [testQuantity, setTestQuantity] = useState('1');
  const [livePreview, setLivePreview] = useState<number | null>(null);
  const formulaInputRef = useRef<HTMLInputElement>(null);

  // Memoize expensive operations
  const availableFields = useMemo(() => kpiCalculator.getAvailableFields(), []);
  const exampleFormulas = useMemo(() => kpiCalculator.getExampleFormulas(), []);

  // Debounce formula for validation
  const debouncedFormula = useDebouncedValue(newKpiFormula, 150);

  // Reset form callback
  const resetForm = useCallback(() => {
    setNewKpiName('');
    setNewKpiFormula('');
    setNewKpiDescription('');
    setNewKpiFormat('number');
    setEditingKpi(null);
    setValidationResult(null);
    setTestResult(null);
  }, []);

  useEffect(() => {
    fetchKpis();
  }, [organizationId]);

  // Auto-dismiss success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [successMessage]);

  useEffect(() => {
    // Validate formula with performance measurement
    if (debouncedFormula.length > 0) {
      const startTime = performance.now();
      const result = kpiCalculator.validateFormula(debouncedFormula);
      const endTime = performance.now();
      const duration = endTime - startTime;

      setValidationResult({ ...result, duration });

      // Warn if validation exceeds 100ms threshold
      if (duration > 100) {
        console.warn(`[FormulaBuilder] Validation took ${duration.toFixed(2)}ms (>100ms threshold)`);
      }

      // Auto-compute live preview if formula is valid
      if (result.valid) {
        const sampleRecord = {
          cost: parseFloat(testCost) || 0,
          monthlyRate: parseFloat(testMonthlyRate) || 0,
          quantity: parseFloat(testQuantity) || 0,
          purchasePrice: 50000
        };
        const previewResult = kpiCalculator.testFormula(debouncedFormula, sampleRecord);
        if (previewResult.success) {
          setLivePreview(previewResult.value!);
        } else {
          setLivePreview(null);
        }
      } else {
        setLivePreview(null);
      }
    } else {
      setValidationResult(null);
      setLivePreview(null);
    }
  }, [debouncedFormula, testCost, testMonthlyRate, testQuantity]);

  const fetchKpis = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('pfa_auth_token');
      const response = await fetch(
        `${API_BASE_URL}/api/kpis?organizationId=${organizationId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch KPIs: ${response.statusText}`);
      }

      const data = await response.json();
      setKpis(data.kpis || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load KPIs';
      setError(message);
      console.error('[FormulaBuilder] fetchKpis error:', err, { organizationId });
    } finally {
      setLoading(false);
    }
  };

  const handleTestFormula = () => {
    const sampleRecord = {
      cost: parseFloat(testCost) || 0,
      monthlyRate: parseFloat(testMonthlyRate) || 0,
      quantity: parseFloat(testQuantity) || 0,
      purchasePrice: 50000
    };

    const result = kpiCalculator.testFormula(newKpiFormula, sampleRecord);
    setTestResult(result);
  };

  const handleSaveKpi = async () => {
    try {
      validateKpiInput(newKpiName, newKpiFormula, validationResult);

      const token = localStorage.getItem('pfa_auth_token');
      if (!token) throw new Error('Not authenticated');

      setSaving(true);
      setError(null);

      const method = editingKpi ? 'PUT' : 'POST';
      const url = editingKpi
        ? `${API_BASE_URL}/api/kpis/${editingKpi.id}`
        : `${API_BASE_URL}/api/kpis`;

      const payload = buildKpiPayload(
        newKpiName,
        newKpiFormula,
        newKpiDescription,
        newKpiFormat,
        organizationId
      );

      await saveKpiToApi(url, method, payload, token);

      const action = editingKpi ? 'updated' : 'created';
      setSuccessMessage(`KPI "${sanitizeName(newKpiName)}" ${action} successfully`);

      resetForm();
      await fetchKpis();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save KPI';
      setError(message);
      console.error('[FormulaBuilder] handleSaveKpi error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKpi = async (id: string) => {
    if (!confirm('Are you sure you want to delete this KPI?')) return;

    try {
      const token = localStorage.getItem('pfa_auth_token');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE_URL}/api/kpis/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete KPI: ${response.statusText}`);
      }

      await fetchKpis();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete KPI';
      setError(message);
      console.error('[FormulaBuilder] handleDeleteKpi error:', err, { id });
    }
  };

  const handleEditKpi = (kpi: KpiDefinition) => {
    setEditingKpi(kpi);
    setNewKpiName(kpi.name);
    setNewKpiFormula(kpi.formula);
    setNewKpiDescription(kpi.description || '');
    setNewKpiFormat(kpi.format);
  };

  const handleFormulaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const totalItems = availableFields.length + exampleFormulas.length;

    if (e.key === '{') {
      const rect = formulaInputRef.current?.getBoundingClientRect();
      if (rect) {
        setAutocompletePosition({ top: rect.bottom + 5, left: rect.left });
      }
      setShowAutocomplete(true);
      setSelectedIndex(0);
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false);
    } else if (showAutocomplete) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, totalItems - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        if (selectedIndex < availableFields.length) {
          insertField(availableFields[selectedIndex].name);
        } else {
          insertExample(exampleFormulas[selectedIndex - availableFields.length].formula);
        }
      }
    }
  };

  const insertField = (fieldName: string) => {
    const cursorPos = formulaInputRef.current?.selectionStart || newKpiFormula.length;
    const before = newKpiFormula.slice(0, cursorPos);
    const after = newKpiFormula.slice(cursorPos);
    setNewKpiFormula(`${before}{${fieldName}}${after}`);
    setShowAutocomplete(false);
    formulaInputRef.current?.focus();
  };

  const insertExample = (formula: string) => {
    setNewKpiFormula(formula);
    setShowAutocomplete(false);
  };

  const handleInputFocus = () => {
    if (newKpiFormula.length > 0) {
      setShowAutocomplete(true);
      const rect = formulaInputRef.current?.getBoundingClientRect();
      if (rect) {
        setAutocompletePosition({ top: rect.bottom + 5, left: rect.left });
      }
    }
  };

  const handleInputBlur = (e: React.FocusEvent) => {
    // Only close if focus moved outside autocomplete
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !relatedTarget.closest('#autocomplete-dropdown')) {
      setTimeout(() => setShowAutocomplete(false), 200);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Calculator className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-semibold text-gray-900">Formula Builder</h2>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <p className="ml-3 text-sm text-red-700">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4">
          <div className="flex">
            <Check className="w-5 h-5 text-green-400" />
            <p className="ml-3 text-sm text-green-700">{successMessage}</p>
            <button onClick={() => setSuccessMessage(null)} className="ml-auto">
              <X className="w-4 h-4 text-green-400" />
            </button>
          </div>
        </div>
      )}

      {/* Existing KPIs */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700">Custom KPIs</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {kpis.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No custom KPIs defined. Create one below.
            </div>
          ) : (
            kpis.map(kpi => (
              <div key={kpi.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                      <span className="font-medium text-gray-900">{kpi.name}</span>
                      <span className="px-2 py-0.5 text-xs bg-gray-100 rounded">
                        {kpi.format}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                      <code className="bg-gray-100 px-2 py-0.5 rounded">{kpi.formula}</code>
                      <span className="flex items-center">
                        <Play className="w-3 h-3 mr-1" />
                        {kpi.executionCount} runs
                      </span>
                      {kpi.avgExecutionTime && (
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {kpi.avgExecutionTime}ms avg
                        </span>
                      )}
                    </div>
                    {kpi.description && (
                      <p className="mt-1 text-sm text-gray-500">{kpi.description}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEditKpi(kpi)}
                      className="p-1 text-gray-400 hover:text-blue-500"
                      title="Edit"
                    >
                      <Code className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteKpi(kpi.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Form */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700">
            {editingKpi ? 'Edit KPI' : 'Create New KPI'}
          </h3>
        </div>
        <div className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="kpi-name" className="block text-sm font-medium text-gray-700 mb-1">
              KPI Name
            </label>
            <input
              id="kpi-name"
              type="text"
              value={newKpiName}
              onChange={(e) => setNewKpiName(e.target.value)}
              placeholder="e.g., Cost with Tax"
              aria-label="KPI Name"
              aria-required="true"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Formula */}
          <div className="relative">
            <label htmlFor="kpi-formula" className="block text-sm font-medium text-gray-700 mb-1">
              Formula
              <button
                onClick={() => setShowAutocomplete(!showAutocomplete)}
                className="ml-2 text-blue-500 hover:text-blue-600"
                aria-label="Show formula help"
                type="button"
              >
                <HelpCircle className="w-4 h-4 inline" />
              </button>
            </label>

            {/* Syntax highlighting background */}
            <div className="relative">
              <div className="absolute inset-0 pointer-events-none rounded-md overflow-hidden">
                <SyntaxHighlighter
                  language="javascript"
                  style={docco}
                  customStyle={{
                    margin: 0,
                    padding: '8px 12px',
                    fontSize: '14px',
                    background: 'transparent',
                    border: 'none'
                  }}
                  PreTag="div"
                >
                  {newKpiFormula || ' '}
                </SyntaxHighlighter>
              </div>
              <input
                id="kpi-formula"
                ref={formulaInputRef}
                type="text"
                value={newKpiFormula}
                onChange={(e) => setNewKpiFormula(e.target.value)}
                onKeyDown={handleFormulaKeyDown}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                placeholder="{monthlyRate} * 1.15"
                aria-label="KPI Formula"
                aria-required="true"
                aria-describedby="formula-validation formula-help"
                aria-invalid={validationResult !== null && !validationResult.valid}
                aria-autocomplete="list"
                aria-controls="autocomplete-dropdown"
                aria-expanded={showAutocomplete}
                className={`relative bg-transparent font-mono w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                  validationResult === null
                    ? 'border-gray-300 focus:ring-blue-500'
                    : validationResult.valid
                      ? 'border-green-500 focus:ring-green-500'
                      : 'border-red-500 focus:ring-red-500'
                }`}
              />
            </div>

            {/* Validation feedback */}
            {validationResult && (
              <div
                id="formula-validation"
                className={`mt-1 text-sm flex items-center justify-between ${
                  validationResult.valid ? 'text-green-600' : 'text-red-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  {validationResult.valid ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Valid formula</span>
                      {validationResult.variables && validationResult.variables.length > 0 && (
                        <>
                          <span className="text-gray-400">•</span>
                          <div className="flex gap-1 flex-wrap">
                            {validationResult.variables.map((variable) => (
                              <span
                                key={variable}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-green-100 text-green-800 border border-green-200"
                                title={`Field: ${variable}`}
                              >
                                {variable}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4 mr-1" />
                      {validationResult.error}
                    </>
                  )}
                </div>
                {validationResult.duration !== undefined && (
                  <span className="text-xs text-gray-400">
                    ({validationResult.duration.toFixed(1)}ms)
                  </span>
                )}
              </div>
            )}

            {/* Live Preview */}
            {livePreview !== null && validationResult?.valid && (
              <div className="mt-2 p-3 rounded-md bg-blue-50 border border-blue-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">Live Preview:</span>
                  <span className="font-mono font-bold text-blue-800">
                    {kpiCalculator.formatValue(livePreview, newKpiFormat)}
                  </span>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  Using test values: cost={testCost}, monthlyRate={testMonthlyRate}, quantity={testQuantity}
                </p>
              </div>
            )}

            {/* Live region for screen readers */}
            <div
              id="formula-help"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {validationResult?.valid
                ? `Formula is valid. Uses ${validationResult.variables?.length || 0} fields.`
                : validationResult?.error || ''}
            </div>

            {/* Autocomplete dropdown */}
            {showAutocomplete && (
              <div
                id="autocomplete-dropdown"
                role="listbox"
                aria-label="Formula field suggestions"
                className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200"
                style={{ maxHeight: '300px', overflowY: 'auto' }}
              >
                <div className="p-2 border-b border-gray-200">
                  <p className="text-xs text-gray-500 font-medium">AVAILABLE FIELDS</p>
                </div>
                {availableFields.map((field, index) => (
                  <button
                    key={field.name}
                    role="option"
                    aria-selected={selectedIndex === index}
                    onClick={() => insertField(field.name)}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between ${
                      selectedIndex === index ? 'bg-blue-100' : 'hover:bg-gray-100'
                    }`}
                  >
                    <span className="font-mono text-sm">{`{${field.name}}`}</span>
                    <span className="text-xs text-gray-500">{field.description}</span>
                  </button>
                ))}
                <div className="p-2 border-t border-gray-200">
                  <p className="text-xs text-gray-500 font-medium">EXAMPLES</p>
                </div>
                {exampleFormulas.map((example, index) => {
                  const exampleIndex = availableFields.length + index;
                  return (
                    <button
                      key={example.name}
                      role="option"
                      aria-selected={selectedIndex === exampleIndex}
                      onClick={() => insertExample(example.formula)}
                      className={`w-full px-3 py-2 text-left border-l-2 ${
                        selectedIndex === exampleIndex
                          ? 'bg-blue-100 border-blue-500'
                          : 'border-transparent hover:bg-blue-50 hover:border-blue-500'
                      }`}
                    >
                      <span className="text-sm font-medium">{example.name}</span>
                      <span className="block text-xs text-gray-500 font-mono">{example.formula}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="kpi-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <input
              id="kpi-description"
              type="text"
              value={newKpiDescription}
              onChange={(e) => setNewKpiDescription(e.target.value)}
              placeholder="What does this KPI measure?"
              aria-label="KPI Description"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Format */}
          <div>
            <label htmlFor="kpi-format" className="block text-sm font-medium text-gray-700 mb-1">
              Display Format
            </label>
            <select
              id="kpi-format"
              value={newKpiFormat}
              onChange={(e) => setNewKpiFormat(e.target.value)}
              aria-label="Display Format"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="number">Number</option>
              <option value="currency">Currency ($)</option>
              <option value="percent">Percentage (%)</option>
            </select>
          </div>

          {/* Test Data Inputs */}
          <div className="border-t border-gray-200 pt-4">
            <button
              onClick={() => setShowTestInputs(!showTestInputs)}
              className="flex items-center text-sm text-blue-600 hover:text-blue-700"
              type="button"
            >
              <Play className="w-4 h-4 mr-1" />
              {showTestInputs ? 'Hide' : 'Customize'} Test Values
            </button>

            {showTestInputs && (
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="test-cost" className="block text-xs font-medium text-gray-600 mb-1">
                    Cost
                  </label>
                  <input
                    id="test-cost"
                    type="number"
                    value={testCost}
                    onChange={(e) => setTestCost(e.target.value)}
                    placeholder="1000"
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="test-monthly-rate" className="block text-xs font-medium text-gray-600 mb-1">
                    Monthly Rate
                  </label>
                  <input
                    id="test-monthly-rate"
                    type="number"
                    value={testMonthlyRate}
                    onChange={(e) => setTestMonthlyRate(e.target.value)}
                    placeholder="500"
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="test-quantity" className="block text-xs font-medium text-gray-600 mb-1">
                    Quantity
                  </label>
                  <input
                    id="test-quantity"
                    type="number"
                    value={testQuantity}
                    onChange={(e) => setTestQuantity(e.target.value)}
                    placeholder="1"
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`p-3 rounded-md ${
              testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              {testResult.success ? (
                <div className="flex items-center justify-between">
                  <span className="text-green-700">Test Result:</span>
                  <span className="font-mono font-bold text-green-800">
                    {kpiCalculator.formatValue(testResult.value!, newKpiFormat)}
                  </span>
                </div>
              ) : (
                <span className="text-red-700">{testResult.error}</span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleTestFormula}
              disabled={!newKpiFormula}
              className="flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 disabled:opacity-50"
            >
              <Play className="w-4 h-4 mr-2" />
              Test Formula
            </button>
            <button
              onClick={handleSaveKpi}
              disabled={!newKpiName || !newKpiFormula || !validationResult?.valid || saving}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-busy={saving}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : editingKpi ? 'Update KPI' : 'Save KPI'}
            </button>
            {editingKpi && (
              <button
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormulaBuilder;
