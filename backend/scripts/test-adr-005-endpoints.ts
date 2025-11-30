/**
 * Test ADR-005 Endpoints
 * Manual integration test for the 6 new ADR-005 endpoints
 *
 * Run: npx tsx backend/scripts/test-adr-005-endpoints.ts
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  statusCode?: number;
  error?: string;
  responseTime?: number;
}

const results: TestResult[] = [];

/**
 * Login and get JWT token
 */
async function login(): Promise<string> {
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123',
    });

    if (response.data.token) {
      console.log('✓ Login successful');
      return response.data.token;
    }

    throw new Error('No token returned');
  } catch (error: any) {
    console.error('✗ Login failed:', error.message);
    throw error;
  }
}

/**
 * Test an endpoint
 */
async function testEndpoint(
  method: string,
  path: string,
  token: string,
  data?: any
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const config = {
      method,
      url: `${BASE_URL}${path}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data,
    };

    const response = await axios(config);
    const responseTime = Date.now() - startTime;

    return {
      endpoint: path,
      method,
      status: 'PASS',
      statusCode: response.status,
      responseTime,
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;

    return {
      endpoint: path,
      method,
      status: 'FAIL',
      statusCode: error.response?.status,
      error: error.message,
      responseTime,
    };
  }
}

/**
 * Main test suite
 */
async function runTests() {
  console.log('🧪 Testing ADR-005 Endpoints\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Step 1: Login
  console.log('Step 1: Authentication');
  console.log('───────────────────────────────────────────────────────────');

  let token: string;
  try {
    token = await login();
    console.log('');
  } catch (error) {
    console.log('✗ Cannot proceed without authentication\n');
    process.exit(1);
  }

  // Step 2: Test Role Templates
  console.log('Step 2: Role Templates');
  console.log('───────────────────────────────────────────────────────────');

  const roleTemplatesTest = await testEndpoint('GET', '/api/role-templates', token);
  results.push(roleTemplatesTest);
  console.log(
    `${roleTemplatesTest.status === 'PASS' ? '✓' : '✗'} GET /api/role-templates - ${roleTemplatesTest.statusCode} (${roleTemplatesTest.responseTime}ms)`
  );
  console.log('');

  // Step 3: Test Personal Access Tokens
  console.log('Step 3: Personal Access Tokens');
  console.log('───────────────────────────────────────────────────────────');

  const tokensTest = await testEndpoint('GET', '/api/tokens', token);
  results.push(tokensTest);
  console.log(
    `${tokensTest.status === 'PASS' ? '✓' : '✗'} GET /api/tokens - ${tokensTest.statusCode} (${tokensTest.responseTime}ms)`
  );

  const tokensStatsTest = await testEndpoint('GET', '/api/tokens/stats', token);
  results.push(tokensStatsTest);
  console.log(
    `${tokensStatsTest.status === 'PASS' ? '✓' : '✗'} GET /api/tokens/stats - ${tokensStatsTest.statusCode} (${tokensStatsTest.responseTime}ms)`
  );
  console.log('');

  // Step 4: Test Sessions
  console.log('Step 4: Sessions');
  console.log('───────────────────────────────────────────────────────────');

  const currentSessionTest = await testEndpoint('GET', '/api/sessions/current', token);
  results.push(currentSessionTest);
  console.log(
    `${currentSessionTest.status === 'PASS' ? '✓' : '✗'} GET /api/sessions/current - ${currentSessionTest.statusCode} (${currentSessionTest.responseTime}ms)`
  );

  const sessionStatsTest = await testEndpoint('GET', '/api/sessions/stats', token);
  results.push(sessionStatsTest);
  console.log(
    `${sessionStatsTest.status === 'PASS' ? '✓' : '✗'} GET /api/sessions/stats - ${sessionStatsTest.statusCode} (${sessionStatsTest.responseTime}ms)`
  );
  console.log('');

  // Step 5: Test Webhooks
  console.log('Step 5: Webhooks');
  console.log('───────────────────────────────────────────────────────────');

  const webhooksTest = await testEndpoint('GET', '/api/webhooks', token);
  results.push(webhooksTest);
  console.log(
    `${webhooksTest.status === 'PASS' ? '✓' : '✗'} GET /api/webhooks - ${webhooksTest.statusCode} (${webhooksTest.responseTime}ms)`
  );
  console.log('');

  // Step 6: Test System Dictionary
  console.log('Step 6: System Dictionary');
  console.log('───────────────────────────────────────────────────────────');

  const dictionaryCategoriesTest = await testEndpoint('GET', '/api/dictionary/categories', token);
  results.push(dictionaryCategoriesTest);
  console.log(
    `${dictionaryCategoriesTest.status === 'PASS' ? '✓' : '✗'} GET /api/dictionary/categories - ${dictionaryCategoriesTest.statusCode} (${dictionaryCategoriesTest.responseTime}ms)`
  );

  const dictionaryEntriesTest = await testEndpoint('GET', '/api/dictionary/equipment_class', token);
  results.push(dictionaryEntriesTest);
  console.log(
    `${dictionaryEntriesTest.status === 'PASS' ? '✓' : '✗'} GET /api/dictionary/equipment_class - ${dictionaryEntriesTest.statusCode} (${dictionaryEntriesTest.responseTime}ms)`
  );
  console.log('');

  // Step 7: Test Trash Can
  console.log('Step 7: Trash Can');
  console.log('───────────────────────────────────────────────────────────');

  const trashTest = await testEndpoint('GET', '/api/trash', token);
  results.push(trashTest);
  console.log(
    `${trashTest.status === 'PASS' ? '✓' : '✗'} GET /api/trash - ${trashTest.statusCode} (${trashTest.responseTime}ms)`
  );

  const trashStatsTest = await testEndpoint('GET', '/api/trash/stats', token);
  results.push(trashStatsTest);
  console.log(
    `${trashStatsTest.status === 'PASS' ? '✓' : '✗'} GET /api/trash/stats - ${trashStatsTest.statusCode} (${trashStatsTest.responseTime}ms)`
  );
  console.log('');

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 Test Summary');
  console.log('───────────────────────────────────────────────────────────');

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`Passed:      ${passed} ✓`);
  console.log(`Failed:      ${failed} ✗`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Show failures
  if (failed > 0) {
    console.log('❌ Failed Tests:');
    results
      .filter((r) => r.status === 'FAIL')
      .forEach((r) => {
        console.log(`   ${r.method} ${r.endpoint}`);
        console.log(`   Status: ${r.statusCode}`);
        console.log(`   Error: ${r.error}`);
        console.log('');
      });
  }

  // Exit code
  if (failed > 0) {
    console.log('❌ Some tests failed');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!');
    process.exit(0);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
