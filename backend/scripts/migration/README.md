# SQLite to PostgreSQL Migration Scripts

Complete toolkit for migrating PFA Vanguard database from SQLite to PostgreSQL with zero data loss.

## Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `analyze-current-data.ts` | Analyze SQLite database before migration | `npx tsx scripts/migration/analyze-current-data.ts` |
| `export-sqlite-data.ts` | Export all SQLite data to JSON files | `npx tsx scripts/migration/export-sqlite-data.ts` |
| `verify-export.ts` | Verify exported data integrity | `npx tsx scripts/migration/verify-export.ts <export-dir>` |
| `import-to-postgresql.ts` | Import exported data into PostgreSQL | `npx tsx scripts/migration/import-to-postgresql.ts <export-dir>` |

## Quick Start

### 1. Pre-Migration Analysis

Understand what will be migrated:

```bash
cd backend
npx tsx scripts/migration/analyze-current-data.ts
```

**Output**: `scripts/migration/pre-migration-analysis.json`

This shows:
- Current table row counts
- Sample data from key tables
- Foreign key relationships
- Migration order (dependency-aware)
- Warnings about large datasets or special fields

### 2. Export SQLite Data

Export all data with checksums for integrity verification:

```bash
npx tsx scripts/migration/export-sqlite-data.ts
```

**Output**: `scripts/migration/export-YYYY-MM-DD/`
- `manifest.json` - Export metadata and checksums
- `users.json` - User data
- `organizations.json` - Organization data
- `api_configurations.json` - API config data
- `pfa_records.json` - PFA data (can be large)
- ... (12 tables total)
- `complete-export.json` - Single file with all data

**Features**:
- ✅ Exports tables in correct order (respects foreign keys)
- ✅ Calculates checksums for each table
- ✅ Handles date serialization (ISO format)
- ✅ Batch processing for large tables (PFA records)
- ✅ Progress reporting
- ✅ Validates data before saving

**Time**: ~5 minutes for typical dataset, ~10 minutes for 100K+ records

### 3. Verify Export

Validate export integrity before importing:

```bash
npx tsx scripts/migration/verify-export.ts scripts/migration/export-YYYY-MM-DD
```

**Checks**:
- ✅ All table files exist
- ✅ Checksums match manifest
- ✅ Row counts match manifest
- ✅ Data structure is valid (has id fields, proper types)
- ✅ Foreign key references exist (no orphaned records)

**Time**: ~1 minute

### 4. Setup PostgreSQL

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md#setup-postgresql-database) for detailed PostgreSQL setup instructions.

**Quick Docker setup**:
```bash
cd backend

# Create docker-compose.yml
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

# Start PostgreSQL
docker-compose up -d
```

### 5. Configure PostgreSQL Connection

Update `.env`:

```bash
# Backup current .env
cp .env .env.sqlite.backup

# Edit .env
nano .env
```

Change:
```env
# Before (SQLite)
DATABASE_URL="file:./prisma/dev.db"

# After (PostgreSQL)
DATABASE_URL="postgresql://pfa_user:secure_password_here@localhost:5432/pfa_vanguard?schema=public"
```

Update `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"  // Changed from "sqlite"
  url      = env("DATABASE_URL")
}
```

### 6. Run Migrations

```bash
# Generate Prisma client for PostgreSQL
npx prisma generate

# Apply schema migrations
npx prisma migrate deploy
```

### 7. Import Data

```bash
npx tsx scripts/migration/import-to-postgresql.ts scripts/migration/export-YYYY-MM-DD
```

**Features**:
- ✅ Imports tables in correct order (respects foreign keys)
- ✅ Transactional imports (all-or-nothing per table)
- ✅ Batch processing (1000 records per transaction)
- ✅ Checksum validation before import
- ✅ Row count verification after import
- ✅ Progress reporting
- ✅ Automatic rollback on error

**Time**: ~5 minutes for typical dataset, ~15 minutes for 100K+ records

### 8. Verify Migration

```bash
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
    apiConfigurations: await prisma.apiConfiguration.count(),
    pfaRecords: await prisma.pfaRecord.count(),
  };

  console.table(counts);
  console.log('\nTotal records:', Object.values(counts).reduce((a, b) => a + b, 0));

  // Test login
  const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
  console.log('\nAdmin user:', admin ? '✅ Found' : '❌ Not found');

  await prisma.$disconnect();
}

verify();
EOF

npx tsx verify-migration.ts
```

## Script Details

### analyze-current-data.ts

**Purpose**: Pre-migration database analysis

**What it does**:
1. Connects to SQLite database
2. Counts rows in each table
3. Shows sample data from key tables
4. Identifies foreign key relationships
5. Determines optimal migration order
6. Warns about potential issues (large datasets, encrypted fields, JSON fields)

**Output**: `pre-migration-analysis.json`

**When to use**: Before starting migration to understand scope

### export-sqlite-data.ts

**Purpose**: Export all SQLite data to JSON

**What it does**:
1. Exports tables in dependency order:
   - users
   - organizations
   - user_organizations
   - ai_providers
   - organization_ai_configs
   - ai_usage_logs
   - api_configurations
   - organization_api_credentials
   - data_source_mappings
   - field_configurations
   - pfa_records (batch processing)
   - sync_logs
2. Serializes dates to ISO format
3. Calculates checksums for integrity verification
4. Saves individual table files + complete export
5. Generates manifest with metadata

**Output**: Directory with 13 JSON files + manifest

**When to use**: After backing up SQLite database, before switching to PostgreSQL

**Performance**:
- Small datasets (<1000 records): <1 minute
- Medium datasets (1K-10K records): 1-3 minutes
- Large datasets (100K+ records): 5-10 minutes

### verify-export.ts

**Purpose**: Validate exported data integrity

**What it does**:
1. Loads manifest
2. For each table:
   - Checks file exists
   - Verifies checksum matches manifest
   - Verifies row count matches manifest
   - Checks data structure is valid
3. Verifies foreign key references:
   - UserOrganizations → Users, Organizations
   - OrganizationAiConfigs → Organizations
   - AiUsageLogs → Users
   - ApiConfigurations → Organizations (nullable)
   - OrganizationApiCredentials → Organizations, ApiConfigurations
   - DataSourceMappings → ApiConfigurations
   - FieldConfigurations → Organizations (nullable)
   - PfaRecords → Organizations

**Output**: Verification report with pass/fail status

**When to use**: After export, before import (catches corruption early)

### import-to-postgresql.ts

**Purpose**: Import exported data into PostgreSQL

**What it does**:
1. Loads manifest and verifies checksums
2. Checks if database is empty (safety check)
3. For each table:
   - Deserializes dates from ISO format
   - Verifies checksum before import
   - Imports in batches (1000 records per transaction)
   - Shows progress
   - Verifies row count after import
4. Reports success/failure for each table

**Output**: Import statistics and success/failure report

**When to use**: After PostgreSQL setup, schema migration, and export verification

**Performance**:
- Small datasets: <1 minute
- Medium datasets: 2-5 minutes
- Large datasets: 10-20 minutes

**Safety features**:
- Transactional imports (rollback on error)
- Checksum validation
- Row count verification
- 10-second warning if database not empty

## Error Handling

All scripts include comprehensive error handling:

### Export Errors

**Problem**: "Cannot read file ./prisma/dev.db"
**Solution**: Ensure SQLite database exists and is not locked
```bash
ls -lh prisma/dev.db
# If locked, stop backend server
pkill -f "npm run dev"
```

**Problem**: "Out of memory"
**Solution**: Increase Node.js memory limit
```bash
NODE_OPTIONS="--max-old-space-size=4096" npx tsx scripts/migration/export-sqlite-data.ts
```

### Verification Errors

**Problem**: "Checksum mismatch"
**Solution**: Re-export data (file may be corrupted)
```bash
rm -rf scripts/migration/export-*
npx tsx scripts/migration/export-sqlite-data.ts
```

**Problem**: "Foreign key violations found"
**Solution**: Check SQLite database integrity
```bash
# Connect to SQLite
sqlite3 prisma/dev.db

# Check foreign keys
PRAGMA foreign_key_check;

# If issues found, fix data before export
```

### Import Errors

**Problem**: "Connection refused"
**Solution**: Verify PostgreSQL is running and connection string is correct
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1;"

# Check .env
cat .env | grep DATABASE_URL
```

**Problem**: "Unique constraint violation"
**Solution**: Database not empty, clear before import
```bash
# Drop and recreate schema
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Re-run migrations
npx prisma migrate deploy

# Re-import
npx tsx scripts/migration/import-to-postgresql.ts scripts/migration/export-YYYY-MM-DD
```

## Rollback Procedure

If migration fails, rollback to SQLite:

```bash
# 1. Stop backend server
pkill -f "npm run dev"

# 2. Restore .env
cp .env.sqlite.backup .env

# 3. Revert schema.prisma
nano prisma/schema.prisma
# Change provider back to "sqlite"

# 4. Restore database backup
cp backups/pre-migration/dev.db.backup-<timestamp> prisma/dev.db

# 5. Regenerate Prisma client
npx prisma generate

# 6. Start server and test
npm run dev
```

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md#rollback-procedure) for detailed rollback steps.

## Best Practices

### Before Migration

1. **Always backup**: Copy `dev.db` and `.env` before starting
2. **Run analysis**: Understand what you're migrating
3. **Test in dev**: Never migrate production first
4. **Schedule downtime**: Plan for 30-60 minute window
5. **Notify team**: Inform stakeholders of maintenance window

### During Migration

1. **Follow order**: Run scripts in sequence (analyze → export → verify → import)
2. **Verify checksums**: Always run verify-export before importing
3. **Monitor progress**: Watch for errors in real-time
4. **Save export**: Keep export directory as backup
5. **Don't interrupt**: Let import complete (transactional, but slower if interrupted)

### After Migration

1. **Verify counts**: Compare row counts with export
2. **Test authentication**: Verify login works
3. **Test API endpoints**: Run smoke tests
4. **Check performance**: Monitor query times
5. **Create indexes**: Add performance indexes if needed
6. **Setup backups**: Configure automated PostgreSQL backups

## Performance Tuning

### For Large Datasets (100K+ PFA Records)

**Increase batch sizes** (if you have enough memory):

Edit `export-sqlite-data.ts`:
```typescript
// Line ~140
const BATCH_SIZE = 10000;  // Increase from 5000
```

Edit `import-to-postgresql.ts`:
```typescript
// Line ~250
const pfaBatchSize = 1000;  // Increase from 500
```

**Increase Node.js memory**:
```bash
NODE_OPTIONS="--max-old-space-size=8192" npx tsx scripts/migration/import-to-postgresql.ts <export-dir>
```

**Disable indexes during import** (faster, but requires rebuild):
```sql
-- Before import
DROP INDEX idx_pfa_org_sync_state;
DROP INDEX idx_pfa_org_modified;

-- After import
CREATE INDEX idx_pfa_org_sync_state ON pfa_records(organizationId, syncState);
CREATE INDEX idx_pfa_org_modified ON pfa_records(organizationId, modifiedAt);
ANALYZE pfa_records;
```

## Migration Checklist

Use this checklist during migration:

- [ ] Backup SQLite database
- [ ] Backup .env file
- [ ] Run analysis script
- [ ] Review analysis output
- [ ] Export SQLite data
- [ ] Verify export integrity
- [ ] Setup PostgreSQL database
- [ ] Update .env DATABASE_URL
- [ ] Update schema.prisma provider
- [ ] Run `npx prisma generate`
- [ ] Run `npx prisma migrate deploy`
- [ ] Import data
- [ ] Verify row counts
- [ ] Test login
- [ ] Test API endpoints
- [ ] Check foreign keys
- [ ] Configure connection pool
- [ ] Setup PostgreSQL backups
- [ ] Update documentation

## Additional Resources

- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - Comprehensive migration guide with PostgreSQL setup
- **[Prisma PostgreSQL Guide](https://www.prisma.io/docs/concepts/database-connectors/postgresql)** - Official Prisma docs
- **[PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)** - Official PostgreSQL docs

## Support

If you encounter issues:

1. Check error messages in script output
2. Review troubleshooting section in [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md#troubleshooting)
3. Check Prisma logs: `DEBUG="prisma:*" npx tsx <script>`
4. Verify PostgreSQL logs: `docker logs pfa_postgres` (if using Docker)
5. Rollback and try again with fixes

---

**Documentation Version**: 1.0.0
**Last Updated**: 2025-11-25
**Tested With**: SQLite 3.x, PostgreSQL 15.x, Prisma 5.x, Node.js 18.x
