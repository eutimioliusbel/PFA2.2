# PFA Vanguard - Phased Validation Strategy

This document outlines the strategy for validating and locking functionality for the PFA Vanguard project. We will follow a sequential "Lock-Down" approach, ensuring that the foundation is solid before validating higher-level features.

## Strategy Overview

We will execute 4 distinct phases. Each phase has:
1.  **Scope:** Specific modules to validate.
2.  **Verification:** Specific test suites (Backend & E2E) that MUST pass.
3.  **Lock:** A dedicated git branch to preserve the stable state.

---

## Phase 1: Foundation & Access Control (The "Gatekeeper")

**Focus:** Users, Organizations, Roles, and Multi-Tenant Isolation (ADR-005).
**Why:** If security fails, nothing else matters. We must prove that User A in Org X cannot see User B in Org Y.

### Modules to Validate
-   [x] User Authentication (Login/Logout)
-   [x] Organization Switching
-   [x] Permission Granting/Revoking (The 14 flags)
-   [x] Role Drift Detection

### Verification Suites
*Run these commands:*
```bash
# Backend Integration
npm run test:integration -- backend/tests/integration/permissions.test.ts
npm run test:integration -- backend/tests/integration/multiTenantIsolation.test.ts
npm run test:integration -- backend/tests/integration/organizationCascading.test.ts

# E2E (Frontend + Backend)
npx playwright test tests/e2e/multiOrgAccess.e2e.test.ts
npx playwright test tests/e2e/permissionGrant.e2e.test.ts
```

### Lock Action
Upon success:
```bash
git checkout -b release/v1.2-phase1-auth-locked
git tag -a v1.2.0-phase1 -m "Phase 1: Auth & Isolation Validated"
```

---

## Phase 2: Data Integrity & Architecture (The "Mirror")

**Focus:** Database "Mirror + Delta" Architecture, PEMS Sync, and API CRUD.
**Why:** We need to prove that the complex JSONB merging logic works and that PEMS sync doesn't corrupt local data.

### Modules to Validate
-   [ ] PFA Record CRUD (Create/Read/Update/Soft-Delete)
-   [ ] PEMS Batch Sync (Read-only mirror)
-   [ ] Data Integrity (No leaks between orgs)

### Verification Suites
*Run these commands:*
```bash
# Backend Integration
npm run test:integration -- backend/tests/integration/pfa-data-api.test.ts
npm run test:integration -- backend/tests/integration/dataIntegrity.test.ts
npm run test:integration -- backend/tests/integration/pemsSyncFiltering.test.ts

# Load Tests (Lightweight)
npm run test:load:db-stress
```

### Lock Action
Upon success:
```bash
git checkout -b release/v1.2-phase2-data-locked
git tag -a v1.2.0-phase2 -m "Phase 2: Data Architecture Validated"
```

---

## Phase 3: PFA Core Workflow (The "App")

**Focus:** The actual user application—Timeline, Grid, Filtering, and Bulk Operations.
**Why:** This is where the Project Managers live. We need to verify the UI correctly interacts with the Phase 2 backend.

### Modules to Validate
-   [ ] Timeline Visualization (Gantt rendering)
-   [ ] Forecasting (Drag-and-drop dates)
-   [ ] Bulk Operations (Mass update)
-   [ ] Filtering Logic

### Verification Suites
*Run these commands:*
```bash
# E2E (Critical)
# Note: New test suite needed
npx playwright test tests/e2e/pfaLifecycle.e2e.test.ts
```

### Lock Action
Upon success:
```bash
git checkout -b release/v1.2-phase3-app-locked
git tag -a v1.2.0-phase3 -m "Phase 3: Core PFA App Validated"
```

---

## Phase 4: Intelligence & Advanced Features (The "Value")

**Focus:** AI Features, Financial Masking, and Analytics.
**Why:** These are high-value but high-complexity features that depend on a stable core.

### Modules to Validate
-   [ ] AI Assistant (Chat & Context)
-   [ ] Permission Suggestions (AI analysis)
-   [ ] Financial Masking (Compliance)

### Verification Suites
*Run these commands:*
```bash
# Backend Integration
npm run test:integration -- backend/tests/integration/aiPermissionSuggestion.test.ts
npm run test:integration -- backend/tests/integration/nlPermissionQuery.test.ts

# E2E
npx playwright test tests/e2e/financialMasking.e2e.test.ts
```

### Lock Action
Upon success:
```bash
git checkout -b release/v1.2-phase4-full-locked
git tag -a v1.2.0-gold -m "Phase 4: Gold Master"
```

---

## Current Status: Ready to Start Phase 1
