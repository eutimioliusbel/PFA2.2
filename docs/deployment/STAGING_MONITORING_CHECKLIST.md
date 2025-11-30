# 48-Hour Staging Monitoring Checklist
## ADR-008 Phase 5: Task 5.1 - Post-Deployment Monitoring

**Deployment Date:** `_______________`
**Monitoring Period:** `_______________ to _______________`
**Monitored By:** `_______________`

---

## Hour 0-4: Critical Startup Period

### Immediate Post-Deployment (First 30 Minutes)

- [ ] **Smoke tests passed** (all green in `smoke-test-staging.ts`)
- [ ] **Backend server healthy**
  - [ ] `/health` returns 200 OK
  - [ ] `/health/db` returns 200 OK
  - [ ] `/health/write-sync` returns 200 OK
- [ ] **Sync worker started successfully**
  - [ ] Process visible in `pm2 list`
  - [ ] Worker status: `online`
  - [ ] No immediate crash loops
- [ ] **Database migrations applied**
  - [ ] Latest migration version confirmed
  - [ ] No migration errors in logs

### First Hour

- [ ] **Queue Processing Operational**
  - [ ] Queue size: `_____ items` (target: < 100)
  - [ ] Processing rate: `_____ items/min` (target: > 10)
  - [ ] No stuck items (items with retry count > 5)
- [ ] **Error Logs Clean**
  - [ ] No FATAL errors
  - [ ] No database connection errors
  - [ ] No PEMS API authentication failures
- [ ] **Memory Usage Stable**
  - [ ] Backend: `_____% of allocated` (target: < 70%)
  - [ ] Sync worker: `_____% of allocated` (target: < 70%)
  - [ ] PostgreSQL: `_____% of allocated` (target: < 80%)
- [ ] **API Response Times Normal**
  - [ ] `/api/pems/sync-status`: `_____ ms` (target: < 500ms)
  - [ ] `/api/pems/queue-metrics`: `_____ ms` (target: < 300ms)

### Hours 2-4

- [ ] **First successful sync completed**
  - [ ] Sync batch ID: `_______________`
  - [ ] Records synced: `_____`
  - [ ] Sync duration: `_____ seconds`
  - [ ] Success rate: `_____%` (target: 100%)
- [ ] **WebSocket connections stable**
  - [ ] Active connections: `_____` (expected count)
  - [ ] No abnormal disconnections
  - [ ] Heartbeat responses normal
- [ ] **Rate limiting functional**
  - [ ] `X-RateLimit-*` headers present in responses
  - [ ] No rate limit violations
- [ ] **Conflict resolution working**
  - [ ] Conflicts detected: `_____`
  - [ ] Auto-resolved: `_____`
  - [ ] Manual resolution queue: `_____`

---

## Hours 4-12: Stability Verification

### Hour 6 Checkpoint

- [ ] **Queue metrics healthy**
  - [ ] Pending: `_____` (target: < 100)
  - [ ] Processing: `_____` (target: 1-10)
  - [ ] Failed: `_____` (target: < 5)
  - [ ] Completed (last hour): `_____`
- [ ] **Sync latency acceptable**
  - [ ] Average sync time: `_____ minutes` (target: < 2 min)
  - [ ] P95 sync time: `_____ minutes` (target: < 5 min)
  - [ ] P99 sync time: `_____ minutes` (target: < 10 min)
- [ ] **No memory leaks detected**
  - [ ] Backend memory trend: `Stable / Increasing / Decreasing`
  - [ ] Worker memory trend: `Stable / Increasing / Decreasing`
  - [ ] Heap usage: `_____%` (target: < 75%)
- [ ] **Database performance stable**
  - [ ] Active connections: `_____` (target: < 50)
  - [ ] Slow queries (> 1s): `_____` (target: 0)
  - [ ] Lock wait time: `_____ ms` (target: < 100ms)

### Hour 12 Checkpoint

- [ ] **Error rate acceptable**
  - [ ] Total errors: `_____` (target: < 10)
  - [ ] Error rate: `_____%` (target: < 0.1%)
  - [ ] Retry success rate: `_____%` (target: > 90%)
- [ ] **AWS Secrets Manager access working**
  - [ ] Secret rotation count: `_____`
  - [ ] Access errors: `_____` (target: 0)
  - [ ] Latency for secret retrieval: `_____ ms` (target: < 200ms)
- [ ] **Redis cache operational**
  - [ ] Connection status: `Connected / Disconnected`
  - [ ] Cache hit rate: `_____%` (target: > 80%)
  - [ ] Memory usage: `_____%` (target: < 70%)
- [ ] **PEMS API health**
  - [ ] API response time: `_____ ms` (target: < 2000ms)
  - [ ] API success rate: `_____%` (target: > 99%)
  - [ ] Rate limit violations: `_____` (target: 0)

---

## Hours 12-24: Production Readiness

### Hour 18 Checkpoint

- [ ] **Sync success rate meets SLA**
  - [ ] Success rate (12h): `_____%` (target: > 99.9%)
  - [ ] Total syncs: `_____`
  - [ ] Failed syncs: `_____`
- [ ] **Queue never exceeded threshold**
  - [ ] Max queue size: `_____` (target: < 1000)
  - [ ] Queue cleared regularly: `Yes / No`
- [ ] **No WebSocket disconnection spikes**
  - [ ] Disconnections per hour: `_____` (target: < 10)
  - [ ] Reconnection success rate: `_____%` (target: 100%)
- [ ] **Monitoring dashboards functional**
  - [ ] Grafana dashboards loading: `Yes / No`
  - [ ] All metrics reporting: `Yes / No`
  - [ ] Alerts configured: `Yes / No`

### Hour 24 Checkpoint

- [ ] **24-hour stability confirmed**
  - [ ] Uptime: `_____%` (target: 100%)
  - [ ] No restarts required: `Yes / No`
  - [ ] No manual interventions: `Yes / No`
- [ ] **Performance benchmarks met**
  - [ ] Avg sync latency: `_____ minutes` (target: < 2 min)
  - [ ] P99 sync latency: `_____ minutes` (target: < 10 min)
  - [ ] Throughput: `_____ syncs/hour`
- [ ] **Security checks passed**
  - [ ] No authentication failures
  - [ ] API keys secured in AWS Secrets Manager
  - [ ] Audit logs recording correctly
  - [ ] No suspicious access patterns

---

## Hours 24-48: Extended Stability

### Hour 36 Checkpoint

- [ ] **Long-term memory stability**
  - [ ] Backend memory (36h): `_____% of allocated`
  - [ ] Worker memory (36h): `_____% of allocated`
  - [ ] Memory growth rate: `_____ MB/hour` (target: < 10 MB/h)
- [ ] **Database size growth acceptable**
  - [ ] DB size increase: `_____ GB` (expected)
  - [ ] Table bloat: `None / Minimal / Concerning`
  - [ ] Index health: `Good / Needs rebuild`
- [ ] **No degradation over time**
  - [ ] Sync latency trend: `Stable / Increasing / Decreasing`
  - [ ] Error rate trend: `Stable / Increasing / Decreasing`
  - [ ] Queue processing rate: `Stable / Degraded`

### Hour 48 Final Checkpoint

- [ ] **48-hour stability confirmed**
  - [ ] Total syncs processed: `_____`
  - [ ] Overall success rate: `_____%` (target: > 99.9%)
  - [ ] Average queue size: `_____` (target: < 50)
- [ ] **All systems nominal**
  - [ ] Backend: `Healthy / Degraded / Failed`
  - [ ] Sync worker: `Healthy / Degraded / Failed`
  - [ ] Database: `Healthy / Degraded / Failed`
  - [ ] Redis: `Healthy / Degraded / Failed`
  - [ ] PEMS API: `Healthy / Degraded / Failed`
- [ ] **Ready for production**
  - [ ] All critical tests passed: `Yes / No`
  - [ ] No blocking issues: `Yes / No`
  - [ ] Team sign-off: `Yes / No`

---

## Critical Events Log

Use this section to document any incidents, anomalies, or manual interventions:

### Event 1
- **Time:** `_______________`
- **Severity:** `Critical / High / Medium / Low`
- **Description:** `_______________`
- **Action Taken:** `_______________`
- **Resolution:** `_______________`

### Event 2
- **Time:** `_______________`
- **Severity:** `Critical / High / Medium / Low`
- **Description:** `_______________`
- **Action Taken:** `_______________`
- **Resolution:** `_______________`

### Event 3
- **Time:** `_______________`
- **Severity:** `Critical / High / Medium / Low`
- **Description:** `_______________`
- **Action Taken:** `_______________`
- **Resolution:** `_______________`

---

## Monitoring Commands

### Check Health Status
```bash
# Backend health
curl https://staging-api.pfavanguard.com/health

# Write sync worker health
curl https://staging-api.pfavanguard.com/health/write-sync

# Database health
curl https://staging-api.pfavanguard.com/health/db
```

### Check Queue Metrics
```bash
# Queue status
curl -H "Authorization: Bearer $TOKEN" \
  https://staging-api.pfavanguard.com/api/pems/queue-metrics

# Sync status for organization
curl -H "Authorization: Bearer $TOKEN" \
  "https://staging-api.pfavanguard.com/api/pems/sync-status?organizationId=org-rio"
```

### Check Process Status
```bash
# PM2 process list
pm2 list

# View real-time logs
pm2 logs pems-write-sync-worker --lines 100

# Memory usage
pm2 monit
```

### Check Database Status
```bash
# Connect to PostgreSQL
psql $DATABASE_URL

# Check connection count
SELECT count(*) FROM pg_stat_activity;

# Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

# Check slow queries
SELECT query, mean_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## Escalation Criteria

**STOP DEPLOYMENT** if any of the following occur:

1. **Critical Error Rate > 1%** - More than 1 in 100 syncs failing
2. **Queue Size > 1000** - Backlog growing uncontrollably
3. **Memory Leak Detected** - Memory growth > 50 MB/hour sustained
4. **Database Connection Failures** - Unable to connect to PostgreSQL
5. **PEMS API Authentication Failures** - Credential issues
6. **Sync Latency > 5 minutes (P95)** - System too slow
7. **WebSocket Disconnections > 50/hour** - Connection instability
8. **AWS Secrets Manager Access Failures** - Security infrastructure down
9. **Data Corruption Detected** - Incorrect data written to PEMS
10. **Security Vulnerability Discovered** - Immediate rollback required

**Contact:**
- **On-Call Engineer:** `_______________`
- **DevSecOps Lead:** `_______________`
- **Product Owner:** `_______________`

---

## Sign-Off

### 24-Hour Review
- **Date:** `_______________`
- **Reviewed By:** `_______________`
- **Status:** `PASS / FAIL / CONTINUE MONITORING`
- **Notes:** `_______________`

### 48-Hour Review
- **Date:** `_______________`
- **Reviewed By:** `_______________`
- **Status:** `READY FOR PRODUCTION / NEEDS MORE TIME / ROLLBACK`
- **Notes:** `_______________`

---

**Last Updated:** 2025-11-28
**Document Owner:** DevSecOps Team
**Related:** ADR-008 Phase 5, DEPLOYMENT_RUNBOOK.md, ROLLBACK_PLAN.md
