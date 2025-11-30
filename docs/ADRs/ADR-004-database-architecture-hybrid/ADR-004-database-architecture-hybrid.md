# ADR-004: 3-Tier Hybrid Database Architecture for PFA Storage

**Status:** Accepted
**Date:** 2025-11-25
**Deciders:** Development Team
**Related:** PEMS Integration (ADR-003), Data Scale (1M+ records)

---

## Context

PFA Vanguard needs to store and manage millions of PFA (Plan-Forecast-Actual) records across multiple organizations with the following requirements:

### Scale Requirements
- **Current**: 1M+ PFA records across all organizations
- **Growth**: Continuously growing dataset (construction projects span years)
- **Performance**: Sub-100ms query response times for UI operations
- **Bi-directional Sync**: Read from PEMS Grid Data API + Write local changes back to PEMS
- **AI Integration**: Fast queries for AI assistant natural language commands

### Key Challenges
1. **Volume**: Millions of records make in-memory storage impractical
2. **Performance**: Timeline visualization, matrix views, and grid views require fast filtering
3. **Change Tracking**: Need to distinguish PEMS data vs. local edits for write-back sync
4. **Conflict Detection**: Handle cases where both PEMS and local data changed
5. **Sandbox Pattern**: Existing frontend uses ref-based state with undo/redo (no backend persistence yet)
6. **AI Queries**: Natural language queries like "Show rentals in Silo 4 over $5000" need structured data

### Constraints
- Must maintain compatibility with existing frontend sandbox pattern
- Cannot require full frontend rewrite
- Must support fast initial load (< 2 seconds)
- Must enable incremental sync (don't re-fetch all data every time)
- Must work with SQLite (dev) and PostgreSQL (prod)

---

## Decision

We will implement a **3-Tier Hybrid Architecture** combining database persistence, caching, and frontend state management:

```
┌─────────────────────────────────────────────────────────────┐
│  TIER 1: PostgreSQL Database (Source of Truth)             │
│  - Store ALL PFA records with proper indexing              │
│  - Track change state: pristine vs. modified vs. pending    │
│  - Composite index on (organizationId, updatedAt)           │
│  - Partial index on (organizationId WHERE modified=true)    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  TIER 2: Redis Cache (Hot Data Layer) - Phase 2            │
│  - Cache active org data (TTL: 15 min)                      │
│  - Cache AI query results (TTL: 5 min)                      │
│  - Cache modified records (no TTL until sync)               │
│  Key pattern: pfa:{orgId}:records, pfa:{orgId}:modified     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  TIER 3: React State (Active Session)                      │
│  - Load only visible records (~800-1000)                    │
│  - Sandbox pattern for uncommitted changes                  │
│  - Virtual scrolling for 20K+ record views                  │
└─────────────────────────────────────────────────────────────┘
```

### Change Tracking Fields

Add to `PfaRecord` Prisma model:

```prisma
// Change Tracking (for bi-directional sync)
syncState         String    @default("pristine") // pristine, modified, pending_sync, sync_error
lastSyncedAt      DateTime? // When last pushed to PEMS
pemsVersion       String?   // PEMS lastModified timestamp (for conflict detection)
localVersion      Int       @default(1) // Increment on every local edit

// Modified Fields Tracking (for incremental sync)
modifiedFields    String?   // JSON array: ["forecastStart", "forecastEnd"]
modifiedBy        String?   // User ID who made local changes
modifiedAt        DateTime? // When local changes were made

// Sync Error Handling
syncErrorMessage  String?
syncRetryCount    Int       @default(0)
```

### Sync State Machine

```
PEMS Read → pristine → User Edit → modified → Write to PEMS → pending_sync
                ↑                                                    ↓
                └────────── Success/Error ──────────────────────────┘
                                  ↓
                            sync_error (retry 3x)
```

### Database Indexing Strategy

```sql
-- Composite indexes for fast filtering
CREATE INDEX idx_pfa_org_category_source
  ON pfa_records(organizationId, category, source)
  WHERE isDiscontinued = false;

-- Date range queries
CREATE INDEX idx_pfa_org_dates
  ON pfa_records(organizationId, forecastStart, forecastEnd);

-- Modified records (for write sync)
CREATE INDEX idx_pfa_modified_pending
  ON pfa_records(organizationId, syncState)
  WHERE syncState IN ('modified', 'pending_sync');
```

---

## Consequences

### Positive

1. **Scalability**: Can handle 10M+ records without performance degradation
2. **Fast Queries**: Indexed queries return results in < 100ms
3. **Bi-directional Sync**: Change tracking enables write-back to PEMS
4. **Conflict Detection**: `pemsVersion` and `localVersion` prevent data loss
5. **AI Integration**: Structured data enables complex natural language queries
6. **Incremental Sync**: Only fetch changed records from PEMS
7. **Error Recovery**: Retry mechanism with sync_error state
8. **Audit Trail**: Track who changed what and when

### Negative

1. **Migration Complexity**: Need to migrate SQLite → PostgreSQL for production
2. **Schema Changes**: Requires Prisma migration and data backfill
3. **Frontend Changes**: Need to modify sandbox pattern to persist changes
4. **Additional Infrastructure**: Redis required for Tier 2 (Phase 2)
5. **Increased Complexity**: More moving parts (database + cache + frontend state)

### Neutral

1. **Storage Cost**: ~500 MB for 1M records (manageable)
2. **Development Time**: ~2 weeks for full implementation
3. **Testing Burden**: Need comprehensive tests for sync state machine

---

## Alternatives Considered

### Alternative 1: Pure In-Memory (No Database)

**Approach**: Fetch all PFA data from PEMS on every page load, keep in memory

**Pros**:
- Simple architecture
- No database management
- No schema changes

**Cons**:
- ❌ **REJECTED**: Initial load would take 30+ seconds for 1M records
- ❌ Lost local edits on page refresh
- ❌ Cannot track changes for write-back sync
- ❌ AI queries require full dataset scan (slow)

### Alternative 2: Database Only (No Caching)

**Approach**: Store in PostgreSQL, query directly on every request

**Pros**:
- Simpler than 3-tier approach
- No cache invalidation complexity
- Data always consistent

**Cons**:
- Query latency would be 200-500ms (too slow for timeline drag-and-drop)
- Database load would be very high (every timeline scroll = query)
- No benefit from repeated queries (AI assistant queries same data multiple times)

### Alternative 3: IndexedDB (Browser Storage)

**Approach**: Store PFA data in browser's IndexedDB

**Pros**:
- No backend database needed
- Fast local queries
- Offline support

**Cons**:
- ❌ **REJECTED**: 1M records would exceed browser storage limits (typically 50-100 MB)
- ❌ Sync state not shared across devices
- ❌ Complex synchronization logic
- ❌ AI assistant cannot access data server-side

### Alternative 4: Event Sourcing

**Approach**: Store only events (user actions), rebuild state on demand

**Pros**:
- Perfect audit trail
- Can replay history
- Small storage footprint

**Cons**:
- ❌ **REJECTED**: Rebuilding state for 1M records too slow
- ❌ Complex to implement
- ❌ PEMS integration doesn't fit event sourcing model
- ❌ Overkill for this use case

---

## Implementation Notes

### Phase 1: Database + Change Tracking (Current)

1. Add change tracking fields to Prisma schema
2. Generate migration: `npx prisma migrate dev --name add_change_tracking`
3. Update seed.ts to initialize syncState fields
4. Uncomment database persistence in PemsSyncService.ts
5. Add SyncLog creation and tracking
6. Implement conflict detection logic

**Estimated Time**: 2-3 days
**Risk**: Low (additive changes only)

### Phase 2: PostgreSQL Migration

1. Update `schema.prisma` datasource to PostgreSQL
2. Set up production PostgreSQL database
3. Create migration for SQLite → PostgreSQL data transfer
4. Add PostgreSQL-specific indexes (partial, GIN, BRIN)
5. Performance testing with production data volumes

**Estimated Time**: 3-5 days
**Risk**: Medium (data migration risk)

### Phase 3: Redis Caching Layer (Future)

1. Set up Redis infrastructure
2. Implement `RedisCacheService.ts`
3. Add cache warming on org switch
4. Implement cache invalidation on data changes
5. Add cache hit/miss metrics

**Estimated Time**: 5-7 days
**Risk**: Medium (cache invalidation complexity)

### Phase 4: Write-Back Sync

1. Create `PemsWriteService.ts`
2. Implement PEMS Write API integration
3. Map local PFA format to PEMS Grid Data format
4. Add conflict resolution UI
5. Comprehensive testing of round-trip sync

**Estimated Time**: 7-10 days
**Risk**: High (bi-directional sync always complex)

---

## Performance Benchmarks

**Target Performance** (with proper indexing):

| Operation | Current | Target | Phase 1 | Phase 2 | Phase 3 |
|-----------|---------|--------|---------|---------|---------|
| Filter by org + category | N/A | < 100ms | 80ms | 50ms | 10ms |
| Get modified records | N/A | < 50ms | 35ms | 20ms | 5ms |
| AI query (3 filters) | N/A | < 200ms | 150ms | 100ms | 30ms |
| Timeline render (1000 records) | 450ms | < 500ms | 420ms | 400ms | 350ms |
| Full org sync (60K records) | 15s | < 20s | 15s | 12s | 10s |

**Storage Estimates**:
- PostgreSQL: ~500 bytes/record × 1M = **500 MB**
- Redis cache: 10 active orgs × 50K records × 500 bytes = **250 MB**
- Total: **< 1 GB** (manageable for modern infrastructure)

---

## Related Decisions

- **[ADR-001] Sandbox Pattern**: Maintains compatibility with existing frontend architecture
- **[ADR-002] Multi-Organization Isolation**: Database design supports org-level data isolation
- **[ADR-003] PEMS Integration**: Read sync already working, write sync enabled by this decision

---

## References

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Performance Tips](https://www.postgresql.org/docs/current/performance-tips.html)
- [Redis Caching Patterns](https://redis.io/docs/manual/patterns/)
- CLAUDE.md - Database Architecture & Storage Strategy section

---

**Decision Made By**: Development Team
**Date**: 2025-11-25
**Approved By**: Project Lead
**Review Date**: 2026-02-01 (after Phase 2 completion)
