/**
 * Test WebSocket Sync Events
 *
 * Simulates sync events by triggering a write sync and listening for WebSocket events.
 *
 * Prerequisites:
 * - Backend server must be running
 * - At least one pending item in PfaWriteQueue
 *
 * Usage:
 *   npx tsx scripts/test-websocket-sync-events.ts [organizationId]
 */

import WebSocket from 'ws';
import prisma from '../src/config/database';

const ORGANIZATION_ID = process.argv[2] || 'org-rio';
const WS_URL = `ws://localhost:3000/api/ws/sync/${ORGANIZATION_ID}`;

interface SyncEvent {
  type: 'CONNECTED' | 'SYNC_QUEUED' | 'SYNC_PROCESSING' | 'SYNC_SUCCESS' | 'SYNC_CONFLICT' | 'SYNC_FAILED';
  pfaId?: string;
  organizationId?: string;
  timestamp?: Date;
  details?: any;
}

let receivedEvents: SyncEvent[] = [];

console.log(`🔌 Connecting to WebSocket: ${WS_URL}\n`);

const ws = new WebSocket(WS_URL);

ws.on('open', async () => {
  console.log('✅ WebSocket connection established');
  console.log('📊 Checking for pending queue items...\n');

  // Check if there are pending items in the queue
  const pendingItems = await prisma.pfaWriteQueue.findMany({
    where: {
      organizationId: ORGANIZATION_ID,
      status: { in: ['pending', 'queued'] }
    },
    take: 5
  });

  if (pendingItems.length === 0) {
    console.log('⚠️ No pending items in write queue for this organization.');
    console.log('💡 Create a pending item first, or wait for the cron job to process existing items.');
    ws.close();
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log(`✅ Found ${pendingItems.length} pending items:`);
  pendingItems.forEach(item => {
    console.log(`   - PFA ${item.pfaId} (status: ${item.status}, retry: ${item.retryCount})`);
  });
  console.log('\n⏳ Waiting for sync events (listening for 30 seconds)...\n');
});

ws.on('message', (data) => {
  try {
    const event: SyncEvent = JSON.parse(data.toString());
    receivedEvents.push(event);

    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 📨 ${event.type}`, event.pfaId ? `- PFA: ${event.pfaId}` : '');

    if (event.details) {
      console.log(`   Details:`, JSON.stringify(event.details, null, 2));
    }
  } catch (error) {
    console.error('❌ Failed to parse message:', error);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
  cleanup();
});

ws.on('close', (code, reason) => {
  console.log(`\n🔌 WebSocket connection closed (code: ${code}, reason: ${reason || 'normal'})`);
  cleanup();
});

// Auto-close after 30 seconds
setTimeout(() => {
  console.log('\n⏱️ Test completed (30 seconds elapsed)');
  console.log(`\n📊 Summary: Received ${receivedEvents.length} events`);

  const eventTypes = receivedEvents.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n📈 Event breakdown:');
  Object.entries(eventTypes).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`);
  });

  ws.close();
}, 30000);

async function cleanup() {
  await prisma.$disconnect();
  process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
