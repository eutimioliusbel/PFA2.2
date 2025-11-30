# WebSocket Services

Real-time event streaming for PFA Vanguard.

## SyncWebSocketServer

Broadcasts sync status events to connected clients in real-time.

### Architecture

```
PemsWriteSyncWorker → WebSocket Server → Frontend Clients
                           ↓
                    organizationId-based rooms
```

### Event Types

| Event Type | Trigger | Payload |
|------------|---------|---------|
| `CONNECTED` | Client connects | `{ organizationId, timestamp }` |
| `SYNC_QUEUED` | Item added to write queue | `{ pfaId, organizationId, timestamp }` |
| `SYNC_PROCESSING` | Worker starts processing item | `{ pfaId, organizationId, timestamp }` |
| `SYNC_SUCCESS` | Item synced to PEMS | `{ pfaId, organizationId, timestamp, details: { newVersion } }` |
| `SYNC_CONFLICT` | Version conflict detected | `{ pfaId, organizationId, timestamp, details: { conflictId, conflictingFields } }` |
| `SYNC_FAILED` | Sync failed permanently | `{ pfaId, organizationId, timestamp, details: { error, retryCount } }` |

### Connection URL

```
ws://localhost:3000/api/ws/sync/{organizationId}
```

**Example:**
```
ws://localhost:3000/api/ws/sync/org-rio
```

### Frontend Usage

```typescript
const ws = new WebSocket(`wss://api/ws/sync/${organizationId}`);

ws.onmessage = (event) => {
  const syncEvent = JSON.parse(event.data);

  switch (syncEvent.type) {
    case 'SYNC_PROCESSING':
      showProcessingIndicator(syncEvent.pfaId);
      break;
    case 'SYNC_SUCCESS':
      showSuccessToast(syncEvent.pfaId);
      refreshPfaData();
      break;
    case 'SYNC_CONFLICT':
      showConflictModal(syncEvent.pfaId, syncEvent.details);
      break;
    case 'SYNC_FAILED':
      showErrorToast(syncEvent.details.error);
      break;
  }
};
```

### Backend Integration

The WebSocket server is automatically initialized in `server.ts` and broadcasts events from:

1. **PemsWriteSyncWorker** - Broadcasts sync lifecycle events
2. **PfaWriteQueue Controller** - Broadcasts SYNC_QUEUED when items added
3. **Conflict Detection Service** - Broadcasts SYNC_CONFLICT when conflicts detected

### Testing

**Basic Connection Test:**
```bash
npx tsx scripts/test-websocket-connection.ts org-rio
```

**Sync Events Test:**
```bash
npx tsx scripts/test-websocket-sync-events.ts org-rio
```

**Manual Test with wscat:**
```bash
npx wscat -c ws://localhost:3000/api/ws/sync/org-rio
```

### Performance

- **Connection Overhead:** ~2KB per client
- **Message Size:** ~200 bytes average
- **Broadcast Latency:** <10ms for 100 concurrent clients
- **Max Concurrent Connections:** 10,000 (configurable)

### Security Considerations

**Current Implementation:**
- No authentication (connections accepted from any origin)
- No rate limiting
- No message validation

**Production Requirements:**
- Add JWT token validation on connection
- Implement per-client rate limiting
- Add message size limits
- Enable compression for large payloads

### Troubleshooting

**Connection Refused:**
- Ensure backend server is running
- Check PORT in `.env` (default: 3000)
- Verify firewall allows WebSocket connections

**No Events Received:**
- Verify organizationId matches queue items
- Check that PEMS write sync worker is enabled
- Ensure there are pending items in `PfaWriteQueue`

**Events Delayed:**
- Check worker cron schedule (default: every minute)
- Verify server load (worker may be rate-limited)
- Check network latency between client and server

### Architecture Decision

**Why WebSockets?**
- **Real-time:** Sub-second latency for sync status updates
- **Efficient:** Single persistent connection vs. polling every second
- **Scalable:** Horizontal scaling via Redis pub/sub (future)

**Alternative Approaches Considered:**
- Polling: High server load, 1-5 second latency
- Server-Sent Events (SSE): One-way only, poor mobile support
- Long polling: Complex to implement, high latency

### Future Enhancements

- [ ] Redis pub/sub for multi-server deployments
- [ ] JWT authentication on connection
- [ ] Heartbeat/ping-pong for connection health
- [ ] Reconnection backoff strategy (client-side)
- [ ] Event compression for high-volume scenarios
- [ ] Metrics (connection count, message rate, latency)
