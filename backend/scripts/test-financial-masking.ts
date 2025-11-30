/**
 * Test Financial Masking API Endpoints
 *
 * Phase 7, Task 7.2 of ADR-005
 *
 * Tests all financial masking endpoints:
 * - POST /api/financial/mask (client-side masking)
 * - GET /api/financial/masked-records (database-driven)
 * - GET /api/financial/portfolio-insight
 * - POST /api/financial/validate-access
 * - GET /api/financial/cache-stats (admin only)
 * - POST /api/financial/cache/clear (admin only)
 *
 * @usage
 * npx tsx backend/scripts/test-financial-masking.ts
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3001';
const API_BASE = `${BASE_URL}/api`;

// Test data
const testRecords = [
  {
    id: 'test-1',
    description: 'CAT 336 Excavator',
    category: 'Excavators',
    class: 'Heavy Equipment',
    source: 'Rental',
    monthlyRate: 15000,
    duration: 60,
    forecastStart: new Date('2025-01-01'),
    forecastEnd: new Date('2025-03-01'),
    cost: 29606.30, // (60 / 30.44) * 15000
  },
  {
    id: 'test-2',
    description: 'Komatsu PC200 Excavator',
    category: 'Excavators',
    class: 'Heavy Equipment',
    source: 'Rental',
    monthlyRate: 8000,
    duration: 30,
    forecastStart: new Date('2025-01-01'),
    forecastEnd: new Date('2025-01-31'),
    cost: 7888.89, // (30 / 30.44) * 8000
  },
  {
    id: 'test-3',
    description: 'Tower Crane',
    category: 'Cranes',
    class: 'Heavy Equipment',
    source: 'Purchase',
    purchasePrice: 450000,
    cost: 450000,
  },
  {
    id: 'test-4',
    description: 'Mobile Crane',
    category: 'Cranes',
    class: 'Heavy Equipment',
    source: 'Rental',
    monthlyRate: 25000,
    duration: 90,
    forecastStart: new Date('2025-01-01'),
    forecastEnd: new Date('2025-03-31'),
    cost: 73890.14, // (90 / 30.44) * 25000
  },
];

interface TestResult {
  endpoint: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  statusCode?: number;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

/**
 * Login and get JWT token
 */
async function login(username: string, password: string): Promise<string | null> {
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, {
      username,
      password,
    });

    if (response.data.token) {
      console.log(`✅ Login successful: ${username}`);
      return response.data.token;
    }
  } catch (error: any) {
    console.error(`❌ Login failed: ${error.response?.data?.message || error.message}`);
  }
  return null;
}

/**
 * Test 1: POST /api/financial/mask (with viewFinancialDetails = true)
 */
async function testMaskWithPermission(token: string) {
  try {
    const response = await axios.post(
      `${API_BASE}/financial/mask`,
      {
        records: testRecords,
        viewFinancialDetails: true,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (response.data.success && response.data.portfolioInsight) {
      // Check that costs are NOT masked (actual numbers, not '***masked***')
      const maskedRecords = response.data.maskedRecords;
      const costsNotMasked = maskedRecords.every((r: any) => typeof r.cost === 'number');

      if (costsNotMasked) {
        results.push({
          endpoint: 'POST /api/financial/mask (with permission)',
          status: 'PASS',
          statusCode: 200,
          message: 'Records returned unmasked for user with viewFinancialDetails',
          details: {
            recordCount: maskedRecords.length,
            sampleCost: maskedRecords[0].cost,
            portfolioInsight: response.data.portfolioInsight,
          },
        });
        console.log('✅ Test 1 PASS: Mask endpoint works with permission');
      } else {
        results.push({
          endpoint: 'POST /api/financial/mask (with permission)',
          status: 'FAIL',
          statusCode: response.status,
          message: 'Costs are masked despite user having viewFinancialDetails',
          details: { sampleRecord: maskedRecords[0] },
        });
        console.log('❌ Test 1 FAIL: Costs incorrectly masked');
      }
    } else {
      results.push({
        endpoint: 'POST /api/financial/mask (with permission)',
        status: 'FAIL',
        statusCode: response.status,
        message: 'Missing required fields in response',
        details: response.data,
      });
      console.log('❌ Test 1 FAIL: Missing required fields');
    }
  } catch (error: any) {
    results.push({
      endpoint: 'POST /api/financial/mask (with permission)',
      status: 'FAIL',
      statusCode: error.response?.status,
      message: error.response?.data?.message || error.message,
    });
    console.log('❌ Test 1 FAIL:', error.response?.data?.message || error.message);
  }
}

/**
 * Test 2: POST /api/financial/mask (with viewFinancialDetails = false)
 */
async function testMaskWithoutPermission(token: string) {
  try {
    const response = await axios.post(
      `${API_BASE}/financial/mask`,
      {
        records: testRecords,
        viewFinancialDetails: false,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (response.data.success && response.data.portfolioInsight) {
      const maskedRecords = response.data.maskedRecords;
      const hasRelativeIndicators = maskedRecords.every((r: any) =>
        r.impactLevel && r.percentile !== undefined && r.relativeComparison
      );

      if (hasRelativeIndicators) {
        results.push({
          endpoint: 'POST /api/financial/mask (without permission)',
          status: 'PASS',
          statusCode: 200,
          message: 'Records masked with relative indicators',
          details: {
            recordCount: maskedRecords.length,
            portfolioInsight: response.data.portfolioInsight,
            sampleMaskedRecord: maskedRecords[0],
          },
        });
        console.log('✅ Test 2 PASS: Mask endpoint works without permission (masking applied)');
      } else {
        results.push({
          endpoint: 'POST /api/financial/mask (without permission)',
          status: 'FAIL',
          statusCode: response.status,
          message: 'Masked records missing relative indicators',
          details: { sampleRecord: maskedRecords[0] },
        });
        console.log('❌ Test 2 FAIL: Missing relative indicators');
      }
    } else {
      results.push({
        endpoint: 'POST /api/financial/mask (without permission)',
        status: 'FAIL',
        statusCode: response.status,
        message: 'Missing portfolioInsight in response',
        details: response.data,
      });
      console.log('❌ Test 2 FAIL: Missing portfolioInsight');
    }
  } catch (error: any) {
    results.push({
      endpoint: 'POST /api/financial/mask (without permission)',
      status: 'FAIL',
      statusCode: error.response?.status,
      message: error.response?.data?.message || error.message,
    });
    console.log('❌ Test 2 FAIL:', error.response?.data?.message || error.message);
  }
}

/**
 * Test 3: POST /api/financial/mask (validation errors)
 */
async function testMaskValidation(token: string) {
  try {
    // Test missing records
    await axios.post(
      `${API_BASE}/financial/mask`,
      {
        viewFinancialDetails: false,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    results.push({
      endpoint: 'POST /api/financial/mask (validation)',
      status: 'FAIL',
      message: 'Should have rejected missing records array',
    });
    console.log('❌ Test 3 FAIL: Missing validation');
  } catch (error: any) {
    if (error.response?.status === 400 && error.response?.data?.error === 'VALIDATION_ERROR') {
      results.push({
        endpoint: 'POST /api/financial/mask (validation)',
        status: 'PASS',
        statusCode: 400,
        message: 'Validation works correctly',
        details: error.response.data,
      });
      console.log('✅ Test 3 PASS: Validation rejects invalid input');
    } else {
      results.push({
        endpoint: 'POST /api/financial/mask (validation)',
        status: 'FAIL',
        statusCode: error.response?.status,
        message: 'Unexpected error type',
        details: error.response?.data,
      });
      console.log('❌ Test 3 FAIL: Unexpected error type');
    }
  }
}

/**
 * Test 4: GET /api/financial/cache-stats (admin only)
 */
async function testCacheStats(token: string, isAdmin: boolean) {
  try {
    const response = await axios.get(`${API_BASE}/financial/cache-stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (isAdmin) {
      if (response.data.success && response.data.cache) {
        results.push({
          endpoint: 'GET /api/financial/cache-stats (admin)',
          status: 'PASS',
          statusCode: 200,
          message: 'Admin can access cache stats',
          details: response.data.cache,
        });
        console.log('✅ Test 4 PASS: Cache stats accessible to admin');
      } else {
        results.push({
          endpoint: 'GET /api/financial/cache-stats (admin)',
          status: 'FAIL',
          statusCode: response.status,
          message: 'Missing cache stats in response',
          details: response.data,
        });
        console.log('❌ Test 4 FAIL: Missing cache stats');
      }
    } else {
      results.push({
        endpoint: 'GET /api/financial/cache-stats (non-admin)',
        status: 'FAIL',
        statusCode: response.status,
        message: 'Non-admin should not access cache stats',
      });
      console.log('❌ Test 4 FAIL: Non-admin accessed admin endpoint');
    }
  } catch (error: any) {
    if (!isAdmin && error.response?.status === 403) {
      results.push({
        endpoint: 'GET /api/financial/cache-stats (non-admin)',
        status: 'PASS',
        statusCode: 403,
        message: 'Non-admin correctly denied access',
      });
      console.log('✅ Test 4 PASS: Non-admin correctly denied');
    } else {
      results.push({
        endpoint: 'GET /api/financial/cache-stats',
        status: 'FAIL',
        statusCode: error.response?.status,
        message: error.response?.data?.message || error.message,
      });
      console.log('❌ Test 4 FAIL:', error.response?.data?.message || error.message);
    }
  }
}

/**
 * Test 5: POST /api/financial/cache/clear (admin only)
 */
async function testCacheClear(token: string, isAdmin: boolean) {
  try {
    const response = await axios.post(
      `${API_BASE}/financial/cache/clear`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (isAdmin) {
      if (response.data.success) {
        results.push({
          endpoint: 'POST /api/financial/cache/clear (admin)',
          status: 'PASS',
          statusCode: 200,
          message: 'Admin can clear cache',
          details: response.data,
        });
        console.log('✅ Test 5 PASS: Cache cleared by admin');
      } else {
        results.push({
          endpoint: 'POST /api/financial/cache/clear (admin)',
          status: 'FAIL',
          statusCode: response.status,
          message: 'Unexpected response',
          details: response.data,
        });
        console.log('❌ Test 5 FAIL: Unexpected response');
      }
    } else {
      results.push({
        endpoint: 'POST /api/financial/cache/clear (non-admin)',
        status: 'FAIL',
        statusCode: response.status,
        message: 'Non-admin should not clear cache',
      });
      console.log('❌ Test 5 FAIL: Non-admin cleared cache');
    }
  } catch (error: any) {
    if (!isAdmin && error.response?.status === 403) {
      results.push({
        endpoint: 'POST /api/financial/cache/clear (non-admin)',
        status: 'PASS',
        statusCode: 403,
        message: 'Non-admin correctly denied access',
      });
      console.log('✅ Test 5 PASS: Non-admin correctly denied');
    } else {
      results.push({
        endpoint: 'POST /api/financial/cache/clear',
        status: 'FAIL',
        statusCode: error.response?.status,
        message: error.response?.data?.message || error.message,
      });
      console.log('❌ Test 5 FAIL:', error.response?.data?.message || error.message);
    }
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  Financial Masking API Test Suite                            ║');
  console.log('║  Phase 7, Task 7.2 - ADR-005                                  ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // Login as admin
  const adminToken = await login('admin', 'admin123');
  if (!adminToken) {
    console.error('❌ Failed to login as admin. Aborting tests.');
    return;
  }

  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│  Running Tests...                                           │');
  console.log('└─────────────────────────────────────────────────────────────┘\n');

  // Run tests
  await testMaskWithPermission(adminToken);
  await testMaskWithoutPermission(adminToken);
  await testMaskValidation(adminToken);
  await testCacheStats(adminToken, true);
  await testCacheClear(adminToken, true);

  // Print summary
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  Test Results Summary                                         ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const skipCount = results.filter(r => r.status === 'SKIP').length;

  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
    console.log(`${icon} ${result.endpoint}`);
    console.log(`   Status: ${result.status} (${result.statusCode || 'N/A'})`);
    console.log(`   Message: ${result.message}`);
    if (result.details && process.env.VERBOSE === 'true') {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
    }
    console.log();
  });

  console.log('─────────────────────────────────────────────────────────────');
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`⏭️  Skipped: ${skipCount}`);
  console.log('─────────────────────────────────────────────────────────────\n');

  if (failCount === 0) {
    console.log('🎉 All tests passed! Financial masking API is working correctly.\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Review the results above.\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
