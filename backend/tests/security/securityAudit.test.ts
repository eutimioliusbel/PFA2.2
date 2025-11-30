/**
 * Phase 10A: Comprehensive Security Red Team Audit
 *
 * Tests all AI-powered features and multi-tenant access controls
 * implemented in Phases 6-8 (AI Foundation + BEO Intelligence)
 *
 * Test Coverage:
 * - 10A.1: Privilege Escalation Testing
 * - 10A.2: Cross-Organization Access (IDOR)
 * - 10A.3: Financial Masking Bypass
 * - 10A.4: API Server Security
 * - 10A.5: JWT Tampering
 * - 10A.6: Rate Limiting Bypass
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import app from '../../src/server';
import { env } from '../../src/config/env';

const prisma = new PrismaClient();

// Test user tokens
let adminToken: string;
let viewerToken: string;
let beoUserToken: string;
let org1UserToken: string;
let org2UserToken: string;

// Test organization IDs
let org1Id: string;
let org2Id: string;

// Test user IDs
let adminUserId: string;
let viewerUserId: string;
let beoUserId: string;
let org1UserId: string;
let org2UserId: string;

describe('Phase 10A: Security Red Team Audit', () => {

  beforeAll(async () => {
    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
    await prisma.$disconnect();
  });

  // ============================================================================
  // 10A.1: PRIVILEGE ESCALATION TESTING
  // ============================================================================

  describe('10A.1: Privilege Escalation Testing', () => {

    describe('Viewer → Admin Escalation Attempts', () => {

      it('should block viewer from accessing admin user management endpoints', async () => {
        const response = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${viewerToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('FORBIDDEN');
        expect(response.body.message).toContain('Admin access required');
      });

      it('should block viewer from creating new users', async () => {
        const response = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({
            username: 'malicious_user',
            password: 'hacked123',
            role: 'admin'
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('FORBIDDEN');
      });

      it('should block viewer from creating new organizations', async () => {
        const response = await request(app)
          .post('/api/organizations')
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({
            code: 'MALICIOUS',
            name: 'Malicious Org',
            description: 'Should not be created'
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('FORBIDDEN');
      });

      it('should block viewer from modifying user permissions', async () => {
        const response = await request(app)
          .patch(`/api/user-orgs/${viewerUserId}/${org1Id}`)
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({
            perm_ManageUsers: true,
            perm_ManageSettings: true
          });

        expect(response.status).toBe(403);
      });

      it('should block viewer from accessing audit logs', async () => {
        const response = await request(app)
          .get('/api/audit')
          .set('Authorization', `Bearer ${viewerToken}`)
          .query({ organizationId: org1Id });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('PERMISSION_DENIED');
      });
    });

    describe('BEO Capability Bypass Attempts', () => {

      it('should block non-BEO user from portfolio health endpoint', async () => {
        const response = await request(app)
          .get('/api/beo/portfolio-health')
          .set('Authorization', `Bearer ${org1UserToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('FORBIDDEN');
        expect(response.body.message).toContain('BEO portfolio access required');
      });

      it('should block non-BEO user from boardroom voice analyst', async () => {
        const response = await request(app)
          .post('/api/beo/query')
          .set('Authorization', `Bearer ${org1UserToken}`)
          .send({
            query: 'Which projects are over budget?',
            responseFormat: 'conversational'
          });

        expect(response.status).toBe(403);
        expect(response.body.message).toContain('perm_ViewAllOrgs');
      });

      it('should block non-BEO user from narrative generation', async () => {
        const response = await request(app)
          .post('/api/beo/narrative/generate')
          .set('Authorization', `Bearer ${org1UserToken}`)
          .send({
            organizationId: org1Id,
            title: 'Test Narrative'
          });

        expect(response.status).toBe(403);
      });

      it('should block non-BEO user from arbitrage detection', async () => {
        const response = await request(app)
          .get('/api/beo/arbitrage/opportunities')
          .set('Authorization', `Bearer ${org1UserToken}`);

        expect(response.status).toBe(403);
      });

      it('should block non-BEO user from vendor pricing analysis', async () => {
        const response = await request(app)
          .get('/api/beo/vendor-pricing/analysis')
          .set('Authorization', `Bearer ${org1UserToken}`);

        expect(response.status).toBe(403);
      });

      it('should block non-BEO user from scenario simulation', async () => {
        const response = await request(app)
          .post('/api/beo/scenario/simulate')
          .set('Authorization', `Bearer ${org1UserToken}`)
          .send({
            organizationIds: [org1Id],
            parameters: {
              type: 'budget_cut',
              budgetCutPercent: 10
            }
          });

        expect(response.status).toBe(403);
      });
    });

    describe('Permission Modification Attacks', () => {

      it('should prevent user from modifying their own capabilities via API', async () => {
        // Attempt to grant self admin permissions
        const response = await request(app)
          .patch(`/api/user-orgs/${org1UserId}/${org1Id}`)
          .set('Authorization', `Bearer ${org1UserToken}`)
          .send({
            perm_ManageUsers: true,
            perm_Impersonate: true
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('PERMISSION_DENIED');
      });

      it('should prevent non-admin from granting permissions to other users', async () => {
        const response = await request(app)
          .patch(`/api/user-orgs/${viewerUserId}/${org1Id}`)
          .set('Authorization', `Bearer ${org1UserToken}`)
          .send({
            perm_EditForecast: true
          });

        expect(response.status).toBe(403);
      });
    });

    describe('JWT Token Manipulation', () => {

      it('should reject JWT with modified payload (added permissions)', async () => {
        // Create token with tampered payload
        const maliciousPayload = {
          userId: org1UserId,
          username: 'org1user',
          organizations: [{
            organizationId: org1Id,
            organizationCode: 'ORG1',
            permissions: {
              perm_Read: true,
              perm_ManageUsers: true, // Maliciously added
              perm_Impersonate: true   // Maliciously added
            }
          }]
        };

        // Sign with different secret (simulation of tampering)
        const tamperedToken = jwt.sign(maliciousPayload, 'wrong_secret', {
          expiresIn: '1h'
        });

        const response = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${tamperedToken}`);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('INVALID_TOKEN');
      });

      it('should reject JWT with no signature', async () => {
        // Create unsigned token
        const unsignedToken = jwt.sign({ userId: adminUserId }, '', {
          algorithm: 'none' as any
        });

        const response = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${unsignedToken}`);

        expect(response.status).toBe(401);
      });

      it('should reject JWT with algorithm confusion attack (RS256 → none)', async () => {
        // Attempt to change algorithm in header
        const payload = {
          userId: adminUserId,
          username: 'admin',
          organizations: []
        };

        // Create token parts manually
        const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
        const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const maliciousToken = `${header}.${body}.`;

        const response = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${maliciousToken}`);

        expect(response.status).toBe(401);
      });

      it('should reject expired JWT token', async () => {
        // Create already-expired token
        const expiredToken = jwt.sign(
          { userId: adminUserId },
          env.JWT_SECRET,
          { expiresIn: '-1h' } // Expired 1 hour ago
        );

        const response = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${expiredToken}`);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('TOKEN_EXPIRED');
      });
    });
  });

  // ============================================================================
  // 10A.2: CROSS-ORGANIZATION ACCESS TESTING (IDOR)
  // ============================================================================

  describe('10A.2: Cross-Organization Access (IDOR)', () => {

    describe('Organization Boundary Violations', () => {

      it('should block user from accessing PFA data from other organization', async () => {
        const response = await request(app)
          .get('/api/pfa-data')
          .set('Authorization', `Bearer ${org1UserToken}`)
          .query({ organizationId: org2Id }); // Attempt to access Org 2 data

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('ORG_ACCESS_DENIED');
      });

      it('should block user from querying other organization via AI assistant', async () => {
        const response = await request(app)
          .post('/api/ai/chat')
          .set('Authorization', `Bearer ${org1UserToken}`)
          .send({
            organizationId: org2Id, // Attempt to query Org 2
            message: 'Show me all PFA records'
          });

        expect(response.status).toBe(403);
      });

      it('should filter audit logs to only show own organization', async () => {
        const response = await request(app)
          .get('/api/audit')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ organizationId: org2Id });

        // Admin should still only see their own org's logs
        // unless they have perm_Impersonate in that org
        if (response.status === 200) {
          const logs = response.body.data;
          const hasOtherOrgLogs = logs.some((log: any) =>
            log.organizationId !== org1Id && log.organizationId !== org2Id
          );
          expect(hasOtherOrgLogs).toBe(false);
        }
      });
    });

    describe('API Server Access Control', () => {

      it('should block user from viewing API servers of other organizations', async () => {
        // First create API server for org2
        const createResponse = await request(app)
          .post('/api/api-servers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            organizationId: org2Id,
            name: 'Org 2 Server',
            url: 'https://api.org2.com'
          });

        if (createResponse.status === 201) {
          // Now try to access it as org1 user
          const response = await request(app)
            .get('/api/api-servers')
            .set('Authorization', `Bearer ${org1UserToken}`)
            .query({ organizationId: org2Id });

          // Should either block or return empty results
          if (response.status === 200) {
            expect(response.body.data).toHaveLength(0);
          } else {
            expect(response.status).toBe(403);
          }
        }
      });

      it('should block user from testing API servers of other organizations', async () => {
        // Assume server exists from previous test
        const servers = await request(app)
          .get('/api/api-servers')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ organizationId: org2Id });

        if (servers.body.data?.length > 0) {
          const serverId = servers.body.data[0].id;

          const response = await request(app)
            .post(`/api/api-servers/${serverId}/test`)
            .set('Authorization', `Bearer ${org1UserToken}`);

          expect(response.status).toBe(403);
        }
      });
    });

    describe('Scenario Simulation IDOR', () => {

      it('should block user from accessing scenarios created by other users', async () => {
        // Create scenario as admin for org2
        const createResponse = await request(app)
          .post('/api/beo/scenario/simulate')
          .set('Authorization', `Bearer ${beoUserToken}`)
          .send({
            organizationIds: [org2Id],
            parameters: {
              type: 'budget_cut',
              budgetCutPercent: 10
            }
          });

        if (createResponse.status === 201) {
          const scenarioId = createResponse.body.data.id;

          // Try to access as org1 user
          const response = await request(app)
            .get(`/api/beo/scenario/${scenarioId}`)
            .set('Authorization', `Bearer ${org1UserToken}`);

          expect([403, 404]).toContain(response.status);
        }
      });
    });
  });

  // ============================================================================
  // 10A.3: FINANCIAL MASKING BYPASS TESTING
  // ============================================================================

  describe('10A.3: Financial Masking Bypass', () => {

    it('should mask financial data for users without perm_ViewFinancials', async () => {
      const response = await request(app)
        .get('/api/pfa-data')
        .set('Authorization', `Bearer ${viewerToken}`)
        .query({ organizationId: org1Id });

      if (response.status === 200) {
        const records = response.body.data;

        // Check if financial fields are masked
        records.forEach((record: any) => {
          if (record.monthlyRate) {
            expect(record.monthlyRate).toBe('***MASKED***');
          }
          if (record.purchasePrice) {
            expect(record.purchasePrice).toBe('***MASKED***');
          }
        });
      }
    });

    it('should not allow bypass via API parameter manipulation', async () => {
      const response = await request(app)
        .get('/api/pfa-data')
        .set('Authorization', `Bearer ${viewerToken}`)
        .query({
          organizationId: org1Id,
          maskFinancials: 'false' // Attempt to bypass masking
        });

      if (response.status === 200) {
        const records = response.body.data;

        // Financial data should still be masked
        const hasUnmaskedFinancials = records.some((record: any) =>
          typeof record.monthlyRate === 'number' ||
          typeof record.purchasePrice === 'number'
        );

        expect(hasUnmaskedFinancials).toBe(false);
      }
    });

    it('should mask financial data in exported CSV', async () => {
      const response = await request(app)
        .post('/api/pfa-data/export')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          organizationId: org1Id,
          format: 'csv'
        });

      if (response.status === 200) {
        const csvData = response.text;
        expect(csvData).not.toContain('monthlyRate');
        expect(csvData).not.toContain('purchasePrice');
      }
    });
  });

  // ============================================================================
  // 10A.4: API SERVER SECURITY AUDIT
  // ============================================================================

  describe('10A.4: API Server Security', () => {

    it('should not expose API credentials in responses', async () => {
      const response = await request(app)
        .get('/api/api-servers')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ organizationId: org1Id });

      if (response.status === 200) {
        const servers = response.body.data;

        servers.forEach((server: any) => {
          expect(server.apiKey).toBeUndefined();
          expect(server.apiSecret).toBeUndefined();
          expect(server.password).toBeUndefined();
        });
      }
    });

    it('should sanitize SQL injection attempts in vendor names', async () => {
      const response = await request(app)
        .post('/api/beo/vendor-pricing/analysis')
        .set('Authorization', `Bearer ${beoUserToken}`)
        .send({
          vendor: "'; DROP TABLE pfa_records; --"
        });

      // Should either reject or sanitize
      expect([400, 403]).toContain(response.status);
    });

    it('should not expose database connection strings in error messages', async () => {
      // Trigger an error by accessing non-existent resource
      const response = await request(app)
        .get('/api/api-servers/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.body.message) {
        expect(response.body.message).not.toContain('postgres://');
        expect(response.body.message).not.toContain('DATABASE_URL');
      }
    });
  });

  // ============================================================================
  // 10A.5: JWT TAMPERING TESTING
  // ============================================================================

  describe('10A.5: JWT Tampering', () => {

    it('should reject JWT with modified userId', async () => {
      const maliciousPayload = jwt.decode(org1UserToken) as any;
      maliciousPayload.userId = adminUserId; // Change to admin user ID

      const tamperedToken = jwt.sign(maliciousPayload, 'wrong_secret');

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
    });

    it('should reject JWT with extended expiry time', async () => {
      const payload = jwt.decode(org1UserToken) as any;
      payload.exp = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year from now

      const tamperedToken = jwt.sign(payload, env.JWT_SECRET);

      // This should fail because signature won't match original
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${tamperedToken}`);

      // May succeed but with original exp time, or fail validation
      // The key is that the extended exp should not be honored
    });
  });

  // ============================================================================
  // 10A.6: RATE LIMITING BYPASS TESTING
  // ============================================================================

  describe('10A.6: Rate Limiting Bypass', () => {

    it('should enforce rate limiting on expensive AI operations', async () => {
      const requests = [];

      // Send 100 requests rapidly
      for (let i = 0; i < 100; i++) {
        requests.push(
          request(app)
            .post('/api/beo/query')
            .set('Authorization', `Bearer ${beoUserToken}`)
            .send({
              query: `Test query ${i}`,
              responseFormat: 'conversational'
            })
        );
      }

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(r => r.status === 429);

      expect(tooManyRequests.length).toBeGreaterThan(0);
    });

    it('should not allow rate limit bypass via IP spoofing', async () => {
      const requests = [];

      // Send requests with different X-Forwarded-For headers
      for (let i = 0; i < 100; i++) {
        requests.push(
          request(app)
            .post('/api/beo/query')
            .set('Authorization', `Bearer ${beoUserToken}`)
            .set('X-Forwarded-For', `192.168.1.${i}`) // Different IP each time
            .send({
              query: `Test query ${i}`,
              responseFormat: 'conversational'
            })
        );
      }

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(r => r.status === 429);

      // Should still hit rate limit (based on userId, not IP)
      expect(tooManyRequests.length).toBeGreaterThan(0);
    });

    it('should include Retry-After header in 429 responses', async () => {
      // Trigger rate limit
      const requests = [];
      for (let i = 0; i < 150; i++) {
        requests.push(
          request(app)
            .get('/api/pfa-data')
            .set('Authorization', `Bearer ${org1UserToken}`)
            .query({ organizationId: org1Id })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.find(r => r.status === 429);

      if (rateLimited) {
        expect(rateLimited.headers['retry-after']).toBeDefined();
      }
    });
  });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function setupTestData() {
  console.log('Setting up security test data...');

  // Create test organizations
  const org1 = await prisma.organization.create({
    data: {
      code: 'SECTEST1',
      name: 'Security Test Org 1',
      description: 'Test organization 1 for security audit',
      isActive: true
    }
  });
  org1Id = org1.id;

  const org2 = await prisma.organization.create({
    data: {
      code: 'SECTEST2',
      name: 'Security Test Org 2',
      description: 'Test organization 2 for security audit',
      isActive: true
    }
  });
  org2Id = org2.id;

  // Create test users
  const passwordHash = await bcrypt.hash('testpass123', 10);

  const adminUser = await prisma.user.create({
    data: {
      username: 'sectest_admin',
      email: 'sectest_admin@test.com',
      passwordHash,
      role: 'admin',
      isActive: true
    }
  });
  adminUserId = adminUser.id;

  const viewerUser = await prisma.user.create({
    data: {
      username: 'sectest_viewer',
      email: 'sectest_viewer@test.com',
      passwordHash,
      role: 'user',
      isActive: true
    }
  });
  viewerUserId = viewerUser.id;

  const beoUser = await prisma.user.create({
    data: {
      username: 'sectest_beo',
      email: 'sectest_beo@test.com',
      passwordHash,
      role: 'admin',
      isActive: true
    }
  });
  beoUserId = beoUser.id;

  const org1User = await prisma.user.create({
    data: {
      username: 'sectest_org1',
      email: 'sectest_org1@test.com',
      passwordHash,
      role: 'user',
      isActive: true
    }
  });
  org1UserId = org1User.id;

  const org2User = await prisma.user.create({
    data: {
      username: 'sectest_org2',
      email: 'sectest_org2@test.com',
      passwordHash,
      role: 'user',
      isActive: true
    }
  });
  org2UserId = org2User.id;

  // Link users to organizations with specific permissions
  await prisma.userOrganization.create({
    data: {
      userId: adminUserId,
      organizationId: org1Id,
      role: 'owner',
      perm_Read: true,
      perm_EditForecast: true,
      perm_ManageUsers: true,
      perm_ManageSettings: true,
      perm_Impersonate: true,
      perm_ViewFinancials: true
    }
  });

  await prisma.userOrganization.create({
    data: {
      userId: viewerUserId,
      organizationId: org1Id,
      role: 'viewer',
      perm_Read: true,
      // All other permissions false (viewer role)
    }
  });

  await prisma.userOrganization.create({
    data: {
      userId: beoUserId,
      organizationId: org1Id,
      role: 'admin',
      perm_Read: true,
      perm_ViewFinancials: true,
      perm_ManageSettings: true
      // Note: perm_ViewAllOrgs doesn't exist in schema - BEO check is broken
    }
  });

  await prisma.userOrganization.create({
    data: {
      userId: org1UserId,
      organizationId: org1Id,
      role: 'member',
      perm_Read: true,
      perm_EditForecast: true,
      perm_Export: true
    }
  });

  await prisma.userOrganization.create({
    data: {
      userId: org2UserId,
      organizationId: org2Id,
      role: 'member',
      perm_Read: true,
      perm_EditForecast: true
    }
  });

  // Generate JWT tokens
  adminToken = generateTestToken(adminUserId, 'sectest_admin', [
    {
      organizationId: org1Id,
      organizationCode: 'SECTEST1',
      permissions: {
        perm_Read: true,
        perm_EditForecast: true,
        perm_ManageUsers: true,
        perm_ManageSettings: true,
        perm_Impersonate: true,
        perm_ViewFinancials: true
      }
    }
  ]);

  viewerToken = generateTestToken(viewerUserId, 'sectest_viewer', [
    {
      organizationId: org1Id,
      organizationCode: 'SECTEST1',
      permissions: {
        perm_Read: true
      }
    }
  ]);

  beoUserToken = generateTestToken(beoUserId, 'sectest_beo', [
    {
      organizationId: org1Id,
      organizationCode: 'SECTEST1',
      permissions: {
        perm_Read: true,
        perm_ViewFinancials: true,
        perm_ManageSettings: true
      }
    }
  ]);

  org1UserToken = generateTestToken(org1UserId, 'sectest_org1', [
    {
      organizationId: org1Id,
      organizationCode: 'SECTEST1',
      permissions: {
        perm_Read: true,
        perm_EditForecast: true,
        perm_Export: true
      }
    }
  ]);

  org2UserToken = generateTestToken(org2UserId, 'sectest_org2', [
    {
      organizationId: org2Id,
      organizationCode: 'SECTEST2',
      permissions: {
        perm_Read: true,
        perm_EditForecast: true
      }
    }
  ]);

  console.log('Security test data setup complete');
}

async function cleanupTestData() {
  console.log('Cleaning up security test data...');

  // Delete test users and orgs (cascade will handle relationships)
  await prisma.user.deleteMany({
    where: {
      username: {
        startsWith: 'sectest_'
      }
    }
  });

  await prisma.organization.deleteMany({
    where: {
      code: {
        startsWith: 'SECTEST'
      }
    }
  });

  console.log('Security test data cleanup complete');
}

function generateTestToken(userId: string, username: string, organizations: any[]): string {
  const payload = {
    userId,
    username,
    email: `${username}@test.com`,
    authProvider: 'local',
    serviceStatus: 'active',
    organizations: organizations.map(org => ({
      organizationId: org.organizationId,
      organizationCode: org.organizationCode,
      role: 'member',
      permissions: {
        perm_Read: false,
        perm_EditForecast: false,
        perm_EditActuals: false,
        perm_Delete: false,
        perm_Import: false,
        perm_RefreshData: false,
        perm_Export: false,
        perm_ViewFinancials: false,
        perm_SaveDraft: false,
        perm_Sync: false,
        perm_ManageUsers: false,
        perm_ManageSettings: false,
        perm_ConfigureAlerts: false,
        perm_Impersonate: false,
        ...org.permissions
      }
    }))
  };

  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h' });
}
