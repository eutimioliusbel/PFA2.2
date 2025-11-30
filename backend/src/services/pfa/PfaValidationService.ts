/**
 * PFA Validation Service
 *
 * Validates PFA modifications before syncing to PEMS.
 * Ensures data integrity and business rule compliance.
 *
 * Phase 2, Track A - Task 2A.4: Validation Service
 */

import { logger } from '../../utils/logger';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export class PfaValidationService {
  /**
   * Validate PFA modification data
   */
  validateModification(delta: any): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate date ordering
    if (delta.forecastStart && delta.forecastEnd) {
      const start = new Date(delta.forecastStart);
      const end = new Date(delta.forecastEnd);

      if (start > end) {
        errors.push({
          field: 'forecastEnd',
          message: 'Forecast end date must be after start date',
          code: 'INVALID_DATE_ORDER'
        });
      }
    }

    // Validate original dates if present
    if (delta.originalStart && delta.originalEnd) {
      const start = new Date(delta.originalStart);
      const end = new Date(delta.originalEnd);

      if (start > end) {
        errors.push({
          field: 'originalEnd',
          message: 'Original end date must be after start date',
          code: 'INVALID_DATE_ORDER'
        });
      }
    }

    // Validate actual dates if present
    if (delta.actualStart && delta.actualEnd) {
      const start = new Date(delta.actualStart);
      const end = new Date(delta.actualEnd);

      if (start > end) {
        errors.push({
          field: 'actualEnd',
          message: 'Actual end date must be after start date',
          code: 'INVALID_DATE_ORDER'
        });
      }
    }

    // Validate source-specific requirements
    if (delta.source === 'Rental') {
      // Rental must have monthlyRate
      if (delta.monthlyRate === null || delta.monthlyRate === undefined) {
        errors.push({
          field: 'monthlyRate',
          message: 'Monthly rate is required for rental equipment',
          code: 'MISSING_REQUIRED_FIELD'
        });
      }

      // Validate monthlyRate is positive
      if (delta.monthlyRate !== undefined && delta.monthlyRate < 0) {
        errors.push({
          field: 'monthlyRate',
          message: 'Monthly rate must be non-negative',
          code: 'INVALID_VALUE'
        });
      }
    }

    if (delta.source === 'Purchase') {
      // Purchase must have purchasePrice
      if (delta.purchasePrice === null || delta.purchasePrice === undefined) {
        errors.push({
          field: 'purchasePrice',
          message: 'Purchase price is required for purchased equipment',
          code: 'MISSING_REQUIRED_FIELD'
        });
      }

      // Validate purchasePrice is positive
      if (delta.purchasePrice !== undefined && delta.purchasePrice < 0) {
        errors.push({
          field: 'purchasePrice',
          message: 'Purchase price must be non-negative',
          code: 'INVALID_VALUE'
        });
      }
    }

    // Validate DOR enum
    if (delta.dor && !['BEO', 'PROJECT'].includes(delta.dor)) {
      errors.push({
        field: 'dor',
        message: 'DOR must be either BEO or PROJECT',
        code: 'INVALID_ENUM_VALUE'
      });
    }

    // Validate source enum
    if (delta.source && !['Rental', 'Purchase'].includes(delta.source)) {
      errors.push({
        field: 'source',
        message: 'Source must be either Rental or Purchase',
        code: 'INVALID_ENUM_VALUE'
      });
    }

    // Validate numeric ranges
    if (delta.monthlyRate !== undefined && delta.monthlyRate < 0) {
      errors.push({
        field: 'monthlyRate',
        message: 'Monthly rate must be non-negative',
        code: 'INVALID_RANGE'
      });
    }

    if (delta.purchasePrice !== undefined && delta.purchasePrice < 0) {
      errors.push({
        field: 'purchasePrice',
        message: 'Purchase price must be non-negative',
        code: 'INVALID_RANGE'
      });
    }

    // Validate boolean flags
    const booleanFields = ['isActualized', 'isDiscontinued', 'isFundsTransferable', 'hasPlan', 'hasActuals'];
    for (const field of booleanFields) {
      if (delta[field] !== undefined && typeof delta[field] !== 'boolean') {
        errors.push({
          field,
          message: `${field} must be a boolean`,
          code: 'INVALID_TYPE'
        });
      }
    }

    // Log validation results
    if (errors.length > 0) {
      logger.warn('Validation failed for PFA modification', {
        errors: errors.map(e => `${e.field}: ${e.message}`)
      });
    } else {
      logger.debug('Validation passed for PFA modification');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate complete PFA record (for new records)
   */
  validateNewPfa(data: any): ValidationResult {
    const errors: ValidationError[] = [];

    // Required fields
    const requiredFields = ['pfaId', 'organizationId', 'category', 'source', 'dor'];
    for (const field of requiredFields) {
      if (!data[field]) {
        errors.push({
          field,
          message: `${field} is required`,
          code: 'MISSING_REQUIRED_FIELD'
        });
      }
    }

    // Delegate to modification validation for business rules
    const modValidation = this.validateModification(data);
    errors.push(...modValidation.errors);

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate date string format
   * Note: Available for use in date field validation if needed
   */
  private isValidDate(dateString: string | null | undefined): boolean {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  /**
   * Public helper to check date validity
   */
  public validateDateField(dateString: string | null | undefined): boolean {
    return this.isValidDate(dateString);
  }

  /**
   * Sanitize and normalize delta before validation
   */
  sanitizeDelta(delta: any): any {
    const sanitized = { ...delta };

    // Convert date strings to Date objects
    const dateFields = ['forecastStart', 'forecastEnd', 'originalStart', 'originalEnd', 'actualStart', 'actualEnd'];
    for (const field of dateFields) {
      if (sanitized[field] && typeof sanitized[field] === 'string') {
        sanitized[field] = new Date(sanitized[field]);
      }
    }

    // Convert numeric strings to numbers
    const numericFields = ['monthlyRate', 'purchasePrice'];
    for (const field of numericFields) {
      if (sanitized[field] && typeof sanitized[field] === 'string') {
        sanitized[field] = parseFloat(sanitized[field]);
      }
    }

    // Trim string fields
    const stringFields = ['category', 'class', 'manufacturer', 'model', 'areaSilo', 'dor', 'source'];
    for (const field of stringFields) {
      if (sanitized[field] && typeof sanitized[field] === 'string') {
        sanitized[field] = sanitized[field].trim();
      }
    }

    return sanitized;
  }

  /**
   * Validate business rules for specific operations
   */
  validateBusinessRules(
    delta: any,
    currentState: any,
    operation: 'create' | 'update' | 'delete'
  ): ValidationResult {
    const errors: ValidationError[] = [];

    if (operation === 'update') {
      // Cannot modify actualized records in certain ways
      if (currentState.isActualized && delta.actualStart) {
        const currentActualStart = new Date(currentState.actualStart);
        const newActualStart = new Date(delta.actualStart);

        if (newActualStart > currentActualStart) {
          errors.push({
            field: 'actualStart',
            message: 'Cannot move actual start date forward for actualized equipment',
            code: 'BUSINESS_RULE_VIOLATION'
          });
        }
      }

      // Cannot change source type for actualized equipment
      if (currentState.isActualized && delta.source && delta.source !== currentState.source) {
        errors.push({
          field: 'source',
          message: 'Cannot change source type for actualized equipment',
          code: 'BUSINESS_RULE_VIOLATION'
        });
      }

      // Cannot un-discontinue equipment
      if (currentState.isDiscontinued && delta.isDiscontinued === false) {
        errors.push({
          field: 'isDiscontinued',
          message: 'Cannot reactivate discontinued equipment',
          code: 'BUSINESS_RULE_VIOLATION'
        });
      }
    }

    if (operation === 'delete') {
      // Cannot delete actualized equipment
      if (currentState.isActualized) {
        errors.push({
          field: 'isActualized',
          message: 'Cannot delete actualized equipment - use discontinue instead',
          code: 'BUSINESS_RULE_VIOLATION'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export const pfaValidationService = new PfaValidationService();
