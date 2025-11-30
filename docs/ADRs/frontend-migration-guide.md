# Frontend Migration Guide: PfaRecord → PfaView

**Status**: Ready for Implementation
**Estimated Effort**: 4-5 hours
**Complexity**: Medium (Type updates + delta-based logic)

---

## Overview

This guide provides step-by-step instructions for migrating frontend components from the legacy `PfaRecord` type to the new `PfaView` type (Mirror + Delta architecture).

**Key Changes**:
- State management: `PfaRecord[]` → `PfaView[]`
- Modifications: Direct state mutation → `PfaModificationDelta` objects
- API calls: `apiClient.saveDraft()` now uses delta-based approach

---

## Phase 6.1: App.tsx Updates

### 1. Import Updates ✅ (Already Done)

```typescript
// ✅ ALREADY UPDATED
import {
  PfaRecord,      // Keep for backward compatibility
  PfaView,        // New type for merged views
  PfaModificationDelta  // For creating user modifications
} from './types';
```

### 2. Helper Function Updates

**Location**: `App.tsx` lines 136-155

**Current**:
```typescript
const cloneAssets = (assets: PfaRecord[]): PfaRecord[] => {
    return assets.map(a => ({
        ...a,
        originalStart: new Date(a.originalStart),
        originalEnd: new Date(a.originalEnd),
        forecastStart: new Date(a.forecastStart),
        forecastEnd: new Date(a.forecastEnd),
        actualStart: new Date(a.actualStart),
        actualEnd: new Date(a.actualEnd)
    }));
};
```

**Updated**: ✅ (Already Done)
```typescript
const cloneAssets = (assets: (PfaRecord | PfaView)[]): (PfaRecord | PfaView)[] => {
    return assets.map(a => ({
        ...a,
        originalStart: new Date(a.originalStart),
        originalEnd: new Date(a.originalEnd),
        forecastStart: new Date(a.forecastStart),
        forecastEnd: new Date(a.forecastEnd),
        actualStart: new Date(a.actualStart),
        actualEnd: new Date(a.actualEnd),
        // Clone _metadata if it exists (PfaView)
        _metadata: (a as any)._metadata ? {
            ...(a as any)._metadata,
            modifiedAt: (a as any)._metadata.modifiedAt ? new Date((a as any)._metadata.modifiedAt) : undefined
        } : undefined
    }));
};
```

### 3. State Declarations

**Location**: `App.tsx` lines 240-246

**Current**:
```typescript
// Phase 4: API-backed state (replaces mockData.ts)
const allPfaRef = useRef<PfaRecord[]>([]);
const baselinePfaRef = useRef<PfaRecord[]>([]);
const [visiblePfaRecords, setVisiblePfaRecords] = useState<PfaRecord[]>([]);
const [visibleBaselinePfaRecords, setVisibleBaselinePfaRecords] = useState<PfaRecord[]>([]);
```

**Update To**:
```typescript
// Phase 5: Mirror + Delta architecture (PfaView = PfaMirror merged with PfaModification)
const allPfaRef = useRef<PfaView[]>([]);
const baselinePfaRef = useRef<PfaView[]>([]);
const [visiblePfaRecords, setVisiblePfaRecords] = useState<PfaView[]>([]);
const [visibleBaselinePfaRecords, setVisibleBaselinePfaRecords] = useState<PfaView[]>([]);
```

### 4. History Stack

**Location**: `App.tsx` lines 281-283

**Current**:
```typescript
const historyRef = useRef<PfaRecord[][]>([]);
const futureRef = useRef<PfaRecord[][]>([]);
```

**Update To**:
```typescript
const historyRef = useRef<PfaView[][]>([]);
const futureRef = useRef<PfaView[][]>([]);
```

### 5. Update Functions Signature

**Location**: `App.tsx` line 866

**Current**:
```typescript
const updatePfaRecords = (fn: (assets: PfaRecord[]) => PfaRecord[]) => {
  const before = allPfaRef.current;
  const after = fn(allPfaRef.current);
  // ...
};
```

**Update To**:
```typescript
const updatePfaRecords = (fn: (assets: PfaView[]) => PfaView[]) => {
  const before = allPfaRef.current;
  const after = fn(allPfaRef.current);
  // ...
};
```

### 6. Data Fetching (usePfaData Hook)

**Location**: Check `hooks/usePfaData.ts` or wherever data is fetched

**Expected Response Format**:
```typescript
// Backend now returns:
{
  success: true,
  data: PfaView[],  // Each item has _metadata field
  pagination: { page, pageSize, totalRecords, totalPages },
  metadata: { queryTime }
}

// Example PfaView object:
{
  pfaId: "PFA-001",
  forecastStart: Date,
  forecastEnd: Date,
  // ... all PfaMirrorData fields
  _metadata: {
    mirrorId: "uuid",
    hasModifications: true,
    syncState: "draft",  // or "pristine", "committed", "syncing", "sync_error"
    modifiedBy: "userId",
    modifiedAt: Date,
    modificationId: "uuid"
  }
}
```

**Update usePfaData Hook**:
```typescript
// hooks/usePfaData.ts
export const usePfaData = (organizationId: string) => {
  const [data, setData] = useState<PfaView[]>([]);  // Changed from PfaRecord[]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiClient.getPfaData(organizationId);
        setData(response.data);  // response.data is PfaView[]
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId]);

  return { data, loading, error };
};
```

### 7. Draft Modifications (Delta-Based)

**Location**: Anywhere PFA modifications are saved (drag-and-drop, bulk operations, etc.)

**Before (Direct State Mutation)**:
```typescript
// OLD APPROACH - Direct mutation
const handleDragEnd = () => {
  updatePfaRecords(prev =>
    prev.map(pfa =>
      pfa.id === draggedId
        ? { ...pfa, forecastStart: newStart, forecastEnd: newEnd }
        : pfa
    )
  );
};
```

**After (Delta-Based with API Call)**:
```typescript
// NEW APPROACH - Create delta and call API
const handleDragEnd = async () => {
  const modifications = [{
    pfaId: draggedPfaId,
    delta: {
      forecastStart: newStart,
      forecastEnd: newEnd
    } as PfaModificationDelta,
    changeReason: "Drag-and-drop timeline adjustment"
  }];

  // Save draft to backend
  await apiClient.saveDraft(
    currentOrg.id,
    sessionId,  // UUID for grouping related changes
    modifications
  );

  // Refresh data to get updated PfaView with new _metadata
  const response = await apiClient.getPfaData(currentOrg.id);
  allPfaRef.current = response.data;
  setDataVersion(v => v + 1);  // Trigger re-render
};
```

### 8. Displaying Sync State

**Add Sync State Indicators**:
```typescript
// In any component displaying PFA records
const getSyncStateColor = (syncState: string) => {
  switch (syncState) {
    case 'pristine': return 'border-gray-300';
    case 'draft': return 'border-yellow-500';  // Unsaved changes
    case 'committed': return 'border-blue-500';  // Ready to sync to PEMS
    case 'syncing': return 'border-purple-500 animate-pulse';  // In progress
    case 'sync_error': return 'border-red-500';  // Failed
    default: return 'border-gray-300';
  }
};

// Use in JSX
<div className={`pfa-card ${getSyncStateColor(pfa._metadata.syncState)}`}>
  {/* PFA card content */}
  {pfa._metadata.hasModifications && (
    <span className="text-xs text-yellow-600">
      Modified by {pfa._metadata.modifiedBy}
    </span>
  )}
</div>
```

---

## Phase 6.2: Timeline.tsx Updates

**Location**: `components/Timeline.tsx`

### 1. Props Type Update

**Current**:
```typescript
interface TimelineProps {
  pfaRecords: PfaRecord[];
  // ...
}
```

**Update To**:
```typescript
interface TimelineProps {
  pfaRecords: PfaView[];
  // ...
}
```

### 2. Bar Rendering with Sync State

**Add Visual Indicators**:
```typescript
const renderBar = (pfa: PfaView, layer: 'plan' | 'forecast' | 'actual') => {
  const isDraft = pfa._metadata.syncState === 'draft';
  const isCommitted = pfa._metadata.syncState === 'committed';
  const isError = pfa._metadata.syncState === 'sync_error';

  return (
    <div
      className={cn(
        'pfa-bar',
        // Base color for layer
        layer === 'plan' && 'bg-blue-200',
        layer === 'forecast' && 'bg-green-200',
        layer === 'actual' && 'bg-orange-200',
        // Sync state border
        isDraft && 'border-2 border-yellow-500 shadow-yellow-200',
        isCommitted && 'border-2 border-blue-500 shadow-blue-200',
        isError && 'border-2 border-red-500 shadow-red-200'
      )}
      title={`${pfa.pfaId} - ${pfa._metadata.syncState}`}
    >
      {/* Bar content */}
      {isDraft && (
        <span className="absolute top-0 right-0 w-2 h-2 bg-yellow-500 rounded-full" />
      )}
    </div>
  );
};
```

### 3. Drag-and-Drop Handler

**Update to Use Delta**:
```typescript
const handleBarDragEnd = (pfaId: string, newDates: { start: Date; end: Date }) => {
  const delta: PfaModificationDelta = {
    forecastStart: newDates.start,
    forecastEnd: newDates.end
  };

  onUpdateAssets([{ pfaId, delta, changeReason: "Timeline drag-and-drop" }]);
};
```

---

## Phase 6.3: MatrixView.tsx Updates

**Location**: `components/MatrixView.tsx`

### 1. Props Type Update

```typescript
interface MatrixViewProps {
  pfaRecords: PfaView[];  // Changed from PfaRecord[]
  // ...
}
```

### 2. Cell Rendering

**Access metadata for visual cues**:
```typescript
const renderCell = (pfa: PfaView, month: number) => {
  const isDraft = pfa._metadata.hasModifications;

  return (
    <div className={cn(
      'matrix-cell',
      isDraft && 'bg-yellow-50 border-yellow-300'
    )}>
      {/* Cell content */}
    </div>
  );
};
```

---

## Phase 6.4: GridLab.tsx Updates

**Location**: `components/GridLab.tsx`

### 1. Props Type Update

```typescript
interface GridLabProps {
  pfaRecords: PfaView[];  // Changed from PfaRecord[]
  // ...
}
```

### 2. Add Sync State Column

**Add new column definition**:
```typescript
const columns: GridColumn[] = [
  { id: 'pfaId', label: 'PFA ID', visible: true, width: 100 },
  // ... existing columns
  {
    id: 'syncState',
    label: 'Sync State',
    visible: true,
    width: 120,
    render: (pfa: PfaView) => (
      <span className={cn(
        'px-2 py-1 rounded text-xs font-medium',
        pfa._metadata.syncState === 'pristine' && 'bg-gray-100 text-gray-700',
        pfa._metadata.syncState === 'draft' && 'bg-yellow-100 text-yellow-700',
        pfa._metadata.syncState === 'committed' && 'bg-blue-100 text-blue-700',
        pfa._metadata.syncState === 'syncing' && 'bg-purple-100 text-purple-700',
        pfa._metadata.syncState === 'sync_error' && 'bg-red-100 text-red-700'
      )}>
        {pfa._metadata.syncState}
      </span>
    )
  }
];
```

---

## Phase 6.5: CommandDeck.tsx Updates

**Location**: `components/CommandDeck.tsx`

### 1. Props Type Update

```typescript
interface CommandDeckProps {
  pfaRecords: PfaView[];  // Changed from PfaRecord[]
  selectedIds: string[];
  onUpdateAssets: (modifications: Array<{ pfaId: string; delta: PfaModificationDelta }>) => void;
  // ...
}
```

### 2. Bulk Operations

**Update bulk operations to use delta**:
```typescript
// BEFORE
const handleBulkShiftDates = (days: number) => {
  onUpdateAssets(
    selectedIds.map(id => {
      const pfa = pfaRecords.find(p => p.id === id);
      return {
        id,
        forecastStart: addDays(pfa.forecastStart, days),
        forecastEnd: addDays(pfa.forecastEnd, days)
      };
    })
  );
};

// AFTER
const handleBulkShiftDates = (days: number) => {
  const modifications = selectedIds.map(pfaId => {
    const pfa = pfaRecords.find(p => p.pfaId === pfaId);
    return {
      pfaId,
      delta: {
        forecastStart: addDays(new Date(pfa.forecastStart), days),
        forecastEnd: addDays(new Date(pfa.forecastEnd), days)
      } as PfaModificationDelta,
      changeReason: `Bulk shift: +${days} days`
    };
  });

  onUpdateAssets(modifications);
};
```

---

## Phase 6.6: Testing Checklist

### Unit Tests
- [ ] `cloneAssets()` properly clones PfaView with _metadata
- [ ] State updates use PfaView type
- [ ] Delta objects only contain editable fields

### Integration Tests
- [ ] Drag-and-drop creates proper PfaModificationDelta
- [ ] API calls use correct payload format
- [ ] Sync state indicators render correctly
- [ ] Bulk operations create valid deltas

### E2E Tests
- [ ] Timeline drag-and-drop workflow
  1. Drag a PFA bar
  2. Verify yellow border (draft state)
  3. Commit changes
  4. Verify blue border (committed state)
- [ ] Bulk operations workflow
  1. Select multiple PFAs
  2. Shift dates by 30 days
  3. Verify all have draft state
  4. Discard changes
  5. Verify return to pristine state

---

## Migration Checklist

**Phase 6.1: App.tsx**
- [✅] Import PfaView and PfaModificationDelta
- [✅] Update cloneAssets function
- [ ] Update state declarations (allPfaRef, baselinePfaRef, visiblePfaRecords)
- [ ] Update historyRef type
- [ ] Update updatePfaRecords signature
- [ ] Update data fetching to handle PfaView response
- [ ] Convert drag-and-drop to delta-based approach
- [ ] Add sync state display logic

**Phase 6.2: Timeline.tsx**
- [ ] Update props type to PfaView[]
- [ ] Add sync state visual indicators (borders, badges)
- [ ] Update drag-and-drop handler to create deltas
- [ ] Add draft/committed state tooltips

**Phase 6.3: MatrixView.tsx**
- [ ] Update props type to PfaView[]
- [ ] Add sync state visual cues to cells
- [ ] Update cell calculations if needed

**Phase 6.4: GridLab.tsx**
- [ ] Update props type to PfaView[]
- [ ] Add "Sync State" column
- [ ] Add modified by / modified at columns (from _metadata)

**Phase 6.5: CommandDeck.tsx**
- [ ] Update props type to PfaView[]
- [ ] Convert bulk operations to delta-based approach
- [ ] Add change reason to bulk operations

**Phase 6.6: FilterPanel.tsx**
- [ ] Update type references if needed
- [ ] Add sync state filter option

**Phase 6.7: Testing**
- [ ] Run TypeScript compiler: `npm run type-check`
- [ ] Manual testing: Drag-and-drop
- [ ] Manual testing: Bulk operations
- [ ] Manual testing: Commit/discard workflow
- [ ] E2E tests: Full modification lifecycle

---

## Common Issues & Solutions

### Issue 1: "Property '_metadata' does not exist"

**Solution**: Ensure you're using PfaView type, not PfaRecord:
```typescript
// ❌ Wrong
const pfa: PfaRecord = ...;
if (pfa._metadata.hasModifications) { ... }

// ✅ Correct
const pfa: PfaView = ...;
if (pfa._metadata.hasModifications) { ... }
```

### Issue 2: "Type 'PfaRecord[]' is not assignable to type 'PfaView[]'"

**Solution**: Update the type declaration:
```typescript
// ❌ Wrong
const [data, setData] = useState<PfaRecord[]>([]);

// ✅ Correct
const [data, setData] = useState<PfaView[]>([]);
```

### Issue 3: "Cannot modify readonly property"

**Solution**: Use PfaModificationDelta for edits:
```typescript
// ❌ Wrong - trying to modify mirror data directly
pfa.originalStart = new Date('2025-01-01');

// ✅ Correct - use delta for editable fields
const delta: PfaModificationDelta = {
  forecastStart: new Date('2025-01-01')
};
// originalStart is NOT in PfaModificationDelta - compiler prevents this!
```

---

## Performance Considerations

### Optimistic Updates

For better UX, implement optimistic updates:

```typescript
const handleSaveDraft = async (modifications: Array<{ pfaId: string; delta: PfaModificationDelta }>) => {
  // 1. Optimistic update (immediate UI feedback)
  const optimisticData = allPfaRef.current.map(pfa => {
    const mod = modifications.find(m => m.pfaId === pfa.pfaId);
    if (!mod) return pfa;

    return {
      ...pfa,
      ...mod.delta,
      _metadata: {
        ...pfa._metadata,
        syncState: 'draft' as const,
        hasModifications: true
      }
    };
  });

  allPfaRef.current = optimisticData;
  setDataVersion(v => v + 1);

  // 2. Save to backend
  try {
    await apiClient.saveDraft(currentOrg.id, sessionId, modifications);
  } catch (error) {
    // 3. Rollback on error
    const response = await apiClient.getPfaData(currentOrg.id);
    allPfaRef.current = response.data;
    setDataVersion(v => v + 1);
    throw error;
  }
};
```

---

## Next Steps

1. **Apply App.tsx changes** (1-2 hours)
2. **Update Timeline.tsx** (1 hour)
3. **Update other components** (1-2 hours)
4. **Test integration** (1 hour)
5. **Fix any TypeScript errors** (30 minutes)

**Total Estimated Time**: 4-5 hours

---

## Verification Commands

```bash
# TypeScript compilation
npm run type-check

# Run development server
npm run dev

# Run tests (when available)
npm run test

# Build for production
npm run build
```

---

**Status**: Implementation guide complete. Ready to apply changes to frontend components.
