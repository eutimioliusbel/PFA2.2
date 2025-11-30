# PEMS Write Sync - Quick Reference

**ADR-008 Phase 2, Track A: Bi-Directional PEMS Sync**

---

## Quick Start

### 1. Enable Write Sync Worker

Add to `.env`:
```bash
ENABLE_PEMS_WRITE_SYNC=true
PEMS_WRITE_SYNC_SCHEDULE="* * * * *"  # Every 1 minute
```

### 2. Start Server

```bash
cd backend
npm start
```

Look for:
```
[CronScheduler] PEMS write sync job scheduled: * * * * *
```

---

## API Endpoints

### Queue Modifications for Sync

```bash
POST /api/pems/write-sync

{
  "organizationId": "uuid",
  "modificationIds": ["uuid1", "uuid2"],  # optional
  "priority": 5  # optional (0-10)
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "write-sync-1234567890",
  "queuedCount": 42,
  "estimatedCompletionTime": "2025-11-28T11:00:00Z"
}
```

---

### Get Sync Status

```bash
GET /api/pems/sync-status?organizationId=uuid&status=pending
```

**Response:**
```json
{
  "totalQueued": 10,
  "processing": 2,
  "completed": 150,
  "failed": 3,
  "avgSyncTime": 2500,
  "lastSyncAt": "2025-11-28T10:30:00Z",
  "nextSyncAt": "2025-11-28T10:31:00Z",
  "health": "healthy",
  "successRate": 98
}
```

---

### List Conflicts

```bash
GET /api/pems/conflicts?organizationId=uuid&status=unresolved
```

**Response:**
```json
{
  "conflicts": [
    {
      "id": "uuid",
      "pfaId": "PFA-12345",
      "localVersion": 3,
      "pemsVersion": 5,
      "conflictFields": ["forecastStart", "monthlyRate"],
      "localData": { "forecastStart": "2025-02-01", "monthlyRate": 6000 },
      "pemsData": { "forecastStart": "2025-01-15", "monthlyRate": 5500 },
      "status": "unresolved",
      "modifiedBy": {
        "username": "john.doe",
        "email": "john.doe@example.com"
      }
    }
  ],
  "total": 5
}
```

---

### Resolve Conflict

```bash
POST /api/pems/conflicts/:conflictId/resolve

{
  "resolution": "use_local" | "use_pems" | "merge",
  "mergedData": { ... }  # required if resolution is "merge"
}
```

**Response:**
```json
{
  "success": true,
  "conflictId": "uuid",
  "resolvedAt": "2025-11-28T10:35:00Z",
  "appliedChanges": { ... }
}
```

---

## Worker Behavior

**Processing Schedule:** Every 1 minute (configurable via `PEMS_WRITE_SYNC_SCHEDULE`)

**Batch Size:** 100 items per run

**Rate Limiting:** 10 requests/second to PEMS

**Retry Logic:**
- Attempt 1: Immediate
- Attempt 2: 5 seconds delay
- Attempt 3: 10 seconds delay
- Attempt 4: 20 seconds delay
- After 3 failures: Mark as `failed`

---

## Queue Item States

```
pending → processing → completed
                    ↘ failed
```

**Pending:** Waiting to be processed
**Processing:** Currently being synced to PEMS
**Completed:** Successfully synced to PEMS
**Failed:** Max retries exceeded or non-retryable error

---

## Conflict Resolution Strategies

### Use Local
- Keep local changes
- Discard PEMS changes
- Re-queue for sync with updated base version

### Use PEMS
- Discard local changes
- Keep PEMS changes
- Mark modification as synced

### Merge
- Apply user-provided merged data
- Re-queue for sync with updated base version

---

## Error Codes

**Non-Retryable (Fail Immediately):**
- 400: Invalid Request
- 401: Unauthorized
- 404: PFA Not Found
- 409: Version Conflict (creates conflict record)

**Retryable (Exponential Backoff):**
- 429: Rate Limit Exceeded
- 500: Server Error
- 503: Service Unavailable

---

## Testing

### Run Unit Tests

```bash
cd backend
npm test -- conflictDetection.test.ts
npm test -- pfaValidation.test.ts
```

### Run Integration Test

```bash
# Set your auth token
export TEST_AUTH_TOKEN="your-jwt-token"

# Run test script
npm run test:write-sync
```

---

## Monitoring

### Check Cron Job Status

```bash
# View server logs
tail -f backend/logs/app.log | grep "PEMS write sync"
```

Look for:
```
[CronJob] Starting PEMS write sync job
[CronJob] PEMS write sync job complete
```

### Check Queue Depth

```sql
SELECT status, COUNT(*)
FROM pfa_write_queue
GROUP BY status;
```

### Check Conflict Count

```sql
SELECT status, COUNT(*)
FROM pfa_sync_conflict
GROUP BY status;
```

---

## Troubleshooting

### Worker Not Running

**Check:**
1. `ENABLE_PEMS_WRITE_SYNC=true` in `.env`
2. Server logs for cron job initialization
3. Worker status: `pemsWriteSyncWorker.getStatus()`

### Items Not Processing

**Check:**
1. Queue items have `status = 'pending'` or `'queued'`
2. `scheduledAt` is in the past
3. Organization has write-enabled API server

### High Failure Rate

**Check:**
1. PEMS API credentials are valid
2. PEMS server is reachable
3. Error messages in `pfa_write_queue.lastError`

### Conflicts Not Resolving

**Check:**
1. Conflict status is `'unresolved'`
2. User has `perm_Sync` permission
3. Merged data passes validation

---

## Performance Tuning

### Increase Throughput

```bash
# Process more items per batch
PEMS_WRITE_SYNC_BATCH_SIZE=200

# Process more frequently
PEMS_WRITE_SYNC_SCHEDULE="*/30 * * * * *"  # Every 30 seconds
```

### Decrease PEMS Load

```bash
# Process less frequently
PEMS_WRITE_SYNC_SCHEDULE="*/5 * * * *"  # Every 5 minutes

# Reduce batch size
PEMS_WRITE_SYNC_BATCH_SIZE=50
```

---

## Database Queries

### View Pending Queue

```sql
SELECT
  id,
  pfaId,
  operation,
  status,
  retryCount,
  scheduledAt,
  lastError
FROM pfa_write_queue
WHERE status IN ('pending', 'queued')
ORDER BY priority DESC, scheduledAt ASC
LIMIT 20;
```

### View Recent Failures

```sql
SELECT
  q.pfaId,
  q.operation,
  q.lastError,
  q.retryCount,
  q.completedAt,
  m.userId
FROM pfa_write_queue q
JOIN pfa_modification m ON q.modificationId = m.id
WHERE q.status = 'failed'
ORDER BY q.completedAt DESC
LIMIT 20;
```

### View Unresolved Conflicts

```sql
SELECT
  c.pfaId,
  c.conflictFields,
  c.localVersion,
  c.pemsVersion,
  c.createdAt,
  u.username
FROM pfa_sync_conflict c
JOIN pfa_modification m ON c.modificationId = m.id
JOIN users u ON m.userId = u.id
WHERE c.status = 'unresolved'
ORDER BY c.createdAt DESC;
```

---

## File Locations

**Services:**
- `backend/src/services/pems/PemsWriteApiClient.ts`
- `backend/src/services/pems/ConflictDetectionService.ts`
- `backend/src/services/pfa/PfaValidationService.ts`
- `backend/src/services/pems/PemsWriteSyncWorker.ts`

**Controllers:**
- `backend/src/controllers/pemsWriteSyncController.ts`

**Routes:**
- `backend/src/routes/pemsWriteSyncRoutes.ts`

**Tests:**
- `backend/tests/unit/conflictDetection.test.ts`
- `backend/tests/unit/pfaValidation.test.ts`

---

## Next Steps

**Phase 2, Track B: UI Integration**
1. Conflict Resolution Modal
2. Sync Status Dashboard
3. Modification Queue Viewer
4. Notification Integration

---

**Version:** 1.0
**Updated:** 2025-11-28
