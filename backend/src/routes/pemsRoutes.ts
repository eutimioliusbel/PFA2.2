/**
 * PEMS API Routes
 */

import { Router } from 'express';
import {
  getPemsConfigs,
  testPemsConnection,
  syncPemsData,
  getSyncStatus,
  getSyncHistory
} from '../controllers/pemsController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

// Get PEMS configurations for an organization
router.get('/configs', getPemsConfigs);

// Test PEMS API connection
router.post('/test', testPemsConnection);

// Trigger data synchronization
router.post('/sync', syncPemsData);

// Get sync status by ID
router.get('/sync/:syncId', getSyncStatus);

// Get sync history for an organization
router.get('/history', getSyncHistory);

export default router;
