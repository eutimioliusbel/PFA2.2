# Auto-Seeding Configuration

## Overview

The backend server is now configured to automatically run database seeds every time it starts in development mode. This ensures that all necessary data (users, organizations, API configurations, etc.) is available whenever you restart the server.

## How It Works

The `npm run dev` script has been modified to:
1. **First**: Run `npm run prisma:seed` (executes `backend/prisma/seed.ts`)
2. **Second**: Run `npx tsx init-pems-credentials.ts` (configures PEMS API credentials)
3. **Then**: Start the development server with `tsx watch src/server.ts`

This happens automatically every time you run `npm run dev`.

## Seed Data Created

Every time the server starts, the seed script creates/updates:

- **6 Users**:
  - Admin user: `admin` / `admin123`
  - 5 additional users: RRECTOR, UROSA, CHURFORD, TESTRADA, SBRYSON (password: `password123`)
  - All users have access to both RIO and PORTARTHUR organizations

- **2 Organizations**:
  - RIO (Rio Tinto Project)
  - PORTARTHUR (Port Arthur LNG Project)

- **5 Global PEMS API Configurations**:
  - PEMS PFA Read (griddata endpoint)
  - PEMS PFA Write (UserDefinedScreenService)
  - PEMS Assets (equipment/assets)
  - PEMS Classes (equipment/categories)
  - PEMS Organizations (organization endpoint)

- **5 Global AI API Templates**:
  - Google Gemini AI
  - OpenAI GPT
  - Anthropic Claude
  - Azure OpenAI
  - xAI Grok

- **3 AI Providers**:
  - Google Gemini (enabled by default)
  - OpenAI GPT-4 (disabled, requires API key)
  - Anthropic Claude (disabled, requires API key)

- **Data Source Mappings**:
  - 4 entity-to-API mappings (configurable data source routing)
  - Links: pfa → PEMS PFA Read, organizations → PEMS Organizations, etc.

- **Field Configurations**:
  - Standard PFA Export configuration

- **PEMS API Credentials** (automatically configured):
  - Username: APIUSER
  - Password: BEOSugarland2025! (encrypted)
  - Tenant: BECHTEL_DEV
  - Organization: **Uses each org's database code** (RIO syncs as "RIO", PORTARTHUR as "PORTARTHUR")
  - Grid Code: CUPFAG
  - Grid ID: 100541

## Commands

### Standard Development (with auto-seeding)
```bash
cd backend
npm run dev
```
This runs the seed script automatically before starting the server.

### Development WITHOUT Seeding
If you want to start the server without running seeds (for faster restarts):
```bash
cd backend
npm run dev:no-seed
```

### Manual Seeding Only
If you just want to run the seed script without starting the server:
```bash
cd backend
npm run prisma:seed        # Database seed only (users, orgs, etc.)
npm run prisma:seed-full   # Full seed (includes PEMS credentials)
npm run db:seed           # Same as prisma:seed-full
```

## Seed Script Details

The seed script uses **upsert** operations, which means:
- If data doesn't exist, it will be **created**
- If data already exists, it will be **updated** (or left unchanged)
- Running seeds multiple times is **safe** and **idempotent**

## Performance

- First seed run: ~2-3 seconds (creates all data)
- PEMS credentials setup: ~1 second
- Subsequent seed runs: ~1-2 seconds (updates existing data)
- Server startup: ~4-5 seconds total (including full seed + credentials)

## Troubleshooting

### Port Already in Use
If you see "EADDRINUSE: address already in use :::3001":
```bash
# On Windows, find and kill the process
netstat -ano | findstr ":3001"
taskkill //F //PID <PID_NUMBER>
```

### Seed Failures
If the seed script fails, check:
1. Database connection in `backend/.env`
2. Prisma migrations are up to date: `npm run prisma:migrate`
3. Prisma client is generated: `npm run prisma:generate`

## Files Modified

- **backend/package.json**:
  - Modified `dev` script to include `npm run prisma:seed &&`
  - Added `dev:no-seed` script for development without seeding

## Benefits of Auto-Seeding

✅ **Consistent Development Environment**: Every developer has the same baseline data
✅ **Easy Onboarding**: New developers get working credentials immediately
✅ **Test Data Reset**: Easily reset to known-good state by restarting server
✅ **CI/CD Friendly**: Automated testing environments get seeded automatically
✅ **No Manual Setup**: No need to remember to run seed commands

## Production Considerations

⚠️ **IMPORTANT**: This auto-seeding is configured for **development only**.

In production:
- Use `npm start` (which does NOT run seeds)
- Run seeds manually once during initial deployment
- Use database migrations for schema changes
- Never auto-seed production databases on every restart

## Next Steps

After the server starts with seeded data, you may want to:

1. **Test PEMS Connections**: Verify PEMS API connections in Admin Dashboard → API Connectivity
2. **Add AI API Keys**: Configure API keys for AI providers in Admin Dashboard (if needed)
3. **Start Frontend**: `cd .. && npm run dev` (in project root)
4. **Login**: Use `admin` / `admin123` to access the application

**Note**: PEMS credentials are now automatically configured during seed, so you don't need to run `init-pems-credentials.ts` manually!

## Data Source Mapping Architecture

The system now includes **configurable API-to-entity mappings** that decouple data sources from sync functionality.

### What are Data Source Mappings?

Data Source Mappings define which API provides data for each entity type (pfa, organizations, asset_master, classifications). This allows you to:

- **Swap APIs** without code changes
- **Configure fallback APIs** for reliability
- **Track performance** per data source
- **Override mappings** per organization

### Default Mappings

The seed script automatically creates these mappings:

| Entity Type | API | Priority | Status |
|------------|-----|----------|--------|
| `pfa` | PEMS - PFA Data (Read) | 1 | Active |
| `organizations` | PEMS - Organizations | 1 | Active |
| `asset_master` | PEMS - Asset Master | 1 | Active |
| `classifications` | PEMS - Classes & Categories | 1 | Active |

### Architecture Benefits

✅ **Flexibility**: Discontinue/replace APIs without breaking sync functionality
✅ **Reliability**: Configure backup APIs that automatically activate on failure
✅ **Observability**: Track success rates and response times per mapping
✅ **Multi-tenancy**: Override global mappings per organization

### Documentation

For full architecture details, see: `backend/API-MAPPING-ARCHITECTURE.md`

---

**Created**: 2025-11-25
**Last Updated**: 2025-11-25
