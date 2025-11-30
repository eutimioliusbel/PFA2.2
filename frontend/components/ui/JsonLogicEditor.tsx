/**
 * @file JsonLogicEditor.tsx
 * @description Visual editor for JsonLogic rules with autocomplete and validation
 * ADR-007 Task 6.2: Promotion Rules Quality Gate
 */

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  AlertTriangle,
  Check,
  Info
} from 'lucide-react';
import jsonLogic from 'json-logic-js';

interface JsonLogicRule {
  [operator: string]: any;
}

interface JsonLogicEditorProps {
  value: JsonLogicRule;
  onChange: (rule: JsonLogicRule) => void;
  fields: string[];
  testData?: Record<string, any>;
}

interface Condition {
  id: string;
  field: string;
  operator: string;
  value: any;
}

// Supported operators with display names and value types
const OPERATORS = [
  { value: '==', label: 'equals', type: 'comparison' },
  { value: '!=', label: 'not equals', type: 'comparison' },
  { value: '>', label: 'greater than', type: 'comparison' },
  { value: '>=', label: 'greater or equal', type: 'comparison' },
  { value: '<', label: 'less than', type: 'comparison' },
  { value: '<=', label: 'less or equal', type: 'comparison' },
  { value: 'in', label: 'is one of', type: 'array' },
  { value: '!', label: 'is not', type: 'boolean' }
];

// Helper: Convert UI conditions to JsonLogic
const conditionsToJsonLogic = (
  conditions: Condition[],
  logicType: 'and' | 'or'
): JsonLogicRule => {
  if (conditions.length === 0) return {};
  if (conditions.length === 1) {
    const c = conditions[0];
    return { [c.operator]: [{ var: c.field }, c.value] };
  }

  const rules = conditions.map(c => ({
    [c.operator]: [{ var: c.field }, c.value]
  }));

  return { [logicType]: rules };
};

// Helper: Parse JsonLogic to UI conditions (simplified)
const jsonLogicToConditions = (rule: JsonLogicRule): {
  conditions: Condition[];
  logicType: 'and' | 'or';
} => {
  const conditions: Condition[] = [];
  let logicType: 'and' | 'or' = 'and';

  if (!rule || Object.keys(rule).length === 0) {
    return { conditions: [], logicType: 'and' };
  }

  const rootKey = Object.keys(rule)[0];

  if (rootKey === 'and' || rootKey === 'or') {
    logicType = rootKey;
    const rules = rule[rootKey] as any[];

    rules.forEach((r: any, idx: number) => {
      const op = Object.keys(r)[0];
      const args = r[op];
      if (Array.isArray(args) && args.length >= 2) {
        const field = args[0]?.var || '';
        const value = args[1];
        conditions.push({
          id: `cond-${idx}`,
          field,
          operator: op,
          value
        });
      }
    });
  } else {
    // Single condition
    const args = rule[rootKey];
    if (Array.isArray(args) && args.length >= 2) {
      const field = args[0]?.var || '';
      const value = args[1];
      conditions.push({
        id: 'cond-0',
        field,
        operator: rootKey,
        value
      });
    }
  }

  return { conditions, logicType };
};

export const JsonLogicEditor: React.FC<JsonLogicEditorProps> = ({
  value,
  onChange,
  fields,
  testData
}) => {
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [logicType, setLogicType] = useState<'and' | 'or'>('and');
  const [testResult, setTestResult] = useState<boolean | null>(null);

  // Initialize from value
  useEffect(() => {
    const parsed = jsonLogicToConditions(value);
    setConditions(parsed.conditions);
    setLogicType(parsed.logicType);
  }, [value]);

  // Update parent when conditions change
  const updateRule = (newConditions: Condition[], newLogicType: 'and' | 'or') => {
    setConditions(newConditions);
    setLogicType(newLogicType);
    const rule = conditionsToJsonLogic(newConditions, newLogicType);
    onChange(rule);
  };

  const addCondition = () => {
    const newCondition: Condition = {
      id: `cond-${Date.now()}`,
      field: fields[0] || '',
      operator: '>',
      value: 0
    };
    updateRule([...conditions, newCondition], logicType);
  };

  const removeCondition = (id: string) => {
    updateRule(conditions.filter(c => c.id !== id), logicType);
  };

  const updateCondition = (id: string, updates: Partial<Condition>) => {
    updateRule(
      conditions.map(c => c.id === id ? { ...c, ...updates } : c),
      logicType
    );
  };

  const toggleLogicType = () => {
    const newType = logicType === 'and' ? 'or' : 'and';
    updateRule(conditions, newType);
  };

  // Test rule against test data using json-logic-js
  const testRule = () => {
    if (!testData || conditions.length === 0) {
      setTestResult(null);
      return;
    }

    try {
      const rule = conditionsToJsonLogic(conditions, logicType);
      const result = jsonLogic.apply(rule, testData);
      setTestResult(!!result);
    } catch (error) {
      console.error('JsonLogic evaluation error:', error);
      setTestResult(null);
    }
  };

  useEffect(() => {
    if (testData) {
      testRule();
    }
  }, [conditions, logicType, testData]);

  return (
    <div className="space-y-4">
      {/* Logic Type Toggle */}
      {conditions.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Match</span>
          <button
            onClick={toggleLogicType}
            className="px-3 py-1 text-sm font-medium rounded border border-slate-600 bg-slate-700 text-slate-100 hover:bg-slate-600"
          >
            {logicType === 'and' ? 'ALL' : 'ANY'}
          </button>
          <span className="text-sm text-slate-400">of the following conditions:</span>
        </div>
      )}

      {/* Conditions */}
      <div className="space-y-2">
        {conditions.length === 0 ? (
          <div className="p-6 border-2 border-dashed border-slate-600 rounded-lg text-center bg-slate-800/50">
            <Info className="mx-auto h-8 w-8 text-slate-500 mb-2" />
            <p className="text-sm text-slate-400">
              No rules defined. Click "Add Condition" to create a quality gate.
            </p>
          </div>
        ) : (
          conditions.map((condition, _idx) => (
            <div
              key={condition.id}
              className="flex items-center gap-2 p-3 bg-slate-700/50 rounded-lg border border-slate-600"
            >
              {/* Field */}
              <select
                value={condition.field}
                onChange={(e) => updateCondition(condition.id, { field: e.target.value })}
                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {fields.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>

              {/* Operator */}
              <select
                value={condition.operator}
                onChange={(e) => updateCondition(condition.id, { operator: e.target.value })}
                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {OPERATORS.map(op => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>

              {/* Value */}
              {condition.operator === 'in' ? (
                <input
                  type="text"
                  value={Array.isArray(condition.value) ? condition.value.join(', ') : ''}
                  onChange={(e) => {
                    const arr = e.target.value.split(',').map(v => v.trim());
                    updateCondition(condition.id, { value: arr });
                  }}
                  placeholder="value1, value2, ..."
                  className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              ) : (
                <input
                  type={typeof condition.value === 'number' ? 'number' : 'text'}
                  value={condition.value}
                  onChange={(e) => {
                    const val = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
                    updateCondition(condition.id, { value: val });
                  }}
                  className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              )}

              {/* Delete */}
              <button
                onClick={() => removeCondition(condition.id)}
                className="p-2 text-red-400 hover:bg-red-500/20 rounded"
                title="Remove condition"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add Condition Button */}
      <button
        onClick={addCondition}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-400 border border-blue-500/50 rounded hover:bg-blue-500/10"
      >
        <Plus className="h-4 w-4" />
        Add Condition
      </button>

      {/* Test Result */}
      {testData && (
        <div className={`p-3 rounded-lg border ${
          testResult === true
            ? 'bg-green-500/10 border-green-500/30'
            : testResult === false
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-slate-700/50 border-slate-600'
        }`}>
          <div className="flex items-center gap-2">
            {testResult === true ? (
              <>
                <Check className="h-5 w-5 text-green-400" />
                <span className="text-sm font-medium text-green-300">
                  Test data passes this rule
                </span>
              </>
            ) : testResult === false ? (
              <>
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <span className="text-sm font-medium text-red-300">
                  Test data does not pass this rule
                </span>
              </>
            ) : (
              <>
                <Info className="h-5 w-5 text-slate-400" />
                <span className="text-sm text-slate-400">
                  No test data provided
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
