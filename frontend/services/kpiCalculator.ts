/**
 * Frontend KPI Calculator - ADR-007
 *
 * Client-side KPI evaluation for real-time sandbox calculations.
 * Uses mathjs-based formula evaluation IDENTICAL to backend.
 *
 * HYBRID APPROACH:
 * - Frontend: Real-time preview on draft/sandbox data (immediate feedback)
 * - Backend: Authoritative calculation with audit trail and AI hooks
 *
 * CRITICAL: This MUST use the same mathjs evaluation logic as backend
 * to ensure formula results are identical.
 *
 * @see ADR-007-AGENT_WORKFLOW.md Task 4.2
 * @see backend/src/services/kpi/KpiCalculator.ts
 */

import { create, all, MathJsInstance, ConfigOptions } from 'mathjs';

/**
 * Result of KPI calculation
 */
export interface KpiCalcResult {
  success: boolean;
  value: number | null;
  recordCount: number;
  error?: string;
}

/**
 * Formula validation result
 */
export interface FormulaValidation {
  valid: boolean;
  error?: string;
  variables?: string[];
}

/**
 * Available field for autocomplete
 */
export interface KpiField {
  name: string;
  description: string;
  type: string;
}

/**
 * Example formula for Formula Builder
 */
export interface ExampleFormula {
  name: string;
  formula: string;
  description: string;
}

// ⚠️ CRITICAL: Same mathjs configuration as backend
const mathConfig: ConfigOptions = {
  epsilon: 1e-12,
  number: 'number',
  precision: 64,
};

const math: MathJsInstance = create(all, mathConfig);

// ⚠️ SECURITY NOTE: mathjs sandboxing approach
// We do NOT disable evaluate/parse functions because they are interdependent.
// Instead, security is enforced via:
//
// 1. **Scope Control**: Only numeric values are passed in the evaluation scope
// 2. **Formula Validation**: Forbidden patterns are blocked (require, import, eval, etc.)
// 3. **Input Sanitization**: All record values are converted to numbers
// 4. **No Dynamic Functions**: Users cannot create new functions or access globals
//
// This is the SAME approach as the backend KpiCalculator service.
// The mathjs library is already sandboxed by design - it doesn't have access
// to Node.js/Browser APIs unless explicitly provided in the scope.

/**
 * Frontend KPI Calculator
 * Lightweight client-side formula evaluation for sandbox mode
 *
 * IMPORTANT: Uses EXACT same evaluation logic as backend KpiCalculator
 */
export class FrontendKpiCalculator {
  private math: MathJsInstance;

  constructor() {
    this.math = math;
  }

  /**
   * Calculate KPI on sandbox/draft records
   * Returns aggregate sum of formula applied to all records
   *
   * @param formula - KPI formula (e.g., "{monthlyRate} * 1.15")
   * @param records - Array of PfaRecord (or sandbox records)
   * @returns KpiCalcResult
   */
  calculate(formula: string, records: Array<Record<string, unknown>>): KpiCalcResult {
    try {
      const validation = this.validateFormula(formula);
      if (!validation.valid) {
        return {
          success: false,
          value: null,
          recordCount: 0,
          error: validation.error
        };
      }

      let total = 0;
      let errorCount = 0;

      for (const record of records) {
        try {
          const value = this.evaluateFormula(formula, record);
          if (!isNaN(value) && isFinite(value)) {
            total += value;
          }
        } catch {
          errorCount++;
        }
      }

      return {
        success: true,
        value: total,
        recordCount: records.length - errorCount
      };

    } catch (error) {
      return {
        success: false,
        value: null,
        recordCount: 0,
        error: error instanceof Error ? error.message : 'Calculation failed'
      };
    }
  }

  /**
   * Evaluate formula for a single record
   * ⚠️ CRITICAL: EXACT SAME LOGIC AS BACKEND
   *
   * @param formula - Formula string (e.g., "{cost} * 1.15")
   * @param record - Record object
   * @returns Calculated value
   */
  evaluateFormula(formula: string, record: Record<string, unknown>): number {
    // Extract placeholders like {fieldName}
    const placeholderRegex = /\{(\w+)\}/g;
    const placeholders = formula.match(placeholderRegex) || [];

    // Build scope with field values
    const scope: Record<string, number> = {};

    for (const placeholder of placeholders) {
      const fieldName = placeholder.slice(1, -1); // Remove { }
      const rawValue = record[fieldName];

      // Convert to number, default to 0 if null/undefined
      let numValue = 0;
      if (rawValue !== null && rawValue !== undefined) {
        numValue = Number(rawValue);
        if (isNaN(numValue)) {
          numValue = 0;
        }
      }

      scope[fieldName] = numValue;
    }

    // Replace placeholders with variable names for mathjs
    let mathExpression = formula;
    for (const placeholder of placeholders) {
      const fieldName = placeholder.slice(1, -1);
      mathExpression = mathExpression.replace(placeholder, fieldName);
    }

    // Evaluate with sandboxed mathjs (SAME AS BACKEND)
    try {
      const result = this.math.evaluate(mathExpression, scope);
      return Number(result);
    } catch (error) {
      throw new Error(`Formula evaluation failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * Validate formula syntax
   * Returns validation result with extracted variables
   *
   * @param formula - Formula string to validate
   * @returns FormulaValidation
   */
  validateFormula(formula: string): FormulaValidation {
    try {
      // Check for empty formula
      if (!formula || formula.trim().length === 0) {
        return { valid: false, error: 'Formula cannot be empty' };
      }

      // Check for forbidden patterns (security) - SAME AS BACKEND
      const forbiddenPatterns = [
        /require\s*\(/,
        /import\s+/,
        /process\./,
        /global\./,
        /eval\s*\(/,
        /Function\s*\(/,
        /\bexec\b/,
        /\bspawn\b/,
        /\bfork\b/,
        /child_process/,
        /fs\./,
        /path\./,
        /http\./,
        /https\./,
        /net\./,
        // Frontend-specific patterns
        /document\./,
        /window\./,
        /fetch\s*\(/,
        /XMLHttpRequest/,
        /localStorage/,
        /sessionStorage/,
        /cookie/,
      ];

      for (const pattern of forbiddenPatterns) {
        if (pattern.test(formula)) {
          return {
            valid: false,
            error: 'Formula contains forbidden patterns'
          };
        }
      }

      // Extract variable names
      const placeholderRegex = /\{(\w+)\}/g;
      const matches = formula.match(placeholderRegex) || [];
      const variables = matches.map(m => m.slice(1, -1));

      // Test evaluation with dummy data
      const testRecord: Record<string, number> = {};
      for (const variable of variables) {
        testRecord[variable] = 100;
      }

      this.evaluateFormula(formula, testRecord);

      return {
        valid: true,
        variables
      };

    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      };
    }
  }

  /**
   * Test formula with sample record
   * Returns calculated value for preview
   *
   * @param formula - Formula string
   * @param sampleRecord - Sample record
   * @returns Test result
   */
  testFormula(
    formula: string,
    sampleRecord?: Record<string, unknown>
  ): { success: boolean; value?: number; error?: string } {
    const validation = this.validateFormula(formula);

    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const testRecord = sampleRecord || {
      monthlyRate: 1000,
      purchasePrice: 50000,
      cost: 1000,
      quantity: 1
    };

    try {
      const value = this.evaluateFormula(formula, testRecord);
      return { success: true, value };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Test failed'
      };
    }
  }

  /**
   * Get available fields for formula builder autocomplete
   */
  getAvailableFields(): KpiField[] {
    return [
      { name: 'monthlyRate', description: 'Monthly rental rate', type: 'number' },
      { name: 'purchasePrice', description: 'Purchase price', type: 'number' },
      { name: 'forecastStart', description: 'Forecast start date (timestamp)', type: 'date' },
      { name: 'forecastEnd', description: 'Forecast end date (timestamp)', type: 'date' },
      { name: 'originalStart', description: 'Original start date (timestamp)', type: 'date' },
      { name: 'originalEnd', description: 'Original end date (timestamp)', type: 'date' },
      { name: 'actualStart', description: 'Actual start date (timestamp)', type: 'date' },
      { name: 'actualEnd', description: 'Actual end date (timestamp)', type: 'date' },
    ];
  }

  /**
   * Get example formulas for Formula Builder
   */
  getExampleFormulas(): ExampleFormula[] {
    return [
      {
        name: 'Cost with Tax',
        formula: '{monthlyRate} * 1.15',
        description: 'Adds 15% tax to monthly rate'
      },
      {
        name: 'Annual Cost',
        formula: '{monthlyRate} * 12',
        description: 'Calculate annual cost from monthly rate'
      },
      {
        name: 'Daily Rate',
        formula: '{monthlyRate} / 30.44',
        description: 'Convert monthly rate to daily rate'
      },
      {
        name: 'Total Value',
        formula: '{purchasePrice} + ({monthlyRate} * 12)',
        description: 'Purchase price plus one year of rental'
      },
      {
        name: 'Rental vs Purchase',
        formula: '{monthlyRate} * 36 - {purchasePrice}',
        description: '3-year rental cost minus purchase price'
      }
    ];
  }

  /**
   * Format KPI value for display
   *
   * @param value - Raw value
   * @param format - Format type ('number', 'currency', 'percent')
   * @returns Formatted string
   */
  formatValue(value: number, format: string = 'number'): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '-';
    }

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(value);

      case 'percent':
        return new Intl.NumberFormat('en-US', {
          style: 'percent',
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        }).format(value / 100);

      case 'number':
      default:
        return new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }).format(value);
    }
  }
}

// Singleton export for easy use
export const kpiCalculator = new FrontendKpiCalculator();
