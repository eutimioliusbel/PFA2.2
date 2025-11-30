/**
 * User Session Routes
 * ADR-005 Missing Components
 */

import { Router } from 'express';
import {
  getUserSessions,
  getCurrentSession,
  revokeSession,
  revokeAllUserSessions,
  getSessionStats,
} from '../controllers/sessionController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

// Get current session
router.get('/current', getCurrentSession);

// Get session statistics
router.get('/stats', getSessionStats);

// Get sessions for a specific user
router.get('/user/:userId', getUserSessions);

// Revoke a specific session
router.delete('/:id', revokeSession);

// Revoke all sessions for a user
router.post('/user/:userId/revoke-all', revokeAllUserSessions);

export default router;
