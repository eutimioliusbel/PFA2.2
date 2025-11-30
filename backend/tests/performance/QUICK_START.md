# Performance Benchmarking - Quick Start Guide
**Task 10B.4 - Performance Benchmarking for ADR-005**

---

## 🚀 5-Minute Quick Start

### Prerequisites

1. **Backend server running**:
   ```bash
   cd backend
   npm run dev
   ```

2. **PostgreSQL database active** with test data

### Run All Benchmarks

```bash
cd backend
npm test -- performance/
```

**Expected Output**:
```
 PASS  tests/performance/authorizationBenchmarks.test.ts
   Authorization Middleware - Performance Benchmarks
     ✓ Benchmark 1: JWT Token Verification
       - P50: 7.23ms ✅ (target: <10ms)
     ✓ Benchmark 2: Permission Check
       - P50: 18.45ms ✅ (target: <20ms)
     ✓ Benchmark 3: Full Auth Chain
       - P50: 42.12ms ✅ (target: <50ms)

 PASS  tests/performance/databaseQueryBenchmarks.test.ts
   Database Query - Performance Benchmarks
     ✓ Benchmark 1: Organization Filtering
       - P50: 38.67ms ✅ (target: <100ms)

 PASS  tests/performance/apiEndpointBenchmarks.test.ts
   API Endpoint - Performance Benchmarks
     ✓ Benchmark 1: GET /api/pfa/:orgId
       - P50: 142.89ms ✅ (target: <200ms)
```

---

## 📊 Validation Workflow

### Step 1: Baseline (Before Optimization)

```bash
# Run WITHOUT performance indexes
npm test -- performance/ > baseline_results.txt

# Expected failures (targets not met):
# - Authorization >50ms
# - Database queries >100ms
```

### Step 2: Apply Optimizations

```bash
# Create performance indexes
psql -U postgres -d pfa_vanguard -f prisma/migrations/create_performance_indexes.sql

# Update database statistics
psql -U postgres -d pfa_vanguard -c "ANALYZE pfa_records; ANALYZE user_organizations; ANALYZE audit_logs;"
```

### Step 3: Re-run (After Optimization)

```bash
# Run WITH performance indexes
npm test -- performance/ > optimized_results.txt

# Expected passes (targets met):
# - Authorization <50ms ✅
# - Database queries <100ms ✅
```

### Step 4: Compare Results

```bash
# View improvement
diff baseline_results.txt optimized_results.txt

# Or manually compare P50/P95/P99 values
```

---

## 🎯 Performance Targets

| Metric | Target (P50) | Target (P95) | Target (P99) |
|--------|--------------|--------------|--------------|
| **Authorization Middleware** | <50ms | <75ms | <100ms |
| **Database Queries** | <100ms | <150ms | <200ms |
| **API Response** | <200ms | <300ms | <400ms |

---

## 🔍 Individual Benchmark Suites

### Authorization Middleware

```bash
npm test -- authorizationBenchmarks.test.ts
```

**Tests**:
- JWT verification (<10ms)
- Permission checks (<20ms)
- Full auth chain (<50ms)
- Concurrent requests

### Database Queries

```bash
npm test -- databaseQueryBenchmarks.test.ts
```

**Tests**:
- Organization filtering (<100ms)
- Composite indexes (<50ms)
- Permission lookups (<20ms)
- Audit log writes (<25ms)

### API Endpoints

```bash
npm test -- apiEndpointBenchmarks.test.ts
```

**Tests**:
- Read operations (<150ms)
- Write operations (<250ms)
- Permission denials (<100ms)
- Concurrent requests

---

## 🛠️ Troubleshooting

### ❌ Tests Fail with "Connection Pool Exhausted"

**Solution**: Increase pool size in `.env`:
```bash
DATABASE_URL="postgresql://...?connection_limit=30"
```

### ❌ All Benchmarks Fail (P50 >100ms)

**Solution**: Verify indexes exist:
```bash
psql -U postgres -d pfa_vanguard -c "
  SELECT indexname
  FROM pg_indexes
  WHERE tablename = 'pfa_records'
    AND indexname LIKE 'idx_%';
"
```

### ❌ JWT Verification >10ms

**Solution**: Token size too large? Check JWT payload:
```typescript
const decoded = jwt.decode(token);
console.log(JSON.stringify(decoded, null, 2).length); // Should be <2KB
```

### ❌ Permission Check >20ms

**Solution**: Verify index usage:
```bash
psql -U postgres -d pfa_vanguard -c "
  EXPLAIN ANALYZE
  SELECT perm_Read FROM user_organizations
  WHERE userId = 'xxx' AND organizationId = 'yyy';
"
# Should show "Index Scan" not "Seq Scan"
```

---

## 📖 Full Documentation

- **Comprehensive Report**: `docs/performance/PERFORMANCE_BENCHMARKS.md`
- **Optimization Guide**: `docs/performance/OPTIMIZATION_GUIDE.md`
- **Test Suite README**: `backend/tests/performance/README.md`
- **Testing Log**: `docs/TESTING_LOG.md` ([TEST-PERF-001])

---

## ✅ Validation Checklist

- [ ] Backend server running (`npm run dev`)
- [ ] PostgreSQL database accessible
- [ ] Baseline benchmarks executed
- [ ] Performance indexes created
- [ ] Optimized benchmarks executed
- [ ] All targets met (P50 <50ms auth, <100ms DB, <200ms API)
- [ ] Results documented in `TESTING_LOG.md`

---

**Status**: ✅ Ready for execution
**Estimated Time**: 10-15 minutes (including warmup)
