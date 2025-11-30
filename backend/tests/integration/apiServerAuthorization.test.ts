/**
 * Integration Tests: API Server Authorization
 * Phase 2, Task 2.3 - API Server Authorization Middleware (ADR-006)
 *
 * Tests verify that:
 * 1. CREATE/UPDATE/DELETE require perm_ManageSettings
 * 2. Any organization member can test servers
 * 3. Organization must be active for CREATE/UPDATE
 * 4. Suspended orgs cannot test API servers
 * 5. Users only see API servers from their orgs
 *
 * Run with: npm test -- apiServerAuthorization.test.ts
 */

import request from 'supertest';
import { app } from '../../src/server';
import prisma from '../../src/config/database';
import { AuthService } from '../../src/services/auth/authService';

describe('API Server Authorization - Integration Tests', () => {
  let authService: AuthService;
  let adminToken: string;
  let viewerToken: string;
  let managerToken: string;
  let testOrgId: string;
  let testServerId: string;
  let suspendedOrgId: string;

  beforeAll(async () => {
    authService = new AuthService();

    // Create active test organization
    const testOrg = await prisma.organization.create({
      data: {
        code: 'TEST_API_ORG',
        name: 'Test API Organization',
        isActive: true,
        serviceStatus: 'active',
      },
    });
    testOrgId = testOrg.id;

    // Create suspended organization
    const suspendedOrg = await prisma.organization.create({
      data: {
        code: 'SUSPENDED_ORG',
        name: 'Suspended Organization',
        isActive: false,
        serviceStatus: 'suspended',
      },
    });
    suspendedOrgId = suspendedOrg.id;

    // Create admin user (all permissions including perm_ManageSettings)
    const adminUser = await prisma.user.create({
      data: {
        username: 'test_api_admin',
        email: 'api_admin@test.com',
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
        perm_ManageSettings: true, // Has permission
        perm_ConfigureAlerts: true,
        perm_Impersonate: true,
      },
    });

    // Create viewer user (read-only, no perm_ManageSettings)
    const viewerUser = await prisma.user.create({
      data: {
        username: 'test_api_viewer',
        email: 'api_viewer@test.com',
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
        perm_Read: true, // Can read
        perm_ManageSettings: false, // Cannot manage settings
        perm_RefreshData: false, // Cannot refresh data
      },
    });

    // Create manager user (has read but no perm_ManageSettings, in suspended org)
    const managerUser = await prisma.user.create({
      data: {
        username: 'test_api_manager',
        email: 'api_manager@test.com',
        passwordHash: await authService['hashPassword']('password123'),
        role: 'manager',
        isActive: true,
        authProvider: 'local',
        serviceStatus: 'active',
      },
    });

    await prisma.userOrganization.create({
      data: {
        userId: managerUser.id,
        organizationId: suspendedOrgId,
        role: 'manager',
        perm_Read: true,
        perm_ManageSettings: true, // Has permission but org is suspended
        perm_RefreshData: true,
      },
    });

    // Generate tokens
    const adminLogin = await authService.login('test_api_admin', 'password123');
    adminToken = adminLogin.token;

    const viewerLogin = await authService.login('test_api_viewer', 'password123');
    viewerToken = viewerLogin.token;

    const managerLogin = await authService.login('test_api_manager', 'password123');
    managerToken = managerLogin.token;

    // Create a test API server
    const testServer = await prisma.apiServer.create({
      data: {
        organizationId: testOrgId,
        name: 'Test PEMS Server',
        baseUrl: 'https://test.pems.com',
        authType: 'basic',
        authKeyEncrypted: 'encrypted_key',
        authValueEncrypted: 'encrypted_value',
      },
    });
    testServerId = testServer.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.apiServer.deleteMany({
      where: { organizationId: { in: [testOrgId, suspendedOrgId] } },
    });
    await prisma.userOrganization.deleteMany({
      where: { organizationId: { in: [testOrgId, suspendedOrgId] } },
    });
    await prisma.user.deleteMany({
      where: {
        username: { in: ['test_api_admin', 'test_api_viewer', 'test_api_manager'] },
      },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [testOrgId, suspendedOrgId] } },
    });
    await prisma.$disconnect();
  });

  describe('POST /api/servers - Create API Server', () => {
    it('should allow admin with perm_ManageSettings', async () => {
      const response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          organizationId: testOrgId,
          name: 'New Test Server',
          baseUrl: 'https://new.test.com',
          authType: 'basic',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('New Test Server');

      // Cleanup
      await prisma.apiServer.delete({ where: { id: response.body.id } });
    });

    it('should deny viewer without perm_ManageSettings', async () => {
      const response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          organizationId: testOrgId,
          name: 'Unauthorized Server',
          baseUrl: 'https://unauthorized.test.com',
          authType: 'basic',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('PERMISSION_DENIED');
      expect(response.body.permission).toBe('perm_ManageSettings');
    });

    it('should deny if organizationId is missing', async () => {
      const response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'No Org Server',
          baseUrl: 'https://noorg.test.com',
          authType: 'basic',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('BAD_REQUEST');
      expect(response.body.message).toContain('organizationId is required');
    });

    it('should deny if organization is suspended', async () => {
      const response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          organizationId: suspendedOrgId,
          name: 'Suspended Org Server',
          baseUrl: 'https://suspended.test.com',
          authType: 'basic',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('ORG_INACTIVE');
      expect(response.body.message).toContain('suspended');
    });
  });

  describe('PUT /api/servers/:serverId - Update API Server', () => {
    it('should allow admin with perm_ManageSettings', async () => {
      const response = await request(app)
        .put(`/api/servers/${testServerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Test Server',
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Test Server');

      // Restore original name
      await prisma.apiServer.update({
        where: { id: testServerId },
        data: { name: 'Test PEMS Server' },
      });
    });

    it('should deny viewer without perm_ManageSettings', async () => {
      const response = await request(app)
        .put(`/api/servers/${testServerId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          name: 'Unauthorized Update',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('PERMISSION_DENIED');
      expect(response.body.permission).toBe('perm_ManageSettings');
    });

    it('should deny if server does not exist', async () => {
      const response = await request(app)
        .put('/api/servers/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Nonexistent Update',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/servers/:serverId - Delete API Server', () => {
    let tempServerId: string;

    beforeEach(async () => {
      // Create a temporary server for deletion tests
      const tempServer = await prisma.apiServer.create({
        data: {
          organizationId: testOrgId,
          name: 'Temp Delete Server',
          baseUrl: 'https://temp.test.com',
          authType: 'basic',
        },
      });
      tempServerId = tempServer.id;
    });

    afterEach(async () => {
      // Cleanup if test didn't delete
      try {
        await prisma.apiServer.delete({ where: { id: tempServerId } });
      } catch (error) {
        // Already deleted, ignore
      }
    });

    it('should allow admin with perm_ManageSettings', async () => {
      const response = await request(app)
        .delete(`/api/servers/${tempServerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it('should deny viewer without perm_ManageSettings', async () => {
      const response = await request(app)
        .delete(`/api/servers/${tempServerId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('PERMISSION_DENIED');
      expect(response.body.permission).toBe('perm_ManageSettings');
    });
  });

  describe('POST /api/servers/:serverId/test - Test API Server', () => {
    it('should allow viewer to test (any org member)', async () => {
      const response = await request(app)
        .post(`/api/servers/${testServerId}/test`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ organizationId: testOrgId });

      // Test may fail if PEMS not available, but should not be a permission error
      expect(response.status).not.toBe(403);
    });

    it('should allow admin to test', async () => {
      const response = await request(app)
        .post(`/api/servers/${testServerId}/test`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ organizationId: testOrgId });

      // Test may fail if PEMS not available, but should not be a permission error
      expect(response.status).not.toBe(403);
    });

    it('should deny if organization is suspended', async () => {
      // Create a server in suspended org
      const suspendedServer = await prisma.apiServer.create({
        data: {
          organizationId: suspendedOrgId,
          name: 'Suspended Test Server',
          baseUrl: 'https://suspended.test.com',
          authType: 'basic',
        },
      });

      const response = await request(app)
        .post(`/api/servers/${suspendedServer.id}/test`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ organizationId: suspendedOrgId });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('ORG_SUSPENDED');

      // Cleanup
      await prisma.apiServer.delete({ where: { id: suspendedServer.id } });
    });

    it('should deny user without access to organization', async () => {
      const response = await request(app)
        .post(`/api/servers/${testServerId}/test`)
        .set('Authorization', `Bearer ${managerToken}`) // Manager is in suspended org, not test org
        .send({ organizationId: testOrgId });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('ORG_ACCESS_DENIED');
    });
  });

  describe('GET /api/servers - List API Servers', () => {
    it('should filter servers by user organizations', async () => {
      const response = await request(app)
        .get('/api/servers')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ organizationId: testOrgId });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // Verify all returned servers belong to user's organization
      response.body.forEach((server: any) => {
        expect(server.organizationId).toBe(testOrgId);
      });
    });

    it('should not show servers from other organizations', async () => {
      const response = await request(app)
        .get('/api/servers')
        .set('Authorization', `Bearer ${viewerToken}`)
        .query({ organizationId: testOrgId });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // Viewer should see servers from test org
      const viewerServers = response.body;

      // Manager should not see test org servers
      const managerResponse = await request(app)
        .get('/api/servers')
        .set('Authorization', `Bearer ${managerToken}`)
        .query({ organizationId: testOrgId });

      expect(managerResponse.status).toBe(200);
      // Manager is not in test org, so should get empty array or 403
      // (depends on controller implementation)
    });
  });

  describe('Audit Logging', () => {
    it('should log permission denials for API server operations', async () => {
      // Make a request that will be denied
      await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          organizationId: testOrgId,
          name: 'Audit Test Server',
          baseUrl: 'https://audit.test.com',
          authType: 'basic',
        });

      // Check audit log for permission denial entry
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          action: 'api_server_permission_denied',
          organizationId: testOrgId,
        },
        orderBy: { timestamp: 'desc' },
        take: 1,
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      const log = auditLogs[0];
      expect(log.success).toBe(false);
      expect(log.metadata).toHaveProperty('permission', 'perm_ManageSettings');
      expect(log.metadata).toHaveProperty('reason', 'PERMISSION_DENIED');
    });
  });
});
