# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Overview](#project-overview)
3. [Essential Domain Concepts](#essential-domain-concepts)
4. [Critical Architecture Patterns](#critical-architecture-patterns)
5. [Key Files](#key-files)
6. [Common Tasks](#common-tasks)
7. [Known Issues](#known-issues)
8. [Production Checklist](#production-checklist)

## Quick Start

```bash
# Install dependencies
npm install

# Set Gemini API key in .env.local
# GEMINI_API_KEY=your_key_here

# Run development server (port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

**Login**: Type any username (mock auth - no password required)

## Project Overview

**PFA Vanguard** is a construction equipment tracking system for large industrial projects. It manages the **Plan → Forecast → Actuals** lifecycle for 10,000+ equipment requirements.

**Core Purpose**: Help Project Managers ensure actual equipment costs don't exceed budgeted amounts by adjusting forecasts to navigate the gap.

**Tech Stack**: React 19 + TypeScript + Vite + Tailwind CSS + Google Gemini AI

**Data Scale**: 20,280 PFA records + 3,735 asset master records (loaded from `mockData.ts`)

## Essential Domain Concepts

### PFA = Plan, Forecast, Actuals

A **PfaRecord** represents one equipment requirement evolving through three states:

```
ESS (Estimation System)
    ↓ CSV Import
PLAN (originalStart/End) ← Locked budget baseline (immutable)
    ↓ Copied to Forecast
FORECAST (forecastStart/End) ← PM strategy (editable in this app)
    ↓ Equipment arrives on-site
ACTUAL (actualStart/End) ← Billing reality (imported from Procurement)
```

**Critical Rule**: Plan never changes. Variance = Forecast/Actual vs. Plan.

### Key Field Groups

**Timeline Fields** (`PfaRecord`):
- `originalStart/End`: Budget baseline (locked)
- `forecastStart/End`: PM strategy (drag-and-drop editable)
- `actualStart/End`: Billing reality (imported, `isActualized = true`)

**Financial Fields**:
- `source`: 'Rental' (uses `monthlyRate`) or 'Purchase' (uses `purchasePrice`)
- `dor`: 'BEO' (general overhead) or 'PROJECT' (specific charge code)

**Status Flags**:
- `isActualized`: Equipment on-site and billing (`true` = orange bars on timeline)
- `isDiscontinued`: Requirement cancelled (`true` = hidden from default views)
- `isFundsTransferable`: Budget donor (`true` = can reallocate funds to other PFAs)

### Cost Calculation Logic

**Rental**: `Cost = (days / 30.44) × monthlyRate`
**Purchase**: `Cost = purchasePrice` (duration irrelevant)

See `utils.ts: calculateCost()` for implementation.

## Critical Architecture Patterns

### 1. Sandbox Pattern (Simulation Mode)

**Problem**: PMs need to experiment ("What if I cut all rentals by 10%?") without affecting production data.

**Solution**: Dual-ref architecture
- `allPfaRef.current`: Working sandbox (all edits happen here)
- `baselinePfaRef.current`: Committed truth (reset point)
- `visiblePfaRecords`: State-based filtered data for rendering

```tsx
// All mutations flow through this pattern
const updatePfaRecords = (fn: (assets: PfaRecord[]) => PfaRecord[]) => {
  pushHistory(); // Save current state for undo
  allPfaRef.current = fn(allPfaRef.current); // Mutate sandbox
  setDataVersion(v => v + 1); // Trigger re-render
};

// Discard experimental changes
const handleDiscardChanges = () => {
  allPfaRef.current = cloneAssets(baselinePfaRef.current); // Reset
};

// Commit changes to baseline
const handleSubmitChanges = () => {
  baselinePfaRef.current = cloneAssets(allPfaRef.current); // Commit
};
```

**Why Refs**: Enables 20-level undo/redo history without triggering re-renders on intermediate states.

**Memory Warning**: Each history snapshot clones ~20K records. Consider diff-based history for production.

### 2. Smart Bulk Operations

**Problem**: Weather delay shuts down "Silo 4" for 14 days. Need to adjust 600 equipment lines, but logic differs by state.

**Solution**: State-aware bulk operations in `CommandDeck.tsx`

```tsx
// Forecasts: Shift both start and end dates
// Actuals: Can't change past start date, only extend end date
onShiftTime={(days) => updatePfaRecords(prev =>
  prev.map(a => selectedIds.has(a.id)
    ? a.isActualized
      ? { ...a, actualEnd: addDays(a.actualEnd, days) }      // Actuals: extend only
      : { ...a, forecastStart: addDays(a.forecastStart, days),  // Forecasts: shift both
                forecastEnd: addDays(a.forecastEnd, days) }
    : a
  )
)}
```

### 3. Drag-and-Drop with Live Preview

**Problem**: Dragging 10+ timeline bars simultaneously requires smooth preview without data mutation until drop.

**Solution**: `dragOverrides` Map in `Timeline.tsx`

```tsx
// During drag: Store overrides in Map (no data mutation)
const [dragOverrides, setDragOverrides] = useState<Map<string, DragUpdate>>(new Map());

// On drop: Apply overrides via onUpdateAssets callback
const handleMouseUp = () => {
  if (dragOverrides.size > 0) {
    onUpdateAssets(Array.from(dragOverrides.entries()).map(([id, update]) => ({
      id, start: update.start, end: update.end, layer: update.layer
    })));
  }
  setDragOverrides(new Map()); // Clear
};
```

### 4. Multi-Organization Isolation

Each construction project is an "Organization" (e.g., HOLNG, PEMS_Global).

**Pattern**:
- Users have `allowedOrganizationIds[]` (can access multiple projects)
- `currentUser.organizationId` = active context
- All data filtered by `organization` field
- Each org has isolated filters: `orgSpecificFilters[orgId]`

**Switching Context**: `handleSwitchContext(newOrgId)` updates active org and restores that org's filters.

### 5. Dynamic Form Fields (Rent vs. Buy)

**Problem**: Rental uses `monthlyRate`, Purchase uses `purchasePrice`. Form fields must change.

**Solution**: Conditional rendering based on `source` field

```tsx
{source === 'Rental' && (
  <input type="number" name="monthlyRate" placeholder="Monthly Rate" />
)}
{source === 'Purchase' && (
  <input type="number" name="purchasePrice" placeholder="Purchase Price" />
)}
```

KPI Board recalculates instantly using `calculateCost()` which branches on `source`.

## Key Files

### Core State Management

**`App.tsx`** (890 lines)
- Root state manager implementing sandbox pattern
- Critical functions:
  - `updatePfaRecords()`: All mutations flow here
  - `pushHistory()`: Undo/redo stack management
  - `handleSubmitChanges()`: Commit sandbox to baseline
  - `handleDiscardChanges()`: Reset sandbox
  - `handleDataImport()`: CSV import orchestration
- **Warning**: Uses refs for state (not standard React pattern)

**`types.ts`** (336 lines)
- All TypeScript interfaces
- `PfaRecord`: Core data model with Plan/Forecast/Actual fields
- `FilterState`: Organization-specific filter configuration
- `DragState`: Drag-and-drop state management

**`utils.ts`** (294 lines)
- Business logic calculations
- `calculateCost()`: Rental vs. Purchase cost logic
- `aggregateCosts()`: Sum totals for KPI Board
- `groupAssets()`: Hierarchical rollup for variance analysis
- `getTimelineBounds()`: Timeline viewport calculation

### Visualization Components

**`Timeline.tsx`** (~500 lines)
- Gantt chart with drag-and-drop
- Multi-layer rendering (Plan=blue, Forecast=green, Actual=orange)
- `dragOverrides` Map for live preview
- Scale switching (Day/Week/Month/Year)

**`MatrixView.tsx`** (~400 lines)
- Month-by-month cost breakdown
- Displays cost/duration/quantity metrics
- Grouping support for category/class rollups

**`GridLab.tsx`** (~200 lines)
- Tabular view with virtual scrolling
- Efficient for 20K+ records (renders only visible rows)
- Sortable columns, multi-select

### Operation Components

**`CommandDeck.tsx`** (~400 lines)
- Bulk operations center
- Key operations:
  - Shift Time (smart logic for Forecast vs. Actual)
  - Adjust Duration
  - Change Category/DOR
  - Equipment Assignment (link to Asset Master)
  - Reset to Plan
- Enforces business rules (e.g., can't move actual start dates backward)

**`FilterPanel.tsx`** (~300 lines)
- Reduces 20K records to relevant subset
- Multi-select filters (category, class, DOR, source, area)
- Date range filters
- Status filters (Forecast, Actuals, Discontinued, Funds Transferable)
- Focus mode (hide unselected)

**`KpiBoard.tsx`** (~200 lines)
- Variance metrics dashboard
- Displays: Total Plan, Total Forecast, Total Actual, Delta
- Color coding: Red = over budget, Green = under budget

### AI & Admin

**`AiAssistant.tsx`** (~600 lines)
- Google Gemini integration
- Panel mode (chat) and Voice mode (speech-to-text/TTS)
- Natural language queries: "Show me rentals over $5000 in Silo 4"
- Confirmation required for mutations
- Configured via `Organization.aiRules[]` and `SystemConfig.aiGlobalRules[]`

**`AdminDashboard.tsx`** (~400 lines)
- System administration console
- User/Org/API management
- CSV import orchestration
- Master data CRUD (Asset Master, Classifications)
- Field mapping configuration

### Data Files

**`mockData.ts`** (520K lines, 20,280 PFA records)
- Generated from CSV files via `generateMockData.js`
- Contains: `STATIC_PFA_RECORDS`, `STATIC_ASSET_MASTER`, `STATIC_CLASSIFICATION`
- **Warning**: Large file causes slow initial loads

**`generateMockData.js`** (in project root)
- Script to regenerate mockData.ts from CSV
- Run: `node generateMockData.js`
- Sources: `PFA.csv` (20,280 records), `assets.csv` (3,735 records), `class_cat.csv` (1,163 records)

## Common Tasks

### Add a New PfaRecord Field

1. Update `PfaRecord` interface in `types.ts`
2. Regenerate `mockData.ts`: `node generateMockData.js` (or manually add to `STATIC_PFA_RECORDS`)
3. Update `cloneAssets()` in `App.tsx` if field is non-primitive
4. Add to import/export mappings in `DEFAULT_EXPORT_CONFIG` (App.tsx)
5. Add column to grid view if needed (update `GridColumn[]`)

### Add a New Filter

1. Add field to `FilterState` interface in `types.ts`
2. Update `createDefaultFilters()` in `App.tsx`
3. Add UI control in `FilterPanel.tsx`
4. Update filter logic in `App.tsx` useEffect (around line 297-346)

### Add a New Bulk Operation

1. Add button/form to `CommandDeck.tsx`
2. Call `onUpdateAssets()` with transformation function
3. Ensure business rules are enforced (e.g., don't move actual start dates backward)
4. History is automatically saved via `updatePfaRecords()` wrapper

### Debug Drag-and-Drop Issues

1. Check `dragOverrides` Map in `Timeline.tsx` (should contain temp updates during drag)
2. Verify `onUpdateAsset()` or `onUpdateAssets()` is called on mouse up
3. Check `updatePfaRecords()` is invoked (triggers re-render via `setDataVersion`)
4. Inspect `allPfaRef.current` in browser DevTools (should see updated dates after drop)

### Fix Cost Calculation Issues

1. Check `source` field ('Rental' or 'Purchase')
2. Verify `utils.ts: calculateCost()` logic
3. For Rental: Ensure `monthlyRate` is set and `days / 30.44` is correct
4. For Purchase: Ensure `purchasePrice` is set (duration is ignored)
5. Check KPI Board aggregation: `aggregateCosts()` in `utils.ts`

## Known Issues

### Critical (Security)

1. **No Real Authentication**: Mock login with no password validation
   - Anyone can login as "admin" by typing the username
   - State can be manipulated in browser DevTools
   - **Fix**: Implement JWT-based backend authentication

2. **API Key Exposed**: Gemini API key embedded in client bundle via Vite define
   - Visible in browser DevTools → anyone can steal and abuse
   - **Fix**: Move API calls to backend proxy, never expose keys client-side

### High Priority (Architecture)

3. **Ref-Based State**: Violates React best practices
   - `allPfaRef` mutations don't trigger re-renders automatically
   - Hard to debug, race conditions possible
   - **Fix**: Migrate to Zustand or Redux Toolkit

4. **800 Record Limit**: Hardcoded cap in filtering (line 343-344 in App.tsx)
   - 20,280 records available but only 800 shown
   - **Fix**: Implement proper pagination or remove limit

5. **Memory Leaks**: History management stores 20 full snapshots
   - 20 snapshots × 20K records × 1KB = ~400MB RAM
   - **Fix**: Use diff-based history (store only changes)

### Medium Priority

6. **Custom CSV Parser**: Regex-based, fragile for edge cases
   - Doesn't handle newlines in quoted fields correctly
   - **Fix**: Use Papa Parse library

7. **No Error Boundaries**: One component error crashes entire app
   - **Fix**: Wrap major sections in `<ErrorBoundary>` components

8. **No Tests**: Zero test coverage
   - **Fix**: Add Vitest + Testing Library for critical functions

## Production Checklist

### Critical (Before ANY Production Use)

- [ ] Implement real JWT authentication with backend API
- [ ] Move Gemini API key to backend proxy
- [ ] Add error boundaries for fault tolerance
- [ ] Security audit (OWASP Top 10)

### High Priority

- [ ] Replace ref-based state with proper state management (Zustand/Redux)
- [ ] Remove 800 record limit or implement pagination
- [ ] Optimize history management (diff-based)
- [ ] Replace custom CSV parser with Papa Parse
- [ ] Add comprehensive error handling

### Medium Priority

- [ ] Add unit/integration tests (target 70%+ coverage)
- [ ] Implement proper backend API for persistence
- [ ] Add loading states and skeleton screens
- [ ] Audit accessibility (WCAG compliance)

### Business Integration

- [ ] Connect to ESS API for PLAN imports
- [ ] Connect to Procurement system for ACTUAL updates
- [ ] Set up scheduled imports (daily/weekly)
- [ ] Configure field mappings for client's external systems
- [ ] Test end-to-end flow: ESS → PFA Vanguard → Procurement → Finance

## External Resources

- **AI Studio**: https://ai.studio/apps/drive/1qDNhrLQ0m0jiM3gWkyzWZmIqkCzdq3Pc
- **Gemini API**: https://ai.google.dev/
- **Vite Docs**: https://vitejs.dev/
- **React 19**: https://react.dev/
