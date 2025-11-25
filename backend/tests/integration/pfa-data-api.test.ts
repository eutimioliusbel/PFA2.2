/**
 * @file pfa-data-api.test.ts
 * @description Integration tests for PFA Data API (Phase 3)
 *
 * Tests:
 * - Live merge query (mirror + modifications)
 * - Draft save/commit/discard workflows
 * - Organization isolation
 * - User permissions
 * - Filtering and pagination
 * - KPI aggregations
 *
 * Prerequisites:
 * - PostgreSQL running with test database
 * - Test data seeded (mirror records + sample modifications)
 * - Test user with valid JWT token
 *
 * Run:
 * npm test -- pfa-data-api.test.ts
 */

import request from 'supertest';
import app from '../../src/server';
import prisma from '../../src/config/database';
import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env';

// ============================================================================
// Test Setup
// ============================================================================

let authToken: string;
let testOrgId: string;
let testUserId: string;
let testMirrorId: string;

beforeAll(async () => {
  // Create test organization
  const testOrg = await prisma.organization.create({
    data: {
      code: 'TEST_ORG',
      name: 'Test Organization',
      isActive: true,
    },
  });
  testOrgId = testOrg.id;

  // Create test user
  const testUser = await prisma.user.create({
    data: {
      username: 'testuser',
      passwordHash: 'dummy', // Not used in tests
      role: 'user',
      isActive: true,
      organizations: {
        create: {
          organizationId: testOrgId,
          role: 'member',
        },
      },
    },
  });
  testUserId = testUser.id;

  // Generate JWT token for test user
  authToken = jwt.sign(
    {
      userId: testUserId,
      username: 'testuser',
      role: 'user',
      organizationIds: [testOrgId],
    },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Create test mirror records
  const mirror1 = await prisma.pfaMirror.create({
    data: {
      organizationId: testOrgId,
      pfaId: 'PFA-TEST-001',
      data: {
        pfaId: 'PFA-TEST-001',
        category: 'Crane',
        class: 'Mobile Crane',
        source: 'Rental',
        dor: 'BEO',
        monthlyRate: 5000,
        forecastStart: '2025-12-01',
        forecastEnd: '2025-12-31',
        isActualized: false,
        isDiscontinued: false,
      },
    },
  });
  testMirrorId = mirror1.id;

  await prisma.pfaMirror.create({
    data: {
      organizationId: testOrgId,
      pfaId: 'PFA-TEST-002',
      data: {
        pfaId: 'PFA-TEST-002',
        category: 'Excavator',
        class: 'Tracked Excavator',
        source: 'Purchase',
        dor: 'PROJECT',
        purchasePrice: 150000,
        forecastStart: '2025-12-15',
        forecastEnd: '2026-01-15',
        isActualized: false,
        isDiscontinued: false,
      },
    },
  });

  await prisma.pfaMirror.create({
    data: {
      organizationId: testOrgId,
      pfaId: 'PFA-TEST-003',
      data: {
        pfaId: 'PFA-TEST-003',
        category: 'Crane',
        class: 'Tower Crane',
        source: 'Rental',
        dor: 'BEO',
        monthlyRate: 8000,
        forecastStart: '2025-11-01',
        forecastEnd: '2026-02-28',
        isActualized: true,
        isDiscontinued: false,
      },
    },
  });
});

afterAll(async () => {
  // Clean up test data
  await prisma.pfaModification.deleteMany({ where: { organizationId: testOrgId } });
  await prisma.pfaMirror.deleteMany({ where: { organizationId: testOrgId } });
  await prisma.userOrganization.deleteMany({ where: { userId: testUserId } });
  await prisma.user.delete({ where: { id: testUserId } });
  await prisma.organization.delete({ where: { id: testOrgId } });
  await prisma.$disconnect();
});

// ============================================================================
// Test: GET /api/pfa/:orgId - Get merged PFA data
// ============================================================================

describe('GET /api/pfa/:orgId', () => {
  it('should return merged PFA data for organization', async () => {
    const response = await request(app)
      .get(`/api/pfa/${testOrgId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeInstanceOf(Array);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.pagination).toBeDefined();
    expect(response.body.pagination.totalRecords).toBe(3);
  });

  it('should filter by category', async () => {
    const response = await request(app)
      .get(`/api/pfa/${testOrgId}?category=Crane`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data.length).toBe(2);
    expect(response.body.data.every((r: any) => r.data.category === 'Crane')).toBe(true);
  });

  it('should filter by source', async () => {
    const response = await request(app)
      .get(`/api/pfa/${testOrgId}?source=Rental`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data.length).toBe(2);
    expect(response.body.data.every((r: any) => r.data.source === 'Rental')).toBe(true);
  });

  it('should filter by isActualized', async () => {
    const response = await request(app)
      .get(`/api/pfa/${testOrgId}?isActualized=true`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data.length).toBe(1);
    expect(response.body.data[0].data.pfaId).toBe('PFA-TEST-003');
  });

  it('should support pagination', async () => {
    const response = await request(app)
      .get(`/api/pfa/${testOrgId}?page=1&pageSize=2`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data.length).toBe(2);
    expect(response.body.pagination.page).toBe(1);
    expect(response.body.pagination.pageSize).toBe(2);
    expect(response.body.pagination.totalPages).toBe(2);
  });

  it('should reject unauthorized requests', async () => {
    await request(app)
      .get(`/api/pfa/${testOrgId}`)
      .expect(401);
  });

  it('should reject requests for other organizations', async () => {
    const otherOrg = await prisma.organization.create({
      data: {
        code: 'OTHER_ORG',
        name: 'Other Organization',
        isActive: true,
      },
    });

    await request(app)
      .get(`/api/pfa/${otherOrg.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(403);

    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });
});

// ============================================================================
// Test: POST /api/pfa/:orgId/draft - Save draft modifications
// ============================================================================

describe('POST /api/pfa/:orgId/draft', () => {
  it('should save draft modifications', async () => {
    const response = await request(app)
      .post(`/api/pfa/${testOrgId}/draft`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        modifications: [
          {
            pfaId: 'PFA-TEST-001',
            delta: {
              forecastStart: '2025-12-15',
              forecastEnd: '2026-01-15',
            },
            changeReason: 'Weather delay',
          },
        ],
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.saved).toBeInstanceOf(Array);
    expect(response.body.saved.length).toBe(1);
    expect(response.body.saved[0].pfaId).toBe('PFA-TEST-001');
    expect(response.body.sessionId).toBeDefined();
  });

  it('should upsert existing modifications', async () => {
    // First save
    const response1 = await request(app)
      .post(`/api/pfa/${testOrgId}/draft`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        sessionId: 'test-session-001',
        modifications: [
          {
            pfaId: 'PFA-TEST-002',
            delta: { monthlyRate: 6000 },
          },
        ],
      })
      .expect(200);

    expect(response1.body.saved[0].version).toBe(1);

    // Second save (upsert)
    const response2 = await request(app)
      .post(`/api/pfa/${testOrgId}/draft`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        sessionId: 'test-session-001',
        modifications: [
          {
            pfaId: 'PFA-TEST-002',
            delta: { monthlyRate: 7000 },
          },
        ],
      })
      .expect(200);

    expect(response2.body.saved[0].version).toBe(2);
  });

  it('should reject empty modifications array', async () => {
    await request(app)
      .post(`/api/pfa/${testOrgId}/draft`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        modifications: [],
      })
      .expect(400);
  });

  it('should return error for non-existent pfaId', async () => {
    const response = await request(app)
      .post(`/api/pfa/${testOrgId}/draft`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        modifications: [
          {
            pfaId: 'NON-EXISTENT',
            delta: { forecastStart: '2025-12-01' },
          },
        ],
      })
      .expect(200);

    expect(response.body.errors).toBeDefined();
    expect(response.body.errors.length).toBe(1);
    expect(response.body.errors[0].pfaId).toBe('NON-EXISTENT');
  });
});

// ============================================================================
// Test: GET /api/pfa/:orgId - Merge query with modifications
// ============================================================================

describe('GET /api/pfa/:orgId - Merge with modifications', () => {
  beforeEach(async () => {
    // Create test modification
    await prisma.pfaModification.create({
      data: {
        mirrorId: testMirrorId,
        organizationId: testOrgId,
        userId: testUserId,
        sessionId: 'merge-test-session',
        syncState: 'draft',
        delta: {
          forecastStart: '2025-12-10',
          monthlyRate: 5500,
        },
        modifiedFields: ['forecastStart', 'monthlyRate'],
      },
    });
  });

  afterEach(async () => {
    await prisma.pfaModification.deleteMany({
      where: { sessionId: 'merge-test-session' },
    });
  });

  it('should merge mirror with modifications', async () => {
    const response = await request(app)
      .get(`/api/pfa/${testOrgId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const mergedRecord = response.body.data.find((r: any) => r.pfaId === 'PFA-TEST-001');
    expect(mergedRecord).toBeDefined();
    expect(mergedRecord.data.forecastStart).toBe('2025-12-10'); // Modified value
    expect(mergedRecord.data.monthlyRate).toBe(5500); // Modified value
    expect(mergedRecord.data.forecastEnd).toBe('2025-12-31'); // Original value
    expect(mergedRecord.syncState).toBe('draft');
  });
});

// ============================================================================
// Test: POST /api/pfa/:orgId/commit - Commit modifications
// ============================================================================

describe('POST /api/pfa/:orgId/commit', () => {
  beforeEach(async () => {
    // Create draft modification
    await prisma.pfaModification.create({
      data: {
        mirrorId: testMirrorId,
        organizationId: testOrgId,
        userId: testUserId,
        sessionId: 'commit-test-session',
        syncState: 'draft',
        delta: { monthlyRate: 6000 },
        modifiedFields: ['monthlyRate'],
      },
    });
  });

  afterEach(async () => {
    await prisma.pfaModification.deleteMany({
      where: { sessionId: 'commit-test-session' },
    });
  });

  it('should commit draft modifications', async () => {
    const response = await request(app)
      .post(`/api/pfa/${testOrgId}/commit`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        sessionId: 'commit-test-session',
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.committedCount).toBe(1);

    // Verify syncState changed to 'committed'
    const modification = await prisma.pfaModification.findFirst({
      where: { sessionId: 'commit-test-session' },
    });
    expect(modification?.syncState).toBe('committed');
    expect(modification?.committedAt).toBeDefined();
  });

  it('should return error if no drafts found', async () => {
    await request(app)
      .post(`/api/pfa/${testOrgId}/commit`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        sessionId: 'non-existent-session',
      })
      .expect(404);
  });
});

// ============================================================================
// Test: POST /api/pfa/:orgId/discard - Discard modifications
// ============================================================================

describe('POST /api/pfa/:orgId/discard', () => {
  beforeEach(async () => {
    // Create draft modifications
    await prisma.pfaModification.create({
      data: {
        mirrorId: testMirrorId,
        organizationId: testOrgId,
        userId: testUserId,
        sessionId: 'discard-test-session',
        syncState: 'draft',
        delta: { monthlyRate: 7000 },
        modifiedFields: ['monthlyRate'],
      },
    });
  });

  it('should discard draft modifications by sessionId', async () => {
    const response = await request(app)
      .post(`/api/pfa/${testOrgId}/discard`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        sessionId: 'discard-test-session',
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.discardedCount).toBe(1);

    // Verify record deleted
    const modification = await prisma.pfaModification.findFirst({
      where: { sessionId: 'discard-test-session' },
    });
    expect(modification).toBeNull();
  });

  it('should discard by pfaIds', async () => {
    const response = await request(app)
      .post(`/api/pfa/${testOrgId}/discard`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        pfaIds: ['PFA-TEST-001'],
      })
      .expect(200);

    expect(response.body.discardedCount).toBeGreaterThanOrEqual(0);
  });

  it('should reject request without discard criteria', async () => {
    await request(app)
      .post(`/api/pfa/${testOrgId}/discard`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({})
      .expect(400);
  });
});

// ============================================================================
// Test: GET /api/pfa/:orgId/stats - KPI Statistics
// ============================================================================

describe('GET /api/pfa/:orgId/stats', () => {
  it('should return KPI statistics', async () => {
    const response = await request(app)
      .get(`/api/pfa/${testOrgId}/stats`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.total_records).toBeDefined();
    expect(response.body.metadata.queryTime).toBeDefined();
  });

  it('should include category breakdown', async () => {
    const response = await request(app)
      .get(`/api/pfa/${testOrgId}/stats`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data.category_breakdown).toBeDefined();
  });
});

// ============================================================================
// Test: Performance - Response time < 200ms
// ============================================================================

describe('Performance Tests', () => {
  it('should return merged data in < 200ms', async () => {
    const startTime = Date.now();

    await request(app)
      .get(`/api/pfa/${testOrgId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(200);
  });

  it('should save drafts in < 200ms', async () => {
    const startTime = Date.now();

    await request(app)
      .post(`/api/pfa/${testOrgId}/draft`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        modifications: [
          {
            pfaId: 'PFA-TEST-001',
            delta: { monthlyRate: 5100 },
          },
        ],
      })
      .expect(200);

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(200);
  });
});
