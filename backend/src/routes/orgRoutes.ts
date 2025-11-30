import express from 'express';
import {
  getOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  suspendOrganization,
  activateOrganization,
  archiveOrganization,
  toggleSync,
  unlinkOrganization,
} from '../controllers/orgController';
import { authenticateJWT } from '../middleware/auth';
import { requirePermissionGlobal } from '../middleware/requirePermission';

const router = express.Router();

// All organization routes require authentication
router.use(authenticateJWT);

/**
 * GET /api/organizations
 * Get all organizations (filtered by user's access)
 *
 * Required Permission: perm_Read
 * Organization ID: Query parameter 'organizationId' (optional, returns all accessible orgs if not provided)
 *
 * Note: Users can only see organizations they have access to
 * Admins with perm_ViewAllOrgs can see all organizations (not yet implemented)
 *
 * Response: Array of organizations user has access to
 */
router.get('/', authenticateJWT, getOrganizations);

/**
 * POST /api/organizations
 * Create new organization
 *
 * Required Permission: perm_ManageSettings (system-wide)
 * Organization ID: Body field 'organizationId' (optional, system admin operation)
 *
 * Note: Only system admins should be able to create organizations
 *
 * Request Body:
 * - code: string (required) - Unique organization code
 * - name: string (required) - Organization name
 * - description: string (optional)
 * - isExternal: boolean (optional) - From PEMS?
 * - externalId: string (optional) - PEMS org ID
 *
 * Response: Created organization object
 */
router.post('/', requirePermissionGlobal('perm_ManageSettings'), createOrganization);

/**
 * PUT /api/organizations/:id
 * Update organization
 *
 * Required Permission: perm_ManageSettings
 * Organization ID: URL parameter ':id' (organization being updated)
 *
 * Request Body:
 * - name: string (optional)
 * - description: string (optional)
 * - serviceStatus: string (optional) - 'active', 'suspended', 'archived'
 * - enableSync: boolean (optional)
 *
 * Response: Updated organization object
 */
router.put('/:id', requirePermissionGlobal('perm_ManageSettings'), updateOrganization);

/**
 * DELETE /api/organizations/:id
 * Delete organization
 *
 * Required Permission: perm_ManageSettings (system-wide)
 * Organization ID: URL parameter ':id' (organization being deleted)
 *
 * Note: Deletes cascade to all related data (users, PFA records, etc.)
 * Note: PEMS organizations cannot be deleted (will return 400 error)
 *
 * Response: Success message
 */
router.delete('/:id', requirePermissionGlobal('perm_ManageSettings'), deleteOrganization);

/**
 * POST /api/organizations/:id/suspend
 * Suspend organization (set serviceStatus to 'suspended')
 *
 * Required Permission: perm_ManageSettings
 * Organization ID: URL parameter ':id'
 *
 * Request Body:
 * - reason: string (optional) - Reason for suspension
 *
 * Response: Updated organization object
 */
router.post('/:id/suspend', requirePermissionGlobal('perm_ManageSettings'), suspendOrganization);

/**
 * POST /api/organizations/:id/activate
 * Activate organization (set serviceStatus to 'active')
 *
 * Required Permission: perm_ManageSettings
 * Organization ID: URL parameter ':id'
 *
 * Response: Updated organization object
 */
router.post('/:id/activate', requirePermissionGlobal('perm_ManageSettings'), activateOrganization);

/**
 * POST /api/organizations/:id/archive
 * Archive organization (set serviceStatus to 'archived')
 *
 * Required Permission: perm_ManageSettings
 * Organization ID: URL parameter ':id'
 *
 * Request Body:
 * - reason: string (optional) - Reason for archiving
 *
 * Response: Updated organization object
 */
router.post('/:id/archive', requirePermissionGlobal('perm_ManageSettings'), archiveOrganization);

/**
 * PATCH /api/organizations/:id/sync
 * Toggle sync for organization
 *
 * Required Permission: perm_ManageSettings
 * Organization ID: URL parameter ':id'
 *
 * Request Body:
 * - enableSync: boolean (required) - Enable or disable sync
 *
 * Response: Updated organization object
 */
router.patch('/:id/sync', requirePermissionGlobal('perm_ManageSettings'), toggleSync);

/**
 * POST /api/organizations/:id/unlink
 * Unlink PEMS organization (mark as local)
 *
 * Required Permission: perm_ManageSettings
 * Organization ID: URL parameter ':id'
 *
 * Request Body:
 * - reason: string (optional) - Reason for unlinking
 *
 * Response: Updated organization object
 */
router.post('/:id/unlink', requirePermissionGlobal('perm_ManageSettings'), unlinkOrganization);

export default router;
