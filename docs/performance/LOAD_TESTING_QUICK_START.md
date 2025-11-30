# Load Testing Quick Start Guide

**⚡ Get started with load testing in 5 minutes**

---

## Prerequisites

1. **Backend running** on http://localhost:3001
2. **PostgreSQL** database configured
3. **Artillery installed** (already in backend devDependencies)

---

## Step 1: Generate Test Data (2 minutes)

```bash
cd backend
npm run test:load:generate-data
```

**Creates:**
- ✅ 1000 test users across 10 organizations
- ✅ 100 admin users
- ✅ `load-tests/test-credentials.json`
- ✅ `load-tests/admin-credentials.json`

---

## Step 2: Run Individual Tests (3-5 minutes each)

### Option A: Run All Tests

```bash
cd backend
npm run test:load
```

### Option B: Run Individual Tests

```bash
# Permission Check (200 concurrent users, ~3 min)
npm run test:load:permission-check

# Permission Grant (50 admins, ~2 min)
npm run test:load:permission-grant

# Organization Switch (100 users, ~3 min)
npm run test:load:org-switch

# Database Stress (variable load, ~2 min)
npm run test:load:db-stress

# Memory Leak Detection (~5 min)
npm run test:load:memory
```

---

## Step 3: Generate Reports (30 seconds)

```bash
# Generate comprehensive summary
npm run test:load:report

# Generate HTML reports
artillery report ../temp/output/permission-check-results.json --output ../docs/performance/permission-check-report.html
artillery report ../temp/output/permission-grant-results.json --output ../docs/performance/permission-grant-report.html
artillery report ../temp/output/org-switch-results.json --output ../docs/performance/org-switch-report.html
artillery report ../temp/output/db-stress-results.json --output ../docs/performance/db-stress-report.html
```

---

## Step 4: View Results

### Comprehensive Summary

```bash
# Open summary report
cat ../docs/performance/LOAD_TEST_REPORT.md
```

### HTML Reports (Interactive Charts)

Open in browser:
- `docs/performance/permission-check-report.html`
- `docs/performance/permission-grant-report.html`
- `docs/performance/org-switch-report.html`
- `docs/performance/db-stress-report.html`

### Memory Leak Report

```bash
cat ../docs/performance/MEMORY_LEAK_TEST_REPORT.md
```

---

## What to Look For

### ✅ Good Results

| Metric | Good Value |
|--------|------------|
| **Permission Check P95** | <100ms |
| **Permission Grant P95** | <200ms |
| **Org Switch P95** | <400ms |
| **Error Rate** | <1% |
| **Database Errors** | 0 (no 500, 503 errors) |
| **Memory Leak** | Heap growth <50MB |

### 🚫 Red Flags

| Issue | Indicator | Fix |
|-------|-----------|-----|
| **High Latency** | P95 >200ms | Add Redis caching, optimize queries |
| **Connection Pool Exhaustion** | 503 errors | Increase pool size from 10 to 20 |
| **Database Deadlocks** | 500 errors | Review concurrent write logic |
| **Memory Leak** | Heap growth >50MB | Check for unclosed connections, event listeners |

---

## Cleanup After Testing

```sql
-- Delete test data
DELETE FROM users WHERE username LIKE 'loadtest_%';
DELETE FROM organizations WHERE code LIKE 'LOAD_TEST_%';
```

Or regenerate database:

```bash
npm run prisma:migrate -- --name reset
npm run prisma:seed
```

---

## Monitoring During Tests

### Backend Memory

```bash
# Start backend with memory profiling
node --expose-gc --inspect dist/server.js

# Connect Chrome DevTools
# 1. Open chrome://inspect
# 2. Click "Inspect" under your Node.js process
# 3. Go to "Memory" tab
```

### Database Connections

```sql
-- Monitor active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'pfa_vanguard';

-- Check for slow queries
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state != 'idle' AND query_start < now() - interval '100 milliseconds';
```

### System Resources

```bash
# CPU and RAM
htop

# Disk I/O
iotop -o

# Network
nethogs
```

---

## Common Issues

### Backend Not Running

**Error:** `Backend not running at http://localhost:3001`

**Fix:**
```bash
cd backend
npm run dev
```

### Test Data Already Exists

**Error:** `Organization LOAD_TEST_01 already exists`

**Fix:**
```bash
# Delete existing test data
psql -d pfa_vanguard -c "DELETE FROM users WHERE username LIKE 'loadtest_%';"
psql -d pfa_vanguard -c "DELETE FROM organizations WHERE code LIKE 'LOAD_TEST_%';"

# Regenerate
npm run test:load:generate-data
```

### Artillery Not Found

**Error:** `artillery: command not found`

**Fix:**
```bash
cd backend
npm install
```

---

## Next Steps

1. **Baseline Metrics:** Document current performance for comparison
2. **Optimize:** Implement Redis caching, increase connection pool
3. **Re-test:** Validate improvements
4. **Production Monitoring:** Set up Prometheus + Grafana
5. **CI/CD Integration:** Add load tests to GitHub Actions

---

## Resources

- **Full Documentation:** [load-tests/README.md](../../load-tests/README.md)
- **Monitoring Setup:** [MONITORING_SETUP.md](./MONITORING_SETUP.md)
- **Testing Log:** [docs/TESTING_LOG.md](../TESTING_LOG.md)
- **ADR-005:** [Multi-Tenant Access Control](../adrs/ADR-005-multi-tenant-access-control/)

---

**Estimated Time:** 15-20 minutes for full test suite
**Difficulty:** Easy (fully automated)
**Maintained By:** SDET Team
