/**
 * @file apiEndpointService.ts
 * @description Service layer for API Endpoint management (two-tier architecture)
 * Handles CRUD operations and endpoint-level metadata
 */

import { PrismaClient, api_endpoints, endpoint_test_results } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

export interface CreateApiEndpointDto {
  serverId: string;
  name: string;
  path: string;
  description?: string;
  entity: string;
  operationType: 'read' | 'write' | 'read-write';
  customHeaders?: Record<string, string>;
  defaultParams?: Record<string, string>;
  promotionRules?: any;
  timeoutMs?: number;
  retryAttempts?: number;
}

export interface UpdateApiEndpointDto {
  name?: string;
  path?: string;
  description?: string;
  entity?: string;
  operationType?: 'read' | 'write' | 'read-write';
  customHeaders?: Record<string, string>;
  defaultParams?: Record<string, string>;
  promotionRules?: any;
  timeoutMs?: number;
  retryAttempts?: number;
  isActive?: boolean;
}

export interface ApiEndpointWithTestResults extends api_endpoints {
  testResults?: endpoint_test_results[];
  _count?: {
    testResults: number;
  };
}

export class ApiEndpointService {
  /**
   * Validate endpoint path for security
   * @throws Error if path is invalid
   */
  private static validatePath(path: string): void {
    // Must start with /
    if (!path.startsWith('/')) {
      throw new Error('Path must start with /');
    }

    // No path traversal allowed
    if (path.includes('..')) {
      throw new Error('Path traversal (..) is not allowed for security reasons');
    }

    // No backslashes (Windows path separators)
    if (path.includes('\\')) {
      throw new Error('Backslashes are not allowed in paths');
    }

    // Basic length check
    if (path.length > 500) {
      throw new Error('Path exceeds maximum length of 500 characters');
    }
  }

  /**
   * Sanitize text input to prevent XSS
   */
  private static sanitizeInput(input: string | undefined | null): string | undefined | null {
    if (!input) return input;

    // Remove script tags
    return input
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<script[^>]*>/gi, '')
      .replace(/<\/script>/gi, '')
      // Remove event handlers
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
      // Remove javascript: protocol
      .replace(/javascript:/gi, '');
  }

  /**
   * Get all endpoints for a server
   */
  static async getEndpointsByServer(serverId: string): Promise<api_endpoints[]> {
    const endpoints = await prisma.api_endpoints.findMany({
      where: { serverId },
      orderBy: { name: 'asc' }
    });

    return endpoints;
  }

  /**
   * Get a single endpoint by ID
   */
  static async getEndpointById(
    endpointId: string,
    serverId: string
  ): Promise<ApiEndpointWithTestResults | null> {
    const endpoint = await prisma.api_endpoints.findFirst({
      where: {
        id: endpointId,
        serverId
      },
      include: {
        endpoint_test_results: {
          orderBy: { testTimestamp: 'desc' },
          take: 10  // Last 10 test results
        },
        _count: {
          select: { endpoint_test_results: true }
        }
      }
    });

    return endpoint as ApiEndpointWithTestResults | null;
  }

  /**
   * Get endpoints by entity type
   */
  static async getEndpointsByEntity(
    serverId: string,
    entity: string
  ): Promise<api_endpoints[]> {
    const endpoints = await prisma.api_endpoints.findMany({
      where: {
        serverId,
        entity
      },
      orderBy: { name: 'asc' }
    });

    return endpoints;
  }

  /**
   * Create a new endpoint
   */
  static async createEndpoint(data: CreateApiEndpointDto): Promise<api_endpoints> {
    // Validate path for security
    this.validatePath(data.path);

    // Sanitize text inputs
    const sanitizedName = this.sanitizeInput(data.name) || data.name;
    const sanitizedDescription = this.sanitizeInput(data.description);

    // Convert custom headers to JSON string
    const customHeadersJson = data.customHeaders
      ? JSON.stringify(data.customHeaders)
      : null;

    // Convert default params to JSON (Prisma will handle the Json type)
    const defaultParamsJson = data.defaultParams || {};

    // Convert promotion rules to JSON (Prisma will handle the Json type)
    const promotionRulesJson = data.promotionRules || [];

    const endpoint = await prisma.api_endpoints.create({
      data: {
        id: randomUUID(),
        serverId: data.serverId,
        name: sanitizedName,
        path: data.path,
        description: sanitizedDescription,
        entity: data.entity,
        operationType: data.operationType,
        customHeaders: customHeadersJson,
        defaultParams: defaultParamsJson,
        promotionRules: promotionRulesJson,
        timeoutMs: data.timeoutMs || 30000,
        retryAttempts: data.retryAttempts || 3,
        isActive: true,
        status: 'untested',
        testCount: 0,
        successCount: 0,
        failureCount: 0,
        updatedAt: new Date()
      }
    });

    return endpoint;
  }

  /**
   * Update an existing endpoint
   */
  static async updateEndpoint(
    endpointId: string,
    serverId: string,
    data: UpdateApiEndpointDto
  ): Promise<api_endpoints> {
    // First verify the endpoint belongs to the server
    const existing = await prisma.api_endpoints.findFirst({
      where: { id: endpointId, serverId }
    });

    if (!existing) {
      throw new Error('Endpoint not found for this server');
    }

    // Build updateData object with only schema-valid fields
    const updateData: any = {};

    // Validate path if it's being updated
    if (data.path !== undefined) {
      this.validatePath(data.path);
      updateData.path = data.path;
    }

    // Sanitize text inputs if they're being updated
    if (data.name !== undefined) {
      updateData.name = this.sanitizeInput(data.name) || data.name;
    }
    if (data.description !== undefined) {
      updateData.description = this.sanitizeInput(data.description);
    }

    // Add other allowed fields
    if (data.entity !== undefined) {
      updateData.entity = data.entity;
    }
    if (data.operationType !== undefined) {
      updateData.operationType = data.operationType;
    }
    if (data.timeoutMs !== undefined) {
      updateData.timeoutMs = data.timeoutMs;
    }
    if (data.retryAttempts !== undefined) {
      updateData.retryAttempts = data.retryAttempts;
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    // Convert custom headers to JSON string
    if (data.customHeaders !== undefined) {
      updateData.customHeaders = data.customHeaders
        ? JSON.stringify(data.customHeaders)
        : null;
    }

    // Handle default params (Prisma handles Json type)
    if (data.defaultParams !== undefined) {
      updateData.defaultParams = data.defaultParams || {};
    }

    // Handle promotion rules (Prisma handles Json type)
    if (data.promotionRules !== undefined) {
      updateData.promotionRules = data.promotionRules || [];
    }

    const endpoint = await prisma.api_endpoints.update({
      where: { id: endpointId },
      data: updateData
    });

    return endpoint;
  }

  /**
   * Delete an endpoint
   */
  static async deleteEndpoint(endpointId: string, serverId: string): Promise<void> {
    // First verify the endpoint belongs to the server
    const existing = await prisma.api_endpoints.findFirst({
      where: { id: endpointId, serverId }
    });

    if (!existing) {
      throw new Error('Endpoint not found for this server');
    }

    await prisma.api_endpoints.delete({
      where: { id: endpointId }
    });
  }

  /**
   * Update endpoint metadata after a test
   */
  static async updateEndpointMetadata(
    endpointId: string,
    testResult: {
      success: boolean;
      responseTimeMs?: number;
      statusCode?: number;
      errorMessage?: string;
    }
  ): Promise<api_endpoints> {
    const endpoint = await prisma.api_endpoints.findUnique({
      where: { id: endpointId },
      select: {
        testCount: true,
        successCount: true,
        failureCount: true,
        avgResponseTimeMs: true,
        firstTestedAt: true
      }
    });

    if (!endpoint) {
      throw new Error('Endpoint not found');
    }

    const newTestCount = endpoint.testCount + 1;
    const newSuccessCount = testResult.success
      ? endpoint.successCount + 1
      : endpoint.successCount;
    const newFailureCount = !testResult.success
      ? endpoint.failureCount + 1
      : endpoint.failureCount;

    // Calculate new average response time
    let newAvgResponseTime = endpoint.avgResponseTimeMs;
    if (testResult.responseTimeMs !== undefined) {
      if (endpoint.avgResponseTimeMs === null) {
        newAvgResponseTime = testResult.responseTimeMs;
      } else {
        newAvgResponseTime = Math.round(
          (endpoint.avgResponseTimeMs * endpoint.testCount + testResult.responseTimeMs) /
          newTestCount
        );
      }
    }

    // Determine status based on test result
    let status: string;
    if (testResult.success) {
      status = 'healthy';
    } else {
      // Check failure rate
      const failureRate = newFailureCount / newTestCount;
      if (failureRate > 0.5) {
        status = 'down';
      } else {
        status = 'degraded';
      }
    }

    const updateData: any = {
      testCount: newTestCount,
      successCount: newSuccessCount,
      failureCount: newFailureCount,
      avgResponseTimeMs: newAvgResponseTime,
      lastTestedAt: new Date(),
      status
    };

    // Set firstTestedAt if this is the first test
    if (!endpoint.firstTestedAt) {
      updateData.firstTestedAt = new Date();
    }

    // Update last known good/error state
    if (testResult.success) {
      updateData.lastKnownGoodAt = new Date();
    } else {
      updateData.lastErrorMessage = testResult.errorMessage || 'Unknown error';
      updateData.lastErrorAt = new Date();
      updateData.lastStatusCode = testResult.statusCode;
    }

    const updatedEndpoint = await prisma.api_endpoints.update({
      where: { id: endpointId },
      data: updateData
    });

    return updatedEndpoint;
  }

  /**
   * Get custom headers for an endpoint
   */
  static getCustomHeaders(endpoint: api_endpoints): Record<string, string> {
    if (!endpoint.customHeaders) {
      return {};
    }

    try {
      return JSON.parse(endpoint.customHeaders);
    } catch (error) {
      console.error('Failed to parse custom headers:', error);
      return {};
    }
  }

  /**
   * Get all endpoints for an organization (across all servers)
   */
  static async getEndpointsByOrganization(organizationId: string): Promise<api_endpoints[]> {
    const endpoints = await prisma.api_endpoints.findMany({
      where: {
        api_servers: {
          organizationId
        }
      },
      include: {
        api_servers: {
          select: {
            id: true,
            name: true,
            baseUrl: true
          }
        }
      },
      orderBy: [
        { api_servers: { name: 'asc' } },
        { name: 'asc' }
      ]
    });

    return endpoints;
  }
}

export default ApiEndpointService;
