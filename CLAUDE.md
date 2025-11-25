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
# Frontend Setup
npm install

# Backend Setup
cd backend
npm install

# Setup database and seed initial data
npm run prisma:migrate
npm run prisma:seed

# Configure environment variables
# Copy .env.example to .env and configure
cp .env.example .env

# Start backend server (port 3001)
npm run dev

# In new terminal, start frontend (port 3000)
cd ..
npm run dev
```

**Login Credentials**:
- Username: `admin`
- Password: `admin123`

**Architecture**: Full-stack application with Express backend + SQLite database + React frontend

## Project Overview

**PFA Vanguard** is a construction equipment tracking system for large industrial projects. It manages the **Plan → Forecast → Actuals** lifecycle for 10,000+ equipment requirements.

**Core Purpose**: Help Project Managers ensure actual equipment costs don't exceed budgeted amounts by adjusting forecasts to navigate the gap.

**Tech Stack**:
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + Prisma ORM + SQLite (dev) / PostgreSQL (prod)
- **AI Integration**: Google Gemini AI + OpenAI + Anthropic Claude
- **Authentication**: JWT tokens + bcrypt password hashing

**Data Scale**: 20,280 PFA records + 3,735 asset master records

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

## Project Folder Structure

```
PFA2.2/
├── backend/                    # Express.js backend API
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema (Users, Orgs, PFA, AI, APIs)
│   │   ├── migrations/        # Database migrations
│   │   ├── seed.ts            # Seed data (admin user, orgs, AI providers)
│   │   └── dev.db             # SQLite database (development)
│   ├── src/
│   │   ├── config/            # Environment and database config
│   │   ├── controllers/       # Route controllers (auth, AI, PEMS, APIs)
│   │   ├── middleware/        # Authentication, rate limiting
│   │   ├── models/            # Business logic models
│   │   ├── routes/            # API route definitions
│   │   ├── services/          # Business services (auth, AI, encryption)
│   │   ├── types/             # TypeScript types
│   │   ├── utils/             # Utilities (logger, encryption)
│   │   └── server.ts          # Express app entry point
│   ├── .env                   # Backend environment variables
│   └── package.json           # Backend dependencies
│
├── components/                # React UI components
│   ├── admin/                 # Admin dashboard components
│   │   ├── ApiConnectivity.tsx    # PEMS & AI API management
│   │   ├── ApiManager.tsx         # API config CRUD
│   │   └── SystemManager.tsx      # System settings
│   ├── AdminDashboard.tsx     # Main admin panel
│   ├── CommandDeck.tsx        # Bulk operations UI
│   ├── FilterPanel.tsx        # Multi-dimensional filters
│   ├── GridLab.tsx            # Tabular data view
│   ├── KpiBoard.tsx           # Variance dashboard
│   ├── LoginScreen.tsx        # Authentication UI
│   ├── MatrixView.tsx         # Month-by-month breakdown
│   └── Timeline.tsx           # Gantt chart with drag-and-drop
│
├── contexts/                  # React contexts
│   └── AuthContext.tsx        # JWT authentication state
│
├── services/                  # Frontend API clients
│   └── apiClient.ts           # HTTP client for backend API
│
├── .env.local                 # Frontend environment variables
├── App.tsx                    # Main React app (sandbox pattern)
├── mockData.ts                # Static PFA/Asset data (20K+ records)
├── types.ts                   # Shared TypeScript types
├── utils.ts                   # Business logic utilities
└── package.json               # Frontend dependencies
```

### Backend API Endpoints

**Authentication**:
- `POST /api/auth/login` - User login (returns JWT token)
- `POST /api/auth/register` - Create user (admin only)
- `POST /api/auth/verify` - Verify JWT token

**AI**:
- `POST /api/ai/chat` - Send AI chat request
- `GET /api/ai/usage` - Get AI usage statistics

**PEMS Integration**:
- `GET /api/pems/configs` - Get PEMS configurations
- `POST /api/pems/test` - Test PEMS connection
- `POST /api/pems/sync` - Sync PFA data from PEMS

**API Management**:
- `GET /api/configs` - Get API configurations
- `POST /api/configs` - Create API configuration
- `PUT /api/configs/:id` - Update API configuration
- `DELETE /api/configs/:id` - Delete API configuration
- `POST /api/configs/:id/test` - Test API connection

## Authentication & Security

### Authentication Flow

1. **User Login**:
   - User enters username and password in `LoginScreen.tsx`
   - Frontend sends POST request to `/api/auth/login` via `apiClient.ts`
   - Backend validates credentials using bcrypt password hashing
   - On success, backend returns JWT token + user data
   - Frontend stores token in localStorage and user data in AuthContext

2. **Authenticated Requests**:
   - All API requests include `Authorization: Bearer <token>` header
   - Backend middleware verifies JWT on protected routes
   - Token contains userId, username, role, and organizationIds

3. **Session Management**:
   - JWT tokens expire after configured time (default: 7 days)
   - Token stored in localStorage for persistence
   - On app load, token is verified with `/api/auth/verify`
   - Invalid/expired tokens trigger logout

### Security Features

**Password Security**:
- Passwords hashed with bcrypt (10 rounds)
- Stored as `passwordHash` in database (plaintext never stored)
- Generic "Invalid credentials" error prevents username enumeration

**JWT Token Security**:
- Signed with secret key (stored in backend .env)
- Contains minimal claims (no sensitive data)
- Tokens validated on every protected API request

**Database Security**:
- User model includes `isActive` flag for account management
- Role-based access control (admin, user, viewer)
- Organization-level data isolation

**API Security**:
- CORS configured for allowed origins
- Global rate limiting (100 requests/15 minutes per IP)
- Request logging for audit trails

**Credentials in Database**:
- Admin user: `admin` / `admin123` (created via `prisma/seed.ts`)
- Additional users can be created via `/api/auth/register` (admin only)
- User credentials stored in `users` table with bcrypt hashes

## PEMS Data Synchronization

**PFA Vanguard** integrates with **PEMS Grid Data API** (HxGN EAM) to synchronize PFA records, asset master data, and classification data from external construction management systems.

### Sync Architecture

**Key Components**:
- **Backend Service**: `backend/src/services/pemsSyncService.ts` - Handles batch processing and API calls
- **Controller**: `backend/src/controllers/pemsSyncController.ts` - REST endpoints for sync operations
- **Database Schema**: Sync tracking fields in `ApiConfiguration` model
- **Frontend UI**: `components/admin/ApiConnectivity.tsx` - Sync button and progress tracking

**Sync Flow**:
```
1. User clicks "Sync Data" button in API Connectivity UI
2. Frontend calls POST /api/pems/sync with organizationId and syncType
3. Backend starts sync in background (non-blocking)
4. Frontend polls GET /api/pems/sync/:syncId for progress updates
5. Backend processes data in batches (10,000 records/API call, 1,000 records/DB batch)
6. On completion, sync statistics saved to ApiConfiguration table
7. UI displays updated sync metrics (first sync, last sync, record counts)
```

### Sync Tracking Fields

Added to `ApiConfiguration` schema (migration `20251125040401_add_sync_tracking_fields`):

```prisma
model ApiConfiguration {
  // ... existing fields ...

  // Sync Tracking (for APIs with feeds configured)
  firstSyncAt           DateTime?    // Date of first successful data sync
  lastSyncAt            DateTime?    // Date of most recent data sync
  lastSyncRecordCount   Int?         // Records synced in last operation
  totalSyncRecordCount  Int?         // Lifetime total records synced
}
```

**Field Usage**:
- `firstSyncAt`: Set only on first successful sync, never updated again
- `lastSyncAt`: Updated after every successful sync with completion timestamp
- `lastSyncRecordCount`: Shows records inserted + updated in most recent sync
- `totalSyncRecordCount`: Cumulative total across all syncs (previous total + new records)

### API Configuration Feeds

The `feeds` field (JSON string) defines what data an API synchronizes:

```typescript
// PEMS PFA Read API
feeds: JSON.stringify([{
  entity: 'pfa',
  views: ['Timeline Lab', 'Matrix', 'Grid Lab', 'PFA 1.0 Lab', 'PFA Master Data']
}])

// PEMS PFA Write API
feeds: JSON.stringify([{
  entity: 'pfa',
  operation: 'write'
}])

// PEMS Assets API
feeds: JSON.stringify([{
  entity: 'asset_master',
  views: ['Asset Master']
}])

// PEMS Classes API
feeds: JSON.stringify([{
  entity: 'classifications',
  views: ['Classifications Master Data']
}])
```

**UI Behavior**: The green "Sync Data" button only appears for APIs with non-null `feeds` configuration.

### Sync Endpoints

**Start Sync**:
```
POST /api/pems/sync
Body: { organizationId: string, syncType: 'full' | 'incremental' }
Response: { success: true, syncId: string, message: string, status: 'running' }
```

**Get Sync Progress**:
```
GET /api/pems/sync/:syncId
Response: {
  syncId: string,
  status: 'running' | 'completed' | 'failed',
  organizationId: string,
  progress: { total, processed, inserted, updated, errors, percentage },
  batch: { current, total },
  timing: { startedAt, completedAt, duration },
  error: string | null
}
```

### Frontend Authentication

**JWT Token Storage**:
- Token stored in localStorage under key `'pfa_auth_token'` (not `'token'`)
- User data stored under key `'pfa_user_data'`
- All authenticated API calls use `apiClient` service which automatically includes the token

**Important**: Always use `apiClient` methods for API calls instead of manual `fetch()` calls. The `apiClient` service handles:
- Token retrieval from correct localStorage key
- Authorization header injection
- Error handling and token cleanup on 401 responses

**Example**:
```typescript
// ✅ CORRECT - Uses apiClient service
const data = await apiClient.syncPemsData(organizationId, 'full');

// ❌ WRONG - Manual fetch with hardcoded token key
const token = localStorage.getItem('token'); // Wrong key!
const response = await fetch('/api/pems/sync', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### UI Sync Tracking Columns

**API Connectivity Table** displays four sync tracking columns:

| Column | Description | Format | Display Condition |
|--------|-------------|--------|-------------------|
| **First Sync** | Date of first successful sync | `MMM DD, YYYY` | Only if `feeds` configured |
| **Last Sync** | Date and time of most recent sync | `MMM DD, YYYY HH:MM` | Only if `feeds` configured |
| **Last Pull** | Records synced in last operation | `1,234` (with thousands separator) | Only if `feeds` configured |
| **Total Records** | Lifetime cumulative records | `12,345` (bold blue, thousands separator) | Only if `feeds` configured |

**Empty State**: Shows "Never" or "—" for APIs that have never been synced.

### Batch Processing

**Performance Characteristics**:
- **API Page Size**: 10,000 records per PEMS Grid Data API call
- **Database Batch Size**: 1,000 records per Prisma transaction
- **Memory Safety**: Processes large datasets without loading all into memory
- **Progress Tracking**: Real-time updates via polling (2-second interval)

**Organization Filtering**:
- Authentication uses organization from API configuration (`'BECH'` for PEMS)
- Data filtering uses actual organization code from database records
- Supports multi-organization scenarios (e.g., RIO, HOLNG separate projects)

### Utility Scripts

**Check Feeds Status**:
```bash
cd backend
npx tsx check-feeds.ts
```
Displays current `feeds` configuration and sync statistics for all API configurations.

**Update Feeds Configuration**:
```bash
cd backend
npx tsx update-feeds.ts
```
Manually populates `feeds` field for PEMS APIs. Use if seed script didn't update existing records.

**Clear PFA Data**:
```bash
cd backend
npx tsx clear-pfa-data.ts
```
Deletes all PFA records from database before full sync. Useful for testing sync from scratch.

### Troubleshooting Sync Issues

**Sync Button Not Visible**:
- Check if `feeds` field is NULL in database (run `check-feeds.ts`)
- If NULL, run `update-feeds.ts` to populate
- Verify API configuration has `operationType: 'read'` or appropriate operation

**Authentication Errors (401)**:
- Ensure using `apiClient` service methods, not manual `fetch()`
- Token is stored under `'pfa_auth_token'` key, not `'token'`
- Check token expiration (default 7 days)
- Try logout and login again

**Sync Performance Issues**:
- Reduce `PAGE_SIZE` in `pemsSyncService.ts` if API timeouts occur
- Increase `BATCH_SIZE` if database writes are slow (max 1000 recommended)
- Monitor backend logs for API latency and database transaction times

**Data Not Appearing After Sync**:
- Verify organization code filtering in `pemsSyncService.ts`
- Check that records have correct `organizationId` in database
- Ensure frontend filters are not hiding synced records

### Related Files

**Backend**:
- `backend/src/services/pemsSyncService.ts` - Core sync logic with batch processing
- `backend/src/controllers/pemsSyncController.ts` - REST endpoints and progress tracking
- `backend/src/routes/pems.ts` - Route definitions for PEMS endpoints
- `backend/prisma/schema.prisma` - Database schema with sync tracking fields
- `backend/prisma/migrations/20251125040401_add_sync_tracking_fields/` - Migration for sync fields
- `backend/check-feeds.ts` - Utility to verify feeds configuration
- `backend/update-feeds.ts` - Utility to populate feeds field
- `backend/clear-pfa-data.ts` - Utility to clear PFA records

**Frontend**:
- `components/admin/ApiConnectivity.tsx` - Sync UI with button, progress modal, and tracking columns
- `services/apiClient.ts` - HTTP client with JWT authentication and sync methods

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

1. **API Keys in Environment Variables**: AI provider API keys stored in backend .env
   - Keys are server-side only (good), but need proper secrets management
   - **Fix**: Use AWS Secrets Manager, Azure Key Vault, or similar for production

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

- [x] Implement JWT authentication with backend API ✅
- [x] Move AI API keys to backend proxy ✅
- [x] Use generic "Invalid credentials" error message (prevents username enumeration) ✅
- [ ] Migrate to proper secrets management (AWS Secrets Manager / Azure Key Vault)
- [ ] Add error boundaries for fault tolerance
- [ ] Security audit (OWASP Top 10)
- [ ] Migrate database from SQLite to PostgreSQL

### High Priority

- [ ] Replace ref-based state with proper state management (Zustand/Redux)
- [ ] Remove 800 record limit or implement pagination
- [ ] Optimize history management (diff-based)
- [ ] Replace custom CSV parser with Papa Parse
- [ ] Add comprehensive error handling

### Medium Priority

- [ ] Add unit/integration tests (target 70%+ coverage)
- [x] Implement backend API with Prisma ORM ✅
- [ ] Add loading states and skeleton screens
- [ ] Audit accessibility (WCAG compliance)
- [ ] Add rate limiting per user (currently global only)

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


```

**ErrorBoundary Features**:

- Automatic fallback UI with retry/refresh options
- Development mode error details
- Custom error handling callbacks
- Integration with NextUI design system

**ErrorFallback Variants**:

- `default` - Full error display with actions
- `minimal` - Compact inline error message  
- `minimal` - Compact inline error message
- `detailed` - Includes error stack trace in development

## Visual Development & Testing

### Design System

The project follows S-Tier SaaS design standards inspired by Stripe, Airbnb, and Linear. All UI development must adhere to:

- **Design Principles**: `/context/design-principles.md` - Comprehensive checklist for world-class UI
- **Component Library**: NextUI with custom Tailwind configuration

### Quick Visual Check

**IMMEDIATELY after implementing any front-end change:**

1. **Identify what changed** - Review the modified components/pages
2. **Navigate to affected pages** - Use `mcp__playwright__browser_navigate` to visit each changed view
3. **Verify design compliance** - Compare against `/context/design-principles.md`
4. **Validate feature implementation** - Ensure the change fulfills the user's specific request
5. **Check acceptance criteria** - Review any provided context files or requirements
6. **Capture evidence** - Take full page screenshot at desktop viewport (1440px) of each changed view
7. **Check for errors** - Run `mcp__playwright__browser_console_messages` ⚠️

This verification ensures changes meet design standards and user requirements.

### Comprehensive Design Review

For significant UI changes or before merging PRs, use the design review agent:

```bash
# Option 1: Use the slash command
/design-review

# Option 2: Invoke the agent directly
@agent-design-review
```

The design review agent will:

- Test all interactive states and user flows
- Verify responsiveness (desktop/tablet/mobile)
- Check accessibility (WCAG 2.1 AA compliance)
- Validate visual polish and consistency
- Test edge cases and error states
- Provide categorized feedback (Blockers/High/Medium/Nitpicks)

### Playwright MCP Integration

#### Essential Commands for UI Testing

```javascript
// Navigation & Screenshots
mcp__playwright__browser_navigate(url); // Navigate to page
mcp__playwright__browser_take_screenshot(); // Capture visual evidence
mcp__playwright__browser_resize(
  width,
  height
); // Test responsiveness

// Interaction Testing
mcp__playwright__browser_click(element); // Test clicks
mcp__playwright__browser_type(
  element,
  text
); // Test input
mcp__playwright__browser_hover(element); // Test hover states

// Validation
mcp__playwright__browser_console_messages(); // Check for errors
mcp__playwright__browser_snapshot(); // Accessibility check
mcp__playwright__browser_wait_for(
  text / element
); // Ensure loading
```

### Design Compliance Checklist

When implementing UI features, verify:

- [ ] **Visual Hierarchy**: Clear focus flow, appropriate spacing
- [ ] **Consistency**: Uses design tokens, follows patterns
- [ ] **Responsiveness**: Works on mobile (375px), tablet (768px), desktop (1440px)
- [ ] **Accessibility**: Keyboard navigable, proper contrast, semantic HTML
- [ ] **Performance**: Fast load times, smooth animations (150-300ms)
- [ ] **Error Handling**: Clear error states, helpful messages
- [ ] **Polish**: Micro-interactions, loading states, empty states

## When to Use Automated Visual Testing

### Use Quick Visual Check for:

- Every front-end change, no matter how small
- After implementing new components or features
- When modifying existing UI elements
- After fixing visual bugs
- Before committing UI changes

### Use Comprehensive Design Review for:

- Major feature implementations
- Before creating pull requests with UI changes
- When refactoring component architecture
- After significant design system updates
- When accessibility compliance is critical

### Skip Visual Testing for:

- Backend-only changes (API, database)
- Configuration file updates
- Documentation changes
- Test file modifications
- Non-visual utility functions

## Environment Setup

Requires these environment variables:
@@ -164,9 +277,8 @@ Requires these environment variables:
- Cloudinary configuration
- Email service credentials (Resend)

[byterover-mcp]

# important
## Additional Context

always use byterover-retrive-knowledge tool to get the related context before any tasks
always use byterover-store-knowledge to store all the critical informations after sucessful tasks
- Design review agent configuration: `/.claude/agents/design-review-agent.md`
- Design principles checklist: `/context/design-principles.md`
- Custom slash commands: `/context/design-review-slash-command.md`