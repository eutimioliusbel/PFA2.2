# Frontend Documentation

**Last Updated:** 2025-11-25
**Status:** Current

> **Purpose**: Frontend-specific documentation including React components, state management patterns, hooks, and UI architecture.

---

## 📖 Available Documentation

### Component Catalog

| Document | Purpose | Status |
|----------|---------|--------|
| **COMPONENTS.md** | React component reference | 📋 Planned |
| **STATE_MANAGEMENT.md** | Sandbox pattern deep dive | 📋 Planned |
| **HOOKS.md** | Custom hooks reference | 📋 Planned |

**Note**: Frontend documentation is primarily in [ARCHITECTURE.md Section 6](../ARCHITECTURE.md#6-frontend-architecture) until dedicated docs are created.

---

## 🎨 Frontend Architecture Overview

**Tech Stack**:
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State**: Ref-based sandbox pattern (to be migrated to Zustand)
- **Virtual Scrolling**: Custom implementation for 20K+ records

**Key Patterns**:
- **Sandbox Pattern**: Dual-ref (`allPfaRef` + `baselinePfaRef`) for undo/redo
- **Drag-and-Drop**: `dragOverrides` Map for live preview
- **Virtual Scrolling**: Renders only visible rows (efficient for 20K records)
- **Multi-Organization**: Context switching with isolated filters

---

## 📂 Frontend File Structure

```
PFA2.2/
├── components/                 # React UI components
│   ├── admin/                  # Admin dashboard components
│   │   ├── ApiConnectivity.tsx     # PEMS & AI API management
│   │   ├── ApiManager.tsx          # API config CRUD
│   │   ├── DataSourceManager.tsx   # Data source mappings
│   │   └── SystemManager.tsx       # System settings
│   ├── AdminDashboard.tsx      # Main admin panel
│   ├── CommandDeck.tsx         # Bulk operations UI
│   ├── FilterPanel.tsx         # Multi-dimensional filters
│   ├── GridLab.tsx             # Tabular data view
│   ├── KpiBoard.tsx            # Variance dashboard
│   ├── LoginScreen.tsx         # Authentication UI
│   ├── MatrixView.tsx          # Month-by-month breakdown
│   └── Timeline.tsx            # Gantt chart with drag-and-drop
├── contexts/                   # React contexts
│   └── AuthContext.tsx         # JWT authentication state
├── services/                   # Frontend API clients
│   └── apiClient.ts            # HTTP client for backend API
├── App.tsx                     # Main React app (890 lines)
├── types.ts                    # TypeScript interfaces (336 lines)
├── utils.ts                    # Business logic utilities (294 lines)
└── mockData.ts                 # Static PFA data (20K records)
```

---

## 🧩 Key Components

### Core UI Components

| Component | Purpose | Lines | Key Features |
|-----------|---------|-------|--------------|
| **App.tsx** | Root state manager | 890 | Sandbox pattern, undo/redo, org switching |
| **Timeline.tsx** | Gantt chart | ~500 | Drag-and-drop, multi-layer, scale switching |
| **MatrixView.tsx** | Month breakdown | ~400 | Cost/duration/quantity, grouping |
| **GridLab.tsx** | Tabular view | ~200 | Virtual scrolling, sortable, multi-select |
| **CommandDeck.tsx** | Bulk operations | ~400 | Smart logic for Forecast vs. Actual |
| **FilterPanel.tsx** | Multi-filters | ~300 | Category, class, DOR, source, date range |
| **KpiBoard.tsx** | Variance dashboard | ~200 | Total Plan/Forecast/Actual, delta |

### Admin Components

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| **AdminDashboard.tsx** | Admin console | User/Org/API management |
| **ApiConnectivity.tsx** | PEMS sync UI | Sync button, progress tracking |
| **DataSourceManager.tsx** | API mappings | Priority-based fallback config |

---

## 🔧 Critical Patterns

### Sandbox Pattern (Dual-Ref Architecture)

```typescript
// App.tsx - Core state management
const allPfaRef = useRef<PfaRecord[]>([]);      // Working sandbox
const baselinePfaRef = useRef<PfaRecord[]>([]); // Committed truth

// All mutations use this wrapper
const updatePfaRecords = (fn: (assets: PfaRecord[]) => PfaRecord[]) => {
  pushHistory();                    // Save for undo
  allPfaRef.current = fn(allPfaRef.current); // Mutate sandbox
  setDataVersion(v => v + 1);       // Trigger re-render
};

// Discard changes
const handleDiscardChanges = () => {
  allPfaRef.current = cloneAssets(baselinePfaRef.current);
};
```

**Why Refs**: Enables 20-level undo/redo without re-render spam

**Critical Rule**: ❌ Never mutate `allPfaRef.current` directly. ✅ Always use `updatePfaRecords()` wrapper.

### Drag-and-Drop with Live Preview

```typescript
// Timeline.tsx - Drag preview without mutation
const [dragOverrides, setDragOverrides] = useState<Map<string, DragUpdate>>(new Map());

// During drag: Store overrides in Map (no data mutation)
const handleMouseMove = (e: MouseEvent) => {
  // Calculate new position
  setDragOverrides(new Map([[id, { start, end, layer }]]));
};

// On drop: Apply via callback
const handleMouseUp = () => {
  if (dragOverrides.size > 0) {
    onUpdateAssets(Array.from(dragOverrides.entries()));
  }
  setDragOverrides(new Map());
};
```

### Virtual Scrolling

```typescript
// GridLab.tsx - Render only visible rows
const visibleStart = Math.floor(scrollTop / ROW_HEIGHT);
const visibleEnd = Math.min(visibleStart + visibleCount, records.length);
const visibleRecords = records.slice(visibleStart, visibleEnd);

// Render with offset
<div style={{ transform: `translateY(${visibleStart * ROW_HEIGHT}px)` }}>
  {visibleRecords.map(record => <Row {...record} />)}
</div>
```

---

## 🚀 Quick Start

### Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev  # Runs on port 3000

# Build for production
npm run build
```

### Component Development

1. Create component in `components/` folder
2. Follow naming: PascalCase.tsx
3. Use TypeScript with strict mode
4. Follow 20-line function rule (see [CODING_STANDARDS.md](../CODING_STANDARDS.md))
5. Add to relevant section (admin, visualization, etc.)

### Adding Features

**Add PFA Field**:
1. Update `PfaRecord` interface in `types.ts`
2. Update `cloneAssets()` if field is non-primitive
3. Add to export config in `App.tsx`
4. Add column to `GridLab.tsx` if needed

**Add Filter**:
1. Update `FilterState` interface in `types.ts`
2. Update `createDefaultFilters()` in `App.tsx`
3. Add UI control in `FilterPanel.tsx`
4. Update filter logic in `App.tsx` useEffect

**Add Bulk Operation**:
1. Add button to `CommandDeck.tsx`
2. Call `onUpdateAssets()` with transformation
3. Enforce business rules (e.g., can't move actual start dates backward)

---

## 🔗 Related Documentation

- **[../ARCHITECTURE.md Section 6](../ARCHITECTURE.md#6-frontend-architecture)** - Detailed frontend architecture
- **[../CODING_STANDARDS.md Section 5](../CODING_STANDARDS.md#5-react--frontend-standards)** - React coding standards
- **[../CLAUDE.md](../../CLAUDE.md)** - Common tasks and patterns

---

## 📝 Known Issues & Technical Debt

### High Priority

| Issue | Impact | Fix |
|-------|--------|-----|
| **Ref-Based State** | Hard to debug, race conditions | Migrate to Zustand/Redux |
| **800 Record Limit** | Users can't see all 20K records | Remove limit or add pagination |
| **Memory Leaks** | 20 snapshots × 20K records = ~400MB | Use diff-based history |

### Medium Priority

| Issue | Impact | Fix |
|-------|--------|-----|
| **No Error Boundaries** | One error crashes entire app | Add `<ErrorBoundary>` components |
| **No Loading States** | Blank screen during API calls | Add skeleton screens |
| **Custom CSV Parser** | Fragile for edge cases | Use Papa Parse library |

See [../ARCHITECTURE.md Section 13](../ARCHITECTURE.md#13-known-issues--technical-debt) for complete list.

---

## 📝 Contributing

When adding frontend documentation:

1. **Components**: Document in COMPONENTS.md (once created)
2. **Patterns**: Update STATE_MANAGEMENT.md or ARCHITECTURE.md
3. **Hooks**: Add to HOOKS.md (once created)
4. **Performance**: Document optimizations in ARCHITECTURE.md

---

**Questions?** See [DOCUMENTATION_STANDARDS.md](../DOCUMENTATION_STANDARDS.md) or [docs/README.md](../README.md)
