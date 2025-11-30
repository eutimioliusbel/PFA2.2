/**
 * Authentication Helpers for E2E Tests
 *
 * Provides utilities for login, logout, and token management
 */

import { Page, expect } from '@playwright/test';
import { TestUser, SELECTORS, TIMEOUTS, API_ENDPOINTS } from '../fixtures/testData';

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3001';
const TOKEN_KEY = 'pfa_auth_token';
const USER_KEY = 'pfa_user_data';

/**
 * Login via UI
 * Navigates to login screen and submits credentials
 */
export async function loginViaUI(page: Page, user: TestUser): Promise<void> {
  await page.goto('/');

  // Wait for login screen
  await page.waitForSelector(SELECTORS.LOGIN_USERNAME, { timeout: TIMEOUTS.PAGE_LOAD });

  // Fill credentials
  await page.fill(SELECTORS.LOGIN_USERNAME, user.username);
  await page.fill(SELECTORS.LOGIN_PASSWORD, user.password);

  // Submit
  await page.click(SELECTORS.LOGIN_SUBMIT);

  // Wait for navigation to complete
  await page.waitForURL('**/', { timeout: TIMEOUTS.PAGE_LOAD });

  // Verify token is stored
  const token = await page.evaluate(() => localStorage.getItem('pfa_auth_token'));
  expect(token).toBeTruthy();
}

/**
 * Login via API
 * Faster alternative to UI login - directly sets token in localStorage
 */
export async function loginViaAPI(page: Page, user: TestUser): Promise<string> {
  // Make API request
  const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.LOGIN}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: user.username,
      password: user.password,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Login failed: ${errorData.error || response.statusText}`);
  }

  const data = await response.json();
  const token = data.token;

  // Set token in browser localStorage
  await page.goto('/');
  await page.evaluate(
    ({ token, user, tokenKey, userKey }) => {
      localStorage.setItem(tokenKey, token);
      localStorage.setItem(userKey, JSON.stringify(user));
    },
    { token, user: data.user, tokenKey: TOKEN_KEY, userKey: USER_KEY }
  );

  return token;
}

/**
 * Logout
 * Clears authentication tokens from localStorage
 */
export async function logout(page: Page): Promise<void> {
  await page.evaluate(({ tokenKey, userKey }) => {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
  }, { tokenKey: TOKEN_KEY, userKey: USER_KEY });

  await page.goto('/');
}

/**
 * Get stored token
 */
export async function getToken(page: Page): Promise<string | null> {
  return await page.evaluate((tokenKey) => {
    return localStorage.getItem(tokenKey);
  }, TOKEN_KEY);
}

/**
 * Verify authenticated
 */
export async function expectAuthenticated(page: Page): Promise<void> {
  const token = await getToken(page);
  expect(token).toBeTruthy();
}

/**
 * Verify not authenticated
 */
export async function expectNotAuthenticated(page: Page): Promise<void> {
  const token = await getToken(page);
  expect(token).toBeFalsy();
}

/**
 * Make authenticated API request
 */
export async function authenticatedRequest(
  page: Page,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getToken(page);

  if (!token) {
    throw new Error('No authentication token found');
  }

  return await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

/**
 * Wait for API response
 * Useful for testing loading states and API latency
 */
export async function waitForAPIResponse(
  page: Page,
  urlPattern: string | RegExp,
  timeout: number = TIMEOUTS.API_REQUEST
): Promise<void> {
  await page.waitForResponse(
    (response) => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout }
  );
}
