/**
 * Request Validation Middleware
 *
 * P0-1: SQL Injection Protection
 * Validates request parameters using Zod schemas to prevent SQL injection
 * and other input-based attacks.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../utils/logger';
import { env } from '../config/env';

/**
 * Validates request data against a Zod schema
 *
 * Merges query, params, and body for validation to catch all attack vectors.
 * In production, does not expose detailed validation errors to prevent
 * information disclosure.
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 */
export function validateRequest(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Merge all request data sources for comprehensive validation
      const data = {
        ...req.query,
        ...req.params,
        ...req.body,
      };

      // Parse and validate
      const validatedData = schema.parse(data);

      // Replace request data with validated (sanitized) data
      req.validatedData = validatedData;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Log full error details for debugging
        logger.warn('Request validation failed', {
          path: req.path,
          method: req.method,
          errors: error.errors,
          userId: (req as any).user?.userId,
        });

        // In production, return minimal error information
        // to prevent information disclosure
        const isProduction = env.NODE_ENV === 'production';

        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          // Only include detailed errors in development
          ...(isProduction ? {} : { details: error.errors }),
        });
        return;
      }

      // Unexpected error during validation
      logger.error('Unexpected validation middleware error', { error });
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Request validation failed',
      });
    }
  };
}

/**
 * Validates specific parameter by name
 *
 * Useful for validating URL parameters like :id, :organizationId, etc.
 *
 * @param paramName - Parameter name to validate
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 */
export function validateParam(paramName: string, schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const paramValue = req.params[paramName] || req.query[paramName] || req.body[paramName];

      if (paramValue === undefined) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: `Missing required parameter: ${paramName}`,
        });
        return;
      }

      schema.parse(paramValue);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Parameter validation failed', {
          param: paramName,
          value: req.params[paramName],
          errors: error.errors,
        });

        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: `Invalid parameter: ${paramName}`,
          details: env.NODE_ENV === 'production' ? undefined : error.errors,
        });
        return;
      }

      logger.error('Unexpected parameter validation error', { error });
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Parameter validation failed',
      });
    }
  };
}

// Extend Express Request type to include validated data
declare global {
  namespace Express {
    interface Request {
      validatedData?: any;
    }
  }
}
