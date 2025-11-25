# PostgreSQL Migration Guide

**Purpose**: Step-by-step guide for migrating PFA Vanguard from SQLite to PostgreSQL

**Timeline**: 3-4 hours
**Risk Level**: Medium (requires database backup)
**Rollback**: Available (restore from backup)

---

## Why Migrate to PostgreSQL?

### Required for Mirror + Delta Architecture

The Cached Mirror + Delta architecture **requires** PostgreSQL for:
- ✅ **JSONB columns** - Flexible schema with indexed fields
- ✅ **Generated columns** - Automatic extraction from JSONB
- ✅ **Materialized views** - Pre-computed aggregations
- ✅ **Advanced indexing** - GIN indexes for JSON queries
- ✅ **Better concurrency** - Multiple users editing simultaneously

### Benefits

| Feature | SQLite | PostgreSQL | Winner |
|---------|--------|------------|--------|
| JSONB support | ❌ No | ✅ Native | PostgreSQL |
| Generated columns | ❌ Limited | ✅ Full support | PostgreSQL |
| Materialized views | ❌ No | ✅ Yes | PostgreSQL |
| Concurrent writes | ⚠️ Limited | ✅ Excellent | PostgreSQL |
| Production readiness | ⚠️ Not recommended | ✅ Industry standard | PostgreSQL |
| Scale | ⚠️ Single file | ✅ 1TB+ | PostgreSQL |

**Verdict**: PostgreSQL is required for the architecture to work.

---

## Migration Checklist

### Pre-Migration (15 minutes)

- [ ] **Backup SQLite database**
  ```bash
  cp backend/prisma/dev.db backend/prisma/dev.db.backup
  ```

- [ ] **Choose PostgreSQL setup**:
  - [ ] Option A: Local PostgreSQL (production-like)
  - [ ] Option B: Docker PostgreSQL (easiest for dev)
  - [ ] Option C: Cloud PostgreSQL (AWS RDS, Supabase, etc.)

- [ ] **Create scripts directory**:
  ```bash
  mkdir -p backend/scripts/migration
  ```

### Step 1: Setup PostgreSQL (30 minutes)

**Option B: Docker (Recommended for Development)**

```bash
# Create docker-compose.yml
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
docker ps | grep pfa_postgres
```

**Verification**:
```bash
# Connect to database
psql -U pfa_user -h localhost -d pfa_vanguard_dev
# Password: pfa_dev_password

# You should see: pfa_vanguard_dev=#
\q
```

### Step 2: Update Configuration (5 minutes)

**Update `backend/.env`**:
```bash
# OLD
# DATABASE_URL="file:./prisma/dev.db"

# NEW (Docker)
DATABASE_URL="postgresql://pfa_user:pfa_dev_password@localhost:5432/pfa_vanguard_dev?schema=public"
```

**Update `backend/prisma/schema.prisma`**:
```prisma
datasource db {
  provider = "postgresql"  // Changed from "sqlite"
  url      = env("DATABASE_URL")
}
```

### Step 3: Export SQLite Data (15 minutes)

**Create export script**: `backend/scripts/migration/export-sqlite-data.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient({
  datasources: { db: { url: 'file:./prisma/dev.db' } }
});

async function exportData() {
  console.log('📤 Exporting from SQLite...');

  const data = {
    users: await prisma.user.findMany(),
    organizations: await prisma.organization.findMany(),
    apiConfigurations: await prisma.apiConfiguration.findMany(),
    aiProviders: await prisma.aiProvider.findMany(),
    systemConfig: await prisma.systemConfig.findMany(),
    dataSourceMappings: await prisma.dataSourceMapping.findMany(),
  };

  writeFileSync('./scripts/migration/sqlite-export.json', JSON.stringify(data, null, 2));

  console.log('✅ Exported:', Object.entries(data).map(([k, v]) => `${k}: ${v.length}`).join(', '));
  await prisma.$disconnect();
}

exportData();
```

**Run export**:
```bash
cd backend
npx tsx scripts/migration/export-sqlite-data.ts
```

**Expected output**:
```
📤 Exporting from SQLite...
✅ Exported: users: 1, organizations: 2, apiConfigurations: 4, aiProviders: 3, systemConfig: 1, dataSourceMappings: 4
```

**Verify**: Check that `backend/scripts/migration/sqlite-export.json` exists and contains your data.

### Step 4: Reset Migrations (10 minutes)

```bash
cd backend

# Backup old migrations
mv prisma/migrations prisma/migrations_sqlite_backup

# Create initial PostgreSQL migration
npx prisma migrate dev --name initial_postgresql_migration

# Expected output:
# ✔ Generated Prisma Client
# ✔ Database schema created (X tables)
```

**Verification**:
```bash
# Check tables created in PostgreSQL
psql -U pfa_user -h localhost -d pfa_vanguard_dev -c "\dt"

# Expected: List of tables (users, organizations, api_configurations, etc.)
```

### Step 5: Import Data to PostgreSQL (15 minutes)

**Create import script**: `backend/scripts/migration/import-to-postgresql.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';

const prisma = new PrismaClient();

async function importData() {
  console.log('📥 Importing to PostgreSQL...');

  const data = JSON.parse(readFileSync('./scripts/migration/sqlite-export.json', 'utf-8'));

  await prisma.$transaction(async (tx) => {
    // Import in order (respects foreign keys)
    for (const user of data.users) {
      await tx.user.create({ data: user });
    }
    console.log(`✅ Users: ${data.users.length}`);

    for (const org of data.organizations) {
      await tx.organization.create({ data: org });
    }
    console.log(`✅ Organizations: ${data.organizations.length}`);

    for (const config of data.apiConfigurations) {
      await tx.apiConfiguration.create({ data: config });
    }
    console.log(`✅ API Configurations: ${data.apiConfigurations.length}`);

    for (const provider of data.aiProviders) {
      await tx.aiProvider.create({ data: provider });
    }
    console.log(`✅ AI Providers: ${data.aiProviders.length}`);

    for (const config of data.systemConfig) {
      await tx.systemConfig.create({ data: config });
    }
    console.log(`✅ System Config: ${data.systemConfig.length}`);

    for (const mapping of data.dataSourceMappings) {
      await tx.dataSourceMapping.create({ data: mapping });
    }
    console.log(`✅ Data Source Mappings: ${data.dataSourceMappings.length}`);
  });

  console.log('✅ All data imported!');
  await prisma.$disconnect();
}

importData();
```

**Run import**:
```bash
cd backend
npx tsx scripts/migration/import-to-postgresql.ts
```

### Step 6: Verify Migration (15 minutes)

**1. Check data counts**:
```bash
psql -U pfa_user -h localhost -d pfa_vanguard_dev

SELECT 'users' as table_name, COUNT(*) FROM users
UNION ALL
SELECT 'organizations', COUNT(*) FROM organizations
UNION ALL
SELECT 'api_configurations', COUNT(*) FROM api_configurations
UNION ALL
SELECT 'ai_providers', COUNT(*) FROM ai_providers;

-- Expected: Same counts as SQLite export
```

**2. Verify admin user**:
```sql
SELECT id, username, role FROM users WHERE username = 'admin';
-- Expected: 1 row with admin user
```

**3. Test backend**:
```bash
cd backend

# Regenerate Prisma Client
npx prisma generate

# Start server
npm run dev

# In another terminal, test login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Expected: JWT token returned
```

**4. Test frontend**:
```bash
cd ..  # Back to project root
npm run dev

# Open browser: http://localhost:3000
# Login with admin/admin123
# Expected: Login works, data loads
```

### Step 7: Clean Up (5 minutes)

**If migration successful**:
```bash
# Keep SQLite backup but remove old data
# DO NOT delete dev.db.backup yet!

# Remove SQLite migrations backup (after confirming everything works)
rm -rf backend/prisma/migrations_sqlite_backup

# Update .gitignore to ignore SQLite files
echo "backend/prisma/*.db" >> .gitignore
echo "backend/prisma/*.db.backup" >> .gitignore
```

---

## Troubleshooting

### Problem: "database does not exist"

**Solution**:
```bash
docker-compose down
docker-compose up -d
# Wait 10 seconds for PostgreSQL to start
psql -U pfa_user -h localhost -d pfa_vanguard_dev
```

### Problem: "relation does not exist"

**Cause**: Migrations not applied

**Solution**:
```bash
cd backend
npx prisma migrate dev
```

### Problem: Import fails with foreign key errors

**Cause**: Wrong import order

**Solution**: Ensure imports happen in this order:
1. Users
2. Organizations
3. API Configurations
4. AI Providers
5. System Config
6. Data Source Mappings

### Problem: Backend can't connect to PostgreSQL

**Check**:
```bash
# 1. Verify PostgreSQL is running
docker ps | grep pfa_postgres

# 2. Test connection manually
psql -U pfa_user -h localhost -d pfa_vanguard_dev

# 3. Check DATABASE_URL in .env
cat backend/.env | grep DATABASE_URL

# 4. Verify connection string format
# postgresql://user:password@host:port/database?schema=public
```

### Problem: Login returns 401 Unauthorized

**Possible causes**:
1. Admin user not imported correctly
2. Password hash format issue

**Solution**:
```bash
# Check if admin user exists
psql -U pfa_user -h localhost -d pfa_vanguard_dev -c \
  "SELECT id, username FROM users WHERE username = 'admin';"

# If missing, re-run import script
cd backend
npx tsx scripts/migration/import-to-postgresql.ts
```

---

## Rollback Plan

### If Migration Fails

**Step 1: Stop backend server** (Ctrl+C)

**Step 2: Restore SQLite**:
```bash
cd backend
cp prisma/dev.db.backup prisma/dev.db
```

**Step 3: Revert configuration**:
```bash
# Revert schema.prisma
git checkout prisma/schema.prisma

# Revert .env
# Change DATABASE_URL back to: file:./prisma/dev.db
```

**Step 4: Restore migrations**:
```bash
rm -rf prisma/migrations
mv prisma/migrations_sqlite_backup prisma/migrations
```

**Step 5: Regenerate Prisma Client**:
```bash
npx prisma generate
```

**Step 6: Restart backend**:
```bash
npm run dev
```

**Step 7: Test**:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Expected: JWT token (should work as before)
```

---

## Post-Migration Tasks

### 1. Update Documentation

- [ ] Update README.md with PostgreSQL setup instructions
- [ ] Update QUICKSTART.md with Docker Compose steps
- [ ] Add PostgreSQL to `.env.example`

### 2. Production Setup

- [ ] Choose cloud PostgreSQL provider (AWS RDS, Supabase, etc.)
- [ ] Set up database backups (daily)
- [ ] Configure SSL connections
- [ ] Set up monitoring (connection pool, query performance)

### 3. Performance Tuning

- [ ] Run ANALYZE on all tables
- [ ] Configure connection pool size
- [ ] Set up query logging for slow queries
- [ ] Monitor database size growth

---

## Success Criteria

✅ **Migration Complete When**:
- [ ] PostgreSQL database running
- [ ] All tables created in PostgreSQL
- [ ] All data imported (counts match SQLite)
- [ ] Backend connects and serves API
- [ ] Login works (admin user functional)
- [ ] Frontend loads and displays data
- [ ] No errors in backend logs
- [ ] No errors in browser console

---

## Next Steps

After successful migration, proceed to:
1. **Add Mirror & Modification tables** (Task 1.1 in Implementation Plan)
2. **Create materialized views** (Task 1.2)
3. **Implement background sync worker** (Phase 2)

See [IMPLEMENTATION-PLAN-MIRROR-DELTA.md](./IMPLEMENTATION-PLAN-MIRROR-DELTA.md) for full details.

---

**Questions or Issues?**

If you encounter problems not covered in this guide:
1. Check backend logs: `backend/logs/app.log`
2. Check Docker logs: `docker-compose logs postgres`
3. Test database connection: `psql -U pfa_user -h localhost -d pfa_vanguard_dev`
4. Review error messages carefully

**Keep the SQLite backup until you're 100% confident the migration is stable!**
