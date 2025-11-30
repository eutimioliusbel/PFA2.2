// backend/src/routes/roleDriftRoutes.ts
/**
 * Role Drift Routes
 *
 * Phase 7, Task 7.4 of ADR-005 Multi-Tenant Access Control
 * AI Use Case 19: Role Drift Detection and Role Template Suggestions
 */

import express from 'express';
import {
  detectRoleDrift,
  applyRoleRefactor,
  rollbackRefactor,
} from '../controllers/roleDriftController';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticateJWT);

/**
 * POST /api/roles/detect-drift
 * Detect role drift patterns in an organization
 *
 * Required Permission: perm_ManageUsers OR perm_ManageSettings
 *
 * Request Body:
 * - organizationId: string (required)
 *
 * Response:
 * - driftDetected: boolean
 * - patterns: DriftPattern[]
 * - recommendations: DriftRecommendation[]
 * - summary: { totalUsersAnalyzed, usersWithOverrides, patternsDetected, estimatedOverridesToRemove }
 * - lastAnalyzedAt: string
 *
 * Drift Pattern Types:
 * - CONSISTENT_OVERRIDES: 3+ users with 60%+ identical overrides
 * - EXCESSIVE_OVERRIDES: Single user with 5+ custom overrides
 * - ROLE_MISMATCH: User's actual behavior doesn't match assigned role
 */
router.post('/detect-drift', detectRoleDrift);

/**
 * POST /api/roles/apply-refactor
 * Apply a role refactor - create new role and migrate users
 *
 * Required Permission: perm_ManageUsers
 *
 * Request Body:
 * - organizationId: string (required)
 * - pattern: DriftPattern (required) - The drift pattern to refactor
 * - customRoleName?: string (optional) - Override the suggested role name
 *
 * Response:
 * - success: boolean
 * - newRoleCreated: boolean
 * - newRoleId: string
 * - newRoleName: string
 * - usersMigrated: number
 * - overridesRemoved: number
 * - rollbackId: string - ID for rollback within 7 days
 * - rollbackAvailable: boolean
 * - rollbackExpiresAt: string
 *
 * What happens:
 * 1. Creates a new role with the combined permissions
 * 2. Migrates affected users to the new role
 * 3. Removes individual permission overrides (now part of role)
 * 4. Stores rollback history for 7 days
 */
router.post('/apply-refactor', applyRoleRefactor);

/**
 * POST /api/roles/rollback-refactor
 * Rollback a role refactor within the 7-day window
 *
 * Required Permission: perm_ManageUsers
 *
 * Request Body:
 * - organizationId: string (required)
 * - rollbackId: string (required) - ID from apply-refactor response
 *
 * Response:
 * - success: boolean
 * - error?: string
 *
 * What happens:
 * 1. Restores each user's previous role
 * 2. Restores each user's previous permission overrides
 * 3. Creates audit log entry
 *
 * Note: Does NOT delete the created role (it may be in use by other users)
 */
router.post('/rollback-refactor', rollbackRefactor);

export default router;
