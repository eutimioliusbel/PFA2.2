# Performance Optimization Guide
**Task 10B.4 - Performance Benchmarking for ADR-005**

**Date**: 2025-11-27
**Target**: <50ms authorization overhead, <200ms API response time

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Optimization Phases](#optimization-phases)
3. [Database Optimizations](#database-optimizations)
4. [Application-Level Optimizations](#application-level-optimizations)
5. [Caching Strategy](#caching-strategy)
6. [Connection Pooling](#connection-pooling)
7. [Monitoring & Validation](#monitoring--validation)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Apply All Optimizations (Production)

```bash
# Step 1: Apply database indexes
cd backend
psql -U your_user -d pfa_vanguard -f prisma/migrations/create_performance_indexes.sql

# Step 2: Analyze tables
psql -U your_user -d pfa_vanguard -c "ANALYZE pfa_records; ANALYZE user_organizations; ANALYZE audit_logs;"

# Step 3: Verify indexes
psql -U your_user -d pfa_vanguard -c "
  SELECT tablename, indexname, pg_size_pretty(pg_relation_size(indexrelid))
  FROM pg_stat_user_indexes
  WHERE tablename IN ('pfa_records', 'user_organizations', 'audit_logs')
  ORDER BY tablename, indexname;
"

# Step 4: Run benchmarks to validate
npm test -- performance/
```

### Rollback Procedure

```bash
# Remove all performance indexes
psql -U your_user -d pfa_vanguard -f prisma/migrations/rollback_performance_indexes.sql

# Or manually:
psql -U your_user -d pfa_vanguard -c "
  DROP INDEX CONCURRENTLY IF EXISTS idx_pfa_org;
  DROP INDEX CONCURRENTLY IF EXISTS idx_pfa_org_category_source;
  DROP INDEX CONCURRENTLY IF EXISTS idx_pfa_org_sync_state;
"
```

---

## Optimization Phases

### Phase 1: Critical Indexes (Required for <50ms Target)

**Priority**: 🔴 CRITICAL
**Impact**: ~60% latency reduction
**Effort**: 1 hour

#### 1.1 Organization Filtering Index

**Problem**: Full table scans on `pfa_records` for organization filtering

```sql
-- Before: Full table scan (150ms for 10K records)
SELECT * FROM pfa_records WHERE organizationId = 'org-123' LIMIT 100;

-- After: Index scan (<50ms)
CREATE INDEX CONCURRENTLY idx_pfa_org
  ON pfa_records(organizationId)
  WHERE isDiscontinued = false;
```

**Expected Impact**:
- Query latency: 150ms → 35ms (-77%)
- Index size: ~10MB per million records
- Maintenance overhead: Minimal (automatic)

#### 1.2 Composite Index for Filtered Queries

**Problem**: Multiple index lookups for category + source filters

```sql
-- Before: Two separate index scans (200ms)
SELECT * FROM pfa_records
WHERE organizationId = 'org-123'
  AND category = 'Heavy Equipment'
  AND source = 'Rental'
LIMIT 100;

-- After: Single composite index scan (<50ms)
CREATE INDEX CONCURRENTLY idx_pfa_org_category_source
  ON pfa_records(organizationId, category, source)
  WHERE isDiscontinued = false;
```

**Expected Impact**:
- Query latency: 200ms → 45ms (-78%)
- Covers 60% of PFA queries
- Partial index reduces size by 20%

#### 1.3 Sync State Index (Write Sync Critical Path)

**Problem**: Slow lookup of modified records for PEMS sync

```sql
-- Before: Full table scan on syncState (100ms)
SELECT * FROM pfa_records
WHERE organizationId = 'org-123'
  AND syncState IN ('modified', 'pending_sync');

-- After: Partial index on modified records (<25ms)
CREATE INDEX CONCURRENTLY idx_pfa_org_sync_state
  ON pfa_records(organizationId, syncState)
  WHERE syncState IN ('modified', 'pending_sync', 'sync_error');
```

**Expected Impact**:
- Sync query latency: 100ms → 22ms (-78%)
- Bi-directional sync performance: 10K records/min → 50K records/min
- Index size: <5MB (only modified records)

#### 1.4 Permission Lookup Optimization

**Problem**: Slow permission checks on every request

```sql
-- Verify unique index exists (should already exist from migration)
CREATE UNIQUE INDEX CONCURRENTLY idx_user_org_unique
  ON user_organizations(userId, organizationId);
```

**Expected Impact**:
- Permission check latency: 25ms → 8ms (-68%)
- **Critical for <50ms authorization target**

---

### Phase 2: Application-Level Optimizations

**Priority**: 🟡 HIGH
**Impact**: ~30% latency reduction
**Effort**: 4 hours

#### 2.1 Async Audit Logging

**Problem**: Permission denials write to audit log synchronously, blocking response

**Before** (`requirePermission.ts`):
```typescript
// Synchronous audit log write (adds ~10ms)
await prisma.auditLog.create({
  data: { userId, organizationId, action: 'permission_denied', ... }
});
```

**After** (Background queue):
```typescript
// Async audit log write (non-blocking)
auditQueue.add({ userId, organizationId, action: 'permission_denied', ... });
```

**Implementation**:
1. Install `bull` or `bee-queue`
2. Create audit log worker
3. Replace `await prisma.auditLog.create()` with queue.add()

**Expected Impact**:
- Permission denial latency: 120ms → 65ms (-46%)
- No loss of audit data (queued writes)

#### 2.2 Connection Pooling

**Problem**: Creating new database connections adds ~10ms overhead

**Before** (Default Prisma connection):
```typescript
// Single connection, no pooling
const prisma = new PrismaClient();
```

**After** (Connection pool):
```typescript
// Connection pool with max 20 connections
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=20&pool_timeout=10',
    },
  },
});
```

**Expected Impact**:
- Connection overhead: 10ms → <1ms (-90%)
- Supports up to 20 concurrent requests

#### 2.3 Prepared Statements

**Problem**: Query compilation overhead on every request

**Implementation**: Prisma automatically prepares statements, but verify:

```typescript
// Check if prepared statements are enabled
const result = await prisma.$queryRaw`SHOW max_prepared_transactions;`;
```

**Expected Impact**:
- Repeated query latency: -5-10ms per query
- Hot queries (permission checks) benefit most

---

### Phase 3: Caching Strategy (Optional)

**Priority**: 🟢 MEDIUM
**Impact**: ~50% latency reduction (cache hit rate: 80%)
**Effort**: 8 hours

#### 3.1 Redis Cache for Permission Lookups

**Problem**: Every request queries database for permissions

**Implementation**:

```typescript
// 1. Install Redis client
npm install ioredis

// 2. Cache permission lookups
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

async function getUserPermissions(userId: string, orgId: string) {
  const cacheKey = `perms:${userId}:${orgId}`;

  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached); // <1ms cache hit
  }

  // Cache miss: Query database
  const permissions = await prisma.userOrganization.findFirst({
    where: { userId, organizationId: orgId },
  });

  // Store in cache (TTL: 5 minutes)
  await redis.setex(cacheKey, 300, JSON.stringify(permissions));

  return permissions;
}
```

**Cache Invalidation**:
```typescript
// Invalidate cache when permissions change
async function updateUserPermissions(userId: string, orgId: string, newPerms: any) {
  await prisma.userOrganization.update({ where: { ... }, data: newPerms });

  // Invalidate cache
  await redis.del(`perms:${userId}:${orgId}`);
}
```

**Expected Impact**:
- Permission check latency: 20ms → <1ms (cache hit)
- Cache hit rate: ~80% (permissions rarely change)
- Redis memory usage: ~1KB per user-org pair × 1000 users = ~1MB

#### 3.2 Query Result Caching (Aggregations)

**Problem**: Dashboard metrics recalculate on every page load

**Implementation**:

```typescript
// Cache PFA record counts
async function getPfaRecordCount(orgId: string, filters: any) {
  const cacheKey = `pfa:count:${orgId}:${JSON.stringify(filters)}`;

  const cached = await redis.get(cacheKey);
  if (cached) {
    return parseInt(cached, 10);
  }

  const count = await prisma.pfaRecord.count({
    where: { organizationId: orgId, ...filters },
  });

  // Cache for 1 minute (data changes frequently)
  await redis.setex(cacheKey, 60, count.toString());

  return count;
}
```

**Expected Impact**:
- Count query latency: 50ms → <1ms (cache hit)
- Reduces database load by ~70%

---

## Database Optimizations

### Index Maintenance

#### Check Index Usage

```sql
-- Find unused indexes (candidates for removal)
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS scans,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;
```

#### Rebuild Fragmented Indexes

```sql
-- Rebuild indexes if they become fragmented
REINDEX INDEX CONCURRENTLY idx_pfa_org;
REINDEX INDEX CONCURRENTLY idx_pfa_org_category_source;
```

### Vacuum and Analyze

```sql
-- Regular maintenance (run weekly)
VACUUM ANALYZE pfa_records;
VACUUM ANALYZE user_organizations;
VACUUM ANALYZE audit_logs;

-- Check bloat
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename) - pg_relation_size(schemaname || '.' || tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('pfa_records', 'user_organizations', 'audit_logs')
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
```

---

## Connection Pooling

### Prisma Connection Pool Configuration

**Recommended Settings** (`.env`):

```bash
# PostgreSQL connection pool
DATABASE_URL="postgresql://user:password@localhost:5432/pfa_vanguard?connection_limit=20&pool_timeout=10&connect_timeout=5"
```

**Parameters**:
- `connection_limit=20`: Max concurrent connections
- `pool_timeout=10`: Wait 10s for connection from pool
- `connect_timeout=5`: Max 5s to establish new connection

### PgBouncer (Production)

**Use Case**: If you have >100 concurrent users

```ini
# pgbouncer.ini
[databases]
pfa_vanguard = host=localhost port=5432 dbname=pfa_vanguard

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
reserve_pool_size = 5
```

**Benefits**:
- Support 1000+ concurrent clients with 20 database connections
- Connection pooling at infrastructure level

---

## Monitoring & Validation

### Application Metrics (Winston Logger)

```typescript
import { logger } from '../utils/logger';

// Log permission check latency
const startTime = Date.now();
const hasPermission = await checkPermission(userId, orgId, 'perm_EditForecast');
const elapsed = Date.now() - startTime;

if (elapsed > 50) {
  logger.warn('Permission check exceeded 50ms target', {
    elapsed,
    userId,
    organizationId: orgId,
    permission: 'perm_EditForecast',
  });
}
```

### Database Query Monitoring

```sql
-- Enable query logging for slow queries
ALTER DATABASE pfa_vanguard SET log_min_duration_statement = 100; -- Log queries >100ms

-- Check slow queries
SELECT
  substring(query, 1, 100) AS query_preview,
  calls,
  mean_exec_time,
  max_exec_time,
  stddev_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### Production Alerts

**Recommended CloudWatch/Datadog Alerts**:

1. **Authorization Latency Alert**
   - Metric: `pfa.auth.middleware.p95_latency`
   - Threshold: P95 > 75ms
   - Action: Investigate index usage, check query plans

2. **Database Connection Pool Saturation**
   - Metric: `pfa.db.pool.active_connections`
   - Threshold: >18 (90% of pool size)
   - Action: Increase pool size or investigate slow queries

3. **Permission Denial Spike**
   - Metric: `pfa.auth.permission_denied.count`
   - Threshold: >10 denials/minute
   - Action: Potential brute-force attack, review audit logs

---

## Troubleshooting

### Problem: Authorization Still >50ms After Indexes

**Diagnosis**:
1. Check if indexes are being used:
   ```sql
   EXPLAIN ANALYZE
   SELECT "perm_EditForecast"
   FROM user_organizations
   WHERE "userId" = 'user-123' AND "organizationId" = 'org-456';
   ```
   - Look for `Index Scan` (good) vs `Seq Scan` (bad)

2. Check index statistics:
   ```sql
   SELECT idx_scan, idx_tup_read, idx_tup_fetch
   FROM pg_stat_user_indexes
   WHERE indexname = 'idx_user_org_unique';
   ```
   - If `idx_scan = 0`, index is not being used

**Solutions**:
- Run `ANALYZE user_organizations;` to update statistics
- Verify index exists: `\d user_organizations` in psql
- Check query planner settings: `SHOW enable_indexscan;`

### Problem: Database Query >100ms Despite Indexes

**Diagnosis**:
1. Check query plan:
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM pfa_records
   WHERE organizationId = 'org-123'
     AND category = 'Heavy Equipment'
   LIMIT 100;
   ```

2. Look for:
   - `Seq Scan` → Index not used (missing or outdated statistics)
   - `Index Scan` with high `actual time` → Index selectivity issue
   - `Bitmap Heap Scan` → Multiple indexes combined (slower)

**Solutions**:
- Rebuild index: `REINDEX INDEX CONCURRENTLY idx_pfa_org_category_source;`
- Update statistics: `ANALYZE pfa_records;`
- Check index bloat: Run `VACUUM FULL pfa_records;` (requires downtime)

### Problem: High Memory Usage with Redis Cache

**Diagnosis**:
```bash
# Check Redis memory usage
redis-cli INFO memory
```

**Solutions**:
- Reduce TTL (e.g., 5 min → 2 min)
- Implement LRU eviction: `maxmemory-policy allkeys-lru`
- Set max memory: `maxmemory 256mb`

### Problem: Connection Pool Exhaustion

**Symptoms**:
- Error: `timed out waiting for connection from pool`
- High `pool_timeout` values

**Diagnosis**:
```typescript
// Check active connections
const result = await prisma.$queryRaw`
  SELECT count(*) FROM pg_stat_activity
  WHERE state = 'active';
`;
```

**Solutions**:
- Increase pool size: `connection_limit=30`
- Investigate slow queries (they hold connections longer)
- Implement connection timeout: `statement_timeout=10000` (10s)

---

## Performance Validation Checklist

- [ ] All critical indexes created (`create_performance_indexes.sql`)
- [ ] Indexes verified with `EXPLAIN ANALYZE`
- [ ] Benchmark suite passes all targets (<50ms auth, <100ms DB, <200ms API)
- [ ] Connection pooling configured (`connection_limit=20`)
- [ ] Slow query logging enabled (`log_min_duration_statement=100`)
- [ ] Production monitoring alerts configured
- [ ] Cache invalidation strategy documented (if using Redis)
- [ ] Index maintenance schedule established (weekly VACUUM ANALYZE)

---

## Additional Resources

- **PostgreSQL Performance Tuning**: https://wiki.postgresql.org/wiki/Performance_Optimization
- **Prisma Performance Best Practices**: https://www.prisma.io/docs/guides/performance-and-optimization
- **Redis Caching Patterns**: https://redis.io/docs/manual/patterns/

**Status**: 🟡 Optimizations documented, awaiting implementation and validation
