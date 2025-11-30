/**
 * @file PromotionRulesEditor.test.tsx
 * @description Unit tests for PromotionRulesEditor component
 * ADR-007 Task 6.2: Test promotion rules with sample data
 */

import { describe, it, expect, beforeEach } from 'vitest';
import jsonLogic from 'json-logic-js';

describe('Promotion Rules - JsonLogic Evaluation', () => {
  describe('Cost-based rules', () => {
    it('should pass records with cost > 0', () => {
      const rule = {
        '>': [{ var: 'cost' }, 0]
      };

      const validRecord = { cost: 1500 };
      const invalidRecord = { cost: 0 };

      expect(jsonLogic.apply(rule, validRecord)).toBe(true);
      expect(jsonLogic.apply(rule, invalidRecord)).toBe(false);
    });

    it('should handle cost >= 100', () => {
      const rule = {
        '>=': [{ var: 'cost' }, 100]
      };

      expect(jsonLogic.apply(rule, { cost: 100 })).toBe(true);
      expect(jsonLogic.apply(rule, { cost: 150 })).toBe(true);
      expect(jsonLogic.apply(rule, { cost: 99 })).toBe(false);
    });
  });

  describe('Status-based rules', () => {
    it('should filter by status using "in" operator', () => {
      const rule = {
        in: [{ var: 'status' }, ['ACTIVE', 'PENDING']]
      };

      expect(jsonLogic.apply(rule, { status: 'ACTIVE' })).toBe(true);
      expect(jsonLogic.apply(rule, { status: 'PENDING' })).toBe(true);
      expect(jsonLogic.apply(rule, { status: 'DISCONTINUED' })).toBe(false);
    });

    it('should exclude discontinued items', () => {
      const rule = {
        '!=': [{ var: 'isDiscontinued' }, true]
      };

      expect(jsonLogic.apply(rule, { isDiscontinued: false })).toBe(true);
      expect(jsonLogic.apply(rule, { isDiscontinued: true })).toBe(false);
    });
  });

  describe('Compound rules (AND logic)', () => {
    it('should require all conditions to pass', () => {
      const rule = {
        and: [
          { '>': [{ var: 'cost' }, 0] },
          { in: [{ var: 'status' }, ['ACTIVE', 'PENDING']] },
          { '==': [{ var: 'isDiscontinued' }, false] }
        ]
      };

      const validRecord = {
        cost: 1500,
        status: 'ACTIVE',
        isDiscontinued: false
      };

      const invalidCost = {
        cost: 0,
        status: 'ACTIVE',
        isDiscontinued: false
      };

      const invalidStatus = {
        cost: 1500,
        status: 'DISCONTINUED',
        isDiscontinued: false
      };

      expect(jsonLogic.apply(rule, validRecord)).toBe(true);
      expect(jsonLogic.apply(rule, invalidCost)).toBe(false);
      expect(jsonLogic.apply(rule, invalidStatus)).toBe(false);
    });
  });

  describe('Compound rules (OR logic)', () => {
    it('should pass if any condition is met', () => {
      const rule = {
        or: [
          { '>': [{ var: 'cost' }, 5000] },
          { '==': [{ var: 'category' }, 'Premium'] }
        ]
      };

      expect(jsonLogic.apply(rule, { cost: 6000, category: 'Standard' })).toBe(true);
      expect(jsonLogic.apply(rule, { cost: 1000, category: 'Premium' })).toBe(true);
      expect(jsonLogic.apply(rule, { cost: 1000, category: 'Standard' })).toBe(false);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle PFA rental quality gate', () => {
      const rule = {
        and: [
          { '>': [{ var: 'cost' }, 0] },
          { '==': [{ var: 'source' }, 'Rental'] },
          { in: [{ var: 'status' }, ['ACTIVE', 'FORECAST']] },
          { '==': [{ var: 'isDiscontinued' }, false] }
        ]
      };

      const validRental = {
        cost: 1500,
        source: 'Rental',
        status: 'ACTIVE',
        isDiscontinued: false
      };

      const purchaseItem = {
        cost: 1500,
        source: 'Purchase',
        status: 'ACTIVE',
        isDiscontinued: false
      };

      const zeroCostRental = {
        cost: 0,
        source: 'Rental',
        status: 'ACTIVE',
        isDiscontinued: false
      };

      expect(jsonLogic.apply(rule, validRental)).toBe(true);
      expect(jsonLogic.apply(rule, purchaseItem)).toBe(false);
      expect(jsonLogic.apply(rule, zeroCostRental)).toBe(false);
    });

    it('should handle BEO portfolio filter', () => {
      const rule = {
        and: [
          { '==': [{ var: 'dor' }, 'BEO'] },
          { '>': [{ var: 'monthlyRate' }, 0] }
        ]
      };

      const validBeo = {
        dor: 'BEO',
        monthlyRate: 500
      };

      const projectItem = {
        dor: 'PROJECT',
        monthlyRate: 500
      };

      expect(jsonLogic.apply(rule, validBeo)).toBe(true);
      expect(jsonLogic.apply(rule, projectItem)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty rules (pass all)', () => {
      const rule = {};
      expect(jsonLogic.apply(rule, { cost: 0 })).toEqual({}); // Empty rule returns empty object
    });

    it('should handle missing fields gracefully', () => {
      const rule = {
        '>': [{ var: 'cost' }, 0]
      };

      const recordWithoutCost = { status: 'ACTIVE' };
      expect(jsonLogic.apply(rule, recordWithoutCost)).toBe(false);
    });

    it('should handle null values', () => {
      const rule = {
        '!=': [{ var: 'cost' }, null]
      };

      expect(jsonLogic.apply(rule, { cost: 0 })).toBe(true);
      expect(jsonLogic.apply(rule, { cost: null })).toBe(false);
    });
  });
});
