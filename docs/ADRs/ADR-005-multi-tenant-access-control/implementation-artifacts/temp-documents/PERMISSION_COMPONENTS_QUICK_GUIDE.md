# Permission-Aware Components - Quick Reference Guide

**Phase 2B, Task 2B.1** | **Date**: 2025-11-27

---

## 🚀 Quick Start

### 1. Import What You Need

```typescript
// For permission checks
import { usePermissions } from '../hooks/usePermissions';

// For conditional content
import { PermissionGuard } from './PermissionGuard';

// For permission-aware buttons
import { PermissionButton } from './PermissionButton';

// For testing (optional)
import { MOCK_ADMIN_USER, mockLogin } from '../mockData/mockPermissions';
```

---

## 🎯 Common Use Cases

### Use Case 1: Hide Content Based on Permission

```tsx
<PermissionGuard permission="perm_ManageUsers">
  <UserManagementPanel />
</PermissionGuard>
```

### Use Case 2: Show Reason Why Content is Hidden

```tsx
<PermissionGuard permission="perm_EditForecast" showReason>
  <ForecastEditor />
</PermissionGuard>
```

### Use Case 3: Custom Fallback Content

```tsx
<PermissionGuard
  permission="perm_ViewFinancials"
  fallback={<div>Contact admin to view financial data</div>}
>
  <FinancialDashboard />
</PermissionGuard>
```

### Use Case 4: Disable Buttons Based on Permission

```tsx
<PermissionButton
  permission="perm_SaveDraft"
  onClick={handleSaveDraft}
  className="btn-primary"
>
  Save Draft
</PermissionButton>
```

### Use Case 5: Check Permissions in Code

```tsx
function MyComponent() {
  const { hasPermission, isReadOnly } = usePermissions();

  if (hasPermission('perm_EditForecast')) {
    // Show edit UI
  }

  if (isReadOnly) {
    // Show read-only warning
  }
}
```

---

## 📋 All 14 Permissions

| Permission | Description | Typical Use |
|------------|-------------|-------------|
| `perm_Read` | View data | Timeline, Grid, Matrix views |
| `perm_EditForecast` | Edit forecast dates | Drag-and-drop, bulk operations |
| `perm_EditActuals` | Edit actual dates | Import actual data |
| `perm_Delete` | Delete records | Delete buttons, bulk delete |
| `perm_Import` | Import data | CSV import |
| `perm_RefreshData` | Sync with PEMS | Refresh button |
| `perm_Export` | Export data | Export to CSV/Excel |
| `perm_ViewFinancials` | View costs | KPI Board, cost columns |
| `perm_SaveDraft` | Save drafts | Draft save button |
| `perm_Sync` | Sync to PEMS | Commit/sync button |
| `perm_ManageUsers` | Manage users | User admin panel |
| `perm_ManageSettings` | Manage settings | System settings, API config |
| `perm_ConfigureAlerts` | Configure alerts | Alert configuration |
| `perm_Impersonate` | Impersonate users | Admin impersonation feature |

---

## 🎨 Component Props Reference

### PermissionGuard

```typescript
<PermissionGuard
  permission="perm_EditForecast"        // Required: permission name
  showReason={true}                     // Optional: show yellow banner
  reasonMessage="Custom message"        // Optional: custom reason text
  fallback={<FallbackComponent />}      // Optional: show if denied
>
  <ProtectedContent />
</PermissionGuard>
```

### PermissionButton

```typescript
<PermissionButton
  permission="perm_SaveDraft"           // Required: permission name
  onClick={handleClick}                 // Required: click handler
  tooltipMessage="Custom tooltip"       // Optional: custom tooltip
  showLockIcon={true}                   // Optional: show lock icon (default: true)
  className="btn-primary"               // Optional: CSS classes
  disabled={false}                      // Optional: additional disable condition
>
  Button Text
</PermissionButton>
```

### usePermissions Hook

```typescript
const {
  permissions,      // Current org's permission object
  hasPermission,    // Function: (permission, orgId?) => boolean
  isReadOnly,       // Boolean: no write permissions
  role              // String: user's role in current org
} = usePermissions();
```

---

## 🧪 Testing with Mock Data

### Setup Mock User

```typescript
import { mockLogin } from '../mockData/mockPermissions';

// In your test or development setup
const { token, user } = mockLogin('admin');  // or 'manager', 'editor', 'viewer'

// Store in AuthContext
authContext.login(user, token);
```

### Available Mock Users

| Mock User | Role | Key Permissions |
|-----------|------|-----------------|
| `MOCK_ADMIN_USER` | admin | All permissions |
| `MOCK_MANAGER_USER` | user | All except admin/impersonate |
| `MOCK_EDITOR_USER` | user | Edit + Draft, no Sync/Delete |
| `MOCK_VIEWER_USER` | viewer | Read + Export only |
| `MOCK_MULTI_ORG_USER` | user | Different perms per org |

---

## 🔧 Integration Examples

### Example 1: Protect Command Deck Operations

```tsx
// File: components/CommandDeck.tsx

import { PermissionButton } from './PermissionButton';

function CommandDeck() {
  return (
    <div className="command-deck">
      <PermissionButton
        permission="perm_EditForecast"
        onClick={handleShiftDates}
        className="btn-primary"
      >
        Shift Dates
      </PermissionButton>

      <PermissionButton
        permission="perm_Delete"
        onClick={handleBulkDelete}
        className="btn-danger"
      >
        Delete Selected
      </PermissionButton>

      <PermissionButton
        permission="perm_Sync"
        onClick={handleSyncToPems}
        className="btn-success"
      >
        Sync to PEMS
      </PermissionButton>
    </div>
  );
}
```

### Example 2: Conditional Admin Menu

```tsx
// File: App.tsx

import { PermissionGuard } from './components/PermissionGuard';

function App() {
  return (
    <div className="app">
      <nav>
        <MenuItem label="Dashboard" onClick={...} />
        <MenuItem label="Timeline" onClick={...} />

        <PermissionGuard permission="perm_ManageUsers">
          <MenuItem label="User Management" onClick={...} />
        </PermissionGuard>

        <PermissionGuard permission="perm_ManageSettings">
          <MenuItem label="System Settings" onClick={...} />
        </PermissionGuard>
      </nav>
    </div>
  );
}
```

### Example 3: Read-Only Banner

```tsx
// File: components/Header.tsx

import { usePermissions } from '../hooks/usePermissions';

function Header() {
  const { isReadOnly } = usePermissions();

  return (
    <header>
      <h1>PFA Vanguard</h1>

      {isReadOnly && (
        <div className="alert alert-info">
          You are in read-only mode. Contact admin to request edit permissions.
        </div>
      )}
    </header>
  );
}
```

### Example 4: Conditional Form Fields

```tsx
// File: components/ForecastEditor.tsx

import { usePermissions } from '../hooks/usePermissions';

function ForecastEditor() {
  const { hasPermission } = usePermissions();

  return (
    <form>
      <input type="date" name="forecastStart" disabled={!hasPermission('perm_EditForecast')} />
      <input type="date" name="forecastEnd" disabled={!hasPermission('perm_EditForecast')} />

      {hasPermission('perm_SaveDraft') && (
        <button type="button" onClick={handleSaveDraft}>
          Save Draft
        </button>
      )}

      {hasPermission('perm_Sync') && (
        <button type="button" onClick={handleCommit}>
          Commit Changes
        </button>
      )}
    </form>
  );
}
```

---

## ⚠️ Important Reminders

### 1. Frontend Permissions are for UX ONLY

```tsx
// ❌ WRONG - Relying on frontend for security
<PermissionButton permission="perm_Delete" onClick={deleteRecord}>
  Delete
</PermissionButton>
// Backend doesn't check permission - SECURITY HOLE!

// ✅ CORRECT - Frontend + Backend enforcement
<PermissionButton permission="perm_Delete" onClick={deleteRecord}>
  Delete
</PermissionButton>
// Backend route: requirePermission('perm_Delete') ✅
```

### 2. Always Wrap App in AuthProvider

```tsx
// main.tsx or App.tsx
import { AuthProvider } from './contexts/AuthContext';

<AuthProvider>
  <App />
</AuthProvider>
```

### 3. Handle Unauthenticated State

```tsx
const { user, isAuthenticated } = useAuth();
const { permissions } = usePermissions();

if (!isAuthenticated) {
  return <LoginScreen />;
}

if (!permissions) {
  return <Loading />;
}
```

---

## 🐛 Common Pitfalls

### Pitfall 1: Using Permission Checks Before Login

```tsx
// ❌ WRONG - Component renders before user loaded
function Dashboard() {
  const { hasPermission } = usePermissions();
  return hasPermission('perm_Read') ? <Data /> : null;
}

// ✅ CORRECT - Check authentication first
function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = usePermissions();

  if (!isAuthenticated || !user) {
    return <LoginScreen />;
  }

  return hasPermission('perm_Read') ? <Data /> : null;
}
```

### Pitfall 2: Forgetting to Update on Org Switch

```tsx
// ❌ WRONG - Storing permissions in local state (won't update on org switch)
const [canEdit, setCanEdit] = useState(hasPermission('perm_EditForecast'));

// ✅ CORRECT - Call hasPermission() directly (auto-updates)
const canEdit = hasPermission('perm_EditForecast');
```

### Pitfall 3: Hardcoding Organization ID

```tsx
// ❌ WRONG - Hardcoded org ID
const canEdit = hasPermission('perm_EditForecast', 'org-holng-001');

// ✅ CORRECT - Use current org (or pass dynamic org ID)
const canEdit = hasPermission('perm_EditForecast');
```

---

## 📚 Further Reading

- **Full Implementation Summary**: `temp/PHASE2B_TASK2B.1_IMPLEMENTATION_SUMMARY.md`
- **ADR-005**: Multi-Tenant Access Control
- **Backend Permission Middleware**: `backend/src/middleware/requirePermission.ts`
- **API Authorization**: `temp/PHASE2_TASK2.2_IMPLEMENTATION_SUMMARY.md`

---

**Questions?** Refer to the full implementation summary or ask a team member familiar with ADR-005.
