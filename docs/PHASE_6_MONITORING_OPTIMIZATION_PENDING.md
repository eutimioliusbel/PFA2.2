# Phase 6: Monitoring & Optimization - PENDING

**Status**: Not Yet Started
**Estimated Duration**: 3-4 days
**Agent**: devsecops-engineer
**Dependencies**: Phase 5 (AI Integration) recommended but not required

---

## 📋 Overview

Phase 6 will implement comprehensive monitoring, observability, and performance optimization for the PFA Vanguard system. This phase focuses on production readiness, scalability to 1M+ records, and operational excellence.

---

## 🎯 Objectives

### 1. Sync Monitoring Dashboard
Real-time visibility into PEMS synchronization operations.

**Features**:
- Live sync status (running/completed/failed)
- Sync history timeline
- Record counts and throughput metrics
- Error tracking and alerting
- Organization-level sync status

### 2. Performance Optimization
Ensure system performs well with large datasets (1M+ records).

**Optimizations**:
- Database query optimization
- Index tuning for frequent queries
- Query plan analysis
- Materialized views for KPI aggregations
- Connection pooling
- Caching layer (Redis)

### 3. Observability & Alerting
Monitor system health and alert on issues.

**Monitoring**:
- API response times
- Database query performance
- Sync worker health
- Error rates
- Resource utilization (CPU, memory, disk)

**Alerting**:
- Sync failures
- API downtime
- Database connection issues
- High error rates
- Performance degradation

### 4. Load Testing & Scalability
Validate system can handle production scale.

**Tests**:
- 1M+ PFA records
- 100+ concurrent users
- 1000+ requests/second
- Multi-organization workloads
- Peak load scenarios

---

## 🔧 Technical Architecture

### Monitoring Stack

**Components**:
- **Prometheus** - Metrics collection
- **Grafana** - Dashboards and visualization
- **Winston** - Structured logging
- **PM2** - Process management and monitoring
- **Redis** - Caching layer

**Architecture**:
```
┌─────────────────────────────────────────┐
│  Grafana Dashboards                     │
│  - Sync Status                          │
│  - API Performance                      │
│  - Database Metrics                     │
└─────────────────────────────────────────┘
                ↓ Query
┌─────────────────────────────────────────┐
│  Prometheus Time-Series Database        │
│  - Stores metrics                       │
│  - Retention: 30 days                   │
└─────────────────────────────────────────┘
                ↑ Scrape
┌─────────────────────────────────────────┐
│  Application Metrics Exporters          │
│  - Express API metrics                  │
│  - PostgreSQL metrics                   │
│  - Sync worker metrics                  │
└─────────────────────────────────────────┘
```

---

## 📦 Files to Create

### Backend Monitoring
1. `backend/src/monitoring/metricsCollector.ts` - Prometheus metrics
2. `backend/src/monitoring/healthChecks.ts` - Health check endpoints
3. `backend/src/monitoring/performanceMonitor.ts` - Query performance tracking
4. `backend/src/middleware/metricsMiddleware.ts` - HTTP metrics
5. `backend/src/workers/MonitoringWorker.ts` - Background monitoring

### Caching Layer
6. `backend/src/services/cache/RedisCacheService.ts` - Redis client
7. `backend/src/services/cache/CacheManager.ts` - Cache strategies
8. `backend/src/services/cache/CacheInvalidation.ts` - Cache invalidation

### Database Optimization
9. `backend/prisma/migrations/add_performance_indexes.sql` - Performance indexes
10. `backend/prisma/views/materialized_kpi_stats.sql` - Materialized views
11. `backend/scripts/db/analyze-query-plans.ts` - Query plan analyzer
12. `backend/scripts/db/optimize-indexes.ts` - Index optimization

### Frontend Monitoring UI
13. `components/admin/SyncMonitoringDashboard.tsx` - Sync dashboard
14. `components/admin/PerformanceMetrics.tsx` - Performance charts
15. `components/admin/ErrorLogViewer.tsx` - Error log viewer
16. `components/admin/AlertsManager.tsx` - Alert configuration

### Load Testing
17. `tests/load/api-load-test.ts` - API load tests
18. `tests/load/sync-load-test.ts` - Sync worker load tests
19. `tests/load/database-load-test.ts` - Database stress tests

### Configuration
20. `monitoring/prometheus.yml` - Prometheus configuration
21. `monitoring/grafana/dashboards/sync-dashboard.json` - Grafana dashboard
22. `monitoring/docker-compose.monitoring.yml` - Monitoring stack

### Documentation
23. `docs/MONITORING_GUIDE.md` - Monitoring setup guide
24. `docs/PERFORMANCE_TUNING.md` - Performance optimization guide
25. `docs/LOAD_TESTING_RESULTS.md` - Load test results

---

## 📊 Metrics to Track

### Sync Worker Metrics
```typescript
{
  // Sync Operations
  sync_operations_total: Counter,          // Total syncs attempted
  sync_operations_success: Counter,        // Successful syncs
  sync_operations_failed: Counter,         // Failed syncs
  sync_duration_seconds: Histogram,        // Sync operation duration
  sync_records_processed: Histogram,       // Records processed per sync

  // Throughput
  sync_records_per_second: Gauge,          // Current throughput
  sync_api_calls_total: Counter,           // PEMS API calls
  sync_db_writes_total: Counter,           // Database writes

  // Errors
  sync_errors_by_org: Counter,             // Errors per organization
  sync_retries_total: Counter,             // Retry attempts
}
```

### API Metrics
```typescript
{
  // Requests
  http_requests_total: Counter,            // Total HTTP requests
  http_request_duration_seconds: Histogram, // Request latency
  http_requests_in_flight: Gauge,          // Concurrent requests

  // Responses
  http_response_size_bytes: Histogram,     // Response sizes
  http_errors_total: Counter,              // Error responses

  // By Endpoint
  api_endpoint_requests: Counter,          // Requests per endpoint
  api_endpoint_latency: Histogram,         // Latency per endpoint
}
```

### Database Metrics
```typescript
{
  // Queries
  db_queries_total: Counter,               // Total queries
  db_query_duration_seconds: Histogram,    // Query latency
  db_slow_queries_total: Counter,          // Slow queries (>1s)

  // Connections
  db_connections_active: Gauge,            // Active connections
  db_connections_idle: Gauge,              // Idle connections
  db_connections_waiting: Gauge,           // Waiting connections

  // Tables
  db_table_size_bytes: Gauge,              // Table sizes
  db_table_row_count: Gauge,               // Row counts
  db_index_hit_rate: Gauge,                // Index efficiency
}
```

### Cache Metrics
```typescript
{
  // Cache Operations
  cache_hits_total: Counter,               // Cache hits
  cache_misses_total: Counter,             // Cache misses
  cache_hit_rate: Gauge,                   // Hit rate percentage

  // Performance
  cache_operation_duration_seconds: Histogram, // Cache op latency
  cache_size_bytes: Gauge,                 // Current cache size
  cache_evictions_total: Counter,          // Evictions
}
```

---

## 🎯 Performance Targets

### API Response Times
| Endpoint | Target | Optimized Target |
|----------|--------|------------------|
| GET /api/pfa/:orgId | <200ms | <50ms (with cache) |
| POST /api/pfa/:orgId/draft | <200ms | <100ms |
| POST /api/pfa/:orgId/commit | <500ms | <200ms |
| GET /api/pfa/:orgId/stats | <500ms | <100ms (materialized) |
| POST /api/sync/trigger | <100ms | <50ms (async) |

### Database Query Times
| Query Type | Target | Optimized Target |
|------------|--------|------------------|
| SELECT with filters | <100ms | <20ms (indexed) |
| JSONB merge query | <200ms | <50ms (indexed) |
| Aggregate/GROUP BY | <500ms | <100ms (materialized) |
| INSERT/UPDATE | <50ms | <20ms (batch) |

### Sync Worker Performance
| Metric | Target | Optimized Target |
|--------|--------|------------------|
| Throughput | 1K records/min | 10K records/min |
| PEMS API latency | <500ms | <200ms (batched) |
| Database write latency | <100ms | <50ms (batch) |
| Full sync time (1M records) | <60 min | <15 min |

---

## 🔧 Database Optimizations

### Indexes to Add

**1. Composite Indexes for Filtering**:
```sql
-- Fast filtering by organization + category + source
CREATE INDEX idx_pfa_org_category_source
  ON pfa_mirror(organization_id, category, source)
  WHERE is_discontinued = false;

-- Fast date range queries
CREATE INDEX idx_pfa_org_dates
  ON pfa_mirror(organization_id, forecast_start, forecast_end)
  WHERE is_discontinued = false;

-- Fast sync state queries
CREATE INDEX idx_pfa_modification_sync_state
  ON pfa_modification(organization_id, sync_state)
  WHERE sync_state IN ('modified', 'pending_sync');
```

**2. JSONB Indexes for Performance**:
```sql
-- Index on JSONB fields for fast queries
CREATE INDEX idx_pfa_mirror_data_category
  ON pfa_mirror USING GIN ((data -> 'category'));

CREATE INDEX idx_pfa_mirror_data_source
  ON pfa_mirror USING GIN ((data -> 'source'));
```

**3. Partial Indexes for Common Queries**:
```sql
-- Index only active records
CREATE INDEX idx_pfa_active_records
  ON pfa_mirror(organization_id, forecast_start)
  WHERE is_discontinued = false AND is_actualized = false;
```

### Materialized Views for KPIs

**Create Materialized View**:
```sql
CREATE MATERIALIZED VIEW mv_pfa_kpi_stats AS
SELECT
  organization_id,
  category,
  source,
  COUNT(*) as record_count,
  SUM((data->>'forecastCost')::numeric) as total_forecast_cost,
  SUM((data->>'planCost')::numeric) as total_plan_cost,
  AVG((data->>'monthlyRate')::numeric) as avg_monthly_rate
FROM pfa_mirror
WHERE is_discontinued = false
GROUP BY organization_id, category, source;

-- Refresh automatically
CREATE INDEX ON mv_pfa_kpi_stats(organization_id);
```

**Auto-Refresh Strategy**:
- Trigger: After sync completion
- Frequency: Every 15 minutes
- Method: `REFRESH MATERIALIZED VIEW CONCURRENTLY`

---

## 🚀 Caching Strategy

### Redis Cache Layers

**1. API Response Cache** (TTL: 5 minutes):
```typescript
// Cache merged PFA data
cache.set(`pfa:${orgId}:data`, mergedData, 300);

// Cache KPI stats
cache.set(`pfa:${orgId}:stats`, kpiStats, 300);
```

**2. Organization Data Cache** (TTL: 15 minutes):
```typescript
// Cache active org configuration
cache.set(`org:${orgId}:config`, orgConfig, 900);

// Cache user permissions
cache.set(`user:${userId}:perms`, permissions, 900);
```

**3. AI Query Cache** (TTL: 1 hour):
```typescript
// Cache AI-generated SQL queries
const queryHash = hash(naturalLanguageQuery);
cache.set(`ai:query:${queryHash}`, sqlQuery, 3600);
```

### Cache Invalidation

**Invalidate on**:
- Draft save → Invalidate `pfa:${orgId}:data`
- Commit → Invalidate `pfa:${orgId}:*`
- Sync complete → Invalidate `pfa:${orgId}:*`
- Org config change → Invalidate `org:${orgId}:*`

---

## 🧪 Load Testing Scenarios

### Scenario 1: API Load Test
- **Target**: 1,000 requests/second
- **Endpoints**: GET /api/pfa/:orgId with filters
- **Duration**: 5 minutes
- **Expected**: <200ms p95 latency, 0% errors

### Scenario 2: Sync Worker Stress Test
- **Target**: Sync 1M records across 50 organizations
- **Concurrency**: 10 organizations in parallel
- **Expected**: Complete in <15 minutes, 0% data loss

### Scenario 3: Database Stress Test
- **Target**: 10,000 JSONB merge queries/second
- **Dataset**: 1M PFA records + 100K modifications
- **Expected**: <50ms average query time

### Scenario 4: Concurrent User Simulation
- **Target**: 100 concurrent users
- **Actions**: Browse, filter, edit, save drafts, commit
- **Duration**: 30 minutes
- **Expected**: No deadlocks, <500ms p95 latency

---

## 📊 Grafana Dashboards

### Dashboard 1: Sync Monitoring
**Panels**:
- Sync operations per hour (timeline)
- Success rate (gauge)
- Active syncs (table)
- Error rate by organization (bar chart)
- Throughput (records/second)
- Average sync duration

### Dashboard 2: API Performance
**Panels**:
- Request rate (timeline)
- Response time percentiles (p50, p95, p99)
- Requests by endpoint (pie chart)
- Error rate (timeline)
- Concurrent requests (gauge)

### Dashboard 3: Database Health
**Panels**:
- Query latency (heatmap)
- Slow queries (table)
- Connection pool status (gauge)
- Table sizes (bar chart)
- Index hit rate (timeline)
- Cache hit rate (gauge)

---

## 🚨 Alerting Rules

### Critical Alerts (Page on-call)
- Sync failure rate > 50% for 15 minutes
- API error rate > 10% for 5 minutes
- Database connections exhausted
- Disk usage > 90%
- API response time p95 > 2 seconds

### Warning Alerts (Email/Slack)
- Sync failure rate > 20% for 30 minutes
- API error rate > 5% for 15 minutes
- Slow queries > 100/hour
- Cache hit rate < 50%
- Disk usage > 75%

---

## 🔗 Related Documentation

- **Phase 3**: `docs/PHASE_3_LIVE_MERGE_API.md` - API architecture to monitor
- **Phase 2**: Background Sync Worker - Sync operations to monitor
- **Database**: `backend/DATABASE_ARCHITECTURE.md` - Schema to optimize
- **Deployment**: `docs/DEPLOYMENT_GUIDE.md` - Production deployment

---

## 📝 Implementation Timeline

### Day 1: Monitoring Foundation
- Morning: Set up Prometheus + Grafana
- Afternoon: Add metrics to API endpoints
- Evening: Create basic dashboards

### Day 2: Database Optimization
- Morning: Add performance indexes
- Afternoon: Create materialized views
- Evening: Query plan analysis

### Day 3: Caching Layer
- Morning: Set up Redis
- Afternoon: Implement cache strategies
- Evening: Test cache performance

### Day 4: Load Testing & Tuning
- Morning: Run load tests
- Afternoon: Analyze bottlenecks
- Evening: Performance tuning

---

## 🎯 Success Criteria

### Performance Requirements
- [ ] API p95 latency < 200ms (with 1M records)
- [ ] Database queries < 50ms (with indexes)
- [ ] Sync throughput > 5K records/minute
- [ ] Cache hit rate > 80%

### Scalability Requirements
- [ ] System handles 1M+ PFA records
- [ ] Support 100+ concurrent users
- [ ] Support 50+ organizations
- [ ] Handle 1000+ API requests/second

### Monitoring Requirements
- [ ] All critical metrics tracked
- [ ] Grafana dashboards operational
- [ ] Alerting rules configured
- [ ] Load testing complete

### Documentation Requirements
- [ ] Monitoring guide complete
- [ ] Performance tuning guide complete
- [ ] Load test results documented
- [ ] Runbooks for common issues

---

## 📦 Deliverables

**Code**:
- Prometheus metrics exporters
- Grafana dashboards
- Redis caching layer
- Database indexes and materialized views
- Load testing scripts

**Configuration**:
- Prometheus configuration
- Grafana dashboards (JSON)
- Redis configuration
- PM2 process configuration

**Documentation**:
- Monitoring setup guide
- Performance tuning guide
- Load testing results
- Operational runbooks

---

**Status**: PENDING
**Blocked By**: Phase 5 completion (optional)
**Next Step**: Complete Phase 4 and 5 testing, then start Phase 6 with devsecops-engineer agent

*Document created: 2025-11-25*
*Last updated: 2025-11-25*
