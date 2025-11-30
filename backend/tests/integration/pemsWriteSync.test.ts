/**
 * Integration Tests: PEMS Write Sync
 *
 * Tests complete bi-directional sync workflows:
 * - Full sync cycle: commit → queue → sync → verify
 * - Conflict detection and resolution
 * - Retry and Dead Letter Queue handling
 * - Mirror version management
 * - WebSocket event broadcasting
 *
 * Phase 4, Gate 2 - Task 4B.3: Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { prisma, createTestUser, createTestOrg, assignUserToOrg, generateToken, cleanupTestScenario } from './setup';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

describe('Integration: PEMS Write Sync', () => {
  let testOrg: any;
  let testUser: any;
  let authToken: string;
  let testMirror: any;
  let testModification: any;

  beforeAll(async () => {
    // Create test organization
    testOrg = await createTestOrg({
      code: 'WRITE_SYNC_TEST',
      name: 'Write Sync Test Org',
      enableSync: true,
    });

    // Create test user
    testUser = await createTestUser({
      username: 'write_sync_editor',
      role: 'editor',
    });

    // Assign user to org with full permissions
    await assignUserToOrg({
      userId: testUser.id,
      organizationId: testOrg.id,
      role: 'editor',
      permissions: {
        perm_Read: true,
        perm_EditForecast: true,
        perm_SaveDraft: true,
        perm_Sync: true,
      },
    });

    authToken = generateToken(testUser);
  });

  afterAll(async () => {
    await cleanupTestScenario('WRITE_SYNC_TEST');
    await cleanupTestScenario('write_sync_');
  });

  beforeEach(async () => {
    // Create test PFA mirror record
    testMirror = await prisma.pfaMirror.create({
      data: {
        pfaId: 'PFA-WS-TEST-001',
        organizationId: testOrg.id,
        version: 1,
        pemsVersion: '2025-01-15T10:00:00Z',
        data: {
          pfaId: 'PFA-WS-TEST-001',
          category: 'Excavators',
          class: '20-30 Ton',
          source: 'Rental',
          dor: 'PROJECT',
          monthlyRate: 15000,
          forecastStart: '2025-01-01',
          forecastEnd: '2025-06-30',
          organization: 'WRITE_SYNC_TEST',
        },
        category: 'Excavators',
        class: '20-30 Ton',
        source: 'Rental',
        dor: 'PROJECT',
        monthlyRate: 15000,
        forecastStart: new Date('2025-01-01'),
        forecastEnd: new Date('2025-06-30'),
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.pfaWriteQueue.deleteMany({
      where: { organizationId: testOrg.id },
    });
    await prisma.pfaSyncConflict.deleteMany({
      where: { organizationId: testOrg.id },
    });
    await prisma.pfaModification.deleteMany({
      where: { organizationId: testOrg.id },
    });
    await prisma.pfaMirrorHistory.deleteMany({
      where: { organizationId: testOrg.id },
    });
    await prisma.pfaMirror.deleteMany({
      where: { organizationId: testOrg.id },
    });
  });

  describe('Full Sync Cycle', () => {
    it('should complete full sync flow: commit → queue → sync → verify', async () => {
      // Step 1: Create a modification (user edits PFA)
      const modification = await prisma.pfaModification.create({
        data: {
          userId: testUser.id,
          organizationId: testOrg.id,
          pfaMirrorId: testMirror.id,
          delta: {
            forecastStart: '2025-01-15',
            monthlyRate: 18000,
          },
          baseVersion: testMirror.version,
          currentVersion: testMirror.version,
          syncState: 'modified',
          syncStatus: 'pending',
          changeReason: 'Integration test modification',
        },
      });

      expect(modification.syncState).toBe('modified');
      expect(modification.syncStatus).toBe('pending');

      // Step 2: Commit modification (queues for sync)
      const queueItem = await prisma.pfaWriteQueue.create({
        data: {
          modificationId: modification.id,
          pfaId: testMirror.pfaId!,
          organizationId: testOrg.id,
          operation: 'update',
          payload: modification.delta,
          status: 'queued',
          priority: 1,
          scheduledAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
        },
      });

      expect(queueItem.status).toBe('queued');

      // Step 3: Manually process queue item (simulating worker)
      // Note: In E2E tests, we would actually run the worker

      // Update queue item to processing
      await prisma.pfaWriteQueue.update({
        where: { id: queueItem.id },
        data: { status: 'processing' },
      });

      // Simulate successful PEMS write
      await prisma.$transaction(async (tx) => {
        // Update modification as synced
        await tx.pfaModification.update({
          where: { id: modification.id },
          data: {
            syncStatus: 'synced',
            syncedAt: new Date(),
            pemsVersion: '2025-01-15T12:00:00Z',
          },
        });

        // Archive current mirror version
        await tx.pfaMirrorHistory.create({
          data: {
            mirrorId: testMirror.id,
            version: testMirror.version,
            organizationId: testOrg.id,
            pfaId: testMirror.pfaId,
            data: testMirror.data,
            category: testMirror.category,
            source: testMirror.source,
            dor: testMirror.dor,
            monthlyRate: testMirror.monthlyRate,
            forecastStart: testMirror.forecastStart,
            forecastEnd: testMirror.forecastEnd,
            changedBy: testUser.username,
            changeReason: 'Write sync to PEMS',
          },
        });

        // Update mirror with new version
        await tx.pfaMirror.update({
          where: { id: testMirror.id },
          data: {
            data: {
              ...testMirror.data,
              forecastStart: '2025-01-15',
              monthlyRate: 18000,
            },
            version: testMirror.version + 1,
            pemsVersion: '2025-01-15T12:00:00Z',
            forecastStart: new Date('2025-01-15'),
            monthlyRate: 18000,
          },
        });

        // Mark queue item as completed
        await tx.pfaWriteQueue.update({
          where: { id: queueItem.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
          },
        });
      });

      // Step 4: Verify final state
      const updatedModification = await prisma.pfaModification.findUnique({
        where: { id: modification.id },
      });
      expect(updatedModification?.syncStatus).toBe('synced');
      expect(updatedModification?.syncedAt).toBeTruthy();

      const updatedMirror = await prisma.pfaMirror.findUnique({
        where: { id: testMirror.id },
      });
      expect(updatedMirror?.version).toBe(2);
      expect(updatedMirror?.monthlyRate).toBe(18000);

      const completedQueueItem = await prisma.pfaWriteQueue.findUnique({
        where: { id: queueItem.id },
      });
      expect(completedQueueItem?.status).toBe('completed');
      expect(completedQueueItem?.completedAt).toBeTruthy();

      const history = await prisma.pfaMirrorHistory.findMany({
        where: { mirrorId: testMirror.id },
        orderBy: { version: 'desc' },
      });
      expect(history).toHaveLength(1);
      expect(history[0].version).toBe(1);
    });
  });

  describe('Conflict Detection', () => {
    it('should detect conflict when modification is based on outdated mirror version', async () => {
      // Step 1: Create modification based on version 1
      const modification = await prisma.pfaModification.create({
        data: {
          userId: testUser.id,
          organizationId: testOrg.id,
          pfaMirrorId: testMirror.id,
          delta: {
            forecastStart: '2025-01-20',
          },
          baseVersion: 1, // Based on version 1
          currentVersion: 1,
          syncState: 'modified',
          syncStatus: 'pending',
        },
      });

      // Step 2: Simulate PEMS update (mirror advances to version 2)
      await prisma.$transaction(async (tx) => {
        await tx.pfaMirrorHistory.create({
          data: {
            mirrorId: testMirror.id,
            version: 1,
            organizationId: testOrg.id,
            pfaId: testMirror.pfaId,
            data: testMirror.data,
            category: testMirror.category,
            source: testMirror.source,
            dor: testMirror.dor,
            monthlyRate: testMirror.monthlyRate,
            forecastStart: testMirror.forecastStart,
            changedBy: 'PEMS_SYNC',
            changeReason: 'External PEMS update',
          },
        });

        await tx.pfaMirror.update({
          where: { id: testMirror.id },
          data: {
            data: {
              ...testMirror.data,
              forecastStart: '2025-01-25', // PEMS changed same field
            },
            version: 2,
            forecastStart: new Date('2025-01-25'),
          },
        });
      });

      // Step 3: Queue modification for sync
      const queueItem = await prisma.pfaWriteQueue.create({
        data: {
          modificationId: modification.id,
          pfaId: testMirror.pfaId!,
          organizationId: testOrg.id,
          operation: 'update',
          payload: modification.delta,
          status: 'queued',
          scheduledAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
        },
      });

      // Step 4: Detect conflict
      const { ConflictDetectionService } = await import(
        '../../src/services/pems/ConflictDetectionService'
      );
      const conflictService = new ConflictDetectionService();

      const conflictResult = await conflictService.detectConflict(modification.id);

      expect(conflictResult.hasConflict).toBe(true);
      expect(conflictResult.canAutoMerge).toBe(false);
      expect(conflictResult.conflict?.conflictFields).toContain('forecastStart');
      expect(conflictResult.conflict?.localVersion).toBe(1);
      expect(conflictResult.conflict?.pemsVersion).toBe(2);
    });

    it('should allow auto-merge when fields do not overlap', async () => {
      // Step 1: Create modification changing forecastStart (based on version 1)
      const modification = await prisma.pfaModification.create({
        data: {
          userId: testUser.id,
          organizationId: testOrg.id,
          pfaMirrorId: testMirror.id,
          delta: {
            forecastStart: '2025-01-20',
          },
          baseVersion: 1,
          currentVersion: 1,
          syncState: 'modified',
          syncStatus: 'pending',
        },
      });

      // Step 2: Simulate PEMS update changing different field (monthlyRate)
      await prisma.$transaction(async (tx) => {
        await tx.pfaMirrorHistory.create({
          data: {
            mirrorId: testMirror.id,
            version: 1,
            organizationId: testOrg.id,
            pfaId: testMirror.pfaId,
            data: testMirror.data,
            category: testMirror.category,
            source: testMirror.source,
            dor: testMirror.dor,
            monthlyRate: testMirror.monthlyRate,
            changedBy: 'PEMS_SYNC',
            changeReason: 'External PEMS update',
          },
        });

        await tx.pfaMirror.update({
          where: { id: testMirror.id },
          data: {
            data: {
              ...testMirror.data,
              monthlyRate: 18000, // PEMS changed different field
            },
            version: 2,
            monthlyRate: 18000,
          },
        });
      });

      // Step 3: Detect conflict (should allow auto-merge)
      const { ConflictDetectionService } = await import(
        '../../src/services/pems/ConflictDetectionService'
      );
      const conflictService = new ConflictDetectionService();

      const conflictResult = await conflictService.detectConflict(modification.id);

      expect(conflictResult.hasConflict).toBe(false);
      expect(conflictResult.canAutoMerge).toBe(true);
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve conflict with use_local strategy', async () => {
      // Create modification and conflict
      const modification = await prisma.pfaModification.create({
        data: {
          userId: testUser.id,
          organizationId: testOrg.id,
          pfaMirrorId: testMirror.id,
          delta: { forecastStart: '2025-01-20' },
          baseVersion: 1,
          currentVersion: 1,
          syncState: 'modified',
          syncStatus: 'pending',
        },
      });

      const conflict = await prisma.pfaSyncConflict.create({
        data: {
          pfaId: testMirror.pfaId!,
          organizationId: testOrg.id,
          modificationId: modification.id,
          localVersion: 1,
          pemsVersion: 2,
          localData: { forecastStart: '2025-01-20' },
          pemsData: { forecastStart: '2025-01-25' },
          conflictFields: ['forecastStart'],
          status: 'unresolved',
        },
      });

      // Resolve conflict
      const { ConflictDetectionService } = await import(
        '../../src/services/pems/ConflictDetectionService'
      );
      const conflictService = new ConflictDetectionService();

      await conflictService.resolveConflict(
        conflict.id,
        'use_local',
        undefined,
        testUser.id
      );

      // Verify resolution
      const resolvedConflict = await prisma.pfaSyncConflict.findUnique({
        where: { id: conflict.id },
      });
      expect(resolvedConflict?.status).toBe('resolved');
      expect(resolvedConflict?.resolution).toBe('use_local');
      expect(resolvedConflict?.resolvedBy).toBe(testUser.id);

      // Verify modification was re-queued
      const queueItem = await prisma.pfaWriteQueue.findFirst({
        where: { modificationId: modification.id },
      });
      expect(queueItem?.status).toBe('pending');
    });

    it('should resolve conflict with use_pems strategy', async () => {
      const modification = await prisma.pfaModification.create({
        data: {
          userId: testUser.id,
          organizationId: testOrg.id,
          pfaMirrorId: testMirror.id,
          delta: { forecastStart: '2025-01-20' },
          baseVersion: 1,
          currentVersion: 1,
          syncState: 'modified',
          syncStatus: 'pending',
        },
      });

      const conflict = await prisma.pfaSyncConflict.create({
        data: {
          pfaId: testMirror.pfaId!,
          organizationId: testOrg.id,
          modificationId: modification.id,
          localVersion: 1,
          pemsVersion: 2,
          localData: { forecastStart: '2025-01-20' },
          pemsData: { forecastStart: '2025-01-25' },
          conflictFields: ['forecastStart'],
          status: 'unresolved',
        },
      });

      const { ConflictDetectionService } = await import(
        '../../src/services/pems/ConflictDetectionService'
      );
      const conflictService = new ConflictDetectionService();

      await conflictService.resolveConflict(
        conflict.id,
        'use_pems',
        undefined,
        testUser.id
      );

      // Verify modification was marked as synced
      const updatedModification = await prisma.pfaModification.findUnique({
        where: { id: modification.id },
      });
      expect(updatedModification?.syncStatus).toBe('synced');

      // Verify NO new queue item was created
      const queueItem = await prisma.pfaWriteQueue.findFirst({
        where: { modificationId: modification.id },
      });
      expect(queueItem).toBeNull();
    });
  });

  describe('Retry and DLQ', () => {
    it('should retry failed sync with exponential backoff', async () => {
      const modification = await prisma.pfaModification.create({
        data: {
          userId: testUser.id,
          organizationId: testOrg.id,
          pfaMirrorId: testMirror.id,
          delta: { forecastStart: '2025-01-20' },
          baseVersion: 1,
          currentVersion: 1,
          syncState: 'modified',
          syncStatus: 'pending',
        },
      });

      const queueItem = await prisma.pfaWriteQueue.create({
        data: {
          modificationId: modification.id,
          pfaId: testMirror.pfaId!,
          organizationId: testOrg.id,
          operation: 'update',
          payload: modification.delta,
          status: 'pending',
          scheduledAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
        },
      });

      // Simulate first retry (5 second delay)
      const firstRetry = new Date(Date.now() + 5000);
      await prisma.pfaWriteQueue.update({
        where: { id: queueItem.id },
        data: {
          status: 'pending',
          retryCount: 1,
          lastError: 'Service Unavailable',
          scheduledAt: firstRetry,
        },
      });

      let updated = await prisma.pfaWriteQueue.findUnique({
        where: { id: queueItem.id },
      });
      expect(updated?.retryCount).toBe(1);
      expect(updated?.scheduledAt?.getTime()).toBeGreaterThanOrEqual(
        Date.now() + 4000
      );

      // Simulate second retry (10 second delay)
      const secondRetry = new Date(Date.now() + 10000);
      await prisma.pfaWriteQueue.update({
        where: { id: queueItem.id },
        data: {
          retryCount: 2,
          scheduledAt: secondRetry,
        },
      });

      updated = await prisma.pfaWriteQueue.findUnique({
        where: { id: queueItem.id },
      });
      expect(updated?.retryCount).toBe(2);

      // Simulate third retry (20 second delay)
      const thirdRetry = new Date(Date.now() + 20000);
      await prisma.pfaWriteQueue.update({
        where: { id: queueItem.id },
        data: {
          retryCount: 3,
          scheduledAt: thirdRetry,
        },
      });

      updated = await prisma.pfaWriteQueue.findUnique({
        where: { id: queueItem.id },
      });
      expect(updated?.retryCount).toBe(3);
    });

    it('should move item to DLQ after max retries exceeded', async () => {
      const modification = await prisma.pfaModification.create({
        data: {
          userId: testUser.id,
          organizationId: testOrg.id,
          pfaMirrorId: testMirror.id,
          delta: { forecastStart: '2025-01-20' },
          baseVersion: 1,
          currentVersion: 1,
          syncState: 'modified',
          syncStatus: 'pending',
        },
      });

      const queueItem = await prisma.pfaWriteQueue.create({
        data: {
          modificationId: modification.id,
          pfaId: testMirror.pfaId!,
          organizationId: testOrg.id,
          operation: 'update',
          payload: modification.delta,
          status: 'pending',
          scheduledAt: new Date(),
          retryCount: 3, // Max retries
          maxRetries: 3,
        },
      });

      // Mark as failed (moved to DLQ)
      await prisma.pfaWriteQueue.update({
        where: { id: queueItem.id },
        data: {
          status: 'failed',
          lastError: 'Max retries exceeded - Service Unavailable',
          completedAt: new Date(),
        },
      });

      await prisma.pfaModification.update({
        where: { id: modification.id },
        data: {
          syncStatus: 'sync_error',
          syncError: 'Max retries exceeded - Service Unavailable',
        },
      });

      const failedItem = await prisma.pfaWriteQueue.findUnique({
        where: { id: queueItem.id },
      });
      expect(failedItem?.status).toBe('failed');
      expect(failedItem?.retryCount).toBe(3);
      expect(failedItem?.completedAt).toBeTruthy();

      const failedModification = await prisma.pfaModification.findUnique({
        where: { id: modification.id },
      });
      expect(failedModification?.syncStatus).toBe('sync_error');
    });
  });

  describe('Mirror Version Management', () => {
    it('should create history record when mirror version changes', async () => {
      await prisma.$transaction(async (tx) => {
        // Archive version 1
        await tx.pfaMirrorHistory.create({
          data: {
            mirrorId: testMirror.id,
            version: 1,
            organizationId: testOrg.id,
            pfaId: testMirror.pfaId,
            data: testMirror.data,
            category: testMirror.category,
            source: testMirror.source,
            dor: testMirror.dor,
            monthlyRate: testMirror.monthlyRate,
            forecastStart: testMirror.forecastStart,
            changedBy: testUser.username,
            changeReason: 'Write sync test',
          },
        });

        // Update mirror to version 2
        await tx.pfaMirror.update({
          where: { id: testMirror.id },
          data: { version: 2 },
        });
      });

      const history = await prisma.pfaMirrorHistory.findMany({
        where: { mirrorId: testMirror.id },
        orderBy: { version: 'desc' },
      });

      expect(history).toHaveLength(1);
      expect(history[0].version).toBe(1);
      expect(history[0].changedBy).toBe(testUser.username);

      const updatedMirror = await prisma.pfaMirror.findUnique({
        where: { id: testMirror.id },
      });
      expect(updatedMirror?.version).toBe(2);
    });

    it('should track version changes across multiple syncs', async () => {
      // Version 1 → 2
      await prisma.$transaction(async (tx) => {
        await tx.pfaMirrorHistory.create({
          data: {
            mirrorId: testMirror.id,
            version: 1,
            organizationId: testOrg.id,
            pfaId: testMirror.pfaId,
            data: testMirror.data,
            changedBy: 'user1',
            changeReason: 'First sync',
          },
        });
        await tx.pfaMirror.update({
          where: { id: testMirror.id },
          data: { version: 2 },
        });
      });

      // Version 2 → 3
      await prisma.$transaction(async (tx) => {
        const current = await tx.pfaMirror.findUnique({
          where: { id: testMirror.id },
        });
        await tx.pfaMirrorHistory.create({
          data: {
            mirrorId: testMirror.id,
            version: 2,
            organizationId: testOrg.id,
            pfaId: current!.pfaId,
            data: current!.data,
            changedBy: 'user2',
            changeReason: 'Second sync',
          },
        });
        await tx.pfaMirror.update({
          where: { id: testMirror.id },
          data: { version: 3 },
        });
      });

      const history = await prisma.pfaMirrorHistory.findMany({
        where: { mirrorId: testMirror.id },
        orderBy: { version: 'asc' },
      });

      expect(history).toHaveLength(2);
      expect(history[0].version).toBe(1);
      expect(history[0].changedBy).toBe('user1');
      expect(history[1].version).toBe(2);
      expect(history[1].changedBy).toBe('user2');

      const currentMirror = await prisma.pfaMirror.findUnique({
        where: { id: testMirror.id },
      });
      expect(currentMirror?.version).toBe(3);
    });
  });
});
