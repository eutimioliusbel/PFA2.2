# Accessibility Remediation Action Plan
**ADR-005: Multi-Tenant Access Control**
**Priority**: 🔴 **BLOCKER** - Must fix before production

---

## 📋 Quick Summary

**Current Status**: ❌ Non-compliant (0% passing WCAG 2.1 AA)
**Violations Found**: 47 total (39 critical, 6 serious, 2 moderate)
**Estimated Fix Time**: 10-14 hours
**Target Completion**: December 4, 2025

---

## 🚨 Phase 1: Critical Blockers (Must Fix Before Launch)

**Deadline**: December 2, 2025
**Estimated Time**: 6-8 hours
**Assigned To**: Frontend Team

### Task 1.1: Fix Icon Button Accessibility (2 hours)
**Priority**: 🔴 BLOCKER
**Violations**: 24 (button-name)
**WCAG**: 4.1.2 Name, Role, Value (Level A)

**Files to Update**:
1. `components/admin/UserManagement.tsx` (lines 273-323)
2. `components/admin/ApiServerManager.tsx` (lines 696-733)

**What to Do**:
Add `aria-label` to every icon-only button with descriptive text including context.

**Code Pattern**:
```tsx
// ❌ BEFORE: Screen readers announce "button" (no context)
<button onClick={() => handleEdit(user)}>
  <Edit className="w-4 h-4" />
</button>

// ✅ AFTER: Screen readers announce "Edit user admin"
<button
  onClick={() => handleEdit(user)}
  aria-label={`Edit user ${user.username}`}
  title="Edit User"
>
  <Edit className="w-4 h-4" aria-hidden="true" />
</button>
```

**Buttons to Fix**:
- Suspend/Activate buttons (Pause/Play icons)
- Edit buttons (Edit icon)
- Delete buttons (Trash2 icon)
- Permission buttons (Shield icon)
- Test endpoint buttons (Play icon)
- Toggle activation buttons (Eye/EyeOff icons)

**Acceptance Criteria**:
- [ ] All icon buttons have descriptive `aria-label`
- [ ] Labels include context (user name, endpoint name, etc.)
- [ ] Icons have `aria-hidden="true"` (decorative)
- [ ] Run automated tests: 0 button-name violations

**Test Command**:
```bash
npx playwright test accessibility/a11y.test.ts --grep "button-name"
```

---

### Task 1.2: Fix Form Label Association (1.5 hours)
**Priority**: 🔴 BLOCKER
**Violations**: 12 (label)
**WCAG**: 1.3.1 Info and Relationships, 4.1.2 Name, Role, Value (Level A)

**Files to Update**:
1. `components/LoginScreen.tsx` (lines 93-120)
2. `components/admin/UserPermissionModal.tsx` (lines 329-356)

**What to Do**:
Associate every `<label>` with its `<input>` using `htmlFor`/`id` attributes.

**Code Pattern**:
```tsx
// ❌ BEFORE: Label not programmatically associated
<label className="text-sm font-semibold">Username</label>
<input
  type="text"
  placeholder="Enter your username"
/>

// ✅ AFTER: Label associated with input
<label
  htmlFor="login-username"
  className="text-sm font-semibold"
>
  Username
</label>
<input
  id="login-username"
  name="username"
  type="text"
  aria-label="Username"
  aria-required="true"
  placeholder="Enter your username"
  autoComplete="username"
/>
```

**Inputs to Fix**:
- Login form: username, password (2)
- Permission modal: role, department (2)
- User edit modal: firstName, lastName, email, role (4)
- Filter selects: category, source, DOR, status (4)

**Acceptance Criteria**:
- [ ] All inputs have `id` attribute
- [ ] All labels have `htmlFor` matching input `id`
- [ ] All inputs have `aria-label` as secondary label
- [ ] Required inputs have `aria-required="true"`
- [ ] Run automated tests: 0 label violations

**Test Command**:
```bash
npx playwright test accessibility/a11y.test.ts --grep "labels"
```

---

### Task 1.3: Implement Modal Focus Trapping (3 hours)
**Priority**: 🔴 BLOCKER
**Violations**: 6 (focus-order-semantics)
**WCAG**: 2.1.2 No Keyboard Trap (Level A)

**What to Do**:
Create a reusable `FocusTrap` component and apply it to all modals.

**Step 1: Create FocusTrap Component** (1 hour)

**File**: `components/common/FocusTrap.tsx` (new file)

Copy the implementation from `docs/accessibility/REMEDIATION_GUIDE.md` (Critical Fix 3).

**Features**:
- Traps Tab key within modal boundaries
- Tab on last element → focuses first element
- Shift+Tab on first element → focuses last element
- Escape key closes modal (optional callback)
- Restores focus to trigger button on close

**Step 2: Apply to All Modals** (2 hours)

**Files to Update**:
1. `components/admin/UserManagement.tsx` (Suspend Dialog)
2. `components/admin/EditUserModal.tsx`
3. `components/admin/UserPermissionModal.tsx`
4. `components/admin/RevokeAccessDialog.tsx`
5. `components/admin/UnlinkConfirmDialog.tsx`

**Code Pattern**:
```tsx
// ❌ BEFORE: Focus escapes modal
{showModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-slate-800 rounded-lg p-6">
      <h3>Modal Title</h3>
      {/* modal content */}
    </div>
  </div>
)}

// ✅ AFTER: Focus trapped in modal
{showModal && (
  <FocusTrap onEscape={() => setShowModal(false)}>
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 id="modal-title">Modal Title</h2>
        {/* modal content */}
      </div>
    </div>
  </FocusTrap>
)}
```

**Acceptance Criteria**:
- [ ] FocusTrap component created and tested
- [ ] All modals wrapped in FocusTrap
- [ ] Tab key cycles within modal
- [ ] Escape key closes modal
- [ ] Focus returns to trigger button on close
- [ ] Manual test: Tab through modal, verify no escape

**Test Command**:
```bash
npx playwright test accessibility/a11y.test.ts --grep "focus trap"
```

---

### Task 1.4: Add ARIA Dialog Roles (1 hour)
**Priority**: 🔴 BLOCKER
**Violations**: 3 (aria-required-attr)
**WCAG**: 4.1.2 Name, Role, Value (Level A)

**Files to Update**:
All modal components (same as Task 1.3)

**What to Do**:
Add proper ARIA attributes to all modal containers.

**Code Pattern**:
```tsx
<div
  role="dialog"                          // Required
  aria-modal="true"                      // Required
  aria-labelledby="modal-title-id"      // Required
  aria-describedby="modal-desc-id"      // Optional
  className="fixed inset-0..."
>
  <div className="bg-slate-800 rounded-lg p-6">
    <h2 id="modal-title-id">Modal Title</h2>
    <p id="modal-desc-id">Optional description</p>
    {/* content */}
  </div>
</div>
```

**Required Attributes**:
- `role="dialog"` (or `role="alertdialog"` for destructive actions)
- `aria-modal="true"`
- `aria-labelledby` pointing to modal title element

**Acceptance Criteria**:
- [ ] All modals have `role="dialog"`
- [ ] All modals have `aria-modal="true"`
- [ ] All modals have `aria-labelledby` pointing to title
- [ ] Title elements have unique `id` attribute
- [ ] Run automated tests: 0 aria-required-attr violations

**Test Command**:
```bash
npx playwright test accessibility/a11y.test.ts --grep "ARIA"
```

---

## ⚡ Phase 2: High Priority (Complete in Follow-up Sprint)

**Deadline**: December 6, 2025
**Estimated Time**: 4-6 hours
**Assigned To**: Frontend Team

### Task 2.1: Create Enhanced StatusBadge Component (2 hours)
**Priority**: 🟠 HIGH
**Issue**: Status badges rely solely on color
**WCAG**: 1.3.3 Sensory Characteristics, 1.4.1 Use of Color (Level A)

**What to Do**:
Create a StatusBadge component with icons + text (not color alone).

**File**: `components/StatusBadge.tsx` (enhance or create new)

**Code Pattern**:
```tsx
<StatusBadge status="active" size="sm" />
// Renders: [CheckCircle icon] Active (green background)

<StatusBadge status="suspended" size="md" />
// Renders: [AlertTriangle icon] Suspended (yellow background)
```

**Features**:
- Icon + text for each status
- `role="status"` for screen reader announcements
- `aria-label` with full description
- Color as enhancement, not sole indicator

**Acceptance Criteria**:
- [ ] StatusBadge component created
- [ ] All status types have icons
- [ ] Replace all color-only badges
- [ ] Manual test: Verify icons visible in grayscale

**Reference**: See `docs/accessibility/REMEDIATION_GUIDE.md` (High Priority Fix 5)

---

### Task 2.2: Improve Focus Indicators (1 hour)
**Priority**: 🟠 HIGH
**Issue**: Weak focus indicators on icon buttons
**WCAG**: 2.4.7 Focus Visible (Level AA)

**What to Do**:
Add global CSS for stronger focus outlines.

**File**: Global CSS file or `index.css`

**Code**:
```css
/* Stronger focus indicators for all interactive elements */
*:focus-visible {
  outline: 3px solid #3b82f6;
  outline-offset: 2px;
}

/* High contrast for dark backgrounds */
.dark *:focus-visible {
  outline: 3px solid #60a5fa;
  outline-offset: 2px;
}
```

**Acceptance Criteria**:
- [ ] Global focus styles added
- [ ] Focus visible on all interactive elements
- [ ] High contrast maintained in dark mode
- [ ] Manual test: Tab through page, verify outlines

---

### Task 2.3: Add ARIA Live Regions (2 hours)
**Priority**: 🟠 HIGH
**Issue**: Dynamic content changes not announced
**WCAG**: 4.1.3 Status Messages (Level AA)

**What to Do**:
Add `aria-live` regions for notifications and loading states.

**Code Pattern**:
```tsx
// Loading state
{isLoading && (
  <div role="status" aria-live="polite" className="sr-only">
    Loading users...
  </div>
)}

// Success message
{successMessage && (
  <div role="status" aria-live="polite" className="sr-only">
    {successMessage}
  </div>
)}

// Error message
{errorMessage && (
  <div role="alert" aria-live="assertive" className="sr-only">
    {errorMessage}
  </div>
)}
```

**Acceptance Criteria**:
- [ ] Loading states announced
- [ ] Success messages announced
- [ ] Error messages announced
- [ ] Manual test with screen reader: Verify announcements

---

## 🎨 Phase 3: Polish (Nice to Have)

**Deadline**: December 9, 2025
**Estimated Time**: 2-3 hours
**Assigned To**: Frontend Team

### Task 3.1: Fix Heading Hierarchy (1 hour)
**Issue**: Inconsistent heading structure
**WCAG**: 1.3.1 Info and Relationships (Level A)

**What to Do**:
- Add visually-hidden `<h1>` to main layout
- Change modal titles from `<h3>` to `<h2>`
- Ensure no skipped heading levels

### Task 3.2: Add Skip Links (0.5 hours)
**Issue**: No bypass mechanism for keyboard users
**WCAG**: 2.4.1 Bypass Blocks (Level A)

**What to Do**:
Add "Skip to main content" link at top of page.

### Task 3.3: Improve Error Messaging (1 hour)
**Issue**: Generic error messages
**WCAG**: 3.3.1 Error Identification (Level A)

**What to Do**:
Make error messages more descriptive and actionable.

---

## ✅ Acceptance Criteria (All Phases)

### Automated Tests
- [ ] 0 critical violations (button-name, label, aria-required-attr)
- [ ] 0 serious violations (focus-order-semantics)
- [ ] All automated tests pass

**Run Command**:
```bash
npx playwright test accessibility/a11y.test.ts
```

### Manual Tests
- [ ] Keyboard: Tab through all pages, focus stays in modals
- [ ] Screen Reader: All buttons have descriptive labels
- [ ] Visual: Status indicators use icons + text
- [ ] Focus: Strong outlines visible on all elements

### WCAG Compliance
- [ ] 100% Level A compliance (currently 60%)
- [ ] 100% Level AA compliance (currently 50%)
- [ ] All 4 components passing (currently 0/4)

---

## 📊 Progress Tracking

### Phase 1 Checklist (BLOCKERS)
- [ ] Task 1.1: Icon button aria-labels (2h)
- [ ] Task 1.2: Form label association (1.5h)
- [ ] Task 1.3: Modal focus trapping (3h)
- [ ] Task 1.4: ARIA dialog roles (1h)

**Phase 1 Complete**: 0/4 tasks ✅ (0%)

### Phase 2 Checklist (HIGH)
- [ ] Task 2.1: Enhanced StatusBadge (2h)
- [ ] Task 2.2: Focus indicators (1h)
- [ ] Task 2.3: ARIA live regions (2h)

**Phase 2 Complete**: 0/3 tasks ✅ (0%)

### Phase 3 Checklist (POLISH)
- [ ] Task 3.1: Heading hierarchy (1h)
- [ ] Task 3.2: Skip links (0.5h)
- [ ] Task 3.3: Error messaging (1h)

**Phase 3 Complete**: 0/3 tasks ✅ (0%)

---

## 🛠️ Developer Resources

### Documentation
- [ACCESSIBILITY_REPORT.md](./ACCESSIBILITY_REPORT.md) - Detailed findings
- [REMEDIATION_GUIDE.md](./REMEDIATION_GUIDE.md) - Code examples
- [README.md](./README.md) - Overview and quick links

### Testing Commands
```bash
# Run all accessibility tests
npx playwright test accessibility/a11y.test.ts

# Run specific test category
npx playwright test accessibility/a11y.test.ts --grep "button-name"
npx playwright test accessibility/a11y.test.ts --grep "Keyboard"

# View HTML report
npx playwright show-report

# Update Playwright browsers
npx playwright install
```

### WCAG Resources
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Articles](https://webaim.org/articles/)

---

## 🚀 Daily Standup Updates

### Day 1 (Dec 2)
**Goal**: Complete Phase 1 Tasks 1.1 and 1.2
- [ ] Morning: Fix icon button labels (UserManagement.tsx)
- [ ] Afternoon: Fix icon button labels (ApiServerManager.tsx)
- [ ] EOD: Fix form labels (LoginScreen.tsx)

### Day 2 (Dec 3)
**Goal**: Complete Phase 1 Tasks 1.3 and 1.4
- [ ] Morning: Create FocusTrap component
- [ ] Afternoon: Apply FocusTrap to all modals
- [ ] EOD: Add ARIA dialog roles

### Day 3 (Dec 4)
**Goal**: Testing and Phase 2 start
- [ ] Morning: Run automated tests, fix any failures
- [ ] Afternoon: Create StatusBadge component
- [ ] EOD: Replace color-only badges

---

## ⚠️ Risks and Blockers

| Risk | Mitigation |
|------|-----------|
| Time estimate too low | Prioritize Phase 1 only, defer Phase 2/3 |
| Breaking existing functionality | Add regression tests, thorough QA |
| Team unfamiliar with ARIA | Pair programming, code reviews |
| Testing delays | Run automated tests frequently |

---

## 🎯 Success Metrics

### Before Remediation
- WCAG 2.1 A: 60% compliant
- WCAG 2.1 AA: 50% compliant
- Components passing: 0/4 (0%)
- Critical violations: 39

### After Remediation (Target)
- WCAG 2.1 A: 100% compliant ✅
- WCAG 2.1 AA: 100% compliant ✅
- Components passing: 4/4 (100%) ✅
- Critical violations: 0 ✅

---

## 📞 Contact

**Questions?** Refer to:
- Technical details: `REMEDIATION_GUIDE.md`
- Test results: `ACCESSIBILITY_REPORT.md`
- Overview: `README.md`

**Assigned Team**: Frontend Development
**Project Manager**: [PM Name]
**QA Lead**: [QA Name]

---

**Action Plan Created**: November 27, 2025
**Target Completion**: December 4, 2025 (Phase 1)
**Next Review**: December 5, 2025

---

**Let's make PFA Vanguard accessible to all users!** 🎉
