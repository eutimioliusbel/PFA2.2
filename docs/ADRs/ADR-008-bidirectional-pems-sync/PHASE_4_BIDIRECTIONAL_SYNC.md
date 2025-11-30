# Phase 4: Bi-directional PEMS Synchronization

**Status:** Planning Phase
**Priority:** High
**Estimated Effort:** 104 hours
**Last Updated:** 2025-11-28

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State (Phase 3)](#current-state-phase-3)
3. [Target State (Phase 4)](#target-state-phase-4)
4. [Architecture Overview](#architecture-overview)
5. [Technical Requirements](#technical-requirements)
6. [API Specifications](#api-specifications)
7. [Data Flow](#data-flow)
8. [Security & Compliance](#security--compliance)
9. [Error Handling & Recovery](#error-handling--recovery)
10. [Testing Strategy](#testing-strategy)
11. [Migration Plan](#migration-plan)
12. [Risk Assessment](#risk-assessment)
13. [Implementation Tasks](#implementation-tasks)
14. [Acceptance Criteria](#acceptance-criteria)

---

## Executive Summary

**Objective:** Enable bi-directional synchronization between PFA Vanguard and PEMS (HxGN EAM), allowing user modifications in PFA Vanguard to be written back to PEMS.

**Business Value:**
- Users can manage PFA data in PFA Vanguard's superior UI
- Single source of truth maintained in PEMS
- Reduced data entry duplication
- Audit trail for all changes
- Conflict resolution for concurrent edits

**Scope:**
- Write API for pushing PFA modifications to PEMS
- Conflict detection and resolution
- Two-way sync worker with intelligent batching
- Sync status tracking and notifications
- Rollback capabilities

---

## Current State (Phase 3)

### What Works Today

**Read-Only Sync:**
- ✅ PEMS → PostgreSQL (Bronze layer ingestion)
- ✅ Bronze → Silver → Gold medallion architecture
- ✅ PfaMirror (immutable PEMS baseline)
- ✅ PfaModification (user deltas)
- ✅ Real-time merge views
- ✅ Optimistic locking with version tracking

**Data Model:**
```
PEMS (Source of Truth)
  ↓ Read-only sync
PostgreSQL Bronze Layer (raw PEMS data)
  ↓ Transformation
PostgreSQL Silver Layer (validated data)
  ↓ Promotion
PostgreSQL Gold Layer (analytics-ready)
  ↓
PfaMirror (immutable baseline) + PfaModification (user deltas)
  ↓
Merged View (displayed to users)
```

**Limitations:**
- ❌ No write-back to PEMS
- ❌ User changes stay in PFA Vanguard
- ❌ Data divergence over time
- ❌ Manual reconciliation required

---

## Target State (Phase 4)

### Bi-directional Sync Architecture

```
PEMS (Source of Truth)
  ↕ Bi-directional sync
PostgreSQL Bronze Layer
  ↓ Transformation
PostgreSQL Silver Layer
  ↓ Promotion
PostgreSQL Gold Layer
  ↓
PfaMirror + PfaModification
  ↓
Merged View
  ↓ User edits
Change Queue (pending sync)
  ↓ Sync worker
PEMS UPDATE API
  ↓
PEMS (updated)
```

### Key Capabilities

1. **Write Sync Worker**
   - Polls for committed modifications
   - Batches updates for efficiency
   - Handles PEMS API rate limits
   - Retries failed writes with exponential backoff

2. **PEMS Update API**
   - `PUT /api/pfa/:id` - Update single PFA record
   - `POST /api/pfa/batch` - Batch update multiple records
   - `DELETE /api/pfa/:id` - Soft delete (mark as discontinued)

3. **Conflict Resolution**
   - Detect concurrent modifications (PEMS version vs local baseVersion)
   - User notification for conflicts
   - Manual or automatic resolution strategies
   - Audit trail for all resolutions

4. **Sync Status Tracking**
   - Real-time sync progress
   - Error notifications
   - Detailed logs for debugging
   - Dashboard with sync health metrics

---

## Architecture Overview

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     PFA Vanguard Frontend                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Timeline    │  │  GridLab     │  │ CommandDeck  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │                │
│         └─────────────────┴─────────────────┘                │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                    ┌───────▼────────┐
                    │  API Gateway   │
                    │ (Express.js)   │
                    └───────┬────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼──────┐
│ PfaData        │  │ PemsSync       │  │ PemsWrite   │
│ Controller     │  │ Controller     │  │ Controller  │
│ (Read/Update)  │  │ (Read Sync)    │  │ (Write Sync)│
└───────┬────────┘  └───────┬────────┘  └──────┬──────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                    ┌───────▼────────┐
                    │ PfaMirrorSvc   │
                    │ (Draft/Commit) │
                    └───────┬────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼──────┐
│ PfaMirror      │  │ PfaModification│  │ SyncQueue   │
│ (PEMS baseline)│  │ (User deltas)  │  │ (Pending)   │
└────────────────┘  └────────────────┘  └──────┬──────┘
                                               │
                                        ┌──────▼──────┐
                                        │ Sync Worker │
                                        │ (Background)│
                                        └──────┬──────┘
                                               │
                                        ┌──────▼──────┐
                                        │ PEMS API    │
                                        │ (UPDATE)    │
                                        └─────────────┘
```

### Data Model Enhancements

**New Tables:**

**`pfa_write_queue`** - Pending writes to PEMS
```sql
CREATE TABLE pfa_write_queue (
  id TEXT PRIMARY KEY,
  modificationId TEXT NOT NULL,
  pfaId TEXT NOT NULL,
  organizationId TEXT NOT NULL,
  operation TEXT NOT NULL, -- 'UPDATE', 'DELETE'
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  priority INTEGER DEFAULT 0,
  retryCount INTEGER DEFAULT 0,
  maxRetries INTEGER DEFAULT 3,
  lastAttemptAt TIMESTAMP,
  lastError TEXT,
  scheduledAt TIMESTAMP NOT NULL,
  completedAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (modificationId) REFERENCES pfa_modification(id) ON DELETE CASCADE,
  INDEX idx_status_scheduled (status, scheduledAt),
  INDEX idx_organization (organizationId),
  INDEX idx_pfa_id (pfaId)
);
```

**`pfa_sync_conflict`** - Detected conflicts
```sql
CREATE TABLE pfa_sync_conflict (
  id TEXT PRIMARY KEY,
  pfaId TEXT NOT NULL,
  organizationId TEXT NOT NULL,
  localVersion INTEGER NOT NULL,
  pemsVersion INTEGER NOT NULL,
  localData JSONB NOT NULL,
  pemsData JSONB NOT NULL,
  conflictFields JSONB NOT NULL, -- ['forecastStart', 'forecastEnd']
  status TEXT NOT NULL DEFAULT 'unresolved', -- unresolved, resolved_auto, resolved_manual
  resolution TEXT, -- 'use_local', 'use_pems', 'merge'
  resolvedBy TEXT,
  resolvedAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_status (status),
  INDEX idx_organization (organizationId),
  INDEX idx_pfa_id (pfaId)
);
```

**Updated Tables:**

**`pfa_modification`** - Add sync tracking
```sql
ALTER TABLE pfa_modification
ADD COLUMN syncStatus TEXT DEFAULT 'draft', -- draft, committed, queued, syncing, synced, failed
ADD COLUMN syncedAt TIMESTAMP,
ADD COLUMN syncError TEXT,
ADD COLUMN pemsVersion INTEGER; -- PEMS version at time of sync
```

---

## Technical Requirements

### Functional Requirements

**FR-1: Write API**
- Support UPDATE operations for PFA fields
- Support DELETE operations (soft delete in PEMS)
- Validate changes against PEMS business rules
- Return PEMS confirmation response

**FR-2: Sync Worker**
- Poll for committed modifications every 60 seconds
- Batch up to 100 records per sync cycle
- Respect PEMS API rate limits (max 10 req/sec)
- Update sync status in real-time

**FR-3: Conflict Detection**
- Compare baseVersion with PEMS current version
- Identify changed fields
- Notify user of conflicts
- Provide resolution options

**FR-4: Error Handling**
- Retry failed writes up to 3 times
- Exponential backoff (5s → 10s → 20s)
- Move to dead letter queue after max retries
- Alert administrators of critical failures

**FR-5: Audit Trail**
- Log all write attempts
- Track who made changes
- Record PEMS responses
- Maintain conflict resolution history

### Non-Functional Requirements

**NFR-1: Performance**
- Process 1000 modifications within 5 minutes
- Sync latency < 2 minutes for committed changes
- Handle 10,000 concurrent modifications in queue

**NFR-2: Reliability**
- 99.9% sync success rate
- Zero data loss during failures
- Automatic recovery from network issues

**NFR-3: Security**
- Encrypt PEMS credentials at rest
- Use HTTPS for all PEMS communication
- Validate user permissions before sync
- Audit all write operations

**NFR-4: Observability**
- Real-time sync status dashboard
- Prometheus metrics for monitoring
- Detailed error logs for debugging
- Alert on sync failures

---

## API Specifications

### 1. PEMS Update API (External - HxGN EAM)

**Endpoint:** `PUT /api/pems/pfa/:pfaId`

**Request:**
```json
{
  "pfaId": "PFA-12345",
  "organizationCode": "RIO",
  "changes": {
    "forecastStart": "2025-01-15T00:00:00Z",
    "forecastEnd": "2025-06-30T00:00:00Z",
    "monthlyRate": 5500.00,
    "dor": "PROJECT"
  },
  "version": 3,
  "modifiedBy": "john.doe@example.com",
  "changeReason": "Budget reallocation"
}
```

**Response (Success):**
```json
{
  "success": true,
  "pfaId": "PFA-12345",
  "newVersion": 4,
  "updatedAt": "2025-11-28T10:30:00Z",
  "message": "PFA record updated successfully"
}
```

**Response (Conflict):**
```json
{
  "success": false,
  "error": "VERSION_CONFLICT",
  "message": "Record has been modified by another user",
  "currentVersion": 5,
  "expectedVersion": 3,
  "conflictingFields": ["forecastStart", "forecastEnd"]
}
```

### 2. Internal Write Sync API

**Endpoint:** `POST /api/pems/write-sync`

**Description:** Trigger write sync worker manually

**Request:**
```json
{
  "organizationId": "org-123",
  "modificationIds": ["mod-1", "mod-2"], // Optional: specific mods
  "priority": "high" // Optional: high, normal, low
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "sync-job-456",
  "queuedCount": 25,
  "estimatedCompletionTime": "2025-11-28T10:35:00Z"
}
```

### 3. Conflict Resolution API

**Endpoint:** `POST /api/pems/conflicts/:conflictId/resolve`

**Request:**
```json
{
  "resolution": "use_local", // use_local, use_pems, merge
  "mergedData": { // Required if resolution = merge
    "forecastStart": "2025-01-15T00:00:00Z",
    "forecastEnd": "2025-06-30T00:00:00Z"
  }
}
```

**Response:**
```json
{
  "success": true,
  "conflictId": "conflict-789",
  "resolvedAt": "2025-11-28T10:32:00Z",
  "appliedChanges": {
    "forecastStart": "2025-01-15T00:00:00Z",
    "forecastEnd": "2025-06-30T00:00:00Z"
  }
}
```

### 4. Sync Status API

**Endpoint:** `GET /api/pems/sync-status`

**Query Parameters:**
- `organizationId` (optional)
- `status` (optional): pending, processing, completed, failed
- `startDate` (optional)
- `endDate` (optional)

**Response:**
```json
{
  "totalQueued": 150,
  "processing": 10,
  "completed": 12500,
  "failed": 23,
  "avgSyncTime": 45.2,
  "lastSyncAt": "2025-11-28T10:30:00Z",
  "nextSyncAt": "2025-11-28T10:31:00Z",
  "health": "healthy"
}
```

---

## Data Flow

### Write Sync Flow (Happy Path)

```
1. User edits PFA record in Timeline
   ↓
2. Frontend calls POST /api/pfa-data/save-draft
   ↓
3. PfaMirrorService creates/updates PfaModification
   - syncState: 'draft'
   - baseVersion: mirror.version
   ↓
4. User clicks "Save & Sync"
   ↓
5. Frontend calls POST /api/pfa-data/commit-drafts
   ↓
6. PfaMirrorService updates modifications
   - syncState: 'committed'
   - committedAt: now()
   ↓
7. System creates pfa_write_queue entry
   - status: 'pending'
   - scheduledAt: now()
   ↓
8. Sync Worker (every 60s) picks up pending items
   ↓
9. Worker calls PEMS UPDATE API
   ↓
10. PEMS responds with success + new version
   ↓
11. Worker updates:
    - pfa_modification.syncState = 'synced'
    - pfa_modification.syncedAt = now()
    - pfa_modification.pemsVersion = 4
    - pfa_write_queue.status = 'completed'
    ↓
12. Worker triggers read sync to update mirror
   ↓
13. PfaMirror updated with new PEMS data
   - version incremented
   - old version archived to history
   ↓
14. User sees "Synced ✓" status in UI
```

### Conflict Detection Flow

```
1. Sync Worker prepares to sync modification
   ↓
2. Worker checks modification.baseVersion vs mirror.version
   ↓
3. IF baseVersion < mirror.version:
   - CONFLICT DETECTED
   - Worker calls PEMS API to get latest version
   ↓
4. Worker compares:
   - modification.delta (local changes)
   - PEMS current data (remote changes)
   ↓
5. Worker creates pfa_sync_conflict record
   - localVersion: modification.baseVersion
   - pemsVersion: mirror.version
   - conflictFields: ['forecastStart', 'forecastEnd']
   ↓
6. Worker updates modification.syncState = 'conflict'
   ↓
7. User receives notification
   ↓
8. User opens conflict resolution UI
   - Shows side-by-side comparison
   - Highlights conflicting fields
   ↓
9. User selects resolution:
   - Use Local (override PEMS)
   - Use PEMS (discard local)
   - Merge (pick fields)
   ↓
10. Frontend calls POST /api/pems/conflicts/:id/resolve
   ↓
11. System re-queues modification with resolved data
   ↓
12. Sync worker picks up and completes sync
```

### Rollback Flow

```
1. Administrator detects bad sync
   ↓
2. Admin navigates to Sync History
   ↓
3. Admin selects failed sync batch
   ↓
4. Admin clicks "Rollback"
   ↓
5. System queries pfa_mirror_history
   - Finds previous version before bad sync
   ↓
6. System creates reverse modifications
   - Reverts to historical state
   ↓
7. System queues write to PEMS
   - Sends historical values
   ↓
8. PEMS accepts rollback
   ↓
9. System updates mirror to rolled-back state
   ↓
10. Admin confirms rollback success
```

---

## Security & Compliance

### Authentication & Authorization

**PEMS API Credentials:**
- Store in encrypted `organization_api_credentials` table
- Use AES-256 encryption at rest
- Decrypt only in memory during sync
- Rotate credentials every 90 days

**User Permissions:**
- `perm_Sync` - Required to commit changes for PEMS sync
- `perm_EditForecast` - Required to modify forecast fields
- `perm_EditActuals` - Required to modify actual fields
- `perm_ManageSettings` - Required to configure sync settings

### Audit Trail

**What to Log:**
- All write attempts (success or failure)
- PEMS API requests and responses
- Conflict detections and resolutions
- Rollback operations
- Sync worker activity

**Audit Log Schema:**
```typescript
{
  id: string;
  eventType: 'WRITE_ATTEMPT' | 'CONFLICT_DETECTED' | 'ROLLBACK';
  userId: string;
  organizationId: string;
  pfaId: string;
  modificationId: string;
  changes: object;
  pemsResponse: object;
  success: boolean;
  errorMessage?: string;
  timestamp: Date;
}
```

### Data Validation

**Pre-Sync Validation:**
- Field type validation (dates, numbers, strings)
- Business rule validation (forecastEnd >= forecastStart)
- Required field validation
- Character limit validation
- Enum value validation (dor: 'BEO' | 'PROJECT')

**Example Validator:**
```typescript
function validatePfaChanges(changes: Partial<PfaRecord>): ValidationResult {
  const errors: string[] = [];

  if (changes.forecastStart && changes.forecastEnd) {
    if (changes.forecastEnd < changes.forecastStart) {
      errors.push('Forecast end must be after forecast start');
    }
  }

  if (changes.monthlyRate && changes.monthlyRate < 0) {
    errors.push('Monthly rate must be positive');
  }

  if (changes.dor && !['BEO', 'PROJECT'].includes(changes.dor)) {
    errors.push('DOR must be BEO or PROJECT');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

---

## Error Handling & Recovery

### Error Categories

**1. Transient Errors (Retry)**
- Network timeouts
- PEMS API rate limiting (429)
- PEMS temporary unavailability (503)
- Database connection failures

**2. Permanent Errors (Fail Fast)**
- Authentication failures (401)
- Invalid data format (400)
- Record not found (404)
- Business rule violations

**3. Conflict Errors (User Resolution)**
- Version conflicts (409)
- Concurrent modifications
- Record locked by another user

### Retry Strategy

```typescript
interface RetryConfig {
  maxAttempts: 3;
  baseDelay: 5000; // 5 seconds
  maxDelay: 60000; // 1 minute
  backoffMultiplier: 2; // Exponential
}

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let attempt = 1;

  while (attempt <= config.maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryable(error) || attempt === config.maxAttempts) {
        throw error;
      }

      const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
        config.maxDelay
      );

      await sleep(delay);
      attempt++;
    }
  }
}
```

### Dead Letter Queue

**When to Use:**
- Max retries exceeded
- Permanent error detected
- Manual intervention required

**DLQ Process:**
1. Move failed item to `pfa_write_queue_dlq` table
2. Log detailed error information
3. Send notification to administrators
4. Provide UI for manual review and reprocessing

---

## Testing Strategy

### Unit Tests

**Coverage Areas:**
- Write sync worker logic
- Conflict detection algorithm
- Data validation functions
- Retry mechanism
- PEMS API client

**Example Test Cases:**
```typescript
describe('WriteSyncWorker', () => {
  it('should batch modifications for sync', async () => {
    const modifications = createMockModifications(150);
    const batches = worker.createBatches(modifications, 100);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(100);
    expect(batches[1]).toHaveLength(50);
  });

  it('should detect version conflicts', async () => {
    const modification = createModification({ baseVersion: 1 });
    const mirror = createMirror({ version: 3 });
    const conflict = worker.detectConflict(modification, mirror);
    expect(conflict).toBeTruthy();
    expect(conflict.localVersion).toBe(1);
    expect(conflict.pemsVersion).toBe(3);
  });

  it('should retry transient errors', async () => {
    let attempts = 0;
    const operation = jest.fn(() => {
      attempts++;
      if (attempts < 3) throw new NetworkError();
      return Promise.resolve({ success: true });
    });

    await worker.syncWithRetry(operation);
    expect(attempts).toBe(3);
  });
});
```

### Integration Tests

**Test Scenarios:**
1. Full sync cycle (commit → queue → sync → verify)
2. Conflict detection and resolution
3. Rollback operation
4. Rate limit handling
5. Network failure recovery

**Example Integration Test:**
```typescript
describe('Bi-directional Sync Integration', () => {
  it('should sync user modifications to PEMS', async () => {
    // 1. Create modification
    const modification = await createModification({
      pfaId: 'PFA-12345',
      delta: { forecastStart: new Date('2025-01-15') },
      baseVersion: 1
    });

    // 2. Commit modification
    await commitModification(modification.id);

    // 3. Wait for sync worker
    await waitForSync(modification.id, { timeout: 10000 });

    // 4. Verify PEMS was updated
    const pemsData = await pemsClient.getPfa('PFA-12345');
    expect(pemsData.forecastStart).toBe('2025-01-15T00:00:00Z');

    // 5. Verify sync status
    const updated = await getModification(modification.id);
    expect(updated.syncState).toBe('synced');
    expect(updated.pemsVersion).toBe(2);
  });
});
```

### Load Tests

**Scenarios:**
- 1000 concurrent modifications
- 10,000 queued items
- PEMS API rate limit saturation
- Database connection pool exhaustion

**Tools:**
- Artillery for HTTP load testing
- Custom worker load simulator
- Prometheus + Grafana for metrics

---

## Migration Plan

### Phase 4.1: Infrastructure Setup (Week 1)

**Tasks:**
1. Create new database tables (`pfa_write_queue`, `pfa_sync_conflict`)
2. Add indexes for query optimization
3. Update `pfa_modification` schema
4. Configure PEMS API credentials in environment

**Migration Script:**
```sql
-- backend/prisma/migrations/20251201_phase4_infrastructure/migration.sql

-- Create write queue
CREATE TABLE pfa_write_queue (
  -- ... schema from above
);

-- Create conflict tracking
CREATE TABLE pfa_sync_conflict (
  -- ... schema from above
);

-- Update modification table
ALTER TABLE pfa_modification
ADD COLUMN syncStatus TEXT DEFAULT 'draft',
ADD COLUMN syncedAt TIMESTAMP,
ADD COLUMN syncError TEXT,
ADD COLUMN pemsVersion INTEGER;

-- Create indexes
CREATE INDEX idx_writequeue_status_scheduled
ON pfa_write_queue(status, scheduledAt);

CREATE INDEX idx_modification_syncstatus
ON pfa_modification(syncStatus);
```

### Phase 4.2: Write API Development (Week 2)

**Tasks:**
1. Implement PEMS API client
2. Create write sync controller
3. Add conflict detection logic
4. Implement validation layer
5. Write unit tests

**Deliverables:**
- `PemsWriteApiClient.ts`
- `PemsWriteSyncController.ts`
- `ConflictDetectionService.ts`
- `PfaValidationService.ts`

### Phase 4.3: Sync Worker Development (Week 3)

**Tasks:**
1. Implement write sync worker
2. Add queue management
3. Implement retry logic
4. Create dead letter queue handler
5. Write integration tests

**Deliverables:**
- `PemsWriteSyncWorker.ts`
- `SyncQueueManager.ts`
- `RetryService.ts` (enhance existing)
- `DeadLetterQueueHandler.ts`

### Phase 4.4: UI Development (Week 4)

**Tasks:**
1. Add sync status indicators
2. Create conflict resolution modal
3. Add sync history dashboard
4. Implement rollback UI
5. Add real-time notifications

**Deliverables:**
- `SyncStatusIndicator.tsx`
- `ConflictResolutionModal.tsx`
- `SyncHistoryDashboard.tsx`
- `RollbackModal.tsx`

### Phase 4.5: Testing & QA (Week 5)

**Tasks:**
1. Execute integration test suite
2. Perform load testing
3. Security audit
4. User acceptance testing
5. Fix identified issues

### Phase 4.6: Deployment (Week 6)

**Tasks:**
1. Deploy to staging environment
2. Run smoke tests
3. Deploy to production
4. Monitor sync health
5. Collect user feedback

---

## Risk Assessment

### High Risks

**R-1: Data Loss During Sync Failures**
- **Probability:** Medium
- **Impact:** Critical
- **Mitigation:**
  - Transactional queue operations
  - Persistent retry tracking
  - Automatic rollback on failure
  - Comprehensive audit logging

**R-2: Version Conflicts**
- **Probability:** High
- **Impact:** Medium
- **Mitigation:**
  - Optimistic locking with baseVersion
  - Clear conflict notification UI
  - Multiple resolution strategies
  - User training on conflict handling

**R-3: PEMS API Rate Limiting**
- **Probability:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Respect rate limits (10 req/sec)
  - Implement request throttling
  - Queue-based batching
  - Exponential backoff on 429 errors

### Medium Risks

**R-4: Network Failures**
- **Probability:** Medium
- **Impact:** Low
- **Mitigation:**
  - Retry logic with exponential backoff
  - Health check monitoring
  - Automatic reconnection
  - Graceful degradation

**R-5: Database Performance**
- **Probability:** Low
- **Impact:** Medium
- **Mitigation:**
  - Proper indexing on queue tables
  - Batch processing for updates
  - Connection pooling
  - Query optimization

---

## Implementation Tasks

### Backend Tasks (64 hours)

**Task 1: PEMS Write API Client** (8 hours)
- File: `backend/src/services/pems/PemsWriteApiClient.ts`
- Implement UPDATE, DELETE endpoints
- Add request/response typing
- Handle authentication
- Error handling

**Task 2: Write Sync Controller** (8 hours)
- File: `backend/src/controllers/pemsWriteSyncController.ts`
- Create queue management endpoints
- Implement conflict resolution endpoints
- Add sync status endpoints
- Route configuration

**Task 3: Conflict Detection Service** (8 hours)
- File: `backend/src/services/pems/ConflictDetectionService.ts`
- Version comparison logic
- Field-level diff detection
- Automatic resolution strategies
- Conflict persistence

**Task 4: Write Sync Worker** (16 hours)
- File: `backend/src/services/pems/PemsWriteSyncWorker.ts`
- Queue polling logic
- Batch processing
- Rate limiting
- Retry mechanism
- Status updates

**Task 5: Validation Service** (6 hours)
- File: `backend/src/services/pfa/PfaValidationService.ts`
- Field validation rules
- Business logic validation
- PEMS constraint validation
- Error messaging

**Task 6: Integration Tests** (10 hours)
- File: `backend/tests/integration/pemsWriteSync.test.ts`
- Full sync cycle tests
- Conflict resolution tests
- Rollback tests
- Error handling tests

**Task 7: Database Migrations** (4 hours)
- Create migration script
- Add indexes
- Update schema
- Seed test data

**Task 8: Load Testing** (4 hours)
- Artillery test scripts
- Worker load simulator
- Performance benchmarks
- Optimization

### Frontend Tasks (24 hours)

**Task 9: Sync Status Indicator** (4 hours)
- File: `components/SyncStatusIndicator.tsx`
- Real-time status display
- Tooltip with details
- Color-coded states
- Integration with Timeline/GridLab

**Task 10: Conflict Resolution Modal** (8 hours)
- File: `components/ConflictResolutionModal.tsx`
- Side-by-side comparison
- Field highlighting
- Resolution options
- Merge interface

**Task 11: Sync History Dashboard** (6 hours)
- File: `components/admin/SyncHistoryDashboard.tsx`
- Sync job listing
- Filter/search
- Detailed view
- Error display

**Task 12: Rollback UI** (4 hours)
- File: `components/admin/RollbackModal.tsx`
- Version selection
- Preview changes
- Confirmation
- Progress tracking

**Task 13: Notifications** (2 hours)
- Real-time sync updates
- Conflict alerts
- Error notifications
- Toast messages

### Documentation Tasks (8 hours)

**Task 14: API Documentation** (2 hours)
- Update API_REFERENCE.md
- Add write sync endpoints
- Document request/response formats
- Add examples

**Task 15: User Guide** (3 hours)
- Write user guide for sync feature
- Conflict resolution guide
- Troubleshooting section
- Screenshots

**Task 16: Admin Guide** (2 hours)
- Sync configuration guide
- Monitoring guide
- Rollback procedures
- Best practices

**Task 17: Code Comments** (1 hour)
- Document complex logic
- Add inline comments
- Update JSDoc
- Explain algorithms

### DevOps Tasks (8 hours)

**Task 18: Environment Configuration** (2 hours)
- Add PEMS write API credentials
- Configure sync worker schedule
- Set retry parameters
- Enable/disable sync per org

**Task 19: Monitoring Setup** (3 hours)
- Prometheus metrics
- Grafana dashboards
- Alert rules
- Log aggregation

**Task 20: Deployment Scripts** (2 hours)
- Update deployment pipeline
- Add migration step
- Configure cron jobs
- Rollback procedure

**Task 21: Security Audit** (1 hour)
- Credential encryption review
- Permission validation
- Audit log verification
- HTTPS enforcement

---

## Acceptance Criteria

### Functional Acceptance

**AC-1: Write Sync**
- [x] User can commit modifications for PEMS sync
- [x] System queues modifications for processing
- [x] Sync worker processes queue within 2 minutes
- [x] PEMS receives updates successfully
- [x] Mirror updates with new PEMS version

**AC-2: Conflict Resolution**
- [x] System detects version conflicts
- [x] User receives notification of conflict
- [x] User can view side-by-side comparison
- [x] User can select resolution strategy
- [x] Resolved changes sync to PEMS

**AC-3: Error Handling**
- [x] Transient errors retry automatically
- [x] Permanent errors fail fast with clear message
- [x] Max retry attempts respected
- [x] Failed items move to DLQ
- [x] Administrators receive error alerts

**AC-4: Monitoring**
- [x] Dashboard shows sync status
- [x] Metrics track success/failure rates
- [x] Logs capture all sync attempts
- [x] Alerts trigger on failures
- [x] Health check endpoint available

### Performance Acceptance

**AC-5: Throughput**
- [x] Process 1000 modifications in < 5 minutes
- [x] Handle 10,000 queued items without degradation
- [x] Sync latency < 2 minutes average

**AC-6: Reliability**
- [x] 99.9% sync success rate
- [x] Zero data loss during failures
- [x] Automatic recovery from network issues

### Security Acceptance

**AC-7: Authentication & Authorization**
- [x] PEMS credentials encrypted at rest
- [x] User permissions validated before sync
- [x] Audit log captures all write attempts
- [x] HTTPS enforced for PEMS communication

---

## Dependencies

### External Dependencies

**PEMS API:**
- UPDATE endpoint availability
- API documentation
- Rate limit specifications
- Test environment access

**Infrastructure:**
- PostgreSQL 14+
- Redis (for worker coordination)
- Monitoring tools (Prometheus/Grafana)

### Internal Dependencies

**Completed:**
- ✅ PfaMirror + PfaModification architecture
- ✅ Optimistic locking with versioning
- ✅ Retry service with exponential backoff
- ✅ Permission system

**In Progress:**
- None

---

## Success Metrics

### Key Performance Indicators (KPIs)

**Sync Performance:**
- Avg sync latency: < 2 minutes (Target)
- Sync success rate: > 99.9% (Target)
- Queue processing time: < 5 min for 1000 items (Target)

**User Experience:**
- Conflict resolution time: < 5 minutes (Target)
- User-reported sync issues: < 1% (Target)
- Sync status visibility: 100% (Target)

**Operational:**
- System uptime: > 99.95% (Target)
- Data consistency: 100% (Target)
- Audit trail completeness: 100% (Target)

---

## Next Steps

1. **Review & Approval** - Stakeholder review of this document
2. **Environment Setup** - Configure PEMS test API credentials
3. **Sprint Planning** - Break tasks into 2-week sprints
4. **Development Start** - Begin Phase 4.1 (Infrastructure)
5. **Weekly Check-ins** - Review progress and adjust plan

---

**Document Owner:** Development Team
**Approvers:** Product Manager, Tech Lead, Security Team
**Status:** Awaiting Approval
