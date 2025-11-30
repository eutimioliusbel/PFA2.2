# ADR-005: Phase 10A Prompt Bundles - Security Red Team Gate

**Phase**: 10A (Security Red Team Testing)
**Duration**: 1.5 days
**Agent**: ai-security-red-teamer
**Status**: Ready for Execution
**Prerequisites**: Phase 9 Complete (All AI features implemented)

---

## 📋 Phase 10A Task Index

| Task ID | Task Name | Agent | Duration | Status |
|---------|-----------|-------|----------|--------|
| **10A.1** | Privilege Escalation Testing | ai-security-red-teamer | 3 hours | Ready |
| **10A.2** | Cross-Organization Access Testing (IDOR) | ai-security-red-teamer | 3 hours | Ready |
| **10A.3** | Financial Masking Bypass Testing | ai-security-red-teamer | 3 hours | Ready |
| **10A.4** | API Server Security Audit | ai-security-red-teamer | 3 hours | Ready |
| 10A.5 | JWT Tampering & Token Integrity Testing | ai-security-red-teamer | 2 hours | ✅ Bundle in PHASE_10_PROMPT_BUNDLES.md |
| 10A.6 | Rate Limiting & Account Lockout Testing | ai-security-red-teamer | 2 hours | ✅ Bundle in PHASE_10_PROMPT_BUNDLES.md |

**Total Phase Duration**: 1.5 days (12 hours)

---

## 🎯 Phase 10A Overview

**Purpose**: Security gate before QA testing - adversarial testing to identify privilege escalation, IDOR vulnerabilities, financial masking bypasses, and API server security issues.

**Critical Success Criteria**:
- ✅ All privilege escalation attack vectors documented and tested
- ✅ Cross-organization access controls validated
- ✅ Financial masking bypass attempts detected and blocked
- ✅ API server authorization vulnerabilities identified
- ✅ Automated security test suites created for regression testing
- ✅ Security audit report generated with remediation recommendations

**Output Artifacts**:
- Integration test suites for each vulnerability class
- SECURITY_AUDIT_REPORT.md with findings and remediation steps
- Automated regression test suite
- Security compliance checklist

---

# Task 10A.1: Privilege Escalation Testing

**Agent**: ai-security-red-teamer
**Duration**: 3 hours
**Prerequisites**: Phase 9 Complete
**Deliverables**:
- Privilege escalation attack test suite
- Vulnerability report
- Remediation recommendations

---

## 📦 Self-Contained Prompt Bundle

```markdown
# TASK: Privilege Escalation Security Testing - ADR-005

## Your Role
You are the **ai-security-red-teamer** agent responsible for adversarial security testing of the Multi-Tenant Access Control system. Your mission is to identify and document privilege escalation vulnerabilities before production deployment.

## Context: What Has Been Built

### System Architecture
The PFA Vanguard application has implemented a sophisticated multi-tenant access control system with:

**User Capabilities** (14 permission flags):
- `canViewOrgData` - View organization data
- `canEditPfaRecords` - Edit PFA records
- `canDeletePfaRecords` - Delete PFA records
- `canManageUsers` - Create/edit users
- `canManageOrganizations` - Manage organizations
- `perm_ManageSettings` - Manage API servers and system settings
- `perm_ViewAuditLogs` - View audit logs
- `perm_ExportData` - Export data
- `perm_ImportData` - Import data
- `perm_ManageRoles` - Manage roles
- `perm_TriggerSync` - Trigger PEMS sync
- `perm_BulkOperations` - Perform bulk operations
- `perm_ApproveChanges` - Approve changes
- `viewFinancialDetails` - View financial data (costs)

**Role System**:
- Predefined roles: Admin, BEO User, Field Engineer, Accountant, Viewer
- Hybrid role-override model: Role defines baseline, capabilities allow custom overrides
- Role drift detection: AI identifies patterns of consistent overrides

**Database Tables**:
- `User`: Contains `capabilities` JSONB field + `role` field
- `UserOrganization`: Many-to-many relationship with per-org role assignments
- `Organization`: Has `serviceStatus` field (active/suspended)
- `ApiServer`: Requires `perm_ManageSettings` permission for CRUD
- `AuditLog`: Tracks all permission changes

**Middleware**:
- `requirePermission(capability)` - Guards routes by permission
- `requireApiServerPermission()` - Guards API server operations
- JWT tokens contain: `userId`, `username`, `role`, `organizationIds[]`

### Attack Surface

**Critical Threat Vectors**:
1. **Role Manipulation**: User modifies their own role via database or API
2. **Capability Injection**: User adds permissions to their JWT token
3. **Token Tampering**: User modifies JWT claims to grant themselves admin
4. **Database Direct Access**: User bypasses API to modify `capabilities` JSON
5. **API Parameter Manipulation**: User changes `role` in request body during account update
6. **Session Hijacking**: User steals admin token and escalates privileges
7. **Permission Cache Poisoning**: User exploits caching to retain revoked permissions

## Your Mission

**Primary Objective**: Test every attack vector that could allow a non-admin user to escalate their privileges.

**Attack Scenarios to Test**:

### Scenario 1: Viewer Attempts to Grant Admin Role
**Initial State**: User has `role: 'Viewer'`, no write permissions
**Attack**: User calls `PATCH /api/users/{self}` with `{ role: 'Admin' }`
**Expected Defense**: 403 Forbidden - "Cannot modify your own role"

### Scenario 2: User Grants Themselves perm_ManageSettings
**Initial State**: User has `perm_ManageSettings: false`
**Attack**: User calls `PATCH /api/users/{self}` with `{ capabilities: { perm_ManageSettings: true } }`
**Expected Defense**: 403 Forbidden - "Requires perm_ManageRoles permission"

### Scenario 3: Capability Manipulation via Token Tampering
**Initial State**: User has valid JWT token with limited capabilities
**Attack**: User decodes JWT, adds `"perm_ManageSettings": true` to payload, re-encodes with guessed secret
**Expected Defense**: 401 Unauthorized - JWT signature verification fails

### Scenario 4: Database Direct Modification
**Initial State**: User has database read access (vulnerability)
**Attack**: User executes `UPDATE users SET capabilities = '{"perm_ManageSettings": true}' WHERE id = 'attacker-id'`
**Expected Defense**: Database-level permissions prevent write access OR application-level validation detects tampering

### Scenario 5: API Parameter Manipulation
**Initial State**: User submits form to update their profile
**Attack**: User intercepts request and adds `role: 'Admin'` to JSON body
**Expected Defense**: Backend strips `role` field from self-update requests

### Scenario 6: Permission Bypass via Stale Token
**Initial State**: Admin grants user `perm_ManageSettings`, then immediately revokes it
**Attack**: User's cached token still has permission for next 5 minutes
**Expected Defense**: Permission re-check on every request OR short token TTL

### Scenario 7: Exploiting Role Drift Auto-Migration
**Initial State**: System detects role drift and suggests new role
**Attack**: User manipulates recommendation API to grant themselves admin capabilities
**Expected Defense**: Role creation requires `perm_ManageRoles` permission

## Deliverables

### 1. Integration Test Suite

Create comprehensive test file at `backend/tests/integration/privilegeEscalation.test.ts`:

```typescript
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../../src/server';
import { prisma } from '../../src/config/database';
import { createUser, loginAs, createOrganization } from '../helpers/testHelpers';

describe('Security: Privilege Escalation Prevention', () => {
  let viewerToken: string;
  let viewerUser: any;
  let editorToken: string;
  let editorUser: any;
  let adminToken: string;

  beforeAll(async () => {
    // Setup test users
    viewerUser = await createUser({
      username: 'viewer-test',
      email: 'viewer@test.com',
      role: 'Viewer',
      capabilities: {
        canViewOrgData: true,
        canEditPfaRecords: false,
        canManageUsers: false,
        perm_ManageSettings: false
      }
    });
    viewerToken = await loginAs('viewer-test', 'password');

    editorUser = await createUser({
      username: 'editor-test',
      email: 'editor@test.com',
      role: 'Field Engineer',
      capabilities: {
        canViewOrgData: true,
        canEditPfaRecords: true,
        canManageUsers: false,
        perm_ManageSettings: false
      }
    });
    editorToken = await loginAs('editor-test', 'password');

    adminToken = await loginAs('admin', 'admin123');
  });

  afterAll(async () => {
    // Cleanup test users
    await prisma.user.deleteMany({
      where: { email: { in: ['viewer@test.com', 'editor@test.com'] } }
    });
  });

  describe('ATTACK-PE-001: Self Role Modification', () => {
    it('should prevent viewer from changing their own role to Admin', async () => {
      const response = await request(app)
        .patch(`/api/users/${viewerUser.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ role: 'Admin' });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Cannot modify your own role');

      // Verify role unchanged
      const user = await prisma.user.findUnique({ where: { id: viewerUser.id } });
      expect(user.role).toBe('Viewer');
    });

    it('should prevent viewer from changing their own role to BEO User', async () => {
      const response = await request(app)
        .patch(`/api/users/${viewerUser.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ role: 'BEO User' });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Cannot modify your own role');
    });
  });

  describe('ATTACK-PE-002: Self Permission Grant', () => {
    it('should prevent user from granting themselves perm_ManageSettings', async () => {
      const response = await request(app)
        .patch(`/api/users/${editorUser.id}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          capabilities: {
            perm_ManageSettings: true
          }
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('perm_ManageRoles');

      // Verify permission unchanged
      const user = await prisma.user.findUnique({ where: { id: editorUser.id } });
      expect(user.capabilities.perm_ManageSettings).toBe(false);
    });

    it('should prevent user from granting themselves canManageUsers', async () => {
      const response = await request(app)
        .patch(`/api/users/${viewerUser.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          capabilities: {
            canManageUsers: true,
            perm_ManageRoles: true
          }
        });

      expect(response.status).toBe(403);

      // Verify permissions unchanged
      const user = await prisma.user.findUnique({ where: { id: viewerUser.id } });
      expect(user.capabilities.canManageUsers).toBeFalsy();
      expect(user.capabilities.perm_ManageRoles).toBeFalsy();
    });
  });

  describe('ATTACK-PE-003: Token Tampering', () => {
    it('should reject JWT with modified capabilities claim', async () => {
      // Attempt to use a JWT with tampered capabilities
      const tamperedToken = viewerToken.replace('Viewer', 'Admin'); // Naive tampering

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/invalid.*token|unauthorized/i);
    });

    it('should reject expired tokens even if capabilities are valid', async () => {
      // Generate expired token (requires test helper)
      const expiredToken = generateExpiredToken(viewerUser.id);

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('TOKEN_EXPIRED');
    });
  });

  describe('ATTACK-PE-004: API Parameter Injection', () => {
    it('should strip role field from self-update requests', async () => {
      const response = await request(app)
        .patch(`/api/users/${editorUser.id}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          displayName: 'Updated Name',
          role: 'Admin', // Injected field
          capabilities: { perm_ManageSettings: true } // Also injected
        });

      // Either 403 (permission denied) OR 200 (but role/capabilities ignored)
      if (response.status === 200) {
        const user = await prisma.user.findUnique({ where: { id: editorUser.id } });
        expect(user.role).toBe('Field Engineer'); // Unchanged
        expect(user.capabilities.perm_ManageSettings).toBe(false); // Unchanged
      } else {
        expect(response.status).toBe(403);
      }
    });

    it('should prevent role field injection via multipart form data', async () => {
      const response = await request(app)
        .patch(`/api/users/${viewerUser.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .field('role', 'Admin')
        .field('displayName', 'Hacker');

      expect(response.status).toBe(403);

      const user = await prisma.user.findUnique({ where: { id: viewerUser.id } });
      expect(user.role).toBe('Viewer');
    });
  });

  describe('ATTACK-PE-005: Permission Cache Exploitation', () => {
    it('should revalidate permissions after revocation', async () => {
      // Admin grants permission
      await request(app)
        .patch(`/api/users/${editorUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          capabilities: {
            perm_ManageSettings: true
          }
        });

      // User performs action (should succeed)
      let response = await request(app)
        .get('/api/api-servers')
        .set('Authorization', `Bearer ${editorToken}`);
      expect(response.status).toBe(200);

      // Admin revokes permission
      await request(app)
        .patch(`/api/users/${editorUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          capabilities: {
            perm_ManageSettings: false
          }
        });

      // User attempts same action (should fail immediately or within 5 min)
      response = await request(app)
        .get('/api/api-servers')
        .set('Authorization', `Bearer ${editorToken}`);

      // If using cached token, this MIGHT be 200 (acceptable if TTL < 5 min)
      // But if re-checking DB on every request, should be 403
      if (response.status === 200) {
        console.warn('⚠️ WARNING: Permissions cached in JWT token - revocation not immediate');
        console.warn('   Recommendation: Reduce token TTL or implement token revocation list');
      }
      // After token refresh, should definitely fail
      const newToken = await loginAs('editor-test', 'password');
      response = await request(app)
        .get('/api/api-servers')
        .set('Authorization', `Bearer ${newToken}`);
      expect(response.status).toBe(403);
    });
  });

  describe('ATTACK-PE-006: Exploiting Admin Endpoints', () => {
    it('should prevent non-admin from creating API server for other org', async () => {
      const otherOrg = await createOrganization({ code: 'OTHER', name: 'Other Org' });

      const response = await request(app)
        .post('/api/api-servers')
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          organizationId: otherOrg.id,
          name: 'Malicious Server',
          baseUrl: 'https://evil.com',
          authType: 'bearer'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/permission|unauthorized/i);
    });

    it('should prevent user from suspending organization', async () => {
      const org = await createOrganization({ code: 'TEST', name: 'Test Org' });

      const response = await request(app)
        .patch(`/api/organizations/${org.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ serviceStatus: 'suspended' });

      expect(response.status).toBe(403);

      // Verify org not suspended
      const updatedOrg = await prisma.organization.findUnique({ where: { id: org.id } });
      expect(updatedOrg.serviceStatus).not.toBe('suspended');
    });
  });

  describe('ATTACK-PE-007: Database Constraint Bypass', () => {
    it('should validate capabilities JSON structure', async () => {
      // Attempt to send malformed capabilities
      const response = await request(app)
        .patch(`/api/users/${editorUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`) // Admin making change
        .send({
          capabilities: 'INVALID_JSON' // Not a JSON object
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('capabilities must be an object');
    });

    it('should reject unknown capability flags', async () => {
      const response = await request(app)
        .patch(`/api/users/${editorUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          capabilities: {
            canViewOrgData: true,
            UNKNOWN_CAPABILITY: true, // Invalid capability
            hackerAccess: true // Another invalid one
          }
        });

      // Either 400 (validation error) OR capabilities stripped to known fields only
      if (response.status === 400) {
        expect(response.body.error).toContain('unknown');
      } else if (response.status === 200) {
        const user = await prisma.user.findUnique({ where: { id: editorUser.id } });
        expect(user.capabilities).not.toHaveProperty('UNKNOWN_CAPABILITY');
        expect(user.capabilities).not.toHaveProperty('hackerAccess');
      }
    });
  });

  describe('ATTACK-PE-008: Concurrent Modification Race Condition', () => {
    it('should handle concurrent permission grants safely', async () => {
      // Two admins grant different permissions simultaneously
      const promises = [
        request(app)
          .patch(`/api/users/${editorUser.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ capabilities: { perm_TriggerSync: true } }),
        request(app)
          .patch(`/api/users/${editorUser.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ capabilities: { perm_BulkOperations: true } })
      ];

      const results = await Promise.all(promises);
      results.forEach(r => expect(r.status).toBeLessThan(500)); // No server errors

      // Verify both permissions granted OR last-write-wins
      const user = await prisma.user.findUnique({ where: { id: editorUser.id } });
      // Both should be true OR one of them (depends on implementation)
      expect(
        user.capabilities.perm_TriggerSync === true ||
        user.capabilities.perm_BulkOperations === true
      ).toBe(true);
    });
  });
});
```

### 2. Vulnerability Report

Create `docs/security/PRIVILEGE_ESCALATION_AUDIT.md`:

```markdown
# Privilege Escalation Security Audit Report

**Audit Date**: [Current Date]
**Auditor**: ai-security-red-teamer
**System**: PFA Vanguard Multi-Tenant Access Control
**Scope**: ADR-005 Privilege Escalation Attack Vectors

---

## Executive Summary

**Total Attack Vectors Tested**: 8 categories, 18 test scenarios
**Critical Vulnerabilities Found**: [To be filled after running tests]
**High-Risk Vulnerabilities**: [To be filled]
**Medium-Risk Vulnerabilities**: [To be filled]
**Overall Security Rating**: [To be determined]

---

## Attack Vector Analysis

### 1. Self Role Modification (ATTACK-PE-001)
**Status**: [PASS/FAIL]
**Risk Level**: CRITICAL
**Test Results**:
- Viewer → Admin: [Result]
- Viewer → BEO User: [Result]

**Findings**:
[Document any vulnerabilities found]

**Remediation** (if needed):
- Ensure `requirePermission('perm_ManageRoles')` guards `/api/users/:id` PATCH endpoint
- Add validation: `if (req.user.id === params.id && 'role' in body) throw 403`

---

### 2. Self Permission Grant (ATTACK-PE-002)
**Status**: [PASS/FAIL]
**Risk Level**: CRITICAL
**Test Results**:
- Grant perm_ManageSettings: [Result]
- Grant canManageUsers: [Result]

**Findings**:
[Document any vulnerabilities found]

**Remediation** (if needed):
- Require `perm_ManageRoles` for any `capabilities` modifications
- Log all capability changes to audit log

---

### 3. Token Tampering (ATTACK-PE-003)
**Status**: [PASS/FAIL]
**Risk Level**: HIGH
**Test Results**:
- Modified capabilities claim: [Result]
- Expired token: [Result]

**Findings**:
[Document any vulnerabilities found]

**Remediation** (if needed):
- Ensure JWT secret is strong (32+ characters, random)
- Implement token rotation every 24 hours
- Add token revocation list (blacklist) for immediate revocation

---

### 4. API Parameter Injection (ATTACK-PE-004)
**Status**: [PASS/FAIL]
**Risk Level**: HIGH
**Test Results**:
- Role field injection: [Result]
- Capabilities field injection: [Result]

**Findings**:
[Document any vulnerabilities found]

**Remediation** (if needed):
- Implement input sanitization middleware
- Whitelist allowed fields for self-update requests
- Strip sensitive fields before processing

---

### 5. Permission Cache Exploitation (ATTACK-PE-005)
**Status**: [PASS/FAIL]
**Risk Level**: MEDIUM
**Test Results**:
- Revoked permission still active: [Result]
- Token TTL: [Current value]

**Findings**:
[Document if revoked permissions remain active for >5 minutes]

**Remediation** (if needed):
- Reduce JWT TTL to 15 minutes (currently 7 days in dev)
- Implement token revocation list
- Add permission re-check middleware on sensitive routes

---

### 6. Admin Endpoint Exploitation (ATTACK-PE-006)
**Status**: [PASS/FAIL]
**Risk Level**: CRITICAL
**Test Results**:
- Create API server for other org: [Result]
- Suspend organization: [Result]

**Findings**:
[Document any vulnerabilities found]

**Remediation** (if needed):
- Ensure all admin routes guarded by `requirePermission()`
- Add organization ownership validation for API server operations

---

### 7. Database Constraint Bypass (ATTACK-PE-007)
**Status**: [PASS/FAIL]
**Risk Level**: MEDIUM
**Test Results**:
- Malformed capabilities JSON: [Result]
- Unknown capability flags: [Result]

**Findings**:
[Document any vulnerabilities found]

**Remediation** (if needed):
- Add JSON schema validation for `capabilities` field
- Reject unknown capability flags OR strip them before saving

---

### 8. Concurrent Modification Race Condition (ATTACK-PE-008)
**Status**: [PASS/FAIL]
**Risk Level**: LOW
**Test Results**:
- Concurrent permission grants: [Result]

**Findings**:
[Document if data corruption or server errors occur]

**Remediation** (if needed):
- Implement database transaction isolation level `READ COMMITTED`
- Use optimistic locking (version field) for user updates

---

## Security Compliance Checklist

- [ ] All 18 test scenarios passing
- [ ] No critical vulnerabilities found
- [ ] No high-risk vulnerabilities found
- [ ] JWT token TTL < 1 hour (production)
- [ ] Token revocation implemented
- [ ] Audit logging enabled for all permission changes
- [ ] Input validation implemented for all user-modifiable fields
- [ ] Role modification restricted to admins only
- [ ] Permission grant restricted to users with `perm_ManageRoles`
- [ ] Database-level constraints prevent invalid capabilities

---

## Recommendations for Production Deployment

### Immediate Actions (P0)
1. [List critical fixes needed before production]

### High Priority (P1)
1. [List high-priority security enhancements]

### Medium Priority (P2)
1. [List medium-priority improvements]

---

## Appendix: Test Execution Log

[Paste complete test output here after running `npm run test:security`]
```

### 3. Remediation Implementation Guide

If vulnerabilities are found, create:

**File**: `docs/security/PRIVILEGE_ESCALATION_REMEDIATION.md`

```markdown
# Privilege Escalation Remediation Guide

## Critical Fix 1: [Vulnerability Name]

**Issue**: [Description]
**Risk**: CRITICAL
**Affected Code**: [File paths]

### Implementation

**Step 1**: Update middleware
```typescript
// backend/src/middleware/requirePermission.ts
export const preventSelfRoleModification = (req, res, next) => {
  if (req.params.id === req.user.id && 'role' in req.body) {
    return res.status(403).json({ error: 'Cannot modify your own role' });
  }
  next();
};
```

**Step 2**: Apply to route
```typescript
// backend/src/routes/userRoutes.ts
router.patch('/:id',
  authenticate,
  preventSelfRoleModification,
  requirePermission('perm_ManageRoles'),
  userController.updateUser
);
```

**Step 3**: Add test
```typescript
it('should prevent self role modification', async () => {
  // Test code here
});
```

**Step 4**: Verify fix
```bash
npm run test:security -- privilegeEscalation.test.ts
```

---

[Repeat for each vulnerability found]
```

## Success Criteria

✅ **Task Complete When**:
1. All 18 test scenarios implemented in `privilegeEscalation.test.ts`
2. All tests passing OR vulnerabilities documented in audit report
3. Security audit report generated with findings
4. Remediation guide created for any vulnerabilities found
5. Automated regression test suite integrated into CI/CD pipeline

## Validation Steps

After completing this task:

```bash
# Run privilege escalation tests
cd backend
npm run test:integration -- privilegeEscalation.test.ts

# Generate coverage report
npm run test:coverage

# Verify no critical vulnerabilities
cat docs/security/PRIVILEGE_ESCALATION_AUDIT.md | grep "Critical Vulnerabilities Found: 0"

# If vulnerabilities found, verify remediation implemented
npm run test:security -- privilegeEscalation.test.ts --verbose
```

## References

- **Test Plan**: ADR-005-TEST_PLAN.md lines 20-44 (Privilege Escalation Tests)
- **Implementation**: ADR-005-IMPLEMENTATION_PLAN.md Phase 2 (Backend Authorization)
- **Decision**: ADR-005-DECISION.md (Permission Model)

---

**Estimated Time**: 3 hours
**Dependencies**: Phase 9 complete (all AI features implemented)
**Blocker Risk**: NONE
**Agent Handoff**: → Task 10A.2 (Cross-Organization Access Testing)
```

---

# Task 10A.2: Cross-Organization Access Testing (IDOR)

**Agent**: ai-security-red-teamer
**Duration**: 3 hours
**Prerequisites**: Phase 9 Complete
**Deliverables**:
- IDOR attack test suite
- Multi-tenant isolation validation
- Security findings report

---

## 📦 Self-Contained Prompt Bundle

```markdown
# TASK: Cross-Organization Access Testing (IDOR) - ADR-005

## Your Role
You are the **ai-security-red-teamer** agent responsible for testing Insecure Direct Object Reference (IDOR) vulnerabilities in the multi-tenant PFA Vanguard system. Your mission is to verify that users cannot access data from organizations they don't belong to.

## Context: Multi-Tenant Architecture

### Organization Isolation Model
PFA Vanguard is a multi-tenant system where:

**Tenants**: Each construction project is an "Organization" (e.g., HOLNG, RIO, BECH, PEMS_Global)

**User-Organization Relationship**:
- Users can belong to multiple organizations: `User.allowedOrganizationIds[]`
- Users have a "current context" organization: `User.organizationId`
- Each user-org relationship has a role: `UserOrganization.role`

**Data Isolation**:
- PFA records: Each has `organizationId` field
- API servers: Each has `organizationId` field
- API endpoints: Belong to API servers (indirect org relationship)
- Users: Can access only data from their allowed organizations

**Database Schema**:
```prisma
model User {
  id                    String   @id
  organizationId        String   // Current context
  allowedOrganizationIds String[] // Organizations user can access
  role                  String
  capabilities          Json
  organizations         UserOrganization[]
}

model UserOrganization {
  id             String
  userId         String
  organizationId String
  role           String
  capabilities   Json?
  user           User         @relation(...)
  organization   Organization @relation(...)
}

model Organization {
  id            String @id
  code          String @unique
  name          String
  serviceStatus String @default("active")
  users         UserOrganization[]
  apiServers    ApiServer[]
  pfaRecords    PfaRecord[]
}

model ApiServer {
  id             String
  organizationId String
  name           String
  organization   Organization @relation(...)
}

model PfaRecord {
  id             String
  organizationId String
  organization   Organization @relation(...)
}
```

### Attack Surface

**Critical IDOR Vulnerabilities to Test**:
1. **Direct ID Access**: User guesses another org's resource ID
2. **Organization ID Manipulation**: User changes `organizationId` query param
3. **Context Switching Exploit**: User switches org context to unauthorized org
4. **Bulk Operation Cross-Org**: User includes records from other orgs in bulk update
5. **API Server IDOR**: User modifies/deletes another org's API server
6. **Audit Log Leak**: User views audit logs from other organizations

## Your Mission

**Primary Objective**: Test every IDOR attack vector to ensure organization data isolation is bulletproof.

**Attack Scenarios to Test**:

### Scenario 1: Direct PFA Record Access
**Initial State**: User in HOLNG tries to access RIO's PFA record
**Attack**: `GET /api/pfa/records/{rio-record-id}`
**Expected Defense**: 403 Forbidden - "You don't have access to this organization"

### Scenario 2: Organization ID Query Manipulation
**Initial State**: User in HOLNG requests PFA records
**Attack**: `GET /api/pfa/records?organizationId=RIO`
**Expected Defense**: 403 Forbidden OR empty result set (data filtered out)

### Scenario 3: API Server Direct Access
**Initial State**: User in BECH tries to edit HOLNG's API server
**Attack**: `PATCH /api/api-servers/{holng-server-id}` with `{ name: 'Hacked' }`
**Expected Defense**: 403 Forbidden - "You don't have permission to manage this organization's API servers"

### Scenario 4: Context Switch to Unauthorized Org
**Initial State**: User allowed for [HOLNG], attempts switch to RIO
**Attack**: `POST /api/users/switch-context` with `{ organizationId: 'RIO' }`
**Expected Defense**: 403 Forbidden - "Not authorized for organization RIO"

### Scenario 5: Bulk Operation Cross-Org Injection
**Initial State**: User in HOLNG performs bulk PFA update
**Attack**: Include RIO record IDs in bulk update payload
**Expected Defense**: Operation fails OR RIO records silently ignored

### Scenario 6: Audit Log Enumeration
**Initial State**: User in HOLNG views audit logs
**Attack**: `GET /api/audit-logs?organizationId=RIO`
**Expected Defense**: 403 Forbidden OR data filtered to only HOLNG logs

### Scenario 7: User Enumeration Attack
**Initial State**: Attacker guesses user IDs from other orgs
**Attack**: `GET /api/users/{rio-user-id}`
**Expected Defense**: 403 Forbidden OR 404 Not Found (indistinguishable from non-existent user)

## Deliverables

### 1. Integration Test Suite

Create comprehensive test file at `backend/tests/integration/idorMultiTenant.test.ts`:

```typescript
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../../src/server';
import { prisma } from '../../src/config/database';
import { createUser, loginAs, createOrganization, createPfaRecord, createApiServer } from '../helpers/testHelpers';

describe('Security: IDOR and Multi-Tenant Isolation', () => {
  let holngOrg: any;
  let rioOrg: any;
  let bechOrg: any;

  let holngUser: any;
  let holngToken: string;
  let rioUser: any;
  let rioToken: string;
  let multiOrgUser: any; // User in both HOLNG and RIO
  let multiOrgToken: string;

  let holngPfaRecord: any;
  let rioPfaRecord: any;
  let holngApiServer: any;
  let rioApiServer: any;

  beforeAll(async () => {
    // Create organizations
    holngOrg = await createOrganization({ code: 'HOLNG', name: 'Holcim Nigeria' });
    rioOrg = await createOrganization({ code: 'RIO', name: 'Rio Tinto' });
    bechOrg = await createOrganization({ code: 'BECH', name: 'Bechtel' });

    // Create users
    holngUser = await createUser({
      username: 'holng-user',
      email: 'holng@test.com',
      organizationId: holngOrg.id,
      allowedOrganizationIds: [holngOrg.id],
      role: 'Field Engineer',
      capabilities: { canViewOrgData: true, canEditPfaRecords: true, perm_ManageSettings: true }
    });
    holngToken = await loginAs('holng-user', 'password');

    rioUser = await createUser({
      username: 'rio-user',
      email: 'rio@test.com',
      organizationId: rioOrg.id,
      allowedOrganizationIds: [rioOrg.id],
      role: 'Field Engineer',
      capabilities: { canViewOrgData: true, canEditPfaRecords: true, perm_ManageSettings: true }
    });
    rioToken = await loginAs('rio-user', 'password');

    multiOrgUser = await createUser({
      username: 'multi-org-user',
      email: 'multi@test.com',
      organizationId: holngOrg.id, // Default context: HOLNG
      allowedOrganizationIds: [holngOrg.id, rioOrg.id],
      role: 'Field Engineer',
      capabilities: { canViewOrgData: true, canEditPfaRecords: true, perm_ManageSettings: true }
    });
    multiOrgToken = await loginAs('multi-org-user', 'password');

    // Create test data
    holngPfaRecord = await createPfaRecord({ organizationId: holngOrg.id, category: 'Cranes' });
    rioPfaRecord = await createPfaRecord({ organizationId: rioOrg.id, category: 'Excavators' });

    holngApiServer = await createApiServer({ organizationId: holngOrg.id, name: 'HOLNG Server' });
    rioApiServer = await createApiServer({ organizationId: rioOrg.id, name: 'RIO Server' });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.pfaRecord.deleteMany({ where: { id: { in: [holngPfaRecord.id, rioPfaRecord.id] } } });
    await prisma.apiServer.deleteMany({ where: { id: { in: [holngApiServer.id, rioApiServer.id] } } });
    await prisma.user.deleteMany({ where: { email: { in: ['holng@test.com', 'rio@test.com', 'multi@test.com'] } } });
    await prisma.organization.deleteMany({ where: { code: { in: ['HOLNG', 'RIO', 'BECH'] } } });
  });

  describe('ATTACK-IDOR-001: Direct PFA Record Access', () => {
    it('should prevent HOLNG user from accessing RIO PFA record', async () => {
      const response = await request(app)
        .get(`/api/pfa/records/${rioPfaRecord.id}`)
        .set('Authorization', `Bearer ${holngToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/access|permission|organization/i);
    });

    it('should prevent RIO user from accessing HOLNG PFA record', async () => {
      const response = await request(app)
        .get(`/api/pfa/records/${holngPfaRecord.id}`)
        .set('Authorization', `Bearer ${rioToken}`);

      expect(response.status).toBe(403);
    });

    it('should allow user to access their own org PFA record', async () => {
      const response = await request(app)
        .get(`/api/pfa/records/${holngPfaRecord.id}`)
        .set('Authorization', `Bearer ${holngToken}`);

      expect(response.status).toBe(200);
      expect(response.body.organizationId).toBe(holngOrg.id);
    });
  });

  describe('ATTACK-IDOR-002: Organization ID Query Manipulation', () => {
    it('should filter out unauthorized org records in list query', async () => {
      const response = await request(app)
        .get(`/api/pfa/records?organizationId=${rioOrg.id}`)
        .set('Authorization', `Bearer ${holngToken}`);

      // Either 403 OR empty result (data filtered)
      if (response.status === 200) {
        expect(response.body.length).toBe(0); // No RIO records visible
      } else {
        expect(response.status).toBe(403);
        expect(response.body.error).toMatch(/access|permission/i);
      }
    });

    it('should only return records from allowed organizations', async () => {
      const response = await request(app)
        .get('/api/pfa/records')
        .set('Authorization', `Bearer ${holngToken}`);

      expect(response.status).toBe(200);
      expect(response.body.every((r: any) => r.organizationId === holngOrg.id)).toBe(true);
    });
  });

  describe('ATTACK-IDOR-003: API Server Direct Modification', () => {
    it('should prevent HOLNG user from editing RIO API server', async () => {
      const response = await request(app)
        .patch(`/api/api-servers/${rioApiServer.id}`)
        .set('Authorization', `Bearer ${holngToken}`)
        .send({ name: 'Hacked Server' });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/permission|organization/i);

      // Verify server name unchanged
      const server = await prisma.apiServer.findUnique({ where: { id: rioApiServer.id } });
      expect(server.name).toBe('RIO Server');
    });

    it('should prevent RIO user from deleting HOLNG API server', async () => {
      const response = await request(app)
        .delete(`/api/api-servers/${holngApiServer.id}`)
        .set('Authorization', `Bearer ${rioToken}`);

      expect(response.status).toBe(403);

      // Verify server still exists
      const server = await prisma.apiServer.findUnique({ where: { id: holngApiServer.id } });
      expect(server).not.toBeNull();
    });

    it('should allow user to edit their own org API server', async () => {
      const response = await request(app)
        .patch(`/api/api-servers/${holngApiServer.id}`)
        .set('Authorization', `Bearer ${holngToken}`)
        .send({ name: 'Updated HOLNG Server' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated HOLNG Server');
    });
  });

  describe('ATTACK-IDOR-004: Context Switching Exploit', () => {
    it('should prevent user from switching to unauthorized organization', async () => {
      const response = await request(app)
        .post('/api/users/switch-context')
        .set('Authorization', `Bearer ${holngToken}`)
        .send({ organizationId: rioOrg.id });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/not authorized|access denied/i);

      // Verify user context unchanged
      const user = await prisma.user.findUnique({ where: { id: holngUser.id } });
      expect(user.organizationId).toBe(holngOrg.id);
    });

    it('should allow multi-org user to switch between allowed organizations', async () => {
      // Switch from HOLNG to RIO
      let response = await request(app)
        .post('/api/users/switch-context')
        .set('Authorization', `Bearer ${multiOrgToken}`)
        .send({ organizationId: rioOrg.id });

      expect(response.status).toBe(200);

      // Verify context switched
      const user = await prisma.user.findUnique({ where: { id: multiOrgUser.id } });
      expect(user.organizationId).toBe(rioOrg.id);

      // Switch back to HOLNG
      response = await request(app)
        .post('/api/users/switch-context')
        .set('Authorization', `Bearer ${multiOrgToken}`)
        .send({ organizationId: holngOrg.id });

      expect(response.status).toBe(200);
    });

    it('should prevent multi-org user from switching to non-allowed org', async () => {
      const response = await request(app)
        .post('/api/users/switch-context')
        .set('Authorization', `Bearer ${multiOrgToken}`)
        .send({ organizationId: bechOrg.id }); // Not in allowedOrganizationIds

      expect(response.status).toBe(403);
    });
  });

  describe('ATTACK-IDOR-005: Bulk Operation Cross-Org Injection', () => {
    it('should reject bulk update with records from unauthorized org', async () => {
      const response = await request(app)
        .post('/api/pfa/records/bulk-update')
        .set('Authorization', `Bearer ${holngToken}`)
        .send({
          recordIds: [holngPfaRecord.id, rioPfaRecord.id], // Injected RIO record
          updates: { category: 'Hacked' }
        });

      // Either 403 (entire operation rejected) OR 200 (but RIO record ignored)
      if (response.status === 200) {
        const rioRecord = await prisma.pfaRecord.findUnique({ where: { id: rioPfaRecord.id } });
        expect(rioRecord.category).not.toBe('Hacked'); // RIO record unchanged
      } else {
        expect(response.status).toBe(403);
      }

      // HOLNG record should be updated (if partial success allowed)
      const holngRecord = await prisma.pfaRecord.findUnique({ where: { id: holngPfaRecord.id } });
      expect(holngRecord.category).toBe('Hacked'); // OR unchanged if all-or-nothing
    });

    it('should filter out unauthorized records in bulk delete', async () => {
      const response = await request(app)
        .post('/api/pfa/records/bulk-delete')
        .set('Authorization', `Bearer ${holngToken}`)
        .send({
          recordIds: [rioPfaRecord.id] // Attempt to delete RIO record
        });

      expect(response.status).toBe(403); // OR 200 with 0 deleted

      // Verify RIO record not deleted
      const rioRecord = await prisma.pfaRecord.findUnique({ where: { id: rioPfaRecord.id } });
      expect(rioRecord).not.toBeNull();
    });
  });

  describe('ATTACK-IDOR-006: Audit Log Data Leak', () => {
    it('should prevent user from viewing other org audit logs', async () => {
      // Create audit log entry for RIO
      await prisma.auditLog.create({
        data: {
          userId: rioUser.id,
          organizationId: rioOrg.id,
          action: 'pfa:update',
          resourceType: 'PfaRecord',
          resourceId: rioPfaRecord.id,
          metadata: {}
        }
      });

      const response = await request(app)
        .get(`/api/audit-logs?organizationId=${rioOrg.id}`)
        .set('Authorization', `Bearer ${holngToken}`);

      // Either 403 OR empty result
      if (response.status === 200) {
        expect(response.body.length).toBe(0); // No RIO logs visible
      } else {
        expect(response.status).toBe(403);
      }
    });

    it('should only show audit logs from user allowed organizations', async () => {
      const response = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${holngToken}`);

      expect(response.status).toBe(200);
      expect(response.body.every((log: any) => log.organizationId === holngOrg.id)).toBe(true);
    });
  });

  describe('ATTACK-IDOR-007: User Enumeration', () => {
    it('should prevent HOLNG user from viewing RIO user details', async () => {
      const response = await request(app)
        .get(`/api/users/${rioUser.id}`)
        .set('Authorization', `Bearer ${holngToken}`);

      // Should be 403 OR 404 (indistinguishable from non-existent user)
      expect([403, 404]).toContain(response.status);
    });

    it('should allow user to view users from their own organization', async () => {
      // Assuming holngUser can view other HOLNG users
      const holngUser2 = await createUser({
        username: 'holng-user-2',
        email: 'holng2@test.com',
        organizationId: holngOrg.id,
        allowedOrganizationIds: [holngOrg.id],
        role: 'Viewer'
      });

      const response = await request(app)
        .get(`/api/users/${holngUser2.id}`)
        .set('Authorization', `Bearer ${holngToken}`);

      expect(response.status).toBe(200);
      expect(response.body.organizationId).toBe(holngOrg.id);

      await prisma.user.delete({ where: { id: holngUser2.id } });
    });

    it('should filter user list to only allowed organizations', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${holngToken}`);

      expect(response.status).toBe(200);
      // All returned users should be from HOLNG or multi-org users who have HOLNG access
      expect(response.body.every((u: any) =>
        u.allowedOrganizationIds.includes(holngOrg.id)
      )).toBe(true);
    });
  });

  describe('ATTACK-IDOR-008: API Server List Leak', () => {
    it('should only show API servers from user allowed organizations', async () => {
      const response = await request(app)
        .get('/api/api-servers')
        .set('Authorization', `Bearer ${holngToken}`);

      expect(response.status).toBe(200);
      expect(response.body.every((s: any) => s.organizationId === holngOrg.id)).toBe(true);
    });

    it('should show API servers from all allowed orgs for multi-org user', async () => {
      const response = await request(app)
        .get('/api/api-servers')
        .set('Authorization', `Bearer ${multiOrgToken}`);

      expect(response.status).toBe(200);
      const orgIds = response.body.map((s: any) => s.organizationId);
      expect(orgIds).toContain(holngOrg.id);
      expect(orgIds).toContain(rioOrg.id);
      expect(orgIds).not.toContain(bechOrg.id); // User not in BECH
    });
  });

  describe('ATTACK-IDOR-009: Organization Detail Leak', () => {
    it('should prevent user from viewing unauthorized organization details', async () => {
      const response = await request(app)
        .get(`/api/organizations/${rioOrg.id}`)
        .set('Authorization', `Bearer ${holngToken}`);

      expect([403, 404]).toContain(response.status);
    });

    it('should allow user to view their own organization details', async () => {
      const response = await request(app)
        .get(`/api/organizations/${holngOrg.id}`)
        .set('Authorization', `Bearer ${holngToken}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe('HOLNG');
    });
  });
});
```

### 2. Security Findings Report

Create `docs/security/IDOR_MULTI_TENANT_AUDIT.md`:

```markdown
# IDOR and Multi-Tenant Isolation Audit Report

**Audit Date**: [Current Date]
**Auditor**: ai-security-red-teamer
**System**: PFA Vanguard Multi-Tenant Access Control
**Scope**: ADR-005 IDOR Attack Vectors

---

## Executive Summary

**Total Attack Vectors Tested**: 9 categories, 21 test scenarios
**Critical Vulnerabilities Found**: [To be filled]
**Data Leak Vulnerabilities**: [To be filled]
**Overall Isolation Rating**: [To be determined]

---

## Attack Vector Analysis

### 1. Direct PFA Record Access (ATTACK-IDOR-001)
**Status**: [PASS/FAIL]
**Risk Level**: CRITICAL
**Test Results**:
- HOLNG → RIO record access: [Result]
- RIO → HOLNG record access: [Result]

**Findings**:
[Document if unauthorized access possible]

**Remediation** (if needed):
- Add organization ownership check in `getPfaRecordById` controller
- Verify `req.user.allowedOrganizationIds.includes(record.organizationId)`

---

### 2. Organization ID Query Manipulation (ATTACK-IDOR-002)
**Status**: [PASS/FAIL]
**Risk Level**: HIGH
**Test Results**:
- Query param manipulation: [Result]
- List query filtering: [Result]

**Findings**:
[Document if data leak possible via query manipulation]

**Remediation** (if needed):
- Implement server-side filtering: `WHERE organizationId IN (user.allowedOrganizationIds)`
- Never trust client-provided `organizationId` query param

---

### 3. API Server Direct Modification (ATTACK-IDOR-003)
**Status**: [PASS/FAIL]
**Risk Level**: CRITICAL
**Test Results**:
- Cross-org edit: [Result]
- Cross-org delete: [Result]

**Findings**:
[Document if unauthorized API server modification possible]

**Remediation** (if needed):
- Add `requireApiServerPermission` middleware
- Verify `apiServer.organizationId IN user.allowedOrganizationIds`

---

### 4. Context Switching Exploit (ATTACK-IDOR-004)
**Status**: [PASS/FAIL]
**Risk Level**: HIGH
**Test Results**:
- Unauthorized context switch: [Result]
- Multi-org valid switch: [Result]

**Findings**:
[Document if context switching allows unauthorized org access]

**Remediation** (if needed):
- Validate `newOrganizationId IN user.allowedOrganizationIds`
- Log all context switch attempts to audit log

---

### 5. Bulk Operation Cross-Org Injection (ATTACK-IDOR-005)
**Status**: [PASS/FAIL]
**Risk Level**: HIGH
**Test Results**:
- Bulk update with cross-org IDs: [Result]
- Bulk delete with cross-org IDs: [Result]

**Findings**:
[Document if bulk operations can affect other orgs data]

**Remediation** (if needed):
- Filter recordIds: `recordIds = recordIds.filter(id => ownedRecordIds.includes(id))`
- Return error if any unauthorized IDs detected

---

### 6. Audit Log Data Leak (ATTACK-IDOR-006)
**Status**: [PASS/FAIL]
**Risk Level**: MEDIUM
**Test Results**:
- Cross-org audit log access: [Result]
- Audit log filtering: [Result]

**Findings**:
[Document if audit logs leak data from other orgs]

**Remediation** (if needed):
- Always filter: `WHERE organizationId IN (user.allowedOrganizationIds)`
- Never expose audit logs without org filtering

---

### 7. User Enumeration (ATTACK-IDOR-007)
**Status**: [PASS/FAIL]
**Risk Level**: MEDIUM
**Test Results**:
- Cross-org user detail access: [Result]
- User list filtering: [Result]

**Findings**:
[Document if user enumeration possible]

**Remediation** (if needed):
- Return 404 (not 403) for non-existent OR unauthorized users
- Filter user list by shared organizations

---

### 8. API Server List Leak (ATTACK-IDOR-008)
**Status**: [PASS/FAIL]
**Risk Level**: MEDIUM
**Test Results**:
- API server list filtering: [Result]
- Multi-org server visibility: [Result]

**Findings**:
[Document if API servers leak across orgs]

**Remediation** (if needed):
- Filter: `WHERE organizationId IN (user.allowedOrganizationIds)`

---

### 9. Organization Detail Leak (ATTACK-IDOR-009)
**Status**: [PASS/FAIL]
**Risk Level**: LOW
**Test Results**:
- Cross-org detail access: [Result]

**Findings**:
[Document if organization details accessible without authorization]

**Remediation** (if needed):
- Verify `organizationId IN user.allowedOrganizationIds`

---

## Multi-Tenant Isolation Checklist

- [ ] All 21 test scenarios passing
- [ ] No critical IDOR vulnerabilities found
- [ ] PFA records properly isolated by organization
- [ ] API servers properly isolated by organization
- [ ] Audit logs properly isolated by organization
- [ ] User enumeration prevented or minimized
- [ ] Context switching validated against allowed organizations
- [ ] Bulk operations filtered to owned records only
- [ ] Database queries include organization filtering
- [ ] API responses never leak unauthorized org data

---

## Recommendations

### Immediate Actions (P0)
1. [List critical IDOR fixes needed]

### High Priority (P1)
1. [List high-priority isolation improvements]

---

## Appendix: Test Execution Log

[Paste test output]
```

### 3. Validation Script

Create `backend/scripts/validate-multi-tenant-isolation.ts`:

```typescript
/**
 * @file Validate Multi-Tenant Isolation
 * @description Script to verify organization data isolation in production database
 * @usage npx tsx scripts/validate-multi-tenant-isolation.ts
 */

import { prisma } from '../src/config/database';

async function validateIsolation() {
  console.log('🔍 Validating Multi-Tenant Isolation...\n');

  // Test 1: Verify all PFA records have organizationId
  const pfaWithoutOrg = await prisma.pfaRecord.count({
    where: { organizationId: null }
  });
  console.log(`✅ PFA Records without organizationId: ${pfaWithoutOrg}`);
  if (pfaWithoutOrg > 0) {
    console.error('❌ CRITICAL: Found PFA records without organization assignment');
  }

  // Test 2: Verify all API servers have organizationId
  const serversWithoutOrg = await prisma.apiServer.count({
    where: { organizationId: null }
  });
  console.log(`✅ API Servers without organizationId: ${serversWithoutOrg}`);

  // Test 3: Verify all users have allowedOrganizationIds
  const usersWithoutOrgs = await prisma.user.count({
    where: {
      OR: [
        { allowedOrganizationIds: { equals: [] } },
        { allowedOrganizationIds: null }
      ]
    }
  });
  console.log(`✅ Users without allowedOrganizationIds: ${usersWithoutOrgs}`);

  // Test 4: Check for orphaned UserOrganization records
  const orphanedRelations = await prisma.userOrganization.findMany({
    where: {
      OR: [
        { user: null },
        { organization: null }
      ]
    }
  });
  console.log(`✅ Orphaned UserOrganization records: ${orphanedRelations.length}`);

  // Test 5: Verify audit logs have organizationId
  const auditLogsWithoutOrg = await prisma.auditLog.count({
    where: { organizationId: null }
  });
  console.log(`✅ Audit logs without organizationId: ${auditLogsWithoutOrg}\n`);

  // Summary
  const issues = [
    pfaWithoutOrg,
    serversWithoutOrg,
    usersWithoutOrgs,
    orphanedRelations.length,
    auditLogsWithoutOrg
  ].reduce((sum, count) => sum + count, 0);

  if (issues === 0) {
    console.log('✅ All multi-tenant isolation checks passed!');
  } else {
    console.error(`❌ Found ${issues} isolation issues - review required`);
    process.exit(1);
  }
}

validateIsolation()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

## Success Criteria

✅ **Task Complete When**:
1. All 21 IDOR test scenarios implemented
2. All tests passing OR vulnerabilities documented
3. Security audit report generated
4. Validation script confirms database-level isolation
5. Remediation guide created for any findings

## Validation Steps

```bash
# Run IDOR tests
cd backend
npm run test:integration -- idorMultiTenant.test.ts

# Validate database isolation
npx tsx scripts/validate-multi-tenant-isolation.ts

# Check audit report
cat docs/security/IDOR_MULTI_TENANT_AUDIT.md | grep "Critical Vulnerabilities Found:"

# Verify coverage
npm run test:coverage -- idorMultiTenant.test.ts
```

## References

- **Test Plan**: ADR-005-TEST_PLAN.md lines 46-60 (Cross-Organization Access Tests)
- **Implementation**: ADR-005-IMPLEMENTATION_PLAN.md Phase 2 (Authorization Middleware)
- **UX Spec**: ADR-005-UX_SPEC.md (Multi-Org Context Switching)

---

**Estimated Time**: 3 hours
**Dependencies**: Phase 9 complete
**Blocker Risk**: NONE
**Agent Handoff**: → Task 10A.3 (Financial Masking Bypass Testing)
```

---

# Task 10A.3: Financial Masking Bypass Testing

**Agent**: ai-security-red-teamer
**Duration**: 3 hours
**Prerequisites**: Phase 9 Complete (Financial Masking UI implemented)
**Deliverables**:
- Financial masking bypass attack suite
- Client-side protection audit
- Security recommendations

---

## 📦 Self-Contained Prompt Bundle

```markdown
# TASK: Financial Masking Bypass Testing - ADR-005

## Your Role
You are the **ai-security-red-teamer** agent responsible for testing if users without `viewFinancialDetails` permission can bypass financial masking to see actual costs.

## Context: Financial Masking System

### Permission Model
**Permission**: `viewFinancialDetails` (boolean capability)
- `true`: User sees actual costs ($450,000)
- `false`: User sees masked costs (***masked*** + relative indicators)

**Affected Fields**:
- `PfaRecord.cost` (rental: monthlyRate × days, purchase: purchasePrice)
- `PfaRecord.monthlyRate`
- `PfaRecord.purchasePrice`
- Aggregated totals (Portfolio Variance Dashboard)

**Masking Implementation**:
- **Backend**: API responses replace cost fields with `"***masked***"` string
- **Frontend**: Components conditionally render based on `user.capabilities.viewFinancialDetails`
- **Relative Indicators**: Users see "HIGH impact" instead of "$450K"

### Attack Surface

**Critical Bypass Vectors**:
1. **Browser DevTools Inspection**: User inspects DOM/Network tab to find actual values
2. **API Response Manipulation**: User intercepts responses and un-masks values
3. **JavaScript Console Access**: User queries React state for un-masked data
4. **Query Parameter Injection**: User adds `?includeFinancials=true` to API calls
5. **Client-Side Filtering Bypass**: User modifies frontend code to show hidden values
6. **Memory Dump**: User inspects browser memory for cost values
7. **Export Bypass**: User exports data to CSV and finds costs included

## Your Mission

**Primary Objective**: Test every bypass vector to ensure financial costs are never exposed to unauthorized users.

**Attack Scenarios to Test**:

### Scenario 1: Browser DevTools Network Tab Inspection
**Initial State**: User without `viewFinancialDetails` loads PFA records
**Attack**: User opens DevTools → Network tab → Inspects `/api/pfa/records` response JSON
**Expected Defense**: Response JSON contains `"cost": "***masked***"`, not actual values

### Scenario 2: Query Parameter Injection
**Initial State**: User requests PFA records normally
**Attack**: User modifies URL to `GET /api/pfa/records?includeFinancials=true`
**Expected Defense**: 403 Forbidden - "FINANCIAL_ACCESS_DENIED" OR parameter ignored

### Scenario 3: JavaScript Console State Inspection
**Initial State**: User loads React app with PFA data
**Attack**: User opens console and runs `window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers.get(1).findFiberByHostInstance(document.querySelector('.pfa-record')).memoizedProps.cost`
**Expected Defense**: Prop contains `"***masked***"`, not actual cost

### Scenario 4: API Direct Call Bypass
**Initial State**: User has valid JWT token
**Attack**: User uses `curl` to call API directly without frontend filtering
**Expected Defense**: Backend always masks if `user.capabilities.viewFinancialDetails === false`

### Scenario 5: Export to CSV Bypass
**Initial State**: User exports PFA records to CSV
**Attack**: User opens CSV file and checks cost column
**Expected Defense**: CSV contains `"***masked***"` for cost, monthlyRate, purchasePrice

### Scenario 6: React Props Drilling
**Initial State**: User inspects React component props
**Attack**: User uses React DevTools to inspect PFA record component props
**Expected Defense**: Props never contain un-masked cost values

### Scenario 7: Audit Log Metadata Leak
**Initial State**: User views audit logs
**Attack**: User checks audit log metadata for cost change history (e.g., "cost changed from $10K to $20K")
**Expected Defense**: Audit log metadata masks costs for unauthorized users

## Deliverables

### 1. Integration Test Suite

Create test file at `backend/tests/integration/financialMaskingBypass.test.ts`:

```typescript
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../../src/server';
import { prisma } from '../../src/config/database';
import { createUser, loginAs, createOrganization, createPfaRecord } from '../helpers/testHelpers';

describe('Security: Financial Masking Bypass Prevention', () => {
  let org: any;
  let userWithFinancials: any;
  let tokenWithFinancials: string;
  let userWithoutFinancials: any;
  let tokenWithoutFinancials: string;
  let expensiveRecord: any;

  beforeAll(async () => {
    org = await createOrganization({ code: 'TEST', name: 'Test Org' });

    userWithFinancials = await createUser({
      username: 'financial-user',
      email: 'financial@test.com',
      organizationId: org.id,
      allowedOrganizationIds: [org.id],
      role: 'BEO User',
      capabilities: { canViewOrgData: true, viewFinancialDetails: true }
    });
    tokenWithFinancials = await loginAs('financial-user', 'password');

    userWithoutFinancials = await createUser({
      username: 'no-financial-user',
      email: 'no-financial@test.com',
      organizationId: org.id,
      allowedOrganizationIds: [org.id],
      role: 'Field Engineer',
      capabilities: { canViewOrgData: true, viewFinancialDetails: false }
    });
    tokenWithoutFinancials = await loginAs('no-financial-user', 'password');

    expensiveRecord = await createPfaRecord({
      organizationId: org.id,
      category: 'Cranes',
      description: 'Crane - Mobile 200T',
      source: 'Rental',
      monthlyRate: 150000,
      forecastStart: new Date('2025-01-01'),
      forecastEnd: new Date('2025-03-31'), // 3 months = $450K
    });
  });

  afterAll(async () => {
    await prisma.pfaRecord.delete({ where: { id: expensiveRecord.id } });
    await prisma.user.deleteMany({ where: { email: { in: ['financial@test.com', 'no-financial@test.com'] } } });
    await prisma.organization.delete({ where: { id: org.id } });
  });

  describe('ATTACK-MASK-001: API Response Inspection', () => {
    it('should mask cost in API response for unauthorized user', async () => {
      const response = await request(app)
        .get(`/api/pfa/records/${expensiveRecord.id}`)
        .set('Authorization', `Bearer ${tokenWithoutFinancials}`);

      expect(response.status).toBe(200);
      expect(response.body.cost).toBe('***masked***');
      expect(response.body.monthlyRate).toBe('***masked***');
      expect(response.body).not.toHaveProperty('purchasePrice'); // Or also masked

      // Verify actual cost NOT in response (even as metadata)
      const jsonString = JSON.stringify(response.body);
      expect(jsonString).not.toContain('450000');
      expect(jsonString).not.toContain('150000');
    });

    it('should show actual cost in API response for authorized user', async () => {
      const response = await request(app)
        .get(`/api/pfa/records/${expensiveRecord.id}`)
        .set('Authorization', `Bearer ${tokenWithFinancials}`);

      expect(response.status).toBe(200);
      expect(response.body.cost).toBeGreaterThan(400000); // Actual cost ~$450K
      expect(response.body.monthlyRate).toBe(150000);
    });

    it('should mask costs in list API response', async () => {
      const response = await request(app)
        .get(`/api/pfa/records?organizationId=${org.id}`)
        .set('Authorization', `Bearer ${tokenWithoutFinancials}`);

      expect(response.status).toBe(200);
      const record = response.body.find((r: any) => r.id === expensiveRecord.id);
      expect(record.cost).toBe('***masked***');
    });
  });

  describe('ATTACK-MASK-002: Query Parameter Injection', () => {
    it('should reject includeFinancials query param for unauthorized user', async () => {
      const response = await request(app)
        .get(`/api/pfa/records?organizationId=${org.id}&includeFinancials=true`)
        .set('Authorization', `Bearer ${tokenWithoutFinancials}`);

      // Either 403 (parameter rejected) OR 200 (parameter ignored, costs still masked)
      if (response.status === 403) {
        expect(response.body.error).toContain('FINANCIAL_ACCESS_DENIED');
      } else {
        expect(response.status).toBe(200);
        const record = response.body.find((r: any) => r.id === expensiveRecord.id);
        expect(record.cost).toBe('***masked***');
      }
    });

    it('should log financial access bypass attempts', async () => {
      await request(app)
        .get(`/api/pfa/records?includeFinancials=true`)
        .set('Authorization', `Bearer ${tokenWithoutFinancials}`);

      // Verify audit log entry created
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          userId: userWithoutFinancials.id,
          action: 'financial_access_attempt',
        }
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog.metadata).toMatchObject({
        attemptedBypass: true,
        queryParams: expect.objectContaining({ includeFinancials: 'true' })
      });
    });
  });

  describe('ATTACK-MASK-003: Export Bypass', () => {
    it('should mask costs in CSV export for unauthorized user', async () => {
      const response = await request(app)
        .get(`/api/pfa/records/export?organizationId=${org.id}&format=csv`)
        .set('Authorization', `Bearer ${tokenWithoutFinancials}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');

      const csvContent = response.text;
      expect(csvContent).toContain('***masked***');
      expect(csvContent).not.toContain('450000');
      expect(csvContent).not.toContain('150000');
    });

    it('should include actual costs in CSV export for authorized user', async () => {
      const response = await request(app)
        .get(`/api/pfa/records/export?organizationId=${org.id}&format=csv`)
        .set('Authorization', `Bearer ${tokenWithFinancials}`);

      expect(response.status).toBe(200);
      const csvContent = response.text;
      expect(csvContent).toMatch(/450000|150000/); // Actual costs present
    });
  });

  describe('ATTACK-MASK-004: Aggregated Totals Bypass', () => {
    it('should mask portfolio variance for unauthorized user', async () => {
      const response = await request(app)
        .get(`/api/analytics/portfolio-variance?organizationId=${org.id}`)
        .set('Authorization', `Bearer ${tokenWithoutFinancials}`);

      expect(response.status).toBe(200);
      expect(response.body.totalCost).toBe('***masked***');
      expect(response.body.variance).toBe('***masked***');
      expect(response.body).toHaveProperty('impactLevel'); // Relative indicator present
    });

    it('should show actual portfolio variance for authorized user', async () => {
      const response = await request(app)
        .get(`/api/analytics/portfolio-variance?organizationId=${org.id}`)
        .set('Authorization', `Bearer ${tokenWithFinancials}`);

      expect(response.status).toBe(200);
      expect(typeof response.body.totalCost).toBe('number');
      expect(response.body.totalCost).toBeGreaterThan(0);
    });
  });

  describe('ATTACK-MASK-005: Audit Log Metadata Leak', () => {
    it('should mask costs in audit log metadata', async () => {
      // Create audit log with cost change
      await prisma.auditLog.create({
        data: {
          userId: userWithFinancials.id,
          organizationId: org.id,
          action: 'pfa:update',
          resourceType: 'PfaRecord',
          resourceId: expensiveRecord.id,
          metadata: {
            changes: {
              monthlyRate: { from: 150000, to: 175000 }
            }
          }
        }
      });

      // Unauthorized user fetches audit log
      const response = await request(app)
        .get(`/api/audit-logs?resourceId=${expensiveRecord.id}`)
        .set('Authorization', `Bearer ${tokenWithoutFinancials}`);

      expect(response.status).toBe(200);
      const logEntry = response.body[0];

      // Verify costs masked in metadata
      expect(logEntry.metadata.changes.monthlyRate.from).toBe('***masked***');
      expect(logEntry.metadata.changes.monthlyRate.to).toBe('***masked***');
    });
  });

  describe('ATTACK-MASK-006: Relative Indicator Reverse Engineering', () => {
    it('should provide relative indicators without revealing exact costs', async () => {
      const response = await request(app)
        .get(`/api/pfa/records/${expensiveRecord.id}`)
        .set('Authorization', `Bearer ${tokenWithoutFinancials}`);

      expect(response.status).toBe(200);
      expect(response.body.cost).toBe('***masked***');

      // Relative indicators should be present
      expect(response.body.impactLevel).toMatch(/HIGH|MEDIUM|LOW/);
      expect(response.body.relativeComparison).toBeTruthy(); // E.g., "3.2x category average"

      // But should NOT reveal exact cost even indirectly
      // E.g., avoid saying "$450K is 3.2x $140K average" (can reverse engineer)
      const indicator = response.body.relativeComparison;
      expect(indicator).not.toMatch(/\$\d+/); // No dollar amounts in indicator
    });
  });

  describe('ATTACK-MASK-007: Token Manipulation', () => {
    it('should re-check permission on every request, not trust token claim', async () => {
      // Scenario: User had viewFinancialDetails, admin revokes it, but token still valid

      // Step 1: User loads data (has permission initially)
      let response = await request(app)
        .get(`/api/pfa/records/${expensiveRecord.id}`)
        .set('Authorization', `Bearer ${tokenWithFinancials}`);
      expect(response.body.cost).toBeGreaterThan(400000);

      // Step 2: Admin revokes viewFinancialDetails
      await prisma.user.update({
        where: { id: userWithFinancials.id },
        data: {
          capabilities: {
            canViewOrgData: true,
            viewFinancialDetails: false // Revoked
          }
        }
      });

      // Step 3: User makes another request with SAME token
      response = await request(app)
        .get(`/api/pfa/records/${expensiveRecord.id}`)
        .set('Authorization', `Bearer ${tokenWithFinancials}`);

      // Should be masked (if backend re-checks DB) OR still un-masked (if using cached token)
      // Acceptable: Cost visible until token expires (if TTL < 1 hour)
      if (response.body.cost === '***masked***') {
        console.log('✅ Permission re-checked on every request');
      } else {
        console.warn('⚠️ WARNING: Permissions cached in JWT - revocation not immediate');
        console.warn('   Verify token TTL < 1 hour for production');
      }

      // Step 4: After new login, should definitely be masked
      const newToken = await loginAs('financial-user', 'password');
      response = await request(app)
        .get(`/api/pfa/records/${expensiveRecord.id}`)
        .set('Authorization', `Bearer ${newToken}`);
      expect(response.body.cost).toBe('***masked***');
    });
  });
});
```

### 2. Client-Side Protection Audit

Create `docs/security/FINANCIAL_MASKING_AUDIT.md`:

```markdown
# Financial Masking Security Audit Report

**Audit Date**: [Current Date]
**Auditor**: ai-security-red-teamer
**System**: PFA Vanguard Financial Masking
**Scope**: ADR-005 Financial Data Protection

---

## Executive Summary

**Total Attack Vectors Tested**: 7 categories, 15 test scenarios
**Critical Leaks Found**: [To be filled]
**Client-Side Vulnerabilities**: [To be filled]
**Overall Masking Effectiveness**: [To be determined]

---

## Attack Vector Analysis

### 1. API Response Inspection (ATTACK-MASK-001)
**Status**: [PASS/FAIL]
**Risk Level**: CRITICAL
**Test Results**:
- Single record API: [Result]
- List API: [Result]
- Aggregated totals: [Result]

**Findings**:
[Document if costs visible in API responses]

**Remediation** (if needed):
- Ensure backend masks BEFORE sending response
- Never include actual costs in metadata or nested fields

---

### 2. Query Parameter Injection (ATTACK-MASK-002)
**Status**: [PASS/FAIL]
**Risk Level**: HIGH
**Test Results**:
- includeFinancials=true: [Result]
- Audit logging: [Result]

**Findings**:
[Document if query params bypass masking]

**Remediation** (if needed):
- Reject OR ignore `includeFinancials` param for unauthorized users
- Log all bypass attempts

---

### 3. Export Bypass (ATTACK-MASK-003)
**Status**: [PASS/FAIL]
**Risk Level**: HIGH
**Test Results**:
- CSV export masking: [Result]
- Excel export masking: [Result]

**Findings**:
[Document if exports leak costs]

**Remediation** (if needed):
- Apply same masking logic to exports
- Verify exports use server-side masking, not client-side

---

### 4. Aggregated Totals Bypass (ATTACK-MASK-004)
**Status**: [PASS/FAIL]
**Risk Level**: MEDIUM
**Test Results**:
- Portfolio variance: [Result]
- Category rollups: [Result]

**Findings**:
[Document if aggregations reveal individual costs]

**Remediation** (if needed):
- Mask aggregated totals as well as individual costs

---

### 5. Audit Log Metadata Leak (ATTACK-MASK-005)
**Status**: [PASS/FAIL]
**Risk Level**: MEDIUM
**Test Results**:
- Cost change history: [Result]

**Findings**:
[Document if audit logs leak historical costs]

**Remediation** (if needed):
- Mask costs in audit log metadata before storing
- OR mask when retrieving audit logs for unauthorized users

---

### 6. Relative Indicator Reverse Engineering (ATTACK-MASK-006)
**Status**: [PASS/FAIL]
**Risk Level**: LOW
**Test Results**:
- Indicator precision: [Result]

**Findings**:
[Document if relative indicators indirectly reveal exact costs]

**Remediation** (if needed):
- Avoid revealing category averages that allow reverse engineering
- Use imprecise indicators: "HIGH impact" instead of "3.2x $140K average"

---

### 7. Token Manipulation (ATTACK-MASK-007)
**Status**: [PASS/FAIL]
**Risk Level**: MEDIUM
**Test Results**:
- Permission revocation timing: [Result]

**Findings**:
[Document delay between permission revocation and masking]

**Remediation** (if needed):
- Re-check permissions on every request OR reduce token TTL to <1 hour

---

## Financial Masking Checklist

- [ ] All 15 test scenarios passing
- [ ] No critical cost leaks found
- [ ] API responses mask costs for unauthorized users
- [ ] Exports (CSV/Excel) mask costs
- [ ] Aggregated totals masked
- [ ] Audit log metadata masked
- [ ] Relative indicators don't reveal exact costs
- [ ] Bypass attempts logged to audit log
- [ ] Permission re-check on every request OR token TTL <1 hour

---

## Recommendations

### Immediate Actions (P0)
1. [List critical fixes]

### High Priority (P1)
1. Reduce JWT token TTL to 15 minutes for financial permissions
2. Implement token revocation list for immediate permission changes
3. Add rate limiting for export endpoints (prevent bulk data extraction)

### Medium Priority (P2)
1. Add watermarking to relative indicators to detect screenshot leaks
2. Implement data loss prevention (DLP) monitoring for financial exports

---

## Appendix: Test Execution Log

[Paste test output]
```

### 3. Frontend Protection Checklist

Create `docs/security/FINANCIAL_MASKING_FRONTEND.md`:

```markdown
# Frontend Financial Masking Checklist

## Critical Security Rules

### Rule 1: Never Send Unmasked Data to Frontend
❌ **WRONG**:
```typescript
// Backend sends unmasked data, frontend decides what to show
res.json({
  cost: 450000,
  userCanView: false
});
```

✅ **CORRECT**:
```typescript
// Backend masks BEFORE sending
const cost = user.capabilities.viewFinancialDetails ? 450000 : '***masked***';
res.json({ cost });
```

### Rule 2: No Client-Side Masking Logic
❌ **WRONG**:
```tsx
// Frontend masking (can be bypassed)
{user.canViewFinancials ? cost : '***masked***'}
```

✅ **CORRECT**:
```tsx
// Data already masked by backend
{cost}
```

### Rule 3: No Costs in Component Props
❌ **WRONG**:
```tsx
<PfaCard
  actualCost={450000}
  maskCost={!user.canViewFinancials}
/>
```

✅ **CORRECT**:
```tsx
<PfaCard cost={cost} /> // cost is already '***masked***' or actual value
```

### Rule 4: Validate Exports Server-Side
❌ **WRONG**:
```typescript
// Client generates CSV from local state
const csv = generateCsv(pfaRecords); // Might include unmasked costs
```

✅ **CORRECT**:
```typescript
// Server generates CSV with masking applied
const response = await fetch('/api/pfa/records/export?format=csv');
```

---

## Implementation Checklist

- [ ] Backend masking middleware applied to all financial endpoints
- [ ] Frontend never receives unmasked costs for unauthorized users
- [ ] Exports generated server-side with masking
- [ ] React DevTools inspection shows masked values in props
- [ ] Network tab inspection shows masked values in responses
- [ ] Local storage/session storage never contains unmasked costs
- [ ] Audit log metadata masked before storage
```

## Success Criteria

✅ **Task Complete When**:
1. All 15 financial masking bypass tests implemented
2. All tests passing OR leaks documented in audit report
3. Client-side protection audit completed
4. Remediation guide created for any vulnerabilities
5. Frontend protection checklist validated

## Validation Steps

```bash
# Run financial masking tests
cd backend
npm run test:integration -- financialMaskingBypass.test.ts

# Verify no cost leaks in API responses
npm run test:security -- financialMaskingBypass.test.ts --verbose

# Manual verification
# 1. Login as user without viewFinancialDetails
# 2. Open DevTools Network tab
# 3. Load PFA records
# 4. Verify all cost fields show "***masked***"

# Check audit report
cat docs/security/FINANCIAL_MASKING_AUDIT.md | grep "Critical Leaks Found:"
```

## References

- **Test Plan**: ADR-005-TEST_PLAN.md lines 1269-1320 (Financial Masking Tests)
- **UX Spec**: ADR-005-UX_SPEC.md Use Case 17 (Financial Masking)
- **AI Opportunities**: ADR-005-AI_OPPORTUNITIES.md Use Case 17

---

**Estimated Time**: 3 hours
**Dependencies**: Phase 9 complete (Financial masking UI implemented)
**Blocker Risk**: NONE
**Agent Handoff**: → Task 10A.4 (API Server Security Audit)
```

---

# Task 10A.4: API Server Security Audit

**Agent**: ai-security-red-teamer
**Duration**: 3 hours
**Prerequisites**: Phase 9 Complete (API Server Management implemented)
**Deliverables**:
- API server authorization test suite
- Cascading security validation
- External entity protection audit

---

## 📦 Self-Contained Prompt Bundle

```markdown
# TASK: API Server Security Audit - ADR-005

## Your Role
You are the **ai-security-red-teamer** agent responsible for adversarial testing of the API Server Management system. Your mission is to identify authorization bypasses, cascading security issues, and external entity protection vulnerabilities.

## Context: API Server Management Architecture

### Permission Model
**API Server CRUD** requires `perm_ManageSettings` permission:
- **Create**: User must have `perm_ManageSettings` + belong to target organization
- **Read**: User can view servers for their allowed organizations
- **Update**: User must have `perm_ManageSettings` + own the server's organization
- **Delete**: User must have `perm_ManageSettings` + own the server's organization

**Organization Status Cascading**:
- `Organization.serviceStatus = 'suspended'` → API server connections disabled
- `Organization.serviceStatus = 'active'` → API server connections enabled
- Suspension affects existing servers, but servers remain in database

**External Entity Protection**:
- `Organization.isExternal = true` → PEMS-managed, CANNOT be deleted
- `Organization.isExternal = false` → Local, CAN be deleted
- External orgs CAN have API servers (settings writable)
- API servers preserved during org unlinking

### Database Schema
```prisma
model Organization {
  id            String      @id
  code          String      @unique
  serviceStatus String      @default("active") // active, suspended
  isExternal    Boolean     @default(false)
  externalId    String?
  apiServers    ApiServer[]
}

model ApiServer {
  id             String
  organizationId String
  name           String
  baseUrl        String
  authType       String
  organization   Organization @relation(..., onDelete: Cascade)
  endpoints      ApiEndpoint[]
}

model ApiEndpoint {
  id       String
  serverId String
  name     String
  server   ApiServer @relation(..., onDelete: Cascade)
}
```

### Attack Surface

**Critical Security Vulnerabilities to Test**:
1. **Permission Bypass**: User without `perm_ManageSettings` creates/edits API servers
2. **Cross-Org Access**: User manages API servers for unauthorized organizations
3. **Cascading Delete**: Organization deletion fails to cascade to API servers
4. **Suspended Org Bypass**: API server test succeeds despite org suspension
5. **External Org Protection**: PEMS-managed org can be deleted
6. **Credentials Exposure**: API server credentials visible in responses

## Your Mission

**Primary Objective**: Test every attack vector that could compromise API server security.

**Attack Scenarios to Test**:

### Scenario 1: Create API Server Without Permission
**Initial State**: User has `perm_ManageSettings: false`
**Attack**: `POST /api/api-servers` with valid server data
**Expected Defense**: 403 Forbidden - "Requires perm_ManageSettings permission"

### Scenario 2: Edit API Server in Different Org
**Initial State**: User has `perm_ManageSettings` for RIO, tries to edit HOLNG server
**Attack**: `PATCH /api/api-servers/{holng-server-id}`
**Expected Defense**: 403 Forbidden - "You don't have permission to manage this organization's API servers"

### Scenario 3: Suspended Org API Server Test
**Initial State**: Organization is suspended
**Attack**: `POST /api/api-servers/{server-id}/test`
**Expected Defense**: 403 Forbidden - "Cannot test - Organization is suspended"

### Scenario 4: Delete External Org with API Servers
**Initial State**: PEMS-managed org has 5 API servers
**Attack**: `DELETE /api/organizations/{pems-org-id}`
**Expected Defense**: 403 Forbidden - "Cannot delete PEMS-managed organization"

### Scenario 5: Credentials Exposure
**Initial State**: User fetches API server details
**Attack**: `GET /api/api-servers/{server-id}`
**Expected Defense**: Response masks `apiKey`, `password`, `bearerToken` fields

### Scenario 6: Cascading Delete Validation
**Initial State**: Local org has 3 API servers, each with 5 endpoints
**Attack**: `DELETE /api/organizations/{local-org-id}`
**Expected Defense**: Organization + API servers + endpoints all deleted (onDelete: Cascade)

### Scenario 7: Reactivate Org Restores Servers
**Initial State**: Suspended org with API servers
**Attack**: `PATCH /api/organizations/{org-id}` with `{ serviceStatus: 'active' }`
**Expected Defense**: API server test now succeeds

## Deliverables

### 1. Integration Test Suite

Create test file at `backend/tests/integration/apiServerAuthorization.test.ts`:

```typescript
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../../src/server';
import { prisma } from '../../src/config/database';
import { createUser, loginAs, createOrganization, createApiServer } from '../helpers/testHelpers';

describe('Security: API Server Management Authorization', () => {
  let holngOrg: any;
  let rioOrg: any;
  let pemsOrg: any;
  let localOrg: any;

  let adminToken: string;
  let userWithPermToken: string;
  let userWithPermUser: any;
  let userWithoutPermToken: string;
  let userWithoutPermUser: any;

  let holngServer: any;
  let rioServer: any;

  beforeAll(async () => {
    // Create organizations
    holngOrg = await createOrganization({ code: 'HOLNG', name: 'Holcim Nigeria', serviceStatus: 'active' });
    rioOrg = await createOrganization({ code: 'RIO', name: 'Rio Tinto', serviceStatus: 'active' });
    pemsOrg = await createOrganization({
      code: 'PEMS_Global',
      name: 'PEMS Global',
      isExternal: true,
      externalId: 'PEMS-ORG-123',
      serviceStatus: 'active'
    });
    localOrg = await createOrganization({ code: 'LOCAL', name: 'Local Org', isExternal: false });

    // Create users
    adminToken = await loginAs('admin', 'admin123');

    userWithPermUser = await createUser({
      username: 'with-perm',
      email: 'with-perm@test.com',
      organizationId: holngOrg.id,
      allowedOrganizationIds: [holngOrg.id],
      role: 'Field Engineer',
      capabilities: { canViewOrgData: true, perm_ManageSettings: true }
    });
    userWithPermToken = await loginAs('with-perm', 'password');

    userWithoutPermUser = await createUser({
      username: 'without-perm',
      email: 'without-perm@test.com',
      organizationId: holngOrg.id,
      allowedOrganizationIds: [holngOrg.id],
      role: 'Field Engineer',
      capabilities: { canViewOrgData: true, perm_ManageSettings: false }
    });
    userWithoutPermToken = await loginAs('without-perm', 'password');

    // Create API servers
    holngServer = await createApiServer({
      organizationId: holngOrg.id,
      name: 'HOLNG Server',
      baseUrl: 'https://api.holng.com',
      authType: 'bearer',
      credentials: { bearerToken: 'secret-token-123' }
    });

    rioServer = await createApiServer({
      organizationId: rioOrg.id,
      name: 'RIO Server',
      baseUrl: 'https://api.rio.com',
      authType: 'basic',
      credentials: { username: 'admin', password: 'secret-pass' }
    });
  });

  afterAll(async () => {
    await prisma.apiServer.deleteMany({ where: { id: { in: [holngServer.id, rioServer.id] } } });
    await prisma.user.deleteMany({ where: { email: { in: ['with-perm@test.com', 'without-perm@test.com'] } } });
    await prisma.organization.deleteMany({ where: { code: { in: ['HOLNG', 'RIO', 'PEMS_Global', 'LOCAL'] } } });
  });

  describe('ATTACK-API-001: Create API Server Without Permission', () => {
    it('should prevent user without perm_ManageSettings from creating server', async () => {
      const response = await request(app)
        .post('/api/api-servers')
        .set('Authorization', `Bearer ${userWithoutPermToken}`)
        .send({
          organizationId: holngOrg.id,
          name: 'Unauthorized Server',
          baseUrl: 'https://evil.com',
          authType: 'bearer'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('perm_ManageSettings');
    });

    it('should allow user with perm_ManageSettings to create server', async () => {
      const response = await request(app)
        .post('/api/api-servers')
        .set('Authorization', `Bearer ${userWithPermToken}`)
        .send({
          organizationId: holngOrg.id,
          name: 'Authorized Server',
          baseUrl: 'https://api.authorized.com',
          authType: 'bearer'
        });

      expect(response.status).toBe(201);
      expect(response.body.organizationId).toBe(holngOrg.id);
      expect(response.body.name).toBe('Authorized Server');

      // Cleanup
      await prisma.apiServer.delete({ where: { id: response.body.id } });
    });
  });

  describe('ATTACK-API-002: Cross-Organization Access', () => {
    it('should prevent user from editing server in different org', async () => {
      const response = await request(app)
        .patch(`/api/api-servers/${rioServer.id}`)
        .set('Authorization', `Bearer ${userWithPermToken}`) // HOLNG user
        .send({ name: 'Hacked RIO Server' });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/organization|permission/i);

      // Verify server name unchanged
      const server = await prisma.apiServer.findUnique({ where: { id: rioServer.id } });
      expect(server.name).toBe('RIO Server');
    });

    it('should prevent user from deleting server in different org', async () => {
      const response = await request(app)
        .delete(`/api/api-servers/${rioServer.id}`)
        .set('Authorization', `Bearer ${userWithPermToken}`);

      expect(response.status).toBe(403);

      // Verify server still exists
      const server = await prisma.apiServer.findUnique({ where: { id: rioServer.id } });
      expect(server).not.toBeNull();
    });

    it('should allow user to edit server in their own org', async () => {
      const response = await request(app)
        .patch(`/api/api-servers/${holngServer.id}`)
        .set('Authorization', `Bearer ${userWithPermToken}`)
        .send({ name: 'Updated HOLNG Server' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated HOLNG Server');
    });
  });

  describe('ATTACK-API-003: Organization Suspension Cascading', () => {
    it('should prevent API server test when organization suspended', async () => {
      // Suspend organization
      await prisma.organization.update({
        where: { id: holngOrg.id },
        data: { serviceStatus: 'suspended' }
      });

      const response = await request(app)
        .post(`/api/api-servers/${holngServer.id}/test`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/suspended|cannot test/i);

      // Reactivate for other tests
      await prisma.organization.update({
        where: { id: holngOrg.id },
        data: { serviceStatus: 'active' }
      });
    });

    it('should allow API server test when organization active', async () => {
      const response = await request(app)
        .post(`/api/api-servers/${holngServer.id}/test`)
        .set('Authorization', `Bearer ${userWithPermToken}`);

      expect([200, 500]).toContain(response.status); // 200 if test succeeds, 500 if connection fails
      // As long as NOT 403, the authorization passed
    });

    it('should preserve API servers when organization suspended', async () => {
      // Suspend organization
      await prisma.organization.update({
        where: { id: holngOrg.id },
        data: { serviceStatus: 'suspended' }
      });

      // Verify servers still exist
      const servers = await prisma.apiServer.findMany({
        where: { organizationId: holngOrg.id }
      });
      expect(servers.length).toBeGreaterThan(0);

      // Reactivate
      await prisma.organization.update({
        where: { id: holngOrg.id },
        data: { serviceStatus: 'active' }
      });
    });
  });

  describe('ATTACK-API-004: External Organization Protection', () => {
    it('should prevent deletion of PEMS-managed organization', async () => {
      // Create API servers for PEMS org
      const pemsServers = await Promise.all([
        createApiServer({ organizationId: pemsOrg.id, name: 'PEMS Server 1' }),
        createApiServer({ organizationId: pemsOrg.id, name: 'PEMS Server 2' })
      ]);

      const response = await request(app)
        .delete(`/api/organizations/${pemsOrg.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Cannot delete PEMS-managed organization');
      expect(response.body.recommendation).toContain('Suspend or unlink instead');

      // Verify org still exists
      const org = await prisma.organization.findUnique({ where: { id: pemsOrg.id } });
      expect(org).not.toBeNull();

      // Cleanup
      await prisma.apiServer.deleteMany({ where: { id: { in: pemsServers.map(s => s.id) } } });
    });

    it('should allow deletion of local organization with cascading', async () => {
      // Create API servers + endpoints for local org
      const server1 = await createApiServer({ organizationId: localOrg.id, name: 'Local Server 1' });
      const server2 = await createApiServer({ organizationId: localOrg.id, name: 'Local Server 2' });

      await prisma.apiEndpoint.createMany({
        data: [
          { serverId: server1.id, name: 'Endpoint 1', method: 'GET', path: '/test1' },
          { serverId: server1.id, name: 'Endpoint 2', method: 'POST', path: '/test2' },
          { serverId: server2.id, name: 'Endpoint 3', method: 'GET', path: '/test3' }
        ]
      });

      const response = await request(app)
        .delete(`/api/organizations/${localOrg.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Verify cascading delete
      const org = await prisma.organization.findUnique({ where: { id: localOrg.id } });
      expect(org).toBeNull();

      const servers = await prisma.apiServer.findMany({ where: { organizationId: localOrg.id } });
      expect(servers.length).toBe(0);

      const endpoints = await prisma.apiEndpoint.findMany({
        where: { serverId: { in: [server1.id, server2.id] } }
      });
      expect(endpoints.length).toBe(0);
    });

    it('should preserve API servers when unlinking external org', async () => {
      // Create server for PEMS org
      const server = await createApiServer({ organizationId: pemsOrg.id, name: 'PEMS Test Server' });

      // Unlink organization (convert to local)
      const response = await request(app)
        .post(`/api/organizations/${pemsOrg.id}/unlink`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ confirmationToken: 'valid-token' });

      expect(response.status).toBe(200);

      // Verify org became local
      const org = await prisma.organization.findUnique({ where: { id: pemsOrg.id } });
      expect(org.isExternal).toBe(false);

      // Verify API server preserved
      const preservedServer = await prisma.apiServer.findUnique({ where: { id: server.id } });
      expect(preservedServer).not.toBeNull();

      // Cleanup
      await prisma.apiServer.delete({ where: { id: server.id } });

      // Restore external flag
      await prisma.organization.update({
        where: { id: pemsOrg.id },
        data: { isExternal: true }
      });
    });
  });

  describe('ATTACK-API-005: Credentials Exposure', () => {
    it('should mask sensitive credentials in API response', async () => {
      const response = await request(app)
        .get(`/api/api-servers/${holngServer.id}`)
        .set('Authorization', `Bearer ${userWithPermToken}`);

      expect(response.status).toBe(200);

      // Verify credentials masked
      if (response.body.credentials) {
        expect(response.body.credentials.bearerToken).toBe('***masked***');
        expect(response.body.credentials).not.toContain('secret-token-123');
      }

      // Or credentials field entirely omitted
      const jsonString = JSON.stringify(response.body);
      expect(jsonString).not.toContain('secret-token-123');
    });

    it('should mask credentials in list response', async () => {
      const response = await request(app)
        .get('/api/api-servers')
        .set('Authorization', `Bearer ${userWithPermToken}`);

      expect(response.status).toBe(200);
      const server = response.body.find((s: any) => s.id === holngServer.id);

      if (server.credentials) {
        expect(server.credentials.bearerToken).toBe('***masked***');
      }

      const jsonString = JSON.stringify(response.body);
      expect(jsonString).not.toContain('secret-token-123');
      expect(jsonString).not.toContain('secret-pass');
    });
  });

  describe('ATTACK-API-006: Permission Re-Check on Submit', () => {
    it('should re-check permission even if modal opened before revocation', async () => {
      // User loads edit modal (permission check passes)
      let response = await request(app)
        .get(`/api/api-servers/${holngServer.id}`)
        .set('Authorization', `Bearer ${userWithPermToken}`);
      expect(response.status).toBe(200);

      // Admin revokes perm_ManageSettings mid-session
      await prisma.user.update({
        where: { id: userWithPermUser.id },
        data: {
          capabilities: { canViewOrgData: true, perm_ManageSettings: false }
        }
      });

      // User submits edit form (permission re-checked)
      response = await request(app)
        .patch(`/api/api-servers/${holngServer.id}`)
        .set('Authorization', `Bearer ${userWithPermToken}`)
        .send({ name: 'Attempted Edit' });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('perm_ManageSettings');

      // Verify server name unchanged
      const server = await prisma.apiServer.findUnique({ where: { id: holngServer.id } });
      expect(server.name).toBe('Updated HOLNG Server'); // From earlier test

      // Restore permission
      await prisma.user.update({
        where: { id: userWithPermUser.id },
        data: {
          capabilities: { canViewOrgData: true, perm_ManageSettings: true }
        }
      });
    });
  });

  describe('ATTACK-API-007: Multi-Tenant Isolation', () => {
    it('should only show servers from user allowed organizations', async () => {
      const response = await request(app)
        .get('/api/api-servers')
        .set('Authorization', `Bearer ${userWithPermToken}`);

      expect(response.status).toBe(200);
      expect(response.body.every((s: any) => s.organizationId === holngOrg.id)).toBe(true);
      expect(response.body.every((s: any) => s.organizationId !== rioOrg.id)).toBe(true);
    });

    it('should update server list on org context switch', async () => {
      // Create multi-org user
      const multiOrgUser = await createUser({
        username: 'multi-org',
        email: 'multi-org@test.com',
        organizationId: holngOrg.id,
        allowedOrganizationIds: [holngOrg.id, rioOrg.id],
        role: 'Field Engineer',
        capabilities: { perm_ManageSettings: true }
      });
      const multiOrgToken = await loginAs('multi-org', 'password');

      // Get HOLNG servers
      let response = await request(app)
        .get(`/api/api-servers?organizationId=${holngOrg.id}`)
        .set('Authorization', `Bearer ${multiOrgToken}`);
      expect(response.body.every((s: any) => s.organizationId === holngOrg.id)).toBe(true);

      // Switch context to RIO
      await request(app)
        .post('/api/users/switch-context')
        .set('Authorization', `Bearer ${multiOrgToken}`)
        .send({ organizationId: rioOrg.id });

      // Get RIO servers
      response = await request(app)
        .get(`/api/api-servers?organizationId=${rioOrg.id}`)
        .set('Authorization', `Bearer ${multiOrgToken}`);
      expect(response.body.every((s: any) => s.organizationId === rioOrg.id)).toBe(true);

      // Cleanup
      await prisma.user.delete({ where: { id: multiOrgUser.id } });
    });
  });
});
```

### 2. Security Audit Report

Create `docs/security/API_SERVER_SECURITY_AUDIT.md`:

```markdown
# API Server Security Audit Report

**Audit Date**: [Current Date]
**Auditor**: ai-security-red-teamer
**System**: PFA Vanguard API Server Management
**Scope**: ADR-005 API Server Authorization & Protection

---

## Executive Summary

**Total Attack Vectors Tested**: 7 categories, 18 test scenarios
**Critical Vulnerabilities Found**: [To be filled]
**Authorization Bypasses**: [To be filled]
**Credentials Exposure**: [To be filled]
**Overall Security Rating**: [To be determined]

---

## Attack Vector Analysis

### 1. Permission Bypass (ATTACK-API-001)
**Status**: [PASS/FAIL]
**Risk Level**: CRITICAL
**Test Results**:
- Create without permission: [Result]
- Create with permission: [Result]

**Findings**:
[Document if unauthorized users can create API servers]

**Remediation** (if needed):
- Ensure `requirePermission('perm_ManageSettings')` guards all CRUD endpoints

---

### 2. Cross-Organization Access (ATTACK-API-002)
**Status**: [PASS/FAIL]
**Risk Level**: CRITICAL
**Test Results**:
- Cross-org edit: [Result]
- Cross-org delete: [Result]

**Findings**:
[Document if cross-org access possible]

**Remediation** (if needed):
- Add `requireApiServerPermission` middleware
- Verify `apiServer.organizationId IN user.allowedOrganizationIds`

---

### 3. Organization Suspension Cascading (ATTACK-API-003)
**Status**: [PASS/FAIL]
**Risk Level**: HIGH
**Test Results**:
- Suspended org test blocked: [Result]
- Active org test allowed: [Result]
- Servers preserved during suspension: [Result]

**Findings**:
[Document if suspended org servers remain functional]

**Remediation** (if needed):
- Check org status before test: `if (org.serviceStatus === 'suspended') throw 403`

---

### 4. External Organization Protection (ATTACK-API-004)
**Status**: [PASS/FAIL]
**Risk Level**: HIGH
**Test Results**:
- PEMS org delete blocked: [Result]
- Local org delete cascading: [Result]
- Servers preserved during unlink: [Result]

**Findings**:
[Document if PEMS orgs can be deleted]

**Remediation** (if needed):
- Prevent deletion: `if (org.isExternal) throw 403`
- Suggest suspend/unlink alternative

---

### 5. Credentials Exposure (ATTACK-API-005)
**Status**: [PASS/FAIL]
**Risk Level**: CRITICAL
**Test Results**:
- Single server credentials masked: [Result]
- List response credentials masked: [Result]

**Findings**:
[Document if credentials leaked in responses]

**Remediation** (if needed):
- Mask credentials before sending: `credentials.bearerToken = '***masked***'`
- OR omit credentials field entirely from GET responses

---

### 6. Permission Re-Check on Submit (ATTACK-API-006)
**Status**: [PASS/FAIL]
**Risk Level**: MEDIUM
**Test Results**:
- Revoked permission blocks submit: [Result]

**Findings**:
[Document delay between permission revocation and enforcement]

**Remediation** (if needed):
- Re-check permissions on every mutating request
- Reduce token TTL to <1 hour

---

### 7. Multi-Tenant Isolation (ATTACK-API-007)
**Status**: [PASS/FAIL]
**Risk Level**: HIGH
**Test Results**:
- Server list filtering: [Result]
- Context switch updates list: [Result]

**Findings**:
[Document if servers leak across organizations]

**Remediation** (if needed):
- Filter: `WHERE organizationId IN (user.allowedOrganizationIds)`

---

## API Server Security Checklist

- [ ] All 18 test scenarios passing
- [ ] No critical authorization bypasses found
- [ ] perm_ManageSettings required for all CRUD operations
- [ ] Cross-organization access prevented
- [ ] Suspended org connections disabled
- [ ] PEMS organizations cannot be deleted
- [ ] Cascading delete works for local organizations
- [ ] Credentials masked in all responses
- [ ] Permission re-checked on every request
- [ ] Multi-tenant isolation enforced

---

## Recommendations

### Immediate Actions (P0)
1. [List critical fixes]

### High Priority (P1)
1. [List high-priority improvements]

---

## Appendix: Test Execution Log

[Paste test output]
```

## Success Criteria

✅ **Task Complete When**:
1. All 18 API server security tests implemented
2. All tests passing OR vulnerabilities documented
3. Security audit report generated
4. Remediation guide created for any findings
5. Cascading security validated

## Validation Steps

```bash
# Run API server security tests
cd backend
npm run test:integration -- apiServerAuthorization.test.ts

# Verify permission enforcement
npm run test:security -- apiServerAuthorization.test.ts --verbose

# Manual verification
# 1. Login as user without perm_ManageSettings
# 2. Try to create API server
# 3. Verify 403 Forbidden response

# Check audit report
cat docs/security/API_SERVER_SECURITY_AUDIT.md | grep "Critical Vulnerabilities Found:"
```

## References

- **Test Plan**: ADR-005-TEST_PLAN.md lines 265-376 (API Server Authorization Tests)
- **Implementation**: ADR-005-IMPLEMENTATION_PLAN.md Phase 2 (Authorization Middleware)
- **UX Spec**: ADR-005-UX_SPEC.md Use Case 3 (API Connectivity)

---

**Estimated Time**: 3 hours
**Dependencies**: Phase 9 complete (API Server Management implemented)
**Blocker Risk**: NONE
**Agent Handoff**: → Task 10A.5 (JWT Tampering) OR Phase 10B (QA Testing)
```

---

## 🎯 Phase 10A Summary

**Total Duration**: 1.5 days (12 hours)
**Total Tasks**: 6 (4 in this file + 2 in PHASE_10_PROMPT_BUNDLES.md)
**Agent**: ai-security-red-teamer (all tasks)

**Critical Outputs**:
1. Privilege escalation test suite (18 scenarios)
2. IDOR/multi-tenant isolation tests (21 scenarios)
3. Financial masking bypass tests (15 scenarios)
4. API server authorization tests (18 scenarios)
5. JWT tampering tests (6 scenarios) - in PHASE_10_PROMPT_BUNDLES.md
6. Rate limiting tests (8 scenarios) - in PHASE_10_PROMPT_BUNDLES.md

**Total Test Coverage**: 86 security test scenarios

**Success Criteria for Phase 10A**:
- ✅ All 86 test scenarios implemented
- ✅ All tests passing OR vulnerabilities documented with remediation plans
- ✅ 4 security audit reports generated
- ✅ Automated regression test suite integrated into CI/CD
- ✅ Security compliance checklist completed
- ✅ No critical vulnerabilities found OR all critical vulnerabilities fixed

---

**Next Phase**: Phase 10B (QA Testing) - See PHASE_10_PROMPT_BUNDLES.md

**Document Created**: [Current Date]
**Last Updated**: [Current Date]
**Version**: 1.0
