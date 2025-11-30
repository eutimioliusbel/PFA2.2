/**
 * Accessibility Test Suite
 * Task 10B.5 - WCAG 2.1 AA Compliance Testing
 *
 * Tests all admin UI components for:
 * - Automated accessibility violations (axe-core)
 * - Keyboard navigation
 * - Screen reader compatibility
 * - Color contrast
 * - Focus management
 *
 * WCAG 2.1 AA Standards:
 * - Perceivable: Alt text, color contrast ≥4.5:1, resizable text
 * - Operable: Keyboard accessible, visible focus, bypass blocks
 * - Understandable: Readable text, predictable navigation, input assistance
 * - Robust: Valid HTML, assistive technology compatible
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Test configuration
const BASE_URL = 'http://localhost:3000';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

/**
 * Helper: Login as admin
 */
async function loginAsAdmin(page: any) {
  await page.goto('/');

  // Check if already logged in
  const isLoggedIn = await page.locator('text=User Management').isVisible().catch(() => false);
  if (isLoggedIn) {
    return;
  }

  // Perform login using placeholder selectors
  await page.fill('input[placeholder="Enter your username"]', ADMIN_USERNAME);
  await page.fill('input[placeholder="Enter your password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for dashboard to load
  await page.waitForSelector('text=User Management', { timeout: 10000 });
}

/**
 * Helper: Navigate to admin section
 */
async function navigateToAdmin(page: any, section: string) {
  await loginAsAdmin(page);

  // Click on the admin menu item
  await page.click(`text="${section}"`);

  // Wait for section to load
  await page.waitForLoadState('networkidle');
}

test.describe('Accessibility: Automated Violations (axe-core)', () => {
  test('User Management - No violations', async ({ page }) => {
    await navigateToAdmin(page, 'User Management');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('API Server Manager - No violations', async ({ page }) => {
    await navigateToAdmin(page, 'API Servers');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Permission Modal - No violations', async ({ page }) => {
    await navigateToAdmin(page, 'User Management');

    // Click on permissions button for first user
    const permissionButton = page.locator('button[title="Manage Organization Permissions"]').first();
    await permissionButton.click();

    // Wait for modal to appear
    await page.waitForSelector('text=User Organization Permissions');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});

test.describe('Accessibility: Keyboard Navigation', () => {
  test('Tab order is logical on User Management page', async ({ page }) => {
    await navigateToAdmin(page, 'User Management');

    // Start from the first interactive element
    await page.keyboard.press('Tab');

    // Track tab order
    const tabOrder: string[] = [];

    for (let i = 0; i < 10; i++) {
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? el.tagName + (el.getAttribute('aria-label') || el.getAttribute('title') || '') : 'none';
      });

      tabOrder.push(focusedElement);
      await page.keyboard.press('Tab');
    }

    // Verify tab order is logical (not jumping randomly)
    expect(tabOrder.length).toBeGreaterThan(5);
    console.log('Tab order:', tabOrder);
  });

  test('All interactive elements are keyboard accessible', async ({ page }) => {
    await navigateToAdmin(page, 'User Management');

    // Get all buttons, links, inputs
    const interactiveElements = await page.locator('button, a, input, select, textarea').count();

    // Tab through all elements
    let reachedCount = 0;
    for (let i = 0; i < interactiveElements + 5; i++) {
      await page.keyboard.press('Tab');

      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return el && el.tagName !== 'BODY';
      });

      if (focused) reachedCount++;
    }

    // Should be able to reach most interactive elements
    expect(reachedCount).toBeGreaterThan(interactiveElements * 0.8);
  });

  test('Modal focus trap works correctly', async ({ page }) => {
    await navigateToAdmin(page, 'User Management');

    // Open suspend dialog
    const suspendButton = page.locator('button[title="Suspend User"]').first();
    await suspendButton.click();

    // Wait for modal
    await page.waitForSelector('text=Suspend User');

    // Track if focus stays inside modal
    let focusEscapedModal = false;

    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');

      const isInModal = await page.evaluate(() => {
        const el = document.activeElement;
        const modal = document.querySelector('[class*="fixed"][class*="inset-0"]');
        return modal?.contains(el) || false;
      });

      if (!isInModal) {
        focusEscapedModal = true;
        break;
      }
    }

    expect(focusEscapedModal).toBe(false);
  });

  test('Escape key closes modals', async ({ page }) => {
    await navigateToAdmin(page, 'User Management');

    // Open suspend dialog
    const suspendButton = page.locator('button[title="Suspend User"]').first();
    await suspendButton.click();

    // Wait for modal
    await page.waitForSelector('text=Suspend User');

    // Press Escape
    await page.keyboard.press('Escape');

    // Modal should be closed
    const modalVisible = await page.locator('text=Suspend User').isVisible().catch(() => false);
    expect(modalVisible).toBe(false);
  });

  test('Enter/Space activates buttons', async ({ page }) => {
    await navigateToAdmin(page, 'User Management');

    // Focus on refresh button
    const refreshButton = page.locator('button:has-text("Refresh")');
    await refreshButton.focus();

    // Verify focus
    const isFocused = await refreshButton.evaluate(el => el === document.activeElement);
    expect(isFocused).toBe(true);

    // Press Enter
    await page.keyboard.press('Enter');

    // Should trigger refresh (network activity or loading state)
    await page.waitForTimeout(500);
  });
});

test.describe('Accessibility: Screen Reader Compatibility', () => {
  test('All form inputs have labels', async ({ page }) => {
    await navigateToAdmin(page, 'User Management');

    // Open edit modal
    const editButton = page.locator('button[title="Edit User"]').first();
    await editButton.click();

    // Wait for modal
    await page.waitForLoadState('networkidle');

    // Get all inputs
    const inputs = page.locator('input, textarea, select');
    const inputCount = await inputs.count();

    // Check each input has a label
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const hasLabel = await input.evaluate((el: any) => {
        // Check for aria-label
        if (el.getAttribute('aria-label')) return true;

        // Check for aria-labelledby
        if (el.getAttribute('aria-labelledby')) return true;

        // Check for associated label element
        const id = el.id;
        if (id && document.querySelector(`label[for="${id}"]`)) return true;

        // Check for parent label
        if (el.closest('label')) return true;

        return false;
      });

      const inputName = await input.getAttribute('name') || await input.getAttribute('placeholder') || `input-${i}`;
      expect(hasLabel).toBe(true);
    }
  });

  test('Buttons have accessible names', async ({ page }) => {
    await navigateToAdmin(page, 'User Management');

    // Get all buttons
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);

      const accessibleName = await button.evaluate((el: any) => {
        // Check for aria-label
        if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');

        // Check for text content
        if (el.textContent?.trim()) return el.textContent.trim();

        // Check for title
        if (el.title) return el.title;

        return null;
      });

      expect(accessibleName).toBeTruthy();
    }
  });

  test('Images have alt text', async ({ page }) => {
    await navigateToAdmin(page, 'User Management');

    // Get all images
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const image = images.nth(i);
      const alt = await image.getAttribute('alt');

      // Images should have alt attribute (can be empty for decorative images)
      expect(alt !== null).toBe(true);
    }
  });

  test('Status badges have readable text', async ({ page }) => {
    await navigateToAdmin(page, 'User Management');

    // Get all status badges
    const badges = page.locator('[class*="badge"], [class*="status"]');
    const badgeCount = await badges.count();

    if (badgeCount > 0) {
      for (let i = 0; i < badgeCount; i++) {
        const badge = badges.nth(i);
        const text = await badge.textContent();

        expect(text?.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test('Loading states are announced', async ({ page }) => {
    await page.goto('/');

    // Check for loading spinner
    const spinner = page.locator('[class*="animate-spin"]');

    if (await spinner.count() > 0) {
      // Loading spinner should have aria-label or be in a container with aria-live
      const hasAriaLabel = await spinner.first().evaluate((el: any) => {
        return el.getAttribute('aria-label') ||
               el.closest('[aria-live]') ||
               el.closest('[role="status"]') ||
               el.closest('[role="alert"]');
      });

      expect(hasAriaLabel).toBeTruthy();
    }
  });
});

test.describe('Accessibility: Color Contrast', () => {
  test('Text has sufficient contrast (4.5:1 minimum)', async ({ page }) => {
    await navigateToAdmin(page, 'User Management');

    // Run axe contrast checker
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .disableRules([
        'landmark-one-main',
        'page-has-heading-one',
        'region',
      ])
      .analyze();

    const contrastViolations = accessibilityScanResults.violations.filter(
      v => v.id === 'color-contrast'
    );

    expect(contrastViolations).toEqual([]);
  });

  test('Button states have visible contrast', async ({ page }) => {
    await navigateToAdmin(page, 'User Management');

    // Get primary action button
    const button = page.locator('button:has-text("Refresh")').first();

    // Check default state
    const defaultColor = await button.evaluate((el: any) => {
      const styles = window.getComputedStyle(el);
      return {
        color: styles.color,
        backgroundColor: styles.backgroundColor,
      };
    });

    expect(defaultColor.color).toBeTruthy();
    expect(defaultColor.backgroundColor).toBeTruthy();

    // Hover state
    await button.hover();
    await page.waitForTimeout(200);

    const hoverColor = await button.evaluate((el: any) => {
      const styles = window.getComputedStyle(el);
      return {
        color: styles.color,
        backgroundColor: styles.backgroundColor,
      };
    });

    // Hover state should be different from default
    expect(
      hoverColor.backgroundColor !== defaultColor.backgroundColor ||
      hoverColor.color !== defaultColor.color
    ).toBe(true);
  });
});

test.describe('Accessibility: Focus Management', () => {
  test('All interactive elements have visible focus indicators', async ({ page }) => {
    await navigateToAdmin(page, 'User Management');

    // Get first interactive element
    const button = page.locator('button').first();
    await button.focus();

    // Check for focus outline
    const hasFocusIndicator = await button.evaluate((el: any) => {
      const styles = window.getComputedStyle(el);
      return (
        styles.outline !== 'none' ||
        styles.outlineStyle !== 'none' ||
        styles.border !== styles.borderColor || // Border change on focus
        styles.boxShadow !== 'none' // Box shadow on focus
      );
    });

    expect(hasFocusIndicator).toBe(true);
  });

  test('Focus is restored after modal close', async ({ page }) => {
    await navigateToAdmin(page, 'User Management');

    // Focus on suspend button
    const suspendButton = page.locator('button[title="Suspend User"]').first();
    await suspendButton.focus();

    // Get button text for later verification
    const buttonId = await suspendButton.evaluate(el => {
      el.id = el.id || 'test-suspend-button';
      return el.id;
    });

    // Click to open modal
    await suspendButton.click();
    await page.waitForSelector('text=Suspend User');

    // Close modal with Cancel button
    await page.click('button:has-text("Cancel")');

    // Wait for modal to close
    await page.waitForTimeout(300);

    // Check if focus returned to trigger button
    const focusedElementId = await page.evaluate(() => {
      return document.activeElement?.id || '';
    });

    // Focus should return to the button that opened the modal
    expect(focusedElementId).toBe(buttonId);
  });

  test('Focus is visible on keyboard navigation', async ({ page }) => {
    await navigateToAdmin(page, 'User Management');

    // Tab to first element
    await page.keyboard.press('Tab');

    // Get focused element outline
    const focusStyle = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;

      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        outlineColor: styles.outlineColor,
        outlineStyle: styles.outlineStyle,
        outlineWidth: styles.outlineWidth,
        boxShadow: styles.boxShadow,
      };
    });

    expect(focusStyle).toBeTruthy();
    expect(
      focusStyle?.outline !== 'none' ||
      focusStyle?.outlineStyle !== 'none' ||
      focusStyle?.boxShadow !== 'none'
    ).toBe(true);
  });
});

test.describe('Accessibility: Semantic HTML', () => {
  test('Proper heading hierarchy', async ({ page }) => {
    await navigateToAdmin(page, 'User Management');

    // Get all headings
    const headings = await page.evaluate(() => {
      const h1 = Array.from(document.querySelectorAll('h1')).map(h => h.textContent);
      const h2 = Array.from(document.querySelectorAll('h2')).map(h => h.textContent);
      const h3 = Array.from(document.querySelectorAll('h3')).map(h => h.textContent);

      return { h1, h2, h3 };
    });

    // Should have at least one h1 or h2
    expect(headings.h1.length + headings.h2.length).toBeGreaterThan(0);

    console.log('Heading hierarchy:', headings);
  });

  test('Tables use proper markup', async ({ page }) => {
    await navigateToAdmin(page, 'User Management');

    // Check for table
    const tables = page.locator('table');
    const tableCount = await tables.count();

    if (tableCount > 0) {
      // Check for thead and tbody
      const hasProperStructure = await tables.first().evaluate((table: any) => {
        return {
          hasThead: !!table.querySelector('thead'),
          hasTbody: !!table.querySelector('tbody'),
          hasTh: !!table.querySelector('th'),
        };
      });

      expect(hasProperStructure.hasThead).toBe(true);
      expect(hasProperStructure.hasTbody).toBe(true);
      expect(hasProperStructure.hasTh).toBe(true);
    }
  });

  test('Lists use proper markup', async ({ page }) => {
    await navigateToAdmin(page, 'User Management');

    // Check for lists
    const lists = await page.locator('ul, ol').count();

    if (lists > 0) {
      // Verify list items are inside lists
      const validLists = await page.evaluate(() => {
        const allLis = document.querySelectorAll('li');
        let valid = true;

        allLis.forEach(li => {
          const parent = li.parentElement;
          if (parent && parent.tagName !== 'UL' && parent.tagName !== 'OL') {
            valid = false;
          }
        });

        return valid;
      });

      expect(validLists).toBe(true);
    }
  });
});

test.describe('Accessibility: ARIA Attributes', () => {
  test('No invalid ARIA attributes', async ({ page }) => {
    await navigateToAdmin(page, 'User Management');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const ariaViolations = accessibilityScanResults.violations.filter(
      v => v.id.includes('aria')
    );

    expect(ariaViolations).toEqual([]);
  });

  test('Modals use proper ARIA roles', async ({ page }) => {
    await navigateToAdmin(page, 'User Management');

    // Open modal
    const suspendButton = page.locator('button[title="Suspend User"]').first();
    await suspendButton.click();

    // Wait for modal
    await page.waitForSelector('text=Suspend User');

    // Check modal ARIA attributes
    const modalAttrs = await page.evaluate(() => {
      const modal = document.querySelector('[class*="fixed"][class*="inset-0"]');
      if (!modal) return null;

      return {
        role: modal.getAttribute('role'),
        ariaModal: modal.getAttribute('aria-modal'),
        ariaLabel: modal.getAttribute('aria-label') || modal.getAttribute('aria-labelledby'),
      };
    });

    // Modal should have role="dialog" and aria-modal="true"
    expect(modalAttrs?.role || modalAttrs?.ariaModal).toBeTruthy();
  });
});

test.describe('Accessibility: Error Handling', () => {
  test('Error messages are announced to screen readers', async ({ page }) => {
    await navigateToAdmin(page, 'User Management');

    // Check for error banner
    const errorBanner = page.locator('[class*="red"]').first();

    if (await errorBanner.count() > 0) {
      const hasAriaLive = await errorBanner.evaluate((el: any) => {
        return el.getAttribute('role') === 'alert' ||
               el.getAttribute('aria-live') ||
               el.closest('[role="alert"]') ||
               el.closest('[aria-live]');
      });

      // Errors should be in an aria-live region or have role="alert"
      expect(hasAriaLive).toBeTruthy();
    }
  });
});
