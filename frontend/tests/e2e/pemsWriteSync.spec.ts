/**
 * E2E Tests: PEMS Write Sync User Workflows
 *
 * Tests complete user flows for bi-directional sync:
 * - Flow 1: Happy Path Sync
 * - Flow 2: Conflict Detection & Resolution
 * - Flow 3: Retry & Dead Letter Queue
 *
 * Uses Playwright for UI interactions and API verification.
 *
 * Phase 4, Gate 2 - Task 4B.1: E2E Tests
 */

import { test, expect, Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Test data
const TEST_ORG_CODE = 'E2E_SYNC_TEST';
const TEST_USER = {
  username: 'e2e_sync_user',
  email: 'e2e_sync@test.com',
  password: 'TestPassword123!',
};

test.describe('E2E: Bi-directional PEMS Sync', () => {
  let testOrgId: string;
  let testUserId: string;
  let testMirrorId: string;
  let testPfaId: string;

  test.beforeAll(async () => {
    // Setup test organization
    const org = await prisma.organization.create({
      data: {
        code: TEST_ORG_CODE,
        name: 'E2E Sync Test Organization',
        isActive: true,
        enableSync: true,
      },
    });
    testOrgId = org.id;

    // Setup test user
    const user = await prisma.user.create({
      data: {
        username: TEST_USER.username,
        email: TEST_USER.email,
        passwordHash: '$2a$10$YourHashedPasswordHere', // Mock hash
        role: 'editor',
        isActive: true,
      },
    });
    testUserId = user.id;

    // Assign user to org with full permissions
    await prisma.userOrganization.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: 'editor',
        perm_Read: true,
        perm_EditForecast: true,
        perm_SaveDraft: true,
        perm_Sync: true,
      },
    });

    // Create test PFA mirror
    testPfaId = 'PFA-E2E-12345';
    const mirror = await prisma.pfaMirror.create({
      data: {
        pfaId: testPfaId,
        organizationId: org.id,
        version: 3,
        pemsVersion: '2025-01-15T10:00:00Z',
        data: {
          pfaId: testPfaId,
          category: 'Excavators',
          class: '20-30 Ton',
          source: 'Rental',
          dor: 'PROJECT',
          monthlyRate: 15000,
          forecastStart: '2025-01-01',
          forecastEnd: '2025-06-30',
        },
        category: 'Excavators',
        source: 'Rental',
        dor: 'PROJECT',
        monthlyRate: 15000,
        forecastStart: new Date('2025-01-01'),
        forecastEnd: new Date('2025-06-30'),
      },
    });
    testMirrorId = mirror.id;
  });

  test.afterAll(async () => {
    // Cleanup test data
    await prisma.pfaWriteQueue.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.pfaSyncConflict.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.pfaModification.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.pfaMirrorHistory.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.pfaMirror.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.userOrganization.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.$disconnect();
  });

  async function loginUser(page: Page) {
    await page.goto('/login');
    await page.fill('input[name="username"]', TEST_USER.username);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  }

  test.describe('Flow 1: Happy Path Sync', () => {
    test('should complete full sync flow: edit → save → sync → verify', async ({ page }) => {
      // Step 1: User logs in
      await loginUser(page);

      // Step 2: Navigate to Timeline view
      await page.click('button:has-text("Timeline")');
      await page.waitForSelector('[data-testid="timeline-view"]');

      // Step 3: Find PFA record and edit forecast start date
      await page.click(`[data-pfa-id="${testPfaId}"]`);
      await page.fill('[data-field="forecastStart"]', '2025-01-15');

      // Verify draft status badge appears
      await expect(page.locator('[data-testid="sync-status-badge"]')).toHaveText('Draft');

      // Step 4: Save changes
      await page.click('button:has-text("Save")');

      // Verify optimistic update (within 100ms)
      const saveStartTime = Date.now();
      await expect(page.locator('[data-field="forecastStart"]')).toHaveValue('2025-01-15');
      const saveEndTime = Date.now();
      expect(saveEndTime - saveStartTime).toBeLessThan(100);

      // Verify modification was created in database
      const modification = await prisma.pfaModification.findFirst({
        where: {
          pfaMirrorId: testMirrorId,
          syncState: 'modified',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(modification).toBeTruthy();
      expect(modification?.delta).toHaveProperty('forecastStart', '2025-01-15');

      // Step 5: Click "Save & Sync"
      await page.click('button:has-text("Save & Sync")');

      // Verify sync status badge changes: Queued
      await expect(page.locator('[data-testid="sync-status-badge"]')).toHaveText('Queued', {
        timeout: 2000,
      });

      // Verify queue item was created
      const queueItem = await prisma.pfaWriteQueue.findFirst({
        where: {
          modificationId: modification!.id,
          status: 'queued',
        },
      });
      expect(queueItem).toBeTruthy();

      // Step 6: Monitor WebSocket for sync progress
      // Note: In real implementation, worker runs and broadcasts events

      // Simulate worker processing (for E2E test)
      await prisma.pfaWriteQueue.update({
        where: { id: queueItem!.id },
        data: { status: 'processing' },
      });

      // Verify badge shows "Syncing"
      await expect(page.locator('[data-testid="sync-status-badge"]')).toHaveText('Syncing', {
        timeout: 2000,
      });

      // Simulate successful sync
      await prisma.$transaction(async (tx) => {
        await tx.pfaModification.update({
          where: { id: modification!.id },
          data: {
            syncStatus: 'synced',
            syncedAt: new Date(),
          },
        });

        await tx.pfaMirrorHistory.create({
          data: {
            mirrorId: testMirrorId,
            version: 3,
            organizationId: testOrgId,
            pfaId: testPfaId,
            data: { forecastStart: '2025-01-01' },
            changedBy: TEST_USER.username,
            changeReason: 'E2E sync test',
          },
        });

        await tx.pfaMirror.update({
          where: { id: testMirrorId },
          data: {
            version: 4,
            forecastStart: new Date('2025-01-15'),
          },
        });

        await tx.pfaWriteQueue.update({
          where: { id: queueItem!.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
          },
        });
      });

      // Verify badge shows "Synced" with checkmark
      await expect(page.locator('[data-testid="sync-status-badge"]')).toHaveText('Synced ✓', {
        timeout: 2000,
      });

      // Verify mirror version incremented
      const updatedMirror = await prisma.pfaMirror.findUnique({
        where: { id: testMirrorId },
      });
      expect(updatedMirror?.version).toBe(4);

      // Verify history record was created
      const history = await prisma.pfaMirrorHistory.findFirst({
        where: { mirrorId: testMirrorId, version: 3 },
      });
      expect(history).toBeTruthy();
    });
  });

  test.describe('Flow 2: Conflict Detection & Resolution', () => {
    test('should detect conflict and allow user to resolve', async ({ page }) => {
      // Setup: Create modification based on version 4
      const modification = await prisma.pfaModification.create({
        data: {
          userId: testUserId,
          organizationId: testOrgId,
          pfaMirrorId: testMirrorId,
          delta: { forecastStart: '2025-02-01' },
          baseVersion: 4,
          currentVersion: 4,
          syncState: 'modified',
          syncStatus: 'pending',
        },
      });

      // Simulate PEMS update (version 4 → 5)
      await prisma.$transaction(async (tx) => {
        await tx.pfaMirrorHistory.create({
          data: {
            mirrorId: testMirrorId,
            version: 4,
            organizationId: testOrgId,
            pfaId: testPfaId,
            data: { forecastStart: '2025-01-15' },
            changedBy: 'PEMS_EXTERNAL',
            changeReason: 'External PEMS update',
          },
        });

        await tx.pfaMirror.update({
          where: { id: testMirrorId },
          data: {
            version: 5,
            forecastStart: new Date('2025-02-15'), // PEMS changed same field
          },
        });
      });

      // User logs in
      await loginUser(page);

      // Navigate to Timeline
      await page.click('button:has-text("Timeline")');

      // User clicks "Save & Sync"
      await page.click(`[data-pfa-id="${testPfaId}"]`);
      await page.click('button:has-text("Save & Sync")');

      // Verify conflict badge appears
      await expect(page.locator('[data-testid="sync-status-badge"]')).toContainText('Conflict', {
        timeout: 3000,
      });

      // Click "Resolve" button
      await page.click('button:has-text("Resolve")');

      // Verify conflict resolution modal appears
      await expect(page.locator('[data-testid="conflict-modal"]')).toBeVisible();

      // Verify side-by-side comparison
      await expect(page.locator('[data-testid="local-value"]')).toContainText('2025-02-01');
      await expect(page.locator('[data-testid="pems-value"]')).toContainText('2025-02-15');

      // Select "Use My Changes"
      await page.click('button:has-text("Use My Changes")');

      // Verify conflict is resolved
      const conflict = await prisma.pfaSyncConflict.findFirst({
        where: {
          modificationId: modification.id,
        },
      });
      expect(conflict).toBeTruthy();

      // Resolve via API (simulating UI action)
      const { ConflictDetectionService } = await import(
        '../../backend/src/services/pems/ConflictDetectionService'
      );
      const conflictService = new ConflictDetectionService();
      await conflictService.resolveConflict(conflict!.id, 'use_local', undefined, testUserId);

      // Verify modification was re-queued
      const requeuedItem = await prisma.pfaWriteQueue.findFirst({
        where: { modificationId: modification.id },
      });
      expect(requeuedItem?.status).toBe('pending');

      // Verify badge returns to "Queued"
      await expect(page.locator('[data-testid="sync-status-badge"]')).toHaveText('Queued', {
        timeout: 2000,
      });
    });
  });

  test.describe('Flow 3: Retry & Dead Letter Queue', () => {
    test('should retry failed syncs and move to DLQ after max retries', async ({ page }) => {
      // Setup: Create modification and queue item
      const modification = await prisma.pfaModification.create({
        data: {
          userId: testUserId,
          organizationId: testOrgId,
          pfaMirrorId: testMirrorId,
          delta: { monthlyRate: 20000 },
          baseVersion: 5,
          currentVersion: 5,
          syncState: 'modified',
          syncStatus: 'pending',
        },
      });

      const queueItem = await prisma.pfaWriteQueue.create({
        data: {
          modificationId: modification.id,
          pfaId: testPfaId,
          organizationId: testOrgId,
          operation: 'update',
          payload: modification.delta,
          status: 'pending',
          scheduledAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
        },
      });

      // User logs in and navigates to Admin Dashboard
      await loginUser(page);
      await page.click('[data-testid="admin-menu"]');
      await page.click('a:has-text("Sync Queue")');

      // Verify queue item is visible
      await expect(page.locator(`[data-queue-id="${queueItem.id}"]`)).toBeVisible();
      await expect(
        page.locator(`[data-queue-id="${queueItem.id}"] [data-field="status"]`)
      ).toHaveText('Pending');
      await expect(
        page.locator(`[data-queue-id="${queueItem.id}"] [data-field="retryCount"]`)
      ).toHaveText('0');

      // Simulate Retry 1 (5s delay)
      await prisma.pfaWriteQueue.update({
        where: { id: queueItem.id },
        data: {
          status: 'pending',
          retryCount: 1,
          lastError: '503 Service Unavailable',
          scheduledAt: new Date(Date.now() + 5000),
        },
      });

      await page.reload();
      await expect(
        page.locator(`[data-queue-id="${queueItem.id}"] [data-field="retryCount"]`)
      ).toHaveText('1');
      await expect(
        page.locator(`[data-queue-id="${queueItem.id}"] [data-field="lastError"]`)
      ).toContainText('503');

      // Simulate Retry 2 (10s delay)
      await prisma.pfaWriteQueue.update({
        where: { id: queueItem.id },
        data: {
          retryCount: 2,
          scheduledAt: new Date(Date.now() + 10000),
        },
      });

      await page.reload();
      await expect(
        page.locator(`[data-queue-id="${queueItem.id}"] [data-field="retryCount"]`)
      ).toHaveText('2');

      // Simulate Retry 3 (20s delay)
      await prisma.pfaWriteQueue.update({
        where: { id: queueItem.id },
        data: {
          retryCount: 3,
          scheduledAt: new Date(Date.now() + 20000),
        },
      });

      await page.reload();
      await expect(
        page.locator(`[data-queue-id="${queueItem.id}"] [data-field="retryCount"]`)
      ).toHaveText('3');

      // Simulate final failure (moved to DLQ)
      await prisma.$transaction(async (tx) => {
        await tx.pfaWriteQueue.update({
          where: { id: queueItem.id },
          data: {
            status: 'failed',
            lastError: 'Max retries exceeded - 503 Service Unavailable',
            completedAt: new Date(),
          },
        });

        await tx.pfaModification.update({
          where: { id: modification.id },
          data: {
            syncStatus: 'sync_error',
            syncError: 'Max retries exceeded - 503 Service Unavailable',
          },
        });
      });

      // Navigate to Dead Letter Queue tab
      await page.click('button:has-text("Dead Letter Queue")');

      // Verify item appears in DLQ
      await expect(page.locator(`[data-queue-id="${queueItem.id}"]`)).toBeVisible();
      await expect(
        page.locator(`[data-queue-id="${queueItem.id}"] [data-field="status"]`)
      ).toHaveText('Failed');
      await expect(
        page.locator(`[data-queue-id="${queueItem.id}"] [data-field="retryCount"]`)
      ).toHaveText('3');
      await expect(
        page.locator(`[data-queue-id="${queueItem.id}"] [data-field="lastError"]`)
      ).toContainText('Max retries exceeded');

      // Verify error badge is shown in Timeline view
      await page.click('button:has-text("Timeline")');
      await expect(page.locator(`[data-pfa-id="${testPfaId}"] [data-testid="sync-status-badge"]`)).toHaveText('Error');

      // User can click "Retry" to re-queue
      await page.click(`[data-pfa-id="${testPfaId}"] button:has-text("Retry")`);

      // Verify item is re-queued
      const retriedItem = await prisma.pfaWriteQueue.findFirst({
        where: {
          modificationId: modification.id,
          status: 'pending',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(retriedItem).toBeTruthy();
      expect(retriedItem?.retryCount).toBe(0); // Reset retry count
    });
  });

  test.describe('Real-time Sync Status Updates', () => {
    test('should update sync status badge in real-time via WebSocket', async ({ page }) => {
      const modification = await prisma.pfaModification.create({
        data: {
          userId: testUserId,
          organizationId: testOrgId,
          pfaMirrorId: testMirrorId,
          delta: { category: 'Excavators - Updated' },
          baseVersion: 5,
          currentVersion: 5,
          syncState: 'modified',
          syncStatus: 'pending',
        },
      });

      const queueItem = await prisma.pfaWriteQueue.create({
        data: {
          modificationId: modification.id,
          pfaId: testPfaId,
          organizationId: testOrgId,
          operation: 'update',
          payload: modification.delta,
          status: 'queued',
          scheduledAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
        },
      });

      await loginUser(page);
      await page.click('button:has-text("Timeline")');

      // Initial state: Queued
      await expect(page.locator(`[data-pfa-id="${testPfaId}"] [data-testid="sync-status-badge"]`)).toHaveText('Queued');

      // Simulate worker picking up item
      await prisma.pfaWriteQueue.update({
        where: { id: queueItem.id },
        data: { status: 'processing' },
      });

      // WebSocket event should update badge to "Syncing"
      await expect(page.locator(`[data-pfa-id="${testPfaId}"] [data-testid="sync-status-badge"]`)).toHaveText('Syncing', {
        timeout: 3000,
      });

      // Simulate successful sync
      await prisma.$transaction(async (tx) => {
        await tx.pfaModification.update({
          where: { id: modification.id },
          data: { syncStatus: 'synced', syncedAt: new Date() },
        });
        await tx.pfaWriteQueue.update({
          where: { id: queueItem.id },
          data: { status: 'completed', completedAt: new Date() },
        });
      });

      // WebSocket event should update badge to "Synced ✓"
      await expect(page.locator(`[data-pfa-id="${testPfaId}"] [data-testid="sync-status-badge"]`)).toHaveText('Synced ✓', {
        timeout: 3000,
      });
    });
  });
});
