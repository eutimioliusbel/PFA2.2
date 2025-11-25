import fetch from 'node-fetch';
import { config } from 'dotenv';

config();

async function testPfaSync() {
  try {
    // Step 1: Login to get JWT token
    console.log('🔐 Logging in...');
    const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }

    const loginData = await loginResponse.json() as any;
    const token = loginData.token;
    const user = loginData.user;

    console.log(`✅ Logged in as: ${user.username}`);
    console.log(`   Organizations: ${user.organizations.map((o: any) => o.code).join(', ')}`);

    // Find RIO organization
    const rioOrg = user.organizations.find((o: any) => o.code === 'RIO');
    if (!rioOrg) {
      throw new Error('RIO organization not found for this user');
    }

    console.log(`\n📊 Testing PFA sync for RIO organization...`);
    console.log(`   Organization ID: ${rioOrg.id}`);
    console.log(`   Organization Code: ${rioOrg.code}`);

    // Step 2: Trigger PFA sync using the orchestrator endpoint
    console.log('\n🔄 Triggering sync...');
    const syncResponse = await fetch('http://localhost:3001/api/data-sources/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        entityType: 'pfa',
        organizationId: rioOrg.id,
        syncType: 'full'
      })
    });

    if (!syncResponse.ok) {
      const errorText = await syncResponse.text();
      throw new Error(`Sync failed: ${syncResponse.status} ${syncResponse.statusText}\n${errorText}`);
    }

    const syncResult = await syncResponse.json() as any;

    console.log('\n✅ Sync completed!');
    console.log('═════════════════════════════════════════════════════');
    console.log('Sync Result:');
    console.log(`  Status: ${syncResult.result.status}`);
    console.log(`  Sync ID: ${syncResult.result.syncId}`);
    console.log(`  Total Records: ${syncResult.result.totalRecords || 0}`);
    console.log(`  Inserted: ${syncResult.result.inserted || 0}`);
    console.log(`  Updated: ${syncResult.result.updated || 0}`);
    console.log(`  Errors: ${syncResult.result.errors || 0}`);

    if (syncResult.result.errorMessage) {
      console.log(`  Error Message: ${syncResult.result.errorMessage}`);
    }

    console.log('═════════════════════════════════════════════════════');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
    }
  }
}

testPfaSync();
