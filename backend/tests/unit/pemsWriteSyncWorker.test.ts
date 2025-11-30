/**
 * Unit Tests: PemsWriteSyncWorker
 *
 * Tests background worker logic:
 * - Queue processing and batching
 * - Rate limiting (10 req/sec)
 * - Retry logic with exponential backoff
 * - Conflict detection integration
 * - WebSocket event broadcasting
 *
 * Phase 4, Gate 2 - Task 4B.2: Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PemsWriteSyncWorker } from '../../src/services/pems/PemsWriteSyncWorker';

// Mock dependencies
vi.mock('../../config/database');
vi.mock('../../src/services/pems/PemsWriteApiClient');
vi.mock('../../src/services/pems/ConflictDetectionService');
vi.mock('../../src/services/pfa/PfaValidationService');

describe('PemsWriteSyncWorker', () => {
  let worker: PemsWriteSyncWorker;
  let mockPrisma: any;
  let mockApiClient: any;
  let mockConflictService: any;
  let mockValidationService: any;

  beforeEach(async () => {
    worker = new PemsWriteSyncWorker();

    const prismaModule = await import('../../config/database');
    mockPrisma = prismaModule.default;

    const apiClientModule = await import('../../src/services/pems/PemsWriteApiClient');
    mockApiClient = {
      updatePfa: vi.fn(),
      deletePfa: vi.fn(),
      healthCheck: vi.fn(),
    };
    (apiClientModule.PemsWriteApiClient as any).fromApiConfig = vi
      .fn()
      .mockResolvedValue(mockApiClient);

    const conflictModule = await import('../../src/services/pems/ConflictDetectionService');
    mockConflictService = conflictModule.conflictDetectionService;

    const validationModule = await import('../../src/services/pfa/PfaValidationService');
    mockValidationService = validationModule.pfaValidationService;

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Retry Logic', () => {
    it('should calculate exponential backoff correctly', () => {
      // Access private method via reflection
      const calculateRetryDelay = (worker as any).calculateRetryDelay.bind(worker);

      expect(calculateRetryDelay(0)).toBe(5000); // 5 seconds base
      expect(calculateRetryDelay(1)).toBe(10000); // 10 seconds (5 * 2^1)
      expect(calculateRetryDelay(2)).toBe(20000); // 20 seconds (5 * 2^2)
      expect(calculateRetryDelay(3)).toBe(40000); // 40 seconds (5 * 2^3)
    });

    it('should retry on retryable errors (5xx, 429)', () => {
      const shouldRetry = (worker as any).shouldRetry.bind(worker);

      const retryableItem = { retryCount: 1, maxRetries: 3 };

      // 503 Service Unavailable - retryable
      expect(
        shouldRetry(retryableItem, {
          success: false,
          errorCode: 'SERVICE_UNAVAILABLE',
        })
      ).toBe(true);

      // 500 Server Error - retryable
      expect(
        shouldRetry(retryableItem, {
          success: false,
          errorCode: 'SERVER_ERROR',
        })
      ).toBe(true);

      // 429 Rate Limit - retryable
      expect(
        shouldRetry(retryableItem, {
          success: false,
          errorCode: 'RATE_LIMIT',
        })
      ).toBe(true);
    });

    it('should not retry on non-retryable errors (4xx)', () => {
      const shouldRetry = (worker as any).shouldRetry.bind(worker);

      const item = { retryCount: 1, maxRetries: 3 };

      // 400 Bad Request - non-retryable
      expect(
        shouldRetry(item, {
          success: false,
          errorCode: 'INVALID_REQUEST',
        })
      ).toBe(false);

      // 401 Unauthorized - non-retryable
      expect(
        shouldRetry(item, {
          success: false,
          errorCode: 'UNAUTHORIZED',
        })
      ).toBe(false);

      // 404 Not Found - non-retryable
      expect(
        shouldRetry(item, {
          success: false,
          errorCode: 'NOT_FOUND',
        })
      ).toBe(false);

      // 409 Conflict - non-retryable
      expect(
        shouldRetry(item, {
          success: false,
          errorCode: 'VERSION_CONFLICT',
        })
      ).toBe(false);
    });

    it('should not retry when max retries exceeded', () => {
      const shouldRetry = (worker as any).shouldRetry.bind(worker);

      const exhaustedItem = { retryCount: 3, maxRetries: 3 };

      expect(
        shouldRetry(exhaustedItem, {
          success: false,
          errorCode: 'SERVICE_UNAVAILABLE',
        })
      ).toBe(false);
    });
  });

  describe('Worker Status', () => {
    it('should track worker running state', () => {
      const initialStatus = worker.getStatus();

      expect(initialStatus.isRunning).toBe(false);
      expect(initialStatus.currentBatchId).toBeNull();
    });

    it('should prevent concurrent worker execution', async () => {
      // Mock empty queue
      mockPrisma.pfaWriteQueue.findMany.mockResolvedValue([]);

      // Start first worker instance
      const firstRun = worker.start();

      // Immediately start second instance (should be rejected)
      const secondRun = worker.start();

      await Promise.all([firstRun, secondRun]);

      // Only one batch should be processed
      expect(mockPrisma.pfaWriteQueue.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('Queue Batching', () => {
    it('should process items in batches of 100', async () => {
      const items = Array.from({ length: 150 }, (_, i) => ({
        id: `item-${i}`,
        pfaId: `PFA-${i}`,
        organizationId: 'org-123',
        operation: 'update',
        payload: {},
        status: 'pending',
        scheduledAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
      }));

      mockPrisma.pfaWriteQueue.findMany.mockResolvedValue(items);

      await worker.start();

      // Should fetch up to 100 items (BATCH_SIZE)
      expect(mockPrisma.pfaWriteQueue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });

    it('should prioritize high-priority items', async () => {
      mockPrisma.pfaWriteQueue.findMany.mockResolvedValue([]);

      await worker.start();

      expect(mockPrisma.pfaWriteQueue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ priority: 'desc' }, { scheduledAt: 'asc' }],
        })
      );
    });

    it('should only process items scheduled for now or past', async () => {
      mockPrisma.pfaWriteQueue.findMany.mockResolvedValue([]);

      await worker.start();

      expect(mockPrisma.pfaWriteQueue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            scheduledAt: { lte: expect.any(Date) },
          }),
        })
      );
    });
  });

  describe('Rate Limiting', () => {
    it('should process items with rate limit of 10 req/sec', async () => {
      const items = Array.from({ length: 25 }, (_, i) => ({
        id: `item-${i}`,
        pfaId: `PFA-${i}`,
        organizationId: 'org-123',
        operation: 'update',
        payload: {},
        status: 'pending',
        scheduledAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
        modification: {
          id: `mod-${i}`,
          users: { id: 'user-1', username: 'editor1' },
          pfaMirror: {
            id: `mirror-${i}`,
            version: 1,
            data: {},
          },
        },
      }));

      mockPrisma.pfaWriteQueue.findMany.mockResolvedValue(items);
      mockPrisma.pfaWriteQueue.update.mockResolvedValue({});
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-123',
        code: 'TEST_ORG',
        apiServers: [
          {
            id: 'server-1',
            apiEndpoints: [{ entity: 'PFA', operationType: 'write', isActive: true }],
          },
        ],
      });

      mockConflictService.detectConflict.mockResolvedValue({
        hasConflict: false,
        canAutoMerge: true,
      });

      mockValidationService.validateModification.mockReturnValue({
        valid: true,
        errors: [],
      });

      mockApiClient.updatePfa.mockResolvedValue({
        success: true,
        newVersion: 2,
      });

      mockPrisma.$transaction.mockImplementation((callback: any) =>
        callback(mockPrisma)
      );

      const startTime = Date.now();
      await worker.start();
      const duration = Date.now() - startTime;

      // 25 items in chunks of 10, with 1-second delays between chunks
      // Should take at least 2 seconds (3 chunks - 1 delay)
      expect(duration).toBeGreaterThanOrEqual(2000);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing organization gracefully', async () => {
      const items = [
        {
          id: 'item-1',
          pfaId: 'PFA-001',
          organizationId: 'org-invalid',
          operation: 'update',
          payload: {},
          status: 'pending',
          scheduledAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
          modification: {
            id: 'mod-1',
            users: { username: 'editor1' },
            pfaMirror: { id: 'mirror-1', version: 1, data: {} },
          },
        },
      ];

      mockPrisma.pfaWriteQueue.findMany.mockResolvedValue(items);
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      mockPrisma.pfaWriteQueue.updateMany.mockResolvedValue({});

      const stats = await (worker as any).processQueue();

      expect(stats.failed).toBe(1);
      expect(mockPrisma.pfaWriteQueue.updateMany).toHaveBeenCalled();
    });

    it('should skip items when no write API is configured', async () => {
      const items = [
        {
          id: 'item-1',
          pfaId: 'PFA-001',
          organizationId: 'org-123',
          operation: 'update',
          payload: {},
          status: 'pending',
          scheduledAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
          modification: {
            id: 'mod-1',
            users: { username: 'editor1' },
            pfaMirror: { id: 'mirror-1', version: 1, data: {} },
          },
        },
      ];

      mockPrisma.pfaWriteQueue.findMany.mockResolvedValue(items);
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-123',
        code: 'TEST_ORG',
        apiServers: [], // No write-enabled API servers
      });
      mockPrisma.pfaWriteQueue.updateMany.mockResolvedValue({});

      const stats = await (worker as any).processQueue();

      expect(stats.skipped).toBe(1);
    });

    it('should handle validation errors', async () => {
      const items = [
        {
          id: 'item-1',
          pfaId: 'PFA-001',
          organizationId: 'org-123',
          operation: 'update',
          payload: { forecastEnd: '2025-01-01', forecastStart: '2025-06-30' },
          status: 'pending',
          scheduledAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
          modification: {
            id: 'mod-1',
            users: { username: 'editor1' },
            pfaMirror: { id: 'mirror-1', version: 1, data: {} },
          },
        },
      ];

      mockPrisma.pfaWriteQueue.findMany.mockResolvedValue(items);
      mockPrisma.pfaWriteQueue.update.mockResolvedValue({});
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-123',
        code: 'TEST_ORG',
        apiServers: [
          {
            id: 'server-1',
            apiEndpoints: [{ entity: 'PFA', operationType: 'write', isActive: true }],
          },
        ],
      });

      mockConflictService.detectConflict.mockResolvedValue({
        hasConflict: false,
        canAutoMerge: true,
      });

      mockValidationService.validateModification.mockReturnValue({
        valid: false,
        errors: [{ field: 'forecastEnd', message: 'Invalid date order', code: 'INVALID_DATE_ORDER' }],
      });

      const stats = await (worker as any).processQueue();

      expect(stats.failed).toBe(1);
      expect(mockApiClient.updatePfa).not.toHaveBeenCalled();
    });
  });

  describe('Conflict Detection Integration', () => {
    it('should detect conflicts before attempting sync', async () => {
      const items = [
        {
          id: 'item-1',
          pfaId: 'PFA-001',
          organizationId: 'org-123',
          operation: 'update',
          payload: {},
          status: 'pending',
          scheduledAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
          modification: {
            id: 'mod-1',
            users: { username: 'editor1' },
            pfaMirror: { id: 'mirror-1', version: 1, data: {} },
          },
        },
      ];

      mockPrisma.pfaWriteQueue.findMany.mockResolvedValue(items);
      mockPrisma.pfaWriteQueue.update.mockResolvedValue({});
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-123',
        code: 'TEST_ORG',
        apiServers: [
          {
            id: 'server-1',
            apiEndpoints: [{ entity: 'PFA', operationType: 'write', isActive: true }],
          },
        ],
      });

      mockConflictService.detectConflict.mockResolvedValue({
        hasConflict: true,
        canAutoMerge: false,
        conflict: {
          id: 'conflict-123',
          conflictingFields: ['forecastStart'],
        },
      });

      const stats = await (worker as any).processQueue();

      expect(stats.conflicts).toBe(1);
      expect(mockApiClient.updatePfa).not.toHaveBeenCalled();
    });

    it('should proceed with sync when no conflict detected', async () => {
      const items = [
        {
          id: 'item-1',
          pfaId: 'PFA-001',
          organizationId: 'org-123',
          operation: 'update',
          payload: {},
          status: 'pending',
          scheduledAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
          modification: {
            id: 'mod-1',
            users: { id: 'user-1', username: 'editor1' },
            pfaMirror: { id: 'mirror-1', version: 1, data: { organization: 'TEST_ORG' } },
          },
        },
      ];

      mockPrisma.pfaWriteQueue.findMany.mockResolvedValue(items);
      mockPrisma.pfaWriteQueue.update.mockResolvedValue({});
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-123',
        code: 'TEST_ORG',
        apiServers: [
          {
            id: 'server-1',
            apiEndpoints: [{ entity: 'PFA', operationType: 'write', isActive: true }],
          },
        ],
      });

      mockConflictService.detectConflict.mockResolvedValue({
        hasConflict: false,
        canAutoMerge: true,
      });

      mockValidationService.validateModification.mockReturnValue({
        valid: true,
        errors: [],
      });

      mockApiClient.updatePfa.mockResolvedValue({
        success: true,
        newVersion: 2,
        updatedAt: '2025-01-15T10:00:00Z',
      });

      mockPrisma.$transaction.mockImplementation((callback: any) =>
        callback(mockPrisma)
      );
      mockPrisma.pfaModification.update.mockResolvedValue({});
      mockPrisma.pfaMirrorHistory.create.mockResolvedValue({});
      mockPrisma.pfaMirror.update.mockResolvedValue({});

      const stats = await (worker as any).processQueue();

      expect(stats.successful).toBe(1);
      expect(mockApiClient.updatePfa).toHaveBeenCalled();
    });
  });

  describe('Field Extraction', () => {
    it('should extract indexed fields from JSONB data', () => {
      const extractIndexedFields = (worker as any).extractIndexedFields.bind(worker);

      const data = {
        pfaId: 'PFA-12345',
        category: 'Excavators',
        class: '20-30 Ton',
        source: 'Rental',
        dor: 'PROJECT',
        monthlyRate: 15000,
        forecastStart: '2025-01-01',
        forecastEnd: '2025-06-30',
        isActualized: true,
        customField: 'should be ignored',
      };

      const indexed = extractIndexedFields(data);

      expect(indexed.category).toBe('Excavators');
      expect(indexed.class).toBe('20-30 Ton');
      expect(indexed.source).toBe('Rental');
      expect(indexed.dor).toBe('PROJECT');
      expect(indexed.monthlyRate).toBe(15000);
      expect(indexed.forecastStart).toBeInstanceOf(Date);
      expect(indexed.isActualized).toBe(true);
      expect(indexed.customField).toBeUndefined();
    });

    it('should handle null values in indexed fields', () => {
      const extractIndexedFields = (worker as any).extractIndexedFields.bind(worker);

      const data = {
        category: null,
        monthlyRate: null,
        isActualized: false,
      };

      const indexed = extractIndexedFields(data);

      expect(indexed.category).toBeNull();
      expect(indexed.monthlyRate).toBeNull();
      expect(indexed.isActualized).toBe(false);
    });
  });
});
