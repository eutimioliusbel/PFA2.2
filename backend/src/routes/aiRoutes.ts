import { Router } from 'express';
import aiController from '../controllers/aiController';
import { authenticateJWT } from '../middleware/auth';
import { aiRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// All AI routes require authentication and stricter rate limiting
router.use(authenticateJWT);
router.use(aiRateLimiter);

router.post('/chat', aiController.chat);
router.get('/usage', aiController.getUsage);

export default router;
