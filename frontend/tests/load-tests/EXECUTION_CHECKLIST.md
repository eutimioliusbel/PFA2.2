# Load Test Execution Checklist

**Use this checklist before running load tests to ensure accurate results.**

---

## Pre-Execution Checklist

### Environment Setup

- [ ] **Backend is running** on http://localhost:3001
  ```bash
  cd backend
  npm run dev
  ```

- [ ] **Database is clean** (no stale test data)
  ```sql
  SELECT count(*) FROM users WHERE username LIKE 'loadtest_%';
  -- Should return 0 before test
  ```

- [ ] **Artillery is installed**
  ```bash
  cd backend
  npm install
  # Verify: artillery --version
  ```

- [ ] **Test data NOT yet generated** (will be generated in Step 1)

### System Preparation

- [ ] **Close unnecessary applications** (to avoid CPU/RAM interference)
- [ ] **Disable auto-updates** (Windows Update, etc.)
- [ ] **Connect to power** (disable battery saver mode)
- [ ] **Disable sleep mode** (tests run for 5-20 minutes)

### Monitoring Setup

- [ ] **Open system monitor** (htop on Linux/Mac, Task Manager on Windows)
- [ ] **Open database monitor** (optional but recommended)
  ```sql
  -- In separate terminal: watch database connections
  watch -n 1 "psql -d pfa_vanguard -c 'SELECT count(*) FROM pg_stat_activity;'"
  ```

- [ ] **Enable slow query logging** (optional)
  ```sql
  ALTER SYSTEM SET log_min_duration_statement = 100;
  SELECT pg_reload_conf();
  ```

---

## Execution Steps

### Step 1: Generate Test Data

```bash
cd backend
npm run test:load:generate-data
```

**Expected Output:**
```
🚀 Generating load test data...

📦 Creating test organizations...
  ✅ Created organization LOAD_TEST_01
  ✅ Created organization LOAD_TEST_02
  ... (10 total)

👥 Creating test users...
  ✅ Created 100 users...
  ✅ Created 200 users...
  ... (1000 total)

🔗 Assigning users to organizations...
  ✅ Created 100 assignments...
  ... (1000 total)

🔐 Generating credentials file...
  ✅ Saved 1000 credentials to load-tests/test-credentials.json
  ✅ Saved 100 admin credentials to load-tests/admin-credentials.json

✅ Test data generation complete!
```

**Verification:**
- [ ] `load-tests/test-credentials.json` exists (should be ~50KB)
- [ ] `load-tests/admin-credentials.json` exists (should be ~5KB)
- [ ] Database has 1000 new users and 10 new organizations

---

### Step 2: Run Load Tests

#### Option A: Run All Tests (Recommended for first run)

```bash
npm run test:load
```

**Expected Duration:** ~15-20 minutes

#### Option B: Run Individual Tests

```bash
# Test 1: Permission Check (~3 min)
npm run test:load:permission-check

# Test 2: Permission Grant (~2 min)
npm run test:load:permission-grant

# Test 3: Organization Switch (~3 min)
npm run test:load:org-switch

# Test 4: Database Stress (~2 min)
npm run test:load:db-stress

# Test 5: Memory Leak Detection (~5 min)
npm run test:load:memory
```

---

### Step 3: Generate Reports

```bash
# Generate summary report
npm run test:load:report

# Generate HTML reports (for each test)
artillery report ../temp/output/permission-check-results.json --output ../docs/performance/permission-check-report.html
artillery report ../temp/output/permission-grant-results.json --output ../docs/performance/permission-grant-report.html
artillery report ../temp/output/org-switch-results.json --output ../docs/performance/org-switch-report.html
artillery report ../temp/output/db-stress-results.json --output ../docs/performance/db-stress-report.html
```

---

### Step 4: Review Results

**Check for Success:**

- [ ] **Permission Check:** P95 <100ms, error rate <1%
- [ ] **Permission Grant:** P95 <200ms, no deadlocks
- [ ] **Org Switch:** P95 <400ms, no race conditions
- [ ] **DB Stress:** No 503 errors (connection pool not exhausted)
- [ ] **Memory Leak:** Heap growth <50MB

**Open Reports:**

```bash
# Summary report
cat ../docs/performance/LOAD_TEST_REPORT.md

# Memory leak report
cat ../docs/performance/MEMORY_LEAK_TEST_REPORT.md

# HTML reports (open in browser)
open ../docs/performance/permission-check-report.html
```

---

## Post-Execution Checklist

### Cleanup

- [ ] **Delete test data** (to avoid clutter)
  ```sql
  DELETE FROM users WHERE username LIKE 'loadtest_%';
  DELETE FROM organizations WHERE code LIKE 'LOAD_TEST_%';
  ```

- [ ] **Delete test credentials files** (optional)
  ```bash
  rm load-tests/test-credentials.json
  rm load-tests/admin-credentials.json
  ```

- [ ] **Clear Artillery results** (optional)
  ```bash
  rm -rf temp/output/*.json
  ```

### Result Documentation

- [ ] **Save reports** (commit to git or archive)
- [ ] **Document baseline metrics** (for future comparison)
- [ ] **Note any performance issues** (for optimization backlog)
- [ ] **Update TESTING_LOG.md** (record execution results)

---

## Troubleshooting

### Issue: Backend Not Responding

**Symptoms:** Artillery shows 100% error rate

**Fix:**
1. Check backend is running: `curl http://localhost:3001/health`
2. Check logs: `cd backend && npm run dev`
3. Restart backend if needed

---

### Issue: Database Connection Pool Exhausted

**Symptoms:** 503 errors in Artillery results

**Fix:**
1. Increase connection pool size:
   ```javascript
   // backend/src/config/database.ts
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

2. Restart backend and re-run tests

---

### Issue: High Latency (P95 >200ms)

**Symptoms:** All tests show high latency

**Possible Causes:**
- CPU bottleneck (check with `htop`)
- Database slow queries (check `pg_stat_activity`)
- Network latency (check if backend is on localhost)

**Fix:**
1. Close other applications
2. Add missing database indexes
3. Implement Redis caching (see recommendations in summary report)

---

### Issue: Memory Leak Detected

**Symptoms:** Heap growth >50MB over 1000 operations

**Fix:**
1. Review backend code for:
   - Unclosed database connections
   - Event listeners not removed
   - Large objects in closures
   - Timers not cleared

2. Use Chrome DevTools Memory Profiler:
   ```bash
   node --expose-gc --inspect backend/dist/server.js
   # Open chrome://inspect and take heap snapshots
   ```

---

## Quick Reference: Expected Values

### Good Results

| Metric | Good Value |
|--------|------------|
| Permission Check P50 | <50ms |
| Permission Check P95 | <100ms |
| Permission Grant P95 | <200ms |
| Org Switch P95 | <400ms |
| Error Rate | <1% |
| Database Errors | 0 |
| Memory Leak | <50MB |

### Red Flags

| Issue | Indicator |
|-------|-----------|
| High Latency | P95 >200ms |
| Connection Pool Exhaustion | 503 errors |
| Database Deadlocks | 500 errors with "deadlock" message |
| Memory Leak | Heap growth >50MB |
| Race Conditions | Concurrent access errors |

---

## Time Estimates

| Test | Duration | Total (with setup) |
|------|----------|--------------------|
| Test Data Generation | 1-2 min | N/A |
| Permission Check | 3.5 min | 4 min |
| Permission Grant | 1.5 min | 2 min |
| Organization Switch | 2.5 min | 3 min |
| Database Stress | 2.3 min | 3 min |
| Memory Leak Detection | 5 min | 6 min |
| Report Generation | 30 sec | 1 min |
| **TOTAL** | **~16 min** | **~20 min** |

---

## Next Steps After Successful Execution

1. [ ] Document baseline performance metrics
2. [ ] Identify top 3 bottlenecks
3. [ ] Implement optimizations (Redis, connection pool, indexes)
4. [ ] Re-run tests to validate improvements
5. [ ] Set up production monitoring (Prometheus + Grafana)
6. [ ] Schedule recurring load tests (weekly in CI/CD)

---

**Checklist Version:** 1.0
**Last Updated:** 2025-11-27
**Maintained By:** SDET Team
