# ADR-005 Data Operations Permissions Update Summary

**Date**: 2025-11-26
**File**: `docs/adrs/ADR-005-multi-tenant-access-control/ADR-005-DECISION.md`

## Objective

Add 3 critical static permission columns to the `UserOrganization` table for data operations that require backend enforcement:
1. `perm_Import` - Upload CSV/Excel to import PFA data
2. `perm_RefreshData` - Trigger manual PEMS sync
3. `perm_Export` - Export data to Excel/CSV

These permissions require backend enforcement because they:
- Affect system resources (CPU, memory, API calls)
- Require rate limiting and audit logging
- Involve file I/O operations that impact performance

## Changes Made

### 1. Updated Context and Problem Statement (Line 23-28)

**Changed from**: 11 permission flags organized in 4 categories
**Changed to**: 14 permission flags organized in 5 categories

Added new category: **Data Operations**: perm_Import, perm_RefreshData, perm_Export

### 2. Updated OrganizationRole Schema (Lines 107-125)

**Added permissions**:
```prisma
// 2. Data Operations (The "How")
perm_Import             Boolean  @default(false) // Upload CSV/Excel to import data
perm_RefreshData        Boolean  @default(false) // Trigger manual PEMS sync
perm_Export             Boolean  @default(false) // Export data to Excel/CSV
```

**Updated numbering**:
- "2. Financials" → "3. Financials"
- "3. Process" → "4. Process"
- "4. Admin" → "5. Admin"

### 3. Updated UserOrganization Schema (Lines 144-162)

Applied same changes as OrganizationRole schema.

### 4. Updated Decision Outcome - Role Template System (Line 237)

**Changed from**: "Each template defines 11 permission flags organized in 4 categories"
**Changed to**: "Each template defines 14 permission flags organized in 5 categories"

### 5. Added New Section 10.5 (Lines 709-846)

**New section**: "Data Operations Permissions (Import/Refresh/Export)"

Includes:
- Problem statement
- Solution description
- Permission definitions with rate limits
- Backend enforcement code examples for all 3 permissions
- UI behavior specifications

**Backend Enforcement Details**:
- **perm_Import**: Rate limit 10 imports/hour, audit logging
- **perm_RefreshData**: Rate limit 1 sync/5 minutes, prevents sync storms
- **perm_Export**: Respects `perm_ViewFinancials` for masking, no rate limit

### 6. Updated Section 11 (Line 851)

**Changed from**: "all 11 permission flags"
**Changed to**: "all 14 permission flags"

### 7. Updated User Story 1 Acceptance Criteria (Lines 2088-2089)

**Changed from**:
- System copies template's 11 permission flags
- Categories: Data Scope (4), Financials (1), Process (2), Admin (4)

**Changed to**:
- System copies template's 14 permission flags
- Categories: Data Scope (4), Data Operations (3), Financials (1), Process (2), Admin (4)

### 8. Updated Authorization Flow (Lines 2311-2313)

**Added permission checks**:
- Import data: Require perm_Import=true (+ rate limit 10/hour)
- Refresh PEMS data: Require perm_RefreshData=true (+ rate limit 1/5min)
- Export data: Require perm_Export=true (respect perm_ViewFinancials)

### 9. Updated Consequences - Positive (Line 2385)

**Changed from**: "11 permission flags per user per organization organized in 4 categories"
**Changed to**: "14 permission flags per user per organization organized in 5 categories"

### 10. Updated Decision Rule Summary Table (Line 1986)

**Added new row**:
```markdown
| **Column (Data Operations)** | Backend enforcement, rate limiting, audit logging required | `perm_Import`, `perm_RefreshData`, `perm_Export` |
```

### 11. Updated Hybrid JSONB Approach Schemas

Updated two additional schema definitions to include the 3 new permissions:
- Line 1010-1023: UserOrganization (Tier 1 High Performance Security)
- Line 1838-1851: UserOrganization (Tier 1 Structural Security)

## Permission Categories (Final)

### Category 1: Data Scope (The "What") - 4 flags
- perm_Read
- perm_EditForecast
- perm_EditActuals
- perm_Delete

### Category 2: Data Operations (The "How") - 3 flags (NEW)
- perm_Import
- perm_RefreshData
- perm_Export

### Category 3: Financials (The "Mask") - 1 flag
- perm_ViewFinancials

### Category 4: Process (The "How") - 2 flags
- perm_SaveDraft
- perm_Sync

### Category 5: Admin (The "Who") - 4 flags
- perm_ManageUsers
- perm_ManageSettings
- perm_ConfigureAlerts
- perm_Impersonate

**Total**: 14 permission flags

## Backend Enforcement Examples

All 3 new permissions include:
- 403 PERMISSION_DENIED error handling
- 429 RATE_LIMIT_EXCEEDED error handling
- Audit logging (user ID, timestamp, record count)
- Integration with existing `perm_ViewFinancials` for exports

## Next Steps

1. **Database Migration**: Create Prisma migration to add 3 new columns to `UserOrganization` and `OrganizationRole` tables
2. **Backend Routes**: Implement the 3 enforcement examples in actual API routes
3. **Rate Limiting**: Implement rate limiting service for imports and refreshes
4. **Audit Logging**: Create audit log model and service
5. **Frontend UI**: Update Admin Dashboard to show new permissions in role templates
6. **Testing**: Write integration tests for permission checks and rate limiting

## Verification

All updates completed successfully:
- ✅ 4 schema definitions updated (OrganizationRole + 3 UserOrganization variants)
- ✅ Context and problem statement updated
- ✅ New section 10.5 added with full implementation examples
- ✅ All references to "11 permission flags" → "14 permission flags"
- ✅ All references to "4 categories" → "5 categories"
- ✅ Authorization flow updated
- ✅ User story acceptance criteria updated
- ✅ Consequences section updated
- ✅ Decision rule table updated

## File Status

**File**: `docs/adrs/ADR-005-multi-tenant-access-control/ADR-005-DECISION.md`
**Status**: Modified (not committed)
**Lines Modified**: ~150 lines across 11 sections
