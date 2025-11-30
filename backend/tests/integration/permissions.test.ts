/**
 * Integration Tests: Permission Enforcement
 * Phase 2, Task 2.2 - API Endpoint Authorization
 *
 * Tests verify that:
 * 1. Authenticated requests with correct permissions succeed
 * 2. Authenticated requests without permissions return 403
 * 3. Unauthenticated requests return 401
 * 4. Permission denials are logged to audit log
 *
 * Run with: npm test -- permissions.test.ts
 */

import request from 'supertest';
import { app } from '../../src/server';
import prisma from '../../src/config/database';
import { AuthService } from '../../src/services/auth/authService';

describe('Permission Enforcement - Integration Tests', () => {
  let authService: AuthService;
  let adminToken: string;
  let viewerToken: string;
  let editorToken: string;
  let testOrgId: string;

  beforeAll(async () => {
    authService = new AuthService();

    // Create test organization
    const testOrg = await prisma.organization.create({
      data: {
        code: 'TEST_ORG',
        name: 'Test Organization',
        isActive: true,
        serviceStatus: 'active',
      },
    });
    testOrgId = testOrg.id;

    // Create admin user (all permissions)
    const adminUser = await prisma.user.create({
      data: {
        username: 'test_admin',
        email: 'admin@test.com',
        passwordHash: await authService['hashPassword']('password123'),
        role: 'admin',
        isActive: true,
        authProvider: 'local',
        serviceStatus: 'active',
      },
    });

    await prisma.userOrganization.create({
      data: {
        userId: adminUser.id,
        organizationId: testOrgId,
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

    // Create viewer user (read-only)
    const viewerUser = await prisma.user.create({
      data: {
        username: 'test_viewer',
        email: 'viewer@test.com',
        passwordHash: await authService['hashPassword']('password123'),
        role: 'viewer',
        isActive: true,
        authProvider: 'local',
        serviceStatus: 'active',
      },
    });

    await prisma.userOrganization.create({
      data: {
        userId: viewerUser.id,
        organizationId: testOrgId,
        role: 'viewer',
        perm_Read: true, // Only read permission
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
      },
    });

    // Create editor user (can save drafts and sync)
    const editorUser = await prisma.user.create({
      data: {
        username: 'test_editor',
        email: 'editor@test.com',
        passwordHash: await authService['hashPassword']('password123'),
        role: 'editor',
        isActive: true,
        authProvider: 'local',
        serviceStatus: 'active',
      },
    });

    await prisma.userOrganization.create({
      data: {
        userId: editorUser.id,
        organizationId: testOrgId,
        role: 'editor',
        perm_Read: true,
        perm_EditForecast: true,
        perm_EditActuals: false,
        perm_Delete: false,
        perm_Import: false,
        perm_RefreshData: false,
        perm_Export: true,
        perm_ViewFinancials: true,
        perm_SaveDraft: true,
        perm_Sync: true,
        perm_ManageUsers: false,
        perm_ManageSettings: false,
        perm_ConfigureAlerts: false,
        perm_Impersonate: false,
      },
    });

    // Generate tokens
    const adminLogin = await authService.login('test_admin', 'password123');
    adminToken = adminLogin.token;

    const viewerLogin = await authService.login('test_viewer', 'password123');
    viewerToken = viewerLogin.token;

    const editorLogin = await authService.login('test_editor', 'password123');
    editorToken = editorLogin.token;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.userOrganization.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.user.deleteMany({
      where: { username: { in: ['test_admin', 'test_viewer', 'test_editor'] } },
    });
    await prisma.organization.delete({
      where: { id: testOrgId },
    });
    await prisma.$disconnect();
  });

  describe('PFA Data Routes', () => {
    describe('GET /api/pfa/:orgId - Read Permission', () => {
      it('should allow admin with perm_Read', async () => {
        const response = await request(app)
          .get(`/api/pfa/${testOrgId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
      });

      it('should allow viewer with perm_Read', async () => {
        const response = await request(app)
          .get(`/api/pfa/${testOrgId}`)
          .set('Authorization', `Bearer ${viewerToken}`);

        expect(response.status).toBe(200);
      });

      it('should deny unauthenticated requests', async () => {
        const response = await request(app).get(`/api/pfa/${testOrgId}`);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('UNAUTHORIZED');
      });
    });

    describe('POST /api/pfa/:orgId/draft - SaveDraft Permission', () => {
      it('should allow editor with perm_SaveDraft', async () => {
        const response = await request(app)
          .post(`/api/pfa/${testOrgId}/draft`)
          .set('Authorization', `Bearer ${editorToken}`)
          .send({
            modifications: [
              {
                pfaId: 'test-pfa-id',
                delta: { forecastStart: '2025-12-01' },
              },
            ],
          });

        expect(response.status).not.toBe(403);
      });

      it('should deny viewer without perm_SaveDraft', async () => {
        const response = await request(app)
          .post(`/api/pfa/${testOrgId}/draft`)
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({
            modifications: [
              {
                pfaId: 'test-pfa-id',
                delta: { forecastStart: '2025-12-01' },
              },
            ],
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('PERMISSION_DENIED');
        expect(response.body.permission).toBe('perm_SaveDraft');
      });
    });

    describe('POST /api/pfa/:orgId/commit - Sync Permission', () => {
      it('should allow editor with perm_Sync', async () => {
        const response = await request(app)
          .post(`/api/pfa/${testOrgId}/commit`)
          .set('Authorization', `Bearer ${editorToken}`)
          .send({ sessionId: 'test-session' });

        expect(response.status).not.toBe(403);
      });

      it('should deny viewer without perm_Sync', async () => {
        const response = await request(app)
          .post(`/api/pfa/${testOrgId}/commit`)
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({ sessionId: 'test-session' });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('PERMISSION_DENIED');
        expect(response.body.permission).toBe('perm_Sync');
      });
    });
  });

  describe('User Management Routes', () => {
    describe('POST /api/users - ManageUsers Permission', () => {
      it('should allow admin with perm_ManageUsers', async () => {
        const response = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            username: 'new_test_user',
            password: 'password123',
            email: 'newuser@test.com',
            organizationId: testOrgId,
          });

        expect(response.status).not.toBe(403);
      });

      it('should deny viewer without perm_ManageUsers', async () => {
        const response = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({
            username: 'new_test_user_2',
            password: 'password123',
            email: 'newuser2@test.com',
            organizationId: testOrgId,
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('PERMISSION_DENIED');
        expect(response.body.permission).toBe('perm_ManageUsers');
      });
    });
  });

  describe('API Server Management Routes', () => {
    describe('POST /api/servers - ManageSettings Permission', () => {
      it('should allow admin with perm_ManageSettings', async () => {
        const response = await request(app)
          .post('/api/servers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            organizationId: testOrgId,
            name: 'Test API Server',
            baseUrl: 'https://api.test.com',
            authType: 'basic',
          });

        expect(response.status).not.toBe(403);
      });

      it('should deny viewer without perm_ManageSettings', async () => {
        const response = await request(app)
          .post('/api/servers')
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({
            organizationId: testOrgId,
            name: 'Test API Server 2',
            baseUrl: 'https://api.test2.com',
            authType: 'basic',
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('PERMISSION_DENIED');
        expect(response.body.permission).toBe('perm_ManageSettings');
      });
    });
  });

  describe('Audit Logging', () => {
    it('should log permission denials to audit log', async () => {
      // Make a request that will be denied
      await request(app)
        .post(`/api/pfa/${testOrgId}/commit`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ sessionId: 'test-session' });

      // Check audit log for permission denial entry
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          action: 'permission_denied',
          organizationId: testOrgId,
        },
        orderBy: { timestamp: 'desc' },
        take: 1,
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      const log = auditLogs[0];
      expect(log.success).toBe(false);
      expect(log.metadata).toHaveProperty('permission');
      expect(log.metadata).toHaveProperty('reason');
    });
  });

  describe('Cross-Organization Access', () => {
    let otherOrgId: string;

    beforeAll(async () => {
      // Create another organization
      const otherOrg = await prisma.organization.create({
        data: {
          code: 'OTHER_ORG',
          name: 'Other Organization',
          isActive: true,
          serviceStatus: 'active',
        },
      });
      otherOrgId = otherOrg.id;
    });

    afterAll(async () => {
      await prisma.organization.delete({
        where: { id: otherOrgId },
      });
    });

    it('should deny access to organization user does not belong to', async () => {
      const response = await request(app)
        .get(`/api/pfa/${otherOrgId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('ORG_ACCESS_DENIED');
    });
  });
});
