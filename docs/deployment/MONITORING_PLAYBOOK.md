# Monitoring Playbook
## ADR-008 Phase 5: Operational Monitoring & Incident Response

**Version:** 1.0.0
**Last Updated:** 2025-11-28
**Document Owner:** DevSecOps Team

---

## Table of Contents

1. [Key Metrics](#key-metrics)
2. [Alert Thresholds](#alert-thresholds)
3. [Grafana Dashboards](#grafana-dashboards)
4. [Alert Response Procedures](#alert-response-procedures)
5. [Escalation Paths](#escalation-paths)
6. [On-Call Runbooks](#on-call-runbooks)

---

## Key Metrics

### System Health Metrics

| Metric | Source | Unit | Target | Critical Threshold |
|--------|--------|------|--------|-------------------|
| API Response Time (P95) | CloudWatch/Datadog | ms | < 500ms | > 2000ms |
| API Response Time (P99) | CloudWatch/Datadog | ms | < 1000ms | > 3000ms |
| Error Rate | Application Logs | % | < 0.1% | > 1% |
| Uptime | Synthetic Monitors | % | > 99.9% | < 99% |
| Database Connections | PostgreSQL | count | < 50 | > 80 |
| Redis Hit Rate | Redis | % | > 80% | < 50% |

### Sync-Specific Metrics

| Metric | Source | Unit | Target | Critical Threshold |
|--------|--------|------|--------|-------------------|
| Queue Size | pfa_write_queue table | count | < 100 | > 1000 |
| Sync Success Rate | pfa_sync_log table | % | > 99.9% | < 99% |
| Average Sync Latency | pfa_sync_log table | minutes | < 2 min | > 5 min |
| P95 Sync Latency | pfa_sync_log table | minutes | < 5 min | > 10 min |
| P99 Sync Latency | pfa_sync_log table | minutes | < 10 min | > 15 min |
| Failed Sync Count | pfa_write_queue table | count/hour | < 5 | > 50 |
| Conflict Count | pfa_sync_conflict table | count/hour | < 10 | > 100 |
| Unresolved Conflicts | pfa_sync_conflict table | count | < 20 | > 100 |
| Sync Worker Uptime | PM2 | % | 100% | < 99% |

### Resource Utilization

| Metric | Source | Unit | Target | Critical Threshold |
|--------|--------|------|--------|-------------------|
| Backend CPU Usage | Server Metrics | % | < 60% | > 85% |
| Backend Memory Usage | Server Metrics | % | < 70% | > 90% |
| Sync Worker CPU Usage | Server Metrics | % | < 60% | > 85% |
| Sync Worker Memory Usage | Server Metrics | % | < 70% | > 90% |
| Database CPU Usage | RDS/CloudWatch | % | < 70% | > 90% |
| Database Memory Usage | RDS/CloudWatch | % | < 80% | > 95% |
| Disk I/O (IOPS) | Server Metrics | ops/sec | < 5000 | > 10000 |
| Network Throughput | Server Metrics | Mbps | < 100 | > 500 |

### Business Metrics

| Metric | Source | Unit | Target | Critical Threshold |
|--------|--------|------|--------|-------------------|
| Daily Active Users | Application Analytics | count | Monitor | - |
| Total Syncs Per Day | pfa_sync_log table | count | Monitor | - |
| Average Syncs Per User | pfa_sync_log table | count | Monitor | - |
| PEMS API Calls Per Hour | API Logs | count | < 5000 | > 10000 |
| Cost Per Sync | AWS Cost Explorer | USD | < $0.01 | > $0.10 |

---

## Alert Thresholds

### Critical Alerts (P1 - Page Immediately)

**Response Time:** < 5 minutes
**Escalation:** Immediate PagerDuty page

| Alert Name | Condition | Dashboard | Query |
|------------|-----------|-----------|-------|
| **High Error Rate** | Error rate > 1% for 5 minutes | System Health | `rate(http_requests_total{status=~"5.."}[5m]) > 0.01` |
| **Queue Overflow** | Queue size > 1000 items | Sync Metrics | `SELECT COUNT(*) FROM pfa_write_queue WHERE status='pending' > 1000` |
| **Sync Worker Down** | Worker not running for 2 minutes | Worker Health | `pm2_process_status{name="pems-write-sync-worker"} == 0` |
| **Database Connection Failure** | DB connections failing for 1 minute | Database Health | `pg_up == 0` |
| **Memory Leak Detected** | Memory growth > 100 MB/hour sustained | Resource Usage | `rate(process_resident_memory_bytes[1h]) > 104857600` |
| **PEMS API Down** | PEMS API failure rate > 50% for 5 minutes | External APIs | `rate(pems_api_errors[5m]) > 0.5` |
| **Data Corruption** | Validation errors > 10 in 5 minutes | Data Integrity | `rate(validation_errors_total[5m]) > 10` |
| **Security Breach** | Unauthorized access attempts > 50/min | Security | `rate(auth_failures_total[1m]) > 50` |

### High Priority Alerts (P2 - Alert On-Call)

**Response Time:** < 15 minutes
**Escalation:** Slack notification + PagerDuty if unacknowledged after 15 min

| Alert Name | Condition | Dashboard | Query |
|------------|-----------|-----------|-------|
| **High Sync Latency** | P95 sync latency > 5 minutes for 15 minutes | Sync Performance | `histogram_quantile(0.95, sync_duration_seconds) > 300` |
| **Elevated Queue Size** | Queue size > 500 items for 10 minutes | Sync Metrics | `SELECT COUNT(*) FROM pfa_write_queue WHERE status='pending' > 500` |
| **High Conflict Rate** | Conflict rate > 5% for 10 minutes | Conflict Management | `(conflicts / total_syncs) > 0.05` |
| **WebSocket Disconnections** | Disconnections > 50/hour | WebSocket Health | `rate(websocket_disconnections[1h]) > 50` |
| **AWS Secrets Manager Failures** | Secret retrieval failures > 5 in 10 minutes | AWS Integration | `rate(secrets_manager_errors[10m]) > 5` |
| **High CPU Usage** | CPU > 85% for 10 minutes | Resource Usage | `cpu_usage_percent > 85` |
| **High Memory Usage** | Memory > 90% for 10 minutes | Resource Usage | `memory_usage_percent > 90` |
| **Slow Database Queries** | Queries > 1s count > 10 in 5 minutes | Database Performance | `SELECT COUNT(*) FROM pg_stat_statements WHERE mean_exec_time > 1000 > 10` |

### Medium Priority Alerts (P3 - Slack Notification)

**Response Time:** < 1 hour
**Escalation:** Business hours only, no pages

| Alert Name | Condition | Dashboard | Query |
|------------|-----------|-----------|-------|
| **Elevated Sync Latency** | P95 sync latency > 2 minutes for 30 minutes | Sync Performance | `histogram_quantile(0.95, sync_duration_seconds) > 120` |
| **Moderate Queue Growth** | Queue size > 200 items for 30 minutes | Sync Metrics | `SELECT COUNT(*) FROM pfa_write_queue WHERE status='pending' > 200` |
| **Cache Hit Rate Low** | Redis hit rate < 50% for 1 hour | Cache Performance | `redis_keyspace_hits / (redis_keyspace_hits + redis_keyspace_misses) < 0.5` |
| **PEMS API Slow** | PEMS API response time > 3s for 15 minutes | External APIs | `histogram_quantile(0.95, pems_api_duration_seconds) > 3` |
| **Failed Syncs Accumulating** | Failed syncs > 20 in 1 hour | Sync Metrics | `SELECT COUNT(*) FROM pfa_write_queue WHERE status='failed' AND last_attempt_at > NOW() - INTERVAL '1 hour' > 20` |
| **Unresolved Conflicts Growing** | Unresolved conflicts > 50 | Conflict Management | `SELECT COUNT(*) FROM pfa_sync_conflict WHERE status='unresolved' > 50` |

### Low Priority Alerts (P4 - Daily Digest)

**Response Time:** Best effort
**Escalation:** Daily summary email

| Alert Name | Condition | Dashboard | Query |
|------------|-----------|-----------|-------|
| **Sync Success Rate Declining** | Success rate < 99.5% over 24 hours | Sync Metrics | `(successful_syncs / total_syncs) < 0.995` |
| **Increased Retry Rate** | Retry rate > 10% over 24 hours | Sync Metrics | `(retries / total_syncs) > 0.10` |
| **Cost Anomaly Detected** | Daily cost > 120% of 7-day average | Cost Management | `cost_today > (avg_cost_7d * 1.2)` |

---

## Grafana Dashboards

### Dashboard 1: System Health Overview

**URL:** `https://grafana.pfavanguard.com/d/system-health`

**Panels:**
1. **API Response Time** (Time Series)
   - Metrics: P50, P95, P99 response times
   - Threshold lines: Warning (1s), Critical (2s)

2. **Error Rate** (Gauge)
   - Metric: Percentage of 5xx errors
   - Color zones: Green (< 0.1%), Yellow (0.1-1%), Red (> 1%)

3. **Uptime** (Stat)
   - Metric: 30-day rolling uptime
   - Target: 99.9%

4. **Active Database Connections** (Time Series)
   - Metric: Current active connections
   - Threshold: Warning (50), Critical (80)

5. **Resource Utilization** (Bar Gauge)
   - Metrics: CPU, Memory, Disk I/O
   - Color zones: Green (< 70%), Yellow (70-85%), Red (> 85%)

### Dashboard 2: Sync Performance

**URL:** `https://grafana.pfavanguard.com/d/sync-performance`

**Panels:**
1. **Queue Size Over Time** (Time Series)
   - Metric: `COUNT(*) FROM pfa_write_queue WHERE status='pending'`
   - Threshold lines: Warning (100), Critical (1000)

2. **Sync Success Rate** (Gauge)
   - Metric: `(successful_syncs / total_syncs) * 100`
   - Target: 99.9%

3. **Sync Latency Distribution** (Heatmap)
   - Metrics: P50, P95, P99 sync latencies
   - Time buckets: 5-minute intervals

4. **Sync Throughput** (Time Series)
   - Metric: Syncs completed per hour
   - Trend line: 7-day moving average

5. **Failed Syncs** (Table)
   - Columns: Timestamp, PFA ID, Error Message, Retry Count
   - Sorted by: Timestamp DESC
   - Limit: Last 50 failures

6. **Sync Operations by Type** (Pie Chart)
   - Metrics: Create, Update, Delete counts
   - Percentage breakdown

### Dashboard 3: Conflict Management

**URL:** `https://grafana.pfavanguard.com/d/conflict-management`

**Panels:**
1. **Conflict Rate Over Time** (Time Series)
   - Metric: Conflicts detected per hour
   - Threshold: Warning (10), Critical (100)

2. **Conflict Resolution Status** (Pie Chart)
   - Metrics: Auto-resolved, Manual-resolved, Unresolved
   - Percentage breakdown

3. **Unresolved Conflicts by Organization** (Bar Chart)
   - Metric: `COUNT(*) FROM pfa_sync_conflict WHERE status='unresolved' GROUP BY organization_id`
   - Top 10 organizations

4. **Average Time to Resolution** (Stat)
   - Metric: `AVG(resolved_at - created_at) FROM pfa_sync_conflict WHERE status='resolved'`
   - Target: < 1 hour

5. **Recent Conflicts** (Table)
   - Columns: Created At, PFA ID, Conflict Fields, Status
   - Sorted by: Created At DESC
   - Limit: Last 100

### Dashboard 4: WebSocket Health

**URL:** `https://grafana.pfavanguard.com/d/websocket-health`

**Panels:**
1. **Active Connections** (Time Series)
   - Metric: Current WebSocket connections
   - Trend line: Expected connections based on active users

2. **Connection Lifecycle** (Time Series)
   - Metrics: Connects/min, Disconnects/min
   - Ideal: Balanced rates

3. **Disconnection Reasons** (Pie Chart)
   - Metrics: Timeout, Error, Client Close, Server Close
   - Percentage breakdown

4. **Message Throughput** (Time Series)
   - Metrics: Messages sent/min, Messages received/min

5. **Average Connection Duration** (Stat)
   - Metric: Average time users stay connected
   - Trend: Increasing is better (indicates stability)

### Dashboard 5: Cost & Resource Optimization

**URL:** `https://grafana.pfavanguard.com/d/cost-optimization`

**Panels:**
1. **Daily Cost Breakdown** (Stacked Bar Chart)
   - Metrics: Database, Compute, API Calls, Storage
   - Trend line: 7-day moving average

2. **Cost Per Sync** (Time Series)
   - Metric: `total_cost / total_syncs`
   - Target: < $0.01 per sync

3. **PEMS API Call Volume** (Time Series)
   - Metric: API calls per hour
   - Rate limit line: Max allowed calls

4. **AWS Secrets Manager API Calls** (Time Series)
   - Metric: Calls per hour
   - Note: High call volume = opportunity for caching

5. **Resource Utilization Efficiency** (Bar Gauge)
   - Metrics: CPU efficiency, Memory efficiency
   - Calculation: (Actual utilization / Provisioned capacity)

---

## Alert Response Procedures

### P1 Alert: High Error Rate (> 1%)

**Symptoms:**
- Error rate dashboard shows red
- 5xx errors in application logs
- Users reporting failures

**Immediate Actions (< 5 minutes):**
```bash
# 1. Check backend health
curl https://api.pfavanguard.com/health

# 2. Check recent error logs
pm2 logs pfa-vanguard-backend --err --lines 100

# 3. Check database connectivity
psql $DATABASE_URL -c "SELECT 1"

# 4. Check PEMS API health
curl -H "Authorization: Bearer $TOKEN" $PEMS_API_URL/health
```

**Diagnosis:**
- If database errors: Possible connection pool exhaustion or DB overload
- If PEMS API errors: External API degradation
- If memory errors: Possible memory leak

**Resolution:**
```bash
# If database connection pool exhausted:
pm2 restart pfa-vanguard-backend

# If PEMS API down:
# Pause sync worker to prevent queue overflow
pm2 stop pems-write-sync-worker

# If memory leak:
# Restart services (temporary fix)
pm2 restart all
# File bug report for investigation
```

**Escalation:**
- If not resolved in 15 minutes: Engage DevSecOps Lead
- If data integrity at risk: Engage Database Admin
- If security-related: Engage Security Team

### P1 Alert: Queue Overflow (> 1000 items)

**Symptoms:**
- Queue size metric exceeds 1000
- Sync latency increasing
- Dashboard shows growing backlog

**Immediate Actions:**
```bash
# 1. Check queue status
psql $DATABASE_URL -c "SELECT status, COUNT(*) FROM pfa_write_queue GROUP BY status;"

# 2. Check sync worker health
pm2 list | grep pems-write-sync-worker

# 3. Check worker logs
pm2 logs pems-write-sync-worker --lines 200

# 4. Check for stuck items
psql $DATABASE_URL -c "SELECT * FROM pfa_write_queue WHERE retry_count > 5 LIMIT 10;"
```

**Diagnosis:**
- If worker down: Restart worker
- If worker running but slow: PEMS API degradation or database bottleneck
- If many stuck items: Data validation issues

**Resolution:**
```bash
# If worker down:
pm2 restart pems-write-sync-worker

# If PEMS API slow:
# Check PEMS API response times
curl -w "@curl-format.txt" -H "Authorization: Bearer $TOKEN" $PEMS_API_URL/api/work-orders

# If database bottleneck:
# Check slow queries
psql $DATABASE_URL -c "SELECT query, mean_exec_time FROM pg_stat_statements WHERE mean_exec_time > 1000 ORDER BY mean_exec_time DESC LIMIT 10;"

# Temporarily scale up worker concurrency:
# Edit ecosystem.config.js: max_workers: 4
pm2 restart pems-write-sync-worker
```

**Escalation:**
- If queue continues growing after 30 minutes: Engage DevSecOps Lead
- If database performance issue: Engage Database Admin

### P1 Alert: Sync Worker Down

**Symptoms:**
- Worker health endpoint returns error
- PM2 shows worker as "stopped" or "errored"
- No sync activity for 2+ minutes

**Immediate Actions:**
```bash
# 1. Check worker status
pm2 list | grep pems-write-sync-worker

# 2. Check recent crash logs
pm2 logs pems-write-sync-worker --err --lines 200

# 3. Check system resources
free -h
df -h
top -b -n 1 | head -20
```

**Diagnosis:**
- If "errored" status: Application crash
- If "stopped" status: Manual stop or system shutdown
- If out of memory: Memory leak or undersized instance

**Resolution:**
```bash
# Restart worker
pm2 restart pems-write-sync-worker

# If continues crashing:
# Check error logs for stack trace
pm2 logs pems-write-sync-worker --err --lines 500 > worker-crash.log

# If out of memory:
# Temporarily reduce batch size in worker config
# Then restart
pm2 restart pems-write-sync-worker
```

**Escalation:**
- If worker crashes more than 3 times in 1 hour: Engage Backend Lead
- If memory-related: Engage DevSecOps for instance resizing

### P2 Alert: High Sync Latency (P95 > 5 minutes)

**Symptoms:**
- Sync latency dashboard shows yellow/red
- Users reporting delays in seeing their changes in PEMS
- Queue size may be elevated

**Immediate Actions:**
```bash
# 1. Check current queue size
psql $DATABASE_URL -c "SELECT COUNT(*) FROM pfa_write_queue WHERE status='pending';"

# 2. Check sync log for recent syncs
psql $DATABASE_URL -c "SELECT id, duration_ms, status FROM pfa_sync_log ORDER BY started_at DESC LIMIT 10;"

# 3. Check PEMS API response times
curl -w "@curl-format.txt" -H "Authorization: Bearer $TOKEN" $PEMS_API_URL/api/work-orders
```

**Diagnosis:**
- If PEMS API slow: External API degradation
- If database slow: Query performance issue
- If queue large: Worker not keeping up

**Resolution:**
```bash
# If PEMS API slow:
# Consider implementing circuit breaker (fail fast)
# No immediate action needed if temporary

# If database slow:
# Identify slow queries
psql $DATABASE_URL -c "SELECT query, mean_exec_time FROM pg_stat_statements WHERE mean_exec_time > 500 ORDER BY mean_exec_time DESC LIMIT 10;"
# Consider adding indexes if missing

# If worker not keeping up:
# Scale up worker concurrency temporarily
# Edit ecosystem.config.js and restart
```

**Escalation:**
- If latency remains high for 1+ hour: Engage DevSecOps Lead
- If database performance issue: Engage Database Admin

### P3 Alert: Cache Hit Rate Low (< 50%)

**Symptoms:**
- Redis dashboard shows low hit rate
- Increased database query load
- Slightly elevated response times

**Immediate Actions:**
```bash
# 1. Check Redis status
redis-cli -u $REDIS_URL info stats

# 2. Check cache key patterns
redis-cli -u $REDIS_URL --scan --pattern "*"

# 3. Check cache TTL distribution
redis-cli -u $REDIS_URL ttl {sample-key}
```

**Diagnosis:**
- If keys expiring too quickly: TTL too short
- If keys evicted: Redis memory pressure
- If keys not being set: Application not caching correctly

**Resolution:**
```bash
# If memory pressure:
# Check memory usage
redis-cli -u $REDIS_URL info memory

# Consider increasing TTL for stable data
# Update cache service configuration

# If keys not being set:
# Check application logs for cache errors
pm2 logs pfa-vanguard-backend --lines 500 | grep "cache"
```

**Escalation:**
- If hit rate doesn't improve after configuration change: Engage Backend Lead

---

## Escalation Paths

### Level 1: On-Call Engineer (0-15 minutes)

**Responsibilities:**
- Acknowledge alert within 5 minutes
- Begin investigation
- Apply standard runbook procedures
- Update incident channel with status

**Escalate to Level 2 if:**
- Issue not resolved in 15 minutes
- Issue requires code changes
- Data integrity at risk
- Security incident suspected

### Level 2: DevSecOps Lead (15-30 minutes)

**Responsibilities:**
- Coordinate cross-team response
- Make rollback decision if needed
- Approve emergency hotfixes
- Communicate with stakeholders

**Escalate to Level 3 if:**
- Issue not resolved in 30 minutes
- Multiple systems affected
- Customer-impacting outage > 30 minutes
- Data loss occurred

### Level 3: All Hands (30+ minutes)

**Participants:**
- DevSecOps Lead
- Backend Lead
- Database Admin
- Product Owner
- Security Team (if security-related)

**Responsibilities:**
- War room coordination
- Executive communication
- Major incident declaration
- Customer notification

---

## On-Call Runbooks

### Runbook: Investigate High Database CPU

```bash
# 1. Check current CPU usage
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# 2. Identify long-running queries
psql $DATABASE_URL -c "SELECT pid, now() - query_start AS duration, query FROM pg_stat_activity WHERE state = 'active' AND now() - query_start > interval '1 minute' ORDER BY duration DESC;"

# 3. Check for blocking queries
psql $DATABASE_URL -c "SELECT blocked_locks.pid AS blocked_pid, blocking_locks.pid AS blocking_pid, blocked_activity.usename AS blocked_user, blocking_activity.usename AS blocking_user, blocked_activity.query AS blocked_statement, blocking_activity.query AS blocking_statement FROM pg_catalog.pg_locks blocked_locks JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation AND blocking_locks.pid != blocked_locks.pid JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid WHERE NOT blocked_locks.granted;"

# 4. If necessary, kill problematic query
# CAUTION: Only do this if query is clearly stuck
psql $DATABASE_URL -c "SELECT pg_terminate_backend({pid});"
```

### Runbook: Investigate Memory Leak

```bash
# 1. Check current memory usage
pm2 list
free -h

# 2. Get detailed memory breakdown
pm2 show pfa-vanguard-backend | grep memory
pm2 show pems-write-sync-worker | grep memory

# 3. Check heap snapshot (requires node-heapdump)
# Add to backend/src/server.ts:
# import heapdump from 'heapdump';
# heapdump.writeSnapshot('/tmp/heap-' + Date.now() + '.heapsnapshot');

# 4. Analyze heap snapshot
# Use Chrome DevTools > Memory > Load snapshot

# 5. Temporary mitigation: Restart services
pm2 restart all

# 6. File bug report with heap snapshot attached
```

### Runbook: Investigate PEMS API Failures

```bash
# 1. Test PEMS API directly
curl -v -H "Authorization: Bearer $PEMS_API_KEY" $PEMS_API_URL/api/work-orders

# 2. Check recent PEMS API errors in logs
pm2 logs pfa-vanguard-backend --lines 500 | grep "PEMS API"

# 3. Check AWS Secrets Manager (credentials may have rotated)
aws secretsmanager get-secret-value --secret-id pfa/pems-api-credentials

# 4. If credentials issue, update in AWS Secrets Manager
aws secretsmanager update-secret --secret-id pfa/pems-api-credentials --secret-string '{"apiKey":"new-key"}'

# 5. Restart backend to pick up new credentials
pm2 restart pfa-vanguard-backend
```

---

## Metric Collection Queries

### Query 1: Queue Metrics (Run every 1 minute)

```sql
SELECT
  status,
  COUNT(*) AS count,
  MIN(created_at) AS oldest_item,
  MAX(retry_count) AS max_retries
FROM pfa_write_queue
GROUP BY status;
```

### Query 2: Sync Performance (Run every 5 minutes)

```sql
SELECT
  organization_id,
  COUNT(*) AS total_syncs,
  AVG(duration_ms) AS avg_duration_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_duration_ms,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) AS success_rate
FROM pfa_sync_log
WHERE started_at > NOW() - INTERVAL '1 hour'
GROUP BY organization_id;
```

### Query 3: Conflict Metrics (Run every 10 minutes)

```sql
SELECT
  organization_id,
  status,
  COUNT(*) AS count,
  AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - created_at))) AS avg_resolution_time_seconds
FROM pfa_sync_conflict
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY organization_id, status;
```

### Query 4: Database Health (Run every 5 minutes)

```sql
SELECT
  COUNT(*) AS active_connections,
  (SELECT count(*) FROM pg_stat_activity WHERE wait_event IS NOT NULL) AS waiting_connections,
  (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction') AS idle_in_transaction
FROM pg_stat_activity;
```

---

**Document Version:** 1.0.0
**Last Review Date:** 2025-11-28
**Next Review Date:** 2026-02-28

**Related Documents:**
- [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md)
- [STAGING_MONITORING_CHECKLIST.md](./STAGING_MONITORING_CHECKLIST.md)
- [ROLLBACK_PLAN.md](./ROLLBACK_PLAN.md)
