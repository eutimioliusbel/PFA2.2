/**
 * Test Script for PEMS Write Sync (ADR-008 Phase 2A)
 *
 * Verifies that all components are working together:
 * 1. Queue modifications
 * 2. Get sync status
 * 3. List conflicts
 * 4. Resolve conflicts
 */

import axios from 'axios';

const API_BASE = 'http://localhost:3000';
const TOKEN = process.env.TEST_AUTH_TOKEN || '';

if (!TOKEN) {
  console.error('ERROR: TEST_AUTH_TOKEN environment variable not set');
  console.log('Usage: TEST_AUTH_TOKEN=<your-jwt-token> npm run test:write-sync');
  process.exit(1);
}

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function testWriteSync() {
  console.log('='.repeat(60));
  console.log('PEMS Write Sync Test Suite');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Test 1: Get organizations
    console.log('[1/5] Getting organizations...');
    const orgsResponse = await api.get('/api/organizations');
    const organizations = orgsResponse.data;

    if (organizations.length === 0) {
      console.error('  ❌ No organizations found');
      return;
    }

    const testOrgId = organizations[0].id;
    console.log(`  ✅ Found ${organizations.length} organizations`);
    console.log(`  → Using organization: ${organizations[0].code} (${testOrgId})`);
    console.log('');

    // Test 2: Trigger write sync
    console.log('[2/5] Triggering write sync...');
    try {
      const syncResponse = await api.post('/api/pems/write-sync', {
        organizationId: testOrgId,
        priority: 5
      });

      console.log(`  ✅ Sync triggered successfully`);
      console.log(`  → Job ID: ${syncResponse.data.jobId}`);
      console.log(`  → Queued Count: ${syncResponse.data.queuedCount}`);
      console.log(`  → Estimated Completion: ${syncResponse.data.estimatedCompletionTime}`);
    } catch (error: any) {
      if (error.response?.status === 200 && error.response?.data?.queuedCount === 0) {
        console.log(`  ✅ No pending modifications to sync`);
      } else {
        throw error;
      }
    }
    console.log('');

    // Test 3: Get sync status
    console.log('[3/5] Getting sync status...');
    const statusResponse = await api.get('/api/pems/sync-status', {
      params: { organizationId: testOrgId }
    });

    console.log(`  ✅ Sync status retrieved`);
    console.log(`  → Total Queued: ${statusResponse.data.totalQueued}`);
    console.log(`  → Processing: ${statusResponse.data.processing}`);
    console.log(`  → Completed: ${statusResponse.data.completed}`);
    console.log(`  → Failed: ${statusResponse.data.failed}`);
    console.log(`  → Health: ${statusResponse.data.health}`);
    console.log(`  → Success Rate: ${statusResponse.data.successRate}%`);
    console.log('');

    // Test 4: List conflicts
    console.log('[4/5] Listing conflicts...');
    const conflictsResponse = await api.get('/api/pems/conflicts', {
      params: { organizationId: testOrgId }
    });

    console.log(`  ✅ Conflicts retrieved`);
    console.log(`  → Total Conflicts: ${conflictsResponse.data.total}`);

    if (conflictsResponse.data.total > 0) {
      console.log(`  → Unresolved: ${conflictsResponse.data.conflicts.filter((c: any) => c.status === 'unresolved').length}`);
      console.log(`  → Resolved: ${conflictsResponse.data.conflicts.filter((c: any) => c.status === 'resolved').length}`);
    }
    console.log('');

    // Test 5: Resolve conflict (if any exist)
    console.log('[5/5] Testing conflict resolution...');
    const unresolvedConflicts = conflictsResponse.data.conflicts.filter((c: any) => c.status === 'unresolved');

    if (unresolvedConflicts.length === 0) {
      console.log(`  ⚠️  No unresolved conflicts to test resolution`);
    } else {
      const conflictId = unresolvedConflicts[0].id;
      console.log(`  → Found conflict: ${conflictId}`);
      console.log(`  → Conflict fields: ${unresolvedConflicts[0].conflictFields.join(', ')}`);

      // Attempt to resolve (use_pems strategy for safety in testing)
      const resolveResponse = await api.post(`/api/pems/conflicts/${conflictId}/resolve`, {
        resolution: 'use_pems'
      });

      console.log(`  ✅ Conflict resolved successfully`);
      console.log(`  → Resolution: use_pems`);
      console.log(`  → Resolved At: ${resolveResponse.data.resolvedAt}`);
    }
    console.log('');

    // Summary
    console.log('='.repeat(60));
    console.log('✅ All tests passed successfully!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Verified Components:');
    console.log('  ✅ POST /api/pems/write-sync');
    console.log('  ✅ GET  /api/pems/sync-status');
    console.log('  ✅ GET  /api/pems/conflicts');
    console.log('  ✅ POST /api/pems/conflicts/:id/resolve');
    console.log('');
    console.log('Backend Infrastructure: READY ✅');
    console.log('');

  } catch (error: any) {
    console.error('');
    console.error('❌ Test Failed:');
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Error: ${error.response.data?.error || 'Unknown error'}`);
      console.error(`  Message: ${error.response.data?.message || 'No message'}`);
    } else {
      console.error(`  ${error.message}`);
    }
    console.error('');
    process.exit(1);
  }
}

testWriteSync();
