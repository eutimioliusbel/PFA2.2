/**
 * IDOR (Insecure Direct Object Reference) Security Test
 * Tests CRITICAL-003: Unauthorized access to other organizations' sync status
 *
 * Run: npm test -- idor-attack.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/server';
import prisma from '../../src/config/database';

describe('IDOR Attack Tests', () => {
  let userAToken: string;
  let userBToken: string;
  let orgAId: string;
  let orgBId: string;
  let userASyncId: string;
  let apiConfigId: string;

  beforeAll(async () => {
    // Setup: Create two users in different organizations

    // Create Organization A (RIO)
    const orgA = await prisma.organization.upsert({
      where: { code: 'RIO' },
      update: {},
      create: {
        code: 'RIO',
        name: 'Rio Tinto',
        isActive: true,
        isExternal: true
      }
    });
    orgAId = orgA.id;

    // Create Organization B (PORTARTHUR)
    const orgB = await prisma.organization.upsert({
      where: { code: 'PORTARTHUR' },
      update: {},
      create: {
        code: 'PORTARTHUR',
        name: 'Port Arthur',
        isActive: true,
        isExternal: true
      }
    });
    orgBId = orgB.id;

    // Create User A (RIO)
    const userARes = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'user_a_rio',
        email: 'usera@rio.com',
        password: 'SecurePass123!',
        organizationId: orgAId
      });

    if (userARes.status === 201) {
      const loginARes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'user_a_rio',
          password: 'SecurePass123!'
        });
      userAToken = loginARes.body.token;
    }

    // Create User B (PORTARTHUR)
    const userBRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'user_b_portarthur',
        email: 'userb@portarthur.com',
        password: 'SecurePass123!',
        organizationId: orgBId
      });

    if (userBRes.status === 201) {
      const loginBRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'user_b_portarthur',
          password: 'SecurePass123!'
        });
      userBToken = loginBRes.body.token;
    }

    // Get API config
    const apiConfig = await prisma.apiConfiguration.findFirst({
      where: { isActive: true }
    });
    apiConfigId = apiConfig!.id;
  });

  afterAll(async () => {
    // Cleanup test users
    await prisma.user.deleteMany({
      where: {
        username: { in: ['user_a_rio', 'user_b_portarthur'] }
      }
    });

    await prisma.$disconnect();
  });

  it('[CRITICAL-003] User A creates a sync in Organization A', async () => {
    const res = await request(app)
      .post('/api/pems/sync')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        organizationId: orgAId,
        apiConfigId: apiConfigId,
        syncType: 'full'
      });

    expect([200, 409]).toContain(res.status);

    if (res.status === 200) {
      userASyncId = res.body.syncId;
      expect(userASyncId).toBeDefined();
      console.log(`✅ User A created sync: ${userASyncId}`);
    }
  });

  it('[CRITICAL-003] User B should NOT access User A\'s sync status', async () => {
    if (!userASyncId) {
      console.warn('⚠️ Skipping test - no sync ID from previous test');
      return;
    }

    const res = await request(app)
      .get(`/api/pems/sync/${userASyncId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    // Expected: 404 Not Found (to prevent sync ID enumeration)
    // Alternative: 403 Forbidden (if you want to be explicit)
    expect([403, 404]).toContain(res.status);

    // Should NOT leak organization data
    if (res.status === 200) {
      console.error('❌ VULNERABILITY: User B accessed User A\'s sync!');
      console.error('Leaked data:', res.body);
      expect(res.status).not.toBe(200);
    } else {
      console.log('✅ IDOR attack blocked');
    }
  });

  it('[CRITICAL-003] User B should NOT access Org A sync history', async () => {
    const res = await request(app)
      .get('/api/pems/sync/history')
      .query({ organizationId: orgAId })  // User B queries Org A
      .set('Authorization', `Bearer ${userBToken}`);

    // Should return 403 Forbidden or empty results
    expect([403, 404]).toContain(res.status);

    if (res.status === 200 && res.body.history?.length > 0) {
      console.error('❌ VULNERABILITY: User B accessed Org A sync history!');
      expect(res.body.history.length).toBe(0);
    } else {
      console.log('✅ Cross-org access blocked');
    }
  });

  it('[CRITICAL-003] User B should NOT cancel User A\'s sync', async () => {
    if (!userASyncId) {
      console.warn('⚠️ Skipping test - no sync ID');
      return;
    }

    const res = await request(app)
      .post(`/api/pems/sync/${userASyncId}/cancel`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        organizationId: orgAId  // Even if User B knows the org ID
      });

    // Should return 403 Forbidden
    expect([403, 404]).toContain(res.status);

    if (res.status === 200) {
      console.error('❌ VULNERABILITY: User B cancelled User A\'s sync!');
      expect(res.status).not.toBe(200);
    } else {
      console.log('✅ Unauthorized sync cancellation blocked');
    }
  });

  it('[CRITICAL-003] User A should access their own sync status', async () => {
    if (!userASyncId) {
      console.warn('⚠️ Skipping test - no sync ID');
      return;
    }

    const res = await request(app)
      .get(`/api/pems/sync/${userASyncId}`)
      .set('Authorization', `Bearer ${userAToken}`);

    // Should succeed
    expect(res.status).toBe(200);
    expect(res.body.syncId).toBe(userASyncId);
    expect(res.body.organizationId).toBe(orgAId);
    console.log('✅ Authorized access allowed');
  });

  it('[CRITICAL-003] Admin should access all syncs (if perm_Impersonate)', async () => {
    // Login as admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'admin123'
      });

    const adminToken = adminRes.body.token;

    if (!userASyncId) {
      console.warn('⚠️ Skipping test - no sync ID');
      return;
    }

    const res = await request(app)
      .get(`/api/pems/sync/${userASyncId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Admin should have access (if they have perm_Impersonate)
    // OR should get 403 if not a member of Org A
    expect([200, 403, 404]).toContain(res.status);

    if (res.status === 200) {
      console.log('✅ Admin access allowed (has perm_Impersonate)');
    } else {
      console.log('✅ Admin blocked (not member of Org A, even with admin role)');
    }
  });

  it('[CRITICAL-003] Should prevent sync ID enumeration attack', async () => {
    // Generate predictable sync IDs (timestamp-based)
    const now = Date.now();
    const predictedSyncIds = [
      `pfa-sync-${now}`,
      `pfa-sync-${now - 1000}`,
      `pfa-sync-${now - 2000}`,
      `pfa-sync-${now + 1000}`,
      `pfa-sync-${now + 2000}`
    ];

    let foundSyncs = 0;

    for (const syncId of predictedSyncIds) {
      const res = await request(app)
        .get(`/api/pems/sync/${syncId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      if (res.status === 200) {
        foundSyncs++;
        console.warn(`⚠️ Found sync via enumeration: ${syncId}`);
      }
    }

    // Should not find any syncs via enumeration
    expect(foundSyncs).toBe(0);

    if (foundSyncs > 0) {
      console.error('❌ VULNERABILITY: Sync ID enumeration possible!');
    } else {
      console.log('✅ Sync ID enumeration blocked');
    }
  });
});
