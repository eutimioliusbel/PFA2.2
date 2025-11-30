# Migration Scripts

This directory contains one-time migration scripts for evolving the PFA Vanguard database schema and data structures.

---

## Available Migrations

### migrate-to-two-tier-api.ts

**Purpose**: Convert legacy `ApiConfiguration` records to the new two-tier architecture (`ApiServer` + `ApiEndpoint`).

**Problem Solved**: Eliminates credential duplication across 7 PEMS API configurations by storing credentials once at the server level.

**Usage**:

```bash
# Dry run (see what would be created without making changes)
npx tsx scripts/migrations/migrate-to-two-tier-api.ts --dry-run

# Migrate specific organization
npx tsx scripts/migrations/migrate-to-two-tier-api.ts --org=BECHTEL_DEV

# Migrate all organizations
npx tsx scripts/migrations/migrate-to-two-tier-api.ts
```

**What It Does**:

1. **Analyzes existing `ApiConfiguration` records** for each organization
2. **Extracts base URL** from first config (e.g., `https://pems.example.com:443/axis/restservices`)
3. **Creates one `ApiServer`** record with:
   - Credentials from first config (all configs share same credentials)
   - Common headers (tenant, gridCode, gridId)
   - Server health aggregation fields
4. **Creates `ApiEndpoint`** records for each original config:
   - Endpoint path extracted from URL (e.g., `/assets`, `/users`)
   - Entity mapping (e.g., `PEMS_ASSETS` → `asset_master`)
   - Operation type (read/write)
5. **Updates `DataSourceMapping` records** to reference new `apiEndpointId`

**Before Migration**:
```
ApiConfiguration (7 records)
├── PEMS_ASSETS (https://.../assets) + credentials
├── PEMS_USERS (https://.../users) + credentials
├── PEMS_CLASSES (https://.../classes) + credentials
└── ... (4 more with duplicate credentials)
```

**After Migration**:
```
ApiServer (1 record)
└── PEMS Production (https://.../restservices) + credentials
    ├── ApiEndpoint: Assets (/assets)
    ├── ApiEndpoint: Users (/users)
    ├── ApiEndpoint: Categories & Classes (/classes)
    └── ... (4 more endpoints)
```

**Estimated Duration**: < 5 seconds for typical dataset

**Rollback**: Not provided. Backup database before running.

---

## Migration Best Practices

1. **Always run with `--dry-run` first** to verify what will be created
2. **Backup the database** before running production migration
3. **Test on staging environment** before production
4. **Verify results** in Admin → API Connectivity UI after migration
5. **Monitor logs** for errors during migration

---

## Adding New Migrations

When creating a new migration script:

1. **Naming Convention**: `migrate-[description].ts` (e.g., `migrate-add-user-roles.ts`)
2. **Required Sections**:
   - JSDoc header with `@file`, `@description`, `@usage`, `@example`
   - `--dry-run` flag support
   - Error handling with detailed logging
   - Summary output with statistics
   - TypeScript types for results
3. **Update this README** with usage instructions

---

**Last Updated**: 2025-11-26
**Maintainer**: Development Team
