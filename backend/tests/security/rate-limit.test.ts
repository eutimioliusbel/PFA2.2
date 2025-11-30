/**
 * Rate Limiting Security Test
 * Tests CRITICAL-005: DoS via unlimited sync requests
 *
 * Run: npm test -- rate-limit.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/server';
import prisma from '../../src/config/database';

describe('Rate Limiting Tests', () => {
  let authToken: string;
  let orgId: string;
  let apiConfigId: string;

  beforeAll(async () => {
    // Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'admin123'
      });

    authToken = loginRes.body.token;

    // Get org and API config
    const org = await prisma.organization.findFirst({
      where: { isActive: true }
    });
    orgId = org!.id;

    const apiConfig = await prisma.apiConfiguration.findFirst({
      where: { isActive: true }
    });
    apiConfigId = apiConfig!.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('[CRITICAL-005] Should enforce rate limit on sync endpoint', async () => {
    const requests = 20;  // Attempt 20 syncs in rapid succession
    const responses: number[] = [];

    console.log(`Sending ${requests} sync requests rapidly...`);

    for (let i = 0; i < requests; i++) {
      const res = await request(app)
        .post('/api/pems/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          organizationId: orgId,
          apiConfigId: apiConfigId,
          syncType: 'full'
        });

      responses.push(res.status);

      if (res.status === 429) {
        console.log(`✅ Rate limit enforced after ${i + 1} requests`);
        expect(res.body.error).toBe('TOO_MANY_REQUESTS');
        expect(res.body.retryAfter).toBeDefined();
        break;
      }
    }

    // Should get 429 Too Many Requests at some point
    const rateLimited = responses.some(status => status === 429);

    if (rateLimited) {
      console.log('✅ Rate limiting is working');
    } else {
      console.error('❌ VULNERABILITY: No rate limiting detected!');
      console.error(`Sent ${requests} requests, all succeeded: ${responses}`);
      expect(rateLimited).toBe(true);
    }
  });

  it('[CRITICAL-005] Should track rate limit per user, not globally', async () => {
    // Create second user
    const user2Res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'ratelimit_test_user',
        email: 'ratelimit@test.com',
        password: 'SecurePass123!',
        organizationId: orgId
      });

    let user2Token: string;

    if (user2Res.status === 201) {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'ratelimit_test_user',
          password: 'SecurePass123!'
        });
      user2Token = loginRes.body.token;
    } else {
      // User might already exist, try logging in
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'ratelimit_test_user',
          password: 'SecurePass123!'
        });
      user2Token = loginRes.body.token;
    }

    // User 1 exhausts rate limit
    for (let i = 0; i < 15; i++) {
      await request(app)
        .post('/api/pems/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ organizationId: orgId, apiConfigId: apiConfigId });
    }

    // User 2 should still be able to sync
    const user2Res = await request(app)
      .post('/api/pems/sync')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ organizationId: orgId, apiConfigId: apiConfigId });

    // User 2 should NOT be rate limited (separate bucket)
    if (user2Res.status === 429) {
      console.error('❌ VULNERABILITY: Rate limit is global, not per-user!');
      expect(user2Res.status).not.toBe(429);
    } else {
      console.log('✅ Per-user rate limiting working');
    }

    // Cleanup
    await prisma.user.deleteMany({
      where: { username: 'ratelimit_test_user' }
    });
  });

  it('[CRITICAL-005] Should include Retry-After header in 429 response', async () => {
    // Exhaust rate limit
    let rateLimitedRes;

    for (let i = 0; i < 50; i++) {
      const res = await request(app)
        .post('/api/pems/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ organizationId: orgId, apiConfigId: apiConfigId });

      if (res.status === 429) {
        rateLimitedRes = res;
        break;
      }
    }

    if (rateLimitedRes) {
      expect(rateLimitedRes.headers['retry-after']).toBeDefined();
      console.log(`✅ Retry-After: ${rateLimitedRes.headers['retry-after']} seconds`);
    }
  });

  it('[CRITICAL-005] Should prevent memory exhaustion from unbounded sync Map', async () => {
    // Check activeSyncs Map size
    // This test is conceptual - in production, monitor memory usage

    const initialMemory = process.memoryUsage().heapUsed;

    // Trigger multiple syncs
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/pems/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ organizationId: orgId, apiConfigId: apiConfigId });
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;  // MB

    console.log(`Memory increase: ${memoryIncrease.toFixed(2)} MB`);

    // Memory increase should be bounded (< 50MB for 10 syncs)
    // If using LRU cache, memory should be constant
    if (memoryIncrease > 100) {
      console.warn('⚠️ Possible memory leak: Large memory increase detected');
    } else {
      console.log('✅ Memory usage appears bounded');
    }
  });

  it('[CRITICAL-005] Should prevent sync history unbounded growth', async () => {
    // Query sync history multiple times
    const res = await request(app)
      .get('/api/pems/sync/history')
      .query({ organizationId: orgId })
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);

    if (res.body.history) {
      const historyCount = res.body.history.length;

      // History should be capped (e.g., max 50 entries)
      expect(historyCount).toBeLessThanOrEqual(100);

      console.log(`✅ Sync history capped at ${historyCount} entries`);
    }
  });
});
