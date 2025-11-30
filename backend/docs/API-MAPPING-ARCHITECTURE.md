# API-to-Data Mapping Architecture

## Problem Statement

**Current Issue**: The system has tight coupling between API configurations and sync functionality. The sync service uses hardcoded logic to determine which sync method to call based on API usage type.

**Business Need**: Administrators need the ability to:
1. Discontinue an API without breaking functionality
2. Add alternative APIs for the same data entity
3. Manage which API is active for each data type
4. Configure fallback/backup APIs
5. Track API performance and reliability per entity type

## Proposed Solution

A **configurable API-to-Entity mapping system** with UI-based management that decouples data entities from specific API implementations.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin UI                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Data Source Management                              │  │
│  │  - Configure which API provides which entity         │  │
│  │  - Set active/inactive status                        │  │
│  │  - Configure priority/fallback order                 │  │
│  │  - View performance metrics per entity               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Data Source Mapping Table                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  entityType  │ apiConfigId │ priority │ isActive    │  │
│  ├──────────────┼─────────────┼──────────┼─────────────┤  │
│  │  pfa         │ pems-read   │    1     │   true      │  │
│  │  pfa         │ alt-api-1   │    2     │   false     │  │
│  │  organizations│ pems-orgs  │    1     │   true      │  │
│  │  asset_master│ pems-assets │    1     │   true      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Sync Orchestrator                          │
│  - Queries active mapping for entity type                   │
│  - Calls appropriate sync service method                    │
│  - Handles fallback to secondary APIs on failure            │
│  - Tracks success/failure metrics per mapping               │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Sync Service Methods                        │
│  - syncPfaData()                                            │
│  - syncOrganizationData()                                   │
│  - syncAssetData()                                          │
│  - syncClassificationData()                                 │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### New Table: `DataSourceMapping`

Maps data entities to API configurations with priority and status tracking.

```prisma
model DataSourceMapping {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Entity Definition
  entityType      String   // 'pfa', 'organizations', 'asset_master', 'classifications'
  organizationId  String?  // null = global, set = org-specific override

  // API Configuration Reference
  apiConfigId     String
  apiConfig       ApiConfiguration @relation(fields: [apiConfigId], references: [id], onDelete: Cascade)

  // Priority & Status
  priority        Int      @default(1)  // 1 = primary, 2+ = fallbacks
  isActive        Boolean  @default(true)

  // Performance Tracking
  lastUsedAt      DateTime?
  lastSuccessAt   DateTime?
  lastFailureAt   DateTime?
  successCount    Int      @default(0)
  failureCount    Int      @default(0)
  avgResponseTime Int?     // milliseconds

  // Unique constraint: one active mapping per entity per org
  @@unique([entityType, organizationId, priority])
  @@index([entityType, isActive, priority])
  @@index([apiConfigId])
}
```

### Updated Table: `ApiConfiguration`

No structural changes, but usage clarification:

- `feeds` field defines **what data this API can provide** (capabilities)
- `DataSourceMapping` table defines **which API is actively used** (configuration)

## Entity Types (Standardized)

The system recognizes these standard entity types:

| Entity Type | Description | Sync Method | Related Table |
|------------|-------------|-------------|---------------|
| `pfa` | Plan/Forecast/Actual records | `syncPfaData()` | `PfaRecord` |
| `organizations` | Organization master data | `syncOrganizationData()` | `Organization` |
| `asset_master` | Equipment asset catalog | `syncAssetData()` | `AssetMaster` |
| `classifications` | Category/class taxonomy | `syncClassificationData()` | `Classification` |

## Implementation Plan

### Phase 1: Database Schema (Current Priority)

1. Add `DataSourceMapping` model to Prisma schema
2. Create migration for new table
3. Seed initial mappings based on current API configurations
4. Add relation to `ApiConfiguration` model

### Phase 2: Sync Orchestrator Service

Create `DataSourceOrchestrator` service that:

```typescript
class DataSourceOrchestrator {
  /**
   * Get the active API configuration for an entity type
   * @param entityType - The entity type to sync
   * @param organizationId - Optional org ID for org-specific overrides
   * @returns The highest priority active API config
   */
  async getActiveDataSource(
    entityType: string,
    organizationId?: string
  ): Promise<ApiConfiguration | null>

  /**
   * Execute sync using the active data source
   * @param entityType - The entity type to sync
   * @param organizationId - Target organization
   * @param syncType - 'full' or 'incremental'
   * @returns Sync progress result
   */
  async executeSync(
    entityType: string,
    organizationId: string,
    syncType: 'full' | 'incremental'
  ): Promise<SyncProgress>

  /**
   * Record sync metrics for a mapping
   * @param mappingId - The data source mapping ID
   * @param success - Whether sync succeeded
   * @param responseTime - Sync duration in ms
   */
  async recordSyncMetrics(
    mappingId: string,
    success: boolean,
    responseTime: number
  ): Promise<void>

  /**
   * Get fallback API if primary fails
   * @param entityType - The entity type
   * @param organizationId - Optional org ID
   * @param excludeApiId - API ID that failed (skip this one)
   */
  async getFallbackDataSource(
    entityType: string,
    organizationId: string | null,
    excludeApiId: string
  ): Promise<ApiConfiguration | null>
}
```

### Phase 3: Update Sync Controllers

Refactor `pemsSyncController.ts` to use orchestrator:

```typescript
// Before (hardcoded):
if (entityType === 'organizations') {
  syncPromise = pemsSyncService.syncOrganizationData(...);
} else {
  syncPromise = pemsSyncService.syncPfaData(...);
}

// After (configurable):
const orchestrator = new DataSourceOrchestrator();
syncPromise = orchestrator.executeSync(entityType, organizationId, syncType);
```

### Phase 4: Admin UI Components

Create new admin components:

1. **DataSourceManager.tsx**
   - List all entity types
   - Show active API for each entity
   - Configure primary/fallback APIs
   - View performance metrics

2. **DataSourceMappingForm.tsx**
   - Select entity type
   - Choose API configuration
   - Set priority and status
   - Organization-specific overrides

3. **DataSourceMetrics.tsx**
   - Success/failure rates per mapping
   - Average response times
   - Last sync timestamps
   - Reliability scores

## Migration Strategy

### Step 1: Create Mappings from Existing Feeds

Run migration script to create initial mappings:

```typescript
// For each ApiConfiguration with feeds:
const configs = await prisma.apiConfiguration.findMany({
  where: { feeds: { not: null } }
});

for (const config of configs) {
  const feeds = JSON.parse(config.feeds);
  for (const feed of feeds) {
    await prisma.dataSourceMapping.create({
      data: {
        entityType: feed.entity,
        apiConfigId: config.id,
        organizationId: config.organizationId,
        priority: 1,
        isActive: true
      }
    });
  }
}
```

### Step 2: Backward Compatibility

Keep existing sync logic working during transition:

1. Check if DataSourceMapping exists for entity
2. If yes, use orchestrator (new path)
3. If no, fall back to feeds-based routing (old path)
4. Log deprecation warnings for old path usage

### Step 3: Full Cutover

Once all mappings are configured:

1. Remove feeds-based routing logic
2. Make DataSourceMapping required for syncs
3. Update documentation

## Benefits

1. **Flexibility**: Swap APIs without code changes
2. **Reliability**: Automatic fallback to secondary APIs
3. **Observability**: Track performance per data source
4. **Multi-tenancy**: Organization-specific overrides
5. **Future-proof**: Easy to add new entity types and APIs

## Example Scenarios

### Scenario 1: Primary API Failure

Current active mapping:
- Entity: `pfa`
- API: `pems-pfa-read` (priority 1, active)
- Fallback: `alternative-pfa-api` (priority 2, active)

Sync flow:
1. User clicks "Sync Data" for PFA entity
2. Orchestrator queries for active mapping (priority 1)
3. Tries `pems-pfa-read` API
4. API returns 500 error
5. Orchestrator records failure metrics
6. Orchestrator queries for fallback (priority 2)
7. Tries `alternative-pfa-api`
8. Success - data synced
9. Admin receives notification about primary API failure

### Scenario 2: Testing New API

Admin wants to test a new PFA data source:

1. Add new `ApiConfiguration` for the test API
2. Create `DataSourceMapping`:
   - Entity: `pfa`
   - API: `new-test-api`
   - Priority: 3
   - isActive: false (testing only)
3. In UI, manually trigger sync with this specific mapping
4. Review metrics and results
5. If successful, set isActive: true and priority: 1
6. Set old API to priority: 2 (fallback)

### Scenario 3: Organization-Specific Override

RIO project wants to use a different asset API than PORTARTHUR:

1. Create global mapping (default for all orgs):
   - Entity: `asset_master`
   - API: `pems-assets`
   - organizationId: null
   - Priority: 1

2. Create RIO-specific override:
   - Entity: `asset_master`
   - API: `rio-custom-asset-api`
   - organizationId: `rio-org-id`
   - Priority: 1

Sync behavior:
- When RIO syncs: Uses `rio-custom-asset-api`
- When PORTARTHUR syncs: Uses global `pems-assets`

## Next Steps

1. ✅ Document architecture (this file)
2. ⏳ Implement Prisma schema updates
3. ⏳ Create migration script
4. ⏳ Seed initial mappings
5. ⏳ Implement DataSourceOrchestrator service
6. ⏳ Refactor sync controllers
7. ⏳ Build admin UI components
8. ⏳ Test end-to-end flows
9. ⏳ Update documentation

---

**Created**: 2025-11-25
**Status**: Design Phase
**Owner**: Development Team
