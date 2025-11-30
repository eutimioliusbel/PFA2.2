/**
 * @file apiServerService.ts
 * @description Service layer for API Server management (two-tier architecture)
 * Handles CRUD operations, health aggregation, and server-level operations
 */

import { PrismaClient, api_servers, api_endpoints } from '@prisma/client';
import { encryptionService } from '../utils/encryption';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

export interface CreateApiServerDto {
  organizationId: string;
  name: string;
  baseUrl: string;
  description?: string;
  authType: 'basic' | 'bearer' | 'apiKey' | 'none';
  authKey?: string;  // Plaintext (will be encrypted)
  authValue?: string;  // Plaintext (will be encrypted)
  commonHeaders?: Record<string, string>;
  status?: 'active' | 'inactive' | 'maintenance';
}

export interface UpdateApiServerDto {
  name?: string;
  baseUrl?: string;
  description?: string;
  authType?: 'basic' | 'bearer' | 'apiKey' | 'none';
  authKey?: string;  // Plaintext (will be encrypted if provided)
  authValue?: string;  // Plaintext (will be encrypted if provided)
  commonHeaders?: Record<string, string>;
  status?: 'active' | 'inactive' | 'maintenance';
  isActive?: boolean;
}

export interface ApiServerWithEndpoints extends api_servers {
  endpoints: api_endpoints[];
  _count?: {
    endpoints: number;
  };
  authKeyEncrypted: string | null;
  authValueEncrypted: string | null;
}

export class ApiServerService {
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
   * Get all API servers for an organization
   */
  static async getServersByOrganization(organizationId: string): Promise<ApiServerWithEndpoints[]> {
    const servers = await prisma.api_servers.findMany({
      where: { organizationId },
      include: {
        api_endpoints: {
          orderBy: { name: 'asc' }
        },
        _count: {
          select: { api_endpoints: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return servers as any;
  }

  /**
   * Get a single API server by ID
   */
  static async getServerById(serverId: string, organizationId: string): Promise<ApiServerWithEndpoints | null> {
    const server = await prisma.api_servers.findFirst({
      where: {
        id: serverId,
        organizationId
      },
      include: {
        api_endpoints: {
          orderBy: { name: 'asc' }
        },
        _count: {
          select: { api_endpoints: true }
        }
      }
    });

    return server as any;
  }

  /**
   * Create a new API server
   */
  static async createServer(data: CreateApiServerDto, userId?: string): Promise<api_servers> {
    // Sanitize text inputs
    const sanitizedName = this.sanitizeInput(data.name) || data.name;
    const sanitizedDescription = this.sanitizeInput(data.description);

    // Encrypt credentials if provided
    const authKeyEncrypted = data.authKey
      ? encryptionService.encrypt(data.authKey)
      : null;

    const authValueEncrypted = data.authValue
      ? encryptionService.encrypt(data.authValue)
      : null;

    // Convert common headers to JSON string
    const commonHeadersJson = data.commonHeaders
      ? JSON.stringify(data.commonHeaders)
      : null;

    const server = await prisma.api_servers.create({
      data: {
        id: randomUUID(),
        organizationId: data.organizationId,
        name: sanitizedName,
        baseUrl: data.baseUrl,
        description: sanitizedDescription,
        authType: data.authType,
        authKeyEncrypted,
        authValueEncrypted,
        commonHeaders: commonHeadersJson,
        status: data.status || 'active',
        isActive: true,
        healthStatus: 'unknown',
        healthScore: 0,
        totalEndpoints: 0,
        healthyEndpoints: 0,
        degradedEndpoints: 0,
        downEndpoints: 0,
        updatedAt: new Date()
      }
    });

    // Audit logging
    if (userId) {
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          userId,
          organizationId: data.organizationId,
          action: 'api_server:create',
          resource: 'api_servers',
          method: 'POST',
          success: true,
          metadata: JSON.stringify({
            serverId: server.id,
            serverName: server.name,
            baseUrl: server.baseUrl,
            authType: server.authType,
          }) as any
        },
      }).catch(err => console.error('Audit log failed:', err));
    }

    return server;
  }

  /**
   * Update an existing API server
   */
  static async updateServer(
    serverId: string,
    organizationId: string,
    data: UpdateApiServerDto,
    userId?: string
  ): Promise<api_servers> {
    // First verify the server belongs to the organization
    const existing = await prisma.api_servers.findFirst({
      where: { id: serverId, organizationId }
    });

    if (!existing) {
      throw new Error('Server not found for this organization');
    }

    // Build updateData object with only schema-valid fields
    const updateData: any = {};

    // Sanitize text inputs if they're being updated
    if (data.name !== undefined) {
      updateData.name = this.sanitizeInput(data.name) || data.name;
    }
    if (data.description !== undefined) {
      updateData.description = this.sanitizeInput(data.description);
    }
    if (data.baseUrl !== undefined) {
      updateData.baseUrl = data.baseUrl;
    }
    if (data.authType !== undefined) {
      updateData.authType = data.authType;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    // Handle credentials encryption
    if (data.authKey !== undefined) {
      updateData.authKeyEncrypted = data.authKey
        ? encryptionService.encrypt(data.authKey)
        : null;
    }

    if (data.authValue !== undefined) {
      updateData.authValueEncrypted = data.authValue
        ? encryptionService.encrypt(data.authValue)
        : null;
    }

    // Convert common headers to JSON string
    if (data.commonHeaders !== undefined) {
      updateData.commonHeaders = data.commonHeaders
        ? JSON.stringify(data.commonHeaders)
        : null;
    }

    const server = await prisma.api_servers.update({
      where: { id: serverId },
      data: updateData
    });

    // Audit logging
    if (userId) {
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          userId,
          organizationId,
          action: 'api_server:update',
          resource: 'api_servers',
          method: 'PUT',
          success: true,
          metadata: JSON.stringify({
            serverId: server.id,
            serverName: server.name,
            updatedFields: Object.keys(data),
          }) as any
        },
      }).catch(err => console.error('Audit log failed:', err));
    }

    return server;
  }

  /**
   * Delete an API server (will cascade delete all endpoints)
   */
  static async deleteServer(serverId: string, organizationId: string, userId?: string): Promise<void> {
    // Get server details before deletion for audit log
    const server = await prisma.api_servers.findFirst({
      where: { id: serverId, organizationId },
      select: { id: true, name: true, baseUrl: true },
    });

    if (!server) {
      throw new Error('Server not found for this organization');
    }

    await prisma.api_servers.delete({
      where: { id: serverId }
    });

    // Audit logging
    if (userId) {
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          userId,
          organizationId,
          action: 'api_server:delete',
          resource: 'api_servers',
          method: 'DELETE',
          success: true,
          metadata: JSON.stringify({
            serverId: server.id,
            serverName: server.name,
            baseUrl: server.baseUrl,
            cascadeDelete: true,
          }) as any
        },
      }).catch(err => console.error('Audit log failed:', err));
    }
  }

  /**
   * Get decrypted credentials for a server (for internal use only)
   * NEVER expose this through the API
   */
  static async getDecryptedCredentials(
    serverId: string,
    organizationId: string
  ): Promise<{ authKey: string | null; authValue: string | null }> {
    const server = await prisma.api_servers.findFirst({
      where: {
        id: serverId,
        organizationId
      },
      select: {
        authKeyEncrypted: true,
        authValueEncrypted: true
      }
    });

    if (!server) {
      throw new Error('Server not found');
    }

    return {
      authKey: server.authKeyEncrypted
        ? encryptionService.decrypt(server.authKeyEncrypted)
        : null,
      authValue: server.authValueEncrypted
        ? encryptionService.decrypt(server.authValueEncrypted)
        : null
    };
  }

  /**
   * Update server health status based on endpoint aggregation
   * Called after endpoint tests complete
   */
  static async updateServerHealth(serverId: string): Promise<api_servers> {
    // Get all endpoints for this server
    const endpoints = await prisma.api_endpoints.findMany({
      where: { serverId },
      select: { status: true }
    });

    const totalEndpoints = endpoints.length;
    const healthyEndpoints = endpoints.filter(e => e.status === 'healthy').length;
    const degradedEndpoints = endpoints.filter(e => e.status === 'degraded').length;
    const downEndpoints = endpoints.filter(e => e.status === 'down').length;

    // Calculate health score (0-100)
    const healthScore = totalEndpoints > 0
      ? Math.round((healthyEndpoints / totalEndpoints) * 100)
      : 0;

    // Determine overall health status
    let healthStatus: string;
    if (downEndpoints === totalEndpoints) {
      healthStatus = 'down';
    } else if (healthScore >= 80) {
      healthStatus = 'healthy';
    } else if (healthScore >= 50) {
      healthStatus = 'degraded';
    } else {
      healthStatus = 'down';
    }

    // Update server
    const server = await prisma.api_servers.update({
      where: { id: serverId },
      data: {
        healthStatus,
        healthScore,
        totalEndpoints,
        healthyEndpoints,
        degradedEndpoints,
        downEndpoints,
        lastHealthCheckAt: new Date()
      }
    });

    return server;
  }

  /**
   * Build full URL for an endpoint
   */
  static buildEndpointUrl(server: api_servers, endpointPath: string): string {
    const baseUrl = server.baseUrl.endsWith('/')
      ? server.baseUrl.slice(0, -1)
      : server.baseUrl;

    const path = endpointPath.startsWith('/')
      ? endpointPath
      : `/${endpointPath}`;

    return `${baseUrl}${path}`;
  }

  /**
   * Get common headers for a server
   */
  static getCommonHeaders(server: api_servers): Record<string, string> {
    if (!server.commonHeaders) {
      return {};
    }

    try {
      return JSON.parse(server.commonHeaders);
    } catch (error) {
      console.error('Failed to parse common headers:', error);
      return {};
    }
  }
}

export default ApiServerService;
