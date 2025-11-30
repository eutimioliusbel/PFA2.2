# ADR-005: Scope Change Remediation Plan

**Change Request**: "ADR-006 API Server Architecture Integration"
**Change Description**: "ADR-006 introduces a two-tier API architecture (ApiServer → ApiEndpoint) that interacts with ADR-005's Organization model. ApiServer has organizationId FK to Organization and must respect organization-level access control (perm_ManageSettings), service status (active/suspended), and external entity constraints (isExternal flag). This integration requires updates to permission middleware, cascading logic, and multi-tenant isolation tests."
**Impact Analysis**: MEDIUM
**Affected Documents**: 3 of 5 blueprint documents
**Date Created**: 2025-11-26

---

## 🛑 Critical Instruction

**DO NOT SKIP TO CODE IMPLEMENTATION**

You must update the Blueprint documents **BEFORE** you build the code.
This ensures:
- ✅ Permission checks are consistently enforced across API server management
- ✅ Organization service status cascades properly to child API servers
- ✅ External organization constraints are respected
- ✅ Multi-tenant isolation is thoroughly tested

Execute the Prompt Bundles below in order. Each bundle targets a specific specialist agent.

---

## 📊 Impact Summary

| Document | Impact Level | Changes Required |
|----------|-------------|------------------|
| DECISION.md | **LOW** | No changes needed (database schema already supports organizationId FK) |
| AI_OPPORTUNITIES.md | **LOW** | No changes needed (API server management is deterministic CRUD) |
| UX_SPEC.md | **MEDIUM** | Add permission check indicators for API Connectivity UI, org status badges |
| TEST_PLAN.md | **HIGH** | Add multi-tenant isolation tests, permission authorization tests, org service status cascading tests |
| IMPLEMENTATION_PLAN.md | **HIGH** | Update Phase 5 with API server authorization middleware, org status validation, external org constraints |

**Total Estimated Time**: 4-6 hours

---

## 🔄 Update Workflow

Follow these steps in order:

1. ⬜ Execute Step 1 (UX_SPEC.md update) - Permission indicators and org status badges
2. ⬜ Execute Step 2 (TEST_PLAN.md update) - Multi-tenant isolation and permission tests
3. ⬜ Execute Step 3 (IMPLEMENTATION_PLAN.md update) - Authorization middleware and cascading logic
4. ⬜ Re-orchestrate: `/execute-adr 005`

---

## Step 1: Update UX Specification

**Target**: `ADR-005-UX_SPEC.md`
**Agent**: `ux-technologist`
**Reason**: API Connectivity UI needs to show permission-based access and organization status indicators

**Current State** (from UX_SPEC.md):
```
API Connectivity UI shows API configurations in a table
No permission-based UI restrictions documented
No organization service status indicators
```

**Required Changes**:
- Add permission check for API server management (perm_ManageSettings)
- Add organization status badge to API server entries
- Add disabled state for API servers when org is suspended
- Add visual indicator for external organization constraints

---

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@ux-technologist

**SYSTEM CONTEXT**:
You are updating ADR-005 to accommodate ADR-006's API Server Architecture integration.

**CURRENT STATE** (Read for context):
File: `docs/adrs/ADR-005-multi-tenant-access-control/ADR-005-UX_SPEC.md`

Current UX specifications include:
- User Management table with permission-based action buttons
- Organization Settings page
- Permission-based feature visibility
- Latency budgets: <100ms for UI interactions, <500ms for permission checks

**NEW FUNCTIONALITY FROM ADR-006**:
The system now has ApiServer and ApiEndpoint models:
- ApiServer belongs to Organization (organizationId FK)
- API server management requires perm_ManageSettings permission
- API servers should reflect organization service status (suspended orgs = disabled servers)
- External organizations (isExternal=true) may have constraints on API server creation

**YOUR MISSION**:

**Step 1: API Connectivity UI Permission Checks**

**Current UI** (API Connectivity screen):
```
┌────────────────────────────────────────────────────────────────┐
│ 🔌 API Connectivity                                            │
├────────────────────────────────────────────────────────────────┤
│ Server Name     │ Organization │ Endpoints │ Actions           │
├─────────────────┼──────────────┼───────────┼──────────────────┤
│ PEMS Production │ HOLNG        │ 7         │ [Edit] [Test]    │
│ PEMS Dev        │ RIO          │ 5         │ [Edit] [Test]    │
└─────────────────┴──────────────┴───────────┴──────────────────┘
```

**Updated UI** (with permission checks and org status):
```
┌────────────────────────────────────────────────────────────────┐
│ 🔌 API Connectivity                                            │
├────────────────────────────────────────────────────────────────┤
│ Server Name     │ Organization        │ Status │ Actions       │
├─────────────────┼─────────────────────┼────────┼──────────────┤
│ PEMS Production │ HOLNG [✅ Active]   │ OK     │ [Edit] [Test]│
│ PEMS Dev        │ RIO [⚠️ Suspended]  │ -      │ [View Only]  │
│ ESS Integration │ BECH [☁️ External]  │ OK     │ [Edit] [Test]│
└─────────────────┴─────────────────────┴────────┴──────────────┘

ℹ️ RIO is suspended - API servers are unavailable

[+ Add Server] ← Only visible if user has perm_ManageSettings
```

**Permission-Based Visibility**:
- [+ Add Server] button: **Hidden** if `!perm_ManageSettings`
- [Edit] button: **Hidden** if `!perm_ManageSettings`
- [Test] button: **Always visible** (read operation)
- [View Only] mode: Shown for servers in suspended organizations

**Organization Status Badges**:
- `✅ Active` = Green badge, tooltip: "Organization is active"
- `⚠️ Suspended` = Orange badge, tooltip: "Organization is suspended - API servers unavailable"
- `☁️ External` = Blue badge, tooltip: "PEMS-managed organization"

**Step 2: Add/Edit Server Modal (Permission Warnings)**

**Add Server Modal** (permission check):
```
┌─────────────────────────────────────────────────────────────────┐
│ ➕ Add API Server                                               │
├─────────────────────────────────────────────────────────────────┤
│ Server Name:   _____________________                            │
│                                                                  │
│ Organization:  [Dropdown]                                       │
│                ⚠️ Only organizations where you have             │
│                   perm_ManageSettings are shown                 │
│                                                                  │
│ Base URL:      https://______________________                   │
│                                                                  │
│ Auth Type:     ○ JWT  ○ Basic  ○ OAuth                          │
│                                                                  │
│ [Cancel] [Create Server]                                        │
└─────────────────────────────────────────────────────────────────┘
```

**Behavior**:
- Organization dropdown: **Filtered** to show only orgs where `perm_ManageSettings = true`
- If user has 0 orgs with permission: Show message "You don't have permission to manage API servers. Contact your administrator."
- Suspended orgs: **Included** in dropdown but show warning badge

**Step 3: Organization Service Status Cascading**

**Scenario**: Admin suspends organization "RIO"

**UI Behavior**:
1. **API Connectivity Table**: RIO's API servers show grayed-out with [View Only] actions
2. **Status Column**: Changes to "Suspended" (orange badge)
3. **Test Button**: Becomes disabled with tooltip "Cannot test - Organization is suspended"
4. **Sync Button** (if applicable): Disabled with same tooltip

**Perceived Performance**:
- **Permission Check**: <50ms (cached from session)
- **Organization Status Update**: Real-time via WebSocket or 5-second polling
- **UI State Change**: <100ms (instant badge color change)
- **Modal Open**: <200ms (permission filtering happens client-side)

**Step 4: Accessibility**

- Organization status badges must have `aria-label` for screen readers
- Disabled [Edit] button must announce "Edit unavailable - requires Manage Settings permission"
- Suspended org servers must announce "API server unavailable - Organization is suspended"
- Permission-filtered dropdown must announce "X organizations available where you have permission"

**DELIVERABLES**:
1. Updated API Connectivity table mockup with org status badges and permission-based actions
2. Add/Edit Server modal mockup with permission warnings
3. Suspended organization UI behavior specification
4. Perceived performance specifications for permission checks
5. Accessibility requirements for new UI elements
6. Recommendation on where to insert in UX_SPEC.md (create new section "API Server Management UI" or add to existing Admin sections)

**CONSTRAINT**:
Focus on immediate visual feedback. Users should understand permission restrictions without attempting actions that will fail.
```

**Status**: ⬜ Not Started

**How to Execute**:
1. Copy the prompt bundle above
2. Paste into a new chat message
3. Wait for ux-technologist output
4. Apply the recommended changes to ADR-005-UX_SPEC.md
5. Commit the changes to git
6. Mark this step as ✅ Complete

---

## Step 2: Update Security & Testing Guardrails

**Target**: `ADR-005-TEST_PLAN.md`
**Agent**: `sdet-test-automation`
**Reason**: Need comprehensive tests for API server authorization, org status cascading, and multi-tenant isolation

**Current State** (from TEST_PLAN.md):
```
Contains 150+ test scenarios covering:
- Permission-based authorization for user/org management
- Multi-tenant data isolation
- Service status lifecycle
```

**Required Changes**:
- Add API server authorization tests (perm_ManageSettings required)
- Add organization service status cascading tests
- Add multi-tenant isolation tests for API servers
- Add external organization constraint tests

---

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@sdet-test-automation

**SYSTEM CONTEXT**:
You are updating ADR-005 test plan to cover ADR-006's API Server Architecture integration.

**CURRENT TEST PLAN** (Read for context):
File: `docs/adrs/ADR-005-multi-tenant-access-control/ADR-005-TEST_PLAN.md`

Current test coverage includes:
- Permission-based authorization (14 permission flags)
- Multi-tenant data isolation (users can only access their org's data)
- Service status lifecycle (active → suspended → locked)

**NEW FUNCTIONALITY FROM ADR-006**:
Database schema now includes:
```prisma
model ApiServer {
  id             String  @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  baseUrl        String
  authType       String
  // ... other fields
}
```

**Key Integration Points**:
1. API server CRUD requires `perm_ManageSettings` permission
2. API servers belong to organizations (organizationId FK)
3. Organization service status affects API server availability
4. External organizations (isExternal=true) may have constraints

**YOUR MISSION**:

**Step 1: Authorization Test Suite**

Add these permission-based authorization tests:

**Test Suite: API Server Management Authorization**

```
TEST-API-001: Create API Server Without Permission
- Setup: User "Bob" has perm_ManageSettings=false for org "HOLNG"
- Action: POST /api/api-servers { organizationId: 'HOLNG', name: 'Test Server' }
- Expected: 403 Forbidden with message "Requires perm_ManageSettings permission"

TEST-API-002: Create API Server With Permission
- Setup: User "Alice" has perm_ManageSettings=true for org "HOLNG"
- Action: POST /api/api-servers { organizationId: 'HOLNG', name: 'Test Server' }
- Expected: 201 Created with server object returned

TEST-API-003: Edit API Server in Different Org
- Setup: User "Bob" has perm_ManageSettings=true for org "RIO" (not HOLNG)
- Action: PATCH /api/api-servers/{holng-server-id} { name: 'Hacked' }
- Expected: 403 Forbidden with message "You don't have permission to manage this organization's API servers"

TEST-API-004: Delete API Server Without Permission
- Setup: User "Charlie" has perm_ManageSettings=false for org "BECH"
- Action: DELETE /api/api-servers/{bech-server-id}
- Expected: 403 Forbidden with message "Requires perm_ManageSettings permission"

TEST-API-005: Test API Server Without Permission
- Setup: User "Bob" has perm_ManageSettings=false for org "HOLNG"
- Action: POST /api/api-servers/{holng-server-id}/test
- Expected: 200 OK (testing is a read operation, doesn't require perm_ManageSettings)
```

**Step 2: Organization Service Status Cascading Tests**

Add these cascading behavior tests:

**Test Suite: Organization Status Cascading**

```
TEST-CASCADE-001: Suspend Organization Affects API Servers
- Setup: Organization "RIO" is active with 3 API servers
- Action: PATCH /api/organizations/RIO { serviceStatus: 'suspended' }
- Expected: API servers still exist but connections should fail with "Organization suspended"

TEST-CASCADE-002: API Server Test During Org Suspension
- Setup: Organization "HOLNG" is suspended
- Action: POST /api/api-servers/{holng-server-id}/test
- Expected: 403 Forbidden with message "Cannot test - Organization is suspended"

TEST-CASCADE-003: Reactivate Organization Restores API Servers
- Setup: Organization "RIO" is suspended, then reactivated
- Action: PATCH /api/organizations/RIO { serviceStatus: 'active' }
- Expected: API servers become available again, test endpoints succeed

TEST-CASCADE-004: Delete Organization Cascades to API Servers
- Setup: Organization "BECH" has 2 API servers, isExternal=false
- Action: DELETE /api/organizations/BECH
- Expected: Organization and all 2 API servers are deleted (onDelete: Cascade)

TEST-CASCADE-005: Cannot Delete External Org with API Servers
- Setup: Organization "PEMS_Global" has isExternal=true with 5 API servers
- Action: DELETE /api/organizations/PEMS_Global
- Expected: 403 Forbidden (external orgs cannot be deleted, must unlink first)
```

**Step 3: Multi-Tenant Isolation Tests**

Add these cross-organization isolation tests:

**Test Suite: API Server Multi-Tenant Isolation**

```
TEST-ISOLATION-001: User Cannot See Other Org's API Servers
- Setup: User "Alice" belongs to org "HOLNG", org "RIO" has 3 API servers
- Action: GET /api/api-servers (filtered by user's org)
- Expected: Returns only HOLNG's API servers, RIO's servers are not visible

TEST-ISOLATION-002: Admin Across Multiple Orgs Sees Correct Servers
- Setup: User "Bob" has perm_ManageSettings for both "HOLNG" and "RIO"
- Action: GET /api/api-servers?organizationId=HOLNG
- Expected: Returns only HOLNG's servers
- Action: GET /api/api-servers?organizationId=RIO
- Expected: Returns only RIO's servers

TEST-ISOLATION-003: Cannot Create API Server for Unauthorized Org
- Setup: User "Charlie" has perm_ManageSettings for org "BECH" only
- Action: POST /api/api-servers { organizationId: 'HOLNG', name: 'Hack' }
- Expected: 403 Forbidden "You don't have permission to manage HOLNG's API servers"

TEST-ISOLATION-004: Organization Switch Updates API Server List
- Setup: User "Alice" switches from org "HOLNG" to org "RIO"
- Action: Switch context to RIO, then GET /api/api-servers
- Expected: Returns RIO's servers only (not HOLNG's)
```

**Step 4: External Organization Constraints**

Add these external org constraint tests:

**Test Suite: External Organization API Server Constraints**

```
TEST-EXT-API-001: Create API Server for External Org
- Setup: Organization "PEMS_Global" has isExternal=true
- Action: POST /api/api-servers { organizationId: 'PEMS_Global', name: 'Test' }
- Expected: 201 Created (external orgs CAN have API servers - settings are writable)

TEST-EXT-API-002: Sync Affects External Org's API Servers
- Setup: External org "PEMS_Global" has enableSync=true and 2 API servers
- Action: PEMS sync updates organization settings
- Expected: API server configs remain unchanged (only org identity is read-only)

TEST-EXT-API-003: Unlink External Org Preserves API Servers
- Setup: External org "HOLNG" has isExternal=true with 3 API servers
- Action: POST /api/organizations/HOLNG/unlink { confirmationToken }
- Expected: Organization becomes local (isExternal=false), API servers remain intact
```

**Step 5: Performance Thresholds**

For API server management operations:
- **Permission check**: <50ms (cached from user session)
- **Organization status validation**: <100ms (single DB query)
- **API server list query** (filtered by org): <200ms (indexed on organizationId)
- **Cascading delete** (org + servers): <500ms (transaction with 10 servers)

**Step 6: Edge Cases**

What breaks API server management?

**Edge Case Tests**:

```
EDGE-API-001: API Server Without Organization
- Scenario: Attempt to create API server with null/invalid organizationId
- Expected: 400 Bad Request "organizationId is required"

EDGE-API-002: Permission Revoked During Edit Session
- Scenario: User "Bob" opens Edit Server modal, admin revokes perm_ManageSettings, Bob submits form
- Expected: 403 Forbidden (permission re-checked on submit)

EDGE-API-003: Organization Suspended During API Server Test
- Scenario: User initiates API server test, admin suspends org mid-test
- Expected: Test completes (already in progress) but next test fails

EDGE-API-004: User Leaves Organization with API Server Management Open
- Scenario: User "Alice" has API Connectivity page open, admin removes her from org
- Expected: Next API call returns 403, UI shows "You no longer have access to this organization"
```

**DELIVERABLES**:
1. API server authorization test suite (5 tests)
2. Organization status cascading test suite (5 tests)
3. Multi-tenant isolation test suite (4 tests)
4. External organization constraint test suite (3 tests)
5. Performance thresholds for API server operations
6. Edge case test scenarios (4 tests)
7. Recommendation on where to insert in TEST_PLAN.md (create new section "API Server Management Testing")

**CONSTRAINT**:
Think about cross-organization attacks. A malicious user with perm_ManageSettings for Org A should NOT be able to create/edit/delete API servers for Org B.
```

**Status**: ⬜ Not Started

---

## Step 3: Update Technical Implementation Plan

**Target**: `ADR-005-IMPLEMENTATION_PLAN.md`
**Agent**: `backend-architecture-optimizer`
**Reason**: Need authorization middleware, org status validation, and cascading logic for API server management

**Current State** (from IMPLEMENTATION_PLAN.md):
```
Version 2.0 with 10 phases:
- Phase 1: Database Schema
- Phase 2: Backend Authorization
- Phase 5: Admin UI + Core Governance
```

**Required Changes**:
- Update Phase 2: Add API server authorization middleware
- Update Phase 5: Add org status validation for API server operations
- Add cascading logic documentation

---

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@backend-architecture-optimizer

**SYSTEM CONTEXT**:
You are updating ADR-005 implementation plan to accommodate ADR-006's API Server Architecture integration.

**CURRENT ARCHITECTURE** (Read for context):
File: `docs/adrs/ADR-005-multi-tenant-access-control/ADR-005-IMPLEMENTATION_PLAN.md`

Current Phase 2 includes:
- Permission middleware for user/org management
- requirePermission() guard decorator
- Organization context filtering

Current Phase 5 includes:
- User CRUD APIs with permission checks
- Organization CRUD APIs with external entity restrictions

**NEW FUNCTIONALITY FROM ADR-006**:
Database schema includes:
```prisma
model ApiServer {
  id             String  @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  baseUrl        String
  authType       String

  @@index([organizationId])
}

model ApiEndpoint {
  id         String    @id @default(cuid())
  serverId   String
  server     ApiServer @relation(fields: [serverId], references: [id], onDelete: Cascade)
  // ... other fields
}
```

**Key Requirements**:
1. API server CRUD requires `perm_ManageSettings` permission
2. Organization service status affects API server availability
3. Multi-tenant isolation (user can only manage servers for their orgs)
4. Cascading delete (delete org → delete all API servers)

**YOUR MISSION**:

**Step 1: Update Phase 2 - Authorization Middleware**

**Task 2.3: API Server Authorization Middleware**

Add new middleware for API server management:

```typescript
// backend/src/middleware/requireApiServerPermission.ts

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { ForbiddenException } from '../utils/exceptions';

/**
 * Middleware to check if user has perm_ManageSettings for the organization
 * that owns the API server being accessed.
 */
export async function requireApiServerPermission(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { user } = req; // From JWT auth middleware
  const serverId = req.params.id || req.body.serverId;
  const organizationId = req.body.organizationId;

  // For CREATE operations, check permission on target organization
  if (req.method === 'POST' && organizationId) {
    const userOrg = await prisma.userOrganization.findFirst({
      where: {
        userId: user.id,
        organizationId: organizationId,
        perm_ManageSettings: true,
      },
    });

    if (!userOrg) {
      throw new ForbiddenException({
        message: 'You don\'t have permission to manage this organization\'s API servers',
        requiredPermission: 'perm_ManageSettings',
        organizationId,
      });
    }

    // Check organization service status
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (org.serviceStatus === 'suspended') {
      throw new ForbiddenException({
        message: 'Cannot manage API servers - Organization is suspended',
        organizationId,
        serviceStatus: org.serviceStatus,
      });
    }

    return next();
  }

  // For UPDATE/DELETE/TEST operations, check permission on server's organization
  if (serverId) {
    const server = await prisma.apiServer.findUnique({
      where: { id: serverId },
      include: { organization: true },
    });

    if (!server) {
      return res.status(404).json({ error: 'API server not found' });
    }

    // Check user has permission for this server's organization
    const userOrg = await prisma.userOrganization.findFirst({
      where: {
        userId: user.id,
        organizationId: server.organizationId,
        // Test operations don't require perm_ManageSettings (read-only)
        ...(req.path.includes('/test') ? {} : { perm_ManageSettings: true }),
      },
    });

    if (!userOrg) {
      throw new ForbiddenException({
        message: req.path.includes('/test')
          ? 'You don\'t have access to this organization'
          : 'Requires perm_ManageSettings permission',
        requiredPermission: req.path.includes('/test') ? 'perm_Read' : 'perm_ManageSettings',
        organizationId: server.organizationId,
      });
    }

    // Check organization status for non-read operations
    if (!req.path.includes('/test') && server.organization.serviceStatus === 'suspended') {
      throw new ForbiddenException({
        message: 'Cannot manage API servers - Organization is suspended',
        organizationId: server.organizationId,
        serviceStatus: server.organization.serviceStatus,
      });
    }

    // For test operations, also check org status
    if (req.path.includes('/test') && server.organization.serviceStatus === 'suspended') {
      throw new ForbiddenException({
        message: 'Cannot test API server - Organization is suspended',
        organizationId: server.organizationId,
        serviceStatus: server.organization.serviceStatus,
      });
    }

    return next();
  }

  // No serverId or organizationId provided
  return res.status(400).json({ error: 'Missing serverId or organizationId' });
}
```

**Step 2: Update Phase 5 - API Server CRUD Endpoints**

**Task 5.3: API Server Management Endpoints**

Add API server CRUD with authorization:

```typescript
// backend/src/controllers/apiServerController.ts

import { Router } from 'express';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';
import { requireApiServerPermission } from '../middleware/requireApiServerPermission';

const router = Router();

// GET /api/api-servers - List API servers for user's organizations
router.get('/', requireAuth, async (req, res) => {
  const { user } = req;
  const { organizationId } = req.query;

  // Get all organizations user has access to
  const userOrgs = await prisma.userOrganization.findMany({
    where: { userId: user.id },
    select: { organizationId: true },
  });

  const orgIds = userOrgs.map(uo => uo.organizationId);

  // Filter by specific org if requested
  const servers = await prisma.apiServer.findMany({
    where: {
      organizationId: organizationId
        ? { equals: organizationId as string }
        : { in: orgIds },
    },
    include: {
      organization: {
        select: { code: true, name: true, serviceStatus: true, isExternal: true },
      },
      endpoints: true,
    },
    orderBy: { name: 'asc' },
  });

  res.json(servers);
});

// POST /api/api-servers - Create API server
router.post('/', requireAuth, requireApiServerPermission, async (req, res) => {
  const { organizationId, name, baseUrl, authType, credentials } = req.body;

  const server = await prisma.apiServer.create({
    data: {
      organizationId,
      name,
      baseUrl,
      authType,
      credentials, // Encrypted
    },
    include: { organization: true },
  });

  res.status(201).json(server);
});

// PATCH /api/api-servers/:id - Update API server
router.patch('/:id', requireAuth, requireApiServerPermission, async (req, res) => {
  const { id } = req.params;
  const { name, baseUrl, authType, credentials } = req.body;

  const server = await prisma.apiServer.update({
    where: { id },
    data: { name, baseUrl, authType, credentials },
    include: { organization: true },
  });

  res.json(server);
});

// DELETE /api/api-servers/:id - Delete API server
router.delete('/:id', requireAuth, requireApiServerPermission, async (req, res) => {
  const { id } = req.params;

  // Cascading delete will remove all endpoints
  await prisma.apiServer.delete({ where: { id } });

  res.json({ message: 'API server deleted' });
});

// POST /api/api-servers/:id/test - Test API server connection
router.post('/:id/test', requireAuth, requireApiServerPermission, async (req, res) => {
  const { id } = req.params;

  const server = await prisma.apiServer.findUnique({
    where: { id },
    include: { organization: true },
  });

  // Test connection logic here...
  const testResult = await testApiConnection(server);

  res.json(testResult);
});

export default router;
```

**Step 3: Organization Status Validation**

**Task 5.4: Organization Status Validation Service**

Add validation helper:

```typescript
// backend/src/services/organizationValidation.ts

import { prisma } from '../config/database';
import { ForbiddenException } from '../utils/exceptions';

export class OrganizationValidationService {
  /**
   * Validates organization is in active status for management operations
   */
  static async validateOrgActive(organizationId: string, operation: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { code: true, serviceStatus: true },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (org.serviceStatus !== 'active') {
      throw new ForbiddenException({
        message: `Cannot ${operation} - Organization is ${org.serviceStatus}`,
        organizationCode: org.code,
        serviceStatus: org.serviceStatus,
        recommendation: 'Reactivate organization first',
      });
    }

    return org;
  }

  /**
   * Checks if user has specific permission for organization
   */
  static async checkUserOrgPermission(
    userId: string,
    organizationId: string,
    permission: string
  ): Promise<boolean> {
    const userOrg = await prisma.userOrganization.findFirst({
      where: {
        userId,
        organizationId,
        [permission]: true,
      },
    });

    return !!userOrg;
  }
}
```

**Step 4: Cascading Delete Documentation**

**Database Cascading Behavior**:

From ADR-006 schema:
```prisma
model ApiServer {
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}

model ApiEndpoint {
  server     ApiServer @relation(fields: [serverId], references: [id], onDelete: Cascade)
}
```

**Cascade Chain**:
```
DELETE Organization
  ↓ onDelete: Cascade
DELETE ApiServer(s)
  ↓ onDelete: Cascade
DELETE ApiEndpoint(s)
```

**Important**: External organizations (isExternal=true) cannot be deleted, so this cascade only applies to local organizations.

**Step 5: Error Response Specifications**

For API server operations:

```typescript
// Permission denied
HTTP 403 Forbidden
{
  "error": "PermissionDenied",
  "message": "You don't have permission to manage this organization's API servers",
  "requiredPermission": "perm_ManageSettings",
  "organizationId": "clx123...",
  "organizationCode": "HOLNG"
}

// Organization suspended
HTTP 403 Forbidden
{
  "error": "OrganizationSuspended",
  "message": "Cannot manage API servers - Organization is suspended",
  "organizationId": "clx123...",
  "organizationCode": "RIO",
  "serviceStatus": "suspended",
  "recommendation": "Reactivate organization first"
}

// Cross-organization access attempt
HTTP 403 Forbidden
{
  "error": "CrossOrganizationAccess",
  "message": "You don't have access to this organization's API servers",
  "requestedOrganization": "HOLNG",
  "yourOrganizations": ["RIO", "BECH"]
}
```

**DELIVERABLES**:
1. API server authorization middleware implementation
2. API server CRUD controller with permission checks
3. Organization status validation service
4. Cascading delete documentation
5. Error response specifications
6. Recommendation on where to insert in IMPLEMENTATION_PLAN.md (add Task 2.3 to Phase 2, Tasks 5.3-5.4 to Phase 5)

**CONSTRAINT**:
Focus on authorization and validation. The API server connection logic (testing, credentials encryption) is handled in ADR-006 implementation. This update only covers ADR-005 integration points.
```

**Status**: ⬜ Not Started

---

## 🔄 Step 4: Re-Orchestrate the Workflow

**After ALL blueprint updates are complete**, regenerate the implementation workflow:

```bash
/execute-adr 005
```

**What This Does**:
- Reads your UPDATED blueprint documents (UX_SPEC, TEST_PLAN, IMPLEMENTATION_PLAN)
- Generates a NEW `ADR-005-AGENT_WORKFLOW.md` file
- Includes new tasks for API server authorization and validation
- Updates dependency graph to reflect ADR-006 integration work

**Why This Is CRITICAL**:
- ❌ Without re-orchestration, the old workflow omits API server permission checks
- ✅ Re-orchestration ensures tasks like "Implement API server authorization middleware" are scheduled
- ✅ New tests for multi-tenant isolation and org status cascading are enforced in workflow

**Expected Workflow Changes**:
- Phase 2 will include Task 2.3 (API server authorization middleware)
- Phase 5 will include Tasks 5.3-5.4 (API server CRUD endpoints, org status validation)
- Phase 10 (Testing) will include API server authorization tests, multi-tenant isolation tests

---

## 📋 Completion Checklist

Use this checklist to track your progress:

**Blueprint Updates**:
- [ ] Step 1: UX_SPEC.md updated (API Connectivity UI with permission indicators, org status badges)
- [ ] Step 2: TEST_PLAN.md updated (API server authorization tests, org status cascading tests, multi-tenant isolation)
- [ ] Step 3: IMPLEMENTATION_PLAN.md updated (Phase 2 authorization middleware, Phase 5 CRUD endpoints)
- [ ] All changes committed to git

**Re-Orchestration**:
- [ ] Ran `/execute-adr 005`
- [ ] New AGENT_WORKFLOW.md generated
- [ ] Reviewed new tasks in workflow (should include API server authorization, org status validation)
- [ ] Ready to begin implementation

**Documentation**:
- [ ] Updated ADR-005 README.md status to "Scope Change: ADR-006 API Server Integration - In Progress"
- [ ] Updated DEVELOPMENT_LOG.md with scope change note and rationale
- [ ] Notified stakeholders of timeline impact (+4-6 hours for integration work)

---

## 📚 Related Documentation

- **Original Decision**: [ADR-005-DECISION.md](./ADR-005-DECISION.md)
- **UX Specification**: [ADR-005-UX_SPEC.md](./ADR-005-UX_SPEC.md)
- **Test Plan**: [ADR-005-TEST_PLAN.md](./ADR-005-TEST_PLAN.md)
- **Implementation Plan**: [ADR-005-IMPLEMENTATION_PLAN.md](./ADR-005-IMPLEMENTATION_PLAN.md)
- **ADR-006 Integration**: [../ADR-006-api-server-and-endpoint-architecture/](../ADR-006-api-server-and-endpoint-architecture/)

---

**Update Plan Generated**: 2025-11-26
**Generated By**: Change Management Orchestrator
**Status**: ⏳ Awaiting Blueprint Updates

*This is a scope change management document. Complete all steps before proceeding to code.*
