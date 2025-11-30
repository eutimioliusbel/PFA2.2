# Deployment Runbook
## ADR-008 Phase 5: Bi-directional PEMS Synchronization

**Version:** 1.0.0
**Last Updated:** 2025-11-28
**Document Owner:** DevSecOps Team

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Staging Deployment](#staging-deployment)
3. [Production Deployment](#production-deployment)
4. [Verification Procedures](#verification-procedures)
5. [Rollback Procedures](#rollback-procedures)
6. [Emergency Contacts](#emergency-contacts)
7. [Known Issues & Workarounds](#known-issues--workarounds)

---

## Pre-Deployment Checklist

### Code Readiness (15 Items)

- [ ] **1. All tests passing**
  - [ ] Unit tests: `npm run test:unit`
  - [ ] Integration tests: `npm run test:integration`
  - [ ] Security tests: `npm run test:security`
  - [ ] Performance tests: `npm run test:performance`

- [ ] **2. Code review completed**
  - [ ] PR approved by at least 2 reviewers
  - [ ] Security review completed
  - [ ] No unresolved comments

- [ ] **3. Database migrations ready**
  - [ ] Migration scripts tested locally
  - [ ] Rollback migrations prepared
  - [ ] Migration run time estimated (< 5 minutes)

- [ ] **4. Environment variables configured**
  - [ ] `.env.staging` file verified
  - [ ] `.env.production` file verified
  - [ ] AWS Secrets Manager secrets created
  - [ ] Redis connection strings configured

- [ ] **5. Dependencies updated**
  - [ ] `npm audit` shows no critical vulnerabilities
  - [ ] All dependencies at latest stable versions
  - [ ] Lock files committed

- [ ] **6. Build artifacts created**
  - [ ] Frontend build successful: `npm run build`
  - [ ] Backend build successful: `cd backend && npm run build`
  - [ ] Docker images built (if applicable)

- [ ] **7. API credentials validated**
  - [ ] PEMS API credentials tested
  - [ ] AWS credentials configured
  - [ ] Redis credentials configured
  - [ ] Gemini API key validated

- [ ] **8. Git tags created**
  - [ ] Tag format: `v4.0.0-phase4-bidirectional-sync`
  - [ ] Tag pushed to remote

- [ ] **9. Deployment window scheduled**
  - [ ] Team notified
  - [ ] Maintenance window announced to users
  - [ ] On-call rotation confirmed

- [ ] **10. Backup procedures verified**
  - [ ] Database backup tested
  - [ ] Backup restoration tested
  - [ ] Backup retention policy confirmed

- [ ] **11. Monitoring configured**
  - [ ] Grafana dashboards created
  - [ ] Alert rules configured
  - [ ] PagerDuty integration tested

- [ ] **12. Documentation updated**
  - [ ] API documentation current
  - [ ] ADR-008 marked as implemented
  - [ ] DEVELOPMENT_LOG.md updated

- [ ] **13. Rollback plan reviewed**
  - [ ] Rollback steps documented
  - [ ] Rollback tested in staging
  - [ ] Rollback time estimated (< 10 minutes)

- [ ] **14. Security checklist completed**
  - [ ] No hardcoded secrets
  - [ ] API keys in AWS Secrets Manager
  - [ ] CORS policies reviewed
  - [ ] Rate limiting configured

- [ ] **15. Stakeholder approval**
  - [ ] Product Owner sign-off
  - [ ] Security team approval
  - [ ] DevOps team ready

---

## Staging Deployment

### Step 1: Pre-Deployment Verification (10 minutes)

```bash
# 1. Verify you're on the correct branch
git branch --show-current
# Expected: master or release branch

# 2. Verify latest code
git pull origin master
git log -1 --oneline

# 3. Verify environment
export DEPLOY_ENV=staging
echo $DEPLOY_ENV

# 4. Verify AWS credentials
aws sts get-caller-identity

# 5. Verify database access
psql $DATABASE_URL_STAGING -c "SELECT version();"
```

### Step 2: Database Migration (5 minutes)

```bash
# 1. Navigate to backend directory
cd backend

# 2. Verify current migration status
npx prisma migrate status

# 3. Create backup before migration
pg_dump $DATABASE_URL_STAGING > backup_$(date +%Y%m%d_%H%M%S).sql

# 4. Apply migrations
npx prisma migrate deploy

# 5. Verify migration success
npx prisma migrate status
# Expected: All migrations applied

# 6. Verify table structure
psql $DATABASE_URL_STAGING -c "\d pfa_write_queue"
psql $DATABASE_URL_STAGING -c "\d pfa_sync_conflict"
```

**Expected Output:**
- All migrations marked as "Applied"
- New tables: `pfa_write_queue`, `pfa_sync_conflict`
- New columns in `pfa_modification`: `syncStatus`, `syncedAt`, `syncError`, `pemsVersion`

### Step 3: Build and Deploy Backend (10 minutes)

```bash
# 1. Install dependencies
npm ci

# 2. Run TypeScript build
npm run build

# 3. Verify build artifacts
ls -la dist/

# 4. Stop existing backend (if running)
pm2 stop pfa-vanguard-backend || true

# 5. Deploy new backend
pm2 start ecosystem.config.js --only pfa-vanguard-backend --env staging

# 6. Verify backend started
pm2 list
pm2 logs pfa-vanguard-backend --lines 50

# 7. Wait for backend to stabilize (30 seconds)
sleep 30

# 8. Verify health endpoint
curl https://staging-api.pfavanguard.com/health
# Expected: {"status":"healthy"}
```

### Step 4: Deploy Sync Worker (5 minutes)

```bash
# 1. Verify sync worker configuration
cat ecosystem.config.js | grep -A 10 "pems-write-sync-worker"

# 2. Start sync worker
pm2 start ecosystem.config.js --only pems-write-sync-worker --env staging

# 3. Verify worker started
pm2 list | grep pems-write-sync-worker

# 4. Check worker logs
pm2 logs pems-write-sync-worker --lines 50

# 5. Verify worker health endpoint
curl https://staging-api.pfavanguard.com/health/write-sync
# Expected: {"worker":{"running":true},"queue":{"size":0}}
```

### Step 5: Build and Deploy Frontend (15 minutes)

```bash
# 1. Navigate to project root
cd ..

# 2. Install dependencies
npm ci

# 3. Build frontend
npm run build

# 4. Verify build artifacts
ls -la dist/

# 5. Deploy to CDN/static hosting
# AWS S3 example:
aws s3 sync dist/ s3://staging-pfavanguard-frontend/ --delete

# Or Netlify/Vercel:
netlify deploy --prod --dir=dist

# 6. Verify deployment
curl https://staging.pfavanguard.com
# Expected: HTML page loads
```

### Step 6: Run Smoke Tests (10 minutes)

```bash
# 1. Configure smoke test credentials
export SMOKE_TEST_TOKEN="your-staging-admin-token"
export SMOKE_TEST_ORG_ID="org-rio"
export STAGING_API_URL="https://staging-api.pfavanguard.com"

# 2. Run smoke tests
cd backend
npx tsx scripts/smoke-test-staging.ts --env=staging

# 3. Verify all tests passed
# Expected: ✅ ALL SMOKE TESTS PASSED
```

**If smoke tests fail:** See [Rollback Procedures](#rollback-procedures)

### Step 7: Post-Deployment Verification (15 minutes)

```bash
# 1. Verify all services running
pm2 list
# Expected: All services "online"

# 2. Check error logs
pm2 logs --err --lines 100
# Expected: No critical errors

# 3. Verify database connections
psql $DATABASE_URL_STAGING -c "SELECT count(*) FROM pg_stat_activity WHERE application_name LIKE '%pfa%';"
# Expected: < 50 connections

# 4. Verify Redis connection
redis-cli -u $REDIS_URL_STAGING ping
# Expected: PONG

# 5. Test manual sync trigger
curl -X POST https://staging-api.pfavanguard.com/api/pems/write-sync \
  -H "Authorization: Bearer $SMOKE_TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"org-rio"}'
# Expected: {"message":"Sync triggered","queueSize":0}

# 6. Monitor queue for 5 minutes
watch -n 10 'curl -H "Authorization: Bearer $TOKEN" https://staging-api.pfavanguard.com/api/pems/queue-metrics'

# 7. Verify WebSocket connection
# Use browser console:
# ws = new WebSocket('wss://staging-api.pfavanguard.com/ws/sync-status')
# ws.onopen = () => console.log('Connected')
```

### Step 8: Start 48-Hour Monitoring (Ongoing)

```bash
# 1. Open monitoring checklist
cat docs/STAGING_MONITORING_CHECKLIST.md

# 2. Set monitoring alarms
# - Grafana dashboard: https://grafana.pfavanguard.com/d/staging-sync
# - PagerDuty: Verify on-call schedule

# 3. Begin hourly checks
# Follow STAGING_MONITORING_CHECKLIST.md

# 4. Document any incidents
# Update STAGING_MONITORING_CHECKLIST.md > Critical Events Log
```

---

## Production Deployment

**CRITICAL:** Only proceed if staging has been stable for 48 hours with no critical issues.

### Pre-Production Checklist

- [ ] Staging deployed successfully
- [ ] 48-hour monitoring completed
- [ ] All smoke tests passed
- [ ] No critical issues in staging
- [ ] Team sign-off received
- [ ] Maintenance window scheduled
- [ ] Rollback plan reviewed

### Step 1: Create Git Tag (2 minutes)

```bash
# 1. Verify you're on master branch
git checkout master
git pull origin master

# 2. Create annotated tag
git tag -a v4.0.0-phase4-bidirectional-sync -m "ADR-008 Phase 4: Bi-directional PEMS Sync"

# 3. Push tag to remote
git push origin v4.0.0-phase4-bidirectional-sync

# 4. Verify tag
git tag -l "v4.0.0*"
```

### Step 2: Database Migration (5 minutes)

```bash
# 1. Set production environment
export DEPLOY_ENV=production
export DATABASE_URL=$DATABASE_URL_PRODUCTION

# 2. Create pre-migration backup
pg_dump $DATABASE_URL > backup_prod_$(date +%Y%m%d_%H%M%S).sql

# 3. Upload backup to S3
aws s3 cp backup_prod_*.sql s3://pfavanguard-backups/

# 4. Apply migrations
cd backend
npx prisma migrate deploy

# 5. Verify migration success
npx prisma migrate status
```

### Step 3: Deploy Backend (10 minutes)

```bash
# Follow same steps as staging deployment
# Replace staging URLs with production URLs

# 1. Build backend
npm ci
npm run build

# 2. Stop existing backend
pm2 stop pfa-vanguard-backend

# 3. Start new backend
pm2 start ecosystem.config.js --only pfa-vanguard-backend --env production

# 4. Verify health
curl https://api.pfavanguard.com/health
```

### Step 4: Deploy Sync Worker (5 minutes)

```bash
# 1. Start sync worker
pm2 start ecosystem.config.js --only pems-write-sync-worker --env production

# 2. Verify worker health
curl https://api.pfavanguard.com/health/write-sync
```

### Step 5: Deploy Frontend (15 minutes)

```bash
# 1. Build frontend
cd ..
npm ci
npm run build

# 2. Deploy to production CDN
aws s3 sync dist/ s3://pfavanguard-frontend/ --delete

# 3. Invalidate CloudFront cache (if using)
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DIST_ID --paths "/*"
```

### Step 6: Run Production Smoke Tests (10 minutes)

```bash
# 1. Configure for production
export SMOKE_TEST_TOKEN="your-production-admin-token"
export PROD_API_URL="https://api.pfavanguard.com"

# 2. Run smoke tests
cd backend
npx tsx scripts/smoke-test-staging.ts --env=production

# 3. Verify all tests passed
```

### Step 7: Monitor Production (First Hour)

```bash
# 1. Watch logs in real-time
pm2 logs --lines 200

# 2. Monitor queue metrics
watch -n 30 'curl -H "Authorization: Bearer $TOKEN" https://api.pfavanguard.com/api/pems/queue-metrics'

# 3. Check Grafana dashboards
# Open: https://grafana.pfavanguard.com/d/production-sync

# 4. Verify no alerts firing
# Check PagerDuty: https://pfavanguard.pagerduty.com
```

### Step 8: Announce Deployment Complete

```bash
# 1. Update status page
# Mark maintenance window complete

# 2. Notify team
# Slack: "#deployments" channel

# 3. Update documentation
# Mark ADR-008 as DEPLOYED in DEVELOPMENT_LOG.md
```

---

## Verification Procedures

### Health Check Verification

```bash
# Backend health
curl https://api.pfavanguard.com/health
# Expected: {"status":"healthy","timestamp":"..."}

# Database health
curl https://api.pfavanguard.com/health/db
# Expected: {"status":"healthy","connections":...}

# Write sync health
curl https://api.pfavanguard.com/health/write-sync
# Expected: {"worker":{"running":true},"queue":{"size":...}}
```

### Sync Functionality Verification

```bash
# 1. Trigger manual sync
curl -X POST https://api.pfavanguard.com/api/pems/write-sync \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"org-rio"}'

# 2. Check sync status
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.pfavanguard.com/api/pems/sync-status?organizationId=org-rio"

# 3. Verify queue metrics
curl -H "Authorization: Bearer $TOKEN" \
  https://api.pfavanguard.com/api/pems/queue-metrics

# 4. Check recent sync logs
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.pfavanguard.com/api/pems/sync-logs?organizationId=org-rio&limit=10"
```

### WebSocket Verification

```javascript
// Run in browser console
const ws = new WebSocket('wss://api.pfavanguard.com/ws/sync-status');

ws.onopen = () => {
  console.log('✅ WebSocket connected');
  ws.send(JSON.stringify({ type: 'subscribe', organizationId: 'org-rio' }));
};

ws.onmessage = (event) => {
  console.log('📨 Message received:', JSON.parse(event.data));
};

ws.onerror = (error) => {
  console.error('❌ WebSocket error:', error);
};
```

### Database Verification

```sql
-- Connect to database
psql $DATABASE_URL

-- Verify new tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'pfa_%';

-- Check write queue
SELECT status, COUNT(*) FROM pfa_write_queue GROUP BY status;

-- Check sync conflicts
SELECT status, COUNT(*) FROM pfa_sync_conflict GROUP BY status;

-- Verify no orphaned records
SELECT COUNT(*) FROM pfa_write_queue WHERE modification_id NOT IN (SELECT id FROM pfa_modification);
```

---

## Rollback Procedures

See [ROLLBACK_PLAN.md](./ROLLBACK_PLAN.md) for detailed rollback procedures.

### Quick Rollback (< 10 minutes)

```bash
# 1. Stop sync worker immediately
pm2 stop pems-write-sync-worker

# 2. Revert to previous backend version
git checkout v3.0.0
cd backend
npm ci
npm run build
pm2 restart pfa-vanguard-backend

# 3. Rollback database migration
npx prisma migrate resolve --rolled-back 20251128000003_phase4_bidirectional_sync_infrastructure

# 4. Verify system health
curl https://api.pfavanguard.com/health

# 5. Notify team
# Slack: "#incidents" channel
```

---

## Emergency Contacts

### On-Call Rotation

- **Primary On-Call:** Check PagerDuty schedule
- **Secondary On-Call:** Check PagerDuty schedule
- **Escalation:** DevSecOps Lead

### Key Contacts

| Role | Name | Phone | Slack |
|------|------|-------|-------|
| DevSecOps Lead | `_______________` | `_______________` | `@devsecops-lead` |
| Backend Lead | `_______________` | `_______________` | `@backend-lead` |
| Database Admin | `_______________` | `_______________` | `@dba` |
| Product Owner | `_______________` | `_______________` | `@product-owner` |
| Security Team | `_______________` | `_______________` | `@security` |

### Escalation Path

1. **Level 1 (0-15 min):** On-call engineer investigates
2. **Level 2 (15-30 min):** DevSecOps Lead engaged
3. **Level 3 (30+ min):** All hands meeting, consider rollback

---

## Known Issues & Workarounds

### Issue 1: Queue Size Spikes During Peak Hours

**Symptoms:** Queue size grows > 500 items during 9-11 AM

**Workaround:**
```bash
# Temporarily increase worker concurrency
pm2 stop pems-write-sync-worker
# Edit ecosystem.config.js: max_workers: 4
pm2 start ecosystem.config.js --only pems-write-sync-worker
```

### Issue 2: WebSocket Disconnections Behind Load Balancer

**Symptoms:** Frequent WebSocket disconnections (> 10/min)

**Workaround:**
```bash
# Check load balancer timeout settings
# Ensure timeout > 60 seconds
aws elbv2 describe-load-balancers --load-balancer-arns $LB_ARN
```

### Issue 3: PEMS API Rate Limiting

**Symptoms:** 429 Too Many Requests from PEMS

**Workaround:**
```bash
# Reduce sync frequency temporarily
# Edit worker: SYNC_INTERVAL_MS from 60000 to 120000
pm2 restart pems-write-sync-worker
```

---

## Deployment Metrics

Track these metrics for each deployment:

| Metric | Target | Actual |
|--------|--------|--------|
| Total deployment time | < 60 min | `_____` |
| Database migration time | < 5 min | `_____` |
| Backend downtime | < 2 min | `_____` |
| Frontend downtime | 0 min | `_____` |
| Smoke test success rate | 100% | `_____` |
| Rollback required | No | `_____` |

---

## Post-Deployment Tasks

- [ ] Update DEVELOPMENT_LOG.md with deployment details
- [ ] Create deployment retrospective document
- [ ] Archive deployment logs
- [ ] Update capacity planning based on production metrics
- [ ] Schedule post-deployment review meeting (within 1 week)

---

**Document Version:** 1.0.0
**Last Deployment:** `_______________`
**Next Scheduled Deployment:** `_______________`

**Related Documents:**
- [STAGING_MONITORING_CHECKLIST.md](./STAGING_MONITORING_CHECKLIST.md)
- [MONITORING_PLAYBOOK.md](./MONITORING_PLAYBOOK.md)
- [ROLLBACK_PLAN.md](./ROLLBACK_PLAN.md)
- [ADR-008](./adrs/ADR-008-bidirectional-pems-sync/)
