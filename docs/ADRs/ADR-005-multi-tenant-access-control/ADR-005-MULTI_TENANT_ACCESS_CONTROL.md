# ADR-005: Multi-Tenant Access Control Architecture

**Status**: Proposed
**Date**: 2025-11-26
**Deciders**: Development Team
**Related**: ADR-004 (3-Tier Hybrid Architecture), Phase 1-3 (PostgreSQL Migration)

---

## Context and Problem Statement

PFA Vanguard needs a robust multi-tenant access control system that supports:

1. **Organization-Level Service Control**: Ability to disable/enable organizations to control PEMS data sync
2. **User-Level Service Control**: Ability to disable/enable user accounts independently
3. **Granular Permissions**: Read-only vs. read-write access per user per organization
4. **Shared vs. Dedicated Resources**:
   - PEMS API: One global configuration syncing data for all active organizations
   - AI API: Can be configured per-organization OR shared across organizations
5. **Efficient Sync**: Only sync data for organizations marked as "in service"

**Current Limitations**:
- No organization service status tracking
- No user service status tracking beyond `isActive` flag
- No per-organization permission model
- No distinction between read-only and read-write access
- PEMS sync attempts all organizations regardless of status

---

## Decision Drivers

### Business Requirements
- **Cost Control**: Don't sync data for inactive organizations (reduces API calls)
- **Security**: Disable user access immediately when needed
- **Compliance**: Audit trail of who can modify data
- **Flexibility**: Some users need multi-organization access with varying permissions

### Technical Requirements
- **Performance**: Filter organizations efficiently during sync
- **Scalability**: Support 28+ organizations with 100+ users
- **Maintainability**: Clear permission model easy to understand
- **Backward Compatibility**: Existing users/orgs must continue working

---

## Considered Options

### Option 1: Simple Boolean Flags (Current State)
**Pros**: Simple, already exists
**Cons**: No granular permissions, no per-org access control

### Option 2: Role-Based Access Control (RBAC) with Organization Context
**Pros**: Industry standard, flexible, auditable
**Cons**: More complex, requires migration

### Option 3: Attribute-Based Access Control (ABAC)
**Pros**: Most flexible
**Cons**: Overly complex for current needs, hard to debug

---

## Decision Outcome

**Chosen Option**: **Option 2 - Role-Based Access Control (RBAC) with Organization Context**

Implement a multi-tenant RBAC system with:

### 1. Organization Service Status

```prisma
model Organization {
  id          String   @id @default(cuid())
  code        String   @unique
  name        String

  // Service Control
  isActive    Boolean  @default(true)  // Existing field
  serviceStatus String @default("active") // New: active, suspended, archived

  // Sync Control
  enableSync  Boolean  @default(true)  // New: Control PEMS sync
  lastSyncAt  DateTime?

  // Metadata
  suspendedAt DateTime?
  suspendedBy String?
  suspensionReason String?

  // Relations
  users       UserOrganization[]
  pfaRecords  PfaRecord[]
  apiCredentials OrganizationApiCredentials[]
}
```

**Service Status States**:
- `active`: Normal operation, sync enabled
- `suspended`: Temporarily disabled, no sync, users can't login
- `archived`: Permanently disabled, read-only historical access

### 2. User Service Status

```prisma
model User {
  id          String   @id @default(cuid())
  username    String   @unique
  email       String   @unique

  // Service Control
  isActive    Boolean  @default(true)  // Existing field
  serviceStatus String @default("active") // New: active, suspended, locked

  // Account Status
  suspendedAt DateTime?
  suspendedBy String?  // User ID who suspended this account
  suspensionReason String?
  lastLoginAt DateTime?

  // Relations
  organizations UserOrganization[]
}
```

**Service Status States**:
- `active`: Normal operation
- `suspended`: Temporarily disabled (HR action, security concern)
- `locked`: Security lockout (too many failed logins)

### 3. User-Organization Permissions

```prisma
model UserOrganization {
  id             String   @id @default(cuid())
  userId         String
  organizationId String

  // Permission Model
  role           String   @default("viewer") // viewer, editor, admin

  // Granular Permissions
  canRead        Boolean  @default(true)
  canWrite       Boolean  @default(false)
  canDelete      Boolean  @default(false)
  canManageUsers Boolean  @default(false)
  canSync        Boolean  @default(false)

  // Status
  isActive       Boolean  @default(true)
  grantedAt      DateTime @default(now())
  grantedBy      String?  // User ID who granted access
  revokedAt      DateTime?
  revokedBy      String?

  // Relations
  user           User         @relation(fields: [userId], references: [id])
  organization   Organization @relation(fields: [organizationId], references: [id])

  @@unique([userId, organizationId])
  @@index([userId, isActive])
  @@index([organizationId, isActive])
}
```

**Predefined Roles**:
- `viewer`: Read-only access (canRead=true, all others=false)
- `editor`: Read-write access (canRead=true, canWrite=true, canDelete=false)
- `admin`: Full access (all permissions=true)

### 4. PEMS API Sync Logic

```typescript
// Only sync organizations that are:
// 1. Active (isActive = true)
// 2. In service (serviceStatus = 'active')
// 3. Sync enabled (enableSync = true)
const organizationsToSync = await prisma.organization.findMany({
  where: {
    isActive: true,
    serviceStatus: 'active',
    enableSync: true,
  },
});
```

### 5. AI API Configuration

**Two Modes**:

**Mode 1: Shared AI Provider** (most common)
- One AI provider configuration (e.g., Gemini API key)
- Used by multiple organizations
- Tracked via `OrganizationAiConfig` table

**Mode 2: Dedicated AI Provider** (per-organization)
- Each organization has its own AI API key
- Isolated billing and rate limits
- Linked via `organizationId` in `OrganizationAiConfig`

```prisma
model OrganizationAiConfig {
  id             String   @id @default(cuid())
  organizationId String?  // NULL = shared, non-NULL = dedicated
  providerId     String   // Links to global AiProvider

  // Credentials (organization-specific)
  apiKey         String?  // Encrypted
  endpoint       String?

  // Usage Limits
  dailyTokenLimit   Int?
  monthlyTokenLimit Int?

  // Status
  isActive       Boolean  @default(true)

  @@unique([organizationId, providerId])
}
```

---

## Authorization Flow

### Login Flow
```typescript
1. User enters credentials
2. Backend validates username + password
3. Check user.serviceStatus === 'active' && user.isActive === true
4. If suspended: Return "Account suspended" error
5. Load user's organizations via UserOrganization table
6. Filter organizations where:
   - organization.serviceStatus === 'active'
   - userOrg.isActive === true
7. Return JWT with:
   - userId
   - username
   - allowedOrganizations: [{orgId, role, permissions}]
```

### API Request Flow
```typescript
1. Extract JWT token
2. Verify user.serviceStatus === 'active'
3. Extract organizationId from request
4. Verify user has access to organization:
   - UserOrganization exists
   - userOrg.isActive === true
   - organization.serviceStatus === 'active'
5. Check required permission:
   - Read operation: Require canRead=true
   - Write operation: Require canWrite=true
   - Delete operation: Require canDelete=true
6. Execute request or return 403 Forbidden
```

### Sync Worker Flow
```typescript
1. Cron triggers sync worker (every 15 minutes)
2. Query organizations where:
   - isActive = true
   - serviceStatus = 'active'
   - enableSync = true
3. For each organization:
   - Check OrganizationApiCredentials exists
   - Call PEMS API to fetch data
   - Update PfaMirror records
4. Skip suspended/archived organizations
5. Log sync results per organization
```

---

## Consequences

### Positive
✅ **Fine-Grained Access Control**: Permissions per user per organization
✅ **Efficient Sync**: Only sync active organizations, reduce API costs
✅ **Security**: Immediate account suspension capability
✅ **Compliance**: Audit trail of permissions and status changes
✅ **Scalability**: Supports multi-org users with varying roles
✅ **Flexibility**: Shared vs. dedicated AI providers per organization

### Negative
⚠️ **Migration Complexity**: Need to migrate existing users/orgs to new schema
⚠️ **Increased Queries**: Authorization checks add database queries per request
⚠️ **Frontend Changes**: UI must respect read-only permissions (disable buttons)
⚠️ **Testing Burden**: More test cases for permission combinations

### Neutral
🔄 **Breaking Change**: Existing API clients must handle new permission errors
🔄 **Documentation**: Need comprehensive permission documentation
🔄 **Admin UI**: Need UI for managing user-org relationships

---

## Implementation Roadmap

See: `docs/implementation/IMPLEMENTATION-PLAN-ACCESS-CONTROL.md`

**Phases**:
1. **Phase 1**: Database schema changes + migration (1 day)
2. **Phase 2**: Backend authorization middleware (1-2 days)
3. **Phase 3**: PEMS sync filtering (0.5 days)
4. **Phase 4**: Frontend permission enforcement (1-2 days)
5. **Phase 5**: Admin UI for user/org management (1-2 days)
6. **Phase 6**: Testing + documentation (1 day)

**Total Estimate**: 6-8 days

---

## Related Documentation

- **Implementation Plan**: `docs/implementation/IMPLEMENTATION-PLAN-ACCESS-CONTROL.md`
- **Database Schema**: `backend/prisma/schema.prisma`
- **Authorization Middleware**: `backend/src/middleware/authorize.ts` (to be created)
- **API Documentation**: `backend/docs/API_AUTHORIZATION.md` (to be created)

---

**Status**: Proposed
**Decision Date**: 2025-11-26
**Review Date**: TBD

*Document created: 2025-11-26*
*Last updated: 2025-11-26*
