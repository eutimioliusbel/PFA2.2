/**
 * Personal Access Token Routes
 * ADR-005 Missing Components
 */

import { Router } from 'express';
import {
  getUserTokens,
  createToken,
  revokeToken,
  getTokenStats,
} from '../controllers/personalAccessTokenController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

// Get user's tokens
router.get('/', getUserTokens);

// Get token statistics
router.get('/stats', getTokenStats);

// Create new token
router.post('/', createToken);

// Revoke token
router.delete('/:id', revokeToken);

export default router;
