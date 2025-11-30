/**
 * @file PromotionRulesEditor.tsx
 * @description Quality gate configuration for Bronze → Silver promotion
 * ADR-007 Task 6.2: Promotion Rules UI
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Save,
  AlertTriangle,
  Info,
  Loader2,
  CheckCircle,
  XCircle,
  Code
} from 'lucide-react';
import { JsonLogicEditor } from '../ui/JsonLogicEditor';
import jsonLogic from 'json-logic-js';

interface ApiEndpoint {
  id: string;
  name: string;
  entity: string;
  promotionRules?: any;
}

interface PromotionRulesEditorProps {
  endpoint: ApiEndpoint;
  onSave: (endpoint: ApiEndpoint) => Promise<void>;
  onClose?: () => void;
}

interface TestRecord {
  [key: string]: any;
}

// Common field types for Bronze records
const BRONZE_FIELDS = [
  'cost',
  'category',
  'status',
  'quantity',
  'manufacturer',
  'model',
  'areaSilo',
  'source',
  'dor',
  'isDiscontinued',
  'forecastStart',
  'forecastEnd'
];

// Sample test records for different scenarios
const SAMPLE_TEST_RECORDS: Record<string, TestRecord> = {
  valid: {
    cost: 1500,
    category: 'Rental',
    status: 'ACTIVE',
    quantity: 1,
    manufacturer: 'Caterpillar',
    source: 'Rental',
    isDiscontinued: false
  },
  zeroCost: {
    cost: 0,
    category: 'Rental',
    status: 'ACTIVE',
    quantity: 1,
    manufacturer: 'Caterpillar',
    source: 'Rental',
    isDiscontinued: false
  },
  discontinued: {
    cost: 2000,
    category: 'Rental',
    status: 'DISCONTINUED',
    quantity: 1,
    manufacturer: 'Caterpillar',
    source: 'Rental',
    isDiscontinued: true
  }
};

export const PromotionRulesEditor: React.FC<PromotionRulesEditorProps> = ({
  endpoint,
  onSave,
  onClose
}) => {
  const [rules, setRules] = useState<any>({});
  const [testRecord, setTestRecord] = useState<TestRecord>(SAMPLE_TEST_RECORDS.valid);
  const [selectedSample, setSelectedSample] = useState<string>('valid');
  const [saving, setSaving] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Initialize rules from endpoint
  useEffect(() => {
    if (endpoint?.promotionRules) {
      // Handle both array format (default "[]") and object format
      const parsedRules = Array.isArray(endpoint.promotionRules)
        ? {}
        : endpoint.promotionRules;
      setRules(parsedRules);
    }
  }, [endpoint]);

  // Update test record when sample changes
  useEffect(() => {
    setTestRecord(SAMPLE_TEST_RECORDS[selectedSample]);
  }, [selectedSample]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      const updatedEndpoint = {
        ...endpoint,
        promotionRules: rules
      };
      await onSave(updatedEndpoint);
      if (onClose) onClose();
    } catch (error: any) {
      setSaveError(error.message || 'Failed to save promotion rules');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setRules({});
    setSaveError(null);
  };

  // Compute whether test record passes using json-logic-js
  const testRecordPasses = () => {
    if (!rules || Object.keys(rules).length === 0) return true; // No rules = all pass

    try {
      const result = jsonLogic.apply(rules, testRecord);
      return !!result;
    } catch (error) {
      console.error('JsonLogic evaluation error:', error);
      return false;
    }
  };

  const passes = testRecordPasses();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Shield className="h-6 w-6 text-blue-400 mt-1" />
        <div>
          <h2 className="text-xl font-semibold text-slate-100">
            Promotion Rules (Quality Gate)
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Define rules to control which Bronze records get promoted to Silver.
            Only records matching these conditions will be processed.
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="h-5 w-5 text-blue-400 mt-0.5" />
          <div className="text-sm text-blue-200">
            <p className="font-medium">Endpoint: {endpoint.name}</p>
            <p className="text-blue-300 mt-1">
              Entity: <span className="font-mono">{endpoint.entity}</span>
            </p>
            <p className="text-blue-300 mt-1">
              Rules are evaluated when Bronze data is ingested. Records that don't pass
              are flagged but retained for audit purposes.
            </p>
          </div>
        </div>
      </div>

      {/* Rule Editor */}
      <div className="bg-slate-800 border border-slate-600 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-100 mb-3">
          Quality Gate Conditions
        </h3>
        <JsonLogicEditor
          value={rules}
          onChange={setRules}
          fields={BRONZE_FIELDS}
          testData={testRecord}
        />
      </div>

      {/* Test Panel */}
      <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-100 mb-3">
          Test with Sample Data
        </h3>

        {/* Sample Selector */}
        <div className="flex items-center gap-2 mb-3">
          <label className="text-sm text-slate-300">Sample:</label>
          <select
            value={selectedSample}
            onChange={(e) => setSelectedSample(e.target.value)}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="valid">Valid Record (cost &gt; 0)</option>
            <option value="zeroCost">Zero Cost Record</option>
            <option value="discontinued">Discontinued Record</option>
          </select>
        </div>

        {/* Test Record Display */}
        <div className="bg-slate-900 border border-slate-700 rounded p-3 mb-3">
          <pre className="text-xs text-slate-300 font-mono overflow-x-auto">
            {JSON.stringify(testRecord, null, 2)}
          </pre>
        </div>

        {/* Test Result */}
        <div className={`flex items-center gap-2 p-3 rounded-lg border ${
          passes
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          {passes ? (
            <>
              <CheckCircle className="h-5 w-5 text-green-400" />
              <div>
                <p className="text-sm font-medium text-green-300">
                  ✓ Record will be promoted to Silver
                </p>
                <p className="text-xs text-green-400 mt-1">
                  This record passes all quality gate conditions
                </p>
              </div>
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5 text-red-400" />
              <div>
                <p className="text-sm font-medium text-red-300">
                  ✗ Record will be rejected
                </p>
                <p className="text-xs text-red-400 mt-1">
                  This record does not meet quality gate requirements
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Raw JSON View */}
      <div>
        <button
          onClick={() => setShowRawJson(!showRawJson)}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
        >
          <Code className="h-4 w-4" />
          {showRawJson ? 'Hide' : 'Show'} Raw JSON
        </button>
        {showRawJson && (
          <div className="mt-2 bg-slate-900 border border-slate-700 text-emerald-400 p-4 rounded font-mono text-xs overflow-x-auto">
            <pre>{JSON.stringify(rules, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* Error Message */}
      {saveError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <p className="text-sm text-red-300">{saveError}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-700">
        <button
          onClick={handleReset}
          className="px-4 py-2 text-sm font-medium text-slate-300 border border-slate-600 rounded hover:bg-slate-700 hover:text-slate-100"
          disabled={saving}
        >
          Reset Rules
        </button>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 border border-slate-600 rounded hover:bg-slate-700 hover:text-slate-100"
              disabled={saving}
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-slate-600 disabled:text-slate-400"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Promotion Rules
              </>
            )}
          </button>
        </div>
      </div>

      {/* Example Rules */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="h-5 w-5 text-amber-400 mt-0.5" />
          <div className="text-sm text-amber-200">
            <p className="font-medium mb-2">Example Rules:</p>
            <ul className="space-y-1 text-xs text-amber-300">
              <li>• Only promote records with cost &gt; 0</li>
              <li>• Only promote active records (status = "ACTIVE")</li>
              <li>• Exclude discontinued items (isDiscontinued = false)</li>
              <li>• Only promote rentals (source = "Rental")</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
