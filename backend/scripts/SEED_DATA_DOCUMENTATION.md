# Seed Data Documentation

**Document Version:** 1.0
**Last Updated:** 2025-11-25
**Status:** Current

> **Purpose**: This document provides comprehensive documentation of all seed scripts and data sources used to initialize the PFA Vanguard database.

---

## Table of Contents

1. [Overview](#overview)
2. [Seed Files](#seed-files)
3. [Data Sources](#data-sources)
4. [Entity Relationships](#entity-relationships)
5. [PostgreSQL Migration Considerations](#postgresql-migration-considerations)
6. [Running Seed Scripts](#running-seed-scripts)
7. [Seed Data Validation](#seed-data-validation)

---

## Overview

PFA Vanguard uses multiple seed scripts to initialize the database with essential data. The seed scripts are designed to be **idempotent** (can be run multiple times safely) using Prisma's `upsert` operations.

### Seed Script Categories

| Script | Purpose | Run Frequency | Dependencies |
|--------|---------|---------------|--------------|
| `prisma/seed.ts` | Main seed script (users, orgs, AI providers) | Once on initial setup | None |
| `seed-pems-global.ts` | PEMS Global organization API configurations | Deprecated (replaced by main seed) | Requires PEMS_Global org |
| `seed-data-source-mappings.ts` | Maps entities to API endpoints | After API config changes | Requires ApiConfiguration records |

---

## Seed Files

### 1. Main Seed Script: `backend/prisma/seed.ts`

**Purpose**: Creates initial database structure with users, organizations, API configurations, and AI providers.

**Run Command**:
```bash
cd backend
npm run prisma:seed
```

**Data Created**:

#### 1.1 Users (6 total)

| Username | Role | Password | Description |
|----------|------|----------|-------------|
| `admin` | admin | `admin123` | System administrator with full access |
| `RRECTOR` | user | `password123` | Rick Rector (project user) |
| `UROSA` | user | `password123` | Ubi Rosa (project user) |
| `CHURFORD` | user | `password123` | Calvin Hurford (project user) |
| `TESTRADA` | user | `password123` | Tony Estrada (project user) |
| `SBRYSON` | user | `password123` | Steve Bryson (project user) |

**Important**: All passwords are hashed using bcrypt (10 rounds) before storage.

#### 1.2 Organizations (2 total)

| Code | Name | Description |
|------|------|-------------|
| `RIO` | Rio Tinto Project | Rio Tinto construction project |
| `PORTARTHUR` | Port Arthur Project | Port Arthur LNG construction project |

**Note**: Previous organizations `HOLNG` and `PEMS_Global` were removed in v1.0.1 cleanup.

#### 1.3 User-Organization Relationships (12 links)

- Admin is linked to both organizations as `owner`
- All 5 users are linked to both organizations as `member`

#### 1.4 AI Providers (3 total)

| Provider | Type | Default Model | Status | Enabled |
|----------|------|---------------|--------|---------|
| Google Gemini | gemini | gemini-1.5-flash-002 | untested | ✅ Yes |
| OpenAI GPT-4 | openai | gpt-4-turbo-preview | untested | ❌ No (requires API key) |
| Anthropic Claude | anthropic | claude-3-5-sonnet-20241022 | untested | ❌ No (requires API key) |

**Pricing** (per 1M tokens):

| Provider | Model | Input | Output | Cached |
|----------|-------|-------|--------|--------|
| Gemini Flash | gemini-1.5-flash-002 | $0.075 | $0.30 | $0.01875 (75% discount) |
| GPT-4 Turbo | gpt-4-turbo-preview | $10.00 | $30.00 | N/A |
| Claude Sonnet | claude-3-5-sonnet-20241022 | $3.00 | $15.00 | N/A |

#### 1.5 Organization AI Configurations (2 total)

Both RIO and PORTARTHUR organizations get:
- **Enabled**: Yes
- **Access Level**: full-access
- **Primary Provider**: Google Gemini
- **Daily Limit**: $10.00
- **Monthly Limit**: $100.00
- **Alert Threshold**: 80%
- **Max Context Records**: 50
- **Semantic Cache**: Enabled (24-hour expiration)

#### 1.6 Global PEMS API Configurations (5 total)

**Architecture**: PEMS APIs are **global** (organizationId = NULL), meaning they're system-wide and shared by all organizations. Organizations add their specific credentials via `OrganizationApiCredentials`.

| ID | Name | Usage | URL | Auth Type | Operation |
|----|------|-------|-----|-----------|-----------|
| `pems-global-pfa-read` | PEMS - PFA Data (Read) | PEMS_PFA_READ | griddata endpoint | basic | read |
| `pems-global-pfa-write` | PEMS - PFA Data (Write) | PEMS_PFA_WRITE | UserDefinedScreenService | basic | write |
| `pems-global-assets` | PEMS - Asset Master | PEMS_ASSETS | assetdefaults endpoint | basic | read |
| `pems-global-classes` | PEMS - Classes & Categories | PEMS_CLASSES | categories endpoint | basic | read |
| `pems-global-organizations` | PEMS - Organizations | PEMS_ORGANIZATIONS | organization endpoint | basic | read |

**Feeds Configuration**:

Each API configuration has a `feeds` JSON field specifying what data it synchronizes:

```json
// PEMS PFA Read
{
  "feeds": [
    {
      "entity": "pfa",
      "views": ["Timeline Lab", "Matrix", "Grid Lab", "PFA 1.0 Lab", "PFA Master Data"]
    }
  ]
}

// PEMS PFA Write
{
  "feeds": [
    {
      "entity": "pfa",
      "operation": "write"
    }
  ]
}
```

#### 1.7 Global AI API Templates (5 total)

**Architecture**: AI provider APIs are **templates** (organizationId = NULL). Organizations add their own API keys via `OrganizationApiCredentials`.

| ID | Name | Usage | URL | Auth Type |
|----|------|-------|-----|-----------|
| `ai-global-gemini` | Google Gemini AI | AI_GEMINI | https://generativelanguage.googleapis.com/v1beta/models | apiKey |
| `ai-global-openai` | OpenAI GPT | AI_OPENAI | https://api.openai.com/v1 | apiKey |
| `ai-global-anthropic` | Anthropic Claude | AI_ANTHROPIC | https://api.anthropic.com/v1 | apiKey |
| `ai-global-azure` | Azure OpenAI | AI_AZURE | https://<your-resource>.openai.azure.com | apiKey |
| `ai-global-grok` | xAI Grok | AI_GROK | https://api.x.ai/v1 | apiKey |

#### 1.8 Field Configuration (1 default)

**ID**: `default-pfa-config`
**Scope**: Global (organizationId = NULL)
**Purpose**: Standard PFA export/import field mappings

**Fields** (22 total):

| Field | Label | Enabled | Order |
|-------|-------|---------|-------|
| pfaId | PFA ID | ✅ | 1 |
| organization | Organization | ✅ | 2 |
| areaSilo | Area/Silo | ✅ | 3 |
| category | Category | ✅ | 4 |
| class | Class | ✅ | 5 |
| source | Source | ✅ | 6 |
| dor | DOR | ✅ | 7 |
| monthlyRate | Monthly Rate | ✅ | 8 |
| purchasePrice | Purchase Price | ✅ | 9 |
| manufacturer | Manufacturer | ✅ | 10 |
| model | Model | ✅ | 11 |
| originalStart | Plan Start | ✅ | 12 |
| originalEnd | Plan End | ✅ | 13 |
| forecastStart | Forecast Start | ✅ | 14 |
| forecastEnd | Forecast End | ✅ | 15 |
| actualStart | Actual Start | ✅ | 16 |
| actualEnd | Actual End | ✅ | 17 |
| equipment | Equipment | ✅ | 18 |
| contract | Contract | ❌ | 19 |
| isActualized | Is Actualized | ❌ | 20 |
| isDiscontinued | Is Discontinued | ❌ | 21 |
| isFundsTransferable | Is Funds Transferable | ❌ | 22 |

**Export Settings**:
- Include Headers: Yes
- Date Format: YYYY-MM-DD
- Delimiter: Comma (,)
- Encoding: UTF-8

#### 1.9 Data Source Mappings (4 created)

The seed script automatically creates `DataSourceMapping` records by parsing the `feeds` field of each API configuration. This links entities to their data sources.

**Example Mappings**:

| Entity Type | API Config | Organization | Priority | Active |
|-------------|-----------|--------------|----------|--------|
| pfa | PEMS - PFA Data (Read) | Global (NULL) | 1 | ✅ |
| asset_master | PEMS - Asset Master | Global (NULL) | 1 | ✅ |
| classifications | PEMS - Classes & Categories | Global (NULL) | 1 | ✅ |
| organizations | PEMS - Organizations | Global (NULL) | 1 | ✅ |

---

### 2. PEMS Global Seed Script: `backend/seed-pems-global.ts`

**Status**: ⚠️ **DEPRECATED** (functionality merged into main seed.ts)

**Purpose**: Originally created API configurations for the PEMS_Global organization.

**Why Deprecated**:
- PEMS_Global organization was removed in v1.0.1 cleanup
- PEMS APIs are now global (organizationId = NULL) instead of org-specific
- Main seed script now handles all PEMS API configurations

**Historical Context**: This script was used during Phase 2 when PEMS APIs were organization-specific rather than global templates.

---

### 3. Data Source Mapping Seed: `backend/seed-data-source-mappings.ts`

**Purpose**: Creates `DataSourceMapping` records to link entities to API endpoints.

**Run Command**:
```bash
cd backend
npx tsx seed-data-source-mappings.ts
```

**When to Run**:
- After adding new API configurations with `feeds` field
- After modifying existing `feeds` configurations
- To rebuild mappings after database reset

**Logic**:

1. Queries all `ApiConfiguration` records with non-null `feeds` field
2. Parses `feeds` JSON to extract entity types
3. Creates `DataSourceMapping` for each entity with:
   - `entityType`: Entity name (e.g., "pfa", "asset_master")
   - `organizationId`: Copied from API configuration (NULL for global)
   - `apiConfigId`: References the API configuration
   - `priority`: 1 (highest priority)
   - `isActive`: true

**Output Example**:

```
🔄 Seeding Data Source Mappings...

Found 5 API configurations with feeds

   ✅ Created mapping: pfa → PEMS - PFA Data (Read)
   ✅ Created mapping: asset_master → PEMS - Asset Master
   ✅ Created mapping: classifications → PEMS - Classes & Categories
   ✅ Created mapping: organizations → PEMS - Organizations
   ⏭️  Mapping already exists: pfa → PEMS - PFA Data (Write)

✨ Seeding complete!
   Created: 4 mappings
   Skipped: 1 existing mappings

📊 Current Data Source Mappings:

   pfa:
      🟢 Active [Priority 1] PEMS - PFA Data (Read) (Global)
      🟢 Active [Priority 2] PEMS - PFA Data (Write) (Global)

   asset_master:
      🟢 Active [Priority 1] PEMS - Asset Master (Global)

   classifications:
      🟢 Active [Priority 1] PEMS - Classes & Categories (Global)

   organizations:
      🟢 Active [Priority 1] PEMS - Organizations (Global)
```

---

## Data Sources

### External API Data Sources

#### 1. PEMS (HxGN EAM) APIs

**Base URL**: `https://us1.eam.hxgnsmartcloud.com:443`

**Authentication**: Basic Auth (username + password)

**Endpoints**:

| Endpoint | Purpose | Data Entities | Method |
|----------|---------|---------------|--------|
| `/axis/restservices/griddata` | Grid Data API (bulk read) | PFA records | POST |
| `/axis/services/UserDefinedScreenService` | SOAP API (write operations) | PFA records | SOAP |
| `/axis/restservices/assetdefaults` | Asset defaults (OpenAPI) | Asset Master | GET |
| `/axis/restservices/categories` | Categories (OpenAPI) | Classifications | GET |
| `/axis/restservices/organization` | Organizations (OpenAPI) | Organizations | GET |

**Grid Data Views**:
- Timeline Lab
- Matrix
- Grid Lab
- PFA 1.0 Lab
- PFA Master Data
- Asset Master
- Classifications Master Data

#### 2. AI Provider APIs

**Google Gemini**:
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models`
- Auth: API Key (x-goog-api-key header)
- Models: gemini-1.5-flash-002, gemini-1.5-pro-002, gemini-2.0-flash-exp

**OpenAI**:
- Endpoint: `https://api.openai.com/v1`
- Auth: Bearer token
- Models: gpt-4-turbo-preview, gpt-4, gpt-3.5-turbo

**Anthropic Claude**:
- Endpoint: `https://api.anthropic.com/v1`
- Auth: x-api-key header
- Models: claude-3-5-sonnet-20241022, claude-3-opus-20240229, claude-3-haiku-20240307

**Azure OpenAI**:
- Endpoint: `https://<resource-name>.openai.azure.com`
- Auth: api-key header
- Models: Deployment-specific

**xAI Grok**:
- Endpoint: `https://api.x.ai/v1`
- Auth: Bearer token
- Models: TBD

---

### Internal Data Sources

#### Static Seed Data (Hardcoded)

All data in the seed scripts is hardcoded TypeScript/JavaScript objects. No external files are required.

**Source Code Location**: `backend/prisma/seed.ts`

**Data Format**: TypeScript objects using Prisma client methods

**Advantages**:
- ✅ No external file dependencies
- ✅ Type-safe (TypeScript compilation checks)
- ✅ Version controlled with code
- ✅ Idempotent (upsert operations)

**Disadvantages**:
- ❌ Requires code changes to modify seed data
- ❌ Can't easily seed large datasets (use migrations for those)

---

## Entity Relationships

### Foreign Key Dependencies

The seed script creates entities in the correct order to respect foreign key constraints:

```
1. users (no dependencies)
2. organizations (no dependencies)
3. user_organizations (depends on: users, organizations)
4. ai_providers (no dependencies)
5. organization_ai_configs (depends on: organizations)
6. ai_usage_logs (depends on: users)
7. api_configurations (depends on: organizations - nullable)
8. organization_api_credentials (depends on: organizations, api_configurations)
9. data_source_mappings (depends on: api_configurations)
10. field_configurations (depends on: organizations - nullable)
11. pfa_records (depends on: organizations)
12. sync_logs (no dependencies)
```

### Entity Relationship Diagram

```
┌──────────────┐
│   users      │
└──────┬───────┘
       │
       │ userId
       ↓
┌──────────────────────┐       ┌──────────────────┐
│ user_organizations   │───────│  organizations   │
└──────────────────────┘       └────────┬─────────┘
              organizationId            │
                                        │ organizationId
                                        ↓
                          ┌────────────────────────────┐
                          │ organization_ai_configs    │
                          │ api_configurations         │
                          │ field_configurations       │
                          │ pfa_records                │
                          └────────────────────────────┘
                                        ↓
                          ┌────────────────────────────┐
                          │ data_source_mappings       │
                          └────────────────────────────┘
```

---

## PostgreSQL Migration Considerations

### SQLite → PostgreSQL Differences

#### 1. String Lengths

**SQLite**: No enforced length limits (TEXT type for all strings)

**PostgreSQL**: Explicit length constraints recommended for performance

**Seed Script Changes Required**:

```typescript
// SQLite (current)
username: 'admin'  // No length validation

// PostgreSQL (recommended)
username: 'admin'  // VARCHAR(50) enforced at schema level
```

**Action**: No changes needed in seed script. Schema migrations will handle constraints.

#### 2. JSON Fields

**SQLite**: Stores JSON as TEXT strings

**PostgreSQL**: Native JSONB type with indexing

**Seed Script Changes Required**:

```typescript
// Current (SQLite)
availableModels: JSON.stringify([
  'gemini-1.5-flash-002',
  'gemini-1.5-pro-002'
])

// PostgreSQL (same code, different storage)
availableModels: JSON.stringify([...])  // Stored as JSONB internally
```

**Action**: No changes needed. Prisma handles conversion automatically.

#### 3. Encrypted Fields

**Current Schema**:
- `apiKeyEncrypted` (AES-256-GCM encrypted)
- `authKeyEncrypted`
- `authValueEncrypted`

**PostgreSQL Consideration**: Ensure encryption keys are consistent between SQLite and PostgreSQL environments.

**Action**: Verify `JWT_SECRET` or encryption keys are identical in `.env` files.

#### 4. Auto-increment IDs

**SQLite**: Uses INTEGER PRIMARY KEY AUTOINCREMENT

**PostgreSQL**: Uses SERIAL or BIGSERIAL

**Seed Script Changes Required**: None (Prisma abstracts this)

**Note**: Explicit IDs in seed script (e.g., `id: 'pems-global-pfa-read'`) are preserved.

---

### Migration Order for Seed Data

When migrating to PostgreSQL:

1. **Export SQLite data**: Run `npx tsx backend/scripts/migration/export-sqlite-data.ts`
2. **Setup PostgreSQL**: Start Docker container or cloud instance
3. **Run migrations**: `npx prisma migrate deploy`
4. **Import data**: Run `npx tsx backend/scripts/migration/import-to-postgresql.ts`
5. **Verify data**: Run `npx tsx backend/scripts/migration/verify-export.ts`
6. **(Optional) Re-run seed scripts**: If you want to add additional seed data

**Important**: The import script preserves all existing data. Running seed scripts after import will skip existing records due to `upsert` operations.

---

### PostgreSQL Seed Script Compatibility

The current seed scripts are **fully compatible** with PostgreSQL with no modifications required:

✅ **Compatible**:
- Prisma client abstracts database differences
- JSON.stringify() works for both SQLite (TEXT) and PostgreSQL (JSONB)
- Upsert operations work identically
- bcrypt password hashing is database-agnostic

❌ **Incompatible** (none found):
- No SQLite-specific syntax used
- No hardcoded SQL queries
- No database-specific data types

---

## Running Seed Scripts

### Quick Start

**Initial Database Setup** (run once):

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Generate Prisma client
npx prisma generate

# 3. Run migrations
npx prisma migrate deploy

# 4. Run main seed script
npm run prisma:seed

# 5. (Optional) Seed data source mappings
npx tsx seed-data-source-mappings.ts

# 6. Configure PEMS credentials
npx tsx init-pems-credentials.ts
```

### Individual Scripts

**Run Main Seed Script Only**:

```bash
cd backend
npm run prisma:seed
```

**Run Data Source Mappings Only**:

```bash
cd backend
npx tsx seed-data-source-mappings.ts
```

**Reset Database & Re-seed**:

```bash
cd backend

# SQLite (development)
npx prisma migrate reset --force

# PostgreSQL (use with caution!)
npx prisma migrate reset --force
```

---

## Seed Data Validation

### Verify Seed Completed Successfully

**Check Record Counts**:

```typescript
// Run in Node REPL or create a test script
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function verify() {
  const counts = {
    users: await prisma.user.count(),
    organizations: await prisma.organization.count(),
    userOrgs: await prisma.userOrganization.count(),
    aiProviders: await prisma.aiProvider.count(),
    apiConfigs: await prisma.apiConfiguration.count(),
    dataSourceMappings: await prisma.dataSourceMapping.count(),
  };

  console.log('Seed Data Verification:');
  console.log(JSON.stringify(counts, null, 2));

  // Expected counts
  const expected = {
    users: 6,
    organizations: 2,
    userOrgs: 12,
    aiProviders: 3,
    apiConfigs: 10,
    dataSourceMappings: 4,
  };

  const matches = JSON.stringify(counts) === JSON.stringify(expected);
  console.log(matches ? '✅ Seed data valid' : '❌ Seed data mismatch');
}

verify();
```

### Expected Output

```
🌱 Starting database seed...

👤 Creating admin user...
✓ Admin user created: admin (cluid123...)
  Login credentials: admin / admin123

👥 Creating additional users...
✓ User created: Rick Rector (RRECTOR)
✓ User created: Ubi Rosa (UROSA)
✓ User created: Calvin Hurford (CHURFORD)
✓ User created: Tony Estrada (TESTRADA)
✓ User created: Steve Bryson (SBRYSON)
  Default password for all users: password123

🏢 Creating organizations...
✓ Created organization: Rio Tinto Project (RIO)
✓ Created organization: Port Arthur Project (PORTARTHUR)

🔗 Linking admin to organizations...
✓ Admin linked to RIO
✓ Admin linked to PORTARTHUR

🔗 Linking users to organizations...
✓ RRECTOR linked to RIO
✓ RRECTOR linked to PORTARTHUR
✓ UROSA linked to RIO
✓ UROSA linked to PORTARTHUR
✓ CHURFORD linked to RIO
✓ CHURFORD linked to PORTARTHUR
✓ TESTRADA linked to RIO
✓ TESTRADA linked to PORTARTHUR
✓ SBRYSON linked to RIO
✓ SBRYSON linked to PORTARTHUR

🤖 Creating AI provider configurations...
✓ Created provider: Google Gemini (Default)
✓ Created provider: OpenAI GPT-4 (disabled)
✓ Created provider: Anthropic Claude (disabled)

⚙️  Creating organization AI configurations...
✓ AI config created for RIO (daily: $10, monthly: $100)
✓ AI config created for PORTARTHUR (daily: $10, monthly: $100)

🔌 Creating global PEMS API configurations (system-wide)...
✓ PEMS PFA Read  (griddata endpoint)
✓ PEMS PFA Write (UserDefinedScreenService)
✓ PEMS Assets    (equipment/assets)
✓ PEMS Classes   (equipment/categories)
✓ PEMS Organizations (organization endpoint)

🤖 Creating global AI provider API templates...
✓ Google Gemini AI (global template)
✓ OpenAI GPT (global template)
✓ Anthropic Claude (global template)
✓ Azure OpenAI (global template)
✓ xAI Grok (global template)

📋 Creating default field configuration...
✓ Default field configuration created

🔗 Creating data source mappings...
✓ Data source mappings created: 4 new, 0 existing

✅ Database seed completed successfully!

═══════════════════════════════════════════════════════════
📋 Summary:
───────────────────────────────────────────────────────────
   Users:                    6 (admin + 5 users)
   Organizations:            2 (RIO, PORTARTHUR)
   Global PEMS APIs:         5 (PFA Read/Write, Assets, Classes, Orgs)
   Global AI API Templates:  5 (Gemini, OpenAI, Claude, Azure, Grok)
   AI Providers:             3 (Gemini enabled, OpenAI/Claude disabled)
   Data Source Mappings:     4 (API→Entity links)
   Field Configurations:     1 (Standard PFA Export)
═══════════════════════════════════════════════════════════

🔐 Login Credentials:
   Admin:
     Username: admin
     Password: admin123

   Users:
     RRECTOR, UROSA, CHURFORD, TESTRADA, SBRYSON
     Password: password123

📌 New Architecture:
   • PEMS APIs are GLOBAL (admin-only, shared by all orgs)
   • AI providers are TEMPLATES (orgs add their own API keys)
   • Organizations add credentials via OrganizationApiCredentials

🚀 IMPORTANT - Next Steps:
   1. Run: npx tsx init-pems-credentials.ts
      This will configure PEMS credentials for all organizations
   2. Start backend: cd backend && npm run dev
   3. Orgs: Add AI API keys for providers they want to use
   4. Test PEMS connections in Admin Dashboard
```

### Common Issues

**Issue 1: "Unique constraint failed"**

```
Error: Unique constraint failed on the fields: (`username`)
```

**Cause**: Seed script was run multiple times without database reset.

**Solution**: This is expected behavior. Upsert operations will update existing records instead of creating duplicates.

---

**Issue 2: "Foreign key constraint failed"**

```
Error: Foreign key constraint failed on the field: `organizationId`
```

**Cause**: Database schema out of sync with seed script.

**Solution**:
```bash
npx prisma migrate reset --force
npm run prisma:seed
```

---

**Issue 3: "Table does not exist"**

```
Error: Table `users` does not exist
```

**Cause**: Migrations not run before seeding.

**Solution**:
```bash
npx prisma migrate deploy
npm run prisma:seed
```

---

## Related Documentation

- [Backend Architecture](../DATABASE_ARCHITECTURE.md) - Database schema and query patterns
- [Migration Guide](./migration/MIGRATION_GUIDE.md) - SQLite → PostgreSQL migration
- [API Configuration](../API-MAPPING-ARCHITECTURE.md) - Data source orchestration
- [Auto-Seed README](../AUTO-SEED-README.md) - Automatic seeding on startup

---

## Change Log

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-11-25 | Initial seed data documentation | Claude Code |

---

**Document Version:** 1.0
**Last Updated:** 2025-11-25
**Maintained By:** PFA Vanguard Backend Team

**Questions?** See [DOCUMENTATION_STANDARDS.md](../../docs/DOCUMENTATION_STANDARDS.md)
