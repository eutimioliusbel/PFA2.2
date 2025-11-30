/**
 * KPI Calculator Service - ADR-007
 *
 * Evaluates user-defined KPI formulas using mathjs with sandboxing
 * for security. Supports formula validation, execution logging,
 * and performance tracking.
 *
 * CRITICAL SECURITY: mathjs is sandboxed to prevent code injection.
 * Dangerous functions (require, import, eval) are disabled.
 *
 * @see ADR-007-AGENT_WORKFLOW.md Task 4.1
 */

import { create, all, MathJsInstance, ConfigOptions } from 'mathjs';
import prisma from '../../config/database';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Result of KPI calculation
 */
export interface KpiCalculationResult {
  success: boolean;
  value: number | null;
  kpiId: string;
  kpiName: string;
  inputRecordCount: number;
  executionTime: number;
  error?: string;
}

/**
 * Formula validation result
 */
export interface FormulaValidationResult {
  valid: boolean;
  error?: string;
  parsedVariables?: string[];
}


// Create sandboxed mathjs instance
// CRITICAL: Disable dangerous functions to prevent code injection
const mathConfig: ConfigOptions = {
  epsilon: 1e-12,
  number: 'number',
  precision: 64,
};

const math: MathJsInstance = create(all, mathConfig);

// Create limited (sandboxed) scope
// Remove dangerous functions that could allow code execution
const dangerousFunctions = [
  'import',
  'createUnit',
  'evaluate',
  'parse',
  'simplify',
  'derivative',
  'compile',
  'help',
  'parser',
  'chain',
];

// Attempt to disable dangerous functions
dangerousFunctions.forEach((fn) => {
  try {
    if ((math as unknown as Record<string, unknown>)[fn]) {
      (math as unknown as Record<string, unknown>)[fn] = undefined;
    }
  } catch {
    // Some functions may be read-only
  }
});

export class KpiCalculator {
  private math: MathJsInstance;

  constructor() {
    this.math = math;
  }

  /**
   * Calculate KPI for an organization
   * Fetches all records and applies formula to each, then aggregates
   *
   * @param kpiId - KpiDefinition ID
   * @param organizationId - Organization to calculate for
   * @param userId - User performing calculation (for audit)
   * @returns KpiCalculationResult
   */
  async calculate(
    kpiId: string,
    organizationId: string,
    userId: string = 'system'
  ): Promise<KpiCalculationResult> {
    const startTime = Date.now();

    try {
      // 1. Load KPI Definition
      const kpi = await prisma.kpi_definitions.findUnique({
        where: { id: kpiId }
      });

      if (!kpi) {
        throw new Error(`KPI not found: ${kpiId}`);
      }

      if (kpi.organizationId !== organizationId) {
        throw new Error('Access denied: KPI belongs to different organization');
      }

      if (!kpi.isActive) {
        throw new Error('KPI is inactive');
      }

      // 2. Fetch Silver Records
      const records = await prisma.pfa_records.findMany({
        where: {
          organizationId,
          isDiscontinued: false
        }
      });

      // 3. Evaluate Formula for Each Record
      const results: number[] = [];
      const errors: string[] = [];

      for (const record of records) {
        try {
          const value = this.evaluateFormula(kpi.formula, record);
          if (!isNaN(value) && isFinite(value)) {
            results.push(value);
          }
        } catch (error) {
          errors.push(`Record ${record.id}: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }

      // 4. Aggregate Results (Sum)
      const total = results.reduce((sum, val) => sum + val, 0);

      // 5. Log Execution (AI Hook)
      const executionTime = Date.now() - startTime;

      await prisma.kpi_execution_logs.create({
        data: {
          id: uuidv4(),
          kpiId: kpi.id,
          userId,
          organizationId,
          inputRecordCount: records.length,
          inputSample: records.slice(0, 10).map((r: any) => ({
            id: r.id,
            pfaId: r.pfaId,
            monthlyRate: r.monthlyRate,
            purchasePrice: r.purchasePrice,
            category: r.category
          })),
          outputValue: total,
          executionTime
        }
      });

      // 6. Update KPI Stats
      await prisma.kpi_definitions.update({
        where: { id: kpi.id },
        data: {
          executionCount: { increment: 1 },
          avgExecutionTime: executionTime,
          lastExecutedAt: new Date()
        }
      });

      logger.info(`[KPI] Calculated ${kpi.name}`, {
        kpiId,
        organizationId,
        value: total,
        recordCount: records.length,
        executionTime
      });

      return {
        success: true,
        value: total,
        kpiId: kpi.id,
        kpiName: kpi.name,
        inputRecordCount: records.length,
        executionTime
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const executionTime = Date.now() - startTime;

      logger.error(`[KPI] Calculation failed`, {
        kpiId,
        organizationId,
        error: errorMsg,
        executionTime
      });

      return {
        success: false,
        value: null,
        kpiId,
        kpiName: '',
        inputRecordCount: 0,
        executionTime,
        error: errorMsg
      };
    }
  }

  /**
   * Calculate KPI on provided records (for real-time sandbox)
   * Used by frontend to calculate on draft data without saving
   *
   * @param formula - KPI formula (e.g., "{cost} * 1.15")
   * @param records - Array of records (PfaRecord or similar shape)
   * @returns Aggregated value
   */
  calculateOnRecords(
    formula: string,
    records: Array<Record<string, unknown>>
  ): number {
    let total = 0;

    for (const record of records) {
      try {
        const value = this.evaluateFormula(formula, record);
        if (!isNaN(value) && isFinite(value)) {
          total += value;
        }
      } catch {
        // Skip errored records
      }
    }

    return total;
  }

  /**
   * Evaluate mathjs formula with record data
   * Replaces {fieldName} placeholders with actual values
   *
   * @param formula - Formula string (e.g., "{cost} * 1.15")
   * @param record - Record with field values
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

    // Evaluate with sandboxed mathjs
    try {
      const result = this.math.evaluate(mathExpression, scope);
      return Number(result);
    } catch (error) {
      throw new Error(`Formula evaluation failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * Validate formula syntax without executing
   * Returns validation result with extracted variables
   *
   * @param formula - Formula string to validate
   * @returns FormulaValidationResult
   */
  validateFormula(formula: string): FormulaValidationResult {
    try {
      // Check for empty formula
      if (!formula || formula.trim().length === 0) {
        return { valid: false, error: 'Formula cannot be empty' };
      }

      // Check for forbidden patterns (security)
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
        testRecord[variable] = 100; // Use 100 as test value
      }

      this.evaluateFormula(formula, testRecord);

      return {
        valid: true,
        parsedVariables: variables
      };

    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      };
    }
  }

  /**
   * Test formula with sample data
   * Returns the calculated value for preview
   *
   * @param formula - Formula string
   * @param sampleRecord - Sample record with field values
   * @returns Calculated value or error
   */
  testFormula(
    formula: string,
    sampleRecord: Record<string, unknown>
  ): { success: boolean; value?: number; error?: string } {
    const validation = this.validateFormula(formula);

    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const value = this.evaluateFormula(formula, sampleRecord);
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
   * Returns list of PfaRecord numeric fields
   */
  getAvailableFields(): Array<{ name: string; description: string; type: string }> {
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
   * Get example formulas for formula builder
   */
  getExampleFormulas(): Array<{ name: string; formula: string; description: string }> {
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
        description: '3-year rental cost minus purchase price (positive = rental more expensive)'
      }
    ];
  }
}

// Singleton export
export const kpiCalculator = new KpiCalculator();
