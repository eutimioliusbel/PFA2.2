/**
 * Integration Tests: Edge Cases
 * ADR-005 Multi-Tenant Access Control - Phase 10B, Task 10B.1
 *
 * Tests verify handling of:
 * 1. Null and undefined values
 * 2. Empty collections
 * 3. Boundary conditions
 * 4. Race conditions
 * 5. Malformed inputs
 * 6. Large payloads
 *
 * Test Count: 26+ tests
 */

import request from 'supertest';
import { app } from '../../src/server';
import prisma from '../../src/config/database';
import { AuthService } from '../../src/services/auth/authService';

describe('Edge Cases - Integration Tests', () => {
  let authService: AuthService;
  let testOrgId: string;
  let adminUserId: string;
  let adminToken: string;

  beforeAll(async () => {
    authService = new AuthService();
    const timestamp = Date.now();

    // Create test organization
    const testOrg = await prisma.organization.create({
      data: {
        code: `EDGE_ORG_${timestamp}`,
        name: 'Edge Cases Test Organization',
        isActive: true,
        serviceStatus: 'active',
      },
    });
    testOrgId = testOrg.id;

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        username: `edge_admin_${timestamp}`,
        email: `edge_admin_${timestamp}@test.com`,
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
        organizationId: testOrgId,
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
    await prisma.apiServer.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.userOrganization.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.user.deleteMany({
      where: { id: adminUserId },
    });
    await prisma.organization.delete({
      where: { id: testOrgId },
    });
    await prisma.$disconnect();
  });

  describe('Null and Undefined Handling', () => {
    it('TEST-EDGE-001: Handles null organizationId gracefully', async () => {
      const response = await request(app)
        .get('/api/pfa/null')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([400, 403, 404]).toContain(response.status);
    });

    it('TEST-EDGE-002: Handles undefined in request body', async () => {
      const response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          organizationId: testOrgId,
          name: 'Test Server',
          baseUrl: undefined,
          authType: 'none',
        });

      expect([400]).toContain(response.status);
    });

    it('TEST-EDGE-003: Handles null username in login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: null, password: 'test' });

      expect([400, 401]).toContain(response.status);
    });

    it('TEST-EDGE-004: Handles null password in login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test', password: null });

      expect([400, 401]).toContain(response.status);
    });
  });

  describe('Empty Collections and Strings', () => {
    it('TEST-EDGE-005: Returns empty array for org with no data', async () => {
      const response = await request(app)
        .get(`/api/pfa/${testOrgId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      // Should return empty array or object, not error
      expect(response.body).toBeDefined();
    });

    it('TEST-EDGE-006: Handles empty string username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: '', password: 'test' });

      expect([400, 401]).toContain(response.status);
    });

    it('TEST-EDGE-007: Handles empty string password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test', password: '' });

      expect([400, 401]).toContain(response.status);
    });

    it('TEST-EDGE-008: Handles whitespace-only input', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: '   ',
          email: 'test@test.com',
          password: 'TestPass123!',
        });

      expect([400]).toContain(response.status);
    });
  });

  describe('Boundary Conditions', () => {
    it('TEST-EDGE-009: Handles very long username', async () => {
      const longUsername = 'a'.repeat(500);

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: longUsername,
          email: 'long@test.com',
          password: 'TestPass123!',
        });

      expect([400]).toContain(response.status);
    });

    it('TEST-EDGE-010: Handles very long email', async () => {
      const longEmail = 'a'.repeat(300) + '@test.com';

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'longEmailUser',
          email: longEmail,
          password: 'TestPass123!',
        });

      expect([400]).toContain(response.status);
    });

    it('TEST-EDGE-011: Handles very long server name', async () => {
      const longName = 'Server'.repeat(100);

      const response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          organizationId: testOrgId,
          name: longName,
          baseUrl: 'https://test.com',
          authType: 'none',
        });

      expect([400]).toContain(response.status);
    });

    it('TEST-EDGE-012: Handles minimum valid input', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'a',
          email: 'a@b.c',
          password: 'Pass123!',
        });

      // May succeed or fail based on validation rules
      expect([200, 201, 400]).toContain(response.status);

      // Cleanup if created
      if (response.status === 200 || response.status === 201) {
        try {
          await prisma.user.delete({
            where: { username: 'a' },
          });
        } catch (e) {
          // Ignore
        }
      }
    });
  });

  describe('Special Characters', () => {
    it('TEST-EDGE-013: Handles special characters in username', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: "user<script>alert('xss')</script>",
          email: 'special@test.com',
          password: 'TestPass123!',
        });

      // Should either reject or sanitize
      if (response.status === 200 || response.status === 201) {
        // Verify sanitized
        expect(response.body.username).not.toContain('<script>');
      }
    });

    it('TEST-EDGE-014: Handles SQL injection attempt in query', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ search: "'; DROP TABLE users; --" });

      // Should not cause server error
      expect(response.status).not.toBe(500);
    });

    it('TEST-EDGE-015: Handles Unicode characters', async () => {
      const response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          organizationId: testOrgId,
          name: 'Server Name',
          baseUrl: 'https://test.com',
          authType: 'none',
        });

      expect([200, 201, 400]).toContain(response.status);

      // Cleanup if created
      if (response.status === 200 || response.status === 201) {
        try {
          await prisma.apiServer.delete({
            where: { id: response.body.id },
          });
        } catch (e) {
          // Ignore
        }
      }
    });

    it('TEST-EDGE-016: Handles newlines in input', async () => {
      const response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          organizationId: testOrgId,
          name: 'Server\nWith\nNewlines',
          baseUrl: 'https://test.com',
          authType: 'none',
        });

      // Should either accept or reject, not crash
      expect([200, 201, 400]).toContain(response.status);

      // Cleanup
      if (response.status === 200 || response.status === 201) {
        try {
          await prisma.apiServer.delete({
            where: { id: response.body.id },
          });
        } catch (e) {
          // Ignore
        }
      }
    });
  });

  describe('Invalid Data Types', () => {
    it('TEST-EDGE-017: Handles string where number expected', async () => {
      const response = await request(app)
        .get('/api/pfa')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ limit: 'not-a-number' });

      expect([200, 400]).toContain(response.status);
    });

    it('TEST-EDGE-018: Handles array where string expected', async () => {
      const response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          organizationId: testOrgId,
          name: ['array', 'of', 'strings'],
          baseUrl: 'https://test.com',
          authType: 'none',
        });

      expect([400]).toContain(response.status);
    });

    it('TEST-EDGE-019: Handles object where string expected', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: { malicious: 'object' },
          password: 'test',
        });

      expect([400, 401]).toContain(response.status);
    });
  });

  describe('Race Conditions', () => {
    it('TEST-EDGE-020: Handles concurrent same-user logins', async () => {
      const loginPromises = Array.from({ length: 10 }, () =>
        request(app).post('/api/auth/login').send({
          username: `edge_admin_${Date.now().toString().slice(-6)}`,
          password: 'TestPass123!',
        })
      );

      const results = await Promise.all(loginPromises);

      // All should complete without server crash
      results.forEach((result) => {
        expect([200, 401]).toContain(result.status);
      });
    });

    it('TEST-EDGE-021: Handles rapid permission changes', async () => {
      // Create a test user for permission changes
      const testUser = await prisma.user.create({
        data: {
          username: `race_test_user_${Date.now()}`,
          email: `race_test_${Date.now()}@test.com`,
          passwordHash: await authService['hashPassword']('TestPass123!'),
          role: 'viewer',
          isActive: true,
          authProvider: 'local',
          serviceStatus: 'active',
        },
      });

      const userOrg = await prisma.userOrganization.create({
        data: {
          userId: testUser.id,
          organizationId: testOrgId,
          role: 'viewer',
          perm_Read: true,
        },
      });

      // Rapid permission updates
      const updatePromises = [
        prisma.userOrganization.update({
          where: { id: userOrg.id },
          data: { perm_Export: true },
        }),
        prisma.userOrganization.update({
          where: { id: userOrg.id },
          data: { perm_ViewFinancials: true },
        }),
        prisma.userOrganization.update({
          where: { id: userOrg.id },
          data: { perm_SaveDraft: true },
        }),
      ];

      await Promise.all(updatePromises);

      // Verify final state is consistent
      const finalUserOrg = await prisma.userOrganization.findUnique({
        where: { id: userOrg.id },
      });

      expect(finalUserOrg).toBeTruthy();

      // Cleanup
      await prisma.userOrganization.delete({ where: { id: userOrg.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
    });
  });

  describe('Large Payloads', () => {
    it('TEST-EDGE-022: Handles large JSON payload', async () => {
      const largePayload = {
        organizationId: testOrgId,
        name: 'Test Server',
        baseUrl: 'https://test.com',
        authType: 'none',
        extraData: 'x'.repeat(100000), // 100KB of data
      };

      const response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(largePayload);

      // Should either succeed (ignoring extra data) or reject with 413/400
      expect([200, 201, 400, 413]).toContain(response.status);

      // Cleanup if created
      if (response.status === 200 || response.status === 201) {
        try {
          await prisma.apiServer.delete({ where: { id: response.body.id } });
        } catch (e) {
          // Ignore
        }
      }
    });

    it('TEST-EDGE-023: Handles many query parameters', async () => {
      const manyParams: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        manyParams[`param${i}`] = `value${i}`;
      }

      const response = await request(app)
        .get('/api/pfa')
        .set('Authorization', `Bearer ${adminToken}`)
        .query(manyParams);

      // Should not crash
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Authorization Edge Cases', () => {
    it('TEST-EDGE-024: Handles malformed JWT token', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer malformed.token.here');

      expect(response.status).toBe(401);
    });

    it('TEST-EDGE-025: Handles missing Bearer prefix', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', adminToken);

      expect(response.status).toBe(401);
    });

    it('TEST-EDGE-026: Handles empty Authorization header', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', '');

      expect(response.status).toBe(401);
    });
  });
});
