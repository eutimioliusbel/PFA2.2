/**
 * Performance Benchmarks: Authorization Middleware
 * Task 10B.4 - Performance Benchmarking for ADR-005
 *
 * Measures latency of:
 * 1. JWT token verification (authenticateJWT middleware)
 * 2. Permission checks (requirePermission middleware)
 * 3. Organization access checks (requireOrgAccess middleware)
 *
 * Performance Targets:
 * - Authorization Middleware: <50ms (P50), <75ms (P95), <100ms (P99)
 * - JWT Verification: <10ms (P50)
 * - Permission Check: <20ms (P50)
 *
 * Run with: npm test -- authorizationBenchmarks.test.ts
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateJWT, requireOrgAccess } from '../../src/middleware/auth';
import { requirePermission } from '../../src/middleware/requirePermission';
import { AuthService } from '../../src/services/auth/authService';
import prisma from '../../src/config/database';
import { env } from '../../src/config/env';
import { AuthRequest } from '../../src/types/auth';

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

/**
 * Calculate performance metrics from latency samples
 */
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

/**
 * Run benchmark: Execute function N times and measure latency
 */
async function runBenchmark(
  name: string,
  iterations: number,
  fn: () => Promise<void>
): Promise<PerformanceMetrics> {
  console.log(`\n🔄 Running benchmark: ${name} (${iterations} iterations)...`);

  const latencies: number[] = [];

  // Warmup (exclude from results)
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

/**
 * Mock Express request/response/next for middleware testing
 */
function createMockReqRes(): {
  req: Partial<AuthRequest>;
  res: Partial<Response>;
  next: NextFunction;
  nextCalled: () => boolean;
} {
  let nextWasCalled = false;

  const req: Partial<AuthRequest> = {
    headers: {},
    params: {},
    query: {},
    body: {},
    path: '/api/test',
    method: 'GET',
  };

  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  const next: NextFunction = jest.fn(() => {
    nextWasCalled = true;
  });

  return {
    req,
    res,
    next,
    nextCalled: () => nextWasCalled,
  };
}

describe('Authorization Middleware - Performance Benchmarks', () => {
  let authService: AuthService;
  let validToken: string;
  let testUserId: string;
  let testOrgId: string;

  beforeAll(async () => {
    authService = new AuthService();

    // Create test organization
    const testOrg = await prisma.organization.create({
      data: {
        code: 'PERF_TEST',
        name: 'Performance Test Org',
        isActive: true,
        serviceStatus: 'active',
      },
    });
    testOrgId = testOrg.id;

    // Create test user with permissions
    const testUser = await prisma.user.create({
      data: {
        username: 'perf_test_user',
        email: 'perf@test.com',
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
        perm_SaveDraft: true,
        perm_Sync: true,
        perm_ViewFinancials: true,
      },
    });

    // Generate JWT token
    const loginResult = await authService.login('perf_test_user', 'password123');
    validToken = loginResult.token;
  });

  afterAll(async () => {
    // Cleanup
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

  describe('Benchmark 1: JWT Token Verification', () => {
    it('should verify JWT tokens in <10ms (P50)', async () => {
      const iterations = 1000;

      const metrics = await runBenchmark(
        'JWT Token Verification',
        iterations,
        async () => {
          const { req, res, next } = createMockReqRes();
          req.headers = { authorization: `Bearer ${validToken}` };

          await new Promise<void>((resolve) => {
            authenticateJWT(req as AuthRequest, res as Response, (err?: any) => {
              if (err) throw err;
              resolve();
            });
          });
        }
      );

      // Validate targets
      expect(metrics.p50).toBeLessThan(10); // Target: <10ms
      expect(metrics.p95).toBeLessThan(20); // Target: <20ms
      expect(metrics.p99).toBeLessThan(30); // Target: <30ms
    });

    it('should handle invalid tokens in <5ms (fast rejection)', async () => {
      const iterations = 1000;

      const metrics = await runBenchmark(
        'Invalid Token Rejection',
        iterations,
        async () => {
          const { req, res, next } = createMockReqRes();
          req.headers = { authorization: 'Bearer invalid_token' };

          await new Promise<void>((resolve) => {
            authenticateJWT(req as AuthRequest, res as Response, (err?: any) => {
              resolve(); // Don't throw on expected failure
            });
          });
        }
      );

      // Invalid tokens should fail faster
      expect(metrics.p50).toBeLessThan(5);
      expect(metrics.p95).toBeLessThan(10);
    });
  });

  describe('Benchmark 2: Organization Access Check', () => {
    it('should check organization access in <20ms (P50)', async () => {
      const iterations = 500;

      const metrics = await runBenchmark(
        'Organization Access Check',
        iterations,
        async () => {
          const { req, res, next } = createMockReqRes();

          // Mock authenticated user
          const decoded = jwt.verify(validToken, env.JWT_SECRET) as any;
          req.user = decoded;
          req.params = { orgId: testOrgId };

          const middleware = requireOrgAccess('orgId');

          await new Promise<void>((resolve) => {
            middleware(req as AuthRequest, res as Response, (err?: any) => {
              if (err) throw err;
              resolve();
            });
          });
        }
      );

      // Validate targets
      expect(metrics.p50).toBeLessThan(20); // Target: <20ms
      expect(metrics.p95).toBeLessThan(40); // Target: <40ms
    });
  });

  describe('Benchmark 3: Permission Check (Database Query)', () => {
    it('should check permissions in <20ms (P50)', async () => {
      const iterations = 500;

      const metrics = await runBenchmark(
        'Permission Check (perm_EditForecast)',
        iterations,
        async () => {
          const { req, res, next } = createMockReqRes();

          // Mock authenticated user
          const decoded = jwt.verify(validToken, env.JWT_SECRET) as any;
          req.user = decoded;
          req.body = { organizationId: testOrgId };

          const middleware = requirePermission('perm_EditForecast', 'organizationId');

          await new Promise<void>((resolve) => {
            middleware(req as AuthRequest, res as Response, (err?: any) => {
              if (err) throw err;
              resolve();
            });
          });
        }
      );

      // Validate targets
      expect(metrics.p50).toBeLessThan(20); // Target: <20ms
      expect(metrics.p95).toBeLessThan(40); // Target: <40ms
    });

    it('should deny missing permissions in <25ms (with audit log)', async () => {
      const iterations = 500;

      // Create user without permission
      const viewerUser = await prisma.user.create({
        data: {
          username: 'perf_viewer',
          email: 'viewer@perf.com',
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
          perm_Read: true, // Only read, no edit
          perm_EditForecast: false,
        },
      });

      const viewerLogin = await authService.login('perf_viewer', 'password123');
      const viewerToken = viewerLogin.token;

      const metrics = await runBenchmark(
        'Permission Denial (with audit log)',
        iterations,
        async () => {
          const { req, res, next } = createMockReqRes();

          const decoded = jwt.verify(viewerToken, env.JWT_SECRET) as any;
          req.user = decoded;
          req.body = { organizationId: testOrgId };

          const middleware = requirePermission('perm_EditForecast', 'organizationId');

          await new Promise<void>((resolve) => {
            middleware(req as AuthRequest, res as Response, (err?: any) => {
              resolve(); // Don't throw on expected denial
            });
          });
        }
      );

      // Cleanup
      await prisma.userOrganization.deleteMany({
        where: { userId: viewerUser.id },
      });
      await prisma.user.delete({
        where: { id: viewerUser.id },
      });

      // Permission denials include audit log write, so slightly slower
      expect(metrics.p50).toBeLessThan(25); // Target: <25ms
      expect(metrics.p95).toBeLessThan(50); // Target: <50ms
    });
  });

  describe('Benchmark 4: Full Authorization Chain', () => {
    it('should complete full auth chain in <50ms (P50)', async () => {
      const iterations = 500;

      const metrics = await runBenchmark(
        'Full Authorization Chain (JWT + Permission)',
        iterations,
        async () => {
          // Step 1: JWT authentication
          const { req: req1, res: res1, next: next1 } = createMockReqRes();
          req1.headers = { authorization: `Bearer ${validToken}` };

          await new Promise<void>((resolve) => {
            authenticateJWT(req1 as AuthRequest, res1 as Response, (err?: any) => {
              if (err) throw err;
              resolve();
            });
          });

          // Step 2: Permission check (using authenticated user)
          const { req: req2, res: res2, next: next2 } = createMockReqRes();
          req2.user = req1.user;
          req2.body = { organizationId: testOrgId };

          const middleware = requirePermission('perm_EditForecast', 'organizationId');

          await new Promise<void>((resolve) => {
            middleware(req2 as AuthRequest, res2 as Response, (err?: any) => {
              if (err) throw err;
              resolve();
            });
          });
        }
      );

      // Full chain target: <50ms
      expect(metrics.p50).toBeLessThan(50); // Target: <50ms
      expect(metrics.p95).toBeLessThan(75); // Target: <75ms
      expect(metrics.p99).toBeLessThan(100); // Target: <100ms
    });
  });

  describe('Benchmark 5: Concurrent Authorization Requests', () => {
    it('should handle concurrent requests without degradation', async () => {
      const concurrency = 10; // 10 concurrent requests
      const iterations = 100; // 100 batches

      const metrics = await runBenchmark(
        `Concurrent Authorization (${concurrency} parallel)`,
        iterations,
        async () => {
          const promises = [];

          for (let i = 0; i < concurrency; i++) {
            const { req, res, next } = createMockReqRes();
            req.headers = { authorization: `Bearer ${validToken}` };
            req.body = { organizationId: testOrgId };

            const promise = new Promise<void>((resolve) => {
              authenticateJWT(req as AuthRequest, res as Response, (err?: any) => {
                if (err) throw err;

                const middleware = requirePermission('perm_EditForecast', 'organizationId');
                middleware(req as AuthRequest, res as Response, (err2?: any) => {
                  if (err2) throw err2;
                  resolve();
                });
              });
            });

            promises.push(promise);
          }

          await Promise.all(promises);
        }
      );

      // Concurrent requests should still be fast (per-request latency)
      // Note: This measures the slowest request in each batch
      expect(metrics.p50).toBeLessThan(75); // Target: <75ms
      expect(metrics.p95).toBeLessThan(150); // Target: <150ms
    });
  });
});
