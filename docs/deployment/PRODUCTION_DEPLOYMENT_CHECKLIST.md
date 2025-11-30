# Production Deployment Checklist
## ADR-008 Phase 5: Task 5.2 - Production Deployment

**Deployment Date:** `_______________`
**Deployment Lead:** `_______________`
**Version:** `v4.0.0-phase4-bidirectional-sync`

---

## Pre-Deployment Sign-Off

- [ ] **Staging Deployment Successful**
  - Deployed on: `_______________`
  - Stable for 48 hours: `Yes / No`
  - All smoke tests passed: `Yes / No`

- [ ] **Monitoring Data Reviewed**
  - Error rate < 0.1%: `Yes / No`
  - Queue size < 100: `Yes / No`
  - Sync success rate > 99.9%: `Yes / No`
  - No memory leaks detected: `Yes / No`

- [ ] **Stakeholder Approvals**
  - Product Owner: `Approved / Declined`
  - DevSecOps Lead: `Approved / Declined`
  - Security Team: `Approved / Declined`

- [ ] **Deployment Window Scheduled**
  - Date/Time: `_______________`
  - Duration: `___ hours`
  - Users notified: `Yes / No`

---

## T-24 Hours: Preparation

### Code & Build

- [ ] **Git Tag Created**
  ```bash
  git tag -a v4.0.0-phase4-bidirectional-sync -m "ADR-008 Phase 4: Bi-directional PEMS Sync"
  git push origin v4.0.0-phase4-bidirectional-sync
  ```
  - Tag created: `Yes / No`
  - Tag pushed: `Yes / No`

- [ ] **Build Artifacts Created**
  - Backend build successful: `Yes / No`
  - Frontend build successful: `Yes / No`
  - All tests passing: `Yes / No`

### Infrastructure

- [ ] **AWS Secrets Manager Verified**
  - PEMS API credentials: `Valid / Invalid`
  - Database credentials: `Valid / Invalid`
  - Redis credentials: `Valid / Invalid`
  - Gemini API key: `Valid / Invalid`

- [ ] **Database Backup Created**
  ```bash
  pg_dump $DATABASE_URL_PRODUCTION > backup_prod_$(date +%Y%m%d_%H%M%S).sql
  aws s3 cp backup_prod_*.sql s3://pfavanguard-backups/
  ```
  - Backup created: `Yes / No`
  - Backup uploaded to S3: `Yes / No`
  - Backup size: `_____ GB`
  - Backup verified: `Yes / No`

- [ ] **Redis Verified**
  ```bash
  redis-cli -u $REDIS_URL_PRODUCTION ping
  ```
  - Redis responding: `Yes / No`
  - Memory usage < 70%: `Yes / No`

### Monitoring

- [ ] **Grafana Dashboards Ready**
  - System Health dashboard: `Configured`
  - Sync Performance dashboard: `Configured`
  - Conflict Management dashboard: `Configured`
  - Cost Optimization dashboard: `Configured`

- [ ] **Alert Rules Configured**
  - P1 alerts: `___ rules` configured
  - P2 alerts: `___ rules` configured
  - P3 alerts: `___ rules` configured
  - PagerDuty integration: `Working / Broken`

- [ ] **On-Call Rotation Confirmed**
  - Primary on-call: `_______________`
  - Secondary on-call: `_______________`
  - PagerDuty schedule: `Verified`

### Documentation

- [ ] **Deployment Runbook Reviewed**
  - All steps clear: `Yes / No`
  - Commands tested in staging: `Yes / No`

- [ ] **Rollback Plan Reviewed**
  - Rollback steps documented: `Yes / No`
  - Rollback tested in staging: `Yes / No`
  - Estimated rollback time: `___ minutes`

- [ ] **Communication Plan**
  - Status page message drafted: `Yes / No`
  - Customer notification email drafted: `Yes / No`
  - Team Slack announcement drafted: `Yes / No`

---

## T-1 Hour: Final Checks

- [ ] **Team Ready**
  - DevSecOps engineer available: `Yes / No`
  - Backend engineer available: `Yes / No`
  - Database admin available: `Yes / No`
  - Product owner notified: `Yes / No`

- [ ] **Production Health Check**
  ```bash
  curl https://api.pfavanguard.com/health
  ```
  - Backend healthy: `Yes / No`
  - Database healthy: `Yes / No`
  - Error rate < 0.5%: `Yes / No`

- [ ] **Maintenance Window Announced**
  - Status page updated: `Yes / No`
  - Users notified: `Yes / No`
  - Expected downtime: `___ minutes`

- [ ] **Rollback Decision Point**
  - Go / No-Go decision: `GO / NO-GO`
  - Decision maker: `_______________`
  - Time: `_______________`

---

## T-0: Deployment Start

**Start Time:** `_______________`

### Step 1: Stop Sync Operations (2 minutes)

- [ ] **Disable Auto-Sync**
  ```bash
  # Update feature flag in database
  psql $DATABASE_URL_PRODUCTION -c "UPDATE feature_flags SET enabled = false WHERE flag_name = 'auto_sync';"
  ```
  - Feature flag disabled: `Yes / No`

- [ ] **Verify No Active Syncs**
  ```bash
  psql $DATABASE_URL_PRODUCTION -c "SELECT COUNT(*) FROM pfa_write_queue WHERE status = 'processing';"
  ```
  - Active syncs: `_____` (target: 0)

### Step 2: Database Migration (5 minutes)

- [ ] **Pre-Migration Backup**
  ```bash
  pg_dump $DATABASE_URL_PRODUCTION > backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql
  ```
  - Backup created: `Yes / No`
  - Start time: `_______________`

- [ ] **Apply Migrations**
  ```bash
  cd backend
  npx prisma migrate deploy
  ```
  - Migrations applied: `Yes / No`
  - New tables created: `Yes / No`
  - End time: `_______________`
  - Duration: `___ seconds`

- [ ] **Verify Migration**
  ```bash
  npx prisma migrate status
  psql $DATABASE_URL_PRODUCTION -c "\d pfa_write_queue"
  psql $DATABASE_URL_PRODUCTION -c "\d pfa_sync_conflict"
  ```
  - All migrations applied: `Yes / No`
  - Tables verified: `Yes / No`

### Step 3: Deploy Backend (10 minutes)

- [ ] **Stop Existing Backend**
  ```bash
  pm2 stop pfa-vanguard-backend
  ```
  - Backend stopped: `Yes / No`
  - Time: `_______________`

- [ ] **Build & Deploy**
  ```bash
  npm ci
  npm run build
  pm2 start ecosystem.config.js --only pfa-vanguard-backend --env production
  ```
  - Dependencies installed: `Yes / No`
  - Build successful: `Yes / No`
  - Backend started: `Yes / No`

- [ ] **Verify Backend Health**
  ```bash
  sleep 30
  curl https://api.pfavanguard.com/health
  ```
  - Health check passing: `Yes / No`
  - Response time < 500ms: `Yes / No`
  - Time: `_______________`

### Step 4: Deploy Sync Worker (5 minutes)

- [ ] **Start Sync Worker**
  ```bash
  pm2 start ecosystem.config.js --only pems-write-sync-worker --env production
  ```
  - Worker started: `Yes / No`
  - Time: `_______________`

- [ ] **Verify Worker Health**
  ```bash
  curl https://api.pfavanguard.com/health/write-sync
  ```
  - Worker running: `Yes / No`
  - Queue initialized: `Yes / No`

### Step 5: Deploy Frontend (15 minutes)

- [ ] **Build Frontend**
  ```bash
  cd ..
  npm ci
  npm run build
  ```
  - Build successful: `Yes / No`
  - Bundle size: `_____ MB`

- [ ] **Deploy to CDN**
  ```bash
  aws s3 sync dist/ s3://pfavanguard-frontend/ --delete
  ```
  - S3 upload successful: `Yes / No`
  - Files uploaded: `_____`

- [ ] **Invalidate Cache**
  ```bash
  aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DIST_ID --paths "/*"
  ```
  - Invalidation created: `Yes / No`
  - Invalidation ID: `_______________`

### Step 6: Smoke Tests (10 minutes)

- [ ] **Run Automated Smoke Tests**
  ```bash
  export SMOKE_TEST_TOKEN="your-production-admin-token"
  export PROD_API_URL="https://api.pfavanguard.com"
  cd backend
  npx tsx scripts/smoke-test-staging.ts --env=production
  ```
  - Tests started: `_______________`
  - Tests completed: `_______________`
  - All tests passed: `Yes / No`
  - Test results:
    - Health checks: `PASS / FAIL`
    - Authentication: `PASS / FAIL`
    - Sync status: `PASS / FAIL`
    - Queue metrics: `PASS / FAIL`
    - Manual sync trigger: `PASS / FAIL`

- [ ] **Manual Verification**
  - Login works: `Yes / No`
  - PFA data loads: `Yes / No`
  - Sync button visible: `Yes / No`
  - No console errors: `Yes / No`

### Step 7: Enable Features (2 minutes)

- [ ] **Enable Auto-Sync**
  ```bash
  psql $DATABASE_URL_PRODUCTION -c "UPDATE feature_flags SET enabled = true WHERE flag_name = 'auto_sync';"
  ```
  - Feature flag enabled: `Yes / No`

- [ ] **Remove Maintenance Mode**
  - Status page updated: `Yes / No`
  - Users notified: `Yes / No`

**Deployment Complete Time:** `_______________`
**Total Deployment Duration:** `___ minutes`

---

## Post-Deployment Verification (1 Hour)

### Immediate Checks (First 15 Minutes)

- [ ] **System Health**
  - Backend healthy: `Yes / No`
  - Sync worker healthy: `Yes / No`
  - Database connections < 50: `Yes / No`
  - Error rate < 0.5%: `Yes / No`

- [ ] **Sync Functionality**
  - Manual sync works: `Yes / No`
  - Queue processing: `Yes / No`
  - WebSocket connections: `_____`

- [ ] **Monitoring Active**
  - Grafana dashboards showing data: `Yes / No`
  - No critical alerts: `Yes / No`
  - Metrics flowing normally: `Yes / No`

### 30-Minute Checkpoint

- [ ] **Performance Metrics**
  - API response time (P95): `_____ ms` (target: < 500ms)
  - Sync latency (avg): `_____ min` (target: < 2 min)
  - Queue size: `_____` (target: < 100)
  - Error rate: `_____%` (target: < 0.1%)

- [ ] **Resource Utilization**
  - Backend CPU: `_____%` (target: < 60%)
  - Backend memory: `_____%` (target: < 70%)
  - Worker CPU: `_____%` (target: < 60%)
  - Worker memory: `_____%` (target: < 70%)
  - Database CPU: `_____%` (target: < 70%)

- [ ] **Log Review**
  ```bash
  pm2 logs --lines 200 --err
  ```
  - No critical errors: `Yes / No`
  - No authentication failures: `Yes / No`
  - No database errors: `Yes / No`

### 1-Hour Checkpoint

- [ ] **Stability Confirmed**
  - No crashes: `Yes / No`
  - No restarts required: `Yes / No`
  - No manual interventions: `Yes / No`

- [ ] **User Feedback**
  - Support tickets: `_____` (target: 0)
  - User complaints: `_____` (target: 0)
  - Positive feedback: `_____`

- [ ] **Sync Statistics**
  - Total syncs completed: `_____`
  - Success rate: `_____%` (target: > 99%)
  - Conflicts detected: `_____`
  - Failed syncs: `_____` (target: < 5)

---

## 24-Hour Stability Check

**Check Date/Time:** `_______________`
**Checked By:** `_______________`

- [ ] **Uptime**
  - Backend uptime: `_____%` (target: 100%)
  - Worker uptime: `_____%` (target: 100%)

- [ ] **Performance**
  - Avg sync latency: `_____ min` (target: < 2 min)
  - P99 sync latency: `_____ min` (target: < 10 min)
  - Error rate: `_____%` (target: < 0.1%)

- [ ] **Resource Trends**
  - Memory growth rate: `_____ MB/hour` (target: < 10)
  - CPU trend: `Stable / Increasing / Decreasing`

- [ ] **Queue Health**
  - Max queue size (24h): `_____` (target: < 200)
  - Avg queue size: `_____` (target: < 50)
  - Failed items: `_____` (target: < 20)

- [ ] **Conflicts**
  - Total conflicts: `_____`
  - Auto-resolved: `_____`
  - Manual resolution needed: `_____`

**24-Hour Status:** `STABLE / NEEDS ATTENTION / ROLLBACK REQUIRED`

---

## Rollback Decision Points

### Immediate Rollback If:

- [ ] Smoke tests fail
- [ ] Critical errors > 10 in first hour
- [ ] Error rate > 5% sustained
- [ ] Complete system outage > 5 minutes
- [ ] Data corruption detected
- [ ] Security vulnerability discovered

**Rollback Initiated:** `Yes / No`
**Rollback Start Time:** `_______________`
**Rollback Completed Time:** `_______________`

### Conditional Rollback If:

- [ ] Error rate 1-5% after 1 hour
- [ ] Sync success rate < 95%
- [ ] Queue size > 1000 and growing
- [ ] Multiple P1 alerts
- [ ] Major feature non-functional

**Decision:** `ROLLBACK / PATCH / MONITOR`
**Decision Maker:** `_______________`

---

## Post-Deployment Tasks

- [ ] **Update Documentation**
  - DEVELOPMENT_LOG.md updated: `Yes / No`
  - ADR-008 marked as DEPLOYED: `Yes / No`

- [ ] **Notify Stakeholders**
  - Product Owner notified: `Yes / No`
  - Team announcement: `Yes / No`
  - Customer email sent: `Yes / No`

- [ ] **Archive Deployment Logs**
  ```bash
  pm2 logs --lines 1000 > deployment-logs-$(date +%Y%m%d).txt
  aws s3 cp deployment-logs-*.txt s3://pfavanguard-deployment-logs/
  ```
  - Logs archived: `Yes / No`

- [ ] **Schedule Retrospective**
  - Meeting scheduled: `Yes / No`
  - Date/Time: `_______________`
  - Attendees invited: `Yes / No`

---

## Deployment Metrics Summary

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Total deployment time | < 60 min | `_____` | ☐ |
| Database migration time | < 5 min | `_____` | ☐ |
| Backend downtime | < 2 min | `_____` | ☐ |
| Frontend downtime | 0 min | `_____` | ☐ |
| Smoke test success rate | 100% | `_____` | ☐ |
| First hour error rate | < 0.5% | `_____` | ☐ |
| 24-hour uptime | 100% | `_____` | ☐ |
| Rollback required | No | `_____` | ☐ |

---

## Sign-Off

### Deployment Complete

- **Deployed By:** `_______________`
- **Date/Time:** `_______________`
- **Deployment Status:** `SUCCESS / FAILED / ROLLED BACK`
- **Notes:** `_______________`

### 24-Hour Stability Confirmation

- **Verified By:** `_______________`
- **Date/Time:** `_______________`
- **Status:** `STABLE / NEEDS MONITORING / ISSUES DETECTED`
- **Notes:** `_______________`

### Deployment Closure

- **Closed By:** `_______________`
- **Date/Time:** `_______________`
- **Final Status:** `COMPLETE / MONITORING ONGOING`
- **Lessons Learned:** `_______________`

---

**Document Version:** 1.0.0
**Last Updated:** 2025-11-28

**Related Documents:**
- [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md)
- [STAGING_MONITORING_CHECKLIST.md](./STAGING_MONITORING_CHECKLIST.md)
- [MONITORING_PLAYBOOK.md](./MONITORING_PLAYBOOK.md)
- [ROLLBACK_PLAN.md](./ROLLBACK_PLAN.md)
