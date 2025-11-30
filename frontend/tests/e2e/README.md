<!-- markdownlint-disable MD024 -->
# E2E Test Suite - ADR-005 Multi-Tenant Access Control

Comprehensive end-to-end tests for permission workflows, user management, and organization access control.

## 📋 Table of Contents

- [Overview](#overview)
- [Test Coverage](#test-coverage)
- [Getting Started](#getting-started)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Test Data](#test-data)
- [Screenshots & Visual Regression](#screenshots--visual-regression)
- [Performance Metrics](#performance-metrics)
- [Troubleshooting](#troubleshooting)
- [CI/CD Integration](#cicd-integration)

---

## Overview

This E2E test suite validates complete user workflows for the PFA Vanguard multi-tenant access control system. Tests verify that frontend UI, backend API, and database remain in sync across all permission operations.

**Test Framework**: Playwright
**Language**: TypeScript
**Test Count**: 60+ tests across 9 test suites
**Coverage**: Permission management, user suspension, organization switching, visual regression, performance, security

---

## Test Coverage

### Test Suites

| Suite | Tests | Coverage | Status |
|-------|-------|----------|--------|
| `permissionGrant.e2e.test.ts` | 5 | Grant permissions to users | ✅ |
| `permissionRevoke.e2e.test.ts` | 6 | Revoke permissions, audit trail | ✅ |
| `userSuspension.e2e.test.ts` | 7 | Suspend users, invalidate sessions | ✅ |
| `accountReactivation.e2e.test.ts` | 7 | Reactivate suspended users | ✅ |
| `orgSwitch.e2e.test.ts` | 8 | Organization context switching | ✅ |
| `multiOrgAccess.e2e.test.ts` | 8 | Multi-org user assignment | ✅ |
| `visualRegression.e2e.test.ts` | 9 | UI layout consistency | ✅ |
| `performance.e2e.test.ts` | 9 | Page load times, API latency | ✅ |
| `errorScenarios.e2e.test.ts` | 9 | Network errors, security attacks | ✅ |

### Critical Workflows Tested

1. **Admin Grants Permission**:
   - Admin opens User Management → Selects user → Opens Permission Modal → Grants `perm_ManageSettings` → Saves
   - Backend updates database → User can now create API servers

2. **User Suspension**:
   - Admin suspends user → User's active session becomes invalid → User sees "Account suspended" error on next API call

3. **Organization Switch**:
   - Multi-org user switches from HOLNG to RIO → UI updates to show RIO data → User can manage RIO's API servers

---

## Getting Started

### Prerequisites

```bash
# Install dependencies (if not already installed)
npm install

# Install Playwright browsers
npx playwright install
```

### Database Setup

```bash
# Seed test database with test users and organizations
cd backend
npx tsx ../tests/e2e/fixtures/seed.ts
```

**Test Users Created**:

| Username | Password | Role | Organizations |
|----------|----------|------|---------------|
| `test-admin` | `Test@Admin123!` | admin | TEST-ORG-1, TEST-ORG-2 |
| `test-user` | `Test@User123!` | user | TEST-ORG-1 |
| `test-viewer` | `Test@Viewer123!` | viewer | TEST-ORG-1, TEST-ORG-2 |
| `test-user-suspend` | `Test@UserSuspend123!` | user | TEST-ORG-1 |

---

## Running Tests

### Run All Tests

```bash
# Run all E2E tests (headless mode)
npx playwright test

# Run with UI mode (interactive)
npx playwright test --ui

# Run in headed mode (see browser)
npx playwright test --headed
```

### Run Specific Test Suite

```bash
# Run permission grant tests
npx playwright test tests/e2e/permissionGrant.e2e.test.ts

# Run performance tests
npx playwright test tests/e2e/performance.e2e.test.ts

# Run visual regression tests
npx playwright test tests/e2e/visualRegression.e2e.test.ts
```

### Run Tests by Tag

```bash
# Run only security-related tests
npx playwright test --grep "attack|injection|XSS|IDOR"

# Run only performance tests
npx playwright test --grep "performance|latency|load time"
```

### Debug Tests

```bash
# Debug specific test
npx playwright test --debug tests/e2e/permissionGrant.e2e.test.ts

# Show browser console logs
npx playwright test --headed --trace on
```

---

## Test Structure

### File Organization

```
tests/
├── e2e/
│   ├── fixtures/
│   │   ├── testData.ts          # Test users, orgs, permissions, selectors
│   │   └── seed.ts              # Database seeding script
│   ├── utils/
│   │   ├── authHelpers.ts       # Login, logout, token management
│   │   └── pageHelpers.ts       # Navigation, interaction helpers
│   ├── permissionGrant.e2e.test.ts
│   ├── permissionRevoke.e2e.test.ts
│   ├── userSuspension.e2e.test.ts
│   ├── accountReactivation.e2e.test.ts
│   ├── orgSwitch.e2e.test.ts
│   ├── multiOrgAccess.e2e.test.ts
│   ├── visualRegression.e2e.test.ts
│   ├── performance.e2e.test.ts
│   ├── errorScenarios.e2e.test.ts
│   └── README.md                # This file
└── test-results/                # Generated test results
```

### Test Pattern

```typescript
import { test, expect, Page } from '@playwright/test';
import { TEST_ADMIN, SELECTORS } from './fixtures/testData';
import { loginViaAPI } from './utils/authHelpers';
import { navigateToUserManagement } from './utils/pageHelpers';

test.describe('Feature Name', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // Setup: Create page and login
    const context = await browser.newContext();
    page = await context.newPage();
    await loginViaAPI(page, TEST_ADMIN);
  });

  test.afterAll(async () => {
    // Cleanup: Close page
    await page?.close();
  });

  test('should perform action', async () => {
    // ARRANGE: Setup test state
    await page.goto('/');
    await navigateToUserManagement(page);

    // ACT: Perform action
    await page.click(SELECTORS.USER_SUSPEND_BTN);

    // ASSERT: Verify outcome
    const response = await authenticatedRequest(page, API_ENDPOINTS.USERS);
    expect(response.ok).toBe(true);
  });
});
```

---

## Test Data

### Test Organizations

```typescript
TEST_ORG_PRIMARY: {
  id: 'test-org-primary-001',
  code: 'TEST-ORG-1',
  name: 'Test Organization Primary'
}

TEST_ORG_SECONDARY: {
  id: 'test-org-secondary-001',
  code: 'TEST-ORG-2',
  name: 'Test Organization Secondary'
}
```

### Permission Sets

```typescript
PERMISSION_SETS.ADMIN: {
  perm_Read: true,
  perm_EditForecast: true,
  perm_ManageUsers: true,
  perm_ManageSettings: true,
  // ... all 14 permissions granted
}

PERMISSION_SETS.VIEWER: {
  perm_Read: true,
  perm_Export: true,
  // ... all other permissions denied
}
```

### Selectors

```typescript
SELECTORS.USER_MANAGEMENT_TAB = 'text=User Management'
SELECTORS.USER_SUSPEND_BTN = 'button[title="Suspend User"]'
SELECTORS.CAPABILITY_CHECKBOX = (perm) => `input[type="checkbox"][name="${perm}"]`
```

---

## Screenshots & Visual Regression

### Baseline Screenshots

Baseline screenshots are stored in `docs/testing/screenshots/`:

- `user-management-table.png`
- `user-org-permissions-modal.png`
- `capability-editor-modal.png`
- `suspend-user-dialog.png`

### Updating Baselines

```bash
# Update all baseline screenshots
npx playwright test --update-snapshots

# Update specific test screenshots
npx playwright test visualRegression.e2e.test.ts --update-snapshots
```

### Visual Diff Threshold

Tests allow up to 100 pixel differences for minor rendering variations:

```typescript
await expect(page).toHaveScreenshot('user-management.png', {
  maxDiffPixels: 100
});
```

---

## Performance Metrics

### Target Performance

| Operation | Target | Test |
|-----------|--------|------|
| Page Load | < 2 seconds | `performance.e2e.test.ts` |
| Permission Grant | < 2 seconds | `performance.e2e.test.ts` |
| User Suspension | < 2 seconds | `performance.e2e.test.ts` |
| Organization Switch | < 3 seconds | `performance.e2e.test.ts` |
| API Response (P95) | < 2 seconds | `performance.e2e.test.ts` |

### Measuring Performance

```bash
# Run performance tests and view results
npx playwright test performance.e2e.test.ts --reporter=html
```

Performance metrics are logged to console:

```
User Management page load time: 1523ms ✓
Permission grant time: 1342ms ✓
API Latency - P50: 234ms, P95: 1821ms, P99: 2456ms ✓
```

---

## Troubleshooting

### Tests Failing with "Element not found"

**Cause**: UI elements have different selectors than expected

**Fix**: Update selectors in `fixtures/testData.ts`:

```typescript
export const SELECTORS = {
  USER_SUSPEND_BTN: 'button[title="Suspend User"]', // Update this
};
```

### Database Seeding Fails

**Cause**: Test data conflicts with existing data

**Fix**: Clear test data before seeding:

```bash
cd backend
npx tsx ../tests/e2e/fixtures/seed.ts
```

The seed script automatically cleans up existing test data.

### Tests Timeout

**Cause**: Network latency or slow API responses

**Fix**: Increase timeout in `playwright.config.ts`:

```typescript
export default defineConfig({
  timeout: 60 * 1000, // Increase to 60 seconds
});
```

### Visual Regression Tests Fail

**Cause**: UI layout changes or different rendering

**Fix**: Review diff in test results and update baseline:

```bash
# View HTML report
npx playwright show-report

# If changes are intentional, update baseline
npx playwright test visualRegression.e2e.test.ts --update-snapshots
```

### Authentication Errors

**Cause**: Expired tokens or incorrect credentials

**Fix**: Verify test users exist in database:

```bash
cd backend
npx tsx ../tests/e2e/fixtures/seed.ts
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Seed test database
        run: cd backend && npx tsx ../tests/e2e/fixtures/seed.ts

      - name: Run E2E tests
        run: npx playwright test

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: test-results/
```

### Running in Docker

```dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Seed database
RUN cd backend && npx tsx ../tests/e2e/fixtures/seed.ts

# Run tests
CMD ["npx", "playwright", "test"]
```

---

## Test IDs & TESTING_LOG.md

Each test suite is assigned a test ID for tracking in `TESTING_LOG.md`:

| Test ID | Suite | Description |
|---------|-------|-------------|
| [TEST-E2E-001] | permissionGrant | Grant permissions workflow |
| [TEST-E2E-002] | permissionRevoke | Revoke permissions workflow |
| [TEST-E2E-003] | userSuspension | User suspension workflow |
| [TEST-E2E-004] | accountReactivation | Account reactivation workflow |
| [TEST-E2E-005] | orgSwitch | Organization switch workflow |
| [TEST-E2E-006] | multiOrgAccess | Multi-org access workflow |
| [TEST-E2E-007] | visualRegression | Visual regression testing |
| [TEST-E2E-008] | performance | Performance testing |
| [TEST-E2E-009] | errorScenarios | Error handling and security |

---

## Best Practices

### DO

- ✅ Run tests against test database (never production)
- ✅ Use `loginViaAPI()` instead of UI login for speed
- ✅ Clean up test data after each test
- ✅ Use descriptive test names
- ✅ Capture screenshots for debugging
- ✅ Measure performance metrics
- ✅ Test error scenarios

### DON'T

- ❌ Run tests in parallel (causes race conditions)
- ❌ Use production user credentials
- ❌ Commit test database state
- ❌ Skip authentication tests
- ❌ Ignore performance degradation
- ❌ Use `test.only()` in committed code

---

## Contributing

When adding new tests:

1. Create test file in `tests/e2e/`
2. Follow AAA pattern (Arrange, Act, Assert)
3. Add test data to `fixtures/testData.ts`
4. Update this README with new test coverage
5. Add test ID to TESTING_LOG.md
6. Include screenshots for visual tests

---

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [ADR-005 Multi-Tenant Access Control](../../docs/adrs/ADR-005-multi-tenant-access-control/)
- [TEST_PLAN.md](../../docs/ADRs/ADR-005-multi-tenant-access-control/ADR-005-TEST_PLAN.md)
- [CLAUDE.md - Testing Section](../../CLAUDE.md#temporal-files-scripts--test-organization)

---

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review test logs in `test-results/`
3. Check Playwright HTML report: `npx playwright show-report`
4. Contact development team

---

**Last Updated**: 2025-11-27
**Maintainer**: PFA Vanguard Test Team
**Status**: ✅ Production Ready
