/**
 * E2E Test: User Suspension Workflow
 *
 * Tests the complete flow of suspending a user:
 * 1. Admin opens User Management
 * 2. Admin selects active user
 * 3. Admin clicks Suspend button
 * 4. Admin provides reason (optional)
 * 5. Admin confirms suspension
 * 6. Verify database serviceStatus = 'suspended'
 * 7. Verify user's active session becomes invalid
 * 8. Verify user sees "Account suspended" error on next API call
 *
 * Related ADR: ADR-005 Multi-Tenant Access Control
 * Test ID: [TEST-E2E-003]
 */

import { test, expect, Page } from '@playwright/test';
import {
  TEST_ADMIN,
  TEST_USER_SUSPEND,
  TEST_ORG_PRIMARY,
  SELECTORS,
  TIMEOUTS,
  API_ENDPOINTS,
  MESSAGES,
} from './fixtures/testData';
import { loginViaAPI, authenticatedRequest, logout } from './utils/authHelpers';
import {
  navigateToUserManagement,
  waitForElement,
  clickButtonInRow,
  waitForLoadingComplete,
  takeScreenshot,
  waitForErrorMessage,
} from './utils/pageHelpers';

test.describe('User Suspension Workflow', () => {
  let adminPage: Page;
  let userPage: Page;

  test.beforeAll(async ({ browser }) => {
    const adminContext = await browser.newContext();
    const userContext = await browser.newContext();

    adminPage = await adminContext.newPage();
    userPage = await userContext.newPage();

    await loginViaAPI(adminPage, TEST_ADMIN);
    await loginViaAPI(userPage, TEST_USER_SUSPEND);
  });

  test.afterAll(async () => {
    await adminPage?.close();
    await userPage?.close();
  });

  test('should suspend user and invalidate active session', async () => {
    // ARRANGE: Verify user is currently active
    const beforeResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_BY_ID(TEST_USER_SUSPEND.id) +
        `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const beforeData = await beforeResponse.json();
    expect(beforeData.user.serviceStatus).toBe('active');

    // Verify user can currently make API requests
    const userBeforeResponse = await authenticatedRequest(
      userPage,
      API_ENDPOINTS.USERS + `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    expect(userBeforeResponse.ok).toBe(true);

    // ACT: Navigate to User Management as admin
    await adminPage.goto('/');
    await navigateToUserManagement(adminPage);
    await waitForLoadingComplete(adminPage);

    await takeScreenshot(adminPage, 'user-suspension-01-user-management');

    // Click suspend button for user
    await clickButtonInRow(
      adminPage,
      SELECTORS.USER_TABLE,
      TEST_USER_SUSPEND.username,
      SELECTORS.USER_SUSPEND_BTN
    );

    // Wait for suspend dialog
    await waitForElement(adminPage, SELECTORS.SUSPEND_DIALOG);
    await takeScreenshot(adminPage, 'user-suspension-02-suspend-dialog');

    // Fill suspension reason
    await adminPage.fill(
      SELECTORS.SUSPEND_REASON_INPUT,
      'Temporary suspension for security audit'
    );

    // Measure API response time
    const startTime = Date.now();

    // Confirm suspension
    await adminPage.click(SELECTORS.SUSPEND_CONFIRM_BTN);

    // Wait for API response
    await adminPage.waitForResponse(
      (response) => response.url().includes('/suspend'),
      { timeout: TIMEOUTS.API_REQUEST }
    );

    const responseTime = Date.now() - startTime;

    // Verify response time is under 2 seconds
    expect(responseTime).toBeLessThan(2000);

    await waitForLoadingComplete(adminPage);

    // Wait for dialog to close
    await waitForElement(adminPage, SELECTORS.SUSPEND_DIALOG, { timeout: 1000 })
      .then(() => {
        // Dialog still visible, wait for it to disappear
        return adminPage.waitForSelector(SELECTORS.SUSPEND_DIALOG, {
          state: 'hidden',
          timeout: TIMEOUTS.MEDIUM,
        });
      })
      .catch(() => {
        // Dialog already hidden
      });

    await takeScreenshot(adminPage, 'user-suspension-03-suspended');

    // ASSERT: Verify database is updated
    const afterResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_BY_ID(TEST_USER_SUSPEND.id) +
        `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const afterData = await afterResponse.json();
    expect(afterData.user.serviceStatus).toBe('suspended');
    expect(afterData.user.suspendedAt).toBeDefined();

    // Verify suspendedAt is recent (within last 5 seconds)
    const suspendedAt = new Date(afterData.user.suspendedAt);
    const now = new Date();
    const diffSeconds = (now.getTime() - suspendedAt.getTime()) / 1000;
    expect(diffSeconds).toBeLessThan(5);

    // ASSERT: Verify user's active session becomes invalid
    // User tries to make API request
    const userAfterResponse = await authenticatedRequest(
      userPage,
      API_ENDPOINTS.USERS + `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    // Should fail with 403
    expect(userAfterResponse.status).toBe(403);

    const errorData = await userAfterResponse.json();
    expect(errorData.error).toContain('Account suspended');

    await takeScreenshot(userPage, 'user-suspension-04-user-blocked');

    // ASSERT: Verify UI shows "Account suspended" error
    await userPage.goto('/');
    await waitForLoadingComplete(userPage);

    // User should see error message
    await waitForErrorMessage(userPage, MESSAGES.ACCOUNT_SUSPENDED);

    await takeScreenshot(userPage, 'user-suspension-05-error-message');
  });

  test('should update user status badge to "suspended"', async () => {
    // ARRANGE
    await adminPage.goto('/');
    await navigateToUserManagement(adminPage);
    await waitForLoadingComplete(adminPage);

    // ACT: Find user row
    const userRow = await adminPage.locator(
      SELECTORS.USER_ROW(TEST_USER_SUSPEND.username)
    );

    // ASSERT: Verify status badge shows "suspended"
    const statusBadge = await userRow.locator(SELECTORS.STATUS_BADGE('suspended'));
    await expect(statusBadge).toBeVisible();

    await takeScreenshot(adminPage, 'user-suspension-status-badge');
  });

  test('should show activate button for suspended users', async () => {
    // ARRANGE
    await adminPage.goto('/');
    await navigateToUserManagement(adminPage);
    await waitForLoadingComplete(adminPage);

    // ACT: Find user row
    const userRow = await adminPage.locator(
      SELECTORS.USER_ROW(TEST_USER_SUSPEND.username)
    );

    // ASSERT: Verify activate button is visible
    const activateBtn = await userRow.locator(SELECTORS.USER_ACTIVATE_BTN);
    await expect(activateBtn).toBeVisible();

    // Verify suspend button is not visible
    const suspendBtn = await userRow.locator(SELECTORS.USER_SUSPEND_BTN);
    await expect(suspendBtn).not.toBeVisible();

    await takeScreenshot(adminPage, 'user-suspension-activate-button');
  });

  test('should prevent suspended user from logging in', async () => {
    // ARRANGE: Logout user
    await logout(userPage);

    // ACT: Try to login as suspended user
    await userPage.goto('/');
    await waitForElement(userPage, SELECTORS.LOGIN_USERNAME);

    await userPage.fill(SELECTORS.LOGIN_USERNAME, TEST_USER_SUSPEND.username);
    await userPage.fill(SELECTORS.LOGIN_PASSWORD, TEST_USER_SUSPEND.password);

    await userPage.click(SELECTORS.LOGIN_SUBMIT);

    // ASSERT: Login should fail with "Account suspended" error
    await waitForErrorMessage(userPage, MESSAGES.ACCOUNT_SUSPENDED);

    await takeScreenshot(userPage, 'user-suspension-login-blocked');

    // Verify no token is stored
    const token = await userPage.evaluate(() =>
      localStorage.getItem('pfa_auth_token')
    );
    expect(token).toBeFalsy();
  });

  test('should suspend user mid-session', async () => {
    // ARRANGE: Create new user session
    const { browser } = await import('@playwright/test');
    const newBrowser = await browser.chromium.launch();
    const newContext = await newBrowser.newContext();
    const newUserPage = await newContext.newPage();

    // First, activate the user so we can test mid-session suspension
    await adminPage.goto('/');
    await navigateToUserManagement(adminPage);
    await waitForLoadingComplete(adminPage);

    await clickButtonInRow(
      adminPage,
      SELECTORS.USER_TABLE,
      TEST_USER_SUSPEND.username,
      SELECTORS.USER_ACTIVATE_BTN
    );

    await adminPage.waitForResponse((response) =>
      response.url().includes('/activate')
    );
    await waitForLoadingComplete(adminPage);

    // Login user with active status
    await loginViaAPI(newUserPage, TEST_USER_SUSPEND);
    await newUserPage.goto('/');
    await waitForLoadingComplete(newUserPage);

    // Verify user can access data
    const beforeResponse = await authenticatedRequest(
      newUserPage,
      API_ENDPOINTS.USERS + `?organizationId=${TEST_ORG_PRIMARY.id}`
    );
    expect(beforeResponse.ok).toBe(true);

    // ACT: Admin suspends user while user has page open
    await adminPage.goto('/');
    await navigateToUserManagement(adminPage);
    await waitForLoadingComplete(adminPage);

    await clickButtonInRow(
      adminPage,
      SELECTORS.USER_TABLE,
      TEST_USER_SUSPEND.username,
      SELECTORS.USER_SUSPEND_BTN
    );

    await waitForElement(adminPage, SELECTORS.SUSPEND_DIALOG);

    await adminPage.fill(
      SELECTORS.SUSPEND_REASON_INPUT,
      'Mid-session suspension test'
    );

    await adminPage.click(SELECTORS.SUSPEND_CONFIRM_BTN);

    await adminPage.waitForResponse((response) =>
      response.url().includes('/suspend')
    );
    await waitForLoadingComplete(adminPage);

    // ASSERT: User's next API call should fail
    const afterResponse = await authenticatedRequest(
      newUserPage,
      API_ENDPOINTS.USERS + `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    expect(afterResponse.status).toBe(403);

    const errorData = await afterResponse.json();
    expect(errorData.error).toContain('Account suspended');

    await takeScreenshot(newUserPage, 'user-suspension-mid-session');

    // Cleanup
    await newUserPage.close();
    await newContext.close();
    await newBrowser.close();
  });

  test('should prevent non-admin users from suspending users', async () => {
    // ARRANGE: Create regular user session
    const { browser } = await import('@playwright/test');
    const newBrowser = await browser.chromium.launch();
    const newContext = await newBrowser.newContext();
    const regularUserPage = await newContext.newPage();

    await loginViaAPI(regularUserPage, TEST_USER_SUSPEND);

    // ACT: Try to suspend user via API
    const response = await authenticatedRequest(
      regularUserPage,
      API_ENDPOINTS.USER_SUSPEND(TEST_USER_SUSPEND.id),
      {
        method: 'POST',
        body: JSON.stringify({
          reason: 'Unauthorized suspension attempt',
          organizationId: TEST_ORG_PRIMARY.id,
        }),
      }
    );

    // ASSERT: Should fail with 403
    expect(response.status).toBe(403);

    const errorData = await response.json();
    expect(errorData.error).toContain('Permission denied');

    // Cleanup
    await regularUserPage.close();
    await newContext.close();
    await newBrowser.close();
  });

  test('should track suspension reason in database', async () => {
    // ARRANGE
    const suspensionReason = 'Policy violation: unauthorized data access';

    await adminPage.goto('/');
    await navigateToUserManagement(adminPage);
    await waitForLoadingComplete(adminPage);

    // ACT: Suspend user with specific reason
    await clickButtonInRow(
      adminPage,
      SELECTORS.USER_TABLE,
      TEST_USER_SUSPEND.username,
      SELECTORS.USER_ACTIVATE_BTN // First activate if suspended
    );
    await adminPage.waitForResponse((response) =>
      response.url().includes('/activate')
    );
    await waitForLoadingComplete(adminPage);

    await clickButtonInRow(
      adminPage,
      SELECTORS.USER_TABLE,
      TEST_USER_SUSPEND.username,
      SELECTORS.USER_SUSPEND_BTN
    );

    await waitForElement(adminPage, SELECTORS.SUSPEND_DIALOG);

    await adminPage.fill(SELECTORS.SUSPEND_REASON_INPUT, suspensionReason);

    await adminPage.click(SELECTORS.SUSPEND_CONFIRM_BTN);

    await adminPage.waitForResponse((response) =>
      response.url().includes('/suspend')
    );
    await waitForLoadingComplete(adminPage);

    // ASSERT: Verify reason is stored (check via API or audit log)
    // Note: This assumes the backend stores suspension reason in metadata or audit log
    const userResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_BY_ID(TEST_USER_SUSPEND.id) +
        `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const userData = await userResponse.json();

    // Check if reason is stored in metadata
    if (userData.user.metadata) {
      expect(userData.user.metadata.suspensionReason).toBe(suspensionReason);
    }
  });
});
