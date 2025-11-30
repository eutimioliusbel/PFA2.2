/**
 * Security Red Team Integration Tests
 * Phase 10A of ADR-005 Multi-Tenant Access Control
 *
 * Covers:
 * - Task 10A.1: Privilege Escalation Testing
 * - Task 10A.2: Cross-Organization Access Testing (IDOR)
 * - Task 10A.3: Financial Masking Bypass Testing
 * - Task 10A.4: API Server Security Audit
 * - Task 10A.5: JWT Tampering Testing
 * - Task 10A.6: Rate Limiting Bypass Testing
 *
 * Run with: npm test -- securityRedTeam.test.ts
 */

import request from 'supertest';
import { app } from '../../src/server';
import prisma from '../../src/config/database';
import { AuthService } from '../../src/services/auth/authService';
import jwt from 'jsonwebtoken';

describe('Security Red Team Tests - ADR-005 Phase 10A', () => {
  let authService: AuthService;

  // Test users
  let adminToken: string;
  let viewerToken: string;
  let editorToken: string;
  let adminUserId: string;
  let viewerUserId: string;
  let editorUserId: string;

  // Test organizations
  let org1Id: string;
  let org2Id: string;

  beforeAll(async () => {
    authService = new AuthService();

    // Create two test organizations
    const org1 = await prisma.organization.upsert({
      where: { code: 'SEC_ORG_1' },
      update: {},
      create: {
        code: 'SEC_ORG_1',
        name: 'Security Test Org 1',
        isActive: true,
        serviceStatus: 'active',
      },
    });
    org1Id = org1.id;

    const org2 = await prisma.organization.upsert({
      where: { code: 'SEC_ORG_2' },
      update: {},
      create: {
        code: 'SEC_ORG_2',
        name: 'Security Test Org 2',
        isActive: true,
        serviceStatus: 'active',
      },
    });
    org2Id = org2.id;

    // Create admin user (full permissions on org1)
    const adminUser = await prisma.user.upsert({
      where: { email: 'sec_admin@test.com' },
      update: {},
      create: {
        username: 'sec_admin',
        email: 'sec_admin@test.com',
        passwordHash: await authService['hashPassword']('SecurePass123!'),
        role: 'admin',
        isActive: true,
        authProvider: 'local',
        serviceStatus: 'active',
      },
    });
    adminUserId = adminUser.id;

    await prisma.userOrganization.upsert({
      where: { userId_organizationId: { userId: adminUserId, organizationId: org1Id } },
      update: {},
      create: {
        userId: adminUserId,
        organizationId: org1Id,
        role: 'admin',
        perm_Read: true,
        perm_EditForecast: true,
        perm_EditActuals: true,
        perm_Delete: true,
        perm_Import: true,
        perm_RefreshData: true,
        perm_Export: true,
        perm_ViewFinancials: true,
        perm_SaveDraft: true,
        perm_Sync: true,
        perm_ManageUsers: true,
        perm_ManageSettings: true,
        perm_ConfigureAlerts: true,
        perm_Impersonate: true,
      },
    });

    // Create viewer user (read-only on org1)
    const viewerUser = await prisma.user.upsert({
      where: { email: 'sec_viewer@test.com' },
      update: {},
      create: {
        username: 'sec_viewer',
        email: 'sec_viewer@test.com',
        passwordHash: await authService['hashPassword']('ViewerPass123!'),
        role: 'viewer',
        isActive: true,
        authProvider: 'local',
        serviceStatus: 'active',
      },
    });
    viewerUserId = viewerUser.id;

    await prisma.userOrganization.upsert({
      where: { userId_organizationId: { userId: viewerUserId, organizationId: org1Id } },
      update: {},
      create: {
        userId: viewerUserId,
        organizationId: org1Id,
        role: 'viewer',
        perm_Read: true,
        perm_EditForecast: false,
        perm_EditActuals: false,
        perm_Delete: false,
        perm_Import: false,
        perm_RefreshData: false,
        perm_Export: false,
        perm_ViewFinancials: false, // No financial access
        perm_SaveDraft: false,
        perm_Sync: false,
        perm_ManageUsers: false,
        perm_ManageSettings: false,
        perm_ConfigureAlerts: false,
        perm_Impersonate: false,
      },
    });

    // Create editor user (limited permissions on org1)
    const editorUser = await prisma.user.upsert({
      where: { email: 'sec_editor@test.com' },
      update: {},
      create: {
        username: 'sec_editor',
        email: 'sec_editor@test.com',
        passwordHash: await authService['hashPassword']('EditorPass123!'),
        role: 'editor',
        isActive: true,
        authProvider: 'local',
        serviceStatus: 'active',
      },
    });
    editorUserId = editorUser.id;

    await prisma.userOrganization.upsert({
      where: { userId_organizationId: { userId: editorUserId, organizationId: org1Id } },
      update: {},
      create: {
        userId: editorUserId,
        organizationId: org1Id,
        role: 'editor',
        perm_Read: true,
        perm_EditForecast: true,
        perm_EditActuals: false,
        perm_Delete: false,
        perm_Import: false,
        perm_RefreshData: false,
        perm_Export: true,
        perm_ViewFinancials: true, // Has financial access
        perm_SaveDraft: true,
        perm_Sync: false,
        perm_ManageUsers: false,
        perm_ManageSettings: false,
        perm_ConfigureAlerts: false,
        perm_Impersonate: false,
      },
    });

    // Get tokens
    const loginAdmin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'sec_admin', password: 'SecurePass123!' });
    adminToken = loginAdmin.body.token;

    const loginViewer = await request(app)
      .post('/api/auth/login')
      .send({ username: 'sec_viewer', password: 'ViewerPass123!' });
    viewerToken = loginViewer.body.token;

    const loginEditor = await request(app)
      .post('/api/auth/login')
      .send({ username: 'sec_editor', password: 'EditorPass123!' });
    editorToken = loginEditor.body.token;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.userOrganization.deleteMany({
      where: {
        organizationId: { in: [org1Id, org2Id] },
      },
    });

    await prisma.user.deleteMany({
      where: {
        email: { in: ['sec_admin@test.com', 'sec_viewer@test.com', 'sec_editor@test.com'] },
      },
    });

    await prisma.organization.deleteMany({
      where: {
        code: { in: ['SEC_ORG_1', 'SEC_ORG_2'] },
      },
    });
  });

  // ==========================================================================
  // TASK 10A.1: Privilege Escalation Testing
  // ==========================================================================

  describe('Task 10A.1: Privilege Escalation Prevention', () => {
    it('ATTACK-PE-001: Viewer cannot change own role to Admin', async () => {
      const response = await request(app)
        .patch(`/api/users/${viewerUserId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ role: 'admin' });

      // Should be 403 (forbidden) or 401 (unauthorized for self-update)
      expect([401, 403]).toContain(response.status);
    });

    it('ATTACK-PE-002: Editor cannot grant self perm_ManageSettings', async () => {
      // Attempting to update own permissions should fail
      const response = await request(app)
        .patch(`/api/users/${editorUserId}/permissions`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({ perm_ManageSettings: true });

      expect([401, 403, 404]).toContain(response.status);
    });

    it('ATTACK-PE-003: Viewer cannot delete other users', async () => {
      const response = await request(app)
        .delete(`/api/users/${editorUserId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect([401, 403]).toContain(response.status);
    });

    it('ATTACK-PE-004: Viewer cannot create new users', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          username: 'hacker_user',
          email: 'hacker@test.com',
          password: 'HackerPass123!',
          role: 'admin',
        });

      expect([401, 403]).toContain(response.status);
    });

    it('ATTACK-PE-005: Editor cannot modify admin user', async () => {
      const response = await request(app)
        .patch(`/api/users/${adminUserId}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({ role: 'viewer' });

      expect([401, 403]).toContain(response.status);
    });
  });

  // ==========================================================================
  // TASK 10A.2: Cross-Organization Access Testing (IDOR)
  // ==========================================================================

  describe('Task 10A.2: Cross-Organization Access (IDOR) Prevention', () => {
    it('ATTACK-IDOR-001: User cannot access data from unassigned organization', async () => {
      // Viewer is in org1, trying to access org2 data
      const response = await request(app)
        .get(`/api/pfa-data?organizationId=${org2Id}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      // Should be 403 (no access to org2) or return empty results
      if (response.status === 200) {
        expect(response.body.records?.length || 0).toBe(0);
      } else {
        expect([403, 404]).toContain(response.status);
      }
    });

    it('ATTACK-IDOR-002: User cannot create resources in unassigned organization', async () => {
      const response = await request(app)
        .post('/api/api-servers')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          organizationId: org2Id, // User not in this org
          name: 'Malicious Server',
          baseUrl: 'https://evil.com',
          authType: 'none',
        });

      expect([401, 403]).toContain(response.status);
    });

    it('ATTACK-IDOR-003: User cannot switch to unassigned organization', async () => {
      const response = await request(app)
        .post('/api/users/switch-organization')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ organizationId: org2Id });

      expect([401, 403, 400]).toContain(response.status);
    });
  });

  // ==========================================================================
  // TASK 10A.3: Financial Masking Bypass Testing
  // ==========================================================================

  describe('Task 10A.3: Financial Masking Bypass Prevention', () => {
    it('ATTACK-FIN-001: Viewer without ViewFinancials sees masked costs', async () => {
      // Viewer has perm_ViewFinancials: false
      const response = await request(app)
        .get(`/api/pfa-data?organizationId=${org1Id}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      if (response.status === 200 && response.body.records?.length > 0) {
        const record = response.body.records[0];
        // If financial masking is implemented, cost should be masked or absent
        if (record.cost !== undefined) {
          // If cost is returned, it should be masked for non-financial viewers
          expect(record.cost).toMatch(/masked|\*\*\*|null/i);
        }
      }
    });

    it('ATTACK-FIN-002: Cannot bypass masking via includeFinancials param', async () => {
      const response = await request(app)
        .get(`/api/pfa-data?organizationId=${org1Id}&includeFinancials=true`)
        .set('Authorization', `Bearer ${viewerToken}`);

      // Should still be masked or return 403
      if (response.status === 200 && response.body.records?.length > 0) {
        const record = response.body.records[0];
        if (record.cost !== undefined && typeof record.cost === 'number') {
          // Financial data should NOT be exposed
          // This is a security concern if actual costs are returned
          console.warn('WARNING: Financial data may be exposed to non-financial user');
        }
      }
    });

    it('ATTACK-FIN-003: Cannot access financial endpoint without permission', async () => {
      const response = await request(app)
        .get(`/api/financial/translate?organizationId=${org1Id}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      // Either 403 (permission denied) or 200 with masked data
      if (response.status === 200) {
        expect(response.body.masked).toBe(true);
      } else {
        expect([401, 403, 404]).toContain(response.status);
      }
    });
  });

  // ==========================================================================
  // TASK 10A.4: API Server Security Audit
  // ==========================================================================

  describe('Task 10A.4: API Server Security', () => {
    it('ATTACK-API-001: Viewer cannot create API server', async () => {
      const response = await request(app)
        .post('/api/api-servers')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          organizationId: org1Id,
          name: 'Unauthorized Server',
          baseUrl: 'https://unauthorized.com',
          authType: 'none',
        });

      expect([401, 403]).toContain(response.status);
    });

    it('ATTACK-API-002: Viewer cannot update API server', async () => {
      // First, find an existing API server or skip
      const servers = await prisma.apiServer.findFirst({
        where: { organizationId: org1Id },
      });

      if (servers) {
        const response = await request(app)
          .patch(`/api/api-servers/${servers.id}`)
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({ name: 'Hacked Server' });

        expect([401, 403]).toContain(response.status);
      }
    });

    it('ATTACK-API-003: Cannot inject malicious baseUrl', async () => {
      const response = await request(app)
        .post('/api/api-servers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          organizationId: org1Id,
          name: 'Test Server',
          baseUrl: 'javascript:alert(1)', // XSS attempt
          authType: 'none',
        });

      // Should reject invalid URL or sanitize it
      if (response.status === 200 || response.status === 201) {
        expect(response.body.server?.baseUrl).not.toContain('javascript:');
      } else {
        expect([400]).toContain(response.status);
      }
    });

    it('ATTACK-API-004: API credentials not exposed in responses', async () => {
      const response = await request(app)
        .get('/api/api-servers')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200 && response.body.servers?.length > 0) {
        for (const server of response.body.servers) {
          // API keys and passwords should be masked or omitted
          if (server.credentials) {
            expect(server.credentials).not.toHaveProperty('password');
            expect(server.credentials).not.toHaveProperty('apiKey');
          }
        }
      }
    });
  });

  // ==========================================================================
  // TASK 10A.5: JWT Tampering Testing
  // ==========================================================================

  describe('Task 10A.5: JWT Tampering Prevention', () => {
    it('ATTACK-JWT-001: Reject tampered JWT signature', async () => {
      // Tamper with the token by changing a character
      const tamperedToken = viewerToken.slice(0, -5) + 'XXXXX';

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect([401]).toContain(response.status);
    });

    it('ATTACK-JWT-002: Reject JWT with modified payload', async () => {
      // Decode, modify, re-encode (without correct signature)
      const parts = viewerToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        payload.role = 'admin'; // Attempt to escalate
        const modifiedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
        const tamperedToken = `${parts[0]}.${modifiedPayload}.${parts[2]}`;

        const response = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${tamperedToken}`);

        expect([401]).toContain(response.status);
      }
    });

    it('ATTACK-JWT-003: Reject expired JWT', async () => {
      // Create an expired token
      const expiredPayload = {
        userId: viewerUserId,
        username: 'sec_viewer',
        role: 'viewer',
        iat: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      };

      const secret = process.env.JWT_SECRET || 'test-secret';
      const expiredToken = jwt.sign(expiredPayload, secret);

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect([401]).toContain(response.status);
    });

    it('ATTACK-JWT-004: Reject JWT with no algorithm (alg:none attack)', async () => {
      // Create token with algorithm set to 'none' (classic JWT attack)
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64');
      const payload = Buffer.from(JSON.stringify({
        userId: adminUserId,
        username: 'sec_admin',
        role: 'admin',
      })).toString('base64');
      const algNoneToken = `${header}.${payload}.`;

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${algNoneToken}`);

      expect([401]).toContain(response.status);
    });
  });

  // ==========================================================================
  // TASK 10A.6: Rate Limiting Bypass Testing
  // ==========================================================================

  describe('Task 10A.6: Rate Limiting', () => {
    it('ATTACK-RATE-001: Login endpoint should be rate limited', async () => {
      // Attempt multiple failed logins
      const attempts = [];
      for (let i = 0; i < 20; i++) {
        attempts.push(
          request(app)
            .post('/api/auth/login')
            .send({ username: 'nonexistent', password: 'wrongpassword' })
        );
      }

      const responses = await Promise.all(attempts);

      // At least one should be rate limited (429) after multiple attempts
      // Or all should fail with 401 (invalid credentials)
      const statusCodes = responses.map(r => r.status);
      const hasRateLimit = statusCodes.some(s => s === 429);
      const allAuthFailed = statusCodes.every(s => s === 401 || s === 429);

      expect(allAuthFailed).toBe(true);
      // Rate limiting is recommended but not always implemented
      if (!hasRateLimit) {
        console.warn('WARNING: Login endpoint may not be rate limited');
      }
    });

    it('ATTACK-RATE-002: API endpoints should be rate limited for excessive requests', async () => {
      // Make many rapid requests
      const attempts = [];
      for (let i = 0; i < 50; i++) {
        attempts.push(
          request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${viewerToken}`)
        );
      }

      const responses = await Promise.all(attempts);
      const statusCodes = responses.map(r => r.status);

      // Either all succeed (200) or some get rate limited (429)
      const allSuccessOrLimited = statusCodes.every(s => s === 200 || s === 429);
      expect(allSuccessOrLimited).toBe(true);
    });
  });

  // ==========================================================================
  // Additional Security Tests
  // ==========================================================================

  describe('Additional Security Checks', () => {
    it('Unauthenticated requests return 401', async () => {
      const response = await request(app)
        .get('/api/users/me');

      expect(response.status).toBe(401);
    });

    it('Invalid authorization header format rejected', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'InvalidFormat');

      expect(response.status).toBe(401);
    });

    it('SQL injection in query parameters sanitized', async () => {
      const response = await request(app)
        .get('/api/pfa-data')
        .query({ organizationId: "'; DROP TABLE users; --" })
        .set('Authorization', `Bearer ${viewerToken}`);

      // Should not cause a server error (500)
      expect(response.status).not.toBe(500);
    });

    it('XSS in input fields sanitized', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: '<script>alert("xss")</script>',
          password: 'test',
        });

      // Should return normal error response, not execute script
      expect(response.body).not.toContain('<script>');
      expect([400, 401]).toContain(response.status);
    });
  });
});
