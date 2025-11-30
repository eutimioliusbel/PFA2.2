# Security Remediation Checklist

**Status Tracker**: Use this checklist to track remediation progress

---

## 🔴 CRITICAL FIXES (Week 1 - BLOCKERS)

### CVE-2024-BEO-001: Add perm_ViewAllOrgs Permission

**Estimated Time**: 4 hours

- [ ] **Step 1**: Add field to schema
  ```prisma
  // backend/prisma/schema.prisma - UserOrganization model (after line 152)
  perm_ViewAllOrgs Boolean @default(false)
  ```

- [ ] **Step 2**: Create migration
  ```bash
  cd backend
  npx prisma migrate dev --name add-perm-view-all-orgs
  ```

- [ ] **Step 3**: Update auth types
  ```typescript
  // backend/src/types/auth.ts - Add to Permissions interface (after line 35)
  perm_ViewAllOrgs: boolean;
  ```

- [ ] **Step 4**: Update permission extraction
  ```typescript
  // backend/src/types/auth.ts - extractPermissions function (after line 144)
  export function extractPermissions(userOrg: any): Permissions {
    return {
      // ... existing permissions ...
      perm_ViewAllOrgs: userOrg.perm_ViewAllOrgs,
    };
  }
  ```

- [ ] **Step 5**: Update seed script
  ```typescript
  // backend/prisma/seed.ts - Grant to admin user (after line 183)
  await prisma.userOrganization.upsert({
    // ... existing fields ...
    perm_ViewAllOrgs: true, // NEW
  });
  ```

- [ ] **Step 6**: Fix controller checks
  ```typescript
  // backend/src/controllers/beoController.ts - Replace all instances
  // OLD: capabilities['perm_ViewAllOrgs']
  // NEW: permissions.perm_ViewAllOrgs

  const hasPortfolioAccess = req.user.organizations.some(
    org => org.permissions.perm_ViewAllOrgs === true
  );
  ```

- [ ] **Step 7**: Test manually
  ```bash
  # Login as admin
  curl -X POST http://localhost:3001/api/auth/login \
    -d '{"username":"admin","password":"admin123"}'

  # Should return 200 OK
  curl -X GET http://localhost:3001/api/beo/portfolio-health \
    -H "Authorization: Bearer <token>"
  ```

**Verification**:
- [ ] Migration applied successfully
- [ ] Seed script runs without errors
- [ ] Admin user has `perm_ViewAllOrgs = true` in database
- [ ] BEO endpoints return 200 OK for authorized users
- [ ] BEO endpoints return 403 for unauthorized users

---

### CVE-2024-BEO-002: Add Middleware Authorization

**Estimated Time**: 2 hours

- [ ] **Step 1**: Add middleware to BEO routes
  ```typescript
  // backend/src/routes/beoRoutes.ts - Add after line 23
  import { requirePermission } from '../middleware/requirePermission';

  router.use(authenticateJWT);
  router.use(requirePermission('perm_ViewAllOrgs')); // NEW - Applies to all routes below
  ```

- [ ] **Step 2**: Remove duplicate controller checks (optional cleanup)
  ```typescript
  // backend/src/controllers/beoController.ts
  // Can now remove the hasPortfolioAccess check since middleware handles it
  // OR keep for defense in depth
  ```

- [ ] **Step 3**: Test middleware enforcement
  ```bash
  # Attempt access without permission
  curl -X GET http://localhost:3001/api/beo/portfolio-health \
    -H "Authorization: Bearer <non_beo_token>"

  # Expected: 403 FORBIDDEN before reaching controller
  ```

**Verification**:
- [ ] Middleware blocks unauthorized requests
- [ ] 403 response from middleware, not controller
- [ ] All 10 BEO endpoints protected

---

### CVE-2024-AUTH-001: Prevent Self-Permission Modification

**Estimated Time**: 3 hours

- [ ] **Step 1**: Add self-modification check
  ```typescript
  // backend/src/controllers/userOrgController.ts
  export async function updateUserOrgPermissions(req: AuthRequest, res: Response) {
    const { userId, organizationId } = req.params;

    // NEW: Prevent self-modification
    if (userId === req.user?.userId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Cannot modify your own permissions'
      });
    }

    // ... rest of function
  }
  ```

- [ ] **Step 2**: Add privilege escalation prevention
  ```typescript
  // backend/src/controllers/userOrgController.ts - Before update
  const modifierOrg = req.user?.organizations.find(
    o => o.organizationId === organizationId
  );

  const requestedPermissions = req.body;
  for (const [key, value] of Object.entries(requestedPermissions)) {
    if (value === true && !modifierOrg?.permissions[key]) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Cannot grant permission ${key} that you don't have`
      });
    }
  }
  ```

- [ ] **Step 3**: Add audit logging
  ```typescript
  // backend/src/controllers/userOrgController.ts - After successful update
  await prisma.auditLog.create({
    data: {
      userId: req.user?.userId,
      organizationId,
      action: 'permission_modified',
      resource: `/api/user-orgs/${userId}/${organizationId}`,
      metadata: {
        targetUserId: userId,
        changedPermissions: requestedPermissions
      }
    }
  });
  ```

- [ ] **Step 4**: Test prevention
  ```bash
  # Attempt to grant self admin permissions
  curl -X PATCH http://localhost:3001/api/user-orgs/<my_user_id>/<org_id> \
    -H "Authorization: Bearer <my_token>" \
    -d '{"perm_ManageUsers": true}'

  # Expected: 403 FORBIDDEN
  ```

**Verification**:
- [ ] Self-modification blocked
- [ ] Cannot grant permissions you don't have
- [ ] Audit log entries created for permission changes
- [ ] Admin users can still modify others' permissions

---

### CVE-2024-JWT-001: Enforce JWT Algorithm

**Estimated Time**: 1 hour

- [ ] **Step 1**: Update JWT verification
  ```typescript
  // backend/src/middleware/auth.ts - Line 38
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'], // NEW - Explicitly specify allowed algorithm
  }) as JWTPayload;
  ```

- [ ] **Step 2**: Add payload validation
  ```typescript
  // backend/src/middleware/auth.ts - After decode (new lines)
  if (!decoded.userId || !decoded.username || !decoded.organizations) {
    res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Token missing required fields'
    });
    return;
  }
  ```

- [ ] **Step 3**: Log suspicious activity
  ```typescript
  // backend/src/middleware/auth.ts - In catch block
  } else if (error instanceof jwt.JsonWebTokenError) {
    // NEW: Log potential tampering
    logger.warn('Potential JWT tampering attempt', {
      error: error.message,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(401).json({ error: 'INVALID_TOKEN', message: 'Invalid token' });
  }
  ```

- [ ] **Step 4**: Test algorithm confusion attack
  ```bash
  # Create token with algorithm "none"
  # Should be rejected by server
  ```

**Verification**:
- [ ] Algorithm "none" tokens rejected
- [ ] Missing userId/username tokens rejected
- [ ] Suspicious attempts logged
- [ ] Normal tokens still work

---

### CVE-2024-IDOR-001: Enforce Organization Filtering at Query Level

**Estimated Time**: 6 hours

- [ ] **Step 1**: Audit all Prisma queries
  ```bash
  # Search for queries without organizationId filter
  grep -r "findMany" backend/src/controllers/ | grep -v "organizationId"
  ```

- [ ] **Step 2**: Fix PFA data queries
  ```typescript
  // backend/src/controllers/pfaDataController.ts
  export async function getPfaData(req: AuthRequest, res: Response) {
    const { organizationId } = req.query;

    // Validate organizationId required
    if (!organizationId) {
      return res.status(400).json({ error: 'organizationId required' });
    }

    // Authorize user has access
    const userOrg = req.user?.organizations.find(
      org => org.organizationId === organizationId
    );

    if (!userOrg) {
      return res.status(403).json({ error: 'ORG_ACCESS_DENIED' });
    }

    // CRITICAL: Filter at database level
    const records = await prisma.pfaRecord.findMany({
      where: {
        organizationId: organizationId, // Hard filter in query
      },
    });

    return res.json({ data: records });
  }
  ```

- [ ] **Step 3**: Implement Prisma middleware (optional, recommended)
  ```typescript
  // backend/src/config/database.ts
  import { PrismaClient } from '@prisma/client';
  import { AsyncLocalStorage } from 'async_hooks';

  const prisma = new PrismaClient();
  const userContext = new AsyncLocalStorage();

  // Auto-filter queries by user's allowed organizations
  prisma.$use(async (params, next) => {
    if (params.model === 'PfaRecord') {
      const user = userContext.getStore() as any;
      const allowedOrgIds = user?.organizations.map(o => o.organizationId);

      if (params.action === 'findMany' || params.action === 'findFirst') {
        params.args.where = {
          ...params.args.where,
          organizationId: { in: allowedOrgIds }
        };
      }
    }

    return next(params);
  });

  export default prisma;
  ```

- [ ] **Step 4**: Test cross-org access
  ```bash
  # User belonging to ORG1 attempts to access ORG2 data
  curl -X GET 'http://localhost:3001/api/pfa-data?organizationId=ORG2' \
    -H "Authorization: Bearer <org1_user_token>"

  # Expected: 403 FORBIDDEN
  ```

**Verification**:
- [ ] All PFA queries filter by organizationId at DB level
- [ ] Cross-org access attempts return 403
- [ ] Performance improved (no in-memory filtering)

---

### CVE-2024-FIN-001: Database-Level Financial Masking

**Estimated Time**: 4 hours

- [ ] **Step 1**: Refactor PFA data query
  ```typescript
  // backend/src/controllers/pfaDataController.ts
  export async function getPfaData(req: AuthRequest, res: Response) {
    const userOrg = req.user?.organizations.find(/* ... */);
    const hasViewFinancials = userOrg?.permissions.perm_ViewFinancials;

    // NEW: Conditional field selection
    const selectFields = {
      id: true,
      pfaId: true,
      category: true,
      class: true,
      forecastStart: true,
      forecastEnd: true,
      // Conditionally include financial fields
      monthlyRate: hasViewFinancials || false,
      purchasePrice: hasViewFinancials || false,
    };

    const records = await prisma.pfaRecord.findMany({
      where: { organizationId },
      select: selectFields // Only fetch allowed fields
    });

    // No masking needed - sensitive data not fetched
    return res.json({ data: records });
  }
  ```

- [ ] **Step 2**: Fix export function
  ```typescript
  // backend/src/controllers/exportController.ts
  export async function exportPfaData(req: AuthRequest, res: Response) {
    const hasViewFinancials = /* check permission */;

    const exportColumns = ['pfaId', 'category', 'class'];

    if (hasViewFinancials) {
      exportColumns.push('monthlyRate', 'purchasePrice');
    }

    const records = await prisma.pfaRecord.findMany({
      where: { ... },
      select: Object.fromEntries(exportColumns.map(col => [col, true]))
    });

    const csv = generateCSV(records, exportColumns);
    return res.send(csv);
  }
  ```

- [ ] **Step 3**: Test masking bypass attempts
  ```bash
  # User without perm_ViewFinancials
  curl -X GET 'http://localhost:3001/api/pfa-data?organizationId=X' \
    -H "Authorization: Bearer <viewer_token>"

  # Response should NOT contain monthlyRate or purchasePrice fields

  # Test export
  curl -X POST http://localhost:3001/api/pfa-data/export \
    -H "Authorization: Bearer <viewer_token>" \
    -d '{"organizationId":"X","format":"csv"}'

  # CSV should NOT contain financial columns
  ```

**Verification**:
- [ ] Users without permission never receive financial fields
- [ ] Export respects financial masking
- [ ] No bypass via API parameters

---

## 🟠 HIGH PRIORITY FIXES (Week 2)

### CVE-2024-API-001: Prevent API Credential Exposure

- [ ] Add explicit `select` to API server queries
- [ ] Implement credential preview (last 4 characters only)
- [ ] Test: Credentials not in API responses

### CVE-2024-INJ-001: SQL Injection Prevention

- [ ] Replace `$queryRaw` with Prisma query builder
- [ ] Add input validation for vendor names
- [ ] Test: SQL injection payloads rejected

### CVE-2024-JWT-002: Token Revocation

- [ ] Set up Redis for token blacklist
- [ ] Implement logout endpoint with blacklisting
- [ ] Add user active status check in JWT middleware
- [ ] Test: Revoked tokens rejected

---

## 🟡 MEDIUM PRIORITY (Week 3)

### Enhanced Rate Limiting

- [ ] Implement tiered rate limits (standard, AI, expensive)
- [ ] Add `Retry-After` headers to 429 responses
- [ ] Add AI cost tracking

---

## 📋 Final Checklist

**Before Production Deployment**:

- [ ] All CRITICAL fixes completed (6 items)
- [ ] All HIGH priority fixes completed (3 items)
- [ ] Automated security test suite passing (34 tests)
- [ ] Manual penetration testing conducted
- [ ] AI prompt injection testing conducted
- [ ] External security audit completed
- [ ] Security monitoring configured
- [ ] Incident response plan documented

**Current Progress**: 0 / 42 items completed

---

## 🧪 Testing After Each Fix

```bash
# Run automated security tests
cd backend
npm test -- tests/security/securityAudit.test.ts

# Expected: All tests passing (34/34)
```

---

**Last Updated**: 2025-11-27
**Next Review**: After Critical fixes complete
