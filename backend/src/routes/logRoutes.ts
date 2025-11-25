import express from 'express';
import {
  getAiUsageLogs,
  getSyncLogs,
  getAiUsageStats,
  getSyncStats,
} from '../controllers/logController';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticateJWT);

// AI Usage Logs
router.get('/ai-usage', getAiUsageLogs);
router.get('/ai-usage/stats', getAiUsageStats);

// Sync Logs
router.get('/sync', getSyncLogs);
router.get('/sync/stats', getSyncStats);

export default router;
