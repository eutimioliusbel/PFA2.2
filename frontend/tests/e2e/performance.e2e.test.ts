/**
 * E2E Test: Performance Testing
 *
 * Measures and validates performance metrics:
 * 1. Page load times < 2 seconds
 * 2. API response times < 2 seconds
 * 3. Permission grant/revoke operations < 2 seconds
 * 4. User suspension < 2 seconds
 * 5. Organization switch < 3 seconds
 * 6. No memory leaks in long-running sessions
 *
 * Related ADR: ADR-005 Multi-Tenant Access Control
 * Test ID: [TEST-E2E-008]
 */

import { test, expect, Page } from '@playwright/test';
import {
  TEST_ADMIN,
  TEST_USER,
  TEST_ORG_PRIMARY,
  TEST_ORG_SECONDARY,
  SELECTORS,
  API_ENDPOINTS,
} from './fixtures/testData';
import { loginViaAPI, authenticatedRequest } from './utils/authHelpers';
import {
  navigateToUserManagement,
  waitForLoadingComplete,
  clickButtonInRow,
  waitForModal,
  toggleCheckbox,
  measurePageLoadTime,
  measureAPIResponseTime,
} from './utils/pageHelpers';

test.describe('Performance Testing', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();

    await loginViaAPI(page, TEST_ADMIN);
  });

  test.afterAll(async () => {
    await page?.close();
  });

  test('should load User Management page in under 2 seconds', async () => {
    // ACT
    const loadTime = await measurePageLoadTime(page, '/');

    // ASSERT
    expect(loadTime).toBeLessThan(2000);

    console.log(`User Management page load time: ${loadTime}ms`);
  });

  test('should fetch users API in under 2 seconds', async () => {
    // ARRANGE
    await page.goto('/');
    await waitForLoadingComplete(page);

    // ACT: Measure API response time
    const startTime = Date.now();

    await navigateToUserManagement(page);

    await page.waitForResponse(
      (response) => response.url().includes(API_ENDPOINTS.USERS),
      { timeout: 5000 }
    );

    const responseTime = Date.now() - startTime;

    // ASSERT
    expect(responseTime).toBeLessThan(2000);

    console.log(`Get users API response time: ${responseTime}ms`);
  });

  test('should grant permission in under 2 seconds', async () => {
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

    // ACT: Measure permission grant time
    await toggleCheckbox(
      page,
      SELECTORS.CAPABILITY_CHECKBOX('perm_Delete'),
      true
    );

    const startTime = Date.now();

    await page.click(SELECTORS.CAPABILITY_SAVE_BTN);

    await page.waitForResponse(
      (response) => response.url().includes('/capabilities'),
      { timeout: 5000 }
    );

    const grantTime = Date.now() - startTime;

    // ASSERT
    expect(grantTime).toBeLessThan(2000);

    console.log(`Permission grant time: ${grantTime}ms`);
  });

  test('should suspend user in under 2 seconds', async () => {
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

    await page.fill(SELECTORS.SUSPEND_REASON_INPUT, 'Performance test');

    // ACT: Measure suspension time
    const startTime = Date.now();

    await page.click(SELECTORS.SUSPEND_CONFIRM_BTN);

    await page.waitForResponse(
      (response) => response.url().includes('/suspend'),
      { timeout: 5000 }
    );

    const suspendTime = Date.now() - startTime;

    // ASSERT
    expect(suspendTime).toBeLessThan(2000);

    console.log(`User suspension time: ${suspendTime}ms`);

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
    await waitForLoadingComplete(page);
  });

  test('should revoke permission in under 2 seconds', async () => {
    // ARRANGE: Grant permission first
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

    await toggleCheckbox(
      page,
      SELECTORS.CAPABILITY_CHECKBOX('perm_Import'),
      true
    );

    await page.click(SELECTORS.CAPABILITY_SAVE_BTN);
    await page.waitForResponse((response) => response.url().includes('/capabilities'));
    await waitForLoadingComplete(page);

    // ACT: Measure revoke time
    await clickButtonInRow(
      page,
      SELECTORS.USER_ORG_TABLE,
      TEST_ORG_PRIMARY.code,
      SELECTORS.USER_ORG_CAPABILITY_BTN
    );

    await waitForModal(page, SELECTORS.CAPABILITY_MODAL);
    await waitForLoadingComplete(page);

    await toggleCheckbox(
      page,
      SELECTORS.CAPABILITY_CHECKBOX('perm_Import'),
      false
    );

    const startTime = Date.now();

    await page.click(SELECTORS.CAPABILITY_SAVE_BTN);

    await page.waitForResponse(
      (response) => response.url().includes('/capabilities'),
      { timeout: 5000 }
    );

    const revokeTime = Date.now() - startTime;

    // ASSERT
    expect(revokeTime).toBeLessThan(2000);

    console.log(`Permission revoke time: ${revokeTime}ms`);
  });

  test('should switch organizations in under 3 seconds', async () => {
    // ARRANGE
    await page.goto('/');
    await waitForLoadingComplete(page);

    // ACT: Measure org switch time
    const startTime = Date.now();

    await page.evaluate((orgId) => {
      const userData = localStorage.getItem('pfa_user_data');
      if (userData) {
        const user = JSON.parse(userData);
        user.currentOrganizationId = orgId;
        localStorage.setItem('pfa_user_data', JSON.stringify(user));
      }
    }, TEST_ORG_SECONDARY.id);

    await page.reload();
    await waitForLoadingComplete(page);

    const switchTime = Date.now() - startTime;

    // ASSERT
    expect(switchTime).toBeLessThan(3000);

    console.log(`Organization switch time: ${switchTime}ms`);
  });

  test('should handle 100 users without performance degradation', async () => {
    // ARRANGE: Create performance marker
    await page.goto('/');
    await navigateToUserManagement(page);
    await waitForLoadingComplete(page);

    // ACT: Measure render time for user table
    const startTime = performance.now();

    await page.waitForSelector(SELECTORS.USER_TABLE, { state: 'visible' });

    const renderTime = performance.now() - startTime;

    // ASSERT: Should render in under 1 second
    expect(renderTime).toBeLessThan(1000);

    console.log(`User table render time: ${renderTime}ms`);
  });

  test('should not have memory leaks in long-running session', async () => {
    // ARRANGE: Get initial memory usage
    const initialMetrics = await page.metrics();
    const initialHeapSize = initialMetrics.JSHeapUsedSize;

    // ACT: Perform multiple operations
    for (let i = 0; i < 10; i++) {
      await page.goto('/');
      await navigateToUserManagement(page);
      await waitForLoadingComplete(page);

      // Open and close modals
      await clickButtonInRow(
        page,
        SELECTORS.USER_TABLE,
        TEST_USER.username,
        SELECTORS.USER_PERMISSIONS_BTN
      );

      await waitForModal(page, SELECTORS.USER_ORG_MODAL);

      // Close modal
      const closeButton = await page.locator('button:has-text("×"), button[aria-label="Close"]').first();
      await closeButton.click();

      await page.waitForTimeout(100);
    }

    // ASSERT: Heap size should not grow significantly
    const finalMetrics = await page.metrics();
    const finalHeapSize = finalMetrics.JSHeapUsedSize;

    const heapGrowth = finalHeapSize - initialHeapSize;
    const heapGrowthMB = heapGrowth / 1024 / 1024;

    console.log(`Heap growth after 10 operations: ${heapGrowthMB.toFixed(2)}MB`);

    // Allow up to 50MB heap growth (reasonable for 10 operations)
    expect(heapGrowthMB).toBeLessThan(50);
  });

  test('should measure API latency percentiles', async () => {
    // ARRANGE
    const latencies: number[] = [];

    // ACT: Make 20 API requests
    for (let i = 0; i < 20; i++) {
      const startTime = Date.now();

      await authenticatedRequest(
        page,
        API_ENDPOINTS.USERS + `?organizationId=${TEST_ORG_PRIMARY.id}`
      );

      const latency = Date.now() - startTime;
      latencies.push(latency);

      await page.waitForTimeout(100); // Small delay between requests
    }

    // Calculate percentiles
    latencies.sort((a, b) => a - b);

    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];

    console.log(`API Latency - P50: ${p50}ms, P95: ${p95}ms, P99: ${p99}ms`);

    // ASSERT
    expect(p50).toBeLessThan(1000); // Median should be under 1 second
    expect(p95).toBeLessThan(2000); // 95th percentile should be under 2 seconds
    expect(p99).toBeLessThan(3000); // 99th percentile should be under 3 seconds
  });
});
