# ADR-006: Quick Testing Guide

**Purpose**: Step-by-step manual testing of the API Server & Endpoint Architecture implementation.

**Prerequisites**:
- Backend running: http://localhost:3001
- Frontend running: http://localhost:3002
- Logged in as admin user

---

## 🚀 Quick Start Test (5 minutes)

### Test 1: Access the UI

1. Navigate to http://localhost:3002
2. Login as admin (`admin` / `admin123`)
3. Click **Administration** → **API Servers** in the sidebar
4. **Expected**: Empty state message "No API servers configured"

### Test 2: Create a Server with Test Connection

1. Click **"+ Add Server"** button
2. Fill in the form:
   - Name: `Test Server`
   - Base URL: `https://jsonplaceholder.typicode.com`
   - Auth Type: `none`
   - Status: `active`
3. **Expected**: Orange warning box appears: "Critical fields changed - Test connection before saving"
4. Click **"Test Connection"**
5. **Expected**: Green success message: "Connected successfully (HTTP 200)"
6. Click **"Add Server"**
7. **Expected**: Modal closes, server appears in list with health status "untested"

### Test 3: Add an Endpoint

1. Click on "Test Server" to expand it
2. Click **"+ Add Endpoint"**
3. Fill in the form:
   - Name: `Posts`
   - Path: `/posts`
   - Entity: `other`
   - Operation: `read`
   - Method: `GET`
4. Click **"Add Endpoint"**
5. **Expected**: Modal closes, endpoint appears under server

### Test 4: Test the Endpoint

1. Find the "Posts" endpoint
2. Click the **Play button** (test icon)
3. **Expected**:
   - Loading spinner appears
   - After ~1 second, green success message appears
   - Stats update: "Tests: 1 (100% success)"

---

## 🛡️ Security Feature Tests (10 minutes)

### Test 5: Write-Only Password Pattern

**Purpose**: Verify credentials are never exposed to frontend.

1. Create a server with Basic auth:
   - Name: `Secure Server`
   - Base URL: `https://api.example.com`
   - Auth Type: `basic`
   - Username: `testuser`
   - Password: `secret123`
   - (Skip test connection - click X on warning)
   - Click **"Add Server"** (form will show validation error)

2. Click **"Add Server"** anyway (after filling all required fields)
3. Click **Edit** (pencil icon) on "Secure Server"
4. **Expected**:
   - Username field shows: `[UNCHANGED]`
   - Password field shows: `[UNCHANGED]`
   - Help text: "(leave blank to keep existing)"

5. Change only the name to `Secure Server Updated`
6. Leave username and password blank
7. Click **"Update Server"**
8. **Expected**: Server updates successfully (old credentials preserved)

### Test 6: Test Connection Requirement

**Purpose**: Verify save is blocked for critical changes without testing.

1. Edit "Secure Server Updated"
2. Change Base URL to `https://newurl.example.com`
3. **Expected**: Orange warning appears, Save button disabled
4. Try to click **"Update Server"**
5. **Expected**: Button is disabled (grayed out)
6. Click **"Test Connection"**
7. **Expected**: Test fails (connection error), Save button still disabled
8. Change Base URL back to `https://api.example.com`
9. Click **"Test Connection"**
10. **Expected**: If connection succeeds, Save button becomes enabled

### Test 7: Impact Warning Modal

**Purpose**: Verify blast radius awareness for high-risk changes.

**Setup**: Create a server with 4+ endpoints first.

1. Create "PEMS Production" server with Base URL `https://pems.example.com`
2. Add 4 endpoints: `/assets`, `/users`, `/categories`, `/pfa`
3. Click **Edit** on "PEMS Production"
4. Change Base URL to `https://pems-new.example.com`
5. Click **"Test Connection"** → Success
6. Click **"Update Server"**
7. **Expected**: Impact Warning Modal appears:
   - Title: "Confirm High-Risk Change"
   - Message mentions "4 endpoints"
   - Message mentions "active data syncs"
   - Buttons: "Cancel" and "Yes, Update Server"
8. Click **"Cancel"**
9. **Expected**: Modal closes, changes not saved
10. Click **"Update Server"** again → Click **"Yes, Update Server"**
11. **Expected**: Server updates, modal closes

### Test 8: Path Traversal Prevention

**Purpose**: Verify security validation for endpoint paths.

1. Expand any server
2. Click **"+ Add Endpoint"**
3. Enter path: `../../etc/passwd`
4. **Expected**: Red error box appears:
   - "Invalid path format"
   - "Path traversal (../) is not allowed for security reasons"
5. Try path: `assets` (no leading slash)
6. **Expected**: Error: "Path must start with /"
7. Enter valid path: `/valid-path`
8. **Expected**: No errors

---

## 📊 UX Performance Tests (5 minutes)

### Test 9: Optimistic UI - Expand Server

**Purpose**: Verify <16ms perceived latency for expand/collapse.

1. Click to expand a server
2. **Expected**: Opens immediately (instant feedback)
3. Click to collapse
4. **Expected**: Closes immediately

**Measurement**: Should feel instant, no visible delay.

### Test 10: Optimistic UI - Test Endpoint

**Purpose**: Verify optimistic update pattern.

1. Click **Test** on an endpoint
2. **Expected Sequence**:
   - Button shows loading spinner immediately (0ms)
   - "Testing..." message appears
   - After API response (~500ms), result appears
   - If success: Green box with response time
   - If error: Red box with error message

### Test 11: Delete Operations

**Purpose**: Verify cascading deletes and confirmations.

1. Create a server with 2 endpoints
2. Click **Delete** (trash icon) on an endpoint
3. **Expected**: Browser confirm dialog: "Delete this endpoint? This cannot be undone."
4. Click **Cancel** → Endpoint remains
5. Click **Delete** again → Click **OK**
6. **Expected**: Endpoint disappears (optimistic update)

7. Click **Delete** on the server
8. **Expected**: Confirm dialog: "Delete this server and all its endpoints? This cannot be undone."
9. Click **OK**
10. **Expected**: Server and remaining endpoint both disappear

---

## 🧪 Error Handling Tests (5 minutes)

### Test 12: Invalid URL

1. Create server with Base URL: `not-a-valid-url`
2. **Expected**: Form validation error: "Invalid URL format"

### Test 13: Missing Required Fields

1. Try to create server with only Name filled
2. **Expected**: Errors appear:
   - "Base URL is required"
   - "Username/Key is required" (if auth type requires it)

### Test 14: Network Error Simulation

1. Create server with Base URL: `https://nonexistent-domain-12345.com`
2. Fill all fields, click **"Test Connection"**
3. **Expected**: Red error message after 5 seconds:
   - "Cannot connect to https://nonexistent-domain-12345.com. Check URL and network access."

---

## ✅ Acceptance Criteria Checklist

After completing all tests, verify:

- [ ] Can create, edit, delete servers
- [ ] Can create, edit, delete endpoints
- [ ] Test connection works and is required for critical changes
- [ ] Impact warning appears for servers with 3+ endpoints
- [ ] Credentials never visible in edit mode (shows `[UNCHANGED]`)
- [ ] Path traversal validation works
- [ ] Optimistic updates provide instant feedback
- [ ] Error messages are clear and actionable
- [ ] Loading states appear for all async operations
- [ ] Cascading deletes work (server → endpoints)
- [ ] Health status updates after endpoint tests
- [ ] Stats update (test count, success rate, avg response time)

---

## 🐛 Known Issues to Watch For

**If you encounter these, report them**:

1. **White screen after navigation**: Check browser console for errors
2. **"Network Error" on all requests**: Verify backend is running on port 3001
3. **"Organization not found in token"**: Logout and login again
4. **Modal doesn't open**: Check for console errors
5. **Save button never enables**: Verify test connection succeeded

---

## 📝 Test Results Template

```markdown
## Test Results - ADR-006 Integration Testing

**Tester**: [Your Name]
**Date**: [YYYY-MM-DD]
**Environment**: Frontend: http://localhost:3002, Backend: http://localhost:3001

### Quick Start Tests (Test 1-4)
- [ ] Test 1: Access UI - ✅ PASS / ❌ FAIL
- [ ] Test 2: Create Server - ✅ PASS / ❌ FAIL
- [ ] Test 3: Add Endpoint - ✅ PASS / ❌ FAIL
- [ ] Test 4: Test Endpoint - ✅ PASS / ❌ FAIL

### Security Tests (Test 5-8)
- [ ] Test 5: Write-Only Password - ✅ PASS / ❌ FAIL
- [ ] Test 6: Test Connection Requirement - ✅ PASS / ❌ FAIL
- [ ] Test 7: Impact Warning - ✅ PASS / ❌ FAIL
- [ ] Test 8: Path Traversal Prevention - ✅ PASS / ❌ FAIL

### UX Performance Tests (Test 9-11)
- [ ] Test 9: Expand Server (<16ms) - ✅ PASS / ❌ FAIL
- [ ] Test 10: Test Endpoint Optimistic UI - ✅ PASS / ❌ FAIL
- [ ] Test 11: Delete Operations - ✅ PASS / ❌ FAIL

### Error Handling Tests (Test 12-14)
- [ ] Test 12: Invalid URL - ✅ PASS / ❌ FAIL
- [ ] Test 13: Missing Required Fields - ✅ PASS / ❌ FAIL
- [ ] Test 14: Network Error - ✅ PASS / ❌ FAIL

### Issues Found
[List any bugs or unexpected behavior]

### Screenshots
[Attach screenshots of key flows]

### Conclusion
Overall Status: ✅ READY FOR PHASE 4 / ⚠️ MINOR ISSUES / ❌ BLOCKED
```

---

**Generated**: 2025-11-26
**Document Version**: 1.0
**Related**: ADR-006-IMPLEMENTATION-SUMMARY.md
