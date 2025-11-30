# Phase 4: Quick Reference Guide

**Full Documentation:** [PHASE_4_BIDIRECTIONAL_SYNC.md](./PHASE_4_BIDIRECTIONAL_SYNC.md)

---

## At a Glance

**What:** Bi-directional sync between PFA Vanguard and PEMS (write-back capability)
**Effort:** 104 hours (6 weeks)
**Priority:** High
**Status:** Planning Phase

---

## Key Components to Build

### Backend (64 hours)

1. **PemsWriteApiClient.ts** (8h)
   - PEMS UPDATE/DELETE API integration
   - Authentication handling
   - Response parsing

2. **PemsWriteSyncController.ts** (8h)
   - POST `/api/pems/write-sync` - Trigger sync
   - POST `/api/pems/conflicts/:id/resolve` - Resolve conflicts
   - GET `/api/pems/sync-status` - Query sync status

3. **ConflictDetectionService.ts** (8h)
   - Compare baseVersion vs PEMS version
   - Field-level diff detection
   - Auto-resolution strategies

4. **PemsWriteSyncWorker.ts** (16h)
   - Background worker (60s polling)
   - Queue processing (100 records/batch)
   - Retry logic (3 attempts, exponential backoff)
   - Rate limiting (10 req/sec)

5. **PfaValidationService.ts** (6h)
   - Pre-sync validation
   - Business rule checks
   - PEMS constraint validation

6. **Integration Tests** (10h)
   - Full sync cycle
   - Conflict scenarios
   - Error handling
   - Rollback tests

7. **Database Migrations** (4h)
   - `pfa_write_queue` table
   - `pfa_sync_conflict` table
   - Update `pfa_modification` schema

8. **Load Testing** (4h)
   - 1000 concurrent modifications
   - 10,000 queued items
   - Rate limit testing

### Frontend (24 hours)

9. **SyncStatusIndicator.tsx** (4h)
   - Real-time sync status badge
   - "Syncing...", "Synced ✓", "Conflict ⚠️", "Failed ✗"
   - Integration with Timeline, GridLab, CommandDeck

10. **ConflictResolutionModal.tsx** (8h)
    - Side-by-side comparison
    - Highlight conflicting fields
    - Resolution options: Use Local, Use PEMS, Merge
    - Apply resolution

11. **SyncHistoryDashboard.tsx** (6h)
    - List all sync jobs
    - Filter by status, date, organization
    - Detailed error view
    - Retry/rollback actions

12. **RollbackModal.tsx** (4h)
    - Select version to rollback
    - Preview changes
    - Confirm and execute rollback

13. **Real-time Notifications** (2h)
    - Toast notifications for sync events
    - WebSocket integration for status updates

### Documentation (8 hours)

14. **API Documentation** (2h) - Update `API_REFERENCE.md`
15. **User Guide** (3h) - How to use sync feature
16. **Admin Guide** (2h) - Configuration and monitoring
17. **Code Comments** (1h) - Inline documentation

### DevOps (8 hours)

18. **Environment Config** (2h) - PEMS credentials, worker schedule
19. **Monitoring** (3h) - Prometheus metrics, Grafana dashboards
20. **Deployment** (2h) - CI/CD pipeline updates
21. **Security Audit** (1h) - Credential encryption, permissions

---

## Database Schema

### New Tables

**pfa_write_queue** - Pending writes to PEMS
```sql
id, modificationId, pfaId, organizationId, operation, payload,
status, priority, retryCount, maxRetries, lastAttemptAt, lastError,
scheduledAt, completedAt, createdAt
```

**pfa_sync_conflict** - Detected conflicts
```sql
id, pfaId, organizationId, localVersion, pemsVersion, localData,
pemsData, conflictFields, status, resolution, resolvedBy,
resolvedAt, createdAt
```

### Updated Tables

**pfa_modification** - Add sync tracking
```sql
ALTER TABLE pfa_modification
ADD COLUMN syncStatus TEXT DEFAULT 'draft',
ADD COLUMN syncedAt TIMESTAMP,
ADD COLUMN syncError TEXT,
ADD COLUMN pemsVersion INTEGER;
```

---

## API Endpoints

### Write Sync

**Trigger Sync:**
```
POST /api/pems/write-sync
Body: { organizationId, modificationIds?, priority? }
```

**Sync Status:**
```
GET /api/pems/sync-status?organizationId=&status=&startDate=&endDate=
```

### Conflict Resolution

**Resolve Conflict:**
```
POST /api/pems/conflicts/:conflictId/resolve
Body: { resolution: 'use_local' | 'use_pems' | 'merge', mergedData? }
```

**List Conflicts:**
```
GET /api/pems/conflicts?organizationId=&status=
```

### PEMS API (External)

**Update PFA:**
```
PUT /api/pems/pfa/:pfaId
Body: { changes, version, modifiedBy, changeReason }
Response: { success, newVersion, updatedAt }
```

---

## Key Flows

### Happy Path Sync

```
User Edit → Draft → Commit → Queue → Worker → PEMS → Success → Mirror Update
```

### Conflict Flow

```
Worker → Detect Conflict → Create Conflict Record → Notify User →
User Resolves → Re-queue → Sync → Success
```

### Error Flow

```
Sync Attempt → Transient Error → Retry (3x) → Still Failing →
Move to DLQ → Alert Admin
```

---

## Testing Checklist

- [ ] User can commit modifications
- [ ] Queue processes within 2 minutes
- [ ] PEMS receives updates correctly
- [ ] Conflicts detected and notified
- [ ] Resolution strategies work
- [ ] Transient errors retry automatically
- [ ] Permanent errors fail fast
- [ ] DLQ captures failed items
- [ ] Rollback works correctly
- [ ] Monitoring shows accurate metrics
- [ ] 1000+ modifications handled
- [ ] Rate limits respected
- [ ] Security audit passed

---

## Configuration

**Environment Variables:**
```bash
# PEMS Write API
PEMS_WRITE_API_URL=https://pems.example.com/api
PEMS_WRITE_API_KEY=<encrypted>

# Sync Worker
ENABLE_WRITE_SYNC=true
WRITE_SYNC_SCHEDULE=*/1 * * * *  # Every 1 minute
WRITE_SYNC_BATCH_SIZE=100
WRITE_SYNC_MAX_RETRIES=3
WRITE_SYNC_RETRY_DELAY=5000  # 5 seconds

# Rate Limiting
PEMS_API_RATE_LIMIT=10  # requests per second
```

---

## Monitoring Metrics

**Key Metrics:**
- `pems_sync_queue_size` - Items in queue
- `pems_sync_success_rate` - % successful syncs
- `pems_sync_latency_seconds` - Time from commit to sync
- `pems_sync_conflicts_total` - Total conflicts detected
- `pems_sync_errors_total` - Total sync errors
- `pems_api_rate_limit_hits` - Rate limit 429 responses

**Alerts:**
- Queue size > 1000 for > 10 minutes
- Success rate < 95% over 1 hour
- DLQ size > 50
- Sync worker not running for > 5 minutes

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Data loss during sync | Medium | Critical | Transactional operations, audit logs |
| Version conflicts | High | Medium | Optimistic locking, clear UI |
| PEMS rate limiting | Medium | Medium | Throttling, batching, backoff |
| Network failures | Medium | Low | Retry logic, health checks |

---

## Success Criteria

- [x] 99.9% sync success rate
- [x] < 2 minute sync latency
- [x] 1000 modifications in < 5 minutes
- [x] Zero data loss
- [x] 100% audit trail coverage

---

## Phase Timeline

**Week 1:** Infrastructure setup (DB tables, migrations)
**Week 2:** Write API development (client, controller, validation)
**Week 3:** Sync worker development (queue, retry, DLQ)
**Week 4:** UI development (status, conflicts, history)
**Week 5:** Testing & QA (integration, load, security)
**Week 6:** Deployment & monitoring

---

## Related Documents

- [PHASE_4_BIDIRECTIONAL_SYNC.md](./PHASE_4_BIDIRECTIONAL_SYNC.md) - Full specification
- [FUTURE_ENHANCEMENTS.md](./FUTURE_ENHANCEMENTS.md) - Enhancement tracking
- [API_REFERENCE.md](./backend/API_REFERENCE.md) - API documentation
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture

---

**Last Updated:** 2025-11-28
