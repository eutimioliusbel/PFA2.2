/**
 * Unit Tests for Frontend KPI Calculator - ADR-007 Task 4.2
 *
 * Verifies that frontend KPI calculations produce IDENTICAL results to backend.
 *
 * CRITICAL: These tests verify formula parity between:
 * - services/kpiCalculator.ts (Frontend)
 * - backend/src/services/kpi/KpiCalculator.ts (Backend)
 *
 * @see ADR-007-AGENT_WORKFLOW.md Task 4.2
 */

import { describe, it, expect } from 'vitest';
import { FrontendKpiCalculator, kpiCalculator } from '../../services/kpiCalculator';

describe('FrontendKpiCalculator', () => {
  describe('Formula Evaluation - Parity with Backend', () => {
    const calculator = new FrontendKpiCalculator();

    it('should calculate simple addition formula', () => {
      const record = { monthlyRate: 1000, purchasePrice: 50000 };
      const result = calculator.evaluateFormula('{monthlyRate} + {purchasePrice}', record);
      expect(result).toBe(51000);
    });

    it('should calculate multiplication formula', () => {
      const record = { monthlyRate: 1000 };
      const result = calculator.evaluateFormula('{monthlyRate} * 1.15', record);
      expect(result).toBeCloseTo(1150, 2);
    });

    it('should calculate division formula', () => {
      const record = { monthlyRate: 1000 };
      const result = calculator.evaluateFormula('{monthlyRate} / 30.44', record);
      expect(result).toBeCloseTo(32.85, 2);
    });

    it('should calculate complex formula with parentheses', () => {
      const record = { monthlyRate: 1000, purchasePrice: 50000 };
      const result = calculator.evaluateFormula('{purchasePrice} + ({monthlyRate} * 12)', record);
      expect(result).toBe(62000);
    });

    it('should calculate rental vs purchase formula', () => {
      const record = { monthlyRate: 1000, purchasePrice: 30000 };
      const result = calculator.evaluateFormula('{monthlyRate} * 36 - {purchasePrice}', record);
      expect(result).toBe(6000); // 36000 - 30000
    });

    it('should handle missing fields as 0', () => {
      const record = { monthlyRate: 1000 };
      const result = calculator.evaluateFormula('{monthlyRate} + {missingField}', record);
      expect(result).toBe(1000);
    });

    it('should handle null values as 0', () => {
      const record = { monthlyRate: 1000, purchasePrice: null };
      const result = calculator.evaluateFormula('{monthlyRate} + {purchasePrice}', record);
      expect(result).toBe(1000);
    });

    it('should handle string numbers correctly', () => {
      const record = { monthlyRate: '1000', purchasePrice: '50000' };
      const result = calculator.evaluateFormula('{monthlyRate} + {purchasePrice}', record);
      expect(result).toBe(51000);
    });

    it('should throw error for invalid formula syntax', () => {
      const record = { monthlyRate: 1000 };
      expect(() => {
        calculator.evaluateFormula('{monthlyRate} ++ {invalid}', record);
      }).toThrow();
    });
  });

  describe('Aggregate Calculation', () => {
    const calculator = new FrontendKpiCalculator();

    it('should aggregate sum across multiple records', () => {
      const records = [
        { monthlyRate: 1000 },
        { monthlyRate: 2000 },
        { monthlyRate: 1500 }
      ];

      const result = calculator.calculate('{monthlyRate} * 12', records);

      expect(result.success).toBe(true);
      expect(result.value).toBe(54000); // (1000 + 2000 + 1500) * 12 = 54000
      expect(result.recordCount).toBe(3);
    });

    it('should handle partial record failures gracefully', () => {
      const records = [
        { monthlyRate: 1000 },
        { monthlyRate: 'invalid' },
        { monthlyRate: 2000 }
      ];

      const result = calculator.calculate('{monthlyRate} * 12', records);

      expect(result.success).toBe(true);
      expect(result.value).toBeCloseTo(36000, 2); // Only valid records: (1000 + 2000) * 12
      expect(result.recordCount).toBe(2); // 2 valid records
    });

    it('should return error for invalid formula', () => {
      const records = [{ monthlyRate: 1000 }];
      const result = calculator.calculate('invalid formula', records);

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('should handle empty record array', () => {
      const result = calculator.calculate('{monthlyRate} * 12', []);

      expect(result.success).toBe(true);
      expect(result.value).toBe(0);
      expect(result.recordCount).toBe(0);
    });
  });

  describe('Formula Validation', () => {
    const calculator = new FrontendKpiCalculator();

    it('should validate correct formula', () => {
      const validation = calculator.validateFormula('{monthlyRate} * 1.15');

      expect(validation.valid).toBe(true);
      expect(validation.variables).toEqual(['monthlyRate']);
    });

    it('should validate formula with multiple variables', () => {
      const validation = calculator.validateFormula('{monthlyRate} + {purchasePrice}');

      expect(validation.valid).toBe(true);
      expect(validation.variables).toEqual(['monthlyRate', 'purchasePrice']);
    });

    it('should reject empty formula', () => {
      const validation = calculator.validateFormula('');

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('empty');
    });

    it('should reject formula with forbidden patterns', () => {
      const forbiddenFormulas = [
        'require("fs")',
        'import("evil")',
        'process.exit()',
        'eval("code")',
        'Function("code")',
        'document.cookie',
        'window.fetch()',
        'localStorage.getItem()',
      ];

      for (const formula of forbiddenFormulas) {
        const validation = calculator.validateFormula(formula);
        expect(validation.valid).toBe(false);
        expect(validation.error).toContain('forbidden');
      }
    });
  });

  describe('Test Formula with Sample Data', () => {
    const calculator = new FrontendKpiCalculator();

    it('should test formula with default sample data', () => {
      const test = calculator.testFormula('{monthlyRate} * 1.15');

      expect(test.success).toBe(true);
      expect(test.value).toBeCloseTo(1150, 2); // Default monthlyRate is 1000
    });

    it('should test formula with custom sample data', () => {
      const sampleRecord = { monthlyRate: 5000 };
      const test = calculator.testFormula('{monthlyRate} * 1.15', sampleRecord);

      expect(test.success).toBe(true);
      expect(test.value).toBeCloseTo(5750, 2);
    });

    it('should return error for invalid formula in test', () => {
      const test = calculator.testFormula('invalid formula');

      expect(test.success).toBe(false);
      expect(test.error).toBeDefined();
    });
  });

  describe('Format Value', () => {
    const calculator = new FrontendKpiCalculator();

    it('should format as currency', () => {
      const formatted = calculator.formatValue(123456, 'currency');
      expect(formatted).toBe('$123,456');
    });

    it('should format as number', () => {
      const formatted = calculator.formatValue(1234.567, 'number');
      expect(formatted).toBe('1,234.57');
    });

    it('should format as percent', () => {
      const formatted = calculator.formatValue(75.5, 'percent');
      expect(formatted).toBe('75.5%');
    });

    it('should handle null values', () => {
      const formatted = calculator.formatValue(null as any, 'currency');
      expect(formatted).toBe('-');
    });

    it('should handle NaN values', () => {
      const formatted = calculator.formatValue(NaN, 'currency');
      expect(formatted).toBe('-');
    });
  });

  describe('Available Fields', () => {
    const calculator = new FrontendKpiCalculator();

    it('should return available fields list', () => {
      const fields = calculator.getAvailableFields();

      expect(fields).toContainEqual({
        name: 'monthlyRate',
        description: 'Monthly rental rate',
        type: 'number'
      });

      expect(fields).toContainEqual({
        name: 'purchasePrice',
        description: 'Purchase price',
        type: 'number'
      });

      expect(fields.length).toBeGreaterThan(0);
    });
  });

  describe('Example Formulas', () => {
    const calculator = new FrontendKpiCalculator();

    it('should return example formulas', () => {
      const examples = calculator.getExampleFormulas();

      expect(examples).toContainEqual({
        name: 'Cost with Tax',
        formula: '{monthlyRate} * 1.15',
        description: 'Adds 15% tax to monthly rate'
      });

      expect(examples.length).toBeGreaterThan(0);
    });

    it('should validate all example formulas', () => {
      const examples = calculator.getExampleFormulas();

      for (const example of examples) {
        const validation = calculator.validateFormula(example.formula);
        expect(validation.valid).toBe(true);
      }
    });
  });

  describe('Singleton Instance', () => {
    it('should provide singleton instance', () => {
      expect(kpiCalculator).toBeInstanceOf(FrontendKpiCalculator);
    });

    it('should calculate using singleton', () => {
      const records = [{ monthlyRate: 1000 }];
      const result = kpiCalculator.calculate('{monthlyRate} * 12', records);

      expect(result.success).toBe(true);
      expect(result.value).toBe(12000);
    });
  });

  describe('Parity Tests - Backend Compatibility', () => {
    const calculator = new FrontendKpiCalculator();

    /**
     * CRITICAL: These tests verify that frontend produces EXACT same results as backend
     * by using the same test cases from backend/tests/unit/KpiCalculator.test.ts
     */

    it('should match backend calculation for simple multiplication', () => {
      const record = { monthlyRate: 1000 };
      const result = calculator.evaluateFormula('{monthlyRate} * 1.15', record);

      // Backend result: 1150
      expect(result).toBeCloseTo(1150, 2);
    });

    it('should match backend calculation for annual cost', () => {
      const record = { monthlyRate: 1000 };
      const result = calculator.evaluateFormula('{monthlyRate} * 12', record);

      // Backend result: 12000
      expect(result).toBe(12000);
    });

    it('should match backend calculation for daily rate', () => {
      const record = { monthlyRate: 1000 };
      const result = calculator.evaluateFormula('{monthlyRate} / 30.44', record);

      // Backend result: 32.85...
      expect(result).toBeCloseTo(32.85, 2);
    });

    it('should match backend calculation for total value', () => {
      const record = { monthlyRate: 1000, purchasePrice: 50000 };
      const result = calculator.evaluateFormula('{purchasePrice} + ({monthlyRate} * 12)', record);

      // Backend result: 62000
      expect(result).toBe(62000);
    });

    it('should match backend calculation for rental vs purchase', () => {
      const record = { monthlyRate: 1000, purchasePrice: 30000 };
      const result = calculator.evaluateFormula('{monthlyRate} * 36 - {purchasePrice}', record);

      // Backend result: 6000
      expect(result).toBe(6000);
    });

    it('should match backend handling of null values', () => {
      const record = { monthlyRate: 1000, purchasePrice: null };
      const result = calculator.evaluateFormula('{monthlyRate} + {purchasePrice}', record);

      // Backend result: 1000 (null treated as 0)
      expect(result).toBe(1000);
    });

    it('should match backend handling of missing fields', () => {
      const record = { monthlyRate: 1000 };
      const result = calculator.evaluateFormula('{monthlyRate} + {nonExistent}', record);

      // Backend result: 1000 (missing treated as 0)
      expect(result).toBe(1000);
    });
  });
});
