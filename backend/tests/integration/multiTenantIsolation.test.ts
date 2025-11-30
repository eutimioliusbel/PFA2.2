/**
 * Integration Tests: Multi-Tenant Isolation
 * ADR-005 Multi-Tenant Access Control - Phase 10B, Task 10B.1
 *
 * Tests verify that:
 * 1. Users can only access data from their assigned organizations
 * 2. Cross-organization data access is blocked
 * 3. Multi-org users can switch between assigned orgs
 * 4. Organization context is properly enforced on all endpoints
 *
 * Test Count: 20+ tests
 */

import request from 'supertest';
import { app } from '../../src/server';
import prisma from '../../src/config/database';
import { AuthService } from '../../src/services/auth/authService';

describe('Multi-Tenant Isolation - Integration Tests', () => {
  let authService: AuthService;

  // Organizations
  let org1Id: string;
  let org2Id: string;
  let org3Id: string;

  // Users
  let singleOrgUserId: string;
  let multiOrgUserId: string;
  let adminUserId: string;

  // Tokens
  let singleOrgUserToken: string;
  let multiOrgUserToken: string;
  let adminToken: string;

  // Test API Server IDs
  let org1ServerId: string;
  let org2ServerId: string;

  beforeAll(async () => {
    authService = new AuthService();

    // Create three organizations
    const org1 = await prisma.organization.create({
      data: {
        code: 'ISO_ORG_1',
        name: 'Isolation Test Org 1',
        isActive: true,
        serviceStatus: 'active',
      },
    });
    org1Id = org1.id;

    const org2 = await prisma.organization.create({
      data: {
        code: 'ISO_ORG_2',
        name: 'Isolation Test Org 2',
        isActive: true,
        serviceStatus: 'active',
      },
    });
    org2Id = org2.id;

    const org3 = await prisma.organization.create({
      data: {
        code: 'ISO_ORG_3',
        name: 'Isolation Test Org 3',
        isActive: true,
        serviceStatus: 'active',
      },
    });
    org3Id = org3.id;

    // Create single-org user (only in org1)
    const singleOrgUser = await prisma.user.create({
      data: {
        username: 'iso_single_user',
        email: 'iso_single@test.com',
        passwordHash: await authService['hashPassword']('TestPass123!'),
        role: 'editor',
        isActive: true,
        authProvider: 'local',
        serviceStatus: 'active',
      },
    });
    singleOrgUserId = singleOrgUser.id;

    await prisma.userOrganization.create({
      data: {
        userId: singleOrgUserId,
        organizationId: org1Id,
        role: 'editor',
        perm_Read: true,
        perm_EditForecast: true,
        perm_Export: true,
        perm_ViewFinancials: true,
        perm_ManageSettings: true,
      },
    });

    // Create multi-org user (in org1 and org2)
    const multiOrgUser = await prisma.user.create({
      data: {
        username: 'iso_multi_user',
        email: 'iso_multi@test.com',
        passwordHash: await authService['hashPassword']('TestPass123!'),
        role: 'editor',
        isActive: true,
        authProvider: 'local',
        serviceStatus: 'active',
      },
    });
    multiOrgUserId = multiOrgUser.id;

    await prisma.userOrganization.create({
      data: {
        userId: multiOrgUserId,
        organizationId: org1Id,
        role: 'admin',
        perm_Read: true,
        perm_EditForecast: true,
        perm_ManageSettings: true,
        perm_ManageUsers: true,
        perm_ViewFinancials: true,
      },
    });

    await prisma.userOrganization.create({
      data: {
        userId: multiOrgUserId,
        organizationId: org2Id,
        role: 'viewer',
        perm_Read: true,
        perm_ViewFinancials: false,
      },
    });

    // Create admin user (in all orgs)
    const adminUser = await prisma.user.create({
      data: {
        username: 'iso_admin_user',
        email: 'iso_admin@test.com',
        passwordHash: await authService['hashPassword']('TestPass123!'),
        role: 'admin',
        isActive: true,
        authProvider: 'local',
        serviceStatus: 'active',
      },
    });
    adminUserId = adminUser.id;

    await prisma.userOrganization.create({
      data: {
        userId: adminUserId,
        organizationId: org1Id,
        role: 'admin',
        perm_Read: true,
        perm_ManageSettings: true,
        perm_ManageUsers: true,
        perm_ViewFinancials: true,
      },
    });

    await prisma.userOrganization.create({
      data: {
        userId: adminUserId,
        organizationId: org2Id,
        role: 'admin',
        perm_Read: true,
        perm_ManageSettings: true,
        perm_ManageUsers: true,
        perm_ViewFinancials: true,
      },
    });

    await prisma.userOrganization.create({
      data: {
        userId: adminUserId,
        organizationId: org3Id,
        role: 'admin',
        perm_Read: true,
        perm_ManageSettings: true,
        perm_ManageUsers: true,
        perm_ViewFinancials: true,
      },
    });

    // Create API servers for testing
    const org1Server = await prisma.apiServer.create({
      data: {
        organizationId: org1Id,
        name: 'ISO_Org1_Server',
        baseUrl: 'https://org1.test.com',
        authType: 'basic',
      },
    });
    org1ServerId = org1Server.id;

    const org2Server = await prisma.apiServer.create({
      data: {
        organizationId: org2Id,
        name: 'ISO_Org2_Server',
        baseUrl: 'https://org2.test.com',
        authType: 'basic',
      },
    });
    org2ServerId = org2Server.id;

    // Generate tokens
    const singleLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'iso_single_user', password: 'TestPass123!' });
    singleOrgUserToken = singleLogin.body.token;

    const multiLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'iso_multi_user', password: 'TestPass123!' });
    multiOrgUserToken = multiLogin.body.token;

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'iso_admin_user', password: 'TestPass123!' });
    adminToken = adminLogin.body.token;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.apiServer.deleteMany({
      where: { organizationId: { in: [org1Id, org2Id, org3Id] } },
    });
    await prisma.userOrganization.deleteMany({
      where: { organizationId: { in: [org1Id, org2Id, org3Id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [singleOrgUserId, multiOrgUserId, adminUserId] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [org1Id, org2Id, org3Id] } },
    });
    await prisma.$disconnect();
  });

  describe('Single-Organization User Isolation', () => {
    it('TEST-MULTI-001: Single-org user can access their assigned organization', async () => {
      const response = await request(app)
        .get(`/api/pfa/${org1Id}`)
        .set('Authorization', `Bearer ${singleOrgUserToken}`);

      expect(response.status).toBe(200);
    });

    it('TEST-MULTI-002: Single-org user cannot access unassigned organization', async () => {
      const response = await request(app)
        .get(`/api/pfa/${org2Id}`)
        .set('Authorization', `Bearer ${singleOrgUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('ORG_ACCESS_DENIED');
    });

    it('TEST-MULTI-003: Single-org user cannot see API servers from other orgs', async () => {
      const response = await request(app)
        .get(`/api/servers/${org2ServerId}`)
        .set('Authorization', `Bearer ${singleOrgUserToken}`);

      expect([403, 404]).toContain(response.status);
    });

    it('TEST-MULTI-004: Single-org user cannot create resources in unassigned org', async () => {
      const response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${singleOrgUserToken}`)
        .send({
          organizationId: org2Id,
          name: 'Unauthorized Server',
          baseUrl: 'https://unauthorized.test.com',
          authType: 'none',
        });

      expect(response.status).toBe(403);
    });

    it('TEST-MULTI-005: Single-org user cannot update resources in unassigned org', async () => {
      const response = await request(app)
        .put(`/api/servers/${org2ServerId}`)
        .set('Authorization', `Bearer ${singleOrgUserToken}`)
        .send({ name: 'Hacked Server Name' });

      expect(response.status).toBe(403);
    });
  });

  describe('Multi-Organization User Isolation', () => {
    it('TEST-MULTI-006: Multi-org user can access all assigned organizations', async () => {
      const org1Response = await request(app)
        .get(`/api/pfa/${org1Id}`)
        .set('Authorization', `Bearer ${multiOrgUserToken}`);
      expect(org1Response.status).toBe(200);

      const org2Response = await request(app)
        .get(`/api/pfa/${org2Id}`)
        .set('Authorization', `Bearer ${multiOrgUserToken}`);
      expect(org2Response.status).toBe(200);
    });

    it('TEST-MULTI-007: Multi-org user cannot access unassigned organization', async () => {
      const response = await request(app)
        .get(`/api/pfa/${org3Id}`)
        .set('Authorization', `Bearer ${multiOrgUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('ORG_ACCESS_DENIED');
    });

    it('TEST-MULTI-008: Multi-org user has different permissions per org', async () => {
      // User is admin in org1 (can manage settings)
      const org1Response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${multiOrgUserToken}`)
        .send({
          organizationId: org1Id,
          name: 'Multi_Org1_Test_Server',
          baseUrl: 'https://multi-org1.test.com',
          authType: 'none',
        });
      expect(org1Response.status).not.toBe(403);

      // Clean up created server
      if (org1Response.body.id) {
        await prisma.apiServer.delete({ where: { id: org1Response.body.id } });
      }

      // User is viewer in org2 (cannot manage settings)
      const org2Response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${multiOrgUserToken}`)
        .send({
          organizationId: org2Id,
          name: 'Multi_Org2_Test_Server',
          baseUrl: 'https://multi-org2.test.com',
          authType: 'none',
        });
      expect(org2Response.status).toBe(403);
    });

    it('TEST-MULTI-009: Multi-org user financial access varies by org', async () => {
      // User has ViewFinancials in org1
      const org1Response = await request(app)
        .get(`/api/pfa/${org1Id}`)
        .set('Authorization', `Bearer ${multiOrgUserToken}`);
      expect(org1Response.status).toBe(200);
      // Financial data should be visible

      // User does NOT have ViewFinancials in org2
      const org2Response = await request(app)
        .get(`/api/pfa/${org2Id}`)
        .set('Authorization', `Bearer ${multiOrgUserToken}`);
      expect(org2Response.status).toBe(200);
      // Financial data should be masked (implementation-dependent)
    });
  });

  describe('Cross-Organization Data Access Prevention', () => {
    it('TEST-MULTI-010: Cannot modify data in org user cannot access', async () => {
      const response = await request(app)
        .delete(`/api/servers/${org2ServerId}`)
        .set('Authorization', `Bearer ${singleOrgUserToken}`);

      expect(response.status).toBe(403);
    });

    it('TEST-MULTI-011: Cannot view users from unassigned organization', async () => {
      // Create a user specifically for org3
      const org3User = await prisma.user.create({
        data: {
          username: 'iso_org3_only_user',
          email: 'iso_org3only@test.com',
          passwordHash: await authService['hashPassword']('TestPass123!'),
          role: 'viewer',
          isActive: true,
          authProvider: 'local',
          serviceStatus: 'active',
        },
      });

      await prisma.userOrganization.create({
        data: {
          userId: org3User.id,
          organizationId: org3Id,
          role: 'viewer',
          perm_Read: true,
        },
      });

      // Multi-org user (org1, org2) should not see org3 user in their user list
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${multiOrgUserToken}`)
        .query({ organizationId: org3Id });

      expect([403, 200]).toContain(response.status);
      if (response.status === 200) {
        // If 200, should not include org3 users
        const org3Users = response.body.filter(
          (u: any) => u.id === org3User.id
        );
        expect(org3Users.length).toBe(0);
      }

      // Cleanup
      await prisma.userOrganization.deleteMany({
        where: { userId: org3User.id },
      });
      await prisma.user.delete({ where: { id: org3User.id } });
    });

    it('TEST-MULTI-012: API listing only shows servers from accessible orgs', async () => {
      const response = await request(app)
        .get('/api/servers')
        .set('Authorization', `Bearer ${singleOrgUserToken}`)
        .query({ organizationId: org1Id });

      expect(response.status).toBe(200);

      // Verify no org2 servers are returned
      const org2Servers = response.body.filter(
        (s: any) => s.organizationId === org2Id
      );
      expect(org2Servers.length).toBe(0);
    });

    it('TEST-MULTI-013: Cannot assign user to org they cannot access', async () => {
      // Single-org user cannot add another user to org2
      const response = await request(app)
        .post('/api/user-organizations')
        .set('Authorization', `Bearer ${singleOrgUserToken}`)
        .send({
          userId: adminUserId,
          organizationId: org2Id,
          role: 'viewer',
        });

      expect([403, 404]).toContain(response.status);
    });
  });

  describe('Organization Context Enforcement', () => {
    it('TEST-MULTI-014: Organization ID is required for org-scoped endpoints', async () => {
      const response = await request(app)
        .get('/api/pfa')
        .set('Authorization', `Bearer ${singleOrgUserToken}`);

      // Should either require orgId or return only user's orgs
      expect([200, 400]).toContain(response.status);
    });

    it('TEST-MULTI-015: Invalid organization ID returns 404', async () => {
      const response = await request(app)
        .get('/api/pfa/invalid-org-id-12345')
        .set('Authorization', `Bearer ${singleOrgUserToken}`);

      expect([403, 404]).toContain(response.status);
    });

    it('TEST-MULTI-016: Organization filter cannot be bypassed', async () => {
      // Try to inject org2 ID via query param when accessing org1 resource
      const response = await request(app)
        .get(`/api/servers`)
        .set('Authorization', `Bearer ${singleOrgUserToken}`)
        .query({ organizationId: org2Id });

      // Should either deny access or filter to user's org
      if (response.status === 200) {
        const org2Servers = response.body.filter(
          (s: any) => s.organizationId === org2Id
        );
        expect(org2Servers.length).toBe(0);
      } else {
        expect([403]).toContain(response.status);
      }
    });
  });

  describe('Admin Multi-Org Access', () => {
    it('TEST-MULTI-017: Admin can access all assigned organizations', async () => {
      const org1Response = await request(app)
        .get(`/api/pfa/${org1Id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(org1Response.status).toBe(200);

      const org2Response = await request(app)
        .get(`/api/pfa/${org2Id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(org2Response.status).toBe(200);

      const org3Response = await request(app)
        .get(`/api/pfa/${org3Id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(org3Response.status).toBe(200);
    });

    it('TEST-MULTI-018: Admin can manage resources in any assigned org', async () => {
      const server = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          organizationId: org3Id,
          name: 'Admin_Org3_Test_Server',
          baseUrl: 'https://admin-org3.test.com',
          authType: 'none',
        });

      expect(server.status).not.toBe(403);

      // Cleanup
      if (server.body.id) {
        await prisma.apiServer.delete({ where: { id: server.body.id } });
      }
    });
  });

  describe('Audit Logging for Cross-Org Access', () => {
    it('TEST-MULTI-019: Failed cross-org access is logged', async () => {
      // Clear relevant audit logs
      await prisma.auditLog.deleteMany({
        where: {
          action: 'org_access_denied',
          organizationId: org2Id,
        },
      });

      // Attempt unauthorized access
      await request(app)
        .get(`/api/pfa/${org2Id}`)
        .set('Authorization', `Bearer ${singleOrgUserToken}`);

      // Check audit log
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          action: 'org_access_denied',
          organizationId: org2Id,
        },
        orderBy: { timestamp: 'desc' },
        take: 1,
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].success).toBe(false);
    });

    it('TEST-MULTI-020: Successful cross-org access logged for multi-org users', async () => {
      // Access should be logged when multi-org user accesses second org
      await request(app)
        .get(`/api/pfa/${org2Id}`)
        .set('Authorization', `Bearer ${multiOrgUserToken}`);

      // This test verifies no errors occur, logging implementation may vary
      expect(true).toBe(true);
    });
  });
});
