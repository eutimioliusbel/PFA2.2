/**
 * Manual Verification Script for API Connectivity
 *
 * This script will help verify the new 2-tier API configuration architecture
 */

const API_BASE = 'http://localhost:3001';

async function verifyApiConnectivity() {
  console.log('\n=== API Connectivity Verification ===\n');

  try {
    // Step 1: Login as admin
    console.log('1. Testing login...');
    const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status}`);
    }

    const { token, user } = await loginRes.json();
    console.log(`✓ Logged in as: ${user.username} (${user.organizations.length} orgs)\n`);

    const orgId = user.organizations[0].id;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Step 2: Get API configurations
    console.log('2. Fetching API configurations...');
    const configsRes = await fetch(`${API_BASE}/api/configs?organizationId=${orgId}`, { headers });

    if (!configsRes.ok) {
      throw new Error(`Failed to fetch configs: ${configsRes.status}`);
    }

    const { configs } = await configsRes.json();
    console.log(`✓ Received ${configs.length} API configurations\n`);

    // Debug: Show structure of first config
    if (configs.length > 0) {
      console.log('Sample configuration structure:');
      console.log(JSON.stringify(configs[0], null, 2));
      console.log('');
    }

    // Step 3: Verify PEMS APIs
    const pemsConfigs = configs.filter(c => c.type && c.type.startsWith('PEMS_'));
    console.log(`3. PEMS APIs (${pemsConfigs.length} found):`);

    pemsConfigs.forEach(config => {
      console.log(`   - ${config.name}`);
      console.log(`     Type: ${config.type}`);
      console.log(`     URL: ${config.url}`);
      console.log(`     Operation: ${config.operationType}`);
      console.log(`     Status: ${config.status}`);
      console.log(`     Global: ${config.isGlobal ? 'Yes (Admin-managed)' : 'Org-specific'}`);
      console.log('');
    });

    // Verify we have the expected PEMS APIs
    const expectedPems = ['PEMS_PFA_READ', 'PEMS_PFA_WRITE', 'PEMS_ASSETS', 'PEMS_CLASSES'];
    const foundPems = pemsConfigs.map(c => c.type);
    const missingPems = expectedPems.filter(e => !foundPems.includes(e));

    if (missingPems.length > 0) {
      console.log(`   ⚠ Missing PEMS APIs: ${missingPems.join(', ')}\n`);
    } else {
      console.log(`   ✓ All expected PEMS APIs found\n`);
    }

    // Step 4: Verify AI Providers
    const aiConfigs = configs.filter(c => c.type && c.type.startsWith('AI_'));
    console.log(`4. AI Providers (${aiConfigs.length} found):`);

    aiConfigs.forEach(config => {
      console.log(`   - ${config.name}`);
      console.log(`     Type: ${config.type}`);
      console.log(`     URL: ${config.url}`);
      console.log(`     Auth Type: ${config.authType}`);
      console.log(`     Status: ${config.status}`);
      console.log(`     Credentials Configured: ${config.credentialsConfigured ? 'Yes' : 'No'}`);
      console.log('');
    });

    // Verify we have the expected AI providers
    const expectedAi = ['AI_GEMINI', 'AI_OPENAI', 'AI_ANTHROPIC', 'AI_AZURE', 'AI_GROK'];
    const foundAi = aiConfigs.map(c => c.type);
    const missingAi = expectedAi.filter(e => !foundAi.includes(e));

    if (missingAi.length > 0) {
      console.log(`   ⚠ Missing AI Providers: ${missingAi.join(', ')}\n`);
    } else {
      console.log(`   ✓ All expected AI Providers found\n`);
    }

    // Step 5: Test PEMS API connection (if available)
    const pemsTestConfig = pemsConfigs.find(c => c.type === 'PEMS_PFA_READ');
    if (pemsTestConfig && pemsTestConfig.status !== 'unconfigured') {
      console.log('5. Testing PEMS PFA Read connection...');
      const testRes = await fetch(`${API_BASE}/api/configs/${pemsTestConfig.id}/test`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ organizationId: orgId })
      });

      const testResult = await testRes.json();
      if (testResult.success) {
        console.log(`   ✓ PEMS connection successful (${testResult.latencyMs}ms)`);
        console.log(`   Message: ${testResult.message}\n`);
      } else {
        console.log(`   ✗ PEMS connection failed: ${testResult.message}\n`);
      }
    } else {
      console.log('5. PEMS PFA Read not configured or unavailable\n');
    }

    // Summary
    console.log('=== Verification Summary ===');
    console.log(`Total Configurations: ${configs.length}`);
    console.log(`PEMS APIs: ${pemsConfigs.length} (Global, Admin-managed)`);
    console.log(`AI Providers: ${aiConfigs.length} (Templates, Org-configured)`);
    console.log('');

    // Architecture verification
    console.log('=== Architecture Verification ===');
    const globalConfigs = configs.filter(c => c.organizationId === null);
    console.log(`Global Configurations: ${globalConfigs.length}`);
    console.log(`  - Should include all PEMS and AI templates`);
    console.log(`  - PEMS should have admin credentials`);
    console.log(`  - AI templates should NOT have credentials (org-specific)\n`);

    const aiWithOrgCreds = aiConfigs.filter(c => c.credentialsConfigured);
    console.log(`AI Providers with Org Credentials: ${aiWithOrgCreds.length}`);
    if (aiWithOrgCreds.length > 0) {
      console.log(`  Configured providers:`);
      aiWithOrgCreds.forEach(c => console.log(`    - ${c.name}`));
    } else {
      console.log(`  No AI providers configured yet (expected for new setup)`);
    }

    console.log('\n✅ Verification Complete!\n');

  } catch (error) {
    console.error('\n❌ Verification Failed:', error.message);
    console.error(error);
  }
}

verifyApiConnectivity();
