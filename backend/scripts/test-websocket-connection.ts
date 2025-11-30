/**
 * Test WebSocket Connection
 *
 * Verifies that the WebSocket server is running and can handle connections.
 *
 * Usage:
 *   npx tsx scripts/test-websocket-connection.ts [organizationId]
 */

import WebSocket from 'ws';

const ORGANIZATION_ID = process.argv[2] || 'org-rio';
const WS_URL = `ws://localhost:3000/api/ws/sync/${ORGANIZATION_ID}`;

console.log(`🔌 Testing WebSocket connection to: ${WS_URL}\n`);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ WebSocket connection established');
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('📨 Message received:', JSON.stringify(message, null, 2));

    // Auto-close after receiving initial connection message
    if (message.type === 'CONNECTED') {
      console.log('\n✅ Connection confirmed! Closing connection in 2 seconds...');
      setTimeout(() => {
        ws.close();
      }, 2000);
    }
  } catch (error) {
    console.error('❌ Failed to parse message:', error);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
  process.exit(1);
});

ws.on('close', (code, reason) => {
  console.log(`\n🔌 WebSocket connection closed (code: ${code}, reason: ${reason || 'normal'})`);
  process.exit(0);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.error('\n⏱️ Connection timeout after 10 seconds');
  ws.close();
  process.exit(1);
}, 10000);
