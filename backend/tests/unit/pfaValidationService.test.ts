/**
 * Unit Tests: PfaValidationService
 *
 * Tests all validation rules for PFA modifications:
 * - Date ordering validation
 * - Source-specific requirements (Rental/Purchase)
 * - Enum validation (DOR, Source)
 * - Business rules (actualized equipment, discontinued items)
 * - Type validation (booleans, numbers)
 *
 * Phase 4, Gate 2 - Task 4B.2: Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PfaValidationService } from '../../src/services/pfa/PfaValidationService';

describe('PfaValidationService', () => {
  let service: PfaValidationService;

  beforeEach(() => {
    service = new PfaValidationService();
  });

  describe('validateModification', () => {
    describe('Date Ordering Validation', () => {
      it('should pass validation when forecast end is after forecast start', () => {
        const delta = {
          forecastStart: '2025-01-01',
          forecastEnd: '2025-06-30',
        };

        const result = service.validateModification(delta);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should fail validation when forecast end is before forecast start', () => {
        const delta = {
          forecastStart: '2025-06-30',
          forecastEnd: '2025-01-01',
        };

        const result = service.validateModification(delta);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe('forecastEnd');
        expect(result.errors[0].code).toBe('INVALID_DATE_ORDER');
      });

      it('should validate original dates correctly', () => {
        const delta = {
          originalStart: '2025-06-30',
          originalEnd: '2025-01-01',
        };

        const result = service.validateModification(delta);

        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('originalEnd');
        expect(result.errors[0].code).toBe('INVALID_DATE_ORDER');
      });

      it('should validate actual dates correctly', () => {
        const delta = {
          actualStart: '2025-06-30',
          actualEnd: '2025-01-01',
        };

        const result = service.validateModification(delta);

        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('actualEnd');
        expect(result.errors[0].code).toBe('INVALID_DATE_ORDER');
      });
    });

    describe('Source-Specific Requirements', () => {
      it('should require monthlyRate for Rental equipment', () => {
        const delta = {
          source: 'Rental',
          monthlyRate: null,
        };

        const result = service.validateModification(delta);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'monthlyRate',
            code: 'MISSING_REQUIRED_FIELD',
          })
        );
      });

      it('should reject negative monthlyRate for Rental equipment', () => {
        const delta = {
          source: 'Rental',
          monthlyRate: -1000,
        };

        const result = service.validateModification(delta);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'monthlyRate',
            code: 'INVALID_VALUE',
          })
        );
      });

      it('should require purchasePrice for Purchase equipment', () => {
        const delta = {
          source: 'Purchase',
          purchasePrice: null,
        };

        const result = service.validateModification(delta);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'purchasePrice',
            code: 'MISSING_REQUIRED_FIELD',
          })
        );
      });

      it('should reject negative purchasePrice for Purchase equipment', () => {
        const delta = {
          source: 'Purchase',
          purchasePrice: -50000,
        };

        const result = service.validateModification(delta);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'purchasePrice',
            code: 'INVALID_VALUE',
          })
        );
      });

      it('should allow zero monthlyRate (free equipment)', () => {
        const delta = {
          source: 'Rental',
          monthlyRate: 0,
        };

        const result = service.validateModification(delta);

        expect(result.valid).toBe(true);
      });
    });

    describe('Enum Validation', () => {
      it('should reject invalid DOR values', () => {
        const delta = {
          dor: 'INVALID_VALUE',
        };

        const result = service.validateModification(delta);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'dor',
            code: 'INVALID_ENUM_VALUE',
          })
        );
      });

      it('should accept valid DOR values', () => {
        const validDorValues = ['BEO', 'PROJECT'];

        for (const dor of validDorValues) {
          const result = service.validateModification({ dor });
          expect(result.valid).toBe(true);
        }
      });

      it('should reject invalid Source values', () => {
        const delta = {
          source: 'Lease', // Only 'Rental' and 'Purchase' are valid
        };

        const result = service.validateModification(delta);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'source',
            code: 'INVALID_ENUM_VALUE',
          })
        );
      });

      it('should accept valid Source values', () => {
        const validSourceValues = ['Rental', 'Purchase'];

        for (const source of validSourceValues) {
          const result = service.validateModification({ source });
          expect(result.valid).toBe(true);
        }
      });
    });

    describe('Boolean Type Validation', () => {
      it('should reject non-boolean values for boolean fields', () => {
        const delta = {
          isActualized: 'true', // String instead of boolean
          isDiscontinued: 1, // Number instead of boolean
        };

        const result = service.validateModification(delta);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(2);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'isActualized',
            code: 'INVALID_TYPE',
          })
        );
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'isDiscontinued',
            code: 'INVALID_TYPE',
          })
        );
      });

      it('should accept boolean values for boolean fields', () => {
        const delta = {
          isActualized: true,
          isDiscontinued: false,
          isFundsTransferable: true,
        };

        const result = service.validateModification(delta);

        expect(result.valid).toBe(true);
      });
    });

    describe('Complex Validation Scenarios', () => {
      it('should return multiple errors for multiple violations', () => {
        const delta = {
          forecastStart: '2025-06-30',
          forecastEnd: '2025-01-01', // Invalid date order
          source: 'InvalidSource', // Invalid enum
          dor: 'INVALID_DOR', // Invalid enum
          monthlyRate: -1000, // Negative value
        };

        const result = service.validateModification(delta);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(3);
      });

      it('should pass validation for complete valid modification', () => {
        const delta = {
          forecastStart: '2025-01-01',
          forecastEnd: '2025-06-30',
          source: 'Rental',
          monthlyRate: 15000,
          dor: 'PROJECT',
          category: 'Excavators',
          manufacturer: 'Caterpillar',
          model: '320D',
        };

        const result = service.validateModification(delta);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe('validateNewPfa', () => {
    it('should require all mandatory fields', () => {
      const data = {
        // Missing pfaId, organizationId, category, source, dor
      };

      const result = service.validateNewPfa(data);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(5);

      const requiredFields = ['pfaId', 'organizationId', 'category', 'source', 'dor'];
      for (const field of requiredFields) {
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field,
            code: 'MISSING_REQUIRED_FIELD',
          })
        );
      }
    });

    it('should pass validation for complete new PFA record', () => {
      const data = {
        pfaId: 'PFA-12345',
        organizationId: 'org-123',
        category: 'Excavators',
        source: 'Rental',
        dor: 'PROJECT',
        monthlyRate: 15000,
        forecastStart: '2025-01-01',
        forecastEnd: '2025-06-30',
      };

      const result = service.validateNewPfa(data);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should apply business rules from validateModification', () => {
      const data = {
        pfaId: 'PFA-12345',
        organizationId: 'org-123',
        category: 'Excavators',
        source: 'Rental',
        dor: 'PROJECT',
        monthlyRate: -5000, // Negative value - should fail
        forecastStart: '2025-06-30',
        forecastEnd: '2025-01-01', // Invalid date order - should fail
      };

      const result = service.validateNewPfa(data);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateBusinessRules', () => {
    describe('Update Operation', () => {
      it('should prevent moving actual start date forward for actualized equipment', () => {
        const currentState = {
          isActualized: true,
          actualStart: '2025-01-01',
        };

        const delta = {
          actualStart: '2025-02-01', // Moving forward - not allowed
        };

        const result = service.validateBusinessRules(delta, currentState, 'update');

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'actualStart',
            code: 'BUSINESS_RULE_VIOLATION',
          })
        );
      });

      it('should allow moving actual start date backward for actualized equipment', () => {
        const currentState = {
          isActualized: true,
          actualStart: '2025-02-01',
        };

        const delta = {
          actualStart: '2025-01-01', // Moving backward - allowed
        };

        const result = service.validateBusinessRules(delta, currentState, 'update');

        expect(result.valid).toBe(true);
      });

      it('should prevent changing source type for actualized equipment', () => {
        const currentState = {
          isActualized: true,
          source: 'Rental',
        };

        const delta = {
          source: 'Purchase',
        };

        const result = service.validateBusinessRules(delta, currentState, 'update');

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'source',
            code: 'BUSINESS_RULE_VIOLATION',
          })
        );
      });

      it('should prevent un-discontinuing equipment', () => {
        const currentState = {
          isDiscontinued: true,
        };

        const delta = {
          isDiscontinued: false,
        };

        const result = service.validateBusinessRules(delta, currentState, 'update');

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'isDiscontinued',
            code: 'BUSINESS_RULE_VIOLATION',
          })
        );
      });
    });

    describe('Delete Operation', () => {
      it('should prevent deleting actualized equipment', () => {
        const currentState = {
          isActualized: true,
        };

        const result = service.validateBusinessRules({}, currentState, 'delete');

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'isActualized',
            code: 'BUSINESS_RULE_VIOLATION',
          })
        );
      });

      it('should allow deleting non-actualized equipment', () => {
        const currentState = {
          isActualized: false,
        };

        const result = service.validateBusinessRules({}, currentState, 'delete');

        expect(result.valid).toBe(true);
      });
    });

    describe('Create Operation', () => {
      it('should pass validation for create operation', () => {
        const delta = {
          pfaId: 'PFA-NEW',
          category: 'Excavators',
        };

        const result = service.validateBusinessRules(delta, {}, 'create');

        expect(result.valid).toBe(true);
      });
    });
  });

  describe('sanitizeDelta', () => {
    it('should convert date strings to Date objects', () => {
      const delta = {
        forecastStart: '2025-01-01',
        forecastEnd: '2025-06-30',
        category: 'Excavators',
      };

      const sanitized = service.sanitizeDelta(delta);

      expect(sanitized.forecastStart).toBeInstanceOf(Date);
      expect(sanitized.forecastEnd).toBeInstanceOf(Date);
      expect(sanitized.category).toBe('Excavators');
    });

    it('should convert numeric strings to numbers', () => {
      const delta = {
        monthlyRate: '15000',
        purchasePrice: '50000',
      };

      const sanitized = service.sanitizeDelta(delta);

      expect(sanitized.monthlyRate).toBe(15000);
      expect(sanitized.purchasePrice).toBe(50000);
    });

    it('should trim string fields', () => {
      const delta = {
        category: '  Excavators  ',
        manufacturer: '  Caterpillar  ',
        model: '  320D  ',
      };

      const sanitized = service.sanitizeDelta(delta);

      expect(sanitized.category).toBe('Excavators');
      expect(sanitized.manufacturer).toBe('Caterpillar');
      expect(sanitized.model).toBe('320D');
    });

    it('should preserve non-string, non-date, non-numeric fields', () => {
      const delta = {
        isActualized: true,
        customData: { key: 'value' },
      };

      const sanitized = service.sanitizeDelta(delta);

      expect(sanitized.isActualized).toBe(true);
      expect(sanitized.customData).toEqual({ key: 'value' });
    });
  });
});
