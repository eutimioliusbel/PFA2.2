import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/**
 * Global rate limiter for all API endpoints
 */
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use user ID from JWT if available
  keyGenerator: (req: any) => {
    return req.user?.userId || req.ip;
  },
});

/**
 * Stricter rate limiter for AI endpoints (expensive operations)
 */
export const aiRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 20, // 20 requests per minute
  message: {
    error: 'AI_RATE_LIMIT_EXCEEDED',
    message: 'Too many AI requests. Please wait before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    return req.user?.userId || req.ip;
  },
});

/**
 * Auth endpoint rate limiter (prevent brute force)
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts
  message: {
    error: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Too many login attempts. Please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});
