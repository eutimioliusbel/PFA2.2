# ADR-006: API Server and Endpoint Architecture - UX Specification & Best Practices

> **Primary Agent**: `ux-technologist`
> **Instruction**: Ensure the design is intuitive, accessible, and feels instant. Focus on perceived performance over actual performance.

**Status**: 🔴 Draft
**Created**: 2025-11-26
**Last Updated**: 2025-11-26

---

## ⚡ 1. Perceived Performance Rules

### Rule 1: Optimistic Updates
**Principle**: Update the UI immediately on user action, revert only on error.

**Example - Test Endpoint**:
```typescript
// User clicks "Test Endpoint"
IMMEDIATELY (0ms):
  ✅ Show "Testing..." status on endpoint row
  ✅ Show subtle loading spinner
  ✅ Disable test button (prevent duplicate requests)

AFTER SERVER (500ms):
  ✅ Show success icon (green checkmark) or error icon (red X)
  ✅ Update status text: "Healthy (215ms)" or "Failed: 404 Not Found"
  ✅ Re-enable test button

ON ERROR:
  ❌ Show error toast: "Test failed: Network error"
  ❌ Revert status to previous state
  ❌ Re-enable test button
```

---

### Rule 2: Latency Budget
**Target Latency**: <100ms for UI interactions, <500ms for network operations

| Interaction | Target | Max Acceptable | Strategy |
|-------------|--------|----------------|----------|
| Expand server | <16ms | 50ms | Optimistic expand |
| Test single endpoint | <500ms | 2000ms | Show progress |
| Test all endpoints | <2000ms | 10000ms | Progress bar |
| Save server | <200ms | 500ms | Optimistic save |
| Delete endpoint | <100ms | 300ms | Optimistic removal |

**Enforcement**: Log slow interactions to identify bottlenecks.

---

### Rule 3: Loading Strategy
**Progressive Disclosure > Skeleton Screens > Spinners**

**Server List Loading**:
```
┌─────────────────────────────────────┐
│ API Servers                         │
├─────────────────────────────────────┤
│ ▼ PEMS Production                   │
│   ├─ ███████████ Loading            │
│   ├─ ███████████ Loading            │
│   └─ ███████████ Loading            │
└─────────────────────────────────────┘
```

**Never show**:
- ❌ Blank white screen while loading
- ❌ Generic "Loading..." text without context
- ❌ Spinner that lasts >2 seconds without explanation

---

## 🎨 2. Interaction Model

### Happy Path: Test Individual Endpoint

**User Flow**:
1. Admin expands "PEMS Production" server
2. Sees list of 7 endpoints
3. Clicks "Test" button next to "Assets" endpoint
4. Status updates to "Testing..." immediately
5. After 215ms, status shows "✅ Healthy (215ms)"

**Timing**:
- Step 1 → 2: <16ms (instant expand animation)
- Step 2 → 3: <16ms (instant click feedback)
- Step 3 → 4: <16ms (optimistic status update)
- Step 4 → 5: 215ms (server response)

---

### Hierarchical View: Server → Endpoints

**UI Structure**:
```
┌─────────────────────────────────────────────────────────┐
│ API Servers                                    [+ Add]  │
├─────────────────────────────────────────────────────────┤
│ ▼ PEMS Production                         [Test All]    │
│   Status: ●●●●●●○ (6/7 healthy)                        │
│   Base URL: https://pems.example.com                    │
│   Last Tested: 2 minutes ago                            │
│                                                          │
│   ├─ ✅ Assets (215ms)                     [Test]       │
│   ├─ ✅ Users (187ms)                      [Test]       │
│   ├─ ✅ Categories (142ms)                 [Test]       │
│   ├─ ✅ Organizations (201ms)              [Test]       │
│   ├─ ✅ Manufacturers (178ms)              [Test]       │
│   ├─ ✅ PFA Data (Read) (325ms)            [Test]       │
│   └─ ❌ PFA Data (Write) - 404 Not Found   [Test]       │
│                                                          │
│ ▶ ESS Integration                          [Test All]   │
│   Status: Not tested                                    │
└─────────────────────────────────────────────────────────┘
```

**Expansion Behavior**:
- Click server name → Expand/collapse (smooth 200ms animation)
- Click "Test All" → Tests all endpoints sequentially with progress
- Click individual "Test" → Tests single endpoint

---

### Empty States

**Scenario 1**: No servers configured yet

**UI**:
```
┌───────────────────────────────────┐
│  📡 No API Servers Configured     │
│                                   │
│  Add your first API server to     │
│  start syncing data.              │
│                                   │
│  [+ Add PEMS Server]              │
│  [📚 View Documentation]          │
└───────────────────────────────────┘
```

---

**Scenario 2**: Server has no endpoints

**UI**:
```
┌───────────────────────────────────┐
│ ▼ PEMS Production                 │
│   Status: No endpoints configured │
│                                   │
│   ℹ️ Add endpoints to sync data   │
│                                   │
│   [+ Add Endpoint]                │
└───────────────────────────────────┘
```

---

### Error States

**Scenario 1**: Endpoint test fails - Network Error

**UI**:
```
┌───────────────────────────────────┐
│ ❌ Assets - Failed                │
│    Network error: Timeout         │
│    Last success: 5 minutes ago    │
│                                   │
│    [Retry] [View Logs]            │
└───────────────────────────────────┘
```

---

**Scenario 2**: Endpoint test fails - Auth Error

**UI**:
```
┌───────────────────────────────────┐
│ ❌ Assets - Failed                │
│    401 Unauthorized               │
│    Server credentials invalid     │
│                                   │
│    [Update Credentials] [Retry]   │
└───────────────────────────────────┘
```

---

**Scenario 3**: Multiple endpoints failing (systemic issue)

**UI**:
```
┌───────────────────────────────────────────┐
│ ⚠️ Warning: Server Health Degraded       │
│                                           │
│ 5 of 7 endpoints failing with 401 errors │
│ Likely cause: Server credentials invalid │
│                                           │
│ [Update Server Credentials]              │
└───────────────────────────────────────────┘
```

**Smart Error Correlation**: If ≥3 endpoints fail with same error, show server-level warning instead of per-endpoint errors.

---

## ♿ 3. Accessibility & Inclusion (Best Practices)

### Keyboard Navigation
**Tab Order**:
1. "Add Server" button
2. Server 1 expand/collapse button
3. Server 1 "Test All" button
4. Endpoint 1 "Test" button
5. Endpoint 2 "Test" button
6. ...
7. Server 2 expand/collapse button

**Keyboard Shortcuts**:
- `Enter` on focused server: Expand/collapse
- `Enter` on focused endpoint: Test endpoint
- `Ctrl+T` (or `Cmd+T`): Test all endpoints in current server
- `Esc`: Close server edit modal

---

### Screen Reader Support
**ARIA Labels Required**:
```html
<button
  aria-label="Expand PEMS Production server to view 7 endpoints"
  aria-expanded="false"
  aria-controls="server-endpoints-pems"
>
  <ChevronRight aria-hidden="true" />
  PEMS Production
</button>

<div
  id="server-endpoints-pems"
  role="region"
  aria-labelledby="server-pems-title"
>
  <ul role="list">
    <li>
      <span id="endpoint-assets-status" role="status">
        Assets: Healthy, 215 milliseconds response time
      </span>
      <button aria-label="Test Assets endpoint">Test</button>
    </li>
  </ul>
</div>
```

**Live Regions for Test Results**:
```html
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  Assets endpoint test completed. Status: Healthy. Response time: 215 milliseconds.
</div>
```

---

### Color Accessibility
**Status Indicators**:
- ✅ Healthy: Green (#10b981) + checkmark icon
- ⚠️ Degraded: Yellow (#f59e0b) + warning icon
- ❌ Failed: Red (#ef4444) + X icon
- ⏳ Testing: Blue (#3b82f6) + spinner

**Never rely on color alone**: Always include icon + text.

---

### Mobile Considerations
**Touch Targets**: Minimum 44px × 44px for all buttons

**Mobile Layout**:
```
┌─────────────────────────┐
│ API Servers             │
├─────────────────────────┤
│ ▼ PEMS Production       │
│   ●●●●●●○ (6/7)         │
│                         │
│ ✅ Assets (215ms)       │
│    [Test]               │
│                         │
│ ✅ Users (187ms)        │
│    [Test]               │
│                         │
│ ... (stack vertically)  │
└─────────────────────────┘
```

**Responsive Breakpoints**:
- Mobile: 320px - 767px (vertical stack, full-width cards)
- Tablet: 768px - 1023px (2-column grid)
- Desktop: 1024px+ (hierarchical tree view)

---

## 🎯 4. Visual Feedback Patterns

### Success Feedback - Endpoint Test Passed
**Toast Message**:
```
┌──────────────────────────────┐
│ ✅ Endpoint Test Successful  │
│ Assets endpoint: 215ms       │
└──────────────────────────────┘
```
- Duration: 3 seconds
- Position: Top-right
- Auto-dismiss: Yes

---

### Error Feedback - Endpoint Test Failed
**Inline Error** (preferred):
```
❌ Assets - 404 Not Found
   Endpoint path may have changed
   [Retry] [View Logs] [Edit Endpoint]
```

**Toast Error** (for systemic failures):
```
┌──────────────────────────────┐
│ ❌ Server Test Failed        │
│ 5/7 endpoints unreachable    │
│ Check network connection     │
│ [Retry All] [Dismiss]        │
└──────────────────────────────┘
```

---

### Progress Feedback - Test All Endpoints
**Progress Bar**:
```
┌───────────────────────────────────┐
│ Testing Endpoints... (3/7)        │
│ ████████░░░░░░░░░░░░░░░░░░ 43%   │
│                                   │
│ ✅ Assets (215ms)                 │
│ ✅ Users (187ms)                  │
│ ✅ Categories (142ms)             │
│ ⏳ Organizations - Testing...     │
│ ⏸️ Manufacturers - Pending        │
│ ⏸️ PFA Data (Read) - Pending      │
│ ⏸️ PFA Data (Write) - Pending     │
└───────────────────────────────────┘
```

**Real-time Updates**: Progress bar and status update as each endpoint completes.

---

## 🧪 5. UX Testing Scenarios

### Scenario 1: Test Single Endpoint (Happy Path)
**Steps**:
1. Expand "PEMS Production" server
2. Click "Test" on "Assets" endpoint
3. Wait for result

**Expected**:
- ✅ Expand animation <16ms (1 frame)
- ✅ "Testing..." status appears instantly
- ✅ Result appears in <500ms
- ✅ Success toast shows for 3 seconds

---

### Scenario 2: Test All Endpoints
**Steps**:
1. Click "Test All" on server
2. Observe progress

**Expected**:
- ⏳ Progress modal appears immediately
- ⏳ Endpoints tested sequentially (avoid rate limits)
- ⏳ Progress bar updates in real-time
- ✅ Summary shown at end: "6/7 passed, 1 failed"

---

### Scenario 3: Systemic Failure (All Endpoints Fail)
**Steps**:
1. Disconnect network
2. Click "Test All"

**Expected**:
- ⚠️ After 2nd failure, show warning: "Multiple failures detected"
- ⚠️ Offer to cancel remaining tests
- ⚠️ Suggest root cause: "Network issue or server credentials"

---

### Scenario 4: Endpoint Configuration (Add New Endpoint)
**Steps**:
1. Click "+ Add Endpoint" button
2. Fill form: Name, Path, Entity
3. Click "Save"

**Expected**:
- ✅ Form validates instantly (before submission)
- ✅ Endpoint appears in list immediately (optimistic)
- ✅ "Test" button available immediately
- ⏳ If save fails, revert optimistic add and show error

---

## 📚 Related Documentation

- **Decision**: [ADR-006-DECISION.md](./ADR-006-DECISION.md)
- **AI Opportunities**: [ADR-006-AI_OPPORTUNITIES.md](./ADR-006-AI_OPPORTUNITIES.md)
- **Test Plan**: [ADR-006-TEST_PLAN.md](./ADR-006-TEST_PLAN.md)
- **Implementation Plan**: [ADR-006-IMPLEMENTATION_PLAN.md](./ADR-006-IMPLEMENTATION_PLAN.md)

---

**Status**: 🔴 Draft - Awaiting UX Review
**Next Action**: Frontend developer must implement hierarchical server → endpoints view with optimistic UI

*Document created: 2025-11-26*
*UX Spec Version: 1.0*
