/**
 * PEMS API Routes
 */

import { Router } from 'express';
import {
  getPemsConfigs,
  testPemsConnection
} from '../controllers/pemsController';
import {
  startSync,
  getSyncStatus,
  getSyncHistory,
  cancelSync,
  syncGlobalApi,
  syncOrgApis,
  getBatchStatus
} from '../controllers/pemsSyncController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

// Get PEMS configurations for an organization
router.get('/configs', getPemsConfigs);

// Test PEMS API connection
router.post('/test', testPemsConnection);

// Trigger data synchronization (NEW - using PemsSyncService)
router.post('/sync', startSync);

// Get sync status by ID
router.get('/sync/:syncId', getSyncStatus);

// Get sync history for an organization
router.get('/history', getSyncHistory);

// Cancel a running sync
router.post('/sync/:syncId/cancel', cancelSync);

// Global sync - sync specific API for all organizations
router.post('/sync-global', syncGlobalApi);

// Organization sync - sync all APIs with feeds for specific organization
router.post('/sync-org', syncOrgApis);

// Get batch sync status
router.get('/sync-batch/:batchId', getBatchStatus);

export default router;
