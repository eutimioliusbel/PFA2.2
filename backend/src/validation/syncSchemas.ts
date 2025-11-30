/**
 * Validation schemas for PEMS sync endpoints
 *
 * P0-1: SQL Injection Protection
 * All query parameters and request bodies must be validated
 * to prevent SQL injection attacks.
 */

import { z } from 'zod';

/**
 * GET /api/pems/sync-status validation
 * Protects against SQL injection via organizationId and status parameters
 */
export const getSyncStatusSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID format'),
  status: z.enum(['pending', 'queued', 'processing', 'completed', 'failed']).optional(),
  startDate: z.string().datetime({ message: 'Invalid start date format' }).optional(),
  endDate: z.string().datetime({ message: 'Invalid end date format' }).optional(),
});

/**
 * POST /api/pems/write-sync validation
 * Already implemented in controller, exported here for consistency
 */
export const writeSyncSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID format'),
  modificationIds: z.array(z.string().uuid('Invalid modification ID format')).optional(),
  priority: z.number().int().min(0).max(10).optional().default(0),
});

/**
 * POST /api/pems/conflicts/:conflictId/resolve validation
 * Already implemented in controller, exported here for consistency
 */
export const resolveConflictSchema = z.object({
  conflictId: z.string().uuid('Invalid conflict ID format'),
  resolution: z.enum(['use_local', 'use_pems', 'merge']),
  mergedData: z.record(z.any()).optional(),
});

/**
 * GET /api/pems/conflicts validation
 * Protects against SQL injection via organizationId parameter
 */
export const listConflictsSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID format'),
  status: z.enum(['unresolved', 'resolved']).optional(),
});

/**
 * Generic UUID validation helper
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Generic date range validation helper
 */
export const dateRangeSchema = z.object({
  startDate: z.string().datetime({ message: 'Invalid start date format' }).optional(),
  endDate: z.string().datetime({ message: 'Invalid end date format' }).optional(),
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate);
  }
  return true;
}, {
  message: 'Start date must be before or equal to end date',
});
