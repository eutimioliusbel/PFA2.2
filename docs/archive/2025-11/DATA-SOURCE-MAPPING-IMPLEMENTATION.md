# Data Source Mapping Implementation Summary

## Overview

This document summarizes the complete implementation of the configurable API-to-entity mapping system that decouples data sources from sync functionality.

**Problem Solved**: The system had tight coupling between API configurations and sync functionality. It was impossible to discontinue an API without breaking functionality or to configure fallback APIs.

**Solution**: A flexible, database-driven mapping system that allows administrators to configure which API provides data for each entity type, with automatic fallback support and performance tracking.

---

## ✅ Completed Implementation

### 1. Database Schema (`backend/prisma/schema.prisma`)

**New Model: `DataSourceMapping`**
- **Purpose**: Maps entity types to API configurations with priority and performance tracking
- **Key Fields**:
  - `entityType`: Type of data (pfa, organizations, asset_master, classifications)
  - `apiConfigId`: Which API provides the data
  - `organizationId`: null = global, set = org-specific override
  - `priority`: 1 = primary, 2+ = fallbacks
  - `isActive`: Enable/disable mappings without deletion
  - **Performance Metrics**:
    - `successCount` / `failureCount`: Track reliability
    - `avgResponseTime`: Monitor performance (milliseconds)
    - `lastSuccessAt` / `lastFailureAt`: Troubleshooting timestamps

**Migration**: `20251125120420_add_data_source_mapping`
- Created table with proper indexes
- Foreign key to `api_configurations` with CASCADE delete
- Unique constraint on `(entityType, organizationId, priority)`

### 2. Data Source Orchestrator Service

**File**: `backend/src/services/DataSourceOrchestrator.ts`

**Core Methods**:

```typescript
// Get active API for an entity type (org-specific or global)
getActiveDataSource(entityType, organizationId?): Promise<DataSourceInfo>

// Execute sync using configured mapping
executeSync(entityType, organizationId, syncType, syncId?): Promise<SyncProgress>

// Get fallback API if primary fails
getFallbackDataSource(entityType, organizationId, excludeApiId): Promise<DataSourceInfo>

// Record performance metrics after each sync
recordSyncMetrics(mappingId, success, responseTime): Promise<void>

// Get all mappings for an entity
getMappingsForEntity(entityType, organizationId?): Promise<DataSourceMapping[]>

// Get performance statistics
getMappingMetrics(mappingId): Promise<{
  successRate, failureRate, totalSyncs, avgResponseTime, ...
}>
```

**Fallback Logic**:
1. Attempt sync with priority 1 (primary) API
2. If failure, record metrics
3. Query for next priority mapping (priority > 1)
4. Attempt sync with fallback API
5. If success, record fallback metrics and return result
6. If fallback also fails, throw error

**Organization Override Logic**:
1. First check for org-specific mapping (`organizationId` = specific org)
2. If not found, fallback to global mapping (`organizationId` = null)
3. Returns highest priority (lowest priority number) active mapping

### 3. Updated Sync Controllers

**File**: `backend/src/controllers/pemsSyncController.ts`

**Changes** (3 locations updated):

```typescript
// BEFORE (hardcoded routing):
const syncPromise = entityType === 'organizations'
  ? pemsSyncService.syncOrganizationData(...)
  : pemsSyncService.syncPfaData(...);

// AFTER (configurable via orchestrator):
const orchestrator = new DataSourceOrchestrator();
const syncPromise = orchestrator.executeSync(entityType, organizationId, syncType, syncId);
```

**Locations Updated**:
1. `startSync()` - Single API sync endpoint (line ~124)
2. `syncGlobalApi()` - Batch sync across all orgs for one API (line ~427)
3. `syncOrgApis()` - Batch sync of all APIs for one org (line ~596)

### 4. Automatic Seeding

**File**: `backend/prisma/seed.ts` (lines 613-666)

**Seed Logic**:
- Queries all `ApiConfiguration` records with non-null `feeds`
- Parses `feeds` JSON to extract entity types
- Creates `DataSourceMapping` for each (entity, API) pair
- Uses `findFirst` instead of `findUnique` (Prisma null handling)
- Idempotent: skips existing mappings

**Default Mappings Created**:
| Entity Type | API | Priority | Status |
|------------|-----|----------|--------|
| `pfa` | PEMS - PFA Data (Read) | 1 | Active |
| `organizations` | PEMS - Organizations | 1 | Active |
| `asset_master` | PEMS - Asset Master | 1 | Active |
| `classifications` | PEMS - Classes & Categories | 1 | Active |

**Standalone Script**: `backend/seed-data-source-mappings.ts`
- Can be run independently: `npx tsx seed-data-source-mappings.ts`
- Displays detailed output with mapping summary

### 5. Documentation

**Architecture Document**: `backend/API-MAPPING-ARCHITECTURE.md`
- Complete system design with diagrams
- Implementation phases
- Database schema specifications
- Example scenarios (failover, testing, org overrides)
- Migration strategy
- Benefits analysis

**Updated Docs**:
- `backend/AUTO-SEED-README.md` - Added Data Source Mapping section
- `CLEANUP-SUMMARY.md` - Added architectural enhancement section

---

## 🏗️ Architecture Benefits

### ✅ Implemented

1. **Flexibility**: Swap APIs without code changes ✅
   - Mappings controlled via database
   - No deployment required to change data sources

2. **Reliability**: Automatic fallback to secondary APIs ✅
   - Orchestrator detects primary failure
   - Automatically attempts next priority mapping
   - Records metrics for both attempts

3. **Observability**: Track performance per mapping ✅
   - Success/failure rates
   - Average response times
   - Last used/success/failure timestamps

4. **Organization Overrides**: Org-specific mappings ✅
   - Global mappings as defaults
   - Orgs can override with custom APIs
   - Seamless fallback to global if no override

### ⏳ Pending (UI Required)

5. **UI Management**: Admin interface to configure mappings
   - View all entity types and their active APIs
   - Create/edit/delete mappings
   - Set priorities and active status
   - View performance metrics dashboard

---

## 🎯 Current System Behavior

### How Sync Works Now

**User Action**: Click "Sync Data" button in API Connectivity UI

**Flow**:
1. UI sends `POST /api/pems/sync` with `apiConfigId` and `organizationId`
2. Controller parses API's `feeds` to determine `entityType`
3. Controller calls `orchestrator.executeSync(entityType, organizationId, syncType)`
4. Orchestrator queries `DataSourceMapping` for active mapping:
   - First checks for org-specific mapping (if orgId provided)
   - Falls back to global mapping (organizationId = null)
5. Orchestrator executes sync using configured API:
   - Calls appropriate sync method based on entity type
   - `pfa` → `pemsSyncService.syncPfaData()`
   - `organizations` → `pemsSyncService.syncOrganizationData()`
6. On failure, orchestrator attempts fallback (if available)
7. Records performance metrics to `DataSourceMapping` table
8. Returns `SyncProgress` result to controller

### Example: Organization Sync

**Current Mapping** (from seed):
- Entity: `organizations`
- API: `pems-global-organizations`
- Priority: 1
- Status: Active

**Sync Execution**:
1. User clicks sync on Organizations API
2. Controller determines entity type = "organizations"
3. Orchestrator finds active mapping → `pems-global-organizations`
4. Orchestrator calls `pemsSyncService.syncOrganizationData()`
5. Sync fetches organizations from PEMS `/organization` endpoint
6. Upserts organizations to database (UPDATE existing, INSERT new)
7. Records metrics: `successCount++`, `lastSuccessAt = now()`, `avgResponseTime = 1250ms`

---

## 📊 Database State

### Current Tables

**`data_source_mappings`** (4 records):
```sql
SELECT entityType, priority, isActive FROM data_source_mappings ORDER BY entityType;

entityType        | priority | isActive
-----------------|----------|----------
asset_master     | 1        | true
classifications  | 1        | true
organizations    | 1        | true
pfa              | 1        | true
```

### Performance Metrics (Initially Empty)

```sql
SELECT
  entityType,
  successCount,
  failureCount,
  avgResponseTime
FROM data_source_mappings;

-- After first syncs, will show metrics like:
-- pfa              | 1  | 0  | 2340ms
-- organizations    | 1  | 0  | 1250ms
```

---

## 🚀 Next Steps

### Immediate: UI Components

**Priority 1: Read-Only Display**
Create `components/admin/DataSourceManager.tsx`:
- List all entity types
- Show active API for each entity
- Display basic metrics (last sync, success rate)

**Priority 2: Metrics Dashboard**
Create `components/admin/DataSourceMetrics.tsx`:
- Success/failure rates per mapping
- Average response times chart
- Last sync timestamps
- Reliability scores

**Priority 3: Management Interface**
Create `components/admin/DataSourceMappingForm.tsx`:
- Create new mappings
- Edit existing mappings
- Set priority and active status
- Organization-specific overrides
- Delete mappings

### Future Enhancements

1. **API Endpoints**: REST APIs for mapping CRUD operations
2. **Validation**: Ensure at least one active mapping per entity
3. **Alerts**: Notify admins when primary API fails repeatedly
4. **Historical Tracking**: Store sync attempt logs (not just counters)
5. **Multi-API Sync**: Allow syncing same entity from multiple sources (data merging)

---

## 🧪 Testing Guide

### Manual Testing

**Test 1: Verify Mappings Exist**
```bash
cd backend
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.dataSourceMapping.findMany({include:{apiConfig:true}}).then(console.log);
"
```

**Test 2: Test Organization Sync**
1. Login to frontend as admin
2. Navigate to Admin Dashboard → API Connectivity
3. Find "PEMS - Organizations" API
4. Click "Sync Data" button
5. Watch progress modal
6. Verify organizations populated in database

**Test 3: Check Metrics**
```bash
cd backend
npx tsx -e "
import { DataSourceOrchestrator } from './src/services/DataSourceOrchestrator';
const orch = new DataSourceOrchestrator();
const mappings = await orch.getMappingsForEntity('organizations');
for (const m of mappings) {
  const metrics = await orch.getMappingMetrics(m.id);
  console.log(m.entityType, metrics);
}
"
```

### Integration Testing

**Test Fallback Logic**:
1. Create two mappings for same entity (priority 1 and 2)
2. Temporarily break primary API (wrong credentials)
3. Trigger sync
4. Verify orchestrator automatically tries fallback
5. Check metrics recorded for both attempts

**Test Organization Override**:
1. Create global mapping (organizationId = null)
2. Create RIO-specific mapping (organizationId = RIO's ID)
3. Sync for RIO → should use RIO-specific mapping
4. Sync for PORTARTHUR → should use global mapping

---

## 📁 Files Modified/Created

### Created Files
- ✅ `backend/src/services/DataSourceOrchestrator.ts` (450 lines)
- ✅ `backend/seed-data-source-mappings.ts` (130 lines)
- ✅ `backend/prisma/migrations/20251125120420_add_data_source_mapping/migration.sql`
- ✅ `backend/API-MAPPING-ARCHITECTURE.md` (comprehensive design doc)
- ✅ `DATA-SOURCE-MAPPING-IMPLEMENTATION.md` (this file)

### Modified Files
- ✅ `backend/prisma/schema.prisma` - Added `DataSourceMapping` model
- ✅ `backend/src/controllers/pemsSyncController.ts` - 3 locations updated to use orchestrator
- ✅ `backend/prisma/seed.ts` - Integrated data source mapping seeding
- ✅ `backend/AUTO-SEED-README.md` - Added mapping documentation
- ✅ `CLEANUP-SUMMARY.md` - Added architectural enhancement section

---

## 🎓 Key Learnings

### Design Patterns Used

1. **Orchestrator Pattern**: DataSourceOrchestrator coordinates between mappings and sync services
2. **Strategy Pattern**: Different sync methods selected based on entity type
3. **Chain of Responsibility**: Fallback logic tries APIs in priority order
4. **Metrics Tracking**: Built-in observability for operational insights

### Database Design Decisions

1. **Unique Constraint on (entityType, organizationId, priority)**:
   - Prevents duplicate mappings at same priority level
   - Allows multiple mappings for same entity (different priorities)
   - Supports both global and org-specific mappings

2. **Null organizationId for Global Mappings**:
   - Prisma requires `findFirst` instead of `findUnique` for nullable fields
   - Enables shared default behavior across all organizations

3. **Performance Metrics in Same Table**:
   - Keeps related data together
   - Simplifies queries (no joins required)
   - Atomic updates for metrics

---

**Implementation Date**: 2025-11-25
**Status**: Backend Complete, UI Pending
**Next Phase**: Admin UI Components
