# ADR-007: API Connectivity & Intelligence Layer - UX Specification

> **Primary Agent**: `ux-technologist`
> **Instruction**: Design intuitive Admin UX for managing connectivity, mappings, and KPIs. Focus on progressive disclosure and helpful error messages.

**Status**: 🔴 Draft
**Created**: 2025-11-27
**Last Updated**: 2025-11-27

---

## ⚡ 1. Perceived Performance Rules

### Rule 1: Optimistic Updates for Configuration Changes
**Principle**: Show changes immediately in UI, sync to backend in background.

**Example - Create ApiFieldMapping**:
```typescript
// User drags "udf_char_01" to "category" field
IMMEDIATELY (0ms):
  ✅ Show mapping in Mapping Studio (optimistic)
  ✅ Show subtle "Saving..." indicator
  ✅ Disable drag-drop (prevent conflicts)

AFTER SERVER (200ms):
  ✅ Confirm save with toast: "✅ Mapping saved"
  ✅ Re-enable drag-drop
  ✅ Show "Test Mapping" button

ON ERROR:
  ❌ Revert mapping in UI
  ❌ Show error: "Failed to save mapping. PEMS field not found."
  ❌ Re-enable drag-drop
```

---

### Rule 2: Latency Budget
**Target Latency**: <200ms for all Admin operations

| Interaction | Target | Max Acceptable | Strategy |
|-------------|--------|----------------|----------|
| Load API Servers list | <100ms | 300ms | React Query cache |
| Test API connection | <2000ms | 5000ms | Show progress indicator |
| Create field mapping | <100ms | 300ms | Optimistic UI |
| Preview mapped data | <500ms | 1000ms | Sample 100 records only |
| Save KPI formula | <100ms | 300ms | Optimistic UI |
| Calculate KPI preview | <200ms | 500ms | Client-side on sample data |
| **Replay impact calculation** 🆕 | <200ms | 500ms | Count batches/records |
| **Load Bronze Inspector** 🆕 | <500ms | 1000ms | Sample 100 records with virtualization |
| **Load Schema Diff** 🆕 | <200ms | 500ms | Compare fingerprints |
| **Load Version History** 🆕 | <300ms | 800ms | Query historical mappings |

**Enforcement**: Log slow interactions to identify bottlenecks.

---

### Rule 3: Loading Strategy
**Progressive Disclosure**: Show skeleton screens, then load data incrementally.

**API Servers List Loading**:
```
┌─────────────────────────────────────────┐
│ API Servers                             │
├─────────────────────────────────────────┤
│ ███████████ Loading                     │
│ ███████████ Loading                     │
│ ███████████ Loading                     │
└─────────────────────────────────────────┘

↓ After 200ms ↓

┌─────────────────────────────────────────┐
│ API Servers                  [+ Add]    │
├─────────────────────────────────────────┤
│ ✅ PEMS Production                      │
│ ⚠️ PEMS Staging (Connection Failed)    │
│ ✅ HOLNG PEMS                           │
└─────────────────────────────────────────┘
```

---

## 🎨 2. Interaction Model

### Workflow 1: Connect to New PEMS Server

**User Flow**:
1. Admin clicks "+ Add Server" button
2. Modal opens with form (Name, Base URL, Auth Type, Credentials)
3. Admin fills in details
4. Admin clicks "Test Connection" button
5. App calls PEMS API with credentials
6. Success: Show "✅ Connection successful. Sample data: 1,234 records"
7. Admin clicks "Save Server"
8. Server appears in list

**Timing**:
- Step 1 → 2: <16ms (instant modal open)
- Step 3 → 4: <16ms (instant button click)
- Step 4 → 5: 2000ms (network call to PEMS)
- Step 5 → 6: <100ms (parse response)
- Step 7 → 8: 200ms (save to database)

**UX Details**:
```
┌─────────────────────────────────────────┐
│ Add API Server                    [×]   │
├─────────────────────────────────────────┤
│ Name*                                   │
│ [PEMS Production              ]         │
│                                         │
│ Base URL*                               │
│ [https://eam.example.com      ]         │
│                                         │
│ Auth Type*                              │
│ [Basic Auth ▼]                          │
│                                         │
│ Username*                               │
│ [admin                        ]         │
│                                         │
│ Password*                               │
│ [••••••••                     ]         │
│                                         │
│ [Test Connection]  [Cancel]  [Save]    │
└─────────────────────────────────────────┘

After "Test Connection" clicked:

┌─────────────────────────────────────────┐
│ Testing Connection...                   │
│ [=========>          ] 60%              │
│                                         │
│ Connecting to https://eam.example.com   │
│ Authenticating...                       │
└─────────────────────────────────────────┘

Success state:

┌─────────────────────────────────────────┐
│ ✅ Connection Successful                │
│                                         │
│ Sample Data:                            │
│ • 1,234 PFA records found               │
│ • 5 fields detected (id, cost, ...)    │
│                                         │
│ [View Sample Data]  [Save Server]      │
└─────────────────────────────────────────┘
```

---

### Workflow 2: Map PEMS Fields to PFA Schema

**User Flow**:
1. Admin selects API Endpoint from list
2. App loads sample Bronze records (first 100)
3. Mapping Studio shows two columns: "PEMS Fields" (left) and "PFA Fields" (right)
4. Admin drags "udf_char_01" from left to "category" field on right
5. Preview panel shows sample mapped data
6. Admin clicks "Apply Mapping"
7. Mapping saved to database

**UX Details**:
```
┌─────────────────────────────────────────────────────────────┐
│ Mapping Studio: PEMS Production → PFA Records              │
├───────────────────────┬─────────────────────────────────────┤
│ PEMS Fields           │ PFA Fields                          │
│ (Drag to map →)       │ (← Drop here)                       │
├───────────────────────┼─────────────────────────────────────┤
│ 📄 id                 │ ✅ id (mapped: id)                  │
│ 📄 udf_char_01        │ ✅ category (mapped: udf_char_01)   │
│ 📄 udf_num_01         │ ⚠️ cost (unmapped)                  │
│ 📄 last_update_date   │ ✅ updatedAt (mapped: last_update_  │
│ 📄 status             │ ⚠️ status (unmapped)                │
│ 📄 ...                │ ...                                 │
└───────────────────────┴─────────────────────────────────────┘

Preview Panel (right side):
┌─────────────────────────────────────────┐
│ Preview: First 10 Mapped Records        │
├─────────────────────────────────────────┤
│ ID         Category    Cost    Updated  │
│ PFA-001    Rental      5000    Nov 27   │
│ PFA-002    Purchase    25000   Nov 26   │
│ PFA-003    Rental      3500    Nov 27   │
│ ...                                     │
│                                         │
│ ⚠️ 2 warnings:                          │
│ • "cost" field unmapped (47 records)   │
│ • "status" field unmapped (all)        │
│                                         │
│ [Apply Mapping]  [Reset]  [Cancel]     │
└─────────────────────────────────────────┘
```

---

### Workflow 3: Create Custom KPI

**User Flow**:
1. Admin clicks "New KPI" button
2. Formula Builder modal opens
3. Admin types: "Total Spend with Tax"
4. Admin types formula: `{cost} * 1.15`
5. App shows preview: "Sample result: $5,750.00 (from 100 records)"
6. Admin selects format: "Currency"
7. Admin clicks "Save KPI"
8. KPI appears on KPI Board

**UX Details**:
```
┌─────────────────────────────────────────┐
│ Create Custom KPI                 [×]   │
├─────────────────────────────────────────┤
│ KPI Name*                               │
│ [Total Spend with Tax         ]         │
│                                         │
│ Formula*                                │
│ [{cost} * 1.15                ]         │
│   ↑                                     │
│   Available fields:                     │
│   • {cost}                              │
│   • {monthlyRate}                       │
│   • {quantity}                          │
│                                         │
│ Preview Result (100 sample records):    │
│ ┌─────────────────────────────────────┐ │
│ │ ✅ Formula Valid                    │ │
│ │ Sample: $5,000 * 1.15 = $5,750.00   │ │
│ │ Average: $5,234.50                  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Display Format                          │
│ [Currency ▼]                            │
│                                         │
│ [Test Formula]  [Cancel]  [Save KPI]   │
└─────────────────────────────────────────┘
```

---

### Workflow 4: Replay Historical Transformation (Time Machine)

**User Flow**:
1. Admin navigates to Sync Status Dashboard → History Tab
2. Selects date range (e.g., "Nov 1 - Nov 27")
3. Clicks "Replay Transformation" button
4. Modal opens with impact preview
5. Admin reviews: "25 batches, 15,400 records will be reprocessed"
6. Admin clicks "Confirm Replay"
7. Progress indicator shows replay status
8. Success toast: "✅ Replay complete. 15,400 records updated"

**Timing**:
- Step 1 → 2: <16ms (instant tab switch)
- Step 2 → 3: <16ms (instant button click)
- Step 3 → 4: 200ms (calculate impact)
- Step 6 → 7: Background job (30s - 5min depending on batch size)
- Step 7 → 8: Real-time updates via SSE/polling

**UX Details**:
```
┌─────────────────────────────────────────────────────────────┐
│ Sync History                                [Replay...]     │
├─────────────────────────────────────────────────────────────┤
│ Date Range: [Nov 1, 2025 ▼] to [Nov 27, 2025 ▼]           │
│                                                             │
│ Batch ID         Records   Status      Ingested            │
│ batch-20251127   10,000    ✅ Complete  Nov 27, 8:00 AM    │
│ batch-20251126   10,000    ✅ Complete  Nov 26, 8:00 AM    │
│ batch-20251125   9,500     ✅ Complete  Nov 25, 8:00 AM    │
│ ...                                                         │
│                                                             │
│ Total: 25 batches, 240,500 records                         │
└─────────────────────────────────────────────────────────────┘

After clicking "Replay Transformation":

┌─────────────────────────────────────────┐
│ Replay Transformation          [×]      │
├─────────────────────────────────────────┤
│ You are about to re-process:            │
│                                         │
│ • 25 batches                            │
│ • 240,500 Bronze records                │
│ • Date range: Nov 1 - Nov 27, 2025     │
│                                         │
│ ⚠️ Important:                           │
│ • Uses CURRENT mapping rules            │
│ • Will update 15,400 Silver records     │
│ • Cannot be undone                      │
│                                         │
│ Estimated time: 3-5 minutes             │
│                                         │
│ [Cancel]  [Confirm Replay]              │
└─────────────────────────────────────────┘

During replay:

┌─────────────────────────────────────────┐
│ Replay in Progress...                   │
│ [============>       ] 60%              │
│                                         │
│ Batch 15 of 25 processing               │
│ 9,000 / 15,000 records updated          │
│                                         │
│ Estimated: 2 minutes remaining          │
└─────────────────────────────────────────┘
```

---

### Workflow 5: View Raw Bronze Data (X-Ray Vision)

**User Flow**:
1. Admin clicks on specific Batch ID in Sync History
2. Batch Details panel opens
3. Admin clicks "View Source Data Payload" tab
4. JSON Viewer displays raw PEMS data
5. Admin can search, fold/unfold, and copy JSON
6. Context banner shows: "Ingested: Nov 24, 8:00 AM | Server: PEMS Prod"

**Timing**:
- Step 1 → 2: <100ms (load batch metadata)
- Step 2 → 3: <500ms (load first 100 Bronze records)
- Step 4 → 5: <16ms (instant JSON render with virtualization)

**UX Details**:
```
┌─────────────────────────────────────────────────────────────┐
│ Batch Details: batch-20251124-001                           │
├─────────────────────────────────────────────────────────────┤
│ Tabs: [Overview] [Source Data Payload] [Transformation Log]│
├─────────────────────────────────────────────────────────────┤
│ Source Data Payload                                         │
│                                                             │
│ Context: Ingested Nov 24, 8:00 AM | Server: PEMS Prod      │
│ Records: 10,000 | Schema Version: abc123def                │
│                                                             │
│ Search: [________________________________________] 🔍        │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ [1] {                                               │   │
│ │   "id": "PFA-001",                    [Copy]  [↕]   │   │
│ │   "udf_char_01": "RENTAL",                          │   │
│ │   "udf_num_01": 5000,                               │   │
│ │   "last_update_date": "2025-11-24T08:00:00Z",       │   │
│ │   "status": "A"                                     │   │
│ │ }                                                   │   │
│ │                                                     │   │
│ │ [2] { ... }                           [Copy]  [↕]   │   │
│ │                                                     │   │
│ │ Showing 1-100 of 10,000        [Load More]         │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│ [Export Batch as JSON]  [Compare with Silver]              │
└─────────────────────────────────────────────────────────────┘
```

---

### Workflow 6: Investigate Schema Drift (Diff View)

**User Flow**:
1. Admin sees yellow warning banner on Endpoint Card: "⚠️ Schema Drift Detected"
2. Admin clicks "View Changes"
3. Schema Diff Modal opens with side-by-side comparison
4. Left: Baseline schema (expected fields)
5. Right: Received schema (actual fields from last sync)
6. Missing fields highlighted in RED
7. New fields highlighted in GREEN
8. Admin clicks "Update Mapping to use new fields"
9. Redirects to Mapping Studio with suggested changes pre-filled

**Timing**:
- Step 1 → 2: <16ms (instant click)
- Step 2 → 3: <200ms (load schema diff)
- Step 8 → 9: <100ms (navigate to Mapping Studio)

**UX Details**:
```
┌─────────────────────────────────────────┐
│ Endpoint: PEMS Production → PFA        │
│ Status: ✅ Connected                    │
│                                         │
│ ⚠️ Schema Drift Detected in last sync  │
│ 5 expected fields missing               │
│ 3 new unexpected fields found           │
│                                         │
│ [View Changes]  [Dismiss]               │
└─────────────────────────────────────────┘

After clicking "View Changes":

┌─────────────────────────────────────────────────────────────┐
│ Schema Drift Analysis                            [×]        │
├─────────────────────────────────────────────────────────────┤
│ Detected: Nov 27, 2025 8:00 AM                              │
│ Batch: batch-20251127-001                                   │
│                                                             │
│ ┌─────────────────────┬─────────────────────────────────┐  │
│ │ Baseline (Expected) │ Received (Actual)               │  │
│ ├─────────────────────┼─────────────────────────────────┤  │
│ │ id                  │ id                  ✅          │  │
│ │ cost           🔴   │ cost_usd            🟢 NEW      │  │
│ │ category            │ category            ✅          │  │
│ │ status              │ status              ✅          │  │
│ │ updated_at     🔴   │ last_modified       🟢 NEW      │  │
│ │ quantity       🔴   │ qty                 🟢 NEW      │  │
│ └─────────────────────┴─────────────────────────────────┘  │
│                                                             │
│ Summary:                                                    │
│ • 3 fields missing: cost, updated_at, quantity              │
│ • 3 new fields: cost_usd, last_modified, qty                │
│                                                             │
│ Suggested Actions:                                          │
│ ✅ Map "cost_usd" → "cost" field                           │
│ ✅ Map "last_modified" → "updatedAt" field                 │
│ ✅ Map "qty" → "quantity" field                            │
│                                                             │
│ [Ignore Drift]  [Update Mappings]                          │
└─────────────────────────────────────────────────────────────┘
```

---

### Workflow 7: View Mapping Version History (Timeline)

**User Flow**:
1. Admin is in Mapping Studio
2. Clicks "History" button in top-right corner
3. Version History drawer slides in from right
4. Shows chronological list: "v3 (Current)", "v2 (Oct 1 - Nov 15)", "v1 (Initial)"
5. Admin clicks "v2"
6. Mapping Studio loads v2 configuration (Read-Only)
7. Orange banner: "⚠️ Viewing Historical Version v2 (Active Oct 1 - Nov 15)"
8. Admin can compare with current or restore this version

**Timing**:
- Step 2 → 3: <16ms (instant drawer slide)
- Step 5 → 6: <300ms (load historical mapping rules)
- Step 8: <200ms (restore operation)

**UX Details**:
```
┌─────────────────────────────────────────────────────────────┐
│ Mapping Studio: PEMS Production → PFA    [History]         │
├─────────────────────────────────────────────────────────────┤
│ PEMS Fields     │ PFA Fields        │ Version History     ▶│
│ ...             │ ...               │                      │
└─────────────────────────────────────────────────────────────┘

After clicking "History":

┌─────────────────────────────────────────────────────────────┐
│ Mapping Studio: PEMS Production → PFA    [History ✓]       │
├─────────────────────────────────────────────────────────────┤
│ PEMS Fields     │ PFA Fields        │ Version History     ◀│
│ ...             │ ...               │                      │
│                 │                   │ v3 (Current)         │
│                 │                   │ Active: Nov 16+      │
│                 │                   │ [View]               │
│                 │                   │                      │
│                 │                   │ v2                   │
│                 │                   │ Oct 1 - Nov 15       │
│                 │                   │ [View] [Restore]     │
│                 │                   │                      │
│                 │                   │ v1 (Initial)         │
│                 │                   │ Aug 1 - Sep 30       │
│                 │                   │ [View] [Restore]     │
│                 │                   │                      │
│                 │                   │ Changes in v2:       │
│                 │                   │ • Added cost→cost    │
│                 │                   │ • Removed old_field  │
└─────────────────────────────────────────────────────────────┘

After clicking "View" on v2:

┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Viewing Historical Version v2 (Active Oct 1 - Nov 15)   │
│ [Return to Current] [Restore This Version]                  │
├─────────────────────────────────────────────────────────────┤
│ Mapping Studio: PEMS Production → PFA    [History ✓]       │
├─────────────────────────────────────────────────────────────┤
│ PEMS Fields     │ PFA Fields        │ Version History     ◀│
│ (Read-Only)     │ (Read-Only)       │                      │
│                 │                   │ v2 ← VIEWING         │
│ udf_char_01  →  │ category          │                      │
│ old_field    →  │ legacy_data       │                      │
│ ...             │ ...               │                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📐 3. Updated Component Tree (Operational & Forensic UI)

The following component tree now includes **operational** (Time Machine, Bronze Inspector) and **forensic** (Schema Drift, Version History) capabilities:

```
<AdminDashboard>
  ├─ <ConnectivityManager>
  │    ├─ <ApiServerList>
  │    │    └─ <ServerCard> (repeatable)
  │    │         ├─ Server name, status, health
  │    │         ├─ <SchemaDriftAlert> (conditional) 🆕
  │    │         │    └─ [View Changes] → <SchemaDiffModal> 🆕
  │    │         └─ [Edit] [Delete] [Test] buttons
  │    └─ <ServerFormModal>
  │
  ├─ <MappingStudio>
  │    ├─ <EndpointSelector>
  │    ├─ <MappingPanel>
  │    │    ├─ <PemsFieldsList> (left column)
  │    │    ├─ <PfaFieldsList> (right column)
  │    │    └─ <MappingLine> (visual connection)
  │    ├─ <PreviewPanel>
  │    ├─ <VersionHistoryDrawer> (side panel) 🆕
  │    │    └─ List of past mapping rule sets
  │    │         ├─ v3 (Current)
  │    │         ├─ v2 (Historical)
  │    │         └─ v1 (Initial)
  │    └─ <MappingActions>
  │
  ├─ <FormulaBuilder>
  │    ├─ <KpiList>
  │    └─ <KpiFormModal>
  │
  └─ <SyncStatusDashboard>
       ├─ <IngestionProgress>
       ├─ <TransformationProgress>
       ├─ <SyncHistory> 🆕
       │    ├─ <BatchTable>
       │    │    └─ <BatchRow> (repeatable)
       │    │         ├─ [View Raw Payload] → <BronzeInspector> 🆕
       │    │         └─ Batch metadata
       │    └─ [Replay Transformation] → <ReplayModal> 🆕
       └─ <SyncHistoryTab>

<BronzeInspector> (Modal) 🆕
  ├─ <BatchDetailsHeader>
  │    └─ Context: Ingested date, Server, Schema version
  ├─ <TabNavigation>
  │    ├─ [Overview]
  │    ├─ [Source Data Payload] ← Bronze Layer
  │    └─ [Transformation Log]
  └─ <JsonViewer>
       ├─ Search functionality
       ├─ Fold/unfold controls
       ├─ Copy to clipboard
       └─ Virtualized scrolling (10K+ records)

<SchemaDiffModal> (Modal) 🆕
  ├─ <DiffHeader>
  │    └─ Detection timestamp, Batch ID
  ├─ <SideBySideComparison>
  │    ├─ Baseline (Expected) schema
  │    ├─ Received (Actual) schema
  │    └─ Highlights:
  │         ├─ 🔴 Missing fields (RED)
  │         └─ 🟢 New fields (GREEN)
  ├─ <SuggestedActions>
  │    └─ Auto-generated mapping suggestions
  └─ <Actions>
       ├─ [Ignore Drift]
       └─ [Update Mappings]

<ReplayModal> (Modal) 🆕
  ├─ <ImpactSummary>
  │    ├─ Batch count
  │    ├─ Record count
  │    └─ Date range
  ├─ <WarningBanner>
  │    ├─ Uses CURRENT mapping rules
  │    ├─ Will update Silver records
  │    └─ Cannot be undone
  ├─ <EstimatedTime>
  └─ <Actions>
       ├─ [Cancel]
       └─ [Confirm Replay]
```

**Key Additions (🆕)**:
1. **SchemaDriftAlert**: Yellow warning banner on Endpoint cards when schema changes detected
2. **SchemaDiffModal**: Visual side-by-side comparison of expected vs. actual schema
3. **VersionHistoryDrawer**: Timeline of mapping rule changes with restore capability
4. **BronzeInspector**: Raw JSON viewer for audit/debugging (the "X-Ray" view)
5. **ReplayModal**: Time Machine UI for reprocessing historical Bronze batches
6. **SyncHistory**: Enhanced history table with batch-level operations

---

## 🔄 4. Empty States

### Empty State 1: No API Servers Configured

```
┌─────────────────────────────────────────┐
│  🔌 No API Servers Connected            │
│                                         │
│  Connect to PEMS or other data sources  │
│  to start syncing equipment data.       │
│                                         │
│  [+ Add Your First Server]              │
└─────────────────────────────────────────┘
```

---

### Empty State 2: No Mappings Configured for Endpoint

```
┌─────────────────────────────────────────┐
│  📋 No Field Mappings                   │
│                                         │
│  Map PEMS fields to PFA fields to       │
│  start transforming data.               │
│                                         │
│  Tip: We detected 5 fields that might   │
│  match automatically.                   │
│                                         │
│  [Auto-Suggest Mappings] [Manual Setup] │
└─────────────────────────────────────────┘
```

---

### Empty State 3: No KPIs Defined

```
┌─────────────────────────────────────────┐
│  📊 No Custom KPIs                      │
│                                         │
│  Create custom calculations to track    │
│  your own metrics.                      │
│                                         │
│  Examples:                              │
│  • Total spend with tax                 │
│  • Cost per day                         │
│  • Variance percentage                  │
│                                         │
│  [Create First KPI] [View Examples]     │
└─────────────────────────────────────────┘
```

---

## 🚨 5. Error States

### Error 1: Connection Test Failed

```
┌─────────────────────────────────────────┐
│ ❌ Connection Failed                    │
│                                         │
│ Could not connect to PEMS server.       │
│                                         │
│ Possible causes:                        │
│ • Wrong credentials                     │
│ • Server unreachable (firewall?)        │
│ • Invalid Base URL                      │
│                                         │
│ Error Details:                          │
│ HTTP 401: Unauthorized                  │
│                                         │
│ [Check Credentials] [Retry] [Get Help] │
└─────────────────────────────────────────┘
```

---

### Error 2: Mapping Preview Failed

```
┌─────────────────────────────────────────┐
│ ⚠️ Preview Failed                       │
│                                         │
│ Could not load sample data from Bronze  │
│ layer. No records found for this        │
│ endpoint.                               │
│                                         │
│ Suggestion: Run a sync first to         │
│ populate Bronze layer with data.        │
│                                         │
│ [Run Sync Now] [Skip Preview] [Cancel] │
└─────────────────────────────────────────┘
```

---

### Error 3: KPI Formula Invalid

```
┌─────────────────────────────────────────┐
│ ❌ Formula Error                        │
│                                         │
│ Formula: {cost} * {unknownField}        │
│                  ^~~~~~~~~~~~~~~~       │
│ Error: Field "unknownField" not found   │
│                                         │
│ Available fields:                       │
│ • cost                                  │
│ • monthlyRate                           │
│ • quantity                              │
│                                         │
│ [Fix Formula] [Get Help]                │
└─────────────────────────────────────────┘
```

---

## ♿ 6. Accessibility & Inclusion

### Keyboard Navigation

**API Server Manager**:
- `Tab` to navigate between form fields
- `Enter` to test connection or save
- `Esc` to close modal

**Mapping Studio**:
- `Tab` to focus on PEMS field
- `Space` to select field
- `Arrow keys` to navigate PFA fields
- `Enter` to confirm mapping
- `Delete` to remove mapping

**Formula Builder**:
- `Tab` to navigate between name/formula/format
- `Ctrl+Space` to open field autocomplete
- `Enter` to test formula
- `Ctrl+Enter` to save KPI

---

### Screen Reader Support

**ARIA Labels Required**:
```html
<button
  aria-label="Add new API server to connect to PEMS"
  aria-describedby="server-add-description"
>
  + Add Server
</button>

<div
  role="dialog"
  aria-labelledby="mapping-studio-title"
  aria-describedby="mapping-studio-description"
>
  <h2 id="mapping-studio-title">Mapping Studio</h2>
  <p id="mapping-studio-description">
    Drag PEMS fields from left to PFA fields on right to create mappings
  </p>
</div>

<div role="alert" aria-live="assertive" aria-atomic="true">
  ✅ Mapping saved successfully
</div>
```

---

### Mobile Considerations

**Responsive Breakpoints**:
- Mobile (320px - 767px): Stack columns vertically
- Tablet (768px - 1023px): Side-by-side with scrolling
- Desktop (1024px+): Full Mapping Studio layout

**Touch Gestures**:
- Long press on PEMS field to start drag
- Drag to PFA field and release
- Minimum touch target: 44px × 44px

---

## 📊 7. Visual Feedback Patterns

### Success Feedback

**Toast Message - Mapping Saved**:
```
┌──────────────────────────────┐
│ ✅ Mapping Saved             │
│ udf_char_01 → category       │
└──────────────────────────────┘
```
- Duration: 3 seconds
- Position: Top-right
- Auto-dismiss: Yes

---

### Warning Feedback

**Inline Warning - Unmapped Fields**:
```
⚠️ 3 PFA fields unmapped: cost, status, updatedAt
This may cause data loss during transformation.
[Map Now] [Ignore]
```

---

### Progress Feedback

**Sync Status Dashboard**:
```
┌─────────────────────────────────────────┐
│ Sync Status: PEMS Production → PFA     │
├─────────────────────────────────────────┤
│ Ingestion:  [=========>    ] 75%        │
│ 7,500 / 10,000 records ingested         │
│                                         │
│ Transformation: [=====>       ] 45%     │
│ 4,500 / 10,000 records transformed      │
│                                         │
│ Estimated Time: 2 minutes remaining     │
│                                         │
│ [View Logs] [Cancel Sync]               │
└─────────────────────────────────────────┘
```

---

## 🧪 8. UX Testing Scenarios

### Scenario 1: First-Time Setup (Happy Path)

**Steps**:
1. Admin logs in for first time
2. Empty state: "No API Servers Connected"
3. Clicks "+ Add Your First Server"
4. Fills in PEMS credentials
5. Clicks "Test Connection"
6. Success: "✅ Connection successful"
7. Clicks "Save Server"
8. Server appears in list

**Expected**:
- ✅ Empty state is helpful and action-oriented
- ✅ Form validation guides user (e.g., "Base URL required")
- ✅ Connection test shows progress indicator
- ✅ Success state shows sample data preview
- ✅ Transition from empty to populated is smooth

---

### Scenario 2: Mapping with Preview

**Steps**:
1. Admin selects endpoint
2. Mapping Studio loads with sample Bronze data
3. Admin drags 3 fields
4. Preview shows mapped results
5. Warning: "2 fields unmapped"
6. Admin maps remaining fields
7. Clicks "Apply Mapping"

**Expected**:
- ✅ Preview updates immediately after each drag
- ✅ Warnings are inline and actionable
- ✅ Success toast confirms save
- ✅ Can see before/after comparison

---

### Scenario 3: KPI Creation with Error

**Steps**:
1. Admin clicks "New KPI"
2. Types formula with typo: `{cost * 1.15`
3. Clicks "Test Formula"
4. Error: "Syntax error: Missing closing brace"
5. Admin fixes: `{cost} * 1.15`
6. Success: "Preview: $5,750.00"
7. Clicks "Save KPI"

**Expected**:
- ✅ Error message is specific and actionable
- ✅ Preview updates on every keystroke (debounced)
- ✅ Success state shows sample calculation
- ✅ KPI appears on board immediately

---

### Scenario 4: Time Machine Replay (Operational)

**Steps**:
1. Admin navigates to Sync History
2. Selects date range (3 weeks of data)
3. Clicks "Replay Transformation"
4. Reviews impact: "25 batches, 240K records"
5. Confirms replay

**Expected**:
- ✅ Impact calculation completes in <200ms
- ✅ Progress updates in real-time (SSE/polling)
- ✅ Can cancel during replay
- ✅ Success message shows updated record count
- ✅ Replay uses current mapping rules (warns user)

---

### Scenario 5: Bronze Inspector (Forensic)

**Steps**:
1. Admin clicks batch ID from history
2. Opens "Source Data Payload" tab
3. Searches for specific record: "PFA-001"
4. Expands JSON, copies field value

**Expected**:
- ✅ JSON loads in <500ms
- ✅ Search highlights matching records
- ✅ Fold/unfold works smoothly
- ✅ Copy button copies to clipboard
- ✅ Shows context: ingestion date, server, schema version

---

### Scenario 6: Schema Drift Detection (Forensic)

**Steps**:
1. PEMS changes API (removes "cost", adds "cost_usd")
2. Next sync triggers schema drift alert
3. Admin sees yellow banner on Endpoint card
4. Clicks "View Changes"
5. Reviews side-by-side diff
6. Clicks "Update Mappings"

**Expected**:
- ✅ Alert appears immediately after sync
- ✅ Diff view highlights changes (RED/GREEN)
- ✅ Suggested actions are auto-generated
- ✅ "Update Mappings" pre-fills Mapping Studio
- ✅ Admin can dismiss alert if intentional change

---

### Scenario 7: Mapping Version History (Forensic)

**Steps**:
1. Admin opens Mapping Studio
2. Clicks "History" button
3. Views 3 versions: v3 (current), v2, v1
4. Clicks "View" on v2
5. Reviews historical mappings (read-only)
6. Returns to current version

**Expected**:
- ✅ Version history loads in <300ms
- ✅ Historical version displays with warning banner
- ✅ Read-only mode prevents accidental edits
- ✅ "Restore" button enables rollback
- ✅ Shows what changed between versions

---

## 📚 Related Documentation

- **Decision**: [ADR-007-DECISION.md](./ADR-007-DECISION.md)
- **AI Opportunities**: [ADR-007-AI_OPPORTUNITIES.md](./ADR-007-AI_OPPORTUNITIES.md)
- **Test Plan**: [ADR-007-TEST_PLAN.md](./ADR-007-TEST_PLAN.md)
- **Implementation Plan**: [ADR-007-IMPLEMENTATION_PLAN.md](./ADR-007-IMPLEMENTATION_PLAN.md)

---

**Status**: 🔴 Draft - Awaiting UX Review
**Next Action**: Frontend developer must implement optimistic UI patterns

*Document created: 2025-11-27*
*Last updated: 2025-11-27 (Enhanced with Operational & Forensic UI: Time Machine, Bronze Inspector, Schema Drift, Version History)*
*UX Spec Version: 2.0*
