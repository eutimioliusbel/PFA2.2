# PEMS User Sync Filtering

> **CRITICAL**: NOT ALL USERS FROM PEMS ARE SYNCED. This document explains which users are synchronized and why.

---

## Overview

**PFA Vanguard** implements **selective user synchronization** from PEMS (HxGN EAM). The system uses a **4-tier filtering strategy** to determine which users should be imported into the local database.

**Business Context**: The client explicitly stated "we won't be bringing all the users down," requiring filtering logic to identify only relevant users for PFA Vanguard.

**Architecture**: Hybrid identity model
- Users sourced from PEMS have `authProvider='pems'`
- passwordHash is **nullable** (no local password for pure PEMS users)
- Email and username come from PEMS
- LDAP roles mapped to `UserOrganization.externalRoleId`

---

## 4-Tier Filtering Criteria

### Filter 1: Active Users Only

**Rule**: `ISACTIVE = '+'`

**Why**: Inactive users should not have access to PFA Vanguard. Only active PEMS users are synchronized.

**Example**:
```typescript
// ✅ SYNCED
{ USERID: 'PM001', ISACTIVE: '+', ... }

// ❌ SKIPPED
{ USERID: 'INACTIVE001', ISACTIVE: '-', ... }
```

**Skip Reason**: `"Inactive user"`

---

### Filter 2: Allowed User Groups

**Rule**: `USERGROUP IN ['PROJECT_MANAGERS', 'COST_ENGINEERS', 'ADMINISTRATORS', 'BEO_USERS']`

**Why**: Only specific job roles need access to PFA Vanguard. Contractors, inspectors, and other roles are excluded.

**Allowed User Groups**:
- `PROJECT_MANAGERS` → Maps to `role='admin'`
- `COST_ENGINEERS` → Maps to `role='user'`
- `ADMINISTRATORS` → Maps to `role='admin'`
- `BEO_USERS` → Maps to `role='user'`

**Example**:
```typescript
// ✅ SYNCED
{ USERID: 'PM001', USERGROUP: 'PROJECT_MANAGERS', ... }

// ❌ SKIPPED
{ USERID: 'CONTRACTOR001', USERGROUP: 'CONTRACTORS', ... }
```

**Skip Reason**: `"User group not allowed"`

---

### Filter 3: Required Organizations

**Rule**: User must have at least one organization assignment in `['BECH', 'HOLNG', 'RIO']`

**Why**: PFA Vanguard only supports specific construction projects. Users not assigned to these projects are excluded.

**Required Organizations**:
- `BECH` (Bechtel project)
- `HOLNG` (Holland project)
- `RIO` (Rio project)

**Process**:
1. Fetch user's organization assignments via `/usersetup/{userId}/organizations`
2. Filter organizations by `ORGANIZATIONCODE`
3. If no matching organizations, skip user

**Example**:
```typescript
// ✅ SYNCED
User has organizations: ['BECH', 'HOLNG']
Filtered organizations: ['BECH', 'HOLNG'] ← Non-empty

// ❌ SKIPPED
User has organizations: ['OTHER_PROJECT', 'ANOTHER_PROJECT']
Filtered organizations: [] ← Empty
```

**Skip Reason**: `"No matching organizations"`

---

### Filter 4: PFA Access Flag

**Rule**: `StandardUserDefinedFields.UDFCHAR01 IN ['Y', 'YES', 'TRUE', 'true', 'yes', '1']`

**Why**: Custom field `UDFCHAR01` is used as a PFA Access Flag. Only users with this flag enabled should sync.

**Accepted Values**:
- `'Y'`
- `'YES'`
- `'TRUE'`
- `'true'`
- `'yes'`
- `'1'`

**Example**:
```typescript
// ✅ SYNCED
{
  USERID: 'PM001',
  StandardUserDefinedFields: { UDFCHAR01: 'Y', ... }
}

// ❌ SKIPPED
{
  USERID: 'NOACCESS001',
  StandardUserDefinedFields: { UDFCHAR01: 'N', ... }
}
```

**Skip Reason**: `"Custom field filter not met"`

---

## Filtering Flow Diagram

```
PEMS User
   ↓
Filter 1: ISACTIVE = '+' ?
   ↓ YES
Filter 2: USERGROUP allowed ?
   ↓ YES
Filter 3: Fetch organizations
   ↓
Filter 3: Has BECH, HOLNG, or RIO ?
   ↓ YES
Filter 4: UDFCHAR01 = 'Y' ?
   ↓ YES
✅ SYNC USER
   ↓
Upsert to database (authProvider='pems', passwordHash=NULL)
```

---

## User Sync Process

### Step 1: Fetch Users (Paginated)

```http
GET /usersetup
Headers:
  Authorization: Basic <base64(username:password)>
  tenant: BECH
  organization: BECH
  cursorposition: 0
```

**Response**:
```json
{
  "Result": {
    "ResultData": {
      "DATARECORD": [
        {
          "USERID": { "USERCODE": "PM001" },
          "EMAIL": "pm001@example.com",
          "ISACTIVE": "+",
          "USERGROUP": "PROJECT_MANAGERS",
          "EXTERNALUSERID": "EXT123",
          "StandardUserDefinedFields": {
            "UDFCHAR01": "Y"
          }
        }
      ],
      "CURRENTCURSORPOSITION": 0,
      "NEXTCURSORPOSITION": 100
    }
  }
}
```

### Step 2: Apply Filters

For each user:
1. Check `ISACTIVE = '+'` ✅
2. Check `USERGROUP` in allowed list ✅
3. Fetch organizations ⬇️

### Step 3: Fetch User Organizations

```http
GET /usersetup/PM001/organizations
Headers:
  Authorization: Basic <base64(username:password)>
  tenant: BECH
  organization: BECH
```

**Response**:
```json
{
  "Result": {
    "ResultData": {
      "DATARECORD": [
        {
          "USERORGANIZATIONID": {
            "ORGANIZATIONID": { "ORGANIZATIONCODE": "BECH" },
            "USERID": { "USERCODE": "PM001" },
            "LDAPROLEID": { "ROLECODE": "PROJECT_MANAGER" }
          },
          "USERGROUP": "PROJECT_MANAGERS"
        },
        {
          "USERORGANIZATIONID": {
            "ORGANIZATIONID": { "ORGANIZATIONCODE": "HOLNG" },
            "USERID": { "USERCODE": "PM001" },
            "LDAPROLEID": { "ROLECODE": "PROJECT_MANAGER" }
          },
          "USERGROUP": "PROJECT_MANAGERS"
        }
      ]
    }
  }
}
```

### Step 4: Filter Organizations

```typescript
const filteredOrgs = userOrgs.filter(uo =>
  ['BECH', 'HOLNG', 'RIO'].includes(
    uo.USERORGANIZATIONID.ORGANIZATIONID.ORGANIZATIONCODE
  )
);
// Result: [BECH, HOLNG] ✅
```

### Step 5: Check PFA Access Flag

```typescript
const udfChar01 = user.StandardUserDefinedFields?.UDFCHAR01;
if (!['Y', 'YES', 'TRUE', 'true', 'yes', '1'].includes(udfChar01)) {
  skip(); // ❌
}
```

### Step 6: Upsert User

```typescript
await prisma.user.upsert({
  where: { username: 'PM001' },
  update: {
    email: 'pm001@example.com',
    isActive: true,
    // FUTURE: authProvider: 'pems',
    // FUTURE: externalUserId: 'EXT123',
  },
  create: {
    username: 'PM001',
    email: 'pm001@example.com',
    passwordHash: '', // TEMPORARY: Will be nullable in Phase 0, Task 0.2
    role: 'admin', // Mapped from PROJECT_MANAGERS
    isActive: true,
    // FUTURE: authProvider: 'pems',
    // FUTURE: externalUserId: 'EXT123',
  }
});
```

### Step 7: Upsert Organization Assignments

```typescript
for (const userOrg of filteredOrgs) {
  const orgCode = userOrg.USERORGANIZATIONID.ORGANIZATIONID.ORGANIZATIONCODE;
  const org = await prisma.organization.findUnique({ where: { code: orgCode } });

  await prisma.userOrganization.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
    update: {
      role: mapUserGroupToRole(userOrg.USERGROUP),
      // FUTURE: externalRoleId: userOrg.USERORGANIZATIONID.LDAPROLEID?.ROLECODE,
    },
    create: {
      userId: user.id,
      organizationId: org.id,
      role: mapUserGroupToRole(userOrg.USERGROUP),
      // FUTURE: externalRoleId: userOrg.USERORGANIZATIONID.LDAPROLEID?.ROLECODE,
    }
  });
}
```

---

## Adjusting Filters

**Q**: What if I need to add more user groups?
**A**: Edit `backend/src/services/pems/PemsUserSyncService.ts`:

```typescript
this.syncFilters = {
  allowedUserGroups: [
    'PROJECT_MANAGERS',
    'COST_ENGINEERS',
    'ADMINISTRATORS',
    'BEO_USERS',
    'NEW_GROUP_HERE' // ← Add new group
  ]
};
```

**Q**: What if I need to add more organizations?
**A**: Edit `backend/src/services/pems/PemsUserSyncService.ts`:

```typescript
this.syncFilters = {
  requiredOrganizations: [
    'BECH',
    'HOLNG',
    'RIO',
    'NEW_ORG_CODE_HERE' // ← Add new org
  ]
};
```

**Q**: What if I need to change the PFA Access Flag field?
**A**: Edit `backend/src/services/pems/PemsUserSyncService.ts`:

```typescript
this.syncFilters = {
  customFieldFilters: [
    { fieldName: 'UDFCHAR02', values: ['ENABLED'] } // ← Change field
  ]
};
```

---

## Test Users

Run the test seed to create sample users:

```bash
npx tsx backend/prisma/seeds/pems-users.seed.ts
```

**Users that SHOULD SYNC**:
- `PM001` - Project Manager (BECH, HOLNG) ✅
- `CE002` - Cost Engineer (BECH) ✅
- `ADM003` - Administrator (BECH, HOLNG, RIO) ✅

**Users that SHOULD BE SKIPPED**:
- `INACTIVE001` - Inactive user (ISACTIVE = '-') ❌
- `CONTRACTOR001` - Contractor role (USERGROUP not allowed) ❌
- `NOACCESS001` - No PFA access flag (UDFCHAR01 = 'N') ❌

---

## Troubleshooting

### Issue: User not syncing

**Checklist**:
1. ✅ User has `ISACTIVE = '+'` in PEMS?
2. ✅ User has allowed `USERGROUP` (PROJECT_MANAGERS, COST_ENGINEERS, etc.)?
3. ✅ User has at least one organization in BECH, HOLNG, or RIO?
4. ✅ User has `UDFCHAR01 = 'Y'` in PEMS?

**Check Logs**: Look for skip reason in backend logs:

```
Skipping user PM999: User group not allowed
  USERGROUP = 'INSPECTOR' (allowed: PROJECT_MANAGERS, COST_ENGINEERS, ...)
```

### Issue: Too many users syncing

**Solution**: Tighten filters by reducing allowed user groups or organizations.

### Issue: Not enough users syncing

**Solution**: Loosen filters by adding more user groups or organizations, or change `UDFCHAR01` acceptance values.

---

## Sync Statistics

After sync completes, check logs for skip summary:

```
Skipped 1,234 users:
  Inactive user: 456
  User group not allowed: 321
  No matching organizations: 234
  Custom field filter not met: 223
```

**Get Detailed Skip Report**:
```typescript
const service = new PemsUserSyncService();
await service.syncUsers(organizationId, apiConfigId);
const skipped = service.getSkippedUsers();

// skipped = [
//   { userId: 'PM999', reason: 'User group not allowed', details: '...' },
//   ...
// ]
```

---

## Database Schema Notes

**Phase 0, Task 0.2** will add the following fields to support hybrid authentication:

**User model**:
- `authProvider` (string): `'local'` or `'pems'`
- `passwordHash` (nullable): NULL for PEMS users
- `externalUserId` (string): PEMS `EXTERNALUSERID`

**UserOrganization model**:
- `externalRoleId` (string): PEMS `LDAPROLEID.ROLECODE`

---

## Related Files

**Service**:
- `backend/src/services/pems/PemsUserSyncService.ts` - Sync logic with filtering

**Configuration**:
- `backend/prisma/seed.ts` - API configuration
- `backend/prisma/seeds/pems-users.seed.ts` - Test user data

**Documentation**:
- `docs/ADRs/ADR-005-multi-tenant-access-control/DECISION.md` - Business requirements
- `docs/ADRs/ADR-005-multi-tenant-access-control/IMPLEMENTATION_PLAN.md` - Technical spec

**Scripts**:
- `backend/scripts/test-user-sync.ts` - Test sync script (to be created)

---

## Summary

**NOT ALL USERS ARE SYNCED**. Only users meeting ALL 4 criteria are imported:

1. ✅ Active (`ISACTIVE = '+'`)
2. ✅ Allowed user group (PROJECT_MANAGERS, COST_ENGINEERS, ADMINISTRATORS, BEO_USERS)
3. ✅ Assigned to required organization (BECH, HOLNG, RIO)
4. ✅ PFA Access Flag enabled (`UDFCHAR01 = 'Y'`)

**Hybrid Authentication**: PEMS users have `authProvider='pems'` and `passwordHash=NULL` (no local password).

**Filtering is intentional and business-driven** to ensure only relevant users have access to PFA Vanguard.
