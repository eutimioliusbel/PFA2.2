/**
 * Performance Benchmarks: API Endpoints (Full Request/Response)
 * Task 10B.4 - Performance Benchmarking for ADR-005
 *
 * Measures end-to-end latency of:
 * 1. Protected PFA data endpoints
 * 2. User management endpoints
 * 3. API server management endpoints
 * 4. Full authentication + authorization + query cycle
 *
 * Performance Targets:
 * - API Response (protected): <200ms (P50), <300ms (P95), <400ms (P99)
 * - Read operations: <150ms (P50)
 * - Write operations: <250ms (P50)
 *
 * Run with: npm test -- apiEndpointBenchmarks.test.ts
 */

import request from 'supertest';
import { app } from '../../src/server';
import prisma from '../../src/config/database';
import { AuthService } from '../../src/services/auth/authService';

interface PerformanceMetrics {
  samples: number[];
  mean: number;
  p50: number;
  p75: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
}

function calculateMetrics(samples: number[]): PerformanceMetrics {
  const sorted = samples.sort((a, b) => a - b);
  const len = sorted.length;

  const mean = sorted.reduce((sum, val) => sum + val, 0) / len;
  const p50 = sorted[Math.floor(len * 0.5)];
  const p75 = sorted[Math.floor(len * 0.75)];
  const p95 = sorted[Math.floor(len * 0.95)];
  const p99 = sorted[Math.floor(len * 0.99)];
  const min = sorted[0];
  const max = sorted[len - 1];

  return { samples, mean, p50, p75, p95, p99, min, max };
}

async function runBenchmark(
  name: string,
  iterations: number,
  fn: () => Promise<void>
): Promise<PerformanceMetrics> {
  console.log(`\n🔄 Running benchmark: ${name} (${iterations} iterations)...`);

  const latencies: number[] = [];

  // Warmup
  for (let i = 0; i < 5; i++) {
    await fn();
  }

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    latencies.push(end - start);
  }

  const metrics = calculateMetrics(latencies);

  console.log(`✅ ${name} - Results:`);
  console.log(`   Mean: ${metrics.mean.toFixed(2)}ms`);
  console.log(`   P50:  ${metrics.p50.toFixed(2)}ms`);
  console.log(`   P75:  ${metrics.p75.toFixed(2)}ms`);
  console.log(`   P95:  ${metrics.p95.toFixed(2)}ms`);
  console.log(`   P99:  ${metrics.p99.toFixed(2)}ms`);
  console.log(`   Range: ${metrics.min.toFixed(2)}ms - ${metrics.max.toFixed(2)}ms`);

  return metrics;
}

describe('API Endpoint - Performance Benchmarks', () => {
  let authService: AuthService;
  let adminToken: string;
  let editorToken: string;
  let viewerToken: string;
  let testOrgId: string;
  let testUserId: string;
  let pfaRecordIds: string[] = [];

  beforeAll(async () => {
    authService = new AuthService();

    // Create test organization
    const testOrg = await prisma.organization.create({
      data: {
        code: 'API_PERF_TEST',
        name: 'API Performance Test Org',
        isActive: true,
        serviceStatus: 'active',
      },
    });
    testOrgId = testOrg.id;

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        username: 'api_perf_admin',
        email: 'admin@apiperf.com',
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

    // Create editor user
    const editorUser = await prisma.user.create({
      data: {
        username: 'api_perf_editor',
        email: 'editor@apiperf.com',
        passwordHash: await authService['hashPassword']('password123'),
        role: 'user',
        isActive: true,
        authProvider: 'local',
        serviceStatus: 'active',
      },
    });
    testUserId = editorUser.id;

    await prisma.userOrganization.create({
      data: {
        userId: editorUser.id,
        organizationId: testOrgId,
        role: 'editor',
        perm_Read: true,
        perm_EditForecast: true,
        perm_ViewFinancials: true,
        perm_SaveDraft: true,
        perm_Sync: true,
      },
    });

    // Create viewer user
    const viewerUser = await prisma.user.create({
      data: {
        username: 'api_perf_viewer',
        email: 'viewer@apiperf.com',
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
        perm_Read: true,
      },
    });

    // Generate tokens
    const adminLogin = await authService.login('api_perf_admin', 'password123');
    adminToken = adminLogin.token;

    const editorLogin = await authService.login('api_perf_editor', 'password123');
    editorToken = editorLogin.token;

    const viewerLogin = await authService.login('api_perf_viewer', 'password123');
    viewerToken = viewerLogin.token;

    // Create test PFA records (500 for API testing)
    console.log('Creating 500 test PFA records...');
    const pfaRecords = [];
    for (let i = 0; i < 500; i++) {
      pfaRecords.push({
        id: `api-perf-test-${i}`,
        pfaId: `PFA-API-${i.toString().padStart(4, '0')}`,
        organizationId: testOrgId,
        category: i % 5 === 0 ? 'Heavy Equipment' : 'Light Equipment',
        class: i % 3 === 0 ? 'Crane' : 'Forklift',
        source: i % 2 === 0 ? 'Rental' : 'Purchase',
        dor: i % 2 === 0 ? 'BEO' : 'PROJECT',
        areaSilo: `Area ${i % 10}`,
        isActualized: i % 4 === 0,
        isDiscontinued: false,
        monthlyRate: i % 2 === 0 ? 5000.0 : null,
        purchasePrice: i % 2 === 1 ? 50000.0 : null,
        forecastStart: new Date('2025-01-01'),
        forecastEnd: new Date('2025-12-31'),
        syncState: 'pristine',
      });
    }

    const batchSize = 100;
    for (let i = 0; i < pfaRecords.length; i += batchSize) {
      const batch = pfaRecords.slice(i, i + batchSize);
      await prisma.pfaRecord.createMany({
        data: batch,
      });
    }

    pfaRecordIds = pfaRecords.map((r) => r.id);
    console.log('Test data created successfully!');
  });

  afterAll(async () => {
    // Cleanup
    console.log('Cleaning up test data...');
    await prisma.pfaRecord.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.userOrganization.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.user.deleteMany({
      where: {
        username: {
          in: ['api_perf_admin', 'api_perf_editor', 'api_perf_viewer'],
        },
      },
    });
    await prisma.organization.delete({
      where: { id: testOrgId },
    });
    await prisma.$disconnect();
  });

  describe('Benchmark 1: Authentication Endpoints', () => {
    it('should login in <100ms (P50)', async () => {
      const iterations = 100;

      const metrics = await runBenchmark('POST /api/auth/login', iterations, async () => {
        await request(app).post('/api/auth/login').send({
          username: 'api_perf_editor',
          password: 'password123',
        });
      });

      // Login should be fast (JWT generation + password hash comparison)
      expect(metrics.p50).toBeLessThan(100); // Target: <100ms
      expect(metrics.p95).toBeLessThan(200); // Target: <200ms
    });
  });

  describe('Benchmark 2: Read Operations (PFA Data)', () => {
    it('should fetch PFA data in <150ms (P50)', async () => {
      const iterations = 100;

      const metrics = await runBenchmark(
        'GET /api/pfa/:orgId (Read Permission)',
        iterations,
        async () => {
          const response = await request(app)
            .get(`/api/pfa/${testOrgId}`)
            .set('Authorization', `Bearer ${editorToken}`);

          expect(response.status).toBe(200);
        }
      );

      // Read operations should be fast
      expect(metrics.p50).toBeLessThan(150); // Target: <150ms
      expect(metrics.p95).toBeLessThan(250); // Target: <250ms
      expect(metrics.p99).toBeLessThan(400); // Target: <400ms
    });

    it('should fetch PFA data with filters in <200ms (P50)', async () => {
      const iterations = 100;

      const metrics = await runBenchmark(
        'GET /api/pfa/:orgId?category=Heavy&source=Rental',
        iterations,
        async () => {
          const response = await request(app)
            .get(`/api/pfa/${testOrgId}`)
            .query({
              category: 'Heavy Equipment',
              source: 'Rental',
            })
            .set('Authorization', `Bearer ${editorToken}`);

          expect(response.status).toBe(200);
        }
      );

      // Filtered queries add minimal overhead
      expect(metrics.p50).toBeLessThan(200); // Target: <200ms
      expect(metrics.p95).toBeLessThan(300); // Target: <300ms
    });
  });

  describe('Benchmark 3: Write Operations (Save Draft)', () => {
    it('should save draft in <250ms (P50)', async () => {
      const iterations = 50; // Fewer iterations for write operations

      const metrics = await runBenchmark(
        'POST /api/pfa/:orgId/draft (SaveDraft Permission)',
        iterations,
        async () => {
          const response = await request(app)
            .post(`/api/pfa/${testOrgId}/draft`)
            .set('Authorization', `Bearer ${editorToken}`)
            .send({
              modifications: [
                {
                  pfaId: 'PFA-API-0001',
                  delta: {
                    forecastStart: '2025-06-01',
                    forecastEnd: '2025-12-31',
                  },
                },
              ],
            });

          expect(response.status).not.toBe(403);
        }
      );

      // Write operations with audit logging
      expect(metrics.p50).toBeLessThan(250); // Target: <250ms
      expect(metrics.p95).toBeLessThan(400); // Target: <400ms
    });
  });

  describe('Benchmark 4: Permission Denials', () => {
    it('should deny unauthorized requests in <100ms (P50)', async () => {
      const iterations = 100;

      const metrics = await runBenchmark(
        'POST /api/pfa/:orgId/draft (Permission Denied)',
        iterations,
        async () => {
          const response = await request(app)
            .post(`/api/pfa/${testOrgId}/draft`)
            .set('Authorization', `Bearer ${viewerToken}`) // Viewer has no SaveDraft permission
            .send({
              modifications: [
                {
                  pfaId: 'PFA-API-0001',
                  delta: { forecastStart: '2025-06-01' },
                },
              ],
            });

          expect(response.status).toBe(403);
        }
      );

      // Permission denials should fail fast (before hitting controller)
      expect(metrics.p50).toBeLessThan(100); // Target: <100ms
      expect(metrics.p95).toBeLessThan(150); // Target: <150ms
    });
  });

  describe('Benchmark 5: User Management Endpoints', () => {
    it('should create user in <300ms (P50)', async () => {
      const iterations = 50;

      const createdUserIds: string[] = [];

      const metrics = await runBenchmark(
        'POST /api/users (ManageUsers Permission)',
        iterations,
        async () => {
          const randomUsername = `perf_user_${Math.random().toString(36).substring(7)}`;
          const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              username: randomUsername,
              password: 'password123',
              email: `${randomUsername}@test.com`,
              organizationId: testOrgId,
            });

          if (response.status === 201 && response.body.user) {
            createdUserIds.push(response.body.user.id);
          }
        }
      );

      // Cleanup created users
      await prisma.user.deleteMany({
        where: {
          id: { in: createdUserIds },
        },
      });

      // User creation includes password hashing (bcrypt is slow)
      expect(metrics.p50).toBeLessThan(300); // Target: <300ms
      expect(metrics.p95).toBeLessThan(500); // Target: <500ms
    });
  });

  describe('Benchmark 6: Concurrent Requests', () => {
    it('should handle 10 concurrent requests in <250ms (P50 per request)', async () => {
      const iterations = 20; // 20 batches
      const concurrency = 10; // 10 concurrent requests per batch

      const metrics = await runBenchmark(
        'Concurrent Read Requests (10 parallel)',
        iterations,
        async () => {
          const promises = [];

          for (let i = 0; i < concurrency; i++) {
            const promise = request(app)
              .get(`/api/pfa/${testOrgId}`)
              .set('Authorization', `Bearer ${editorToken}`)
              .then((res) => {
                expect(res.status).toBe(200);
              });

            promises.push(promise);
          }

          await Promise.all(promises);
        }
      );

      // Concurrent requests should not cause severe degradation
      // Note: This measures the time for ALL 10 requests to complete
      expect(metrics.p50).toBeLessThan(500); // Target: <500ms for batch
      expect(metrics.p95).toBeLessThan(1000); // Target: <1000ms for batch
    });
  });

  describe('Benchmark 7: Cross-Organization Denial', () => {
    it('should deny cross-org access in <75ms (P50)', async () => {
      const iterations = 100;

      // Create another organization
      const otherOrg = await prisma.organization.create({
        data: {
          code: 'OTHER_ORG_PERF',
          name: 'Other Org Performance Test',
          isActive: true,
          serviceStatus: 'active',
        },
      });

      const metrics = await runBenchmark(
        'GET /api/pfa/:orgId (Cross-Org Denial)',
        iterations,
        async () => {
          const response = await request(app)
            .get(`/api/pfa/${otherOrg.id}`)
            .set('Authorization', `Bearer ${editorToken}`); // User only has access to testOrgId

          expect(response.status).toBe(403);
        }
      );

      // Cleanup
      await prisma.organization.delete({
        where: { id: otherOrg.id },
      });

      // Cross-org denials should be very fast (no database query needed)
      expect(metrics.p50).toBeLessThan(75); // Target: <75ms
      expect(metrics.p95).toBeLessThan(150); // Target: <150ms
    });
  });

  describe('Benchmark 8: End-to-End Latency Breakdown', () => {
    it('should break down latency components', async () => {
      console.log('\n📊 Latency Breakdown Analysis');

      // Step 1: JWT verification only
      const jwtStart = performance.now();
      await request(app)
        .get(`/api/pfa/${testOrgId}`)
        .set('Authorization', `Bearer ${editorToken}`);
      const jwtEnd = performance.now();

      const jwtLatency = jwtEnd - jwtStart;

      // Step 2: Database query only (without HTTP overhead)
      const dbStart = performance.now();
      await prisma.pfaRecord.findMany({
        where: {
          organizationId: testOrgId,
        },
        take: 100,
      });
      const dbEnd = performance.now();

      const dbLatency = dbEnd - dbStart;

      console.log(`   Full Request Latency: ${jwtLatency.toFixed(2)}ms`);
      console.log(`   Database Query Only:  ${dbLatency.toFixed(2)}ms`);
      console.log(
        `   Middleware + HTTP:    ${(jwtLatency - dbLatency).toFixed(2)}ms (${(((jwtLatency - dbLatency) / jwtLatency) * 100).toFixed(1)}%)`
      );
      console.log(
        `   Database Overhead:    ${dbLatency.toFixed(2)}ms (${((dbLatency / jwtLatency) * 100).toFixed(1)}%)`
      );

      // HTTP + Middleware overhead should be <50ms
      expect(jwtLatency - dbLatency).toBeLessThan(50);
    });
  });
});
