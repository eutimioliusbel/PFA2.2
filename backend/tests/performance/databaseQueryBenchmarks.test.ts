/**
 * Performance Benchmarks: Database Queries
 * Task 10B.4 - Performance Benchmarking for ADR-005
 *
 * Measures latency of:
 * 1. PfaRecord queries filtered by organizationId
 * 2. JSONB field queries (UserOrganization permissions)
 * 3. Composite index performance
 * 4. Join queries (User + UserOrganization)
 *
 * Performance Targets:
 * - Database Query (by org): <100ms (P50), <150ms (P95), <200ms (P99)
 * - Indexed queries: <50ms (P50)
 * - JSONB queries: <75ms (P50)
 *
 * Run with: npm test -- databaseQueryBenchmarks.test.ts
 */

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
  for (let i = 0; i < 10; i++) {
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

describe('Database Query - Performance Benchmarks', () => {
  let authService: AuthService;
  let testOrgId: string;
  let testUserId: string;
  let pfaRecordIds: string[] = [];

  beforeAll(async () => {
    authService = new AuthService();

    // Create test organization
    const testOrg = await prisma.organization.create({
      data: {
        code: 'DB_PERF_TEST',
        name: 'Database Performance Test Org',
        isActive: true,
        serviceStatus: 'active',
      },
    });
    testOrgId = testOrg.id;

    // Create test user
    const testUser = await prisma.user.create({
      data: {
        username: 'db_perf_user',
        email: 'dbperf@test.com',
        passwordHash: await authService['hashPassword']('password123'),
        role: 'user',
        isActive: true,
        authProvider: 'local',
        serviceStatus: 'active',
      },
    });
    testUserId = testUser.id;

    // Grant permissions
    await prisma.userOrganization.create({
      data: {
        userId: testUser.id,
        organizationId: testOrgId,
        role: 'editor',
        perm_Read: true,
        perm_EditForecast: true,
        perm_EditActuals: true,
        perm_ViewFinancials: true,
        perm_SaveDraft: true,
        perm_Sync: true,
      },
    });

    // Create test PFA records (1000 records for realistic testing)
    console.log('Creating 1000 test PFA records...');
    const pfaRecords = [];
    for (let i = 0; i < 1000; i++) {
      pfaRecords.push({
        id: `perf-test-${i}`,
        pfaId: `PFA-PERF-${i.toString().padStart(4, '0')}`,
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
        originalStart: new Date('2025-01-01'),
        originalEnd: new Date('2025-12-31'),
        syncState: 'pristine',
      });
    }

    // Batch insert (Prisma doesn't have great bulk insert, so we'll do smaller batches)
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
    await prisma.user.delete({
      where: { id: testUserId },
    });
    await prisma.organization.delete({
      where: { id: testOrgId },
    });
    await prisma.$disconnect();
  });

  describe('Benchmark 1: Simple Organization Filtering', () => {
    it('should query PFA records by organizationId in <100ms (P50)', async () => {
      const iterations = 200;

      const metrics = await runBenchmark(
        'PFA Query: organizationId filter',
        iterations,
        async () => {
          await prisma.pfaRecord.findMany({
            where: {
              organizationId: testOrgId,
            },
            take: 100, // Limit to first 100 (pagination simulation)
          });
        }
      );

      // Validate targets
      expect(metrics.p50).toBeLessThan(100); // Target: <100ms
      expect(metrics.p95).toBeLessThan(150); // Target: <150ms
      expect(metrics.p99).toBeLessThan(200); // Target: <200ms
    });
  });

  describe('Benchmark 2: Composite Index Performance', () => {
    it('should query with composite index (org + category + source) in <50ms', async () => {
      const iterations = 200;

      const metrics = await runBenchmark(
        'PFA Query: organizationId + category + source',
        iterations,
        async () => {
          await prisma.pfaRecord.findMany({
            where: {
              organizationId: testOrgId,
              category: 'Heavy Equipment',
              source: 'Rental',
            },
            take: 100,
          });
        }
      );

      // Composite index should be fast
      expect(metrics.p50).toBeLessThan(50); // Target: <50ms
      expect(metrics.p95).toBeLessThan(100); // Target: <100ms
    });

    it('should query with date range filter in <75ms', async () => {
      const iterations = 200;

      const metrics = await runBenchmark(
        'PFA Query: organizationId + date range',
        iterations,
        async () => {
          await prisma.pfaRecord.findMany({
            where: {
              organizationId: testOrgId,
              forecastStart: {
                gte: new Date('2025-01-01'),
              },
              forecastEnd: {
                lte: new Date('2025-06-30'),
              },
            },
            take: 100,
          });
        }
      );

      // Date range queries should use index
      expect(metrics.p50).toBeLessThan(75); // Target: <75ms
      expect(metrics.p95).toBeLessThan(150); // Target: <150ms
    });
  });

  describe('Benchmark 3: Sync State Filtering', () => {
    it('should query modified records in <50ms (P50)', async () => {
      const iterations = 200;

      // Create some modified records
      await prisma.pfaRecord.updateMany({
        where: {
          organizationId: testOrgId,
          id: { in: pfaRecordIds.slice(0, 50) }, // First 50 records
        },
        data: {
          syncState: 'modified',
        },
      });

      const metrics = await runBenchmark(
        'PFA Query: modified records (for sync)',
        iterations,
        async () => {
          await prisma.pfaRecord.findMany({
            where: {
              organizationId: testOrgId,
              syncState: { in: ['modified', 'pending_sync'] },
            },
          });
        }
      );

      // Reset sync state
      await prisma.pfaRecord.updateMany({
        where: {
          organizationId: testOrgId,
          id: { in: pfaRecordIds.slice(0, 50) },
        },
        data: {
          syncState: 'pristine',
        },
      });

      // Sync state queries are critical for write sync
      expect(metrics.p50).toBeLessThan(50); // Target: <50ms
      expect(metrics.p95).toBeLessThan(100); // Target: <100ms
    });
  });

  describe('Benchmark 4: User Permission Queries', () => {
    it('should query user permissions in <20ms (P50)', async () => {
      const iterations = 200;

      const metrics = await runBenchmark(
        'User Permission Query',
        iterations,
        async () => {
          await prisma.userOrganization.findFirst({
            where: {
              userId: testUserId,
              organizationId: testOrgId,
            },
            select: {
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
        }
      );

      // Permission checks should be very fast (hot path)
      expect(metrics.p50).toBeLessThan(20); // Target: <20ms
      expect(metrics.p95).toBeLessThan(40); // Target: <40ms
    });
  });

  describe('Benchmark 5: Join Queries (User + Permissions)', () => {
    it('should join user and permissions in <30ms (P50)', async () => {
      const iterations = 200;

      const metrics = await runBenchmark(
        'User + Permissions Join',
        iterations,
        async () => {
          await prisma.user.findUnique({
            where: { id: testUserId },
            include: {
              organizations: {
                where: {
                  organizationId: testOrgId,
                },
                include: {
                  organization: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                    },
                  },
                },
              },
            },
          });
        }
      );

      // Join queries for JWT payload generation
      expect(metrics.p50).toBeLessThan(30); // Target: <30ms
      expect(metrics.p95).toBeLessThan(60); // Target: <60ms
    });
  });

  describe('Benchmark 6: Audit Log Writes', () => {
    it('should write audit logs in <25ms (P50)', async () => {
      const iterations = 200;

      const auditLogIds: string[] = [];

      const metrics = await runBenchmark(
        'Audit Log Write (permission denial)',
        iterations,
        async () => {
          const result = await prisma.auditLog.create({
            data: {
              userId: testUserId,
              organizationId: testOrgId,
              action: 'permission_denied',
              resource: '/api/pfa',
              method: 'POST',
              success: false,
              metadata: {
                username: 'db_perf_user',
                permission: 'perm_EditForecast',
                reason: 'PERMISSION_DENIED',
                timestamp: new Date().toISOString(),
              },
            },
          });
          auditLogIds.push(result.id);
        }
      );

      // Cleanup audit logs
      await prisma.auditLog.deleteMany({
        where: {
          id: { in: auditLogIds },
        },
      });

      // Audit log writes should not block requests
      expect(metrics.p50).toBeLessThan(25); // Target: <25ms
      expect(metrics.p95).toBeLessThan(50); // Target: <50ms
    });
  });

  describe('Benchmark 7: Count Queries', () => {
    it('should count records in <50ms (P50)', async () => {
      const iterations = 200;

      const metrics = await runBenchmark(
        'Count Query (organizationId filter)',
        iterations,
        async () => {
          await prisma.pfaRecord.count({
            where: {
              organizationId: testOrgId,
            },
          });
        }
      );

      // Count queries for pagination
      expect(metrics.p50).toBeLessThan(50); // Target: <50ms
      expect(metrics.p95).toBeLessThan(100); // Target: <100ms
    });

    it('should count with filters in <75ms (P50)', async () => {
      const iterations = 200;

      const metrics = await runBenchmark(
        'Count Query (with filters)',
        iterations,
        async () => {
          await prisma.pfaRecord.count({
            where: {
              organizationId: testOrgId,
              category: 'Heavy Equipment',
              source: 'Rental',
              isDiscontinued: false,
            },
          });
        }
      );

      // Filtered count queries
      expect(metrics.p50).toBeLessThan(75); // Target: <75ms
      expect(metrics.p95).toBeLessThan(150); // Target: <150ms
    });
  });

  describe('Benchmark 8: Pagination Performance', () => {
    it('should paginate with cursor in <60ms (P50)', async () => {
      const iterations = 200;

      const metrics = await runBenchmark(
        'Cursor Pagination (skip + take)',
        iterations,
        async () => {
          await prisma.pfaRecord.findMany({
            where: {
              organizationId: testOrgId,
            },
            skip: 100,
            take: 50,
            orderBy: {
              createdAt: 'desc',
            },
          });
        }
      );

      // Pagination for UI tables
      expect(metrics.p50).toBeLessThan(60); // Target: <60ms
      expect(metrics.p95).toBeLessThan(120); // Target: <120ms
    });
  });
});
