# ADR-005: Scope Change Remediation Plan

**Change Request**: "PEMS Hybrid Source of Truth Integration"
**Change Description**: "Support entities (Users, Organizations, Roles) sourced from PEMS (HxGN EAM) with hybrid authentication, maintaining local flexibility while respecting external identity constraints. Includes: nullable passwordHash for PEMS users with optional local passwords, isExternal flag for PEMS-managed orgs, assignmentSource tracking, sync conflict resolution, and orphan account detection."
**Impact Analysis**: HIGH
**Affected Documents**: 4 of 5 blueprint documents
**Date Created**: 2025-11-26

---

## 🛑 Critical Instruction

**DO NOT SKIP TO CODE IMPLEMENTATION**

You must update the Blueprint documents **BEFORE** you build the code.
This ensures:
- ✅ All stakeholders understand the new scope
- ✅ UX is designed before implementation
- ✅ Security is considered upfront (hybrid auth, sync conflicts)
- ✅ AI data hooks are included from day one

Execute the Prompt Bundles below in order. Each bundle targets a specific specialist agent.

---

## 📊 Impact Summary

| Document | Impact Level | Changes Required |
|----------|-------------|------------------|
| DECISION.md | **HIGH** | Add hybrid source of truth context (item #18), update User/Organization/UserOrganization database schemas with external identity fields |
| AI_OPPORTUNITIES.md | **MEDIUM** | Add Use Cases 26-27 for sync conflict resolution and orphan account detection |
| UX_SPEC.md | **MEDIUM** | Add visual indicators for PEMS-managed entities, edit warnings, source badges |
| TEST_PLAN.md | **HIGH** | Add security tests for hybrid authentication, sync conflict scenarios, orphan detection |
| IMPLEMENTATION_PLAN.md | **HIGH** | Update Phase 2 (hybrid auth service), Phase 5 (admin UI logic for external entities) |

**Total Estimated Time**: 12-16 hours

---

## 🔄 Update Workflow

Follow these steps in order:

1. ✅ Execute Step 1 (DECISION.md update) - Database schema + business requirements
2. ✅ Execute Step 2 (AI_OPPORTUNITIES.md update) - Sync conflict AI use cases
3. ✅ Execute Step 3 (UX_SPEC.md update) - PEMS badges and visual indicators
4. ✅ Execute Step 4 (TEST_PLAN.md update) - Hybrid auth security tests
5. ✅ Execute Step 5 (IMPLEMENTATION_PLAN.md update) - Backend auth + Admin UI changes
6. ✅ Re-orchestrate: `/execute-adr 005`

---

## Step 1: Update Requirements & Database Schema

**Target**: `ADR-005-DECISION.md`
**Agent**: `product-requirements-analyst` + `postgres-jsonb-architect`
**Reason**: Need to add hybrid source of truth business requirements and update database schema for external identity tracking

**Current State** (from DECISION.md):
```
Context and Problem Statement contains 17 requirements.
Database Schema section defines User, Organization, UserOrganization models.
```

**Required Changes**:
- Add requirement #18: Hybrid Source of Truth & Identity
- Update User model: Make `passwordHash` nullable, add `externalId`, add `authProvider`
- Update Organization model: Add `externalId`, add `isExternal` flag
- Update UserOrganization model: Add `assignmentSource`, add `externalRoleId`, add `isCustom` override flag

---

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@product-requirements-analyst @postgres-jsonb-architect

**SYSTEM CONTEXT**:
You are updating ADR-005 to add "PEMS Hybrid Source of Truth Integration".
This is a HIGH-impact scope change to the Multi-Tenant Access Control architecture.

**CURRENT STATE** (Read for context):
File: `docs/adrs/ADR-005-multi-tenant-access-control/ADR-005-DECISION.md`

Current requirements include items 1-17 covering:
- Multi-tenant isolation
- RBAC permissions (14 feature flags)
- Organization/User service status
- Session management
- Financial masking
- Temporal access controls

Current Database Schema includes:
- User model (with passwordHash as required String)
- Organization model (local-only entities)
- OrganizationRole model
- UserOrganization model (junction table)

**NEW REQUIREMENT**:

**18. Hybrid Source of Truth & Identity**:
The system must support entities sourced from PEMS (HxGN EAM) while maintaining local flexibility.

- **Hybrid Identity**: Users may be sourced from PEMS (`authProvider='pems'`) but retain a local password hash for hybrid authentication (`passwordHash` is nullable but often populated).
- **Hybrid Tenancy**: Organizations may be synced from PEMS. These are "External" records where core identity fields (Code, Name) are read-only locally, but settings are writable.
- **Hybrid Access**: User assignments can be dictated by PEMS sync (`assignmentSource='pems_sync'`) or granted locally (`assignmentSource='local'`).

**YOUR MISSION**:

**Step 1: Analyze Business Impact**
This change introduces:
- [ ] External system as source of truth for identity
- [ ] Potential sync conflicts (PEMS says "Viewer", local says "Editor")
- [ ] Orphaned accounts (deleted in PEMS but still in Vanguard)
- [ ] Hybrid authentication (PEMS user with local password)

These create new acceptance criteria.

**Step 2: Add New Context Item**
Insert as item #18 in "Context and Problem Statement":

```markdown
18. **Hybrid Source of Truth & Identity**: The system must support entities sourced from PEMS (HxGN EAM) while maintaining local flexibility.
   - **Hybrid Identity**: Users may be sourced from PEMS (`authProvider='pems'`) but retain a local password hash for hybrid authentication (`passwordHash` is nullable but often populated).
   - **Hybrid Tenancy**: Organizations may be synced from PEMS. These are "External" records where core identity fields (Code, Name) are read-only locally, but settings are writable.
   - **Hybrid Access**: User assignments can be dictated by PEMS sync (`assignmentSource='pems_sync'`) or granted locally (`assignmentSource='local'`).
```

**Step 3: Update Database Schema**

Replace the User, Organization, and UserOrganization model definitions with these updated versions:

```prisma
// UPDATED User Model (Hybrid Support)
model User {
  id                String   @id @default(cuid())
  username          String   @unique
  email             String   @unique

  // Hybrid Auth: Nullable because pure SSO users might not have one,
  // but Hybrid PEMS users WILL have one.
  passwordHash      String?

  // Identity Source
  externalId        String?  @unique // PEMS User ID (e.g., "10345")
  authProvider      String   @default("local") // "local", "pems"

  // ... rest of existing fields (serviceStatus, preferences, etc.) ...

  @@index([externalId])
  @@index([authProvider])
}

// UPDATED Organization Model (Hybrid Tenancy)
model Organization {
  id                String   @id @default(cuid())

  // Identity Source
  externalId        String?  @unique // PEMS Tenant/Org ID
  isExternal        Boolean  @default(false) // True if managed by PEMS

  // ... rest of existing fields (settings, serviceStatus, etc.) ...

  @@index([externalId])
  @@index([isExternal])
}

// UPDATED UserOrganization Model (Hybrid Access)
model UserOrganization {
  // ... existing fields (userId, organizationId, roleId, etc.) ...

  // Access Source
  assignmentSource  String   @default("local") // "local", "pems_sync", "auto_provision"
  externalRoleId    String?  // Reference to specific PEMS role ID

  // Override Tracking (Crucial for Hybrid)
  isCustom          Boolean  @default(false) // True if we changed permissions locally for a PEMS-synced user

  @@index([assignmentSource])
  @@index([isCustom])
}
```

**Step 4: Add Acceptance Criteria**

Add these new acceptance criteria to the "Success Criteria" section:

```markdown
### Hybrid Source of Truth
- [ ] PEMS users with `authProvider='pems'` can authenticate with local password (hybrid mode)
- [ ] PEMS users without local password can authenticate via SSO/external token
- [ ] Organizations with `isExternal=true` have read-only core identity fields (Code, Name)
- [ ] Local admins can modify settings/preferences for external organizations
- [ ] User assignments with `assignmentSource='pems_sync'` can be overridden locally (marked `isCustom=true`)
- [ ] Sync conflicts are detected and flagged for admin review
- [ ] Orphaned accounts (deleted in PEMS) are automatically flagged for suspension
```

**DELIVERABLES**:
1. Complete Markdown section for requirement #18 to insert in DECISION.md
2. Updated Prisma schema blocks for User, Organization, UserOrganization models
3. New acceptance criteria section for hybrid source of truth
4. Note on where to insert these changes in DECISION.md (after requirement #17, in Database Schema section)

**CONSTRAINTS**:
- Do NOT implement code. Only define WHAT we're building and WHY.
- Ensure backward compatibility: existing users/orgs default to `authProvider='local'` and `isExternal=false`
- Consider data migration: existing `passwordHash` values remain valid (nullable allows NULL for future SSO-only users)
```

**Status**: ⬜ Not Started

**How to Execute**:
1. Copy the prompt bundle above
2. Paste into a new chat message
3. Wait for product-requirements-analyst + postgres-jsonb-architect output
4. Apply the recommended changes to ADR-005-DECISION.md
5. Commit the changes to git
6. Mark this step as ✅ Complete

---

## Step 2: Update AI Opportunities

**Target**: `ADR-005-AI_OPPORTUNITIES.md`
**Agent**: `ai-systems-architect`
**Condition**: YES (Hybrid model creates new AI opportunities)

**Current State** (from AI_OPPORTUNITIES.md):
```
Contains Use Cases 1-25 covering:
- Part 1: Governance & Security (Use Cases 1-9)
- Part 2: UX Intelligence (Use Cases 10-15)
- Part 3: Executive BEO Analytics (Use Cases 16-25)
```

**Required Changes**:
- Add Use Case 26: Sync Conflict Resolution
- Add Use Case 27: Orphan Account Detection

---

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@ai-systems-architect

**SYSTEM CONTEXT**:
You are analyzing the AI implications of "PEMS Hybrid Source of Truth Integration".

**CURRENT AI HOOKS** (Read for context):
File: `docs/adrs/ADR-005-multi-tenant-access-control/ADR-005-AI_OPPORTUNITIES.md`

Current use cases include:
- Part 1: Governance & Security (Use Cases 1-9) - Permission explanations, audit search, role drift detection
- Part 2: UX Intelligence (Use Cases 10-15) - Context tooltips, financial masking, smart notifications
- Part 3: Executive BEO Analytics (Use Cases 16-25) - Voice analyst, variance narratives, scenario planning

**NEW FUNCTIONALITY**:
The system now supports hybrid source of truth where Users, Organizations, and Role Assignments can be sourced from PEMS (HxGN EAM) or managed locally. This creates:
1. **Sync Conflicts**: PEMS sync tries to change a permission that was manually overridden locally
2. **Orphan Accounts**: Users deleted in PEMS but still active in Vanguard

**YOUR MISSION**:

**Step 1: Identify New Data Hooks**

For Sync Conflict Detection:
- Log: `{ syncId, userId, field, pemsValue, localValue, resolution, timestamp }`
- Capture in: `pems-sync-service.ts` during reconciliation

For Orphan Account Detection:
- Log: `{ userId, lastSeenInPems, deletedInPemsAt, currentStatus, timestamp }`
- Capture in: `pems-sync-service.ts` when user not found in PEMS response

**Step 2: Design the Hook Structure**

```typescript
// Hook 1: Sync Conflict Detection
interface SyncConflictEvent {
  syncId: string;
  userId: string;
  organizationId: string;
  field: string; // e.g., "roleId", "permissions"
  pemsValue: any;
  localValue: any;
  resolution: 'local_wins' | 'pems_wins' | 'manual_review';
  timestamp: Date;
}

// Hook 2: Orphan Account Detection
interface OrphanAccountEvent {
  userId: string;
  externalId: string; // PEMS User ID
  lastSeenInPems: Date;
  deletedInPemsAt: Date;
  currentStatus: string; // "active", "suspended"
  recommendedAction: 'suspend' | 'convert_to_local' | 'delete';
  timestamp: Date;
}
```

**Step 3: AI Use Cases**

Add these two use cases to **Part 1: Governance & Security**:

```markdown
### Use Case 26: Sync Conflict Resolution

**Scenario**: PEMS sync indicates User "John Doe" should be a "Viewer", but Local Admin previously upgraded him to "Editor" (marked as `isCustom=true`).

**AI Data Available**:
- PEMS role assignment: `{ roleId: 'viewer', source: 'pems', effectiveDate: '2025-11-20' }`
- Local override: `{ roleId: 'editor', isCustom: true, modifiedBy: 'admin-sarah', modifiedAt: '2025-11-15' }`
- Sync policy: `{ conflictResolution: 'local_wins' }`

**AI Action**:
"🔄 **Conflict Detected**: PEMS sync attempted to downgrade User 'John Doe' from 'Editor' to 'Viewer'. I have preserved the local 'Editor' role (marked as custom override) per your policy 'Local Overrides Win'. This conflict has been flagged for your review in the Audit Log."

**UX Integration**: Toast notification with "View Conflict" button → Opens audit log entry with diff view

**Data Capture**:
```typescript
await logAiEvent({
  type: 'sync_conflict_resolved',
  userId: john.id,
  metadata: {
    field: 'roleId',
    pemsValue: 'viewer',
    localValue: 'editor',
    resolution: 'local_wins',
    policy: 'local_overrides_win'
  }
});
```

**Mandatory Hook**: `pems-sync-service.ts` → `reconcileUserAssignments()` function
```

```markdown
### Use Case 27: Orphan Account Detection

**Scenario**: User "JSmith" (`externalId: 'PEMS-10345'`) was deleted in PEMS 2 days ago but remains `status='active'` in Vanguard. This could be due to sync failure, or the user was converted to a hybrid local account.

**AI Data Available**:
- User record: `{ id: '...', username: 'jsmith', authProvider: 'pems', externalId: 'PEMS-10345', status: 'active' }`
- PEMS sync log: `{ syncId: 'sync-123', usersProcessed: 150, jsmithFound: false, timestamp: '2025-11-24' }`
- Last successful sync before deletion: `{ syncId: 'sync-120', jsmithFound: true, timestamp: '2025-11-22' }`

**AI Action**:
"⚠️ **Security Alert**: User 'JSmith' (jsmith@example.com) is currently ACTIVE in Vanguard but was deleted from PEMS source system on Nov 22nd. This account has been orphaned for 2 days. Recommended action: Immediate suspension pending investigation."

**UX Integration**: Admin dashboard shows "Orphaned Accounts" badge (count) → Clicking opens filtered user list

**Data Capture**:
```typescript
await logAiEvent({
  type: 'orphan_account_detected',
  userId: jsmith.id,
  metadata: {
    externalId: 'PEMS-10345',
    lastSeenInPems: '2025-11-22T10:30:00Z',
    daysSinceOrphaned: 2,
    currentStatus: 'active',
    recommendedAction: 'suspend'
  }
});
```

**Mandatory Hook**: `pems-sync-service.ts` → `detectOrphanedAccounts()` function (runs after sync completes)
```

**Step 4: API Requirements**

For these AI features, the system needs:
- [ ] **Dry-Run Sync API**: `POST /api/pems/sync/preview` - Shows what would change without applying
- [ ] **Conflict Review API**: `GET /api/pems/conflicts?status=pending` - Lists all unresolved sync conflicts
- [ ] **Orphan Account API**: `GET /api/users/orphaned` - Lists users deleted in PEMS but active locally

**DELIVERABLES**:
1. Two new use cases (26 & 27) formatted for AI_OPPORTUNITIES.md
2. TypeScript interface definitions for SyncConflictEvent and OrphanAccountEvent
3. Data capture examples for both use cases
4. API requirements for AI conflict management features
5. Recommendation on where to insert (in Part 1: Governance & Security, after Use Case 9 or 25)

**CONSTRAINT**:
Think proactively about security. Orphaned accounts are a **HIGH RISK** - attackers could exploit deleted PEMS users that remain active in Vanguard.
```

**Status**: ⬜ Not Started

---

## Step 3: Update UX & Interaction Model

**Target**: `ADR-005-UX_SPEC.md`
**Agent**: `ux-technologist`
**Condition**: YES (UI needs visual indicators for PEMS entities)

**Current State** (from UX_SPEC.md):
```
Version 3.0 with 29 use cases covering:
- User Management UI
- Organization Settings UI
- Permission Matrix
- Audit Log Viewer
- Core Governance features (Pre-Flight, Time Travel, Import Wizard, BEO Glass Mode)
```

**Required Changes**:
- Add "Source" column to User Management table with PEMS badge
- Add edit warnings for PEMS-managed users (email field locked warning)
- Add PEMS badge to Organization Settings with sync controls
- Update Edit User Modal with hybrid identity warnings

---

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@ux-technologist

**SYSTEM CONTEXT**:
You are defining the UX specification for "PEMS Hybrid Source of Truth Integration".

**CURRENT UX RULES** (Read for context):
File: `docs/adrs/ADR-005-multi-tenant-access-control/ADR-005-UX_SPEC.md`

Current version includes:
- User Management table with columns: Name, Email, Role, Status, Actions
- Organization Settings page
- Permission editing modals
- Latency budgets: <100ms for UI interactions, <500ms for permission checks

**NEW FUNCTIONALITY**:
The system now distinguishes between:
- **Local Users**: Created and managed entirely in Vanguard (`authProvider='local'`)
- **PEMS Users**: Sourced from PEMS with hybrid authentication (`authProvider='pems'`, may have local password)
- **Local Orgs**: Created in Vanguard (`isExternal=false`)
- **PEMS Orgs**: Synced from PEMS with read-only identity (`isExternal=true`)

Users need visual indicators to understand:
1. Which entities are externally managed (cannot be fully edited/deleted)
2. When editing might break sync (e.g., changing email for PEMS user)
3. How to trigger manual sync or view PEMS source

**YOUR MISSION**:

**Step 1: Define Visual Indicators**

**User Management Table** - Add "Source" column:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 👥 User Management                                                       │
├──────────────────────────────────────────────────────────────────────────┤
│ Name           │ Source       │ Status   │ Actions                       │
├────────────────┼──────────────┼──────────┼───────────────────────────────┤
│ John Doe       │ ☁️ PEMS      │ Active   │ [Edit] [Suspend] [Reset PW]   │
│ Jane Smith     │ 🏠 Local     │ Active   │ [Edit] [Suspend] [Delete]     │
│ Bob Jones      │ ☁️ PEMS      │ Locked   │ [View Only]                   │
└────────────────┴──────────────┴──────────┴───────────────────────────────┘
```

**Source Badge Rules**:
- `☁️ PEMS` = Blue badge, tooltip: "User managed by PEMS (HxGN EAM)"
- `🏠 Local` = Gray badge, tooltip: "User created locally in Vanguard"

**Action Button States**:
- PEMS users: [Delete] button is **disabled** (show "Suspend" instead)
- Local users: [Delete] button is **enabled**
- Both: [Reset PW] is enabled (hybrid auth supports local passwords for PEMS users)

**Step 2: Edit User Modal (Hybrid Warnings)**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ✏️ Edit User: John Doe                                                  │
│ [☁️ PEMS Managed]                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│ Username:   john.doe          [Read Only]                               │
│                                                                          │
│ Email:      john.doe@example.com                                        │
│             ⚠️ Warning: Managed by PEMS. Changing this may break sync.  │
│             [ ] I understand and want to override                       │
│                                                                          │
│ Password:   ••••••••••        [Change Password]                         │
│             ℹ️ Hybrid mode: Local password is supported                 │
│                                                                          │
│ Preferences:                                                             │
│   [✓] Email Notifications                                               │
│   [ ] Voice Mode                                                        │
│                                                                          │
│ [Cancel] [Save Changes]                                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

**Behavior**:
- **Email field**: Editable, but shows warning. "Save Changes" is **disabled** until user checks "I understand" checkbox.
- **Password field**: Fully editable for both PEMS and local users (hybrid support).
- **Username field**: Read-only for PEMS users (linked to external ID).

**Step 3: Organization Settings (PEMS Badge)**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🏢 Organization: HOLNG                                                  │
│ [☁️ PEMS Synced]                                                        │
├─────────────────────────────────────────────────────────────────────────┤
│ Code:       HOLNG              [Read Only]                              │
│             ℹ️ Managed by PEMS. To rename, update in HxGN EAM.          │
│                                                                          │
│ Name:       Holcim Nigeria     [Read Only]                              │
│                                                                          │
│ Settings:   [Editable]                                                  │
│   Timezone:        UTC+1 (Lagos)                                        │
│   Currency:        NGN                                                  │
│   Fiscal Year:     Jan-Dec                                              │
│                                                                          │
│ Sync Status:                                                            │
│   Last Sync:       Nov 26, 2025 10:30 AM                                │
│   Next Sync:       Nov 27, 2025 10:30 AM                                │
│                                                                          │
│ [Force Sync Now] [View PEMS Source] [Unlink from PEMS]                 │
└─────────────────────────────────────────────────────────────────────────┘
```

**Behavior**:
- **Code/Name fields**: Read-only for `isExternal=true` orgs (PEMS-managed).
- **Settings fields**: Fully editable (local preferences override PEMS).
- **Force Sync Now**: Triggers manual PEMS sync for this org.
- **Unlink from PEMS**: Converts org to local (sets `isExternal=false`), shows destructive confirmation modal.

**Step 4: Perceived Performance**

For PEMS-related operations:
- **Loading User Table**: <500ms (includes fetching `authProvider` for badge display)
- **Edit Modal Open**: <200ms (badge determination is instant from cached data)
- **Force Sync Now**: Show progress modal immediately, poll every 2s for sync status updates
- **Unlink Action**: Show "Are you sure?" modal <100ms, actual unlink operation <1s

**Step 5: Accessibility**

- Source badges (☁️, 🏠) must have `aria-label` for screen readers
- Warning icons (⚠️) must announce "Warning: Managed by PEMS" to screen readers
- Disabled [Delete] button must have `aria-disabled="true"` and tooltip explaining why
- Edit modal checkbox "I understand" must be keyboard-navigable (Tab to focus, Space to toggle)

**DELIVERABLES**:
1. ASCII mockups for User Management table with Source column
2. Edit User Modal mockup with hybrid warnings
3. Organization Settings mockup with PEMS badge
4. Perceived performance specifications for sync operations
5. Accessibility requirements for new UI elements
6. Recommendation on where to insert in UX_SPEC.md (create new section "Hybrid Entity Management" or add to existing User/Org management sections)

**CONSTRAINT**:
Focus on how it FEELS. Users should immediately understand which entities are externally managed without reading documentation.
```

**Status**: ⬜ Not Started

---

## Step 4: Update Security & Testing Guardrails

**Target**: `ADR-005-TEST_PLAN.md`
**Agent**: `sdet-test-automation`
**Always Required**: YES

**Current State** (from TEST_PLAN.md):
```
Contains 150+ test scenarios covering:
- Security red-teaming (SQL injection, XSS, IDOR)
- Critical user flows
- AI quality assessment
- Coverage requirements (>80% backend, >80% frontend)
```

**Required Changes**:
- Add hybrid authentication security tests
- Add sync conflict detection tests
- Add orphan account detection tests
- Add PEMS entity CRUD restriction tests

---

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@sdet-test-automation

**SYSTEM CONTEXT**:
You are defining the testing strategy for "PEMS Hybrid Source of Truth Integration".

**CURRENT TEST PLAN** (Read for context):
File: `docs/adrs/ADR-005-multi-tenant-access-control/ADR-005-TEST_PLAN.md`

Current test coverage includes:
- Security red-teaming for SQL injection, XSS, IDOR, rate limiting
- Critical user flows for login, permission checks, audit logging
- AI quality tests for permission explanations and role drift detection

**NEW FUNCTIONALITY**:
The system now supports:
1. **Hybrid Authentication**: PEMS users can have local passwords OR SSO-only
2. **External Entity Management**: PEMS orgs/users have restricted CRUD operations
3. **Sync Conflict Detection**: AI detects when PEMS and local values clash
4. **Orphan Account Detection**: AI flags users deleted in PEMS but active locally

**YOUR MISSION**:

**Step 1: Security Red Team Scenarios**

Add these adversarial tests:

**Test Suite: Hybrid Authentication Security**

```
TEST-HYB-001: Bypass PEMS Authentication
- Attack: Attacker tries to login as PEMS user using default/common passwords
- Defense: System must NOT allow password auth if user has no local passwordHash
- Expected: 401 Unauthorized with message "SSO required for this user"

TEST-HYB-002: PEMS User Impersonation
- Attack: Attacker creates local user with same email as PEMS user
- Defense: Email uniqueness constraint prevents duplicate
- Expected: 409 Conflict with message "Email already exists"

TEST-HYB-003: Hybrid Password Reset Abuse
- Attack: Attacker resets password for PEMS user to gain access
- Defense: Password reset requires email verification
- Expected: Password reset link sent to registered email only

TEST-HYB-004: Orphan Account Exploitation
- Attack: Attacker compromises PEMS user, then deletes user in PEMS to evade audit
- Defense: Orphan detection flags account within 24 hours of sync
- Expected: Account auto-suspended with alert to admins
```

**Test Suite: External Entity CRUD Restrictions**

```
TEST-EXT-001: Delete PEMS Organization
- Attack: Local admin tries to DELETE organization with isExternal=true
- Defense: API returns 403 Forbidden
- Expected: Error message "Cannot delete PEMS-managed organization. Suspend or unlink instead."

TEST-EXT-002: Rename PEMS Organization Code
- Attack: Admin tries to PATCH /organizations/{id} with new 'code' for PEMS org
- Defense: API validates isExternal=true and rejects code change
- Expected: 422 Unprocessable Entity with field error "code: read-only for external orgs"

TEST-EXT-003: Delete PEMS User
- Attack: Admin tries to DELETE /users/{id} for user with authProvider='pems'
- Defense: API returns 403 Forbidden
- Expected: Error message "Cannot delete PEMS user. Use suspend instead."

TEST-EXT-004: Bypass External Flag
- Attack: Attacker sends PATCH with isExternal=false to convert PEMS org to local
- Defense: API requires special "unlink" endpoint with confirmation token
- Expected: 403 Forbidden (must use POST /organizations/{id}/unlink with confirmationToken)
```

**Step 2: Critical User Flow Tests**

Add these end-to-end scenarios:

**Flow: PEMS User Hybrid Login**
1. User "john.doe@example.com" (authProvider='pems') navigates to /login
2. User enters username + password (local password is set)
3. System validates passwordHash (hybrid mode)
4. User is logged in successfully
5. Session includes flag `authProvider='pems'` for UI badges

**Acceptance**:
- [ ] Login succeeds with valid local password
- [ ] Login fails with invalid password (same as local users)
- [ ] UI shows "☁️ PEMS" badge in user profile

**Flow: Sync Conflict Detection**
1. Admin manually upgrades PEMS user "jane@example.com" to "Editor" role
2. System marks assignment as `isCustom=true`
3. PEMS sync runs and indicates user should be "Viewer"
4. System detects conflict (local='Editor', pems='Viewer')
5. AI logs conflict event and preserves local "Editor" role
6. Admin receives notification: "1 sync conflict detected"

**Acceptance**:
- [ ] Local role is preserved (isCustom=true)
- [ ] Conflict is logged in audit table
- [ ] Admin notification sent within 5 minutes
- [ ] Conflict appears in Admin Dashboard "Conflicts" tab

**Flow: Orphan Account Detection**
1. PEMS sync runs and processes 100 users
2. User "bob@example.com" (externalId='PEMS-99') is NOT in PEMS response
3. System checks last sync where Bob was found (2 days ago)
4. System marks Bob as orphaned and logs event
5. AI recommends suspension
6. Admin receives alert: "1 orphaned account detected"

**Acceptance**:
- [ ] User status remains "active" (not auto-suspended yet)
- [ ] Orphan event logged with recommendation
- [ ] Admin alert sent within 1 hour of sync completion
- [ ] User appears in Admin Dashboard "Orphaned Accounts" list

**Step 3: Performance Thresholds**

For PEMS hybrid operations:
- **Hybrid auth login**: <300ms (same as local users)
- **Sync conflict detection**: <50ms per conflict (during sync)
- **Orphan detection query**: <200ms (after sync completes)
- **UI badge rendering**: <10ms (cached from user record)

**Step 4: Edge Cases**

What breaks hybrid source of truth?

**Edge Case Tests**:

```
EDGE-001: PEMS User with No Local Password
- Scenario: User has authProvider='pems' and passwordHash=NULL
- Expected: Password login fails, SSO login succeeds
- Test: Attempt login with password → 401, attempt SSO → 200

EDGE-002: Orphan Account that Was Converted to Local
- Scenario: PEMS user was manually converted (authProvider changed to 'local')
- Expected: Orphan detection ignores this user (no longer PEMS-linked)
- Test: Sync runs, user not in PEMS → No orphan alert

EDGE-003: Sync Conflict with Multiple Overrides
- Scenario: Local admin changed BOTH role AND permissions for PEMS user
- Expected: Both overrides preserved (isCustom=true for assignment)
- Test: Verify both fields retained after sync

EDGE-004: Force Unlink During Active Sync
- Scenario: Admin clicks "Unlink from PEMS" while sync is running
- Expected: Unlink operation waits for sync completion
- Test: API returns 409 Conflict "Sync in progress, retry in X seconds"

EDGE-005: Deleted PEMS User Re-Created
- Scenario: User deleted in PEMS (orphaned), then re-created in PEMS with same email
- Expected: System links to new PEMS externalId, clears orphan flag
- Test: Sync detects new externalId, updates user record, removes orphan status
```

**DELIVERABLES**:
1. Security red team test suite (8 tests) for hybrid auth and external entity restrictions
2. Critical user flow tests (3 flows) with acceptance criteria
3. Performance thresholds for sync operations
4. Edge case test scenarios (5 tests)
5. Recommendation on where to insert in TEST_PLAN.md (create new section "Hybrid Source of Truth Security")

**CONSTRAINT**:
Think adversarially. Orphaned accounts are a **CRITICAL SECURITY RISK**. Your tests must ensure they're detected within 24 hours max.
```

**Status**: ⬜ Not Started

---

## Step 5: Update Technical Implementation Plan

**Target**: `ADR-005-IMPLEMENTATION_PLAN.md`
**Agent**: `backend-architecture-optimizer`
**Always Required**: YES

**Current State** (from IMPLEMENTATION_PLAN.md):
```
Version 2.0 with 10 phases:
- Phase 1: Database Schema
- Phase 2: Backend Authorization
- Phase 5: Admin UI + Core Governance
- (Phases 3-10 cover PEMS sync, frontend, AI, testing)
```

**Required Changes**:
- Update Phase 2: Hybrid authentication service logic
- Update Phase 5: Admin UI restrictions for external entities

---

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@backend-architecture-optimizer

**SYSTEM CONTEXT**:
You are designing the technical implementation for "PEMS Hybrid Source of Truth Integration".

**CURRENT ARCHITECTURE** (Read for context):
File: `docs/adrs/ADR-005-multi-tenant-access-control/ADR-005-IMPLEMENTATION_PLAN.md`

Current Phase 2 includes:
- authService.login() - validates username + passwordHash
- JWT token generation
- Session management

Current Phase 5 includes:
- User CRUD APIs (GET, POST, PATCH, DELETE)
- Organization CRUD APIs
- Admin UI for user/org management

**NEW FUNCTIONALITY**:
Database schema now includes:
- User.authProvider ('local' | 'pems')
- User.externalId (PEMS User ID)
- User.passwordHash (nullable for SSO-only users)
- Organization.isExternal (true if PEMS-managed)
- UserOrganization.assignmentSource ('local' | 'pems_sync')
- UserOrganization.isCustom (true if locally overridden)

**PERFORMANCE CONSTRAINT**: Hybrid auth must complete in <300ms (same as local auth)

**YOUR MISSION**:

**Step 1: Update Phase 2 - Backend Authorization**

**Task 2.1: Hybrid Authentication Service**

Current implementation:
```typescript
async login(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    throw new UnauthorizedException('Invalid credentials');
  }
  return generateJWT(user);
}
```

**New implementation** (Hybrid support):
```typescript
async login(username: string, password: string, ssoToken?: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    throw new UnauthorizedException('Invalid credentials');
  }

  // Hybrid Auth Logic
  if (user.authProvider === 'local') {
    // Local users MUST have passwordHash
    if (!user.passwordHash || !bcrypt.compareSync(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }
  } else if (user.authProvider === 'pems') {
    // PEMS users: Try local password first (Hybrid), fallback to SSO
    if (password && user.passwordHash) {
      // Hybrid mode: Local password is set
      if (!bcrypt.compareSync(password, user.passwordHash)) {
        throw new UnauthorizedException('Invalid credentials');
      }
    } else if (ssoToken) {
      // SSO-only mode: Validate external token
      const isValid = await this.validatePemsToken(ssoToken);
      if (!isValid) {
        throw new UnauthorizedException('Invalid SSO token');
      }
    } else {
      throw new UnauthorizedException('Password or SSO required');
    }
  }

  return generateJWT(user);
}
```

**Task 2.2: JIT Provisioning (Auto-Create PEMS Users)**

Add new service method:
```typescript
async provisionPemsUser(pemsUserData: PemsUserDto) {
  // Called when PEMS SSO succeeds but user doesn't exist locally
  const user = await prisma.user.create({
    data: {
      username: pemsUserData.username,
      email: pemsUserData.email,
      authProvider: 'pems',
      externalId: pemsUserData.id,
      passwordHash: null, // SSO-only initially
      serviceStatus: 'active',
    }
  });
  return user;
}
```

**Step 2: Update Phase 5 - Admin UI APIs**

**Task 5.1: User CRUD Restrictions**

Update `PATCH /api/users/:id` endpoint:
```typescript
async updateUser(id: string, data: UpdateUserDto, force: boolean = false) {
  const user = await prisma.user.findUnique({ where: { id } });

  // Warning: Editing PEMS user email
  if (user.authProvider === 'pems' && data.email && data.email !== user.email) {
    if (!force) {
      throw new ConflictException({
        message: 'Changing email for PEMS user may break sync',
        requiresConfirmation: true,
        confirmationFlag: 'force=true'
      });
    }
    // If force=true, log warning and proceed
    await auditLog.warn(`Admin overrode email for PEMS user ${id}`);
  }

  // Allow password updates for both local and PEMS users (Hybrid support)
  if (data.password) {
    data.passwordHash = bcrypt.hashSync(data.password, 10);
    delete data.password;
  }

  return prisma.user.update({ where: { id }, data });
}
```

Update `DELETE /api/users/:id` endpoint:
```typescript
async deleteUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });

  // Prevent deletion of PEMS users
  if (user.authProvider === 'pems') {
    throw new ForbiddenException({
      message: 'Cannot delete PEMS-managed user',
      recommendation: 'Use suspend instead',
      endpoint: 'PATCH /api/users/:id { serviceStatus: "suspended" }'
    });
  }

  return prisma.user.delete({ where: { id } });
}
```

**Task 5.2: Organization CRUD Restrictions**

Update `PATCH /api/organizations/:id` endpoint:
```typescript
async updateOrganization(id: string, data: UpdateOrgDto) {
  const org = await prisma.organization.findUnique({ where: { id } });

  // Read-only fields for PEMS orgs
  if (org.isExternal) {
    const readOnlyFields = ['code', 'name'];
    const attemptedChanges = readOnlyFields.filter(f => data[f] !== undefined);

    if (attemptedChanges.length > 0) {
      throw new UnprocessableEntityException({
        message: 'Cannot modify core identity fields for PEMS-managed organization',
        readOnlyFields: attemptedChanges,
        recommendation: 'Update in PEMS (HxGN EAM) to sync changes'
      });
    }
  }

  // Settings/preferences are always writable
  return prisma.organization.update({ where: { id }, data });
}
```

Update `DELETE /api/organizations/:id` endpoint:
```typescript
async deleteOrganization(id: string) {
  const org = await prisma.organization.findUnique({ where: { id } });

  // Prevent deletion of PEMS orgs
  if (org.isExternal) {
    throw new ForbiddenException({
      message: 'Cannot delete PEMS-managed organization',
      recommendation: 'Use unlink endpoint to convert to local',
      endpoint: 'POST /api/organizations/:id/unlink { confirmationToken }'
    });
  }

  return prisma.organization.delete({ where: { id } });
}
```

**Step 3: New Endpoint - Unlink from PEMS**

Add new endpoint:
```typescript
// POST /api/organizations/:id/unlink
async unlinkFromPems(id: string, confirmationToken: string) {
  // Verify confirmation token (sent via email to prevent accidents)
  const isValid = await this.verifyUnlinkToken(confirmationToken);
  if (!isValid) {
    throw new UnauthorizedException('Invalid confirmation token');
  }

  const org = await prisma.organization.update({
    where: { id },
    data: {
      isExternal: false,
      externalId: null,
      // Keep all other data (code, name, settings) intact
    }
  });

  await auditLog.critical(`Organization ${org.code} unlinked from PEMS by admin`);
  return org;
}
```

**Step 4: AI Hooks Integration**

From `ADR-005-AI_OPPORTUNITIES.md`, we need:
- Sync conflict detection hook in `pems-sync-service.ts`
- Orphan account detection hook in `pems-sync-service.ts`

Add to `pems-sync-service.ts`:
```typescript
async reconcileUserAssignments(pemsUsers: PemsUser[]) {
  for (const pemsUser of pemsUsers) {
    const localUser = await prisma.user.findUnique({
      where: { externalId: pemsUser.id },
      include: { organizations: true }
    });

    if (!localUser) continue;

    for (const pemsAssignment of pemsUser.assignments) {
      const localAssignment = localUser.organizations.find(
        o => o.organizationId === pemsAssignment.orgId
      );

      // CONFLICT DETECTION (AI Hook)
      if (localAssignment?.isCustom && localAssignment.roleId !== pemsAssignment.roleId) {
        await logAiEvent({
          type: 'sync_conflict_resolved',
          userId: localUser.id,
          metadata: {
            field: 'roleId',
            pemsValue: pemsAssignment.roleId,
            localValue: localAssignment.roleId,
            resolution: 'local_wins',
            policy: 'preserve_custom_overrides'
          }
        });
        // Preserve local override (don't update)
        continue;
      }

      // No conflict: Apply PEMS value
      await prisma.userOrganization.update({
        where: { id: localAssignment.id },
        data: {
          roleId: pemsAssignment.roleId,
          assignmentSource: 'pems_sync',
        }
      });
    }
  }
}

async detectOrphanedAccounts(pemsUsers: PemsUser[]) {
  const pemsExternalIds = pemsUsers.map(u => u.id);

  // Find all PEMS users in local DB that were NOT in PEMS response
  const orphans = await prisma.user.findMany({
    where: {
      authProvider: 'pems',
      externalId: { notIn: pemsExternalIds },
      serviceStatus: 'active', // Only flag active users
    }
  });

  for (const orphan of orphans) {
    // ORPHAN DETECTION (AI Hook)
    await logAiEvent({
      type: 'orphan_account_detected',
      userId: orphan.id,
      metadata: {
        externalId: orphan.externalId,
        lastSeenInPems: orphan.updatedAt, // Approximation
        daysSinceOrphaned: daysSince(orphan.updatedAt),
        currentStatus: orphan.serviceStatus,
        recommendedAction: 'suspend'
      }
    });

    // Send admin alert
    await notificationService.sendAlert({
      type: 'security',
      priority: 'high',
      message: `Orphaned account detected: ${orphan.email}`,
      action: `Review user ${orphan.id}`
    });
  }
}
```

**Step 5: Error Handling**

For hybrid auth failures:
```typescript
// Scenario: PEMS user with no local password tries password login
HTTP 401 Unauthorized
{
  "error": "AuthenticationFailed",
  "message": "This user requires SSO authentication",
  "authProvider": "pems",
  "supportedMethods": ["sso"],
  "ssoEndpoint": "/auth/pems/sso"
}

// Scenario: Admin tries to delete PEMS org
HTTP 403 Forbidden
{
  "error": "OperationNotAllowed",
  "message": "Cannot delete PEMS-managed organization",
  "recommendation": "Use suspend or unlink instead",
  "allowedEndpoints": [
    "PATCH /api/organizations/:id { serviceStatus: 'suspended' }",
    "POST /api/organizations/:id/unlink { confirmationToken }"
  ]
}
```

**DELIVERABLES**:
1. Updated authService.login() implementation with hybrid logic
2. JIT provisioning service method
3. Updated User/Organization CRUD endpoints with external entity restrictions
4. New unlink endpoint specification
5. AI hook integration points in pems-sync-service.ts
6. Error response specifications
7. Recommendation on where to insert in IMPLEMENTATION_PLAN.md (modify Phase 2 Task 2.1, Phase 5 Tasks 5.1-5.2)

**CONSTRAINT**:
Focus on BACKEND architecture. Frontend changes for badges/warnings are handled in UX_SPEC.md.
Ensure backward compatibility: existing users/orgs default to local with no migration needed.
```

**Status**: ⬜ Not Started

---

## 🔄 Step 6: Re-Orchestrate the Workflow

**After ALL blueprint updates are complete**, regenerate the implementation workflow:

```bash
/execute-adr 005
```

**What This Does**:
- Reads your UPDATED blueprint documents (DECISION, AI_OPPORTUNITIES, UX_SPEC, TEST_PLAN, IMPLEMENTATION_PLAN)
- Generates a NEW `ADR-005-AGENT_WORKFLOW.md` file
- Includes new tasks for implementing hybrid source of truth
- Updates dependency graph to reflect PEMS integration work
- Adjusts timeline estimate (likely adds 3-5 days for hybrid features)

**Why This Is CRITICAL**:
- ❌ Without re-orchestration, the old workflow omits hybrid auth and PEMS entity restrictions
- ✅ Re-orchestration ensures tasks like "Implement orphan detection" are scheduled
- ✅ New AI hooks, UX badges, and security tests are enforced in workflow

**Expected Workflow Changes**:
- Phase 1 will include new database fields (externalId, isExternal, assignmentSource, isCustom)
- Phase 2 will include hybrid auth service + JIT provisioning
- Phase 5 will include CRUD restrictions + unlink endpoint
- Phase 6-9 (AI) will include sync conflict and orphan detection use cases
- Phase 10 (Testing) will include hybrid auth security tests

---

## 📋 Completion Checklist

Use this checklist to track your progress:

**Blueprint Updates**:
- [ ] Step 1: DECISION.md updated (requirement #18 + database schema changes)
- [ ] Step 2: AI_OPPORTUNITIES.md updated (Use Cases 26-27 added)
- [ ] Step 3: UX_SPEC.md updated (PEMS badges, edit warnings, org settings)
- [ ] Step 4: TEST_PLAN.md updated (hybrid auth tests, external entity tests, orphan detection)
- [ ] Step 5: IMPLEMENTATION_PLAN.md updated (Phase 2 hybrid auth, Phase 5 CRUD restrictions)
- [ ] All changes committed to git

**Re-Orchestration**:
- [ ] Ran `/execute-adr 005`
- [ ] New AGENT_WORKFLOW.md generated
- [ ] Reviewed new tasks in workflow (should include hybrid auth, sync conflict, orphan detection)
- [ ] Timeline adjusted (expect +3-5 days for hybrid features)
- [ ] Ready to begin implementation

**Documentation**:
- [ ] Updated ADR-005 README.md status to "Scope Change: PEMS Hybrid Integration - In Progress"
- [ ] Updated DEVELOPMENT_LOG.md with scope change note and rationale
- [ ] Notified stakeholders of timeline impact

---

## 📚 Related Documentation

- **Original Decision**: [ADR-005-DECISION.md](./ADR-005-DECISION.md)
- **AI Opportunities**: [ADR-005-AI_OPPORTUNITIES.md](./ADR-005-AI_OPPORTUNITIES.md)
- **UX Specification**: [ADR-005-UX_SPEC.md](./ADR-005-UX_SPEC.md)
- **Test Plan**: [ADR-005-TEST_PLAN.md](./ADR-005-TEST_PLAN.md)
- **Implementation Plan**: [ADR-005-IMPLEMENTATION_PLAN.md](./ADR-005-IMPLEMENTATION_PLAN.md)

---

**Update Plan Generated**: 2025-11-26
**Generated By**: Change Management Orchestrator
**Status**: ⏳ Awaiting Blueprint Updates

*This is a scope change management document. Complete all steps before proceeding to code.*
