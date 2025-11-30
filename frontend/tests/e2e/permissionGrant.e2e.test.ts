/**
 * E2E Test: Permission Grant Workflow
 *
 * Tests the complete flow of granting permissions to a user:
 * 1. Admin opens User Management
 * 2. Admin selects user
 * 3. Admin opens Permission Modal
 * 4. Admin grants perm_ManageSettings
 * 5. Admin saves changes
 * 6. Verify database is updated
 * 7. Verify user can now use the permission
 *
 * Related ADR: ADR-005 Multi-Tenant Access Control
 * Test ID: [TEST-E2E-001]
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
import { loginViaAPI, authenticatedRequest } from './utils/authHelpers';
import {
  navigateToUserManagement,
  waitForElement,
  clickButtonInRow,
  waitForModal,
  toggleCheckbox,
  waitForLoadingComplete,
  takeScreenshot,
  expectCheckboxState,
} from './utils/pageHelpers';

test.describe('Permission Grant Workflow', () => {
  let adminPage: Page;
  let userPage: Page;

  test.beforeAll(async ({ browser }) => {
    // Create separate pages for admin and user
    const adminContext = await browser.newContext();
    const userContext = await browser.newContext();

    adminPage = await adminContext.newPage();
    userPage = await userContext.newPage();

    // Login as admin
    await loginViaAPI(adminPage, TEST_ADMIN);

    // Login as regular user
    await loginViaAPI(userPage, TEST_USER);
  });

  test.afterAll(async () => {
    await adminPage?.close();
    await userPage?.close();
  });

  test('should grant perm_ManageSettings to user via UI', async () => {
    // ARRANGE: Navigate to User Management as admin
    await adminPage.goto('/');
    await navigateToUserManagement(adminPage);
    await waitForLoadingComplete(adminPage);

    // Take baseline screenshot
    await takeScreenshot(adminPage, 'permission-grant-01-user-management');

    // ACT: Open user's organization permissions
    await clickButtonInRow(
      adminPage,
      SELECTORS.USER_TABLE,
      TEST_USER.username,
      SELECTORS.USER_PERMISSIONS_BTN
    );

    // Wait for modal to open
    await waitForModal(adminPage, SELECTORS.USER_ORG_MODAL);
    await takeScreenshot(adminPage, 'permission-grant-02-org-permissions-modal');

    // Find the row for TEST_ORG_PRIMARY and click configure capabilities
    await clickButtonInRow(
      adminPage,
      SELECTORS.USER_ORG_TABLE,
      TEST_ORG_PRIMARY.code,
      SELECTORS.USER_ORG_CAPABILITY_BTN
    );

    // Wait for capability editor modal
    await waitForModal(adminPage, SELECTORS.CAPABILITY_MODAL);
    await waitForLoadingComplete(adminPage);
    await takeScreenshot(adminPage, 'permission-grant-03-capability-editor');

    // Verify perm_ManageSettings is currently unchecked
    await expectCheckboxState(
      adminPage,
      SELECTORS.CAPABILITY_CHECKBOX('perm_ManageSettings'),
      false
    );

    // Grant perm_ManageSettings
    await toggleCheckbox(
      adminPage,
      SELECTORS.CAPABILITY_CHECKBOX('perm_ManageSettings'),
      true
    );

    await takeScreenshot(adminPage, 'permission-grant-04-permission-granted');

    // Measure API response time for permission grant
    const startTime = Date.now();

    // Save changes
    await adminPage.click(SELECTORS.CAPABILITY_SAVE_BTN);

    // Wait for API response
    await adminPage.waitForResponse(
      (response) => response.url().includes('/capabilities'),
      { timeout: TIMEOUTS.API_REQUEST }
    );

    const responseTime = Date.now() - startTime;

    // Verify response time is under 2 seconds
    expect(responseTime).toBeLessThan(2000);

    // Wait for modal to close
    await waitForLoadingComplete(adminPage);
    await takeScreenshot(adminPage, 'permission-grant-05-saved');

    // ASSERT: Verify database is updated
    const userOrgsResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_ORGS(TEST_USER.id) + `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    expect(userOrgsResponse.ok).toBe(true);

    const userOrgsData = await userOrgsResponse.json();
    const primaryOrg = userOrgsData.userOrganizations.find(
      (uo: any) => uo.organizationId === TEST_ORG_PRIMARY.id
    );

    expect(primaryOrg).toBeDefined();
    expect(primaryOrg.permissions.perm_ManageSettings).toBe(true);

    // ASSERT: Verify user can now use perm_ManageSettings
    // Navigate to settings page as user (this should now be accessible)
    await userPage.goto('/');

    // Wait for page to load
    await waitForLoadingComplete(userPage);

    // Check if "API Server Manager" menu item is visible (requires perm_ManageSettings)
    const apiServerMenuVisible = await userPage
      .locator('text=API Server Manager')
      .isVisible();

    expect(apiServerMenuVisible).toBe(true);

    await takeScreenshot(userPage, 'permission-grant-06-user-can-access-settings');
  });

  test('should grant multiple permissions simultaneously', async () => {
    // ARRANGE
    await adminPage.goto('/');
    await navigateToUserManagement(adminPage);
    await waitForLoadingComplete(adminPage);

    // ACT: Open user's organization permissions
    await clickButtonInRow(
      adminPage,
      SELECTORS.USER_TABLE,
      TEST_USER.username,
      SELECTORS.USER_PERMISSIONS_BTN
    );

    await waitForModal(adminPage, SELECTORS.USER_ORG_MODAL);

    await clickButtonInRow(
      adminPage,
      SELECTORS.USER_ORG_TABLE,
      TEST_ORG_PRIMARY.code,
      SELECTORS.USER_ORG_CAPABILITY_BTN
    );

    await waitForModal(adminPage, SELECTORS.CAPABILITY_MODAL);
    await waitForLoadingComplete(adminPage);

    // Grant multiple permissions
    await toggleCheckbox(
      adminPage,
      SELECTORS.CAPABILITY_CHECKBOX('perm_Import'),
      true
    );

    await toggleCheckbox(
      adminPage,
      SELECTORS.CAPABILITY_CHECKBOX('perm_Export'),
      true
    );

    await toggleCheckbox(
      adminPage,
      SELECTORS.CAPABILITY_CHECKBOX('perm_RefreshData'),
      true
    );

    await takeScreenshot(adminPage, 'permission-grant-multiple-01-before-save');

    // Save changes
    await adminPage.click(SELECTORS.CAPABILITY_SAVE_BTN);

    await adminPage.waitForResponse(
      (response) => response.url().includes('/capabilities'),
      { timeout: TIMEOUTS.API_REQUEST }
    );

    await waitForLoadingComplete(adminPage);

    // ASSERT: Verify all permissions are granted
    const userOrgsResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_ORGS(TEST_USER.id) + `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const userOrgsData = await userOrgsResponse.json();
    const primaryOrg = userOrgsData.userOrganizations.find(
      (uo: any) => uo.organizationId === TEST_ORG_PRIMARY.id
    );

    expect(primaryOrg.permissions.perm_Import).toBe(true);
    expect(primaryOrg.permissions.perm_Export).toBe(true);
    expect(primaryOrg.permissions.perm_RefreshData).toBe(true);
  });

  test('should mark user-org as custom when permissions differ from template', async () => {
    // ARRANGE
    await adminPage.goto('/');
    await navigateToUserManagement(adminPage);
    await waitForLoadingComplete(adminPage);

    // ACT: Grant custom permission (not in editor template)
    await clickButtonInRow(
      adminPage,
      SELECTORS.USER_TABLE,
      TEST_USER.username,
      SELECTORS.USER_PERMISSIONS_BTN
    );

    await waitForModal(adminPage, SELECTORS.USER_ORG_MODAL);

    await clickButtonInRow(
      adminPage,
      SELECTORS.USER_ORG_TABLE,
      TEST_ORG_PRIMARY.code,
      SELECTORS.USER_ORG_CAPABILITY_BTN
    );

    await waitForModal(adminPage, SELECTORS.CAPABILITY_MODAL);
    await waitForLoadingComplete(adminPage);

    // Grant permission not in editor template (perm_Delete)
    await toggleCheckbox(
      adminPage,
      SELECTORS.CAPABILITY_CHECKBOX('perm_Delete'),
      true
    );

    await adminPage.click(SELECTORS.CAPABILITY_SAVE_BTN);

    await adminPage.waitForResponse(
      (response) => response.url().includes('/capabilities'),
      { timeout: TIMEOUTS.API_REQUEST }
    );

    await waitForLoadingComplete(adminPage);

    // ASSERT: Verify isCustom flag is set
    const userOrgsResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_ORGS(TEST_USER.id) + `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const userOrgsData = await userOrgsResponse.json();
    const primaryOrg = userOrgsData.userOrganizations.find(
      (uo: any) => uo.organizationId === TEST_ORG_PRIMARY.id
    );

    expect(primaryOrg.isCustom).toBe(true);
    expect(primaryOrg.permissions.perm_Delete).toBe(true);

    await takeScreenshot(adminPage, 'permission-grant-custom-01-custom-permissions');
  });

  test('should prevent non-admin users from granting permissions', async () => {
    // ARRANGE: Login as regular user (not admin)
    await userPage.goto('/');
    await waitForLoadingComplete(userPage);

    // ACT: Try to navigate to User Management
    const userManagementVisible = await userPage
      .locator(SELECTORS.USER_MANAGEMENT_TAB)
      .isVisible();

    // ASSERT: User Management should not be visible
    expect(userManagementVisible).toBe(false);

    // Try direct API access (should fail with 403)
    const userOrgsResponse = await authenticatedRequest(
      userPage,
      API_ENDPOINTS.USER_ORGS(TEST_USER.id) + `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    expect(userOrgsResponse.status).toBe(403);

    const errorData = await userOrgsResponse.json();
    expect(errorData.error).toContain('Permission denied');
  });
});
