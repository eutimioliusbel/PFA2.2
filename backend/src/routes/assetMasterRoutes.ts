/**
 * @file assetMasterRoutes.ts
 * @description Asset Master API Routes
 *
 * Routes for accessing equipment registry data from asset_master table.
 * All routes require authentication.
 */

import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import {
  getAssetMaster,
  getAssetByCode,
  getAssetStats,
  getAllAssets
} from '../controllers/assetMasterController';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

// GET /api/assets/all - Get all assets across organizations (admin view)
router.get('/all', getAllAssets);

// GET /api/assets/:orgId - Get paginated asset list for organization
router.get('/:orgId', getAssetMaster);

// GET /api/assets/:orgId/stats - Get asset statistics for organization
router.get('/:orgId/stats', getAssetStats);

// GET /api/assets/:orgId/:assetCode - Get single asset by code
router.get('/:orgId/:assetCode', getAssetByCode);

export default router;
