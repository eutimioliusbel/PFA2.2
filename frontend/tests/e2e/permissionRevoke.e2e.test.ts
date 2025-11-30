/**
 * E2E Test: Permission Revoke Workflow
 *
 * Tests the complete flow of revoking permissions from a user:
 * 1. Admin opens User Management
 * 2. Admin selects user with existing permissions
 * 3. Admin opens Permission Modal
 * 4. Admin revokes perm_EditForecast
 * 5. Admin saves changes
 * 6. Verify database is updated
 * 7. Verify user can no longer use the permission
 *
 * Related ADR: ADR-005 Multi-Tenant Access Control
 * Test ID: [TEST-E2E-002]
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

test.describe('Permission Revoke Workflow', () => {
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

  test('should revoke perm_EditForecast from user via UI', async () => {
    // ARRANGE: Verify user currently has perm_EditForecast
    const beforeResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_ORGS(TEST_USER.id) + `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const beforeData = await beforeResponse.json();
    const beforeOrg = beforeData.userOrganizations.find(
      (uo: any) => uo.organizationId === TEST_ORG_PRIMARY.id
    );

    expect(beforeOrg.permissions.perm_EditForecast).toBe(true);

    // ACT: Navigate to User Management as admin
    await adminPage.goto('/');
    await navigateToUserManagement(adminPage);
    await waitForLoadingComplete(adminPage);

    await takeScreenshot(adminPage, 'permission-revoke-01-user-management');

    // Open user's organization permissions
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

    await takeScreenshot(adminPage, 'permission-revoke-02-capability-editor');

    // Verify perm_EditForecast is currently checked
    await expectCheckboxState(
      adminPage,
      SELECTORS.CAPABILITY_CHECKBOX('perm_EditForecast'),
      true
    );

    // Revoke perm_EditForecast
    await toggleCheckbox(
      adminPage,
      SELECTORS.CAPABILITY_CHECKBOX('perm_EditForecast'),
      false
    );

    await takeScreenshot(adminPage, 'permission-revoke-03-permission-revoked');

    // Save changes
    await adminPage.click(SELECTORS.CAPABILITY_SAVE_BTN);

    await adminPage.waitForResponse(
      (response) => response.url().includes('/capabilities'),
      { timeout: TIMEOUTS.API_REQUEST }
    );

    await waitForLoadingComplete(adminPage);

    // ASSERT: Verify database is updated
    const afterResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_ORGS(TEST_USER.id) + `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const afterData = await afterResponse.json();
    const afterOrg = afterData.userOrganizations.find(
      (uo: any) => uo.organizationId === TEST_ORG_PRIMARY.id
    );

    expect(afterOrg.permissions.perm_EditForecast).toBe(false);

    // ASSERT: Verify user can no longer use perm_EditForecast
    // User should not see "Edit Forecast" buttons in Timeline view
    await userPage.goto('/');
    await waitForLoadingComplete(userPage);

    const editForecastButtonVisible = await userPage
      .locator('button:has-text("Edit Forecast")')
      .isVisible();

    expect(editForecastButtonVisible).toBe(false);

    await takeScreenshot(userPage, 'permission-revoke-04-user-cannot-edit');
  });

  test('should revoke multiple permissions simultaneously', async () => {
    // ARRANGE: Grant multiple permissions first
    await adminPage.goto('/');
    await navigateToUserManagement(adminPage);
    await waitForLoadingComplete(adminPage);

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

    // Grant permissions
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

    await adminPage.click(SELECTORS.CAPABILITY_SAVE_BTN);
    await adminPage.waitForResponse((response) =>
      response.url().includes('/capabilities')
    );
    await waitForLoadingComplete(adminPage);

    // ACT: Revoke all three permissions
    await clickButtonInRow(
      adminPage,
      SELECTORS.USER_ORG_TABLE,
      TEST_ORG_PRIMARY.code,
      SELECTORS.USER_ORG_CAPABILITY_BTN
    );

    await waitForModal(adminPage, SELECTORS.CAPABILITY_MODAL);
    await waitForLoadingComplete(adminPage);

    await toggleCheckbox(
      adminPage,
      SELECTORS.CAPABILITY_CHECKBOX('perm_Import'),
      false
    );
    await toggleCheckbox(
      adminPage,
      SELECTORS.CAPABILITY_CHECKBOX('perm_Export'),
      false
    );
    await toggleCheckbox(
      adminPage,
      SELECTORS.CAPABILITY_CHECKBOX('perm_RefreshData'),
      false
    );

    await takeScreenshot(adminPage, 'permission-revoke-multiple-01-before-save');

    await adminPage.click(SELECTORS.CAPABILITY_SAVE_BTN);
    await adminPage.waitForResponse((response) =>
      response.url().includes('/capabilities')
    );
    await waitForLoadingComplete(adminPage);

    // ASSERT
    const userOrgsResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_ORGS(TEST_USER.id) + `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const userOrgsData = await userOrgsResponse.json();
    const primaryOrg = userOrgsData.userOrganizations.find(
      (uo: any) => uo.organizationId === TEST_ORG_PRIMARY.id
    );

    expect(primaryOrg.permissions.perm_Import).toBe(false);
    expect(primaryOrg.permissions.perm_Export).toBe(false);
    expect(primaryOrg.permissions.perm_RefreshData).toBe(false);
  });

  test('should revoke all organization access', async () => {
    // ARRANGE
    await adminPage.goto('/');
    await navigateToUserManagement(adminPage);
    await waitForLoadingComplete(adminPage);

    // ACT: Revoke entire organization access
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
      SELECTORS.USER_ORG_REVOKE_BTN
    );

    // Wait for revoke confirmation dialog
    await waitForElement(adminPage, 'text=Revoke Access');

    await takeScreenshot(adminPage, 'permission-revoke-org-01-confirmation');

    // Fill reason
    await adminPage.fill('textarea[name="reason"]', 'Project access no longer needed');

    // Confirm revocation
    await adminPage.click('button:has-text("Revoke Access")');

    await adminPage.waitForResponse((response) =>
      response.url().includes('/user-organizations/')
    );

    await waitForLoadingComplete(adminPage);

    // ASSERT: Verify user no longer has access to organization
    const userOrgsResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_ORGS(TEST_USER.id) + `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const userOrgsData = await userOrgsResponse.json();
    const primaryOrg = userOrgsData.userOrganizations.find(
      (uo: any) => uo.organizationId === TEST_ORG_PRIMARY.id
    );

    expect(primaryOrg).toBeUndefined();

    // User should not be able to access organization data
    await userPage.goto('/');
    await waitForLoadingComplete(userPage);

    // Check if organization selector shows TEST_ORG_PRIMARY
    const orgSelectorHasOrg = await userPage
      .locator(`text=${TEST_ORG_PRIMARY.code}`)
      .isVisible();

    expect(orgSelectorHasOrg).toBe(false);

    await takeScreenshot(userPage, 'permission-revoke-org-02-user-no-access');
  });

  test('should prevent permission escalation attack', async () => {
    // ARRANGE: Regular user tries to grant themselves permissions via API
    const maliciousPayload = {
      perm_ManageUsers: true,
      perm_ManageSettings: true,
      perm_Impersonate: true,
    };

    // ACT: Try to update capabilities without proper permission
    const response = await authenticatedRequest(
      userPage,
      API_ENDPOINTS.USER_ORG_CAPABILITIES('fake-user-org-id') +
        `?organizationId=${TEST_ORG_PRIMARY.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(maliciousPayload),
      }
    );

    // ASSERT: Request should fail with 403
    expect(response.status).toBe(403);

    const errorData = await response.json();
    expect(errorData.error).toContain('Permission denied');
  });

  test('should audit permission revocations', async () => {
    // ARRANGE: Grant permission first
    await adminPage.goto('/');
    await navigateToUserManagement(adminPage);
    await waitForLoadingComplete(adminPage);

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

    await toggleCheckbox(
      adminPage,
      SELECTORS.CAPABILITY_CHECKBOX('perm_Delete'),
      true
    );

    await adminPage.click(SELECTORS.CAPABILITY_SAVE_BTN);
    await adminPage.waitForResponse((response) =>
      response.url().includes('/capabilities')
    );
    await waitForLoadingComplete(adminPage);

    // ACT: Revoke permission
    await clickButtonInRow(
      adminPage,
      SELECTORS.USER_ORG_TABLE,
      TEST_ORG_PRIMARY.code,
      SELECTORS.USER_ORG_CAPABILITY_BTN
    );

    await waitForModal(adminPage, SELECTORS.CAPABILITY_MODAL);
    await waitForLoadingComplete(adminPage);

    await toggleCheckbox(
      adminPage,
      SELECTORS.CAPABILITY_CHECKBOX('perm_Delete'),
      false
    );

    await adminPage.click(SELECTORS.CAPABILITY_SAVE_BTN);
    await adminPage.waitForResponse((response) =>
      response.url().includes('/capabilities')
    );
    await waitForLoadingComplete(adminPage);

    // ASSERT: Verify audit trail exists
    // Check modifiedAt and modifiedBy fields are updated
    const userOrgsResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_ORGS(TEST_USER.id) + `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const userOrgsData = await userOrgsResponse.json();
    const primaryOrg = userOrgsData.userOrganizations.find(
      (uo: any) => uo.organizationId === TEST_ORG_PRIMARY.id
    );

    expect(primaryOrg.modifiedBy).toBeDefined();
    expect(primaryOrg.modifiedAt).toBeDefined();

    // modifiedAt should be recent (within last 5 seconds)
    const modifiedAt = new Date(primaryOrg.modifiedAt);
    const now = new Date();
    const diffSeconds = (now.getTime() - modifiedAt.getTime()) / 1000;

    expect(diffSeconds).toBeLessThan(5);
  });
});
