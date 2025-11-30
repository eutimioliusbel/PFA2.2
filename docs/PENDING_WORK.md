# Pending Work & Technical Debt

This document tracks pending development work, TODOs, type errors, and technical debt discovered during development.

**Last Updated:** 2025-11-30

---

## Frontend Type System Alignment (2025-11-30)

### Status: PHASE 1 COMPLETE ✅

**Option A implemented:** Merged type definitions into single source of truth (`types.ts`).

### Phase 1 Accomplishments
1. ✅ **Deleted duplicate file:** `frontend/services/apiTypes.ts` removed
2. ✅ **Unified type definitions:** All API response types now in `types.ts`
3. ✅ **Updated apiClient.ts:** Now imports from `types.ts` instead of `apiTypes.ts`
4. ✅ **Added comprehensive API types:** Added ~400 lines of new unified types:
   - `ApiUser`, `ApiUserOrganization`, `ApiOrganization`
   - `SyncLog`, `SyncStats`, `SyncHistoryItem`
   - `AuditLog`, `AuditReview`, `AuditStats`
   - `UserOrganization`, `UserOrganizationSummary`
   - `ApiRoleTemplate`, `ApiPersonalAccessToken`, `ApiTrashItem`
   - `Webhook`, `DictionaryEntry`, `Pagination`, `PfaMetadata`
   - Generic API response wrappers: `SuccessResponse<T>`, `ErrorResponse`
5. ✅ **TypeScript compiles with 0 errors**

### Phase 2 Remaining Work (Future Task)

Some components still use `@ts-nocheck` due to mismatches between:
- **Frontend display types** (`User`, `Organization`) - used for UI state
- **API response types** (`ApiUser`, `ApiOrganization`) - returned from API

**Files requiring type alignment (19 files):**

| File | Issue |
|------|-------|
| `PersonalAccessTokens.tsx` | PersonalAccessToken vs ApiPersonalAccessToken (scopes, revoked) |
| `TrashCan.tsx` | TrashItem vs ApiTrashItem (entityName, data) |
| `useAdminMetaState.ts` | Organization/User vs ApiOrganization/ApiUser |
| `SyncStatusDashboard.tsx` | Sync API response structure |
| `SystemDictionaryEditor.tsx` | SystemDictionaryEntry vs DictionaryEntry (label, order) |
| `IntegrationsHub.tsx` | WebhookConfig vs Webhook |
| `HistoryTab.tsx` | AuditLog field differences |
| `ImportWizard.tsx` | dataQualityIssues severity enum |
| `ApiServerManager.tsx` | ApiEndpoint type mismatch |
| `OrganizationManagement.tsx` | OrgFeatures type alignment |
| `UserOrgPermissions.tsx` | UserOrganization optional fields |
| `DataImporter.tsx` | InternalKey index signature |
| `EditOrganizationModal.tsx` | API payload types |
| `FieldConfigManager.tsx` | InternalKey enum values |
| `NLQueryInput.tsx` | Response type inference |
| `MatrixView.tsx` | bounds prop with AddNewDialog |
| `TimelineLab.tsx` | AssetMasterRecord index signature |
| `index.tsx` | @types/react-dom needed |
| `mockData.ts` | Complex union types |

**Non-production files (can be ignored):**
- `EXAMPLE_PermissionTooltip_Usage.tsx`
- `ReplayModal.stories.tsx`
- `MappingStudio.backup.tsx`
- `MappingStudio.enhanced.backup.tsx`

### Recommended Phase 2 Approach

**Option A: Component-by-component migration**
1. Pick a component file
2. Remove `@ts-nocheck`
3. Fix type errors by using Api* types
4. Test functionality
5. Repeat

**Option B: Add mapper functions to apiClient**
```typescript
// In apiClient.ts
function mapApiUserToUser(apiUser: ApiUser): User {
  return { ...apiUser, organizationId: apiUser.organizations[0]?.id };
}
```

**Estimated Effort:** 4-6 hours
**Risk:** Low (incremental, testable changes)

---

## Latest Server Restart (2025-11-29 19:14)

### Summary
**Status:** ✅ Both servers started successfully with clean initialization

### Backend Server (Port 3001) - ✅ RUNNING
**Process ID:** `c1337f`
**Status:** All systems operational

**Initialization Completed:**
- ✅ Prisma Client generated (v5.22.0) in 1.03s
- ✅ Database seeded successfully
  - 6 users (admin + 5 others)
  - 2 organizations (RIO, PORTARTHUR)
  - 7 PEMS API endpoints
  - 5 AI provider templates
  - 5 role templates
  - 23 field mappings per PFA endpoint

**Services Status:**
- ✅ Redis connected for rate limiting
- ✅ Database connected
- ✅ PemsSyncWorker enabled (interval: */15 * * * *)
- ✅ CronScheduler initialized
  - Bronze pruning: 0 2 * * *
  - PEMS write sync: * * * * *
- ✅ WebSocket server initialized
- ✅ PEMS Write Sync Worker started

**Warnings (Non-Critical):**
1. `[SemanticAuditSearchService] No Google AI API key - using rule-based parsing`
2. `[FinancialMaskingService] No Google AI API key - using fallback insights`
3. `[NotificationTimingService] No Google AI API key - using rule-based routing`

**Action:** These warnings are expected in development. Configure Google AI API key in organization settings when ready.

### Frontend Server (Port 3000) - ✅ RUNNING
**Process ID:** `ab13c9`
**Status:** Ready (Vite v6.4.1)

**Startup Time:** 624ms

**URLs:**
- Local: http://localhost:3000/
- Network: http://192.168.50.184:3000/
- Network: http://172.22.240.1:3000/

**Errors/Warnings:** None detected

---

## Server Startup Status (2025-11-29 17:55)

### Backend Server (Port 3001) - ✅ RUNNING
**Status:** Started successfully

**Warnings (Non-Critical):**
- `[SemanticAuditSearchService] No Google AI API key - using rule-based parsing`
- `[FinancialMaskingService] No Google AI API key - using fallback insights`
- `[NotificationTimingService] No Google AI API key - using rule-based routing`

**Services Running:**
- ✓ Database connected
- ✓ Redis connected (rate limiting)
- ✓ PemsSyncWorker (interval: */15 * * * *)
- ✓ CronScheduler (Bronze pruning: 0 2 * * *, PEMS write sync: * * * * *)
- ✓ WebSocket server initialized

### Frontend Server (Port 3000) - ✅ RUNNING
**Status:** Started successfully on Vite v6.4.1

**URLs:**
- Local: http://localhost:3000/
- Network: http://192.168.50.184:3000/

**Note:** Previously had a port conflict - port 3000 was occupied by stale node process (PID 7068). Process was killed and frontend restarted successfully.

---

## Critical Type Errors - FIXED

### App.tsx Type Mismatches (RESOLVED 2025-11-29)
**Status:** Fixed
**Changes Made:**
- Added `id: string` to `PfaMirrorData` interface in `types.ts`
- Made `_metadata` optional in `PfaView` interface
- Updated `historyStore.ts` to use `PfaView` instead of `PfaRecord`
- Fixed `useAuthActions.ts` AI mode type (`'panel'` not `'chat'`)
- Fixed `setVisibleSeries` signature in `SettingsPanel.tsx`
- Fixed `grouping` type to use `GroupingField[]` in `viewSettingsStore.ts` and `useOrgViewSettings.ts`
- Fixed `useDraftManagement.ts` refetchPfaData return type
- Updated `AppRoutes.tsx` interface to match actual hook signatures
- Cleaned up over 50 unused imports in `App.tsx`

---

## Backend Script Prisma Model Names
**Priority:** Medium
**Impact:** Scripts will fail at runtime if not fixed

### Scripts Fixed (2025-11-29):
- `backend/check-db.ts` - Fixed `organization`, `apiConfiguration`
- `backend/check-feeds.ts` - Fixed `apiConfiguration`
- `backend/check-pems-credentials.ts` - Fixed `apiConfiguration`
- `backend/clear-pfa-data.ts` - Fixed `pfaRecord`
- `backend/get-token.ts` - Fixed `user`
- `backend/scripts/check-admin-user.ts` - Fixed `user`, `userOrganization`
- `backend/scripts/check-ai-hooks-tables.ts` - Fixed AI model names
- `backend/scripts/check-all-endpoints.ts` - Fixed `apiServer`

### Scripts Fixed (2025-11-29 Session 2):
All backend scripts have been updated to use correct Prisma snake_case model names:
- `check-api-config.ts` - Fixed
- `check-pems-endpoints.ts` - Fixed
- `check-recent-tests.ts` - Fixed
- `check-successful-tests.ts` - Fixed
- `check-test-result.ts` - Fixed
- `create-missing-orgs.ts` - Fixed
- `fix-pfa-write-endpoint.ts` - Fixed
- `migrate-pems-endpoints.ts` - Fixed
- `migrate-pems-to-new-architecture.ts` - Fixed
- `migrate-pfa-record-to-mirror.ts` - Fixed
- `seed-test-kpi.ts` - Fixed
- `test-all-pems-endpoints.ts` - Fixed
- `test-organization-endpoint.ts` - Fixed
- `test-pems-endpoint.ts` - Fixed
- `verify-ai-data-collection.ts` - Fixed
- `verify-pems-apis.ts` - Fixed
- `verify-vendor-pricing-migration.ts` - Fixed

---

## Prisma Seed File Issues - FIXED
**Status:** Fixed (2025-11-29)

### `backend/prisma/seeds/pems-users.seed.ts`
**Issue:** Prisma `create` requires `id` and `updatedAt` fields that are marked as required without defaults in schema.

**Fix Applied:**
- Added `import { randomUUID } from 'crypto';`
- Added `id: randomUUID()` and `updatedAt: new Date()` to all user create blocks
- Also added `updatedAt: new Date()` to update blocks

---

## TODOs Found in Codebase

### constants/mockData.ts (Line 3)
```typescript
// TODO: Remove when fully integrated with backend API
```
**Status:** Pending
**Action:** Remove mock data generator once all API endpoints are connected

### components/TimelineLab.tsx (Line 149) - FIXED
**Status:** Fixed (2025-11-29)
**Action Taken:**
- Renamed `assets` prop to `pfaRecords` in MatrixView.tsx
- Updated TimelineLab.tsx to use `pfaRecords` prop
- Changed TimelineLab interface from `PfaRecord[]` to `PfaView[]`
- Now consistent with Timeline.tsx naming convention

---

## API Endpoints Not Yet Implemented

### Portfolio Dashboard APIs
These endpoints are called by PortfolioLanding.tsx but may not have full backend implementation:
- `GET /api/portfolio/health` - Portfolio health metrics
- `GET /api/priority-items` - Priority attention items

---

## Known Runtime Issues (Fixed)

### PortfolioLanding.tsx (Fixed 2025-11-29)
**Issue:** `priorityItems.filter is not a function` error
**Root Cause:** API methods were being called with incorrect arguments, and response shapes were mismatched

**Fixes Applied:**
- Removed unused `React` import
- Removed arguments from `getPortfolioHealth()` and `getPriorityItems()` calls (API takes no params)
- Added response transformation to match component interface expectations
- Fixed `trends.healthScore` → `trends.health` mapping
- Added defensive array checks in `loadPriorityItems()`
- Added fallback `|| []` on filter line
- Removed unused `severityColor` variable and `getSeverityColor` function

---

## Pre-existing TypeScript Errors (Found 2025-11-29)

These errors exist in the codebase and are NOT related to the Bronze ingestion work. They should be addressed separately.

### High Priority - Authentication & Permissions - FIXED (2025-11-29)

**`src/services/auth/authService.ts`** - FIXED
- ~~Line 83: Type error - `null` not assignable to `string`~~ - Added null check for passwordHash
- ~~Line 109: JWT sign overload mismatch~~ - Fixed with proper type cast
- ~~Line 132: Index signature issue with `Permissions` type~~ - Used `unknown` intermediate cast
- ~~Line 191: Missing `id` and `updatedAt` in user create call~~ - Added randomUUID() and Date

**`src/routes/auditRoutes.ts`** - FIXED
- ~~Line 192: `perm_ViewAuditLog` not in `keyof Permissions`~~ - Changed to `perm_Read`

**`src/routes/pemsWriteSyncRoutes.ts`** - FIXED
- ~~Lines 56, 88, 113, 156: Permission strings (`"Sync"`, `"Read"`) don't match~~ - Changed to `perm_Sync` and `perm_Read`

### Medium Priority - AI Services - FIXED (2025-11-29)

**`src/services/ai/AzureOpenAIAdapter.ts`** - FIXED
- ~~Lines 34, 79: Type mismatch with OpenAI chat completion messages~~ - Fixed formatMessages return type

**`src/services/ai/AICircuitBreaker.ts`** - FIXED
- ~~Line 167: `error` is of type `unknown`~~ - Added proper error handling with instanceof check
- ~~Line 202: Type `unknown` not assignable to `Error | null`~~ - Fixed with proper error conversion

**`src/services/ai/PermissionSuggestionService.ts`** - FIXED
- ~~Line 726: Missing `id` field in audit_logs create~~ - Added randomUUID()

### Low Priority - Unused Variables

**Multiple controllers have unused `req` parameters:**
- `src/controllers/syncStatsController.ts` (lines 55, 251)
- `src/controllers/systemDictionaryController.ts` (line 18)
- `src/controllers/trashCanController.ts` (line 219)

**Other unused variables:**
- `src/services/ai/NotificationTimingService.ts` - `_DayOfWeekEngagement`, `_genAI`
- `src/services/ai/VendorPricingWatchdogService.ts` - `_SUSPICIOUS_INCREASE_THRESHOLD`
- `src/services/ai/PromptTemplateManager.ts` - `match` (line 518)
- `src/services/ai/AIResponseCache.ts` - `config` (line 384)
- `src/routes/pfaDataRoutes.ts` - `requireOrgAccess` (line 26)

### Configuration Issues - FIXED (2025-11-29)

**`src/routes/mappingTemplateRoutes.ts`** - FIXED
- ~~Lines 58, 108: Not all code paths return a value~~ - Added return statements

### Additional Service Errors (Found 2025-11-29) - PARTIALLY FIXED

**`src/services/endpointTestService.ts`** - FIXED
- ~~Lines 167, 335, 348: Cannot find name `endpoint_test_results`~~ - Added imports from @prisma/client
- ~~Lines 391, 392: Cannot find names `api_endpoints`, `api_servers`~~ - Added imports from @prisma/client

**`src/services/pems/PemsSyncService.ts`** - FIXED
- ~~Lines 96, 141, 1171, 1226: Missing `id` field in audit_logs create~~ - Added randomUUID()
- Line 1060: Unused `organizationId` parameter (Low Priority - unused variable)

**`src/services/pems/PemsWriteApiClient.ts`**
- Lines 90-93: Unused private properties `baseUrl`, `username`, `password`, `tenant` (Low Priority - unused variables)

**`src/services/pfa/PfaValidationService.ts`**
- Line 206: Unused `isValidDate` variable (Low Priority - unused variable)

**`src/services/secrets/SecretsService.ts`** - FIXED
- ~~Line 44: Property `AWS_REGION` does not exist on type `EnvConfig`~~ - Added AWS_REGION to EnvConfig

**`src/services/websocket/SyncWebSocketServer.ts`**
- Line 16: Unused `eventBus` import (Low Priority - unused variable)

**`src/services/cron/archival/AzureBlobArchivalBackend.ts`**
- Line 2: Unused `BlockBlobClient` import (Low Priority - unused variable)

**`src/controllers/syncStatsController.ts`** - FIXED
- ~~Line 228: Type `string | null` not assignable to `string`~~ - Changed return type to allow null

### Backend Scripts Prisma Model Name Issues (Found 2025-11-29)

These scripts use old camelCase Prisma model names instead of snake_case:

**`backend/scripts/db/migrate-to-mirror.ts`**
- Uses `pfaRecord`, `pfaMirror` instead of `pfa_records`, `pfa_mirror`

**`backend/scripts/migrate-pfa-record-to-mirror.ts`**
- Uses `migratedToMirror` instead of `migrated_to_mirror`
- Uses `pfa_modifications` instead of `pfa_modification`
- Missing `id`, `updatedAt` in create calls

**`backend/scripts/migration/analyze-current-data.ts`**
- Uses `user`, `organization`, `userOrganization`, `aiProvider`, etc. (camelCase)

**`backend/scripts/migration/export-sqlite-data.ts`**
- Uses old camelCase model names throughout

**`backend/scripts/check-admin-user.ts`**
- Uses `organization` instead of `organizations` in include
- Null handling issues with `passwordHash`

**`backend/scripts/check-all-endpoints.ts`**
- Uses `endpoints` instead of `api_endpoints` in include

**`backend/scripts/create-missing-orgs.ts`**
- Missing `id`, `updatedAt` in organization create

**`backend/scripts/fix-pfa-write-endpoint.ts`**
- Missing `id`, `updatedAt` in server create

**`backend/scripts/migrate-pems-endpoints.ts`**
- Missing `id`, `updatedAt` in endpoint create

**`backend/scripts/migrate-pems-to-new-architecture.ts`**
- Missing `id`, `updatedAt` in create calls
- Uses non-existent `method` property

### Seed File Issues (Found 2025-11-29)

**`backend/prisma/seeds/pems-users.seed.ts`**
- Line 26: Unused `bcrypt` import
- Lines 206-272: Missing `id`, `modifiedAt` in user_organizations create calls

---

## Runtime Errors (Found 2025-11-29)

### Missing Database Table

**`mapping_templates` table does not exist**
- Error: `Raw query failed. Code: '42P01'. Message: 'relation "mapping_templates" does not exist'`
- Affected Routes: `GET /api/mapping-templates`
- Location: `backend/src/routes/mappingTemplateRoutes.ts`
- **Fix Required**: Add `mapping_templates` model to Prisma schema and run migration

---

## Technical Debt

### Theme Consistency
**Status:** Partially Completed (2025-11-29)

**Completed:**
- DataImporter.tsx - Updated to dark slate theme
- FieldConfigManager.tsx - Updated to dark slate theme
- ExportView.tsx - Updated to dark slate theme
- NarrativeReader.tsx - Updated to dark slate theme, added Go Back button
- NotificationPreferences.tsx - Updated to dark slate theme (2025-11-29)
- ArbitrageOpportunities.tsx - Updated to dark slate theme (2025-11-29)
- VendorPricingDashboard.tsx - Updated to dark slate theme (2025-11-29)
- ScenarioBuilder.tsx - Updated to dark slate theme (2025-11-29)

**All BEO components now use consistent dark slate theme.**

---

### Missing Admin Menu Items - VERIFIED
**Status:** Already Complete

MappingStudio was verified to already exist in `components/MainSidebar.tsx` at lines 230-236 with the `GitMerge` icon.

### Permission System
**Status:** Completed (2025-11-29)
- Added `perm_UseAiFeatures` to Permissions interface
- Fixed permission mapping in `useAuthUserMapping.ts`
- Admin users now get all 15 permissions
- BEO user flag properly set for admin users

---

## Recommended Next Steps

1. ~~**Fix PfaView/PfaRecord type alignment**~~ - DONE
2. ~~**Update remaining backend scripts**~~ - DONE (Changed Prisma model references to snake_case)
3. ~~**Clean up App.tsx imports**~~ - DONE
4. ~~**Fix Prisma seed file**~~ - DONE (Added required id and updatedAt fields)
5. **Remove mockData.ts** - After confirming all backend APIs are functional
6. ~~**Standardize prop naming**~~ - DONE (TimelineLab/MatrixView now use `pfaRecords`)

---

## How to Use This Document

When working on files:
1. Check if the file has entries in this document
2. If you encounter new issues, add them here
3. Mark items as completed with date when fixed
4. Remove fully resolved items after verification

This document should be reviewed weekly and kept up to date.
