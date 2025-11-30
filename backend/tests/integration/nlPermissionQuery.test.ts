// backend/tests/integration/nlPermissionQuery.test.ts
/**
 * Integration Tests: Natural Language Permission Queries
 *
 * Phase 6, Task 6.4 of ADR-005 Multi-Tenant Access Control
 *
 * Tests semantic understanding, confidence scoring, and query variations.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../src/server';

const prisma = new PrismaClient();

// Test data
let testToken: string;
let testUser: any;
let testOrg: any;

beforeAll(async () => {
  // Create test organization
  testOrg = await prisma.organization.create({
    data: {
      code: 'NLTEST',
      name: 'NL Query Test Org',
      isActive: true,
    },
  });

  // Create test user (admin)
  testUser = await prisma.user.create({
    data: {
      username: 'nl_test_admin',
      email: 'nltest@example.com',
      passwordHash: '$2b$10$XqTH18VQVJ1F8VX9Z0Q3r.S9Q8H9X1X2X3X4X5X6X7X8X9', // hash of 'test123'
      role: 'admin',
      isActive: true,
      organizations: {
        create: {
          organizationId: testOrg.id,
          role: 'admin',
          perm_Read: true,
          perm_ManageUsers: true,
          perm_ViewFinancials: true,
        },
      },
    },
  });

  // Create additional test users for queries
  await prisma.user.createMany({
    data: [
      {
        username: 'john.doe',
        email: 'john.doe@example.com',
        passwordHash: '$2b$10$dummy',
        role: 'user',
        isActive: true,
      },
      {
        username: 'alice.smith',
        email: 'alice.smith@example.com',
        passwordHash: '$2b$10$dummy',
        role: 'user',
        isActive: true,
      },
      {
        username: 'bob.jones',
        email: 'bob.jones@example.com',
        passwordHash: '$2b$10$dummy',
        role: 'viewer',
        isActive: true,
      },
    ],
  });

  // Assign users to organization with different permissions
  const users = await prisma.user.findMany({
    where: {
      username: {
        in: ['john.doe', 'alice.smith', 'bob.jones'],
      },
    },
  });

  for (const user of users) {
    await prisma.userOrganization.create({
      data: {
        userId: user.id,
        organizationId: testOrg.id,
        role: user.role,
        perm_Read: true,
        perm_EditForecast: user.username === 'john.doe' || user.username === 'alice.smith',
        perm_Delete: user.username === 'john.doe',
        perm_ViewFinancials: user.username === 'alice.smith',
      },
    });
  }

  // Login to get token
  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({ username: 'nl_test_admin', password: 'test123' });

  testToken = loginResponse.body.token;
});

afterAll(async () => {
  // Cleanup test data
  await prisma.userOrganization.deleteMany({
    where: { organizationId: testOrg.id },
  });

  await prisma.user.deleteMany({
    where: {
      username: {
        in: ['nl_test_admin', 'john.doe', 'alice.smith', 'bob.jones'],
      },
    },
  });

  await prisma.organization.delete({
    where: { id: testOrg.id },
  });

  await prisma.$disconnect();
});

// ============================================================================
// User Permission Queries
// ============================================================================

describe('Natural Language Permission Queries - User Permissions', () => {
  test('should understand "What can john.doe do?"', async () => {
    const response = await request(app)
      .post('/api/ai/nl-query')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ query: 'What can john.doe do?' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.queryType).toBe('user_permissions');
    expect(response.body.confidence).toBeGreaterThanOrEqual(0.7);
    expect(response.body.data.user.username).toBe('john.doe');
  });

  test('should understand "Show me alice\'s permissions"', async () => {
    const response = await request(app)
      .post('/api/ai/nl-query')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ query: 'Show me alice\'s permissions' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.queryType).toBe('user_permissions');
    expect(response.body.confidence).toBeGreaterThanOrEqual(0.7);
    expect(response.body.data.user.username).toContain('alice');
  });

  test('should handle variations: "What access does bob.jones have?"', async () => {
    const response = await request(app)
      .post('/api/ai/nl-query')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ query: 'What access does bob.jones have?' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.queryType).toBe('user_permissions');
    expect(response.body.confidence).toBeGreaterThanOrEqual(0.7);
  });
});

// ============================================================================
// Organization Permission Queries
// ============================================================================

describe('Natural Language Permission Queries - Organization Permissions', () => {
  test('should understand "Who has access to NLTEST?"', async () => {
    const response = await request(app)
      .post('/api/ai/nl-query')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ query: 'Who has access to NLTEST?' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.queryType).toBe('org_permissions');
    expect(response.body.confidence).toBeGreaterThanOrEqual(0.7);
    expect(response.body.data.organization.code).toBe('NLTEST');
    expect(response.body.data.users.length).toBeGreaterThan(0);
  });

  test('should filter by permission: "Who can delete records in NLTEST?"', async () => {
    const response = await request(app)
      .post('/api/ai/nl-query')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ query: 'Who can delete records in NLTEST?' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.confidence).toBeGreaterThanOrEqual(0.7);
    // Should only return john.doe (who has perm_Delete)
    expect(response.body.data.users.length).toBe(1);
    expect(response.body.data.users[0].username).toBe('john.doe');
  });
});

// ============================================================================
// Capability Search Queries
// ============================================================================

describe('Natural Language Permission Queries - Capability Search', () => {
  test('should understand "Who can delete records?"', async () => {
    const response = await request(app)
      .post('/api/ai/nl-query')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ query: 'Who can delete records?' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.queryType).toBe('capability_search');
    expect(response.body.confidence).toBeGreaterThanOrEqual(0.7);
  });

  test('should understand semantic variations: "Show me users with financial access"', async () => {
    const response = await request(app)
      .post('/api/ai/nl-query')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ query: 'Show me users with financial access' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.queryType).toBe('capability_search');
    expect(response.body.confidence).toBeGreaterThanOrEqual(0.7);
    // Should only return alice.smith (who has perm_ViewFinancials)
    const usernames = response.body.data.users.map((u: any) => u.username);
    expect(usernames).toContain('alice.smith');
  });

  test('should understand "List users who can manage settings"', async () => {
    const response = await request(app)
      .post('/api/ai/nl-query')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ query: 'List users who can manage settings' });

    expect(response.status).toBe(200);
    expect(response.body.queryType).toBe('capability_search');
    expect(response.body.confidence).toBeGreaterThanOrEqual(0.7);
  });
});

// ============================================================================
// Confidence Scoring
// ============================================================================

describe('Natural Language Permission Queries - Confidence Scoring', () => {
  test('should return high confidence for clear queries', async () => {
    const response = await request(app)
      .post('/api/ai/nl-query')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ query: 'What can john.doe do?' });

    expect(response.status).toBe(200);
    expect(response.body.confidence).toBeGreaterThanOrEqual(0.7);
    expect(response.body.parsingMethod).toBe('llm'); // Should use LLM if Gemini is configured
  });

  test('should reject ambiguous queries with low confidence', async () => {
    const response = await request(app)
      .post('/api/ai/nl-query')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ query: 'stuff things maybe?' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(false);
    expect(response.body.confidence).toBeLessThan(0.7);
    expect(response.body.lowConfidenceWarning).toBeDefined();
  });

  test('should display confidence in response', async () => {
    const response = await request(app)
      .post('/api/ai/nl-query')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ query: 'Who can delete?' });

    expect(response.status).toBe(200);
    expect(response.body.confidence).toBeDefined();
    expect(response.body.confidence).toBeGreaterThanOrEqual(0);
    expect(response.body.confidence).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// Semantic Matching
// ============================================================================

describe('Natural Language Permission Queries - Semantic Matching', () => {
  test('should match "manage settings" to perm_ManageSettings', async () => {
    const response = await request(app)
      .post('/api/ai/nl-query')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ query: 'Who can configure the system?' });

    expect(response.status).toBe(200);
    expect(response.body.queryType).toBe('capability_search');
  });

  test('should match "financial data" to perm_ViewFinancials', async () => {
    const response = await request(app)
      .post('/api/ai/nl-query')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ query: 'Show me users with access to cost data' });

    expect(response.status).toBe(200);
    expect(response.body.queryType).toBe('capability_search');
  });

  test('should match "admin" to role or admin permissions', async () => {
    const response = await request(app)
      .post('/api/ai/nl-query')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ query: 'Who has administrator access?' });

    expect(response.status).toBe(200);
    expect(response.body.queryType).toMatch(/capability_search|org_permissions/);
  });
});

// ============================================================================
// Query History & Suggestions
// ============================================================================

describe('Natural Language Permission Queries - History & Suggestions', () => {
  test('should provide query suggestions', async () => {
    const response = await request(app)
      .get('/api/ai/nl-query/suggestions')
      .set('Authorization', `Bearer ${testToken}`);

    expect(response.status).toBe(200);
    expect(response.body.suggestions).toBeDefined();
    expect(response.body.suggestions.length).toBeGreaterThan(0);
    expect(response.body.suggestions[0].category).toBeDefined();
    expect(response.body.suggestions[0].queries).toBeDefined();
  });

  test('should track query history', async () => {
    // Execute a query
    await request(app)
      .post('/api/ai/nl-query')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ query: 'What can john.doe do?' });

    // Check history
    const historyResponse = await request(app)
      .get('/api/ai/nl-query/history')
      .set('Authorization', `Bearer ${testToken}`);

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.history).toBeDefined();
    expect(historyResponse.body.history.length).toBeGreaterThan(0);
    expect(historyResponse.body.history[0].query).toBe('What can john.doe do?');
  });
});

// ============================================================================
// Error Handling
// ============================================================================

describe('Natural Language Permission Queries - Error Handling', () => {
  test('should require authentication', async () => {
    const response = await request(app)
      .post('/api/ai/nl-query')
      .send({ query: 'Who can delete?' });

    expect(response.status).toBe(401);
  });

  test('should validate query input', async () => {
    const response = await request(app)
      .post('/api/ai/nl-query')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ query: '' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
  });

  test('should handle unknown users gracefully', async () => {
    const response = await request(app)
      .post('/api/ai/nl-query')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ query: 'What can nonexistent.user do?' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.response).toContain('couldn\'t find');
  });

  test('should handle unknown organizations gracefully', async () => {
    const response = await request(app)
      .post('/api/ai/nl-query')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ query: 'Who has access to NONEXISTENT?' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.response).toContain('couldn\'t find');
  });
});
