/**
 * @file apiEndpointController.ts
 * @description REST API controller for API Endpoint management
 * Exposes 12 endpoints for endpoint CRUD, testing, schema drift, and mapping versions
 */

import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import ApiEndpointService from '../services/apiEndpointService';
import ApiServerService from '../services/apiServerService';
import EndpointTestService from '../services/endpointTestService';
import { SchemaDriftDetector } from '../services/pems/SchemaDriftDetector';
import { pemsSyncServiceV2 } from '../services/pems/PemsSyncServiceV2';
import prisma from '../config/database';
import { distance as levenshteinDistance } from 'fastest-levenshtein';
import { handleControllerError } from '../utils/errorHandling';
import { Prisma, api_endpoints } from '@prisma/client';

export class ApiEndpointController {
  /**
   * GET /api/api-endpoints
   * Get all endpoints for authenticated user's organizations
   * Used by Mapping Studio to populate endpoint selector dropdown
   *
   * Returns combined results from:
   * 1. api_servers + api_endpoints (ADR-006 two-tier architecture)
   * 2. api_configurations (legacy PEMS API configs)
   */
  static async getAllEndpoints(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Get all organization IDs the user has access to
      const userOrgs = req.user?.organizations || [];
      const organizationIds = userOrgs.map((org: { organizationId: string }) => org.organizationId);

      if (organizationIds.length === 0) {
        res.json({ success: true, endpoints: [] });
        return;
      }

      const allEndpoints: Array<{
        id: string;
        name: string;
        path: string;
        entity: string;
        operationType: string;
        serverId?: string;
        serverName?: string;
        organizationId?: string;
        source: 'api_endpoints' | 'api_configurations';
      }> = [];

      // ========================================
      // 1. Get endpoints from api_servers + api_endpoints (ADR-006)
      // ========================================
      const servers = await prisma.api_servers.findMany({
        where: {
          organizationId: { in: organizationIds },
          status: 'active'
        },
        select: { id: true, name: true, organizationId: true }
      });

      if (servers.length > 0) {
        const serverIds = servers.map(s => s.id);
        const endpoints = await prisma.api_endpoints.findMany({
          where: {
            serverId: { in: serverIds },
            isActive: true  // Use isActive boolean, not status (which is health status)
          },
          include: {
            api_servers: {
              select: { name: true, organizationId: true }
            }
          },
          orderBy: [
            { entity: 'asc' },
            { name: 'asc' }
          ]
        });

        const serverLookup = new Map(servers.map(s => [s.id, s]));

        endpoints.forEach((ep: api_endpoints & { api_servers?: { name: string; organizationId: string } }) => {
          allEndpoints.push({
            id: ep.id,
            name: ep.name,
            path: ep.path,
            entity: ep.entity,
            operationType: ep.operationType,
            serverId: ep.serverId,
            serverName: ep.api_servers?.name || serverLookup.get(ep.serverId)?.name,
            organizationId: ep.api_servers?.organizationId || serverLookup.get(ep.serverId)?.organizationId,
            source: 'api_endpoints'
          });
        });
      }

      // ========================================
      // 2. Get endpoints from api_configurations (legacy)
      // ========================================
      const apiConfigs = await prisma.api_configurations.findMany({
        where: {
          OR: [
            { organizationId: { in: organizationIds } },
            { organizationId: null } // Global configs
          ],
          status: { not: 'deleted' }
        },
        include: {
          organizations: {
            select: { name: true }
          }
        },
        orderBy: [
          { usage: 'asc' },
          { name: 'asc' }
        ]
      });

      apiConfigs.forEach((config) => {
        // Derive entity from usage field (e.g., 'pems_read' -> 'PFA')
        let entity = 'PFA';
        if (config.usage?.toLowerCase().includes('asset')) {
          entity = 'Asset';
        } else if (config.usage?.toLowerCase().includes('user')) {
          entity = 'User';
        }

        allEndpoints.push({
          id: `config_${config.id}`, // Prefix to distinguish from api_endpoints
          name: config.name,
          path: config.url,
          entity: entity,
          operationType: config.operationType || 'read',
          serverName: config.organizations?.name || 'Global',
          organizationId: config.organizationId || undefined,
          source: 'api_configurations'
        });
      });

      // Sort combined results by entity then name
      allEndpoints.sort((a, b) => {
        if (a.entity !== b.entity) return a.entity.localeCompare(b.entity);
        return a.name.localeCompare(b.name);
      });

      res.json({
        success: true,
        endpoints: allEndpoints
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiEndpointController.getAllEndpoints');
    }
  }

  /**
   * GET /api/servers/:serverId/endpoints
   * Get all endpoints for a server
   */
  static async getEndpointsByServer(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;
      const organizationId = req.query.organizationId as string ||
                            (req.user?.organizations && req.user.organizations[0]?.organizationId);

      if (!organizationId) {
        res.status(401).json({ error: 'Organization not found in token' });
        return;
      }

      // Verify server belongs to organization
      const server = await ApiServerService.getServerById(serverId, organizationId);
      if (!server) {
        res.status(404).json({
          success: false,
          error: 'API server not found'
        });
        return;
      }

      const endpoints = await ApiEndpointService.getEndpointsByServer(serverId);

      res.json({
        success: true,
        data: endpoints
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiEndpointController.getEndpointsByServer');
    }
  }

  /**
   * GET /api/endpoints/:endpointId
   * Get a single endpoint by ID
   */
  static async getEndpointById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { endpointId } = req.params;
      const organizationId = req.query.organizationId as string ||
                            (req.user?.organizations && req.user.organizations[0]?.organizationId);

      if (!organizationId) {
        res.status(401).json({ error: 'Organization not found in token' });
        return;
      }

      const endpoint = await ApiEndpointService.getEndpointById(
        endpointId,
        req.query.serverId as string
      );

      if (!endpoint) {
        res.status(404).json({
          success: false,
          error: 'Endpoint not found'
        });
        return;
      }

      res.json({
        success: true,
        data: endpoint
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiEndpointController.getEndpointById');
    }
  }

  /**
   * POST /api/servers/:serverId/endpoints
   * Create a new endpoint
   */
  static async createEndpoint(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;
      const organizationId = req.query.organizationId as string ||
                            (req.user?.organizations && req.user.organizations[0]?.organizationId);

      if (!organizationId) {
        res.status(401).json({ error: 'Organization not found in token' });
        return;
      }

      // Verify server belongs to organization
      const server = await ApiServerService.getServerById(serverId, organizationId);
      if (!server) {
        res.status(404).json({
          success: false,
          error: 'API server not found'
        });
        return;
      }

      // Validate required fields
      const { name, path, entity, operationType } = req.body;
      if (!name || !path || !entity || !operationType) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: name, path, entity, operationType'
        });
        return;
      }

      const endpoint = await ApiEndpointService.createEndpoint({
        ...req.body,
        serverId
      });

      res.status(201).json({
        success: true,
        data: endpoint
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiEndpointController.createEndpoint');
    }
  }

  /**
   * PUT /api/endpoints/:endpointId
   * Update an existing endpoint
   */
  static async updateEndpoint(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { endpointId } = req.params;
      const serverId = req.body.serverId || req.query.serverId as string;
      const organizationId = req.query.organizationId as string ||
                            (req.user?.organizations && req.user.organizations[0]?.organizationId);

      if (!organizationId || !serverId) {
        res.status(400).json({ error: 'serverId required' });
        return;
      }

      // Verify server belongs to organization
      const server = await ApiServerService.getServerById(serverId, organizationId);
      if (!server) {
        res.status(404).json({
          success: false,
          error: 'API server not found'
        });
        return;
      }

      const endpoint = await ApiEndpointService.updateEndpoint(
        endpointId,
        serverId,
        req.body
      );

      res.json({
        success: true,
        data: endpoint
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiEndpointController.updateEndpoint');
    }
  }

  /**
   * DELETE /api/endpoints/:endpointId
   * Delete an endpoint
   */
  static async deleteEndpoint(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { endpointId } = req.params;
      const serverId = req.query.serverId as string;
      const organizationId = req.query.organizationId as string ||
                            (req.user?.organizations && req.user.organizations[0]?.organizationId);

      if (!organizationId || !serverId) {
        res.status(400).json({ error: 'serverId required' });
        return;
      }

      // Verify server belongs to organization
      const server = await ApiServerService.getServerById(serverId, organizationId);
      if (!server) {
        res.status(404).json({
          success: false,
          error: 'API server not found'
        });
        return;
      }

      await ApiEndpointService.deleteEndpoint(endpointId, serverId);

      res.json({
        success: true,
        message: 'Endpoint deleted successfully'
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiEndpointController.deleteEndpoint');
    }
  }

  /**
   * POST /api/endpoints/:endpointId/test
   * Test a single endpoint
   */
  static async testEndpoint(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { endpointId } = req.params;
      const userId = req.user?.userId;

      // Get organizationId from request body or query, fallback to user's first org
      const organizationId = req.body.organizationId ||
                           req.query.organizationId as string ||
                           (req.user?.organizations && req.user.organizations[0]?.organizationId);

      const result = await EndpointTestService.testEndpoint(endpointId, {
        method: req.body.method,
        payload: req.body.payload,
        customHeaders: req.body.customHeaders,
        triggeredBy: userId,
        testType: 'manual',
        organizationId: organizationId as string
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiEndpointController.testEndpoint');
    }
  }

  /**
   * GET /api/endpoints/:endpointId/test-results
   * Get test results for an endpoint
   */
  static async getTestResults(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { endpointId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const results = await EndpointTestService.getTestResults(endpointId, limit);

      res.json({
        success: true,
        data: results
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiEndpointController.getTestResults');
    }
  }

  /**
   * GET /api/endpoints/:endpointId/latest-test
   * Get latest test result for an endpoint
   */
  static async getLatestTest(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { endpointId } = req.params;

      const result = await EndpointTestService.getLatestTestResult(endpointId);

      if (!result) {
        res.status(404).json({
          success: false,
          error: 'No test results found for this endpoint'
        });
        return;
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiEndpointController.getLatestTest');
    }
  }

  /**
   * GET /api/endpoints/:endpointId/schema-drift
   * Analyze schema drift between last two batches
   */
  static async getSchemaDrift(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { endpointId } = req.params;

      const batches = await prisma.bronze_batches.findMany({
        where: { endpointId, completedAt: { not: null } },
        orderBy: { ingestedAt: 'desc' },
        take: 2
      });

      if (batches.length < 2) {
        res.json({
          drift: {
            hasDrift: false,
            missingFields: [],
            newFields: [],
            changedTypes: {},
            severity: 'low' as const,
            metrics: {
              baselineFieldCount: 0,
              newFieldCount: batches[0]?.schemaFingerprint ?
                (batches[0].schemaFingerprint as { fields?: string[] }).fields?.length || 0 : 0,
              missingPercent: 0,
              addedCount: 0,
              typeChangeCount: 0
            }
          },
          baseline: null,
          received: null,
          suggestions: []
        });
        return;
      }

      const [received, baseline] = batches;
      const driftDetector = new SchemaDriftDetector();

      const receivedFingerprint = received.schemaFingerprint as {
        fields: string[];
        types: Record<string, string>;
        sampleSize: number;
      };

      const drift = await driftDetector.detectDrift(endpointId, receivedFingerprint);

      const baselineFingerprint = baseline.schemaFingerprint as {
        fields?: string[];
        types?: Record<string, string>;
      };

      const suggestions = await ApiEndpointController.generateMappingSuggestions(
        drift.newFields,
        baselineFingerprint.fields || []
      );

      res.json({
        drift,
        baseline: {
          fields: baselineFingerprint.fields || [],
          capturedAt: baseline.ingestedAt,
          batchId: baseline.syncBatchId
        },
        received: {
          fields: receivedFingerprint.fields,
          capturedAt: received.ingestedAt,
          batchId: received.syncBatchId
        },
        suggestions
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiEndpointController.getSchemaDrift');
    }
  }

  /**
   * GET /api/endpoints/:endpointId/mapping-versions
   * Get all mapping version snapshots for an endpoint
   */
  static async getMappingVersions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { endpointId } = req.params;

      const mappings = await prisma.api_field_mappings.findMany({
        where: { endpointId },
        select: {
          id: true,
          sourceField: true,
          destinationField: true,
          validFrom: true,
          validTo: true,
          createdBy: true,
          transformType: true
        },
        orderBy: { validFrom: 'desc' }
      });

      const versionMap = new Map<string, typeof mappings>();
      mappings.forEach(mapping => {
        const key = mapping.validFrom.toISOString();
        if (!versionMap.has(key)) {
          versionMap.set(key, []);
        }
        versionMap.get(key)!.push(mapping);
      });

      const versionSnapshots = Array.from(versionMap.entries()).map(
        ([validFrom, mappingsGroup], index) => ({
          id: `version_${validFrom}`,
          version: versionMap.size - index,
          validFrom,
          validTo: mappingsGroup[0].validTo,
          createdBy: mappingsGroup[0].createdBy,
          mappingCount: mappingsGroup.length,
          isActive: !mappingsGroup[0].validTo
        })
      );

      res.json({ versions: versionSnapshots });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiEndpointController.getMappingVersions');
    }
  }

  /**
   * GET /api/endpoints/:endpointId/mapping-versions/:versionId
   * Get specific mapping version details
   */
  static async getMappingVersionDetail(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { endpointId, versionId } = req.params;

      const validFrom = versionId.replace('version_', '');

      const mappings = await prisma.api_field_mappings.findMany({
        where: {
          endpointId,
          validFrom: new Date(validFrom)
        }
      });

      res.json({ mappings });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiEndpointController.getMappingVersionDetail');
    }
  }

  /**
   * POST /api/endpoints/:endpointId/mappings/batch
   * Create multiple field mappings at once
   */
  static async createMappingsBatch(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { endpointId } = req.params;
      const { mappings } = req.body;
      const userId = req.user?.userId || 'system';

      if (!Array.isArray(mappings) || mappings.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Mappings array is required and must not be empty'
        });
        return;
      }

      const results = { created: 0, failed: 0, mappings: [] as any[] };

      for (const mapping of mappings) {
        try {
          const created = await prisma.api_field_mappings.create({
            data: {
              id: `${endpointId}_${mapping.sourceField}_${Date.now()}`,
              endpointId,
              sourceField: mapping.sourceField,
              destinationField: mapping.destinationField,
              transformType: mapping.transformType || 'direct',
              dataType: mapping.dataType || 'string',
              transformParams: mapping.transformParams || {},
              defaultValue: mapping.defaultValue || null,
              isActive: true,
              validFrom: new Date(),
              createdBy: userId,
              updatedAt: new Date()
            }
          });
          results.created++;
          results.mappings.push(created);
        } catch (err: any) {
          results.failed++;
          console.error(
            `Failed to create mapping ${mapping.sourceField}:`,
            err.message
          );
        }
      }

      res.json(results);
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiEndpointController.createMappingsBatch');
    }
  }

  /**
   * POST /api/endpoints/:endpointId/mapping-versions/:versionId/restore
   * Restore a historical mapping version
   */
  static async restoreMappingVersion(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { endpointId, versionId } = req.params;
      const userId = req.user?.userId || 'system';

      const validFrom = versionId.replace('version_', '');

      const historicalMappings = await prisma.api_field_mappings.findMany({
        where: {
          endpointId,
          validFrom: new Date(validFrom)
        }
      });

      if (historicalMappings.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Version not found'
        });
        return;
      }

      await prisma.api_field_mappings.updateMany({
        where: {
          endpointId,
          isActive: true
        },
        data: {
          isActive: false,
          validTo: new Date()
        }
      });

      const restored = await prisma.$transaction(
        historicalMappings.map(old =>
          prisma.api_field_mappings.create({
            data: {
              id: `${endpointId}_${old.sourceField}_${Date.now()}_restored`,
              endpointId,
              sourceField: old.sourceField,
              destinationField: old.destinationField,
              transformType: old.transformType,
              dataType: old.dataType,
              transformParams: old.transformParams as Prisma.InputJsonValue,
              defaultValue: old.defaultValue,
              isActive: true,
              validFrom: new Date(),
              createdBy: userId,
              updatedAt: new Date()
            }
          })
        )
      );

      res.json({ restored: restored.length, mappings: restored });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiEndpointController.restoreMappingVersion');
    }
  }

  /**
   * GET /api/endpoints/active-organizations
   * Get list of active organizations available for sync
   * Used to populate organization dropdown in UI
   */
  static async getActiveOrganizations(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const orgs = await pemsSyncServiceV2.getActiveOrganizations();

      res.json({
        success: true,
        organizations: orgs
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiEndpointController.getActiveOrganizations');
    }
  }

  /**
   * POST /api/endpoints/:endpointId/fetch-raw
   * Fetch raw JSON data from PEMS without transformation
   * Uses the new api_servers + api_endpoints architecture (ADR-006)
   *
   * If organizationCode not provided, uses first active organization from DB
   */
  static async fetchRawData(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { endpointId } = req.params;
      const { serverId, organizationCode, limit, offset, includeRawResponse } = req.body;

      if (!serverId) {
        res.status(400).json({
          success: false,
          error: 'serverId is required'
        });
        return;
      }

      // organizationCode is optional - service will use first active org if not provided
      const result = await pemsSyncServiceV2.fetchRawData(
        serverId,
        endpointId,
        organizationCode,
        {
          limit: limit || 100,
          offset: offset || 0,
          includeRawResponse: includeRawResponse || false
        }
      );

      res.json({
        success: result.success,
        data: result
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiEndpointController.fetchRawData');
    }
  }

  /**
   * POST /api/endpoints/:endpointId/fetch-all
   * Fetch all pages of raw JSON data from PEMS
   */
  static async fetchAllRawData(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { endpointId } = req.params;
      const { serverId, organizationCode } = req.body;

      if (!serverId) {
        res.status(400).json({
          success: false,
          error: 'serverId is required'
        });
        return;
      }

      const result = await pemsSyncServiceV2.fetchAllRawData(
        serverId,
        endpointId,
        organizationCode
      );

      res.json({
        success: result.success,
        data: result
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiEndpointController.fetchAllRawData');
    }
  }

  /**
   * POST /api/endpoints/:endpointId/sync
   * Sync data from PEMS to database using new architecture
   */
  static async syncEndpointData(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { endpointId } = req.params;
      const { serverId, organizationId, syncType } = req.body;

      if (!serverId || !organizationId) {
        res.status(400).json({
          success: false,
          error: 'serverId and organizationId are required'
        });
        return;
      }

      const result = await pemsSyncServiceV2.syncPfaData(
        organizationId,
        serverId,
        endpointId,
        syncType || 'full'
      );

      res.json({
        success: result.status === 'completed',
        data: result
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiEndpointController.syncEndpointData');
    }
  }

  /**
   * Generate mapping suggestions using string similarity
   */
  private static async generateMappingSuggestions(
    newFields: string[],
    baselineFields: string[]
  ): Promise<Array<{
    sourceField: string;
    destinationField: string;
    confidence: number;
    reason: string;
  }>> {
    const suggestions = [];

    for (const newField of newFields) {
      for (const baseField of baselineFields) {
        const distance = levenshteinDistance(newField, baseField);
        const maxLen = Math.max(newField.length, baseField.length);
        const confidence = 1 - distance / maxLen;

        if (confidence > 0.7) {
          suggestions.push({
            sourceField: newField,
            destinationField: baseField,
            confidence: Math.round(confidence * 100) / 100,
            reason: `Field name similarity (Levenshtein distance: ${distance})`
          });
        }
      }
    }

    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
  }
}

export default ApiEndpointController;
