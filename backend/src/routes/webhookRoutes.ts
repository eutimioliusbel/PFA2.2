/**
 * Webhook Configuration Routes
 * ADR-005 Missing Components
 */

import { Router } from 'express';
import {
  getAllWebhooks,
  getWebhookById,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
} from '../controllers/webhookController';
import { authenticateJWT } from '../middleware/auth';
import { requirePermission } from '../middleware/requirePermission';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

// Get all webhooks (requires perm_ManageSettings)
router.get('/', requirePermission('perm_ManageSettings'), getAllWebhooks);

// Get single webhook
router.get('/:id', requirePermission('perm_ManageSettings'), getWebhookById);

// Test webhook
router.post('/:id/test', requirePermission('perm_ManageSettings'), testWebhook);

// Create new webhook
router.post('/', requirePermission('perm_ManageSettings'), createWebhook);

// Update webhook
router.put('/:id', requirePermission('perm_ManageSettings'), updateWebhook);

// Delete webhook
router.delete('/:id', requirePermission('perm_ManageSettings'), deleteWebhook);

export default router;
