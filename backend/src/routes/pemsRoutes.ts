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
import {
  startUserSync,
  getUserSyncProgress,
  getSkippedUsers,
  getActiveUserSyncs,
  cancelUserSync
} from '../controllers/pemsUserSyncController';
import {
  testPemsScreen,
  getPfaRecord,
  updatePfaRecord,
  createPfaRecord,
  deletePfaRecord,
  getFieldMapping,
  batchUpdatePfaRecords
} from '../controllers/pemsScreenController';
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

// ============================================================================
// User Sync Routes (Phase 0, Task 0.1: PEMS User Sync with Filtering)
// ============================================================================

// Start user sync from PEMS with selective filtering
router.post('/users/sync', startUserSync);

// Get user sync progress by ID
router.get('/users/sync/:syncId', getUserSyncProgress);

// Get list of skipped users with reasons
router.get('/users/sync/:syncId/skipped', getSkippedUsers);

// Get all active user syncs
router.get('/users/active-syncs', getActiveUserSyncs);

// Cancel a running user sync
router.delete('/users/sync/:syncId', cancelUserSync);

// ============================================================================
// PEMS Screen Service Routes (UserDefinedScreenService API - CUPFA2)
// For bi-directional sync: PFA Vanguard → PEMS
// ============================================================================

// Test PEMS Screen Service connection and write capability
router.get('/screen/test', testPemsScreen);

// Get field mapping between PFA Vanguard and PEMS
router.get('/screen/field-mapping', getFieldMapping);

// Get single PFA record directly from PEMS
router.get('/screen/record/:pfaId', getPfaRecord);

// Update PFA record in PEMS
router.put('/screen/record/:pfaId', updatePfaRecord);

// Create new PFA record in PEMS
router.post('/screen/record', createPfaRecord);

// Delete PFA record in PEMS
router.delete('/screen/record/:pfaId', deletePfaRecord);

// Batch update multiple PFA records (max 100 per request)
router.post('/screen/batch-update', batchUpdatePfaRecords);

export default router;
