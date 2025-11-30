# Accessibility Remediation Guide
**ADR-005: Multi-Tenant Access Control UI**
**Target Standard**: WCAG 2.1 AA Compliance

---

## Quick Reference

| Issue | Priority | Estimated Time | Files Affected |
|-------|---------|----------------|----------------|
| Button accessible names | 🔴 Critical | 2 hours | UserManagement.tsx, ApiServerManager.tsx |
| Form label association | 🔴 Critical | 1.5 hours | LoginScreen.tsx, UserPermissionModal.tsx |
| Modal focus trapping | 🔴 Critical | 3 hours | All modals |
| Modal ARIA roles | 🟠 High | 1 hour | All modals |
| Status indicator icons | 🟠 High | 1.5 hours | StatusBadge.tsx |
| Heading hierarchy | 🟡 Medium | 1 hour | All admin pages |

**Total Estimated Effort**: 10 hours

---

## Critical Fix 1: Button Accessible Names

### Problem
Icon-only buttons lack accessible names, making them unusable with screen readers.

### WCAG Guideline Violated
- **4.1.2 Name, Role, Value** (Level A)

### Affected Files
- `components/admin/UserManagement.tsx` (lines 273-323)
- `components/admin/ApiServerManager.tsx` (lines 696-733)

---

### Fix: UserManagement.tsx

**Before**:
```tsx
{/* Suspend/Activate Button */}
{user.serviceStatus === 'active' ? (
  <button
    onClick={() => setShowSuspendDialog(user.id)}
    className="p-2 hover:bg-yellow-500/20 text-yellow-400 rounded transition-colors"
    title="Suspend User"
  >
    <Pause className="w-4 h-4" />
  </button>
) : (
  <button
    onClick={() => handleActivate(user.id)}
    className="p-2 hover:bg-green-500/20 text-green-400 rounded transition-colors"
    title="Activate User"
  >
    <Play className="w-4 h-4" />
  </button>
)}
```

**After**:
```tsx
{/* Suspend/Activate Button */}
{user.serviceStatus === 'active' ? (
  <button
    onClick={() => setShowSuspendDialog(user.id)}
    aria-label={`Suspend user ${user.username}`}
    title="Suspend User"
    className="p-2 hover:bg-yellow-500/20 text-yellow-400 rounded transition-colors"
  >
    <Pause className="w-4 h-4" aria-hidden="true" />
  </button>
) : (
  <button
    onClick={() => handleActivate(user.id)}
    aria-label={`Activate user ${user.username}`}
    title="Activate User"
    className="p-2 hover:bg-green-500/20 text-green-400 rounded transition-colors"
  >
    <Play className="w-4 h-4" aria-hidden="true" />
  </button>
)}

{/* Organization Permissions Button */}
<button
  onClick={() => setPermissionsUserId(user.id)}
  aria-label={`Manage permissions for ${user.username}`}
  title="Manage Organization Permissions"
  className="p-2 hover:bg-purple-500/20 text-purple-400 rounded transition-colors"
>
  <Shield className="w-4 h-4" aria-hidden="true" />
</button>

{/* Edit Button */}
<button
  onClick={() => setSelectedUser(user)}
  aria-label={`Edit user ${user.username}`}
  title="Edit User"
  className="p-2 hover:bg-blue-500/20 text-blue-400 rounded transition-colors"
>
  <Edit className="w-4 h-4" aria-hidden="true" />
</button>

{/* Delete Button */}
<button
  onClick={() => handleDelete(user)}
  disabled={user.authProvider === 'pems'}
  aria-label={
    user.authProvider === 'pems'
      ? `Cannot delete PEMS user ${user.username}`
      : `Delete user ${user.username}`
  }
  title={user.authProvider === 'pems' ? 'Cannot delete PEMS users' : 'Delete User'}
  className={`p-2 rounded transition-colors ${
    user.authProvider === 'pems'
      ? 'text-slate-600 cursor-not-allowed'
      : 'hover:bg-red-500/20 text-red-400'
  }`}
>
  <Trash2 className="w-4 h-4" aria-hidden="true" />
</button>
```

**Key Changes**:
1. Added `aria-label` with descriptive text including context (user name)
2. Added `aria-hidden="true"` to icon components (icons are decorative)
3. Kept `title` attribute for tooltip (optional but helpful)

---

### Fix: ApiServerManager.tsx

**Before**:
```tsx
<button
  onClick={(e) => { e.stopPropagation(); toggleEndpointActivation(endpoint, server.id); }}
  className={`p-1.5 rounded transition-colors ${
    endpoint.isActive
      ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
      : 'text-gray-400 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
  }`}
  title={endpoint.isActive ? 'Deactivate' : 'Activate'}
>
  {endpoint.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
</button>
```

**After**:
```tsx
<button
  onClick={(e) => { e.stopPropagation(); toggleEndpointActivation(endpoint, server.id); }}
  aria-label={endpoint.isActive ? `Deactivate endpoint ${endpoint.name}` : `Activate endpoint ${endpoint.name}`}
  title={endpoint.isActive ? 'Deactivate' : 'Activate'}
  className={`p-1.5 rounded transition-colors ${
    endpoint.isActive
      ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
      : 'text-gray-400 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
  }`}
>
  {endpoint.isActive ? (
    <Eye className="w-4 h-4" aria-hidden="true" />
  ) : (
    <EyeOff className="w-4 h-4" aria-hidden="true" />
  )}
</button>

<button
  onClick={(e) => { e.stopPropagation(); testEndpoint(endpoint.id); }}
  disabled={isTesting || !endpoint.isActive}
  aria-label={isTesting ? `Testing endpoint ${endpoint.name}...` : `Test endpoint ${endpoint.name}`}
  title={endpoint.isActive ? 'Test' : 'Activate to test'}
  className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors disabled:opacity-50"
>
  {isTesting ? (
    <div className="w-4 h-4 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
  ) : (
    <Play className="w-4 h-4" aria-hidden="true" />
  )}
</button>
```

---

## Critical Fix 2: Form Label Association

### Problem
Input fields do not have programmatically associated labels, failing screen reader announcements.

### WCAG Guideline Violated
- **1.3.1 Info and Relationships** (Level A)
- **4.1.2 Name, Role, Value** (Level A)

### Affected Files
- `components/LoginScreen.tsx` (lines 93-120)
- `components/admin/UserPermissionModal.tsx` (lines 329-356)

---

### Fix: LoginScreen.tsx

**Before**:
```tsx
<div className="space-y-2">
  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Username</label>
  <div className="relative">
    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
    <input
      type="text"
      value={username}
      onChange={e => setUsername(e.target.value)}
      className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900..."
      placeholder="Enter your username"
    />
  </div>
</div>
```

**After**:
```tsx
<div className="space-y-2">
  <label
    htmlFor="login-username"
    className="text-sm font-semibold text-slate-700 dark:text-slate-300"
  >
    Username
  </label>
  <div className="relative">
    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" aria-hidden="true" />
    <input
      id="login-username"
      type="text"
      name="username"
      value={username}
      onChange={e => setUsername(e.target.value)}
      aria-label="Username"
      aria-required="true"
      className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900..."
      placeholder="Enter your username"
      autoComplete="username"
    />
  </div>
</div>

<div className="space-y-2">
  <label
    htmlFor="login-password"
    className="text-sm font-semibold text-slate-700 dark:text-slate-300"
  >
    Password
  </label>
  <div className="relative">
    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" aria-hidden="true" />
    <input
      id="login-password"
      type="password"
      name="password"
      value={password}
      onChange={e => setPassword(e.target.value)}
      aria-label="Password"
      aria-required="true"
      className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900..."
      placeholder="Enter your password"
      autoComplete="current-password"
    />
  </div>
</div>
```

**Key Changes**:
1. Added `htmlFor` on label matching `id` on input
2. Added `name` attribute for form semantics
3. Added `aria-label` as secondary label
4. Added `aria-required="true"` for required fields
5. Added `autoComplete` for browser autofill
6. Added `aria-hidden="true"` to decorative icons

---

### Fix: UserPermissionModal.tsx

**Before**:
```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Job Role
  </label>
  <input
    type="text"
    value={role}
    onChange={(e) => setRole(e.target.value)}
    onBlur={fetchSuggestion}
    placeholder="e.g., Project Manager"
    className="w-full px-3 py-2 border border-gray-300 rounded-md..."
  />
</div>
```

**After**:
```tsx
<div>
  <label
    htmlFor="permission-role"
    className="block text-sm font-medium text-gray-700 mb-2"
  >
    Job Role
  </label>
  <input
    id="permission-role"
    name="role"
    type="text"
    value={role}
    onChange={(e) => setRole(e.target.value)}
    onBlur={fetchSuggestion}
    aria-label="Job role for permission suggestions"
    placeholder="e.g., Project Manager"
    className="w-full px-3 py-2 border border-gray-300 rounded-md..."
  />
</div>

<div>
  <label
    htmlFor="permission-department"
    className="block text-sm font-medium text-gray-700 mb-2"
  >
    Department
  </label>
  <input
    id="permission-department"
    name="department"
    type="text"
    value={department}
    onChange={(e) => setDepartment(e.target.value)}
    onBlur={fetchSuggestion}
    aria-label="Department for permission suggestions"
    placeholder="e.g., Construction"
    className="w-full px-3 py-2 border border-gray-300 rounded-md..."
  />
</div>

<div>
  <label
    htmlFor="permission-role-template"
    className="block text-sm font-medium text-gray-700 mb-2"
  >
    Role Template
  </label>
  <select
    id="permission-role-template"
    name="roleTemplate"
    value={selectedRole}
    onChange={(e) => setSelectedRole(e.target.value)}
    aria-label="Select a predefined role template"
    className="w-full px-3 py-2 border border-gray-300 rounded-md..."
  >
    {ROLES.map((r) => (
      <option key={r.value} value={r.value}>
        {r.label} - {r.description}
      </option>
    ))}
  </select>
</div>
```

---

## Critical Fix 3: Modal Focus Trapping

### Problem
Focus escapes modal boundaries, violating keyboard navigation expectations.

### WCAG Guideline Violated
- **2.1.2 No Keyboard Trap** (Level A)
- **2.4.3 Focus Order** (Level A)

### Affected Files
- `components/admin/UserManagement.tsx` (Suspend Dialog, lines 332-366)
- `components/admin/EditUserModal.tsx`
- `components/admin/UserPermissionModal.tsx`

---

### Solution: Create Reusable FocusTrap Component

**File**: `components/common/FocusTrap.tsx` (New File)

```tsx
/**
 * FocusTrap Component
 * Traps focus within modal/dialog boundaries for keyboard accessibility
 *
 * Usage:
 *   <FocusTrap>
 *     <div role="dialog">
 *       {modal content}
 *     </div>
 *   </FocusTrap>
 */

import { useEffect, useRef, ReactNode } from 'react';

interface FocusTrapProps {
  children: ReactNode;
  active?: boolean;
  onEscape?: () => void;
  restoreFocus?: boolean;
}

export function FocusTrap({
  children,
  active = true,
  onEscape,
  restoreFocus = true,
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // Store currently focused element
    previouslyFocusedElement.current = document.activeElement as HTMLElement;

    // Get all focusable elements within container
    const getFocusableElements = (): HTMLElement[] => {
      if (!containerRef.current) return [];

      const selector = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(',');

      return Array.from(containerRef.current.querySelectorAll(selector));
    };

    // Focus first element
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    // Handle Tab key
    const handleTab = (e: KeyboardEvent) => {
      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.key === 'Tab') {
        // Shift + Tab (backwards)
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        }
        // Tab (forwards)
        else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }

      // Escape key
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
      }
    };

    document.addEventListener('keydown', handleTab);

    // Cleanup: restore focus
    return () => {
      document.removeEventListener('keydown', handleTab);

      if (restoreFocus && previouslyFocusedElement.current) {
        previouslyFocusedElement.current.focus();
      }
    };
  }, [active, onEscape, restoreFocus]);

  return <div ref={containerRef}>{children}</div>;
}
```

---

### Fix: UserManagement.tsx (Suspend Dialog)

**Before**:
```tsx
{/* Suspend Dialog */}
{showSuspendDialog && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
      <h3 className="text-lg font-bold text-slate-100 mb-4">Suspend User</h3>
      ...
    </div>
  </div>
)}
```

**After**:
```tsx
{/* Suspend Dialog */}
{showSuspendDialog && (
  <FocusTrap
    onEscape={() => {
      setShowSuspendDialog(null);
      setSuspendReason('');
    }}
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="suspend-dialog-title"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowSuspendDialog(null);
          setSuspendReason('');
        }
      }}
    >
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
        <h3 id="suspend-dialog-title" className="text-lg font-bold text-slate-100 mb-4">
          Suspend User
        </h3>
        <p className="text-sm text-slate-300 mb-4">
          Provide a reason for suspending this user (optional):
        </p>
        <textarea
          id="suspend-reason"
          name="suspendReason"
          value={suspendReason}
          onChange={(e) => setSuspendReason(e.target.value)}
          aria-label="Reason for suspension"
          placeholder="e.g., Policy violation, temporary access revoked, etc."
          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          rows={3}
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => handleSuspend(showSuspendDialog)}
            className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded font-medium transition-colors"
          >
            Suspend User
          </button>
          <button
            onClick={() => {
              setShowSuspendDialog(null);
              setSuspendReason('');
            }}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </FocusTrap>
)}
```

**Key Changes**:
1. Wrapped modal in `<FocusTrap>` component
2. Added `role="dialog"` and `aria-modal="true"`
3. Added `aria-labelledby` pointing to title
4. Added `id` attributes for ARIA references
5. Added click-outside handler to close modal
6. Added `aria-label` to textarea

---

## High Priority Fix 4: Modal ARIA Roles

### Problem
Modals lack proper ARIA semantics for screen reader context.

### WCAG Guideline Violated
- **4.1.2 Name, Role, Value** (Level A)

### Fix Template for All Modals

```tsx
<div
  role="dialog"                          // or "alertdialog" for destructive actions
  aria-modal="true"                      // Indicates modal behavior
  aria-labelledby="modal-title-id"      // Points to h2/h3 with modal title
  aria-describedby="modal-desc-id"      // (Optional) Points to description text
  className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
>
  <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
    <h2 id="modal-title-id" className="text-lg font-bold text-slate-100 mb-4">
      Modal Title
    </h2>
    <p id="modal-desc-id" className="text-sm text-slate-300 mb-4">
      Optional description for additional context
    </p>
    ...
  </div>
</div>
```

**Apply to**:
- Suspend Dialog
- Edit User Modal
- Permission Modal
- Revoke Access Dialog
- Unlink Confirmation Dialog

---

## High Priority Fix 5: Status Indicator Icons

### Problem
Status badges rely solely on color, inaccessible to color-blind users.

### WCAG Guideline Violated
- **1.3.3 Sensory Characteristics** (Level A)
- **1.4.1 Use of Color** (Level A)

### Affected File
- `components/StatusBadge.tsx` (New File or enhance existing)

---

### Solution: Enhanced StatusBadge Component

**File**: `components/StatusBadge.tsx`

**Before** (color only):
```tsx
<span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
  ACTIVE
</span>
```

**After** (icon + text + ARIA):
```tsx
/**
 * StatusBadge Component
 * WCAG 2.1 AA Compliant status indicator
 *
 * Features:
 * - Icon + Text (not color alone)
 * - ARIA role="status" for announcements
 * - Semantic color coding
 */

import { CheckCircle, AlertTriangle, XCircle, Clock, Lock } from 'lucide-react';

type ServiceStatus = 'active' | 'suspended' | 'locked' | 'pending';
type EndpointStatus = 'healthy' | 'degraded' | 'down' | 'untested';

interface StatusBadgeProps {
  status: ServiceStatus | EndpointStatus;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG = {
  // Service statuses
  active: {
    icon: CheckCircle,
    label: 'Active',
    className: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800',
    ariaLabel: 'Service status: Active',
  },
  suspended: {
    icon: AlertTriangle,
    label: 'Suspended',
    className: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800',
    ariaLabel: 'Service status: Suspended',
  },
  locked: {
    icon: Lock,
    label: 'Locked',
    className: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800',
    ariaLabel: 'Service status: Locked due to failed login attempts',
  },
  pending: {
    icon: Clock,
    label: 'Pending',
    className: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-700',
    ariaLabel: 'Service status: Pending activation',
  },
  // Endpoint statuses
  healthy: {
    icon: CheckCircle,
    label: 'Healthy',
    className: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800',
    ariaLabel: 'Endpoint status: Healthy',
  },
  degraded: {
    icon: AlertTriangle,
    label: 'Degraded',
    className: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800',
    ariaLabel: 'Endpoint status: Degraded performance',
  },
  down: {
    icon: XCircle,
    label: 'Down',
    className: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800',
    ariaLabel: 'Endpoint status: Down',
  },
  untested: {
    icon: Clock,
    label: 'Untested',
    className: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-700',
    ariaLabel: 'Endpoint status: Not yet tested',
  },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
  };

  return (
    <span
      role="status"
      aria-label={config.ariaLabel}
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.className} ${sizeClasses[size]}`}
    >
      <Icon className={iconSizes[size]} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}
```

**Usage**:
```tsx
<StatusBadge status={user.serviceStatus} size="sm" />
<StatusBadge status={endpoint.status} size="md" />
```

---

## Medium Priority Fix 6: Heading Hierarchy

### Problem
Inconsistent heading structure prevents screen reader navigation.

### WCAG Guideline Violated
- **1.3.1 Info and Relationships** (Level A)

### Fix: UserManagement.tsx

**Before**:
```tsx
<h2 className="text-2xl font-bold text-slate-100">User Management</h2>
```

**After**:
```tsx
<div>
  <h1 className="sr-only">Administration Dashboard</h1>
  <h2 className="text-2xl font-bold text-slate-100">User Management</h2>
</div>
```

**Modal Titles** (change from `<h3>` to `<h2>`):
```tsx
<h2 id="suspend-dialog-title" className="text-lg font-bold text-slate-100 mb-4">
  Suspend User
</h2>
```

**Rationale**: Modals are separate dialog contexts, so they restart heading hierarchy at h2.

---

## Testing After Fixes

### Automated Test
```bash
npx playwright test accessibility/a11y.test.ts --grep "Automated Violations"
```

**Expected Result**: 0 violations

---

### Manual Keyboard Test
1. Tab through User Management page
2. Verify all buttons are reachable
3. Open modal with Enter key
4. Tab through modal elements
5. Verify focus stays in modal
6. Press Escape to close
7. Verify focus returns to trigger button

---

### Screen Reader Test (NVDA)
1. Navigate to User Management
2. Tab to first user row
3. Verify: "Button: Suspend user admin"
4. Tab to edit button
5. Verify: "Button: Edit user admin"
6. Open modal with Enter
7. Verify: "Dialog: Suspend User"
8. Tab to textarea
9. Verify: "Edit, Reason for suspension"

---

## Implementation Checklist

### Phase 1: Critical Fixes (Day 1-2)
- [ ] Add aria-labels to all icon buttons (UserManagement.tsx)
- [ ] Add aria-labels to all icon buttons (ApiServerManager.tsx)
- [ ] Add label associations (LoginScreen.tsx)
- [ ] Add label associations (UserPermissionModal.tsx)
- [ ] Create FocusTrap component
- [ ] Apply FocusTrap to all modals
- [ ] Add ARIA dialog roles to all modals

### Phase 2: High Priority (Day 3)
- [ ] Create enhanced StatusBadge component
- [ ] Replace color-only badges with icon badges
- [ ] Test with automated scanner

### Phase 3: Medium Priority (Day 4)
- [ ] Fix heading hierarchy
- [ ] Add visually-hidden h1 where needed
- [ ] Update modal titles to h2

### Phase 4: Validation (Day 5)
- [ ] Run automated tests (axe-core)
- [ ] Manual keyboard navigation test
- [ ] Manual screen reader test (NVDA)
- [ ] Create final compliance report

---

## Additional Recommendations

### 1. Add Skip Links
```tsx
// In App.tsx or main layout
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded"
>
  Skip to main content
</a>
```

### 2. Improve Focus Indicators
```css
/* Add to global CSS */
*:focus-visible {
  outline: 3px solid #3b82f6;
  outline-offset: 2px;
}
```

### 3. Add Live Regions for Notifications
```tsx
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
>
  {successMessage && successMessage}
</div>
```

---

## Resources

- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM: Keyboard Accessibility](https://webaim.org/techniques/keyboard/)
- [Accessible Modal Dialog Example](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [axe DevTools Browser Extension](https://www.deque.com/axe/devtools/)

---

**Document Version**: 1.0
**Last Updated**: November 27, 2025
**Status**: Ready for Implementation
