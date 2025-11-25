/**
 * @file test-sync-worker.ts
 * @description Manual test script for Phase 2 Sync Worker
 *
 * Usage:
 * npm run tsx test-sync-worker.ts
 *
 * This script:
 * 1. Triggers a manual sync via API
 * 2. Polls for sync status
 * 3. Displays results
 */

import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:3001';

interface SyncLog {
  id: string;
  organizationCode: string;
  organizationName: string;
  status: string;
  recordsTotal: number;
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsErrored: number;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  triggeredBy: string;
}

interface SyncStatusResponse {
  success: boolean;
  logs: SyncLog[];
  summary: {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    lastSync: string | null;
  };
}

async function login(): Promise<string> {
  console.log('🔐 Logging in...');

  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: 'admin123'
    })
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.statusText}`);
  }

  const data = await response.json() as any;
  console.log('✅ Login successful');
  return data.token;
}

async function getOrganizations(token: string): Promise<any[]> {
  console.log('\n📋 Fetching organizations...');

  const response = await fetch(`${API_BASE_URL}/api/organizations`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch organizations: ${response.statusText}`);
  }

  const data = await response.json() as any;
  console.log(`✅ Found ${data.organizations.length} organizations`);

  data.organizations.forEach((org: any, index: number) => {
    console.log(`   ${index + 1}. ${org.code} - ${org.name}`);
  });

  return data.organizations;
}

async function triggerSync(token: string, organizationId: string): Promise<string> {
  console.log('\n🔄 Triggering sync...');

  const response = await fetch(`${API_BASE_URL}/api/sync/trigger`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ organizationId })
  });

  if (!response.ok) {
    const errorData = await response.json() as any;
    throw new Error(`Sync trigger failed: ${errorData.message || response.statusText}`);
  }

  const data = await response.json() as any;
  console.log(`✅ Sync triggered: ${data.message}`);
  console.log(`   Batch ID: ${data.batchId}`);

  return data.batchId;
}

async function getSyncStatus(token: string, organizationId?: string): Promise<SyncStatusResponse> {
  const url = organizationId
    ? `${API_BASE_URL}/api/sync/status?organizationId=${organizationId}&limit=5`
    : `${API_BASE_URL}/api/sync/status?limit=5`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to get sync status: ${response.statusText}`);
  }

  return await response.json() as SyncStatusResponse;
}

async function waitForSync(token: string, organizationId: string, maxWaitSeconds: number = 300): Promise<void> {
  console.log('\n⏳ Waiting for sync to complete...');

  const startTime = Date.now();
  const pollInterval = 2000; // 2 seconds

  while (true) {
    const elapsed = (Date.now() - startTime) / 1000;

    if (elapsed > maxWaitSeconds) {
      console.log('⚠️  Timeout waiting for sync to complete');
      break;
    }

    const status = await getSyncStatus(token, organizationId);

    if (status.logs.length === 0) {
      console.log('   No sync logs found yet...');
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      continue;
    }

    const latestLog = status.logs[0];

    if (latestLog.status === 'running') {
      console.log(`   Sync in progress... (${latestLog.recordsProcessed}/${latestLog.recordsTotal} records)`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      continue;
    }

    // Sync completed or failed
    console.log('\n✅ Sync completed!');
    console.log('\n📊 Sync Results:');
    console.log(`   Organization: ${latestLog.organizationCode} - ${latestLog.organizationName}`);
    console.log(`   Status: ${latestLog.status}`);
    console.log(`   Total Records: ${latestLog.recordsTotal}`);
    console.log(`   Processed: ${latestLog.recordsProcessed}`);
    console.log(`   Inserted: ${latestLog.recordsInserted}`);
    console.log(`   Updated: ${latestLog.recordsUpdated}`);
    console.log(`   Errors: ${latestLog.recordsErrored}`);
    console.log(`   Duration: ${latestLog.durationMs}ms`);
    console.log(`   Triggered By: ${latestLog.triggeredBy}`);

    if (latestLog.errorMessage) {
      console.log(`   Error: ${latestLog.errorMessage}`);
    }

    console.log('\n📈 Summary Statistics:');
    console.log(`   Total Syncs: ${status.summary.totalSyncs}`);
    console.log(`   Successful: ${status.summary.successfulSyncs}`);
    console.log(`   Failed: ${status.summary.failedSyncs}`);
    console.log(`   Last Sync: ${status.summary.lastSync}`);

    break;
  }
}

async function getWorkerStatus(token: string): Promise<void> {
  console.log('\n🔧 Worker Status:');

  const response = await fetch(`${API_BASE_URL}/api/sync/worker-status`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    console.log('   Failed to get worker status');
    return;
  }

  const data = await response.json() as any;
  console.log(`   Enabled: ${data.worker.enabled}`);
  console.log(`   Running: ${data.worker.running}`);
  console.log(`   Next Run: ${data.worker.nextRun || 'N/A'}`);
}

async function main() {
  try {
    console.log('🚀 PFA Vanguard - Sync Worker Test');
    console.log('====================================\n');

    // Step 1: Login
    const token = await login();

    // Step 2: Get worker status
    await getWorkerStatus(token);

    // Step 3: Get organizations
    const organizations = await getOrganizations(token);

    if (organizations.length === 0) {
      console.log('\n⚠️  No organizations found. Please run the seed script first.');
      return;
    }

    // Step 4: Select first active organization (prefer RIO if available)
    const org = organizations.find(o => o.code === 'RIO') ||
                organizations.find(o => o.isActive) ||
                organizations[0];
    console.log(`\n📍 Selected organization: ${org.code} - ${org.name}`);
    console.log(`   Organization ID: ${org.id}`);

    // Step 5: Trigger sync
    await triggerSync(token, org.id);

    // Step 6: Wait for sync to complete
    await waitForSync(token, org.id);

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
main();
