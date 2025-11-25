# What's Next: Phase 1 Implementation Guide

**Last Updated:** 2025-11-25
**Status:** Ready to Begin
**Estimated Time:** 8 hours (Day 1)

> **Current Status**: All Phase 1 preparation complete. Docker installation is the only remaining prerequisite.

---

## Quick Start

### Prerequisites Status

| Prerequisite | Status | Action Required |
|--------------|--------|-----------------|
| ✅ Agent Recommendations | Complete | None - all agents delivered |
| ✅ Safety Checkpoints | Complete | Git commit (5a4f023) + SQLite backup |
| ✅ Documentation | Complete | 10+ files (6,000+ lines) |
| ✅ Migration Scripts | Complete | 8 scripts ready to use |
| ✅ PostgreSQL Seed Scripts | Complete | Mirror + Delta sample data ready |
| ❌ Docker Desktop | **Not Installed** | **Install now** (see below) |

---

## Step 1: Install Docker Desktop (30 minutes)

### Quick Install

1. **Download Docker Desktop**:
   - Visit: https://www.docker.com/products/docker-desktop
   - Click "Download for Windows"
   - Save installer (~500 MB)

2. **Run Installer**:
   - Double-click `Docker Desktop Installer.exe`
   - Check: "Use WSL 2 instead of Hyper-V"
   - Click "OK" and wait for installation
   - **Restart your computer** when prompted

3. **Launch Docker Desktop**:
   - Docker should start automatically after restart
   - Accept Terms of Service
   - Wait for green status indicator (2-5 minutes)
   - **Skip sign-in** (optional for local development)

4. **Verify Installation**:
   ```powershell
   # Open PowerShell and run:
   cd C:\Projects\PFA2.2\backend
   .\verify-docker-setup.ps1
   ```

**Detailed Instructions**: See `docs/DOCKER_SETUP_WINDOWS.md`

---

## Step 2: Start PostgreSQL (5 minutes)

### Start Containers

```powershell
# Navigate to backend folder
cd C:\Projects\PFA2.2\backend

# Start PostgreSQL and pgAdmin
docker-compose up -d

# Verify containers are running
docker ps

# Expected: 2 containers (postgres, pgadmin) with "Up" status
```

### Verify PostgreSQL

```powershell
# Check logs
docker-compose logs -f postgres

# Look for: "database system is ready to accept connections"

# Test connection
docker exec -it backend_postgres_1 psql -U pfa_user -d pfa_vanguard_dev

# Inside psql, run: \l (list databases), then \q (quit)
```

### Access pgAdmin (Optional)

1. Open browser: http://localhost:5050
2. Login: `admin@pfa.local` / `admin`
3. Add server:
   - Name: `PFA Vanguard Dev`
   - Host: `postgres`
   - Port: `5432`
   - Database: `pfa_vanguard_dev`
   - Username: `pfa_user`
   - Password: `pfa_dev_password`

---

## Step 3: Update Environment Configuration (5 minutes)

### Create/Update backend/.env

```bash
# Navigate to backend folder
cd backend

# Copy example if .env doesn't exist
if not exist .env copy .env.example .env

# Open .env in text editor and update:
```

**Required Changes**:

```env
# DATABASE_URL - Update to PostgreSQL
DATABASE_URL="postgresql://pfa_user:pfa_dev_password@localhost:5432/pfa_vanguard_dev?schema=public"

# JWT_SECRET - Keep existing or generate new
JWT_SECRET="your-existing-secret-or-generate-new"

# AI Provider Keys - Keep existing
GEMINI_API_KEY="your-existing-key"
# ... other keys
```

**Generate New JWT Secret** (Optional):

```powershell
# Using OpenSSL (if installed):
openssl rand -base64 32

# Or using PowerShell:
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

---

## Step 4: Run Database Migrations (10 minutes)

### Regenerate Prisma Client

```bash
# Navigate to backend (if not already there)
cd backend

# Regenerate Prisma client for PostgreSQL
npx prisma generate
```

**Expected Output**:
```
✔ Generated Prisma Client (4.x.x) to ./node_modules/@prisma/client in 50ms
```

### Deploy Migrations

```bash
# Apply all migrations to PostgreSQL
npx prisma migrate deploy
```

**Expected Output**:
```
12 migrations found in prisma/migrations
Applying migration `20251125040401_add_sync_tracking_fields`
Applying migration `20251125120420_add_data_source_mapping`
... (12 total)

The following migration(s) have been applied:
migrations/
  └─ 20251125040401_add_sync_tracking_fields
  └─ 20251125120420_add_data_source_mapping
  └─ ... (10 more)

All migrations have been successfully applied.
```

### Verify Schema

```bash
# Open Prisma Studio to verify tables exist
npx prisma studio
```

**Browser opens**: http://localhost:5555

**Verify**:
- All 12 tables exist
- Tables are empty (no records yet)
- Schema matches documentation

---

## Step 5: Import Data (15 minutes)

### Option A: Import from Existing Export (Recommended)

```bash
# Import data from SQLite export
npx tsx scripts/migration/import-to-postgresql.ts scripts/migration/export-2025-11-25
```

**Expected Output**:
```
📥 Importing to PostgreSQL...

✓ Found 13 JSON files
✓ Imported users: 7 records
✓ Imported organizations: 28 records
✓ Imported user_organizations: 12 records
... (12 tables total)

✅ All data imported successfully!
   Duration: 1.2s
   Total Records: 67
```

### Verify Import

```bash
# Verify data integrity
npx tsx scripts/migration/verify-export.ts scripts/migration/export-2025-11-25
```

**Expected Output**:
```
✅ Verification Summary
Status:             ✅ PASS
Tables Verified:    12
Tables Passed:      12
Tables Failed:      0
FK Violations:      0
```

### Option B: Fresh Seed (Alternative)

```bash
# Seed fresh data (if import doesn't work or you want fresh start)
npm run prisma:seed
npx tsx seed-data-source-mappings.ts
```

---

## Step 6: Seed Mirror + Delta Sample Data (5 minutes)

```bash
# Seed sample data for Mirror + Delta architecture
npx tsx scripts/db/seed-postgres-mirror-delta.ts
```

**Expected Output**:
```
╔═══════════════════════════════════════════════════════════════╗
║  PostgreSQL Mirror + Delta Seed Script                       ║
╚═══════════════════════════════════════════════════════════════╝

✓ PostgreSQL database detected
✓ Found 3 Mirror + Delta tables

📦 Seeding PfaMirror table...
   ✅ Created mirror: PFA-RIO-001 (RIO - Earthmoving)
   ✅ Created mirror: PFA-RIO-002 (RIO - Lifting)
   ✅ Created mirror: PFA-PORTARTHUR-001 (PORTARTHUR - Earthmoving)

📝 Seeding PfaModification table...
   ✅ Created modification: admin → PFA-RIO-001
   ✅ Created modification: RRECTOR → PFA-RIO-002

✅ Seed completed successfully!
```

**Verify in Prisma Studio**:
- `pfa_mirror`: 3 records
- `pfa_modification`: 2 records
- `sync_log`: 1 record

---

## Step 7: Start Backend Server (5 minutes)

### Start Development Server

```bash
# Still in backend folder
npm run dev
```

**Expected Output**:
```
> backend@1.0.0 dev
> nodemon src/server.ts

[nodemon] starting `ts-node src/server.ts`
🚀 Server started on port 3001
📊 Database connected: PostgreSQL
✅ All systems operational
```

### Test Backend Endpoints

**Open new terminal**:

```bash
# Test health endpoint
curl http://localhost:3001/health

# Expected: {"status":"ok"}

# Test authentication
curl http://localhost:3001/api/auth/verify -H "Authorization: Bearer test"

# Expected: {"error":"Invalid token"}

# Test API configs endpoint
curl http://localhost:3001/api/configs

# Expected: JSON array of API configurations
```

---

## Step 8: Test Frontend (5 minutes)

### Start Frontend Development Server

**Open new terminal**:

```bash
# Navigate to project root
cd C:\Projects\PFA2.2

# Start frontend
npm run dev
```

**Expected Output**:
```
> pfa-vanguard@1.0.0 dev
> vite

  VITE v4.x.x  ready in 500 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

### Test Login

1. **Open browser**: http://localhost:3000
2. **Login**:
   - Username: `admin`
   - Password: `admin123`
3. **Verify**:
   - Dashboard loads
   - Organization selector shows "RIO" and "PORTARTHUR"
   - No console errors

---

## Verification Checklist

Before proceeding to Phase 2, verify all these items:

### Infrastructure

- [ ] Docker Desktop installed and running
- [ ] PostgreSQL container running (`docker ps` shows "Up")
- [ ] pgAdmin accessible at http://localhost:5050
- [ ] Backend server running on port 3001
- [ ] Frontend server running on port 3000

### Database

- [ ] All 12 tables exist in PostgreSQL
- [ ] 67 base records imported successfully
- [ ] 3 Mirror + Delta sample records seeded
- [ ] Prisma Studio shows all data
- [ ] No foreign key violations

### Application

- [ ] Login works (admin / admin123)
- [ ] Organizations load (RIO, PORTARTHUR)
- [ ] Admin dashboard accessible
- [ ] API Connectivity page shows PEMS APIs
- [ ] No console errors in browser

### Documentation

- [ ] Read `docs/implementation/IMPLEMENTATION-PLAN-MIRROR-DELTA.md`
- [ ] Reviewed Phase 2 requirements
- [ ] Understand Mirror + Delta architecture (ADR-005)

---

## If Something Goes Wrong

### Common Issues

**Issue 1: Docker won't start**
```powershell
# Solution: Restart Docker Desktop
# Right-click Docker tray icon → Restart
```

**Issue 2: Port 5432 already in use**
```powershell
# Solution: Check what's using the port
netstat -ano | findstr :5432

# Kill the process or change Docker port in docker-compose.yml
```

**Issue 3: Migrations fail**
```bash
# Solution: Reset database and try again
docker-compose down -v
docker-compose up -d
npx prisma migrate deploy
```

**Issue 4: Import fails with foreign key errors**
```bash
# Solution: Verify export order
npx tsx scripts/migration/analyze-current-data.ts

# Check migration order matches documented order
```

**Issue 5: Backend won't connect to database**
```bash
# Solution: Verify DATABASE_URL in .env
# Should be: postgresql://pfa_user:pfa_dev_password@localhost:5432/pfa_vanguard_dev?schema=public
```

---

## Detailed Documentation

| Document | Purpose | Location |
|----------|---------|----------|
| **Docker Setup** | Windows installation guide | `docs/DOCKER_SETUP_WINDOWS.md` |
| **Implementation Plan** | 6-phase roadmap | `docs/implementation/IMPLEMENTATION-PLAN-MIRROR-DELTA.md` |
| **Phase 1 Summary** | Agent deliverables | `docs/implementation/PHASE1-IMPLEMENTATION-SUMMARY.md` |
| **ADR-005** | Architecture decision | `docs/adrs/ADR-005-CACHED-MIRROR-DELTA-ARCHITECTURE.md` |
| **Migration Guide** | Step-by-step migration | `backend/scripts/migration/MIGRATION_GUIDE.md` |
| **Database Architecture** | Schema documentation | `backend/DATABASE_ARCHITECTURE.md` |
| **Seed Documentation** | Seed script reference | `backend/scripts/SEED_DATA_DOCUMENTATION.md` |

---

## Phase 2 Preview

Once Phase 1 is complete, Phase 2 focuses on:

1. **Background Sync Worker** (5 days):
   - 15-minute PEMS sync cron job
   - Batch processing (1,000 records/transaction)
   - Error handling and retry logic
   - Sync status dashboard

2. **Key Features**:
   - Automatic baseline updates from PEMS
   - Conflict detection (user drafts vs. PEMS changes)
   - Sync history and audit logs
   - Performance monitoring

3. **Deliverables**:
   - `backend/src/workers/PemsSyncWorker.ts`
   - Cron job configuration
   - Sync monitoring dashboard
   - Performance benchmarks

**Estimated Duration**: 5 days (40 hours)

---

## Getting Help

**Documentation Issues**: See `docs/DOCUMENTATION_STANDARDS.md`

**Technical Questions**: Review:
- `docs/implementation/IMPLEMENTATION-PLAN-MIRROR-DELTA.md`
- `docs/adrs/ADR-005-CACHED-MIRROR-DELTA-ARCHITECTURE.md`
- `backend/DATABASE_ARCHITECTURE.md`

**Bug Reports**: Check:
- `docs/TROUBLESHOOTING_GUIDE.md`
- `docs/DEVELOPMENT_LOG.md`

---

## Success Metrics

After completing Phase 1, you should achieve:

✅ **Infrastructure**: PostgreSQL running in Docker
✅ **Data Migration**: All 67 records migrated successfully
✅ **Sample Data**: Mirror + Delta architecture functional
✅ **Application**: Backend and frontend running
✅ **Performance**: Database queries <50ms
✅ **Documentation**: All changes documented

**Ready for Phase 2**: ✅ Yes

---

**Last Updated:** 2025-11-25
**Next Review:** After Phase 1 completion
**Maintained By:** PFA Vanguard Project Team
