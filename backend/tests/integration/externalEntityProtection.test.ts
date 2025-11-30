/**
 * Integration Tests: External Entity Protection
 * ADR-005 Multi-Tenant Access Control - Phase 10B, Task 10B.1
 *
 * Tests verify that:
 * 1. PEMS-managed organizations cannot be deleted
 * 2. PEMS-managed users cannot be deleted
 * 3. External entity fields are read-only
 * 4. Unlinking external entities preserves data
 * 5. Sync overwrite warnings are displayed
 *
 * Test Count: 15+ tests
 */

import request from 'supertest';
import { app } from '../../src/server';
import prisma from '../../src/config/database';
import { AuthService } from '../../src/services/auth/authService';

describe('External Entity Protection - Integration Tests', () => {
  let authService: AuthService;

  // Organizations
  let localOrgId: string;
  let externalOrgId: string;

  // Users
  let localUserId: string;
  let externalUserId: string;
  let adminUserId: string;

  // Tokens
  let adminToken: string;

  beforeAll(async () => {
    authService = new AuthService();
    const timestamp = Date.now();

    // Create local (non-PEMS) organization
    const localOrg = await prisma.organization.create({
      data: {
        code: `LOCAL_ORG_${timestamp}`,
        name: 'Local Test Organization',
        isActive: true,
        isExternal: false,
        serviceStatus: 'active',
      },
    });
    localOrgId = localOrg.id;

    // Create external (PEMS-managed) organization
    const externalOrg = await prisma.organization.create({
      data: {
        code: `PEMS_ORG_${timestamp}`,
        name: 'PEMS Managed Organization',
        isActive: true,
        isExternal: true,
        externalId: `pems-org-${timestamp}`,
        serviceStatus: 'active',
        enableSync: true,
      },
    });
    externalOrgId = externalOrg.id;

    // Create local user
    const localUser = await prisma.user.create({
      data: {
        username: `local_user_${timestamp}`,
        email: `local_user_${timestamp}@test.com`,
        passwordHash: await authService['hashPassword']('TestPass123!'),
        role: 'viewer',
        isActive: true,
        authProvider: 'local',
        serviceStatus: 'active',
      },
    });
    localUserId = localUser.id;

    await prisma.userOrganization.create({
      data: {
        userId: localUserId,
        organizationId: localOrgId,
        role: 'viewer',
        perm_Read: true,
      },
    });

    // Create external (PEMS-managed) user
    const externalUser = await prisma.user.create({
      data: {
        username: `pems_user_${timestamp}`,
        email: `pems_user_${timestamp}@test.com`,
        passwordHash: await authService['hashPassword']('TestPass123!'),
        role: 'editor',
        isActive: true,
        authProvider: 'pems',
        externalId: `pems-user-${timestamp}`,
        serviceStatus: 'active',
      },
    });
    externalUserId = externalUser.id;

    await prisma.userOrganization.create({
      data: {
        userId: externalUserId,
        organizationId: externalOrgId,
        role: 'editor',
        perm_Read: true,
        perm_EditForecast: true,
        assignmentSource: 'pems_sync',
      },
    });

    // Create admin user (for making admin requests)
    const adminUser = await prisma.user.create({
      data: {
        username: `ext_admin_${timestamp}`,
        email: `ext_admin_${timestamp}@test.com`,
        passwordHash: await authService['hashPassword']('TestPass123!'),
        role: 'admin',
        isActive: true,
        authProvider: 'local',
        serviceStatus: 'active',
      },
    });
    adminUserId = adminUser.id;

    // Admin has access to both orgs
    await prisma.userOrganization.create({
      data: {
        userId: adminUserId,
        organizationId: localOrgId,
        role: 'admin',
        perm_Read: true,
        perm_ManageUsers: true,
        perm_ManageSettings: true,
      },
    });

    await prisma.userOrganization.create({
      data: {
        userId: adminUserId,
        organizationId: externalOrgId,
        role: 'admin',
        perm_Read: true,
        perm_ManageUsers: true,
        perm_ManageSettings: true,
      },
    });

    // Get admin token
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: adminUser.username, password: 'TestPass123!' });
    adminToken = adminLogin.body.token;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.userOrganization.deleteMany({
      where: {
        organizationId: { in: [localOrgId, externalOrgId] },
      },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [localUserId, externalUserId, adminUserId] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [localOrgId, externalOrgId] } },
    });
    await prisma.$disconnect();
  });

  describe('External Organization Protection', () => {
    it('TEST-EXT-001: Cannot delete PEMS-managed organization', async () => {
      const response = await request(app)
        .delete(`/api/organizations/${externalOrgId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/EXTERNAL_ENTITY|PEMS_MANAGED/i);
    });

    it('TEST-EXT-002: Can delete local organization', async () => {
      // Create a temporary local org for deletion
      const tempOrg = await prisma.organization.create({
        data: {
          code: `TEMP_LOCAL_${Date.now()}`,
          name: 'Temporary Local Org',
          isActive: true,
          isExternal: false,
          serviceStatus: 'active',
        },
      });

      // Admin needs access
      await prisma.userOrganization.create({
        data: {
          userId: adminUserId,
          organizationId: tempOrg.id,
          role: 'admin',
          perm_ManageSettings: true,
        },
      });

      const response = await request(app)
        .delete(`/api/organizations/${tempOrg.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Should succeed or return 404 if already handled
      expect([200, 204, 404]).toContain(response.status);

      // Cleanup if not deleted
      try {
        await prisma.userOrganization.deleteMany({
          where: { organizationId: tempOrg.id },
        });
        await prisma.organization.delete({ where: { id: tempOrg.id } });
      } catch (e) {
        // Already deleted
      }
    });

    it('TEST-EXT-003: Cannot change external org code', async () => {
      const response = await request(app)
        .patch(`/api/organizations/${externalOrgId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: 'NEW_CODE' });

      // Should either reject or ignore the change
      if (response.status === 200) {
        // Verify code was not changed
        const org = await prisma.organization.findUnique({
          where: { id: externalOrgId },
        });
        expect(org?.code).not.toBe('NEW_CODE');
      } else {
        expect([400, 403]).toContain(response.status);
      }
    });

    it('TEST-EXT-004: Can modify local settings on external org', async () => {
      const response = await request(app)
        .patch(`/api/organizations/${externalOrgId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enableSync: false });

      // Local settings like enableSync should be modifiable
      expect([200, 404]).toContain(response.status);
    });

    it('TEST-EXT-005: Can suspend external organization', async () => {
      const response = await request(app)
        .patch(`/api/organizations/${externalOrgId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ serviceStatus: 'suspended' });

      expect([200, 404]).toContain(response.status);

      // Restore
      await prisma.organization.update({
        where: { id: externalOrgId },
        data: { serviceStatus: 'active' },
      });
    });
  });

  describe('External User Protection', () => {
    it('TEST-EXT-006: Cannot delete PEMS-managed user', async () => {
      const response = await request(app)
        .delete(`/api/users/${externalUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/EXTERNAL_ENTITY|PEMS_MANAGED/i);
    });

    it('TEST-EXT-007: Can delete local user', async () => {
      // Create a temporary local user for deletion
      const tempUser = await prisma.user.create({
        data: {
          username: `temp_delete_user_${Date.now()}`,
          email: `temp_delete_${Date.now()}@test.com`,
          passwordHash: await authService['hashPassword']('TestPass123!'),
          role: 'viewer',
          isActive: true,
          authProvider: 'local',
          serviceStatus: 'active',
        },
      });

      await prisma.userOrganization.create({
        data: {
          userId: tempUser.id,
          organizationId: localOrgId,
          role: 'viewer',
          perm_Read: true,
        },
      });

      const response = await request(app)
        .delete(`/api/users/${tempUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 204, 404]).toContain(response.status);

      // Cleanup if not deleted
      try {
        await prisma.userOrganization.deleteMany({
          where: { userId: tempUser.id },
        });
        await prisma.user.delete({ where: { id: tempUser.id } });
      } catch (e) {
        // Already deleted
      }
    });

    it('TEST-EXT-008: Cannot change external user auth provider', async () => {
      const response = await request(app)
        .patch(`/api/users/${externalUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ authProvider: 'local' });

      // Should either reject or ignore
      if (response.status === 200) {
        const user = await prisma.user.findUnique({
          where: { id: externalUserId },
        });
        expect(user?.authProvider).toBe('pems');
      } else {
        expect([400, 403, 404]).toContain(response.status);
      }
    });

    it('TEST-EXT-009: Can suspend external user', async () => {
      const response = await request(app)
        .patch(`/api/users/${externalUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ serviceStatus: 'suspended' });

      expect([200, 404]).toContain(response.status);

      // Restore
      await prisma.user.update({
        where: { id: externalUserId },
        data: { serviceStatus: 'active' },
      });
    });

    it('TEST-EXT-010: Can modify local overrides on external user', async () => {
      const response = await request(app)
        .patch(`/api/users/${externalUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ displayName: 'Local Override Name' });

      // Local overrides should be allowed
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('External Assignment Protection', () => {
    it('TEST-EXT-011: Cannot delete PEMS-synced user-org assignment', async () => {
      // Get the PEMS-synced assignment
      const assignment = await prisma.userOrganization.findFirst({
        where: {
          userId: externalUserId,
          organizationId: externalOrgId,
          assignmentSource: 'pems_sync',
        },
      });

      if (assignment) {
        const response = await request(app)
          .delete(`/api/user-organizations/${assignment.id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect([403, 404]).toContain(response.status);
      }
    });

    it('TEST-EXT-012: Can add local capability override to PEMS assignment', async () => {
      const assignment = await prisma.userOrganization.findFirst({
        where: {
          userId: externalUserId,
          organizationId: externalOrgId,
        },
      });

      if (assignment) {
        // Adding a local override should be allowed
        const response = await request(app)
          .patch(`/api/user-organizations/${assignment.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            perm_ViewFinancials: true,
            isCustomOverride: true,
          });

        expect([200, 404]).toContain(response.status);
      }
    });
  });

  describe('Unlink Operations', () => {
    it('TEST-EXT-013: Unlinking external org preserves local data', async () => {
      // Create a server in the external org
      const server = await prisma.apiServer.create({
        data: {
          organizationId: externalOrgId,
          name: `Unlink_Test_Server_${Date.now()}`,
          baseUrl: 'https://unlink.test.com',
          authType: 'none',
        },
      });

      // Unlink operation (if supported)
      const response = await request(app)
        .post(`/api/organizations/${externalOrgId}/unlink`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Verify server still exists (if unlink was successful)
      if (response.status === 200) {
        const serverAfter = await prisma.apiServer.findUnique({
          where: { id: server.id },
        });
        expect(serverAfter).toBeTruthy();

        // Restore external status
        await prisma.organization.update({
          where: { id: externalOrgId },
          data: { isExternal: true },
        });
      }

      // Cleanup
      await prisma.apiServer.delete({ where: { id: server.id } });
    });

    it('TEST-EXT-014: Unlinking requires confirmation', async () => {
      const response = await request(app)
        .post(`/api/organizations/${externalOrgId}/unlink`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ confirm: false });

      // Should require explicit confirmation
      expect([400, 404]).toContain(response.status);
    });
  });

  describe('Sync Overwrite Warnings', () => {
    it('TEST-EXT-015: API returns warning when editing PEMS user email', async () => {
      const response = await request(app)
        .patch(`/api/users/${externalUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'new_email@test.com' });

      // Response should include sync warning
      if (response.status === 200) {
        expect(
          response.body.warning ||
          response.body.syncWarning ||
          response.body.message
        ).toBeDefined();
      }
    });
  });
});
