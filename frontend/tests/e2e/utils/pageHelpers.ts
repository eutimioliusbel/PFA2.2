/**
 * Page Navigation and Interaction Helpers
 *
 * Utilities for navigating the application and interacting with UI elements
 */

import { Page, expect } from '@playwright/test';
import { SELECTORS, TIMEOUTS } from '../fixtures/testData';

/**
 * Navigate to User Management page
 */
export async function navigateToUserManagement(page: Page): Promise<void> {
  // Assume we start from home page
  await page.click(SELECTORS.USER_MANAGEMENT_TAB);

  // Wait for user table to load
  await page.waitForSelector(SELECTORS.USER_TABLE, { timeout: TIMEOUTS.LONG });
}

/**
 * Wait for element to be visible
 */
export async function waitForElement(
  page: Page,
  selector: string,
  timeout: number = TIMEOUTS.MEDIUM
): Promise<void> {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

/**
 * Wait for element to disappear
 */
export async function waitForElementToDisappear(
  page: Page,
  selector: string,
  timeout: number = TIMEOUTS.MEDIUM
): Promise<void> {
  await page.waitForSelector(selector, { state: 'hidden', timeout });
}

/**
 * Click and wait for navigation
 */
export async function clickAndWaitForNavigation(
  page: Page,
  selector: string
): Promise<void> {
  await Promise.all([
    page.waitForNavigation({ timeout: TIMEOUTS.PAGE_LOAD }),
    page.click(selector),
  ]);
}

/**
 * Fill form and submit
 */
export async function fillFormAndSubmit(
  page: Page,
  formData: Record<string, string>,
  submitSelector: string
): Promise<void> {
  // Fill all fields
  for (const [name, value] of Object.entries(formData)) {
    await page.fill(`input[name="${name}"], textarea[name="${name}"]`, value);
  }

  // Submit
  await page.click(submitSelector);
}

/**
 * Wait for success message
 */
export async function waitForSuccessMessage(
  page: Page,
  message?: string
): Promise<void> {
  await waitForElement(page, SELECTORS.SUCCESS_BANNER);

  if (message) {
    const bannerText = await page.textContent(SELECTORS.SUCCESS_BANNER);
    expect(bannerText).toContain(message);
  }
}

/**
 * Wait for error message
 */
export async function waitForErrorMessage(
  page: Page,
  message?: string
): Promise<void> {
  await waitForElement(page, SELECTORS.ERROR_BANNER);

  if (message) {
    const bannerText = await page.textContent(SELECTORS.ERROR_BANNER);
    expect(bannerText).toContain(message);
  }
}

/**
 * Get table row by text
 */
export async function getTableRow(
  page: Page,
  tableSelector: string,
  rowText: string
): Promise<any> {
  return page.locator(`${tableSelector} tr:has-text("${rowText}")`).first();
}

/**
 * Click button in table row
 */
export async function clickButtonInRow(
  page: Page,
  tableSelector: string,
  rowText: string,
  buttonSelector: string
): Promise<void> {
  const row = await getTableRow(page, tableSelector, rowText);
  await row.locator(buttonSelector).click();
}

/**
 * Wait for modal to open
 */
export async function waitForModal(
  page: Page,
  modalSelector: string
): Promise<void> {
  await waitForElement(page, modalSelector);
}

/**
 * Close modal
 */
export async function closeModal(
  page: Page,
  closeButtonSelector: string
): Promise<void> {
  await page.click(closeButtonSelector);
}

/**
 * Verify checkbox state
 */
export async function expectCheckboxState(
  page: Page,
  selector: string,
  checked: boolean
): Promise<void> {
  const isChecked = await page.isChecked(selector);
  expect(isChecked).toBe(checked);
}

/**
 * Toggle checkbox
 */
export async function toggleCheckbox(
  page: Page,
  selector: string,
  checked: boolean
): Promise<void> {
  const isChecked = await page.isChecked(selector);

  if (isChecked !== checked) {
    await page.click(selector);
  }
}

/**
 * Refresh page data
 */
export async function refreshPage(page: Page): Promise<void> {
  await page.click(SELECTORS.REFRESH_BTN);

  // Wait for loading indicator to appear and disappear
  await page.waitForTimeout(TIMEOUTS.SHORT);
}

/**
 * Take screenshot with timestamp
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  fullPage: boolean = true
): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}.png`;

  await page.screenshot({
    path: `docs/testing/screenshots/${filename}`,
    fullPage,
  });
}

/**
 * Verify element text
 */
export async function expectElementText(
  page: Page,
  selector: string,
  expectedText: string | RegExp
): Promise<void> {
  const text = await page.textContent(selector);

  if (typeof expectedText === 'string') {
    expect(text).toContain(expectedText);
  } else {
    expect(text).toMatch(expectedText);
  }
}

/**
 * Verify element count
 */
export async function expectElementCount(
  page: Page,
  selector: string,
  count: number
): Promise<void> {
  const elements = await page.locator(selector).count();
  expect(elements).toBe(count);
}

/**
 * Wait for loading to complete
 */
export async function waitForLoadingComplete(page: Page): Promise<void> {
  // Wait for any loading spinners to disappear
  const spinnerSelector = '.animate-spin';

  try {
    await page.waitForSelector(spinnerSelector, { state: 'visible', timeout: 1000 });
    await page.waitForSelector(spinnerSelector, { state: 'hidden', timeout: TIMEOUTS.LONG });
  } catch {
    // No spinner found, already loaded
  }
}

/**
 * Measure page load time
 */
export async function measurePageLoadTime(page: Page, url: string): Promise<number> {
  const startTime = Date.now();
  await page.goto(url);
  await waitForLoadingComplete(page);
  const endTime = Date.now();

  return endTime - startTime;
}

/**
 * Measure API response time
 */
export async function measureAPIResponseTime(
  page: Page,
  apiPattern: string | RegExp
): Promise<number> {
  let startTime = 0;
  let endTime = 0;

  // Listen for request
  page.on('request', (request) => {
    const url = request.url();
    const matches =
      typeof apiPattern === 'string' ? url.includes(apiPattern) : apiPattern.test(url);

    if (matches) {
      startTime = Date.now();
    }
  });

  // Listen for response
  await page.waitForResponse(
    (response) => {
      const url = response.url();
      const matches =
        typeof apiPattern === 'string' ? url.includes(apiPattern) : apiPattern.test(url);

      if (matches) {
        endTime = Date.now();
        return true;
      }
      return false;
    },
    { timeout: TIMEOUTS.API_REQUEST }
  );

  return endTime - startTime;
}
