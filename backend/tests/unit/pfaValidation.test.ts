/**
 * PFA Validation Service Unit Tests
 *
 * Tests for data validation logic and business rules
 * Phase 2, Track A - Task 2A.7: Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PfaValidationService } from '../../src/services/pfa/PfaValidationService';

describe('PfaValidationService', () => {
  let service: PfaValidationService;

  beforeEach(() => {
    service = new PfaValidationService();
  });

  describe('validateModification', () => {
    it('should pass validation for valid rental data', () => {
      const delta = {
        source: 'Rental',
        monthlyRate: 5000,
        forecastStart: '2025-01-15',
        forecastEnd: '2025-06-30',
      };

      const result = service.validateModification(delta);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass validation for valid purchase data', () => {
      const delta = {
        source: 'Purchase',
        purchasePrice: 50000,
        forecastStart: '2025-01-15',
        forecastEnd: '2025-06-30',
      };

      const result = service.validateModification(delta);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when forecastEnd is before forecastStart', () => {
      const delta = {
        forecastStart: '2025-06-30',
        forecastEnd: '2025-01-15',
      };

      const result = service.validateModification(delta);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('forecastEnd');
      expect(result.errors[0].code).toBe('INVALID_DATE_ORDER');
    });

    it('should fail when rental is missing monthlyRate', () => {
      const delta = {
        source: 'Rental',
        monthlyRate: null,
      };

      const result = service.validateModification(delta);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'monthlyRate')).toBe(true);
      expect(result.errors.some(e => e.code === 'MISSING_REQUIRED_FIELD')).toBe(true);
    });

    it('should fail when purchase is missing purchasePrice', () => {
      const delta = {
        source: 'Purchase',
        purchasePrice: null,
      };

      const result = service.validateModification(delta);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'purchasePrice')).toBe(true);
      expect(result.errors.some(e => e.code === 'MISSING_REQUIRED_FIELD')).toBe(true);
    });

    it('should fail when monthlyRate is negative', () => {
      const delta = {
        source: 'Rental',
        monthlyRate: -100,
      };

      const result = service.validateModification(delta);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'monthlyRate')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_VALUE' || e.code === 'INVALID_RANGE')).toBe(true);
    });

    it('should fail when dor is invalid', () => {
      const delta = {
        dor: 'INVALID',
      };

      const result = service.validateModification(delta);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'dor')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_ENUM_VALUE')).toBe(true);
    });

    it('should fail when source is invalid', () => {
      const delta = {
        source: 'Lease',
      };

      const result = service.validateModification(delta);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'source')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_ENUM_VALUE')).toBe(true);
    });

    it('should fail when boolean field is not boolean', () => {
      const delta = {
        isActualized: 'yes',
      };

      const result = service.validateModification(delta);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'isActualized')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_TYPE')).toBe(true);
    });

    it('should handle multiple validation errors', () => {
      const delta = {
        source: 'Rental',
        monthlyRate: -100,
        forecastStart: '2025-06-30',
        forecastEnd: '2025-01-15',
        dor: 'INVALID',
      };

      const result = service.validateModification(delta);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(2);
    });
  });

  describe('validateNewPfa', () => {
    it('should pass validation for complete new PFA', () => {
      const data = {
        pfaId: 'PFA-12345',
        organizationId: 'org-1',
        category: 'Excavators',
        source: 'Rental',
        dor: 'PROJECT',
        monthlyRate: 5000,
        forecastStart: '2025-01-15',
        forecastEnd: '2025-06-30',
      };

      const result = service.validateNewPfa(data);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when required fields are missing', () => {
      const data = {
        pfaId: 'PFA-12345',
        // Missing organizationId, category, source, dor
      };

      const result = service.validateNewPfa(data);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'MISSING_REQUIRED_FIELD')).toBe(true);
    });
  });

  describe('validateBusinessRules', () => {
    it('should allow updating forecast dates for non-actualized equipment', () => {
      const delta = {
        forecastStart: '2025-02-01',
      };

      const currentState = {
        isActualized: false,
        source: 'Rental',
      };

      const result = service.validateBusinessRules(delta, currentState, 'update');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should prevent moving actual start date forward for actualized equipment', () => {
      const delta = {
        actualStart: '2025-02-01',
      };

      const currentState = {
        isActualized: true,
        actualStart: '2025-01-15',
      };

      const result = service.validateBusinessRules(delta, currentState, 'update');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'actualStart')).toBe(true);
      expect(result.errors.some(e => e.code === 'BUSINESS_RULE_VIOLATION')).toBe(true);
    });

    it('should prevent changing source type for actualized equipment', () => {
      const delta = {
        source: 'Purchase',
      };

      const currentState = {
        isActualized: true,
        source: 'Rental',
      };

      const result = service.validateBusinessRules(delta, currentState, 'update');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'source')).toBe(true);
      expect(result.errors.some(e => e.code === 'BUSINESS_RULE_VIOLATION')).toBe(true);
    });

    it('should prevent un-discontinuing equipment', () => {
      const delta = {
        isDiscontinued: false,
      };

      const currentState = {
        isDiscontinued: true,
      };

      const result = service.validateBusinessRules(delta, currentState, 'update');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'isDiscontinued')).toBe(true);
      expect(result.errors.some(e => e.code === 'BUSINESS_RULE_VIOLATION')).toBe(true);
    });

    it('should prevent deleting actualized equipment', () => {
      const delta = {};
      const currentState = {
        isActualized: true,
      };

      const result = service.validateBusinessRules(delta, currentState, 'delete');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'isActualized')).toBe(true);
      expect(result.errors.some(e => e.code === 'BUSINESS_RULE_VIOLATION')).toBe(true);
    });
  });

  describe('sanitizeDelta', () => {
    it('should convert date strings to Date objects', () => {
      const delta = {
        forecastStart: '2025-01-15',
        forecastEnd: '2025-06-30',
      };

      const sanitized = service.sanitizeDelta(delta);

      expect(sanitized.forecastStart).toBeInstanceOf(Date);
      expect(sanitized.forecastEnd).toBeInstanceOf(Date);
    });

    it('should convert numeric strings to numbers', () => {
      const delta = {
        monthlyRate: '5000',
        purchasePrice: '50000',
      };

      const sanitized = service.sanitizeDelta(delta);

      expect(typeof sanitized.monthlyRate).toBe('number');
      expect(sanitized.monthlyRate).toBe(5000);
      expect(typeof sanitized.purchasePrice).toBe('number');
      expect(sanitized.purchasePrice).toBe(50000);
    });

    it('should trim string fields', () => {
      const delta = {
        category: '  Excavators  ',
        manufacturer: ' Caterpillar ',
      };

      const sanitized = service.sanitizeDelta(delta);

      expect(sanitized.category).toBe('Excavators');
      expect(sanitized.manufacturer).toBe('Caterpillar');
    });
  });
});
