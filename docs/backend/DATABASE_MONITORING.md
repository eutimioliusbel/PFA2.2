# PostgreSQL Database Monitoring & Alerting

Comprehensive observability strategy for PFA Vanguard PostgreSQL database.

## Table of Contents
1. [Monitoring Stack Overview](#monitoring-stack-overview)
2. [Key Metrics](#key-metrics)
3. [Grafana Dashboards](#grafana-dashboards)
4. [Alerting Rules](#alerting-rules)
5. [Setup Instructions](#setup-instructions)
6. [Troubleshooting](#troubleshooting)

---

## Monitoring Stack Overview

### Architecture

```
PostgreSQL Database
    ↓
Postgres Exporter (metrics collection)
    ↓
Prometheus (metrics storage)
    ↓
Grafana (visualization) + AlertManager (alerting)
    ↓
Slack / Email / PagerDuty (notifications)
```

### Components

| Component | Purpose | Port |
|-----------|---------|------|
| **PostgreSQL** | Database server | 5432 |
| **Postgres Exporter** | Exposes Prometheus metrics | 9187 |
| **Prometheus** | Time-series metrics database | 9090 |
| **Grafana** | Metrics visualization | 3002 |
| **AlertManager** | Alert routing and aggregation | 9093 |

---

## Key Metrics

### Database Health Metrics

#### Connection Metrics
```promql
# Total active connections
pg_stat_database_numbackends

# Connection limit
pg_settings_max_connections

# Connection utilization (alert if > 80%)
(sum(pg_stat_database_numbackends) / pg_settings_max_connections) * 100
```

#### Query Performance
```promql
# Average query duration (milliseconds)
rate(pg_stat_database_blks_read[5m]) * 1000

# Slow queries (> 1 second)
pg_slow_queries_total

# Queries per second
rate(pg_stat_database_xact_commit[1m])

# Cache hit ratio (should be > 90%)
(sum(pg_stat_database_blks_hit) / (sum(pg_stat_database_blks_hit) + sum(pg_stat_database_blks_read))) * 100
```

#### Database Size & Growth
```promql
# Total database size
pg_database_size_bytes{datname="pfa_vanguard_prod"}

# Daily growth rate
rate(pg_database_size_bytes[24h])

# Table size
pg_table_size_bytes{schemaname="public"}

# Index size
pg_indexes_size_bytes{schemaname="public"}
```

#### Transaction Metrics
```promql
# Commits per second
rate(pg_stat_database_xact_commit[1m])

# Rollbacks per second (high rollback rate indicates issues)
rate(pg_stat_database_xact_rollback[1m])

# Deadlocks
rate(pg_stat_database_deadlocks[5m])

# Conflicts
rate(pg_stat_database_conflicts[5m])
```

#### Replication Lag (Production)
```promql
# Replication lag in bytes
pg_replication_lag_bytes

# Replication lag in seconds
pg_replication_lag_seconds

# Alert if lag > 10 seconds
pg_replication_lag_seconds > 10
```

### System Resource Metrics

#### CPU & Memory
```promql
# Database CPU usage (requires node_exporter)
rate(process_cpu_seconds_total{job="postgres"}[5m]) * 100

# Memory usage
process_resident_memory_bytes{job="postgres"}

# Shared buffer utilization
pg_stat_bgwriter_buffers_alloc
```

#### Disk I/O
```promql
# Disk reads per second
rate(pg_stat_database_blks_read[1m])

# Disk writes per second
rate(pg_stat_database_blks_write[1m])

# Checkpoint frequency (too frequent = performance issue)
rate(pg_stat_bgwriter_checkpoints_req[5m])
```

#### Disk Space
```promql
# Available disk space
node_filesystem_avail_bytes{mountpoint="/var/lib/postgresql/data"}

# Disk space utilization percentage
100 - ((node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100)
```

### Application-Specific Metrics

#### PFA Record Count
```promql
# Total PFA records
pg_table_row_count{table="pfa_records"}

# Records by organization
pg_table_row_count{table="pfa_records"} by (organization_id)

# Daily record growth
rate(pg_table_row_count{table="pfa_records"}[24h])
```

#### Authentication Metrics
```promql
# Failed login attempts (requires audit logging)
pg_stat_database_conflicts{conflict_type="auth"}

# Active user sessions
pg_stat_activity_count{state="active"}
```

#### Sync Operation Metrics
```promql
# PEMS sync duration (custom metric from application)
pfa_pems_sync_duration_seconds

# PEMS sync record count
pfa_pems_sync_records_total

# Sync errors
rate(pfa_pems_sync_errors_total[5m])
```

---

## Grafana Dashboards

### Dashboard 1: Database Overview

**Panels:**
1. **Database Size** (single stat + trend)
2. **Active Connections** (gauge with threshold)
3. **Queries per Second** (line graph)
4. **Cache Hit Ratio** (gauge, target > 90%)
5. **Slow Queries** (table with top 10)
6. **Transaction Rate** (commits + rollbacks)
7. **Disk Space** (gauge with threshold)
8. **Replication Lag** (line graph, production only)

**JSON Configuration:**
```json
{
  "dashboard": {
    "title": "PFA Vanguard - Database Overview",
    "panels": [
      {
        "type": "stat",
        "title": "Database Size",
        "targets": [
          {
            "expr": "pg_database_size_bytes{datname=\"pfa_vanguard_prod\"}",
            "legendFormat": "Size"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "bytes",
            "thresholds": {
              "mode": "absolute",
              "steps": [
                { "value": 0, "color": "green" },
                { "value": 10737418240, "color": "yellow" },
                { "value": 21474836480, "color": "red" }
              ]
            }
          }
        }
      }
    ]
  }
}
```

### Dashboard 2: Query Performance

**Panels:**
1. **Query Duration Distribution** (heatmap)
2. **Slow Queries Table** (table with query text, duration, count)
3. **Query Types** (pie chart: SELECT, INSERT, UPDATE, DELETE)
4. **Lock Waits** (line graph)
5. **Index Usage** (table with index hit rates)
6. **Sequential Scans** (alert if increasing)

### Dashboard 3: Resource Utilization

**Panels:**
1. **CPU Usage** (line graph)
2. **Memory Usage** (line graph with shared buffers)
3. **Disk I/O** (line graph: reads + writes)
4. **Network Traffic** (line graph)
5. **Disk Space Growth** (bar chart by table)
6. **Checkpoint Activity** (line graph)

### Dashboard 4: Application Metrics

**Panels:**
1. **PFA Record Count** (single stat with trend)
2. **Active Users** (gauge)
3. **PEMS Sync Status** (status indicator)
4. **API Request Rate** (line graph)
5. **Failed Authentication Attempts** (table)
6. **Audit Log Activity** (bar chart)

---

## Alerting Rules

### Critical Alerts (Page Immediately)

#### Database Down
```yaml
- alert: PostgreSQLDown
  expr: up{job="postgres"} == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "PostgreSQL database is down"
    description: "PostgreSQL instance {{ $labels.instance }} has been down for more than 1 minute."
    runbook: "https://wiki.company.com/runbooks/postgres-down"
```

#### Disk Space Critical
```yaml
- alert: DiskSpaceCritical
  expr: |
    100 - ((node_filesystem_avail_bytes{mountpoint="/var/lib/postgresql/data"} /
    node_filesystem_size_bytes) * 100) > 90
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Disk space critically low"
    description: "Disk space is at {{ $value }}% on {{ $labels.instance }}"
```

#### Connection Pool Exhausted
```yaml
- alert: ConnectionPoolExhausted
  expr: |
    (sum(pg_stat_database_numbackends) / pg_settings_max_connections) * 100 > 95
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "PostgreSQL connection pool nearly exhausted"
    description: "{{ $value }}% of connections in use. Application may start failing."
```

#### Replication Broken (Production)
```yaml
- alert: ReplicationLagHigh
  expr: pg_replication_lag_seconds > 60
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Replication lag is critically high"
    description: "Replication lag is {{ $value }} seconds behind master."
```

### High Priority Alerts (Investigate Within 1 Hour)

#### High Query Duration
```yaml
- alert: HighQueryDuration
  expr: |
    rate(pg_stat_database_blk_read_time[5m]) /
    rate(pg_stat_database_xact_commit[5m]) > 1000
  for: 10m
  labels:
    severity: high
  annotations:
    summary: "Query duration is high"
    description: "Average query duration is {{ $value }}ms"
```

#### Low Cache Hit Ratio
```yaml
- alert: LowCacheHitRatio
  expr: |
    (sum(pg_stat_database_blks_hit) /
    (sum(pg_stat_database_blks_hit) + sum(pg_stat_database_blks_read))) * 100 < 90
  for: 15m
  labels:
    severity: high
  annotations:
    summary: "Database cache hit ratio is low"
    description: "Cache hit ratio is {{ $value }}% (target: 90%+)"
```

#### Deadlock Rate Increasing
```yaml
- alert: DeadlocksIncreasing
  expr: rate(pg_stat_database_deadlocks[5m]) > 0.1
  for: 10m
  labels:
    severity: high
  annotations:
    summary: "Database deadlocks increasing"
    description: "Deadlock rate: {{ $value }} per second"
```

#### PEMS Sync Failure
```yaml
- alert: PemsSyncFailed
  expr: pfa_pems_sync_errors_total > 0
  for: 5m
  labels:
    severity: high
  annotations:
    summary: "PEMS sync operation failed"
    description: "{{ $value }} sync errors detected"
```

### Medium Priority Alerts (Investigate Next Business Day)

#### Disk Space Warning
```yaml
- alert: DiskSpaceWarning
  expr: |
    100 - ((node_filesystem_avail_bytes{mountpoint="/var/lib/postgresql/data"} /
    node_filesystem_size_bytes) * 100) > 70
  for: 15m
  labels:
    severity: warning
  annotations:
    summary: "Disk space above 70%"
    description: "Disk space is at {{ $value }}% on {{ $labels.instance }}"
```

#### Backup Age Threshold
```yaml
- alert: BackupTooOld
  expr: (time() - pfa_last_backup_timestamp_seconds) > 90000
  for: 1h
  labels:
    severity: warning
  annotations:
    summary: "Database backup is too old"
    description: "Last backup was {{ $value | humanizeDuration }} ago (threshold: 25 hours)"
```

#### High Connection Count
```yaml
- alert: HighConnectionCount
  expr: |
    (sum(pg_stat_database_numbackends) / pg_settings_max_connections) * 100 > 70
  for: 30m
  labels:
    severity: warning
  annotations:
    summary: "Connection count is high"
    description: "{{ $value }}% of max connections in use"
```

---

## Setup Instructions

### 1. Install Postgres Exporter

**Docker Compose (Add to existing docker-compose.yml):**
```yaml
services:
  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:latest
    container_name: pfa-postgres-exporter
    restart: unless-stopped

    environment:
      DATA_SOURCE_NAME: "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?sslmode=disable"
      PG_EXPORTER_EXTEND_QUERY_PATH: "/etc/postgres_exporter/queries.yaml"

    ports:
      - "9187:9187"

    volumes:
      - ./monitoring/postgres-exporter-queries.yaml:/etc/postgres_exporter/queries.yaml:ro

    networks:
      - pfa-network

    depends_on:
      postgres:
        condition: service_healthy
```

**Custom Queries Configuration:**
```yaml
# monitoring/postgres-exporter-queries.yaml
pg_slow_queries:
  query: |
    SELECT
      queryid,
      substring(query, 1, 100) as query_preview,
      calls,
      mean_exec_time / 1000 as mean_time_seconds
    FROM pg_stat_statements
    WHERE mean_exec_time > 1000
    ORDER BY mean_exec_time DESC
    LIMIT 20
  metrics:
    - query_preview:
        usage: "LABEL"
        description: "Query text preview"
    - mean_time_seconds:
        usage: "GAUGE"
        description: "Mean execution time in seconds"

pg_table_row_count:
  query: |
    SELECT
      schemaname,
      tablename,
      n_live_tup as row_count
    FROM pg_stat_user_tables
  metrics:
    - schemaname:
        usage: "LABEL"
        description: "Schema name"
    - tablename:
        usage: "LABEL"
        description: "Table name"
    - row_count:
        usage: "GAUGE"
        description: "Approximate row count"
```

### 2. Install Prometheus

**Docker Compose:**
```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    container_name: pfa-prometheus
    restart: unless-stopped

    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'

    ports:
      - "9090:9090"

    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./monitoring/alerts.yml:/etc/prometheus/alerts.yml:ro
      - prometheus_data:/prometheus

    networks:
      - pfa-network

volumes:
  prometheus_data:
```

**Prometheus Configuration:**
```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    environment: 'production'
    application: 'pfa-vanguard'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

rule_files:
  - 'alerts.yml'

scrape_configs:
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'backend'
    static_configs:
      - targets: ['backend:3001']

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
```

### 3. Install Grafana

**Docker Compose:**
```yaml
services:
  grafana:
    image: grafana/grafana:latest
    container_name: pfa-grafana
    restart: unless-stopped

    environment:
      GF_SECURITY_ADMIN_USER: ${GRAFANA_ADMIN_USER:-admin}
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD}
      GF_USERS_ALLOW_SIGN_UP: false
      GF_SERVER_ROOT_URL: https://grafana.pfa-vanguard.com

    ports:
      - "3002:3000"

    volumes:
      - ./monitoring/grafana-datasources.yml:/etc/grafana/provisioning/datasources/datasources.yml
      - ./monitoring/grafana-dashboards.yml:/etc/grafana/provisioning/dashboards/dashboards.yml
      - ./monitoring/dashboards:/var/lib/grafana/dashboards
      - grafana_data:/var/lib/grafana

    networks:
      - pfa-network

    depends_on:
      - prometheus

volumes:
  grafana_data:
```

**Grafana Datasource Configuration:**
```yaml
# monitoring/grafana-datasources.yml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

### 4. Install AlertManager

**Docker Compose:**
```yaml
services:
  alertmanager:
    image: prom/alertmanager:latest
    container_name: pfa-alertmanager
    restart: unless-stopped

    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'

    ports:
      - "9093:9093"

    volumes:
      - ./monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
      - alertmanager_data:/alertmanager

    networks:
      - pfa-network

volumes:
  alertmanager_data:
```

**AlertManager Configuration:**
```yaml
# monitoring/alertmanager.yml
global:
  resolve_timeout: 5m
  slack_api_url: 'YOUR_SLACK_WEBHOOK_URL'

route:
  receiver: 'default'
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  routes:
    - receiver: 'critical'
      match:
        severity: critical
      continue: true
    - receiver: 'high'
      match:
        severity: high
    - receiver: 'warning'
      match:
        severity: warning

receivers:
  - name: 'default'
    email_configs:
      - to: 'devops@company.com'
        from: 'alerts@pfa-vanguard.com'
        smarthost: 'smtp.sendgrid.net:587'
        auth_username: 'apikey'
        auth_password: 'YOUR_SENDGRID_API_KEY'

  - name: 'critical'
    slack_configs:
      - channel: '#pfa-alerts-critical'
        title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_KEY'

  - name: 'high'
    slack_configs:
      - channel: '#pfa-alerts'
        title: '⚠️  HIGH: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'warning'
    slack_configs:
      - channel: '#pfa-alerts'
        title: 'ℹ️  WARNING: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

### 5. Start Monitoring Stack

```bash
# Start all monitoring services
docker-compose up -d postgres-exporter prometheus grafana alertmanager

# Verify services are running
docker-compose ps

# Access Grafana
# URL: http://localhost:3002
# Login: admin / <GRAFANA_ADMIN_PASSWORD>

# Access Prometheus
# URL: http://localhost:9090

# Access AlertManager
# URL: http://localhost:9093
```

---

## Troubleshooting

### Postgres Exporter Not Collecting Metrics

**Check logs:**
```bash
docker logs pfa-postgres-exporter
```

**Test connection:**
```bash
docker exec pfa-postgres-exporter \
  psql "postgresql://pfa_admin:password@postgres:5432/pfa_vanguard_dev" -c "SELECT 1"
```

**Verify metrics endpoint:**
```bash
curl http://localhost:9187/metrics
```

### Prometheus Not Scraping Targets

**Check Prometheus targets:**
```bash
# Open in browser
http://localhost:9090/targets

# All targets should show "UP" status
```

**Check Prometheus configuration:**
```bash
docker exec pfa-prometheus promtool check config /etc/prometheus/prometheus.yml
```

### Grafana Dashboard Not Displaying Data

**Verify Prometheus datasource:**
```bash
# Grafana UI → Configuration → Data Sources → Prometheus
# Click "Test" button - should show "Data source is working"
```

**Check Prometheus has data:**
```bash
# Query Prometheus directly
curl 'http://localhost:9090/api/v1/query?query=up{job="postgres"}'
```

### Alerts Not Firing

**Check alert rules:**
```bash
# Prometheus UI → Alerts
# Check if rules are loaded and in correct state
http://localhost:9090/alerts
```

**Check AlertManager:**
```bash
# AlertManager UI → Status
http://localhost:9093/#/status
```

**Test alert manually:**
```bash
curl -X POST http://localhost:9093/api/v1/alerts -d '[{
  "labels": {"alertname": "TestAlert", "severity": "warning"},
  "annotations": {"summary": "Test alert"}
}]'
```

---

## Additional Resources

- [Postgres Exporter Documentation](https://github.com/prometheus-community/postgres_exporter)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana PostgreSQL Dashboard](https://grafana.com/grafana/dashboards/9628)
- [PostgreSQL Monitoring Best Practices](https://www.postgresql.org/docs/current/monitoring.html)

---

**Last Updated:** 2024-11-25
**Maintainer:** DevSecOps Team
