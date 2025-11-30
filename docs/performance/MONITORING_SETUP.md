# Performance Monitoring Setup

This document provides instructions for setting up performance monitoring during load tests.

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Backend Metrics](#backend-metrics)
3. [Database Metrics](#database-metrics)
4. [Artillery Metrics](#artillery-metrics)
5. [Real-Time Monitoring](#real-time-monitoring)
6. [Post-Test Analysis](#post-test-analysis)

---

## System Requirements

### Minimum Hardware

- **CPU:** 4 cores (8 recommended for concurrent tests)
- **RAM:** 8 GB (16 GB recommended)
- **Disk:** 10 GB free space (for logs and results)

### Software Dependencies

- **Node.js:** v18+ with `--expose-gc` flag support
- **PostgreSQL:** v14+ with performance monitoring enabled
- **Artillery:** v2.0+ with plugins
- **System monitoring tools:** `htop`, `iotop`, `netstat` (Linux/Mac)

---

## Backend Metrics

### 1. Node.js Memory Monitoring

**Enable Heap Profiling:**

```bash
# Start backend with heap profiling enabled
node --expose-gc --max-old-space-size=4096 --inspect dist/server.js
```

**Connect Chrome DevTools:**

1. Open Chrome and navigate to `chrome://inspect`
2. Click "Inspect" under your Node.js process
3. Go to "Memory" tab
4. Take heap snapshots before/after tests

### 2. Event Loop Monitoring

**Install monitoring module:**

```bash
npm install -D clinic
```

**Run with Clinic.js:**

```bash
# Start backend with Clinic.js Doctor
npx clinic doctor -- node dist/server.js

# After load test, Clinic.js will generate a report
```

### 3. CPU Profiling

**Enable CPU profiler:**

```bash
# Start backend with V8 profiler
node --prof dist/server.js

# After test, process the log
node --prof-process isolate-*.log > cpu-profile.txt
```

---

## Database Metrics

### 1. PostgreSQL Connection Pool Monitoring

**Check active connections:**

```sql
-- Monitor active connections during load test
SELECT
  count(*) AS total_connections,
  count(*) FILTER (WHERE state = 'active') AS active_connections,
  count(*) FILTER (WHERE state = 'idle') AS idle_connections
FROM pg_stat_activity
WHERE datname = 'pfa_vanguard';
```

**Monitor connection pool saturation:**

```sql
-- Check if connection limit is being reached
SELECT
  max_conn,
  used,
  res_for_super,
  max_conn - used - res_for_super AS available
FROM (
  SELECT
    count(*) FILTER (WHERE backend_type = 'client backend') AS used,
    (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_conn,
    (SELECT setting::int FROM pg_settings WHERE name = 'superuser_reserved_connections') AS res_for_super
  FROM pg_stat_activity
) t;
```

### 2. Query Performance Monitoring

**Enable slow query logging:**

```sql
-- Enable slow query log (queries > 100ms)
ALTER SYSTEM SET log_min_duration_statement = 100;
SELECT pg_reload_conf();
```

**Monitor slow queries during test:**

```sql
-- Find slow queries
SELECT
  pid,
  now() - query_start AS duration,
  state,
  query
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < now() - interval '100 milliseconds'
ORDER BY duration DESC;
```

### 3. Lock Monitoring

**Check for database locks:**

```sql
-- Monitor locks during concurrent writes
SELECT
  locktype,
  relation::regclass,
  mode,
  transactionid AS tid,
  virtualtransaction AS vtid,
  pid,
  granted
FROM pg_locks
WHERE NOT granted
ORDER BY pid;
```

**Detect deadlocks:**

```sql
-- Enable deadlock logging
ALTER SYSTEM SET log_lock_waits = on;
ALTER SYSTEM SET deadlock_timeout = '1s';
SELECT pg_reload_conf();
```

---

## Artillery Metrics

### 1. Real-Time Monitoring

**Run Artillery with live output:**

```bash
# Run with real-time statistics
artillery run permission-check.yml --output results.json | tee test-output.log
```

**Key metrics to watch:**

- **Request rate:** Should match configured `arrivalRate`
- **Response time (P95):** Should stay below target (100ms for permission checks)
- **Error rate:** Should be <1%
- **Virtual users:** Should match configured concurrency

### 2. Custom Metrics

Artillery captures custom metrics emitted from processor scripts:

```javascript
// In processor script
ee.emit('customStat', {
  stat: 'permission_check_latency',
  value: latencyMs
});
```

**Custom metrics tracked:**

- `permission_check_latency` - Permission middleware latency
- `permission_grant_latency` - Permission grant operation latency
- `org_switch_latency` - Organization switch latency
- `db_query_latency` - Database query latency
- `database_deadlocks` - Count of deadlock errors
- `connection_pool_exhaustions` - Count of connection pool errors
- `race_conditions` - Count of race condition errors

### 3. Export Metrics to CSV

**Generate CSV report:**

```bash
# Convert JSON results to CSV
artillery report results.json --output report.html

# Extract metrics manually
cat results.json | jq '.aggregate.histograms["http.response_time"]' > latencies.json
```

---

## Real-Time Monitoring

### 1. System Resource Monitoring

**Monitor CPU, RAM, and Disk I/O:**

```bash
# Install monitoring tools (Linux)
sudo apt-get install htop iotop nethogs

# Monitor resources during test
htop          # CPU and RAM
iotop -o      # Disk I/O (only active processes)
nethogs       # Network bandwidth
```

**Monitor backend process specifically:**

```bash
# Get backend process PID
ps aux | grep "node.*server.js"

# Monitor specific process
top -p <PID>
```

### 2. Network Monitoring

**Monitor HTTP connections:**

```bash
# Monitor active connections to port 3001
watch -n 1 "netstat -an | grep ':3001' | wc -l"

# Monitor TCP connection states
netstat -an | grep ':3001' | awk '{print $6}' | sort | uniq -c
```

---

## Post-Test Analysis

### 1. Artillery HTML Reports

Artillery automatically generates detailed HTML reports:

```bash
# Generate HTML report from JSON results
artillery report results.json --output report.html
```

**Report includes:**

- Request/response distribution
- Latency percentiles (P50, P95, P99)
- Error rate breakdown
- Virtual user concurrency timeline
- HTTP status code distribution

### 2. Database Query Analysis

**Analyze query performance:**

```sql
-- Get slowest queries during test period
SELECT
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time,
  query
FROM pg_stat_statements
WHERE query LIKE '%user_organizations%'
   OR query LIKE '%audit_logs%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Reset query statistics:**

```sql
-- Reset pg_stat_statements before test
SELECT pg_stat_statements_reset();
```

### 3. Memory Leak Analysis

**Review heap snapshots:**

1. Open Chrome DevTools Memory tab
2. Compare "Before" vs "After" snapshots
3. Look for:
   - Detached DOM nodes
   - Event listeners not removed
   - Large arrays/objects not garbage collected

**Review memory leak test report:**

```bash
# Report generated at
cat docs/performance/MEMORY_LEAK_TEST_REPORT.md
```

**Red flags:**

- Heap growth > 50 MB after 1000 operations
- Linear heap growth pattern (indicates leak)
- Retained objects count increasing
- GC not reclaiming memory

---

## Monitoring Checklist

**Before Load Test:**

- [ ] Backend running with `--expose-gc` flag
- [ ] Database slow query logging enabled
- [ ] PostgreSQL connection pool configured (10 connections default)
- [ ] System monitoring tools running (`htop`, `iotop`)
- [ ] Artillery installed with plugins
- [ ] Test data generated (1000 users, 10 orgs)

**During Load Test:**

- [ ] Monitor CPU usage (should stay <80%)
- [ ] Monitor RAM usage (watch for memory leaks)
- [ ] Monitor database connection count (should not exceed pool size)
- [ ] Monitor Artillery request rate (should match config)
- [ ] Monitor error rate (should be <1%)
- [ ] Watch for slow queries (>100ms)

**After Load Test:**

- [ ] Generate Artillery HTML reports
- [ ] Review database slow query log
- [ ] Analyze heap snapshots (before vs after)
- [ ] Review custom metrics (deadlocks, race conditions)
- [ ] Check for connection pool exhaustion
- [ ] Generate comprehensive summary report

---

## Troubleshooting

### High Latency (P95 > 200ms)

**Possible causes:**

1. **Database connection pool exhaustion**
   - Check: `SELECT count(*) FROM pg_stat_activity`
   - Fix: Increase Prisma connection pool size

2. **Slow queries**
   - Check: Enable slow query log
   - Fix: Add missing indexes

3. **CPU bottleneck**
   - Check: `htop` (>80% CPU usage)
   - Fix: Deploy multiple backend instances

### Connection Pool Errors (503 responses)

**Diagnosis:**

```sql
-- Check current connection usage
SELECT count(*) FROM pg_stat_activity WHERE datname = 'pfa_vanguard';
```

**Fix:**

```javascript
// Increase Prisma connection pool size
// backend/src/config/database.ts
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  connectionPool: {
    maxConnections: 20, // Increase from default 10
    timeout: 5000, // 5 seconds
  },
});
```

### Memory Leaks

**Diagnosis:**

- Run memory leak test: `tsx --expose-gc load-tests/memory-leak-test.ts`
- Take heap snapshots in Chrome DevTools
- Review `MEMORY_LEAK_TEST_REPORT.md`

**Common causes:**

1. **Event listeners not removed**
2. **Closures retaining large objects**
3. **Database connections not closed**
4. **Timers not cleared**

---

**Document Version:** 1.0
**Last Updated:** 2025-11-27
**Maintained By:** SDET Team
