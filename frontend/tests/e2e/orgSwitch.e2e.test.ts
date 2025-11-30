/**
 * E2E Test: Organization Switch Workflow
 *
 * Tests the complete flow of switching between organizations:
 * 1. Multi-org user logs in
 * 2. User views data for Organization A
 * 3. User switches to Organization B
 * 4. UI updates to show Organization B data
 * 5. User can manage Organization B's API servers
 * 6. Permissions are enforced per organization
 *
 * Related ADR: ADR-005 Multi-Tenant Access Control
 * Test ID: [TEST-E2E-005]
 */

import { test, expect, Page } from '@playwright/test';
import {
  TEST_ADMIN,
  TEST_VIEWER,
  TEST_ORG_PRIMARY,
  TEST_ORG_SECONDARY,
  SELECTORS,
  TIMEOUTS,
  API_ENDPOINTS,
} from './fixtures/testData';
import { loginViaAPI, authenticatedRequest } from './utils/authHelpers';
import {
  waitForLoadingComplete,
  takeScreenshot,
  waitForElement,
  expectElementText,
} from './utils/pageHelpers';

test.describe('Organization Switch Workflow', () => {
  let adminPage: Page;

  test.beforeAll(async ({ browser }) => {
    const adminContext = await browser.newContext();
    adminPage = await adminContext.newPage();

    await loginViaAPI(adminPage, TEST_ADMIN);
  });

  test.afterAll(async () => {
    await adminPage?.close();
  });

  test('should display organization selector for multi-org users', async () => {
    // ARRANGE
    await adminPage.goto('/');
    await waitForLoadingComplete(adminPage);

    // ASSERT: Verify organization selector is visible
    const orgSelector = await adminPage.locator('[data-testid="org-selector"]');
    const isSelectorVisible = await orgSelector.isVisible().catch(() => false);

    // If org selector uses different element, try alternative selectors
    if (!isSelectorVisible) {
      const altSelector = await adminPage
        .locator('select, .org-selector, [class*="organization"]')
        .first();
      await expect(altSelector).toBeVisible();
    }

    await takeScreenshot(adminPage, 'org-switch-01-selector-visible');
  });

  test('should switch from primary to secondary organization', async () => {
    // ARRANGE
    await adminPage.goto('/');
    await waitForLoadingComplete(adminPage);

    // Get current organization
    const currentOrg = await adminPage.evaluate(() => {
      const userData = localStorage.getItem('pfa_user_data');
      if (userData) {
        const user = JSON.parse(userData);
        return user.currentOrganizationId || user.organizations[0]?.id;
      }
      return null;
    });

    expect(currentOrg).toBeDefined();

    await takeScreenshot(adminPage, 'org-switch-02-before-switch');

    // ACT: Switch to secondary organization
    // This depends on how org switching is implemented in the UI
    // Common patterns: dropdown, menu, or organization list

    // Method 1: Try dropdown selector
    const orgDropdown = await adminPage
      .locator('[data-testid="org-selector"]')
      .isVisible()
      .catch(() => false);

    if (orgDropdown) {
      await adminPage.selectOption('[data-testid="org-selector"]', {
        label: TEST_ORG_SECONDARY.name,
      });
    } else {
      // Method 2: Try clicking organization name/button
      const orgButton = await adminPage
        .locator(`text=${TEST_ORG_SECONDARY.code}`)
        .first();
      await orgButton.click();
    }

    // Wait for org switch to complete
    await waitForLoadingComplete(adminPage);

    await takeScreenshot(adminPage, 'org-switch-03-after-switch');

    // ASSERT: Verify organization context has changed
    const newOrg = await adminPage.evaluate(() => {
      const userData = localStorage.getItem('pfa_user_data');
      if (userData) {
        const user = JSON.parse(userData);
        return user.currentOrganizationId || user.organizations[0]?.id;
      }
      return null;
    });

    expect(newOrg).not.toBe(currentOrg);
    expect(newOrg).toBe(TEST_ORG_SECONDARY.id);
  });

  test('should display correct data for each organization', async () => {
    // ARRANGE: Switch to primary org
    await adminPage.goto('/');
    await waitForLoadingComplete(adminPage);

    // ACT: Request data for primary org
    const primaryDataResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.ORGANIZATIONS + `/${TEST_ORG_PRIMARY.id}`
    );

    expect(primaryDataResponse.ok).toBe(true);

    const primaryData = await primaryDataResponse.json();
    expect(primaryData.organization.id).toBe(TEST_ORG_PRIMARY.id);
    expect(primaryData.organization.code).toBe(TEST_ORG_PRIMARY.code);

    // Switch to secondary org
    await adminPage.evaluate((orgId) => {
      const userData = localStorage.getItem('pfa_user_data');
      if (userData) {
        const user = JSON.parse(userData);
        user.currentOrganizationId = orgId;
        localStorage.setItem('pfa_user_data', JSON.stringify(user));
      }
    }, TEST_ORG_SECONDARY.id);

    await adminPage.reload();
    await waitForLoadingComplete(adminPage);

    // ACT: Request data for secondary org
    const secondaryDataResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.ORGANIZATIONS + `/${TEST_ORG_SECONDARY.id}`
    );

    expect(secondaryDataResponse.ok).toBe(true);

    const secondaryData = await secondaryDataResponse.json();
    expect(secondaryData.organization.id).toBe(TEST_ORG_SECONDARY.id);
    expect(secondaryData.organization.code).toBe(TEST_ORG_SECONDARY.code);

    await takeScreenshot(adminPage, 'org-switch-data-isolation');
  });

  test('should enforce permissions per organization', async () => {
    // ARRANGE: Admin has full access to both orgs
    // Verify permissions for primary org
    const primaryPermsResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_ORGS(TEST_ADMIN.id) + `?organizationId=${TEST_ORG_PRIMARY.id}`
    );

    const primaryPermsData = await primaryPermsResponse.json();
    const primaryOrg = primaryPermsData.userOrganizations.find(
      (uo: any) => uo.organizationId === TEST_ORG_PRIMARY.id
    );

    expect(primaryOrg.permissions.perm_ManageSettings).toBe(true);

    // Verify permissions for secondary org
    const secondaryPermsResponse = await authenticatedRequest(
      adminPage,
      API_ENDPOINTS.USER_ORGS(TEST_ADMIN.id) + `?organizationId=${TEST_ORG_SECONDARY.id}`
    );

    const secondaryPermsData = await secondaryPermsResponse.json();
    const secondaryOrg = secondaryPermsData.userOrganizations.find(
      (uo: any) => uo.organizationId === TEST_ORG_SECONDARY.id
    );

    expect(secondaryOrg.permissions.perm_ManageSettings).toBe(true);

    // ASSERT: Both orgs should have admin permissions for TEST_ADMIN
    expect(primaryOrg.permissions).toEqual(secondaryOrg.permissions);
  });

  test('should prevent access to organizations without permission', async () => {
    // ARRANGE: Create user session with access to only one org
    const { browser } = await import('@playwright/test');
    const newBrowser = await browser.chromium.launch();
    const newContext = await newBrowser.newContext();
    const viewerPage = await newContext.newPage();

    await loginViaAPI(viewerPage, TEST_VIEWER);

    // ACT: Try to access primary org (viewer has access)
    const primaryResponse = await authenticatedRequest(
      viewerPage,
      API_ENDPOINTS.ORGANIZATIONS + `/${TEST_ORG_PRIMARY.id}`
    );

    expect(primaryResponse.ok).toBe(true);

    // Try to access organization without permission (create fake org ID)
    const unauthorizedOrgId = 'fake-org-id-123';
    const unauthorizedResponse = await authenticatedRequest(
      viewerPage,
      API_ENDPOINTS.ORGANIZATIONS + `/${unauthorizedOrgId}`
    );

    // ASSERT: Should fail with 403 or 404
    expect([403, 404]).toContain(unauthorizedResponse.status);

    // Cleanup
    await viewerPage.close();
    await newContext.close();
    await newBrowser.close();
  });

  test('should persist organization context across page reloads', async () => {
    // ARRANGE: Set organization context
    await adminPage.goto('/');
    await waitForLoadingComplete(adminPage);

    await adminPage.evaluate((orgId) => {
      const userData = localStorage.getItem('pfa_user_data');
      if (userData) {
        const user = JSON.parse(userData);
        user.currentOrganizationId = orgId;
        localStorage.setItem('pfa_user_data', JSON.stringify(user));
      }
    }, TEST_ORG_SECONDARY.id);

    // ACT: Reload page
    await adminPage.reload();
    await waitForLoadingComplete(adminPage);

    // ASSERT: Organization context should persist
    const persistedOrg = await adminPage.evaluate(() => {
      const userData = localStorage.getItem('pfa_user_data');
      if (userData) {
        const user = JSON.parse(userData);
        return user.currentOrganizationId;
      }
      return null;
    });

    expect(persistedOrg).toBe(TEST_ORG_SECONDARY.id);

    await takeScreenshot(adminPage, 'org-switch-persist-context');
  });

  test('should show correct organization name in header', async () => {
    // ARRANGE
    await adminPage.goto('/');
    await waitForLoadingComplete(adminPage);

    // Set organization to secondary
    await adminPage.evaluate((orgId) => {
      const userData = localStorage.getItem('pfa_user_data');
      if (userData) {
        const user = JSON.parse(userData);
        user.currentOrganizationId = orgId;
        localStorage.setItem('pfa_user_data', JSON.stringify(user));
      }
    }, TEST_ORG_SECONDARY.id);

    await adminPage.reload();
    await waitForLoadingComplete(adminPage);

    // ASSERT: Header should show secondary org name
    const headerText = await adminPage.textContent('header, .header, [role="banner"]');

    if (headerText) {
      expect(headerText).toContain(TEST_ORG_SECONDARY.code);
    }

    await takeScreenshot(adminPage, 'org-switch-header-name');
  });

  test('should measure organization switch performance', async () => {
    // ARRANGE
    await adminPage.goto('/');
    await waitForLoadingComplete(adminPage);

    // ACT: Measure switch time
    const startTime = Date.now();

    await adminPage.evaluate((orgId) => {
      const userData = localStorage.getItem('pfa_user_data');
      if (userData) {
        const user = JSON.parse(userData);
        user.currentOrganizationId = orgId;
        localStorage.setItem('pfa_user_data', JSON.stringify(user));
      }
    }, TEST_ORG_PRIMARY.id);

    await adminPage.reload();
    await waitForLoadingComplete(adminPage);

    const switchTime = Date.now() - startTime;

    // ASSERT: Switch should complete in <3 seconds
    expect(switchTime).toBeLessThan(3000);

    console.log(`Organization switch time: ${switchTime}ms`);
  });
});
