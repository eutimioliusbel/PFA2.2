# Performance Benchmarking Suite
**Task 10B.4 - Performance Benchmarking for ADR-005**

Comprehensive performance benchmarking for Multi-Tenant Access Control system.

---

## Quick Start

### Run All Benchmarks

```bash
cd backend
npm test -- performance/
```

### Run Individual Benchmark Suites

```bash
# Authorization middleware benchmarks (JWT + permissions)
npm test -- authorizationBenchmarks.test.ts

# Database query benchmarks (org filtering + JSONB)
npm test -- databaseQueryBenchmarks.test.ts

# API endpoint benchmarks (full request/response)
npm test -- apiEndpointBenchmarks.test.ts
```

### Expected Output

```
🔄 Running benchmark: JWT Token Verification (1000 iterations)...
✅ JWT Token Verification - Results:
   Mean: 8.45ms
   P50:  7.23ms
   P75:  9.12ms
   P95:  12.34ms
   P99:  15.67ms
   Range: 5.12ms - 18.23ms

 PASS  tests/performance/authorizationBenchmarks.test.ts
   ✓ should verify JWT tokens in <10ms (P50) (1234ms)
```

---

## Benchmark Suites

### 1. Authorization Middleware Benchmarks

**File**: `authorizationBenchmarks.test.ts`

**Measures**:
- JWT token verification (`authenticateJWT` middleware)
- Permission checks (`requirePermission` middleware)
- Organization access validation (`requireOrgAccess` middleware)
- Full authorization chain (JWT + permission)
- Concurrent authorization requests

**Performance Targets**:
- JWT Verification: <10ms (P50), <20ms (P95)
- Permission Check: <20ms (P50), <40ms (P95)
- Full Auth Chain: <50ms (P50), <75ms (P95), <100ms (P99)

**Test Data**:
- 1 test organization
- 3 test users (admin, editor, viewer)
- 1000 iterations per benchmark

### 2. Database Query Benchmarks

**File**: `databaseQueryBenchmarks.test.ts`

**Measures**:
- Simple organization filtering (`WHERE organizationId = ?`)
- Composite index performance (`org + category + source`)
- Sync state filtering (modified records for write sync)
- User permission queries (hot path)
- Join queries (User + UserOrganization)
- Audit log writes
- Count queries (pagination)

**Performance Targets**:
- Org Filter (simple): <100ms (P50), <150ms (P95)
- Composite Filter: <50ms (P50), <100ms (P95)
- Permission Lookup: <20ms (P50), <40ms (P95)
- Audit Log Write: <25ms (P50), <50ms (P95)

**Test Data**:
- 1 test organization
- 1 test user with permissions
- 1000 PFA records

### 3. API Endpoint Benchmarks

**File**: `apiEndpointBenchmarks.test.ts`

**Measures**:
- Authentication endpoints (`POST /api/auth/login`)
- Read operations (`GET /api/pfa/:orgId`)
- Write operations (`POST /api/pfa/:orgId/draft`)
- Permission denials (fast rejection)
- Concurrent requests (10 parallel)
- Cross-organization access denials
- End-to-end latency breakdown

**Performance Targets**:
- Login: <100ms (P50), <200ms (P95)
- Read Operations: <150ms (P50), <250ms (P95), <400ms (P99)
- Write Operations: <250ms (P50), <400ms (P95)
- Permission Denials: <100ms (P50), <150ms (P95)

**Test Data**:
- 1 test organization
- 3 test users (admin, editor, viewer)
- 500 PFA records

---

## Query Analysis

### EXPLAIN ANALYZE Queries

**File**: `queryAnalysis.sql`

Run database query analysis:

```bash
# Replace YOUR_ORG_ID_HERE and YOUR_USER_ID_HERE with actual UUIDs
psql -U your_user -d pfa_vanguard -f tests/performance/queryAnalysis.sql
```

**Queries Analyzed**:
1. PFA records by organizationId
2. PFA records with composite filter (org + category + source)
3. PFA records with date range filter
4. Modified PFA records for sync
5. User organization permissions
6. User + organizations join (JWT payload)
7. Audit log writes
8. Count queries
9. Pagination queries

**Output**:
- Query plan (`Seq Scan` vs `Index Scan`)
- Actual execution time (milliseconds)
- Rows examined vs rows returned
- Index usage statistics
- Missing index detection

---

## Performance Optimization

### Apply Optimizations

```bash
# Create performance indexes
psql -U your_user -d pfa_vanguard -f prisma/migrations/create_performance_indexes.sql

# Analyze tables to update statistics
psql -U your_user -d pfa_vanguard -c "ANALYZE pfa_records; ANALYZE user_organizations; ANALYZE audit_logs;"

# Verify index creation
psql -U your_user -d pfa_vanguard -c "
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'pfa_records'
    AND indexname LIKE 'idx_%';
"
```

### Rollback Procedure

```bash
# Remove all performance indexes
psql -U your_user -d pfa_vanguard -c "
  DROP INDEX CONCURRENTLY IF EXISTS idx_pfa_org;
  DROP INDEX CONCURRENTLY IF EXISTS idx_pfa_org_category_source;
  DROP INDEX CONCURRENTLY IF EXISTS idx_pfa_org_sync_state;
  DROP INDEX CONCURRENTLY IF EXISTS idx_pfa_org_dates;
  DROP INDEX CONCURRENTLY IF EXISTS idx_pfa_org_modified;
  DROP INDEX CONCURRENTLY IF EXISTS idx_user_org_user;
  DROP INDEX CONCURRENTLY IF EXISTS idx_audit_user_timestamp;
  DROP INDEX CONCURRENTLY IF EXISTS idx_audit_org_timestamp;
  DROP INDEX CONCURRENTLY IF EXISTS idx_audit_action_timestamp;
  DROP INDEX CONCURRENTLY IF EXISTS idx_pfa_org_category;
  DROP INDEX CONCURRENTLY IF EXISTS idx_pfa_org_source;
  DROP INDEX CONCURRENTLY IF EXISTS idx_pfa_org_dor;
  DROP INDEX CONCURRENTLY IF EXISTS idx_pfa_org_actualized;
"
```

---

## Validation Workflow

### 1. Baseline Benchmarks (Before Optimization)

```bash
# Run benchmarks WITHOUT performance indexes
npm test -- performance/

# Save results to baseline report
npm test -- performance/ > baseline_results.txt
```

### 2. Apply Optimizations

```bash
# Apply performance indexes
psql -U your_user -d pfa_vanguard -f prisma/migrations/create_performance_indexes.sql

# Analyze tables
psql -U your_user -d pfa_vanguard -c "ANALYZE pfa_records; ANALYZE user_organizations; ANALYZE audit_logs;"
```

### 3. Re-run Benchmarks (After Optimization)

```bash
# Run benchmarks WITH performance indexes
npm test -- performance/

# Save results to optimized report
npm test -- performance/ > optimized_results.txt
```

### 4. Compare Results

```bash
# Compare baseline vs optimized
diff baseline_results.txt optimized_results.txt

# Or manually compare P50/P95/P99 values
```

### 5. Validate Targets Met

- [ ] Authorization Middleware: <50ms (P50), <75ms (P95), <100ms (P99)
- [ ] Database Queries: <100ms (P50), <150ms (P95), <200ms (P99)
- [ ] API Responses: <200ms (P50), <300ms (P95), <400ms (P99)

---

## Test Data Cleanup

All benchmarks automatically clean up test data in `afterAll()` hooks:

```typescript
afterAll(async () => {
  await prisma.pfaRecord.deleteMany({ where: { organizationId: testOrgId } });
  await prisma.userOrganization.deleteMany({ where: { organizationId: testOrgId } });
  await prisma.user.deleteMany({ where: { username: { in: ['test_users'] } } });
  await prisma.organization.delete({ where: { id: testOrgId } });
  await prisma.$disconnect();
});
```

**Note**: If tests fail before cleanup, you may need to manually delete test data:

```sql
-- Cleanup test organizations
DELETE FROM organizations WHERE code LIKE '%_PERF_TEST';

-- Cleanup test users
DELETE FROM users WHERE username LIKE 'perf_%';
```

---

## Continuous Performance Monitoring

### Integration with CI/CD

Add performance regression tests to CI pipeline:

```yaml
# .github/workflows/performance-tests.yml
name: Performance Regression Tests

on:
  pull_request:
    branches: [main, develop]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd backend && npm install
      - name: Run performance benchmarks
        run: cd backend && npm test -- performance/
      - name: Check performance targets
        run: |
          if grep -q "FAIL.*performance" test_results.txt; then
            echo "Performance regression detected!"
            exit 1
          fi
```

### Production Monitoring

**Recommended Metrics** (CloudWatch/Datadog):

1. **Authorization Latency**
   - Metric: `pfa.auth.middleware.p95_latency`
   - Alert: P95 > 75ms

2. **Database Query Latency**
   - Metric: `pfa.db.query.p95_latency`
   - Alert: P95 > 150ms

3. **API Response Time**
   - Metric: `pfa.api.response.p95_latency`
   - Alert: P95 > 300ms

---

## Troubleshooting

### Benchmark Failures

**Problem**: Tests fail with "Permission check exceeded 50ms target"

**Solution**:
1. Verify indexes are created: `\d pfa_records` in psql
2. Check index usage: `EXPLAIN ANALYZE SELECT ...`
3. Run `ANALYZE` to update statistics
4. Increase test timeout if database is slow

### Database Connection Issues

**Problem**: `Error: Can't reach database server`

**Solution**:
1. Verify PostgreSQL is running: `pg_isready`
2. Check DATABASE_URL in `.env`
3. Ensure database exists: `psql -l`
4. Check connection pool size: `connection_limit=20`

### Out of Memory

**Problem**: Node.js heap out of memory during benchmarks

**Solution**:
1. Reduce test iterations (1000 → 500)
2. Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096 npm test`
3. Run benchmarks individually instead of all at once

---

## References

- **Performance Benchmarks Report**: `docs/performance/PERFORMANCE_BENCHMARKS.md`
- **Optimization Guide**: `docs/performance/OPTIMIZATION_GUIDE.md`
- **Index Creation Script**: `prisma/migrations/create_performance_indexes.sql`
- **Query Analysis**: `tests/performance/queryAnalysis.sql`

**Status**: ✅ Benchmark suite complete, ready for execution
