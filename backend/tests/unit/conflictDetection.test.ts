/**
 * Conflict Detection Service Unit Tests
 *
 * Tests for version conflict detection and field-level diff logic
 * Phase 2, Track A - Task 2A.7: Unit Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConflictDetectionService } from '../../src/services/pems/ConflictDetectionService';
import prisma from '../../src/config/database';

// Mock Prisma
vi.mock('../../src/config/database', () => ({
  default: {
    pfaModification: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    pfaMirror: {
      findUnique: vi.fn(),
    },
    pfaMirrorHistory: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    pfaSyncConflict: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    pfaWriteQueue: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
  },
}));

describe('ConflictDetectionService', () => {
  let service: ConflictDetectionService;

  beforeEach(() => {
    service = new ConflictDetectionService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectConflict', () => {
    it('should return no conflict when baseVersion >= mirrorVersion', async () => {
      const mockModification = {
        id: 'mod-1',
        baseVersion: 5,
        delta: { forecastStart: '2025-01-15' },
        pfaMirror: {
          id: 'mirror-1',
          version: 5,
          pfaId: 'PFA-123',
        },
      };

      vi.mocked(prisma.pfaModification.findUnique).mockResolvedValue(mockModification as any);

      const result = await service.detectConflict('mod-1');

      expect(result.hasConflict).toBe(false);
      expect(result.canAutoMerge).toBe(true);
      expect(result.conflict).toBeUndefined();
    });

    it('should detect non-overlapping changes and allow auto-merge', async () => {
      const mockModification = {
        id: 'mod-1',
        baseVersion: 3,
        delta: { forecastStart: '2025-01-15' },
        organizationId: 'org-1',
        pfaMirror: {
          id: 'mirror-1',
          version: 5,
          pfaId: 'PFA-123',
          data: {},
        },
      };

      const mockHistory = [
        {
          version: 4,
          data: { monthlyRate: 5000 },
        },
        {
          version: 5,
          data: { monthlyRate: 5500 },
        },
      ];

      vi.mocked(prisma.pfaModification.findUnique).mockResolvedValue(mockModification as any);
      vi.mocked(prisma.pfaMirrorHistory.findMany).mockResolvedValue(mockHistory as any);

      const result = await service.detectConflict('mod-1');

      expect(result.hasConflict).toBe(false);
      expect(result.canAutoMerge).toBe(true);
    });

    it('should detect overlapping changes and create conflict record', async () => {
      const mockModification = {
        id: 'mod-1',
        baseVersion: 3,
        delta: { forecastStart: '2025-01-15', monthlyRate: 6000 },
        organizationId: 'org-1',
        pfaMirror: {
          id: 'mirror-1',
          version: 5,
          pfaId: 'PFA-123',
          data: { monthlyRate: 5500 },
        },
      };

      const mockHistory = [
        {
          version: 4,
          data: { monthlyRate: 5000 },
        },
        {
          version: 5,
          data: { monthlyRate: 5500 },
        },
      ];

      const mockConflict = {
        id: 'conflict-1',
        pfaId: 'PFA-123',
        localVersion: 3,
        pemsVersion: 5,
        conflictFields: ['monthlyRate'],
        localData: mockModification.delta,
        pemsData: mockModification.pfaMirror.data,
      };

      vi.mocked(prisma.pfaModification.findUnique).mockResolvedValue(mockModification as any);
      vi.mocked(prisma.pfaMirrorHistory.findMany).mockResolvedValue(mockHistory as any);
      vi.mocked(prisma.pfaSyncConflict.create).mockResolvedValue(mockConflict as any);

      const result = await service.detectConflict('mod-1');

      expect(result.hasConflict).toBe(true);
      expect(result.canAutoMerge).toBe(false);
      expect(result.conflict).toBeDefined();
      expect(result.conflict?.conflictFields).toContain('monthlyRate');
    });
  });

  describe('resolveConflict', () => {
    it('should resolve conflict with use_local strategy', async () => {
      const mockConflict = {
        id: 'conflict-1',
        status: 'unresolved',
        modificationId: 'mod-1',
        organizationId: 'org-1',
        pfaId: 'PFA-123',
        localData: { monthlyRate: 6000 },
        pemsData: { monthlyRate: 5500 },
        pemsVersion: 5,
        modification: {
          id: 'mod-1',
          pfaMirror: {
            id: 'mirror-1',
          },
        },
      };

      vi.mocked(prisma.pfaSyncConflict.findUnique).mockResolvedValue(mockConflict as any);
      vi.mocked(prisma.pfaSyncConflict.update).mockResolvedValue(mockConflict as any);
      vi.mocked(prisma.pfaModification.update).mockResolvedValue({} as any);
      vi.mocked(prisma.pfaWriteQueue.create).mockResolvedValue({} as any);

      await service.resolveConflict('conflict-1', 'use_local', undefined, 'user-1');

      expect(prisma.pfaSyncConflict.update).toHaveBeenCalledWith({
        where: { id: 'conflict-1' },
        data: expect.objectContaining({
          status: 'resolved',
          resolution: 'use_local',
          resolvedBy: 'user-1',
        }),
      });

      expect(prisma.pfaModification.update).toHaveBeenCalled();
      expect(prisma.pfaWriteQueue.create).toHaveBeenCalled();
    });

    it('should resolve conflict with use_pems strategy', async () => {
      const mockConflict = {
        id: 'conflict-1',
        status: 'unresolved',
        modificationId: 'mod-1',
        organizationId: 'org-1',
        pfaId: 'PFA-123',
        localData: { monthlyRate: 6000 },
        pemsData: { monthlyRate: 5500 },
        pemsVersion: 5,
        modification: {
          id: 'mod-1',
          pfaMirror: {
            id: 'mirror-1',
          },
        },
      };

      vi.mocked(prisma.pfaSyncConflict.findUnique).mockResolvedValue(mockConflict as any);
      vi.mocked(prisma.pfaSyncConflict.update).mockResolvedValue(mockConflict as any);
      vi.mocked(prisma.pfaModification.update).mockResolvedValue({} as any);

      await service.resolveConflict('conflict-1', 'use_pems', undefined, 'user-1');

      expect(prisma.pfaSyncConflict.update).toHaveBeenCalledWith({
        where: { id: 'conflict-1' },
        data: expect.objectContaining({
          status: 'resolved',
          resolution: 'use_pems',
          resolvedBy: 'user-1',
        }),
      });

      expect(prisma.pfaModification.update).toHaveBeenCalledWith({
        where: { id: 'mod-1' },
        data: expect.objectContaining({
          syncStatus: 'synced',
          baseVersion: 5,
          currentVersion: 5,
        }),
      });

      // Should NOT queue for sync when using PEMS version
      expect(prisma.pfaWriteQueue.create).not.toHaveBeenCalled();
    });

    it('should reject merge resolution without merged data', async () => {
      const mockConflict = {
        id: 'conflict-1',
        status: 'unresolved',
        modification: {
          id: 'mod-1',
        },
      };

      vi.mocked(prisma.pfaSyncConflict.findUnique).mockResolvedValue(mockConflict as any);

      await expect(
        service.resolveConflict('conflict-1', 'merge', undefined, 'user-1')
      ).rejects.toThrow('Merged data required for merge resolution');
    });

    it('should reject resolution of already resolved conflict', async () => {
      const mockConflict = {
        id: 'conflict-1',
        status: 'resolved',
      };

      vi.mocked(prisma.pfaSyncConflict.findUnique).mockResolvedValue(mockConflict as any);

      await expect(
        service.resolveConflict('conflict-1', 'use_local', undefined, 'user-1')
      ).rejects.toThrow('Conflict conflict-1 is already resolved');
    });
  });
});
