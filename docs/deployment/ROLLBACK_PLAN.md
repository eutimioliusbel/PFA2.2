# Rollback Plan
## ADR-008 Phase 5: Emergency Rollback Procedures

**Version:** 1.0.0
**Last Updated:** 2025-11-28
**Document Owner:** DevSecOps Team

---

## Table of Contents

1. [Rollback Decision Matrix](#rollback-decision-matrix)
2. [Quick Rollback (< 10 minutes)](#quick-rollback--10-minutes)
3. [Full Rollback (< 30 minutes)](#full-rollback--30-minutes)
4. [Database Rollback](#database-rollback)
5. [Partial Rollback Scenarios](#partial-rollback-scenarios)
6. [Post-Rollback Verification](#post-rollback-verification)
7. [Rollback Retrospective](#rollback-retrospective)

---

## Rollback Decision Matrix

### When to Rollback

**IMMEDIATE ROLLBACK** - Execute within 5 minutes if:
- [ ] Critical security vulnerability discovered
- [ ] Data corruption or data loss detected
- [ ] Complete system outage (> 5 minutes)
- [ ] Error rate > 10% sustained for 5 minutes
- [ ] Database connection failures preventing all operations
- [ ] PEMS API authentication completely broken

**SCHEDULED ROLLBACK** - Plan within 30 minutes if:
- [ ] Error rate 1-10% sustained for 15 minutes
- [ ] Sync success rate < 90% for 30 minutes
- [ ] Queue size > 1000 and growing for 30 minutes
- [ ] Memory leak causing crashes every < 30 minutes
- [ ] Critical feature completely non-functional
- [ ] Multiple P1 alerts firing simultaneously

**MONITOR & PATCH** - No rollback if:
- [ ] Error rate < 1% with no data integrity issues
- [ ] Performance degradation but system functional
- [ ] Non-critical feature issues
- [ ] Fix can be deployed within 2 hours

### Rollback Authorization

| Scenario | Authorized Decision Maker | Notification Required |
|----------|---------------------------|----------------------|
| Production P1 Alert | On-Call Engineer + DevSecOps Lead | Product Owner, Team |
| Staging Critical Issue | On-Call Engineer | DevSecOps Lead |
| Security Incident | Security Team + DevSecOps Lead | Legal, Executives, Customers |
| Data Corruption | DevSecOps Lead + Database Admin | Product Owner, Compliance |

---

## Quick Rollback (< 10 minutes)

**Use Case:** Emergency rollback when deployment is clearly broken.

**Objective:** Restore service to last known good state as fast as possible.

### Step 1: Stop Sync Worker (1 minute)

```bash
# CRITICAL: Stop sync worker FIRST to prevent data corruption
pm2 stop pems-write-sync-worker

# Verify stopped
pm2 list | grep pems-write-sync-worker
# Expected: status = "stopped"

# Log action
echo "[$(date)] Sync worker stopped for rollback - Ticket: INCIDENT-XXX" >> /var/log/pfa/rollback.log
```

**Why this matters:** Prevents new writes to PEMS during rollback, avoiding data inconsistency.

### Step 2: Revert Backend Code (3 minutes)

```bash
# 1. Identify previous stable version
git tag -l "v*" | tail -5
# Expected: v3.0.0 = last stable version

# 2. Checkout previous version
git checkout v3.0.0

# 3. Navigate to backend
cd backend

# 4. Install dependencies (use cache if available)
npm ci

# 5. Build backend
npm run build

# 6. Restart backend
pm2 restart pfa-vanguard-backend

# 7. Verify backend restarted
pm2 list | grep pfa-vanguard-backend
# Expected: status = "online"
```

### Step 3: Verify Backend Health (2 minutes)

```bash
# 1. Wait for backend to stabilize
sleep 15

# 2. Check health endpoint
curl https://api.pfavanguard.com/health
# Expected: {"status":"healthy"}

# 3. Check error logs
pm2 logs pfa-vanguard-backend --err --lines 50
# Expected: No critical errors

# 4. Test authentication
curl -H "Authorization: Bearer $TEST_TOKEN" \
  https://api.pfavanguard.com/api/pfa-data?organizationId=org-rio
# Expected: 200 OK
```

### Step 4: Revert Frontend (2 minutes)

```bash
# 1. Navigate to project root
cd ..

# 2. Build frontend from v3.0.0 code
npm ci
npm run build

# 3. Deploy to production CDN
aws s3 sync dist/ s3://pfavanguard-frontend/ --delete

# 4. Invalidate CloudFront cache (if applicable)
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_DIST_ID \
  --paths "/*"

# 5. Verify frontend loads
curl https://pfavanguard.com
# Expected: HTML page returned
```

### Step 5: Announce Rollback (2 minutes)

```bash
# 1. Update status page
# Mark incident as "Investigating - Rollback in progress"

# 2. Notify team
# Slack: #incidents channel
# Message: "🔴 ROLLBACK IN PROGRESS: ADR-008 deployment rolled back to v3.0.0 due to {reason}. ETA: 5 minutes. Incident: INCIDENT-XXX"

# 3. Log rollback completion
echo "[$(date)] Rollback to v3.0.0 completed - Duration: $(timer) - Ticket: INCIDENT-XXX" >> /var/log/pfa/rollback.log

# 4. Verify system stable
# Monitor for 15 minutes before declaring success
```

**Total Time:** ~10 minutes

**Recovery Point:** Last committed transaction before deployment

**Data Loss:** None (sync worker stopped before rollback)

---

## Full Rollback (< 30 minutes)

**Use Case:** Complete rollback including database migration reversal.

**Objective:** Return entire system (code + database) to pre-deployment state.

### Step 1: Stop All Services (2 minutes)

```bash
# 1. Stop sync worker
pm2 stop pems-write-sync-worker

# 2. Stop backend (graceful shutdown)
pm2 stop pfa-vanguard-backend

# 3. Verify all stopped
pm2 list
# Expected: All PFA processes "stopped"

# 4. Announce maintenance
# Status page: "Emergency maintenance in progress"
# Slack: "🔴 SYSTEM OFFLINE: Full rollback initiated"
```

### Step 2: Rollback Database Migration (10 minutes)

**CRITICAL:** Database rollback is irreversible. Verify backup exists before proceeding.

```bash
# 1. Verify backup exists
aws s3 ls s3://pfavanguard-backups/ | grep "$(date +%Y%m%d)"
# Expected: Recent backup file listed

# 2. Navigate to backend directory
cd backend

# 3. Check current migration status
npx prisma migrate status
# Note the latest applied migration

# 4. Mark problematic migration as rolled back
npx prisma migrate resolve --rolled-back 20251128000003_phase4_bidirectional_sync_infrastructure

# 5. Verify migration marked as rolled back
npx prisma migrate status
# Expected: Migration marked as "rolled back"

# 6. Connect to database and verify tables
psql $DATABASE_URL

-- Check if new tables still exist (they will)
\dt pfa_write_queue
\dt pfa_sync_conflict

-- These tables will remain but won't be used by v3.0.0 code
-- They can be dropped manually after confirming rollback successful:
-- DROP TABLE pfa_write_queue CASCADE;
-- DROP TABLE pfa_sync_conflict CASCADE;
-- DROP TABLE pfa_modification CASCADE; -- Only if added in v4.0.0
```

**Alternative: Full Database Restore (if data corruption occurred)**

```bash
# ONLY USE IF DATA CORRUPTION DETECTED

# 1. Download latest backup
aws s3 cp s3://pfavanguard-backups/backup_prod_$(date +%Y%m%d).sql /tmp/

# 2. Drop existing database (DESTRUCTIVE)
# WARNING: All data since backup will be lost
dropdb $DATABASE_NAME

# 3. Create fresh database
createdb $DATABASE_NAME

# 4. Restore from backup
psql $DATABASE_URL < /tmp/backup_prod_$(date +%Y%m%d).sql

# 5. Verify restoration
psql $DATABASE_URL -c "SELECT COUNT(*) FROM pfa_records;"
# Expected: Record count matches pre-deployment count
```

### Step 3: Revert Code (5 minutes)

```bash
# 1. Checkout previous stable version
git checkout v3.0.0

# 2. Install dependencies
cd backend
npm ci
cd ..
npm ci

# 3. Build backend
cd backend
npm run build

# 4. Build frontend
cd ..
npm run build
```

### Step 4: Deploy Previous Version (8 minutes)

```bash
# 1. Start backend
pm2 start ecosystem.config.js --only pfa-vanguard-backend --env production

# 2. Wait for backend to stabilize
sleep 30

# 3. Verify backend health
curl https://api.pfavanguard.com/health

# 4. Deploy frontend
aws s3 sync dist/ s3://pfavanguard-frontend/ --delete
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DIST_ID --paths "/*"

# 5. Verify frontend loads
curl https://pfavanguard.com
```

### Step 5: Post-Rollback Verification (5 minutes)

See [Post-Rollback Verification](#post-rollback-verification) section below.

---

## Database Rollback

### Scenario 1: Migration Applied, No Data Written

**Situation:** Migration ran successfully but no production data written to new tables.

**Action:** Mark migration as rolled back, no data loss risk.

```bash
npx prisma migrate resolve --rolled-back 20251128000003_phase4_bidirectional_sync_infrastructure
```

### Scenario 2: Migration Applied, Data Written, No Corruption

**Situation:** New tables contain data but old tables unaffected.

**Action:** Mark migration as rolled back. New table data orphaned but not deleted.

```bash
# 1. Mark migration as rolled back
npx prisma migrate resolve --rolled-back 20251128000003_phase4_bidirectional_sync_infrastructure

# 2. Data in pfa_write_queue, pfa_sync_conflict remains
# v3.0.0 code will ignore these tables

# 3. After confirming rollback successful, manually drop tables:
psql $DATABASE_URL <<EOF
DROP TABLE IF EXISTS pfa_write_queue CASCADE;
DROP TABLE IF EXISTS pfa_sync_conflict CASCADE;
EOF
```

### Scenario 3: Data Corruption Detected

**Situation:** Bad data written to production tables.

**Action:** Full database restore from backup.

**Recovery Point Objective (RPO):** Up to 24 hours (daily backups)

**Recovery Time Objective (RTO):** 30 minutes

```bash
# See "Full Database Restore" in Full Rollback section above
```

### Migration Rollback Script

**File:** `backend/prisma/migrations/20251128000003_phase4_bidirectional_sync_infrastructure/down.sql`

```sql
-- Rollback script for ADR-008 Phase 4 migration
-- WARNING: This drops tables and data. Use only in emergency.

BEGIN;

-- Drop new tables
DROP TABLE IF EXISTS pfa_sync_conflict CASCADE;
DROP TABLE IF EXISTS pfa_write_queue CASCADE;

-- Remove columns added to existing tables
ALTER TABLE pfa_modification
  DROP COLUMN IF EXISTS sync_status,
  DROP COLUMN IF EXISTS synced_at,
  DROP COLUMN IF EXISTS sync_error,
  DROP COLUMN IF EXISTS pems_version;

COMMIT;
```

**Execute rollback:**

```bash
psql $DATABASE_URL < backend/prisma/migrations/20251128000003_phase4_bidirectional_sync_infrastructure/down.sql
```

---

## Partial Rollback Scenarios

### Scenario A: Rollback Sync Worker Only (Keep Backend/Frontend)

**Use Case:** Sync functionality broken but rest of system working.

```bash
# 1. Stop sync worker
pm2 stop pems-write-sync-worker

# 2. Disable sync UI features (feature flag)
# Update feature_flags table
psql $DATABASE_URL -c "UPDATE feature_flags SET enabled = false WHERE flag_name = 'bi_directional_sync';"

# 3. Backend/Frontend continue serving read operations
# Users can view data but not trigger syncs

# 4. Notify users
# In-app banner: "Sync temporarily disabled. Read-only mode."
```

### Scenario B: Rollback Backend Only (Keep Frontend on v4.0.0)

**Use Case:** Backend API issues but frontend compatible with v3.0.0 API.

```bash
# 1. Stop backend
pm2 stop pfa-vanguard-backend

# 2. Revert backend code
git checkout v3.0.0 -- backend/
cd backend
npm ci
npm run build

# 3. Restart backend
pm2 start ecosystem.config.js --only pfa-vanguard-backend

# 4. Verify API compatibility
# Test critical endpoints used by frontend
curl -H "Authorization: Bearer $TOKEN" https://api.pfavanguard.com/api/pfa-data
```

### Scenario C: Rollback Frontend Only (Keep Backend on v4.0.0)

**Use Case:** Frontend UI issues but backend API functional.

```bash
# 1. Checkout v3.0.0 frontend code
git checkout v3.0.0 -- src/ components/ index.tsx

# 2. Rebuild frontend
npm ci
npm run build

# 3. Deploy to CDN
aws s3 sync dist/ s3://pfavanguard-frontend/ --delete
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DIST_ID --paths "/*"

# 4. Verify frontend loads and communicates with v4.0.0 backend
```

---

## Post-Rollback Verification

### Verification Checklist (15 minutes)

- [ ] **1. Health Endpoints**
  ```bash
  curl https://api.pfavanguard.com/health
  # Expected: {"status":"healthy"}

  curl https://api.pfavanguard.com/health/db
  # Expected: {"status":"healthy"}
  ```

- [ ] **2. Authentication**
  ```bash
  curl -X POST https://api.pfavanguard.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test-user","password":"test-pass"}'
  # Expected: 200 OK with JWT token
  ```

- [ ] **3. Read Operations**
  ```bash
  curl -H "Authorization: Bearer $TOKEN" \
    "https://api.pfavanguard.com/api/pfa-data?organizationId=org-rio"
  # Expected: 200 OK with PFA data
  ```

- [ ] **4. Write Operations**
  ```bash
  curl -X POST https://api.pfavanguard.com/api/pfa-data \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"organizationId":"org-rio","pfaId":"TEST-001","category":"Equipment"}'
  # Expected: 200 OK
  ```

- [ ] **5. Frontend Loads**
  ```bash
  curl https://pfavanguard.com
  # Expected: HTML page with correct version metadata
  ```

- [ ] **6. Database Connectivity**
  ```bash
  psql $DATABASE_URL -c "SELECT COUNT(*) FROM pfa_records;"
  # Expected: Pre-deployment record count
  ```

- [ ] **7. Error Logs Clean**
  ```bash
  pm2 logs pfa-vanguard-backend --err --lines 100
  # Expected: No critical errors
  ```

- [ ] **8. Monitoring Dashboards**
  - Open Grafana: https://grafana.pfavanguard.com
  - Verify metrics returning to normal
  - Error rate < 0.1%
  - Response times < 500ms

- [ ] **9. User Acceptance Testing**
  - Login as test user
  - View PFA data
  - Filter/sort data
  - Export CSV
  - Verify all core features functional

- [ ] **10. Monitor for 30 Minutes**
  - Watch for error rate spikes
  - Monitor resource utilization
  - Check for memory leaks
  - Verify no new alerts firing

### Success Criteria

Rollback is considered successful when:
- ✅ All health endpoints returning healthy
- ✅ Error rate < 0.5% for 30 minutes
- ✅ No P1/P2 alerts firing
- ✅ User acceptance tests passing
- ✅ No data loss confirmed
- ✅ System performance matches pre-deployment baseline

---

## Rollback Retrospective

### Immediate Post-Rollback (Within 1 hour)

**Document in Incident Report:**

1. **Timeline**
   - Deployment start time: `_______________`
   - Issue detected time: `_______________`
   - Rollback initiated time: `_______________`
   - Rollback completed time: `_______________`
   - Total downtime: `_______________`

2. **Root Cause**
   - What broke: `_______________`
   - Why it broke: `_______________`
   - Why it wasn't caught in staging: `_______________`

3. **Impact**
   - Users affected: `_______________`
   - Transactions lost: `_______________`
   - Data corrupted: `_______________`
   - Revenue impact: `_______________`

4. **Actions Taken**
   - Rollback type: Quick / Full / Partial
   - Database rollback: Yes / No
   - Data restoration: Yes / No
   - Customer notification: Yes / No

### Follow-Up Actions (Within 3 days)

- [ ] **Root Cause Analysis (RCA) Document**
  - Deep technical analysis of failure
  - Timeline with detailed event log
  - Contributing factors identified

- [ ] **Corrective Actions**
  - Fix identified in development
  - Additional tests added
  - Staging environment improved
  - Deployment process updated

- [ ] **Preventive Measures**
  - Pre-deployment checklist updated
  - Monitoring alerts added
  - Smoke tests enhanced
  - Documentation improved

- [ ] **Team Retrospective Meeting**
  - What went wrong?
  - What went right?
  - What can we improve?
  - Action items assigned

### Incident Report Template

**File:** `docs/incidents/INCIDENT-{date}-rollback.md`

```markdown
# Incident Report: ADR-008 Rollback

**Incident ID:** INCIDENT-XXX
**Date:** YYYY-MM-DD
**Severity:** P1 / P2 / P3
**Status:** Resolved / Investigating

## Summary
Brief description of the incident and rollback.

## Timeline
- **HH:MM** - Deployment started
- **HH:MM** - Issue first detected
- **HH:MM** - Rollback decision made
- **HH:MM** - Rollback initiated
- **HH:MM** - Rollback completed
- **HH:MM** - System verified stable

## Root Cause
Technical explanation of what caused the failure.

## Impact
- Users affected: {count}
- Downtime: {duration}
- Data loss: Yes/No - {details}

## Resolution
Steps taken to resolve the incident.

## Lessons Learned
- What worked well
- What needs improvement
- Action items

## Action Items
- [ ] Item 1 - Owner - Due Date
- [ ] Item 2 - Owner - Due Date
```

---

## Rollback Testing

**Recommendation:** Test rollback procedure in staging quarterly.

### Rollback Drill Procedure

```bash
# 1. Schedule drill (announce to team)
# Subject: "Rollback drill scheduled for YYYY-MM-DD at HH:MM"

# 2. Deploy ADR-008 to staging
# Follow DEPLOYMENT_RUNBOOK.md

# 3. Wait 1 hour (simulate production soak time)

# 4. Execute rollback procedure
# Follow this ROLLBACK_PLAN.md

# 5. Time each step
# Record actual times vs. documented times

# 6. Identify gaps
# Update documentation with learnings

# 7. Retrospective
# Team meeting to discuss drill results
```

---

**Document Version:** 1.0.0
**Last Rollback Date:** `Never (initial deployment)`
**Last Drill Date:** `_______________`
**Next Drill Date:** `_______________`

**Related Documents:**
- [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md)
- [STAGING_MONITORING_CHECKLIST.md](./STAGING_MONITORING_CHECKLIST.md)
- [MONITORING_PLAYBOOK.md](./MONITORING_PLAYBOOK.md)
