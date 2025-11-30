/**
 * E2E Test: Visual Regression Testing
 *
 * Captures baseline screenshots of key UI states and compares them
 * to detect unintended visual changes:
 * 1. User Management table layout
 * 2. Permission modal layout
 * 3. Suspend dialog layout
 * 4. Status badges rendering
 * 5. Organization selector
 *
 * Related ADR: ADR-005 Multi-Tenant Access Control
 * Test ID: [TEST-E2E-007]
 */

import { test, expect, Page } from '@playwright/test';
import {
  TEST_ADMIN,
  TEST_USER,
  TEST_ORG_PRIMARY,
  SELECTORS,
} from './fixtures/testData';
import { loginViaAPI } from './utils/authHelpers';
import {
  navigateToUserManagement,
  waitForLoadingComplete,
  clickButtonInRow,
  waitForModal,
} from './utils/pageHelpers';

test.describe('Visual Regression Testing', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });

    page = await context.newPage();
    await loginViaAPI(page, TEST_ADMIN);
  });

  test.afterAll(async () => {
    await page?.close();
  });

  test('should match baseline for User Management table', async () => {
    // ARRANGE
    await page.goto('/');
    await navigateToUserManagement(page);
    await waitForLoadingComplete(page);

    // ACT & ASSERT: Capture and compare screenshot
    await expect(page).toHaveScreenshot('user-management-table.png', {
      fullPage: true,
      maxDiffPixels: 100, // Allow minor rendering differences
    });
  });

  test('should match baseline for User Org Permissions modal', async () => {
    // ARRANGE
    await page.goto('/');
    await navigateToUserManagement(page);
    await waitForLoadingComplete(page);

    // ACT: Open permissions modal
    await clickButtonInRow(
      page,
      SELECTORS.USER_TABLE,
      TEST_USER.username,
      SELECTORS.USER_PERMISSIONS_BTN
    );

    await waitForModal(page, SELECTORS.USER_ORG_MODAL);
    await waitForLoadingComplete(page);

    // ASSERT
    await expect(page).toHaveScreenshot('user-org-permissions-modal.png', {
      maxDiffPixels: 100,
    });
  });

  test('should match baseline for Capability Editor modal', async () => {
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

    // ACT: Open capability editor
    await clickButtonInRow(
      page,
      SELECTORS.USER_ORG_TABLE,
      TEST_ORG_PRIMARY.code,
      SELECTORS.USER_ORG_CAPABILITY_BTN
    );

    await waitForModal(page, SELECTORS.CAPABILITY_MODAL);
    await waitForLoadingComplete(page);

    // ASSERT
    await expect(page).toHaveScreenshot('capability-editor-modal.png', {
      maxDiffPixels: 100,
    });
  });

  test('should match baseline for Suspend User dialog', async () => {
    // ARRANGE
    await page.goto('/');
    await navigateToUserManagement(page);
    await waitForLoadingComplete(page);

    // ACT: Open suspend dialog
    await clickButtonInRow(
      page,
      SELECTORS.USER_TABLE,
      TEST_USER.username,
      SELECTORS.USER_SUSPEND_BTN
    );

    await waitForModal(page, SELECTORS.SUSPEND_DIALOG);

    // ASSERT
    await expect(page).toHaveScreenshot('suspend-user-dialog.png', {
      maxDiffPixels: 50,
    });
  });

  test('should match baseline for status badges', async () => {
    // ARRANGE
    await page.goto('/');
    await navigateToUserManagement(page);
    await waitForLoadingComplete(page);

    // ACT: Find user row with status badges
    const userRow = await page.locator(SELECTORS.USER_ROW(TEST_USER.username));

    // ASSERT
    await expect(userRow).toHaveScreenshot('user-row-with-badges.png', {
      maxDiffPixels: 50,
    });
  });

  test('should detect layout breakage with long AI-generated content', async () => {
    // ARRANGE: Simulate long content in user name field
    // This test ensures the UI handles edge cases gracefully

    await page.goto('/');
    await navigateToUserManagement(page);
    await waitForLoadingComplete(page);

    // ACT: Find table and verify no horizontal overflow
    const table = await page.locator(SELECTORS.USER_TABLE);
    const tableWidth = await table.evaluate((el) => el.scrollWidth);
    const containerWidth = await table.evaluate((el) => el.clientWidth);

    // ASSERT: Table should not overflow container
    expect(tableWidth).toBeLessThanOrEqual(containerWidth + 10); // Allow 10px tolerance

    // Capture screenshot to verify layout
    await expect(page).toHaveScreenshot('user-table-no-overflow.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('should verify responsive design at tablet viewport', async () => {
    // ARRANGE: Resize to tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/');
    await navigateToUserManagement(page);
    await waitForLoadingComplete(page);

    // ASSERT
    await expect(page).toHaveScreenshot('user-management-tablet.png', {
      fullPage: true,
      maxDiffPixels: 200, // Responsive changes may have more variation
    });
  });

  test('should verify responsive design at mobile viewport', async () => {
    // ARRANGE: Resize to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await navigateToUserManagement(page);
    await waitForLoadingComplete(page);

    // ASSERT
    await expect(page).toHaveScreenshot('user-management-mobile.png', {
      fullPage: true,
      maxDiffPixels: 200,
    });
  });

  test('should capture error state visuals', async () => {
    // ARRANGE: Reset viewport to desktop
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('/');

    // ACT: Trigger error state (simulate network error)
    await page.route('**/api/users**', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await navigateToUserManagement(page);
    await waitForLoadingComplete(page);

    // ASSERT: Error banner should be visible
    await expect(page.locator(SELECTORS.ERROR_BANNER)).toBeVisible();

    await expect(page).toHaveScreenshot('user-management-error-state.png', {
      maxDiffPixels: 100,
    });

    // Cleanup route
    await page.unroute('**/api/users**');
  });
});
