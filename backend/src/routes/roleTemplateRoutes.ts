/**
 * Role Template Routes
 * ADR-005 - Global role management (not organization-scoped)
 *
 * Role templates are global resources that can be assigned to users
 * across any organization. They don't belong to a specific org.
 */

import { Router } from 'express';
import {
  getAllRoleTemplates,
  getRoleTemplateById,
  createRoleTemplate,
  updateRoleTemplate,
  deleteRoleTemplate,
  getRoleTemplateUsage,
} from '../controllers/roleTemplateController';
import { authenticateJWT } from '../middleware/auth';
import { requireGlobalPermission } from '../middleware/requireGlobalPermission';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

// Get all role templates (requires perm_ManageUsers in any org OR admin role)
router.get('/', requireGlobalPermission('perm_ManageUsers'), getAllRoleTemplates);

// Get single role template
router.get('/:id', requireGlobalPermission('perm_ManageUsers'), getRoleTemplateById);

// Get role template usage stats
router.get('/:id/usage', requireGlobalPermission('perm_ManageUsers'), getRoleTemplateUsage);

// Create new role template (requires perm_ManageSettings in any org OR admin role)
router.post('/', requireGlobalPermission('perm_ManageSettings'), createRoleTemplate);

// Update role template (requires perm_ManageSettings in any org OR admin role)
router.put('/:id', requireGlobalPermission('perm_ManageSettings'), updateRoleTemplate);

// Delete role template (requires perm_ManageSettings in any org OR admin role)
router.delete('/:id', requireGlobalPermission('perm_ManageSettings'), deleteRoleTemplate);

export default router;
