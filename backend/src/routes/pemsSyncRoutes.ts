/**
 * PEMS Sync Routes
 *
 * Routes for syncing data from PEMS
 */

import express from 'express';
import {
  startSync,
  getSyncStatus,
  getSyncHistory,
  cancelSync
} from '../controllers/pemsSyncController';

const router = express.Router();

// Start a new sync
router.post('/sync', startSync);

// Get sync status
router.get('/sync/:syncId', getSyncStatus);

// Get sync history for an organization
router.get('/sync/history', getSyncHistory);

// Cancel a running sync
router.post('/sync/:syncId/cancel', cancelSync);

export default router;
