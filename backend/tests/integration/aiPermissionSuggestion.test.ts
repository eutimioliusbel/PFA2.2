/**
 * Integration Tests for AI Permission Suggestion API
 *
 * Phase 6, Task 6.1 of ADR-005 Multi-Tenant Access Control
 *
 * Tests the complete end-to-end flow:
 * 1. Authentication
 * 2. Permission checking (perm_ManageUsers required)
 * 3. AI suggestion generation
 * 4. Suggestion acceptance recording
 * 5. Statistics retrieval
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/server';
import prisma from '../../src/config/database';
import { hashPassword } from '../../src/utils/encryption';

describe('AI Permission Suggestion API (Integration)', () => {
  let adminToken: string;
  let userToken: string;
  let adminUserId: string;
  let regularUserId: string;
  let organizationId: string;

  beforeAll(async () => {
    // Clean up test data
    await prisma.aiSuggestionLog.deleteMany({
      where: { organizationId: { contains: 'TEST_' } },
    });
    await prisma.userOrganization.deleteMany({
      where: { organizationId: { contains: 'TEST_' } },
    });
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'test_ai_perm_' } },
    });
    await prisma.organization.deleteMany({
      where: { code: { startsWith: 'TEST_' } },
    });

    // Create test organization
    const org = await prisma.organization.create({
      data: {
        code: 'TEST_AI_PERM_ORG',
        name: 'Test AI Permission Organization',
        description: 'Integration test organization for AI permissions',
      },
    });
    organizationId = org.id;

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        username: 'test_ai_perm_admin',
        email: 'admin@test.com',
        passwordHash: await hashPassword('admin123'),
        role: 'admin',
        metadata: {
          jobTitle: 'System Administrator',
          department: 'IT',
          yearsExperience: 10,
        },
      },
    });
    adminUserId = adminUser.id;

    // Create regular user
    const regularUser = await prisma.user.create({
      data: {
        username: 'test_ai_perm_user',
        email: 'user@test.com',
        passwordHash: await hashPassword('user123'),
        role: 'user',
        metadata: {
          jobTitle: 'Project Manager',
          department: 'Construction',
          yearsExperience: 5,
        },
      },
    });
    regularUserId = regularUser.id;

    // Assign admin to organization with perm_ManageUsers
    await prisma.userOrganization.create({
      data: {
        userId: adminUserId,
        organizationId,
        role: 'admin',
        perm_Read: true,
        perm_ManageUsers: true,
        perm_ManageSettings: true,
      },
    });

    // Assign regular user WITHOUT perm_ManageUsers
    await prisma.userOrganization.create({
      data: {
        userId: regularUserId,
        organizationId,
        role: 'member',
        perm_Read: true,
        perm_ManageUsers: false,
      },
    });

    // Create some historical users for pattern analysis
    for (let i = 0; i < 25; i++) {
      const histUser = await prisma.user.create({
        data: {
          username: `test_ai_perm_hist_user_${i}`,
          email: `hist_user_${i}@test.com`,
          passwordHash: await hashPassword('test123'),
          role: 'user',
          metadata: {
            jobTitle: 'Project Manager',
            department: 'Construction',
            yearsExperience: 3 + i,
          },
        },
      });

      await prisma.userOrganization.create({
        data: {
          userId: histUser.id,
          organizationId,
          role: 'editor',
          perm_Read: true,
          perm_EditForecast: true,
          perm_EditActuals: i % 3 === 0, // 33% have this
          perm_Delete: false,
          perm_Import: i % 5 === 0, // 20% have this
          perm_RefreshData: true,
          perm_Export: true,
          perm_ViewFinancials: i % 4 === 0, // 25% have this
          perm_SaveDraft: true,
          perm_Sync: false,
          perm_ManageUsers: false,
          perm_ManageSettings: false,
          perm_ConfigureAlerts: false,
          perm_Impersonate: false,
        },
      });
    }

    // Login to get tokens
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test_ai_perm_admin', password: 'admin123' });
    adminToken = adminLoginRes.body.token;

    const userLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test_ai_perm_user', password: 'user123' });
    userToken = userLoginRes.body.token;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.aiSuggestionLog.deleteMany({
      where: { organizationId },
    });
    await prisma.userOrganization.deleteMany({
      where: { organizationId },
    });
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'test_ai_perm_' } },
    });
    await prisma.organization.deleteMany({
      where: { code: 'TEST_AI_PERM_ORG' },
    });
    await prisma.$disconnect();
  });

  describe('POST /api/ai/suggest-permissions', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/ai/suggest-permissions')
        .send({
          userId: regularUserId,
          organizationId,
          role: 'Project Manager',
        });

      expect(res.status).toBe(401);
    });

    it('should require perm_ManageUsers permission', async () => {
      const res = await request(app)
        .post('/api/ai/suggest-permissions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          userId: regularUserId,
          organizationId,
          role: 'Project Manager',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('PERMISSION_DENIED');
      expect(res.body.permission).toBe('perm_ManageUsers');
    });

    it('should generate AI suggestion with high confidence for common role', async () => {
      const res = await request(app)
        .post('/api/ai/suggest-permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: regularUserId,
          organizationId,
          role: 'Project Manager',
          department: 'Construction',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('suggestedRole');
      expect(res.body).toHaveProperty('suggestedCapabilities');
      expect(res.body).toHaveProperty('confidence');
      expect(res.body).toHaveProperty('reasoning');
      expect(res.body).toHaveProperty('basedOnUsers');
      expect(res.body).toHaveProperty('securityWarnings');

      // Should be based on 25 historical users
      expect(res.body.basedOnUsers).toBeGreaterThan(10);

      // High confidence expected due to pattern strength
      expect(res.body.confidence).toBeGreaterThan(0.7);

      // Should suggest editor-level permissions (based on historical data)
      expect(res.body.suggestedRole).toMatch(/editor|admin/);
      expect(res.body.suggestedCapabilities.perm_Read).toBe(true);
      expect(res.body.suggestedCapabilities.perm_EditForecast).toBe(true);

      // Should include security warnings if suggesting sensitive permissions
      if (res.body.suggestedCapabilities.perm_ViewFinancials) {
        expect(res.body.securityWarnings.length).toBeGreaterThan(0);
      }
    });

    it('should return rule-based suggestion for uncommon role', async () => {
      const res = await request(app)
        .post('/api/ai/suggest-permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: regularUserId,
          organizationId,
          role: 'Data Analyst',
          department: 'Finance',
        });

      expect(res.status).toBe(200);
      expect(res.body.basedOnUsers).toBeLessThan(10);
      expect(res.body.confidence).toBeLessThan(0.85);
      expect(res.body.reasoning).toContain('based on keyword matching');
    });

    it('should include security warnings for high-risk permissions', async () => {
      const res = await request(app)
        .post('/api/ai/suggest-permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: regularUserId,
          organizationId,
          role: 'Administrator',
          department: 'IT',
        });

      expect(res.status).toBe(200);

      // Admin role should suggest high-risk permissions
      const warnings = res.body.securityWarnings;
      expect(warnings).toBeInstanceOf(Array);

      // Should have warnings for sensitive permissions
      const hasHighRisk = warnings.some((w: any) =>
        ['HIGH', 'CRITICAL'].includes(w.risk)
      );
      expect(hasHighRisk).toBe(true);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/ai/suggest-permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          organizationId,
          // Missing userId
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/ai/accept-suggestion', () => {
    let suggestionId: string;

    beforeEach(async () => {
      // Create a test suggestion
      const suggestion = await request(app)
        .post('/api/ai/suggest-permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: regularUserId,
          organizationId,
          role: 'Project Manager',
          department: 'Construction',
        });

      suggestionId = suggestion.body.id || 'test-suggestion-id';
    });

    it('should record suggestion acceptance', async () => {
      const res = await request(app)
        .post('/api/ai/accept-suggestion')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          suggestionId,
          accepted: true,
          actualPermissions: {
            perm_Read: true,
            perm_EditForecast: true,
            perm_Export: true,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should record suggestion modification', async () => {
      const res = await request(app)
        .post('/api/ai/accept-suggestion')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          suggestionId,
          accepted: false,
          actualPermissions: {
            perm_Read: true,
            perm_EditForecast: false,
            perm_Export: true,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/ai/suggestion-stats', () => {
    it('should require admin access', async () => {
      const res = await request(app)
        .get(`/api/ai/suggestion-stats?organizationId=${organizationId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('should return suggestion statistics', async () => {
      const res = await request(app)
        .get(`/api/ai/suggestion-stats?organizationId=${organizationId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalSuggestions');
      expect(res.body).toHaveProperty('acceptedCount');
      expect(res.body).toHaveProperty('acceptanceRate');
      expect(res.body).toHaveProperty('averageConfidence');
      expect(res.body).toHaveProperty('byRole');
    });
  });

  describe('GET /api/ai/role-templates', () => {
    it('should return predefined role templates', async () => {
      const res = await request(app)
        .get('/api/ai/role-templates')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.templates).toHaveProperty('viewer');
      expect(res.body.templates).toHaveProperty('editor');
      expect(res.body.templates).toHaveProperty('admin');
      expect(res.body.templates).toHaveProperty('beo');
      expect(res.body.templates).toHaveProperty('member');

      // Check template structure
      expect(res.body.templates.editor).toHaveProperty('name');
      expect(res.body.templates.editor).toHaveProperty('description');
      expect(res.body.templates.editor).toHaveProperty('capabilities');

      // Impersonate should never be auto-granted
      Object.values(res.body.templates).forEach((template: any) => {
        expect(template.capabilities.perm_Impersonate).toBe(false);
      });
    });
  });

  describe('Performance', () => {
    it('should return suggestions within 500ms (cached)', async () => {
      // First request to populate cache
      await request(app)
        .post('/api/ai/suggest-permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: regularUserId,
          organizationId,
          role: 'Project Manager',
          department: 'Construction',
        });

      // Second request should hit cache
      const start = Date.now();
      const res = await request(app)
        .post('/api/ai/suggest-permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: regularUserId,
          organizationId,
          role: 'Project Manager',
          department: 'Construction',
        });
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(500); // Should be under 500ms
    });
  });
});
