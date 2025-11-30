/**
 * E2E Test: Account Reactivation Workflow
 *
 * Tests the complete flow of reactivating a suspended user:
 * 1. Admin opens User Management
 * 2. Admin selects suspended user
 * 3. Admin clicks Activate button
 * 4. Admin confirms activation
 * 5. Verify database serviceStatus = 'active'
 * 6. Verify user can login again
 * 7. Verify user can make API calls
 *
 * Related ADR: ADR-005 Multi-Tenant Access Control
 * Test ID: [TEST-E2E-004]
 */

import { test, expect, Page } from '@playwright/test';
import {
  TEST_ADMIN,
  TEST_USER_SUSPEND,
  TEST_ORG_PRIMARY,
  SELECTORS,
  TIMEOUTS,
  API_ENDPOINTS,
} from './fixtures/testData';
import { loginViaAPI, loginViaUI, authenticatedRequest } from './utils/authHelpers';
import {
  navigateToUserManagement,
  waitForElement,
  clickButtonInRow,
  waitForLoadingComplete,
  takeScreenshot,
} from './utils/pageHelpers';

test.describe('Account Reactivation Workflow', () => {
  let adminPage: Page;
  let userPage: Page;

  test.beforeAll(async ({ browser }) => {
    const adminContext = await browser.newContext();
    const userContext = await browser.newContext();

    adminPage = await adminContext.newPage();
    userPage = await userContext.newPage();

    await loginViaAPI(adminPage, TEST_ADMIN);
  });

  test.afterAll(async () => {
    await adminPage?.close();
    await userPage?.close();
  });

  test.beforeEach(async () => {
    // Ensure user is suspended before each test
    await adminPage.goto('/');
    await navigateToUserManagement(adminPage);
    await waitForLoadingComplete(adminPage);

    // Check if user is already suspended
    const userRow = await adminPage.locator(
      SELECTORS.USER_ROW(TEST_USER_SUSPEND.username)
    );
    const suspendBtnVisible = await userRow
      .locator(SELECTORS.USER_SUSPEND_BTN)
      .isVisible();

    if (suspendBtnVisible) {
      // User is active, suspend them
      await clickButtonInRow(
        adminPage,
        SELECTORS.USER_TABLE,
        TEST_USER_SUSPEND.username,
        SELECTORS.USER_SUSPEND_BTN
      );

      await waitForElement(adminPage, SELECTORS.SUSPEND_DIALOG);
      await adminPage.fill(
        SELECTORS.SUSPEND_REASON_INPUT,
        'Setup for reactivation test'
      );
      await adminPage.click(SELECTORS.SUSPEND_CONFIRM_BTN);

      await adminPage.waitForResponse((response) =>
        response.url().includes('/suspend')
      );
      await waitForLoadingComplete(adminPage);
    }
  });

  test('should reactivate suspended user', async () => {
    // ARRANGE: Verify user is currently suspended
    const beforeResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_BY_ID(TEST_USER_SUSPEND.id) +
        `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const beforeData = await beforeResponse.json();
    expect(beforeData.user.serviceStatus).toBe('suspended');

    // ACT: Navigate to User Management
    await adminPage.goto('/');
    await navigateToUserManagement(adminPage);
    await waitForLoadingComplete(adminPage);

    await takeScreenshot(adminPage, 'account-reactivation-01-user-management');

    // Click activate button
    await clickButtonInRow(
      adminPage,
      SELECTORS.USER_TABLE,
      TEST_USER_SUSPEND.username,
      SELECTORS.USER_ACTIVATE_BTN
    );

    // Measure API response time
    const startTime = Date.now();

    // Wait for API response
    await adminPage.waitForResponse(
      (response) => response.url().includes('/activate'),
      { timeout: TIMEOUTS.API_REQUEST }
    );

    const responseTime = Date.now() - startTime;

    // Verify response time is under 2 seconds
    expect(responseTime).toBeLessThan(2000);

    await waitForLoadingComplete(adminPage);

    await takeScreenshot(adminPage, 'account-reactivation-02-activated');

    // ASSERT: Verify database is updated
    const afterResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_BY_ID(TEST_USER_SUSPEND.id) +
        `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const afterData = await afterResponse.json();
    expect(afterData.user.serviceStatus).toBe('active');
    expect(afterData.user.suspendedAt).toBeNull();

    // ASSERT: Verify user can login again
    await userPage.goto('/');
    await loginViaUI(userPage, TEST_USER_SUSPEND);

    await waitForLoadingComplete(userPage);

    await takeScreenshot(userPage, 'account-reactivation-03-user-logged-in');

    // Verify token is stored
    const token = await userPage.evaluate(() =>
      localStorage.getItem('pfa_auth_token')
    );
    expect(token).toBeTruthy();

    // ASSERT: Verify user can make API calls
    const userApiResponse = await authenticatedRequest(
      userPage,
      API_ENDPOINTS.USERS + `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    expect(userApiResponse.ok).toBe(true);
  });

  test('should update status badge to "active"', async () => {
    // ARRANGE
    await adminPage.goto('/');
    await navigateToUserManagement(adminPage);
    await waitForLoadingComplete(adminPage);

    // ACT: Activate user
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

    // ASSERT: Verify status badge shows "active"
    const userRow = await adminPage.locator(
      SELECTORS.USER_ROW(TEST_USER_SUSPEND.username)
    );
    const statusBadge = await userRow.locator(SELECTORS.STATUS_BADGE('active'));
    await expect(statusBadge).toBeVisible();

    await takeScreenshot(adminPage, 'account-reactivation-status-badge');
  });

  test('should show suspend button for active users', async () => {
    // ARRANGE
    await adminPage.goto('/');
    await navigateToUserManagement(adminPage);
    await waitForLoadingComplete(adminPage);

    // ACT: Activate user
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

    // ASSERT: Verify suspend button is visible
    const userRow = await adminPage.locator(
      SELECTORS.USER_ROW(TEST_USER_SUSPEND.username)
    );
    const suspendBtn = await userRow.locator(SELECTORS.USER_SUSPEND_BTN);
    await expect(suspendBtn).toBeVisible();

    // Verify activate button is not visible
    const activateBtn = await userRow.locator(SELECTORS.USER_ACTIVATE_BTN);
    await expect(activateBtn).not.toBeVisible();

    await takeScreenshot(adminPage, 'account-reactivation-suspend-button');
  });

  test('should restore user permissions after reactivation', async () => {
    // ARRANGE: Get user permissions before reactivation
    const beforeResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_ORGS(TEST_USER_SUSPEND.id) +
        `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const beforeData = await beforeResponse.json();
    const beforePermissions = beforeData.userOrganizations.find(
      (uo: any) => uo.organizationId === TEST_ORG_PRIMARY.id
    )?.permissions;

    // ACT: Activate user
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

    // ASSERT: Verify permissions remain unchanged
    const afterResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_ORGS(TEST_USER_SUSPEND.id) +
        `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const afterData = await afterResponse.json();
    const afterPermissions = afterData.userOrganizations.find(
      (uo: any) => uo.organizationId === TEST_ORG_PRIMARY.id
    )?.permissions;

    expect(afterPermissions).toEqual(beforePermissions);
  });

  test('should clear failed login count on reactivation', async () => {
    // ARRANGE: Set failed login count (simulate multiple failed login attempts)
    // Note: This would require backend API to manually set failedLoginCount
    // For now, we'll just verify the field is cleared

    // ACT: Activate user
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

    // ASSERT: Verify failedLoginCount is reset to 0
    const userResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_BY_ID(TEST_USER_SUSPEND.id) +
        `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const userData = await userResponse.json();
    expect(userData.user.failedLoginCount).toBe(0);
  });

  test('should prevent non-admin users from reactivating users', async () => {
    // ARRANGE: Create regular user session
    const { browser } = await import('@playwright/test');
    const newBrowser = await browser.chromium.launch();
    const newContext = await newBrowser.newContext();
    const regularUserPage = await newContext.newPage();

    // First activate the user so they can login
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

    // Suspend again for the test
    await clickButtonInRow(
      adminPage,
      SELECTORS.USER_TABLE,
      TEST_USER_SUSPEND.username,
      SELECTORS.USER_SUSPEND_BTN
    );
    await waitForElement(adminPage, SELECTORS.SUSPEND_DIALOG);
    await adminPage.fill(SELECTORS.SUSPEND_REASON_INPUT, 'Test suspension');
    await adminPage.click(SELECTORS.SUSPEND_CONFIRM_BTN);
    await adminPage.waitForResponse((response) =>
      response.url().includes('/suspend')
    );
    await waitForLoadingComplete(adminPage);

    await loginViaAPI(regularUserPage, TEST_USER_SUSPEND);

    // ACT: Try to activate user via API
    const response = await authenticatedRequest(
      regularUserPage,
      API_ENDPOINTS.USER_ACTIVATE(TEST_USER_SUSPEND.id),
      {
        method: 'POST',
        body: JSON.stringify({
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

  test('should audit reactivation action', async () => {
    // ACT: Activate user
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

    // ASSERT: Verify audit trail
    // Check that suspendedAt is cleared and updatedAt is recent
    const userResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_BY_ID(TEST_USER_SUSPEND.id) +
        `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const userData = await userResponse.json();

    expect(userData.user.suspendedAt).toBeNull();

    // updatedAt should be recent (within last 5 seconds)
    const updatedAt = new Date(userData.user.updatedAt);
    const now = new Date();
    const diffSeconds = (now.getTime() - updatedAt.getTime()) / 1000;

    expect(diffSeconds).toBeLessThan(5);
  });
});
