# GEMINI.md - Context & Instructions for PFA Vanguard

## Project Overview
**PFA Vanguard** is a construction equipment tracking system managing the Plan-Forecast-Actual (PFA) lifecycle. It solves the problem of tracking equipment costs against budgets in large industrial projects.

- **Core Domain:** Construction Management, Equipment Tracking, Financial Forecasting.
- **Key Feature:** "Mirror + Delta" architecture for handling 1M+ records with draft/commit workflows and external system (PEMS) synchronization.

## Tech Stack
- **Frontend:** React 19, TypeScript, Vite 5, Tailwind CSS, TanStack Query.
- **Backend:** Node.js (v18+), Express.js 4.x.
- **Database:** PostgreSQL (Prisma ORM). **Critical:** Uses a specific "Mirror + Delta" pattern (see Architecture).
- **Infrastructure:** Docker (for local DB), Redis (planned for caching).
- **AI:** Google Gemini, OpenAI, Claude integration for features like "AI Assistant" and "Permission Hints".

## Operational Commands

### Setup & Run
- **Install:** `npm install` (root), `cd backend && npm install`
- **Dev Server (Frontend):** `npm run dev` (http://localhost:3000)
- **Dev Server (Backend):** `cd backend && npm run dev` (http://localhost:3001)
  - *Note:* `npm run dev` in backend runs seeding. Use `npm run dev:no-seed` to skip.

### Database Management
- **Schema Update:** `cd backend && npx prisma migrate dev`
- **Seed Data:** `cd backend && npm run prisma:seed`
- **Reset & Seed:** `cd backend && npm run prisma:seed-full`

### Testing
- **Backend Load Tests:** `cd backend && npm run test:load`
- **Playwright:** (See `package.json` in root)

## Critical Architecture & Rules
**Strictly adhere to these patterns. Do not deviate without explicit instruction.**

### 1. Database: Mirror + Delta Pattern
- **Source of Truth:** `pfa_mirror` table (Read-only, synced from PEMS).
- **User Edits:** `pfa_modification` table (Stores deltas/changes only).
- **Read Layer:** `pfa_merged_live` View (Merges Mirror + Delta on the fly).
- **Performance:** `pfa_kpi_summary` Materialized View for dashboards.
- **Rule:** Never mutate `pfa_mirror` directly based on user input. User input creates records in `pfa_modification`.

### 2. Frontend: Sandbox Pattern
- **State:** React state uses a "Sandbox" approach.
- **Rule:** Never mutate `allPfaRef` directly. Use updater functions.
- **Drag & Drop:** Use `dragOverrides` map during drag operations to avoid mutating data until drop.

### 3. Authentication
- **Token:** Stored as `pfa_auth_token` in localStorage.
- **Client:** Always use `apiClient.ts` for requests. **Never** use raw `fetch` with manual headers.

### 4. "The Iron Rules" (from CLAUDE.md)
- **No File Sprawl:** Do not create `TODO.md`, `PLAN.md`, etc. Use `docs/DEVELOPMENT_LOG.md`.
- **One Component, One File:** Strict separation.
- **Update, Don't Duplicate:** Refactor in place. No `_v2` files.
- **Single Source of Truth:** `backend/prisma/schema.prisma` is the ONLY definition of the DB schema.

## Directory Structure
- `backend/`: Node.js API.
  - `src/controllers`: Route logic.
  - `src/services`: Business logic (sync, AI, auth).
  - `prisma/`: Schema and migrations.
- `components/`: React UI components.
  - `admin/`: Admin dashboard.
  - `*.tsx`: Core business components (Timeline, Grid).
- `docs/`: Comprehensive documentation.
  - `ARCHITECTURE.md`: Master architecture doc.
  - `adrs/`: Architecture Decision Records.
  - `DEVELOPMENT_LOG.md`: Current progress tracker.

## Development Workflow
1.  **Check `docs/DEVELOPMENT_LOG.md`** to see current status.
2.  **Update `docs/DEVELOPMENT_LOG.md`** when starting/finishing a task.
3.  **If changing DB:** Modify `schema.prisma` -> `npx prisma migrate dev`.
4.  **If changing Architecture:** Update `docs/ARCHITECTURE.md` first.

## Useful Files to Read for Context
- `CLAUDE.md`: Detailed rules and context router.
- `backend/DATABASE_ARCHITECTURE.md`: Deep dive on the data model.
- `docs/adrs/ADR-005-multi-tenant-access-control/`: Permission system reference.

## Codebase Map

### Frontend Core (`components/`)
- **Visualization:**
  - `Timeline.tsx`: Main Gantt chart view. Handles drag-and-drop logic for `forecastStart/End`.
  - `GridLab.tsx`: Tabular data view.
  - `MatrixView.tsx`: Month-by-month financial aggregation view.
  - `KpiBoard.tsx`: High-level variance dashboard (Plan vs Forecast vs Actual).
- **Operations:**
  - `CommandDeck.tsx`: Bulk operations toolbar (Delete, Move Dates, etc.).
  - `FilterPanel.tsx`: Complex filtering logic (Org, Category, Source).
  - `NewForecastForm.tsx`: Wizard for creating new equipment requirements.
- **Admin & AI:**
  - `AdminDashboard.tsx`: User management, Organization settings, API configs.
  - `AiAssistant.tsx`: Chat interface for Gemini/LLM integration.
  - `PermissionGuard.tsx`: Wrapper component to conditionally render UI based on `UserOrganization` flags.

### Backend Architecture (`backend/src/`)
- **Entry Point:** `server.ts` (Express app setup, middleware injection, route mounting).
- **Controllers (`controllers/`):**
  - `pfaDataController.ts`: Core CRUD for PFA records (reads `pfa_merged_live` view).
  - `pemsSyncController.ts`: Handles synchronization triggers with external PEMS system.
  - `ai*Controller.ts`: Suite of 6+ controllers for AI features (Anomaly, Financial, Permission explanations).
  - `userOrgController.ts`: Manages multi-tenant access and permission flags.
- **Services (`services/`):**
  - `pems/PemsSyncService.ts`: Orchestrates the massive batch syncs from HxGN EAM.
  - `ai/`:
    - `AiService.ts`: General LLM interaction.
    - `FinancialMaskingService.ts`: Logic to hide costs for unauthorized users.
    - `PermissionSuggestionService.ts`: AI analysis of user behavior to suggest role changes.
    - `SemanticAuditSearchService.ts`: Natural language search over audit logs.

### Database Model (`backend/prisma/schema.prisma`)
- **Core Entities:**
  - `User`: Global user identity.
  - `Organization`: Tenant container (e.g., 'RIO', 'PORTARTHUR').
  - `UserOrganization`: **Crucial.** Holds the 14 boolean permission flags (e.g., `perm_EditForecast`).
- **PFA Data (Mirror + Delta):**
  - `PfaMirror`: Read-only replica of PEMS data.
  - `PfaModification`: User changes (deltas) stored separately.
  - `PfaRecord`: Legacy flat table (being deprecated/migrated).

### Middleware (`backend/src/middleware/`)
- `requirePermission.ts`: Enforces the 14 permission flags on routes.
- `auditContext.ts`: Injects user context for logging.
- `rateLimiter.ts`: Global API protection.
