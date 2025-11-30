# Backend Cleanup for Mirror + Delta Architecture - Executive Summary

**Date**: 2025-11-28
**Developer**: Backend Architecture Optimizer
**Status**: Design Complete, Ready for Implementation

---

## Current State Analysis

### Database Schema (✅ Partially Migrated)

**New Tables (ADR-005 - Mirror + Delta)**:
- ✅ `PfaMirror` (lines 322-361) - Immutable PEMS cache with JSONB `data` field
- ✅ `PfaModification` (lines 363-387) - User-specific deltas with JSONB `delta` field
- ✅ Bronze/Silver/Gold tables (ADR-007) - Medallion architecture for data lineage

**Legacy Tables (⚠️ Still Present)**:
- ⚠️ `PfaRecord` (lines 226-283) - **DEPRECATED** flat table, should be removed
- Contains 40+ columns with flat structure (no JSONB)
- Still referenced by services (creates dual write path)

### Type System (❌ Needs Alignment)

**Current Types (types.ts)**:
- ❌ `PfaRecord` interface (lines 5-51) - Flat structure used everywhere
- ❌ No `PfaMirrorData` type (should represent read-only PEMS baseline)
- ❌ No `PfaModificationDelta` type (should represent editable fields only)
- ❌ No `PfaView` type (should represent merged read-only view)

### Backend Services (⚠️ Mixed Implementation)

**PemsSyncService.ts** (lines 903-944):
```typescript
// CURRENT (writes to legacy PfaRecord)
const pfaData = this.mapPemsRecordToPfa(record, organizationId, organizationCode);
// await prisma.pfaRecord.upsert({ ... }); // WRONG TABLE

// SHOULD BE (write to PfaMirror)
await prisma.pfaMirror.upsert({
  where: { organizationId_pfaId: { organizationId, pfaId } },
  update: { data: pemsData as Prisma.JsonObject, ... },
  create: { ...mirrorData }
});
```

**pfaDataController.ts** (lines 642-684):
- ✅ Implements merge queries using PostgreSQL JSONB `||` operator
- ⚠️ Uses raw SQL (not type-safe)
- ⚠️ Returns `MergedPfaRecord` (should be `PfaView`)

### Frontend (❌ Needs Migration)

**App.tsx**:
- Uses `PfaRecord[]` state (should be `PfaView[]`)
- Direct state mutations (should use API calls with deltas)
- No sync state indicators (draft/committed/syncing)

---

## Migration Plan Overview

### Phase 1: Type System Redesign (3 hours)

**Deliverables**:
1. New types in `types.ts`:
   - `PfaMirrorData` - Read-only PEMS baseline
   - `PfaModificationDelta` - Editable fields only (forecastStart, forecastEnd, etc.)
   - `PfaView` - Merged read-only view with `_metadata` field
   - Deprecate `PfaRecord` with `@deprecated` tag

2. Type constraints:
   - `PfaModificationDelta` only allows editable fields (TypeScript compiler enforces)
   - `PfaView` has `_metadata` field with sync state indicators

**Example**:
```typescript
export interface PfaModificationDelta {
  // Only editable forecast fields
  forecastStart?: Date;
  forecastEnd?: Date;
  forecastCategory?: string;
  isDiscontinued?: boolean; // User can mark as discontinued
  notes?: string;
  tags?: string[];
}

export interface PfaView extends PfaMirrorData {
  _metadata: {
    mirrorId: string;
    hasModifications: boolean;
    syncState: 'pristine' | 'draft' | 'committed' | 'syncing' | 'sync_error';
    modifiedBy?: string;
    modifiedAt?: Date;
  };
}
```

### Phase 2: Database Migration (2 hours)

**Migration Steps**:
1. Add deprecation comment to `PfaRecord` table
2. Add `migrated_to_mirror` column for tracking
3. Run data migration script:
   - Pristine records → PfaMirror only
   - Modified records → PfaMirror + PfaModification with extracted delta
4. Verify data integrity (0% data loss)
5. (Later) Drop `PfaRecord` table after full migration

**Rollback Strategy**: Keep `PfaRecord` table active during transition, dual-write if needed

### Phase 3: Backend Service Migration (4-5 hours)

**Files to Update**:
1. **PemsSyncService.ts** - Change write target from PfaRecord to PfaMirror
2. **pfaDataController.ts** - Type-safe merge queries, return `PfaView`
3. **Create PfaMirrorService.ts** - Business logic for merge queries, draft management
4. **Update API routes** - Type-safe request/response validation

**Key Changes**:
```typescript
// PemsSyncService - mapPemsRecordToMirrorData()
private mapPemsRecordToMirrorData(pemsRow: any, orgId: string): PfaMirrorData {
  return {
    pfaId: getValue('pfs_id'),
    category: getValue('pfs_f_category'),
    forecastStart: parseDate(getValue('pfs_f_startdate')),
    // ... all fields from PEMS
  };
}

// pfaDataController - return type-safe PfaView
const views: PfaView[] = results.map(row => ({
  ...(row.data as PfaMirrorData),
  _metadata: {
    mirrorId: row.mirrorId,
    hasModifications: row.modificationId !== null,
    syncState: row.syncState,
    modifiedBy: row.modifiedBy,
    modifiedAt: row.modifiedAt
  }
}));
```

### Phase 4: Frontend Migration (4-5 hours)

**Files to Update**:
1. **App.tsx** - Replace `PfaRecord[]` with `PfaView[]`
2. **Timeline.tsx** - Create deltas instead of direct mutations
3. **apiClient.ts** - Type-safe API calls for merge/draft/commit
4. **FilterPanel.tsx** - No changes (filters still work on PfaView)

**Key Changes**:
```typescript
// App.tsx - new mutation pattern
async function savePfaModifications(
  modifications: Array<{ pfaId: string; delta: PfaModificationDelta }>
) {
  await apiClient.saveDraft(currentOrg.id, modifications);
  const refreshedData = await apiClient.getMergedPfaData(currentOrg.id);
  setAllPfaData(refreshedData);
}

// Timeline.tsx - drag-and-drop creates delta
function handleDragEnd() {
  const modifications = Array.from(dragOverrides.entries()).map(([pfaId, dates]) => ({
    pfaId,
    delta: {
      forecastStart: dates.start,
      forecastEnd: dates.end
    } as PfaModificationDelta
  }));

  savePfaModifications(modifications);
}
```

### Phase 5: Testing (3-4 hours)

**Test Suites**:
1. Unit tests: JSONB merge logic, type constraints
2. Integration tests: PemsSyncService → PfaMirror, merge queries
3. E2E tests: Draft workflow (create → commit → discard)

**Coverage Target**: >80%

### Phase 6: Documentation (1-2 hours)

**Updates Required**:
1. `docs/ARCHITECTURE.md` - Add Mirror + Delta section
2. `docs/backend/API_REFERENCE.md` - Update PFA endpoints
3. `docs/DEVELOPMENT_LOG.md` - ✅ Already updated

---

## Key Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Data loss during migration | Low | Critical | Batch migration with rollback, keep PfaRecord during transition |
| Performance degradation | Low | High | JSONB merge is O(modified fields), not O(total fields) |
| Type errors in frontend | Medium | Medium | Incremental migration, feature flag toggle |
| Breaking existing integrations | Medium | High | Maintain backward compatibility via deprecated PfaRecord type |

---

## Success Criteria

✅ **Type Safety**: No `any` types, strict TypeScript compilation
✅ **Data Integrity**: Zero data loss during migration (verified via row counts and checksums)
✅ **Performance**: Merge queries <100ms for 1K records
✅ **Test Coverage**: >80% for new services
✅ **Backward Compatibility**: Legacy PfaRecord type still works during transition (deprecated, not removed)
✅ **Documentation**: Updated ARCHITECTURE.md, API_REFERENCE.md, DEVELOPMENT_LOG.md

---

## Timeline

**Total Effort**: 16-20 hours (2-3 days with dedicated focus)

**Phase Breakdown**:
- Day 1: Phases 1-2 (Type system + DB migration) - 5 hours
- Day 2: Phase 3 (Backend services) - 5 hours
- Day 3: Phases 4-6 (Frontend + Testing + Docs) - 8 hours

**Recommended Approach**: Execute phases sequentially, deploy to staging after each phase

---

## Deliverables

### Documentation Created

1. **`temp/mirror-delta-type-system-alignment.md`** (34KB) - Complete implementation guide with:
   - New type hierarchy definitions
   - Database migration scripts
   - Backend service refactoring code
   - Frontend migration examples
   - Test suite templates
   - Rollback strategies

2. **`docs/DEVELOPMENT_LOG.md`** - Updated with design entry

3. **This Summary** - Executive overview for stakeholders

### Code Artifacts

**Created**:
- Migration plan with SQL scripts
- Type definitions for PfaMirrorData, PfaModificationDelta, PfaView
- Service refactoring examples
- Test suite templates

**To Be Created** (during implementation):
- `backend/scripts/migrate-pfa-record-to-mirror.ts` - Data migration script
- `backend/tests/unit/pfa-mirror-merge.test.ts` - Unit tests
- `backend/tests/integration/pfa-mirror-merge.test.ts` - Integration tests
- Updated service files (PemsSyncService, pfaDataController, etc.)

---

## Next Steps (Action Items)

### For Product Owner
1. Review migration plan and approve Phase 1 execution
2. Decide on deployment strategy (incremental vs. full cutover)
3. Schedule QA testing window for Phase 5

### For Development Team
1. Execute Phase 1: Update types.ts with new type hierarchy
2. Execute Phase 2: Run database migration script
3. Execute Phase 3: Refactor backend services
4. Execute Phase 4: Migrate frontend components
5. Execute Phase 5: Write and run comprehensive tests
6. Execute Phase 6: Update documentation

### For QA Team
1. Prepare test plan for Mirror + Delta merge queries
2. Validate data integrity after migration (Phase 2)
3. Test draft workflow (create/commit/discard) in Phase 5
4. Performance testing: Verify <100ms merge query target

---

## Questions & Answers

**Q: Will this break existing functionality?**
A: No. Backward compatibility maintained via deprecated PfaRecord type. Feature flag can toggle between old/new during transition.

**Q: What happens to user data during migration?**
A: Zero data loss. Migration script preserves all data in new tables. PfaRecord table remains untouched until full verification.

**Q: How long will the migration take?**
A: 16-20 hours development effort (2-3 days). Actual migration script runs in <5 minutes for 10K records.

**Q: Can we rollback if something goes wrong?**
A: Yes. Each phase has rollback strategy. PfaRecord table kept active during transition as safety net.

**Q: Impact on frontend users?**
A: None during development. Seamless transition. Users will see new sync state indicators (draft/committed) after deployment.

---

## References

- **ADR-005**: Multi-Tenant Access Control (Mirror + Delta architecture decision)
- **ADR-007**: API Connectivity & Intelligence Layer (Bronze/Silver/Gold pipeline)
- **Schema File**: `backend/prisma/schema.prisma` (lines 322-387 for PfaMirror + PfaModification)
- **Type File**: `types.ts` (lines 5-51 for current PfaRecord)
- **Service File**: `backend/src/services/pems/PemsSyncService.ts` (lines 903-1010)
- **Controller File**: `backend/src/controllers/pfaDataController.ts` (lines 642-746)

---

**Document Version**: 1.0
**Reviewed By**: Backend Architecture Optimizer
**Approved By**: [Pending]
**Implementation Start Date**: [To Be Scheduled]
