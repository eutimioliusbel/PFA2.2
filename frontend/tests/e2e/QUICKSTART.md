# E2E Tests - Quick Start Guide

Get up and running with E2E tests in 5 minutes.

---

## 1. Install Dependencies

```bash
# Install Playwright (if not already installed)
npm install

# Install Playwright browsers
npx playwright install
```

---

## 2. Seed Test Database

```bash
# Navigate to backend and run seed script
cd backend
npx tsx ../tests/e2e/fixtures/seed.ts
```

**Expected Output**:

```
🌱 Seeding E2E test database...

🧹 Cleaning up existing test data...
✅ Cleanup complete

🏢 Creating test organizations...
✅ Created: TEST-ORG-1, TEST-ORG-2

👤 Creating test users...
✅ Created: test-admin, test-user, test-user-suspend, test-viewer

🔐 Assigning users to organizations with permissions...
✅ User-organization assignments complete

✅ E2E test database seeding complete!

📋 Test Credentials:
   Admin:  test-admin / Test@Admin123!
   User:   test-user / Test@User123!
   Viewer: test-viewer / Test@Viewer123!
```

---

## 3. Start Development Servers

### Terminal 1: Backend

```bash
cd backend
npm run dev:no-seed
```

### Terminal 2: Frontend

```bash
npm run dev
```

**Wait for**:
- Backend: `Server listening on port 3001`
- Frontend: `Local: http://localhost:3000`

---

## 4. Run Tests

### Option A: Run All Tests (Headless)

```bash
npx playwright test
```

### Option B: Run with UI Mode (Recommended for First Time)

```bash
npx playwright test --ui
```

### Option C: Run Specific Suite

```bash
# Permission grant tests
npx playwright test tests/e2e/permissionGrant.e2e.test.ts

# Performance tests
npx playwright test tests/e2e/performance.e2e.test.ts
```

---

## 5. View Results

```bash
# Open HTML report
npx playwright show-report
```

**Report includes**:
- Test results (pass/fail)
- Screenshots on failure
- Video recordings (if enabled)
- Performance metrics
- Error traces

---

## Common Commands

```bash
# Run tests in headed mode (see browser)
npx playwright test --headed

# Debug specific test
npx playwright test --debug tests/e2e/permissionGrant.e2e.test.ts

# Run tests matching pattern
npx playwright test --grep "permission"

# Update visual regression baselines
npx playwright test visualRegression.e2e.test.ts --update-snapshots
```

---

## Troubleshooting

### Error: "Element not found"

**Fix**: Ensure both servers are running (backend on 3001, frontend on 3000)

### Error: "User not found"

**Fix**: Re-seed test database:

```bash
cd backend
npx tsx ../tests/e2e/fixtures/seed.ts
```

### Tests timeout

**Fix**: Increase timeout in `playwright.config.ts`:

```typescript
timeout: 60 * 1000, // 60 seconds
```

---

## Test Users

| Username | Password | Role | Use For |
|----------|----------|------|---------|
| `test-admin` | `Test@Admin123!` | admin | Permission management tests |
| `test-user` | `Test@User123!` | user | Permission grant/revoke target |
| `test-viewer` | `Test@Viewer123!` | viewer | Read-only access tests |
| `test-user-suspend` | `Test@UserSuspend123!` | user | Suspension tests |

---

## Next Steps

1. ✅ Tests running successfully?
2. ✅ Check `tests/e2e/README.md` for detailed documentation
3. ✅ Add more tests as needed
4. ✅ Integrate into CI/CD pipeline

---

**Need Help?** See [README.md](./README.md) or [Troubleshooting](./README.md#troubleshooting)
