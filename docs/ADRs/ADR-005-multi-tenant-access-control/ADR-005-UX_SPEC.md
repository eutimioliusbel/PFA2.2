# ADR-005: Multi-Tenant Access Control - UX Specification

**Related**: ADR-005 (Multi-Tenant Access Control)
**Status**: UX Design Complete
**Created**: 2025-11-26
**Last Updated**: 2025-11-26

---

## 🎯 Purpose

This document defines the "Perceived Performance" and user behavior for the Multi-Tenant Access Control feature. It ensures the UI feels robust, responsive, and provides clear feedback for all permission-related actions.

---

## ⚡ Optimistic UI Rules

### 1. Permission Changes (Instant Feedback)

**User Action**: Admin grants "canWrite" permission to a user

**UI Behavior**:
```typescript
// BEFORE server response
✅ Immediately update checkbox to checked state
✅ Show subtle loading indicator (spinner on checkbox)
✅ Disable other permission controls (prevent race conditions)
✅ Keep "Save Changes" button enabled with loading state

// AFTER server success (200ms later)
✅ Remove loading indicator
✅ Re-enable controls
✅ Show success toast: "Permissions updated for [username]"
✅ Update "Last Modified" timestamp

// AFTER server error (if occurs)
❌ Revert checkbox to unchecked
❌ Show error toast: "Failed to update permissions. Try again."
❌ Re-enable controls
```

**Why**: Permission changes feel instant, but users see clear feedback if something goes wrong.

---

### 2. User Suspension (Two-Step Confirmation)

**User Action**: Admin clicks "Suspend User" button

**UI Behavior**:
```typescript
// Step 1: Confirmation Modal
Modal appears:
  "Suspend [username]?"
  "This will immediately revoke access to all organizations."
  [Reason for suspension] (required textarea)
  [Cancel] [Confirm Suspension] (red button)

// Step 2: Optimistic Update
IMMEDIATELY after "Confirm":
  ✅ Close modal
  ✅ Fade out user row with "Suspending..." overlay
  ✅ Disable all actions on this user
  ✅ Show loading toast: "Suspending [username]..."

// Step 3: Server Response (500ms later)
SUCCESS:
  ✅ User row badge changes to "Suspended" (red)
  ✅ Success toast: "[username] has been suspended"
  ✅ Action buttons change: [Reactivate] [View Details]

ERROR:
  ❌ Remove overlay, restore user row
  ❌ Error toast: "Failed to suspend user: [error message]"
  ❌ Re-enable actions
```

**Why**: Critical action requires confirmation but feels immediate after confirmation.

---

### 3. Organization Service Status Toggle

**User Action**: Admin changes org status from "active" to "suspended"

**UI Behavior**:
```typescript
// Optimistic Update
IMMEDIATELY:
  ✅ Dropdown value changes to "Suspended"
  ✅ Org card gets red outline
  ✅ Show warning badge: "Sync Disabled"
  ✅ Disable "Sync Data" button
  ✅ Show info tooltip: "PEMS sync paused for suspended org"

// Server Response (300ms later)
SUCCESS:
  ✅ Success toast: "Organization suspended. Sync will be skipped."
  ✅ Update "Suspended At" timestamp
  ✅ Show "Suspended By: [admin name]"

ERROR:
  ❌ Revert dropdown to "Active"
  ❌ Remove red outline
  ❌ Error toast: "Failed to suspend org: [reason]"
  ❌ Re-enable sync button
```

**Why**: Users see immediate visual feedback but can correct errors if server rejects.

---

## 🔄 Loading States

### 1. Permission Management Modal

**Skeleton Screen**:
```
┌─────────────────────────────────────────┐
│ Manage Permissions for [username]      │
├─────────────────────────────────────────┤
│ Organization: [Skeleton Dropdown ▼]    │
│                                         │
│ Role: [███████ Loading...]             │
│                                         │
│ Permissions:                            │
│   [▢] Can Read      [████ Loading]     │
│   [▢] Can Write     [████ Loading]     │
│   [▢] Can Delete    [████ Loading]     │
│   [▢] Can Sync      [████ Loading]     │
│                                         │
│ [Cancel] [Save Changes (disabled)]      │
└─────────────────────────────────────────┘
```

**Loading States**:
- **Initial Load (0-500ms)**: Show skeleton
- **Network Delay (>500ms)**: Add "Loading permissions..." text
- **Slow Network (>2000ms)**: Show warning "This is taking longer than usual. Please wait."

---

### 2. User List Table

**Skeleton Screen**:
```
┌─────────┬──────────┬────────────┬──────────┬─────────┐
│ Username│ Email    │ Role       │ Status   │ Actions │
├─────────┼──────────┼────────────┼──────────┼─────────┤
│ ████████│██████████│████████████│██████████│ ███████ │
│ ████████│██████████│████████████│██████████│ ███████ │
│ ████████│██████████│████████████│██████████│ ███████ │
└─────────┴──────────┴────────────┴──────────┴─────────┘
```

**Progressive Loading**:
- **Fast Connection (<200ms)**: No skeleton, direct render
- **Normal Connection (200-500ms)**: Show 5 skeleton rows
- **Slow Connection (>500ms)**: Show skeleton + "Loading users..."

---

### 3. Organization Health Dashboard

**Skeleton Screen**:
```
┌───────────────────────────────────────────────────┐
│ Organization Health                               │
├───────────────────────────────────────────────────┤
│ [████ Org Name] [███ Status] [███ Last Sync]     │
│                                                   │
│ Active Users: [██ Loading...]                    │
│ Failed Syncs:  [██ Loading...]                    │
│ Health Score:  [███████████████████]              │
│                                                   │
│ [Refresh] [View Details]                         │
└───────────────────────────────────────────────────┘
```

---

## ⚠️ Error Handling (Fail Gracefully)

### 1. Permission Grant Failed

**Error**: 403 Forbidden - User doesn't have permission to grant this level of access

**UI Behavior**:
```typescript
❌ Revert optimistic update (uncheck checkbox)
❌ Show error toast (5 seconds):
   "Permission Denied"
   "You don't have permission to grant 'canManageUsers' access."
   "Contact an administrator for help."
   [Dismiss]

❌ Highlight the failing permission field (red border)
❌ Show inline error message below field
❌ Keep modal open so user can fix error
```

---

### 2. Network Timeout (Sync Operation)

**Error**: Sync operation timed out after 30 seconds

**UI Behavior**:
```typescript
❌ Show error modal (not toast, stays visible):
   "Sync Operation Timed Out"
   "The sync operation is taking longer than expected."
   "What would you like to do?"
   [Keep Waiting] [Cancel Sync] [Run in Background]

❌ If "Keep Waiting": Poll status every 5 seconds
❌ If "Cancel Sync": Send cancellation request
❌ If "Run in Background": Close modal, show notification bell with progress
```

---

### 3. Concurrent Modification Conflict

**Error**: 409 Conflict - Another admin modified the same permission

**UI Behavior**:
```typescript
❌ Show conflict modal:
   "Permission Conflict Detected"
   "Another admin (admin2) modified this user's permissions 10 seconds ago."

   Your Changes:           │ Their Changes:
   ─────────────────────── │ ───────────────────────
   canWrite: false → true  │ canDelete: false → true
   canSync: false → true   │ canSync: false → true

   [Cancel] [Overwrite Their Changes] [Merge Changes]

❌ If "Merge": Apply both sets of changes (safe merge)
❌ If "Overwrite": Force apply user's changes
❌ If "Cancel": Discard user's changes, reload from server
```

---

## ⏱️ Latency Budgets

### Critical Actions (Must Complete Fast)

| Action | Target Latency | Max Acceptable | Perceived Performance |
|--------|----------------|----------------|------------------------|
| **Permission Toggle** | <100ms | 300ms | Optimistic UI required |
| **User Suspension** | <200ms | 500ms | Optimistic UI required |
| **Org Status Change** | <200ms | 500ms | Optimistic UI required |
| **Load User List** | <300ms | 1000ms | Skeleton screen after 200ms |
| **Load Permission Modal** | <200ms | 500ms | Skeleton if >200ms |

### Non-Critical Actions (Can Be Slower)

| Action | Target Latency | Max Acceptable | Perceived Performance |
|--------|----------------|----------------|------------------------|
| **Audit Log Query** | <1000ms | 3000ms | Show "Searching..." after 500ms |
| **Export User List** | <2000ms | 10000ms | Progress bar, can run in background |
| **Health Dashboard Load** | <500ms | 2000ms | Skeleton screen, progressive loading |

**Enforcement**:
- Add latency monitoring to all permission API endpoints
- Log slow requests (>target latency) for optimization
- Show "slow network" warning if >2x target latency

---

## ♿ Accessibility Requirements

### 1. Keyboard Navigation

**Permission Management Modal**:
```
Tab Order:
1. Organization dropdown
2. Role dropdown
3. canRead checkbox
4. canWrite checkbox
5. canDelete checkbox
6. canManageUsers checkbox
7. canSync checkbox
8. canManageSettings checkbox
9. Cancel button
10. Save Changes button

Keyboard Shortcuts:
- Esc: Close modal (with unsaved changes warning)
- Enter on "Save Changes": Submit form
- Space on checkboxes: Toggle permission
- Arrow keys in dropdowns: Navigate options
```

---

### 2. Screen Reader Support

**ARIA Labels**:
```html
<!-- Permission Checkbox -->
<label>
  <input
    type="checkbox"
    role="checkbox"
    aria-checked="true"
    aria-label="Grant write permission to user john_doe for organization ACME Corp"
    aria-describedby="perm-write-desc"
  />
  Can Write
</label>
<span id="perm-write-desc" class="sr-only">
  Allows user to create and modify PFA records
</span>

<!-- User Status Badge -->
<span
  role="status"
  aria-label="User status: Active"
  class="badge badge-success"
>
  Active
</span>

<!-- Loading State -->
<div
  role="status"
  aria-live="polite"
  aria-busy="true"
>
  Loading permissions for user john_doe...
</div>
```

---

### 3. Color Contrast & Visual Indicators

**Status Badges** (WCAG AA Compliant):
- **Active**: Green badge (4.5:1 contrast ratio)
- **Suspended**: Red badge (4.5:1 contrast ratio)
- **Locked**: Orange badge (4.5:1 contrast ratio)
- **Archived**: Gray badge (4.5:1 contrast ratio)

**Don't Rely on Color Alone**:
```
✅ Active (with checkmark icon)
❌ Suspended (with X icon)
🔒 Locked (with lock icon)
📦 Archived (with archive icon)
```

---

### 4. Focus Indicators

**Visible Focus State**:
```css
/* All interactive elements */
:focus-visible {
  outline: 2px solid #0066CC;
  outline-offset: 2px;
  border-radius: 4px;
}

/* Permission checkboxes */
input[type="checkbox"]:focus-visible {
  box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.25);
}

/* Buttons */
button:focus-visible {
  outline: 3px solid #0066CC;
  outline-offset: 2px;
}
```

---

## 🎨 Visual Feedback Patterns

### 1. Success Feedback (Green Theme)

```typescript
// Toast Message
{
  type: 'success',
  icon: <CheckCircle />,
  message: 'Permissions updated successfully',
  duration: 3000, // Auto-dismiss after 3 seconds
  position: 'top-right'
}

// Inline Badge
<span class="badge badge-success">
  <CheckIcon /> Granted
</span>
```

---

### 2. Error Feedback (Red Theme)

```typescript
// Toast Message
{
  type: 'error',
  icon: <XCircle />,
  message: 'Failed to suspend user',
  subMessage: 'User has active sessions. Close sessions first.',
  duration: 5000, // Longer for errors
  dismissible: true,
  action: {
    label: 'View Details',
    onClick: () => showErrorDetails()
  }
}

// Inline Error
<div class="error-message">
  <AlertIcon /> Permission denied. Contact administrator.
</div>
```

---

### 3. Warning Feedback (Yellow Theme)

```typescript
// Warning Banner
<div class="alert alert-warning">
  <WarningIcon />
  <strong>Organization Suspended</strong>
  <p>PEMS sync is disabled for this organization. Reactivate to resume sync.</p>
  <button>Reactivate Organization</button>
</div>
```

---

## 🧪 UX Testing Scenarios

### 1. Happy Path: Grant Permission

1. Admin opens "Manage Permissions" modal
2. Selects organization "ACME Corp"
3. Selects role "Editor"
4. Checks "Can Write" permission
5. Clicks "Save Changes"

**Expected**:
- ✅ Checkbox checks instantly (optimistic)
- ✅ Success toast appears after <300ms
- ✅ Modal closes automatically
- ✅ User list refreshes with updated permissions

---

### 2. Error Path: Network Timeout

1. Admin grants permission (slow network)
2. Server takes >5 seconds to respond

**Expected**:
- ⏳ Loading indicator shows for 500ms
- ⏳ "Taking longer than usual..." message after 2s
- ⏳ Option to "Cancel" or "Keep Waiting"
- ❌ If timeout: Revert optimistic update, show error

---

### 3. Conflict Path: Concurrent Modification

1. Admin A opens permission modal for User X
2. Admin B grants permission to User X
3. Admin A saves changes

**Expected**:
- ⚠️ Conflict modal appears
- ⚠️ Shows both sets of changes side-by-side
- ⚠️ Options: Cancel, Overwrite, Merge
- ✅ Merge successfully combines both changes

---

## 📱 Responsive Design Considerations

### Mobile (320px - 768px)

**Permission Modal**:
- Full-screen modal on mobile
- Single-column layout
- Large touch targets (44px minimum)
- Sticky "Save" button at bottom

### Tablet (768px - 1024px)

**User List Table**:
- Horizontal scroll for wide tables
- Sticky column headers
- Collapse less critical columns

### Desktop (1024px+)

**Full Layout**:
- Side-by-side comparisons (conflicts)
- Hover tooltips for additional context
- Keyboard shortcuts available

---

## 🎨 UX Specifications for Advanced AI Features (Use Cases 16-25)

### Use Case 16: Context-Aware Access Explanation ("The Why Button")

**Component**: AI-powered tooltip on disabled buttons

**Visual Design**:
```
┌─────────────────────────────────────────┐
│ [🔒 Sync Data] (disabled button)       │
│   ↓ (hover triggers tooltip)            │
│ ┌───────────────────────────────────┐   │
│ │ 🤖 Why can't I sync?              │   │
│ │                                   │   │
│ │ You cannot sync because:          │   │
│ │ • Your role (Field Engineer)      │   │
│ │   lacks pems:sync capability      │   │
│ │ • Organization is Suspended       │   │
│ │                                   │   │
│ │ 💡 How to resolve:                │   │
│ │ 1. Request role upgrade to        │   │
│ │    Project Manager                 │   │
│ │    Contact: admin@example.com     │   │
│ │    ETA: 1 business day            │   │
│ │                                   │   │
│ │ 2. Ask admin to reactivate org    │   │
│ │    Contact: Billing Dept          │   │
│ │                                   │   │
│ │ [Request Access] [Dismiss]        │   │
│ └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Interaction Flow**:
1. User hovers over disabled button
2. Tooltip appears after 300ms delay
3. AI explanation loads (cached if available)
4. User clicks "Request Access" → Opens escalation modal
5. User clicks "Dismiss" → Tooltip closes

**Loading State**:
```
┌───────────────────────────────────┐
│ 🤖 Analyzing permissions...       │
│ [Spinner animation]               │
└───────────────────────────────────┘
```

**Error State**:
```
┌───────────────────────────────────┐
│ ⚠️ Unable to explain restriction  │
│ Contact admin@example.com         │
└───────────────────────────────────┘
```

**Accessibility**:
- `aria-describedby` links button to tooltip
- Keyboard accessible (focus + Enter to trigger)
- Screen reader announces: "Button disabled. Press Enter for explanation."

---

### Use Case 17: Predictive "Ghost" Values (Financial Masking)

**Component**: Masked financial data with relative impact indicators

**Visual Design - Timeline Bar**:
```
┌─────────────────────────────────────────┐
│ 🏗️ Crane - Mobile 200T                 │
│ Silo 4 | Dec 1-15 (15 days)            │
│                                         │
│ [⚠️ High Budget Impact]                │
│                                         │
│ Cost: ***masked***                      │
│ Impact: Top 5% of crane costs          │
│ Comparison: 3.2x avg crane rental      │
│                                         │
│ 💡 This equipment is significantly more│
│    expensive than typical cranes.      │
│    Consider reviewing duration or      │
│    exploring alternatives.             │
│                                         │
│ [View Details] [Suggest Alternatives]  │
└─────────────────────────────────────────┘
```

**Badge Variants**:
```
✅ Within Budget       (Green)  - Cost <= avg
⚠️ Moderate Impact     (Yellow) - Cost 1-2x avg
🔴 High Budget Impact  (Red)    - Cost 2-3x avg
🚨 Critical Impact     (Dark Red) - Cost >3x avg
```

**Hover Tooltip (Additional Context)**:
```
┌───────────────────────────────────┐
│ Budget Impact Analysis            │
│                                   │
│ Category: Cranes                  │
│ Percentile: 95th (Top 5%)        │
│ Project Average: ***masked***     │
│ This Item: 3.2x average          │
│                                   │
│ Recommendation:                   │
│ • Review rental duration          │
│ • Consider standard 150T model    │
│ • Evaluate purchase option        │
└───────────────────────────────────┘
```

**Portfolio Summary (for masked users)**:
```
┌─────────────────────────────────────────┐
│ 📊 Your Selection Impact                │
│                                         │
│ Total Items: 45 equipment lines        │
│                                         │
│ Impact Breakdown:                       │
│ ✅ Within Budget: 32 items (71%)       │
│ ⚠️ Moderate: 10 items (22%)            │
│ 🔴 High: 3 items (7%)                  │
│                                         │
│ Overall Portfolio Impact:               │
│ [████████░░] 2.1x project average      │
│                                         │
│ 💡 AI Insight: Your portfolio includes │
│    3 high-impact items. Consider       │
│    alternatives to reduce costs.       │
└─────────────────────────────────────────┘
```

**Interaction Rules**:
- No actual costs shown anywhere (strict masking)
- Clicking "View Details" → Opens impact analysis modal (still masked)
- Clicking "Suggest Alternatives" → AI recommends lower-cost equipment

**Accessibility**:
- Screen reader announces: "High budget impact equipment. Top 5 percent of crane costs."
- Color blind safe: Uses icons + text, not just colors

---

### Use Case 18: Semantic Audit Search ("Forensic Chat")

**Component**: Natural language audit query interface

**Visual Design - Chat Interface**:
```
┌─────────────────────────────────────────┐
│ 🔍 Forensic Chat - Audit Search         │
├─────────────────────────────────────────┤
│                                         │
│ 💬 You:                                 │
│ "Who changed the crane rental duration │
│  in the last week?"                    │
│                                         │
│ 🤖 AI: (2 seconds ago)                 │
│ John Doe extended 12 crane rentals     │
│ by an average of 10 days in the last   │
│ week. Most common reason: "Weather     │
│ delay"                                  │
│                                         │
│ [View Details] [Export Report]         │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ Breakdown by User:               │   │
│ │ • John Doe: 12 changes           │   │
│ │   └─ Crane 101: +14 days         │   │
│ │   └─ Crane 102: +10 days         │   │
│ │   └─ ... (10 more)               │   │
│ └─────────────────────────────────┘   │
│                                         │
│ 💬 You:                                 │
│ "Why did John extend the cranes?"      │
│                                         │
│ 🤖 AI: (just now)                      │
│ 11 out of 12 extensions cited "Weather│
│ delay" as reason. Weather API confirms │
│ heavy rain Nov 20-24. Project timeline │
│ shows concrete pour postponed.         │
│                                         │
│ Cost impact: +$145K in extended        │
│ crane rentals.                         │
│                                         │
│ 💡 The extensions appear justified.    │
│    Consider filing weather claim.      │
│                                         │
│ [File Insurance Claim] [View Timeline] │
│                                         │
├─────────────────────────────────────────┤
│ [Type your question...]          [Send]│
└─────────────────────────────────────────┘
```

**Auto-Suggestions** (appear as user types):
```
┌───────────────────────────────────┐
│ 💡 Common Queries:                │
│ • Who modified PFA records today? │
│ • Show failed login attempts      │
│ • What changed in the last hour?  │
│ • Find bulk permission changes    │
│ • Track equipment cost changes    │
└───────────────────────────────────┘
```

**Loading State**:
```
🤖 AI: [Thinking... ⏳]
```

**Error State**:
```
🤖 AI: ❌ I couldn't understand that query.
     Try: "Show me permission changes from yesterday"
```

**Interaction Flow**:
1. User types natural language question
2. Auto-suggestions appear (common queries)
3. User presses Enter or clicks Send
4. AI translates to structured query (shown in collapsed details)
5. Results appear as narrative + expandable details
6. User asks follow-up question (AI remembers context)

**Keyboard Shortcuts**:
- `↑` / `↓` - Navigate suggestion list
- `Enter` - Send query
- `Ctrl+K` - Focus search input
- `Esc` - Close chat panel

**Accessibility**:
- Chat messages use proper ARIA roles
- Screen reader announces new AI responses
- High contrast mode supported

---

### Use Case 19: Role Drift Detection & Auto-Refactoring

**Component**: AI recommendation cards for role optimization

**Visual Design - Admin Dashboard**:
```
┌─────────────────────────────────────────┐
│ 🔔 AI Recommendations (1 new)           │
├─────────────────────────────────────────┤
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ 💡 Role Optimization Opportunity │   │
│ │                                  │   │
│ │ Pattern: Consistent Overrides    │   │
│ │ Affected: 5 out of 12 Field      │   │
│ │          Engineers (42%)         │   │
│ │                                  │   │
│ │ Common Overrides:                │   │
│ │ • canManageUsers: true           │   │
│ │ • canManageSettings: true        │   │
│ │ • viewFinancialDetails: true     │   │
│ │                                  │   │
│ │ 🎯 Suggested Action:             │   │
│ │ Create "Senior Field Engineer"   │   │
│ │ role template                    │   │
│ │                                  │   │
│ │ Benefits:                        │   │
│ │ • Simplifies permission mgmt     │   │
│ │ • Reduces 15 custom overrides    │   │
│ │ • Improves consistency           │   │
│ │                                  │   │
│ │ [Preview Changes] [Dismiss]      │   │
│ │ [Apply Recommendation] (blue)    │   │
│ └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Preview Modal** (when user clicks "Preview Changes"):
```
┌─────────────────────────────────────────┐
│ 📋 Preview: Create "Senior Field        │
│           Engineer" Role                │
├─────────────────────────────────────────┤
│                                         │
│ New Role Definition:                    │
│ ┌─────────────────────────────────┐   │
│ │ Name: Senior Field Engineer      │   │
│ │ Inherits: Field Engineer         │   │
│ │                                  │   │
│ │ Additional Capabilities:         │   │
│ │ ✅ canManageUsers               │   │
│ │ ✅ canManageSettings            │   │
│ │ ✅ viewFinancialDetails         │   │
│ └─────────────────────────────────┘   │
│                                         │
│ Users to Migrate (5):                   │
│ ┌─────────────────────────────────┐   │
│ │ ✅ John Doe                      │   │
│ │ ✅ Jane Smith                    │   │
│ │ ✅ Bob Johnson                   │   │
│ │ ✅ Alice Williams                │   │
│ │ ✅ Charlie Brown                 │   │
│ └─────────────────────────────────┘   │
│                                         │
│ Impact:                                 │
│ • 5 users migrated                      │
│ • 15 custom overrides removed           │
│ • Rollback available for 7 days        │
│                                         │
│ [Cancel] [Apply & Notify Users] (blue) │
└─────────────────────────────────────────┘
```

**Success State**:
```
┌─────────────────────────────────────────┐
│ ✅ Role Optimization Complete            │
│                                         │
│ Created: "Senior Field Engineer" role   │
│ Migrated: 5 users                       │
│ Removed: 15 custom overrides            │
│                                         │
│ Notifications sent to affected users.   │
│ Rollback available until: Dec 3, 2025  │
│                                         │
│ [View Audit Log] [Dismiss]             │
└─────────────────────────────────────────┘
```

**Interaction Flow**:
1. AI detects drift pattern (background job)
2. Recommendation card appears in admin dashboard
3. Admin clicks "Preview Changes"
4. Modal shows detailed impact analysis
5. Admin clicks "Apply & Notify Users"
6. Confirmation modal: "This will affect 5 users. Continue?"
7. Apply + send email notifications
8. Success message with rollback option

---

### Use Case 20: Behavioral "Quiet Mode" (Notification Timing)

**Component**: User notification preferences dashboard

**Visual Design - User Settings**:
```
┌─────────────────────────────────────────┐
│ 🔔 Notification Preferences             │
├─────────────────────────────────────────┤
│                                         │
│ AI-Powered Smart Delivery               │
│ [●] Enabled (Recommended)               │
│                                         │
│ 🤖 AI has learned your attention        │
│    patterns over the past 4 months      │
│                                         │
│ Your Peak Attention Hours:              │
│ ┌─────────────────────────────────┐   │
│ │ 🌅 Morning: 8-10 AM (Low)       │   │
│ │ 🌞 Midday: 2-4 PM (High) ✅     │   │
│ │ 🌙 Evening: 7-9 PM (Medium)     │   │
│ └─────────────────────────────────┘   │
│                                         │
│ Notification Saturation:                │
│ [████████░░] 25/day (OVERLOADED)       │
│ Optimal: 10-15/day                      │
│                                         │
│ 💡 AI Recommendation:                   │
│ Reduce non-urgent notifications by 60%  │
│ Defer routine updates to 2-4 PM        │
│                                         │
│ Channel Preferences:                    │
│ • Urgent:  Slack ✅                    │
│ • Routine: Email                        │
│ • FYI:     In-app badge                 │
│                                         │
│ [Customize] [Reset to Defaults]        │
└─────────────────────────────────────────┘
```

**Notification Digest** (in-app):
```
┌─────────────────────────────────────────┐
│ 📬 12 updates while you were focused    │
├─────────────────────────────────────────┤
│                                         │
│ Priority (3):                           │
│ • You now have write access to HOLNG    │
│   [View Details]                        │
│ • PEMS sync failed for RIO (retry?)    │
│   [View Error Log]                      │
│ • Budget alert: HOLNG +$12K over plan   │
│   [View Variance]                       │
│                                         │
│ Routine (5):                            │
│ • PEMS sync completed (1,234 records)   │
│ • John Doe commented on PFA #4567       │
│ • ... (3 more)                          │
│   [View All]                            │
│                                         │
│ FYI (4):                                │
│ • System maintenance scheduled Dec 5    │
│ • ... (3 more)                          │
│   [View All]                            │
│                                         │
│ [Mark All Read] [Notification Settings] │
└─────────────────────────────────────────┘
```

**Visual Indicator** (when notifications are deferred):
```
Top-right corner:
[🔕 Quiet Mode: 3 pending] (subtle badge)
```

**Interaction Flow**:
1. User enables "AI-Powered Smart Delivery"
2. AI learns attention patterns (background)
3. Routine notification arrives at 9 AM (quiet hours)
4. AI defers until 2 PM (peak attention time)
5. At 2 PM: Digest notification appears
6. User clicks to expand full list

**Accessibility**:
- Notification count badge has `aria-live="polite"`
- Screen reader announces: "12 new notifications. 3 priority items."

---

## 💼 Executive BEO Intelligence UX Specifications (Use Cases 21-25)

### Use Case 21: Boardroom Voice Analyst

**Component**: Voice-enabled conversational BI interface

**Visual Design - Executive Dashboard**:
```
┌─────────────────────────────────────────┐
│ 💼 Executive Dashboard                  │
├─────────────────────────────────────────┤
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ 🎤 Ask a Question                │   │
│ │                                  │   │
│ │ [🎤] (large mic button)          │   │
│ │  Tap to speak or type below      │   │
│ │                                  │   │
│ │ [Type your question...]    [Ask] │   │
│ └─────────────────────────────────┘   │
│                                         │
│ Recent Queries:                         │
│ • Which projects are over budget?       │
│ • Show me weather-related delays        │
│ • Crane rental cost trends             │
│                                         │
└─────────────────────────────────────────┘
```

**Voice Recording State**:
```
┌─────────────────────────────────────────┐
│ 🎤 Listening...                         │
│                                         │
│ [●●●●●●○○○○] (waveform animation)      │
│                                         │
│ "Which projects are trending over       │
│  budget and why?"                       │
│                                         │
│ [Stop] (red button)                     │
└─────────────────────────────────────────┘
```

**AI Response Card**:
```
┌─────────────────────────────────────────┐
│ 🤖 Portfolio Variance Analysis          │
│                                         │
│ [🔊 Play Audio Response]                │
│                                         │
│ Three of your seven projects are        │
│ trending over budget this quarter:      │
│                                         │
│ 1. HOLNG: +$450K (+12%)                │
│    Driver: Weather delays → extended    │
│    crane rentals (18 cranes, avg +10d) │
│    [View Details] [File Weather Claim]  │
│                                         │
│ 2. RIO Phase 2: +$280K (+8%)           │
│    Driver: Switched from rental to      │
│    purchase (12 generators)             │
│    [View Cost Analysis]                 │
│                                         │
│ 3. PEMS Global: +$95K (+3%)            │
│    Driver: Minor equipment subs         │
│    Status: Within acceptable variance   │
│                                         │
│ Overall Portfolio:                      │
│ Variance: +$825K (+7.2%)               │
│                                         │
│ 💡 Recommended Actions:                 │
│ • Review weather claim (HOLNG)          │
│ • Analyze RIO purchase decision         │
│ • No action needed for PEMS            │
│                                         │
│ [Export Report] [Ask Follow-up]        │
└─────────────────────────────────────────┘
```

**Follow-up Question Flow**:
```
User (voice): "Tell me more about HOLNG"

AI Response:
┌─────────────────────────────────────────┐
│ 🤖 HOLNG Deep Dive                      │
│                                         │
│ [🔊 Play Audio]                         │
│                                         │
│ HOLNG is $450K over budget due to a     │
│ weather event Nov 20-24. Heavy rain     │
│ delayed concrete pour by 7 days,        │
│ forcing 18 crane rentals to extend.     │
│                                         │
│ Financial Breakdown:                    │
│ • Crane extensions: +$320K              │
│ • Scaffolds/generators: +$130K          │
│                                         │
│ Insurance Claim:                        │
│ Filed Nov 26 (Claim #WX-2025-1126)     │
│ Expected recovery: $300-400K            │
│ Net variance after claim: ~$100K        │
│                                         │
│ [View Weather Data] [View Timeline]    │
└─────────────────────────────────────────┘
```

**Accessibility**:
- Voice input has text fallback
- Audio responses have text transcripts
- Screen reader compatible
- Keyboard shortcuts: `Ctrl+M` to start voice input

---

### Use Case 22: Narrative Variance Explanation

**Component**: Chapter-based storytelling interface

**Visual Design - Narrative View**:
```
┌─────────────────────────────────────────┐
│ 📖 The November Weather Delay Story:    │
│    How HOLNG went $450K over budget     │
├─────────────────────────────────────────┤
│                                         │
│ [Progress: ●●●●○] 4 of 5 chapters      │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ Chapter 1: The Plan ✅          │   │
│ │ Chapter 2: The Weather Event ✅ │   │
│ │ Chapter 3: Equipment Extensions ✅│  │
│ │ Chapter 4: The Ripple Effect ✅ │   │
│ │ Chapter 5: The Outcome ○        │   │
│ └─────────────────────────────────┘   │
│                                         │
│ ━━━ Chapter 3: Cascading Equipment ━━━ │
│      Extensions                         │
│                                         │
│ Because the concrete pour was delayed,  │
│ 18 cranes scheduled to finish on Nov 25│
│ had to be extended. John Doe manually   │
│ extended each crane rental by 10-14 days│
│ between Nov 21-25.                      │
│                                         │
│ Most audit log entries cite "Weather   │
│ delay - concrete curing" as reason.    │
│                                         │
│ 💵 Financial Impact: +$320K             │
│                                         │
│ [📊 Show Evidence] (collapsed by default)│
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ 📄 Evidence (3 items):           │   │
│ │ • Audit log: 18 PFA records      │   │
│ │   modified by john.doe           │   │
│ │ • Most common reason: "Weather   │   │
│ │   delay" (11/18)                 │   │
│ │ • Average extension: 12 days     │   │
│ └─────────────────────────────────┘   │
│                                         │
│ [◀ Previous] [Continue Reading ▶]      │
│                                         │
└─────────────────────────────────────────┘
```

**Key Takeaways Summary** (at end of narrative):
```
┌─────────────────────────────────────────┐
│ 🎯 Key Takeaways                        │
├─────────────────────────────────────────┤
│                                         │
│ • Weather event caused 7-day delay      │
│ • 18 cranes extended by avg 12 days     │
│   → +$320K                              │
│ • Ripple effect: scaffolds, generators  │
│   → +$130K                              │
│ • Total variance: +$450K (+12%)         │
│ • Insurance claim filed: Expected       │
│   $300-400K recovery                    │
│                                         │
│ [📊 View Timeline Visualization]        │
│ [📧 Email Report to Stakeholders]       │
│ [💾 Export as PDF]                      │
└─────────────────────────────────────────┘
```

**Timeline Visualization** (linked from narrative):
```
┌─────────────────────────────────────────┐
│ 📅 HOLNG Variance Timeline              │
├─────────────────────────────────────────┤
│                                         │
│ Aug ─────── Oct ──┬─── Nov ────── Dec  │
│                   │                     │
│  Plan:            │ Weather Event       │
│  $3.8M           │ ▼ Nov 20-24        │
│  18 cranes       │ Heavy Rain         │
│                   │                     │
│                   │ ▼ Crane Extensions  │
│                   │ +12 days avg       │
│                   │ +$320K             │
│                   │                     │
│                   │ ▼ Ripple Effect     │
│                   │ Scaffolds +$80K    │
│                   │ Generators +$50K   │
│                   │                     │
│                   ▼                     │
│              Forecast: $4.25M (+$450K) │
│                                         │
│ [◀ Back to Narrative]                  │
└─────────────────────────────────────────┘
```

**Reading Progress Indicator**:
- Sticky progress bar at top
- Estimated reading time: "8 min read"
- Auto-save reading position
- Resume where you left off

---

### Use Case 23: Cross-Organization Asset Arbitrage

**Component**: Opportunity cards with feasibility scoring

**Visual Design - BEO Portfolio Dashboard**:
```
┌─────────────────────────────────────────┐
│ 💡 Cost Optimization Opportunities       │
├─────────────────────────────────────────┤
│                                         │
│ AI detected 2 opportunities to save     │
│ $37,300 across your portfolio           │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ 💰 $8,500 Potential Savings      │   │
│ │                                  │   │
│ │ Idle Equipment Transfer          │   │
│ │ HOLNG → RIO                      │   │
│ │                                  │   │
│ │ Equipment: 2x Crane - Mobile 200T│   │
│ │ Idle Period: Dec 5-28 (23 days) │   │
│ │ Transport: 40 miles              │   │
│ │                                  │   │
│ │ Feasibility: ████████░ 88%      │   │
│ │                                  │   │
│ │ Pros:                            │   │
│ │ ✅ Compatible specs             │   │
│ │ ✅ Reasonable distance          │   │
│ │ ✅ RIO site has capacity        │   │
│ │                                  │   │
│ │ Risks:                           │   │
│ │ ⚠️ Weather may delay HOLNG (5%) │   │
│ │ ⚠️ Inspection required          │   │
│ │                                  │   │
│ │ Cost Breakdown:                  │   │
│ │ Current Plan: $17,000 (new rent)│   │
│ │ Transfer Cost: $3,400           │   │
│ │ Net Savings: $8,500 (71%)       │   │
│ │                                  │   │
│ │ [View Details] [Dismiss]         │   │
│ │ [Propose Transfer] (green button)│   │
│ └─────────────────────────────────┘   │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ 💰 $28,800 Potential Savings     │   │
│ │                                  │   │
│ │ Purchase vs. Rent Arbitrage      │   │
│ │ Organization: BECH               │   │
│ │                                  │   │
│ │ Equipment: 4x Generator 500kW    │   │
│ │ Duration: 180 days               │   │
│ │                                  │   │
│ │ Feasibility: ████████░░ 82%     │   │
│ │                                  │   │
│ │ Current Plan: $76,800 (6mo rent)│   │
│ │ Alternative: $48,000 (purchase) │   │
│ │ Break-even: 90 days ✅          │   │
│ │                                  │   │
│ │ Additional Benefits:             │   │
│ │ • Resale value ~$32K             │   │
│ │ • Future project reuse           │   │
│ │ • No rental availability risk    │   │
│ │                                  │   │
│ │ [Evaluate Purchase] (blue button)│   │
│ └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Proposal Workflow** (Transfer flow):
```
Step 1: Confirmation
┌─────────────────────────────────────────┐
│ 🔄 Propose Equipment Transfer            │
├─────────────────────────────────────────┤
│ From: HOLNG (2x Crane - Mobile 200T)    │
│ To: RIO                                 │
│                                         │
│ Required Approvals:                     │
│ ☐ HOLNG Project Manager                 │
│ ☐ RIO Project Manager                   │
│ ☐ CFO (transfer value >$5K)            │
│                                         │
│ Next Steps:                             │
│ 1. Contact HOLNG PM to confirm idle     │
│ 2. Schedule pre-transfer inspection     │
│ 3. Draft transfer agreement             │
│                                         │
│ Estimated Time: 5 business days         │
│                                         │
│ [Cancel] [Send Proposal] (green)        │
└─────────────────────────────────────────┘

Step 2: Tracking
┌─────────────────────────────────────────┐
│ 📋 Transfer Proposal #2025-001          │
├─────────────────────────────────────────┤
│ Status: Pending Approvals               │
│                                         │
│ ✅ HOLNG PM Approved (Nov 26, 2 PM)    │
│ ⏳ RIO PM Review (pending)              │
│ ⏳ CFO Approval (pending)               │
│                                         │
│ [View Proposal] [Send Reminder]         │
└─────────────────────────────────────────┘
```

**Accessibility**:
- Feasibility bars have numeric labels ("88%")
- Color blind safe: Uses patterns + labels
- Keyboard navigation through opportunity cards

---

### Use Case 24: Vendor Pricing Watchdog

**Component**: Pricing anomaly dashboard with urgency indicators

**Visual Design - Watchdog Dashboard**:
```
┌─────────────────────────────────────────┐
│ 🔍 Vendor Pricing Watchdog              │
├─────────────────────────────────────────┤
│                                         │
│ AI detected 3 pricing anomalies with    │
│ $97,200 annual savings potential        │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ 🔴 HIGH URGENCY                  │   │
│ │                                  │   │
│ │ Sudden Price Increase            │   │
│ │ Vendor: LMN Scaffold Rentals     │   │
│ │                                  │   │
│ │ Price Change:                    │   │
│ │ Before Oct 2025: $1,800/mo      │   │
│ │ After Oct 2025:  $2,500/mo      │   │
│ │ Increase: +$700/mo (+39%)       │   │
│ │                                  │   │
│ │ Impact: 8 contracts affected     │   │
│ │ Annual Impact: $67,200 if all    │   │
│ │                contracts renewed  │   │
│ │                                  │   │
│ │ 💰 Savings Potential: $56,000    │   │
│ │                                  │   │
│ │ Possible Reasons:                │   │
│ │ • Steel costs up 15% in Q4       │   │
│ │ • Vendor cost increase           │   │
│ │ • Price discovery testing        │   │
│ │                                  │   │
│ │ [📋 View Recommended Action]     │   │
│ │                                  │   │
│ │ ┌───────────────────────────┐   │   │
│ │ │ Recommended Action:        │   │
│ │ │ NEGOTIATE_PRICE_FREEZE     │   │
│ │ │                            │   │
│ │ │ Steps:                     │   │
│ │ │ 1. Contact LMN immediately │   │
│ │ │ 2. Reference partnership   │   │
│ │ │    (3+ years)              │   │
│ │ │ 3. Negotiate price freeze  │   │
│ │ │    at $1,800/mo            │   │
│ │ │ 4. Request MFC clause      │   │
│ │ │                            │   │
│ │ │ Approval: Procurement +    │   │
│ │ │           VP Operations    │   │
│ │ └───────────────────────────┘   │   │
│ │                                  │   │
│ │ [Dismiss] [Initiate Negotiation] │   │
│ └─────────────────────────────┘   │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ 🟡 MEDIUM URGENCY                │   │
│ │                                  │   │
│ │ Same Vendor, Different Price     │   │
│ │ Vendor: ABC Equipment Rentals    │   │
│ │ Equipment: Crane - Mobile 200T   │   │
│ │                                  │   │
│ │ HOLNG: $8,500/mo (Oct contract) │   │
│ │ RIO:   $12,000/mo (Sep contract)│   │
│ │ Variance: +$3,500/mo (+41%)     │   │
│ │                                  │   │
│ │ 💰 Savings: $28,000 (retroactive)│   │
│ │                                  │   │
│ │ [Renegotiate RIO Contract]       │   │
│ └─────────────────────────────────┘   │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ 🟢 LOW URGENCY                   │   │
│ │                                  │   │
│ │ Above Market Rate                │   │
│ │ Vendor: XYZ Generator Suppliers  │   │
│ │                                  │   │
│ │ Your Price: $4,200/mo            │   │
│ │ Market Avg: $3,100/mo            │   │
│ │ Deviation: +35% above market     │   │
│ │                                  │   │
│ │ 💰 Savings: $13,200 annually     │   │
│ │                                  │   │
│ │ [Evaluate Alternatives]          │   │
│ └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Price Comparison Chart** (expanded view):
```
┌─────────────────────────────────────────┐
│ 📊 Crane Pricing Across Organizations   │
├─────────────────────────────────────────┤
│                                         │
│ ABC Equipment Rentals - Crane 200T      │
│                                         │
│ HOLNG  ████████░░░░  $8,500/mo  ✅     │
│ RIO    ████████████  $12,000/mo ⚠️     │
│ BECH   █████████░░░  $9,200/mo         │
│ SLO    ████████░░░░  $8,800/mo         │
│                                         │
│ Market Avg: $9,125/mo                   │
│ Your Portfolio Avg: $9,625/mo          │
│                                         │
│ 💡 Insight: RIO is paying 31% above    │
│    your portfolio average. Renegotiate  │
│    to match HOLNG pricing.              │
│                                         │
│ [Export Report] [Schedule Review]      │
└─────────────────────────────────────────┘
```

**Urgency Badge System**:
- 🔴 High (Red): Act within 7 days
- 🟡 Medium (Yellow): Act within 30 days
- 🟢 Low (Green): Act within 90 days

---

### Use Case 25: Strategic "Multiverse" Simulator

**Component**: Scenario planning wizard with what-if analysis

**Visual Design - Scenario Wizard (Step 1)**:
```
┌─────────────────────────────────────────┐
│ 🌌 Create What-If Scenario               │
│ [Step 1 of 3: Basics]                   │
├─────────────────────────────────────────┤
│                                         │
│ Scenario Name:                          │
│ [Delay HOLNG by 30 days___________]    │
│                                         │
│ Base Scenario:                          │
│ [▼ Current Forecast            ]        │
│   • Current Forecast                    │
│   • Current Plan                        │
│   • Scenario: Q1 Accelerated            │
│                                         │
│ Goal:                                   │
│ [ ] Reduce Cost                         │
│ [✓] Reduce Risk                        │
│ [ ] Accelerate Schedule                 │
│                                         │
│ [Cancel] [Next: Define Changes →]      │
└─────────────────────────────────────────┘
```

**Step 2: Modifications**:
```
┌─────────────────────────────────────────┐
│ 🌌 Create What-If Scenario               │
│ [Step 2 of 3: Modifications]            │
├─────────────────────────────────────────┤
│                                         │
│ Modification Type:                      │
│ [▼ Shift Timeline              ]        │
│                                         │
│ Apply to:                               │
│ Organization: [▼ HOLNG         ]        │
│ Category:     [▼ All Equipment ]        │
│ Area:         [▼ All Areas     ]        │
│                                         │
│ Action:                                 │
│ Shift by: [30] days [→ Forward]        │
│                                         │
│ [+ Add Another Modification]            │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ 🔮 AI Quick Preview:             │   │
│ │ • 145 records affected           │   │
│ │ • Estimated cost impact: +$78K   │   │
│ │ • Completion date: Jan 15, 2026  │   │
│ │   (31 days later)                │   │
│ └─────────────────────────────────┘   │
│                                         │
│ [← Back] [Next: Review Impact →]       │
└─────────────────────────────────────────┘
```

**Step 3: AI Impact Analysis**:
```
┌─────────────────────────────────────────┐
│ 🌌 Create What-If Scenario               │
│ [Step 3 of 3: AI Impact Analysis]       │
├─────────────────────────────────────────┤
│                                         │
│ 📊 Impact Summary:                      │
│                                         │
│ Records Affected: 145 PFA lines         │
│                                         │
│ Cost Impact: [🔴 +$78,000]             │
│ ┌─────────────────────────────────┐   │
│ │ • Crane rentals: +$51,000        │   │
│ │ • Scaffolding: +$18,000          │   │
│ │ • Generators: +$9,000            │   │
│ └─────────────────────────────────┘   │
│                                         │
│ Schedule Impact:                        │
│ New Completion: Jan 15, 2026 (+31 days)│
│ Original: Dec 15, 2025                  │
│                                         │
│ Risk Factors:                           │
│ ⚠️ Pushes into winter (higher risk)    │
│ ⚠️ Jan vendor availability limited     │
│ ⚠️ Insurance rates +10% after Jan 1    │
│                                         │
│ Opportunities:                          │
│ ✅ More time to negotiate              │
│ ✅ Volume discount opportunity         │
│ ✅ Avoid holiday shutdown              │
│                                         │
│ 🤖 AI Verdict: [NOT_RECOMMENDED]       │
│                                         │
│ The $78K cost increase outweighs        │
│ benefits. Pushing into January          │
│ introduces higher weather risk and 10%  │
│ insurance rate increase.                │
│                                         │
│ Alternative: Start on time but phase    │
│ equipment delivery to reduce upfront    │
│ costs.                                  │
│                                         │
│ [← Back] [Cancel]                       │
│ [Create Scenario] [Export Analysis]    │
└─────────────────────────────────────────┘
```

**Scenario Comparison Matrix**:
```
┌─────────────────────────────────────────┐
│ 📊 Compare Scenarios                     │
├─────────────────────────────────────────┤
│                                         │
│ Scenarios:                              │
│ [✓] Current Forecast                    │
│ [✓] Delay HOLNG +30d                    │
│ [✓] Generators → Purchase               │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ Metric         │ Current │ +30d  │   │
│ │                │ Forecast│ Delay │ Purchase│
│ ├────────────────┼─────────┼───────┼────────│
│ │ Portfolio Cost │ $12.5M  │$12.578M│$12.2M │
│ │ Completion     │ Dec 15  │ Jan 15│ Dec 15│
│ │ Risk Score     │ 0.68    │ 0.78  │ 0.62  │
│ │ Cash Flow      │ $2.1M/mo│ $2.1M │ $2.5M  │
│ │                │         │       │upfront │
│ └─────────────────────────────────┘   │
│                                         │
│ 🤖 Best Scenario: Generators → Purchase│
│                                         │
│ Switching generators to purchase saves  │
│ $300K and reduces risk. The upfront     │
│ capital investment ($400K) pays back in │
│ 4 months and provides long-term assets. │
│                                         │
│ [📧 Share with Stakeholders]            │
│ [💾 Export to Excel]                    │
│ [🔄 Run More Scenarios]                 │
└─────────────────────────────────────────┘
```

**Saved Scenarios List**:
```
┌─────────────────────────────────────────┐
│ 📁 My Scenarios                          │
├─────────────────────────────────────────┤
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ Delay HOLNG +30d                 │   │
│ │ Created: Nov 26, 2025            │   │
│ │ Impact: +$78K (NOT_RECOMMENDED)  │   │
│ │ [Open] [Export] [Delete]         │   │
│ └─────────────────────────────────┘   │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ Generators → Purchase            │   │
│ │ Created: Nov 26, 2025            │   │
│ │ Impact: -$300K (RECOMMENDED) ✅  │   │
│ │ [Open] [Export] [Delete]         │   │
│ └─────────────────────────────────┘   │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ Consolidate Crane Vendors        │   │
│ │ Created: Nov 25, 2025            │   │
│ │ Impact: -$95K (FEASIBLE)         │   │
│ │ [Open] [Export] [Delete]         │   │
│ └─────────────────────────────────┘   │
│                                         │
│ [+ Create New Scenario]                 │
└─────────────────────────────────────────┘
```

**Keyboard Shortcuts**:
- `Ctrl+N` - New scenario
- `Ctrl+S` - Save scenario
- `Ctrl+E` - Export current view
- `Esc` - Cancel wizard

**Accessibility**:
- Wizard steps have clear progress indicator
- Screen reader announces impact analysis results
- High contrast charts for comparison matrix

---

## 🔒 Core Governance & Operational Features

The following UX specifications define the "safety nets" for data integrity and executive oversight. These operational workflows complement the AI features with mandatory confirmation ceremonies, audit capabilities, and legacy data migration.

### Use Case G1: The "Pre-Flight" Transaction Ceremony

**Purpose**: Mandatory confirmation workflow before syncing changes to PEMS with AI risk assessment.

**Component**: Modal triggered when clicking "Sync to PEMS".

**Visual Design**:

```
┌─────────────────────────────────────────┐
│ 🛫 Review Changes Before Syncing        │
├─────────────────────────────────────────┤
│                                         │
│ 📊 Impact Summary:                      │
│ Records: 15 modified                    │
│ Budget:  [🔴 +$12,500] (Overrun)       │
│                                         │
│ 📝 Change Details:                      │
│ ┌─────────────────────────────────────┐ │
│ │ Record   │ Field    │ Old  │ New    │ │
│ ├──────────┼──────────┼──────┼────────┤ │
│ │ Crane 01 │ End Date │ Jan 1│ Jan 5  │ │
│ │          │ Cost     │ $5k  │ $6k    │ │
│ ├──────────┼──────────┼──────┼────────┤ │
│ │ Gen 500  │ Rate     │ $1k  │ $1.2k  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 💬 Reason for Change (Mandatory):       │
│ [ e.g., Weather delay extension...  ]   │
│ * Minimum 10 characters required        │
│                                         │
│ 🤖 AI Risk Check: [🟡 MEDIUM RISK]      │
│ "Budget impact >$10k. Approval rec."    │
│                                         │
│ [Cancel] [Confirm & Sync] (Disabled)    │
└─────────────────────────────────────────┘
```

**Interaction Flow**:

1. User clicks "Sync to PEMS" button
2. Modal opens showing all pending changes in diff table
3. Budget impact calculated and displayed (Green: under budget, Red: over budget)
4. AI risk assessment runs in background (<2 seconds)
5. Comment field validates: disabled if <10 characters
6. "Confirm & Sync" button remains disabled until comment is valid
7. On confirm: Transaction recorded to audit log with comment
8. Changes synced to PEMS with transaction ID

**Accessibility**:
- `Tab` navigates through table rows and comment field
- `Escape` closes modal without syncing
- Screen reader announces risk level and budget impact
- Comment field has `aria-required="true"` and clear error messages

**Error States**:
- **Empty Comment**: "Comment is required (minimum 10 characters)"
- **AI Service Down**: "Risk assessment unavailable. Sync requires admin approval."
- **Sync Failure**: "Failed to sync to PEMS. Changes saved locally. Retry?"

---

### Use Case G2: The "Time Travel" Revert Interface

**Purpose**: Audit log with batch transaction rollback capability using compensating transactions.

**Component**: "History" Tab on the PFA Data Grid.

**Visual Design - History Log**:

```
┌─────────────────────────────────────────┐
│ 📅 Change History / Audit Log           │
├─────────────────────────────────────────┤
│                                         │
│ [Today]                                 │
│                                         │
│ 🕒 2:30 PM - John Doe (Project Mgr)     │
│ 📝 "Weather delay extension"            │
│ 📊 15 records • +$12,500 impact         │
│ [View Diff] [↩️ Revert Batch]          │
│                                         │
│ 🕒 10:00 AM - Jane Smith (Procurement)  │
│ 📝 "Rate adjustment for Q4"             │
│ 📊 4 records • -$2,000 impact           │
│ [View Diff] [↩️ Revert Batch]          │
│                                         │
│ [Yesterday]                             │
│ ...                                     │
└─────────────────────────────────────────┘
```

**Visual Design - Revert Confirmation Modal**:

```
┌─────────────────────────────────────────┐
│ ⚠️ Confirm Revert Transaction           │
├─────────────────────────────────────────┤
│                                         │
│ You are about to revert the transaction │
│ made by John Doe at 2:30 PM.            │
│                                         │
│ 📉 Effect:                              │
│ • Restore 15 records to previous state  │
│ • Budget will decrease by $12,500       │
│                                         │
│ 🔒 This will create a Compensating      │
│    Transaction in PEMS.                 │
│                                         │
│ [ ] I understand this cannot be undone  │
│                                         │
│ [Cancel] [Execute Revert] (Red)         │
└─────────────────────────────────────────┘
```

**Interaction Flow**:

1. User opens "History" tab in PFA grid
2. Transactions listed chronologically (newest first)
3. User clicks "View Diff" to see specific changes
4. User clicks "↩️ Revert Batch" to undo entire transaction
5. Confirmation modal appears with impact summary
6. User must check "I understand" checkbox to enable "Execute Revert"
7. On execute: Compensating transaction created
8. All changes in batch reversed atomically
9. New audit log entry created: "Reverted transaction [ID]"

**Accessibility**:
- Each transaction has unique `id` for screen readers
- "View Diff" button has `aria-label="View changes for transaction by John Doe at 2:30 PM"`
- Confirmation checkbox required before dangerous action
- High contrast colors for revert button (red background)

**Business Rules**:
- Only users with `canManageSettings` permission can revert
- Cannot revert transactions older than 30 days (policy configurable)
- Revert creates compensating transaction (audit trail preserved)
- If original transaction was synced to PEMS, revert also syncs

---

### Use Case G3: The Intelligent Import Wizard

**Purpose**: AI-powered CSV column mapping for PFA 1.0 legacy data imports with value transformation suggestions.

**Component**: Modal for importing `PFA_v1.csv`.

**Visual Design**:

```
┌─────────────────────────────────────────┐
│ 📥 Import PFA 1.0 Data                  │
│ [Step 2: AI Mapping Review]             │
├─────────────────────────────────────────┤
│                                         │
│ 🤖 AI has mapped 15 columns (98% Conf)  │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ CSV Header   │ V2 Target Field      │ │
│ ├──────────────┼──────────────────────┤ │
│ │ Item_Desc    │ → Equipment Name ✅  │ │
│ │ Class_ID     │ → Asset Category ✅  │ │
│ │ Start_Date   │ → Forecast Start ✅  │ │
│ │ Cost_Mo      │ → Monthly Rate   ✅  │ │
│ │ Custom_1     │ → Metadata (JSON) ⚠️ │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 💡 Recommendation:                      │
│ "V1 'Class A' seems to match V2 'Heavy  │
│ Lift'. Auto-convert values?"            │
│ [ ] Yes, apply value transformation     │
│                                         │
│ [Back] [Import 500 Records]             │
└─────────────────────────────────────────┘
```

**Interaction Flow**:

1. **Step 1: Upload** - User selects CSV file
2. **Step 2: AI Mapping** - AI analyzes headers and suggests mappings
   - Green checkmark: High confidence (>90%)
   - Yellow warning: Review required (<90%)
3. **Step 3: Value Transformation** - AI detects enum mismatches (e.g., "Class A" vs "Heavy Lift")
4. **Step 4: Preview** - Show first 10 rows with mapped values
5. **Step 5: Import** - Batch insert with progress bar

**Accessibility**:
- Wizard step progress announced by screen reader
- Mapping dropdowns have autocomplete
- "Esc" cancels import at any step
- Import button shows record count: "Import 500 Records"

**AI Confidence Levels**:
- **✅ 90-100%**: Green checkmark, auto-selected
- **⚠️ 70-89%**: Yellow warning, requires review
- **❌ <70%**: Red X, manual mapping required

**Error Handling**:
- **Duplicate Headers**: "Column 'Cost' appears twice. Use 'Cost_1' and 'Cost_2'?"
- **Missing Required Fields**: "Required fields missing: Equipment Name, Category"
- **Invalid Values**: "10 rows have invalid dates. Skip or abort?"

---

### Use Case G4: BEO "Glass Mode" Landing Page

**Purpose**: Executive portfolio overview with global health metrics accessible only to users with `perm_ViewAllOrgs` permission.

**Component**: The entry point for Executives landing page.

**Visual Design**:

```
┌─────────────────────────────────────────┐
│ 💼 Enterprise Portfolio                 │
├─────────────────────────────────────────┤
│                                         │
│ 🌍 Global Health                        │
│ [Active Orgs: 28]  [Total Spend: $45M]  │
│ [Variance: +2.1% 🔴]                    │
│                                         │
│ 🚨 Priority Attention Needed            │
│ 1. HOLNG  (+$450k / +12%)  [Drill Down] │
│ 2. RIO    (+$280k / +8%)   [Drill Down] │
│                                         │
│ 📊 Spend by Category (Cross-Org)        │
│ [██████ Cranes      ] $12M              │
│ [████   Generators  ] $8M               │
│ [██     Labor       ] $4M               │
│                                         │
│ 📡 Live Activity Stream                 │
│ • John Doe synced HOLNG (2m ago)        │
│ • Jane Smith approved RIO budget (5m)   │
│                                         │
└─────────────────────────────────────────┘
```

**Interaction Flow**:

1. User logs in with BEO role (`perm_ViewAllOrgs`)
2. Landing page loads portfolio data across all 28 organizations
3. Global health metrics displayed prominently
4. At-risk projects highlighted in red section
5. User clicks "Drill Down" to navigate to specific organization
6. Live activity stream updates every 30 seconds

**Accessibility**:
- High contrast for variance badges (red/green)
- `Tab` navigates through "Drill Down" buttons
- Screen reader announces "Priority attention: HOLNG over budget by $450,000"
- Bar charts have `aria-label` with exact amounts

**Responsive Design**:
- **Desktop (1440px+)**: 3-column layout with charts
- **Tablet (768px)**: 2-column layout, charts stack
- **Mobile (375px)**: Single column, simplified metrics

**Real-Time Updates**:
- Variance metrics refresh every 5 minutes (WebSocket)
- Activity stream updates via Server-Sent Events (SSE)
- "Last Updated" timestamp shown in footer

**Permission Check**:
- If user lacks `perm_ViewAllOrgs`: Redirect to single-org view
- If user has no orgs: Show "Access Denied" with contact info

---

### Use Case H1: PEMS User Management Table (Hybrid Identity Indicators)

**Scenario**: Admin views User Management table and needs to distinguish between local users and PEMS-managed users at a glance.

**UI Mockup**:
```
┌──────────────────────────────────────────────────────────────────────────┐
│ 👥 User Management                                                       │
├──────────────────────────────────────────────────────────────────────────┤
│ Name           │ Source       │ Status   │ Actions                       │
├────────────────┼──────────────┼──────────┼───────────────────────────────┤
│ John Doe       │ ☁️ PEMS      │ Active   │ [Edit] [Suspend] [Reset PW]   │
│ Jane Smith     │ 🏠 Local     │ Active   │ [Edit] [Suspend] [Delete]     │
│ Bob Jones      │ ☁️ PEMS      │ Locked   │ [View Only]                   │
│ Sarah Admin    │ 🏠 Local     │ Active   │ [Edit] [Suspend] [Delete]     │
└────────────────┴──────────────┴──────────┴───────────────────────────────┘
```

**Source Badge Rules**:
- `☁️ PEMS` = Blue badge with tooltip: "User managed by PEMS (HxGN EAM)"
- `🏠 Local` = Gray badge with tooltip: "User created locally in Vanguard"

**Action Button States**:
- **PEMS users**:
  - [Delete] button **disabled** (show "Suspend" instead)
  - [Reset PW] **enabled** (hybrid auth supports local passwords for PEMS users)
  - [Edit] **enabled** but shows warnings for protected fields
- **Local users**:
  - [Delete] button **enabled**
  - All actions available

**Accessibility**:
- Source badges have `aria-label="User source: PEMS"` for screen readers
- Disabled [Delete] button has `aria-disabled="true"` with tooltip: "Cannot delete PEMS users. Use suspend instead."
- Keyboard navigation: Tab to badge shows tooltip, Space/Enter on action buttons

**Performance**: <500ms to load table with badge determination (cached from user records)

---

### Use Case H2: Edit PEMS User Modal (Hybrid Warnings)

**Scenario**: Admin clicks [Edit] on a PEMS user and attempts to modify protected fields.

**UI Mockup**:
```
┌─────────────────────────────────────────────────────────────────────────┐
│ ✏️ Edit User: John Doe                                                  │
│ [☁️ PEMS Managed]                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│ Username:   john.doe          [Read Only]                               │
│             ℹ️ Linked to PEMS ID: 10345                                 │
│                                                                          │
│ Email:      john.doe@example.com                                        │
│             ⚠️ Warning: Managed by PEMS. Changing this may break sync.  │
│             [ ] I understand and want to override                       │
│                                                                          │
│ Password:   ••••••••••        [Change Password]                         │
│             ℹ️ Hybrid mode: Local password is supported                 │
│                                                                          │
│ Role:       Editor                                                      │
│             ℹ️ This is a local override (PEMS role: Viewer)             │
│                                                                          │
│ Preferences:                                                             │
│   [✓] Email Notifications                                               │
│   [ ] Voice Mode                                                        │
│                                                                          │
│ [Cancel] [Save Changes]                                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

**Behavior**:
- **Username field**: Read-only for PEMS users (linked to external ID)
- **Email field**: Editable with warning
  - "Save Changes" button **disabled** until user checks "I understand" checkbox
  - On save with override: API call includes `force=true` flag
  - Backend logs warning: "Admin overrode email for PEMS user {id}"
- **Password field**: Fully editable for both PEMS and local users (hybrid support)
  - Shows "ℹ️ Hybrid mode" tooltip for PEMS users
  - Shows "Local password" for local users
- **Role field**: Shows local override indicator when `isCustom=true`
  - Tooltip: "This role was manually set and differs from PEMS sync value"

**Validation**:
- Email format validation (standard)
- Password strength meter (8+ chars, uppercase, lowercase, number)
- Warning modal if changing email: "This will mark the user as 'custom override' and may cause sync conflicts."

**Accessibility**:
- Warning icon `⚠️` announces "Warning: Managed by PEMS" to screen readers
- Checkbox "I understand" is keyboard-navigable (Tab to focus, Space to toggle)
- Modal supports Esc to cancel, Enter to submit (when enabled)

**Performance**: <200ms to open modal (badge/warning determination is instant from cached data)

---

### Use Case H3: PEMS Organization Settings (Sync Controls)

**Scenario**: Admin views Organization Settings for a PEMS-managed organization and needs to understand sync status and access sync controls.

**UI Mockup**:
```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🏢 Organization: HOLNG                                                  │
│ [☁️ PEMS Synced]                                                        │
├─────────────────────────────────────────────────────────────────────────┤
│ Code:       HOLNG              [Read Only]                              │
│             ℹ️ Managed by PEMS. To rename, update in HxGN EAM.          │
│                                                                          │
│ Name:       Holcim Nigeria     [Read Only]                              │
│                                                                          │
│ Settings:   [Editable]                                                  │
│   Timezone:        UTC+1 (Lagos)                                        │
│   Currency:        NGN                                                  │
│   Fiscal Year:     Jan-Dec                                              │
│                                                                          │
│ Sync Status:                                                            │
│   Last Sync:       Nov 26, 2025 10:30 AM  ✅                            │
│   Next Sync:       Nov 27, 2025 10:30 AM                                │
│   Sync Policy:     Local Overrides Win                                  │
│   Conflicts:       3 pending [View Conflicts]                           │
│                                                                          │
│ [Force Sync Now] [View PEMS Source] [Unlink from PEMS]                 │
└─────────────────────────────────────────────────────────────────────────┘
```

**Behavior**:
- **Code/Name fields**: Read-only for `isExternal=true` orgs (PEMS-managed)
  - Shows info icon with tooltip: "These fields are synced from PEMS. Local edits not allowed."
- **Settings fields**: Fully editable (local preferences override PEMS)
  - Timezone, Currency, Fiscal Year can be modified
  - Changes saved immediately, don't affect PEMS source
- **Sync Status section**:
  - Shows last sync timestamp with checkmark if successful
  - Shows next scheduled sync time
  - Displays sync policy (configurable): "Local Overrides Win" | "PEMS Overrides Win" | "Manual Review Required"
  - Shows conflict count with clickable link to filtered audit log
- **Force Sync Now**:
  - Triggers manual PEMS sync for this organization
  - Shows progress modal with polling (2s interval) for sync status
  - Updates Last Sync timestamp on completion
- **View PEMS Source**:
  - Opens external link to HxGN EAM organization page (if configured)
  - Requires authentication to PEMS system
- **Unlink from PEMS**:
  - Converts organization to local (sets `isExternal=false`)
  - Shows destructive confirmation modal:
    ```
    ⚠️ Warning: Unlink Organization from PEMS

    This will convert HOLNG to a local organization and stop PEMS sync.

    Implications:
    - Organization can be renamed/deleted locally
    - PEMS updates will no longer sync
    - User assignments will remain but won't auto-update
    - This action cannot be undone via UI

    Type organization code to confirm: [____]

    [Cancel] [Unlink Organization]
    ```

**Permission Check**:
- [Force Sync Now]: Requires `perm_RefreshData=true`
- [Unlink from PEMS]: Requires `perm_ManageSettings=true` AND system admin role

**Accessibility**:
- Read-only fields have `aria-readonly="true"` attribute
- Info icons announce full tooltip text to screen readers
- Confirmation modal is keyboard-navigable (Tab through fields, Esc to cancel)

**Performance**:
- Loading Organization Settings: <500ms
- Force Sync Now: Shows progress immediately, polls every 2s for updates
- Unlink Action: <1s for database update

---

## 📚 Related Documentation

- **Decision**: [ADR-005-DECISION.md](./ADR-005-DECISION.md)
- **AI Opportunities**: [ADR-005-AI_OPPORTUNITIES.md](./ADR-005-AI_OPPORTUNITIES.md)
- **Test Plan**: [ADR-005-TEST_PLAN.md](./ADR-005-TEST_PLAN.md)
- **Implementation Plan**: [ADR-005-IMPLEMENTATION_PLAN.md](./ADR-005-IMPLEMENTATION_PLAN.md)

---

**Status**: UX Specification Complete (32 Total Use Cases: 25 AI + 4 Governance + 3 PEMS Hybrid)
**Next Action**: Implement UI components following this specification

**Document Statistics**:
- **Use Cases Covered**: 32 total
  - 15 Core Access Control (Use Cases 1-15)
  - 10 AI/UX Intelligence (Use Cases 16-25)
  - 4 Core Governance & Operational (Use Cases G1-G4)
  - 3 PEMS Hybrid Identity Management (Use Cases H1-H3)
- **UI Components**: 45+ specialized components
  - AI-powered: Context tooltips, voice analyst, scenario simulator, narrative reader, watchdog dashboard
  - Governance: Pre-Flight modal, Time Travel revert interface, Import wizard, BEO Glass Mode landing
  - Core: User management, permission editor, audit log, masked cost badges, notification drawer
- **Interaction Flows**: 29+ documented workflows (all with keyboard navigation and error states)
- **Accessibility Features**: WCAG 2.1 AA compliant throughout
  - Keyboard shortcuts for all major actions
  - Screen reader announcements for dynamic content
  - High contrast mode support
  - Focus indicators on all interactive elements
- **Responsive Breakpoints**: Mobile (375px), Tablet (768px), Desktop (1440px+)

*Document created: 2025-11-26*
*Last updated: 2025-11-26*
*UX Spec Version: 3.0 (Complete Edition: AI Intelligence + Core Governance)*
