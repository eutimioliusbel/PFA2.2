import { Router } from 'express';
import authController from '../controllers/authController';
import { authRateLimiter } from '../middleware/rateLimiter';
import { requireAdmin, authenticateJWT } from '../middleware/auth';
import {
  startImpersonation,
  endImpersonation,
  getImpersonationStatus,
} from '../controllers/impersonationController';

const router = Router();

// Public routes (with rate limiting)
router.post('/login', authRateLimiter, authController.login);
router.post('/verify', authController.verify);

// Protected routes (admin only)
router.post('/register', requireAdmin, authController.register);

// ============================================================================
// IMPERSONATION ROUTES (ADR-005: View As)
// ============================================================================

/**
 * POST /api/auth/impersonate/:userId
 * Start impersonating another user
 * Requires: perm_Impersonate permission
 */
router.post('/impersonate/:userId', authenticateJWT, startImpersonation);

/**
 * POST /api/auth/end-impersonation
 * End impersonation and return to original user
 * Requires: Active impersonation session
 */
router.post('/end-impersonation', authenticateJWT, endImpersonation);

/**
 * GET /api/auth/impersonation-status
 * Check current impersonation status
 * Requires: Authentication
 */
router.get('/impersonation-status', authenticateJWT, getImpersonationStatus);

export default router;
