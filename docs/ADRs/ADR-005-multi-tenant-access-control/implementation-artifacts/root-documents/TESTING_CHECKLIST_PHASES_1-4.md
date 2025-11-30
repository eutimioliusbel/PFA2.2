# Testing Checklist: Phases 1-4 Implementation

**Date**: 2025-11-25
**Scope**: PostgreSQL Migration, Sync Worker, Live Merge API, Frontend Integration
**Status**: Ready for Testing

---

## 🎯 Testing Overview

This document provides a comprehensive testing checklist for Phases 1-4 of the Mirror + Delta architecture implementation. Complete each section systematically to verify all features are working correctly.

---

## ✅ Pre-Test Verification

Before starting tests, verify all services are running:

```bash
# 1. Check backend is running
curl http://localhost:3001/health
# Expected: {"status":"ok","timestamp":"...","environment":"development"}

# 2. Check frontend is accessible
# Open browser: http://localhost:3000
# Expected: Login screen visible

# 3. Check PostgreSQL is running
docker ps | grep pfa-vanguard-db
# Expected: Container status "Up"

# 4. Check pgAdmin is running
# Open browser: http://localhost:5050
# Expected: pgAdmin login screen
```

**Checklist**:
- [ ] Backend API responding on port 3001
- [ ] Frontend accessible on port 3000
- [ ] PostgreSQL container running
- [ ] pgAdmin accessible on port 5050
- [ ] No errors in backend console
- [ ] No errors in frontend console (F12 → Console)

---

## 📋 Phase 1: PostgreSQL Migration Testing

### 1.1 Database Connection Test

**Objective**: Verify PostgreSQL database is accessible and contains migrated data

**Steps**:
1. Open pgAdmin at http://localhost:5050
2. Login: `admin@example.com` / `admin123`
3. Add server connection:
   - Name: PFA Vanguard
   - Host: host.docker.internal (or localhost)
   - Port: 5432
   - Database: pfa_vanguard
   - Username: postgres
   - Password: pfa_vanguard_dev

**Expected Results**:
- [ ] Connection successful
- [ ] Database "pfa_vanguard" visible
- [ ] 12 tables present (users, organizations, pfa_mirror, etc.)
- [ ] No connection errors

### 1.2 Data Migration Verification

**Objective**: Verify all data migrated from SQLite correctly

**Steps**:
1. In pgAdmin, run these queries:

```sql
-- Check user count
SELECT COUNT(*) FROM users;
-- Expected: 6 users (admin + 5 test users)

-- Check organization count
SELECT COUNT(*) FROM organizations;
-- Expected: 28 organizations

-- Check API configurations
SELECT COUNT(*) FROM api_configurations;
-- Expected: 10 API configs

-- Check data integrity
SELECT id, username, role FROM users WHERE username = 'admin';
-- Expected: admin user with role 'admin'
```

**Expected Results**:
- [ ] 6 users in database
- [ ] 28 organizations in database
- [ ] 10 API configurations in database
- [ ] Admin user exists with correct role
- [ ] No NULL values in required fields

### 1.3 Schema Verification

**Objective**: Verify database schema is correct

**Steps**:
1. In pgAdmin, check table structures:

```sql
-- Check PfaMirror table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pfa_mirror';

-- Check PfaModification table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pfa_modification';
```

**Expected Results**:
- [ ] PfaMirror table has `data` column (JSONB)
- [ ] PfaModification table has `changes` column (JSONB)
- [ ] Both tables have organizationId foreign key
- [ ] Indexes exist on organizationId columns
- [ ] Migration lock shows "postgresql" provider

---

## 📋 Phase 2: Background Sync Worker Testing

### 2.1 Sync Worker Status Test

**Objective**: Verify sync worker is running

**Steps**:
1. Check backend console logs
2. Look for: `[Worker] Background sync worker started (interval: */15 * * * *)`
3. Wait 15 minutes and check for sync logs

**Alternative - Manual Trigger**:
```bash
# Login and get JWT token first
TOKEN="your_jwt_token_here"

# Trigger manual sync
curl -X POST http://localhost:3001/api/sync/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"organizationId": "76198c87-6b44-4ebb-9382-abe16fee4805"}'
```

**Expected Results**:
- [ ] Backend logs show "Background sync worker started"
- [ ] Worker runs every 15 minutes automatically
- [ ] Manual trigger returns success response
- [ ] No crash or error logs

### 2.2 Sync Logging Test

**Objective**: Verify sync operations are logged to database

**Steps**:
1. After a sync runs, check database:

```sql
-- Get recent sync logs
SELECT
  id, organization_id, status,
  records_total, records_processed,
  started_at, completed_at
FROM pfa_sync_log
ORDER BY started_at DESC
LIMIT 5;
```

**Expected Results**:
- [ ] Sync logs appear in database
- [ ] Status shows "completed" or "running"
- [ ] Record counts are populated
- [ ] Timestamps are correct
- [ ] Organization IDs match expected values

### 2.3 Sync API Endpoints Test

**Objective**: Verify sync API endpoints work

**Test GET /api/sync/status**:
```bash
curl -X GET "http://localhost:3001/api/sync/status?limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Test GET /api/sync/worker-status**:
```bash
curl -X GET "http://localhost:3001/api/sync/worker-status" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Results**:
- [ ] Status endpoint returns sync logs array
- [ ] Worker status shows enabled: true
- [ ] Next run time is populated
- [ ] Summary statistics are correct

---

## 📋 Phase 3: Live Merge API Testing

### 3.1 GET Merged Data Test

**Objective**: Verify API returns merged PFA data (mirror + modifications)

**Steps**:
1. Get JWT token by logging in:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

2. Use token to get PFA data:
```bash
TOKEN="<paste_token_here>"
ORG_ID="76198c87-6b44-4ebb-9382-abe16fee4805"  # RIO

curl -X GET "http://localhost:3001/api/pfa/$ORG_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Results**:
- [ ] Response contains `success: true`
- [ ] Data array contains PFA records
- [ ] Pagination object present
- [ ] SyncState object shows pristine/modified counts
- [ ] Response time < 200ms

### 3.2 POST Save Draft Test

**Objective**: Verify draft modifications save to database

**Steps**:
1. Save a draft modification:
```bash
SESSION_ID=$(uuidgen)  # Generate UUID
curl -X POST "http://localhost:3001/api/pfa/$ORG_ID/draft" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"modifications\": [{
      \"pfaId\": \"test-pfa-001\",
      \"changes\": {
        \"forecastStart\": \"2025-03-01\",
        \"forecastEnd\": \"2025-03-31\"
      }
    }]
  }"
```

2. Verify in database:
```sql
SELECT * FROM pfa_modification
WHERE session_id = '<your_session_id>'
ORDER BY modified_at DESC;
```

**Expected Results**:
- [ ] API returns `success: true, saved: 1`
- [ ] Database shows new record in pfa_modification table
- [ ] Changes field contains only modified fields (JSONB)
- [ ] syncState is "modified"
- [ ] Response time < 200ms

### 3.3 POST Commit Drafts Test

**Objective**: Verify commit updates syncState to committed

**Steps**:
1. Commit the draft:
```bash
curl -X POST "http://localhost:3001/api/pfa/$ORG_ID/commit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\"}"
```

2. Verify in database:
```sql
SELECT sync_state, modified_at
FROM pfa_modification
WHERE session_id = '<your_session_id>';
```

**Expected Results**:
- [ ] API returns `success: true, committed: 1`
- [ ] Database shows syncState changed to "committed"
- [ ] Response time < 500ms

### 3.4 POST Discard Drafts Test

**Objective**: Verify discard deletes draft modifications

**Steps**:
1. Create a new draft (repeat 3.2 with new sessionId)
2. Discard the draft:
```bash
curl -X POST "http://localhost:3001/api/pfa/$ORG_ID/discard" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\"}"
```

3. Verify in database:
```sql
SELECT COUNT(*) FROM pfa_modification
WHERE session_id = '<your_session_id>';
-- Expected: 0
```

**Expected Results**:
- [ ] API returns `success: true, discarded: 1`
- [ ] Database shows record deleted
- [ ] Response time < 200ms

### 3.5 GET Stats Test

**Objective**: Verify KPI statistics calculation

**Steps**:
```bash
curl -X GET "http://localhost:3001/api/pfa/$ORG_ID/stats" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Results**:
- [ ] Response contains totalRecords count
- [ ] Cost totals are calculated (plan, forecast, actual)
- [ ] Variance calculations present
- [ ] Breakdown by category and source
- [ ] Response time < 500ms

---

## 📋 Phase 4: Frontend Integration Testing

### 4.1 Login Test

**Objective**: Verify authentication works

**Steps**:
1. Open http://localhost:3000
2. Enter credentials:
   - Username: `admin`
   - Password: `admin123`
3. Click "Sign In"

**Expected Results**:
- [ ] Login screen displays correctly
- [ ] Submit button works
- [ ] Success → Redirects to dashboard
- [ ] JWT token stored in localStorage ('pfa_auth_token')
- [ ] User data stored in localStorage ('pfa_user_data')
- [ ] No console errors

### 4.2 Data Loading Test

**Objective**: Verify frontend loads data from API (not mockData)

**Steps**:
1. After login, observe Timeline/Grid/Matrix views
2. Open browser DevTools (F12) → Network tab
3. Filter by "pfa"
4. Refresh page

**Expected Results**:
- [ ] Network request to `GET /api/pfa/:orgId` visible
- [ ] Response shows real data from PostgreSQL
- [ ] Timeline displays equipment records
- [ ] Grid shows correct record count
- [ ] Loading spinner appears briefly during fetch
- [ ] No "mockData" imports in console logs

### 4.3 Sync Status Banner Test

**Objective**: Verify sync status banner displays correctly

**Steps**:
1. Look at top of screen after login
2. Check for sync status banner

**Without Modifications**:
- [ ] Banner shows "All changes saved" or is hidden
- [ ] Pristine count matches total records
- [ ] Modified count is 0

**With Modifications** (after making changes):
- [ ] Banner shows "X unsaved changes"
- [ ] Yellow badge visible
- [ ] Modified count is accurate

### 4.4 Draft Save Workflow Test

**Objective**: Verify draft save functionality

**Steps**:
1. In Timeline view, drag a bar to new dates
2. Click yellow "Save Draft" button (bottom-right floating button)
3. Wait for notification
4. Refresh page (F5)

**Expected Results**:
- [ ] "Save Draft" button visible after edit
- [ ] Click → Shows loading state
- [ ] Success notification appears
- [ ] Network request to `POST /api/pfa/:orgId/draft` visible
- [ ] After refresh, changes persist
- [ ] Sync banner shows "X modified records"

### 4.5 Commit Workflow Test

**Objective**: Verify commit functionality

**Steps**:
1. Make changes and save draft (as above)
2. Click green "Commit" button
3. Confirm in dialog
4. Wait for notification

**Expected Results**:
- [ ] "Commit" button visible when drafts exist
- [ ] Confirmation dialog appears
- [ ] Click confirm → Loading state
- [ ] Success notification appears
- [ ] Network request to `POST /api/pfa/:orgId/commit` visible
- [ ] Sync banner updates to show committed state
- [ ] Changes remain after refresh

### 4.6 Discard Workflow Test

**Objective**: Verify discard functionality

**Steps**:
1. Make changes and save draft
2. Click red "Discard" button
3. Confirm in dialog

**Expected Results**:
- [ ] "Discard" button visible when drafts exist
- [ ] Confirmation dialog appears
- [ ] Click confirm → Loading state
- [ ] Notification appears
- [ ] Network request to `POST /api/pfa/:orgId/discard` visible
- [ ] Changes revert to original state
- [ ] Sync banner clears

### 4.7 Error Handling Test

**Objective**: Verify error states display correctly

**Steps**:
1. Stop backend server: `Ctrl+C` in backend console
2. In frontend, try to save a draft
3. Observe error state

**Expected Results**:
- [ ] Error notification appears
- [ ] Error message is user-friendly
- [ ] "Retry" option visible
- [ ] Console shows detailed error (for debugging)
- [ ] UI doesn't crash
- [ ] After restarting backend, retry works

### 4.8 Organization Switch Test

**Objective**: Verify data reloads when switching organizations

**Steps**:
1. Login as admin (has access to multiple orgs)
2. Note current organization (e.g., "RIO")
3. Switch to different organization (e.g., "PORTARTHUR")
4. Observe data reload

**Expected Results**:
- [ ] Organization selector visible
- [ ] Click triggers data reload
- [ ] Loading spinner appears
- [ ] Network request to `GET /api/pfa/:newOrgId` visible
- [ ] Timeline/Grid updates with new org's data
- [ ] Filters reset to default for new org
- [ ] No errors in console

### 4.9 Loading States Test

**Objective**: Verify loading states prevent user confusion

**Steps**:
1. Slow down network in DevTools (Network tab → Throttling → Slow 3G)
2. Refresh page
3. Observe loading states

**Expected Results**:
- [ ] Loading spinner visible during initial load
- [ ] "Loading PFA data..." message displays
- [ ] Buttons disabled during load
- [ ] UI doesn't show stale data
- [ ] After load completes, spinner disappears

### 4.10 Filter Integration Test

**Objective**: Verify filters work with API data

**Steps**:
1. Apply filter: Category = "Earthmoving"
2. Observe data update
3. Apply additional filter: Source = "Rental"
4. Check network requests

**Expected Results**:
- [ ] Filter panel displays correctly
- [ ] Applying filter updates visible records
- [ ] Record count updates
- [ ] Network request includes filter parameters
- [ ] API returns filtered data
- [ ] Timeline/Grid show only matching records

---

## 📋 Integration Testing

### Integration Test 1: End-to-End Draft Workflow

**Objective**: Test complete workflow from edit to commit

**Steps**:
1. Login as admin
2. Navigate to Timeline view
3. Drag equipment bar to new date
4. Click "Save Draft"
5. Refresh page
6. Verify changes persist
7. Click "Commit"
8. Refresh again
9. Verify changes still persist

**Expected Results**:
- [ ] All steps complete without errors
- [ ] Changes persist through refreshes
- [ ] Database shows draft → committed state change
- [ ] UI reflects current state accurately

### Integration Test 2: Multi-User Scenario

**Objective**: Test draft isolation between users

**Steps**:
1. Login as admin, make changes, save draft
2. Logout
3. Login as different user (e.g., RRECTOR)
4. Check if admin's drafts are visible

**Expected Results**:
- [ ] User 2 doesn't see User 1's drafts
- [ ] Each user has isolated draft sessions
- [ ] Committed changes visible to all users
- [ ] No data leakage between users

### Integration Test 3: Sync Worker + API Integration

**Objective**: Test that sync worker and API work together

**Steps**:
1. Trigger manual sync via API
2. Wait for sync to complete
3. Refresh frontend
4. Check if new/updated records appear

**Expected Results**:
- [ ] Sync completes successfully
- [ ] Frontend receives updated data
- [ ] Sync logs visible in database
- [ ] No conflicts with user drafts

---

## 📋 Performance Testing

### Performance Test 1: API Response Times

**Objective**: Verify API meets performance targets

**Steps**:
1. Use browser DevTools → Network tab
2. Measure response times for:
   - GET /api/pfa/:orgId
   - POST /api/pfa/:orgId/draft
   - POST /api/pfa/:orgId/commit

**Expected Results**:
- [ ] GET merged data: < 200ms
- [ ] POST draft save: < 200ms
- [ ] POST commit: < 500ms
- [ ] All requests: < 1 second
- [ ] No timeout errors

### Performance Test 2: Frontend Load Time

**Objective**: Verify frontend loads quickly

**Steps**:
1. Clear browser cache
2. Hard refresh (Ctrl + Shift + R)
3. Measure time to interactive

**Expected Results**:
- [ ] Initial page load: < 2 seconds
- [ ] Time to interactive: < 3 seconds
- [ ] No blocking resources
- [ ] Smooth animations (60 fps)

### Performance Test 3: Large Dataset Handling

**Objective**: Verify system handles moderate datasets

**Steps**:
1. Query API with no filters (returns all records)
2. Render Timeline with all records
3. Test scrolling and interactions

**Expected Results**:
- [ ] API handles 1000 records without issue
- [ ] Frontend renders without lag
- [ ] Scrolling is smooth
- [ ] Filters apply quickly (< 500ms)

---

## 📋 Security Testing

### Security Test 1: Authentication Required

**Objective**: Verify endpoints require authentication

**Steps**:
1. Try to access API without token:
```bash
curl -X GET "http://localhost:3001/api/pfa/$ORG_ID"
# Should return 401 Unauthorized
```

**Expected Results**:
- [ ] Returns 401 status code
- [ ] Error message: "Unauthorized" or similar
- [ ] No data returned
- [ ] Token validation working

### Security Test 2: Organization Isolation

**Objective**: Verify users can only access their orgs

**Steps**:
1. Login as user with access to only "RIO"
2. Try to access different org's data:
```bash
curl -X GET "http://localhost:3001/api/pfa/WRONG_ORG_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Results**:
- [ ] Returns 403 Forbidden or empty results
- [ ] No data leakage between organizations
- [ ] Error message clear

### Security Test 3: SQL Injection Prevention

**Objective**: Verify Prisma prevents SQL injection

**Steps**:
1. Try malicious input in filter:
```bash
curl -X GET "http://localhost:3001/api/pfa/$ORG_ID?category='; DROP TABLE pfas; --" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Results**:
- [ ] Request handled safely
- [ ] No SQL injection occurs
- [ ] Database tables intact
- [ ] Error handled gracefully

---

## 📋 Browser Compatibility Testing

### Test on Multiple Browsers

**Chrome**:
- [ ] Login works
- [ ] Data loads correctly
- [ ] Drag-and-drop works
- [ ] No console errors

**Firefox**:
- [ ] Login works
- [ ] Data loads correctly
- [ ] Drag-and-drop works
- [ ] No console errors

**Edge**:
- [ ] Login works
- [ ] Data loads correctly
- [ ] Drag-and-drop works
- [ ] No console errors

**Safari** (if available):
- [ ] Login works
- [ ] Data loads correctly
- [ ] Drag-and-drop works
- [ ] No console errors

---

## 📋 Regression Testing

### Test Previous Features Still Work

**Timeline View**:
- [ ] Drag-and-drop still functional
- [ ] Zoom in/out works
- [ ] Multi-select works
- [ ] Context menu works

**Grid View**:
- [ ] Sorting works
- [ ] Column resizing works
- [ ] Selection works
- [ ] Export works

**Matrix View**:
- [ ] Month-by-month breakdown displays
- [ ] Grouping works
- [ ] Cost calculations correct

**Admin Dashboard**:
- [ ] User management works
- [ ] API configuration works
- [ ] Sync logs visible

---

## 🐛 Known Issues to Verify

### Expected Warnings (Not Errors)

**Backend Console**:
- [ ] `[WARN]: [PemsSyncWorker] No PEMS Read API configured for <ORG>` - Expected (orgs need credentials)

**Frontend Console**:
- [ ] Hot module reload warnings - Normal in development

### Issues to Document

If you encounter any of these, document them:
- [ ] Slow performance (> targets)
- [ ] Errors in console
- [ ] UI glitches
- [ ] Data not persisting
- [ ] Sync failures

---

## 📊 Test Results Summary

### Overall Results

**Completion Status**:
- Phase 1 Tests: ___/10 passed
- Phase 2 Tests: ___/9 passed
- Phase 3 Tests: ___/15 passed
- Phase 4 Tests: ___/30 passed
- Integration Tests: ___/3 passed
- Performance Tests: ___/3 passed
- Security Tests: ___/3 passed
- Browser Tests: ___/4 browsers
- Regression Tests: ___/12 passed

**Total Score**: ___/89 tests passed

### Critical Issues Found
(List any blocking issues that prevent system use)

1.
2.
3.

### High Priority Issues Found
(List issues that significantly impact UX but don't block use)

1.
2.
3.

### Medium Priority Issues Found
(List minor issues or enhancements)

1.
2.
3.

### Notes
(Any additional observations or recommendations)

---

## 🚀 Post-Testing Actions

### If All Tests Pass ✅
1. Update README.md with current features
2. Create deployment checklist
3. Plan Phase 5 (AI Integration) start date
4. Document any minor issues for future fix

### If Critical Issues Found ❌
1. Document issues in GitHub Issues or ticket system
2. Prioritize fixes
3. Re-test after fixes
4. Update implementation documentation

---

**Testing Date**: _____________
**Tested By**: _____________
**Environment**: Development (localhost)
**Browser**: _____________
**OS**: _____________

*Document created: 2025-11-25*
*Last updated: 2025-11-25*
