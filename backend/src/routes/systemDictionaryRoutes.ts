/**
 * System Dictionary Routes
 * ADR-005 Missing Components
 */

import { Router } from 'express';
import {
  getCategories,
  getEntriesByCategory,
  getEntryById,
  createEntry,
  updateEntry,
  deleteEntry,
  reorderEntries,
  bulkImportEntries,
} from '../controllers/systemDictionaryController';
import { authenticateJWT } from '../middleware/auth';
import { requirePermissionGlobal } from '../middleware/requirePermission';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

// Get all categories (read-only, no permission required)
router.get('/categories', getCategories);

// Get entries by category (read-only, no permission required)
router.get('/:category', getEntriesByCategory);

// Get single entry
router.get('/entry/:id', getEntryById);

// Create new entry (requires perm_ManageSettings - global, not org-specific)
router.post('/', requirePermissionGlobal('perm_ManageSettings'), createEntry);

// Bulk import entries (requires perm_ManageSettings - global, not org-specific)
router.post('/bulk-import', requirePermissionGlobal('perm_ManageSettings'), bulkImportEntries);

// Reorder entries in a category (requires perm_ManageSettings - global, not org-specific)
router.post('/:category/reorder', requirePermissionGlobal('perm_ManageSettings'), reorderEntries);

// Update entry (requires perm_ManageSettings - global, not org-specific)
router.put('/:id', requirePermissionGlobal('perm_ManageSettings'), updateEntry);

// Delete entry (requires perm_ManageSettings - global, not org-specific)
router.delete('/:id', requirePermissionGlobal('perm_ManageSettings'), deleteEntry);

export default router;
