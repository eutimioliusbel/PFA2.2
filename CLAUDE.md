# CLAUDE.md - AI Context Router

AI instruction manual for PFA Vanguard codebase.

---

## Context Anchors (Read Before Acting)

**Single Source of Truth Files**:

- **Code Style**: `docs/CODING_STANDARDS.md` (Strict Mode, 20-line limit, No `any`, React patterns, Security)
- **Documentation**: `docs/DOCUMENTATION_STANDARDS.md` (Update logs, folder structure, no doc sprawl)
- **Architecture**: `docs/ARCHITECTURE.md` (Complete system design)
- **ADRs**: `docs/adrs/README.md` (blueprint structure, lifecycle commands)
- **API Reference**: `docs/backend/API_REFERENCE.md` (All backend endpoints)
- **Development Log**: `docs/DEVELOPMENT_LOG.md` (Track all implementation work here)

## The Twelve Iron Rules - NEVER VIOLATE THESE

### Rule 1: Documentation-First
**Update `docs/ARCHITECTURE.md` BEFORE implementing architectural changes.**
- Architecture describes intent; code implements it.
- **Critical:** If you change a core pattern, update the architecture doc first.
- If you change an API contract, update `docs/backend/API_REFERENCE.md` before writing the controller.

### Rule 2: No File Sprawl
**Never create new top-level documentation files.**
- **Exception:** ADRs in `docs/adrs/` (must follow the 7-doc blueprint).
- Do not create `PLAN.md`, `TODO.md`, or `STATUS.txt`. Use `docs/DEVELOPMENT_LOG.md`.
- Keep the root clean: Only `CLAUDE.md`, `README.md`, config files (vite, tsconfig, package.json).

### Rule 3: Living Documentation
**All documentation must be updated in real-time.**
- When you create/modify features → Update `docs/DEVELOPMENT_LOG.md`.
- When you run tests → Update `docs/TESTING_LOG.md`.
- When you add a script → Update `backend/scripts/README.md`.
- **Constraint:** A task is not "Done" until the log entry is "LOCKED".

### Rule 4: One Component, One Responsibility
**Strict separation of concerns in file structure.**
- **Frontend:** One major component per file (e.g., `Timeline.tsx`). Small sub-components can stay if local.
- **Backend:** One controller per domain, one service per domain.
- **Styles:** Use Tailwind utility classes; do not create separate CSS files unless absolutely necessary.

### Rule 5: Update, Don't Duplicate
**Refactor in place; never create versioned copies.**
- **Never** create `Timeline_v2.tsx`, `authService_new.ts`, or `schema_backup.prisma`.
- Git preserves history. Rely on it.
- If a major refactor is risky, use a feature branch.

### Rule 6: Archive Obsolete, Don't Delete
**When major features or scripts become obsolete:**
- Move to `docs/archive/` (for docs) or `backend/scripts/archive/` (for scripts).
- Update the relevant `README.md` to note the archival.
- **Exception:** Code that is simply refactored/replaced should be overwritten.

### Rule 7: Check First, Create Second
**Before writing new scripts or utilities:**
- **Check** `backend/scripts/` and `utils.ts` first.
- **Reuse** existing logic if possible.
- **Generalize** existing scripts if they are close to what you need.
- Only create new if strictly necessary, following naming conventions.

### Rule 8: Single Source of Truth for Database (CRITICAL)
**`backend/prisma/schema.prisma` is the ONLY source of truth for the database.**
- **ALL** schema changes MUST be made in `schema.prisma`.
- **DO NOT** manually edit migration SQL files.
- **Workflow:** Modify `schema.prisma` → Run `npx prisma migrate dev`.

### Rule 9: Zero Fluff, Pure Signal
**Responses must be concise, technical, and direct.**
- **No Conversational Filler:** Skip "Here is the code" or "I hope this helps."
- **No Marketing Speak:** Avoid "powerful," "seamless," "state-of-the-art." Use technical terms.
- **Code Over Prose:** Prioritize code blocks over long explanations.

### Rule 10: Executive-Style Summaries
**Summaries must be high-density and skimmable.**
- **Structure:** Use bullet points and active verbs ("Added", "Fixed", "Removed").
- **No Storytelling:** Do not write "We decided to do X because..." unless in an ADR. Just state "Implemented X."
- **Context:** Assume the reader is a domain expert. Do not re-explain core concepts.
- **Link Heavy:** Always cross-reference IDs (`[DEV-XXX]`, `[ADR-XXX]`) rather than describing them.

### Rule 11: No Placeholders, No Shortcuts
**Code must be fully implemented and strictly type-safe.**
- **No Build Hacks:** Never comment out code or use `any` just to fix a compilation error. Fix the root cause (update the Interface/Type).
- **No Ghost Code:** Never leave `// TODO`, `// PENDING`, or `// ... rest of logic` in the final output. If a feature is in scope, build it completely.
- **Full Context:** When updating a file, provide the *entire* modified function or component, not just the changed lines, to ensure context integrity.

### Rule 12: Strict Thematic Consistency
**Adhere rigidly to established UI/UX patterns and tokens.**
- **No Magic Values:** Use defined Tailwind utility classes and theme tokens (colors, spacing). Do not hardcode hex codes or arbitrary pixels.
- **Pattern Matching:** If adding a button, match the existing `Button` component patterns (props, variants). Do not invent new styles unless explicitly requested.
- **Visual Integrity:** New features must look indistinguishable from the existing application core.

---

## Tech Stack

**Frontend:**
- **Core:** React 19, TypeScript, Vite 5
- **Styling:** Tailwind CSS (Utility-first, no CSS-in-JS)
- **State/Fetch:** Context API, TanStack Query (React Query)
- **Testing:** Vitest, React Testing Library

**Backend:**
- **Runtime:** Node.js (v18+), Express.js 4.x
- **Database:** Prisma 5.x (ORM), PostgreSQL (Docker for Dev, Local Install for Prod)
- **Caching/Queues:** Redis (Session kill-switch, Notification batching)
- **Validation:** Zod (Strict schema validation)
- **Logic:** Math.js (KPI formulas)

**Quality & Standards:**
- **Linting:** ESLint (Strict: no unused vars, no implicit any)
- **Formatting:** Prettier (Single quotes, 2-space indent)
- **Type Safety:** TypeScript Strict Mode (noUnusedLocals: true)

**Infrastructure:**
- **Auth:** JWT (Stateless) + bcrypt
- **AI:** Google Gemini (Primary), OpenAI GPT-4, Anthropic Claude
- **External:** PEMS (HxGN EAM) API

---

## Recent Architectural Decisions (ADRs)

> **📖 Always check `docs/adrs/README.md` for the current status of Architectural Decision Records.**

## Critical Architecture Gotchas

> **⚠️ Project-Specific Patterns**: These are unique to PFA Vanguard's architecture. For general coding rules, see `docs/CODING_STANDARDS.md`.

### 1. Sandbox Pattern - NEVER Mutate `allPfaRef` Directly

**Wrong:**
```typescript
allPfaRef.current = allPfaRef.current.map(a => ({ ...a, category: 'New' }));
```

**Correct:**
```typescript
updatePfaRecords(prev => prev.map(a => ({ ...a, category: 'New' })));
```

**Why:** Direct mutation breaks undo/redo history and doesn't trigger re-render.

### 2. Auth - NEVER Use Manual `fetch()`

**Wrong:**
```typescript
const token = localStorage.getItem('token'); // Wrong key!
fetch('/api/pems/sync', { headers: { 'Authorization': `Bearer ${token}` } });
```

**Correct:**
```typescript
const data = await apiClient.syncPemsData(organizationId, 'full');
```

**Why:** Token stored as `'pfa_auth_token'`, not `'token'`. `apiClient` handles this.

### 3. Admin Menu - Add to `App.tsx`, NOT `AdminDashboard.tsx`

**Location:** `App.tsx` lines ~751-758 (menu items), ~950-960 (render logic)

### 4. PFA Lifecycle - Plan is Immutable

```
PLAN (originalStart/End) [locked]
  ↓
FORECAST (forecastStart/End) [editable]
  ↓
ACTUAL (actualStart/End) [billing reality]
```

**Rule:** Plan never changes. Variance = Forecast/Actual vs Plan.

### 5. Cost Calculation - Rental vs Purchase

**Rental:** `(days / 30.44) × monthlyRate`
**Purchase:** `purchasePrice` (duration irrelevant)

**Implementation:** `frontend/utils.ts: calculateCost()`

### 6. Drag-and-Drop - Use `dragOverrides` Map

**During drag:** Store in `dragOverrides` Map (no data mutation)
**On drop:** Apply via `onUpdateAssets()` callback

**Why:** Smooth multi-item drag without mutating data until drop.

### Notification System (Event-Driven)
**Pattern:** Event Bus -> Smart Router -> Multi-Channel Delivery
1.  **Emit:** `eventBus.emit('pfa.sync.failed', payload)` (backend/services/NotificationEventBus.ts)
2.  **Route:** Router applies batching (60s window) and Quiet Hours.
3.  **Deliver:** To Email, In-App, Slack, Teams based on `UserNotificationPreferences`.
**Constraint:** Never send notifications directly from controllers. Use the Event Bus.

### 7. Extensibility Pattern - JSONB vs Columns (ADR-005)
**Rule:** Do NOT add columns for UI toggles, user preferences, or org settings.
* **Security/Filtering:** Use **Boolean Columns** (e.g., `perm_Read`, `isActive`).
* **Settings/Features:** Use **JSONB Columns** (e.g., `settings`, `preferences`, `capabilities`).
* **Dropdown Options:** Use **SystemDictionary** table (not hardcoded enums).
---

## Domain Concepts

### PFA Lifecycle
```
ESS → PLAN [locked] → FORECAST [editable] → ACTUAL [billing]
```
**Active Organizations:** `RIO` (Rio Tinto), `PORTARTHUR` (Port Arthur).
* *Note:* `HOLNG` and `PEMS_Global` were removed (Nov 25). Do not reference them.

### Data Source Orchestration
**Mapping System:** Entities (PFA, Assets) are decoupled from API configs via `DataSourceMapping` table.
**Usage:**
* **Never** hardcode API selection logic.
* **Always** use `DataSourceOrchestrator.getActiveDataSource(entityType, orgId)`.
* **Fallback:** System automatically checks Org-specific mapping -> Global mapping.


### Key Fields

**Timeline:**
- `originalStart/End`: Budget baseline (locked)
- `forecastStart/End`: PM strategy (drag-and-drop)
- `actualStart/End`: Billing reality (`isActualized = true`)

**Financial:**
- `source`: 'Rental' or 'Purchase'
- `dor`: 'BEO' (overhead) or 'PROJECT' (charge code)
- `monthlyRate`: For rentals
- `purchasePrice`: For purchases

**Status:**
- `isActualized`: On-site billing (orange bars)
- `isDiscontinued`: Cancelled (hidden by default)
- `isFundsTransferable`: Budget donor

### Permission System (ADR-005 Implementation)

**Access Control Model**: Hybrid Role-Override Architecture
- Users assigned to one or more organizations via `UserOrganization` junction table
- Each assignment has 14 boolean permission flags
- Permissions can be set via Role template OR per-user override

**Permission Categories**:
```typescript
// Data Scope (4 flags)
perm_Read: boolean              // View PFA records
perm_EditForecast: boolean      // Modify forecast dates/costs
perm_EditActuals: boolean       // Modify actual dates/costs (rare)
perm_Delete: boolean            // Soft delete PFA records

// Data Operations (3 flags)
perm_Import: boolean            // CSV import
perm_RefreshData: boolean       // Trigger PEMS sync
perm_Export: boolean            // Excel export

// Financials (1 flag)
perm_ViewFinancials: boolean    // See cost/budget data (compliance)

// Process (2 flags)
perm_SaveDraft: boolean         // Save uncommitted changes
perm_Sync: boolean              // Push changes to PEMS

// Admin (4 flags)
perm_ManageUsers: boolean       // User/org management
perm_ManageSettings: boolean    // System configuration
perm_ConfigureAlerts: boolean   // Notification rules
perm_Impersonate: boolean       // "View as" other users
```

**Backend Enforcement**:
- Middleware: `requirePermission('Read')` checks `UserOrganization` table
- API Server Access: `requireApiServerPermission(serverId, action)` for PEMS sync
- Audit: All permission checks logged to `AuditLog`

**Frontend Usage**:
```tsx
<PermissionGuard requires="EditForecast">
  <button onClick={handleSave}>Save Changes</button>
</PermissionGuard>

// Or programmatic check
const { hasPermission } = usePermissions();
if (hasPermission('ViewFinancials')) {
  showCostColumn();
}
```

**Special Cases**:
- **Impersonation**: `User.impersonatingUserId` set during session, all actions audited
- **Financial Masking**: If `!perm_ViewFinancials`, cost fields return `null`
- **Temporal Access**: `UserOrganization.accessExpiresAt` auto-disables on expiry
- **Session Kill**: `UserSession.invalidatedAt` revokes JWT token server-side

---

## File Map

### Project Structure
```
PFA2.2/
├── frontend/              # React frontend application
│   ├── components/        # React components
│   ├── contexts/          # React context providers
│   ├── hooks/             # Custom React hooks
│   ├── services/          # API client, query client
│   ├── stores/            # Zustand stores
│   ├── utils/             # Utility functions
│   ├── tests/             # Frontend tests
│   ├── App.tsx            # Root component
│   ├── index.tsx          # Entry point
│   ├── types.ts           # TypeScript interfaces
│   └── utils.ts           # Business logic
├── backend/               # Node.js backend
│   ├── src/               # Source code
│   ├── prisma/            # Database schema
│   └── scripts/           # Utility scripts
├── docs/                  # Documentation
└── [config files]         # vite, tsconfig, package.json
```

### Frontend Core
- `frontend/App.tsx` (~890 lines): Root state, sandbox, undo/redo
- `frontend/types.ts` (~336 lines): TypeScript interfaces
- `frontend/utils.ts` (~294 lines): Business logic

### Frontend Components
- `frontend/components/Timeline.tsx` (~500 lines): Gantt chart
- `frontend/components/MatrixView.tsx` (~400 lines): Month-by-month
- `frontend/components/GridLab.tsx` (~200 lines): Tabular view
- `frontend/components/KpiBoard.tsx` (~200 lines): Variance dashboard
- `frontend/components/CommandDeck.tsx` (~400 lines): Bulk operations
- `frontend/components/FilterPanel.tsx` (~300 lines): Multi-select filters
- `frontend/components/AiAssistant.tsx` (~600 lines): Gemini integration

### Backend
- `backend/src/server.ts`: Express entry
- `backend/src/services/pems/PemsSyncService.ts`: Batch sync
- `backend/src/controllers/pemsSyncController.ts`: Sync endpoints
- `backend/prisma/schema.prisma`: Database schema

### Permission System (ADR-005)
- `backend/src/middleware/requirePermission.ts`: Permission enforcement
- `backend/src/middleware/requireApiServerPermission.ts`: API server access control
- `backend/src/middleware/auditContext.ts`: Audit trail middleware
- `backend/src/controllers/userOrgController.ts`: User-org assignments
- `backend/src/controllers/permissionExplanationController.ts`: Permission hints
- `backend/src/controllers/auditController.ts`: Audit log queries
- `backend/src/services/ai/PermissionExplanationService.ts`: AI permission hints
- `backend/src/services/ai/PermissionSuggestionService.ts`: AI role suggestions
- `backend/src/services/ai/RoleDriftDetectionService.ts`: Permission anomaly detection
- `frontend/components/PermissionGuard.tsx`: Frontend permission wrapper
- `frontend/components/PermissionButton.tsx`: Permission-aware buttons
- `frontend/components/PermissionExplanationTooltip.tsx`: Permission hints UI
- `frontend/components/admin/UserOrgPermissions.tsx`: Permission management UI
- `frontend/components/admin/RoleDriftAlerts.tsx`: Anomaly detection UI

### AI Integration (ADR-005)
- `backend/src/services/ai/NaturalLanguagePermissionService.ts`: NL permission queries
- `backend/src/services/ai/FinancialMaskingService.ts`: AI-powered financial masking
- `backend/src/services/ai/FinancialAccessMonitoringService.ts`: Financial access tracking
- `backend/src/services/ai/SemanticAuditSearchService.ts`: NL audit log search
- `backend/src/services/ai/NotificationTimingService.ts`: Smart notification timing
- `backend/src/services/ai/BeoAnalyticsService.ts`: BEO portfolio analytics
- `frontend/components/admin/SemanticAuditSearch.tsx`: NL audit search UI
- `frontend/components/admin/NLQueryInput.tsx`: Natural language input

---

## Common Tasks

> **📖 For detailed coding rules, see `docs/CODING_STANDARDS.md`**

### Add PfaRecord Field
1. Update `PfaRecord` in `frontend/types.ts`
2. Update `cloneAssets()` in `frontend/App.tsx` (if non-primitive)
3. Add to `DEFAULT_EXPORT_CONFIG` (frontend/App.tsx)
4. Add grid column (if needed)

### Add Filter
1. Update `FilterState` in `frontend/types.ts`
2. Update `createDefaultFilters()` in `frontend/App.tsx`
3. Add UI control in `frontend/components/FilterPanel.tsx`
4. Update filter logic in `frontend/App.tsx` useEffect (~line 297-346)

### Add Bulk Operation
1. Add button to `frontend/components/CommandDeck.tsx`
2. Call `onUpdateAssets()` with transformation
3. Enforce business rules (e.g., can't move actual start backward)

### Add Admin Menu Item
**Location: frontend/App.tsx**
1. Import icon (line 34)
2. Add MenuItem (line ~751-758)
3. Import component (line ~18-30)
4. Add render logic (line ~950-960)

---

## PEMS Sync

### Quick Reference
**Read Sync:** ✅ Working (PEMS → PostgreSQL)
**Write Sync:** 📋 Planned (PostgreSQL → PEMS)
**Scale:** 1M+ records, 10K API calls, 1K DB batches

### Auth Pattern
**Critical:** Use `apiClient` service (handles JWT from `'pfa_auth_token'`)
**Never:** Manual `fetch()` with wrong localStorage key

### Troubleshooting
- **401 errors:** Using manual `fetch()` or wrong token key
- **Sync button hidden:** `feeds` field NULL (run `update-feeds.ts`)
- **Performance:** Adjust `PAGE_SIZE` or `BATCH_SIZE`

### Database Architecture (3-Tier)
```
PostgreSQL (source of truth)
    ↓
Redis Cache (hot data, planned)
    ↓
React State (~800-1000 records)
```

**Change Tracking:** `syncState`: pristine → modified → pending_sync → sync_error

---

## ADR Workflow

> **📖 For complete ADR structure and philosophy, see `docs/adrs/README.md`**

### Lifecycle Commands

```bash
/plan-adr 006 "Title" "Problem"        # Create 7-doc blueprint
/update-adr 006 "Change" "Details"     # Update existing ADR
/execute-adr 006                       # Generate workflow
/invoke-agent <agent-name> <task-id>   # Execute task
```

### Available Agents

**Orchestration & Planning**:
- `orchestrator`: Multi-agent coordination, task dependencies, parallel execution
- `adr-executor`: Execute ADR workflows, process prompt bundles sequentially
- `product-requirements-analyst`: User stories, acceptance criteria, edge cases

**Backend & Database**:
- `backend-architecture-optimizer`: Node.js, Express, APIs, async patterns, queues
- `postgres-jsonb-architect`: Database schema, Prisma migrations, JSONB optimization
- `database-reliability-qa`: Performance testing, concurrency validation, query optimization

**Frontend & UX**:
- `react-ai-ux-specialist`: React components, AI streaming, state management
- `ux-technologist`: UX evaluation, perceived performance, interaction design
- `design-review-agent`: Comprehensive UI/UX review, accessibility, visual polish

**AI & Prompt Engineering**:
- `ai-systems-architect`: LLM integration, RAG pipelines, AI orchestration
- `prompt-engineer`: Prompt optimization, model evaluation, AI feature design
- `ai-quality-engineer`: AI output quality, golden datasets, hallucination detection

**Testing & Quality**:
- `sdet-test-automation`: Test suites, E2E, integration tests, coverage
- `ci-cd-governor`: Code quality enforcement, automated checks, pre-commit hooks

**Security & DevOps**:
- `ai-security-red-teamer`: Prompt injection, jailbreak testing, security audit
- `devsecops-engineer`: CI/CD pipelines, security hardening, infrastructure, monitoring

**Documentation**:
- `documentation-synthesizer`: Technical docs, ADR compilation, markdown standards

**Philosophy:** "Blueprint Container" approach - Product, UX, AI, and Engineering concerns isolated and defined before implementation.

---

## Naming Conventions

> **📖 For complete naming conventions, see `docs/CODING_STANDARDS.md` Section 7**
> **Temporal Files:** `[date]-[purpose]-[status].[ext]` (e.g., `2025-11-25-pems-analysis-wip.md`)
  **Utility Scripts:** `[action]-[subject]-[detail].ts` (e.g., `check-feeds.ts`, `update-feeds.ts`)
  **Test Scripts:** `[subject].[type].test.ts` (e.g., `calculate-cost.unit.test.ts`)

### Log Statuses
* **PENDING / IN PROGRESS**: Active development.
* **ON TESTING**: Code complete, tests running.
* **LOCKED 🔒**: Production deployed. **NEVER modify** without formal change control.

**Commits:** `[TYPE] Brief summary - DEV-XXX`
Types: `FEAT`, `FIX`, `REFACTOR`, `DOCS`, `TEST`, `CHORE`, `PERF`, `SECURITY`, `RELEASE`

**Branches:** `<type>/<ticket>-<description>`
Examples: `feature/DEV-123-pems-sync`, `bugfix/DEV-124-crash`

**Scripts:** `[action]-[subject]-[detail].ts`
Examples: `check-feeds.ts`, `update-feeds.ts`, `verify-orgs.ts`

**Tests:** `[subject].[type].test.ts`
Examples: `calculateCost.unit.test.ts`, `pems-api.integration.test.ts`

**Temp Files:** `[date]-[purpose]-[status].[ext]`
Location: `temp/agent-work/`, `temp/compile/`, `temp/output/`, `temp/test/`

---

## API Endpoints

> **📖 For complete API reference, see `docs/backend/API_REFERENCE.md`**

**Auth:** `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/verify`
**AI:** `POST /api/ai/chat`, `GET /api/ai/usage`
**PEMS:** `GET /api/pems/configs`, `POST /api/pems/test`, `POST /api/pems/sync`
**API Config:** `GET /api/configs`, `POST /api/configs`, `PUT /api/configs/:id`, `DELETE /api/configs/:id`

---

## Known Issues

> **📖 For complete issue list, see `docs/ARCHITECTURE.md` Section 9**

**Security:** API keys in .env (need AWS Secrets Manager / Azure Key Vault)
**Architecture:** Ref-based state, 800 record limit, history management (400MB RAM)
**Missing:** Error boundaries, test coverage (0%), Papa Parse for CSV

---

## Production Checklist

> **📖 For complete checklist, see `docs/ARCHITECTURE.md` Section 10**

**Critical:** Secrets management, error boundaries, security audit, PostgreSQL migration
**High:** Replace ref-based state, remove 800 limit, diff-based history, Papa Parse

---

## External References

**Docs (Read First):**
- `docs/DOCUMENTATION_STANDARDS.md` - Git workflow, commit conventions
- `docs/CODING_STANDARDS.md` - TypeScript strict mode, 20-line rule, security
- `docs/ARCHITECTURE.md` - Complete system architecture (1,500+ lines)

**ADRs:**
- `docs/adrs/README.md` - ADR index and 7-doc structure
- `docs/adrs/ADR-005-multi-tenant-access-control/` - Complete example

**Development:**
- `docs/DEVELOPMENT_LOG.md` - Track all implementation work here
- `docs/TESTING_LOG.md` - Test execution history

**Resources:**
- AI Studio: https://ai.studio/apps/drive/1qDNhrLQ0m0jiM3gWkyzWZmIqkCzdq3Pc
- Gemini API: https://ai.google.dev/
- Vite: https://vitejs.dev/
- React 19: https://react.dev/

---

## Quick ADR Summary

**Implemented**:
- ✅ ADR-005: Multi-Tenant Access Control (14 permissions, audit ledger, PATs, impersonation)

**In Design**:
- 🏗️ ADR-006: API Server & Endpoint Architecture (two-tier, per-endpoint testing)
- 🏗️ ADR-007: API Connectivity & Intelligence Layer (Bronze-Silver-Gold pipeline)

**See**: `docs/adrs/README.md` for complete ADR catalog and lifecycle commands

---

**Version:** 3.2 (Frontend/Backend Separation)
**Updated:** 2025-11-29
