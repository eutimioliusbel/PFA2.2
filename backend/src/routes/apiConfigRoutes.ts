/**
 * API Configuration Routes (New Architecture)
 *
 * Endpoints for managing global API configurations and org-specific credentials
 */

import { Router } from 'express';
import {
  getApiConfigs,
  createGlobalConfig,
  updateGlobalConfig,
  deleteGlobalConfig,
  upsertOrgCredentials,
  deleteOrgCredentials,
  testApiConfig
} from '../controllers/apiConfigController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

// ============================================================================
// Global API Configurations (fetches configs + org credentials)
// ============================================================================

// GET /api/configs - Get global API configurations with org credentials
router.get('/', getApiConfigs);

// ============================================================================
// Admin Routes: Manage Global API Configurations
// ============================================================================

// POST /api/configs - Create new global API configuration (admin only)
router.post('/', createGlobalConfig);

// PUT /api/configs/:id - Update global API configuration (admin only)
router.put('/:id', updateGlobalConfig);

// DELETE /api/configs/:id - Delete global API configuration (admin only)
router.delete('/:id', deleteGlobalConfig);

// ============================================================================
// Organization Routes: Manage Credentials for Global Configs
// ============================================================================

// POST /api/configs/:id/credentials - Add/update org credentials for a global config
router.post('/:id/credentials', upsertOrgCredentials);

// DELETE /api/configs/:id/credentials - Remove org credentials
router.delete('/:id/credentials', deleteOrgCredentials);

// POST /api/configs/:id/test - Test API connection with org's credentials
router.post('/:id/test', testApiConfig);

export default router;
