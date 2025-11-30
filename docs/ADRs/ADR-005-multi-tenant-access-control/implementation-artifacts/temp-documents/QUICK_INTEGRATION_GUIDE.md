# Quick Integration Guide
## Add Permission Tooltips in 5 Minutes

**Component**: `PermissionExplanationTooltip`
**Use Case**: Explain why buttons are disabled

---

## Step 1: Import the Component (30 seconds)

Add this import to your component file:

```tsx
import { PermissionExplanationTooltip } from '../PermissionExplanationTooltip';
// If in admin/ folder, use: '../../PermissionExplanationTooltip'
```

---

## Step 2: Check User Permissions (1 minute)

Use the existing `useAuth` hook to check permissions:

```tsx
import { useAuth } from '../../contexts/AuthContext';

function YourComponent() {
  const { user, currentOrganizationId } = useAuth();

  // Method 1: Check specific permission from JWT
  const canSync = user?.organizations.find(
    o => o.id === currentOrganizationId
  )?.permissions?.perm_Sync === true;

  // Method 2: Check role-based permission
  const isAdmin = user?.role === 'admin';

  // Method 3: Check multiple conditions
  const canDelete = isAdmin && user?.serviceStatus === 'active';
}
```

---

## Step 3: Wrap Your Disabled Button (2 minutes)

### Before:
```tsx
<button
  onClick={() => handleSync()}
  disabled={!canSync}
  className="px-4 py-2 bg-green-600 text-white rounded"
>
  Sync Data
</button>
```

### After:
```tsx
<PermissionExplanationTooltip
  action="pems:sync"
  isDisabled={!canSync}
>
  <button
    onClick={() => handleSync()}
    disabled={!canSync}
    className="px-4 py-2 bg-green-600 text-white rounded"
  >
    Sync Data
  </button>
</PermissionExplanationTooltip>
```

---

## Step 4: (Optional) Add Debug Mode for Admins (30 seconds)

```tsx
<PermissionExplanationTooltip
  action="pems:sync"
  isDisabled={!canSync}
  debugMode={user?.role === 'admin'} // Shows full permission chain
>
  <button disabled={!canSync}>Sync Data</button>
</PermissionExplanationTooltip>
```

---

## Step 5: (Optional) Add Request Access Callback (1 minute)

```tsx
const handleRequestAccess = () => {
  // Option 1: Open a modal
  setShowAccessRequestModal(true);

  // Option 2: Navigate to access request page
  window.location.href = '/admin/request-access';

  // Option 3: Send email
  window.location.href = 'mailto:admin@company.com?subject=Request Access';
};

<PermissionExplanationTooltip
  action="pems:sync"
  isDisabled={!canSync}
  onRequestAccess={handleRequestAccess}
>
  <button disabled={!canSync}>Sync Data</button>
</PermissionExplanationTooltip>
```

---

## Common Actions (Permission Strings)

Use these standardized action strings:

| Feature | Action String | Description |
|---------|---------------|-------------|
| **PEMS Sync** | `pems:sync` | Sync data from PEMS API |
| **PEMS Write** | `pems:write` | Write data to PEMS API |
| **User Management** | `users:manage` | Create/edit users |
| **User Delete** | `users:delete` | Delete user accounts |
| **User Suspend** | `users:suspend` | Suspend user accounts |
| **Org Management** | `organizations:manage` | Create/edit organizations |
| **Org Delete** | `organizations:delete` | Delete organizations |
| **Settings** | `settings:manage` | Modify system settings |
| **API Config** | `api:manage` | Configure API endpoints |
| **Import Data** | `data:import` | Import CSV/Excel files |
| **Export Data** | `data:export` | Export PFA data |
| **View Financials** | `financials:view` | View cost/budget data |
| **Edit Forecast** | `pfa:edit-forecast` | Modify forecast dates |
| **Edit Actuals** | `pfa:edit-actuals` | Modify actual dates |
| **Refresh Data** | `pfa:refresh` | Reload PFA data from DB |

---

## Real-World Examples

### Example 1: Sync Button in ApiConnectivity.tsx

**File**: `components/admin/ApiConnectivity.tsx`
**Location**: Line 1070-1088

**Current Code**:
```tsx
{selectedConfig.feeds && (
  <button
    onClick={() => handleSyncData(selectedConfig)}
    disabled={isSyncing}
    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
  >
    {isSyncing ? (
      <>
        <Loader2 className="w-4 h-4 animate-spin" />
        Syncing...
      </>
    ) : (
      <>
        <RefreshCw className="w-4 h-4" />
        Sync Data
      </>
    )}
  </button>
)}
```

**Updated Code**:
```tsx
{selectedConfig.feeds && (
  <PermissionExplanationTooltip
    action="pems:sync"
    isDisabled={!canSync}
    debugMode={user?.role === 'admin'}
  >
    <button
      onClick={() => handleSyncData(selectedConfig)}
      disabled={isSyncing || !canSync} // Add permission check
      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
    >
      {isSyncing ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Syncing...
        </>
      ) : (
        <>
          <RefreshCw className="w-4 h-4" />
          Sync Data
        </>
      )}
    </button>
  </PermissionExplanationTooltip>
)}
```

**Changes**:
1. Added import: `import { PermissionExplanationTooltip } from '../PermissionExplanationTooltip';`
2. Added permission check: `const canSync = user?.organizations.find(...)`
3. Wrapped button with `<PermissionExplanationTooltip>`
4. Updated disabled condition: `disabled={isSyncing || !canSync}`

---

### Example 2: Delete Button in UserManagement.tsx

**File**: `components/admin/UserManagement.tsx`
**Location**: Line 310-323

**Current Code**:
```tsx
<button
  onClick={() => handleDelete(user)}
  disabled={user.authProvider === 'pems'}
  className={`p-2 rounded transition-colors ${
    user.authProvider === 'pems'
      ? 'text-slate-600 cursor-not-allowed'
      : 'hover:bg-red-500/20 text-red-400'
  }`}
  title={user.authProvider === 'pems' ? 'Cannot delete PEMS users' : 'Delete User'}
>
  <Trash2 className="w-4 h-4" />
</button>
```

**Updated Code**:
```tsx
<PermissionExplanationTooltip
  action="users:delete"
  isDisabled={!canDelete || user.authProvider === 'pems'}
>
  <button
    onClick={() => handleDelete(user)}
    disabled={!canDelete || user.authProvider === 'pems'}
    className={`p-2 rounded transition-colors ${
      !canDelete || user.authProvider === 'pems'
        ? 'text-slate-600 cursor-not-allowed'
        : 'hover:bg-red-500/20 text-red-400'
    }`}
  >
    <Trash2 className="w-4 h-4" />
  </button>
</PermissionExplanationTooltip>
```

**Changes**:
1. Removed hardcoded `title` attribute (tooltip replaces it)
2. Added permission check: `const canDelete = ...`
3. Wrapped button with `<PermissionExplanationTooltip>`

---

### Example 3: Multiple Buttons in a Row

```tsx
<div className="flex gap-2">
  {/* Edit Button */}
  <PermissionExplanationTooltip action="users:edit" isDisabled={!canEdit}>
    <button disabled={!canEdit}>
      <Edit className="w-4 h-4" />
    </button>
  </PermissionExplanationTooltip>

  {/* Delete Button */}
  <PermissionExplanationTooltip action="users:delete" isDisabled={!canDelete}>
    <button disabled={!canDelete}>
      <Trash2 className="w-4 h-4" />
    </button>
  </PermissionExplanationTooltip>

  {/* Suspend Button */}
  <PermissionExplanationTooltip action="users:suspend" isDisabled={!canSuspend}>
    <button disabled={!canSuspend}>
      <Pause className="w-4 h-4" />
    </button>
  </PermissionExplanationTooltip>
</div>
```

Each button gets a unique explanation based on its `action` prop.

---

## Troubleshooting

### Issue: Tooltip doesn't appear
**Solution**: Check that `isDisabled={true}`. Tooltip only shows for disabled buttons.

### Issue: API 401 error
**Solution**: Ensure user is logged in and JWT token is valid.

### Issue: Tooltip shows generic message
**Solution**: Backend may be failing. Check browser console for errors.

### Issue: Tooltip appears instantly
**Solution**: This is intentional if you hover again within 15 minutes (cached explanation).

### Issue: DOMPurify errors
**Solution**: Ensure `npm install dompurify @types/dompurify` was run.

---

## Performance Tips

1. **Pre-load explanations**: Use `explainBatchPermissions()` API to load tooltips for all buttons at once
2. **Cache reuse**: Second hover is instant (cached for 15 minutes)
3. **Lazy loading**: Only fetches explanation on first hover (not on page load)

---

## Accessibility Tips

1. **Always wrap disabled buttons**: Screen readers need the tooltip
2. **Use semantic HTML**: `<button disabled>`, not `<div onclick>`
3. **Test with keyboard**: ESC, Tab, Enter should all work

---

## Testing Your Integration

After adding the tooltip, test these scenarios:

1. **Hover Test**: Hover over disabled button → Tooltip appears after 300ms
2. **Modal Test**: Click "Learn More" → Full explanation modal opens
3. **ESC Test**: Press ESC → Modal closes
4. **Permission Change Test**: Grant permission → Button becomes enabled, tooltip disappears
5. **Error Test**: Disconnect backend → Fallback message appears

---

## Support

**Backend API Endpoint**: `POST /api/permissions/explain`
**Backend Service**: `backend/src/services/permissions/PermissionExplanationService.ts`
**Frontend Component**: `components/PermissionExplanationTooltip.tsx`
**Usage Examples**: `components/admin/EXAMPLE_PermissionTooltip_Usage.tsx`

**Questions?** Check the full implementation summary in `temp/PHASE7-TASK7.1-IMPLEMENTATION-SUMMARY.md`
