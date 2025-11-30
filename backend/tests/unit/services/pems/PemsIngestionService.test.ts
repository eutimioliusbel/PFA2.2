/**
 * Unit Tests for PemsIngestionService
 *
 * ADR-007 Phase 2, Task 2.1 & 2.2: Core Ingestion + Delta Sync
 *
 * Tests ingestion logic including:
 * - Full sync ingestion (Task 2.1)
 * - Delta sync strategies (Task 2.2)
 * - Pagination and bulk insert
 * - Schema fingerprinting
 * - Progress tracking
 * - Error handling and recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PemsIngestionService } from '../../../../src/services/pems/PemsIngestionService';
import { SchemaDriftDetector } from '../../../../src/services/pems/SchemaDriftDetector';
import axios from 'axios';

// Mock Prisma client
vi.mock('../../../../src/config/database', () => ({
  default: {
    api_endpoints: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    api_servers: {
      findUnique: vi.fn(),
    },
    bronzeBatch: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    bronzeRecord: {
      createMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    $executeRawUnsafe: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock encryption utilities
vi.mock('../../../../src/utils/encryption', () => ({
  decrypt: vi.fn((value: string) => value), // Pass-through for tests
  encrypt: vi.fn((value: string) => value),
}));

// Mock SchemaDriftDetector
vi.mock('../../../../src/services/pems/SchemaDriftDetector', () => {
  const MockSchemaDriftDetector = vi.fn().mockImplementation(function(this: any) {
    this.detectDrift = vi.fn().mockResolvedValue({
      hasDrift: false,
      missingFields: [],
      newFields: [],
      changedTypes: {},
      severity: 'low',
    });
    this.createAlert = vi.fn();
  });

  return {
    SchemaDriftDetector: MockSchemaDriftDetector,
  };
});

// Mock axios for API calls (service uses axios, not fetch)
vi.mock('axios', () => {
  return {
    default: {
      get: vi.fn(),
      post: vi.fn(),
    },
  };
});

describe('PemsIngestionService', () => {
  let service: PemsIngestionService;
  let mockPrisma: any;
  let mockAxios: any;

  const mockEndpoint = {
    id: 'endpoint-1',
    serverId: 'server-1',
    name: 'PEMS Read API',
    path: '/api/pems/data',
    method: 'GET',
    entity: 'PFA',
    supportsDelta: true,
    deltaField: 'updated_at',
    deltaStrategy: 'timestamp',
    pageSize: 1000,
    isActive: true,
  };

  const mockServer = {
    id: 'server-1',
    organizationId: 'org-1',
    name: 'PEMS Production',
    baseUrl: 'https://api.pems.example.com',
    authType: 'basic',
    authKeyEncrypted: 'test-user',
    authValueEncrypted: 'test-pass',
    isActive: true,
  };

  beforeEach(async () => {
    // Import the mocked modules
    const { default: prisma } = await import('../../../../src/config/database');
    const axiosModule = await import('axios');

    mockPrisma = prisma;
    mockAxios = axiosModule.default as any;

    service = new PemsIngestionService();
    vi.clearAllMocks();

    // Default mock responses
    mockPrisma.api_endpoints.findUnique.mockResolvedValue(mockEndpoint);
    mockPrisma.api_servers.findUnique.mockResolvedValue(mockServer);
    mockPrisma.bronzeBatch.create.mockResolvedValue({
      syncBatchId: 'batch-123',
      ingestedAt: new Date(),
    });
    mockPrisma.bronzeRecord.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.bronzeBatch.update.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('ingestBatch - Full Sync', () => {
    it('should successfully ingest a small batch (<1000 records)', async () => {
      const mockData = Array.from({ length: 500 }, (_, i) => ({
        id: `pfa-${i}`,
        cost: 1000 + i,
        category: 'Equipment',
      }));

      mockAxios.get.mockResolvedValueOnce({
        data: { data: mockData, hasMore: false },
      });

      mockPrisma.bronzeRecord.createMany.mockResolvedValue({ count: 500 });

      const result = await service.ingestBatch('endpoint-1', 'full');

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(500);
      expect(mockPrisma.bronzeRecord.createMany).toHaveBeenCalledTimes(1);
    });

    it('should handle pagination for large datasets', async () => {
      const page1Data = Array.from({ length: 1000 }, (_, i) => ({ id: `pfa-${i}` }));
      const page2Data = Array.from({ length: 1000 }, (_, i) => ({ id: `pfa-${i + 1000}` }));
      const page3Data = Array.from({ length: 500 }, (_, i) => ({ id: `pfa-${i + 2000}` }));

      (mockAxios.get)
        .mockResolvedValueOnce({
          status: 200,
          data: { data: page1Data, hasMore: true },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { data: page2Data, hasMore: true },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { data: page3Data, hasMore: false },
        });

      mockPrisma.bronzeRecord.createMany.mockResolvedValue({ count: 1000 });

      const result = await service.ingestBatch('endpoint-1', 'full');

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(2500);
      expect(mockAxios.get).toHaveBeenCalledTimes(3); // 3 pages
    });

    it('should batch insert records in chunks of 1000', async () => {
      const mockData = Array.from({ length: 2500 }, (_, i) => ({ id: `pfa-${i}` }));

      (mockAxios.get).mockResolvedValueOnce({
        status: 200,
        data: { data: mockData, hasMore: false },
      });

      mockPrisma.bronzeRecord.createMany.mockResolvedValue({ count: 1000 });

      await service.ingestBatch('endpoint-1', 'full');

      // Should be called 3 times: 1000, 1000, 500
      expect(mockPrisma.bronzeRecord.createMany).toHaveBeenCalledTimes(3);

      const firstCall = mockPrisma.bronzeRecord.createMany.mock.calls[0][0];
      expect(firstCall.data).toHaveLength(1000);

      const lastCall = mockPrisma.bronzeRecord.createMany.mock.calls[2][0];
      expect(lastCall.data).toHaveLength(500);
    });

    it('should generate schema fingerprint from first 100 records', async () => {
      const mockData = Array.from({ length: 500 }, (_, i) => ({
        id: `pfa-${i}`,
        cost: 1000,
        category: 'Equipment',
        status: 'Active',
      }));

      (mockAxios.get).mockResolvedValueOnce({
        status: 200,
        data: { data: mockData, hasMore: false },
      });

      mockPrisma.bronzeRecord.createMany.mockResolvedValue({ count: 500 });
      mockPrisma.bronzeBatch.update.mockResolvedValue({});

      await service.ingestBatch('endpoint-1', 'full');

      // Verify schemaFingerprint was created
      const batchUpdateCall = mockPrisma.bronzeBatch.update.mock.calls[0][0];
      expect(batchUpdateCall.data.schemaFingerprint).toBeDefined();
      expect(batchUpdateCall.data.schemaFingerprint.fields).toContain('id');
      expect(batchUpdateCall.data.schemaFingerprint.fields).toContain('cost');
      expect(batchUpdateCall.data.schemaFingerprint.types).toBeDefined();
    });

    it('should update endpoint lastSyncAt after successful ingestion', async () => {
      (mockAxios.get).mockResolvedValueOnce({
        status: 200,
        data: { data: [{ id: '1' }], hasMore: false },
      });

      mockPrisma.bronzeRecord.createMany.mockResolvedValue({ count: 1 });

      await service.ingestBatch('endpoint-1', 'full');

      expect(mockPrisma.api_endpoints.update).toHaveBeenCalledWith({
        where: { id: 'endpoint-1' },
        data: { lastSyncAt: expect.any(Date) },
      });
    });

    it('should handle empty response (no records)', async () => {
      (mockAxios.get).mockResolvedValueOnce({
        status: 200,
        data: { data: [], hasMore: false },
      });

      const result = await service.ingestBatch('endpoint-1', 'full');

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(0);
      expect(mockPrisma.bronzeRecord.createMany).not.toHaveBeenCalled();
    });

    it('should set completedAt timestamp after successful ingestion', async () => {
      (mockAxios.get).mockResolvedValueOnce({
        status: 200,
        data: { data: [{ id: '1' }], hasMore: false },
      });

      mockPrisma.bronzeRecord.createMany.mockResolvedValue({ count: 1 });

      await service.ingestBatch('endpoint-1', 'full');

      const updateCall = mockPrisma.bronzeBatch.update.mock.calls.find(
        (call) => call[0].data.completedAt
      );
      expect(updateCall).toBeDefined();
      expect(updateCall[0].data.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('ingestBatch - Delta Sync', () => {
    it('should use timestamp-based delta sync when supported', async () => {
      const lastSyncTime = new Date('2025-11-27T00:00:00Z');

      mockPrisma.api_endpoints.findUnique.mockResolvedValue({
        ...mockEndpoint,
        lastSyncAt: lastSyncTime,
      });

      const mockData = [
        { id: 'pfa-1', updated_at: '2025-11-27T12:00:00Z' },
        { id: 'pfa-2', updated_at: '2025-11-28T08:00:00Z' },
      ];

      (mockAxios.get).mockResolvedValueOnce({
        status: 200,
        data: { data: mockData, hasMore: false },
      });

      mockPrisma.bronzeRecord.createMany.mockResolvedValue({ count: 2 });

      const result = await service.ingestBatch('endpoint-1', 'delta');

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(2);

      // Verify fetch was called with timestamp filter
      const axiosCall = mockAxios.get.mock.calls[0];
      const url = fetchCall[0];
      expect(url).toContain('updated_at');
      expect(url).toContain(encodeURIComponent(lastSyncTime.toISOString()));
    });

    it('should fall back to full sync when no lastSyncAt exists', async () => {
      mockPrisma.api_endpoints.findUnique.mockResolvedValue({
        ...mockEndpoint,
        lastSyncAt: null, // No previous sync
      });

      const mockData = [{ id: 'pfa-1' }, { id: 'pfa-2' }];

      (mockAxios.get).mockResolvedValueOnce({
        status: 200,
        data: { data: mockData, hasMore: false },
      });

      mockPrisma.bronzeRecord.createMany.mockResolvedValue({ count: 2 });

      const result = await service.ingestBatch('endpoint-1', 'delta');

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(2);

      // Verify fetch was called WITHOUT timestamp filter (full sync)
      const axiosCall = mockAxios.get.mock.calls[0];
      const url = fetchCall[0];
      expect(url).not.toContain('updated_at');
    });

    it('should fall back to full sync when endpoint does not support delta', async () => {
      mockPrisma.api_endpoints.findUnique.mockResolvedValue({
        ...mockEndpoint,
        supportsDelta: false, // Delta not supported
        lastSyncAt: new Date('2025-11-27T00:00:00Z'),
      });

      const mockData = [{ id: 'pfa-1' }];

      (mockAxios.get).mockResolvedValueOnce({
        status: 200,
        data: { data: mockData, hasMore: false },
      });

      mockPrisma.bronzeRecord.createMany.mockResolvedValue({ count: 1 });

      const result = await service.ingestBatch('endpoint-1', 'delta');

      expect(result.success).toBe(true);

      // Verify full sync was performed
      const axiosCall = mockAxios.get.mock.calls[0];
      const url = fetchCall[0];
      expect(url).not.toContain('updated_at');
    });

    it('should use ID-based delta sync when strategy is "id"', async () => {
      mockPrisma.api_endpoints.findUnique.mockResolvedValue({
        ...mockEndpoint,
        deltaStrategy: 'id',
        deltaField: 'id',
        lastSyncAt: new Date('2025-11-27T00:00:00Z'),
      });

      mockPrisma.bronzeRecord.findFirst.mockResolvedValue({
        rawJson: { id: 'pfa-100' }, // Last synced ID
      });

      const mockData = [
        { id: 'pfa-101' },
        { id: 'pfa-102' },
      ];

      (mockAxios.get).mockResolvedValueOnce({
        status: 200,
        data: { data: mockData, hasMore: false },
      });

      mockPrisma.bronzeRecord.createMany.mockResolvedValue({ count: 2 });

      const result = await service.ingestBatch('endpoint-1', 'delta');

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(2);

      // Verify fetch was called with ID filter
      const axiosCall = mockAxios.get.mock.calls[0];
      const url = fetchCall[0];
      expect(url).toContain('id');
      expect(url).toContain('pfa-100');
    });

    it('should validate delta response contains updated records', async () => {
      mockPrisma.api_endpoints.findUnique.mockResolvedValue({
        ...mockEndpoint,
        lastSyncAt: new Date('2025-11-27T00:00:00Z'),
      });

      // Mock data with old timestamps (should trigger warning)
      const mockData = [
        { id: 'pfa-1', updated_at: '2025-11-26T00:00:00Z' }, // Before lastSyncAt
      ];

      (mockAxios.get).mockResolvedValueOnce({
        status: 200,
        data: { data: mockData, hasMore: false },
      });

      mockPrisma.bronzeRecord.createMany.mockResolvedValue({ count: 1 });

      await service.ingestBatch('endpoint-1', 'delta');

      // Should still succeed but log warning
      const { logger } = await import('../../../../src/utils/logger');
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('Progress Tracking', () => {
    it('should track progress during ingestion', async () => {
      const mockData = Array.from({ length: 100 }, (_, i) => ({ id: `pfa-${i}` }));

      (mockAxios.get).mockResolvedValueOnce({
        status: 200,
        data: { data: mockData, hasMore: false },
      });

      mockPrisma.bronzeRecord.createMany.mockResolvedValue({ count: 100 });

      const result = await service.ingestBatch('endpoint-1', 'full');

      // Progress should be accessible
      const progress = service.getProgress(result.syncBatchId);
      expect(progress).toBeDefined();
      expect(progress?.status).toBe('completed');
      expect(progress?.processedRecords).toBe(100);
    });

    it('should update progress after each batch insert', async () => {
      const mockData = Array.from({ length: 2500 }, (_, i) => ({ id: `pfa-${i}` }));

      (mockAxios.get).mockResolvedValueOnce({
        status: 200,
        data: { data: mockData, hasMore: false },
      });

      mockPrisma.bronzeRecord.createMany.mockResolvedValue({ count: 1000 });

      const result = await service.ingestBatch('endpoint-1', 'full');

      const progress = service.getProgress(result.syncBatchId);
      expect(progress?.processedRecords).toBe(2500);
    });
  });

  describe('Error Handling', () => {
    it('should handle API fetch errors gracefully', async () => {
      (mockAxios.get).mockRejectedValueOnce(new Error('Network error'));

      await expect(service.ingestBatch('endpoint-1', 'full')).rejects.toThrow('Network error');

      // Batch should be marked as failed
      const { logger } = await import('../../../../src/utils/logger');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle API 4xx/5xx errors', async () => {
      (mockAxios.get).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(service.ingestBatch('endpoint-1', 'full')).rejects.toThrow();
    });

    it('should handle database insertion errors', async () => {
      (mockAxios.get).mockResolvedValueOnce({
        status: 200,
        data: { data: [{ id: '1' }], hasMore: false },
      });

      mockPrisma.bronzeRecord.createMany.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.ingestBatch('endpoint-1', 'full')).rejects.toThrow('DB error');
    });

    it('should handle missing endpoint configuration', async () => {
      mockPrisma.api_endpoints.findUnique.mockResolvedValue(null);

      await expect(service.ingestBatch('invalid-endpoint', 'full')).rejects.toThrow();
    });

    it('should handle missing server configuration', async () => {
      mockPrisma.api_servers.findUnique.mockResolvedValue(null);

      await expect(service.ingestBatch('endpoint-1', 'full')).rejects.toThrow();
    });

    it('should handle malformed JSON responses', async () => {
      (mockAxios.get).mockRejectedValueOnce(new Error('Invalid JSON'));

      await expect(service.ingestBatch('endpoint-1', 'full')).rejects.toThrow();
    });
  });

  describe('Schema Drift Integration', () => {
    it('should call SchemaDriftDetector after successful ingestion', async () => {
      (mockAxios.get).mockResolvedValueOnce({
        status: 200,
        data: { data: [{ id: '1', cost: 100 }], hasMore: false },
      });

      mockPrisma.bronzeRecord.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.bronzeBatch.update.mockResolvedValue({});

      await service.ingestBatch('endpoint-1', 'full');

      // Verify SchemaDriftDetector was instantiated and called
      expect(SchemaDriftDetector).toHaveBeenCalled();
      const driftDetector = (SchemaDriftDetector as any).mock.results[0].value;
      expect(driftDetector.detectDrift).toHaveBeenCalledWith(
        'endpoint-1',
        expect.objectContaining({
          fields: expect.arrayContaining(['id', 'cost']),
          types: expect.any(Object),
        })
      );
    });

    it('should create drift alert when drift is detected', async () => {
      const mockDriftDetector = {
        detectDrift: vi.fn().mockResolvedValue({
          hasDrift: true,
          missingFields: ['category'],
          newFields: [],
          changedTypes: {},
          severity: 'medium',
        }),
        createAlert: vi.fn(),
      };

      (SchemaDriftDetector as any).mockImplementation(() => mockDriftDetector);

      (mockAxios.get).mockResolvedValueOnce({
        status: 200,
        data: { data: [{ id: '1' }], hasMore: false },
      });

      mockPrisma.bronzeRecord.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.bronzeBatch.update.mockResolvedValue({});

      await service.ingestBatch('endpoint-1', 'full');

      expect(mockDriftDetector.createAlert).toHaveBeenCalledWith(
        'endpoint-1',
        expect.objectContaining({ hasDrift: true }),
        'batch-123'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle records with null/undefined fields', async () => {
      const mockData = [
        { id: 'pfa-1', cost: null, category: undefined },
        { id: 'pfa-2', cost: 100, category: 'Equipment' },
      ];

      (mockAxios.get).mockResolvedValueOnce({
        status: 200,
        data: { data: mockData, hasMore: false },
      });

      mockPrisma.bronzeRecord.createMany.mockResolvedValue({ count: 2 });

      const result = await service.ingestBatch('endpoint-1', 'full');

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(2);
    });

    it('should handle nested objects in response', async () => {
      const mockData = [
        {
          id: 'pfa-1',
          metadata: {
            location: 'Site A',
            tags: ['equipment', 'rental'],
          },
        },
      ];

      (mockAxios.get).mockResolvedValueOnce({
        status: 200,
        data: { data: mockData, hasMore: false },
      });

      mockPrisma.bronzeRecord.createMany.mockResolvedValue({ count: 1 });

      const result = await service.ingestBatch('endpoint-1', 'full');

      expect(result.success).toBe(true);

      // Verify nested object was stored in rawJson
      const createManyCall = mockPrisma.bronzeRecord.createMany.mock.calls[0][0];
      expect(createManyCall.data[0].rawJson.metadata).toBeDefined();
    });

    it('should handle extremely large records (>100KB each)', async () => {
      const largeObject = {
        id: 'pfa-1',
        largeField: 'x'.repeat(150000), // 150KB of data
      };

      (mockAxios.get).mockResolvedValueOnce({
        status: 200,
        data: { data: [largeObject], hasMore: false },
      });

      mockPrisma.bronzeRecord.createMany.mockResolvedValue({ count: 1 });

      const result = await service.ingestBatch('endpoint-1', 'full');

      expect(result.success).toBe(true);
    });

    it('should handle responses with different field types across records', async () => {
      const mockData = [
        { id: 'pfa-1', cost: 100 }, // cost is number
        { id: 'pfa-2', cost: '200' }, // cost is string
        { id: 'pfa-3', cost: null }, // cost is null
      ];

      (mockAxios.get).mockResolvedValueOnce({
        status: 200,
        data: { data: mockData, hasMore: false },
      });

      mockPrisma.bronzeRecord.createMany.mockResolvedValue({ count: 3 });

      const result = await service.ingestBatch('endpoint-1', 'full');

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(3);
    });
  });

  describe('Authentication', () => {
    it('should send Basic auth headers when authType is BASIC', async () => {
      (mockAxios.get).mockResolvedValueOnce({
        status: 200,
        data: { data: [], hasMore: false },
      });

      await service.ingestBatch('endpoint-1', 'full');

      const axiosCall = mockAxios.get.mock.calls[0];
      const headers = axiosCall[1]?.headers;

      expect(headers).toBeDefined();
      expect(headers.Authorization).toMatch(/^Basic /);
    });

    it('should send Bearer token when authType is BEARER', async () => {
      mockPrisma.api_servers.findUnique.mockResolvedValue({
        ...mockServer,
        authType: 'BEARER',
        credentials: { token: 'test-token-123' },
      });

      (mockAxios.get).mockResolvedValueOnce({
        status: 200,
        data: { data: [], hasMore: false },
      });

      await service.ingestBatch('endpoint-1', 'full');

      const axiosCall = mockAxios.get.mock.calls[0];
      const headers = axiosCall[1]?.headers;

      expect(headers).toBeDefined();
      expect(headers.Authorization).toBe('Bearer test-token-123');
    });

    it('should send no auth headers when authType is NONE', async () => {
      mockPrisma.api_servers.findUnique.mockResolvedValue({
        ...mockServer,
        authType: 'NONE',
        credentials: null,
      });

      (mockAxios.get).mockResolvedValueOnce({
        status: 200,
        data: { data: [], hasMore: false },
      });

      await service.ingestBatch('endpoint-1', 'full');

      const axiosCall = mockAxios.get.mock.calls[0];
      const headers = axiosCall[1]?.headers;

      expect(headers?.Authorization).toBeUndefined();
    });
  });
});
