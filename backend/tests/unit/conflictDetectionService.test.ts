/**
 * Unit Tests: ConflictDetectionService
 *
 * Tests conflict detection and resolution logic:
 * - Version-based conflict detection
 * - Field-level conflict identification
 * - Auto-merge vs manual resolution
 * - Conflict resolution workflows
 *
 * Phase 4, Gate 2 - Task 4B.2: Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConflictDetectionService } from '../../src/services/pems/ConflictDetectionService';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
vi.mock('../../config/database', () => ({
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
    },
    pfaSyncConflict: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    pfaWriteQueue: {
      create: vi.fn(),
    },
  },
}));

describe('ConflictDetectionService', () => {
  let service: ConflictDetectionService;
  let mockPrisma: any;

  beforeEach(async () => {
    service = new ConflictDetectionService();
    const prismaModule = await import('../../config/database');
    mockPrisma = prismaModule.default;

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('detectConflict', () => {
    it('should return no conflict when modification is based on current mirror version', async () => {
      const modificationId = 'mod-123';

      mockPrisma.pfaModification.findUnique.mockResolvedValue({
        id: modificationId,
        baseVersion: 5,
        delta: { forecastStart: '2025-01-15' },
        organizationId: 'org-123',
        pfaMirror: {
          id: 'mirror-123',
          version: 5,
          pfaId: 'PFA-12345',
          data: { forecastStart: '2025-01-01' },
        },
      });

      const result = await service.detectConflict(modificationId);

      expect(result.hasConflict).toBe(false);
      expect(result.canAutoMerge).toBe(true);
      expect(mockPrisma.pfaSyncConflict.create).not.toHaveBeenCalled();
    });

    it('should detect version mismatch but allow auto-merge when fields do not overlap', async () => {
      const modificationId = 'mod-123';

      mockPrisma.pfaModification.findUnique.mockResolvedValue({
        id: modificationId,
        baseVersion: 3,
        delta: { forecastStart: '2025-01-15' }, // User modified forecastStart
        organizationId: 'org-123',
        pfaMirror: {
          id: 'mirror-123',
          version: 5,
          pfaId: 'PFA-12345',
          data: { forecastEnd: '2025-06-30' }, // PEMS modified forecastEnd
        },
      });

      // Mock history showing forecastEnd was changed (not forecastStart)
      mockPrisma.pfaMirrorHistory.findMany.mockResolvedValue([
        {
          version: 4,
          data: { forecastEnd: '2025-05-31' },
        },
        {
          version: 5,
          data: { forecastEnd: '2025-06-30' },
        },
      ]);

      const result = await service.detectConflict(modificationId);

      expect(result.hasConflict).toBe(false);
      expect(result.canAutoMerge).toBe(true);
      expect(mockPrisma.pfaSyncConflict.create).not.toHaveBeenCalled();
    });

    it('should create conflict record when same field is modified in both local and PEMS', async () => {
      const modificationId = 'mod-123';

      mockPrisma.pfaModification.findUnique.mockResolvedValue({
        id: modificationId,
        baseVersion: 3,
        delta: { forecastStart: '2025-01-15' }, // User modified forecastStart
        organizationId: 'org-123',
        pfaMirror: {
          id: 'mirror-123',
          version: 5,
          pfaId: 'PFA-12345',
          data: { forecastStart: '2025-02-01' }, // PEMS also modified forecastStart
        },
      });

      // Mock history showing forecastStart was changed
      mockPrisma.pfaMirrorHistory.findMany.mockResolvedValue([
        {
          version: 4,
          data: { forecastStart: '2025-01-01' },
        },
        {
          version: 5,
          data: { forecastStart: '2025-02-01' },
        },
      ]);

      mockPrisma.pfaSyncConflict.create.mockResolvedValue({
        id: 'conflict-123',
        pfaId: 'PFA-12345',
        localVersion: 3,
        pemsVersion: 5,
        localData: { forecastStart: '2025-01-15' },
        pemsData: { forecastStart: '2025-02-01' },
        conflictFields: ['forecastStart'],
        status: 'unresolved',
      });

      const result = await service.detectConflict(modificationId);

      expect(result.hasConflict).toBe(true);
      expect(result.canAutoMerge).toBe(false);
      expect(result.conflict).toBeDefined();
      expect(result.conflict?.conflictFields).toContain('forecastStart');
      expect(mockPrisma.pfaSyncConflict.create).toHaveBeenCalledOnce();
    });

    it('should identify multiple conflicting fields', async () => {
      const modificationId = 'mod-123';

      mockPrisma.pfaModification.findUnique.mockResolvedValue({
        id: modificationId,
        baseVersion: 3,
        delta: {
          forecastStart: '2025-01-15',
          monthlyRate: 18000,
          category: 'Excavators',
        },
        organizationId: 'org-123',
        pfaMirror: {
          id: 'mirror-123',
          version: 5,
          pfaId: 'PFA-12345',
          data: {
            forecastStart: '2025-02-01',
            monthlyRate: 20000,
          },
        },
      });

      mockPrisma.pfaMirrorHistory.findMany.mockResolvedValue([
        {
          version: 4,
          data: {
            forecastStart: '2025-01-01',
            monthlyRate: 15000,
          },
        },
        {
          version: 5,
          data: {
            forecastStart: '2025-02-01',
            monthlyRate: 20000,
          },
        },
      ]);

      mockPrisma.pfaSyncConflict.create.mockResolvedValue({
        id: 'conflict-123',
        conflictFields: ['forecastStart', 'monthlyRate'],
      });

      const result = await service.detectConflict(modificationId);

      expect(result.hasConflict).toBe(true);
      expect(result.conflict?.conflictFields).toHaveLength(2);
      expect(result.conflict?.conflictFields).toContain('forecastStart');
      expect(result.conflict?.conflictFields).toContain('monthlyRate');
    });

    it('should throw error when modification not found', async () => {
      mockPrisma.pfaModification.findUnique.mockResolvedValue(null);

      await expect(service.detectConflict('invalid-id')).rejects.toThrow(
        'Modification invalid-id not found'
      );
    });
  });

  describe('resolveConflict', () => {
    const mockConflict = {
      id: 'conflict-123',
      modificationId: 'mod-123',
      pfaId: 'PFA-12345',
      organizationId: 'org-123',
      localVersion: 3,
      pemsVersion: 5,
      localData: { forecastStart: '2025-01-15' },
      pemsData: { forecastStart: '2025-02-01' },
      status: 'unresolved',
      modification: {
        id: 'mod-123',
        pfaMirror: {
          id: 'mirror-123',
        },
      },
    };

    beforeEach(() => {
      mockPrisma.pfaSyncConflict.findUnique.mockResolvedValue(mockConflict);
      mockPrisma.pfaSyncConflict.update.mockResolvedValue({});
      mockPrisma.pfaModification.update.mockResolvedValue({});
      mockPrisma.pfaWriteQueue.create.mockResolvedValue({});
    });

    it('should resolve conflict with use_local strategy', async () => {
      await service.resolveConflict('conflict-123', 'use_local', undefined, 'user-123');

      expect(mockPrisma.pfaSyncConflict.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conflict-123' },
          data: expect.objectContaining({
            status: 'resolved',
            resolution: 'use_local',
            resolvedBy: 'user-123',
          }),
        })
      );

      expect(mockPrisma.pfaModification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mod-123' },
          data: expect.objectContaining({
            syncState: 'pending_sync',
            baseVersion: 5, // Updated to PEMS version
          }),
        })
      );

      expect(mockPrisma.pfaWriteQueue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'pending',
            operation: 'update',
          }),
        })
      );
    });

    it('should resolve conflict with use_pems strategy', async () => {
      await service.resolveConflict('conflict-123', 'use_pems', undefined, 'user-123');

      expect(mockPrisma.pfaSyncConflict.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'resolved',
            resolution: 'use_pems',
          }),
        })
      );

      expect(mockPrisma.pfaModification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            syncStatus: 'synced',
            baseVersion: 5,
            currentVersion: 5,
          }),
        })
      );

      // Should NOT re-queue for sync
      expect(mockPrisma.pfaWriteQueue.create).not.toHaveBeenCalled();
    });

    it('should resolve conflict with merge strategy', async () => {
      const mergedData = { forecastStart: '2025-01-20' };

      await service.resolveConflict('conflict-123', 'merge', mergedData, 'user-123');

      expect(mockPrisma.pfaSyncConflict.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'resolved',
            resolution: 'merge',
            mergedData,
          }),
        })
      );

      expect(mockPrisma.pfaModification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            delta: mergedData,
            syncState: 'pending_sync',
          }),
        })
      );

      expect(mockPrisma.pfaWriteQueue.create).toHaveBeenCalled();
    });

    it('should throw error when merge data is missing for merge strategy', async () => {
      await expect(
        service.resolveConflict('conflict-123', 'merge', undefined, 'user-123')
      ).rejects.toThrow('Merged data required for merge resolution');
    });

    it('should throw error when conflict is already resolved', async () => {
      mockPrisma.pfaSyncConflict.findUnique.mockResolvedValue({
        ...mockConflict,
        status: 'resolved',
      });

      await expect(
        service.resolveConflict('conflict-123', 'use_local', undefined, 'user-123')
      ).rejects.toThrow('Conflict conflict-123 is already resolved');
    });

    it('should throw error when conflict not found', async () => {
      mockPrisma.pfaSyncConflict.findUnique.mockResolvedValue(null);

      await expect(
        service.resolveConflict('invalid-id', 'use_local', undefined, 'user-123')
      ).rejects.toThrow('Conflict invalid-id not found');
    });
  });

  describe('getUnresolvedConflicts', () => {
    it('should return all unresolved conflicts for an organization', async () => {
      const mockConflicts = [
        {
          id: 'conflict-1',
          pfaId: 'PFA-001',
          localVersion: 3,
          pemsVersion: 5,
          conflictFields: ['forecastStart'],
          localData: {},
          pemsData: {},
          createdAt: new Date('2025-01-15'),
          modification: {
            users: {
              id: 'user-1',
              username: 'editor1',
              email: 'editor1@test.com',
            },
          },
        },
        {
          id: 'conflict-2',
          pfaId: 'PFA-002',
          localVersion: 2,
          pemsVersion: 4,
          conflictFields: ['monthlyRate'],
          localData: {},
          pemsData: {},
          createdAt: new Date('2025-01-16'),
          modification: {
            users: {
              id: 'user-2',
              username: 'editor2',
              email: 'editor2@test.com',
            },
          },
        },
      ];

      mockPrisma.pfaSyncConflict.findMany.mockResolvedValue(mockConflicts);

      const result = await service.getUnresolvedConflicts('org-123');

      expect(result).toHaveLength(2);
      expect(result[0].pfaId).toBe('PFA-001');
      expect(result[0].conflictFields).toContain('forecastStart');
      expect(result[0].modifiedBy.username).toBe('editor1');
      expect(result[1].pfaId).toBe('PFA-002');
    });

    it('should return empty array when no conflicts exist', async () => {
      mockPrisma.pfaSyncConflict.findMany.mockResolvedValue([]);

      const result = await service.getUnresolvedConflicts('org-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('Field Change Detection', () => {
    it('should detect changes in primitive values', async () => {
      const modificationId = 'mod-123';

      mockPrisma.pfaModification.findUnique.mockResolvedValue({
        id: modificationId,
        baseVersion: 3,
        delta: { monthlyRate: 20000 },
        organizationId: 'org-123',
        pfaMirror: {
          id: 'mirror-123',
          version: 4,
          pfaId: 'PFA-12345',
          data: {},
        },
      });

      mockPrisma.pfaMirrorHistory.findMany.mockResolvedValue([
        {
          version: 4,
          data: { monthlyRate: 15000 },
        },
        {
          version: 5,
          data: { monthlyRate: 18000 },
        },
      ]);

      mockPrisma.pfaSyncConflict.create.mockResolvedValue({
        id: 'conflict-123',
        conflictFields: ['monthlyRate'],
      });

      await service.detectConflict(modificationId);

      expect(mockPrisma.pfaSyncConflict.create).toHaveBeenCalled();
    });

    it('should detect changes in date values', async () => {
      const modificationId = 'mod-123';

      mockPrisma.pfaModification.findUnique.mockResolvedValue({
        id: modificationId,
        baseVersion: 3,
        delta: { forecastStart: new Date('2025-01-15') },
        organizationId: 'org-123',
        pfaMirror: {
          id: 'mirror-123',
          version: 4,
          pfaId: 'PFA-12345',
          data: {},
        },
      });

      mockPrisma.pfaMirrorHistory.findMany.mockResolvedValue([
        {
          version: 4,
          data: { forecastStart: new Date('2025-01-01') },
        },
        {
          version: 5,
          data: { forecastStart: new Date('2025-02-01') },
        },
      ]);

      mockPrisma.pfaSyncConflict.create.mockResolvedValue({
        id: 'conflict-123',
        conflictFields: ['forecastStart'],
      });

      await service.detectConflict(modificationId);

      expect(mockPrisma.pfaSyncConflict.create).toHaveBeenCalled();
    });

    it('should ignore changes to null/undefined fields', async () => {
      const modificationId = 'mod-123';

      mockPrisma.pfaModification.findUnique.mockResolvedValue({
        id: modificationId,
        baseVersion: 4,
        delta: { category: 'Excavators' },
        organizationId: 'org-123',
        pfaMirror: {
          id: 'mirror-123',
          version: 5,
          pfaId: 'PFA-12345',
          data: {},
        },
      });

      mockPrisma.pfaMirrorHistory.findMany.mockResolvedValue([
        {
          version: 4,
          data: { actualStart: null },
        },
        {
          version: 5,
          data: { actualStart: undefined },
        },
      ]);

      const result = await service.detectConflict(modificationId);

      expect(result.hasConflict).toBe(false);
    });
  });
});
