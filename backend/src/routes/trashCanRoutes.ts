/**
 * Trash Can Routes
 * ADR-005 Missing Components
 */

import { Router } from 'express';
import {
  getAllDeletedItems,
  getDeletedItemById,
  softDeleteEntity,
  restoreDeletedItem,
  permanentlyDeleteItem,
  getTrashStats,
} from '../controllers/trashCanController';
import { authenticateJWT } from '../middleware/auth';
import { requirePermission } from '../middleware/requirePermission';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

// Get trash statistics
router.get('/stats', requirePermission('perm_ManageUsers'), getTrashStats);

// Get all deleted items (requires perm_ManageUsers)
router.get('/', requirePermission('perm_ManageUsers'), getAllDeletedItems);

// Get single deleted item
router.get('/:id', requirePermission('perm_ManageUsers'), getDeletedItemById);

// Soft delete an entity (requires perm_Delete permission)
router.post('/', requirePermission('perm_Delete'), softDeleteEntity);

// Restore a deleted item (requires perm_ManageUsers)
router.post('/:id/restore', requirePermission('perm_ManageUsers'), restoreDeletedItem);

// Permanently delete (purge) an item (requires perm_ManageUsers)
router.delete('/:id', requirePermission('perm_ManageUsers'), permanentlyDeleteItem);

export default router;
