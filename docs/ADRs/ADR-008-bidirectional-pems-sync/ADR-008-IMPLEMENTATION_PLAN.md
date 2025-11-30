# ADR-008: IMPLEMENTATION PLAN - Bi-directional PEMS Synchronization

**Status**: Planning Phase
**Created**: 2025-11-28
**Last Updated**: 2025-11-28

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
│ PfaMirror      │  │ PfaModification│  │ WriteQueue  │
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

### Data Flow Architecture

**Write Sync Flow**:
```
User Edit → Draft → Commit → Queue → Worker → PEMS → Success → Mirror Update
```

**Conflict Flow**:
```
Worker → Detect Conflict → Create Conflict Record → Notify User →
User Resolves → Re-queue → Sync → Success
```

**Error Flow**:
```
Sync Attempt → Transient Error → Retry (3x) → Still Failing →
Move to DLQ → Alert Admin
```

---

## Database Schema

### New Tables

#### 1. pfa_write_queue

**Purpose**: Queue for pending PEMS write operations

```prisma
model PfaWriteQueue {
  id             String    @id @default(cuid())
  modificationId String
  pfaId          String
  organizationId String
  operation      String    // 'UPDATE', 'DELETE'
  payload        Json
  status         String    @default("pending") // pending, processing, completed, failed
  priority       Int       @default(0)
  retryCount     Int       @default(0)
  maxRetries     Int       @default(3)
  lastAttemptAt  DateTime?
  lastError      String?
  scheduledAt    DateTime
  completedAt    DateTime?
  createdAt      DateTime  @default(now())

  modification   PfaModification @relation(fields: [modificationId], references: [id], onDelete: Cascade)
  organization   Organization    @relation(fields: [organizationId], references: [id])

  @@index([status, scheduledAt])
  @@index([organizationId])
  @@index([pfaId])
  @@index([modificationId])
  @@map("pfa_write_queue")
}
```

**Migration SQL**:
```sql
CREATE TABLE pfa_write_queue (
  id TEXT PRIMARY KEY,
  modification_id TEXT NOT NULL,
  pfa_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMP,
  last_error TEXT,
  scheduled_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (modification_id) REFERENCES pfa_modification(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organization(id)
);

CREATE INDEX idx_writequeue_status_scheduled ON pfa_write_queue(status, scheduled_at);
CREATE INDEX idx_writequeue_organization ON pfa_write_queue(organization_id);
CREATE INDEX idx_writequeue_pfa_id ON pfa_write_queue(pfa_id);
CREATE INDEX idx_writequeue_modification ON pfa_write_queue(modification_id);
```

---

#### 2. pfa_sync_conflict

**Purpose**: Track detected conflicts and resolutions

```prisma
model PfaSyncConflict {
  id              String    @id @default(cuid())
  pfaId           String
  organizationId  String
  modificationId  String
  localVersion    Int
  pemsVersion     Int
  localData       Json
  pemsData        Json
  conflictFields  Json      // Array of field names
  status          String    @default("unresolved") // unresolved, resolved_auto, resolved_manual
  resolution      String?   // 'use_local', 'use_pems', 'merge'
  mergedData      Json?
  resolvedBy      String?
  resolvedAt      DateTime?
  createdAt       DateTime  @default(now())

  modification    PfaModification @relation(fields: [modificationId], references: [id], onDelete: Cascade)
  organization    Organization    @relation(fields: [organizationId], references: [id])

  @@index([status])
  @@index([organizationId])
  @@index([pfaId])
  @@index([modificationId])
  @@map("pfa_sync_conflict")
}
```

**Migration SQL**:
```sql
CREATE TABLE pfa_sync_conflict (
  id TEXT PRIMARY KEY,
  pfa_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  modification_id TEXT NOT NULL,
  local_version INTEGER NOT NULL,
  pems_version INTEGER NOT NULL,
  local_data JSONB NOT NULL,
  pems_data JSONB NOT NULL,
  conflict_fields JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'unresolved',
  resolution TEXT,
  merged_data JSONB,
  resolved_by TEXT,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (modification_id) REFERENCES pfa_modification(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organization(id)
);

CREATE INDEX idx_conflict_status ON pfa_sync_conflict(status);
CREATE INDEX idx_conflict_organization ON pfa_sync_conflict(organization_id);
CREATE INDEX idx_conflict_pfa_id ON pfa_sync_conflict(pfa_id);
CREATE INDEX idx_conflict_modification ON pfa_sync_conflict(modification_id);
```

---

### Updated Tables

#### pfa_modification

**Add sync tracking fields**:

```prisma
model PfaModification {
  // ... existing fields
  syncStatus  String?   @default("draft") // draft, committed, queued, syncing, synced, conflict, failed
  syncedAt    DateTime?
  syncError   String?
  pemsVersion Int?      // PEMS version at time of sync

  writeQueue  PfaWriteQueue[]
  conflicts   PfaSyncConflict[]
}
```

**Migration SQL**:
```sql
ALTER TABLE pfa_modification
ADD COLUMN sync_status TEXT DEFAULT 'draft',
ADD COLUMN synced_at TIMESTAMP,
ADD COLUMN sync_error TEXT,
ADD COLUMN pems_version INTEGER;

CREATE INDEX idx_modification_syncstatus ON pfa_modification(sync_status);
```

---

## API Specifications

### 1. PEMS Update API (External - HxGN EAM)

**Endpoint**: `PUT /api/pems/pfa/:pfaId`

**Authentication**: Bearer token (stored in `organization_api_credentials`)

**Request**:
```typescript
interface PemsUpdateRequest {
  pfaId: string;
  organizationCode: string;
  changes: Partial<PfaRecord>;
  version: number;           // Optimistic locking
  modifiedBy: string;
  changeReason?: string;
}
```

**Example**:
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

**Response (Success - 200)**:
```json
{
  "success": true,
  "pfaId": "PFA-12345",
  "newVersion": 4,
  "updatedAt": "2025-11-28T10:30:00Z",
  "message": "PFA record updated successfully"
}
```

**Response (Conflict - 409)**:
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

**Error Codes**:
| Code | Meaning | Retry? |
|------|---------|--------|
| 200 | Success | N/A |
| 400 | Invalid request | No |
| 401 | Unauthorized | No |
| 404 | PFA not found | No |
| 409 | Version conflict | No (user resolution) |
| 429 | Rate limit | Yes |
| 500 | Server error | Yes |
| 503 | Service unavailable | Yes |

---

### 2. Internal Write Sync API

#### POST /api/pems/write-sync

**Purpose**: Trigger write sync worker manually

**Request**:
```typescript
interface WriteSyncRequest {
  organizationId: string;
  modificationIds?: string[];  // Optional: specific mods to sync
  priority?: 'high' | 'normal' | 'low';
}
```

**Response**:
```json
{
  "success": true,
  "jobId": "sync-job-456",
  "queuedCount": 25,
  "estimatedCompletionTime": "2025-11-28T10:35:00Z"
}
```

---

#### GET /api/pems/sync-status

**Purpose**: Query sync status and metrics

**Query Parameters**:
- `organizationId` (optional)
- `status` (optional): pending, processing, completed, failed
- `startDate` (optional)
- `endDate` (optional)

**Response**:
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

#### POST /api/pems/conflicts/:conflictId/resolve

**Purpose**: Resolve a detected conflict

**Request**:
```typescript
interface ConflictResolutionRequest {
  resolution: 'use_local' | 'use_pems' | 'merge';
  mergedData?: Partial<PfaRecord>; // Required if resolution = 'merge'
}
```

**Response**:
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

---

#### GET /api/pems/conflicts

**Purpose**: List conflicts for organization

**Query Parameters**:
- `organizationId` (required)
- `status` (optional): unresolved, resolved_auto, resolved_manual

**Response**:
```json
{
  "conflicts": [
    {
      "id": "conflict-789",
      "pfaId": "PFA-12345",
      "status": "unresolved",
      "conflictFields": ["forecastStart", "forecastEnd"],
      "createdAt": "2025-11-28T10:25:00Z"
    }
  ],
  "total": 3
}
```

---

## Implementation Tasks

### Backend Tasks (64 hours)

#### Task 1: PEMS Write API Client (8 hours)

**File**: `backend/src/services/pems/PemsWriteApiClient.ts`

**Responsibilities**:
- HTTP client for PEMS UPDATE/DELETE endpoints
- Request/response typing
- Authentication header injection
- Error mapping (401, 404, 409, 429, 500)

**Interface**:
```typescript
interface PemsWriteApiClient {
  updatePfa(
    pfaId: string,
    changes: Partial<PfaRecord>,
    options: {
      version: number;
      modifiedBy: string;
      changeReason?: string;
    }
  ): Promise<PemsUpdateResponse>;

  deletePfa(
    pfaId: string,
    options: {
      version: number;
      modifiedBy: string;
      reason: string;
    }
  ): Promise<PemsDeleteResponse>;

  healthCheck(): Promise<{ healthy: boolean; latency: number }>;
}
```

**Implementation Details**:
- Use `axios` for HTTP requests
- Timeout: 30 seconds
- Retry logic: 3 attempts for 5xx errors
- Logging: All requests/responses

---

#### Task 2: Write Sync Controller (8 hours)

**File**: `backend/src/controllers/pemsWriteSyncController.ts`

**Endpoints**:
- `POST /api/pems/write-sync` - Trigger manual sync
- `GET /api/pems/sync-status` - Query sync status
- `POST /api/pems/conflicts/:id/resolve` - Resolve conflict
- `GET /api/pems/conflicts` - List conflicts

**Middleware**:
- `requireAuth` - JWT authentication
- `requirePermission('Sync')` - Permission check
- `requireOrganization` - Organization context

**Route Configuration**:
```typescript
// backend/src/routes/pemsWriteSyncRoutes.ts
import { Router } from 'express';
import { PemsWriteSyncController } from '../controllers/pemsWriteSyncController';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();
const controller = new PemsWriteSyncController();

router.post(
  '/write-sync',
  requireAuth,
  requirePermission('Sync'),
  controller.triggerSync
);

router.get(
  '/sync-status',
  requireAuth,
  requirePermission('Read'),
  controller.getSyncStatus
);

router.post(
  '/conflicts/:conflictId/resolve',
  requireAuth,
  requirePermission('Sync'),
  controller.resolveConflict
);

router.get(
  '/conflicts',
  requireAuth,
  requirePermission('Read'),
  controller.listConflicts
);

export default router;
```

---

#### Task 3: Conflict Detection Service (8 hours)

**File**: `backend/src/services/pems/ConflictDetectionService.ts`

**Responsibilities**:
- Version comparison (baseVersion vs mirror.version)
- Field-level diff detection
- Automatic resolution strategies
- Conflict persistence

**Algorithm**:
```typescript
class ConflictDetectionService {
  async detectConflict(
    modification: PfaModification,
    mirror: PfaMirror
  ): Promise<PfaSyncConflict | null> {
    // 1. Check version mismatch
    if (modification.baseVersion >= mirror.version) {
      return null; // No conflict
    }

    // 2. Field-level diff
    const modifiedFields = Object.keys(modification.delta);
    const mirrorChanges = this.diffVersions(
      modification.baseVersion,
      mirror.version,
      mirror.id
    );

    // 3. Identify conflicting fields
    const conflictFields = modifiedFields.filter(field =>
      mirrorChanges.includes(field)
    );

    if (conflictFields.length === 0) {
      // Non-overlapping changes - auto-merge
      return null;
    }

    // 4. Create conflict record
    return prisma.pfaSyncConflict.create({
      data: {
        pfaId: modification.pfaId,
        organizationId: modification.organizationId,
        modificationId: modification.id,
        localVersion: modification.baseVersion,
        pemsVersion: mirror.version,
        localData: modification.delta,
        pemsData: mirror.data,
        conflictFields: conflictFields,
        status: 'unresolved',
      },
    });
  }

  async autoResolve(
    conflict: PfaSyncConflict
  ): Promise<{ strategy: string; mergedData: object } | null> {
    // Auto-resolution strategies:
    // 1. Non-overlapping changes → merge
    // 2. Same value on both sides → no conflict
    // 3. Otherwise → require user decision

    const localFields = Object.keys(conflict.localData);
    const pemsFields = Object.keys(conflict.pemsData);

    if (!localFields.some(f => pemsFields.includes(f))) {
      // Non-overlapping - safe to merge
      return {
        strategy: 'merge',
        mergedData: { ...conflict.pemsData, ...conflict.localData },
      };
    }

    return null; // Require user decision
  }
}
```

---

#### Task 4: Write Sync Worker (16 hours)

**File**: `backend/src/services/pems/PemsWriteSyncWorker.ts`

**Responsibilities**:
- Queue polling (every 60 seconds)
- Batch processing (100 items/batch)
- Rate limiting (10 req/sec)
- Retry mechanism (exponential backoff)
- Status updates (real-time via WebSocket)

**Worker Logic**:
```typescript
class PemsWriteSyncWorker {
  private isRunning = false;
  private batchSize = 100;
  private pollInterval = 60000; // 60 seconds
  private rateLimiter = new RateLimiter(10); // 10 req/sec

  async start() {
    this.isRunning = true;
    this.scheduleNextPoll();
  }

  private async scheduleNextPoll() {
    if (!this.isRunning) return;

    await this.processQueue();
    setTimeout(() => this.scheduleNextPoll(), this.pollInterval);
  }

  async processQueue() {
    logger.info('[WriteSyncWorker] Processing queue...');

    // 1. Fetch pending items
    const pendingItems = await prisma.pfaWriteQueue.findMany({
      where: {
        status: 'pending',
        scheduledAt: { lte: new Date() },
      },
      orderBy: [
        { priority: 'desc' },
        { scheduledAt: 'asc' },
      ],
      take: this.batchSize,
    });

    if (pendingItems.length === 0) {
      logger.info('[WriteSyncWorker] No pending items');
      return;
    }

    logger.info(`[WriteSyncWorker] Processing ${pendingItems.length} items`);

    // 2. Process each item
    for (const item of pendingItems) {
      try {
        await this.rateLimiter.acquire();
        await this.syncOne(item);
      } catch (error) {
        logger.error('[WriteSyncWorker] Sync failed', { item, error });
      }
    }
  }

  private async syncOne(queueItem: PfaWriteQueue) {
    // Mark as processing
    await prisma.pfaWriteQueue.update({
      where: { id: queueItem.id },
      data: { status: 'processing' },
    });

    try {
      // 1. Get modification and mirror
      const modification = await prisma.pfaModification.findUnique({
        where: { id: queueItem.modificationId },
      });

      const mirror = await prisma.pfaMirror.findFirst({
        where: {
          organizationId: queueItem.organizationId,
          pfaId: queueItem.pfaId,
        },
      });

      // 2. Check for conflicts
      const conflict = await this.conflictService.detectConflict(
        modification,
        mirror
      );

      if (conflict) {
        await this.handleConflict(queueItem, conflict);
        return;
      }

      // 3. Call PEMS API
      const pemsResponse = await this.pemsClient.updatePfa(
        queueItem.pfaId,
        queueItem.payload,
        {
          version: modification.baseVersion,
          modifiedBy: modification.createdBy,
          changeReason: modification.changeReason,
        }
      );

      // 4. Update modification and queue
      await prisma.$transaction([
        prisma.pfaModification.update({
          where: { id: queueItem.modificationId },
          data: {
            syncStatus: 'synced',
            syncedAt: new Date(),
            pemsVersion: pemsResponse.newVersion,
          },
        }),
        prisma.pfaWriteQueue.update({
          where: { id: queueItem.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
          },
        }),
      ]);

      // 5. Trigger read sync to update mirror
      await this.pemsReadSync.syncOne(queueItem.organizationId, queueItem.pfaId);

      logger.info('[WriteSyncWorker] Sync successful', { queueItem });

    } catch (error) {
      await this.handleError(queueItem, error);
    }
  }

  private async handleError(queueItem: PfaWriteQueue, error: Error) {
    const isRetryable = this.isRetryableError(error);
    const shouldRetry = queueItem.retryCount < queueItem.maxRetries;

    if (isRetryable && shouldRetry) {
      // Retry with exponential backoff
      const delay = Math.pow(2, queueItem.retryCount) * 5000; // 5s, 10s, 20s

      await prisma.pfaWriteQueue.update({
        where: { id: queueItem.id },
        data: {
          status: 'pending',
          retryCount: queueItem.retryCount + 1,
          lastAttemptAt: new Date(),
          lastError: error.message,
          scheduledAt: new Date(Date.now() + delay),
        },
      });

      logger.info('[WriteSyncWorker] Retry scheduled', { queueItem, delay });
    } else {
      // Move to failed / DLQ
      await prisma.$transaction([
        prisma.pfaWriteQueue.update({
          where: { id: queueItem.id },
          data: {
            status: 'failed',
            lastError: error.message,
            lastAttemptAt: new Date(),
          },
        }),
        prisma.pfaModification.update({
          where: { id: queueItem.modificationId },
          data: {
            syncStatus: 'failed',
            syncError: error.message,
          },
        }),
      ]);

      logger.error('[WriteSyncWorker] Sync failed permanently', { queueItem, error });
    }
  }

  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'NETWORK_ERROR',
      'TIMEOUT',
      'RATE_LIMIT_EXCEEDED',
      'SERVICE_UNAVAILABLE',
    ];
    return retryableErrors.some(e => error.message.includes(e));
  }
}
```

**Cron Configuration**:
```typescript
// backend/src/server.ts
import cron from 'node-cron';
import { PemsWriteSyncWorker } from './services/pems/PemsWriteSyncWorker';

const writeSyncWorker = new PemsWriteSyncWorker();

// Run every 1 minute
cron.schedule('*/1 * * * *', async () => {
  await writeSyncWorker.processQueue();
});
```

---

#### Task 5: Validation Service (6 hours)

**File**: `backend/src/services/pfa/PfaValidationService.ts`

**Validation Rules**:
```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

class PfaValidationService {
  validate(changes: Partial<PfaRecord>): ValidationResult {
    const errors: string[] = [];

    // Date ordering
    if (changes.forecastStart && changes.forecastEnd) {
      if (changes.forecastEnd < changes.forecastStart) {
        errors.push('Forecast end must be after forecast start');
      }
    }

    // Required fields for rentals
    if (changes.source === 'Rental' && !changes.monthlyRate) {
      errors.push('Monthly rate required for rentals');
    }

    // Required fields for purchases
    if (changes.source === 'Purchase' && !changes.purchasePrice) {
      errors.push('Purchase price required for purchases');
    }

    // Enum validation
    if (changes.dor && !['BEO', 'PROJECT'].includes(changes.dor)) {
      errors.push('DOR must be BEO or PROJECT');
    }

    // Numeric validation
    if (changes.monthlyRate && changes.monthlyRate < 0) {
      errors.push('Monthly rate must be positive');
    }

    // Character limits
    if (changes.description && changes.description.length > 500) {
      errors.push('Description must be less than 500 characters');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
```

---

### Frontend Tasks (24 hours)

#### Task 9: SyncStatusIndicator Component (4 hours)

See [UX_SPEC.md](./ADR-008-UX_SPEC.md) for complete specification.

**File**: `components/SyncStatusIndicator.tsx`

---

#### Task 10: ConflictResolutionModal Component (8 hours)

See [UX_SPEC.md](./ADR-008-UX_SPEC.md) for complete specification.

**File**: `components/ConflictResolutionModal.tsx`

---

#### Task 11: SyncHistoryDashboard Component (6 hours)

See [UX_SPEC.md](./ADR-008-UX_SPEC.md) for complete specification.

**File**: `components/admin/SyncHistoryDashboard.tsx`

---

#### Task 12: RollbackModal Component (4 hours)

See [UX_SPEC.md](./ADR-008-UX_SPEC.md) for complete specification.

**File**: `components/admin/RollbackModal.tsx`

---

#### Task 13: Real-time Notifications (2 hours)

See [UX_SPEC.md](./ADR-008-UX_SPEC.md) for complete specification.

**WebSocket Integration**: `services/syncWebSocket.ts`

---

### Documentation Tasks (8 hours)

#### Task 14: API Documentation (2 hours)

Update `docs/backend/API_REFERENCE.md` with new endpoints.

#### Task 15: User Guide (3 hours)

Create `docs/user/SYNC_USER_GUIDE.md`:
- How to sync changes
- Understanding sync status
- Resolving conflicts
- Troubleshooting

#### Task 16: Admin Guide (2 hours)

Create `docs/admin/SYNC_ADMIN_GUIDE.md`:
- Configuration
- Monitoring
- Rollback procedures
- DLQ management

#### Task 17: Code Comments (1 hour)

Inline JSDoc comments for complex logic.

---

### DevOps Tasks (8 hours)

#### Task 18: Environment Configuration (2 hours)

**File**: `backend/.env.example`

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

#### Task 19: Monitoring Setup (3 hours)

**Prometheus Metrics**:
```typescript
// backend/src/monitoring/metrics.ts
import { Counter, Gauge, Histogram } from 'prom-client';

export const pemsSyncMetrics = {
  queueSize: new Gauge({
    name: 'pems_sync_queue_size',
    help: 'Number of items in sync queue',
    labelNames: ['organization_id'],
  }),

  syncSuccessRate: new Counter({
    name: 'pems_sync_success_total',
    help: 'Total successful syncs',
    labelNames: ['organization_id'],
  }),

  syncLatency: new Histogram({
    name: 'pems_sync_latency_seconds',
    help: 'Time from commit to sync completion',
    labelNames: ['organization_id'],
    buckets: [5, 15, 30, 60, 120, 300],
  }),

  conflictsDetected: new Counter({
    name: 'pems_sync_conflicts_total',
    help: 'Total conflicts detected',
    labelNames: ['organization_id'],
  }),

  syncErrors: new Counter({
    name: 'pems_sync_errors_total',
    help: 'Total sync errors',
    labelNames: ['organization_id', 'error_type'],
  }),
};
```

**Grafana Dashboard**: JSON config for sync health visualization.

---

#### Task 20: Deployment Scripts (2 hours)

**Migration Workflow**:
```bash
# 1. Run database migrations
npx prisma migrate deploy

# 2. Restart backend server (picks up new routes)
pm2 restart pfa-vanguard-backend

# 3. Start sync worker
pm2 start ecosystem.config.js --only pems-write-sync-worker

# 4. Verify health
curl https://api/health/write-sync
```

---

#### Task 21: Security Audit (1 hour)

**Checklist**:
- [ ] PEMS credentials encrypted at rest
- [ ] Permission validation in all endpoints
- [ ] Audit log captures all write attempts
- [ ] HTTPS enforced for PEMS communication
- [ ] Input sanitization for SQL injection
- [ ] XSS prevention in UI components

---

## Migration Plan

### Phase 4.1: Infrastructure Setup (Week 1)

**Day 1-2: Database Migrations**
```bash
# Create migration file
npx prisma migrate dev --name phase4_infrastructure

# Apply to staging
npx prisma migrate deploy --preview-feature

# Verify tables created
psql -d pfa_vanguard -c "\d pfa_write_queue"
psql -d pfa_vanguard -c "\d pfa_sync_conflict"
```

**Day 3-4: Environment Configuration**
- Add PEMS credentials to staging environment
- Configure worker schedule
- Set up Prometheus metrics endpoint
- Configure WebSocket server

**Day 5: Testing**
- Verify database schema
- Test queue insert/update
- Test conflict insert/update
- Test environment variables loaded

---

### Phase 4.2: Write API Development (Week 2)

**Deliverables**:
- `PemsWriteApiClient.ts`
- `PemsWriteSyncController.ts`
- `ConflictDetectionService.ts`
- `PfaValidationService.ts`
- Unit tests (90% coverage)

---

### Phase 4.3: Sync Worker Development (Week 3)

**Deliverables**:
- `PemsWriteSyncWorker.ts`
- Queue management logic
- Enhanced retry service
- Dead letter queue handler
- Integration tests

---

### Phase 4.4: UI Development (Week 4)

**Deliverables**:
- `SyncStatusIndicator.tsx`
- `ConflictResolutionModal.tsx`
- `SyncHistoryDashboard.tsx`
- `RollbackModal.tsx`
- WebSocket integration

---

### Phase 4.5: Testing & QA (Week 5)

See [TEST_PLAN.md](./ADR-008-TEST_PLAN.md) for complete testing strategy.

---

### Phase 4.6: Deployment (Week 6)

**Day 1-2: Staging Deployment**
```bash
# Deploy to staging
git checkout phase-4
npm run build
pm2 deploy staging

# Run smoke tests
npm run test:e2e:staging

# Monitor for 48 hours
```

**Day 3-4: Production Deployment**
```bash
# Deploy to production
git tag v4.0.0
npm run deploy:production

# Monitor sync health
watch -n 5 'curl https://api/pems/sync-status'
```

**Day 5: Monitoring & Feedback**
- Monitor Grafana dashboards
- Review error logs
- Collect user feedback
- Address critical issues

---

## Dependencies

### External Dependencies

**PEMS API**:
- UPDATE endpoint documentation ✅ (confirmed)
- Rate limit specs: 10 req/sec ✅
- Test environment access ✅
- Version-based optimistic locking ✅

**Infrastructure**:
- PostgreSQL 14+ ✅ (deployed)
- Redis ✅ (deployed)
- Prometheus/Grafana ⏳ (Phase 4.5)

### Internal Dependencies

**Completed**:
- ✅ PfaMirror + PfaModification architecture (Phase 3)
- ✅ Optimistic locking with versioning (Enhancement 4)
- ✅ Retry service (Enhancement 4, Session 2)
- ✅ Permission system with `perm_Sync` (ADR-005)

---

## Success Metrics

### Key Performance Indicators

**Sync Performance**:
- Avg sync latency: < 2 minutes (Target)
- Sync success rate: > 99.9% (Target)
- Queue processing time: < 5 min for 1000 items (Target)

**User Experience**:
- Conflict resolution time: < 5 minutes (Target)
- User-reported sync issues: < 1% (Target)
- Sync status visibility: 100% (Target)

**Operational**:
- System uptime: > 99.95% (Target)
- Data consistency: 100% (Target)
- Audit trail completeness: 100% (Target)

---

**Next**: See [AGENT_WORKFLOW.md](./ADR-008-AGENT_WORKFLOW.md) for execution schedule (to be generated).
