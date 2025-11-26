# ADR-005: Multi-Tenant Access Control Architecture

**Status**: Proposed (Scope Expanded)
**Date**: 2025-11-26
**Last Updated**: 2025-11-26
**Deciders**: Development Team
**Related**: ADR-004 (3-Tier Hybrid Architecture), Phase 1-3 (PostgreSQL Migration)

---

## Context and Problem Statement

PFA Vanguard needs a **state-of-the-art enterprise access control system** that supports:

### Core Access Control Requirements

1. **Hybrid Role-Override Architecture**: Admins can create reusable role templates (e.g., "Project Manager") but override specific permissions for individual users
2. **Financial Data Masking**: Restrict cost/budget visibility for certain users (compliance requirement)
3. **Temporal Access for Contractors**: Auto-expire access after contract end date
4. **SysAdmin Impersonation Mode**: Admins can "view as" any user for troubleshooting (with full audit trail)
5. **Session Management & Kill Switch**: Revoke active sessions in real-time (security requirement)
6. **Granular Permissions**: 14 permission flags organized in 5 categories:
   - **Data Scope**: perm_Read, perm_EditForecast, perm_EditActuals, perm_Delete
   - **Data Operations**: perm_Import, perm_RefreshData, perm_Export
   - **Financials**: perm_ViewFinancials
   - **Process**: perm_SaveDraft, perm_Sync
   - **Admin**: perm_ManageUsers, perm_ManageSettings, perm_ConfigureAlerts, perm_Impersonate
7. **System-Level Access (BEO Mode)**: Business executives need portfolio oversight across all organizations without individual assignments
8. **Legacy Import with AI**: Migrate PFA 1.0 data with AI-powered structural recommendations

### Governance & Compliance Requirements (Enterprise-Grade)

9. **Immutable Audit Ledger ("The Black Box")**: Forensic-grade change tracking with before/after diffs, user justification, and batch transaction support for compliance and accountability
10. **Personal Access Tokens (PATs)**: User-generated API keys for integrations (Excel, PowerBI, scripts) scoped to their permissions without exposing login credentials
11. **Secure Invitation Lifecycle**: Token-based invitation flow with email magic links, expiration, and status tracking to prevent unauthorized access
12. **Data Retention & Soft Delete**: Enterprise-grade soft delete with 30-day recovery window and admin "Trash Can" view to prevent accidental data loss
13. **Pre-Flight Review & Comment System**: Mandatory change impact preview and justification before syncing to PEMS to ensure audit trail and prevent mistakes
14. **Revert/Undo Capability (Time Travel)**: Compensating transactions using audit log history to rollback mistaken changes synced to PEMS

### Communication & Integration

15. **Multi-Channel Notification System**: Email, In-App, SMS, Slack, Teams with smart batching and quiet hours
16. **Organization-Level Service Control**: Disable/enable organizations to control PEMS data sync
17. **User-Level Service Control**: Disable/enable user accounts independently
18. **Hybrid Source of Truth & Identity**: The system must support entities sourced from PEMS (HxGN EAM) while maintaining local flexibility.
   - **Hybrid Identity**: Users may be sourced from PEMS (`authProvider='pems'`) but retain a local password hash for hybrid authentication (`passwordHash` is nullable but often populated).
   - **Hybrid Tenancy**: Organizations may be synced from PEMS. These are "External" records where core identity fields (Code, Name) are read-only locally, but settings are writable.
   - **Hybrid Access**: User assignments can be dictated by PEMS sync (`assignmentSource='pems_sync'`) or granted locally (`assignmentSource='local'`).

**Current Limitations**:
- No role template system (permissions hardcoded per user)
- No financial masking (all users see cost data)
- No temporal access expiration
- No impersonation mode for troubleshooting
- No session management or kill switch
- No immutable audit log (simple `updatedBy` columns insufficient for forensics)
- No personal access token support (users share passwords for API integrations)
- No secure invitation flow (manual user creation exposes passwords)
- No soft delete (data loss risk, audit trail broken)
- No pre-flight review (users sync changes without seeing impact)
- No revert capability (mistaken syncs cannot be undone)
- No notification system
- No organization service status tracking
- No per-organization permission model
- PEMS sync attempts all organizations regardless of status

---

## Decision Drivers

### Business Requirements
- **Cost Control**: Don't sync data for inactive organizations (reduces API calls)
- **Security**: Disable user access immediately when needed, revoke active sessions
- **Compliance**: Audit trail of who can modify data, mask financial data for restricted users
- **Flexibility**: Some users need multi-organization access with varying permissions
- **Contractor Management**: Auto-expire access for temporary workers
- **Troubleshooting**: SysAdmins need to "view as" users without password sharing
- **Communication**: Users need timely notifications across multiple channels

### Technical Requirements
- **Performance**: Filter organizations efficiently during sync, authorization overhead <50ms per request
- **Scalability**: Support 28+ organizations with 100+ users, notification system handles 10K+ events/day
- **Maintainability**: Clear permission model easy to understand, role templates reduce repetition
- **Backward Compatibility**: Existing users/orgs must continue working
- **Real-Time**: Session revocation takes effect <1 second, notifications delivered within 60 seconds
- **AI-Ready**: Data hooks for future AI-powered permission suggestions and anomaly detection

---

## Considered Options

### Option 1: Simple Role Enum (Rejected - Original Plan)
**Description**: Hardcode 3 roles (viewer, editor, admin) with fixed permissions per user.

**Pros**: Simple, easy to implement
**Cons**:
- No role reusability (admin recreates "Project Manager" permissions for every new PM)
- No permission overrides (can't narrow down a template for specific users)
- No financial masking (all admins see all financial data)
- No temporal access (manual cleanup required)
- No notification system
- Not scalable for enterprise use cases

**Why Rejected**: Insufficient flexibility for enterprise requirements. Does not support financial masking, temporal access, or role templates.

---

### Option 2: Template-Instance Pattern with Hybrid Override (Chosen)
**Description**: Admins create `OrganizationRole` templates (e.g., "Project Manager", "Contractor", "Financial Analyst"). When assigning a user, the system copies the template's permissions to a `UserOrganization` instance. Admins can then **narrow down** permissions (uncheck specific flags) for individual users. The `isCustom` flag tracks whether permissions deviate from the template.

**Pros**:
- ✅ **Role Reusability**: Create "Project Manager" template once, assign to 50 users
- ✅ **Permission Override**: Admin can uncheck "canDelete" for specific users
- ✅ **Financial Masking**: `perm_ViewFinancials` flag controls cost data visibility
- ✅ **Temporal Access**: `accessExpiresAt` field enables auto-expiration
- ✅ **Bulk Updates**: Update template → system propagates to all non-custom users
- ✅ **Audit Trail**: Track `isCustom`, `grantedBy`, `grantedAt`, `modifiedBy`, `modifiedAt`
- ✅ **Scalability**: Supports 28+ organizations with 100+ users

**Cons**:
- ⚠️ **Migration Complexity**: Need to migrate existing users to template-instance model
- ⚠️ **UI Complexity**: Admin UI must show "template vs. instance" comparison
- ⚠️ **Conflict Resolution**: What happens when template is updated and user has `isCustom=true`?

**Implementation**:
```prisma
model OrganizationRole {
  id             String   @id @default(cuid())
  organizationId String
  name           String   // "Project Manager", "Contractor", "Financial Analyst"
  description    String?

  // 1. Data Scope (The "What")
  perm_Read               Boolean  @default(true)
  perm_EditForecast       Boolean  @default(false) // Edit Forecast Start/End/Qty
  perm_EditActuals        Boolean  @default(false) // Edit Actual Start/End
  perm_Delete             Boolean  @default(false) // Hard delete capability

  // 2. Data Operations (The "How")
  perm_Import             Boolean  @default(false) // Upload CSV/Excel to import data
  perm_RefreshData        Boolean  @default(false) // Trigger manual PEMS sync
  perm_Export             Boolean  @default(false) // Export data to Excel/CSV

  // 3. Financials (The "Mask")
  perm_ViewFinancials     Boolean  @default(false)

  // 4. Process (The "How")
  perm_SaveDraft          Boolean  @default(false) // Sandbox access
  perm_Sync               Boolean  @default(false) // PEMS Commit access

  // 5. Admin (The "Who")
  perm_ManageUsers        Boolean  @default(false) // Delegated Admin
  perm_ManageSettings     Boolean  @default(false) // Org Settings
  perm_ConfigureAlerts    Boolean  @default(false) // Notification triggers
  perm_Impersonate        Boolean  @default(false) // SysAdmin only

  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  createdBy      String   // User ID who created this template

  @@unique([organizationId, name])
}

model UserOrganization {
  id             String   @id @default(cuid())
  userId         String
  organizationId String
  roleTemplateId String?  // Links to OrganizationRole (NULL for legacy users)

  // 1. Data Scope (The "What")
  perm_Read               Boolean  @default(true)
  perm_EditForecast       Boolean  @default(false) // Edit Forecast Start/End/Qty
  perm_EditActuals        Boolean  @default(false) // Edit Actual Start/End
  perm_Delete             Boolean  @default(false) // Hard delete capability

  // 2. Data Operations (The "How")
  perm_Import             Boolean  @default(false) // Upload CSV/Excel to import data
  perm_RefreshData        Boolean  @default(false) // Trigger manual PEMS sync
  perm_Export             Boolean  @default(false) // Export data to Excel/CSV

  // 3. Financials (The "Mask")
  perm_ViewFinancials     Boolean  @default(false)

  // 4. Process (The "How")
  perm_SaveDraft          Boolean  @default(false) // Sandbox access
  perm_Sync               Boolean  @default(false) // PEMS Commit access

  // 5. Admin (The "Who")
  perm_ManageUsers        Boolean  @default(false) // Delegated Admin
  perm_ManageSettings     Boolean  @default(false) // Org Settings
  perm_ConfigureAlerts    Boolean  @default(false) // Notification triggers
  perm_Impersonate        Boolean  @default(false) // SysAdmin only

  // Override Tracking
  isCustom       Boolean  @default(false) // TRUE if permissions differ from template

  // Temporal Access (for Contractors)
  accessExpiresAt DateTime?  // NULL = permanent, set = auto-expire at this date

  // Audit Trail
  grantedAt      DateTime @default(now())
  grantedBy      String?  // User ID who granted access
  modifiedAt     DateTime?
  modifiedBy     String?  // User ID who last modified permissions
  revokedAt      DateTime?
  revokedBy      String?

  @@unique([userId, organizationId])
  @@index([userId, isActive])
  @@index([organizationId, isActive])
  @@index([accessExpiresAt]) // Fast query for expired access cleanup
}
```

**Why Chosen**: Balances flexibility with maintainability. Supports all enterprise requirements (financial masking, temporal access, role reusability, permission overrides) while remaining understandable for admins.

---

### Option 3: Attribute-Based Access Control (ABAC) (Rejected)
**Description**: Define policies like "IF user.department = 'Finance' AND resource.costCenter = user.costCenter THEN ALLOW".

**Pros**:
- Maximum flexibility
- Policy-driven (easier to change rules without schema changes)

**Cons**:
- ❌ **Overly Complex**: Requires policy engine (e.g., Open Policy Agent)
- ❌ **Hard to Debug**: "Why can't user X access resource Y?" requires policy trace analysis
- ❌ **Performance**: Policy evaluation adds latency (50-200ms per request)
- ❌ **Overkill**: PFA Vanguard doesn't need dynamic policies (permissions are relatively static)

**Why Rejected**: Too complex for current requirements. Future consideration if policy-driven rules become necessary.

---

### Option 4: JWT-Only Authorization (Rejected)
**Description**: Embed all permissions in JWT token claims, no database lookups.

**Pros**:
- Fast (no database queries)
- Stateless (good for horizontal scaling)

**Cons**:
- ❌ **Stale Permissions**: Token issued at 9am with "canWrite", user suspended at 10am, token still valid until expiration (could be hours/days)
- ❌ **No Real-Time Revocation**: Can't implement session kill switch
- ❌ **Large Tokens**: 8 permissions × 28 organizations = 224 boolean claims → token size bloat
- ❌ **No Audit Trail**: Can't track "who granted permission" or "when was permission revoked"

**Why Rejected**: Incompatible with real-time session revocation and audit trail requirements.

---

## Complete Data Model

This section consolidates **all database schemas** for the Multi-Tenant Access Control system. Each table is organized by functional category.

---

### 1. Core Identity

#### User Table

```prisma
model User {
  id          String   @id @default(cuid())
  username    String   @unique
  email       String   @unique

  // Hybrid Auth: Nullable because pure SSO users might not have one,
  // but Hybrid PEMS users WILL have one.
  passwordHash      String?

  // Identity Source
  externalId        String?  @unique // PEMS User ID (e.g., "10345")
  authProvider      String   @default("local") // "local", "pems"

  // Service Control
  isActive    Boolean  @default(true)
  serviceStatus String @default("active") // active, suspended, locked

  // Account Status
  suspendedAt DateTime?
  suspendedBy String?  // User ID who suspended this account
  suspensionReason String?
  lastLoginAt DateTime?

  // Failed Login Tracking (for account locking)
  failedLoginCount Int @default(0)
  lockedAt DateTime?

  // UI Preferences (NEW - Config Bag Pattern)
  // Stores: { "theme": "dark", "language": "en", "timezone": "America/New_York", "grid_density": "compact" }
  preferences Json @default("{}")

  // Soft Delete
  deletedAt   DateTime?

  // Relations
  organizations               UserOrganization[]
  sessions                    UserSession[]
  personalAccessTokens        PersonalAccessToken[]
  notificationPreferences     UserNotificationPreferences?
  systemRole                  SystemRole?
  sentInvitations             UserInvitation[] @relation("InvitedBy")

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([email])
  @@index([serviceStatus])
  @@index([deletedAt]) // Fast query for active users (WHERE deletedAt IS NULL)
  @@index([externalId])
  @@index([authProvider])
}
```

---

#### SystemRole Table (BEO Mode)

```prisma
model SystemRole {
  id         String   @id @default(cuid())
  userId     String   @unique
  roleName   String   // "BEO Executive", "Global SysAdmin"

  // System-Level Permissions
  perm_ViewAllOrgs      Boolean  @default(false) // Portfolio oversight
  perm_ManageAllUsers   Boolean  @default(false) // Global user management
  perm_ViewAuditLog     Boolean  @default(false) // Cross-org audit log
  perm_ManageSystem     Boolean  @default(false) // System settings

  // Metadata
  grantedAt  DateTime @default(now())
  grantedBy  String   // User ID who granted this system role
  approvedBy String?  // Requires approval from existing SysAdmin

  user       User     @relation(fields: [userId], references: [id])

  @@index([userId])
}
```

---

#### PersonalAccessToken Table (NEW)

```prisma
model PersonalAccessToken {
  id             String   @id @default(cuid())
  userId         String
  name           String   // e.g., "PowerBI Connect", "Excel Integration"
  tokenHash      String   @unique // bcrypt hash of token (never store plaintext)

  // Security Scopes (Narrowing)
  // Even if user is Admin, this token might be Read-Only
  scopes         Json     // ["read:pfa", "read:financials", "write:forecasts"]

  // Usage Tracking
  lastUsedAt     DateTime?
  lastUsedIp     String?
  usageCount     Int      @default(0)

  // Lifecycle
  expiresAt      DateTime?
  createdAt      DateTime @default(now())
  revokedAt      DateTime?
  revokedBy      String?  // User ID who revoked

  user           User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([tokenHash]) // Fast lookup on API requests
  @@index([expiresAt, revokedAt]) // Fast cleanup of expired/revoked tokens
}
```

---

#### UserInvitation Table (NEW)

```prisma
model UserInvitation {
  id             String   @id @default(cuid())
  email          String
  organizationId String
  roleId         String   // The OrganizationRole template they will get
  invitedBy      String   // User ID
  token          String   @unique // High-entropy string (64 chars)
  expiresAt      DateTime // 48 hour validity

  status         String   @default("pending") // pending, expired, accepted, declined

  // Narrowing (Optional)
  // If admin defined custom overrides during invite, store them here
  customPermissions Json?
  customCapabilities Json?

  createdAt      DateTime @default(now())
  acceptedAt     DateTime?

  organization   Organization @relation(fields: [organizationId], references: [id])
  role           OrganizationRole @relation(fields: [roleId], references: [id])
  inviter        User     @relation("InvitedBy", fields: [invitedBy], references: [id])

  @@index([token])
  @@index([email, status])
  @@index([expiresAt]) // Fast cleanup of expired invitations
}
```

---

### 2. Access Control

#### Organization Table

```prisma
model Organization {
  id          String   @id @default(cuid())
  code        String   @unique
  name        String

  // Identity Source
  externalId        String?  @unique // PEMS Tenant/Org ID
  isExternal        Boolean  @default(false) // True if managed by PEMS

  // Service Control
  isActive    Boolean  @default(true)
  serviceStatus String @default("active") // active, suspended, archived

  // Sync Control
  enableSync  Boolean  @default(true)
  lastSyncAt  DateTime?

  // Metadata
  suspendedAt DateTime?
  suspendedBy String?
  suspensionReason String?

  // Config Bag (NEW - Future-Proofing)
  // Stores: { "fiscal_start": 4, "allow_public_share": false, "slack_url": "...", "beta_features": ["ai_insights"] }
  settings Json @default("{}")

  // Soft Delete
  deletedAt   DateTime?

  // Relations
  users       UserOrganization[]
  pfaRecords  PfaRecord[]
  apiCredentials OrganizationApiCredentials[]
  integrations OrganizationIntegration[]
  roles        OrganizationRole[]
  invitations  UserInvitation[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([serviceStatus])
  @@index([deletedAt]) // Fast query for active orgs
  @@index([externalId])
  @@index([isExternal])
}
```

---

#### OrganizationRole Table (Templates)

```prisma
model OrganizationRole {
  id             String   @id @default(cuid())
  organizationId String
  name           String   // "Project Manager", "Contractor", "Financial Analyst"
  description    String?

  // 1. Data Scope (The "What")
  perm_Read               Boolean  @default(true)
  perm_EditForecast       Boolean  @default(false) // Edit Forecast Start/End/Qty
  perm_EditActuals        Boolean  @default(false) // Edit Actual Start/End
  perm_Delete             Boolean  @default(false) // Hard delete capability

  // 2. Data Operations (The "How")
  perm_Import             Boolean  @default(false) // Upload CSV/Excel to import data
  perm_RefreshData        Boolean  @default(false) // Trigger manual PEMS sync
  perm_Export             Boolean  @default(false) // Export data to Excel/CSV

  // 3. Financials (The "Mask")
  perm_ViewFinancials     Boolean  @default(false)

  // 4. Process (The "How")
  perm_SaveDraft          Boolean  @default(false) // Sandbox access
  perm_Sync               Boolean  @default(false) // PEMS Commit access

  // 5. Admin (The "Who")
  perm_ManageUsers        Boolean  @default(false) // Delegated Admin
  perm_ManageSettings     Boolean  @default(false) // Org Settings
  perm_ConfigureAlerts    Boolean  @default(false) // Notification triggers
  perm_Impersonate        Boolean  @default(false) // SysAdmin only

  // Tier 2: Capabilities (NEW - Future-Proofing)
  // UI-level permissions that don't affect data queries
  // Example: ["export_pdf", "beta_ai_chat", "map_view", "feature:import_legacy"]
  capabilities   Json @default("[]")

  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  createdBy      String   // User ID who created this template

  // Soft Delete
  deletedAt      DateTime?

  organization   Organization @relation(fields: [organizationId], references: [id])
  users          UserOrganization[]
  invitations    UserInvitation[]

  @@unique([organizationId, name])
  @@index([organizationId, isActive])
  @@index([deletedAt])
}
```

---

#### UserOrganization Table (Instances)

```prisma
model UserOrganization {
  id             String   @id @default(cuid())
  userId         String
  organizationId String
  roleTemplateId String?  // Links to OrganizationRole (NULL for legacy users)

  // Access Source
  assignmentSource  String   @default("local") // "local", "pems_sync", "auto_provision"
  externalRoleId    String?  // Reference to specific PEMS role ID

  // 1. Data Scope (The "What")
  perm_Read               Boolean  @default(true)
  perm_EditForecast       Boolean  @default(false) // Edit Forecast Start/End/Qty
  perm_EditActuals        Boolean  @default(false) // Edit Actual Start/End
  perm_Delete             Boolean  @default(false) // Hard delete capability

  // 2. Data Operations (The "How")
  perm_Import             Boolean  @default(false) // Upload CSV/Excel to import data
  perm_RefreshData        Boolean  @default(false) // Trigger manual PEMS sync
  perm_Export             Boolean  @default(false) // Export data to Excel/CSV

  // 3. Financials (The "Mask")
  perm_ViewFinancials     Boolean  @default(false)

  // 4. Process (The "How")
  perm_SaveDraft          Boolean  @default(false) // Sandbox access
  perm_Sync               Boolean  @default(false) // PEMS Commit access

  // 5. Admin (The "Who")
  perm_ManageUsers        Boolean  @default(false) // Delegated Admin
  perm_ManageSettings     Boolean  @default(false) // Org Settings
  perm_ConfigureAlerts    Boolean  @default(false) // Notification triggers
  perm_Impersonate        Boolean  @default(false) // SysAdmin only

  // Tier 2: Capabilities (NEW - Future-Proofing)
  // User-specific capability overrides (can narrow down from template)
  // Example: ["export_pdf", "beta_ai_chat"]
  capabilities   Json @default("[]")

  // Override Tracking
  isCustom       Boolean  @default(false) // TRUE if permissions differ from template

  // Temporal Access (for Contractors)
  accessExpiresAt DateTime?  // NULL = permanent, set = auto-expire at this date

  // Audit Trail
  grantedAt      DateTime @default(now())
  grantedBy      String?  // User ID who granted access
  modifiedAt     DateTime?
  modifiedBy     String?  // User ID who last modified permissions
  revokedAt      DateTime?
  revokedBy      String?

  // Soft Delete
  deletedAt      DateTime?

  user           User         @relation(fields: [userId], references: [id])
  organization   Organization @relation(fields: [organizationId], references: [id])
  roleTemplate   OrganizationRole? @relation(fields: [roleTemplateId], references: [id])

  @@unique([userId, organizationId])
  @@index([userId, isActive])
  @@index([organizationId, isActive])
  @@index([accessExpiresAt]) // Fast query for expired access cleanup
  @@index([deletedAt])
  @@index([assignmentSource])
  @@index([isCustom])
}
```

---

### 3. Session Management

#### UserSession Table

```prisma
model UserSession {
  id         String   @id @default(cuid())
  userId     String
  jti        String   @unique // JWT ID (unique per token)
  ipAddress  String
  userAgent  String
  location   String?  // "San Francisco, CA"
  deviceType String   // "Desktop", "Mobile", "Tablet"
  browser    String   // "Chrome 120.0"

  createdAt  DateTime @default(now())
  lastActiveAt DateTime @default(now())
  expiresAt  DateTime
  revokedAt  DateTime?
  revokedBy  String?  // User ID who revoked this session

  user       User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([jti])
  @@index([expiresAt]) // Fast cleanup of expired sessions
}
```

---

### 4. Notifications

#### UserNotificationPreferences Table

```prisma
model UserNotificationPreferences {
  id         String   @id @default(cuid())
  userId     String   @unique

  // Channel Preferences
  enableEmail     Boolean  @default(true)
  enableInApp     Boolean  @default(true)
  enableSms       Boolean  @default(false)
  enablePush      Boolean  @default(true)
  enableSlack     Boolean  @default(false)
  enableTeams     Boolean  @default(false)

  // Event Type Preferences
  notifyOnSyncSuccess  Boolean  @default(false)
  notifyOnSyncFailure  Boolean  @default(true)
  notifyOnBudget       Boolean  @default(true)
  notifyOnSecurity     Boolean  @default(true)
  notifyOnPermissions  Boolean  @default(true)
  notifyOnExpiration   Boolean  @default(true)

  // Digest Preferences
  digestFrequency  String   @default("instant") // instant, daily, weekly
  quietHoursStart  String?  // "18:00"
  quietHoursEnd    String?  // "08:00"
  quietHoursEnabled Boolean @default(false)

  user       User     @relation(fields: [userId], references: [id])

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

---

#### OrganizationIntegration Table

```prisma
model OrganizationIntegration {
  id             String   @id @default(cuid())
  organizationId String
  type           String   // "slack", "teams"

  // Webhook Configuration
  webhookUrl     String   // Encrypted
  channel        String?  // "#pfa-alerts"

  // Event Routing
  notifyOnSyncFailure  Boolean  @default(true)
  notifyOnBudget       Boolean  @default(true)
  notifyOnSecurity     Boolean  @default(true)

  isActive       Boolean  @default(true)

  organization   Organization @relation(fields: [organizationId], references: [id])

  @@unique([organizationId, type])
  @@index([organizationId, isActive])
}
```

---

### 5. Governance (Audit & Compliance)

#### AuditLog Table (NEW - Immutable Ledger)

```prisma
model AuditLog {
  id             String   @id @default(cuid())
  organizationId String?  // Nullable for System-level actions
  userId         String   // Who did it
  action         String   // "pfa:update", "user:promote", "sync:force"
  resourceId     String   // ID of the PfaRecord or User affected
  resourceType   String   // "PfaRecord", "UserOrganization", "Organization"

  // THE EVIDENCE
  changes        Json     // { "before": { "cost": 100 }, "after": { "cost": 200 } }
  reason         String?  // User's comment: "Weather delay extension"
  metadata       Json     // { "ip": "192.168.1.1", "userAgent": "Chrome..." }

  // BATCH GROUPING (allows reverting 50 records changed in one click)
  batchId        String?

  createdAt      DateTime @default(now())

  @@index([organizationId, createdAt]) // Fast timeline retrieval
  @@index([userId, createdAt]) // "What did John do?"
  @@index([resourceType, resourceId]) // "History of this PFA record"
  @@index([batchId]) // "All changes in this transaction"
  @@index([action]) // "All sync operations"
}
```

**Key Features**:
- **Immutable**: No `updatedAt` field, records never modified
- **Before/After Diffs**: `changes` JSONB stores complete state
- **Batch Support**: `batchId` groups related changes for bulk revert
- **User Justification**: `reason` field for compliance
- **IP Tracking**: `metadata` captures request context

---

### 6. Future-Proofing

#### SystemDictionary Table

```prisma
model SystemDictionary {
  id         String   @id @default(cuid())
  category   String   // "equipment_category", "asset_class", "dor_type"
  code       String   // "HVAC", "Heavy Lift", "PROJECT"
  label      String   // "HVAC Equipment", "Heavy Lift Cranes"
  description String?
  metadata   Json     @default("{}")  // Custom fields per category
  sortOrder  Int      @default(0)
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())

  @@unique([category, code])
  @@index([category, isActive])
}
```

---

### 7. Application Data

#### PfaRecord Table (with Governance Features)

```prisma
model PfaRecord {
  id             String   @id @default(cuid())
  organizationId String

  // ... existing PFA fields (timeline, financial, etc.) ...

  // Draft Status (for Sandbox users)
  draftStatus    String   @default("committed") // committed, draft, pending_review
  isDraft        Boolean  @default(false) // Quick filter for queries
  draftCreatedBy String?  // User ID who created draft
  draftCreatedAt DateTime?

  // Change Tracking (for bi-directional sync with PEMS)
  syncState         String    @default("pristine") // pristine, modified, pending_sync, sync_error
  lastSyncedAt      DateTime? // When last pushed to PEMS
  pemsVersion       String?   // PEMS lastModified timestamp (for conflict detection)
  localVersion      Int       @default(1) // Increment on every local edit

  // Modified Fields Tracking (for incremental sync)
  modifiedFields    String?   // JSON array: ["forecastStart", "forecastEnd"]
  modifiedBy        String?   // User ID who made local changes
  modifiedAt        DateTime? // When local changes were made

  // Sync Error Handling
  syncErrorMessage  String?
  syncRetryCount    Int       @default(0)

  // Soft Delete (NEW - Data Retention)
  deletedAt         DateTime?
  deletedBy         String?

  organization   Organization @relation(fields: [organizationId], references: [id])

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([organizationId, syncState]) // Fast query for pending changes
  @@index([organizationId, modifiedAt]) // Recent changes for incremental sync
  @@index([organizationId, draftStatus])
  @@index([deletedAt]) // Fast query for active records
}
```

---

## Data Model Summary

**Total Tables**: 14

| Category | Tables | Purpose |
|----------|--------|---------|
| **Core Identity** | 4 | User, SystemRole, PersonalAccessToken, UserInvitation |
| **Access Control** | 3 | Organization, OrganizationRole, UserOrganization |
| **Session Management** | 1 | UserSession |
| **Notifications** | 2 | UserNotificationPreferences, OrganizationIntegration |
| **Governance** | 1 | AuditLog |
| **Future-Proofing** | 1 | SystemDictionary |
| **Application Data** | 1 | PfaRecord |
| **Other** | 1 | OrganizationApiCredentials (existing) |

**New Governance Tables**:
- ✅ AuditLog - Immutable forensic ledger
- ✅ PersonalAccessToken - User-generated API keys
- ✅ UserInvitation - Secure invitation lifecycle

**New Fields (Soft Delete)**:
- ✅ `deletedAt` on User, Organization, OrganizationRole, UserOrganization, PfaRecord

**New Fields (Config Bags)**:
- ✅ `preferences` JSON on User (theme, language, timezone)
- ✅ `settings` JSON on Organization (fiscal_start, beta_features)
- ✅ `capabilities` JSON on OrganizationRole and UserOrganization (UI feature flags)

---

## Decision Outcome

**Chosen Option**: **Option 2 - Template-Instance Pattern with Hybrid Override + Multi-Channel Notification System**

Implement a state-of-the-art enterprise access control system with:

### 1. Role Template System

**OrganizationRole Table** (Templates):
- Admins create reusable role templates (e.g., "Project Manager", "Contractor", "Financial Analyst")
- Each template defines 14 permission flags organized in 5 categories (Data Scope, Data Operations, Financials, Process, Admin)
- Templates are organization-specific (each org can have different "Project Manager" definitions)

**When Assigning User**:
1. Admin selects a template (e.g., "Project Manager")
2. System copies template's permissions to `UserOrganization` instance
3. Admin can **uncheck specific permissions** (e.g., remove "canDelete" for this user)
4. System sets `isCustom=true` if permissions differ from template
5. UI shows "Custom / Modified" badge

**Bulk Template Updates**:
- Admin updates template → System detects affected users
- Modal shows: "Update All" vs. "Update Standard Only (skip isCustom=true)" vs. "Selective"
- Users with `isCustom=true` are **NOT overwritten** by default (preserves manual overrides)

---

### 2. Financial Data Masking

**Problem**: Compliance requires hiding cost/budget data from certain users (e.g., contractors).

**Solution**: `perm_ViewFinancials` flag + response interceptor

**Enforcement Layers**:
1. **API Layer**: Response interceptor nullifies financial fields if `perm_ViewFinancials=false`
   ```typescript
   if (!user.perm_ViewFinancials) {
     pfaRecord.monthlyRate = null;
     pfaRecord.purchasePrice = null;
     pfaRecord.totalCost = null;
   }
   ```

2. **UI Layer**: Grid View shows `*****` or blurred for financial columns

3. **Export Layer**: CSV/Excel export **excludes financial columns entirely** for restricted users

4. **Security**: No bypass via "Inspect Element" (API enforces masking)

---

### 3. Temporal Access for Contractors

**Problem**: Contractors need access for 3-month project, then access must auto-expire.

**Solution**: `accessExpiresAt` field on `UserOrganization`

**Behavior**:
- Admin sets expiration date when assigning user (e.g., "2025-12-31")
- Middleware checks `accessExpiresAt` on every request:
  ```typescript
  if (userOrg.accessExpiresAt && new Date() > userOrg.accessExpiresAt) {
    return res.status(403).json({ error: 'ACCESS_EXPIRED' });
  }
  ```
- System sends notification **7 days before expiration** (reminders to extend if needed)
- Daily cron job marks expired users as `isActive=false`

---

### 4. SysAdmin Impersonation Mode ("View As")

**Problem**: SysAdmin needs to troubleshoot "Why can't user X see this data?" without asking for password.

**Solution**: Temporary JWT with target user's exact permissions

**Flow**:
1. SysAdmin clicks "View As John Doe" button on user profile
2. Backend issues **temporary 15-minute JWT** with target user's permissions (all claims copied from target user's `UserOrganization` records)
3. Frontend stores temp token in sessionStorage (NOT localStorage)
4. UI shows **persistent orange banner**: "You are viewing as John Doe. [Exit Impersonation]"
5. All actions logged in audit log: `SysAdmin impersonated User X at timestamp`
6. Clicking "Exit" restores original JWT

**Security**:
- Only users with `perm_Impersonate=true` can use this feature (typically only SysAdmins)
- Temporary token expires after 15 minutes (no refresh)
- All actions during impersonation logged with `impersonatedBy` field

---

### 5. Session Management & Kill Switch

**Problem**: User reports "My account was hacked, please lock it NOW" → Need to revoke all active sessions immediately.

**Solution**: Session tracking + JWT blocklist in Redis

**Session Table**:
```prisma
model UserSession {
  id         String   @id @default(cuid())
  userId     String
  jti        String   @unique // JWT ID (unique per token)
  ipAddress  String
  userAgent  String
  location   String?  // "San Francisco, CA"
  deviceType String   // "Desktop", "Mobile", "Tablet"
  browser    String   // "Chrome 120.0"
  createdAt  DateTime @default(now())
  lastActiveAt DateTime @default(now())
  expiresAt  DateTime
  revokedAt  DateTime?
  revokedBy  String?  // User ID who revoked this session
}
```

**Admin UI**:
- Table shows active sessions: Device, Browser, IP, Location, Last Active
- "Revoke" button next to each session

**Revocation Flow**:
1. Admin clicks "Revoke"
2. Backend adds `jti` to Redis blocklist: `SET blocklist:{jti} "revoked" EX 604800` (7 days TTL)
3. Backend disconnects WebSocket connection (if user is online)
4. User's next API call fails with 401: "Session expired, please login again"

**Middleware**:
```typescript
if (await redis.exists(`blocklist:${token.jti}`)) {
  return res.status(401).json({ error: 'SESSION_REVOKED' });
}
```

---

### 6. Multi-Channel Notification System

**Problem**: Users need to know when:
- PEMS sync fails
- Budget threshold exceeded
- Account suspended
- Permission changed
- Temporal access expiring in 7 days

**Solution**: Event-driven notification system with 6 channels

**Architecture**:
```
Event Emitted → Event Bus → Smart Router → Multi-Channel Delivery
                 (in-memory)    (batching)    (Email, In-App, SMS, Slack, Teams, Push)
```

**Components**:

1. **Event Bus** (`NotificationEventBus` service):
   ```typescript
   eventBus.emit('pfa.sync.failed', {
     userId: 'user-123',
     organizationId: 'org-456',
     errorCount: 50,
     metadata: { syncId: 'sync-789' }
   });
   ```

2. **Smart Router** (`NotificationRouter` service):
   - Loads user's notification preferences
   - Checks quiet hours (e.g., 18:00 - 08:00)
   - Applies batching rules (aggregate events within 60-second window)
   - Routes to appropriate channels

3. **User Preferences**:
   ```prisma
   model UserNotificationPreferences {
     id         String   @id @default(cuid())
     userId     String   @unique

     // Channel Preferences
     enableEmail     Boolean  @default(true)
     enableInApp     Boolean  @default(true)
     enableSms       Boolean  @default(false)
     enablePush      Boolean  @default(true)
     enableSlack     Boolean  @default(false)
     enableTeams     Boolean  @default(false)

     // Event Type Preferences
     notifyOnSyncSuccess  Boolean  @default(false)
     notifyOnSyncFailure  Boolean  @default(true)
     notifyOnBudget       Boolean  @default(true)
     notifyOnSecurity     Boolean  @default(true)
     notifyOnPermissions  Boolean  @default(true)
     notifyOnExpiration   Boolean  @default(true)

     // Digest Preferences
     digestFrequency  String   @default("instant") // instant, daily, weekly
     quietHoursStart  String?  // "18:00"
     quietHoursEnd    String?  // "08:00"
     quietHoursEnabled Boolean @default(false)
   }
   ```

4. **Delivery Channels**:

   **Email** (MJML templates):
   - Subject: "PFA Sync Failed: 50 errors detected"
   - Body: HTML email with action buttons
   - Sent via Resend/SendGrid

   **In-App** (React component):
   - Bell icon with unread count badge: "(3)"
   - Drawer with "Unread" and "All" tabs
   - Real-time updates via WebSocket
   - Toast notifications for critical alerts

   **SMS** (Twilio):
   - Plain text: "PFA Sync Failed: 50 errors. View: https://app.pfa.com/sync/789"
   - Rate limited (max 5 SMS/day per user)

   **Slack** (Webhook + Adaptive Cards):
   - Posts to organization's Slack channel
   - Interactive buttons: "Retry Sync", "View Logs"
   - Button clicks trigger authenticated API callbacks

   **Teams** (Webhook + Adaptive Cards):
   - Same as Slack but for Microsoft Teams
   - Uses Teams connector API

   **Push Notifications** (Firebase Cloud Messaging):
   - Mobile/desktop push notifications
   - Requires user to grant permission

5. **Smart Batching**:
   - **Problem**: Bulk import generates 50 errors → 50 individual notifications
   - **Solution**: Wait 60 seconds, aggregate events, send 1 notification:
     ```
     "Bulk Import Failed: 50 errors detected. View details: [Link]"
     ```
   - **Implementation**: Redis queue with 60-second TTL

6. **Quiet Hours**:
   - User sets quiet hours (e.g., 18:00 - 08:00)
   - Non-urgent notifications held in queue
   - Delivered at quiet hours end (e.g., 08:00)
   - Urgent notifications (security alerts) bypass quiet hours

7. **In-App Notification Drawer**:
   ```tsx
   <NotificationDrawer>
     <Tab label="Unread (3)">
       <Notification
         type="error"
         title="PFA Sync Failed"
         message="50 errors detected in Org HOLNG"
         timestamp="2 minutes ago"
         actions={[
           { label: "Retry", onClick: retrySync },
           { label: "View Logs", onClick: viewLogs }
         ]}
       />
     </Tab>
     <Tab label="All">
       {/* All notifications including read ones */}
     </Tab>
   </NotificationDrawer>
   ```

8. **Organization Slack/Teams Integration**:
   ```prisma
   model OrganizationIntegration {
     id             String   @id @default(cuid())
     organizationId String
     type           String   // "slack", "teams"

     // Webhook Configuration
     webhookUrl     String   // Encrypted
     channel        String?  // "#pfa-alerts"

     // Event Routing
     notifyOnSyncFailure  Boolean  @default(true)
     notifyOnBudget       Boolean  @default(true)
     notifyOnSecurity     Boolean  @default(true)

     isActive       Boolean  @default(true)

     @@unique([organizationId, type])
   }
   ```

**Security: HMAC Signature Validation**

All Slack/Teams webhook callbacks MUST validate HMAC signatures to prevent unauthorized API calls:

**Slack Signature Validation**:
```typescript
import crypto from 'crypto';

function validateSlackSignature(req: Request): boolean {
  const slackSignature = req.headers['x-slack-signature'];
  const slackTimestamp = req.headers['x-slack-request-timestamp'];
  const body = JSON.stringify(req.body);

  // Prevent replay attacks (timestamp > 5 minutes = reject)
  if (Math.abs(Date.now() / 1000 - parseInt(slackTimestamp)) > 300) {
    return false;
  }

  // Compute HMAC signature
  const sigBasestring = `v0:${slackTimestamp}:${body}`;
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', process.env.SLACK_SIGNING_SECRET!)
    .update(sigBasestring)
    .digest('hex');

  // Compare signatures (timing-safe)
  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(slackSignature)
  );
}

// In callback endpoint
router.post('/api/integrations/slack/callback', async (req, res) => {
  if (!validateSlackSignature(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Safe to process callback
  const { action, userId, metadata } = req.body;
  // ... handle action ...
});
```

**Teams Signature Validation**:
```typescript
function validateTeamsSignature(req: Request): boolean {
  const teamsSignature = req.headers['authorization'];
  const body = JSON.stringify(req.body);

  // Teams uses HMAC-SHA256 with shared secret
  const expectedSignature = 'HMAC ' + crypto
    .createHmac('sha256', process.env.TEAMS_SHARED_SECRET!)
    .update(body)
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(teamsSignature)
  );
}
```

**Why This Matters**:
- ❌ Without signature validation: Attacker can POST to webhook URL and trigger syncs, delete data, etc.
- ✅ With signature validation: Only authenticated Slack/Teams requests succeed

---

### 7. Organization Service Status

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

---

### 8. User Service Status

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

  // Failed Login Tracking (for account locking)
  failedLoginCount Int @default(0)
  lockedAt DateTime?

  // Relations
  organizations UserOrganization[]
  sessions      UserSession[]
  notificationPreferences UserNotificationPreferences?
}
```

**Service Status States**:
- `active`: Normal operation
- `suspended`: Temporarily disabled (HR action, security concern)
- `locked`: Security lockout (5 failed logins → auto-lock)

---

### 9. PEMS API Sync Logic

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

### 10. Draft Data Strategy (Sandbox Isolation)

**Problem**: Users with `perm_SaveDraft` but not `perm_Sync` need a way to experiment without affecting production data.

**Solution**: `draftStatus` field on `PfaRecord` + draft filtering

**Behavior**:
- Users with `perm_SaveDraft=true` can save records with `draftStatus='draft'`
- Frontend filters: "Show Drafts" toggle (default: hidden)
- API queries exclude drafts by default: `WHERE draftStatus != 'draft'`
- Users with `perm_Sync=true` can "Commit Draft" → Sets `draftStatus='committed'` and syncs to PEMS

**Draft Lifecycle**:
```
User edits record → Save Draft (draftStatus='draft') → User reviews → Commit Draft (draftStatus='committed') → Sync to PEMS
```

**Database Schema Addition**:
```prisma
model PfaRecord {
  // ... existing fields ...

  // Draft Status (for Sandbox users)
  draftStatus    String   @default("committed") // committed, draft, pending_review
  isDraft        Boolean  @default(false) // Quick filter for queries
  draftCreatedBy String?  // User ID who created draft
  draftCreatedAt DateTime?

  @@index([organizationId, draftStatus])
}
```

**UI Behavior**:
- Users with only `perm_SaveDraft`: See "Save Draft" button (no "Sync to PEMS")
- Users with `perm_Sync`: See both "Save Draft" and "Commit & Sync" buttons
- Draft records shown with yellow "Draft" badge in grid view

---

### 10.5. Data Operations Permissions (Import/Refresh/Export)

**Problem**: Users need varying levels of access to data operations that affect system resources.

**Solution**: Three static permission flags for backend enforcement.

**Permissions**:

1. **perm_Import** - Upload CSV/Excel to import PFA data
   - Backend validates file format (CSV, XLSX)
   - Rate limited: 10 imports per hour per user
   - Transaction management: All-or-nothing import
   - Audit log: Records user ID, timestamp, record count

2. **perm_RefreshData** - Trigger manual PEMS sync
   - Backend calls PEMS Grid Data API (costs money)
   - Rate limited: 1 sync per 5 minutes per organization
   - Prevents sync storms (multiple users clicking refresh)
   - Audit log: Records user ID, timestamp, sync status

3. **perm_Export** - Export data to Excel/CSV
   - Backend generates file (CPU intensive)
   - Respects `perm_ViewFinancials` (masks financial columns if false)
   - No rate limit (read-only operation)
   - Audit log: Records user ID, timestamp, record count, financial inclusion

**Backend Enforcement Examples**:

**Import Permission Check**:
```typescript
router.post('/api/pfa/import', upload.single('file'), async (req, res) => {
  const userOrg = await getUserOrganization(req.user.id, req.body.organizationId);

  if (!userOrg.perm_Import) {
    return res.status(403).json({
      error: 'PERMISSION_DENIED',
      message: 'You do not have permission to import data'
    });
  }

  // Rate limiting check
  const importCount = await getImportCountLastHour(req.user.id);
  if (importCount >= 10) {
    return res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Maximum 10 imports per hour. Try again later.'
    });
  }

  // Proceed with import
  const { file } = req;
  const records = await parseCSV(file.buffer);
  await importPfaRecords(records, req.body.organizationId);

  // Audit log
  await createAuditLog({
    userId: req.user.id,
    action: 'DATA_IMPORT',
    recordCount: records.length
  });

  res.json({ success: true, imported: records.length });
});
```

**Refresh Data Permission Check**:
```typescript
router.post('/api/pems/refresh', async (req, res) => {
  const userOrg = await getUserOrganization(req.user.id, req.body.organizationId);

  if (!userOrg.perm_RefreshData) {
    return res.status(403).json({
      error: 'PERMISSION_DENIED',
      message: 'You do not have permission to refresh PEMS data'
    });
  }

  // Rate limiting (PEMS API costs money)
  const lastSync = await getLastSyncTime(req.body.organizationId);
  const timeSinceLastSync = Date.now() - lastSync.getTime();
  if (timeSinceLastSync < 5 * 60 * 1000) { // 5 minutes
    return res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Please wait 5 minutes between syncs',
      nextAllowedAt: new Date(lastSync.getTime() + 5 * 60 * 1000)
    });
  }

  // Trigger PEMS sync
  const syncId = await triggerPemsSync(req.body.organizationId);

  res.json({ success: true, syncId });
});
```

**Export Permission Check**:
```typescript
router.get('/api/pfa/export', async (req, res) => {
  const userOrg = await getUserOrganization(req.user.id, req.query.organizationId);

  if (!userOrg.perm_Export) {
    return res.status(403).json({
      error: 'PERMISSION_DENIED',
      message: 'You do not have permission to export data'
    });
  }

  // Financial masking check
  const includeFinancials = userOrg.perm_ViewFinancials;

  // Fetch data
  const records = await getPfaRecords(req.query.organizationId, {
    filters: req.query.filters,
    includeFinancials
  });

  // Generate Excel file
  const workbook = await generateExcel(records, { includeFinancials });

  // Audit log
  await createAuditLog({
    userId: req.user.id,
    action: 'DATA_EXPORT',
    recordCount: records.length,
    includeFinancials
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=pfa-export.xlsx');
  res.send(workbook);
});
```

**UI Behavior**:
- Users without `perm_Import`: Import button disabled with tooltip "Contact your administrator"
- Users without `perm_RefreshData`: Refresh button disabled with tooltip "You do not have permission to sync data"
- Users without `perm_Export`: Export button hidden

---

### 11. Future-Proofing Architecture (Hybrid JSONB Approach)

**Problem**: The current architecture defines all 14 permission flags as **database columns** (e.g., `perm_EditForecast Boolean`). While this provides excellent query performance for critical security checks, it creates **architectural inflexibility**:

- **Every new permission** requires a database migration (downtime risk, schema bloat)
- **Every new setting** (e.g., `fiscal_year_start`, `theme_color`) requires a column
- **Every new notification type** requires multiple boolean triggers
- **Every new UI feature flag** requires schema changes

In 2 years, we could have **100+ boolean columns** just for permissions and settings, making the schema unmaintainable.

**Solution**: **Hybrid JSONB Approach** - Industry standard pattern that balances performance with extensibility:

- **Critical Security Permissions**: Keep as Boolean columns (high-performance WHERE clauses)
- **Feature Toggles & Settings**: Store in indexed JSONB columns (zero-migration extensibility)
- **System Options & Dropdowns**: Store in generic `SystemDictionary` table (admin-configurable)

This is the same pattern used by **Stripe, GitHub, and Shopify** for enterprise-grade multi-tenant systems.

---

#### Pattern 1: Config Bag (Settings/Preferences)

**Problem**: Adding organizational settings like `fiscal_year_start`, `allow_public_share`, or `beta_features_enabled` requires database migrations for every minor config change.

**Solution**: Add a single indexed JSONB column called `settings` (Organization) or `preferences` (User).

**Implementation**:
```prisma
model Organization {
  id       String @id @default(cuid())
  code     String @unique
  name     String

  // Service Control (existing)
  isActive      Boolean  @default(true)
  serviceStatus String   @default("active")
  enableSync    Boolean  @default(true)

  // --- CONFIG BAG (NEW) ---
  // Stores: { "fiscal_start": 4, "allow_public_share": false, "slack_url": "...", "beta_features": ["ai_insights", "map_view"] }
  // Allows adding unlimited organizational settings without migration
  settings Json @default("{}")

  // Metadata (existing)
  suspendedAt      DateTime?
  suspendedBy      String?
  suspensionReason String?
  lastSyncAt       DateTime?

  // Relations (existing)
  users            UserOrganization[]
  pfaRecords       PfaRecord[]
  apiCredentials   OrganizationApiCredentials[]
  integrations     OrganizationIntegration[]
  roles            OrganizationRole[]

  @@index([id])
}

model User {
  id       String @id @default(cuid())
  username String @unique
  email    String @unique

  // Service Control (existing)
  isActive         Boolean  @default(true)
  serviceStatus    String   @default("active")
  suspendedAt      DateTime?
  suspendedBy      String?
  suspensionReason String?
  lastLoginAt      DateTime?

  // Account Security (existing)
  failedLoginCount Int      @default(0)
  lockedAt         DateTime?

  // --- UI PREFERENCES (NEW) ---
  // Stores: { "theme": "dark", "language": "en", "timezone": "America/New_York", "grid_density": "compact" }
  // Allows adding unlimited user preferences without migration
  preferences Json @default("{}")

  // Relations (existing)
  organizations               UserOrganization[]
  sessions                    UserSession[]
  notificationPreferences     UserNotificationPreferences?
}
```

**How it handles growth**:
- **New Feature**: "Dark Mode" preference? Just start saving `{ "theme": "dark" }` to `preferences`. No migration needed.
- **New Org Setting**: "Fiscal Year Start Month"? Save `{ "fiscal_start": 4 }` to `settings`. Zero downtime.
- **Validation**: Use Zod (TypeScript schema validation) in API layer to enforce JSON structure:

```typescript
// backend/src/schemas/organizationSettings.ts
import { z } from 'zod';

export const OrganizationSettingsSchema = z.object({
  fiscal_start: z.number().int().min(1).max(12).optional(),
  allow_public_share: z.boolean().optional(),
  slack_url: z.string().url().optional(),
  beta_features: z.array(z.string()).optional(),
  notification_email: z.string().email().optional(),
  data_retention_days: z.number().int().positive().optional(),
}).strict(); // Reject unknown keys

// Usage in API endpoint
const settingsUpdate = OrganizationSettingsSchema.parse(req.body.settings);
await prisma.organization.update({
  where: { id: orgId },
  data: { settings: settingsUpdate }
});
```

**Example Settings**:
```typescript
// Organization settings (in database as JSON)
{
  "fiscal_start": 4,              // Fiscal year starts in April
  "allow_public_share": false,    // Disable public sharing
  "slack_url": "https://hooks.slack.com/...",
  "beta_features": ["ai_insights", "map_view"],
  "notification_email": "pm@company.com",
  "data_retention_days": 730      // 2 years
}

// User preferences (in database as JSON)
{
  "theme": "dark",
  "language": "en",
  "timezone": "America/New_York",
  "grid_density": "compact",
  "default_view": "matrix",
  "show_tutorial": false
}
```

---

#### Pattern 2: Two-Tier Permissions (Columns + Capabilities JSON)

**Problem**: Adding UI-level permissions like `perm_ExportPDF`, `perm_SeeBetaDashboard`, `perm_InviteGuests` requires 3 new columns + migration for every minor feature.

**Solution**: Split permissions into two tiers:

1. **Tier 1: Structural Security (Columns)** - Permissions that affect **database queries** (WHERE clauses). Keep as Boolean columns for speed (e.g., `perm_Read`, `perm_EditForecast`, `perm_ViewFinancials`).

2. **Tier 2: Feature Toggles (Capabilities JSON)** - UI-level permissions that **don't affect data queries** (e.g., export buttons, beta features). Store in JSONB array.

**Implementation**:
```prisma
model UserOrganization {
  id             String   @id @default(cuid())
  userId         String
  organizationId String
  roleTemplateId String?  // Links to OrganizationRole

  // --- TIER 1: HIGH PERFORMANCE SECURITY (Columns) ---
  // These are used in Prisma "WHERE" clauses for filtering data
  // Keep as columns for fast database queries
  perm_Read              Boolean @default(true)
  perm_EditForecast      Boolean @default(false)
  perm_EditActuals       Boolean @default(false)
  perm_Delete            Boolean @default(false)
  perm_Import            Boolean @default(false) // Upload CSV/Excel to import data
  perm_RefreshData       Boolean @default(false) // Trigger manual PEMS sync
  perm_Export            Boolean @default(false) // Export data to Excel/CSV
  perm_ViewFinancials    Boolean @default(false)
  perm_SaveDraft         Boolean @default(false)
  perm_Sync              Boolean @default(false)
  perm_ManageUsers       Boolean @default(false)
  perm_ManageSettings    Boolean @default(false)
  perm_ConfigureAlerts   Boolean @default(false)
  perm_Impersonate       Boolean @default(false)

  // --- TIER 2: FEATURE EXPANSION (JSONB) - NEW ---
  // Stores UI flags: ["export_csv", "export_pdf", "export_excel", "beta_ai_chat", "invite_guests", "view_audit_log"]
  // Allows adding unlimited minor permissions without migration
  // Used for: Export buttons, Beta features, UI toggles
  capabilities           Json    @default("[]")

  // --- UI PREFERENCES (JSONB) - NEW ---
  // Stores: { "grid_density": "compact", "default_view": "matrix", "show_welcome": false }
  // User-specific UI customizations per organization context
  uiPreferences          Json    @default("{}")

  // Override Tracking (existing)
  isCustom       Boolean  @default(false)

  // Temporal Access (existing)
  accessExpiresAt DateTime?

  // Audit Trail (existing)
  grantedAt      DateTime @default(now())
  grantedBy      String?
  modifiedAt     DateTime?
  modifiedBy     String?
  revokedAt      DateTime?
  revokedBy      String?

  @@unique([userId, organizationId])
  @@index([userId, isActive])
  @@index([organizationId, isActive])
  @@index([accessExpiresAt])
}
```

**Decision Rule: When to use Column vs. Capability?**

| Use Column (Tier 1) | Use Capability (Tier 2) |
|---------------------|-------------------------|
| Backend needs it for data filtering | Only frontend needs it for UI visibility |
| Affects database WHERE clauses | Affects what buttons/menus are shown |
| Security-critical (data access) | Convenience feature (export formats) |
| **Examples**: `perm_Read`, `perm_EditForecast`, `perm_ViewFinancials` | **Examples**: `export_pdf`, `beta_ai_chat`, `invite_guests` |

**How it handles growth**:
- **New Feature**: "Export to Excel" button? Add `"export_excel"` to user's `capabilities` array. Wrap button in check:
  ```typescript
  {hasCapability(user, 'export_excel') && <ExportExcelButton />}
  ```
- **Beta Feature**: "AI Insights Dashboard"? Add `"beta_ai_insights"` to `capabilities`. No migration, instant rollout to selected users.
- **Validation**: Use Zod to enforce known capability names:

```typescript
// backend/src/schemas/userCapabilities.ts
import { z } from 'zod';

export const KNOWN_CAPABILITIES = [
  'export_csv',
  'export_pdf',
  'export_excel',
  'beta_ai_chat',
  'beta_map_view',
  'invite_guests',
  'view_audit_log',
  'bulk_import',
  'advanced_filters',
] as const;

export const UserCapabilitiesSchema = z.array(
  z.enum(KNOWN_CAPABILITIES)
).max(20); // Prevent abuse (max 20 capabilities per user)

// Usage in API endpoint
const capabilities = UserCapabilitiesSchema.parse(req.body.capabilities);
await prisma.userOrganization.update({
  where: { id: userOrgId },
  data: { capabilities }
});
```

**Frontend Permission Checks**:
```typescript
// frontend/utils/permissions.ts
export const hasCapability = (
  user: UserOrganization,
  capability: string
): boolean => {
  const caps = user.capabilities as string[];
  return caps.includes(capability);
};

// Component usage
{hasCapability(userOrg, 'export_pdf') && (
  <Button onClick={handleExportPDF}>
    <FileText className="w-4 h-4 mr-2" />
    Export PDF
  </Button>
)}

// Multi-capability check
{hasAnyCapability(userOrg, ['export_csv', 'export_pdf', 'export_excel']) && (
  <DropdownMenu>
    <DropdownMenuTrigger>Export</DropdownMenuTrigger>
    <DropdownMenuContent>
      {hasCapability(userOrg, 'export_csv') && (
        <DropdownMenuItem onClick={handleExportCSV}>CSV</DropdownMenuItem>
      )}
      {hasCapability(userOrg, 'export_pdf') && (
        <DropdownMenuItem onClick={handleExportPDF}>PDF</DropdownMenuItem>
      )}
      {hasCapability(userOrg, 'export_excel') && (
        <DropdownMenuItem onClick={handleExportExcel}>Excel</DropdownMenuItem>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

**Example Capabilities**:
```typescript
// In database (UserOrganization.capabilities column)
[
  "export_csv",
  "export_pdf",
  "export_excel",
  "beta_ai_chat",
  "beta_map_view",
  "invite_guests",
  "view_audit_log",
  "bulk_import",
  "advanced_filters"
]
```

---

#### Pattern 3: Topic Registry (Notification Subscriptions)

**Problem**: Adding notification types like `trigger_SyncFail`, `trigger_Budget`, `trigger_Security` as boolean columns is the **hardest to migrate later**. Every new notification type requires a migration.

**Solution**: Treat Notification Types as **Data**, not **Schema**. Store subscriptions in JSONB object mapping topic names to channel arrays.

**Implementation**:
```prisma
model UserNotificationPreferences {
  id     String @id @default(cuid())
  userId String @unique

  // --- TOPIC SUBSCRIPTIONS (JSONB) - REPLACES INDIVIDUAL BOOLEAN COLUMNS ---
  // Stores: {
  //   "pems:sync:fail": ["email", "slack"],
  //   "pems:sync:success": ["in_app"],
  //   "budget:alert": ["in_app", "push"],
  //   "budget:exceeded": ["email", "slack", "sms"],
  //   "security:login": ["email", "sms"],
  //   "security:lockout": ["email", "sms"],
  //   "user:invited": ["email"],
  //   "access:expiring": ["email", "in_app"]
  // }
  // Allows adding unlimited notification types without migration
  subscriptions Json @default("{}")

  // --- GLOBAL CHANNEL PREFERENCES (Backwards Compatible) ---
  // Master switches for entire channels (existing)
  enableEmail     Boolean  @default(true)
  enableInApp     Boolean  @default(true)
  enableSms       Boolean  @default(false)
  enablePush      Boolean  @default(true)
  enableSlack     Boolean  @default(false)
  enableTeams     Boolean  @default(false)

  // --- DIGEST & QUIET HOURS (existing) ---
  digestFrequency   String   @default("instant") // instant, daily, weekly
  quietHoursEnabled Boolean  @default(false)
  quietHoursStart   String?  // "18:00"
  quietHoursEnd     String?  // "08:00"

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**Topics Registry** (Code-based, not database):
```typescript
// backend/src/constants/notificationTopics.ts
export const NOTIFICATION_TOPICS = {
  // PEMS Sync Events
  PEMS_SYNC_FAIL:     'pems:sync:fail',
  PEMS_SYNC_SUCCESS:  'pems:sync:success',
  PEMS_SYNC_PARTIAL:  'pems:sync:partial',

  // Budget & Financial Events
  BUDGET_ALERT:       'budget:alert',
  BUDGET_EXCEEDED:    'budget:exceeded',
  BUDGET_WARNING:     'budget:warning',
  COST_SPIKE:         'cost:spike',

  // Security Events
  SECURITY_LOGIN:         'security:login',
  SECURITY_LOCKOUT:       'security:lockout',
  SECURITY_PASSWORD:      'security:password_reset',
  SECURITY_SESSION:       'security:session_revoked',

  // User Management Events
  USER_INVITED:       'user:invited',
  USER_REMOVED:       'user:removed',
  ACCESS_EXPIRING:    'access:expiring',
  ACCESS_EXPIRED:     'access:expired',
  PERMISSION_CHANGED: 'permission:changed',

  // System Events
  SYSTEM_MAINTENANCE: 'system:maintenance',
  SYSTEM_OUTAGE:      'system:outage',
  SYSTEM_UPGRADE:     'system:upgrade',

  // Data Events
  DATA_IMPORT:        'data:import:complete',
  DATA_EXPORT:        'data:export:ready',
  DATA_VALIDATION:    'data:validation:errors',
} as const;

export type NotificationTopic = typeof NOTIFICATION_TOPICS[keyof typeof NOTIFICATION_TOPICS];

// Metadata for UI rendering
export const TOPIC_METADATA: Record<NotificationTopic, {
  label: string;
  description: string;
  category: string;
  defaultChannels: string[];
  isUrgent: boolean;
}> = {
  'pems:sync:fail': {
    label: 'PEMS Sync Failed',
    description: 'Notification when PEMS data sync encounters errors',
    category: 'PEMS Integration',
    defaultChannels: ['email', 'slack'],
    isUrgent: true,
  },
  'budget:exceeded': {
    label: 'Budget Exceeded',
    description: 'Alert when project budget is exceeded',
    category: 'Financial',
    defaultChannels: ['email', 'slack', 'sms'],
    isUrgent: true,
  },
  // ... more topic metadata ...
};
```

**How it handles growth**:
- **New Alert**: "Server Maintenance" notification? Just emit `'system:maintenance'` event. Users who haven't subscribed ignore it. Build UI to let them subscribe later:

```typescript
// Emit new notification (no schema change needed)
eventBus.emit('system:maintenance', {
  userId: 'all', // Broadcast to all users
  title: 'Scheduled Maintenance',
  message: 'System will be down for 2 hours starting 2am',
  metadata: { startTime: '2025-12-01T02:00:00Z', duration: 7200 }
});

// Smart router checks subscriptions
const userPrefs = await getUserNotificationPreferences(userId);
const subscriptions = userPrefs.subscriptions as Record<string, string[]>;

if (subscriptions['system:maintenance']) {
  const channels = subscriptions['system:maintenance'];
  // Deliver to specified channels: ['email', 'in_app']
}
```

**Default Subscription Behavior** (when user hasn't configured preferences yet):
```typescript
// backend/src/services/NotificationService.ts
export const DEFAULT_SUBSCRIPTIONS: Record<NotificationTopic, string[]> = {
  'pems:sync:fail':     ['email', 'in_app'],
  'budget:exceeded':    ['email', 'in_app', 'slack'],
  'security:login':     ['email'],
  'security:lockout':   ['email', 'sms'],
  'access:expiring':    ['email', 'in_app'],
  // Opt-in for non-critical events
  'pems:sync:success':  [],
  'system:maintenance': [],
};

// When loading user preferences
const getEffectiveSubscriptions = (userPrefs: UserNotificationPreferences): Record<string, string[]> => {
  const saved = (userPrefs.subscriptions as Record<string, string[]>) || {};
  return { ...DEFAULT_SUBSCRIPTIONS, ...saved }; // User overrides take precedence
};
```

**Validation**:
```typescript
// backend/src/schemas/notificationSubscriptions.ts
import { z } from 'zod';
import { NOTIFICATION_TOPICS } from '../constants/notificationTopics';

const VALID_CHANNELS = ['email', 'in_app', 'sms', 'push', 'slack', 'teams'] as const;

export const NotificationSubscriptionsSchema = z.record(
  z.enum(Object.values(NOTIFICATION_TOPICS) as [string, ...string[]]), // Valid topics
  z.array(z.enum(VALID_CHANNELS)).max(6) // Valid channels
);

// Usage in API endpoint
const subscriptions = NotificationSubscriptionsSchema.parse(req.body.subscriptions);
await prisma.userNotificationPreferences.update({
  where: { userId },
  data: { subscriptions }
});
```

**Example Subscriptions**:
```typescript
// In database (UserNotificationPreferences.subscriptions column)
{
  "pems:sync:fail": ["email", "slack"],
  "pems:sync:success": ["in_app"],
  "budget:alert": ["in_app", "push"],
  "budget:exceeded": ["email", "slack", "sms"],
  "security:login": ["email", "sms"],
  "security:lockout": ["email", "sms"],
  "user:invited": ["email"],
  "access:expiring": ["email", "in_app"]
}
```

---

#### Pattern 4: Capability-to-Route Map (Frontend Permission Checks)

**Problem**: Hardcoding `if (role === 'admin')` in frontend makes it impossible to add new roles or permissions dynamically.

**Solution**: Centralized Permission Dictionary in frontend code that maps capabilities to routes and components.

**Implementation**:
```typescript
// frontend/constants/permissions.ts
export const APP_CAPABILITIES = {
  // --- CORE FEATURES (from Tier 1 DB columns) ---
  VIEW_TIMELINE:      'core:timeline:read',
  EDIT_FORECAST:      'core:forecast:edit',
  EDIT_ACTUALS:       'core:actuals:edit',
  VIEW_FINANCIALS:    'core:financials:view',
  DELETE_RECORDS:     'core:records:delete',
  SAVE_DRAFT:         'core:draft:save',
  SYNC_PEMS:          'core:pems:sync',

  // --- EXTENDED FEATURES (from Tier 2 capabilities JSONB) ---
  EXPORT_CSV:         'feature:export:csv',
  EXPORT_PDF:         'feature:export:pdf',
  EXPORT_EXCEL:       'feature:export:excel',
  VIEW_AI_INSIGHTS:   'feature:ai:insights',
  BETA_MAP_VIEW:      'feature:beta:map',
  INVITE_GUESTS:      'feature:invite:guests',
  BULK_IMPORT:        'feature:bulk:import',
  ADVANCED_FILTERS:   'feature:filters:advanced',

  // --- ADMIN FEATURES (from Tier 1 DB columns) ---
  MANAGE_USERS:       'admin:users:manage',
  MANAGE_SETTINGS:    'admin:settings:manage',
  MANAGE_BILLING:     'admin:billing:manage',
  VIEW_AUDIT_LOG:     'admin:audit:view',
  IMPERSONATE_USER:   'admin:impersonate',
  CONFIGURE_ALERTS:   'admin:alerts:configure',
} as const;

// Map DB permissions to app capabilities
export const mapUserToCapabilities = (userOrg: UserOrganization): Set<string> => {
  const caps = new Set<string>();

  // --- Tier 1: Database Columns → Core Capabilities ---
  if (userOrg.perm_Read) caps.add(APP_CAPABILITIES.VIEW_TIMELINE);
  if (userOrg.perm_EditForecast) caps.add(APP_CAPABILITIES.EDIT_FORECAST);
  if (userOrg.perm_EditActuals) caps.add(APP_CAPABILITIES.EDIT_ACTUALS);
  if (userOrg.perm_ViewFinancials) caps.add(APP_CAPABILITIES.VIEW_FINANCIALS);
  if (userOrg.perm_Delete) caps.add(APP_CAPABILITIES.DELETE_RECORDS);
  if (userOrg.perm_SaveDraft) caps.add(APP_CAPABILITIES.SAVE_DRAFT);
  if (userOrg.perm_Sync) caps.add(APP_CAPABILITIES.SYNC_PEMS);
  if (userOrg.perm_ManageUsers) caps.add(APP_CAPABILITIES.MANAGE_USERS);
  if (userOrg.perm_ManageSettings) caps.add(APP_CAPABILITIES.MANAGE_SETTINGS);
  if (userOrg.perm_ConfigureAlerts) caps.add(APP_CAPABILITIES.CONFIGURE_ALERTS);
  if (userOrg.perm_Impersonate) caps.add(APP_CAPABILITIES.IMPERSONATE_USER);

  // --- Tier 2: JSONB Capabilities → Extended Features ---
  const jsonCapabilities = (userOrg.capabilities as string[]) || [];
  jsonCapabilities.forEach(cap => {
    switch(cap) {
      case 'export_csv':      caps.add(APP_CAPABILITIES.EXPORT_CSV); break;
      case 'export_pdf':      caps.add(APP_CAPABILITIES.EXPORT_PDF); break;
      case 'export_excel':    caps.add(APP_CAPABILITIES.EXPORT_EXCEL); break;
      case 'beta_ai_chat':    caps.add(APP_CAPABILITIES.VIEW_AI_INSIGHTS); break;
      case 'beta_map_view':   caps.add(APP_CAPABILITIES.BETA_MAP_VIEW); break;
      case 'invite_guests':   caps.add(APP_CAPABILITIES.INVITE_GUESTS); break;
      case 'bulk_import':     caps.add(APP_CAPABILITIES.BULK_IMPORT); break;
      case 'advanced_filters': caps.add(APP_CAPABILITIES.ADVANCED_FILTERS); break;
      case 'view_audit_log':  caps.add(APP_CAPABILITIES.VIEW_AUDIT_LOG); break;
    }
  });

  return caps;
};

// Helper functions
export const hasCapability = (caps: Set<string>, capability: string): boolean => {
  return caps.has(capability);
};

export const hasAnyCapability = (caps: Set<string>, capabilities: string[]): boolean => {
  return capabilities.some(cap => caps.has(cap));
};

export const hasAllCapabilities = (caps: Set<string>, capabilities: string[]): boolean => {
  return capabilities.every(cap => caps.has(cap));
};
```

**Route Protection**:
```typescript
// frontend/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { mapUserToCapabilities } from '../constants/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredCapability?: string;
  requiredCapabilities?: string[]; // All required
  anyOfCapabilities?: string[];    // At least one required
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredCapability,
  requiredCapabilities,
  anyOfCapabilities,
}) => {
  const { currentUser, currentUserOrg } = useAuth();

  if (!currentUser || !currentUserOrg) {
    return <Navigate to="/login" replace />;
  }

  const caps = mapUserToCapabilities(currentUserOrg);

  // Single capability check
  if (requiredCapability && !caps.has(requiredCapability)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // All capabilities required
  if (requiredCapabilities && !hasAllCapabilities(caps, requiredCapabilities)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // At least one capability required
  if (anyOfCapabilities && !hasAnyCapability(caps, anyOfCapabilities)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

// Usage in routes
<Routes>
  <Route path="/timeline" element={
    <ProtectedRoute requiredCapability={APP_CAPABILITIES.VIEW_TIMELINE}>
      <TimelinePage />
    </ProtectedRoute>
  } />

  <Route path="/settings/billing" element={
    <ProtectedRoute requiredCapability={APP_CAPABILITIES.MANAGE_BILLING}>
      <BillingPage />
    </ProtectedRoute>
  } />

  <Route path="/admin/impersonate" element={
    <ProtectedRoute requiredCapability={APP_CAPABILITIES.IMPERSONATE_USER}>
      <ImpersonationPage />
    </ProtectedRoute>
  } />

  <Route path="/export" element={
    <ProtectedRoute anyOfCapabilities={[
      APP_CAPABILITIES.EXPORT_CSV,
      APP_CAPABILITIES.EXPORT_PDF,
      APP_CAPABILITIES.EXPORT_EXCEL
    ]}>
      <ExportPage />
    </ProtectedRoute>
  } />
</Routes>
```

**Component Conditional Rendering**:
```typescript
// Component usage
import { APP_CAPABILITIES, mapUserToCapabilities } from '../constants/permissions';

const ExportMenu: React.FC = () => {
  const { currentUserOrg } = useAuth();
  const caps = mapUserToCapabilities(currentUserOrg);

  const hasExportCapability = hasAnyCapability(caps, [
    APP_CAPABILITIES.EXPORT_CSV,
    APP_CAPABILITIES.EXPORT_PDF,
    APP_CAPABILITIES.EXPORT_EXCEL
  ]);

  if (!hasExportCapability) return null; // Hide entire menu

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Download className="w-4 h-4" />
        Export
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {caps.has(APP_CAPABILITIES.EXPORT_CSV) && (
          <DropdownMenuItem onClick={handleExportCSV}>
            Export CSV
          </DropdownMenuItem>
        )}
        {caps.has(APP_CAPABILITIES.EXPORT_PDF) && (
          <DropdownMenuItem onClick={handleExportPDF}>
            Export PDF
          </DropdownMenuItem>
        )}
        {caps.has(APP_CAPABILITIES.EXPORT_EXCEL) && (
          <DropdownMenuItem onClick={handleExportExcel}>
            Export Excel
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
```

**How it handles growth**:
- **New Screen**: Create `/insights/ai`. Invent capability `APP_CAPABILITIES.VIEW_AI_INSIGHTS`. Add `'beta_ai_chat'` to user's `capabilities` JSON. Route is instantly protected:
  ```typescript
  <Route path="/insights/ai" element={
    <ProtectedRoute requiredCapability={APP_CAPABILITIES.VIEW_AI_INSIGHTS}>
      <AIInsightsPage />
    </ProtectedRoute>
  } />
  ```

---

#### Pattern 5: SystemDictionary Table (Dynamic Dropdowns)

**Problem**: Hardcoding dropdown options ("Equipment Categories", "Unit Types", "Notification Channels") in code means **deployments for every new option**.

**Solution**: Generic table to store system-wide lists that admins can manage via UI.

**Implementation**:
```prisma
model SystemDictionary {
  id          String   @id @default(cuid())
  category    String   // "EquipmentClass", "UnitOfMeasure", "NotificationChannel", "TimeZone"
  key         String   // "ton", "kg", "email", "America/New_York"
  label       String   // "Metric Ton", "Kilogram", "Email Notification", "New York (EST/EDT)"
  displayOrder Int     @default(0)
  isActive    Boolean  @default(true)

  // Optional metadata (JSONB for flexibility)
  // Examples: { "icon": "envelope", "color": "#3b82f6", "conversion_factor": 1000 }
  metadata    Json?    @default("{}")

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([category, key])
  @@index([category, isActive, displayOrder])
}
```

**Seeded Data Examples**:
```typescript
// backend/prisma/seed.ts - Seed SystemDictionary
const systemDictionaries = [
  // Equipment Classes
  { category: "EquipmentClass", key: "crane", label: "Crane", displayOrder: 1 },
  { category: "EquipmentClass", key: "excavator", label: "Excavator", displayOrder: 2 },
  { category: "EquipmentClass", key: "bulldozer", label: "Bulldozer", displayOrder: 3 },
  { category: "EquipmentClass", key: "loader", label: "Loader", displayOrder: 4 },

  // Units of Measure
  { category: "UnitOfMeasure", key: "ton", label: "Metric Ton", displayOrder: 1, metadata: { conversion_to_kg: 1000 } },
  { category: "UnitOfMeasure", key: "kg", label: "Kilogram", displayOrder: 2, metadata: { conversion_to_kg: 1 } },
  { category: "UnitOfMeasure", key: "lb", label: "Pound", displayOrder: 3, metadata: { conversion_to_kg: 0.453592 } },

  // Notification Channels
  { category: "NotificationChannel", key: "email", label: "Email", displayOrder: 1, metadata: { icon: "envelope", color: "#3b82f6" } },
  { category: "NotificationChannel", key: "sms", label: "SMS", displayOrder: 2, metadata: { icon: "message-square", color: "#10b981" } },
  { category: "NotificationChannel", key: "in_app", label: "In-App", displayOrder: 3, metadata: { icon: "bell", color: "#f59e0b" } },
  { category: "NotificationChannel", key: "slack", label: "Slack", displayOrder: 4, metadata: { icon: "slack", color: "#4a154b" } },
  { category: "NotificationChannel", key: "teams", label: "Microsoft Teams", displayOrder: 5, metadata: { icon: "microsoft", color: "#5558af" } },

  // Time Zones (for user preferences)
  { category: "TimeZone", key: "America/New_York", label: "New York (EST/EDT)", displayOrder: 1 },
  { category: "TimeZone", key: "America/Chicago", label: "Chicago (CST/CDT)", displayOrder: 2 },
  { category: "TimeZone", key: "America/Denver", label: "Denver (MST/MDT)", displayOrder: 3 },
  { category: "TimeZone", key: "America/Los_Angeles", label: "Los Angeles (PST/PDT)", displayOrder: 4 },
  { category: "TimeZone", key: "Europe/London", label: "London (GMT/BST)", displayOrder: 5 },

  // Project Phases (for filtering)
  { category: "ProjectPhase", key: "planning", label: "Planning", displayOrder: 1 },
  { category: "ProjectPhase", key: "execution", label: "Execution", displayOrder: 2 },
  { category: "ProjectPhase", key: "closeout", label: "Closeout", displayOrder: 3 },
];

await prisma.systemDictionary.createMany({ data: systemDictionaries });
```

**Backend API**:
```typescript
// backend/src/routes/systemDictionary.ts
import express from 'express';
import { prisma } from '../config/database';

const router = express.Router();

// Get all entries for a category
router.get('/api/system-dictionary/:category', async (req, res) => {
  const { category } = req.params;

  const entries = await prisma.systemDictionary.findMany({
    where: { category, isActive: true },
    orderBy: { displayOrder: 'asc' },
  });

  res.json(entries);
});

// Admin: Create new entry
router.post('/api/system-dictionary', requirePermission('perm_ManageSettings'), async (req, res) => {
  const { category, key, label, displayOrder, metadata } = req.body;

  const entry = await prisma.systemDictionary.create({
    data: { category, key, label, displayOrder, metadata },
  });

  res.json(entry);
});

// Admin: Update entry
router.put('/api/system-dictionary/:id', requirePermission('perm_ManageSettings'), async (req, res) => {
  const { id } = req.params;
  const { label, displayOrder, isActive, metadata } = req.body;

  const entry = await prisma.systemDictionary.update({
    where: { id },
    data: { label, displayOrder, isActive, metadata },
  });

  res.json(entry);
});

// Admin: Delete entry (soft delete)
router.delete('/api/system-dictionary/:id', requirePermission('perm_ManageSettings'), async (req, res) => {
  const { id } = req.params;

  await prisma.systemDictionary.update({
    where: { id },
    data: { isActive: false },
  });

  res.json({ success: true });
});

export default router;
```

**Frontend Usage**:
```typescript
// frontend/hooks/useSystemDictionary.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';

export const useSystemDictionary = (category: string) => {
  return useQuery({
    queryKey: ['system-dictionary', category],
    queryFn: () => apiClient.get(`/api/system-dictionary/${category}`),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};

// Component usage
const EquipmentClassFilter: React.FC = () => {
  const { data: classes, isLoading } = useSystemDictionary('EquipmentClass');

  if (isLoading) return <Skeleton className="w-full h-10" />;

  return (
    <Select>
      <SelectTrigger>Select Equipment Class</SelectTrigger>
      <SelectContent>
        {classes.map(cls => (
          <SelectItem key={cls.key} value={cls.key}>
            {cls.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// Dynamic notification channel icons
const NotificationChannelIcon: React.FC<{ channel: string }> = ({ channel }) => {
  const { data: channels } = useSystemDictionary('NotificationChannel');
  const channelData = channels?.find(c => c.key === channel);
  const metadata = channelData?.metadata as { icon?: string; color?: string };

  return (
    <div style={{ color: metadata?.color }}>
      <Icon name={metadata?.icon || 'bell'} />
      {channelData?.label}
    </div>
  );
};
```

**Admin UI for Managing Dictionaries**:
```typescript
// frontend/components/admin/SystemDictionaryManager.tsx
const SystemDictionaryManager: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('EquipmentClass');
  const { data: entries, refetch } = useSystemDictionary(selectedCategory);

  const handleAddEntry = async (data: { key: string; label: string }) => {
    await apiClient.post('/api/system-dictionary', {
      category: selectedCategory,
      ...data,
      displayOrder: (entries?.length || 0) + 1,
    });
    refetch();
  };

  const handleUpdateEntry = async (id: string, data: Partial<SystemDictionary>) => {
    await apiClient.put(`/api/system-dictionary/${id}`, data);
    refetch();
  };

  return (
    <div className="space-y-4">
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList>
          <TabsTrigger value="EquipmentClass">Equipment Classes</TabsTrigger>
          <TabsTrigger value="UnitOfMeasure">Units of Measure</TabsTrigger>
          <TabsTrigger value="NotificationChannel">Channels</TabsTrigger>
          <TabsTrigger value="TimeZone">Time Zones</TabsTrigger>
        </TabsList>
      </Tabs>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Order</TableHead>
            <TableHead>Active</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries?.map(entry => (
            <TableRow key={entry.id}>
              <TableCell>{entry.key}</TableCell>
              <TableCell>{entry.label}</TableCell>
              <TableCell>{entry.displayOrder}</TableCell>
              <TableCell>
                <Switch checked={entry.isActive} onCheckedChange={(checked) =>
                  handleUpdateEntry(entry.id, { isActive: checked })
                } />
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => openEditDialog(entry)}>
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Button onClick={() => openAddDialog()}>
        <Plus className="w-4 h-4 mr-2" />
        Add {selectedCategory}
      </Button>
    </div>
  );
};
```

**How it handles growth**:
- **New Unit of Measure**: Admin opens SystemDictionary UI, clicks "Add Unit", enters "Barrel" with conversion factor. No code deployment. Dropdown instantly updated.
- **New Equipment Class**: Admin adds "Tower Crane" via UI. All filter dropdowns fetch dynamically and show new option.
- **New Notification Channel**: Admin adds "WhatsApp" as channel. Users can now subscribe to WhatsApp notifications.

---

#### Complete Updated Schemas

**Updated UserOrganization** (with Tier 2 capabilities):
```prisma
model UserOrganization {
  id             String   @id @default(cuid())
  userId         String
  organizationId String
  roleTemplateId String?

  // --- TIER 1: STRUCTURAL SECURITY (Columns - Database Filtered) ---
  perm_Read              Boolean @default(true)
  perm_EditForecast      Boolean @default(false)
  perm_EditActuals       Boolean @default(false)
  perm_Delete            Boolean @default(false)
  perm_Import            Boolean @default(false) // Upload CSV/Excel to import data
  perm_RefreshData       Boolean @default(false) // Trigger manual PEMS sync
  perm_Export            Boolean @default(false) // Export data to Excel/CSV
  perm_ViewFinancials    Boolean @default(false)
  perm_SaveDraft         Boolean @default(false)
  perm_Sync              Boolean @default(false)
  perm_ManageUsers       Boolean @default(false)
  perm_ManageSettings    Boolean @default(false)
  perm_ConfigureAlerts   Boolean @default(false)
  perm_Impersonate       Boolean @default(false)

  // --- TIER 2: FEATURE EXPANSION (JSONB - UI Filtered) ---
  capabilities           Json    @default("[]")      // ["export_csv", "export_pdf", "beta_ai_chat"]
  uiPreferences          Json    @default("{}")      // { "grid_density": "compact" }

  // Override & Temporal Access (existing)
  isCustom       Boolean  @default(false)
  accessExpiresAt DateTime?

  // Audit Trail (existing)
  grantedAt      DateTime @default(now())
  grantedBy      String?
  modifiedAt     DateTime?
  modifiedBy     String?
  revokedAt      DateTime?
  revokedBy      String?

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([userId, organizationId])
  @@index([userId, isActive])
  @@index([organizationId, isActive])
  @@index([accessExpiresAt])
}
```

**Updated Organization** (with settings bag):
```prisma
model Organization {
  id          String   @id @default(cuid())
  code        String   @unique
  name        String

  // Service Control (existing)
  isActive      Boolean  @default(true)
  serviceStatus String   @default("active")
  enableSync    Boolean  @default(true)

  // --- CONFIG BAG (NEW) ---
  settings Json @default("{}")  // { "fiscal_start": 4, "allow_public_share": false }

  // Metadata (existing)
  suspendedAt      DateTime?
  suspendedBy      String?
  suspensionReason String?
  lastSyncAt       DateTime?

  // Relations (existing)
  users            UserOrganization[]
  pfaRecords       PfaRecord[]
  apiCredentials   OrganizationApiCredentials[]
  integrations     OrganizationIntegration[]
  roles            OrganizationRole[]

  @@index([id])
}
```

**Updated User** (with preferences):
```prisma
model User {
  id       String @id @default(cuid())
  username String @unique
  email    String @unique

  // Service Control (existing)
  isActive         Boolean  @default(true)
  serviceStatus    String   @default("active")
  suspendedAt      DateTime?
  suspendedBy      String?
  suspensionReason String?
  lastLoginAt      DateTime?

  // Account Security (existing)
  failedLoginCount Int      @default(0)
  lockedAt         DateTime?

  // --- UI PREFERENCES (NEW) ---
  preferences Json @default("{}")  // { "theme": "dark", "language": "en" }

  // Relations (existing)
  organizations               UserOrganization[]
  sessions                    UserSession[]
  notificationPreferences     UserNotificationPreferences?
}
```

**Updated UserNotificationPreferences** (with topic subscriptions):
```prisma
model UserNotificationPreferences {
  id     String @id @default(cuid())
  userId String @unique

  // --- TOPIC SUBSCRIPTIONS (JSONB) - NEW ---
  subscriptions Json @default("{}")  // { "pems:sync:fail": ["email", "slack"] }

  // Global Channel Preferences (existing)
  enableEmail     Boolean  @default(true)
  enableInApp     Boolean  @default(true)
  enableSms       Boolean  @default(false)
  enablePush      Boolean  @default(true)
  enableSlack     Boolean  @default(false)
  enableTeams     Boolean  @default(false)

  // Digest & Quiet Hours (existing)
  digestFrequency   String   @default("instant")
  quietHoursEnabled Boolean  @default(false)
  quietHoursStart   String?
  quietHoursEnd     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**New SystemDictionary Table**:
```prisma
model SystemDictionary {
  id          String   @id @default(cuid())
  category    String   // "EquipmentClass", "UnitOfMeasure", "NotificationChannel"
  key         String   // "ton", "email", "America/New_York"
  label       String   // "Metric Ton", "Email Notification", "New York (EST/EDT)"
  displayOrder Int     @default(0)
  isActive    Boolean  @default(true)
  metadata    Json?    @default("{}")  // { "icon": "envelope", "color": "#3b82f6" }
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([category, key])
  @@index([category, isActive, displayOrder])
}
```

---

#### Decision Rule Summary

| Use This Pattern | When You Need | Examples |
|-----------------|---------------|----------|
| **Column (Tier 1)** | Database filtering (WHERE clauses), high-performance security checks | `perm_Read`, `perm_EditForecast`, `perm_ViewFinancials` |
| **Column (Data Operations)** | Backend enforcement, rate limiting, audit logging required | `perm_Import`, `perm_RefreshData`, `perm_Export` |
| **Capability (Tier 2)** | UI feature toggles, beta features, export formats | `export_pdf`, `beta_ai_chat`, `invite_guests` |
| **Settings Bag** | Organizational config, user preferences | `fiscal_start`, `theme`, `language`, `timezone` |
| **Topic Subscriptions** | Notification preferences | `pems:sync:fail`, `budget:exceeded`, `security:login` |
| **SystemDictionary** | Dropdown options, admin-configurable lists | Equipment classes, units of measure, time zones |

---

#### Migration Strategy

**Phase 1: Add JSONB Columns (No Breaking Changes)**
```sql
-- Add new JSONB columns with default empty values
ALTER TABLE "UserOrganization" ADD COLUMN "capabilities" JSONB DEFAULT '[]';
ALTER TABLE "UserOrganization" ADD COLUMN "uiPreferences" JSONB DEFAULT '{}';
ALTER TABLE "Organization" ADD COLUMN "settings" JSONB DEFAULT '{}';
ALTER TABLE "User" ADD COLUMN "preferences" JSONB DEFAULT '{}';
ALTER TABLE "UserNotificationPreferences" ADD COLUMN "subscriptions" JSONB DEFAULT '{}';

-- Create SystemDictionary table
CREATE TABLE "SystemDictionary" (...);

-- Seed SystemDictionary with initial data
INSERT INTO "SystemDictionary" (...) VALUES (...);
```

**Phase 2: Migrate Existing Notification Preferences (If Applicable)**
```typescript
// If you previously had boolean columns like notifyOnSyncFailure, migrate to subscriptions
const users = await prisma.userNotificationPreferences.findMany();

for (const user of users) {
  const subscriptions: Record<string, string[]> = {};

  // Map old boolean columns to new topic subscriptions
  if (user.notifyOnSyncFailure) {
    subscriptions['pems:sync:fail'] = ['email', 'in_app'];
  }
  if (user.notifyOnBudget) {
    subscriptions['budget:alert'] = ['email', 'in_app'];
  }
  if (user.notifyOnSecurity) {
    subscriptions['security:login'] = ['email'];
  }

  await prisma.userNotificationPreferences.update({
    where: { id: user.id },
    data: { subscriptions }
  });
}

// After migration completes, drop old boolean columns
ALTER TABLE "UserNotificationPreferences" DROP COLUMN "notifyOnSyncFailure";
ALTER TABLE "UserNotificationPreferences" DROP COLUMN "notifyOnBudget";
ALTER TABLE "UserNotificationPreferences" DROP COLUMN "notifyOnSecurity";
```

**Phase 3: Update Frontend to Use mapUserToCapabilities**
```typescript
// Replace all hardcoded permission checks
// OLD:
if (userOrg.perm_ManageUsers) { ... }

// NEW:
const caps = mapUserToCapabilities(userOrg);
if (caps.has(APP_CAPABILITIES.MANAGE_USERS)) { ... }
```

**Phase 4: Update Backend to Validate JSONB**
```typescript
// Add Zod validation for all JSONB fields
import { UserCapabilitiesSchema, OrganizationSettingsSchema } from './schemas';

// In API endpoints
const capabilities = UserCapabilitiesSchema.parse(req.body.capabilities);
const settings = OrganizationSettingsSchema.parse(req.body.settings);
```

**Phase 5: Deploy SystemDictionary Admin UI**
```typescript
// Enable admins to manage dropdown options dynamically
<Route path="/admin/system-dictionary" element={
  <ProtectedRoute requiredCapability={APP_CAPABILITIES.MANAGE_SETTINGS}>
    <SystemDictionaryManager />
  </ProtectedRoute>
} />
```

**Timeline**: 2-3 days (non-breaking changes, can be deployed incrementally)

---

### 12. System-Level Access (BEO Mode - Portfolio Oversight)

**Problem**: Business Executive Oversight (BEO) users need to view aggregate metrics across ALL organizations (portfolio dashboard) without being manually assigned to 500+ organizations.

**Current Limitation**: The system only supports organization-scoped permissions. A BEO executive would need 500 individual `UserOrganization` records.

**Solution**: Introduce **System Roles** - permissions that exist above the organization level.

**Architecture**: Three-tier permission model

```
┌─────────────────────────────────────────────┐
│  TIER 1: SYSTEM LEVEL (BEO Mode)           │
│  - Portfolio Dashboard (all orgs)           │
│  - Global Reports                           │
│  - Cross-Org Analytics                      │
└─────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────┐
│  TIER 2: ORGANIZATION LEVEL                 │
│  - Single org access                        │
│  - Role templates                           │
│  - User overrides                           │
└─────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────┐
│  TIER 3: USER LEVEL                         │
│  - Personal preferences                     │
│  - UI customization                         │
└─────────────────────────────────────────────┘
```

**Database Schema**:

```prisma
model SystemRole {
  id          String   @id @default(cuid())
  name        String   @unique // "BEO Executive", "SysAdmin", "Global Auditor"
  description String?

  // System-Level Permissions
  perm_ViewAllOrgs         Boolean  @default(false) // Portfolio Dashboard (Glass Mode)
  perm_ManageSystem        Boolean  @default(false) // System settings (IT Ops)
  perm_ManageGlobalUsers   Boolean  @default(false) // Create/suspend users across orgs (HR)
  perm_ViewGlobalAuditLog  Boolean  @default(false) // Compliance auditor
  perm_ManageIntegrations  Boolean  @default(false) // Configure Slack/Teams globally

  // Metadata
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  createdBy   String?

  // Relations
  users       User[]
}

model User {
  id          String   @id @default(cuid())
  username    String   @unique
  email       String   @unique

  // System Role Assignment (NULL = regular user)
  systemRoleId String?
  systemRole   SystemRole? @relation(fields: [systemRoleId], references: [id])

  // ... existing fields ...
}
```

**BEO Functionality**:

1. **Portfolio Dashboard** (New Screen)
   - Aggregate metrics across ALL active organizations:
     - Total Budget: $X million
     - Total Spend: $Y million
     - Variance: $Z million (red/green)
     - Active Organizations: 28
     - Active Users: 145
   - Drill-down: Click any organization → Enter "Read-Only View" without explicit assignment

2. **Cross-Org Analytics**
   - Bubble chart: Spend vs. Budget by Organization
   - Top 10 Over-Budget Organizations
   - Top 10 Under-Budget Organizations
   - Equipment utilization heatmap

3. **Live Activity Stream**
   - Real-time feed of major changes across all organizations:
     - "User John Doe shifted 50 equipment dates in Org HOLNG"
     - "Budget exceeded in Org RIO by 15%"
     - "PEMS sync failed for Org BECH (3rd failure)"

4. **Drill-Down Behavior**:
   ```typescript
   // Authorization Logic
   if (user.systemRole?.perm_ViewAllOrgs) {
     // BEO user can view ANY organization
     const org = await getOrganization(orgId);
     return {
       canView: true,
       canEdit: false, // Glass Mode (read-only)
       source: 'SYSTEM_ROLE_BEO'
     };
   } else {
     // Regular user: Check UserOrganization
     const userOrg = await getUserOrganization(user.id, orgId);
     if (!userOrg) return { canView: false };
     return {
       canView: userOrg.perm_Read,
       canEdit: userOrg.perm_EditForecast || userOrg.perm_EditActuals,
       source: 'ORG_ASSIGNMENT'
     };
   }
   ```

**UI Indicators**:
- BEO users see orange "Portfolio View" banner when viewing drill-down
- BEO users cannot edit data unless ALSO assigned via `UserOrganization` (override)
- Navigation: "Portfolio Dashboard" → "All Organizations" → Click org → "Read-Only Org View"

**Security**:
- System roles require approval from existing SysAdmin
- Audit log tracks all BEO drill-down actions: "BEO Executive viewed Org HOLNG at timestamp"
- BEO users cannot grant themselves organization-level edit permissions

**Use Cases**:
- **CFO**: Views portfolio dashboard to monitor budget across all projects
- **IT Director**: Manages system settings, integrations, global user accounts
- **Compliance Auditor**: Views global audit log to generate compliance reports
- **Support Agent**: Can view (but not edit) any organization to troubleshoot user issues

---

## User Stories

### User Story 1: Hybrid Role-Override Architecture

**As an** Admin,
**I want to** create reusable role templates (e.g., "Project Manager") and assign them to users while optionally narrowing down permissions for specific users,
**So that** I can maintain consistency across users while allowing exceptions without recreating the entire permission set.

**Acceptance Criteria**:
- [ ] Admin can create/edit/delete "OrganizationRole" templates via Admin UI
- [ ] When assigning user to organization, admin selects a template from dropdown
- [ ] System copies template's 14 permission flags to `UserOrganization` instance
- [ ] Permission categories clearly labeled in UI: Data Scope (4), Data Operations (3), Financials (1), Process (2), Admin (4)
- [ ] Forecast editing (`perm_EditForecast`) and Actuals editing (`perm_EditActuals`) shown as separate toggles
- [ ] Admin can uncheck specific permissions after template selection (e.g., remove "canDelete" for this user)
- [ ] System sets `isCustom=true` when permissions differ from template
- [ ] UI shows "Custom / Modified" badge next to user's role name if `isCustom=true`
- [ ] Bulk template updates do NOT overwrite users with `isCustom=true` by default (modal asks "Update All" vs. "Update Standard Only")
- [ ] Audit log tracks: `templateId`, `isCustom`, `grantedBy`, `grantedAt`, `modifiedBy`, `modifiedAt`
- [ ] **Tier 2 Capabilities**: Admin can assign UI-level capabilities (e.g., `export_pdf`, `beta_ai_chat`) without database migration
- [ ] **UI Preferences**: User-specific settings (e.g., `grid_density`, `default_view`) stored in `uiPreferences` JSONB field
- [ ] **Validation**: Backend validates `capabilities` array using Zod schema (rejects unknown capability names)

---

### User Story 2: Financial Data Masking for Restricted Users

**As an** Admin,
**I want to** restrict cost/budget visibility for certain users (e.g., contractors),
**So that** I can comply with contract terms that prohibit sharing financial data.

**Acceptance Criteria**:
- [ ] `perm_ViewFinancials` flag exists in both `OrganizationRole` template and `UserOrganization` instance
- [ ] Grid View: Financial columns (`monthlyRate`, `purchasePrice`, `totalCost`) show `*****` or blurred text if `perm_ViewFinancials=false`
- [ ] API Response: Backend nullifies financial fields before sending response if user lacks `perm_ViewFinancials`
- [ ] CSV/Excel Export: Financial columns excluded entirely from export file if `perm_ViewFinancials=false`
- [ ] Matrix View: Cost metrics hidden or show "Restricted" message
- [ ] KPI Board: Budget/variance cards hidden if `perm_ViewFinancials=false`
- [ ] No bypass via "Inspect Element" or direct API access (enforced server-side)

---

### User Story 3: Temporal Access for Contractors

**As an** Admin,
**I want to** set an expiration date when assigning a contractor to an organization,
**So that** access automatically expires after the contract ends without manual cleanup.

**Acceptance Criteria**:
- [ ] `accessExpiresAt` field exists on `UserOrganization` table (nullable, default NULL = permanent)
- [ ] Admin UI shows "Access Expires" date picker when assigning user
- [ ] Middleware checks `accessExpiresAt` on every API request: Return 403 if `new Date() > accessExpiresAt`
- [ ] User login rejected if access expired: Error message "Your access expired on [date]. Contact your administrator."
- [ ] System sends notification **7 days before expiration**: "Your access to Org X expires on [date]"
- [ ] Daily cron job (1am) marks expired users as `isActive=false`
- [ ] Admin UI shows "Expired" badge next to user's organization assignment if expired
- [ ] Audit log tracks: `accessExpiresAt`, `expiredAt`, `notifiedAt`

---

### User Story 4: SysAdmin Impersonation Mode ("View As")

**As a** SysAdmin,
**I want to** temporarily view the system with the exact permissions of another user,
**So that** I can troubleshoot "Why can't user X see this data?" without asking for their password.

**Acceptance Criteria**:
- [ ] "View As" button visible on user profile page (only for users with `perm_Impersonate=true`)
- [ ] Clicking "View As" triggers API call: `POST /api/auth/impersonate/:userId`
- [ ] Backend issues **temporary JWT (15 min expiry)** with target user's permissions (all claims copied from target user's `UserOrganization` records)
- [ ] Frontend stores temp JWT in sessionStorage (NOT localStorage)
- [ ] UI shows **persistent orange banner** at top: "You are viewing as John Doe. [Exit Impersonation]"
- [ ] All API requests use temp JWT (includes `impersonatedBy` claim)
- [ ] All actions logged in audit log: `"SysAdmin impersonated User X at timestamp"`
- [ ] Clicking "Exit" or 15-minute expiry restores original JWT
- [ ] Security: Only users with `perm_Impersonate=true` can impersonate (typically SysAdmins only)

---

### User Story 5: Session Management & Kill Switch

**As an** Admin,
**I want to** view all active sessions for a user and revoke any session immediately,
**So that** I can respond to security incidents (e.g., "My account was hacked") in real-time.

**Acceptance Criteria**:
- [ ] Admin UI shows "Active Sessions" table on user profile page
- [ ] Table columns: Device Type, Browser, IP Address, Location (city/state), Last Active timestamp
- [ ] "Revoke" button next to each session
- [ ] Clicking "Revoke" triggers API call: `POST /api/auth/sessions/:sessionId/revoke`
- [ ] Backend adds JWT ID (`jti`) to Redis blocklist: `SET blocklist:{jti} "revoked" EX 604800` (7 days TTL)
- [ ] Backend disconnects user's WebSocket connection (if online)
- [ ] User's next API call receives 401 error: "Session revoked, please login again"
- [ ] Revoked sessions shown with strikethrough in Admin UI
- [ ] Middleware checks Redis blocklist on every request: `if (await redis.exists('blocklist:{jti}')) return 401`
- [ ] Audit log tracks: `sessionId`, `revokedBy`, `revokedAt`, `reason`

---

### User Story 6: Multi-Channel Notification System

**As a** User,
**I want to** receive notifications via multiple channels (Email, In-App, SMS, Slack, Teams) and configure which events I want to be notified about,
**So that** I can stay informed about important system events without being overwhelmed by irrelevant notifications.

**Acceptance Criteria**:
- [ ] User settings page shows "Notification Preferences" section
- [ ] User can enable/disable each channel: Email, In-App, Push, SMS, Slack, Teams (checkboxes)
- [ ] User can enable/disable event types: Sync Success/Failure, Budget Alerts, Security Alerts, Permission Changes, Expiration Warnings
- [ ] User can set digest frequency: Instant, Daily (8am), Weekly (Monday 8am)
- [ ] User can set quiet hours: Start time (e.g., 18:00), End time (e.g., 08:00), Enable/Disable checkbox
- [ ] Non-urgent notifications held during quiet hours, delivered at quiet hours end
- [ ] Urgent notifications (security alerts) bypass quiet hours
- [ ] Backend event bus emits events: `eventBus.emit('pfa.sync.failed', { userId, metadata })`
- [ ] Smart router loads user preferences and routes to appropriate channels
- [ ] Audit log tracks: `notificationId`, `userId`, `eventType`, `channel`, `sentAt`, `deliveryStatus`

---

### User Story 7: Smart Notification Batching

**As a** User,
**I want** rapid-fire events (e.g., 50 sync errors in 60 seconds) to be aggregated into a single notification,
**So that** I'm not overwhelmed by notification spam during bulk operations.

**Acceptance Criteria**:
- [ ] System waits 60 seconds after first event of same type
- [ ] Events within 60-second window aggregated into batch
- [ ] Single notification sent with aggregate message: "Bulk Import Failed: 50 errors detected. View details: [Link]"
- [ ] Batching applies to: Sync failures, budget alerts, import errors
- [ ] Batching does NOT apply to: Security alerts, session revocations (always instant)
- [ ] Redis queue stores pending events with 60-second TTL
- [ ] Notification includes breakdown: "Errors by type: API timeout (30), Invalid data (15), Network error (5)"
- [ ] Clicking notification opens detail view with all individual events
- [ ] Batching reduces notification volume by >70% during bulk operations (measured in tests)

---

### User Story 8: In-App Notification Pop-Out Drawer

**As a** User,
**I want to** see a bell icon with unread count and click it to open a notification drawer,
**So that** I can quickly review recent system events without leaving the current page.

**Acceptance Criteria**:
- [ ] Bell icon in top nav bar shows unread count badge: "(3)"
- [ ] Clicking bell icon opens slide-out drawer from right side
- [ ] Drawer has two tabs: "Unread" and "All"
- [ ] Unread tab shows only unread notifications (max 50)
- [ ] All tab shows all notifications (paginated, 20 per page)
- [ ] Each notification shows: Icon, Title, Message, Timestamp (relative: "2 minutes ago")
- [ ] Clicking notification marks it as read and navigates to relevant page (e.g., sync details)
- [ ] "Mark All Read" button at top of drawer
- [ ] Real-time updates via WebSocket (no manual refresh needed)
- [ ] Toast notifications appear in bottom-right corner for critical alerts (auto-dismiss after 5 seconds)
- [ ] Drawer persists across page navigations (doesn't close when navigating)

---

### User Story 9: Organization Slack/Teams Integration

**As an** Admin,
**I want to** configure a Slack or Teams webhook URL for my organization,
**So that** critical system events (e.g., "Budget exceeded") are posted to our team channel.

**Acceptance Criteria**:
- [ ] Admin UI shows "Integrations" section in Organization settings
- [ ] Admin can add Slack webhook URL and select channel name (e.g., "#pfa-alerts")
- [ ] Admin can add Teams webhook URL
- [ ] Admin can configure event routing: "Notify on Sync Failures", "Notify on Budget Alerts", "Notify on Security Alerts" (checkboxes)
- [ ] System posts Adaptive Cards to Slack/Teams with rich formatting
- [ ] Adaptive Card includes: Title, Message, Timestamp, Action buttons ("Retry Sync", "View Details")
- [ ] Clicking action button triggers authenticated API callback: `POST /api/integrations/slack/callback` with signed payload
- [ ] System validates callback signature to prevent spoofing
- [ ] Slack/Teams notifications bypass user quiet hours (organization-level, not user-level)
- [ ] Audit log tracks: `integrationId`, `eventType`, `channel`, `postedAt`, `deliveryStatus`

---

### User Story 10: Role Template Bulk Updates with Conflict Resolution

**As an** Admin,
**I want to** update a role template (e.g., "Project Manager") and have the system propagate changes to assigned users while respecting manual permission overrides,
**So that** I can update permissions for 50 users at once without overwriting customizations.

**Acceptance Criteria**:
- [ ] Admin edits role template via Admin UI (e.g., change "canSync" from false to true)
- [ ] On save, system detects affected users: Query `UserOrganization WHERE roleTemplateId = X`
- [ ] Modal appears: "This template is assigned to 50 users. How would you like to proceed?"
  - **Option 1**: "Update All (50 users)" - Overwrite even users with `isCustom=true`
  - **Option 2**: "Update Standard Only (40 users)" - Skip users with `isCustom=true` (10 skipped)
  - **Option 3**: "Selective Update" - Show list of 50 users with checkboxes, admin selects which to update
- [ ] Bulk update executed in database transaction (all-or-nothing)
- [ ] Updated users' `modifiedAt` and `modifiedBy` fields set
- [ ] Updated users receive notification: "Your permissions for Org X have been updated by Admin Y"
- [ ] Audit log tracks: `templateId`, `userIds`, `updateStrategy`, `updatedBy`, `updatedAt`
- [ ] If update fails (e.g., database error), transaction rolled back and error message shown

---

### User Story 11: BEO Portfolio Oversight

**As a** Business Executive (BEO),
**I want to** view aggregate metrics across all organizations without being manually assigned to each one,
**So that** I can monitor portfolio health and identify over-budget projects without administrative overhead.

**Acceptance Criteria**:
- [ ] System role "BEO Executive" can be assigned to users via Admin UI
- [ ] Users with `perm_ViewAllOrgs=true` can access Portfolio Dashboard
- [ ] Portfolio Dashboard shows aggregate metrics: Total Budget, Total Spend, Variance, Active Orgs, Active Users
- [ ] BEO users can click any organization and enter "Read-Only View" without explicit `UserOrganization` assignment
- [ ] UI shows orange "Portfolio View" banner when BEO user drills down into an organization
- [ ] BEO users cannot edit data unless ALSO assigned via `UserOrganization` (override for specific org)
- [ ] Live Activity Stream shows real-time changes across all organizations
- [ ] Cross-org analytics: Bubble chart (Spend vs. Budget), Top 10 Over/Under Budget
- [ ] Audit log tracks all BEO drill-down actions: "BEO Executive viewed Org X at timestamp"
- [ ] System role assignment requires approval from existing SysAdmin

---

### User Story 12: PFA 1.0 Legacy Import with AI Recommendations

**As an** Organization Owner migrating from PFA 1.0,
**I want to** upload my legacy CSV export and receive AI recommendations for mapping old categories to the new V2 structure,
**So that** I don't have to manually re-enter or re-map thousands of equipment items.

**Acceptance Criteria**:
- [ ] Users with `capabilities` JSONB containing `"feature:import_legacy"` can access Import Wizard
- [ ] Upload screen accepts `pfa_v1_export.csv` (legacy format)
- [ ] AI analyzes legacy data and detects structural differences:
  - V1 "Class A" → AI suggests mapping to V2 "Heavy Lift Category"
  - V1 custom fields → AI suggests mapping to V2 JSONB `metadata` field
- [ ] Migration Preview UI shows:
  - Left column: V1 structure (old categories, fields)
  - Right column: AI-recommended V2 structure (new categories, fields)
  - Confidence score: "95% confident in this mapping"
- [ ] User can accept/reject AI suggestions per field
- [ ] User can manually override AI mappings via dropdown
- [ ] "Commit Migration" button applies mapping and imports data
- [ ] Imported records marked with `importSource = 'PFA_V1_LEGACY'` for audit trail
- [ ] Capability flags:
  - `"feature:import_legacy"` - Can access Import Wizard
  - `"feature:ai_recommendations"` - Can see AI suggestions (otherwise, manual mapping only)
  - `"feature:apply_migration"` - Can click "Commit Migration" button
- [ ] Admin can revoke `"feature:import_legacy"` capability after migration completes (transient feature)
- [ ] Audit log tracks: Migration source, record count, AI acceptance rate, user ID

**AI Recommendation Example**:
```json
{
  "legacyField": "equipmentClass_V1",
  "legacyValue": "Class A - Heavy Crane",
  "recommendedField": "category",
  "recommendedValue": "Heavy Lift",
  "confidence": 0.92,
  "reasoning": "Based on 150 similar mappings in V1 → V2 migrations"
}
```

---

### User Story 13: Immutable Audit Ledger with Contextual History

**As a** BEO Executive or Compliance Officer,
**I want to** view a complete, immutable history of all changes made to any PFA record with before/after diffs and user justifications,
**So that** I can conduct forensic analysis, prove compliance, and understand why budgets changed.

**Acceptance Criteria**:
- [ ] Every PFA record edit creates immutable `AuditLog` entry with `action = "pfa:update"`
- [ ] `changes` JSONB field stores: `{ "before": { "cost": 500 }, "after": { "cost": 600 } }`
- [ ] User must provide `reason` (comment) before syncing changes to PEMS (enforced in Pre-Flight Modal)
- [ ] `metadata` JSONB stores: IP address, user agent, timestamp
- [ ] Bulk operations assign same `batchId` to all related audit entries
- [ ] Timeline view: "History" tab on PFA record shows chronological changes
- [ ] Diff view: Red/Green visual diff showing ~~old value~~ → **new value**
- [ ] BEO Dashboard: "Recent Activity" stream shows real-time changes across all orgs
- [ ] Audit log is **append-only** (no UPDATE or DELETE operations allowed)
- [ ] Backend enforces write-once via Prisma middleware or database trigger
- [ ] Clicking audit entry shows full context: who, what, when, why, before/after

---

### User Story 14: Personal Access Tokens for API Integrations

**As a** Power User,
**I want to** generate API tokens for Excel, PowerBI, or custom scripts without exposing my login password,
**So that** I can securely automate data access with scoped permissions and revocation capability.

**Acceptance Criteria**:
- [ ] User Profile → "Developer Settings" shows "Personal Access Tokens" section
- [ ] "Generate New Token" button opens modal
- [ ] Modal prompts: Token name (e.g., "PowerBI Connect"), Scopes (checkboxes: Read PFA, Read Financials, Write Forecasts), Expiration (dropdown: Never, 30 days, 90 days, 1 year)
- [ ] On submit, backend generates high-entropy token (64 chars), stores bcrypt hash
- [ ] Frontend shows token **once** with copy button: "Make sure to copy your token now. You won't see it again!"
- [ ] Table shows active tokens: Name, Scopes, Last Used, Created, Expiration, [Revoke] button
- [ ] API requests accept token via `Authorization: Bearer <token>` header
- [ ] Backend validates token hash, checks expiration, enforces scopes
- [ ] Token inherits user's org permissions but can be **narrowed** (e.g., user is Admin but token is Read-Only)
- [ ] Clicking "Revoke" immediately invalidates token (sets `revokedAt`)
- [ ] Audit log tracks: Token creation, usage (every API call), revocation
- [ ] API response includes `X-Token-Scopes` header showing active scopes
- [ ] Rate limiting applies per token (not per user)

---

### User Story 15: Secure Invitation Lifecycle with Magic Links

**As an** Admin,
**I want to** invite new users via email with a secure magic link instead of manually creating accounts,
**So that** users can set their own passwords and the invitation expires if not accepted within 48 hours.

**Acceptance Criteria**:
- [ ] Admin UI: "Invite User" button on Organization user management page
- [ ] Modal prompts: Email, Role Template (dropdown), Custom Permissions (optional checkboxes)
- [ ] On submit, backend creates `UserInvitation` record with:
  - High-entropy token (64 chars, crypto-random)
  - `expiresAt = now() + 48 hours`
  - `status = "pending"`
- [ ] System sends email with magic link: `https://app.pfa.com/join?token={token}`
- [ ] Email template includes: Organization name, Role name, Inviter name, Expiration date
- [ ] Clicking link validates token:
  - If expired: Show "Invitation expired. Contact your administrator."
  - If already accepted: Show "This invitation has already been used."
  - If valid: Continue to acceptance flow
- [ ] **Scenario A (New User)**: Redirect to "Set Password" screen → Create User record → Move invitation data to `UserOrganization`
- [ ] **Scenario B (Existing User)**: Auto-accept → Add `UserOrganization` → Redirect to dashboard
- [ ] On acceptance, set `invitation.status = "accepted"`, `invitation.acceptedAt = now()`
- [ ] Admin UI shows invitation status: "Pending" (yellow), "Accepted" (green), "Expired" (red), "Declined" (gray)
- [ ] Admin can "Resend Invitation" (generates new token, extends expiration)
- [ ] Admin can "Revoke Invitation" (sets `status = "declined"`)
- [ ] Audit log tracks: Invitation sent, accepted, expired, revoked

---

### User Story 16: Data Retention with Soft Delete and Trash Can

**As an** Admin,
**I want** deleted records to be soft-deleted with a 30-day recovery window instead of immediately purged,
**So that** I can recover accidentally deleted data and maintain audit trail continuity.

**Acceptance Criteria**:
- [ ] All DELETE operations set `deletedAt = now()` instead of hard delete
- [ ] Tables with soft delete: User, Organization, OrganizationRole, UserOrganization, PfaRecord
- [ ] Prisma middleware automatically filters deleted records: `WHERE deletedAt IS NULL`
- [ ] Admin UI: "Trash Can" view shows deleted records with columns: Name, Deleted By, Deleted At, [Restore] [Delete Permanently]
- [ ] "Restore" button clears `deletedAt` field (record becomes active again)
- [ ] "Delete Permanently" button prompts confirmation modal: "This cannot be undone. Type DELETE to confirm."
- [ ] On permanent delete, backend checks dependencies:
  - If Organization has PFA records: "Cannot delete. 1,500 PFA records depend on this organization."
  - If User has audit log entries: "Cannot delete. Audit trail references this user."
- [ ] Auto-cleanup cron job (daily 2am): Hard delete records where `deletedAt < now() - 30 days`
- [ ] Audit log tracks: Soft delete, restore, permanent delete
- [ ] Soft-deleted records excluded from all queries except Trash Can view
- [ ] API responses never include `deletedAt != NULL` records (enforced server-side)

---

### User Story 17: Pre-Flight Review with Mandatory Change Justification

**As a** User with `perm_Sync`,
**I want to** see a detailed impact preview before syncing changes to PEMS and provide a mandatory justification comment,
**So that** I understand what I'm changing and create a proper audit trail.

**Acceptance Criteria**:
- [ ] Clicking "Sync to PEMS" button triggers Pre-Flight Modal (does NOT immediately sync)
- [ ] Modal header: "Review Changes Before Syncing"
- [ ] Impact Summary section:
  - "You are modifying **15** records"
  - "Net Budget Impact: **+$12,500**" (color: red if over budget, green if under)
  - "Affected Categories: HVAC (8), Heavy Lift (5), Electrical (2)"
- [ ] Detailed Diff Table:
  - Columns: Record ID, Field, Before (red strikethrough), After (green bold), Cost Delta
  - Row example: `PFA-123 | forecastEnd | ~~Jan 1, 2025~~ | **Jan 5, 2025** | +$1,200`
  - Sortable by cost delta (show biggest budget impacts first)
- [ ] **Mandatory Comment Field**: "Reason for Change" (textarea, required, min 10 chars)
  - Placeholder: "Explain why these changes are necessary (e.g., 'Weather delay extension')"
- [ ] Buttons: [Cancel] [Confirm & Sync] (Confirm disabled until comment provided)
- [ ] On confirm:
  - API call: `POST /api/pfa/sync` with `{ organizationId, changeReason, records[] }`
  - Backend validates `changeReason` is non-empty
  - Creates audit log entries with `reason = changeReason`, `batchId = {uuid}`
  - Syncs to PEMS Grid Data API
- [ ] If sync fails, show error details and allow retry without re-entering comment
- [ ] Audit log `changes` field stores diff data: `{ "before": {...}, "after": {...} }`
- [ ] Pre-Flight Modal accessible for review mode: "View Last Sync Impact" (read-only, no editing)

---

### User Story 18: Revert/Undo Capability Using Audit Log

**As an** Admin,
**I want to** revert a mistaken sync by clicking "Undo" on an audit log entry,
**So that** I can rollback changes that were synced to PEMS without manual re-entry.

**Acceptance Criteria**:
- [ ] Audit Log view (accessible via Admin Dashboard or PFA History tab)
- [ ] Each audit entry shows: Timestamp, User, Action, Reason, [View Details] [Revert]
- [ ] "Revert" button only visible for `action = "pfa:update"` with `syncState = "completed"`
- [ ] Clicking "Revert" opens confirmation modal:
  - "You are about to revert transaction [ID] performed by [User] on [Date]"
  - Shows diff table: "This will restore these values" (Before column highlighted)
  - Warning: "This will create a new sync to PEMS. Cannot be undone."
  - Checkbox: "I understand this creates a compensating transaction"
- [ ] On confirm:
  - Backend reads `AuditLog.changes` JSONB
  - Extracts `before` values
  - Creates new sync payload with `before` values
  - Submits to PEMS as new sync
  - Creates new audit log entry:
    - `action = "pfa:revert"`
    - `reason = "Revert of transaction {batchId} by {Admin}"`
    - `metadata.originalBatchId = {batchId}`
- [ ] If batch has 50 records, all 50 reverted in single transaction
- [ ] If any record fails revert (e.g., PEMS conflict), entire batch rolled back
- [ ] Revert History: Audit log shows linked chain: Original → Revert → Revert-of-Revert
- [ ] UI shows badge: "Reverted" on original audit entry, "Reverts: {batchId}" on revert entry
- [ ] Cannot revert a revert (prevent circular logic)
- [ ] Permission check: Only users with `perm_Sync=true` can revert syncs

---

### User Story 19: Hybrid Source of Truth Integration

**As a** System Administrator,
**I want to** support entities (Users, Organizations, Roles) sourced from PEMS while maintaining local flexibility,
**So that** I can leverage external identity management while allowing local customization when needed.

**Acceptance Criteria**:

#### Hybrid Identity
- [ ] PEMS users with `authProvider='pems'` can authenticate with local password (hybrid mode)
- [ ] PEMS users without local password (`passwordHash=NULL`) can authenticate via SSO/external token
- [ ] Local users (`authProvider='local'`) MUST have `passwordHash` (not nullable for local users)
- [ ] JIT (Just-in-Time) provisioning: When PEMS SSO succeeds but user doesn't exist locally, auto-create user with `authProvider='pems'`
- [ ] Password reset flow works for both local and hybrid PEMS users
- [ ] Login API accepts optional `ssoToken` parameter for external authentication

#### Hybrid Tenancy
- [ ] Organizations with `isExternal=true` have read-only core identity fields (Code, Name)
- [ ] Organizations with `isExternal=true` can have editable settings/preferences fields
- [ ] Organization Settings UI shows "☁️ PEMS Synced" badge for external orgs
- [ ] Attempting to rename/delete external org returns clear error: "Cannot modify PEMS-managed organization"
- [ ] Admin UI provides "Unlink from PEMS" action (converts `isExternal=false` with confirmation)
- [ ] Local admins can modify settings (timezone, currency, fiscal year) for external organizations

#### Hybrid Access
- [ ] User assignments with `assignmentSource='pems_sync'` can be overridden locally (marked `isCustom=true`)
- [ ] User Management UI shows "Source" column with badges: "☁️ PEMS" or "🏠 Local"
- [ ] Edit User Modal shows warning when editing PEMS user: "⚠️ Managed by PEMS. Changing this may break sync."
- [ ] Edit User Modal requires checkbox confirmation: "I understand and want to override"
- [ ] [Delete] button disabled for PEMS users, shows "Suspend" action instead
- [ ] [Reset Password] button enabled for both local and PEMS users (hybrid support)

#### Sync Conflict Resolution
- [ ] Sync conflicts are detected when PEMS value differs from local value AND `isCustom=true`
- [ ] Sync conflict events logged with AI hook: `type='sync_conflict_resolved'`
- [ ] Conflict resolution policy configurable: 'local_wins' | 'pems_wins' | 'manual_review'
- [ ] Admin receives notification when conflicts are detected
- [ ] Admin Dashboard shows "Conflicts" tab with filtered view of pending conflicts
- [ ] Conflict log includes: field, pemsValue, localValue, resolution, timestamp

#### Orphan Account Detection
- [ ] After PEMS sync completes, system detects users with `authProvider='pems'` NOT in PEMS response
- [ ] Orphan accounts flagged with AI event: `type='orphan_account_detected'`
- [ ] Orphan detection includes recommendation: 'suspend' | 'convert_to_local' | 'delete'
- [ ] Admin receives high-priority alert within 1 hour of orphan detection
- [ ] Admin Dashboard shows "Orphaned Accounts" badge with count
- [ ] Orphan accounts remain active (not auto-suspended) pending admin review
- [ ] If orphaned user re-appears in PEMS sync, orphan flag automatically cleared

#### Security
- [ ] Cannot bypass `isExternal` flag via API (requires special unlink endpoint with confirmation)
- [ ] Cannot delete PEMS users via standard DELETE endpoint (403 Forbidden)
- [ ] Cannot delete PEMS organizations via standard DELETE endpoint (403 Forbidden)
- [ ] Email changes for PEMS users require force flag and create audit warning
- [ ] Orphan account detection runs within 24 hours of PEMS sync completion
- [ ] All hybrid auth actions logged in audit trail with `authProvider` field

---

## Authorization Flow

### Login Flow
```typescript
1. User enters credentials
2. Backend validates username + password
3. Check user.serviceStatus === 'active' && user.isActive === true
4. If suspended: Return "Account suspended" error
5. If locked: Return "Account locked due to failed login attempts" error
6. Load user's organizations via UserOrganization table (filter WHERE isActive=true AND accessExpiresAt > now())
7. Filter organizations where organization.serviceStatus === 'active'
8. Return JWT with:
   - userId
   - username
   - allowedOrganizations: [{orgId, roleTemplateId, permissions: {...8 perm flags}}]
9. Create UserSession record with jti, ipAddress, userAgent, location
```

### API Request Flow
```typescript
0. Check System-Level Permissions (BEO Mode):
   - If user.systemRole?.perm_ViewAllOrgs === true:
     - Grant read-only access to ANY organization (Glass Mode)
     - For read operations: Skip UserOrganization check, proceed to step 6
     - For write operations: Continue to step 1 (must have explicit UserOrganization assignment)
     - Audit log: Create AuditLog entry with action="system:view_org", organizationId, userId

1. Extract JWT token or Personal Access Token
   - If Bearer token starts with "pat_": Validate PersonalAccessToken
   - Check token.expiresAt > now() && token.revokedAt IS NULL
   - Load token scopes and inherit user permissions (narrowed by scopes)
   - Update token.lastUsedAt, token.lastUsedIp, increment token.usageCount
   - Audit log: Create AuditLog entry with action="pat:usage", metadata.tokenId

2. Check Redis blocklist: if (await redis.exists('blocklist:{jti}')) return 401

3. Verify user.serviceStatus === 'active' && user.deletedAt IS NULL

4. Extract organizationId from request

5. Verify user has access to organization:
   - UserOrganization exists && deletedAt IS NULL
   - userOrg.isActive === true
   - userOrg.accessExpiresAt === NULL OR accessExpiresAt > now()
   - organization.serviceStatus === 'active' && organization.deletedAt IS NULL

6. Check required permission from UserOrganization instance (NOT template):
   - Read operation: Require perm_Read=true (OR systemRole.perm_ViewAllOrgs=true)
   - Edit forecast fields: Require perm_EditForecast=true
   - Edit actuals fields: Require perm_EditActuals=true
   - Delete: Require perm_Delete=true
   - Import: Require perm_Import=true (+ rate limit check: max 10/hour)
   - Refresh PEMS: Require perm_RefreshData=true (+ rate limit: 1 per 5 min per org)
   - Export: Require perm_Export=true
   - Sync to PEMS: Require perm_Sync=true (+ Pre-Flight Review triggered)

7. Financial Masking (if applicable):
   - If perm_ViewFinancials=false: Nullify financial fields in response
   - Export operation: Exclude financial columns entirely

8. Draft Filtering:
   - Default queries: WHERE draftStatus != 'draft'
   - If user requests "Show Drafts": Include WHERE draftStatus = 'draft'

9. Soft Delete Filtering:
   - All queries: WHERE deletedAt IS NULL (enforced by Prisma middleware)

10. Execute operation with audit logging:
    - **Before mutation**: Snapshot current state (for AuditLog.changes.before)
    - **Execute mutation**: Update record(s)
    - **After mutation**: Snapshot new state (for AuditLog.changes.after)
    - **Create audit entry**:
      - action: "pfa:update", "user:promote", "org:suspend", etc.
      - resourceId, resourceType
      - changes: { before: {...}, after: {...} }
      - reason: (from Pre-Flight Modal if applicable)
      - metadata: { ip, userAgent, timestamp }
      - batchId: (if bulk operation)
      - userId, organizationId

11. Return response with audit trail reference:
    - Include `X-Audit-Log-Id` header with audit log entry ID
    - Frontend can use this to show "View Change History" link
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
   - Emit event: eventBus.emit('pfa.sync.completed', { organizationId, recordCount, status })
4. Skip suspended/archived organizations
5. Log sync results per organization
6. If sync fails: Emit event: eventBus.emit('pfa.sync.failed', { organizationId, error })
7. Smart router sends notifications to subscribed users
```

### Notification Delivery Flow
```typescript
1. Event emitted: eventBus.emit('pfa.sync.failed', { userId, organizationId, error })
2. Smart router receives event
3. Load user's notification preferences: await getUserNotificationPreferences(userId)
4. Check quiet hours: if (inQuietHours && !isUrgent) → Queue for later
5. Check batching: if (similarEventInLast60Seconds) → Aggregate into batch
6. Route to enabled channels:
   - Email: Render MJML template → Send via Resend
   - In-App: Save to Notification table → Emit WebSocket event
   - SMS: Render plain text → Send via Twilio (rate limited)
   - Slack: Render Adaptive Card → POST to webhook
   - Teams: Render Adaptive Card → POST to webhook
7. Track delivery status in audit log
8. If delivery fails: Retry up to 3x with exponential backoff
```

### Impersonation Flow
```typescript
1. SysAdmin clicks "View As" button on user profile
2. Frontend calls: POST /api/auth/impersonate/:targetUserId
3. Backend verifies:
   - sysAdmin.perm_Impersonate === true
   - targetUser exists and is active
4. Backend generates temporary JWT (15 min expiry):
   - Copy all claims from targetUser's UserOrganization records
   - Add claim: { impersonatedBy: sysAdmin.id }
   - Add claim: { isImpersonation: true }
5. Backend logs: "SysAdmin X impersonated User Y at timestamp"
6. Frontend stores temp JWT in sessionStorage
7. Frontend shows orange banner: "You are viewing as [targetUser.username]. [Exit]"
8. All subsequent API requests use temp JWT
9. Backend middleware checks: if (isImpersonation) → Log all actions with impersonatedBy
10. On "Exit" or 15-min expiry: Restore original JWT from localStorage
```

---

## Security Architecture

This section consolidates all security mechanisms for the Multi-Tenant Access Control system.

---

### 1. Authentication

**JWT Tokens (User Sessions)**:
- Issued on login after username/password validation
- Contains claims: `userId`, `username`, `organizationIds[]`, `jti` (unique ID)
- Signed with secret key (HS256 algorithm)
- Expiration: 7 days (configurable)
- Stored in localStorage: `pfa_auth_token`
- Validated on every API request via middleware
- Revocable via Redis blocklist (`blocklist:{jti}`)

**Personal Access Tokens (API Integrations)**:
- User-generated high-entropy tokens (64 chars, crypto-random)
- Stored as bcrypt hash (never plaintext)
- Prefix: `pat_` for easy identification
- Scopes: Array of permissions (e.g., `["read:pfa", "write:forecasts"]`)
- Inherits user's organization permissions but can be **narrowed**
- Validated per request: `bcrypt.compare(token, hash)` (50ms latency)
- Mitigated via Redis caching (5-minute TTL)
- Revocable immediately (sets `revokedAt`)

**Impersonation Tokens (Troubleshooting)**:
- Temporary JWT with target user's exact permissions
- Expiration: 15 minutes (no refresh)
- Claim: `impersonatedBy = {sysAdminUserId}`
- Stored in sessionStorage (NOT localStorage)
- All actions logged in audit log with `impersonatedBy` field
- Auto-exit on expiration or manual exit

---

### 2. HMAC Webhook Validation

**Problem**: Slack/Teams webhooks can be spoofed if we don't validate signatures.

**Solution**: HMAC-SHA256 signature validation on all webhook callbacks.

**Slack Signature Validation**:
```typescript
function validateSlackSignature(req: Request): boolean {
  const slackSignature = req.headers['x-slack-signature'];
  const slackTimestamp = req.headers['x-slack-request-timestamp'];
  const body = JSON.stringify(req.body);

  // Prevent replay attacks (timestamp > 5 minutes = reject)
  if (Math.abs(Date.now() / 1000 - parseInt(slackTimestamp)) > 300) {
    return false;
  }

  // Compute HMAC signature
  const sigBasestring = `v0:${slackTimestamp}:${body}`;
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', process.env.SLACK_SIGNING_SECRET!)
    .update(sigBasestring)
    .digest('hex');

  // Compare signatures (timing-safe)
  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(slackSignature)
  );
}
```

**Teams Signature Validation**:
```typescript
function validateTeamsSignature(req: Request): boolean {
  const teamsSignature = req.headers['authorization'];
  const body = JSON.stringify(req.body);

  const expectedSignature = 'HMAC ' + crypto
    .createHmac('sha256', process.env.TEAMS_SHARED_SECRET!)
    .update(body)
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(teamsSignature)
  );
}
```

**Enforcement**:
```typescript
router.post('/api/integrations/slack/callback', async (req, res) => {
  if (!validateSlackSignature(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  // Safe to process callback
});
```

---

### 3. Financial Data Masking

**Enforcement Layers**:

**Layer 1: API Response Interceptor**:
```typescript
function maskFinancialData(pfaRecords: PfaRecord[], userOrg: UserOrganization): PfaRecord[] {
  if (userOrg.perm_ViewFinancials) {
    return pfaRecords; // No masking
  }

  return pfaRecords.map(record => ({
    ...record,
    monthlyRate: null,
    purchasePrice: null,
    totalCost: null,
    // Non-financial fields remain visible
  }));
}
```

**Layer 2: UI Masking**:
```tsx
<GridColumn
  field="totalCost"
  render={(row) =>
    userOrg.perm_ViewFinancials
      ? `$${row.totalCost.toLocaleString()}`
      : '*****'
  }
/>
```

**Layer 3: Export Exclusion**:
```typescript
function generateExport(records: PfaRecord[], includeFinancials: boolean): Workbook {
  const columns = ['id', 'category', 'forecastStart', 'forecastEnd'];

  if (includeFinancials) {
    columns.push('monthlyRate', 'purchasePrice', 'totalCost');
  }

  return createWorkbook(records, columns);
}
```

**Audit Logging**:
```typescript
await createAuditLog({
  action: 'DATA_EXPORT',
  userId,
  metadata: {
    includeFinancials,
    recordCount: records.length
  }
});
```

---

### 4. Audit Logging

**Immutability Enforcement**:

**Database Trigger** (PostgreSQL):
```sql
CREATE OR REPLACE FUNCTION prevent_audit_log_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log records are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_update();
```

**Prisma Middleware** (Application-level):
```typescript
prisma.$use(async (params, next) => {
  if (params.model === 'AuditLog' && (params.action === 'update' || params.action === 'delete')) {
    throw new Error('Audit log records are immutable');
  }
  return next(params);
});
```

**Batch Transaction Support**:
```typescript
const batchId = uuid();

for (const record of updatedRecords) {
  await createAuditLog({
    action: 'pfa:update',
    resourceId: record.id,
    resourceType: 'PfaRecord',
    changes: {
      before: originalRecord,
      after: record
    },
    reason: changeReason,
    batchId, // Groups all changes in this bulk operation
    userId,
    organizationId
  });
}
```

**Revert Using Audit Log**:
```typescript
async function revertBatch(batchId: string): Promise<void> {
  const auditEntries = await prisma.auditLog.findMany({
    where: { batchId }
  });

  const revertPayload = auditEntries.map(entry => ({
    id: entry.resourceId,
    ...entry.changes.before // Restore "before" state
  }));

  await submitToPems(revertPayload);

  // Create revert audit entries
  for (const entry of auditEntries) {
    await createAuditLog({
      action: 'pfa:revert',
      resourceId: entry.resourceId,
      resourceType: entry.resourceType,
      changes: {
        before: entry.changes.after,
        after: entry.changes.before
      },
      reason: `Revert of transaction ${batchId}`,
      metadata: { originalBatchId: batchId },
      userId,
      organizationId
    });
  }
}
```

---

### 5. Soft Delete

**Prisma Middleware** (Auto-filter deleted records):
```typescript
prisma.$use(async (params, next) => {
  if (params.action === 'findMany' || params.action === 'findFirst') {
    // Add deletedAt filter to all queries
    params.args.where = {
      ...params.args.where,
      deletedAt: null
    };
  }

  if (params.action === 'delete') {
    // Convert hard delete to soft delete
    params.action = 'update';
    params.args.data = {
      deletedAt: new Date(),
      deletedBy: getCurrentUserId()
    };
  }

  return next(params);
});
```

**Trash Can Query** (Admin only):
```typescript
const deletedRecords = await prisma.pfaRecord.findMany({
  where: {
    deletedAt: { not: null },
    deletedAt: { gte: thirtyDaysAgo } // Only show last 30 days
  }
});
```

**Restore Operation**:
```typescript
async function restoreRecord(id: string, userId: string): Promise<void> {
  await prisma.pfaRecord.update({
    where: { id },
    data: { deletedAt: null }
  });

  await createAuditLog({
    action: 'pfa:restore',
    resourceId: id,
    resourceType: 'PfaRecord',
    userId,
    metadata: { restoredFrom: 'trash_can' }
  });
}
```

**Permanent Delete** (After 30 days):
```typescript
// Daily cron job
async function permanentlyDeleteExpired(): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await prisma.pfaRecord.deleteMany({
    where: {
      deletedAt: { lt: thirtyDaysAgo }
    }
  });

  console.log(`Permanently deleted ${result.count} records older than 30 days`);
}
```

---

## Consequences

### Positive

**Security & Compliance**:
- ✅ **Immutable Audit Trail**: Forensic-grade change tracking with before/after diffs, user justifications, and IP tracking satisfies SOX/GDPR audit requirements
- ✅ **Personal Access Tokens**: Secure API integrations without password sharing, scoped permissions, and individual revocation
- ✅ **Real-Time Session Revocation**: Compromised accounts disabled <1 second via Redis blocklist (session kill switch)
- ✅ **Financial Masking Compliance**: Cost data hidden from contractors and restricted users (API + UI + Export enforcement)
- ✅ **Temporal Access**: Contractor access auto-expires with 7-day warnings and daily cleanup
- ✅ **Soft Delete Protection**: 30-day recovery window prevents accidental data loss while maintaining audit continuity

**Operational Efficiency**:
- ✅ **Role Templates**: Create "Project Manager" once, assign to 50 users (vs. 50× manual permission configs)
- ✅ **Pre-Flight Review**: Mandatory change impact preview prevents $50K budget mistakes before PEMS sync
- ✅ **Revert Capability**: One-click rollback of mistaken syncs using audit log history (no manual re-entry)
- ✅ **Secure Invitations**: Email magic links with 48-hour expiration eliminate insecure password sharing
- ✅ **Smart Batching**: 70% reduction in notification volume during bulk operations (50 errors → 1 aggregated notification)
- ✅ **Multi-Channel Notifications**: Users choose Email/SMS/Slack/Teams with quiet hours and event filtering

**Scalability & Flexibility**:
- ✅ **Hybrid JSONB Architecture**: Add new UI features (`beta_ai_chat`) without database migrations via `capabilities` JSON
- ✅ **Config Bags**: Organization settings (`fiscal_start`) and user preferences (`theme: dark`) stored in JSON (zero-downtime extensibility)
- ✅ **BEO Portfolio Mode**: Executives view 28 orgs without 28 manual assignments (system-level `perm_ViewAllOrgs`)
- ✅ **Draft Data Isolation**: Users with `perm_SaveDraft` experiment without affecting production (`WHERE draftStatus != 'draft'`)
- ✅ **Impersonation Mode**: SysAdmins troubleshoot as any user with full audit trail (no password required)

**Developer Experience**:
- ✅ **TypeScript Validation**: Zod schemas enforce `capabilities` and `settings` JSON structure (prevents bad data)
- ✅ **Prisma Middleware**: Automatic soft delete filtering (`WHERE deletedAt IS NULL`) - devs don't manually add to every query
- ✅ **Clear Permission Hierarchy**: 14 static flags (fast queries) + capabilities JSON (UI toggles) = easy to reason about

---

### Negative

**Complexity**:
- ⚠️ **Migration Overhead**: Adding 6 new tables + 15 new columns requires careful migration planning (estimated 2-3 days)
- ⚠️ **Audit Log Storage Growth**: 1M PFA record edits/year × 1KB/entry = **1GB/year** (requires archival strategy after 2 years)
- ⚠️ **Soft Delete Join Complexity**: Queries with multiple tables need `WHERE deletedAt IS NULL` on each join (Prisma middleware helps)
- ⚠️ **PAT Validation Latency**: bcrypt token hash validation adds ~50ms to API requests (mitigated by Redis caching)

**UI/UX Challenges**:
- ⚠️ **Template vs. Instance Confusion**: Admins must understand "Role Template" (shared) vs. "User Permissions" (instance)
- ⚠️ **Pre-Flight Modal Friction**: Users must provide comment before every sync (adds 30 seconds to workflow)
- ⚠️ **Trash Can Discovery**: Users may not know deleted items are recoverable (need prominent UI banner)
- ⚠️ **Audit Log Overwhelm**: Power users generate 1000+ audit entries/day (need smart filtering and search)

**Operational Risks**:
- ⚠️ **Revert Failure Modes**: If PEMS rejects revert sync (conflict), admin must manually fix (edge case)
- ⚠️ **Invitation Email Deliverability**: Magic link emails may go to spam (need SPF/DKIM/DMARC setup)
- ⚠️ **Redis Dependency**: Session revocation requires Redis (single point of failure without Redis Sentinel)
- ⚠️ **Audit Log Immutability**: Cannot fix typos in audit log `reason` field (strict append-only)

**Performance Considerations**:
- ⚠️ **Audit Log Write Amplification**: Every PFA edit = 2 writes (PfaRecord + AuditLog) → 2× database load
- ⚠️ **Batch Revert Complexity**: Reverting 1000-record batch requires 1000 PEMS API calls (rate limiting risk)
- ⚠️ **Personal Access Token Table Growth**: 100 users × 5 tokens/user = 500 tokens (needs periodic cleanup of expired tokens)

---

### Mitigation Strategies

**Audit Log Management**:
- Archive audit logs >1 year old to cold storage (AWS S3 Glacier)
- Implement audit log search with Elasticsearch for fast queries
- Add `auditLogRetentionDays` org setting (default: 730 days)

**Performance Optimization**:
- Cache PAT validation results in Redis (5-minute TTL)
- Batch audit log writes (buffer 10 entries, flush every 1 second)
- Use database partitioning for `AuditLog` table (partition by month)

**User Experience**:
- Add "Quick Sync" mode for trusted users (skips Pre-Flight Modal after 10 successful syncs)
- Tooltip education: Hover "Custom" badge → "This user's permissions differ from the role template"
- Trash Can banner: "Deleted items are kept for 30 days. [View Trash]"

**Resilience**:
- Redis Sentinel for high availability (3-node cluster)
- Graceful degradation: If Redis down, fall back to database session validation (slower but works)
- Webhook retry logic for invitation emails (retry 3×, exponential backoff)

---

## Success Metrics

### Security & Compliance Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Audit Log Coverage** | 100% of critical actions logged | Monitor `AuditLog` entries for pfa:update, user:promote, org:suspend |
| **Audit Log Integrity** | 0 unauthorized modifications | Periodic hash verification, database triggers enforce append-only |
| **Financial Masking Compliance** | 100% enforcement | Test API with `perm_ViewFinancials=false`, verify financial fields nullified |
| **PAT Validation Latency** | <50ms per request | Monitor API response time with `Authorization: Bearer pat_*` |
| **Session Revocation Speed** | <1 second | Time from admin clicks "Revoke" to user 401 error |
| **Temporal Access Cleanup** | 100% expired users disabled | Daily cron job report: `SELECT COUNT(*) WHERE accessExpiresAt < now() AND isActive=true` (should be 0) |
| **Soft Delete Recovery Success Rate** | >95% of recoveries within 30 days | Track "Restore" button clicks vs. "Delete Permanently" |

---

### Operational Efficiency Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Role Template Usage** | 80% of users assigned via templates | `SELECT COUNT(*) FROM UserOrganization WHERE roleTemplateId IS NOT NULL / COUNT(*)` |
| **Pre-Flight Error Prevention** | 30% reduction in sync errors | Compare sync error rate before/after Pre-Flight Modal launch |
| **Revert Usage** | <5% of syncs reverted | `SELECT COUNT(*) FROM AuditLog WHERE action='pfa:revert' / COUNT(*) WHERE action='pfa:update'` |
| **Invitation Acceptance Rate** | >90% accepted within 48 hours | `SELECT COUNT(*) WHERE status='accepted' / COUNT(*)` |
| **Notification Batching Efficiency** | >70% reduction in notifications during bulk ops | Compare total notifications sent before/after batching |
| **Audit Log Search Performance** | <200ms for complex queries | Monitor Elasticsearch query latency for `action:pfa:update AND organizationId:X` |

---

### User Experience Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Permission Override Clarity** | <10% admin support tickets asking "Why can't user X do Y?" | Track Zendesk tickets tagged "permissions" |
| **Pre-Flight Modal Abandonment Rate** | <5% of users cancel after seeing impact | Track "Cancel" clicks in Pre-Flight Modal vs. "Confirm & Sync" |
| **Trash Can Awareness** | >50% of admins know about soft delete | Survey or tooltip engagement tracking |
| **PAT Onboarding Success** | >80% of power users create PAT within first week | Track PAT creation events for users with `perm_Export=true` |
| **Impersonation Mode Clarity** | 0 cases where admin forgets they're impersonating | Orange banner always visible, session auto-expires after 15 min |

---

### Technical Performance Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Authorization Latency** | <20ms per request | Monitor middleware execution time |
| **Audit Log Write Latency** | <10ms per entry | Monitor database insert time |
| **Batch Revert Success Rate** | >95% | Track rollback failures due to PEMS conflicts |
| **Database Query Performance** | <50ms for org + user + permissions lookup | Monitor slow query log |
| **Soft Delete Filter Overhead** | <5ms penalty per query | Compare query time with/without `WHERE deletedAt IS NULL` |
| **Redis Cache Hit Rate** | >90% for PAT validation | Monitor Redis `GET` hits vs. misses |

---

### Business Impact Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Admin Time Savings** | 20 hours/month saved | Survey admins: Time spent on permission management before/after |
| **Compliance Audit Pass Rate** | 100% | External auditor findings on audit trail completeness |
| **Data Recovery Success** | 100% of requested recoveries within 30-day window | Track "Restore" requests that succeed |
| **API Integration Adoption** | 50% of power users using PATs | Track PAT usage vs. total power users |
| **BEO Portfolio Usage** | 100% of BEO users use Portfolio Dashboard weekly | Track dashboard page views |

---

## Implementation Roadmap

See: [ADR-005-IMPLEMENTATION_PLAN.md](./ADR-005-IMPLEMENTATION_PLAN.md)

**Phases**:
1. **Phase 1**: Database schema expansion + migration (2.5 days)
   - Add 5 new tables: OrganizationRole, UserSession, UserNotificationPreferences, OrganizationIntegration, **SystemRole**, SystemDictionary
   - Add JSONB columns for extensibility: `capabilities`, `uiPreferences` (UserOrganization), `settings` (Organization), `preferences` (User), `subscriptions` (UserNotificationPreferences)
   - Add 10+ new fields to existing tables
   - Seed SystemRole table with default roles: "BEO Executive", "SysAdmin", "Global Auditor"
   - Migrate existing users to template-instance model
   - Seed SystemDictionary with initial equipment classes, units of measure, notification channels

2. **Phase 2**: Role template system (2 days)
   - OrganizationRole CRUD APIs
   - Template assignment logic with `isCustom` tracking
   - Bulk update with conflict resolution

3. **Phase 3**: Financial masking + Draft data strategy (1.5 days)
   - Response interceptor for API nullification
   - UI conditional rendering for grid/matrix/KPI
   - CSV/Excel export filtering
   - Draft data strategy implementation (draftStatus field + UI toggles)
   - Sandbox isolation enforcement (perm_SaveDraft vs perm_Sync)

4. **Phase 4**: Temporal access & session management (2 days)
   - `accessExpiresAt` middleware check
   - Expiration notifications (7 days before)
   - Session tracking + Redis blocklist
   - Session kill switch API

5. **Phase 5**: Impersonation mode (1 day)
   - Temporary JWT generation
   - "View As" UI with orange banner
   - Audit logging

6. **Phase 6**: Notification system infrastructure (3 days)
   - Event bus + smart router
   - 6 channel adapters (Email, In-App, SMS, Slack, Teams, Push)
   - User preferences API
   - Smart batching logic
   - Quiet hours enforcement

7. **Phase 7**: Admin UI (2-3 days)
   - Role template creator
   - Permission matrix UI
   - Session management table
   - Notification preferences page
   - Bulk update conflict resolution modals

8. **Phase 8**: Testing + documentation (2 days)
   - Unit tests (80%+ coverage)
   - Integration tests (notification delivery, session revocation)
   - Security tests (financial masking bypass attempts, privilege escalation)
   - API documentation
   - Admin user guide

8.5. **Phase 8.5**: BEO Portfolio Dashboard & Legacy Import (2-3 days)
   - Portfolio Dashboard UI (aggregate metrics, drill-down)
   - Cross-org analytics (bubble chart, top 10 over/under budget)
   - Live Activity Stream (WebSocket feed)
   - System Role assignment UI (Admin can assign BEO role)
   - PFA 1.0 Import Wizard (upload CSV, AI analysis, migration preview)
   - AI recommendation engine (structural mapping suggestions)
   - Transient capability management (admin can revoke after migration)

9. **Phase 9**: Production Deployment
   - Pre-deployment security audit
   - BEO mode testing with multi-org data
   - Legacy import testing with V1 exports
   - System role permission verification
   - Portfolio dashboard performance testing
   - Launch checklist completion

**Total Estimate**: 18-23 days (expanded from 15-20 days to include BEO Mode and Legacy Import features)

---

## Related Documentation

- **Implementation Plan**: [ADR-005-IMPLEMENTATION_PLAN.md](./ADR-005-IMPLEMENTATION_PLAN.md) (requires update)
- **AI Opportunities**: [ADR-005-AI_OPPORTUNITIES.md](./ADR-005-AI_OPPORTUNITIES.md) (requires update)
- **UX Specification**: [ADR-005-UX_SPEC.md](./ADR-005-UX_SPEC.md) (requires update)
- **Test Plan**: [ADR-005-TEST_PLAN.md](./ADR-005-TEST_PLAN.md) (requires update)
- **Agent Workflow**: [ADR-005-AGENT_WORKFLOW.md](./ADR-005-AGENT_WORKFLOW.md) (will be regenerated after all updates)
- **Database Schema**: `backend/prisma/schema.prisma`
- **Authorization Middleware**: `backend/src/middleware/authorize.ts` (to be created)
- **Notification Service**: `backend/src/services/NotificationService.ts` (to be created)
- **API Documentation**: `backend/docs/API_AUTHORIZATION.md` (to be created)

---

**Status**: Proposed (Scope Expanded - Pending Stakeholder Approval)
**Decision Date**: 2025-11-26
**Last Updated**: 2025-11-26
**Review Date**: TBD

**⚠️ SCOPE CHANGE**: Original plan (6-8 days, basic RBAC) expanded to 15-20 days with enterprise features (notification system, financial masking, temporal access, impersonation mode). All 5 blueprint documents require updates before proceeding to implementation. See [ADR-005-UPDATE_PLAN.md](./ADR-005-UPDATE_PLAN.md) for execution steps.

*Document created: 2025-11-26*
*Last updated: 2025-11-26 (Step 1 of UPDATE_PLAN executed)*
