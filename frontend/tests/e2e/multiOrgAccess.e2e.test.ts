/**
 * E2E Test: Multi-Organization Access Workflow
 *
 * Tests granting and managing access to multiple organizations:
 * 1. Admin assigns user to second organization
 * 2. User can view both organizations
 * 3. User has different permissions in each org
 * 4. User can switch between organizations
 *
 * Related ADR: ADR-005 Multi-Tenant Access Control
 * Test ID: [TEST-E2E-006]
 */

import { test, expect, Page } from '@playwright/test';
import {
  TEST_ADMIN,
  TEST_USER,
  TEST_ORG_PRIMARY,
  TEST_ORG_SECONDARY,
  SELECTORS,
  TIMEOUTS,
  API_ENDPOINTS,
  PERMISSION_SETS,
} from './fixtures/testData';
import { loginViaAPI, authenticatedRequest } from './utils/authHelpers';
import {
  navigateToUserManagement,
  waitForLoadingComplete,
  clickButtonInRow,
  waitForModal,
  takeScreenshot,
} from './utils/pageHelpers';

test.describe('Multi-Organization Access Workflow', () => {
  let adminPage: Page;
  let userPage: Page;

  test.beforeAll(async ({ browser }) => {
    const adminContext = await browser.newContext();
    const userContext = await browser.newContext();

    adminPage = await adminContext.newPage();
    userPage = await userContext.newPage();

    await loginViaAPI(adminPage, TEST_ADMIN);
    await loginViaAPI(userPage, TEST_USER);
  });

  test.afterAll(async () => {
    await adminPage?.close();
    await userPage?.close();
  });

  test('should assign user to second organization', async () => {
    // ARRANGE: Verify user currently has access to only one org
    const beforeResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_ORGS(TEST_USER.id) + `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const beforeData = await beforeResponse.json();
    const orgCount = beforeData.userOrganizations.length;

    expect(orgCount).toBe(1);

    // ACT: Navigate to User Management
    await adminPage.goto('/');
    await navigateToUserManagement(adminPage);
    await waitForLoadingComplete(adminPage);

    await takeScreenshot(adminPage, 'multi-org-01-before-assignment');

    // Open user org permissions modal
    await clickButtonInRow(
      adminPage,
      SELECTORS.USER_TABLE,
      TEST_USER.username,
      SELECTORS.USER_PERMISSIONS_BTN
    );

    await waitForModal(adminPage, SELECTORS.USER_ORG_MODAL);

    // Click "Add Organization" button
    const addOrgButton = await adminPage.locator('button:has-text("Add Organization")');
    await addOrgButton.click();

    // Wait for organization assignment dialog
    await waitForModal(adminPage, 'text=Assign to Organization');

    // Select secondary organization
    await adminPage.selectOption('select[name="organizationId"]', TEST_ORG_SECONDARY.id);

    // Select role
    await adminPage.selectOption('select[name="role"]', 'viewer');

    await takeScreenshot(adminPage, 'multi-org-02-assignment-dialog');

    // Confirm assignment
    await adminPage.click('button:has-text("Assign")');

    await adminPage.waitForResponse((response) =>
      response.url().includes('/organizations')
    );

    await waitForLoadingComplete(adminPage);

    await takeScreenshot(adminPage, 'multi-org-03-assigned');

    // ASSERT: Verify user now has access to both orgs
    const afterResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_ORGS(TEST_USER.id) + `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const afterData = await afterResponse.json();
    const newOrgCount = afterData.userOrganizations.length;

    expect(newOrgCount).toBe(2);

    const secondaryOrg = afterData.userOrganizations.find(
      (uo: any) => uo.organizationId === TEST_ORG_SECONDARY.id
    );

    expect(secondaryOrg).toBeDefined();
    expect(secondaryOrg.role).toBe('viewer');
  });

  test('should show different permissions per organization', async () => {
    // ARRANGE: Verify user has different permissions in each org
    const userOrgsResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_ORGS(TEST_USER.id) + `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const userOrgsData = await userOrgsResponse.json();

    const primaryOrg = userOrgsData.userOrganizations.find(
      (uo: any) => uo.organizationId === TEST_ORG_PRIMARY.id
    );

    const secondaryOrg = userOrgsData.userOrganizations.find(
      (uo: any) => uo.organizationId === TEST_ORG_SECONDARY.id
    );

    // Primary org should have editor permissions
    expect(primaryOrg.permissions.perm_EditForecast).toBe(true);

    // Secondary org should have viewer permissions (read-only)
    expect(secondaryOrg.permissions.perm_EditForecast).toBe(false);
    expect(secondaryOrg.permissions.perm_Read).toBe(true);

    await takeScreenshot(adminPage, 'multi-org-different-permissions');
  });

  test('should allow user to switch between organizations', async () => {
    // ARRANGE
    await userPage.goto('/');
    await waitForLoadingComplete(userPage);

    // ACT: Switch to secondary organization
    await userPage.evaluate((orgId) => {
      const userData = localStorage.getItem('pfa_user_data');
      if (userData) {
        const user = JSON.parse(userData);
        user.currentOrganizationId = orgId;
        localStorage.setItem('pfa_user_data', JSON.stringify(user));
      }
    }, TEST_ORG_SECONDARY.id);

    await userPage.reload();
    await waitForLoadingComplete(userPage);

    // ASSERT: User should see secondary org data
    const currentOrg = await userPage.evaluate(() => {
      const userData = localStorage.getItem('pfa_user_data');
      if (userData) {
        const user = JSON.parse(userData);
        return user.currentOrganizationId;
      }
      return null;
    });

    expect(currentOrg).toBe(TEST_ORG_SECONDARY.id);

    await takeScreenshot(userPage, 'multi-org-user-switched');
  });

  test('should enforce read-only access in secondary org', async () => {
    // ARRANGE: User is in secondary org with viewer role
    await userPage.goto('/');
    await waitForLoadingComplete(userPage);

    await userPage.evaluate((orgId) => {
      const userData = localStorage.getItem('pfa_user_data');
      if (userData) {
        const user = JSON.parse(userData);
        user.currentOrganizationId = orgId;
        localStorage.setItem('pfa_user_data', JSON.stringify(user));
      }
    }, TEST_ORG_SECONDARY.id);

    await userPage.reload();
    await waitForLoadingComplete(userPage);

    // ACT: Try to edit data (should fail)
    // This would depend on the specific UI implementation
    // Common pattern: Edit buttons should be disabled or hidden

    const editButtonVisible = await userPage
      .locator('button:has-text("Edit")')
      .isVisible()
      .catch(() => false);

    // ASSERT: Edit functionality should not be available
    expect(editButtonVisible).toBe(false);

    await takeScreenshot(userPage, 'multi-org-read-only-enforcement');
  });

  test('should revoke access to organization', async () => {
    // ARRANGE
    await adminPage.goto('/');
    await navigateToUserManagement(adminPage);
    await waitForLoadingComplete(adminPage);

    // ACT: Revoke access to secondary org
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
      TEST_ORG_SECONDARY.code,
      SELECTORS.USER_ORG_REVOKE_BTN
    );

    // Wait for revoke confirmation dialog
    await waitForModal(adminPage, 'text=Revoke Access');

    await adminPage.fill('textarea[name="reason"]', 'Multi-org test completed');

    await adminPage.click('button:has-text("Revoke Access")');

    await adminPage.waitForResponse((response) =>
      response.url().includes('/user-organizations/')
    );

    await waitForLoadingComplete(adminPage);

    // ASSERT: Verify user no longer has access to secondary org
    const userOrgsResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_ORGS(TEST_USER.id) + `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const userOrgsData = await userOrgsResponse.json();
    const secondaryOrg = userOrgsData.userOrganizations.find(
      (uo: any) => uo.organizationId === TEST_ORG_SECONDARY.id
    );

    expect(secondaryOrg).toBeUndefined();

    await takeScreenshot(adminPage, 'multi-org-access-revoked');
  });

  test('should prevent user from accessing revoked organization', async () => {
    // ARRANGE: User had access to secondary org, but it was revoked
    await userPage.goto('/');
    await waitForLoadingComplete(userPage);

    // ACT: Try to access secondary org data
    const secondaryOrgResponse = await authenticatedRequest(
      userPage,
      API_ENDPOINTS.ORGANIZATIONS + `/${TEST_ORG_SECONDARY.id}`
    );

    // ASSERT: Should fail with 403
    expect(secondaryOrgResponse.status).toBe(403);

    const errorData = await secondaryOrgResponse.json();
    expect(errorData.error).toContain('Permission denied');
  });

  test('should handle organization assignment with custom permissions', async () => {
    // ARRANGE
    await adminPage.goto('/');
    await navigateToUserManagement(adminPage);
    await waitForLoadingComplete(adminPage);

    // ACT: Assign user to secondary org with custom permissions
    await clickButtonInRow(
      adminPage,
      SELECTORS.USER_TABLE,
      TEST_USER.username,
      SELECTORS.USER_PERMISSIONS_BTN
    );

    await waitForModal(adminPage, SELECTORS.USER_ORG_MODAL);

    const addOrgButton = await adminPage.locator('button:has-text("Add Organization")');
    await addOrgButton.click();

    await waitForModal(adminPage, 'text=Assign to Organization');

    await adminPage.selectOption('select[name="organizationId"]', TEST_ORG_SECONDARY.id);
    await adminPage.selectOption('select[name="role"]', 'viewer');

    await adminPage.click('button:has-text("Assign")');

    await adminPage.waitForResponse((response) =>
      response.url().includes('/organizations')
    );

    await waitForLoadingComplete(adminPage);

    // Grant custom permission (perm_Export)
    await clickButtonInRow(
      adminPage,
      SELECTORS.USER_ORG_TABLE,
      TEST_ORG_SECONDARY.code,
      SELECTORS.USER_ORG_CAPABILITY_BTN
    );

    await waitForModal(adminPage, SELECTORS.CAPABILITY_MODAL);
    await waitForLoadingComplete(adminPage);

    await adminPage.click(SELECTORS.CAPABILITY_CHECKBOX('perm_Export'));

    await adminPage.click(SELECTORS.CAPABILITY_SAVE_BTN);

    await adminPage.waitForResponse((response) =>
      response.url().includes('/capabilities')
    );

    await waitForLoadingComplete(adminPage);

    // ASSERT: Verify custom permission is granted
    const userOrgsResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_ORGS(TEST_USER.id) + `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const userOrgsData = await userOrgsResponse.json();
    const secondaryOrg = userOrgsData.userOrganizations.find(
      (uo: any) => uo.organizationId === TEST_ORG_SECONDARY.id
    );

    expect(secondaryOrg.permissions.perm_Export).toBe(true);
    expect(secondaryOrg.isCustom).toBe(true);
  });
});
