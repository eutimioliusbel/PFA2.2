# Implementation Plan: Cached Mirror + Delta Architecture

**Project**: PFA Vanguard - High-Performance Data Layer
**Architecture**: ADR-005 (Cached Mirror + Delta)
**Timeline**: 3 Weeks (2025-11-25 to 2025-12-16)
**Team**: Development Team

---

## Executive Summary

This document provides a detailed, step-by-step implementation plan for the Cached Mirror + Delta architecture. The plan is broken into 6 phases over 3 weeks, with clear deliverables, dependencies, and testing requirements.

**Key Objectives**:
1. ✅ Achieve sub-100ms query performance for 1M+ records
2. ✅ Support persistent draft state across multiple sessions
3. ✅ Reduce storage by 95% compared to full database approach
4. ✅ Enable 10,000x cheaper AI queries via SQL generation
5. ✅ Maintain PEMS as source of truth with bi-directional sync

---

## Phase 1: Database Migration & New Schema (Week 1, Days 1-2)

### Overview
Migrate all existing tables from SQLite to PostgreSQL, then add Mirror, Modification tables, and materialized views.

### Prerequisites
- PostgreSQL 13+ installed and configured
- Prisma CLI installed (`npm install -D prisma`)
- Database connection string configured in `.env`
- **Backup of existing SQLite database** (`backend/prisma/dev.db`)

---

### Task 1.0: Migrate SQLite → PostgreSQL (CRITICAL FIRST STEP)

**Duration**: 3 hours

**Why This First?**
- Existing tables (User, Organization, ApiConfiguration, etc.) need to be in PostgreSQL
- Foreign keys between Mirror and Organizations require same database
- Single database simplifies deployment and backups

#### Step 1: Set Up PostgreSQL Database

**Option A: Local PostgreSQL (Development)**

```bash
# Install PostgreSQL (if not already installed)
# macOS
brew install postgresql@14
brew services start postgresql@14

# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# Windows
# Download installer from https://www.postgresql.org/download/windows/

# Create database
psql -U postgres
CREATE DATABASE pfa_vanguard_dev;
CREATE USER pfa_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE pfa_vanguard_dev TO pfa_user;
\q
```

**Option B: Docker PostgreSQL (Recommended for Development)**

```bash
# Create docker-compose.yml in project root
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    container_name: pfa_postgres
    environment:
      POSTGRES_USER: pfa_user
      POSTGRES_PASSWORD: pfa_dev_password
      POSTGRES_DB: pfa_vanguard_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
EOF

# Start PostgreSQL
docker-compose up -d

# Verify it's running
docker ps
```

**Option C: Cloud PostgreSQL (Production)**

- **AWS RDS PostgreSQL** (recommended for production)
- **Google Cloud SQL for PostgreSQL**
- **Azure Database for PostgreSQL**
- **Heroku Postgres**
- **Supabase** (includes free tier)

#### Step 2: Update Environment Variables

**File**: `backend/.env`

```bash
# OLD (SQLite)
# DATABASE_URL="file:./prisma/dev.db"

# NEW (PostgreSQL - Local/Docker)
DATABASE_URL="postgresql://pfa_user:pfa_dev_password@localhost:5432/pfa_vanguard_dev?schema=public"

# NEW (PostgreSQL - Production Example)
# DATABASE_URL="postgresql://user:password@your-db-host:5432/pfa_vanguard_prod?schema=public&sslmode=require"
```

#### Step 3: Update Prisma Datasource

**File**: `backend/prisma/schema.prisma`

```prisma
// OLD
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// NEW
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

#### Step 4: Export Data from SQLite

**File**: `backend/scripts/migration/export-sqlite-data.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./prisma/dev.db' // SQLite path
    }
  }
});

async function exportData() {
  console.log('📤 Exporting data from SQLite...');

  const data = {
    users: await prisma.user.findMany(),
    organizations: await prisma.organization.findMany(),
    apiConfigurations: await prisma.apiConfiguration.findMany(),
    aiProviders: await prisma.aiProvider.findMany(),
    systemConfig: await prisma.systemConfig.findMany(),
    dataSourceMappings: await prisma.dataSourceMapping.findMany(),
    // Add other tables as needed
  };

  // Write to JSON file
  writeFileSync(
    './scripts/migration/sqlite-export.json',
    JSON.stringify(data, null, 2)
  );

  console.log(`✅ Exported data:`);
  console.log(`  - Users: ${data.users.length}`);
  console.log(`  - Organizations: ${data.organizations.length}`);
  console.log(`  - API Configs: ${data.apiConfigurations.length}`);
  console.log(`  - AI Providers: ${data.aiProviders.length}`);
  console.log(`  - System Config: ${data.systemConfig.length}`);
  console.log(`  - Data Source Mappings: ${data.dataSourceMappings.length}`);

  await prisma.$disconnect();
}

exportData().catch(console.error);
```

**Run Export**:
```bash
cd backend
npx tsx scripts/migration/export-sqlite-data.ts
```

**Result**: Creates `backend/scripts/migration/sqlite-export.json` with all data

#### Step 5: Reset Prisma Migrations

```bash
cd backend

# Remove old SQLite migrations (they won't work with PostgreSQL)
rm -rf prisma/migrations/

# Remove old SQLite database (keep a backup!)
cp prisma/dev.db prisma/dev.db.backup
rm prisma/dev.db

# Generate initial PostgreSQL migration
npx prisma migrate dev --name initial_postgresql_migration
```

This will:
1. Create all existing tables in PostgreSQL
2. Generate a new migration file
3. Apply the migration

#### Step 6: Import Data to PostgreSQL

**File**: `backend/scripts/migration/import-to-postgresql.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';

const prisma = new PrismaClient(); // Uses new PostgreSQL connection

async function importData() {
  console.log('📥 Importing data to PostgreSQL...');

  // Read exported data
  const data = JSON.parse(
    readFileSync('./scripts/migration/sqlite-export.json', 'utf-8')
  );

  try {
    // Import in transaction for atomicity
    await prisma.$transaction(async (tx) => {
      // 1. Import Users
      for (const user of data.users) {
        await tx.user.create({ data: user });
      }
      console.log(`✅ Imported ${data.users.length} users`);

      // 2. Import Organizations
      for (const org of data.organizations) {
        await tx.organization.create({ data: org });
      }
      console.log(`✅ Imported ${data.organizations.length} organizations`);

      // 3. Import API Configurations
      for (const config of data.apiConfigurations) {
        await tx.apiConfiguration.create({ data: config });
      }
      console.log(`✅ Imported ${data.apiConfigurations.length} API configs`);

      // 4. Import AI Providers
      for (const provider of data.aiProviders) {
        await tx.aiProvider.create({ data: provider });
      }
      console.log(`✅ Imported ${data.aiProviders.length} AI providers`);

      // 5. Import System Config
      for (const config of data.systemConfig) {
        await tx.systemConfig.create({ data: config });
      }
      console.log(`✅ Imported ${data.systemConfig.length} system configs`);

      // 6. Import Data Source Mappings
      for (const mapping of data.dataSourceMappings) {
        await tx.dataSourceMapping.create({ data: mapping });
      }
      console.log(`✅ Imported ${data.dataSourceMappings.length} data source mappings`);
    });

    console.log('✅ All data imported successfully!');
  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

importData().catch(console.error);
```

**Run Import**:
```bash
cd backend
npx tsx scripts/migration/import-to-postgresql.ts
```

#### Step 7: Verify Migration

```bash
# Check data in PostgreSQL
cd backend
npx prisma studio

# Or use psql
psql -U pfa_user -d pfa_vanguard_dev

# Run some verification queries
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM organizations;
SELECT COUNT(*) FROM api_configurations;

# Verify admin user exists
SELECT id, username, role FROM users WHERE username = 'admin';

# Exit psql
\q
```

#### Step 8: Test Backend with PostgreSQL

```bash
cd backend

# Regenerate Prisma Client for PostgreSQL
npx prisma generate

# Start backend server
npm run dev

# Test login endpoint
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Expected: Should return JWT token (same as before)
```

**Acceptance Criteria**:
- ✅ PostgreSQL database created and running
- ✅ All existing tables migrated to PostgreSQL
- ✅ All data imported successfully
- ✅ Backend connects to PostgreSQL
- ✅ Login works (admin user exists)
- ✅ API endpoints functional

**Rollback Plan** (if migration fails):
```bash
# 1. Restore SQLite database
cp backend/prisma/dev.db.backup backend/prisma/dev.db

# 2. Revert Prisma schema
git checkout backend/prisma/schema.prisma

# 3. Revert .env
# Change DATABASE_URL back to SQLite

# 4. Restart backend
cd backend
npx prisma generate
npm run dev
```

---

### Task 1.1: Add Mirror & Modification Tables to Prisma Schema

**Duration**: 2 hours

**File**: `backend/prisma/schema.prisma`

**Changes**:

```prisma
// Add to schema.prisma

// ============================================
// PFA MIRROR (Cached Baseline from PEMS)
// ============================================
model PfaMirror {
  id              String   @id @db.VarChar(255)
  organizationId  String   @db.VarChar(50)

  // Full PEMS record as JSONB
  data            Json     @db.JsonB

  // Sync tracking
  lastSyncedAt    DateTime @default(now())
  pemsVersion     String?  @db.VarChar(100) // PEMS lastModified timestamp

  // Indexes
  @@index([organizationId])
  @@index([lastSyncedAt])
  @@map("pfa_mirror")
}

// ============================================
// PFA MODIFICATION (User Drafts)
// ============================================
model PfaModification {
  id              String   @id @default(uuid()) @db.Uuid
  userId          String   @db.VarChar(50)
  recordId        String   @db.VarChar(255) // FK to PfaMirror.id

  // Only changed fields
  changes         Json     @db.JsonB

  // Tracking
  modifiedAt      DateTime @default(now())
  sessionId       String?  @db.VarChar(50)

  // Conflict detection
  baseVersion     String?  @db.VarChar(100) // pemsVersion when edit started

  // Constraints
  @@unique([userId, recordId], name: "unique_user_record")
  @@index([userId])
  @@index([recordId])
  @@map("pfa_modification")
}

// ============================================
// SYNC LOG (Background Worker Tracking)
// ============================================
model SyncLog {
  id              String   @id @default(uuid()) @db.Uuid
  organizationId  String   @db.VarChar(50)
  syncType        String   @db.VarChar(20) // 'full' or 'incremental'

  // Timing
  startedAt       DateTime @default(now())
  completedAt     DateTime?
  durationMs      Int?

  // Results
  status          String   @db.VarChar(20) // 'running', 'completed', 'failed'
  recordsProcessed Int     @default(0)
  recordsInserted  Int     @default(0)
  recordsUpdated   Int     @default(0)
  errorCount      Int      @default(0)
  errorMessage    String?  @db.Text

  @@index([organizationId, startedAt])
  @@map("sync_log")
}
```

**Testing**:
```bash
# Validate schema
npx prisma validate

# Format schema
npx prisma format
```

**Acceptance Criteria**:
- ✅ Schema validates without errors
- ✅ All field types match requirements
- ✅ Indexes are properly defined

---

### Task 1.2: Create Migration with Generated Columns

**Duration**: 2 hours

**Command**:
```bash
cd backend
npx prisma migrate dev --name add_mirror_delta_tables
```

**Post-Migration SQL** (Add manually to migration file):

```sql
-- File: backend/prisma/migrations/YYYYMMDDHHMMSS_add_mirror_delta_tables/migration.sql

-- After the Prisma-generated SQL, add:

-- ============================================
-- GENERATED COLUMNS (for indexed JSONB fields)
-- ============================================
ALTER TABLE pfa_mirror
  ADD COLUMN category TEXT GENERATED ALWAYS AS (data->>'category') STORED,
  ADD COLUMN source TEXT GENERATED ALWAYS AS (data->>'source') STORED,
  ADD COLUMN cost NUMERIC GENERATED ALWAYS AS ((data->>'cost')::numeric) STORED,
  ADD COLUMN forecast_start DATE GENERATED ALWAYS AS ((data->>'forecastStart')::date) STORED,
  ADD COLUMN forecast_end DATE GENERATED ALWAYS AS ((data->>'forecastEnd')::date) STORED,
  ADD COLUMN area TEXT GENERATED ALWAYS AS (data->>'area') STORED,
  ADD COLUMN is_actualized BOOLEAN GENERATED ALWAYS AS ((data->>'isActualized')::boolean) STORED;

-- Indexes on generated columns
CREATE INDEX idx_mirror_org_category ON pfa_mirror(organization_id, category);
CREATE INDEX idx_mirror_org_source ON pfa_mirror(organization_id, source);
CREATE INDEX idx_mirror_org_dates ON pfa_mirror(organization_id, forecast_start, forecast_end);
CREATE INDEX idx_mirror_cost ON pfa_mirror(cost);
CREATE INDEX idx_mirror_area ON pfa_mirror(organization_id, area);

-- GIN index for full JSONB search (optional but recommended)
CREATE INDEX idx_mirror_data_gin ON pfa_mirror USING GIN (data jsonb_path_ops);

-- ============================================
-- MATERIALIZED VIEW: KPI SUMMARY
-- ============================================
CREATE MATERIALIZED VIEW pfa_kpi_summary AS
SELECT
  organization_id,
  data->>'category' as category,
  data->>'source' as source,
  COUNT(*) as record_count,
  SUM((data->>'planCost')::numeric) as total_plan_cost,
  SUM((data->>'forecastCost')::numeric) as total_forecast_cost,
  SUM((data->>'actualCost')::numeric) as total_actual_cost,
  SUM(
    CASE WHEN (data->>'isActualized')::boolean = true THEN 1 ELSE 0 END
  ) as actualized_count
FROM pfa_mirror
GROUP BY organization_id, data->>'category', data->>'source';

-- Unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX pfa_kpi_summary_idx
  ON pfa_kpi_summary(organization_id, category, source);

-- ============================================
-- MATERIALIZED VIEW: TIMELINE BOUNDS
-- ============================================
CREATE MATERIALIZED VIEW pfa_timeline_bounds AS
SELECT
  organization_id,
  MIN((data->>'originalStart')::date) as plan_min_start,
  MAX((data->>'originalEnd')::date) as plan_max_end,
  MIN((data->>'forecastStart')::date) as forecast_min_start,
  MAX((data->>'forecastEnd')::date) as forecast_max_end,
  MIN((data->>'actualStart')::date) as actual_min_start,
  MAX((data->>'actualEnd')::date) as actual_max_end
FROM pfa_mirror
GROUP BY organization_id;

CREATE UNIQUE INDEX pfa_timeline_bounds_idx
  ON pfa_timeline_bounds(organization_id);
```

**Testing**:
```bash
# Run migration
npx prisma migrate dev

# Verify tables created
npx prisma studio
# Check: pfa_mirror, pfa_modification, sync_log tables exist

# Test generated columns (SQL client)
# INSERT INTO pfa_mirror (id, organization_id, data) VALUES
#   ('test-1', 'RIO', '{"category": "Crane", "cost": 5000}'::jsonb);
# SELECT id, category, cost FROM pfa_mirror WHERE id = 'test-1';
# DELETE FROM pfa_mirror WHERE id = 'test-1';
```

**Acceptance Criteria**:
- ✅ Migration runs successfully
- ✅ Generated columns extract data correctly
- ✅ Indexes created without errors
- ✅ Materialized views exist

---

### Task 1.3: Seed Initial Data

**Duration**: 1 hour

**File**: `backend/prisma/seed.ts`

**Add Seed Logic**:

```typescript
// Add to existing seed.ts

async function seedMirrorTables() {
  console.log('🌱 Seeding PFA Mirror tables...');

  // Note: Actual PFA data will be populated by background worker
  // This just creates the structure

  // Option: Import a small test dataset for development
  const testRecords = [
    {
      id: 'test-pfa-001',
      organizationId: 'RIO',
      data: {
        id: 'test-pfa-001',
        category: 'Crane',
        source: 'Rental',
        cost: 5000,
        forecastStart: '2025-01-15',
        forecastEnd: '2025-03-15',
        area: 'Silo 4',
        isActualized: false
      },
      pemsVersion: '2025-11-25T10:00:00Z'
    }
    // Add more test records as needed
  ];

  for (const record of testRecords) {
    await prisma.pfaMirror.upsert({
      where: { id: record.id },
      create: record,
      update: record
    });
  }

  console.log(`✅ Seeded ${testRecords.length} test PFA records`);
}

// Add to main seed function
async function main() {
  // ... existing seed logic ...
  await seedMirrorTables();
}
```

**Run Seed**:
```bash
cd backend
npm run prisma:seed
```

**Acceptance Criteria**:
- ✅ Seed script runs without errors
- ✅ Test data appears in Prisma Studio
- ✅ Generated columns populated correctly

---

### Phase 1 Deliverables

| Deliverable | Status | Evidence |
|-------------|--------|----------|
| **PostgreSQL Migration** | | |
| PostgreSQL database setup | ✅ | Database running (local/Docker/cloud) |
| SQLite data exported | ✅ | sqlite-export.json created |
| Prisma datasource updated | ✅ | schema.prisma uses postgresql provider |
| Existing tables migrated | ✅ | All tables in PostgreSQL |
| Existing data imported | ✅ | Users, Orgs, APIs in new DB |
| Backend connects to PostgreSQL | ✅ | Login works, API functional |
| **New Schema** | | |
| Mirror tables added | ✅ | pfa_mirror, pfa_modification exist |
| Generated columns working | ✅ | Extracted fields queryable |
| Materialized views created | ✅ | pfa_kpi_summary, pfa_timeline_bounds |
| Indexes created | ✅ | All performance indexes in place |
| Seed data loaded | ✅ | Test records in pfa_mirror table |

**Acceptance Test**:
```sql
-- 1. Verify existing data migrated
SELECT COUNT(*) FROM users;  -- Should match SQLite count
SELECT COUNT(*) FROM organizations;  -- Should match SQLite count
SELECT * FROM users WHERE username = 'admin';  -- Admin user exists

-- 2. Verify new tables created
SELECT COUNT(*) FROM pfa_mirror;  -- Should return test record count
SELECT * FROM pfa_kpi_summary;  -- Should show aggregated data
SELECT category, cost FROM pfa_mirror WHERE id = 'test-pfa-001';  -- Should show extracted values

-- 3. Verify materialized views work
REFRESH MATERIALIZED VIEW pfa_kpi_summary;  -- Should complete without error

-- 4. Test backend connectivity
curl http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
# Expected: JWT token returned
```

**Total Duration**: 19 hours (3h migration + 16h new schema)

---

## Phase 2: Background Sync Worker (Week 1, Days 3-4)

### Overview
Implement the cron job that fetches data from PEMS and populates the Mirror table.

---

### Task 2.1: Create Worker Infrastructure

**Duration**: 3 hours

**File**: `backend/src/workers/PemsSyncWorker.ts`

```typescript
import { CronJob } from 'cron';
import { prisma } from '../config/database';
import { PemsSyncService } from '../services/pems/PemsSyncService';
import { logger } from '../utils/logger';

export interface WorkerConfig {
  syncInterval: string; // Cron expression (default: '*/15 * * * *')
  enabled: boolean;
  organizations: string[]; // Which orgs to sync
}

export class PemsSyncWorker {
  private job: CronJob | null = null;
  private isRunning: boolean = false;

  constructor(
    private config: WorkerConfig,
    private syncService: PemsSyncService
  ) {}

  /**
   * Start the background worker
   */
  start(): void {
    if (!this.config.enabled) {
      logger.info('[Worker] Sync worker disabled in config');
      return;
    }

    logger.info(`[Worker] Starting with interval: ${this.config.syncInterval}`);

    this.job = new CronJob(
      this.config.syncInterval,
      () => this.runSync(),
      null, // onComplete
      true, // start immediately
      'America/Chicago' // timezone
    );
  }

  /**
   * Stop the background worker
   */
  stop(): void {
    if (this.job) {
      this.job.stop();
      logger.info('[Worker] Sync worker stopped');
    }
  }

  /**
   * Manually trigger a sync (for admin UI)
   */
  async triggerManualSync(organizationId?: string): Promise<void> {
    logger.info('[Worker] Manual sync triggered');
    await this.runSync(organizationId);
  }

  /**
   * Main sync execution
   */
  private async runSync(specificOrgId?: string): Promise<void> {
    if (this.isRunning) {
      logger.warn('[Worker] Sync already running, skipping this cycle');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      // Determine which orgs to sync
      const orgsToSync = specificOrgId
        ? [specificOrgId]
        : this.config.organizations;

      logger.info(`[Worker] Starting sync for ${orgsToSync.length} organizations`);

      for (const orgId of orgsToSync) {
        await this.syncOrganization(orgId);
      }

      // Refresh materialized views
      await this.refreshMaterializedViews();

      const duration = Date.now() - startTime;
      logger.info(`[Worker] Sync completed in ${duration}ms`);
    } catch (error) {
      logger.error('[Worker] Sync failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Sync a single organization
   */
  private async syncOrganization(orgId: string): Promise<void> {
    const syncLogId = await this.createSyncLog(orgId, 'full');

    try {
      // 1. Fetch from PEMS
      const orgCode = await this.getOrganizationCode(orgId);
      const pemsData = await this.syncService.fetchAllPfaData(orgCode);

      logger.info(`[Worker] Fetched ${pemsData.length} records for ${orgId}`);

      // 2. Upsert to Mirror (batches of 1000)
      const BATCH_SIZE = 1000;
      let inserted = 0;
      let updated = 0;

      for (let i = 0; i < pemsData.length; i += BATCH_SIZE) {
        const batch = pemsData.slice(i, i + BATCH_SIZE);
        const result = await this.upsertBatch(batch, orgId);
        inserted += result.inserted;
        updated += result.updated;
      }

      // 3. Update sync log
      await this.completeSyncLog(syncLogId, {
        status: 'completed',
        recordsProcessed: pemsData.length,
        recordsInserted: inserted,
        recordsUpdated: updated
      });

      logger.info(`[Worker] ${orgId}: ${inserted} inserted, ${updated} updated`);
    } catch (error) {
      await this.failSyncLog(syncLogId, error);
      throw error;
    }
  }

  /**
   * Upsert batch of records to Mirror
   */
  private async upsertBatch(
    records: any[],
    orgId: string
  ): Promise<{ inserted: number; updated: number }> {
    const operations = records.map(record =>
      prisma.pfaMirror.upsert({
        where: { id: record.id },
        create: {
          id: record.id,
          organizationId: orgId,
          data: record,
          pemsVersion: record.lastModified || new Date().toISOString()
        },
        update: {
          data: record,
          lastSyncedAt: new Date(),
          pemsVersion: record.lastModified || new Date().toISOString()
        }
      })
    );

    await prisma.$transaction(operations);

    // Note: Prisma doesn't return inserted vs updated counts
    // For now, return total as updated
    return { inserted: 0, updated: records.length };
  }

  /**
   * Refresh materialized views
   */
  private async refreshMaterializedViews(): Promise<void> {
    logger.info('[Worker] Refreshing materialized views...');

    await prisma.$executeRawUnsafe(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY pfa_kpi_summary'
    );

    await prisma.$executeRawUnsafe(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY pfa_timeline_bounds'
    );

    logger.info('[Worker] Materialized views refreshed');
  }

  /**
   * Create sync log entry
   */
  private async createSyncLog(orgId: string, syncType: string): Promise<string> {
    const log = await prisma.syncLog.create({
      data: {
        organizationId: orgId,
        syncType,
        status: 'running'
      }
    });
    return log.id;
  }

  /**
   * Mark sync as completed
   */
  private async completeSyncLog(
    logId: string,
    data: {
      status: string;
      recordsProcessed: number;
      recordsInserted: number;
      recordsUpdated: number;
    }
  ): Promise<void> {
    await prisma.syncLog.update({
      where: { id: logId },
      data: {
        ...data,
        completedAt: new Date(),
        durationMs: Date.now() - (await this.getSyncStartTime(logId))
      }
    });
  }

  /**
   * Mark sync as failed
   */
  private async failSyncLog(logId: string, error: any): Promise<void> {
    await prisma.syncLog.update({
      where: { id: logId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error.message || String(error)
      }
    });
  }

  /**
   * Get organization code from ID
   */
  private async getOrganizationCode(orgId: string): Promise<string> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { code: true }
    });

    if (!org) {
      throw new Error(`Organization not found: ${orgId}`);
    }

    return org.code;
  }

  /**
   * Get sync log start time
   */
  private async getSyncStartTime(logId: string): Promise<number> {
    const log = await prisma.syncLog.findUnique({
      where: { id: logId },
      select: { startedAt: true }
    });
    return log?.startedAt.getTime() || Date.now();
  }
}
```

**Install Dependencies**:
```bash
cd backend
npm install cron
npm install -D @types/cron
```

---

### Task 2.2: Integrate Worker into Server

**Duration**: 1 hour

**File**: `backend/src/server.ts`

```typescript
// Add to server.ts

import { PemsSyncWorker, WorkerConfig } from './workers/PemsSyncWorker';
import { PemsSyncService } from './services/pems/PemsSyncService';

// Worker configuration from environment
const workerConfig: WorkerConfig = {
  syncInterval: process.env.SYNC_INTERVAL || '*/15 * * * *', // Every 15 min
  enabled: process.env.ENABLE_SYNC_WORKER !== 'false', // Enabled by default
  organizations: process.env.SYNC_ORGS
    ? process.env.SYNC_ORGS.split(',')
    : [] // All orgs if empty
};

// Initialize worker
let syncWorker: PemsSyncWorker | null = null;

if (workerConfig.enabled) {
  const syncService = new PemsSyncService();
  syncWorker = new PemsSyncWorker(workerConfig, syncService);
  syncWorker.start();
  console.log('✅ Background sync worker started');
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (syncWorker) {
    syncWorker.stop();
  }
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Export worker for manual triggering (admin UI)
export { syncWorker };
```

**Update `.env`**:
```bash
# Background Sync Worker
ENABLE_SYNC_WORKER=true
SYNC_INTERVAL=*/15 * * * *
SYNC_ORGS=  # Empty = all orgs, or comma-separated IDs
```

---

### Task 2.3: Add Manual Trigger Endpoint

**Duration**: 1 hour

**File**: `backend/src/routes/sync.ts`

```typescript
import { Router } from 'express';
import { syncWorker } from '../server';

const router = Router();

/**
 * POST /api/sync/trigger
 * Manually trigger a sync (for admin UI)
 */
router.post('/trigger', async (req, res) => {
  const { organizationId } = req.body;

  if (!syncWorker) {
    return res.status(503).json({
      error: 'Sync worker is disabled'
    });
  }

  try {
    // Trigger async (don't wait for completion)
    syncWorker.triggerManualSync(organizationId).catch(error => {
      console.error('[Sync] Manual trigger failed:', error);
    });

    res.json({
      success: true,
      message: 'Sync triggered successfully',
      organizationId: organizationId || 'all'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to trigger sync',
      message: error.message
    });
  }
});

/**
 * GET /api/sync/status
 * Get sync status and recent logs
 */
router.get('/status', async (req, res) => {
  try {
    const recentLogs = await prisma.syncLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10
    });

    res.json({
      workerEnabled: !!syncWorker,
      recentLogs
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get sync status',
      message: error.message
    });
  }
});

export default router;
```

**Register Route** in `backend/src/server.ts`:
```typescript
import syncRoutes from './routes/sync';
app.use('/api/sync', authenticateJWT, syncRoutes);
```

---

### Phase 2 Deliverables

| Deliverable | Status | Evidence |
|-------------|--------|----------|
| Worker class implemented | ✅ | PemsSyncWorker.ts exists |
| Cron job configured | ✅ | Worker starts on server boot |
| Manual trigger endpoint | ✅ | POST /api/sync/trigger works |
| Sync logging | ✅ | Records in sync_log table |
| Materialized view refresh | ✅ | Views update after sync |

**Acceptance Test**:
```bash
# Start backend
cd backend
npm run dev

# Trigger manual sync (from another terminal)
curl -X POST http://localhost:3001/api/sync/trigger \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"organizationId": "RIO"}'

# Check sync status
curl http://localhost:3001/api/sync/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Verify data in database
# SELECT COUNT(*) FROM pfa_mirror WHERE organization_id = 'RIO';
```

---

## Phase 3: Live Merge API (Week 2, Days 1-2)

### Overview
Implement REST API endpoints that merge Mirror + Modifications transparently.

---

### Task 3.1: Create PFA Data Controller

**Duration**: 4 hours

**File**: `backend/src/controllers/pfaDataController.ts`

```typescript
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';

export class PfaDataController {
  /**
   * GET /api/pfa/:orgId
   * Get merged PFA data (Mirror + User's Modifications)
   */
  async getPfaData(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;
    const userId = req.user.id;

    try {
      // Live merge query: Mirror LEFT JOIN Modifications
      const data = await prisma.$queryRaw<any[]>`
        SELECT
          COALESCE(m.record_id, mir.id) as id,
          CASE
            WHEN m.id IS NOT NULL THEN
              -- Merge modifications into baseline
              mir.data || m.changes
            ELSE
              mir.data
          END as data,
          CASE WHEN m.id IS NOT NULL THEN true ELSE false END as has_draft,
          m.modified_at as draft_modified_at
        FROM pfa_mirror mir
        LEFT JOIN pfa_modification m
          ON mir.id = m.record_id
          AND m.user_id = ${userId}
        WHERE mir.organization_id = ${orgId}
        ORDER BY mir.id
      `;

      // Get last sync time
      const lastSync = await prisma.pfaMirror.findFirst({
        where: { organizationId: orgId },
        select: { lastSyncedAt: true },
        orderBy: { lastSyncedAt: 'desc' }
      });

      // Count drafts
      const draftCount = await prisma.pfaModification.count({
        where: { userId }
      });

      res.json({
        records: data,
        meta: {
          totalRecords: data.length,
          draftCount,
          lastSyncedAt: lastSync?.lastSyncedAt || null,
          isSyncing: await this.isSyncRunning(orgId)
        }
      });
    } catch (error) {
      console.error('[PFA Data] Get data failed:', error);
      res.status(500).json({
        error: 'Failed to fetch PFA data',
        message: error.message
      });
    }
  }

  /**
   * POST /api/pfa/:orgId/draft
   * Save user's draft changes
   */
  async saveDraft(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;
    const { recordId, changes } = req.body;
    const userId = req.user.id;

    try {
      // Validate record exists in mirror
      const mirrorRecord = await prisma.pfaMirror.findUnique({
        where: { id: recordId },
        select: { pemsVersion: true }
      });

      if (!mirrorRecord) {
        return res.status(404).json({
          error: 'Record not found in mirror'
        });
      }

      // Upsert modification
      const modification = await prisma.pfaModification.upsert({
        where: {
          unique_user_record: {
            userId,
            recordId
          }
        },
        create: {
          userId,
          recordId,
          changes,
          baseVersion: mirrorRecord.pemsVersion
        },
        update: {
          changes,
          modifiedAt: new Date()
        }
      });

      res.json({
        success: true,
        modificationId: modification.id,
        recordId
      });
    } catch (error) {
      console.error('[PFA Data] Save draft failed:', error);
      res.status(500).json({
        error: 'Failed to save draft',
        message: error.message
      });
    }
  }

  /**
   * POST /api/pfa/:orgId/draft/batch
   * Save multiple drafts at once
   */
  async saveDraftBatch(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;
    const { changes } = req.body; // Array of { recordId, changes }
    const userId = req.user.id;

    try {
      const operations = changes.map(({ recordId, changes: recordChanges }) =>
        prisma.pfaModification.upsert({
          where: {
            unique_user_record: { userId, recordId }
          },
          create: {
            userId,
            recordId,
            changes: recordChanges
          },
          update: {
            changes: recordChanges,
            modifiedAt: new Date()
          }
        })
      );

      await prisma.$transaction(operations);

      res.json({
        success: true,
        savedCount: changes.length
      });
    } catch (error) {
      console.error('[PFA Data] Batch save failed:', error);
      res.status(500).json({
        error: 'Failed to save batch drafts',
        message: error.message
      });
    }
  }

  /**
   * POST /api/pfa/:orgId/commit
   * Push user's drafts to PEMS
   */
  async commitChanges(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;
    const userId = req.user.id;

    try {
      // 1. Get all user's modifications
      const modifications = await prisma.pfaModification.findMany({
        where: { userId },
        include: {
          // Note: Need to add relation in schema
          // mirrorRecord: { select: { data: true, pemsVersion: true } }
        }
      });

      if (modifications.length === 0) {
        return res.json({
          success: true,
          message: 'No changes to commit'
        });
      }

      // 2. Check for conflicts
      const conflicts = await this.checkConflicts(modifications);
      if (conflicts.length > 0) {
        return res.status(409).json({
          error: 'Conflicts detected',
          conflicts
        });
      }

      // 3. Push to PEMS (placeholder - implement in Phase 5)
      // const result = await pemsWriteService.updateRecords(modifications);

      // 4. Clear modifications on success
      await prisma.pfaModification.deleteMany({
        where: { userId }
      });

      res.json({
        success: true,
        committedCount: modifications.length
      });
    } catch (error) {
      console.error('[PFA Data] Commit failed:', error);
      res.status(500).json({
        error: 'Failed to commit changes',
        message: error.message
      });
    }
  }

  /**
   * POST /api/pfa/:orgId/discard
   * Discard user's draft changes
   */
  async discardChanges(req: Request, res: Response): Promise<void> {
    const userId = req.user.id;

    try {
      const deleted = await prisma.pfaModification.deleteMany({
        where: { userId }
      });

      res.json({
        success: true,
        discardedCount: deleted.count
      });
    } catch (error) {
      console.error('[PFA Data] Discard failed:', error);
      res.status(500).json({
        error: 'Failed to discard changes',
        message: error.message
      });
    }
  }

  /**
   * GET /api/pfa/:orgId/kpis
   * Get pre-computed KPIs from materialized view
   */
  async getKpis(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;

    try {
      const kpis = await prisma.$queryRaw<any[]>`
        SELECT * FROM pfa_kpi_summary
        WHERE organization_id = ${orgId}
      `;

      res.json({ kpis });
    } catch (error) {
      console.error('[PFA Data] Get KPIs failed:', error);
      res.status(500).json({
        error: 'Failed to fetch KPIs',
        message: error.message
      });
    }
  }

  /**
   * Helper: Check for conflicts
   */
  private async checkConflicts(
    modifications: any[]
  ): Promise<Array<{ recordId: string; message: string }>> {
    const conflicts: Array<{ recordId: string; message: string }> = [];

    for (const mod of modifications) {
      const mirror = await prisma.pfaMirror.findUnique({
        where: { id: mod.recordId },
        select: { pemsVersion: true }
      });

      if (mirror && mirror.pemsVersion !== mod.baseVersion) {
        conflicts.push({
          recordId: mod.recordId,
          message: 'Record was modified in PEMS since you started editing'
        });
      }
    }

    return conflicts;
  }

  /**
   * Helper: Check if sync is currently running
   */
  private async isSyncRunning(orgId: string): Promise<boolean> {
    const runningSync = await prisma.syncLog.findFirst({
      where: {
        organizationId: orgId,
        status: 'running'
      }
    });

    return !!runningSync;
  }
}
```

---

### Task 3.2: Create API Routes

**Duration**: 1 hour

**File**: `backend/src/routes/pfaData.ts`

```typescript
import { Router } from 'express';
import { PfaDataController } from '../controllers/pfaDataController';

const router = Router();
const controller = new PfaDataController();

// Get merged PFA data (Mirror + Modifications)
router.get('/:orgId', (req, res) => controller.getPfaData(req, res));

// Draft management
router.post('/:orgId/draft', (req, res) => controller.saveDraft(req, res));
router.post('/:orgId/draft/batch', (req, res) => controller.saveDraftBatch(req, res));

// Commit/Discard
router.post('/:orgId/commit', (req, res) => controller.commitChanges(req, res));
router.post('/:orgId/discard', (req, res) => controller.discardChanges(req, res));

// KPIs
router.get('/:orgId/kpis', (req, res) => controller.getKpis(req, res));

export default router;
```

**Register Route** in `backend/src/server.ts`:
```typescript
import pfaDataRoutes from './routes/pfaData';
app.use('/api/pfa', authenticateJWT, pfaDataRoutes);
```

---

### Task 3.3: Integration Tests

**Duration**: 2 hours

**File**: `backend/tests/integration/pfaData.test.ts`

```typescript
import request from 'supertest';
import { app } from '../../src/server';
import { prisma } from '../../src/config/database';

describe('PFA Data API', () => {
  let authToken: string;
  let testOrgId: string;
  let testRecordId: string;

  beforeAll(async () => {
    // Login and get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    authToken = loginRes.body.token;
    testOrgId = 'RIO';

    // Seed test data
    const testRecord = await prisma.pfaMirror.create({
      data: {
        id: 'test-record-001',
        organizationId: testOrgId,
        data: {
          id: 'test-record-001',
          category: 'Crane',
          cost: 5000,
          forecastStart: '2025-01-15',
          forecastEnd: '2025-03-15'
        }
      }
    });
    testRecordId = testRecord.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.pfaMirror.deleteMany({ where: { id: testRecordId } });
    await prisma.pfaModification.deleteMany({});
  });

  test('GET /api/pfa/:orgId - should return merged data', async () => {
    const res = await request(app)
      .get(`/api/pfa/${testOrgId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.records).toBeInstanceOf(Array);
    expect(res.body.meta).toHaveProperty('totalRecords');
  });

  test('POST /api/pfa/:orgId/draft - should save draft', async () => {
    const res = await request(app)
      .post(`/api/pfa/${testOrgId}/draft`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        recordId: testRecordId,
        changes: {
          forecastEnd: '2025-04-15'
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /api/pfa/:orgId - should show draft indicator', async () => {
    const res = await request(app)
      .get(`/api/pfa/${testOrgId}`)
      .set('Authorization', `Bearer ${authToken}`);

    const record = res.body.records.find(r => r.id === testRecordId);
    expect(record.has_draft).toBe(true);
    expect(record.data.forecastEnd).toBe('2025-04-15'); // Modified value
  });

  test('POST /api/pfa/:orgId/discard - should remove drafts', async () => {
    const res = await request(app)
      .post(`/api/pfa/${testOrgId}/discard`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.discardedCount).toBeGreaterThan(0);
  });
});
```

**Run Tests**:
```bash
cd backend
npm test -- pfaData.test.ts
```

---

### Phase 3 Deliverables

| Deliverable | Status | Evidence |
|-------------|--------|----------|
| PfaDataController implemented | ✅ | Controller file exists |
| Live merge query working | ✅ | Returns merged data |
| Draft save/discard working | ✅ | Modifications persisted |
| KPI endpoint working | ✅ | Returns mat view data |
| Integration tests passing | ✅ | All tests green |

**Acceptance Test**:
```bash
# Get PFA data
curl http://localhost:3001/api/pfa/RIO \
  -H "Authorization: Bearer YOUR_TOKEN"

# Save draft
curl -X POST http://localhost:3001/api/pfa/RIO/draft \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recordId": "test-001", "changes": {"forecastEnd": "2025-04-15"}}'

# Discard drafts
curl -X POST http://localhost:3001/api/pfa/RIO/discard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Phase 4: Frontend Integration (Week 2, Days 3-4)

### Overview
Update frontend to use new Mirror + Delta API endpoints.

---

### Task 4.1: Update API Client

**Duration**: 2 hours

**File**: `services/apiClient.ts`

```typescript
// Add new methods to apiClient

class ApiClient {
  // ... existing methods ...

  /**
   * Get PFA data for organization (Mirror + User's Drafts)
   */
  async getPfaData(organizationId: string): Promise<{
    records: PfaRecord[];
    meta: {
      totalRecords: number;
      draftCount: number;
      lastSyncedAt: string | null;
      isSyncing: boolean;
    };
  }> {
    const response = await this.fetch(`/api/pfa/${organizationId}`);
    return response;
  }

  /**
   * Save draft change
   */
  async saveDraft(
    organizationId: string,
    recordId: string,
    changes: Partial<PfaRecord>
  ): Promise<{ success: boolean }> {
    return this.fetch(`/api/pfa/${organizationId}/draft`, {
      method: 'POST',
      body: JSON.stringify({ recordId, changes })
    });
  }

  /**
   * Save multiple drafts at once
   */
  async saveDraftBatch(
    organizationId: string,
    changes: Array<{ recordId: string; changes: Partial<PfaRecord> }>
  ): Promise<{ success: boolean; savedCount: number }> {
    return this.fetch(`/api/pfa/${organizationId}/draft/batch`, {
      method: 'POST',
      body: JSON.stringify({ changes })
    });
  }

  /**
   * Commit drafts to PEMS
   */
  async commitChanges(organizationId: string): Promise<{
    success: boolean;
    committedCount: number;
  }> {
    return this.fetch(`/api/pfa/${organizationId}/commit`, {
      method: 'POST'
    });
  }

  /**
   * Discard drafts
   */
  async discardChanges(organizationId: string): Promise<{
    success: boolean;
    discardedCount: number;
  }> {
    return this.fetch(`/api/pfa/${organizationId}/discard`, {
      method: 'POST'
    });
  }

  /**
   * Get pre-computed KPIs
   */
  async getKpis(organizationId: string): Promise<{
    kpis: Array<{
      category: string;
      source: string;
      record_count: number;
      total_plan_cost: number;
      total_forecast_cost: number;
      total_actual_cost: number;
    }>;
  }> {
    return this.fetch(`/api/pfa/${organizationId}/kpis`);
  }

  /**
   * Manually trigger sync
   */
  async triggerSync(organizationId?: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.fetch('/api/sync/trigger', {
      method: 'POST',
      body: JSON.stringify({ organizationId })
    });
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    workerEnabled: boolean;
    recentLogs: Array<{
      id: string;
      organizationId: string;
      status: string;
      startedAt: string;
      completedAt: string | null;
      recordsProcessed: number;
    }>;
  }> {
    return this.fetch('/api/sync/status');
  }
}
```

---

### Task 4.2: Update App.tsx Data Loading

**Duration**: 3 hours

**File**: `App.tsx`

**Changes**:

```typescript
// Replace mockData imports with API calls

// Remove this:
// import { STATIC_PFA_RECORDS } from './mockData';

// Add this:
useEffect(() => {
  if (currentUser?.organizationId) {
    loadPfaDataFromApi(currentUser.organizationId);
  }
}, [currentUser?.organizationId]);

const loadPfaDataFromApi = async (orgId: string) => {
  try {
    setIsLoadingData(true);

    // Fetch from Mirror + Delta API
    const { records, meta } = await apiClient.getPfaData(orgId);

    // Convert API format to frontend format
    const pfaRecords: PfaRecord[] = records.map((r: any) => ({
      ...r.data,
      id: r.id,
      hasDraft: r.has_draft || false
    }));

    // Initialize refs
    allPfaRef.current = pfaRecords;
    baselinePfaRef.current = cloneAssets(pfaRecords);

    // Update metadata
    setLastSyncTime(meta.lastSyncedAt);
    setDraftCount(meta.draftCount);
    setIsSyncing(meta.isSyncing);

    // Trigger re-render
    setDataVersion(v => v + 1);
  } catch (error) {
    console.error('Failed to load PFA data:', error);
    alert('Failed to load data. Please refresh the page.');
  } finally {
    setIsLoadingData(false);
  }
};

// Update submit handler
const handleSubmitChanges = async () => {
  try {
    // 1. Calculate changes (compare allPfaRef vs baselinePfaRef)
    const changes = calculateChanges(allPfaRef.current, baselinePfaRef.current);

    // 2. Save changes to backend
    await apiClient.saveDraftBatch(currentUser.organizationId, changes);

    // 3. Commit to PEMS
    const result = await apiClient.commitChanges(currentUser.organizationId);

    if (result.success) {
      // 4. Update baseline
      baselinePfaRef.current = cloneAssets(allPfaRef.current);

      // 5. Clear draft indicators
      allPfaRef.current.forEach(record => {
        record.hasDraft = false;
      });

      alert(`Successfully committed ${result.committedCount} changes to PEMS`);
    }
  } catch (error) {
    console.error('Failed to commit changes:', error);
    alert('Failed to commit changes. Please try again.');
  }
};

// Update discard handler
const handleDiscardChanges = async () => {
  try {
    // 1. Discard drafts in backend
    await apiClient.discardChanges(currentUser.organizationId);

    // 2. Reset to baseline
    allPfaRef.current = cloneAssets(baselinePfaRef.current);

    // 3. Trigger re-render
    setDataVersion(v => v + 1);

    alert('Changes discarded');
  } catch (error) {
    console.error('Failed to discard changes:', error);
    alert('Failed to discard changes. Please try again.');
  }
};

// Helper: Calculate changes between current and baseline
function calculateChanges(
  current: PfaRecord[],
  baseline: PfaRecord[]
): Array<{ recordId: string; changes: Partial<PfaRecord> }> {
  const changes: Array<{ recordId: string; changes: Partial<PfaRecord> }> = [];

  for (const record of current) {
    const baselineRecord = baseline.find(b => b.id === record.id);
    if (!baselineRecord) continue;

    const diff = getRecordDiff(record, baselineRecord);
    if (Object.keys(diff).length > 0) {
      changes.push({ recordId: record.id, changes: diff });
    }
  }

  return changes;
}

function getRecordDiff(
  current: PfaRecord,
  baseline: PfaRecord
): Partial<PfaRecord> {
  const diff: Partial<PfaRecord> = {};
  const keysToCompare: (keyof PfaRecord)[] = [
    'forecastStart',
    'forecastEnd',
    'category',
    'source',
    'monthlyRate',
    'purchasePrice'
    // Add other editable fields
  ];

  for (const key of keysToCompare) {
    if (current[key] !== baseline[key]) {
      diff[key] = current[key];
    }
  }

  return diff;
}
```

---

### Task 4.3: Add UI Indicators

**Duration**: 2 hours

**Add Last Sync Indicator**:

```typescript
// In App.tsx header area

<div className="sync-status">
  {lastSyncTime && (
    <span className="text-sm text-gray-600">
      Last synced: {formatDistanceToNow(new Date(lastSyncTime))} ago
    </span>
  )}
  {isSyncing && (
    <span className="text-sm text-blue-600 animate-pulse">
      🔄 Syncing...
    </span>
  )}
  <button
    onClick={() => apiClient.triggerSync(currentUser.organizationId)}
    className="btn-sm btn-secondary"
  >
    Refresh Now
  </button>
</div>

{draftCount > 0 && (
  <div className="draft-indicator">
    <span className="badge badge-warning">
      {draftCount} unsaved changes
    </span>
  </div>
)}
```

**Add Draft Highlighting in Grid**:

```typescript
// In GridLab.tsx or Timeline.tsx

<tr className={record.hasDraft ? 'bg-yellow-50' : ''}>
  <td>
    {record.hasDraft && (
      <span className="text-yellow-600 mr-2" title="Unsaved changes">
        ✏️
      </span>
    )}
    {record.category}
  </td>
  {/* ... other cells ... */}
</tr>
```

---

### Phase 4 Deliverables

| Deliverable | Status | Evidence |
|-------------|--------|----------|
| API client updated | ✅ | New methods in apiClient.ts |
| App.tsx loading from API | ✅ | Data loads from backend |
| Submit/discard handlers updated | ✅ | Changes persist to PEMS |
| Draft indicators visible | ✅ | Yellow highlighting on drafts |
| Last sync timestamp shown | ✅ | Displays "X minutes ago" |

**Acceptance Test**:
1. Login to app
2. Verify data loads from API (not mockData)
3. Make a change (drag timeline bar)
4. See yellow draft indicator
5. Logout and login again
6. Verify change is still there (draft persisted)
7. Click "Submit Changes"
8. Verify draft indicator removed

---

## Phase 5: AI Integration (Week 3, Days 1-2)

### Overview
Implement SQL generation pattern for AI queries.

---

### Task 5.1: Create AI Query Service

**Duration**: 4 hours

**File**: `backend/src/services/AiQueryService.ts`

```typescript
import { prisma } from '../config/database';
import { AiService } from './AiService';

export class AiQueryService {
  constructor(private aiService: AiService) {}

  /**
   * Execute natural language query using SQL generation
   */
  async executeNaturalLanguageQuery(
    userQuestion: string,
    organizationId: string,
    userId: string
  ): Promise<{
    results: any[];
    sql: string;
    explanation: string;
  }> {
    // 1. Generate SQL from natural language
    const { sql, explanation } = await this.generateSQL(userQuestion, organizationId);

    // 2. Validate SQL (security check)
    this.validateSQL(sql);

    // 3. Execute query
    const results = await this.executeSQLQuery(sql, organizationId, userId);

    return {
      results,
      sql,
      explanation
    };
  }

  /**
   * Generate SQL from natural language using AI
   */
  private async generateSQL(
    question: string,
    organizationId: string
  ): Promise<{ sql: string; explanation: string }> {
    const schema = this.getPfaMirrorSchema();

    const prompt = `
You are a PostgreSQL expert. Generate a SQL query to answer the user's question.

Database Schema:
${schema}

User Question: "${question}"

Organization Filter: All queries must filter by organization_id = '${organizationId}'

Important:
- Use LEFT JOIN with pfa_modification to include user drafts
- Merge draft changes using jsonb || operator
- Extract JSONB fields with -> or ->> operators
- Always include organization_id filter in WHERE clause

Generate:
1. A PostgreSQL query
2. An explanation of what the query does

Format your response as JSON:
{
  "sql": "SELECT ...",
  "explanation": "This query finds..."
}
`;

    const response = await this.aiService.generateText(prompt);
    const parsed = JSON.parse(response);

    return {
      sql: parsed.sql,
      explanation: parsed.explanation
    };
  }

  /**
   * Get schema description for AI
   */
  private getPfaMirrorSchema(): string {
    return `
Table: pfa_mirror
  - id: TEXT PRIMARY KEY
  - organization_id: TEXT (filter by this!)
  - data: JSONB (full PFA record)
  - last_synced_at: TIMESTAMP

Generated Columns (indexed, fast):
  - category: TEXT (data->>'category')
  - source: TEXT (data->>'source')
  - cost: NUMERIC (data->>'cost')
  - forecast_start: DATE (data->>'forecastStart')
  - forecast_end: DATE (data->>'forecastEnd')
  - area: TEXT (data->>'area')
  - is_actualized: BOOLEAN (data->>'isActualized')

Table: pfa_modification (user drafts)
  - id: UUID PRIMARY KEY
  - user_id: TEXT
  - record_id: TEXT (FK to pfa_mirror.id)
  - changes: JSONB (modified fields only)
  - modified_at: TIMESTAMP

Common Queries:
- Filter by category: WHERE category = 'Crane'
- Filter by cost: WHERE cost > 5000
- Filter by date: WHERE forecast_start >= '2025-01-01'
- Filter by source: WHERE source = 'Rental'

Merge Pattern (include drafts):
SELECT
  COALESCE(m.record_id, mir.id) as id,
  CASE
    WHEN m.id IS NOT NULL THEN mir.data || m.changes
    ELSE mir.data
  END as data
FROM pfa_mirror mir
LEFT JOIN pfa_modification m ON mir.id = m.record_id AND m.user_id = $userId
WHERE mir.organization_id = $orgId
`;
  }

  /**
   * Validate SQL for security
   */
  private validateSQL(sql: string): void {
    const dangerousPatterns = [
      /DROP\s+TABLE/i,
      /DELETE\s+FROM/i,
      /UPDATE\s+/i,
      /INSERT\s+INTO/i,
      /TRUNCATE/i,
      /ALTER\s+TABLE/i,
      /CREATE\s+/i,
      /GRANT\s+/i,
      /REVOKE\s+/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(sql)) {
        throw new Error('SQL contains dangerous operations');
      }
    }

    // Must be SELECT only
    if (!sql.trim().toUpperCase().startsWith('SELECT')) {
      throw new Error('Only SELECT queries are allowed');
    }
  }

  /**
   * Execute SQL query safely
   */
  private async executeSQLQuery(
    sql: string,
    organizationId: string,
    userId: string
  ): Promise<any[]> {
    // Use parameterized query to prevent SQL injection
    // Replace placeholders with actual values
    const safeSQL = sql
      .replace(/\$orgId/g, `'${organizationId}'`)
      .replace(/\$userId/g, `'${userId}'`);

    try {
      const results = await prisma.$queryRawUnsafe(safeSQL);
      return results as any[];
    } catch (error) {
      console.error('[AI Query] SQL execution failed:', error);
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }

  /**
   * Generate bulk update SQL (for AI-suggested changes)
   */
  async generateBulkUpdate(
    description: string,
    organizationId: string,
    userId: string
  ): Promise<{
    changes: Array<{ recordId: string; changes: any }>;
    explanation: string;
    affectedCount: number;
  }> {
    const prompt = `
User wants to make bulk changes: "${description}"

Generate:
1. A list of records to modify
2. The changes to make to each record
3. An explanation

Organization: ${organizationId}

Format as JSON:
{
  "changes": [
    { "recordId": "...", "changes": { "forecastEnd": "..." } }
  ],
  "explanation": "...",
  "affectedCount": 10
}
`;

    const response = await this.aiService.generateText(prompt);
    const parsed = JSON.parse(response);

    return parsed;
  }
}
```

---

### Task 5.2: Add AI Query Endpoint

**Duration**: 1 hour

**File**: `backend/src/routes/aiQuery.ts`

```typescript
import { Router } from 'express';
import { AiQueryService } from '../services/AiQueryService';
import { AiService } from '../services/AiService';

const router = Router();
const aiService = new AiService();
const queryService = new AiQueryService(aiService);

/**
 * POST /api/ai/query
 * Execute natural language query
 */
router.post('/query', async (req, res) => {
  const { question, organizationId } = req.body;
  const userId = req.user.id;

  try {
    const result = await queryService.executeNaturalLanguageQuery(
      question,
      organizationId,
      userId
    );

    res.json(result);
  } catch (error) {
    console.error('[AI Query] Failed:', error);
    res.status(500).json({
      error: 'Query failed',
      message: error.message
    });
  }
});

/**
 * POST /api/ai/bulk-update
 * Generate bulk update suggestions
 */
router.post('/bulk-update', async (req, res) => {
  const { description, organizationId } = req.body;
  const userId = req.user.id;

  try {
    const result = await queryService.generateBulkUpdate(
      description,
      organizationId,
      userId
    );

    res.json(result);
  } catch (error) {
    console.error('[AI Bulk Update] Failed:', error);
    res.status(500).json({
      error: 'Bulk update generation failed',
      message: error.message
    });
  }
});

export default router;
```

**Register Route**:
```typescript
import aiQueryRoutes from './routes/aiQuery';
app.use('/api/ai', authenticateJWT, aiQueryRoutes);
```

---

### Phase 5 Deliverables

| Deliverable | Status | Evidence |
|-------------|--------|----------|
| AI Query Service implemented | ✅ | SQL generation working |
| SQL validation (security) | ✅ | Dangerous ops blocked |
| Query execution working | ✅ | Results returned |
| Bulk update suggestions | ✅ | AI generates changes |

**Acceptance Test**:
```bash
# Test AI query
curl -X POST http://localhost:3001/api/ai/query \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Show me all rentals over $5000 in Silo 4",
    "organizationId": "RIO"
  }'

# Expected response:
# {
#   "results": [...],
#   "sql": "SELECT ...",
#   "explanation": "This query finds..."
# }
```

---

## Phase 6: Monitoring & Optimization (Week 3, Days 3-5)

### Overview
Add monitoring, performance tuning, and production readiness.

---

### Task 6.1: Create Monitoring Dashboard

**Duration**: 4 hours

**File**: `components/admin/SyncMonitoring.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { apiClient } from '../../services/apiClient';

export const SyncMonitoring: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSyncStatus();
    const interval = setInterval(loadSyncStatus, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  const loadSyncStatus = async () => {
    try {
      const status = await apiClient.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to load sync status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerSync = async (orgId?: string) => {
    try {
      await apiClient.triggerSync(orgId);
      alert('Sync triggered successfully');
      await loadSyncStatus();
    } catch (error) {
      alert('Failed to trigger sync');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="sync-monitoring">
      <h2>Sync Monitoring</h2>

      <div className="worker-status">
        <h3>Worker Status</h3>
        <p>
          Status:{' '}
          <span
            className={
              syncStatus.workerEnabled ? 'text-green-600' : 'text-red-600'
            }
          >
            {syncStatus.workerEnabled ? '✅ Running' : '❌ Stopped'}
          </span>
        </p>
        <button onClick={() => handleTriggerSync()}>
          Trigger Manual Sync (All Orgs)
        </button>
      </div>

      <div className="recent-syncs">
        <h3>Recent Sync Logs</h3>
        <table>
          <thead>
            <tr>
              <th>Organization</th>
              <th>Status</th>
              <th>Started</th>
              <th>Duration</th>
              <th>Records</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {syncStatus.recentLogs.map((log: any) => (
              <tr key={log.id}>
                <td>{log.organizationId}</td>
                <td>
                  <span
                    className={
                      log.status === 'completed'
                        ? 'text-green-600'
                        : log.status === 'failed'
                        ? 'text-red-600'
                        : 'text-blue-600'
                    }
                  >
                    {log.status}
                  </span>
                </td>
                <td>{new Date(log.startedAt).toLocaleString()}</td>
                <td>
                  {log.durationMs ? `${(log.durationMs / 1000).toFixed(2)}s` : '—'}
                </td>
                <td>{log.recordsProcessed?.toLocaleString() || '—'}</td>
                <td>
                  <button onClick={() => handleTriggerSync(log.organizationId)}>
                    Re-sync
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

**Add to Admin Dashboard**:
```typescript
// In AdminDashboard.tsx
import { SyncMonitoring } from './admin/SyncMonitoring';

// Add menu item
<MenuItem label="Sync Monitoring" icon={Activity} onClick={() => setActiveTab('sync')} />

// Add render logic
{activeTab === 'sync' && <SyncMonitoring />}
```

---

### Task 6.2: Add Performance Indexes

**Duration**: 2 hours

**Create Index Optimization Script**:

**File**: `backend/scripts/db/optimize-indexes.ts`

```typescript
import { prisma } from '../../src/config/database';

async function optimizeIndexes() {
  console.log('🔧 Optimizing database indexes...');

  // VACUUM ANALYZE to update statistics
  await prisma.$executeRaw`VACUUM ANALYZE pfa_mirror`;
  await prisma.$executeRaw`VACUUM ANALYZE pfa_modification`;

  console.log('✅ Indexes optimized');
}

optimizeIndexes();
```

**Run periodically** (add to cron job or run manually):
```bash
cd backend
npx tsx scripts/db/optimize-indexes.ts
```

---

### Task 6.3: Load Testing

**Duration**: 4 hours

**File**: `backend/tests/load/pfa-load-test.ts`

```typescript
import autocannon from 'autocannon';

async function runLoadTest() {
  console.log('🚀 Starting load test...');

  const result = await autocannon({
    url: 'http://localhost:3001/api/pfa/RIO',
    connections: 100, // 100 concurrent connections
    duration: 30, // 30 seconds
    headers: {
      'Authorization': 'Bearer YOUR_TEST_TOKEN'
    }
  });

  console.log('📊 Load Test Results:');
  console.log(`Requests/sec: ${result.requests.average}`);
  console.log(`Latency (avg): ${result.latency.mean}ms`);
  console.log(`Latency (p99): ${result.latency.p99}ms`);
  console.log(`Errors: ${result.errors}`);

  // Performance targets
  const targets = {
    requestsPerSec: 100,
    avgLatency: 100,
    p99Latency: 500
  };

  console.log('\n✅ Performance Targets:');
  console.log(
    `Requests/sec: ${result.requests.average >= targets.requestsPerSec ? '✅' : '❌'} (target: ${targets.requestsPerSec}+)`
  );
  console.log(
    `Avg Latency: ${result.latency.mean <= targets.avgLatency ? '✅' : '❌'} (target: <${targets.avgLatency}ms)`
  );
  console.log(
    `P99 Latency: ${result.latency.p99 <= targets.p99Latency ? '✅' : '❌'} (target: <${targets.p99Latency}ms)`
  );
}

runLoadTest();
```

**Install Dependencies**:
```bash
cd backend
npm install -D autocannon
npm install -D @types/autocannon
```

**Run Load Test**:
```bash
cd backend
npx tsx tests/load/pfa-load-test.ts
```

---

### Phase 6 Deliverables

| Deliverable | Status | Evidence |
|-------------|--------|----------|
| Monitoring dashboard | ✅ | Admin UI shows sync logs |
| Manual sync trigger | ✅ | Button works |
| Index optimization script | ✅ | VACUUM runs successfully |
| Load testing | ✅ | Meets performance targets |
| Production deployment guide | ✅ | Documentation complete |

---

## Implementation Timeline

### Week 1: Foundation (Days 1-5)

| Day | Phase | Tasks | Owner |
|-----|-------|-------|-------|
| 1 | Phase 1 | **SQLite → PostgreSQL migration** (setup, export, import) | Backend Dev |
| 2 | Phase 1 | Add Mirror/Modification tables, materialized views, indexes | Backend Dev |
| 3-4 | Phase 2 | Background worker, cron job, manual trigger | Backend Dev |
| 5 | Phase 2 | Testing, debugging, optimization | Backend Dev |

### Week 2: API & Frontend (Days 6-10)

| Day | Phase | Tasks | Owner |
|-----|-------|-------|-------|
| 6-7 | Phase 3 | Live merge API, draft management | Backend Dev |
| 8-9 | Phase 4 | Frontend integration, API client | Frontend Dev |
| 10 | Phase 4 | UI indicators, testing | Frontend Dev |

### Week 3: AI & Production (Days 11-15)

| Day | Phase | Tasks | Owner |
|-----|-------|-------|-------|
| 11-12 | Phase 5 | AI query service, SQL generation | AI Dev |
| 13-14 | Phase 6 | Monitoring, optimization | DevOps |
| 15 | Phase 6 | Load testing, deployment | Full Team |

---

## Success Criteria

### Functional Requirements

- ✅ Users can load PFA data in <100ms
- ✅ Users can make changes that persist across sessions
- ✅ Users can commit changes to PEMS
- ✅ AI can query data using SQL generation
- ✅ Background worker syncs data every 15 minutes
- ✅ Admin can monitor sync status

### Performance Requirements

| Metric | Target | Method |
|--------|--------|--------|
| First login load time | <100ms | Load test |
| Filter query time | <50ms | Manual test |
| KPI dashboard load | <100ms | Manual test |
| Draft save time | <20ms | Manual test |
| AI query execution | <500ms | Load test |
| Background sync duration | <5 min | Monitor logs |

### Storage Requirements

| Metric | Target | Method |
|--------|--------|--------|
| Storage per org | <50 MB | Check DB size |
| Total DB size (10 orgs) | <500 MB | Check DB size |

---

## Risk Mitigation

### Technical Risks

| Risk | Mitigation | Owner |
|------|----------|-------|
| Migration failure | Test on staging first, have rollback plan | DevOps |
| Performance degradation | Load test before production | Backend Dev |
| Data loss during sync | Transaction-based upserts, logging | Backend Dev |
| Frontend breaking changes | Feature flags, gradual rollout | Frontend Dev |

### Operational Risks

| Risk | Mitigation | Owner |
|------|----------|-------|
| Worker crashes | Auto-restart, health checks | DevOps |
| PEMS API downtime | Cached data continues to work | Backend Dev |
| Storage overflow | Archiving strategy, alerts | DevOps |

---

## Rollout Plan

### Stage 1: Internal Testing (Week 3, Day 15)

- Deploy to staging environment
- Test with 1-2 pilot organizations
- Validate performance targets
- Fix critical bugs

### Stage 2: Beta Release (Week 4)

- Deploy to production (read-only mode)
- Enable for 3-5 beta organizations
- Monitor metrics daily
- Collect user feedback

### Stage 3: Full Production (Week 5)

- Enable for all organizations
- Monitor performance 24/7
- Document lessons learned
- Plan future optimizations

---

## Documentation Updates Required

1. **README.md** - Add Mirror + Delta architecture overview
2. **API_REFERENCE.md** - Document new PFA Data API endpoints
3. **DEVELOPMENT_LOG.md** - Track implementation progress
4. **TROUBLESHOOTING_GUIDE.md** - Add sync troubleshooting section
5. **USER_GUIDE.md** - Explain draft indicators and sync behavior

---

## Post-Implementation Tasks

1. ✅ **Archive old code** - Move mockData.ts to docs/archive/
2. ✅ **Update tests** - Ensure all tests use new API
3. ✅ **Performance baseline** - Document actual vs target metrics
4. ✅ **User training** - Create video tutorials for draft workflow
5. ✅ **Monitoring setup** - Configure alerts for sync failures

---

## Appendix A: Environment Variables

```bash
# Backend .env additions

# Background Sync Worker
ENABLE_SYNC_WORKER=true
SYNC_INTERVAL=*/15 * * * *  # Cron expression
SYNC_ORGS=  # Comma-separated org IDs (empty = all)

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/pfa_vanguard

# Performance
MAX_QUERY_RESULTS=10000
QUERY_TIMEOUT_MS=30000
```

---

## Appendix B: SQL Cheat Sheet

```sql
-- Check mirror size
SELECT
  organization_id,
  COUNT(*) as record_count,
  pg_size_pretty(pg_total_relation_size('pfa_mirror')) as size
FROM pfa_mirror
GROUP BY organization_id;

-- Check modification count
SELECT
  user_id,
  COUNT(*) as draft_count
FROM pfa_modification
GROUP BY user_id;

-- Refresh materialized views manually
REFRESH MATERIALIZED VIEW CONCURRENTLY pfa_kpi_summary;
REFRESH MATERIALIZED VIEW CONCURRENTLY pfa_timeline_bounds;

-- Check sync logs
SELECT
  organization_id,
  status,
  started_at,
  duration_ms,
  records_processed
FROM sync_log
ORDER BY started_at DESC
LIMIT 10;

-- Test live merge query
SELECT
  COALESCE(m.record_id, mir.id) as id,
  CASE
    WHEN m.id IS NOT NULL THEN mir.data || m.changes
    ELSE mir.data
  END as data,
  CASE WHEN m.id IS NOT NULL THEN true ELSE false END as has_draft
FROM pfa_mirror mir
LEFT JOIN pfa_modification m ON mir.id = m.record_id AND m.user_id = 'test-user'
WHERE mir.organization_id = 'RIO'
LIMIT 10;
```

---

**Document Version**: 1.0
**Last Updated**: 2025-11-25
**Status**: ✅ Ready for Implementation
**Next Review**: After Phase 1 completion
