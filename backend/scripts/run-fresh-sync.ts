import fetch from 'node-fetch';

async function runFreshSync() {
  try {
    // Login
    console.log('🔐 Logging in...');
    const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });

    const loginData = await loginResponse.json() as any;
    const token = loginData.token;
    const rioOrg = loginData.user.organizations.find((o: any) => o.code === 'RIO');

    console.log(`✅ Logged in. Syncing ${rioOrg.code}...`);

    // Trigger PEMS sync with apiConfigId
    const syncResponse = await fetch('http://localhost:3001/api/pems/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        organizationId: rioOrg.id,
        apiConfigId: 'pems-endpoint-pfa-read',
        syncType: 'full'
      })
    });

    const syncResult = await syncResponse.json() as any;
    console.log('\n📊 Sync Result:', JSON.stringify(syncResult, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

runFreshSync();
