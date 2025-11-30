/**
 * Playwright Test: API Connectivity Component
 *
 * Tests the new 2-tier API configuration architecture
 */

import { test, expect } from '@playwright/test';

test.describe('API Connectivity - New Architecture', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');

    // Login with admin credentials
    await page.fill('input[type="text"]', 'admin');
    await page.click('button:has-text("Login")');

    // Wait for dashboard to load
    await page.waitForURL('**/');

    // Navigate to Admin Dashboard
    await page.click('text=Admin');
    await page.waitForTimeout(1000);
  });

  test('should display PEMS APIs tab with 4 global configurations', async ({ page }) => {
    // Click on API Connectivity tab/button
    await page.click('text=API Connectivity');
    await page.waitForTimeout(1000);

    // Verify we're on PEMS tab by default
    const pemsTab = page.locator('button:has-text("PEMS APIs")');
    await expect(pemsTab).toHaveClass(/border-orange-500/);

    // Check for PEMS API cards
    const pemsCards = page.locator('.grid').locator('.border.rounded-lg');
    const count = await pemsCards.count();

    console.log(`Found ${count} PEMS API configurations`);

    // Should have 4 PEMS APIs: PFA Read, PFA Write, Assets, Classes
    expect(count).toBeGreaterThanOrEqual(4);

    // Verify specific PEMS APIs are present
    await expect(page.locator('text=PFA Data (Read)')).toBeVisible();
    await expect(page.locator('text=PFA Data (Write)')).toBeVisible();
    await expect(page.locator('text=Asset Master')).toBeVisible();
    await expect(page.locator('text=Classes & Categories')).toBeVisible();
  });

  test('should display correct endpoints for PEMS APIs', async ({ page }) => {
    await page.click('text=API Connectivity');
    await page.waitForTimeout(1000);

    // Check for griddata endpoint (PFA Read)
    await expect(page.locator('text=/.*griddata.*/')).toBeVisible();

    // Check for UserDefinedScreenService endpoint (PFA Write)
    await expect(page.locator('text=/.*UserDefinedScreenService.*/')).toBeVisible();

    // Check for equipment/assets endpoint
    await expect(page.locator('text=/.*equipment\/assets.*/')).toBeVisible();

    // Check for equipment/categories endpoint
    await expect(page.locator('text=/.*equipment\/categories.*/')).toBeVisible();
  });

  test('should only show Test button for PEMS APIs (no edit/delete)', async ({ page }) => {
    await page.click('text=API Connectivity');
    await page.waitForTimeout(1000);

    // Get the first PEMS card
    const firstCard = page.locator('.grid').locator('.border.rounded-lg').first();

    // Should have Test button
    await expect(firstCard.locator('button:has-text("Test")')).toBeVisible();

    // Should NOT have Configure, Settings, or individual Delete buttons
    await expect(firstCard.locator('button:has-text("Configure")')).not.toBeVisible();
    await expect(firstCard.locator('button:has-text("Settings")')).not.toBeVisible();
  });

  test('should display AI Providers tab with 5 templates', async ({ page }) => {
    await page.click('text=API Connectivity');
    await page.waitForTimeout(1000);

    // Switch to AI Providers tab
    await page.click('button:has-text("AI Providers")');
    await page.waitForTimeout(1000);

    // Verify we're on AI tab
    const aiTab = page.locator('button:has-text("AI Providers")');
    await expect(aiTab).toHaveClass(/border-orange-500/);

    // Check for AI provider cards
    const aiCards = page.locator('.grid').locator('.border.rounded-lg');
    const count = await aiCards.count();

    console.log(`Found ${count} AI provider templates`);

    // Should have 5 AI providers: Gemini, OpenAI, Claude, Azure, Grok
    expect(count).toBeGreaterThanOrEqual(5);

    // Verify specific AI providers are present
    await expect(page.locator('text=Google Gemini')).toBeVisible();
    await expect(page.locator('text=OpenAI GPT')).toBeVisible();
    await expect(page.locator('text=Anthropic Claude')).toBeVisible();
    await expect(page.locator('text=Azure OpenAI')).toBeVisible();
    await expect(page.locator('text=xAI Grok')).toBeVisible();
  });

  test('should show Configure button for unconfigured AI providers', async ({ page }) => {
    await page.click('text=API Connectivity');
    await page.waitForTimeout(1000);

    // Switch to AI Providers tab
    await page.click('button:has-text("AI Providers")');
    await page.waitForTimeout(1000);

    // Look for unconfigured providers (should have Configure button)
    const configureButtons = page.locator('button:has-text("Configure")');
    const count = await configureButtons.count();

    console.log(`Found ${count} unconfigured AI providers`);

    // Most providers should be unconfigured initially
    expect(count).toBeGreaterThan(0);
  });

  test('should show status badges', async ({ page }) => {
    await page.click('text=API Connectivity');
    await page.waitForTimeout(1000);

    // Check for status badges on PEMS tab
    const statusBadges = page.locator('span.px-2.py-1.rounded.text-xs.font-medium');
    const count = await statusBadges.count();

    console.log(`Found ${count} status badges`);

    expect(count).toBeGreaterThan(0);

    // Should have status text like CONNECTED, UNTESTED, ERROR, or UNCONFIGURED
    const firstBadge = statusBadges.first();
    const badgeText = await firstBadge.textContent();

    console.log(`Status badge text: ${badgeText}`);

    expect(['CONNECTED', 'UNTESTED', 'ERROR', 'UNCONFIGURED']).toContain(badgeText);
  });

  test('should have "Add API" button', async ({ page }) => {
    await page.click('text=API Connectivity');
    await page.waitForTimeout(1000);

    // Should have "Add API" button
    const addButton = page.locator('button:has-text("Add API")');
    await expect(addButton).toBeVisible();

    console.log('Add API button is visible');
  });

  test('should display correct helper text for each tab', async ({ page }) => {
    await page.click('text=API Connectivity');
    await page.waitForTimeout(1000);

    // PEMS tab should show admin-managed message
    await expect(page.locator('text=/.*managed globally by administrators.*/')).toBeVisible();

    // Switch to AI Providers tab
    await page.click('button:has-text("AI Providers")');
    await page.waitForTimeout(1000);

    // AI tab should show credentials configuration message
    await expect(page.locator('text=/.*Configure your organization.*credentials.*/')).toBeVisible();
  });

  test('should open credentials modal when clicking Configure', async ({ page }) => {
    await page.click('text=API Connectivity');
    await page.waitForTimeout(1000);

    // Switch to AI Providers tab
    await page.click('button:has-text("AI Providers")');
    await page.waitForTimeout(1000);

    // Click first Configure button
    const configureButton = page.locator('button:has-text("Configure")').first();

    if (await configureButton.isVisible()) {
      await configureButton.click();
      await page.waitForTimeout(500);

      // Should show credentials modal
      await expect(page.locator('text=/Configure.*/')).toBeVisible();

      // Should have API Key or Username/Password fields
      const apiKeyInput = page.locator('input[placeholder*="API key"]');
      const usernameInput = page.locator('input[placeholder*="username"]');

      const hasApiKey = await apiKeyInput.isVisible();
      const hasUsername = await usernameInput.isVisible();

      expect(hasApiKey || hasUsername).toBeTruthy();

      // Should have Save and Cancel buttons
      await expect(page.locator('button:has-text("Save Credentials")')).toBeVisible();
      await expect(page.locator('button:has-text("Cancel")')).toBeVisible();

      // Close modal
      await page.locator('button:has-text("Cancel")').click();
    }
  });

  test('should open edit modal when clicking Add API button', async ({ page }) => {
    await page.click('text=API Connectivity');
    await page.waitForTimeout(1000);

    // Click Add API button
    const addButton = page.locator('button:has-text("Add API")');
    await addButton.click();
    await page.waitForTimeout(500);

    // Should show edit modal with correct title
    await expect(page.locator('text=Add New API Configuration')).toBeVisible();

    // Should have Name, URL, Auth Type, and Operation Type fields
    await expect(page.locator('input[placeholder*="API name"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="https://"]')).toBeVisible();
    await expect(page.locator('select').filter({ hasText: 'API Key' })).toBeVisible();
    await expect(page.locator('select').filter({ hasText: 'Read' })).toBeVisible();

    // Should have Create API and Cancel buttons
    await expect(page.locator('button:has-text("Create API")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();

    console.log('Edit modal opened successfully with all fields');

    // Close modal
    await page.locator('button:has-text("Cancel")').click();
  });

  test('should open edit modal when double-clicking an API card', async ({ page }) => {
    await page.click('text=API Connectivity');
    await page.waitForTimeout(1000);

    // Double-click the first API card
    const firstCard = page.locator('.grid').locator('.border.rounded-lg').first();
    await firstCard.dblclick();
    await page.waitForTimeout(500);

    // Should show edit modal with correct title
    await expect(page.locator('text=Edit API Configuration')).toBeVisible();

    // Should have Name and URL fields populated
    const nameInput = page.locator('input[placeholder*="API name"]');
    const urlInput = page.locator('input[placeholder*="https://"]');

    await expect(nameInput).toBeVisible();
    await expect(urlInput).toBeVisible();

    // Name should not be empty (editing existing config)
    const nameValue = await nameInput.inputValue();
    expect(nameValue.length).toBeGreaterThan(0);

    console.log(`Editing API: ${nameValue}`);

    // Should have Save Changes and Cancel buttons
    await expect(page.locator('button:has-text("Save Changes")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();

    // Close modal
    await page.locator('button:has-text("Cancel")').click();
  });

  test('should show visual feedback when hovering over API cards', async ({ page }) => {
    await page.click('text=API Connectivity');
    await page.waitForTimeout(1000);

    // Get the first API card
    const firstCard = page.locator('.grid').locator('.border.rounded-lg').first();

    // Card should have cursor-pointer class
    const className = await firstCard.getAttribute('class');
    expect(className).toContain('cursor-pointer');

    // Card should have title attribute
    const title = await firstCard.getAttribute('title');
    expect(title).toBe('Double-click to edit');

    console.log('API cards have correct hover and double-click indicators');
  });
});
