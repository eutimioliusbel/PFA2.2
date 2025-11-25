# PostgreSQL Migration Quick Reference

One-page cheat sheet for SQLite to PostgreSQL migration.

## Pre-Migration (5 minutes)

```bash
cd backend

# 1. Backup SQLite database
cp prisma/dev.db backups/dev.db.backup-$(date +%Y%m%d-%H%M%S)
cp .env .env.sqlite.backup

# 2. Analyze current data
npx tsx scripts/migration/analyze-current-data.ts

# 3. Export data
npx tsx scripts/migration/export-sqlite-data.ts

# 4. Verify export
npx tsx scripts/migration/verify-export.ts scripts/migration/export-<date>
```

## PostgreSQL Setup (10 minutes)

### Option A: Docker (Recommended for Dev)

```bash
cd backend

cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    container_name: pfa_postgres
    environment:
      POSTGRES_DB: pfa_vanguard
      POSTGRES_USER: pfa_user
      POSTGRES_PASSWORD: secure_password_here
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
volumes:
  postgres_data:
EOF

docker-compose up -d
```

### Option B: Local PostgreSQL

**Windows**:
```powershell
# Download from https://www.postgresql.org/download/windows/
# After install:
psql -U postgres
CREATE DATABASE pfa_vanguard;
CREATE USER pfa_user WITH ENCRYPTED PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE pfa_vanguard TO pfa_user;
\q
```

**macOS**:
```bash
brew install postgresql@15
brew services start postgresql@15
createdb pfa_vanguard
psql pfa_vanguard
CREATE USER pfa_user WITH ENCRYPTED PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE pfa_vanguard TO pfa_user;
\q
```

**Linux**:
```bash
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres psql
CREATE DATABASE pfa_vanguard;
CREATE USER pfa_user WITH ENCRYPTED PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE pfa_vanguard TO pfa_user;
\q
```

## Configure Connection (2 minutes)

```bash
cd backend

# Update .env
nano .env
```

Change:
```env
# Before
DATABASE_URL="file:./prisma/dev.db"

# After
DATABASE_URL="postgresql://pfa_user:secure_password_here@localhost:5432/pfa_vanguard?schema=public&connection_limit=10"
```

Update `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"  # Changed from "sqlite"
  url      = env("DATABASE_URL")
}
```

## Run Migration (5 minutes)

```bash
cd backend

# 1. Generate Prisma client
npx prisma generate

# 2. Test connection
psql $DATABASE_URL -c "SELECT 1;"

# 3. Apply schema migrations
npx prisma migrate deploy

# 4. Import data
npx tsx scripts/migration/import-to-postgresql.ts scripts/migration/export-<date>

# 5. Verify
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
Promise.all([
  prisma.user.count(),
  prisma.organization.count(),
  prisma.pfaRecord.count()
]).then(([users, orgs, pfa]) => {
  console.log({ users, orgs, pfa });
  prisma.\$disconnect();
});
"

# 6. Start server
npm run dev
```

## Verify Migration (5 minutes)

### Check Counts
```bash
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const counts = {
    users: await p.user.count(),
    organizations: await p.organization.count(),
    apiConfigs: await p.apiConfiguration.count(),
    pfaRecords: await p.pfaRecord.count()
  };
  console.table(counts);
  await p.\$disconnect();
})();
"
```

### Test Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Check Indexes
```sql
psql $DATABASE_URL -c "
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
"
```

## Rollback (if needed)

```bash
cd backend

# 1. Stop server
pkill -f "npm run dev"

# 2. Restore .env
cp .env.sqlite.backup .env

# 3. Revert schema.prisma (change provider to "sqlite")
nano prisma/schema.prisma

# 4. Restore database
cp backups/dev.db.backup-<timestamp> prisma/dev.db

# 5. Regenerate client
npx prisma generate

# 6. Start server
npm run dev
```

## Post-Migration Optimization

### Create Performance Indexes
```sql
psql $DATABASE_URL

CREATE INDEX CONCURRENTLY idx_pfa_org_area_category
  ON pfa_records(organizationId, areaSilo, category)
  WHERE isDiscontinued = false;

CREATE INDEX CONCURRENTLY idx_pfa_forecast_dates
  ON pfa_records(organizationId, forecastStart, forecastEnd);

CREATE INDEX CONCURRENTLY idx_pfa_pending_sync
  ON pfa_records(organizationId, syncState, modifiedAt)
  WHERE syncState IN ('modified', 'pending_sync');

ANALYZE pfa_records;
```

### Setup Automated Backups
```bash
# Create backup script
cat > /usr/local/bin/backup-pfa-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
pg_dump -U pfa_user -h localhost -d pfa_vanguard \
  --format=custom \
  --file="$BACKUP_DIR/pfa_vanguard-$TIMESTAMP.dump"
gzip "$BACKUP_DIR/pfa_vanguard-$TIMESTAMP.dump"
find $BACKUP_DIR -name "*.dump.gz" -mtime +30 -delete
EOF

chmod +x /usr/local/bin/backup-pfa-db.sh

# Schedule daily backups
crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-pfa-db.sh
```

## Common Issues

### Issue: "Connection refused"
```bash
# Check PostgreSQL is running
docker ps | grep postgres  # Docker
sudo systemctl status postgresql  # Linux

# Test connection
psql $DATABASE_URL -c "SELECT 1;"
```

### Issue: "Checksum mismatch"
```bash
# Re-export data
rm -rf scripts/migration/export-*
npx tsx scripts/migration/export-sqlite-data.ts
```

### Issue: "Foreign key violation"
```bash
# Clear database and re-import
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npx prisma migrate deploy
npx tsx scripts/migration/import-to-postgresql.ts scripts/migration/export-<date>
```

### Issue: "Timeout during import"
```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" npx tsx scripts/migration/import-to-postgresql.ts scripts/migration/export-<date>
```

## Connection Strings

**Local PostgreSQL**:
```env
DATABASE_URL="postgresql://pfa_user:password@localhost:5432/pfa_vanguard?schema=public"
```

**Docker PostgreSQL**:
```env
DATABASE_URL="postgresql://pfa_user:password@localhost:5432/pfa_vanguard?schema=public"
```

**AWS RDS**:
```env
DATABASE_URL="postgresql://pfa_user:password@instance.xxxxxx.us-east-1.rds.amazonaws.com:5432/pfa_vanguard?schema=public"
```

**Azure**:
```env
DATABASE_URL="postgresql://pfa_user@server:password@server.postgres.database.azure.com:5432/pfa_vanguard?schema=public&sslmode=require"
```

**Google Cloud SQL**:
```env
DATABASE_URL="postgresql://pfa_user:password@/pfa_vanguard?host=/cloudsql/project:region:instance&schema=public"
```

## Performance Targets

| Metric | Target |
|--------|--------|
| Simple queries (filters) | < 50ms |
| Complex queries (joins) | < 100ms |
| Aggregations | < 200ms |
| Data import | < 500 records/sec |
| Connection pool | 10-20 connections |
| Cache hit ratio | > 95% |

## Monitoring Commands

```sql
-- Database size
SELECT pg_size_pretty(pg_database_size('pfa_vanguard'));

-- Table sizes
SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'pfa_vanguard';

-- Slow queries
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state != 'idle' AND now() - query_start > interval '1 second';

-- Cache hit ratio
SELECT sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit + heap_blks_read), 0) as cache_hit_ratio
FROM pg_statio_user_tables;
```

## Files Created

| File | Purpose |
|------|---------|
| `analyze-current-data.ts` | Pre-migration analysis |
| `export-sqlite-data.ts` | Export SQLite to JSON |
| `verify-export.ts` | Validate exported data |
| `import-to-postgresql.ts` | Import JSON to PostgreSQL |
| `MIGRATION_GUIDE.md` | Comprehensive guide |
| `POSTGRESQL_OPTIMIZATION.md` | Performance tuning |
| `README.md` | Script documentation |
| `QUICK_REFERENCE.md` | This file |

## Timeline

| Phase | Duration | Notes |
|-------|----------|-------|
| Pre-migration (backup, export) | 5 min | Current DB: 67 records |
| PostgreSQL setup | 10 min | Docker recommended |
| Configure connection | 2 min | Update .env + schema.prisma |
| Run migration | 5 min | Schema + data import |
| Verification | 5 min | Check counts, test login |
| **Total** | **~30 min** | Small dataset |

For large datasets (100K+ records): ~60 minutes

---

**Quick Reference Version**: 1.0.0
**Last Updated**: 2025-11-25
