/**
 * Unit Tests for SchemaDriftDetector
 *
 * ADR-007 Phase 2, Task 2.3: Schema Drift Detection
 *
 * Tests schema change detection including:
 * - Baseline fingerprint retrieval
 * - Missing field detection
 * - New field detection
 * - Type change detection
 * - Severity calculation
 * - Critical field detection
 * - Alert creation and storage
 * - Drift history retrieval
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SchemaDriftDetector } from '../../../../src/services/pems/SchemaDriftDetector';
import type { SchemaFingerprint } from '../../../../src/services/pems/PemsIngestionService';

// Mock Prisma client
vi.mock('../../../../src/config/database', () => ({
  default: {
    bronzeBatch: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    api_endpoints: {
      findUnique: vi.fn(),
    },
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

describe('SchemaDriftDetector', () => {
  let detector: SchemaDriftDetector;
  let mockPrisma: any;

  beforeEach(async () => {
    // Import the mocked module
    const { default: prisma } = await import('../../../../src/config/database');
    mockPrisma = prisma;

    detector = new SchemaDriftDetector();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('detectDrift', () => {
    const baselineFingerprint: SchemaFingerprint = {
      fields: ['id', 'pfa_id', 'cost', 'category', 'status'],
      types: {
        id: 'string',
        pfa_id: 'string',
        cost: 'number',
        category: 'string',
        status: 'string',
      },
      sampleSize: 100,
    };

    it('should return no drift for first sync (no baseline)', async () => {
      mockPrisma.bronzeBatch.findFirst.mockResolvedValue(null);

      const newFingerprint: SchemaFingerprint = {
        fields: ['id', 'pfa_id', 'cost'],
        types: { id: 'string', pfa_id: 'string', cost: 'number' },
        sampleSize: 50,
      };

      const result = await detector.detectDrift('endpoint-1', newFingerprint);

      expect(result.hasDrift).toBe(false);
      expect(result.missingFields).toEqual([]);
      expect(result.newFields).toEqual([]);
      expect(result.severity).toBe('low');
      expect(result.metrics.baselineFieldCount).toBe(0);
      expect(result.metrics.newFieldCount).toBe(3);
    });

    it('should detect missing fields', async () => {
      mockPrisma.bronzeBatch.findFirst.mockResolvedValue({
        schemaFingerprint: baselineFingerprint,
      });

      const newFingerprint: SchemaFingerprint = {
        fields: ['id', 'pfa_id', 'cost'], // Missing 'category' and 'status'
        types: { id: 'string', pfa_id: 'string', cost: 'number' },
        sampleSize: 100,
      };

      const result = await detector.detectDrift('endpoint-1', newFingerprint);

      expect(result.hasDrift).toBe(true);
      expect(result.missingFields).toEqual(['category', 'status']);
      expect(result.newFields).toEqual([]);
      expect(result.metrics.missingPercent).toBeCloseTo(40, 1); // 2/5 = 40%
    });

    it('should detect new fields', async () => {
      mockPrisma.bronzeBatch.findFirst.mockResolvedValue({
        schemaFingerprint: baselineFingerprint,
      });

      const newFingerprint: SchemaFingerprint = {
        fields: ['id', 'pfa_id', 'cost', 'category', 'status', 'custom_field_1', 'custom_field_2'],
        types: {
          id: 'string',
          pfa_id: 'string',
          cost: 'number',
          category: 'string',
          status: 'string',
          custom_field_1: 'string',
          custom_field_2: 'number',
        },
        sampleSize: 100,
      };

      const result = await detector.detectDrift('endpoint-1', newFingerprint);

      expect(result.hasDrift).toBe(true);
      expect(result.missingFields).toEqual([]);
      expect(result.newFields).toEqual(['custom_field_1', 'custom_field_2']);
      expect(result.metrics.addedCount).toBe(2);
    });

    it('should detect type changes', async () => {
      mockPrisma.bronzeBatch.findFirst.mockResolvedValue({
        schemaFingerprint: baselineFingerprint,
      });

      const newFingerprint: SchemaFingerprint = {
        fields: ['id', 'pfa_id', 'cost', 'category', 'status'],
        types: {
          id: 'string',
          pfa_id: 'string',
          cost: 'string', // Changed from number to string
          category: 'number', // Changed from string to number
          status: 'string',
        },
        sampleSize: 100,
      };

      const result = await detector.detectDrift('endpoint-1', newFingerprint);

      expect(result.hasDrift).toBe(true);
      expect(result.changedTypes).toEqual({
        cost: { was: 'number', now: 'string' },
        category: { was: 'string', now: 'number' },
      });
      expect(result.metrics.typeChangeCount).toBe(2);
    });

    it('should calculate HIGH severity for >20% missing fields', async () => {
      mockPrisma.bronzeBatch.findFirst.mockResolvedValue({
        schemaFingerprint: baselineFingerprint,
      });

      const newFingerprint: SchemaFingerprint = {
        fields: ['id', 'pfa_id'], // Missing 3/5 = 60%
        types: { id: 'string', pfa_id: 'string' },
        sampleSize: 100,
      };

      const result = await detector.detectDrift('endpoint-1', newFingerprint);

      expect(result.severity).toBe('high');
      expect(result.metrics.missingPercent).toBeCloseTo(60, 1);
    });

    it('should calculate HIGH severity for >5 new fields', async () => {
      mockPrisma.bronzeBatch.findFirst.mockResolvedValue({
        schemaFingerprint: baselineFingerprint,
      });

      const newFingerprint: SchemaFingerprint = {
        fields: [
          'id', 'pfa_id', 'cost', 'category', 'status',
          'new1', 'new2', 'new3', 'new4', 'new5', 'new6', // 6 new fields
        ],
        types: {
          id: 'string', pfa_id: 'string', cost: 'number',
          category: 'string', status: 'string',
          new1: 'string', new2: 'string', new3: 'string',
          new4: 'string', new5: 'string', new6: 'string',
        },
        sampleSize: 100,
      };

      const result = await detector.detectDrift('endpoint-1', newFingerprint);

      expect(result.severity).toBe('high');
      expect(result.metrics.addedCount).toBe(6);
    });

    it('should calculate MEDIUM severity for >10% missing fields', async () => {
      mockPrisma.bronzeBatch.findFirst.mockResolvedValue({
        schemaFingerprint: baselineFingerprint,
      });

      const newFingerprint: SchemaFingerprint = {
        fields: ['id', 'pfa_id', 'cost', 'category'], // Missing 1/5 = 20%
        types: { id: 'string', pfa_id: 'string', cost: 'number', category: 'string' },
        sampleSize: 100,
      };

      const result = await detector.detectDrift('endpoint-1', newFingerprint);

      expect(result.severity).toBe('medium');
      expect(result.metrics.missingPercent).toBeCloseTo(20, 1);
    });

    it('should calculate MEDIUM severity for >2 new fields', async () => {
      mockPrisma.bronzeBatch.findFirst.mockResolvedValue({
        schemaFingerprint: baselineFingerprint,
      });

      const newFingerprint: SchemaFingerprint = {
        fields: ['id', 'pfa_id', 'cost', 'category', 'status', 'new1', 'new2', 'new3'],
        types: {
          id: 'string', pfa_id: 'string', cost: 'number',
          category: 'string', status: 'string',
          new1: 'string', new2: 'string', new3: 'string',
        },
        sampleSize: 100,
      };

      const result = await detector.detectDrift('endpoint-1', newFingerprint);

      expect(result.severity).toBe('medium');
      expect(result.metrics.addedCount).toBe(3);
    });

    it('should calculate LOW severity for minor changes', async () => {
      mockPrisma.bronzeBatch.findFirst.mockResolvedValue({
        schemaFingerprint: baselineFingerprint,
      });

      const newFingerprint: SchemaFingerprint = {
        fields: ['id', 'pfa_id', 'cost', 'category', 'status', 'new1'], // 1 new field
        types: {
          id: 'string', pfa_id: 'string', cost: 'number',
          category: 'string', status: 'string', new1: 'string',
        },
        sampleSize: 100,
      };

      const result = await detector.detectDrift('endpoint-1', newFingerprint);

      expect(result.severity).toBe('low');
    });

    it('should force HIGH severity for critical field removal', async () => {
      mockPrisma.bronzeBatch.findFirst.mockResolvedValue({
        schemaFingerprint: baselineFingerprint,
      });

      const newFingerprint: SchemaFingerprint = {
        fields: ['category', 'status'], // Missing critical 'id', 'pfa_id', 'cost'
        types: { category: 'string', status: 'string' },
        sampleSize: 100,
      };

      const result = await detector.detectDrift('endpoint-1', newFingerprint);

      expect(result.severity).toBe('high');
      expect(result.missingFields).toContain('id');
      expect(result.missingFields).toContain('pfa_id');
      expect(result.missingFields).toContain('cost');
    });

    it('should handle no drift scenario', async () => {
      mockPrisma.bronzeBatch.findFirst.mockResolvedValue({
        schemaFingerprint: baselineFingerprint,
      });

      const newFingerprint: SchemaFingerprint = {
        fields: ['id', 'pfa_id', 'cost', 'category', 'status'], // Identical
        types: {
          id: 'string',
          pfa_id: 'string',
          cost: 'number',
          category: 'string',
          status: 'string',
        },
        sampleSize: 100,
      };

      const result = await detector.detectDrift('endpoint-1', newFingerprint);

      expect(result.hasDrift).toBe(false);
      expect(result.missingFields).toEqual([]);
      expect(result.newFields).toEqual([]);
      expect(result.changedTypes).toEqual({});
    });
  });

  describe('createAlert', () => {
    it('should create alert for HIGH severity drift', async () => {
      mockPrisma.api_endpoints.findUnique.mockResolvedValue({
        name: 'PEMS Read API',
        path: '/api/pems/data',
      });

      mockPrisma.bronzeBatch.findUnique.mockResolvedValue({
        syncBatchId: 'batch-123',
        warnings: [],
      });

      mockPrisma.bronzeBatch.update.mockResolvedValue({});

      const drift = {
        hasDrift: true,
        missingFields: ['cost', 'rate'],
        newFields: [],
        changedTypes: {},
        severity: 'high' as const,
        metrics: {
          baselineFieldCount: 10,
          newFieldCount: 8,
          missingPercent: 20,
          addedCount: 0,
          typeChangeCount: 0,
        },
      };

      await detector.createAlert('endpoint-1', drift, 'batch-123');

      expect(mockPrisma.bronzeBatch.update).toHaveBeenCalledWith({
        where: { syncBatchId: 'batch-123' },
        data: {
          warnings: expect.arrayContaining([
            expect.objectContaining({
              type: 'SCHEMA_DRIFT',
              severity: 'high',
              message: expect.stringContaining('[CRITICAL]'),
            }),
          ]),
        },
      });
    });

    it('should create alert for MEDIUM severity drift', async () => {
      mockPrisma.api_endpoints.findUnique.mockResolvedValue({
        name: 'PEMS Read API',
        path: '/api/pems/data',
      });

      mockPrisma.bronzeBatch.findUnique.mockResolvedValue({
        syncBatchId: 'batch-123',
        warnings: [],
      });

      mockPrisma.bronzeBatch.update.mockResolvedValue({});

      const drift = {
        hasDrift: true,
        missingFields: ['category'],
        newFields: ['custom_field_1', 'custom_field_2'],
        changedTypes: { cost: { was: 'number', now: 'string' } },
        severity: 'medium' as const,
        metrics: {
          baselineFieldCount: 10,
          newFieldCount: 11,
          missingPercent: 10,
          addedCount: 2,
          typeChangeCount: 1,
        },
      };

      await detector.createAlert('endpoint-1', drift, 'batch-123');

      expect(mockPrisma.bronzeBatch.update).toHaveBeenCalledWith({
        where: { syncBatchId: 'batch-123' },
        data: {
          warnings: expect.arrayContaining([
            expect.objectContaining({
              type: 'SCHEMA_DRIFT',
              severity: 'medium',
              message: expect.stringContaining('[WARNING]'),
            }),
          ]),
        },
      });
    });

    it('should NOT create alert for LOW severity drift', async () => {
      const drift = {
        hasDrift: true,
        missingFields: ['optional_field'],
        newFields: [],
        changedTypes: {},
        severity: 'low' as const,
        metrics: {
          baselineFieldCount: 10,
          newFieldCount: 9,
          missingPercent: 10,
          addedCount: 0,
          typeChangeCount: 0,
        },
      };

      await detector.createAlert('endpoint-1', drift, 'batch-123');

      expect(mockPrisma.bronzeBatch.update).not.toHaveBeenCalled();
    });

    it('should NOT create alert when no drift detected', async () => {
      const drift = {
        hasDrift: false,
        missingFields: [],
        newFields: [],
        changedTypes: {},
        severity: 'low' as const,
        metrics: {
          baselineFieldCount: 10,
          newFieldCount: 10,
          missingPercent: 0,
          addedCount: 0,
          typeChangeCount: 0,
        },
      };

      await detector.createAlert('endpoint-1', drift, 'batch-123');

      expect(mockPrisma.bronzeBatch.update).not.toHaveBeenCalled();
    });

    it('should append to existing warnings array', async () => {
      mockPrisma.api_endpoints.findUnique.mockResolvedValue({
        name: 'PEMS Read API',
        path: '/api/pems/data',
      });

      const existingWarning = {
        type: 'OTHER_WARNING',
        message: 'Existing warning',
        timestamp: '2025-11-27T12:00:00Z',
      };

      mockPrisma.bronzeBatch.findUnique.mockResolvedValue({
        syncBatchId: 'batch-123',
        warnings: [existingWarning],
      });

      mockPrisma.bronzeBatch.update.mockResolvedValue({});

      const drift = {
        hasDrift: true,
        missingFields: ['cost'],
        newFields: [],
        changedTypes: {},
        severity: 'high' as const,
        metrics: {
          baselineFieldCount: 10,
          newFieldCount: 9,
          missingPercent: 10,
          addedCount: 0,
          typeChangeCount: 0,
        },
      };

      await detector.createAlert('endpoint-1', drift, 'batch-123');

      expect(mockPrisma.bronzeBatch.update).toHaveBeenCalledWith({
        where: { syncBatchId: 'batch-123' },
        data: {
          warnings: expect.arrayContaining([
            existingWarning,
            expect.objectContaining({ type: 'SCHEMA_DRIFT' }),
          ]),
        },
      });
    });

    it('should truncate long field lists in message', async () => {
      mockPrisma.api_endpoints.findUnique.mockResolvedValue({
        name: 'PEMS Read API',
        path: '/api/pems/data',
      });

      mockPrisma.bronzeBatch.findUnique.mockResolvedValue({
        warnings: [],
      });

      mockPrisma.bronzeBatch.update.mockResolvedValue({});

      const drift = {
        hasDrift: true,
        missingFields: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'], // 7 fields
        newFields: [],
        changedTypes: {},
        severity: 'high' as const,
        metrics: {
          baselineFieldCount: 10,
          newFieldCount: 3,
          missingPercent: 70,
          addedCount: 0,
          typeChangeCount: 0,
        },
      };

      await detector.createAlert('endpoint-1', drift, 'batch-123');

      const updateCall = mockPrisma.bronzeBatch.update.mock.calls[0][0];
      const alert = (updateCall.data.warnings as any[])[0];

      // Message should truncate to 5 fields + "X more"
      expect(alert.message).toContain('+2 more');
    });
  });

  describe('getDriftHistory', () => {
    it('should return drift history for an endpoint', async () => {
      const mockBatches = [
        {
          syncBatchId: 'batch-3',
          ingestedAt: new Date('2025-11-28T12:00:00Z'),
          warnings: [
            {
              type: 'SCHEMA_DRIFT',
              severity: 'high',
              message: 'Drift detected',
              details: {},
              timestamp: '2025-11-28T12:00:00Z',
            },
          ],
        },
        {
          syncBatchId: 'batch-2',
          ingestedAt: new Date('2025-11-27T12:00:00Z'),
          warnings: [
            {
              type: 'OTHER_WARNING',
              message: 'Not a drift alert',
            },
          ],
        },
        {
          syncBatchId: 'batch-1',
          ingestedAt: new Date('2025-11-26T12:00:00Z'),
          warnings: [],
        },
      ];

      mockPrisma.bronzeBatch.findMany.mockResolvedValue(mockBatches);

      const history = await detector.getDriftHistory('endpoint-1', 10);

      expect(history).toHaveLength(3);
      expect(history[0].alerts).toHaveLength(1);
      expect(history[0].alerts[0].type).toBe('SCHEMA_DRIFT');
      expect(history[1].alerts).toHaveLength(0); // OTHER_WARNING filtered out
      expect(history[2].alerts).toHaveLength(0);
    });

    it('should limit results by specified limit', async () => {
      mockPrisma.bronzeBatch.findMany.mockResolvedValue([]);

      await detector.getDriftHistory('endpoint-1', 5);

      expect(mockPrisma.bronzeBatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      );
    });

    it('should use default limit of 10', async () => {
      mockPrisma.bronzeBatch.findMany.mockResolvedValue([]);

      await detector.getDriftHistory('endpoint-1');

      expect(mockPrisma.bronzeBatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });
  });

  describe('hasActiveDrift', () => {
    it('should return drift status when alerts exist', async () => {
      const mockBatches = [
        {
          warnings: [
            {
              type: 'SCHEMA_DRIFT',
              severity: 'high',
              message: 'Critical drift',
            },
          ],
        },
        {
          warnings: [
            {
              type: 'SCHEMA_DRIFT',
              severity: 'medium',
              message: 'Moderate drift',
            },
          ],
        },
      ];

      mockPrisma.bronzeBatch.findMany.mockResolvedValue(mockBatches);

      const result = await detector.hasActiveDrift('endpoint-1');

      expect(result.hasDrift).toBe(true);
      expect(result.latestSeverity).toBe('high'); // Highest severity
      expect(result.alertCount).toBe(2);
    });

    it('should return no drift when no alerts exist', async () => {
      mockPrisma.bronzeBatch.findMany.mockResolvedValue([
        { warnings: [] },
        { warnings: null },
      ]);

      const result = await detector.hasActiveDrift('endpoint-1');

      expect(result.hasDrift).toBe(false);
      expect(result.latestSeverity).toBe(null);
      expect(result.alertCount).toBe(0);
    });

    it('should filter non-drift warnings', async () => {
      mockPrisma.bronzeBatch.findMany.mockResolvedValue([
        {
          warnings: [
            { type: 'OTHER_WARNING', message: 'Not drift' },
            { type: 'SCHEMA_DRIFT', severity: 'low', message: 'Drift' },
          ],
        },
      ]);

      const result = await detector.hasActiveDrift('endpoint-1');

      expect(result.hasDrift).toBe(true);
      expect(result.alertCount).toBe(1); // Only drift alert counted
    });

    it('should check last 5 batches', async () => {
      mockPrisma.bronzeBatch.findMany.mockResolvedValue([]);

      await detector.hasActiveDrift('endpoint-1');

      expect(mockPrisma.bronzeBatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle null baseline schemaFingerprint', async () => {
      mockPrisma.bronzeBatch.findFirst.mockResolvedValue({
        schemaFingerprint: null,
      });

      const newFingerprint: SchemaFingerprint = {
        fields: ['id'],
        types: { id: 'string' },
        sampleSize: 100,
      };

      const result = await detector.detectDrift('endpoint-1', newFingerprint);

      expect(result.hasDrift).toBe(false); // Treated as first sync
    });

    it('should handle empty baseline fields', async () => {
      mockPrisma.bronzeBatch.findFirst.mockResolvedValue({
        schemaFingerprint: {
          fields: [],
          types: {},
          sampleSize: 0,
        },
      });

      const newFingerprint: SchemaFingerprint = {
        fields: ['id', 'name'],
        types: { id: 'string', name: 'string' },
        sampleSize: 100,
      };

      const result = await detector.detectDrift('endpoint-1', newFingerprint);

      expect(result.hasDrift).toBe(true);
      expect(result.newFields).toEqual(['id', 'name']);
      expect(result.metrics.missingPercent).toBe(0); // Avoid division by zero
    });

    it('should handle missing endpoint name gracefully', async () => {
      mockPrisma.api_endpoints.findUnique.mockResolvedValue(null);

      mockPrisma.bronzeBatch.findUnique.mockResolvedValue({ warnings: [] });
      mockPrisma.bronzeBatch.update.mockResolvedValue({});

      const drift = {
        hasDrift: true,
        missingFields: ['field1'],
        newFields: [],
        changedTypes: {},
        severity: 'high' as const,
        metrics: {
          baselineFieldCount: 5,
          newFieldCount: 4,
          missingPercent: 20,
          addedCount: 0,
          typeChangeCount: 0,
        },
      };

      await detector.createAlert('endpoint-1', drift, 'batch-123');

      const updateCall = mockPrisma.bronzeBatch.update.mock.calls[0][0];
      const alert = (updateCall.data.warnings as any[])[0];

      // Should use endpoint ID as fallback
      expect(alert.message).toContain('endpoint-1');
    });
  });
});
