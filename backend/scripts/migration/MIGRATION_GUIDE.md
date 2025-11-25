# SQLite to PostgreSQL Migration Guide

Complete step-by-step guide for migrating PFA Vanguard from SQLite to PostgreSQL.

## Table of Contents

1. [Pre-Migration Checklist](#pre-migration-checklist)
2. [Setup PostgreSQL Database](#setup-postgresql-database)
3. [Backup Current Database](#backup-current-database)
4. [Export SQLite Data](#export-sqlite-data)
5. [Configure PostgreSQL Connection](#configure-postgresql-connection)
6. [Run Database Migrations](#run-database-migrations)
7. [Import Data](#import-data)
8. [Verification](#verification)
9. [Rollback Procedure](#rollback-procedure)
10. [Troubleshooting](#troubleshooting)

---

## Pre-Migration Checklist

Before starting migration, ensure:

- [ ] **Backup Current Database**: Copy `backend/prisma/dev.db` to safe location
- [ ] **PostgreSQL Installed**: Verify with `psql --version`
- [ ] **Postgres Running**: Check service status
- [ ] **Disk Space**: At least 500MB free (current DB is 220KB, allow for growth)
- [ ] **Node Packages**: Run `npm install` in backend directory
- [ ] **Test Environment**: Perform migration in dev/staging first, NOT production
- [ ] **Downtime Window**: Schedule maintenance window (estimated 15-30 minutes)
- [ ] **Team Notification**: Notify team of planned downtime

---

## Setup PostgreSQL Database

### Option 1: Local PostgreSQL Installation

#### Windows (using PostgreSQL installer):
```powershell
# Download from https://www.postgresql.org/download/windows/
# Run installer and set password for postgres user

# Verify installation
psql --version

# Create database
psql -U postgres
CREATE DATABASE pfa_vanguard;
CREATE USER pfa_user WITH ENCRYPTED PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE pfa_vanguard TO pfa_user;
\q
```

#### macOS (using Homebrew):
```bash
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb pfa_vanguard
psql pfa_vanguard
CREATE USER pfa_user WITH ENCRYPTED PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE pfa_vanguard TO pfa_user;
\q
```

#### Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database
sudo -u postgres psql
CREATE DATABASE pfa_vanguard;
CREATE USER pfa_user WITH ENCRYPTED PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE pfa_vanguard TO pfa_user;
\q
```

### Option 2: Docker PostgreSQL (Recommended for Dev)

```bash
# Create docker-compose.yml in backend directory
cat > backend/docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: pfa_postgres
    restart: unless-stopped
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

# Start PostgreSQL
cd backend
docker-compose up -d

# Verify running
docker ps | grep pfa_postgres
```

### Option 3: Cloud PostgreSQL (Production)

**AWS RDS**:
```bash
# Create RDS PostgreSQL instance via AWS Console or CLI
# Choose PostgreSQL 15.x
# Instance type: db.t3.micro (dev) or db.t3.medium (prod)
# Storage: 20GB GP2 (auto-scaling enabled)
# Enable automatic backups (7-day retention)
# Note endpoint: <instance-name>.xxxxxx.us-east-1.rds.amazonaws.com
```

**Azure Database for PostgreSQL**:
```bash
# Create via Azure Portal
# Choose PostgreSQL Flexible Server
# Version: 15
# Compute: Burstable B1ms (dev) or General Purpose D2s_v3 (prod)
# Storage: 32GB
# Enable automated backups
```

**Google Cloud SQL**:
```bash
# Create via GCP Console
# Choose PostgreSQL 15
# Machine type: db-f1-micro (dev) or db-n1-standard-1 (prod)
# Storage: 10GB SSD
# Enable automated backups
```

---

## Backup Current Database

**Critical**: Always backup before migration!

```bash
cd backend

# Create backup directory
mkdir -p backups/pre-migration

# Copy SQLite database
cp prisma/dev.db backups/pre-migration/dev.db.backup-$(date +%Y%m%d-%H%M%S)

# Verify backup
ls -lh backups/pre-migration/

# Optional: Create compressed backup
tar -czf backups/pre-migration/complete-backup-$(date +%Y%m%d-%H%M%S).tar.gz \
  prisma/dev.db \
  .env \
  prisma/schema.prisma
```

---

## Export SQLite Data

Run the analysis script first to understand what will be exported:

```bash
cd backend

# Analyze current database
npx tsx scripts/migration/analyze-current-data.ts

# Review analysis output
cat scripts/migration/pre-migration-analysis.json
```

Expected output:
```
📊 Analyzing Database Tables...

✓ Users: 5 records
✓ Organizations: 2 records
✓ UserOrganizations: 7 records
✓ AiProviders: 3 records
✓ OrganizationAiConfigs: 1 records
✓ AiUsageLogs: 0 records
✓ ApiConfigurations: 6 records
✓ OrganizationApiCredentials: 2 records
✓ DataSourceMappings: 4 records
✓ FieldConfigurations: 0 records
✓ PfaRecords: 0 records
✓ SyncLogs: 0 records

✅ Analysis complete!
```

Now export the data:

```bash
# Export all data to JSON files
npx tsx scripts/migration/export-sqlite-data.ts
```

Expected output:
```
╔═══════════════════════════════════════════════════════════════╗
║  SQLite Data Export for PostgreSQL Migration                 ║
╚═══════════════════════════════════════════════════════════════╝

📦 Exporting users...
   ✓ Exported 5 records
   ✓ Checksum: 7a8f3c...

📦 Exporting organizations...
   ✓ Exported 2 records
   ✓ Checksum: 9b2e1d...

[... more tables ...]

✅ Export completed successfully!
   Duration: 1.23s
   Total Records: 30
   Overall Checksum: 4c7a...

💾 Saving export files to: /path/to/backend/scripts/migration/export-2025-11-25

   ✓ Saved manifest.json
   ✓ Saved users.json (5 records, 2.45 KB)
   ✓ Saved organizations.json (2 records, 1.12 KB)
   [... more files ...]
   ✓ Saved complete-export.json (0.05 MB)

✅ All files saved successfully!
```

**Important**: Save the export directory path! You'll need it for import.

---

## Configure PostgreSQL Connection

Update your `.env` file to use PostgreSQL:

```bash
cd backend

# Backup current .env
cp .env .env.sqlite.backup

# Edit .env file
nano .env  # or use your preferred editor
```

**Before (SQLite)**:
```env
DATABASE_URL="file:./prisma/dev.db"
```

**After (PostgreSQL)**:

**Local PostgreSQL**:
```env
DATABASE_URL="postgresql://pfa_user:secure_password_here@localhost:5432/pfa_vanguard?schema=public"
```

**Docker PostgreSQL**:
```env
DATABASE_URL="postgresql://pfa_user:secure_password_here@localhost:5432/pfa_vanguard?schema=public"
```

**AWS RDS**:
```env
DATABASE_URL="postgresql://pfa_user:secure_password@your-instance.xxxxxx.us-east-1.rds.amazonaws.com:5432/pfa_vanguard?schema=public"
```

**Connection String Format**:
```
postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]?schema=public
```

---

## Run Database Migrations

Update Prisma schema to use PostgreSQL:

```bash
cd backend

# Edit prisma/schema.prisma
nano prisma/schema.prisma
```

**Change datasource from**:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

**To**:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Now run migrations:

```bash
# Generate Prisma client for PostgreSQL
npx prisma generate

# Test connection
npx prisma db pull --force

# Apply migrations to PostgreSQL
npx prisma migrate deploy

# Or for development (creates new migration)
npx prisma migrate dev --name postgresql_migration
```

Expected output:
```
✔ Generated Prisma Client
✔ Applied 10 migrations
✔ Database schema synchronized
```

Verify schema:
```bash
# Check tables were created
npx prisma studio
# Should see all tables, but empty data
```

---

## Import Data

Now import the exported SQLite data into PostgreSQL:

```bash
cd backend

# Import data (use the export directory path from earlier)
npx tsx scripts/migration/import-to-postgresql.ts scripts/migration/export-2025-11-25
```

Expected output:
```
╔═══════════════════════════════════════════════════════════════╗
║  PostgreSQL Data Import from SQLite Export                   ║
╚═══════════════════════════════════════════════════════════════╝

📂 Loading export from: scripts/migration/export-2025-11-25
   ✓ Manifest loaded (12 tables, 30 total records)
   ✓ Export date: 2025-11-25T...
   ✓ Overall checksum: 4c7a...

📥 Importing users (5 records)...
   ✓ Checksum verified
   Progress: 100.0%
   ✓ Imported 5 records in 0.34s
   ✓ Verified count matches: 5

[... more tables ...]

✅ Import completed successfully!
   Total Duration: 5.67s
   Total Records: 30

╔═══════════════════════════════════════════════════════════════╗
║  Import Summary                                               ║
╚═══════════════════════════════════════════════════════════════╝
Status:             ✅ SUCCESS
Imported Tables:    12
Total Records:      30
Total Duration:     5.67s
```

---

## Verification

Verify the migration was successful:

### 1. Check Row Counts

```bash
cd backend

# Create verification script
cat > verify-migration.ts << 'EOF'
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  console.log('Verifying migration...\n');

  const counts = {
    users: await prisma.user.count(),
    organizations: await prisma.organization.count(),
    userOrganizations: await prisma.userOrganization.count(),
    aiProviders: await prisma.aiProvider.count(),
    organizationAiConfigs: await prisma.organizationAiConfig.count(),
    aiUsageLogs: await prisma.aiUsageLog.count(),
    apiConfigurations: await prisma.apiConfiguration.count(),
    organizationApiCredentials: await prisma.organizationApiCredentials.count(),
    dataSourceMappings: await prisma.dataSourceMapping.count(),
    fieldConfigurations: await prisma.fieldConfiguration.count(),
    pfaRecords: await prisma.pfaRecord.count(),
    syncLogs: await prisma.syncLog.count()
  };

  console.table(counts);
  console.log('\nTotal records:', Object.values(counts).reduce((a, b) => a + b, 0));

  await prisma.$disconnect();
}

verify();
EOF

npx tsx verify-migration.ts
```

Compare counts with the export manifest and pre-migration analysis.

### 2. Check Sample Data

```bash
# Check users
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.user.findMany().then(users => {
  console.log('Users:', users.map(u => ({ username: u.username, role: u.role })));
  prisma.\$disconnect();
});
"

# Check organizations
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.organization.findMany().then(orgs => {
  console.log('Organizations:', orgs.map(o => ({ code: o.code, name: o.name })));
  prisma.\$disconnect();
});
"
```

### 3. Test Application

```bash
# Start backend server
npm run dev
```

Visit `http://localhost:3001/health` - should return `{ "status": "ok" }`

Try logging in with admin credentials:
- Username: `admin`
- Password: `admin123`

### 4. Check Foreign Keys

```bash
# Connect to PostgreSQL
psql $DATABASE_URL

# List foreign keys
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;

\q
```

### 5. Check Indexes

```bash
psql $DATABASE_URL -c "
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
"
```

---

## Rollback Procedure

If migration fails or issues are discovered, rollback to SQLite:

### Step 1: Stop Backend Server

```bash
# Stop the server (Ctrl+C or kill process)
pkill -f "npm run dev"
```

### Step 2: Restore .env

```bash
cd backend

# Restore SQLite connection string
cp .env.sqlite.backup .env

# Verify DATABASE_URL is back to SQLite
cat .env | grep DATABASE_URL
# Should show: DATABASE_URL="file:./prisma/dev.db"
```

### Step 3: Restore Prisma Schema

```bash
# Revert schema.prisma to SQLite
nano prisma/schema.prisma
```

Change back to:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

### Step 4: Restore Database Backup

```bash
# List backups
ls -lh backups/pre-migration/

# Restore latest backup
cp backups/pre-migration/dev.db.backup-<timestamp> prisma/dev.db

# Verify backup
ls -lh prisma/dev.db
```

### Step 5: Regenerate Prisma Client

```bash
# Generate SQLite client
npx prisma generate

# Verify schema
npx prisma studio
```

### Step 6: Test Application

```bash
# Start server
npm run dev

# Test login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

### Step 7: Document Rollback

Create rollback report:

```bash
cat > rollback-report-$(date +%Y%m%d-%H%M%S).md << 'EOF'
# Migration Rollback Report

**Date**: [DATE]
**Performed By**: [NAME]
**Reason for Rollback**: [REASON]

## Actions Taken
1. Stopped backend server
2. Restored .env from backup
3. Reverted prisma/schema.prisma to SQLite
4. Restored dev.db from backup: [BACKUP_FILENAME]
5. Regenerated Prisma client
6. Tested application - ✅ Working

## Next Steps
- [ ] Investigate migration failure
- [ ] Fix root cause
- [ ] Plan re-migration
EOF
```

---

## Troubleshooting

### Issue: "Connection refused" during import

**Cause**: PostgreSQL not running or wrong connection string

**Solution**:
```bash
# Check PostgreSQL is running
docker ps | grep postgres  # For Docker
sudo systemctl status postgresql  # For Linux service

# Test connection manually
psql $DATABASE_URL -c "SELECT 1;"

# Verify .env DATABASE_URL is correct
cat backend/.env | grep DATABASE_URL
```

### Issue: "Checksum mismatch" during import

**Cause**: Export data was modified or corrupted

**Solution**:
```bash
# Re-run export
cd backend
rm -rf scripts/migration/export-*
npx tsx scripts/migration/export-sqlite-data.ts

# Use new export directory for import
```

### Issue: "Foreign key constraint violation"

**Cause**: Tables imported in wrong order

**Solution**:
The import script already handles dependency order. If this error occurs:
```bash
# Drop all tables and re-import
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Re-run migrations
cd backend
npx prisma migrate deploy

# Re-import
npx tsx scripts/migration/import-to-postgresql.ts scripts/migration/export-<date>
```

### Issue: "Timeout during large table import"

**Cause**: PFA records table too large

**Solution**:
Edit `import-to-postgresql.ts` and reduce batch size:
```typescript
// Line ~250
case 'pfa_records':
  const pfaBatchSize = 100;  // Reduce from 500 to 100
```

### Issue: "Authentication failed"

**Cause**: Wrong PostgreSQL credentials

**Solution**:
```bash
# Reset PostgreSQL user password
psql -U postgres
ALTER USER pfa_user WITH PASSWORD 'new_secure_password';
\q

# Update .env
nano backend/.env
# Change DATABASE_URL password
```

### Issue: "Out of memory" during import

**Cause**: Large dataset exhausting Node.js memory

**Solution**:
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npx tsx scripts/migration/import-to-postgresql.ts scripts/migration/export-<date>
```

---

## Performance Optimization Post-Migration

After successful migration, optimize PostgreSQL:

### 1. Analyze Tables

```sql
-- Connect to database
psql $DATABASE_URL

-- Analyze all tables
ANALYZE;

-- Or specific table
ANALYZE pfa_records;
```

### 2. Create Additional Indexes

```sql
-- High-cardinality filters for PFA queries
CREATE INDEX CONCURRENTLY idx_pfa_area_category
  ON pfa_records(organizationId, areaSilo, category)
  WHERE isDiscontinued = false;

CREATE INDEX CONCURRENTLY idx_pfa_date_range
  ON pfa_records(organizationId, forecastStart, forecastEnd);

-- AI query optimization
CREATE INDEX CONCURRENTLY idx_ai_usage_recent
  ON ai_usage_logs(organizationId, createdAt DESC);
```

### 3. Configure Connection Pool (Prisma)

Edit `backend/src/config/database.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['warn', 'error'],
  // Connection pool settings
  // PostgreSQL default: 100 connections
  // Reserve some for direct queries and monitoring
});

// Connection pool environment variables in .env:
// DATABASE_URL="postgresql://...?connection_limit=20&pool_timeout=30"
```

### 4. Enable Query Logging (Development Only)

```typescript
// In development, log slow queries
export const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'warn', emit: 'stdout' },
    { level: 'error', emit: 'stdout' },
  ],
});

prisma.$on('query', (e: any) => {
  if (e.duration > 100) {  // Log queries slower than 100ms
    console.log(`Slow Query (${e.duration}ms): ${e.query}`);
  }
});
```

---

## Migration Checklist Summary

Use this checklist during migration:

### Pre-Migration
- [ ] Backup SQLite database (`dev.db`)
- [ ] Backup `.env` file
- [ ] Run analysis script
- [ ] Export SQLite data
- [ ] Verify export checksums
- [ ] PostgreSQL database created
- [ ] PostgreSQL user created with permissions

### Migration
- [ ] Update `.env` DATABASE_URL to PostgreSQL
- [ ] Update `schema.prisma` provider to "postgresql"
- [ ] Run `npx prisma generate`
- [ ] Run `npx prisma migrate deploy`
- [ ] Verify schema created (check with Prisma Studio)
- [ ] Import data using import script
- [ ] Verify import checksums

### Post-Migration
- [ ] Verify row counts match export
- [ ] Check sample data integrity
- [ ] Test user authentication
- [ ] Test API endpoints
- [ ] Check foreign key constraints
- [ ] Verify indexes created
- [ ] Run performance queries
- [ ] Create additional indexes if needed
- [ ] Configure connection pooling
- [ ] Update documentation
- [ ] Notify team of completion

### Rollback (If Needed)
- [ ] Stop backend server
- [ ] Restore `.env.sqlite.backup`
- [ ] Revert `schema.prisma` to SQLite
- [ ] Restore `dev.db` from backup
- [ ] Run `npx prisma generate`
- [ ] Test application
- [ ] Document rollback reason

---

## Estimated Timeline

For current database size (~220KB, ~30 records):

| Phase | Duration |
|-------|----------|
| Pre-Migration (backup, analysis, export) | 5 minutes |
| PostgreSQL setup | 10 minutes |
| Schema migration | 2 minutes |
| Data import | 1 minute |
| Verification | 5 minutes |
| **Total** | **~25 minutes** |

For larger databases (100K+ PFA records):

| Phase | Duration |
|-------|----------|
| Export | 5-10 minutes |
| Import | 10-20 minutes |
| Verification | 10 minutes |
| **Total** | **~45 minutes** |

---

## Next Steps After Migration

1. **Monitor Performance**: Watch query times in first 24 hours
2. **Optimize Indexes**: Add indexes based on slow query log
3. **Configure Backups**: Set up automated PostgreSQL backups
4. **Update Documentation**: Update deployment docs with PostgreSQL requirements
5. **Plan Redis Caching**: Implement caching layer per 3-Tier Architecture
6. **Test Sync Operations**: Verify PEMS sync works with PostgreSQL
7. **Load Testing**: Run load tests to verify performance under load

---

## Support

If you encounter issues during migration:

1. **Check Logs**: `backend/logs/migration.log`
2. **Rollback**: Follow rollback procedure above
3. **Investigate**: Review error messages and troubleshooting section
4. **Re-attempt**: Fix root cause and try migration again

---

**Migration Documentation Version**: 1.0.0
**Last Updated**: 2025-11-25
**Tested On**: PostgreSQL 15.x, Node.js 18.x, Prisma 5.x
