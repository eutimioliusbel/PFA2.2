# PostgreSQL Optimization Guide for PFA Vanguard

Performance optimization strategies for PostgreSQL after migration.

## Connection Pooling

### Prisma Connection Pool Settings

PostgreSQL has a default connection limit of 100. Configure Prisma to use optimal pool size.

**Update .env**:
```env
# PostgreSQL connection string with pool settings
DATABASE_URL="postgresql://pfa_user:password@localhost:5432/pfa_vanguard?schema=public&connection_limit=20&pool_timeout=30"
```

**Connection pool parameters**:
- `connection_limit=20` - Maximum connections (reserve 80 for other clients)
- `pool_timeout=30` - Timeout in seconds for acquiring connection

### Connection Pool Configuration by Environment

**Development** (single developer):
```env
DATABASE_URL="postgresql://...?connection_limit=5&pool_timeout=10"
```

**Staging** (10-20 concurrent users):
```env
DATABASE_URL="postgresql://...?connection_limit=10&pool_timeout=20"
```

**Production** (100+ concurrent users):
```env
DATABASE_URL="postgresql://...?connection_limit=30&pool_timeout=30"
```

### Calculate Optimal Pool Size

Formula: `connections = (core_count × 2) + effective_spindle_count`

**Examples**:
- 4-core server with SSD: `(4 × 2) + 1 = 9` connections
- 8-core server with SSD: `(8 × 2) + 1 = 17` connections
- 16-core server with SSD: `(16 × 2) + 1 = 33` connections

**Rule of thumb**: Start with 10-20, increase if you see connection timeout errors.

---

## Query Optimization

### Create Performance Indexes

After migration, create additional indexes for common queries:

```sql
-- Connect to database
psql $DATABASE_URL

-- PFA record queries (high cardinality filters)
CREATE INDEX CONCURRENTLY idx_pfa_org_area_category
  ON pfa_records(organizationId, areaSilo, category)
  WHERE isDiscontinued = false;

CREATE INDEX CONCURRENTLY idx_pfa_org_source_dor
  ON pfa_records(organizationId, source, dor)
  WHERE isDiscontinued = false;

-- Date range queries (Timeline view)
CREATE INDEX CONCURRENTLY idx_pfa_forecast_dates
  ON pfa_records(organizationId, forecastStart, forecastEnd);

CREATE INDEX CONCURRENTLY idx_pfa_actual_dates
  ON pfa_records(organizationId, actualStart, actualEnd)
  WHERE hasActuals = true;

-- Modified records (for write sync)
CREATE INDEX CONCURRENTLY idx_pfa_pending_sync
  ON pfa_records(organizationId, syncState, modifiedAt)
  WHERE syncState IN ('modified', 'pending_sync');

-- AI usage logs (recent queries)
CREATE INDEX CONCURRENTLY idx_ai_usage_recent
  ON ai_usage_logs(organizationId, createdAt DESC)
  INCLUDE (provider, model, costUsd);

-- AI semantic cache
CREATE INDEX CONCURRENTLY idx_ai_cache_lookup
  ON ai_usage_logs(queryHash, createdAt DESC)
  WHERE success = true;

-- Sync logs (recent syncs)
CREATE INDEX CONCURRENTLY idx_sync_logs_recent
  ON sync_logs(organizationId, createdAt DESC, status);

-- Analyze tables after creating indexes
ANALYZE pfa_records;
ANALYZE ai_usage_logs;
ANALYZE sync_logs;
```

**Why CONCURRENTLY?** Doesn't block writes during index creation (important for production).

### Index Maintenance

Monitor index usage and remove unused indexes:

```sql
-- Show index usage statistics
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

-- Remove unused indexes (only if idx_scan = 0 after monitoring for 1+ week)
-- DROP INDEX CONCURRENTLY idx_name;
```

### Query Performance Monitoring

Enable slow query logging:

**PostgreSQL config** (`postgresql.conf`):
```conf
# Log queries slower than 100ms
log_min_duration_statement = 100

# Log all queries (development only)
# log_statement = 'all'

# Log query execution plans for slow queries
auto_explain.log_min_duration = 500
```

**Prisma query logging** (development):

Edit `backend/src/config/database.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'warn', emit: 'stdout' },
    { level: 'error', emit: 'stdout' },
  ],
});

// Log slow queries
prisma.$on('query', (e: any) => {
  if (e.duration > 100) {
    console.log(`🐌 Slow Query (${e.duration}ms): ${e.query.substring(0, 100)}...`);
    console.log(`   Params: ${e.params}`);
  }
});
```

---

## Database Configuration

### PostgreSQL Settings for PFA Vanguard

**For databases with <1GB RAM** (development):
```conf
# Memory
shared_buffers = 128MB
effective_cache_size = 512MB
maintenance_work_mem = 64MB
work_mem = 4MB

# Parallelism
max_parallel_workers_per_gather = 2
max_parallel_workers = 2

# WAL
checkpoint_completion_target = 0.9
```

**For databases with 4GB RAM** (staging):
```conf
# Memory
shared_buffers = 1GB
effective_cache_size = 3GB
maintenance_work_mem = 256MB
work_mem = 16MB

# Parallelism
max_parallel_workers_per_gather = 2
max_parallel_workers = 4

# WAL
checkpoint_completion_target = 0.9
wal_buffers = 16MB
```

**For databases with 16GB RAM** (production):
```conf
# Memory
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
work_mem = 32MB

# Parallelism
max_parallel_workers_per_gather = 4
max_parallel_workers = 8

# WAL
checkpoint_completion_target = 0.9
wal_buffers = 16MB
```

**How to apply**:

**Local PostgreSQL**:
```bash
# Find config file
psql -U postgres -c "SHOW config_file;"

# Edit config
sudo nano /path/to/postgresql.conf

# Restart PostgreSQL
sudo systemctl restart postgresql
```

**Docker PostgreSQL**:
```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:15-alpine
    command:
      - "postgres"
      - "-c"
      - "shared_buffers=1GB"
      - "-c"
      - "effective_cache_size=3GB"
      - "-c"
      - "maintenance_work_mem=256MB"
      - "-c"
      - "work_mem=16MB"
```

**AWS RDS**: Configure via Parameter Groups in AWS Console

**Azure/GCP**: Configure via Cloud Console settings

---

## VACUUM and ANALYZE

PostgreSQL requires regular maintenance to keep performance optimal.

### Automatic VACUUM

PostgreSQL runs autovacuum by default, but tune for PFA Vanguard workload:

```conf
# Enable autovacuum (should be on by default)
autovacuum = on

# Be more aggressive for tables with frequent updates
autovacuum_vacuum_scale_factor = 0.1  # Default: 0.2 (vacuum when 10% of rows change)
autovacuum_analyze_scale_factor = 0.05  # Default: 0.1 (analyze when 5% change)

# For PFA records table (frequent updates)
ALTER TABLE pfa_records SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE pfa_records SET (autovacuum_analyze_scale_factor = 0.02);
```

### Manual VACUUM (for maintenance windows)

```sql
-- Full vacuum (reclaims space, slower)
VACUUM FULL pfa_records;

-- Regular vacuum (faster, doesn't block reads)
VACUUM pfa_records;

-- Analyze statistics (fast)
ANALYZE pfa_records;

-- Vacuum all tables
VACUUM ANALYZE;
```

**Schedule**: Run `VACUUM ANALYZE` weekly during off-peak hours.

---

## Transaction Isolation Levels

Choose appropriate isolation level for different operations:

### Default: READ COMMITTED

Good for most operations (PFA reads, updates, dashboard queries).

```typescript
// Prisma uses READ COMMITTED by default
const pfaRecords = await prisma.pfaRecord.findMany({
  where: { organizationId }
});
```

### SERIALIZABLE for Critical Operations

Use for financial calculations where consistency is critical:

```typescript
// Ensure consistent totals calculation
await prisma.$transaction(
  async (tx) => {
    // Calculate totals
    const planTotal = await tx.pfaRecord.aggregate({
      where: { organizationId },
      _sum: { planCost: true }
    });

    // Update summary table
    await tx.costSummary.upsert({
      where: { organizationId },
      update: { planTotal: planTotal._sum.planCost },
      create: { organizationId, planTotal: planTotal._sum.planCost }
    });
  },
  {
    isolationLevel: 'Serializable'
  }
);
```

### REPEATABLE READ for Reports

Ensures consistent read view during long-running reports:

```typescript
await prisma.$transaction(
  async (tx) => {
    // Run multiple queries with consistent snapshot
    const pfaRecords = await tx.pfaRecord.findMany({ where: { organizationId } });
    const summary = await tx.costSummary.findUnique({ where: { organizationId } });

    // Generate report
    return generateReport(pfaRecords, summary);
  },
  {
    isolationLevel: 'RepeatableRead',
    timeout: 60000  // 60 seconds for long report
  }
);
```

---

## Backup Strategy

PostgreSQL backups for PFA Vanguard.

### Automated Backups

**pg_dump** (logical backup):
```bash
#!/bin/bash
# backup-postgres.sh

BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DATABASE="pfa_vanguard"

# Create backup
pg_dump -U pfa_user -h localhost -d $DATABASE \
  --format=custom \
  --file="$BACKUP_DIR/pfa_vanguard-$TIMESTAMP.dump"

# Compress
gzip "$BACKUP_DIR/pfa_vanguard-$TIMESTAMP.dump"

# Delete backups older than 30 days
find $BACKUP_DIR -name "*.dump.gz" -mtime +30 -delete

echo "Backup complete: pfa_vanguard-$TIMESTAMP.dump.gz"
```

**Schedule with cron**:
```cron
# Run daily at 2 AM
0 2 * * * /path/to/backup-postgres.sh
```

**Restore from backup**:
```bash
# Restore from custom format dump
pg_restore -U pfa_user -h localhost -d pfa_vanguard \
  --clean --if-exists \
  /backups/postgres/pfa_vanguard-20251125.dump
```

### Cloud Backups

**AWS RDS**: Automated backups (7-day retention by default)
```bash
# Manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier pfa-vanguard-prod \
  --db-snapshot-identifier pfa-vanguard-manual-20251125
```

**Azure Database for PostgreSQL**: Automated backups (7-day retention)
```bash
# Manual backup
az postgres server restore \
  --resource-group pfa-vanguard-rg \
  --name pfa-vanguard-prod \
  --restore-point-in-time "2025-11-25T02:00:00Z" \
  --source-server pfa-vanguard-prod
```

**Docker PostgreSQL**: Volume snapshots
```bash
# Backup volume
docker run --rm \
  -v pfa_postgres_data:/data \
  -v /backups:/backup \
  alpine tar czf /backup/postgres-data-$(date +%Y%m%d).tar.gz -C /data .

# Restore volume
docker run --rm \
  -v pfa_postgres_data:/data \
  -v /backups:/backup \
  alpine tar xzf /backup/postgres-data-20251125.tar.gz -C /data
```

---

## Monitoring Queries

### Check Database Size

```sql
SELECT
  pg_size_pretty(pg_database_size('pfa_vanguard')) AS database_size;
```

### Check Table Sizes

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check Active Connections

```sql
SELECT
  datname,
  count(*) as connections,
  max(now() - backend_start) as oldest_connection
FROM pg_stat_activity
WHERE datname = 'pfa_vanguard'
GROUP BY datname;
```

### Check Slow Queries (Current)

```sql
SELECT
  pid,
  now() - query_start as duration,
  state,
  query
FROM pg_stat_activity
WHERE state != 'idle'
  AND now() - query_start > interval '5 seconds'
ORDER BY duration DESC;
```

### Check Table Bloat

```sql
SELECT
  schemaname,
  tablename,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows,
  round(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_ratio
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

If `dead_ratio > 10%`, run `VACUUM` on that table.

---

## Performance Testing

### Benchmark Common Queries

Create benchmark script:

```typescript
// benchmark-queries.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: [{ level: 'query', emit: 'event' }]
});

interface BenchmarkResult {
  query: string;
  avgTime: number;
  minTime: number;
  maxTime: number;
  runs: number;
}

async function benchmark(
  name: string,
  fn: () => Promise<any>,
  runs: number = 10
): Promise<BenchmarkResult> {
  const times: number[] = [];

  console.log(`Running ${name}...`);

  for (let i = 0; i < runs; i++) {
    const start = Date.now();
    await fn();
    const duration = Date.now() - start;
    times.push(duration);
    process.stdout.write('.');
  }

  console.log(' Done!');

  return {
    query: name,
    avgTime: times.reduce((a, b) => a + b) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    runs
  };
}

async function main() {
  console.log('🚀 Performance Benchmarks\n');

  const results: BenchmarkResult[] = [];

  // Benchmark 1: Load all PFA records for org
  results.push(await benchmark(
    'Load all PFA records',
    () => prisma.pfaRecord.findMany({
      where: { organizationId: 'your-org-id' }
    })
  ));

  // Benchmark 2: Filtered query
  results.push(await benchmark(
    'Filtered query (category + source)',
    () => prisma.pfaRecord.findMany({
      where: {
        organizationId: 'your-org-id',
        category: 'Cranes',
        source: 'Rental'
      }
    })
  ));

  // Benchmark 3: Date range query
  results.push(await benchmark(
    'Date range query',
    () => prisma.pfaRecord.findMany({
      where: {
        organizationId: 'your-org-id',
        forecastStart: { gte: new Date('2025-01-01') },
        forecastEnd: { lte: new Date('2025-12-31') }
      }
    })
  ));

  // Benchmark 4: Aggregation
  results.push(await benchmark(
    'Cost aggregation',
    () => prisma.pfaRecord.aggregate({
      where: { organizationId: 'your-org-id' },
      _sum: { monthlyRate: true, purchasePrice: true }
    })
  ));

  // Print results
  console.log('\n📊 Results:\n');
  console.table(results);

  // Performance targets
  console.log('\n🎯 Performance Targets:');
  console.log('   Simple queries: < 50ms');
  console.log('   Complex queries: < 100ms');
  console.log('   Aggregations: < 200ms');

  await prisma.$disconnect();
}

main();
```

Run benchmarks:
```bash
npx tsx benchmark-queries.ts
```

### Load Testing

Use **k6** for load testing:

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 10 },    // Stay at 10 users
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
  },
};

export default function () {
  // Login
  const loginRes = http.post('http://localhost:3001/api/auth/login', {
    username: 'admin',
    password: 'admin123'
  });

  check(loginRes, {
    'login successful': (r) => r.status === 200,
  });

  const token = loginRes.json('token');

  // Load PFA records
  const pfaRes = http.get('http://localhost:3001/api/pfa/records', {
    headers: { Authorization: `Bearer ${token}` }
  });

  check(pfaRes, {
    'pfa load successful': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

Run load test:
```bash
k6 run load-test.js
```

---

## Troubleshooting

### Problem: Slow Queries

**Diagnosis**:
```sql
-- Show slow queries
SELECT * FROM pg_stat_activity
WHERE state != 'idle' AND now() - query_start > interval '1 second';

-- Show query plan
EXPLAIN ANALYZE
SELECT * FROM pfa_records WHERE organizationId = 'your-org-id';
```

**Solutions**:
1. Add missing indexes
2. Increase `work_mem` for complex queries
3. Run `VACUUM ANALYZE` on affected tables

### Problem: Connection Pool Exhausted

**Error**: `Can't reach database server`

**Diagnosis**:
```sql
-- Check connection count
SELECT count(*) FROM pg_stat_activity WHERE datname = 'pfa_vanguard';

-- Show max connections
SHOW max_connections;
```

**Solutions**:
1. Increase `connection_limit` in DATABASE_URL
2. Increase `max_connections` in postgresql.conf
3. Fix connection leaks in application code

### Problem: High Disk I/O

**Diagnosis**:
```sql
-- Show table I/O
SELECT
  schemaname,
  tablename,
  heap_blks_read,
  heap_blks_hit,
  round(100.0 * heap_blks_hit / NULLIF(heap_blks_hit + heap_blks_read, 0), 2) as cache_hit_ratio
FROM pg_statio_user_tables
WHERE heap_blks_read > 0
ORDER BY heap_blks_read DESC;
```

**Solutions**:
1. Increase `shared_buffers` and `effective_cache_size`
2. Add missing indexes
3. Optimize queries to reduce data scanned

---

## Resources

- **[PostgreSQL Performance Tips](https://www.postgresql.org/docs/current/performance-tips.html)** - Official docs
- **[PgTune](https://pgtune.leopard.in.ua/)** - PostgreSQL configuration wizard
- **[Prisma Performance](https://www.prisma.io/docs/guides/performance-and-optimization)** - Prisma optimization guide
- **[pgBadger](https://github.com/darold/pgbadger)** - PostgreSQL log analyzer

---

**Documentation Version**: 1.0.0
**Last Updated**: 2025-11-25
**Tested With**: PostgreSQL 15.x, Prisma 5.x
