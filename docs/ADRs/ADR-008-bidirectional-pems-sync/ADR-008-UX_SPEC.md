# ADR-008: UX SPEC - Bi-directional PEMS Synchronization

**Status**: Planning Phase
**Created**: 2025-11-28
**Last Updated**: 2025-11-28

---

## UX Design Philosophy

**Core Principles**:
1. **Transparency**: Always show sync status - never hide background operations
2. **Confidence**: Clear visual feedback for every user action
3. **Control**: Users can pause, retry, or rollback syncs
4. **Forgiveness**: Easy conflict resolution and rollback for mistakes
5. **Performance**: Optimistic updates with instant visual feedback

---

## User Flows

### Flow 1: Happy Path Sync

```
User edits PFA record
  ↓
[Instant UI update - optimistic]
  ↓
User clicks "Save"
  ↓
[Toast: "Draft saved ✓"]
  ↓
User clicks "Save & Sync"
  ↓
[Status Badge: "Queued ⏳"]
  ↓
[60 seconds pass - worker picks up]
  ↓
[Status Badge: "Syncing..." (animated)]
  ↓
[PEMS confirms success]
  ↓
[Status Badge: "Synced ✓" (green)]
[Toast: "Changes synced to PEMS ✓"]
```

**Perceived Performance**:
- Optimistic update: UI reflects changes immediately
- Status badge updates in real-time via WebSocket
- Estimated sync time shown: "Syncing... ~30s remaining"

---

### Flow 2: Conflict Detection & Resolution

```
User edits PFA-12345
  ↓
[Another user edits same record in PEMS]
  ↓
User clicks "Save & Sync"
  ↓
[Status Badge: "Queued ⏳"]
  ↓
Worker detects version mismatch
  ↓
[Status Badge: "Conflict ⚠️" (orange)]
[Toast: "Conflict detected in PFA-12345"]
[In-app notification with "Resolve" button]
  ↓
User clicks "Resolve"
  ↓
[ConflictResolutionModal opens]
  ↓
User selects resolution strategy
  ↓
User clicks "Apply Resolution"
  ↓
[Status Badge: "Queued ⏳"]
[Toast: "Conflict resolved - requeued for sync"]
  ↓
[Sync completes]
  ↓
[Status Badge: "Synced ✓"]
```

**UX Considerations**:
- Conflict notification is non-blocking (not a modal)
- Side-by-side comparison for easy decision-making
- Conflicting fields highlighted in yellow
- "Merge" option shows field-by-field picker

---

### Flow 3: Error Handling

```
User clicks "Save & Sync"
  ↓
[Status Badge: "Queued ⏳"]
  ↓
Worker attempts sync - PEMS returns 500
  ↓
[Status Badge: "Retrying..." (animated)]
  ↓
[Retry #1 fails - 5s wait]
[Retry #2 fails - 10s wait]
[Retry #3 fails - 20s wait]
  ↓
[Status Badge: "Failed ✗" (red)]
[Toast: "Sync failed - moved to admin queue"]
[In-app notification with error details]
  ↓
User clicks "View Error"
  ↓
[Error details modal shows:
 - Error message
 - Retry history
 - "Retry Now" button
 - "Contact Admin" button]
```

**UX Considerations**:
- Error messages are user-friendly, not technical
- Provide clear next steps ("Try again" vs "Contact admin")
- Show retry progress to reduce perceived wait time
- Admin queue visible to users for transparency

---

## UI Components

### 1. SyncStatusIndicator

**Location**: Integrated into Timeline, GridLab, CommandDeck

**Visual Design**:
```
┌──────────────────────────────┐
│ PFA-12345                    │
│ Excavator Rental             │
│ [Synced ✓] 2 min ago        │  ← Badge
└──────────────────────────────┘
```

**States**:
| State | Icon | Color | Tooltip |
|-------|------|-------|---------|
| `draft` | ✎ | Gray | "Draft - not synced" |
| `queued` | ⏳ | Blue | "Queued for sync (~1 min)" |
| `syncing` | ↻ | Blue | "Syncing... 30s remaining" (animated) |
| `synced` | ✓ | Green | "Synced 2 min ago" |
| `conflict` | ⚠️ | Orange | "Conflict - click to resolve" |
| `failed` | ✗ | Red | "Sync failed - click for details" |

**Interaction**:
- Click badge → Open sync details popover
- Hover → Show tooltip with timestamp
- Animated spinner for `syncing` state

**Implementation**:
```tsx
interface SyncStatusIndicatorProps {
  modification: PfaModification;
  onClick?: () => void;
}

function SyncStatusIndicator({ modification, onClick }: SyncStatusIndicatorProps) {
  const { syncStatus, syncedAt, syncError } = modification;

  const badge = useMemo(() => {
    switch (syncStatus) {
      case 'draft':
        return { icon: '✎', color: 'gray', label: 'Draft' };
      case 'queued':
        return { icon: '⏳', color: 'blue', label: 'Queued' };
      case 'syncing':
        return { icon: '↻', color: 'blue', label: 'Syncing...', animated: true };
      case 'synced':
        return { icon: '✓', color: 'green', label: 'Synced' };
      case 'conflict':
        return { icon: '⚠️', color: 'orange', label: 'Conflict' };
      case 'failed':
        return { icon: '✗', color: 'red', label: 'Failed' };
    }
  }, [syncStatus]);

  return (
    <Tooltip content={getTooltipContent(modification)}>
      <button
        className={cn(
          'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs',
          badge.color === 'green' && 'bg-green-100 text-green-700',
          badge.color === 'blue' && 'bg-blue-100 text-blue-700',
          badge.color === 'orange' && 'bg-orange-100 text-orange-700',
          badge.color === 'red' && 'bg-red-100 text-red-700',
          badge.color === 'gray' && 'bg-gray-100 text-gray-700',
          badge.animated && 'animate-spin'
        )}
        onClick={onClick}
      >
        <span className={badge.animated ? 'animate-spin' : ''}>{badge.icon}</span>
        <span>{badge.label}</span>
        {syncedAt && <span className="text-xs opacity-60">
          {formatRelativeTime(syncedAt)}
        </span>}
      </button>
    </Tooltip>
  );
}
```

---

### 2. ConflictResolutionModal

**Trigger**: User clicks "Resolve" on conflict notification

**Layout**:
```
┌────────────────────────────────────────────────────────────┐
│ Resolve Conflict - PFA-12345                          [×]  │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ ⚠️ This record was modified by another user in PEMS       │
│                                                             │
│ ┌────────────────────┬────────────────────┐               │
│ │   YOUR CHANGES     │    PEMS CHANGES    │               │
│ ├────────────────────┼────────────────────┤               │
│ │ Forecast Start     │ Forecast Start     │               │
│ │ 2025-01-15 🔶      │ 2025-01-20         │  ← Conflicting│
│ │                    │                    │               │
│ │ Forecast End       │ Forecast End       │               │
│ │ 2025-06-30 🔶      │ 2025-07-15         │  ← Conflicting│
│ │                    │                    │               │
│ │ Monthly Rate       │ Monthly Rate       │               │
│ │ $5,500            │ $5,500            │  ← Same        │
│ └────────────────────┴────────────────────┘               │
│                                                             │
│ Resolution Strategy:                                        │
│ ○ Use My Changes (override PEMS)                          │
│ ○ Use PEMS Changes (discard mine)                         │
│ ● Merge (pick fields below)                               │
│                                                             │
│ ┌─ Merge Configuration ──────────────────┐                │
│ │ Forecast Start: ● Mine  ○ PEMS         │               │
│ │ Forecast End:   ○ Mine  ● PEMS         │               │
│ └────────────────────────────────────────┘                │
│                                                             │
│           [Cancel]  [Apply Resolution]                     │
└────────────────────────────────────────────────────────────┘
```

**Features**:
- Side-by-side comparison
- Conflicting fields highlighted (🔶)
- Radio buttons for resolution strategy
- Merge mode shows field-by-field pickers
- Preview changes before applying

**Implementation**:
```tsx
interface ConflictResolutionModalProps {
  conflict: PfaSyncConflict;
  onResolve: (resolution: ConflictResolution) => void;
  onCancel: () => void;
}

function ConflictResolutionModal({ conflict, onResolve, onCancel }: ConflictResolutionModalProps) {
  const [strategy, setStrategy] = useState<'use_local' | 'use_pems' | 'merge'>('merge');
  const [mergedData, setMergedData] = useState<Partial<PfaRecord>>({});

  const conflictFields = conflict.conflictFields as string[];

  return (
    <Dialog open onClose={onCancel}>
      <DialogHeader>
        <AlertTriangle className="text-orange-500" />
        <span>Resolve Conflict - {conflict.pfaId}</span>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded p-4">
          <h3 className="font-semibold mb-2">Your Changes</h3>
          {renderFieldComparison(conflict.localData, conflictFields)}
        </div>
        <div className="border rounded p-4">
          <h3 className="font-semibold mb-2">PEMS Changes</h3>
          {renderFieldComparison(conflict.pemsData, conflictFields)}
        </div>
      </div>

      <RadioGroup value={strategy} onValueChange={setStrategy}>
        <Radio value="use_local">Use My Changes (override PEMS)</Radio>
        <Radio value="use_pems">Use PEMS Changes (discard mine)</Radio>
        <Radio value="merge">Merge (pick fields below)</Radio>
      </RadioGroup>

      {strategy === 'merge' && (
        <MergeFieldPicker
          localData={conflict.localData}
          pemsData={conflict.pemsData}
          conflictFields={conflictFields}
          onChange={setMergedData}
        />
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onResolve({ strategy, mergedData })}>
          Apply Resolution
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
```

---

### 3. SyncHistoryDashboard

**Location**: Admin Dashboard → "Sync History" tab

**Layout**:
```
┌────────────────────────────────────────────────────────────┐
│ Sync History                                  [Refresh]    │
├────────────────────────────────────────────────────────────┤
│ Filters:                                                   │
│ [All Orgs ▼] [All Status ▼] [Last 7 Days ▼] [Search...] │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ Sync Job #12345            ✓ Completed  2 min ago   │  │
│ │ Organization: RIO                                     │  │
│ │ Records: 150 queued, 150 synced, 0 failed           │  │
│ │ Duration: 45 seconds                                  │  │
│ │ [View Details]                                        │  │
│ └──────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ Sync Job #12344            ⚠️ Conflict  10 min ago  │  │
│ │ Organization: PORTARTHUR                              │  │
│ │ Records: 200 queued, 195 synced, 3 conflicts, 2 fail│  │
│ │ Duration: 1m 20s                                      │  │
│ │ [View Details] [Resolve Conflicts]                   │  │
│ └──────────────────────────────────────────────────────┘  │
│                                                             │
│                   [Load More]                              │
└────────────────────────────────────────────────────────────┘
```

**Features**:
- Filterable by organization, status, date range
- Real-time updates via WebSocket
- Click to expand details (error logs, retry history)
- Bulk conflict resolution
- Export to CSV

**Implementation**:
```tsx
function SyncHistoryDashboard() {
  const [filters, setFilters] = useState<SyncHistoryFilters>({});
  const { data: syncJobs, isLoading } = useSyncHistory(filters);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Sync History</h1>
        <Button onClick={refetch}>
          <RefreshCw className="mr-2" />
          Refresh
        </Button>
      </div>

      <SyncHistoryFilters value={filters} onChange={setFilters} />

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          {syncJobs.map(job => (
            <SyncJobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### 4. RollbackModal

**Location**: Admin Dashboard → Sync History → "Rollback" button

**Layout**:
```
┌────────────────────────────────────────────────────────────┐
│ Rollback PFA-12345                                    [×]  │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ ⚠️ WARNING: This will revert the PFA record to a previous │
│    version and sync the changes to PEMS.                  │
│                                                             │
│ Select Version to Restore:                                │
│                                                             │
│ ┌────────────────────────────────────────────────────┐   │
│ │ ○ Version 5 (Current)         2025-11-28 10:30am  │   │
│ │   Changed by: john.doe                             │   │
│ │   Reason: Budget reallocation                      │   │
│ │                                                     │   │
│ │ ● Version 4                   2025-11-27 3:15pm   │   │
│ │   Changed by: jane.smith                           │   │
│ │   Reason: Forecast adjustment                      │   │
│ │                                                     │   │
│ │ ○ Version 3                   2025-11-26 9:00am   │   │
│ │   Changed by: PEMS_SYNC                            │   │
│ │   Reason: PEMS data sync update                    │   │
│ └────────────────────────────────────────────────────┘   │
│                                                             │
│ Preview Changes:                                           │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Forecast Start: 2025-01-20 → 2025-01-15          │   │
│ │ Forecast End:   2025-07-15 → 2025-06-30          │   │
│ │ Monthly Rate:   $5,500 (no change)                │   │
│ └────────────────────────────────────────────────────┘   │
│                                                             │
│ Rollback Reason: ________________________________          │
│                                                             │
│           [Cancel]  [Confirm Rollback]                     │
└────────────────────────────────────────────────────────────┘
```

**Features**:
- Version history list with timestamps
- Preview changes before rollback
- Required rollback reason (audit trail)
- Admin-only permission required

**Implementation**:
```tsx
interface RollbackModalProps {
  pfaId: string;
  onRollback: (version: number, reason: string) => void;
  onCancel: () => void;
}

function RollbackModal({ pfaId, onRollback, onCancel }: RollbackModalProps) {
  const { data: versionHistory } = usePfaVersionHistory(pfaId);
  const [selectedVersion, setSelectedVersion] = useState<number>();
  const [reason, setReason] = useState('');

  const currentVersion = versionHistory?.[0];
  const targetVersion = versionHistory?.find(v => v.version === selectedVersion);

  const changes = useMemo(() => {
    if (!currentVersion || !targetVersion) return [];
    return diffVersions(currentVersion, targetVersion);
  }, [currentVersion, targetVersion]);

  return (
    <Dialog open onClose={onCancel}>
      <DialogHeader>
        <AlertTriangle className="text-red-500" />
        <span>Rollback {pfaId}</span>
      </DialogHeader>

      <Alert variant="warning">
        ⚠️ This will revert the PFA record and sync changes to PEMS.
      </Alert>

      <div className="space-y-2">
        <label className="font-semibold">Select Version to Restore:</label>
        <RadioGroup value={selectedVersion} onValueChange={setSelectedVersion}>
          {versionHistory?.map(version => (
            <Radio key={version.version} value={version.version}>
              <div>
                <span className="font-semibold">Version {version.version}</span>
                {version.version === currentVersion.version && ' (Current)'}
                <span className="text-sm text-gray-600 ml-2">
                  {formatDateTime(version.archivedAt)}
                </span>
                <div className="text-sm text-gray-600">
                  Changed by: {version.changedBy}
                  {version.changeReason && ` - ${version.changeReason}`}
                </div>
              </div>
            </Radio>
          ))}
        </RadioGroup>
      </div>

      {changes.length > 0 && (
        <div>
          <label className="font-semibold">Preview Changes:</label>
          <div className="border rounded p-3 bg-gray-50">
            {changes.map(change => (
              <div key={change.field}>
                {change.field}: {change.from} → {change.to}
              </div>
            ))}
          </div>
        </div>
      )}

      <Input
        label="Rollback Reason (required)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Explain why this rollback is necessary..."
      />

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          variant="destructive"
          disabled={!selectedVersion || !reason}
          onClick={() => onRollback(selectedVersion!, reason)}
        >
          Confirm Rollback
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
```

---

### 5. Real-time Notifications

**Delivery Methods**:
1. **Toast Messages** - Non-blocking, auto-dismiss
2. **In-app Notifications** - Persistent until dismissed
3. **WebSocket Updates** - Real-time badge updates

**Notification Types**:
| Event | Toast | In-app | Badge |
|-------|-------|--------|-------|
| Draft saved | ✓ "Draft saved" | - | Draft ✎ |
| Queued for sync | ✓ "Queued for sync" | - | Queued ⏳ |
| Sync started | - | - | Syncing ↻ |
| Sync success | ✓ "Synced to PEMS" | - | Synced ✓ |
| Conflict detected | ✓ "Conflict detected" | ✓ with "Resolve" | Conflict ⚠️ |
| Sync failed | ✓ "Sync failed" | ✓ with "View Error" | Failed ✗ |

**Implementation**:
```tsx
// WebSocket listener for real-time updates
function useSyncStatusUpdates(organizationId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const ws = new WebSocket(`wss://api/ws/sync/${organizationId}`);

    ws.onmessage = (event) => {
      const update: SyncStatusUpdate = JSON.parse(event.data);

      switch (update.type) {
        case 'SYNC_QUEUED':
          toast({ title: 'Queued for sync', icon: '⏳' });
          break;

        case 'SYNC_SUCCESS':
          toast({ title: 'Synced to PEMS', icon: '✓', variant: 'success' });
          break;

        case 'SYNC_CONFLICT':
          toast({
            title: 'Conflict detected',
            description: `PFA-${update.pfaId} needs resolution`,
            icon: '⚠️',
            variant: 'warning',
            action: <Button onClick={() => openConflictModal(update.conflictId)}>
              Resolve
            </Button>
          });
          break;

        case 'SYNC_FAILED':
          toast({
            title: 'Sync failed',
            description: update.errorMessage,
            icon: '✗',
            variant: 'destructive',
          });
          break;
      }

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries(['pfa-modifications', organizationId]);
    };

    return () => ws.close();
  }, [organizationId]);
}
```

---

## Perceived Performance Optimizations

### 1. Optimistic Updates

**Pattern**: Update UI immediately, revert if sync fails

```tsx
function useSaveDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveDraftApi,
    onMutate: async (draft) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries(['pfa-records']);

      // Snapshot previous value
      const previous = queryClient.getQueryData(['pfa-records']);

      // Optimistically update
      queryClient.setQueryData(['pfa-records'], (old: PfaRecord[]) =>
        old.map(r => r.id === draft.id ? { ...r, ...draft.changes } : r)
      );

      return { previous };
    },
    onError: (err, draft, context) => {
      // Revert on error
      queryClient.setQueryData(['pfa-records'], context?.previous);
      toast({ title: 'Save failed', variant: 'destructive' });
    },
  });
}
```

### 2. Skeleton Loaders

**Pattern**: Show structure while loading data

```tsx
function SyncHistorySkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="border rounded p-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}
```

### 3. Progressive Enhancement

**Pattern**: Show basic UI immediately, enhance with real-time updates

```tsx
// Initial render: Server-side data
// Enhancement: WebSocket real-time updates
function SyncStatus({ modificationId }: { modificationId: string }) {
  const { data: initialStatus } = useSyncStatus(modificationId);
  const [realtimeStatus, setRealtimeStatus] = useState(initialStatus);

  useSyncStatusWebSocket(modificationId, setRealtimeStatus);

  return <SyncStatusIndicator modification={realtimeStatus || initialStatus} />;
}
```

---

## Accessibility

**WCAG 2.1 AA Compliance**:

1. **Color + Icon**: Never rely on color alone (use icons + text)
2. **Keyboard Navigation**: All modals and buttons keyboard accessible
3. **Screen Reader**: ARIA labels for all status badges
4. **Focus Management**: Auto-focus on modal open, return on close
5. **Error Messaging**: Clear, actionable error messages

**Example**:
```tsx
<button
  aria-label={`Sync status: ${syncStatus}. Click for details.`}
  aria-live="polite" // Announce status changes
  role="status"
>
  <span aria-hidden="true">{icon}</span>
  <span>{label}</span>
</button>
```

---

## Responsive Design

**Breakpoints**:
- **Mobile** (< 640px): Stack conflict comparison vertically
- **Tablet** (640px - 1024px): Collapse sync history filters
- **Desktop** (> 1024px): Full side-by-side layout

---

**Next**: See [TEST_PLAN.md](./ADR-008-TEST_PLAN.md) for testing strategy and security.
