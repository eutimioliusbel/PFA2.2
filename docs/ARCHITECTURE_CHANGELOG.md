# ARCHITECTURE CHANGELOG

**Document Version:** 1.0
**Last Updated:** 2025-11-25
**Status:** Current

> **Purpose**: This document tracks all significant architectural changes, design decisions, and system evolution of PFA Vanguard.

---

## Table of Contents

1. [2025-11-25: Data Source Mapping System](#2025-11-25-data-source-mapping-system)
2. [2025-11-25: Database Schema Consolidation](#2025-11-25-database-schema-consolidation)
3. [2025-11-25: PEMS Sync Architecture](#2025-11-25-pems-sync-architecture)
4. [2025-11-24: Backend Infrastructure Foundation](#2025-11-24-backend-infrastructure-foundation)
5. [2025-11-15: Frontend Architecture Patterns](#2025-11-15-frontend-architecture-patterns)

---

## 2025-11-25: Data Source Mapping System

**Type**: Major Enhancement
**Impact**: High
**Status**: Implemented

### Problem Statement

System had tight coupling between API configurations and sync functionality. Code used hardcoded checks of API usage types to determine which sync method to call. This made it impossible to swap APIs or configure fallbacks without code changes.

**User Concern**: "Should we have a way in the UI to make that association, so we could discontinue an API in the future and add another one for the same data?"

### Solution Overview

Created a configurable API-to-Entity mapping system with database schema, orchestrator service, and admin UI.

### Architecture Changes

#### 1. Database Schema
**New Model**: `DataSourceMapping`

```prisma
model DataSourceMapping {
  id              String            @id @default(uuid())
  entityType      String            // 'pfa', 'organizations', 'asset_master', 'classifications'
  apiConfigId     String
  apiConfig       ApiConfiguration  @relation(fields: [apiConfigId], references: [id])
  organizationId  String?           // null = global, non-null = org-specific
  organization    Organization?     @relation(fields: [organizationId], references: [id])
  priority        Int               @default(1) // 1 = primary, 2+ = fallbacks
  isActive        Boolean           @default(true)

  // Performance Metrics
  lastUsedAt      DateTime?
  lastSuccessAt   DateTime?
  lastFailureAt   DateTime?
  totalSyncs      Int               @default(0)
  successfulSyncs Int               @default(0)
  failedSyncs     Int               @default(0)
  avgResponseTime Float?

  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@unique([entityType, organizationId, priority])
  @@index([entityType, isActive])
  @@index([organizationId])
}
```

**Migration**: `20251125120420_add_data_source_mapping`

#### 2. Service Layer
**New Service**: `DataSourceOrchestrator` (`backend/src/services/DataSourceOrchestrator.ts`)

**Key Methods**:
- `getActiveDataSource()`: Get active mapping (org-specific or global)
- `executeSync()`: Execute sync using configured API
- `getFallbackDataSource()`: Automatic fallback on primary failure
- `recordSyncMetrics()`: Track performance metrics
- `getMappingMetrics()`: Calculate success rates and response times

**Pattern**: Orchestrator Pattern (decouples routing logic from sync service)

#### 3. API Layer
**New Controller**: `dataSourceController` (`backend/src/controllers/dataSourceController.ts`)
**New Routes**: `dataSource.ts` (8 endpoints)

**Endpoints**:
- `GET /api/data-sources/mappings` - Get all mappings
- `GET /api/data-sources/mappings/:id` - Get specific mapping
- `GET /api/data-sources/mappings/:id/metrics` - Performance metrics
- `POST /api/data-sources/mappings` - Create mapping
- `PATCH /api/data-sources/mappings/:id` - Update mapping
- `DELETE /api/data-sources/mappings/:id` - Delete mapping
- `GET /api/data-sources/entity-types/:type/active` - Get active mapping
- `GET /api/data-sources/entity-types/:type/mappings` - Get all mappings for entity

#### 4. Frontend UI
**New Component**: `DataSourceManager` (`components/admin/DataSourceManager.tsx`)

**Features**:
- Display entity types with active APIs
- Success rate visualization
- Performance metrics display
- Toggle active/inactive status
- Expandable metrics panel

### Design Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| **Database-Driven Configuration** | Runtime config without deployments | Requires seed data to bootstrap |
| **Priority-Based Fallback** | Simple, flexible, unlimited fallbacks | Must enforce unique constraint |
| **Organization Overrides** | Multi-tenant flexibility | Lookup checks org-specific first, then global |
| **Metrics in Same Table** | Keeps related data together | Mixes config with metrics (acceptable) |
| **Orchestrator Pattern** | Decouples routing from sync logic | Additional layer of abstraction |

### Backward Compatibility

 **Fully Backward Compatible**
- Orchestrator uses same `SyncProgress` interface
- Existing sync methods unchanged
- No breaking changes to frontend or backend APIs

### Performance Impact

- **Database Queries**: +1 query per sync (lookup mapping)
- **Response Time**: Negligible (<10ms)
- **Memory**: +4KB per mapping (8 fields × 500 bytes)

### Migration Guide

1. Run database migration: `npx prisma migrate deploy`
2. Seed mappings: Automatic on server start
3. No code changes required (backward compatible)

**Related**:
- [RELEASE_NOTES.md v1.1.0](../RELEASE_NOTES.md#version-110---data-source-mapping-system-2025-11-25)
- [ARCHITECTURE.md Section 5.2](./ARCHITECTURE.md#52-core-models)

---

## 2025-11-25: Database Schema Consolidation

**Type**: Refactoring
**Impact**: Medium
**Status**: Implemented

### Problem Statement

Database contained unused organizations (HOLNG, PEMS_Global) that were causing confusion in development and testing. Organization structure was more complex than needed.

### Solution Overview

Simplified database to two active organizations (RIO, PORTARTHUR) and updated all user relationships.

### Architecture Changes

#### 1. Organizations Removed
- L **HOLNG** (Houston LNG Project)
- L **PEMS_Global** (Global PEMS Organization)

#### 2. Organizations Kept
-  **RIO** (Rio Tinto Project)
-  **PORTARTHUR** (Port Arthur LNG Project)

#### 3. User Relationships Updated
All 6 users now have access to **BOTH** organizations:
- admin (owner role)
- RRECTOR, UROSA, CHURFORD, TESTRADA, SBRYSON (member roles)

#### 4. PEMS Configuration Updated
**File**: `backend/init-pems-credentials.ts`

Changed from:
```typescript
organization: 'BECHTEL_DEV' // Global override
```

To:
```typescript
organization: orgCode // Dynamic per organization (RIO, PORTARTHUR)
```

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Two Organizations** | Aligns with actual PEMS data structure |
| **All Users Access Both** | Simplifies testing and development |
| **Dynamic Organization** | PEMS sync now correctly filters by org code |

### Data Migration

**Script Used**: `backend/cleanup-old-orgs.ts` (deleted after use)

**Steps**:
1. Deleted HOLNG and PEMS_Global organizations
2. Removed associated user-organization links
3. Removed associated AI configurations
4. Removed associated PFA records (there were 0)
5. Updated seed script

### Impact Assessment

- **Breaking Changes**: None (no external dependencies on HOLNG or PEMS_Global)
- **Data Loss**: 0 PFA records deleted (organizations had no data)
- **User Impact**: Simplified organization selector (2 instead of 4 orgs)

**Related**:
- [RELEASE_NOTES.md v1.0.1](../RELEASE_NOTES.md#version-101---database-cleanup-2025-11-25)

---

## 2025-11-25: PEMS Sync Architecture

**Type**: New Feature
**Impact**: High
**Status**: Implemented

### Problem Statement

No automated way to sync data from PEMS Grid Data API (HxGN EAM). Manual data import was error-prone and time-consuming.

### Solution Overview

Complete end-to-end PEMS synchronization system with batch processing, progress tracking, and organization filtering.

### Architecture Changes

#### 1. Database Schema Updates
**Model**: `ApiConfiguration`

Added sync tracking fields:
```prisma
firstSyncAt           DateTime?    // Date of first successful data sync
lastSyncAt            DateTime?    // Date of most recent data sync
lastSyncRecordCount   Int?         // Records synced in last operation
totalSyncRecordCount  Int?         // Lifetime total records synced
```

**Migration**: `20251125040401_add_sync_tracking_fields`

#### 2. Service Layer
**New Service**: `PemsSyncService` (`backend/src/services/pemsSyncService.ts`)

**Key Methods**:
- `syncPfaData()`: Sync PFA records
- `syncOrganizationData()`: Sync organizations
- `syncAssetMasterData()`: Sync asset master (planned)
- `syncClassificationData()`: Sync classifications (planned)

**Pattern**: Batch Processing Pattern

**Characteristics**:
- API Page Size: 10,000 records per call
- Database Batch Size: 1,000 records per transaction
- Memory-safe streaming (doesn't load all into memory)
- Organization filtering for multi-tenancy

#### 3. Controller Layer
**New Controller**: `pemsSyncController` (`backend/src/controllers/pemsSyncController.ts`)

**Endpoints**:
- `POST /api/pems/sync` - Start sync (non-blocking)
- `GET /api/pems/sync/:syncId` - Get sync progress

**Pattern**: Background Processing with Polling

#### 4. Frontend UI
**Updated Component**: `ApiConnectivity` (`components/admin/ApiConnectivity.tsx`)

**New UI Elements**:
- Four sync tracking columns (First Sync, Last Sync, Last Pull, Total Records)
- Sync Data button (green, database icon)
- Progress modal (real-time updates via polling)

### Design Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| **Background Processing** | Prevents request timeouts | Requires polling for status |
| **10K API Page Size** | Optimal for PEMS API | May timeout on slow connections |
| **1K DB Batch Size** | Prisma transaction limit | Could be larger if needed |
| **Polling Interval (2s)** | Balance responsiveness and server load | More frequent = more requests |
| **Organization Filtering** | Multi-tenant data isolation | Complex sync logic |

### Authentication Fix

**Problem**: JWT token failing with 401 "Invalid token" error

**Root Cause**: Code was using `localStorage.getItem('token')` but actual token stored under `'pfa_auth_token'` key

**Solution**: Migrated all sync operations to use `apiClient` service which handles correct token key

### Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| **API Page Size** | 10,000 records | Per PEMS Grid Data API call |
| **Database Batch Size** | 1,000 records | Per Prisma transaction |
| **Polling Interval** | 2 seconds | Progress updates frequency |
| **Memory Usage** | Minimal | Streams data without loading all into memory |
| **Sync Time (20K records)** | ~3 minutes | Depends on API latency |

### Migration Guide

1. Run database migration: `npx prisma migrate deploy`
2. Update feeds configuration: `npx tsx update-feeds.ts`
3. Test sync with small organization first
4. Monitor backend logs for errors

**Related**:
- [RELEASE_NOTES.md v1.0.0](../RELEASE_NOTES.md#version-100---pems-data-synchronization-2025-11-25)
- [CLAUDE.md PEMS Integration](../CLAUDE.md#pems-data-synchronization)

---

## 2025-11-24: Backend Infrastructure Foundation

**Type**: New Feature
**Impact**: Critical
**Status**: Implemented

### Problem Statement

Frontend had direct API calls to Gemini AI (API keys in client bundle - security risk). No backend infrastructure for authentication, data management, or AI orchestration.

### Solution Overview

Complete backend API with Express.js, Prisma ORM, JWT authentication, multi-provider AI support, and PEMS integration.

### Architecture Changes

#### 1. Technology Stack Selection
| Technology | Version | Rationale |
|------------|---------|-----------|
| **Express.js** | 4.x | Industry standard, mature ecosystem |
| **TypeScript** | 5.x | Type safety, better tooling |
| **Prisma ORM** | 5.22.0 | Type-safe queries, excellent migrations |
| **SQLite** | 3.x | Development simplicity, zero setup |
| **PostgreSQL** | 14.x+ | Production target, ACID compliance |
| **JWT** | - | Stateless authentication |
| **bcrypt** | - | Industry standard password hashing |

#### 2. Database Schema Design
**9 Models Created**:
1. `User` - Authentication and profile
2. `Organization` - Projects/tenants
3. `UserOrganization` - Many-to-many with roles
4. `AiProvider` - Multi-provider configs
5. `OrganizationAiConfig` - Per-org AI settings
6. `AiUsageLog` - Token tracking with cost rollup
7. `ApiConfiguration` - PEMS and external APIs
8. `PfaRecord` - Equipment tracking
9. `SyncLog` - Sync audit trail

**Key Patterns**:
- UUID primary keys (not auto-increment)
- Cascading deletes for data integrity
- Indexes on frequently queried fields
- SQLite compatible (no JSON type)

#### 3. Service Layer Architecture
**Pattern**: Service Layer Pattern (separation of concerns)

**Services Created**:
- `authService` - Login/register logic
- `AiService` - AI orchestration
- `GeminiAdapter` - Google Gemini
- `OpenAIAdapter` - OpenAI GPT
- `AnthropicAdapter` - Anthropic Claude
- `PemsApiService` - PEMS API client
- `encryptionService` - AES-256-GCM + bcrypt

#### 4. Middleware Stack
**Order** (important):
1. Helmet (security headers)
2. CORS (cross-origin)
3. JSON body parser (limit: 10mb)
4. Request logging (Winston)
5. Rate limiting (100 req/15 min)
6. Routes
7. Error handler (must be last)

#### 5. Authentication Architecture
**Pattern**: JWT with bcrypt password hashing

**Flow**:
```
1. User submits username + password
2. Backend validates with bcrypt.compare()
3. Backend generates JWT token (8-hour expiry)
4. Frontend stores token in localStorage['pfa_auth_token']
5. All API requests include Authorization: Bearer <token>
6. Backend verifies token on every request
```

**Security Improvements**:
-  API keys moved from client to backend (no longer in bundle)
-  All credentials encrypted at rest (AES-256-GCM)
-  Rate limiting on all endpoints
-  CORS protection
-  Input validation

#### 6. AI Provider Architecture
**Pattern**: Adapter Pattern (unified interface for multiple providers)

**Interface**:
```typescript
interface AiProvider {
  chat(messages: Message[], config: AiConfig): Promise<AiResponse>;
  streamChat(messages: Message[], config: AiConfig): AsyncIterable<AiChunk>;
  countTokens(text: string): number;
  calculateCost(tokens: number): number;
  healthCheck(): Promise<boolean>;
}
```

**Features**:
-  Automatic token counting
-  Cost calculation per request
-  Streaming support
-  Automatic failover
-  Budget enforcement

### Design Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| **Prisma ORM** | Type-safe, excellent migrations | Learning curve, some limitations |
| **SQLite (dev)** | Zero setup, fast development | Single file, no concurrent writes |
| **JWT (not sessions)** | Stateless, scalable | Token revocation more complex |
| **Service Layer** | Separation of concerns | More files, more abstraction |
| **Adapter Pattern** | Easy to add new AI providers | More boilerplate |
| **8-Hour Token Expiry** | Balance security and UX | Users must re-login daily |

### Security Audit Results

**Critical Fixes**:
-  Removed API keys from `vite.config.ts` (no longer in client bundle)
-  All credentials encrypted at rest (AES-256-GCM)
-  JWT tokens instead of API keys in client
-  Rate limiting on all endpoints
-  CORS restricted to allowed origins
-  Input validation with Zod

**Rate Limits Applied**:
- Global API: 60 requests/minute
- AI endpoints: 20 requests/minute
- Auth endpoints: 5 login attempts/15 minutes

### Migration Guide

1. Install backend dependencies: `cd backend && npm install`
2. Configure environment: `cp .env.example .env` (edit values)
3. Run database migration: `npx prisma migrate dev`
4. Seed database: `npx prisma db seed`
5. Start backend: `npm run dev` (port 3001)
6. Update frontend to use backend proxy

**Related**:
- [RELEASE_NOTES.md v0.9.0](../RELEASE_NOTES.md#version-090---phase-1-backend-infrastructure-2025-11-24)
- [ARCHITECTURE.md Section 7](./ARCHITECTURE.md#7-backend-architecture)

---

## 2025-11-15: Frontend Architecture Patterns

**Type**: Foundation
**Impact**: Critical
**Status**: Implemented

### Problem Statement

Need to build a React frontend that handles:
- 20K+ PFA records efficiently
- Real-time drag-and-drop with live preview
- Undo/redo history (20 levels)
- Multi-select bulk operations
- Complex filtering (8+ dimensions)
- Organization context switching

### Solution Overview

Implemented hybrid state management architecture using refs + state + context, with specialized patterns for performance-critical features.

### Architecture Changes

#### 1. Sandbox Pattern (Simulation Mode)
**Pattern**: Dual-Ref Architecture

**Implementation**:
```typescript
const allPfaRef = useRef<PfaRecord[]>([]); // Working sandbox (mutable)
const baselinePfaRef = useRef<PfaRecord[]>([]); // Committed truth (immutable)
const historyRef = useRef<PfaRecord[][]>([]); // Undo/redo stack (max 20)

const updatePfaRecords = (fn: (assets: PfaRecord[]) => PfaRecord[]): void => {
  pushHistory(); // Save current state
  allPfaRef.current = fn(allPfaRef.current); // Mutate sandbox
  setDataVersion(v => v + 1); // Trigger re-render
};
```

**Why Refs**: Avoids re-rendering on 20K record mutations. Only `setDataVersion()` triggers re-render.

#### 2. Drag-and-Drop Pattern
**Pattern**: dragOverrides Map (Non-Destructive Preview)

**Implementation**:
```typescript
const [dragOverrides, setDragOverrides] = useState<Map<string, DragUpdate>>(new Map());

// During drag: Store overrides in Map
handleMouseMove: (e) => {
  const updated = new Map(dragOverrides);
  dragState.selectedIds.forEach(id => {
    updated.set(id, { start: newStart, end: newEnd, layer });
  });
  setDragOverrides(updated); // Preview only, no data mutation
}

// On drop: Apply overrides
handleMouseUp: () => {
  if (dragOverrides.size > 0) {
    onUpdateAssets(Array.from(dragOverrides.entries())); // Commit
  }
  setDragOverrides(new Map()); // Clear
}
```

**Why Map**: O(1) lookups for 10+ simultaneous bars. React batches updates for 60fps preview.

#### 3. State Management Strategy
**Pattern**: Hybrid (Refs + State + Context)

| State Type | Technology | Purpose |
|------------|------------|---------|
| **Global Mutable State** | `useRef` | High-frequency mutations (sandbox data) |
| **Re-render Trigger** | `useState` | Force re-renders after ref mutations |
| **UI State** | `useState` | Component-local UI state |
| **Auth State** | Context API | User authentication + organization |
| **Derived State** | `useMemo` | Computed values from refs |

#### 4. Performance Optimizations
| Technique | Implementation | Impact |
|-----------|----------------|--------|
| **Virtual Scrolling** | GridLab renders only visible rows (~50) | 20K records ’ 50 DOM nodes |
| **React.memo** | Memoize Timeline bars, GridRow | Prevents re-render of unchanged bars |
| **useMemo** | Cache `visiblePfaRecords` | ~100ms filter avoided on re-renders |
| **useCallback** | Stable callbacks | Prevents child re-renders |
| **Debouncing** | 300ms debounce on search | 10/sec ’ 1/sec filter calculations |
| **Map Lookups** | dragOverrides Map | 60fps drag preview for 10+ bars |

### Design Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| **Refs for State** | Avoid re-renders on 20K mutations | Violates React patterns, hard to debug |
| **800 Record Limit** | Performance safety net | Users can't see all 20K records (DEBT-002) |
| **History as Full Snapshots** | Simple implementation | ~400MB RAM for 20 snapshots (DEBT-003) |
| **Custom CSV Parser** | No external dependencies | Fragile for edge cases (DEBT-005) |
| **Context API (not Redux)** | Simpler, less boilerplate | Less tooling support |

### Performance Metrics (Development)

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| **Initial Load** | < 3s | ~2s |  Good |
| **Filter Change** | < 200ms | ~100ms |  Good |
| **Drag-and-Drop** | 60fps | 60fps |  Good |
| **Timeline Zoom** | < 100ms | ~50ms |  Good |
| **Bulk Operation** | < 500ms | ~300ms |  Good |

### Technical Debt Created

| ID | Description | Impact | Target |
|----|-------------|--------|--------|
| DEBT-001 | Ref-based state | Hard to debug | Sprint 7 |
| DEBT-002 | 800 record limit | Can't see all data | Sprint 6 |
| DEBT-003 | Full snapshot history | ~400MB RAM | Sprint 7 |

**Related**:
- [ARCHITECTURE.md Section 6](./ARCHITECTURE.md#6-frontend-architecture)
- [DEVELOPMENT_LOG.md Technical Debt](./DEVELOPMENT_LOG.md#technical-debt)

---

## Future Architectural Changes (Planned)

### Sprint 6-7: State Management Refactoring
**Goal**: Migrate from ref-based state to Zustand

**Rationale**:
- Better debugging (Redux DevTools)
- Follows React best practices
- Easier to test

**Impact**: High (touches all components)
**Effort**: 2 weeks

### Sprint 8: Testing Infrastructure
**Goal**: Add Vitest + Testing Library

**Rationale**:
- Zero test coverage currently
- Catch regressions early
- Enable refactoring with confidence

**Impact**: Medium (adds test files)
**Effort**: 1 week (setup + initial tests)

### Sprint 10: Microservices Architecture (Future)
**Goal**: Split backend into microservices

**Rationale**:
- Better scalability
- Independent deployment
- Team autonomy

**Impact**: Critical (major refactoring)
**Effort**: 8 weeks

**Services Planned**:
1. Auth Service
2. PFA Data Service
3. PEMS Sync Service
4. AI Service
5. API Gateway

---

## Architectural Principles

### 1. Separation of Concerns
- **Frontend**: Presentation logic only
- **Backend**: Business logic + data access
- **Service Layer**: Reusable business logic
- **Data Layer**: Prisma ORM abstracts database

### 2. Performance First
- Virtual scrolling for large lists
- Debouncing for expensive operations
- Memoization for derived state
- Batch processing for sync

### 3. Security by Design
- JWT authentication on all endpoints
- Encrypted credentials at rest
- Rate limiting to prevent abuse
- Input validation on all inputs

### 4. Multi-Tenancy
- Organization-based data isolation
- Per-org configuration (AI, PEMS)
- Org-specific overrides (data source mappings)

### 5. Extensibility
- Adapter pattern for AI providers
- Data source mappings for API flexibility
- Plugin-ready architecture

---

## Change Log

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-11-25 | Initial architecture changelog created | Claude Code |

---

**Document Version:** 1.0
**Last Updated:** 2025-11-25
**Maintained By:** PFA Vanguard Project Team

**Questions?** See [DOCUMENTATION_STANDARDS.md](./DOCUMENTATION_STANDARDS.md) or [ARCHITECTURE.md](./ARCHITECTURE.md)
