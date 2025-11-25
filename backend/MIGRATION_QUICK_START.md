# Migration Quick Start: SQLite → PostgreSQL Mirror + Delta

## Prerequisites

- Node.js 18+
- Docker Desktop (for local PostgreSQL)
- Existing PFA Vanguard installation with SQLite database

## Step-by-Step Migration

### 1. Backup Existing Data

```bash
# Export current SQLite database
cd backend
cp prisma/dev.db prisma/dev.db.backup

# Optional: Export to SQL
sqlite3 prisma/dev.db .dump > backup/sqlite_backup.sql
```

### 2. Start PostgreSQL with Docker

```bash
# Start PostgreSQL container
cd backend
docker-compose -f docker-compose.postgres.yml up -d

# Verify container is running
docker ps | grep pfa-vanguard-db

# Check logs
docker logs pfa-vanguard-db
```

**Access pgAdmin** (optional):
- URL: http://localhost:5050
- Email: admin@pfa-vanguard.local
- Password: admin123

### 3. Update Environment Variables

**Edit `backend/.env`**:

```bash
# OLD (SQLite)
# DATABASE_URL="file:./prisma/dev.db"

# NEW (PostgreSQL)
DATABASE_URL="postgresql://postgres:pfa_vanguard_dev@localhost:5432/pfa_vanguard?schema=public"
```

### 4. Update Prisma Schema

**File: `backend/prisma/schema.prisma`**

Change line 10:
```prisma
// OLD
provider = "sqlite"

// NEW
provider = "postgresql"
```

### 5. Apply Migration

```bash
cd backend

# Generate Prisma Client
npm run prisma:generate

# Apply migration (creates Mirror + Delta tables)
npx prisma migrate dev --name mirror_delta_architecture

# If migration fails, apply SQL manually:
# docker exec -i pfa-vanguard-db psql -U postgres -d pfa_vanguard < prisma/migrations/20251125_mirror_delta_architecture/migration.sql
```

### 6. Migrate Existing Data

```bash
# Run migration script
cd backend
npx tsx scripts/db/migrate-to-mirror.ts

# This will:
# - Read all PfaRecord data
# - Transform to JSONB format
# - Insert into pfa_mirror in batches
# - Refresh materialized views
# - Verify data integrity
```

**Expected Output**:
```
========================================
PFA VANGUARD: Mirror Migration
========================================

[1/6] Checking if pfa_mirror table exists...
   ✓ pfa_mirror table exists

[2/6] Counting existing PfaRecord data...
   ✓ Found 20280 records to migrate

[3/6] Checking for existing mirror data...
   ✓ pfa_mirror is empty, ready to migrate

[4/6] Migrating data to pfa_mirror...
   Batch size: 1000 records
   [Batch 1/21] 4.9% - Migrated: 1000, Failed: 0
   [Batch 2/21] 9.9% - Migrated: 2000, Failed: 0
   ...
   [Batch 21/21] 100.0% - Migrated: 20280, Failed: 0

   ✓ Migration complete!

[5/6] Refreshing materialized views...
   ✓ Materialized views refreshed

[6/6] Verifying data integrity...
   Original records: 20280
   Migrated records: 20280
   ✓ Data integrity verified: All records migrated

========================================
MIGRATION SUMMARY
========================================
Total records: 20280
Successfully migrated: 20280
Failed: 0
Duration: 45.32s
Average: 2.23ms per record
========================================
```

### 7. Verify Migration

**Test Queries**:

```bash
# Connect to PostgreSQL
docker exec -it pfa-vanguard-db psql -U postgres -d pfa_vanguard

# Check record counts
SELECT organization_id, COUNT(*) FROM pfa_mirror GROUP BY organization_id;

# Test merged view
SELECT * FROM pfa_merged_live LIMIT 5;

# Test KPI summary
SELECT * FROM pfa_kpi_summary;

# Test timeline bounds
SELECT * FROM pfa_timeline_bounds;

# Test query performance
SELECT * FROM analyze_pfa_query_performance('HOLNG', 'Heavy Equipment', 'Rental');
```

**Expected Results**:
```
 organization_id | count
-----------------+-------
 HOLNG          | 15000
 RIO            | 5280
(2 rows)

 query_type    | execution_time_ms | rows_returned
---------------+-------------------+--------------
 Simple Filter | 32.45             | NULL
 Merged View   | 85.23             | NULL
 KPI Summary   | 18.67             | NULL
```

### 8. Update Application Code

**Before (Direct Prisma Queries)**:
```typescript
// OLD: Direct PfaRecord query
const records = await prisma.pfaRecord.findMany({
  where: {
    organizationId: 'HOLNG',
    category: 'Heavy Equipment',
  },
});
```

**After (Raw SQL with Merged View)**:
```typescript
// NEW: Query pfa_merged_live view
const records = await prisma.$queryRaw<any[]>`
  SELECT * FROM pfa_merged_live
  WHERE organization_id = ${organizationId}
    AND category = ${category}
  ORDER BY forecast_start
  LIMIT 1000
`;
```

**KPI Queries**:
```typescript
// Query materialized view
const kpis = await prisma.$queryRaw<any[]>`
  SELECT * FROM pfa_kpi_summary
  WHERE organization_id = ${organizationId}
  ORDER BY total_forecast_cost DESC
`;
```

### 9. Setup Materialized View Refresh

**Option A: Cron Job (Linux/Mac)**:
```bash
# Edit crontab
crontab -e

# Add refresh job (every 15 minutes)
*/15 * * * * docker exec pfa-vanguard-db psql -U postgres -d pfa_vanguard -c "SELECT refresh_pfa_materialized_views();"
```

**Option B: Node.js Scheduled Task**:

Create `backend/src/jobs/refreshMaterializedViews.ts`:
```typescript
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Run every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('Refreshing materialized views...');
  try {
    await prisma.$executeRaw`SELECT refresh_pfa_materialized_views()`;
    console.log('✓ Materialized views refreshed');
  } catch (error) {
    console.error('✗ Failed to refresh materialized views:', error);
  }
});
```

Add to `backend/src/server.ts`:
```typescript
import './jobs/refreshMaterializedViews';  // Start cron job
```

### 10. Production Deployment

**For AWS RDS PostgreSQL**:

1. Update DATABASE_URL:
```bash
DATABASE_URL="postgresql://username:password@your-rds-endpoint.us-east-1.rds.amazonaws.com:5432/pfa_vanguard?schema=public"
```

2. Apply migration:
```bash
npx prisma migrate deploy
```

3. Run data migration:
```bash
npx tsx scripts/db/migrate-to-mirror.ts
```

4. Setup CloudWatch Events for materialized view refresh

**For Heroku Postgres**:

1. Provision addon:
```bash
heroku addons:create heroku-postgresql:standard-0
```

2. Apply migration:
```bash
heroku run npm run prisma:migrate
```

3. Run data migration:
```bash
heroku run npx tsx scripts/db/migrate-to-mirror.ts
```

---

## Troubleshooting

### Issue: Migration script hangs

**Solution**: Increase Node.js memory limit
```bash
NODE_OPTIONS="--max-old-space-size=4096" npx tsx scripts/db/migrate-to-mirror.ts
```

### Issue: "relation pfa_mirror does not exist"

**Solution**: Apply migration SQL manually
```bash
docker exec -i pfa-vanguard-db psql -U postgres -d pfa_vanguard < prisma/migrations/20251125_mirror_delta_architecture/migration.sql
```

### Issue: Slow query performance

**Solution**: Run EXPLAIN ANALYZE to check indexes
```sql
EXPLAIN ANALYZE
SELECT * FROM pfa_merged_live
WHERE organization_id = 'HOLNG'
  AND category = 'Heavy Equipment';
```

Look for "Seq Scan" (bad) vs "Index Scan" (good)

### Issue: Materialized view refresh fails

**Solution**: Increase work_mem
```sql
SET work_mem = '256MB';
REFRESH MATERIALIZED VIEW CONCURRENTLY pfa_kpi_summary;
RESET work_mem;
```

---

## Performance Validation

Run these queries to validate performance targets:

```sql
-- Should be <50ms
EXPLAIN ANALYZE
SELECT * FROM pfa_merged_live
WHERE organization_id = 'HOLNG'
  AND category = 'Heavy Equipment'
  AND source = 'Rental'
LIMIT 1000;

-- Should be <50ms (materialized view)
EXPLAIN ANALYZE
SELECT * FROM pfa_kpi_summary
WHERE organization_id = 'HOLNG';

-- Should be <20ms (materialized view)
EXPLAIN ANALYZE
SELECT * FROM pfa_timeline_bounds
WHERE organization_id = 'HOLNG';
```

**Success Criteria**:
- All queries complete in <100ms
- No "Seq Scan" on large tables
- Materialized views return instantly (<50ms)

---

## Rollback Procedure

If migration fails and you need to rollback:

```bash
# Stop application
pm2 stop pfa-vanguard

# Restore SQLite backup
cd backend
rm prisma/dev.db
cp prisma/dev.db.backup prisma/dev.db

# Revert schema.prisma
# Change provider back to "sqlite"

# Revert .env
DATABASE_URL="file:./prisma/dev.db"

# Restart application
pm2 start pfa-vanguard
```

---

## Next Steps

After successful migration:

1. Monitor query performance with `pg_stat_statements`
2. Setup automated backups (pg_dump or WAL archiving)
3. Configure connection pooling (PgBouncer recommended)
4. Setup monitoring (Prometheus + Grafana)
5. Test disaster recovery procedures
6. Update documentation with PostgreSQL-specific queries
7. Consider Redis caching layer for hot data

---

**Migration Support**: See `backend/DATABASE_ARCHITECTURE.md` for detailed architecture documentation
