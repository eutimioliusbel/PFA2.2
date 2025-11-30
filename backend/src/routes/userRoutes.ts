import express from 'express';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  suspendUser,
  activateUser,
} from '../controllers/userController';
import { authenticateJWT } from '../middleware/auth';
import { requirePermission } from '../middleware/requirePermission';

const router = express.Router();

// All user routes require authentication
router.use(authenticateJWT);

/**
 * GET /api/users
 * Get all users (optionally filtered by organization)
 *
 * Required Permission: perm_ManageUsers OR admin role
 * Organization ID: Query parameter 'organizationId' (optional for admins)
 *
 * Query Parameters:
 * - organizationId: string (optional) - Filter users by organization
 *
 * Response: Array of users with their organization memberships
 *
 * Note: Admin users can access all users without specifying organizationId
 */
router.get('/', authenticateJWT, getUsers);

/**
 * POST /api/users
 * Create new user
 *
 * Required Permission: perm_ManageUsers
 * Organization ID: Body field 'organizationId' (required)
 *
 * Request Body:
 * - username: string (required)
 * - password: string (required)
 * - email: string (optional)
 * - firstName: string (optional)
 * - lastName: string (optional)
 * - organizationId: string (required) - Initial organization to assign user to
 * - role: string (optional) - Role within organization
 *
 * Response: Created user object
 */
router.post('/', requirePermission('perm_ManageUsers'), createUser);

/**
 * PUT /api/users/:id
 * Update user
 *
 * Required Permission: perm_ManageUsers
 * Organization ID: Body field 'organizationId' (required)
 *
 * Request Body:
 * - username: string (optional)
 * - email: string (optional)
 * - firstName: string (optional)
 * - lastName: string (optional)
 * - isActive: boolean (optional)
 * - organizationId: string (required) - Organization context for permission check
 *
 * Response: Updated user object
 */
router.put('/:id', requirePermission('perm_ManageUsers'), updateUser);

/**
 * DELETE /api/users/:id
 * Delete user
 *
 * Required Permission: perm_ManageUsers
 * Organization ID: Query parameter 'organizationId' (required)
 *
 * Query Parameters:
 * - organizationId: string (required) - Organization context for permission check
 *
 * Response: Success message
 */
router.delete('/:id', requirePermission('perm_ManageUsers'), deleteUser);

/**
 * POST /api/users/:id/suspend
 * Suspend user (set serviceStatus to 'suspended')
 *
 * Required Permission: perm_ManageUsers
 * Organization ID: Body field 'organizationId' (required)
 *
 * Request Body:
 * - reason: string (optional) - Reason for suspension
 * - organizationId: string (required) - Organization context for permission check
 *
 * Response: Updated user object
 */
router.post('/:id/suspend', requirePermission('perm_ManageUsers'), suspendUser);

/**
 * POST /api/users/:id/activate
 * Activate user (set serviceStatus to 'active')
 *
 * Required Permission: perm_ManageUsers
 * Organization ID: Body field 'organizationId' (required)
 *
 * Request Body:
 * - organizationId: string (required) - Organization context for permission check
 *
 * Response: Updated user object
 */
router.post('/:id/activate', requirePermission('perm_ManageUsers'), activateUser);

export default router;
