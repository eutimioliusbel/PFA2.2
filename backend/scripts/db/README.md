# Database Scripts

**Purpose**: This folder contains database utility scripts for PFA Vanguard, including seeding, migration, and maintenance tasks.

---

## Table of Contents

1. [Available Scripts](#available-scripts)
2. [PostgreSQL Seed Scripts](#postgresql-seed-scripts)
3. [Migration Scripts](#migration-scripts)
4. [Maintenance Scripts](#maintenance-scripts)
5. [Quick Start](#quick-start)

---

## Available Scripts

### Seed Scripts

| Script | Purpose | Database | Run Command |
|--------|---------|----------|-------------|
| `seed-postgres-mirror-delta.ts` | Seeds Mirror + Delta tables with sample data | PostgreSQL only | `npx tsx scripts/db/seed-postgres-mirror-delta.ts` |
| `migrate-to-mirror.ts` | Migrates existing PfaRecord data to Mirror + Delta | PostgreSQL only | `npx tsx scripts/db/migrate-to-mirror.ts` |

### PostgreSQL-Specific Features

The scripts in this folder take advantage of PostgreSQL-specific features:

- **JSONB**: Native JSON storage with indexing and query capabilities
- **Generated Columns**: Virtual columns extracted from JSONB for fast B-tree indexing
- **Materialized Views**: Pre-computed aggregations for instant dashboards
- **Merge Operator (`||`)**: JSONB merge for live data composition

---

## PostgreSQL Seed Scripts

### 1. Mirror + Delta Seed Script

**File**: `seed-postgres-mirror-delta.ts`

**Purpose**: Seeds the PfaMirror and PfaModification tables with sample data for testing the Cached Mirror + Delta architecture.

**Prerequisites**:
- PostgreSQL database running (Docker or cloud)
- Prisma schema updated with Mirror + Delta models
- Migrations applied: `npx prisma migrate deploy`

**Run**:
```bash
cd backend
npx tsx scripts/db/seed-postgres-mirror-delta.ts
```

**What It Does**:
1. Verifies PostgreSQL database is connected
2. Checks for required tables (pfa_mirror, pfa_modification, sync_log)
3. Seeds PfaMirror with 3 sample records (baseline from PEMS)
4. Seeds PfaModification with 2 sample user drafts
5. Creates a sample sync log entry
6. Demonstrates live merge query (Mirror + Modifications)

**Sample Output**:
```
╔═══════════════════════════════════════════════════════════════╗
║  PostgreSQL Mirror + Delta Seed Script                       ║
╚═══════════════════════════════════════════════════════════════╝

✓ PostgreSQL database detected
  Version: PostgreSQL 15.4

📊 Checking required tables...
   ✓ Found 3 Mirror + Delta tables: pfa_mirror, pfa_modification, sync_log

📦 Seeding PfaMirror table (PEMS baseline data)...

   ✅ Created mirror: PFA-RIO-001 (RIO - Earthmoving)
   ✅ Created mirror: PFA-RIO-002 (RIO - Lifting)
   ✅ Created mirror: PFA-PORTARTHUR-001 (PORTARTHUR - Earthmoving)

   Summary: Created 3, Skipped 0

📝 Seeding PfaModification table (user drafts)...

   ✅ Created modification: admin → PFA-RIO-001
      Changes: forecastStart, forecastEnd
   ✅ Created modification: RRECTOR → PFA-RIO-002
      Changes: monthlyRate, forecastEnd

   Summary: Created 2, Skipped 0

📊 Creating sample sync log...

   ✅ Sample sync log created

🔗 Demonstrating live merge (Mirror + User Modifications)...

   Found 2 merged records:

   ✏️  (has draft) PFA-RIO-001: Earthmoving - Excavator
      Modified by: admin at 2025-11-25T17:45:00.000Z
   ✅ (pristine) PFA-RIO-002: Lifting - Crane

╔═══════════════════════════════════════════════════════════════╗
║  Seed Complete                                                ║
╚═══════════════════════════════════════════════════════════════╝

📋 Summary:
───────────────────────────────────────────────────────────────
   Mirror Records:      3 created, 0 existing
   Modifications:       2 created, 0 existing
   Sync Logs:           1 sample
───────────────────────────────────────────────────────────────

✅ Seed completed successfully!
```

**Test Queries** (provided in output):
- View pristine records (no modifications)
- View all user drafts
- Merged view (Mirror + Modifications)

---

## Migration Scripts

### 1. Migrate to Mirror + Delta

**File**: `migrate-to-mirror.ts`

**Purpose**: Migrates existing PfaRecord data from the traditional schema to the new Mirror + Delta architecture.

**Use Case**: When you have existing PFA data in the `pfa_records` table and want to migrate to the new architecture.

**Prerequisites**:
- Existing PfaRecord data in database
- PostgreSQL with Mirror + Delta schema deployed

**Run**:
```bash
cd backend
npx tsx scripts/db/migrate-to-mirror.ts
```

**What It Does**:
1. Queries all existing PfaRecord entries
2. Groups records by organization
3. Inserts each record into `pfa_mirror` as JSONB
4. Sets `last_synced_at` to migration timestamp
5. Creates sync log entry for migration
6. **Optional**: Archives old `pfa_records` table (not deleted)

**Safety Features**:
- Dry run mode (preview before committing)
- Transaction-based (all-or-nothing)
- Preserves original data
- Detailed logging

---

## Maintenance Scripts

### Coming Soon

Additional maintenance scripts will be added:

- `vacuum-mirror-table.ts` - PostgreSQL VACUUM for Mirror table
- `rebuild-indexes.ts` - Rebuild indexes for performance
- `archive-old-modifications.ts` - Clean up old user drafts
- `sync-status-report.ts` - Generate sync health report

---

## Quick Start

### Initial Setup (New Database)

```bash
# 1. Setup PostgreSQL (Docker)
cd backend
docker-compose up -d postgres

# 2. Run migrations
npx prisma migrate deploy

# 3. Seed base data (users, orgs, APIs)
npm run prisma:seed

# 4. Seed Mirror + Delta sample data
npx tsx scripts/db/seed-postgres-mirror-delta.ts

# 5. Verify
npx prisma studio
```

### Migration from Existing Database

```bash
# 1. Backup SQLite
npx tsx scripts/migration/export-sqlite-data.ts

# 2. Setup PostgreSQL
docker-compose up -d postgres

# 3. Run migrations
npx prisma migrate deploy

# 4. Import base data
npx tsx scripts/migration/import-to-postgresql.ts

# 5. Migrate PFA records to Mirror + Delta
npx tsx scripts/db/migrate-to-mirror.ts

# 6. Verify
npx tsx scripts/migration/verify-export.ts
```

---

## PostgreSQL Compatibility Notes

### Existing Seed Scripts (Fully Compatible)

**Good News**: The existing seed scripts in `backend/prisma/seed.ts` and `backend/seed-data-source-mappings.ts` are **fully compatible** with PostgreSQL without any modifications.

**Why?**
- Prisma ORM abstracts database differences
- No SQLite-specific syntax used
- No hardcoded SQL queries (except in raw migrations)
- JSON.stringify() works for both SQLite (TEXT) and PostgreSQL (JSONB)
- Upsert operations are database-agnostic

**Migration Checklist**:
- ✅ Update DATABASE_URL in .env to PostgreSQL connection string
- ✅ Run `npx prisma generate` to regenerate Prisma client
- ✅ Run `npx prisma migrate deploy` to apply PostgreSQL migrations
- ✅ Run `npm run prisma:seed` (same script, no changes needed)
- ✅ Run PostgreSQL-specific seeds if using Mirror + Delta

### PostgreSQL-Specific Enhancements

The scripts in this folder (`scripts/db/`) use PostgreSQL-specific features:

1. **JSONB Merge Operator** (`||`):
   ```sql
   -- Merges user changes into baseline data
   SELECT mir.data || m.changes AS merged_data
   FROM pfa_mirror mir
   LEFT JOIN pfa_modification m ON mir.id = m.record_id
   ```

2. **JSONB Path Queries**:
   ```sql
   -- Query nested fields in JSONB
   SELECT * FROM pfa_mirror
   WHERE data->>'category' = 'Earthmoving'
   ```

3. **Generated Columns** (defined in schema):
   ```sql
   -- Virtual column for fast indexing
   category VARCHAR(100) GENERATED ALWAYS AS (data->>'category') STORED
   ```

4. **Materialized Views**:
   ```sql
   -- Pre-computed KPI aggregations
   CREATE MATERIALIZED VIEW pfa_kpi_summary AS
   SELECT organization_id, SUM((data->>'monthlyRate')::numeric) as total_monthly_cost
   FROM pfa_mirror
   GROUP BY organization_id
   ```

---

## Related Documentation

- [Seed Data Documentation](../SEED_DATA_DOCUMENTATION.md) - Complete seed script reference
- [Migration Guide](../migration/MIGRATION_GUIDE.md) - SQLite → PostgreSQL migration
- [Database Architecture](../../DATABASE_ARCHITECTURE.md) - Schema design and query patterns
- [Implementation Plan](../../../docs/implementation/IMPLEMENTATION-PLAN-MIRROR-DELTA.md) - 6-phase rollout

---

## Change Log

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-11-25 | Initial database scripts documentation | Claude Code |

---

**Questions?** See [DOCUMENTATION_STANDARDS.md](../../../docs/DOCUMENTATION_STANDARDS.md)
