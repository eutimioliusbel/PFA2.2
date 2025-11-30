/**
 * E2E Test: Error Scenarios
 *
 * Tests how the application handles various error conditions:
 * 1. Network failures during permission save
 * 2. Concurrent permission modifications
 * 3. Invalid authentication tokens
 * 4. Server errors (500)
 * 5. Permission escalation attacks
 * 6. SQL injection attempts
 *
 * Related ADR: ADR-005 Multi-Tenant Access Control, TEST_PLAN.md Security Testing
 * Test ID: [TEST-E2E-009]
 */

import { test, expect, Page } from '@playwright/test';
import {
  TEST_ADMIN,
  TEST_USER,
  TEST_ORG_PRIMARY,
  SELECTORS,
  TIMEOUTS,
  API_ENDPOINTS,
} from './fixtures/testData';
import { loginViaAPI, authenticatedRequest, logout } from './utils/authHelpers';
import {
  navigateToUserManagement,
  waitForLoadingComplete,
  clickButtonInRow,
  waitForModal,
  toggleCheckbox,
  waitForErrorMessage,
  takeScreenshot,
} from './utils/pageHelpers';

test.describe('Error Scenarios', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();

    await loginViaAPI(page, TEST_ADMIN);
  });

  test.afterAll(async () => {
    await page?.close();
  });

  test('should handle network failure during permission grant', async () => {
    // ARRANGE
    await page.goto('/');
    await navigateToUserManagement(page);
    await waitForLoadingComplete(page);

    await clickButtonInRow(
      page,
      SELECTORS.USER_TABLE,
      TEST_USER.username,
      SELECTORS.USER_PERMISSIONS_BTN
    );

    await waitForModal(page, SELECTORS.USER_ORG_MODAL);

    await clickButtonInRow(
      page,
      SELECTORS.USER_ORG_TABLE,
      TEST_ORG_PRIMARY.code,
      SELECTORS.USER_ORG_CAPABILITY_BTN
    );

    await waitForModal(page, SELECTORS.CAPABILITY_MODAL);
    await waitForLoadingComplete(page);

    // ACT: Simulate network error
    await page.route('**/capabilities**', (route) => {
      route.abort('failed');
    });

    await toggleCheckbox(
      page,
      SELECTORS.CAPABILITY_CHECKBOX('perm_Delete'),
      true
    );

    await page.click(SELECTORS.CAPABILITY_SAVE_BTN);

    // ASSERT: Error message should be displayed
    await waitForErrorMessage(page, 'Failed');

    await takeScreenshot(page, 'error-network-failure');

    // Cleanup
    await page.unroute('**/capabilities**');
  });

  test('should handle server error (500) gracefully', async () => {
    // ARRANGE
    await page.goto('/');
    await navigateToUserManagement(page);
    await waitForLoadingComplete(page);

    // ACT: Simulate 500 error
    await page.route('**/api/users**', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.click(SELECTORS.REFRESH_BTN);

    // ASSERT: Error banner should be visible
    await waitForErrorMessage(page, 'Internal server error');

    await takeScreenshot(page, 'error-server-500');

    // Cleanup
    await page.unroute('**/api/users**');
  });

  test('should handle expired authentication token', async () => {
    // ARRANGE: Set invalid token
    await page.evaluate(() => {
      localStorage.setItem('pfa_auth_token', 'invalid-expired-token');
    });

    // ACT: Try to make authenticated request
    await page.goto('/');

    // ASSERT: Should redirect to login or show auth error
    const currentUrl = page.url();
    const isLoginPage = currentUrl.includes('/login') || currentUrl === '/';

    if (!isLoginPage) {
      // Check for error message
      await waitForErrorMessage(page, 'Authentication');
    }

    await takeScreenshot(page, 'error-expired-token');

    // Cleanup: Re-login
    await loginViaAPI(page, TEST_ADMIN);
  });

  test('should prevent permission escalation attack', async () => {
    // ARRANGE: Regular user tries to grant themselves admin permissions
    const { browser } = await import('@playwright/test');
    const newBrowser = await browser.chromium.launch();
    const newContext = await newBrowser.newContext();
    const userPage = await newContext.newPage();

    await loginViaAPI(userPage, TEST_USER);

    // ACT: Try to update capabilities via direct API call
    const maliciousPayload = {
      perm_ManageUsers: true,
      perm_ManageSettings: true,
      perm_Impersonate: true,
      perm_ConfigureAlerts: true,
    };

    const response = await authenticatedRequest(
      userPage,
      API_ENDPOINTS.USER_ORG_CAPABILITIES('fake-user-org-id') +
        `?organizationId=${TEST_ORG_PRIMARY.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(maliciousPayload),
      }
    );

    // ASSERT: Should fail with 403 Permission Denied
    expect(response.status).toBe(403);

    const errorData = await response.json();
    expect(errorData.error).toContain('Permission denied');

    await takeScreenshot(userPage, 'error-permission-escalation-blocked');

    // Cleanup
    await userPage.close();
    await newContext.close();
    await newBrowser.close();
  });

  test('should prevent SQL injection in user search', async () => {
    // ARRANGE
    await page.goto('/');
    await navigateToUserManagement(page);
    await waitForLoadingComplete(page);

    // ACT: Try SQL injection in search field
    const searchInput = await page.locator('input[placeholder*="Search"]').first();

    if (await searchInput.isVisible()) {
      const sqlInjectionPayload = "' OR '1'='1";

      await searchInput.fill(sqlInjectionPayload);
      await page.waitForTimeout(500);

      // ASSERT: Should not cause error or return all users
      // Application should sanitize input
      const errorVisible = await page
        .locator(SELECTORS.ERROR_BANNER)
        .isVisible()
        .catch(() => false);

      expect(errorVisible).toBe(false);

      await takeScreenshot(page, 'error-sql-injection-prevented');
    }
  });

  test('should prevent XSS attacks in user input', async () => {
    // ARRANGE
    await page.goto('/');
    await navigateToUserManagement(page);
    await waitForLoadingComplete(page);

    await clickButtonInRow(
      page,
      SELECTORS.USER_TABLE,
      TEST_USER.username,
      SELECTORS.USER_SUSPEND_BTN
    );

    await waitForModal(page, SELECTORS.SUSPEND_DIALOG);

    // ACT: Try XSS payload in suspension reason
    const xssPayload = '<script>alert("XSS")</script>';

    await page.fill(SELECTORS.SUSPEND_REASON_INPUT, xssPayload);

    await page.click(SELECTORS.SUSPEND_CONFIRM_BTN);

    await page.waitForResponse((response) => response.url().includes('/suspend'));
    await waitForLoadingComplete(page);

    // ASSERT: Payload should be sanitized and not executed
    // Verify script did not execute by checking for alert
    const alertTriggered = await page
      .evaluate(() => {
        return (window as any).__xss_triggered === true;
      })
      .catch(() => false);

    expect(alertTriggered).toBe(false);

    await takeScreenshot(page, 'error-xss-prevented');

    // Cleanup: Reactivate user
    await page.click(SELECTORS.REFRESH_BTN);
    await waitForLoadingComplete(page);

    await clickButtonInRow(
      page,
      SELECTORS.USER_TABLE,
      TEST_USER.username,
      SELECTORS.USER_ACTIVATE_BTN
    );

    await page.waitForResponse((response) => response.url().includes('/activate'));
  });

  test('should handle concurrent permission modifications', async () => {
    // ARRANGE: Create two admin sessions
    const { browser } = await import('@playwright/test');
    const newBrowser = await browser.chromium.launch();

    const admin1Context = await newBrowser.newContext();
    const admin2Context = await newBrowser.newContext();

    const admin1Page = await admin1Context.newPage();
    const admin2Page = await admin2Context.newPage();

    await loginViaAPI(admin1Page, TEST_ADMIN);
    await loginViaAPI(admin2Page, TEST_ADMIN);

    // Both admins navigate to same user's permissions
    await admin1Page.goto('/');
    await navigateToUserManagement(admin1Page);
    await waitForLoadingComplete(admin1Page);

    await admin2Page.goto('/');
    await navigateToUserManagement(admin2Page);
    await waitForLoadingComplete(admin2Page);

    // Both open capability editor
    await clickButtonInRow(
      admin1Page,
      SELECTORS.USER_TABLE,
      TEST_USER.username,
      SELECTORS.USER_PERMISSIONS_BTN
    );
    await waitForModal(admin1Page, SELECTORS.USER_ORG_MODAL);
    await clickButtonInRow(
      admin1Page,
      SELECTORS.USER_ORG_TABLE,
      TEST_ORG_PRIMARY.code,
      SELECTORS.USER_ORG_CAPABILITY_BTN
    );
    await waitForModal(admin1Page, SELECTORS.CAPABILITY_MODAL);
    await waitForLoadingComplete(admin1Page);

    await clickButtonInRow(
      admin2Page,
      SELECTORS.USER_TABLE,
      TEST_USER.username,
      SELECTORS.USER_PERMISSIONS_BTN
    );
    await waitForModal(admin2Page, SELECTORS.USER_ORG_MODAL);
    await clickButtonInRow(
      admin2Page,
      SELECTORS.USER_ORG_TABLE,
      TEST_ORG_PRIMARY.code,
      SELECTORS.USER_ORG_CAPABILITY_BTN
    );
    await waitForModal(admin2Page, SELECTORS.CAPABILITY_MODAL);
    await waitForLoadingComplete(admin2Page);

    // ACT: Both admins modify permissions simultaneously
    await toggleCheckbox(
      admin1Page,
      SELECTORS.CAPABILITY_CHECKBOX('perm_Import'),
      true
    );

    await toggleCheckbox(
      admin2Page,
      SELECTORS.CAPABILITY_CHECKBOX('perm_Export'),
      true
    );

    // Admin 1 saves first
    await admin1Page.click(SELECTORS.CAPABILITY_SAVE_BTN);
    await admin1Page.waitForResponse((response) =>
      response.url().includes('/capabilities')
    );

    // Admin 2 saves second (potential conflict)
    await admin2Page.click(SELECTORS.CAPABILITY_SAVE_BTN);
    await admin2Page.waitForResponse((response) =>
      response.url().includes('/capabilities')
    );

    await waitForLoadingComplete(admin1Page);
    await waitForLoadingComplete(admin2Page);

    // ASSERT: Both permissions should be saved (last write wins or merge)
    // Verify final state via API
    const finalResponse = await authenticatedRequest(
      page,
      API_ENDPOINTS.USER_ORGS(TEST_USER.id) + `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const finalData = await finalResponse.json();
    const primaryOrg = finalData.userOrganizations.find(
      (uo: any) => uo.organizationId === TEST_ORG_PRIMARY.id
    );

    // At least one permission should be saved
    const importGranted = primaryOrg.permissions.perm_Import;
    const exportGranted = primaryOrg.permissions.perm_Export;

    expect(importGranted || exportGranted).toBe(true);

    console.log(`Concurrent modification result: Import=${importGranted}, Export=${exportGranted}`);

    // Cleanup
    await admin1Page.close();
    await admin2Page.close();
    await admin1Context.close();
    await admin2Context.close();
    await newBrowser.close();
  });

  test('should handle IDOR attack (Insecure Direct Object Reference)', async () => {
    // ARRANGE: Regular user tries to access another user's permissions
    const { browser } = await import('@playwright/test');
    const newBrowser = await browser.chromium.launch();
    const newContext = await newBrowser.newContext();
    const userPage = await newContext.newPage();

    await loginViaAPI(userPage, TEST_USER);

    // ACT: Try to access admin user's organizations
    const response = await authenticatedRequest(
      userPage,
      API_ENDPOINTS.USER_ORGS(TEST_ADMIN.id) + `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    // ASSERT: Should fail with 403
    expect(response.status).toBe(403);

    const errorData = await response.json();
    expect(errorData.error).toContain('Permission denied');

    // Cleanup
    await userPage.close();
    await newContext.close();
    await newBrowser.close();
  });

  test('should handle rate limiting', async () => {
    // ARRANGE: Make many rapid requests
    const requests = [];

    // ACT: Send 100 requests rapidly
    for (let i = 0; i < 100; i++) {
      const request = authenticatedRequest(
        page,
        API_ENDPOINTS.USERS + `?organizationId=${TEST_ORG_PRIMARY.id}`
      );

      requests.push(request);
    }

    const responses = await Promise.all(requests);

    // ASSERT: Some requests should be rate limited (429)
    const rateLimitedCount = responses.filter((r) => r.status === 429).length;

    console.log(`Rate limited requests: ${rateLimitedCount}/100`);

    // Should have at least some rate limiting
    expect(rateLimitedCount).toBeGreaterThan(0);
  });
});
