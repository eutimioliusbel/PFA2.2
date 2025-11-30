/**
 * Error Handling Utilities
 * Provides type-safe error handling helpers per CODING_STANDARDS.md Section 8
 */

import { Response } from 'express';
import logger from './logger';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR');
    this.name = 'ConflictError';
  }
}

/**
 * Type guard to check if error is an instance of Error
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

/**
 * Safely extract status code from error
 */
export function getErrorStatusCode(error: unknown): number {
  if (isAppError(error)) {
    return error.statusCode;
  }
  return 500;
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }
  if (isError(error)) {
    return new AppError(error.message);
  }
  return new AppError(getErrorMessage(error));
}

/**
 * Async error handler wrapper for Express routes
 * Usage: router.get('/path', asyncHandler(async (req, res) => {...}))
 */
export function asyncHandler(
  fn: (req: any, res: any, next: any) => Promise<any>
) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Standardized error response handler for Express controllers
 * Replaces catch (error: any) blocks with proper typing and logging
 *
 * Usage:
 * ```typescript
 * catch (error: unknown) {
 *   handleControllerError(error, res, 'Failed to fetch servers');
 * }
 * ```
 */
export function handleControllerError(
  error: unknown,
  res: Response,
  defaultMessage: string,
  context?: string
): void {
  const appError = toAppError(error);
  const statusCode = getErrorStatusCode(error);

  // Log error with context
  logger.error(context ? `[${context}] ${appError.message}` : appError.message, {
    statusCode,
    stack: appError.stack,
    code: isAppError(error) ? error.code : undefined,
  });

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: defaultMessage,
    message: appError.message,
    ...(isAppError(error) && error.code ? { code: error.code } : {}),
  });
}
