/**
 * Per-User Rate Limiter with Redis
 *
 * P0-4: Per-User Rate Limiting
 * Prevents single users from exhausting API quotas for all users.
 * Uses Redis sorted sets for accurate sliding window rate limiting.
 *
 * Security Benefits:
 * - Prevents API quota exhaustion by individual users
 * - Fair resource allocation across all users
 * - Protects against DoS attacks
 * - Accurate tracking with sliding window algorithm
 */

import Redis from 'ioredis';
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import { logger } from '../utils/logger';
import { env } from '../config/env';

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix?: string; // Redis key prefix (default: 'rate_limit')
  skipSuccessfulRequests?: boolean; // Don't count successful requests (for auth)
}

// Initialize Redis client
// Fallback to in-memory Map if Redis is unavailable (dev mode)
let redis: Redis | null = null;
const inMemoryStore = new Map<string, Array<number>>();

try {
  // Use REDIS_URL if available, otherwise fall back to individual env vars
  const redisUrl = env.REDIS_URL;

  if (redisUrl) {
    redis = new Redis(redisUrl, {
      retryStrategy: (times) => {
        if (times > 3) {
          logger.warn('Redis connection failed, falling back to in-memory rate limiting');
          return null; // Stop retrying
        }
        return Math.min(times * 100, 3000);
      },
    });
  } else {
    // Fallback to individual env vars (for backward compatibility)
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.warn('Redis connection failed, falling back to in-memory rate limiting');
          return null; // Stop retrying
        }
        return Math.min(times * 100, 3000);
      },
    });
  }

  redis.on('error', (error) => {
    logger.error('Redis connection error', { error });
  });

  redis.on('connect', () => {
    logger.info('Redis connected successfully for rate limiting');
  });
} catch (error) {
  logger.warn('Failed to initialize Redis, using in-memory rate limiting', { error });
  redis = null;
}

/**
 * Per-user rate limiter middleware factory
 *
 * Implements sliding window algorithm using Redis sorted sets.
 * Falls back to in-memory Map if Redis is unavailable.
 *
 * @param options - Rate limit configuration
 * @returns Express middleware function
 */
export function perUserRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    keyPrefix = 'rate_limit',
    skipSuccessfulRequests = false,
  } = options;

  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;

      // Allow unauthenticated requests to pass through
      // (they should be blocked by authenticateJWT middleware)
      if (!userId) {
        next();
        return;
      }

      const now = Date.now();
      const windowStart = now - windowMs;
      const key = `${keyPrefix}:${userId}:${req.path}`;

      let requestCount: number;

      if (redis) {
        // Use Redis for distributed rate limiting
        requestCount = await rateLimitWithRedis(key, now, windowStart, windowMs);
      } else {
        // Fallback to in-memory rate limiting (single instance only)
        requestCount = rateLimitInMemory(key, now, windowStart);
      }

      // Set rate limit headers (standard: RateLimit-* headers)
      res.setHeader('RateLimit-Limit', maxRequests);
      res.setHeader('RateLimit-Remaining', Math.max(0, maxRequests - requestCount));
      res.setHeader('RateLimit-Reset', new Date(now + windowMs).toISOString());

      // Check if rate limit exceeded
      if (requestCount > maxRequests) {
        logger.warn('Rate limit exceeded', {
          userId,
          path: req.path,
          requestCount,
          maxRequests,
          windowMs,
        });

        res.status(429).json({
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Limit: ${maxRequests} requests per ${windowMs / 1000} seconds`,
          retryAfter: Math.ceil(windowMs / 1000),
          limit: maxRequests,
          remaining: 0,
          resetAt: new Date(now + windowMs).toISOString(),
        });
        return;
      }

      // If configured to skip successful requests, remove the request after success
      if (skipSuccessfulRequests) {
        res.on('finish', async () => {
          if (res.statusCode < 400) {
            await removeRequest(key, now);
          }
        });
      }

      next();
    } catch (error) {
      logger.error('Rate limiter middleware error', { error });
      // Fail open - allow request if rate limiting fails
      // This prevents rate limiter from becoming a single point of failure
      next();
    }
  };
}

/**
 * Rate limiting using Redis sorted sets (sliding window)
 */
async function rateLimitWithRedis(
  key: string,
  now: number,
  windowStart: number,
  windowMs: number
): Promise<number> {
  if (!redis) throw new Error('Redis not available');

  const multi = redis.multi();

  // Remove old requests outside the window
  multi.zremrangebyscore(key, 0, windowStart);

  // Add current request
  multi.zadd(key, now, `${now}-${Math.random()}`);

  // Count requests in window
  multi.zcount(key, windowStart, now);

  // Set expiry (cleanup old keys)
  multi.expire(key, Math.ceil(windowMs / 1000) + 1);

  const results = await multi.exec();

  if (!results) {
    throw new Error('Redis transaction failed');
  }

  // Result of ZCOUNT command (3rd command in pipeline)
  const requestCount = results[2][1] as number;

  return requestCount;
}

/**
 * Rate limiting using in-memory Map (single instance only)
 */
function rateLimitInMemory(
  key: string,
  now: number,
  windowStart: number
): number {
  // Get existing requests
  let requests = inMemoryStore.get(key) || [];

  // Remove old requests outside the window
  requests = requests.filter((timestamp) => timestamp > windowStart);

  // Add current request
  requests.push(now);

  // Update store
  inMemoryStore.set(key, requests);

  return requests.length;
}

/**
 * Removes a request from the rate limit counter
 * Used when skipSuccessfulRequests is true
 */
async function removeRequest(key: string, timestamp: number): Promise<void> {
  try {
    if (redis) {
      await redis.zrem(key, `${timestamp}`);
    } else {
      const requests = inMemoryStore.get(key) || [];
      const filtered = requests.filter((t) => t !== timestamp);
      inMemoryStore.set(key, filtered);
    }
  } catch (error) {
    logger.error('Failed to remove request from rate limiter', { error });
  }
}

/**
 * Pre-configured rate limiters for common use cases
 */

// Standard API rate limiter: 100 requests per minute per user
export const standardRateLimiter = perUserRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  keyPrefix: 'api_rate_limit',
});

// Sync endpoint rate limiter: 10 requests per second per user
export const syncRateLimiter = perUserRateLimiter({
  windowMs: 1000, // 1 second
  maxRequests: 10,
  keyPrefix: 'sync_rate_limit',
});

// AI endpoint rate limiter: 20 requests per minute per user
export const aiRateLimiter = perUserRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20,
  keyPrefix: 'ai_rate_limit',
});

// Auth endpoint rate limiter: 5 login attempts per 15 minutes
// Doesn't count successful logins
export const authRateLimiter = perUserRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  keyPrefix: 'auth_rate_limit',
  skipSuccessfulRequests: true,
});

/**
 * Cleanup function for graceful shutdown
 */
export async function closeRateLimiter(): Promise<void> {
  if (redis) {
    await redis.quit();
    logger.info('Redis rate limiter connection closed');
  }
  inMemoryStore.clear();
}
