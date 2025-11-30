# Load Testing Suite - ADR-005 Multi-Tenant Access Control

This directory contains comprehensive load testing configurations for validating the performance and scalability of the Multi-Tenant Access Control system.

---

## Quick Start

### 1. Prerequisites

```bash
# Ensure backend is running
cd backend
npm run dev

# Install Artillery (already installed in backend)
npm install -D artillery artillery-plugin-expect
```

### 2. Generate Test Data

```bash
# Generate 1000 test users across 10 organizations
npx tsx load-tests/generate-test-data.ts
```

**Output:**
- `load-tests/test-credentials.json` - 1000 user credentials
- `load-tests/admin-credentials.json` - 100 admin credentials

### 3. Run Individual Tests

```bash
# Permission Check Load Test (200 concurrent users)
artillery run load-tests/permission-check.yml --output temp/output/permission-check-results.json

# Permission Grant Load Test (50 concurrent admins)
artillery run load-tests/permission-grant.yml --output temp/output/permission-grant-results.json

# Organization Switch Load Test (100 concurrent users)
artillery run load-tests/org-switch.yml --output temp/output/org-switch-results.json

# Database Stress Test (connection pool limits)
artillery run load-tests/db-stress.yml --output temp/output/db-stress-results.json

# Memory Leak Detection Test (1000+ operations)
npx tsx --expose-gc load-tests/memory-leak-test.ts
```

### 4. Run All Tests

```bash
# Execute complete test suite (Linux/Mac)
bash load-tests/run-all-tests.sh

# Windows users: Run tests individually or use Git Bash
```

### 5. View Reports

```bash
# Generate HTML report from JSON results
artillery report temp/output/permission-check-results.json --output docs/performance/permission-check-report.html

# Open in browser
open docs/performance/permission-check-report.html
```

---

## Test Suite Overview

| Test | Objective | Concurrent Users | Duration | Target Latency |
|------|-----------|------------------|----------|----------------|
| **Permission Check** | Validate permission middleware performance | 200 | 210s | P95 < 100ms |
| **Permission Grant** | Test concurrent permission modifications | 50 admins | 90s | P95 < 200ms |
| **Organization Switch** | Validate context switching | 100 | 150s | P95 < 400ms |
| **Database Stress** | Test connection pool limits | Variable | 140s | No exhaustion |
| **Memory Leak** | Detect memory leaks | Sequential | ~5min | Heap growth < 50MB |

---

## Test Files

### Artillery Configurations

- **`permission-check.yml`** - Permission middleware load test
- **`permission-grant.yml`** - Permission grant concurrency test
- **`org-switch.yml`** - Organization context switching test
- **`db-stress.yml`** - Database connection pool stress test

### Scripts

- **`generate-test-data.ts`** - Generate test users and credentials
- **`memory-leak-test.ts`** - Memory leak detection script
- **`generate-summary-report.ts`** - Comprehensive report generator
- **`run-all-tests.sh`** - Execute all tests (Linux/Mac)

### Processors (Artillery Helpers)

- **`processors/auth-processor.js`** - Authentication helpers
- **`processors/permission-grant-processor.js`** - Permission grant helpers
- **`processors/org-switch-processor.js`** - Org switching helpers
- **`processors/db-stress-processor.js`** - Database stress helpers

---

## Performance Targets

### Latency Targets

| Operation | P50 | P95 | P99 |
|-----------|-----|-----|-----|
| Permission Check | <50ms | <100ms | <200ms |
| Permission Grant | <100ms | <200ms | <400ms |
| API Server List | <200ms | <400ms | <800ms |
| Org Status Check | <100ms | <200ms | <400ms |

### Throughput Targets

| Operation | Target | Max Concurrency |
|-----------|--------|-----------------|
| Permission Check | 2000 req/s | 200 users |
| Permission Grant | 500 req/s | 50 admins |
| Org Switch | 500 req/s | 100 users |

### Error Rate Targets

- **Success rate:** >99% (error rate <1%)
- **Database errors:** 0 (no deadlocks, no connection exhaustion)
- **Race conditions:** 0

---

## Test Scenarios

### 1. Permission Check Load Test

**Simulates:** 200 concurrent users accessing PFA data with permission checks.

**Flow:**
1. User logs in
2. Permission check via `/api/pfa` (triggers `requirePermission` middleware)
3. Repeat permission check (test caching)
4. Multi-endpoint access (PFA, servers, organizations)

**Success criteria:**
- P95 latency <100ms
- Error rate <1%
- No authentication failures

### 2. Permission Grant Load Test

**Simulates:** 50 concurrent admins granting permissions to users.

**Flow:**
1. Admin logs in
2. Select random target user
3. Get current permissions
4. Update capabilities (grant permission)
5. Verify permission was granted

**Success criteria:**
- P95 latency <200ms
- No database deadlocks
- Data integrity maintained

### 3. Organization Switch Load Test

**Simulates:** 100 concurrent users rapidly switching between organizations.

**Flow:**
1. User logs in
2. Access data in Organization 1
3. Switch to Organization 2
4. Switch back to Organization 1
5. Rapid context switching (race condition test)

**Success criteria:**
- P95 latency <400ms
- No race conditions
- Correct data isolation

### 4. Database Stress Test

**Simulates:** Database connection pool exhaustion under extreme load.

**Phases:**
1. Baseline (5 req/s)
2. Moderate load (15 req/s)
3. High load (30 req/s - exceeds pool)
4. Exhaustion test (50 req/s)

**Success criteria:**
- No 503 errors (connection pool not exhausted)
- P99 latency <1000ms (no slow queries)
- No database deadlocks

### 5. Memory Leak Detection

**Simulates:** 1000+ sequential operations monitoring heap usage.

**Operations:**
- Permission checks
- Permission grants
- Organization switches

**Success criteria:**
- Heap growth <50 MB
- Memory released after GC
- No detached objects

---

## Monitoring

See [MONITORING_SETUP.md](../docs/performance/MONITORING_SETUP.md) for detailed monitoring instructions.

**Quick monitoring commands:**

```bash
# Monitor backend memory
node --expose-gc --inspect backend/dist/server.js

# Monitor database connections
psql -d pfa_vanguard -c "SELECT count(*) FROM pg_stat_activity;"

# Monitor system resources
htop  # CPU and RAM
```

---

## Interpreting Results

### Artillery Metrics

**Counters:**
- `http.requests` - Total requests sent
- `http.responses` - Total responses received
- `http.codes.200` - Successful requests
- `http.codes.403` - Permission denied (expected)
- `http.codes.500` - Server errors (should be 0)
- `http.codes.503` - Service unavailable (connection pool exhausted)

**Latency:**
- `min` - Fastest response time
- `median (P50)` - 50% of requests faster than this
- `p95` - 95% of requests faster than this (key metric)
- `p99` - 99% of requests faster than this
- `max` - Slowest response time

**Good results:**
- P50 <50ms, P95 <100ms for permission checks
- Error rate <1%
- No 503 errors

**Red flags:**
- P95 >200ms (performance issue)
- Error rate >5% (system instability)
- 503 errors (connection pool exhausted)

---

## Troubleshooting

### High Latency

**Symptoms:** P95 >200ms

**Possible causes:**
1. Database connection pool exhaustion
2. Slow database queries
3. CPU bottleneck
4. Network latency

**Diagnosis:**
```sql
-- Check database connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'pfa_vanguard';

-- Find slow queries
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state != 'idle' AND query_start < now() - interval '100 milliseconds';
```

### Connection Pool Errors (503)

**Symptoms:** `http.codes.503` >0

**Fix:**
```javascript
// Increase connection pool size in backend/src/config/database.ts
const prisma = new PrismaClient({
  datasources: {
    db: {
      connectionPool: {
        maxConnections: 20, // Increase from default 10
      },
    },
  },
});
```

### Memory Leaks

**Symptoms:** Heap growth >50MB over 1000 operations

**Diagnosis:**
```bash
# Run memory leak test with GC
npx tsx --expose-gc load-tests/memory-leak-test.ts

# Review report
cat docs/performance/MEMORY_LEAK_TEST_REPORT.md
```

**Common causes:**
- Event listeners not removed
- Database connections not closed
- Large objects in closures

---

## Test Data Cleanup

After load testing, clean up test data:

```sql
-- Delete test users
DELETE FROM users WHERE username LIKE 'loadtest_%';

-- Delete test organizations
DELETE FROM organizations WHERE code LIKE 'LOAD_TEST_%';
```

Or regenerate database:

```bash
cd backend
npm run prisma:migrate -- --name reset
npm run prisma:seed
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Load Tests

on:
  schedule:
    - cron: '0 2 * * 1' # Weekly on Monday 2am

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Start backend
        run: |
          cd backend
          npm install
          npm run dev &
          sleep 10

      - name: Generate test data
        run: npx tsx load-tests/generate-test-data.ts

      - name: Run load tests
        run: bash load-tests/run-all-tests.sh

      - name: Upload reports
        uses: actions/upload-artifact@v3
        with:
          name: load-test-reports
          path: docs/performance/*.html
```

---

## Performance Benchmarks

**Production targets** (after optimization):

| Metric | Current | Target | Optimized |
|--------|---------|--------|-----------|
| Permission Check P95 | ~80ms | <100ms | <20ms (with Redis) |
| Permission Grant P95 | ~150ms | <200ms | <100ms (with batching) |
| Concurrent Users | 200 | 1000 | 5000 (with load balancing) |
| Throughput | ~1000 req/s | 2000 req/s | 10000 req/s |

---

## Support

For questions or issues:

1. Check [MONITORING_SETUP.md](../docs/performance/MONITORING_SETUP.md)
2. Review [LOAD_TEST_REPORT.md](../docs/performance/LOAD_TEST_REPORT.md)
3. Consult [ADR-005](../docs/adrs/ADR-005-multi-tenant-access-control/)

---

**Maintained By:** SDET Team
**Last Updated:** 2025-11-27
**Version:** 1.0
