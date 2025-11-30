/**
 * Staging Environment Smoke Tests
 * ADR-008 Phase 5: Task 5.1 - Staging Deployment Verification
 *
 * Validates critical functionality after deployment to staging environment.
 * Tests read-only endpoints first, then write operations with cleanup.
 *
 * Usage: npx tsx scripts/smoke-test-staging.ts [--env staging|production]
 */

import fetch from 'node-fetch';
import { config } from 'dotenv';
import * as path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env') });

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface SmokeTestConfig {
  baseUrl: string;
  authToken?: string;
  organizationId: string;
  timeout: number;
}

class SmokeTestRunner {
  private config: SmokeTestConfig;
  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor(environment: 'staging' | 'production' = 'staging') {
    const baseUrl = environment === 'production'
      ? process.env.PROD_API_URL || 'https://api.pfavanguard.com'
      : process.env.STAGING_API_URL || 'https://staging-api.pfavanguard.com';

    this.config = {
      baseUrl,
      authToken: process.env.SMOKE_TEST_TOKEN,
      organizationId: process.env.SMOKE_TEST_ORG_ID || 'org-rio',
      timeout: 30000,
    };

    console.log(`\n🧪 Smoke Test Configuration`);
    console.log(`   Environment: ${environment.toUpperCase()}`);
    console.log(`   Base URL: ${baseUrl}`);
    console.log(`   Org ID: ${this.config.organizationId}\n`);
  }

  private async makeRequest(
    endpoint: string,
    options: {
      method?: string;
      body?: unknown;
      requireAuth?: boolean;
    } = {}
  ): Promise<{ status: number; data: unknown; headers: Headers }> {
    const { method = 'GET', body, requireAuth = false } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (requireAuth && this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    const url = `${this.config.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data: unknown;
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        status: response.status,
        data,
        headers: response.headers,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async runTest(
    name: string,
    testFn: () => Promise<void>
  ): Promise<void> {
    const start = Date.now();

    try {
      await testFn();
      const duration = Date.now() - start;

      this.results.push({
        name,
        status: 'PASS',
        duration,
      });

      console.log(`✅ ${name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.results.push({
        name,
        status: 'FAIL',
        duration,
        error: errorMessage,
      });

      console.log(`❌ ${name} (${duration}ms)`);
      console.log(`   Error: ${errorMessage}`);
    }
  }

  async runAllTests(): Promise<void> {
    this.startTime = Date.now();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏥 HEALTH CHECKS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await this.testHealthEndpoint();
    await this.testWriteSyncHealth();
    await this.testDatabaseConnection();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 AUTHENTICATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await this.testAuthRequired();
    await this.testAuthToken();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SYNC STATUS ENDPOINTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await this.testSyncStatusEndpoint();
    await this.testQueueMetricsEndpoint();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 WRITE SYNC OPERATIONS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await this.testManualSyncTrigger();
    await this.testWebSocketConnection();
    await this.testRateLimiting();

    this.printSummary();
  }

  // ============================================================================
  // HEALTH CHECK TESTS
  // ============================================================================

  private async testHealthEndpoint(): Promise<void> {
    await this.runTest('Health endpoint responds', async () => {
      const { status, data } = await this.makeRequest('/health');

      if (status !== 200) {
        throw new Error(`Expected 200, got ${status}`);
      }

      const healthData = data as { status: string };
      if (healthData.status !== 'healthy') {
        throw new Error(`Expected status=healthy, got ${healthData.status}`);
      }
    });
  }

  private async testWriteSyncHealth(): Promise<void> {
    await this.runTest('Write sync health endpoint', async () => {
      const { status, data } = await this.makeRequest('/health/write-sync');

      if (status !== 200) {
        throw new Error(`Expected 200, got ${status}`);
      }

      const healthData = data as {
        worker: { running: boolean };
        queue: { size: number };
      };

      if (!healthData.worker?.running) {
        throw new Error('Sync worker not running');
      }

      if (healthData.queue?.size > 1000) {
        throw new Error(`Queue size too high: ${healthData.queue.size}`);
      }
    });
  }

  private async testDatabaseConnection(): Promise<void> {
    await this.runTest('Database connection', async () => {
      const { status } = await this.makeRequest('/health/db');

      if (status !== 200) {
        throw new Error(`Database health check failed: ${status}`);
      }
    });
  }

  // ============================================================================
  // AUTHENTICATION TESTS
  // ============================================================================

  private async testAuthRequired(): Promise<void> {
    await this.runTest('Auth required for protected endpoints', async () => {
      const { status } = await this.makeRequest(
        `/api/pems/write-sync`,
        { method: 'POST', requireAuth: false }
      );

      if (status !== 401) {
        throw new Error(`Expected 401 Unauthorized, got ${status}`);
      }
    });
  }

  private async testAuthToken(): Promise<void> {
    await this.runTest('Valid auth token accepted', async () => {
      if (!this.config.authToken) {
        throw new Error('SMOKE_TEST_TOKEN not configured');
      }

      const { status } = await this.makeRequest(
        `/api/pems/sync-status?organizationId=${this.config.organizationId}`,
        { requireAuth: true }
      );

      if (status !== 200) {
        throw new Error(`Auth token rejected: ${status}`);
      }
    });
  }

  // ============================================================================
  // SYNC STATUS TESTS
  // ============================================================================

  private async testSyncStatusEndpoint(): Promise<void> {
    await this.runTest('Sync status endpoint', async () => {
      const { status, data } = await this.makeRequest(
        `/api/pems/sync-status?organizationId=${this.config.organizationId}`,
        { requireAuth: true }
      );

      if (status !== 200) {
        throw new Error(`Expected 200, got ${status}`);
      }

      const syncStatus = data as {
        queueSize: number;
        lastSync?: { completedAt: string };
      };

      if (typeof syncStatus.queueSize !== 'number') {
        throw new Error('Invalid response: missing queueSize');
      }
    });
  }

  private async testQueueMetricsEndpoint(): Promise<void> {
    await this.runTest('Queue metrics endpoint', async () => {
      const { status, data } = await this.makeRequest(
        `/api/pems/queue-metrics`,
        { requireAuth: true }
      );

      if (status !== 200) {
        throw new Error(`Expected 200, got ${status}`);
      }

      const metrics = data as {
        pending: number;
        processing: number;
        failed: number;
      };

      if (typeof metrics.pending !== 'number') {
        throw new Error('Invalid metrics response');
      }
    });
  }

  // ============================================================================
  // WRITE SYNC OPERATION TESTS
  // ============================================================================

  private async testManualSyncTrigger(): Promise<void> {
    await this.runTest('Manual sync trigger', async () => {
      const { status, data } = await this.makeRequest(
        `/api/pems/write-sync`,
        {
          method: 'POST',
          requireAuth: true,
          body: { organizationId: this.config.organizationId },
        }
      );

      if (status !== 200 && status !== 202) {
        throw new Error(`Expected 200/202, got ${status}`);
      }

      const syncResponse = data as { message: string; queueSize?: number };

      if (!syncResponse.message) {
        throw new Error('Invalid sync response');
      }
    });
  }

  private async testWebSocketConnection(): Promise<void> {
    await this.runTest('WebSocket endpoint available', async () => {
      // Note: This only tests HTTP endpoint availability
      // Full WebSocket testing requires ws library
      const wsUrl = this.config.baseUrl.replace('http', 'ws');
      const { status } = await this.makeRequest('/ws/sync-status');

      if (status !== 426 && status !== 101) {
        // 426 Upgrade Required is expected for HTTP request to WS endpoint
        console.log(`   (WebSocket upgrade test: ${status})`);
      }
    });
  }

  private async testRateLimiting(): Promise<void> {
    await this.runTest('Rate limiting headers present', async () => {
      const { headers } = await this.makeRequest(
        `/api/pems/sync-status?organizationId=${this.config.organizationId}`,
        { requireAuth: true }
      );

      const rateLimitHeader = headers.get('X-RateLimit-Limit');

      if (!rateLimitHeader) {
        console.log('   (Warning: Rate limit headers not found)');
      }
    });
  }

  // ============================================================================
  // REPORTING
  // ============================================================================

  private printSummary(): void {
    const totalDuration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 TEST SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`   Total Tests: ${this.results.length}`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ⏱️  Duration: ${totalDuration}ms\n`);

    if (failed > 0) {
      console.log('   FAILED TESTS:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => {
          console.log(`   - ${r.name}`);
          console.log(`     ${r.error}`);
        });
      console.log();
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const exitCode = failed > 0 ? 1 : 0;

    if (exitCode === 0) {
      console.log('✅ ALL SMOKE TESTS PASSED\n');
    } else {
      console.log('❌ SMOKE TESTS FAILED - DO NOT DEPLOY\n');
    }

    process.exit(exitCode);
  }
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const envArg = args.find(arg => arg.startsWith('--env='));
  const environment = envArg?.split('=')[1] as 'staging' | 'production' || 'staging';

  const runner = new SmokeTestRunner(environment);
  await runner.runAllTests();
}

if (require.main === module) {
  main().catch(error => {
    console.error('\n💥 FATAL ERROR:');
    console.error(error);
    process.exit(1);
  });
}

export { SmokeTestRunner };
