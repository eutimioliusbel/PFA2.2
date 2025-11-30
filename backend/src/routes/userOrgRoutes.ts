/**
 * UserOrganization Routes
 * Phase 5, Task 5.3 - User-Organization Permission Manager
 */

import express from 'express';
import {
  getUserOrganizations,
  updateUserOrgRole,
  updateUserOrgCapabilities,
  revokeUserOrganization,
  assignUserToOrganization,
  getRoleTemplate,
} from '../controllers/userOrgController';
import { authenticateJWT } from '../middleware/auth';
import { requirePermission, requirePermissionGlobal } from '../middleware/requirePermission';

const router = express.Router();

// All user-organization routes require authentication
router.use(authenticateJWT);

/**
 * GET /api/users/:userId/organizations
 * Get all organizations for a specific user
 *
 * Required Permission: perm_ManageUsers (global - in any org)
 *
 * Response: Array of user-organization assignments with permissions and role templates
 */
router.get(
  '/users/:userId/organizations',
  requirePermissionGlobal('perm_ManageUsers'),
  getUserOrganizations
);

/**
 * POST /api/users/:userId/organizations
 * Assign user to organization with role
 *
 * Required Permission: perm_ManageUsers
 * Organization ID: Body field 'organizationId' (required)
 *
 * Request Body:
 * - organizationId: string (required) - Organization to assign user to
 * - role: string (optional, default: 'viewer') - Role template to apply
 *
 * Response: Created user-organization assignment
 */
router.post(
  '/users/:userId/organizations',
  requirePermission('perm_ManageUsers'),
  assignUserToOrganization
);

/**
 * PUT /api/user-organizations/:id/role
 * Update role for user-organization assignment
 *
 * Required Permission: perm_ManageUsers
 * Organization ID: Query parameter 'organizationId' (required)
 *
 * Request Body:
 * - role: string (required) - New role template
 * - organizationId: string (required) - Organization context for permission check
 *
 * Response: Updated user-organization assignment
 */
router.put(
  '/user-organizations/:id/role',
  requirePermission('perm_ManageUsers'),
  updateUserOrgRole
);

/**
 * PATCH /api/user-organizations/:id/capabilities
 * Update specific capabilities for user-organization
 *
 * Required Permission: perm_ManageUsers
 * Organization ID: Query parameter 'organizationId' (required)
 *
 * Request Body:
 * - capabilities: object (required) - Permission fields to update (e.g., { perm_Read: true })
 * - organizationId: string (required) - Organization context for permission check
 *
 * Response: Updated user-organization assignment
 */
router.patch(
  '/user-organizations/:id/capabilities',
  requirePermission('perm_ManageUsers'),
  updateUserOrgCapabilities
);

/**
 * DELETE /api/user-organizations/:id
 * Revoke user access to organization
 *
 * Required Permission: perm_ManageUsers
 * Organization ID: Query parameter 'organizationId' (required)
 *
 * Request Body:
 * - reason: string (optional) - Reason for revocation
 * - organizationId: string (required) - Organization context for permission check
 *
 * Response: Success message
 */
router.delete(
  '/user-organizations/:id',
  requirePermission('perm_ManageUsers'),
  revokeUserOrganization
);

/**
 * GET /api/role-templates/:role
 * Get role template capabilities
 *
 * Required Permission: perm_ManageUsers
 * Organization ID: Query parameter 'organizationId' (optional)
 *
 * Response: Role template with default permissions
 */
router.get(
  '/role-templates/:role',
  requirePermission('perm_ManageUsers'),
  getRoleTemplate
);

export default router;
