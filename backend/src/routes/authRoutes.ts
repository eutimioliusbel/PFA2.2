import { Router } from 'express';
import authController from '../controllers/authController';
import { authRateLimiter } from '../middleware/rateLimiter';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// Public routes (with rate limiting)
router.post('/login', authRateLimiter, authController.login);
router.post('/verify', authController.verify);

// Protected routes (admin only)
router.post('/register', requireAdmin, authController.register);

export default router;
