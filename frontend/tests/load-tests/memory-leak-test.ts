/**
 * @file memory-leak-test.ts
 * @description Memory leak detection test for permission middleware
 * @usage tsx load-tests/memory-leak-test.ts
 */

import axios, { AxiosInstance } from 'axios';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const NUM_OPERATIONS = parseInt(process.env.NUM_OPERATIONS || '1000', 10);
const MEMORY_CHECK_INTERVAL = 100; // Check memory every 100 operations

interface MemorySample {
  iteration: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  timestamp: number;
}

class MemoryLeakTest {
  private client: AxiosInstance;
  private authToken: string | null = null;
  private organizationId: string | null = null;
  private memorySamples: MemorySample[] = [];
  private startTime: number = 0;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
    });
  }

  /**
   * Take memory snapshot
   */
  private takeMemorySnapshot(iteration: number): MemorySample {
    const memUsage = process.memoryUsage();
    return {
      iteration,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      timestamp: Date.now() - this.startTime,
    };
  }

  /**
   * Force garbage collection (requires --expose-gc flag)
   */
  private forceGC() {
    if (global.gc) {
      global.gc();
      console.log('  🗑️  Forced garbage collection');
    } else {
      console.log('  ⚠️  Run with --expose-gc to enable forced garbage collection');
    }
  }

  /**
   * Login and get auth token
   */
  async login(): Promise<void> {
    console.log('🔐 Logging in...');
    const response = await this.client.post('/api/auth/login', {
      username: 'admin',
      password: 'admin123',
    });

    this.authToken = response.data.token;
    this.organizationId = response.data.user.organizations[0]?.organizationId;

    console.log(`  ✅ Logged in as admin`);
    console.log(`  📦 Organization: ${this.organizationId}`);
  }

  /**
   * Run permission check operation
   */
  async runPermissionCheck(): Promise<void> {
    if (!this.authToken || !this.organizationId) {
      throw new Error('Not authenticated');
    }

    await this.client.get(`/api/pfa?organizationId=${this.organizationId}`, {
      headers: {
        Authorization: `Bearer ${this.authToken}`,
      },
    });
  }

  /**
   * Run permission grant operation
   */
  async runPermissionGrant(): Promise<void> {
    if (!this.authToken || !this.organizationId) {
      throw new Error('Not authenticated');
    }

    // Get user organizations
    const usersResponse = await this.client.get(
      `/api/users/admin/organizations`,
      {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      }
    );

    const userOrgId = usersResponse.data.userOrganizations[0]?.id;

    if (!userOrgId) {
      throw new Error('No user-organization found');
    }

    // Grant permission (this creates audit logs and triggers AI hooks)
    await this.client.patch(
      `/api/user-organizations/${userOrgId}/capabilities`,
      {
        capabilities: {
          perm_Read: true,
          perm_EditForecast: Math.random() > 0.5, // Toggle randomly
        },
      },
      {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      }
    );
  }

  /**
   * Run organization switch operation
   */
  async runOrgSwitch(): Promise<void> {
    if (!this.authToken || !this.organizationId) {
      throw new Error('Not authenticated');
    }

    // Access different endpoints (simulates org switching)
    await this.client.get(`/api/organizations?organizationId=${this.organizationId}`, {
      headers: {
        Authorization: `Bearer ${this.authToken}`,
      },
    });

    await this.client.get(`/api/servers?organizationId=${this.organizationId}`, {
      headers: {
        Authorization: `Bearer ${this.authToken}`,
      },
    });
  }

  /**
   * Analyze memory samples for leaks
   */
  private analyzeMemoryLeaks(): {
    hasLeak: boolean;
    heapGrowth: number;
    heapGrowthPercent: number;
    avgHeapPerOperation: number;
  } {
    if (this.memorySamples.length < 2) {
      return {
        hasLeak: false,
        heapGrowth: 0,
        heapGrowthPercent: 0,
        avgHeapPerOperation: 0,
      };
    }

    const firstSample = this.memorySamples[0];
    const lastSample = this.memorySamples[this.memorySamples.length - 1];

    const heapGrowth = lastSample.heapUsed - firstSample.heapUsed;
    const heapGrowthPercent = (heapGrowth / firstSample.heapUsed) * 100;
    const avgHeapPerOperation = heapGrowth / NUM_OPERATIONS;

    // Consider it a leak if heap grows more than 50MB
    const hasLeak = heapGrowth > 50 * 1024 * 1024;

    return {
      hasLeak,
      heapGrowth,
      heapGrowthPercent,
      avgHeapPerOperation,
    };
  }

  /**
   * Generate memory leak report
   */
  private generateReport(): string {
    const analysis = this.analyzeMemoryLeaks();

    const firstSample = this.memorySamples[0];
    const lastSample = this.memorySamples[this.memorySamples.length - 1];

    const report = `
# Memory Leak Detection Report

**Test Configuration:**
- Operations: ${NUM_OPERATIONS}
- Duration: ${(lastSample.timestamp / 1000).toFixed(2)}s
- Base URL: ${BASE_URL}

**Memory Metrics:**

| Metric | Initial | Final | Growth | Growth % |
|--------|---------|-------|--------|----------|
| **Heap Used** | ${(firstSample.heapUsed / 1024 / 1024).toFixed(2)} MB | ${(lastSample.heapUsed / 1024 / 1024).toFixed(2)} MB | ${(analysis.heapGrowth / 1024 / 1024).toFixed(2)} MB | ${analysis.heapGrowthPercent.toFixed(2)}% |
| **Heap Total** | ${(firstSample.heapTotal / 1024 / 1024).toFixed(2)} MB | ${(lastSample.heapTotal / 1024 / 1024).toFixed(2)} MB | ${((lastSample.heapTotal - firstSample.heapTotal) / 1024 / 1024).toFixed(2)} MB | — |
| **RSS** | ${(firstSample.rss / 1024 / 1024).toFixed(2)} MB | ${(lastSample.rss / 1024 / 1024).toFixed(2)} MB | ${((lastSample.rss - firstSample.rss) / 1024 / 1024).toFixed(2)} MB | — |
| **External** | ${(firstSample.external / 1024 / 1024).toFixed(2)} MB | ${(lastSample.external / 1024 / 1024).toFixed(2)} MB | ${((lastSample.external - firstSample.external) / 1024 / 1024).toFixed(2)} MB | — |

**Analysis:**

- **Average heap growth per operation:** ${(analysis.avgHeapPerOperation / 1024).toFixed(2)} KB
- **Memory leak detected:** ${analysis.hasLeak ? '❌ YES (heap growth > 50MB)' : '✅ NO'}

**Recommendation:**

${
      analysis.hasLeak
        ? `⚠️  **MEMORY LEAK DETECTED**: Heap grew by ${(analysis.heapGrowth / 1024 / 1024).toFixed(2)} MB (${analysis.heapGrowthPercent.toFixed(2)}%)

Investigate:
1. Check for unclosed database connections
2. Review event listener cleanup
3. Inspect large object retention in closures
4. Verify JWT token cleanup
5. Check audit log buffering`
        : `✅ **NO MEMORY LEAK DETECTED**: Heap growth is within acceptable limits.

Current heap growth of ${(analysis.heapGrowth / 1024 / 1024).toFixed(2)} MB over ${NUM_OPERATIONS} operations is normal for this workload.`
    }

**Memory Timeline:**

\`\`\`
${this.memorySamples
      .map(
        s =>
          `Iteration ${s.iteration.toString().padStart(4, ' ')}: ${(s.heapUsed / 1024 / 1024).toFixed(2)} MB`
      )
      .join('\n')}
\`\`\`
`;

    return report;
  }

  /**
   * Run the memory leak test
   */
  async run(): Promise<void> {
    console.log('\n🧪 Memory Leak Detection Test\n');
    console.log(`  Operations: ${NUM_OPERATIONS}`);
    console.log(`  Base URL: ${BASE_URL}\n`);

    this.startTime = Date.now();

    // Login
    await this.login();

    // Take initial memory snapshot
    console.log('\n📊 Taking initial memory snapshot...');
    this.forceGC();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for GC
    this.memorySamples.push(this.takeMemorySnapshot(0));

    // Run operations
    console.log(`\n🚀 Running ${NUM_OPERATIONS} operations...\n`);

    for (let i = 1; i <= NUM_OPERATIONS; i++) {
      try {
        // Alternate between different operations
        if (i % 3 === 0) {
          await this.runPermissionGrant();
        } else if (i % 3 === 1) {
          await this.runPermissionCheck();
        } else {
          await this.runOrgSwitch();
        }

        // Take memory snapshot periodically
        if (i % MEMORY_CHECK_INTERVAL === 0) {
          const sample = this.takeMemorySnapshot(i);
          this.memorySamples.push(sample);
          console.log(
            `  [${i.toString().padStart(4, ' ')}/${NUM_OPERATIONS}] Heap: ${(sample.heapUsed / 1024 / 1024).toFixed(2)} MB`
          );

          // Force GC every 500 operations
          if (i % 500 === 0) {
            this.forceGC();
          }
        }
      } catch (error) {
        console.error(`  ❌ Error at iteration ${i}:`, error);
      }
    }

    // Take final memory snapshot
    console.log('\n📊 Taking final memory snapshot...');
    this.forceGC();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for GC
    this.memorySamples.push(this.takeMemorySnapshot(NUM_OPERATIONS));

    // Generate and save report
    console.log('\n📝 Generating report...\n');
    const report = this.generateReport();

    const fs = require('fs');
    fs.writeFileSync('docs/performance/MEMORY_LEAK_TEST_REPORT.md', report);

    console.log(report);
    console.log('\n✅ Report saved to docs/performance/MEMORY_LEAK_TEST_REPORT.md\n');
  }
}

// Run the test
const test = new MemoryLeakTest();
test.run().catch(console.error);
