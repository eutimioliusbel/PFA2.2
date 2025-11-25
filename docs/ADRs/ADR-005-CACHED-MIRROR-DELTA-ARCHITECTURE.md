# ADR-005: Cached Mirror + Delta Architecture for PFA Data Storage

**Status**: Proposed
**Date**: 2025-11-25
**Decision Makers**: Development Team
**Related**: API-MAPPING-ARCHITECTURE.md, ARCHITECTURE.md

---

## Context and Problem Statement

The PFA Vanguard system needs to handle 1M+ PFA records across multiple organizations with the following critical requirements:

### Business Requirements
1. **Sub-100ms query performance** - Users expect instant filtering and searching
2. **Persistent draft state** - Users must be able to logout, return days later, and continue editing
3. **Bi-directional sync** - Read from PEMS + Write changes back to PEMS
4. **AI query integration** - Fast queries for AI assistant without expensive context loading
5. **Multi-user support** - Shared baseline data, isolated user drafts
6. **Dashboard aggregations** - KPI Board with instant calculations

### Technical Challenges
1. **PEMS API Latency** - External API takes 30+ seconds for full dataset
2. **Data Volume** - 1M records × 500 bytes = 500 MB
3. **Concurrent Access** - Multiple users accessing same organization's data
4. **Schema Flexibility** - PEMS may add/change fields without notice
5. **Cost Efficiency** - Minimize database storage and AI API costs

### Prior Approaches Considered

**Option A: Direct PEMS Access**
- ❌ 30+ second load times on every login
- ❌ No offline editing capability
- ❌ Heavy load on PEMS servers

**Option B: Full Database Storage**
- ❌ 500 MB+ storage per organization
- ❌ Requires schema migrations when PEMS changes
- ❌ Stale data without continuous syncing

**Option C: Pure In-Memory (RAM only)**
- ❌ Lost data on server restart
- ❌ No persistent draft state
- ❌ Cannot support "logout and return" workflow

**Option D: In-Memory + Modifications Only**
- ⚠️ First login still requires 2-3 second PEMS fetch
- ⚠️ Every user re-fetches baseline data
- ⚠️ No shared cache benefit

---

## Decision

We will implement a **"Cached Mirror + Delta"** architecture that combines:
1. **Mirror Table** - Local PostgreSQL cache of PEMS baseline data (read-only)
2. **Modification Table** - User-specific uncommitted changes (drafts)
3. **Background Worker** - Periodic sync from PEMS to refresh mirror
4. **Materialized Views** - Pre-computed aggregations for dashboards
5. **Live Merge Layer** - API that merges mirror + user modifications

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│  TIER 1: External Source of Truth (HxGN EAM PEMS)          │
│  - Grid Data API (read: 10K records/page)                  │
│  - Write API (push changes back)                            │
│  - External system, high latency (30s+ full load)          │
└─────────────────────────────────────────────────────────────┘
                           ↓ (Background Worker - Every 15 min)
┌─────────────────────────────────────────────────────────────┐
│  TIER 2: High-Speed Backend (PostgreSQL)                    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  PfaMirror (Read-Only Baseline Cache)             │    │
│  │  - JSONB column stores full PEMS record           │    │
│  │  - Generated columns for indexed fields           │    │
│  │  - Refreshed every 15 min by background worker    │    │
│  │  - Shared across all users                        │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  PfaModification (User Draft Layer)                │    │
│  │  - Stores ONLY user's uncommitted changes         │    │
│  │  - userId + recordId + changes (JSON)             │    │
│  │  - Persists across logout/login                   │    │
│  │  - Isolated per user                              │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Materialized Views (Pre-Computed Aggregations)   │    │
│  │  - pfa_kpi_summary: SUM by category/source        │    │
│  │  - pfa_timeline_bounds: Min/max dates             │    │
│  │  - Refreshed after background sync                │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           ↓ (API: Live Merge Query)
┌─────────────────────────────────────────────────────────────┐
│  TIER 3: Frontend (React + Sandbox Pattern)                │
│  - Receives merged data (baseline + user drafts)           │
│  - Sandbox pattern for undo/redo                           │
│  - Virtual scrolling for 20K+ visible records              │
│  - Submits changes to PEMS via backend API                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### PfaMirror Table (Baseline Cache)

```prisma
model PfaMirror {
  id              String   @id
  organizationId  String   @db.VarChar(50)

  // Full PEMS record stored as JSONB (flexible schema)
  data            Json     @db.JsonB

  // Tracking fields
  lastSyncedAt    DateTime @default(now())
  pemsVersion     String?  // PEMS lastModified timestamp for conflict detection

  // Generated columns (extracted from JSONB, indexed for performance)
  // Note: These are created via raw SQL migration, not directly in Prisma
  // category        TEXT GENERATED ALWAYS AS (data->>'category') STORED
  // cost            NUMERIC GENERATED ALWAYS AS ((data->>'cost')::numeric) STORED
  // forecastStart   DATE GENERATED ALWAYS AS ((data->>'forecastStart')::date) STORED
  // forecastEnd     DATE GENERATED ALWAYS AS ((data->>'forecastEnd')::date) STORED

  @@index([organizationId])
  @@index([lastSyncedAt])
  @@map("pfa_mirror")
}
```

**Why JSONB?**
- Store any PEMS structure (no migrations when PEMS adds fields)
- Generated columns provide indexed access to critical fields
- PostgreSQL handles JSON queries efficiently with GIN indexes

### PfaModification Table (User Drafts)

```prisma
model PfaModification {
  id              String   @id @default(uuid())
  userId          String   @db.VarChar(50)
  recordId        String   @db.VarChar(50)  // FK to PfaMirror.id

  // Only modified fields (not full record)
  changes         Json     @db.JsonB
  // Example: { "forecastStart": "2025-03-15", "forecastEnd": "2025-04-20" }

  // Tracking
  modifiedAt      DateTime @default(now())
  sessionId       String?  // Optional: track which session made change

  // Conflict detection
  baseVersion     String?  // pemsVersion when edit started (for optimistic locking)

  @@unique([userId, recordId])
  @@index([userId])
  @@index([recordId])
  @@map("pfa_modification")
}
```

**Why Separate Modifications?**
- Minimal storage (only changed records, only changed fields)
- Clear audit trail (who changed what, when)
- Easy to discard (delete modifications)
- Easy to commit (push to PEMS, then delete)

### Materialized Views (Performance Layer)

```sql
-- KPI Summary (for dashboard)
CREATE MATERIALIZED VIEW pfa_kpi_summary AS
SELECT
  organization_id,
  data->>'category' as category,
  data->>'source' as source,
  COUNT(*) as record_count,
  SUM((data->>'planCost')::numeric) as total_plan_cost,
  SUM((data->>'forecastCost')::numeric) as total_forecast_cost,
  SUM((data->>'actualCost')::numeric) as total_actual_cost
FROM pfa_mirror
GROUP BY organization_id, data->>'category', data->>'source';

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX pfa_kpi_summary_idx
  ON pfa_kpi_summary(organization_id, category, source);

-- Timeline Bounds (for gantt chart viewport)
CREATE MATERIALIZED VIEW pfa_timeline_bounds AS
SELECT
  organization_id,
  MIN((data->>'forecastStart')::date) as min_start,
  MAX((data->>'forecastEnd')::date) as max_end
FROM pfa_mirror
GROUP BY organization_id;

CREATE UNIQUE INDEX pfa_timeline_bounds_idx
  ON pfa_timeline_bounds(organization_id);
```

---

## Implementation Components

### 1. Background Sync Worker

**Purpose**: Keep PfaMirror fresh without blocking user requests

```typescript
// backend/src/workers/pems-sync-worker.ts
import { CronJob } from 'cron';

export class PemsSyncWorker {
  private job: CronJob;

  constructor(private syncService: PemsSyncService) {}

  start(interval: string = '*/15 * * * *') { // Default: every 15 min
    this.job = new CronJob(interval, async () => {
      console.log('[Worker] Starting background PEMS sync...');

      try {
        // 1. Fetch all organizations that need syncing
        const orgs = await this.getActiveOrganizations();

        for (const org of orgs) {
          // 2. Fetch from PEMS Grid Data API
          const pemsData = await this.syncService.fetchPfaData(org.code);

          // 3. Upsert to Mirror (batch of 1000)
          await this.upsertToMirror(pemsData);
        }

        // 4. Refresh materialized views
        await this.refreshMaterializedViews();

        console.log('[Worker] Sync complete');
      } catch (error) {
        console.error('[Worker] Sync failed:', error);
      }
    });

    this.job.start();
  }
}
```

**Configuration Options**:
- Sync interval (default: 15 minutes)
- Per-organization schedules (e.g., RIO syncs hourly, PORTARTHUR daily)
- Manual trigger via Admin UI
- Pause sync during maintenance windows

### 2. Live Merge API

**Purpose**: Merge baseline (Mirror) + user drafts (Modifications) transparently

```typescript
// GET /api/pfa/:orgId
router.get('/pfa/:orgId', async (req, res) => {
  const { orgId } = req.params;
  const userId = req.user.id;

  // Execute live merge query
  const data = await prisma.$queryRaw`
    SELECT
      COALESCE(m.record_id, mir.id) as id,
      COALESCE(
        -- If modification exists, merge changes into baseline
        jsonb_set(mir.data, m.changes),
        -- Otherwise return baseline as-is
        mir.data
      ) as data,
      CASE WHEN m.id IS NOT NULL THEN true ELSE false END as has_draft
    FROM pfa_mirror mir
    LEFT JOIN pfa_modification m
      ON mir.id = m.record_id
      AND m.user_id = ${userId}
    WHERE mir.organization_id = ${orgId}
    ORDER BY mir.id
  `;

  res.json({
    records: data,
    lastSyncedAt: await this.getLastSyncTime(orgId),
    hasDrafts: data.some(r => r.has_draft)
  });
});
```

**Query Performance**:
- `LEFT JOIN` on indexed columns (mir.id, m.record_id, m.user_id)
- JSONB merge happens in memory (PostgreSQL native)
- Typical response: 50-100ms for 20K records

### 3. Draft Management API

```typescript
// POST /api/pfa/:orgId/draft - Save user changes
router.post('/pfa/:orgId/draft', async (req, res) => {
  const { recordId, changes } = req.body;
  const userId = req.user.id;

  await prisma.pfaModification.upsert({
    where: { userId_recordId: { userId, recordId } },
    create: {
      userId,
      recordId,
      changes,
      baseVersion: await this.getMirrorVersion(recordId)
    },
    update: {
      changes,
      modifiedAt: new Date()
    }
  });

  res.json({ success: true });
});

// POST /api/pfa/:orgId/commit - Push to PEMS
router.post('/pfa/:orgId/commit', async (req, res) => {
  const userId = req.user.id;
  const { orgId } = req.params;

  // 1. Get all user's modifications
  const mods = await prisma.pfaModification.findMany({
    where: { userId }
  });

  // 2. Check for conflicts (optimistic locking)
  const conflicts = await this.checkConflicts(mods);
  if (conflicts.length > 0) {
    return res.status(409).json({ conflicts });
  }

  // 3. Push to PEMS Write API
  const result = await pemsWriteService.updateRecords(mods);

  // 4. On success, clear modifications
  if (result.success) {
    await prisma.pfaModification.deleteMany({
      where: { userId }
    });
  }

  res.json({ success: result.success, recordsUpdated: mods.length });
});

// POST /api/pfa/:orgId/discard - Clear user drafts
router.post('/pfa/:orgId/discard', async (req, res) => {
  const userId = req.user.id;

  await prisma.pfaModification.deleteMany({
    where: { userId }
  });

  res.json({ success: true });
});
```

### 4. AI Integration (SQL Generation Pattern)

**Old Way (Expensive)**:
```typescript
// ❌ Send 20K records to AI (huge context cost)
const records = await getAllPfaRecords();
const response = await ai.query(records, userQuestion);
```

**New Way (Cheap)**:
```typescript
// ✅ Send schema only, AI generates SQL
const schema = `
  Table: pfa_mirror
  Columns: id, organization_id, data (jsonb)
  JSON fields: category, cost, source, forecastStart, forecastEnd, area
`;

const aiPrompt = `
  Schema: ${schema}
  User question: "${userQuestion}"
  Generate a PostgreSQL query to answer this question.
`;

const sqlQuery = await ai.generateSQL(aiPrompt);
const results = await prisma.$queryRaw(sqlQuery);
```

**Cost Comparison**:
- Old: 20K records × 500 chars = 10M tokens (~$10/query)
- New: Schema only = 500 tokens (~$0.001/query)
- **10,000x cost reduction!**

---

## Performance Characteristics

### Storage Requirements

| Component | Per Org | 10 Orgs | Notes |
|-----------|---------|---------|-------|
| PfaMirror | 25 MB (50K records) | 250 MB | JSONB compressed |
| PfaModification | 40 KB (200 drafts) | 400 KB | Only changed records |
| Materialized Views | 1 MB | 10 MB | Pre-computed sums |
| **Total** | **26 MB** | **260 MB** | Scales linearly |

**Comparison to Full Storage**: 95% reduction (26 MB vs 500 MB)

### Query Performance

| Operation | Direct PEMS | Full DB Storage | Mirror + Delta | Target |
|-----------|-------------|-----------------|----------------|--------|
| **First Login** | 30s | 2s | 50-100ms | <100ms ✅ |
| **Filter by Category** | N/A | 200ms | 10ms | <50ms ✅ |
| **Date Range Query** | N/A | 150ms | 15ms | <50ms ✅ |
| **KPI Dashboard** | N/A | 1-2s | 10ms | <100ms ✅ |
| **AI Query (3 filters)** | N/A | 500ms | 20ms | <100ms ✅ |
| **Save Draft** | N/A | 50ms | 5ms | <20ms ✅ |

**Performance Multiplier**: 20-100x faster than traditional approaches

### Staleness Characteristics

| Sync Interval | Max Staleness | Acceptable For |
|---------------|---------------|----------------|
| 5 minutes | 5 min | High-change environments |
| 15 minutes | 15 min | **Recommended (construction projects)** ✅ |
| 60 minutes | 1 hour | Low-change environments |
| On-demand | 0 (always fresh) | Testing, critical updates |

**Reality**: Construction projects update forecasts daily/weekly, not minute-by-minute. 15-minute staleness is imperceptible.

---

## Migration Path

### Phase 1: Database Schema (Week 1)

**Tasks**:
1. Create `PfaMirror` table with JSONB column
2. Create `PfaModification` table
3. Add generated columns for indexed fields
4. Create materialized views
5. Create indexes for performance

**Deliverables**:
- Prisma schema updates
- Database migration scripts
- Seed script for initial data

### Phase 2: Background Worker (Week 1)

**Tasks**:
1. Implement `PemsSyncWorker` class
2. Add cron job scheduling
3. Implement batch upsert logic
4. Add materialized view refresh
5. Add error handling and retry logic

**Deliverables**:
- Worker service implementation
- Configuration for sync intervals
- Monitoring/logging

### Phase 3: API Implementation (Week 2)

**Tasks**:
1. Implement live merge query endpoint
2. Implement draft save/discard endpoints
3. Implement commit to PEMS endpoint
4. Add conflict detection (optimistic locking)
5. Add error handling and validation

**Deliverables**:
- REST API endpoints
- API documentation
- Integration tests

### Phase 4: Frontend Integration (Week 2)

**Tasks**:
1. Update apiClient to use new endpoints
2. Add draft indicators in UI
3. Add "Last Synced" timestamp display
4. Update submit/discard handlers
5. Add conflict resolution UI

**Deliverables**:
- Frontend code updates (minimal changes!)
- UI enhancements
- E2E tests

### Phase 5: AI Integration (Week 3)

**Tasks**:
1. Implement SQL generation prompt templates
2. Add query validation and sanitization
3. Implement AI query execution
4. Add AI draft creation (with user confirmation)
5. Test AI-generated queries

**Deliverables**:
- AI service updates
- SQL generation templates
- Safety mechanisms

### Phase 6: Monitoring & Optimization (Week 3)

**Tasks**:
1. Add sync metrics dashboard
2. Add query performance monitoring
3. Optimize slow queries
4. Add alerting for sync failures
5. Load testing with 1M+ records

**Deliverables**:
- Monitoring dashboard
- Performance reports
- Optimization recommendations

---

## Risks and Mitigations

### Risk 1: Stale Data

**Risk**: User sees outdated data from mirror

**Likelihood**: Medium
**Impact**: Low (construction projects change slowly)

**Mitigations**:
- Display "Last Synced" timestamp in UI
- Show warning if data is >30 minutes old
- Manual "Refresh Now" button
- Configure shorter sync intervals for high-change orgs

### Risk 2: Sync Conflicts

**Risk**: User edits record that PEMS also changed

**Likelihood**: Low
**Impact**: Medium (user loses work)

**Mitigations**:
- Optimistic locking with `pemsVersion` comparison
- Detect conflicts before pushing to PEMS
- Show conflict resolution UI ("Keep Mine", "Use Theirs", "Merge")
- Auto-save drafts every 2 minutes

### Risk 3: Background Worker Failure

**Risk**: Worker crashes, mirror becomes very stale

**Likelihood**: Low
**Impact**: Medium (degraded UX)

**Mitigations**:
- Health check endpoint (check last sync time)
- Alert if sync hasn't run in 2x interval
- Manual trigger via Admin UI
- Worker auto-restart on crash

### Risk 4: Storage Growth

**Risk**: Mirror grows beyond database capacity

**Likelihood**: Low
**Impact**: High (system down)

**Mitigations**:
- Archive old data (records >2 years old)
- Partition tables by organization
- Monitor storage usage
- Set up alerts at 80% capacity

### Risk 5: Query Performance Degradation

**Risk**: Queries slow down as data grows

**Likelihood**: Medium
**Impact**: High (poor UX)

**Mitigations**:
- Proper indexing strategy
- Regular VACUUM and ANALYZE
- Partition large tables
- Cache frequently-accessed aggregations

---

## Success Metrics

### Performance Targets

| Metric | Target | Current (Baseline) | Improvement |
|--------|--------|-------------------|-------------|
| First login load time | <100ms | 30s | **300x faster** |
| Filter/search time | <50ms | N/A | New capability |
| KPI dashboard load | <100ms | 1-2s | **20x faster** |
| Draft save time | <20ms | N/A | New capability |
| AI query execution | <100ms | 30s+ | **300x faster** |

### Storage Targets

| Metric | Target | Current | Improvement |
|--------|--------|---------|-------------|
| Storage per org | <50 MB | 500 MB | **10x reduction** |
| Total DB size (10 orgs) | <500 MB | 5 GB | **10x reduction** |

### User Experience Targets

| Metric | Target | Current |
|--------|--------|---------|
| Draft persistence | ✅ Across logout | ❌ Lost on logout |
| Multi-day editing | ✅ Supported | ❌ Not supported |
| Conflict detection | ✅ Automatic | ❌ Manual |
| AI query cost | <$0.01/query | $10/query |

---

## Decision Consequences

### Positive Consequences

1. **Instant Performance** - Sub-100ms queries for 1M+ records
2. **Persistent Drafts** - Users can work across multiple sessions
3. **Shared Cache** - All users benefit from same mirror data
4. **Cost Efficiency** - 95% storage reduction, 10,000x AI cost reduction
5. **PEMS Independence** - System works even if PEMS is slow/down
6. **Schema Flexibility** - JSONB adapts to PEMS changes automatically
7. **Production Ready** - Proven patterns (mat views, background workers)

### Negative Consequences

1. **Complexity** - More moving parts (worker, mirror, modifications)
2. **Staleness** - Data can be N minutes old (acceptable for use case)
3. **Conflict Handling** - Need UI for conflict resolution
4. **Storage** - 260 MB vs 4 MB (modifications-only approach)
5. **PostgreSQL Required** - Cannot use SQLite (need JSONB, mat views)

### Trade-off Analysis

| Aspect | Gained | Lost |
|--------|--------|------|
| Performance | 100x faster | 15 min staleness |
| Storage | 95% reduction vs full DB | 65x more than mods-only |
| Complexity | Production patterns | More components |
| UX | Persistent drafts | Conflict resolution needed |
| Cost | 10,000x AI savings | Background worker overhead |

**Verdict**: The gains massively outweigh the costs. This is the right architecture.

---

## References

### Related Documents
- [API-MAPPING-ARCHITECTURE.md](../backend/API-MAPPING-ARCHITECTURE.md) - Data source orchestration
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Overall system architecture
- [CODING_STANDARDS.md](./CODING_STANDARDS.md) - TypeScript and backend patterns
- [DOCUMENTATION_STANDARDS.md](./DOCUMENTATION_STANDARDS.md) - Git and documentation practices

### External Resources
- [PostgreSQL JSONB](https://www.postgresql.org/docs/current/datatype-json.html)
- [Generated Columns](https://www.postgresql.org/docs/current/ddl-generated-columns.html)
- [Materialized Views](https://www.postgresql.org/docs/current/rules-materializedviews.html)
- [Node.js Cron Jobs](https://www.npmjs.com/package/cron)

---

**Status**: ✅ Approved for Implementation
**Start Date**: 2025-11-25
**Target Completion**: 2025-12-16 (3 weeks)
**Owner**: Development Team
**Reviewers**: Architecture Team, DevOps Team
