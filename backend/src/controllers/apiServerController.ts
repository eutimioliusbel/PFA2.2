/**
 * @file apiServerController.ts
 * @description REST API controller for API Server management
 * Exposes 6 endpoints for server CRUD and testing
 */

import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import ApiServerService from '../services/apiServerService';
import EndpointTestService from '../services/endpointTestService';
import { handleControllerError } from '../utils/errorHandling';

export class ApiServerController {
  /**
   * GET /api/servers
   * Get all API servers for the authenticated user's organization
   */
  static async getServers(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Get organizationId from query params or use first org from user's access list
      const organizationId = req.query.organizationId as string ||
                            (req.user?.organizations && req.user.organizations[0]?.organizationId);

      if (!organizationId) {
        res.status(401).json({ error: 'Organization not found in token' });
        return;
      }

      const servers = await ApiServerService.getServersByOrganization(organizationId);

      res.json({
        success: true,
        data: servers.map(server => {
          const serverData = server as any; // Service returns Prisma result with api_endpoints
          return {
            ...serverData,
            // Map api_endpoints to endpoints for frontend compatibility
            endpoints: serverData.api_endpoints || [],
            api_endpoints: undefined,
            // Remove encrypted credentials from response
            authKeyEncrypted: undefined,
            authValueEncrypted: undefined,
            // Include credential status only
            hasCredentials: !!(serverData.authKeyEncrypted || serverData.authValueEncrypted)
          };
        })
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiServerController.getServers');
    }
  }

  /**
   * GET /api/servers/:serverId
   * Get a single API server by ID
   */
  static async getServerById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;
      const organizationId = req.query.organizationId as string ||
                            (req.user?.organizations && req.user.organizations[0]?.organizationId);

      if (!organizationId) {
        res.status(401).json({ error: 'Organization not found in token' });
        return;
      }

      const server = await ApiServerService.getServerById(serverId, organizationId);

      if (!server) {
        res.status(404).json({
          success: false,
          error: 'API server not found'
        });
        return;
      }

      const serverData = server as any; // Service returns Prisma result with api_endpoints
      res.json({
        success: true,
        data: {
          ...serverData,
          // Map api_endpoints to endpoints for frontend compatibility
          endpoints: serverData.api_endpoints || [],
          api_endpoints: undefined,
          authKeyEncrypted: undefined,
          authValueEncrypted: undefined,
          hasCredentials: !!(serverData.authKeyEncrypted || serverData.authValueEncrypted)
        }
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiServerController.getServerById');
    }
  }

  /**
   * POST /api/servers
   * Create a new API server
   */
  static async createServer(req: AuthRequest, res: Response): Promise<void> {
    try {
      const organizationId = req.body.organizationId ||
                            req.query.organizationId as string ||
                            (req.user?.organizations && req.user.organizations[0]?.organizationId);

      if (!organizationId) {
        res.status(401).json({ error: 'Organization not found in token' });
        return;
      }

      // Validate required fields
      const { name, baseUrl, authType } = req.body;
      if (!name || !baseUrl || !authType) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: name, baseUrl, authType'
        });
        return;
      }

      const server = await ApiServerService.createServer({
        ...req.body,
        organizationId
      }, req.user?.userId);

      const serverData = server as any; // Service returns Prisma result
      res.status(201).json({
        success: true,
        data: {
          ...serverData,
          authKeyEncrypted: undefined,
          authValueEncrypted: undefined,
          hasCredentials: !!(serverData.authKeyEncrypted || serverData.authValueEncrypted)
        }
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiServerController.createServer');
    }
  }

  /**
   * PUT /api/servers/:serverId
   * Update an existing API server
   */
  static async updateServer(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;
      const organizationId = req.body.organizationId ||
                            req.query.organizationId as string ||
                            (req.user?.organizations && req.user.organizations[0]?.organizationId);

      if (!organizationId) {
        res.status(401).json({ error: 'Organization not found in token' });
        return;
      }

      const server = await ApiServerService.updateServer(
        serverId,
        organizationId,
        req.body,
        req.user?.userId
      );

      const serverData = server as any; // Service returns Prisma result
      res.json({
        success: true,
        data: {
          ...serverData,
          authKeyEncrypted: undefined,
          authValueEncrypted: undefined,
          hasCredentials: !!(serverData.authKeyEncrypted || serverData.authValueEncrypted)
        }
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiServerController.updateServer');
    }
  }

  /**
   * DELETE /api/servers/:serverId
   * Delete an API server (cascades to endpoints)
   */
  static async deleteServer(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;
      const organizationId = req.query.organizationId as string ||
                            (req.user?.organizations && req.user.organizations[0]?.organizationId);

      if (!organizationId) {
        res.status(401).json({ error: 'Organization not found in token' });
        return;
      }

      await ApiServerService.deleteServer(serverId, organizationId, req.user?.userId);

      res.json({
        success: true,
        message: 'API server deleted successfully'
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiServerController.deleteServer');
    }
  }

  /**
   * POST /api/servers/test-connection
   * Test connection without saving (for form validation)
   */
  static async testConnection(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { baseUrl, authType, authKey, authValue } = req.body;

      if (!baseUrl) {
        res.status(400).json({
          success: false,
          error: 'Base URL is required'
        });
        return;
      }

      // Simple connectivity test - try to reach the server
      try {
        const axios = require('axios');
        const headers: Record<string, string> = {};

        // Add authentication if provided
        if (authType === 'basic' && authKey && authValue) {
          const credentials = Buffer.from(`${authKey}:${authValue}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        } else if (authType === 'bearer' && authValue) {
          headers['Authorization'] = `Bearer ${authValue}`;
        } else if (authType === 'apiKey' && authKey) {
          headers['X-API-Key'] = authKey;
        }

        // Try a simple HEAD or GET request to the base URL
        const response = await axios({
          method: 'GET',
          url: baseUrl,
          headers,
          timeout: 5000, // 5 second timeout
          validateStatus: () => true // Don't throw on any status code
        });

        // Accept any response (even errors) as long as we can connect
        res.json({
          success: true,
          message: `Connected successfully (HTTP ${response.status})`,
          statusCode: response.status
        });
        return;
      } catch (error: unknown) {
        // Handle axios-specific errors
        const axiosError = error as { code?: string; response?: { status?: number }; message?: string };
        if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ETIMEDOUT') {
          res.status(400).json({
            success: false,
            message: 'Cannot connect to server. Check URL and network.'
          });
          return;
        } else if (axiosError.response && axiosError.response.status === 401) {
          res.status(400).json({
            success: false,
            message: 'Authentication failed. Check credentials.'
          });
          return;
        } else {
          res.status(400).json({
            success: false,
            message: axiosError.message || 'Connection test failed'
          });
          return;
        }
      }
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiServerController.testConnection');
    }
  }

  /**
   * POST /api/servers/:serverId/test
   * Test all endpoints for a server
   */
  static async testAllEndpoints(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;
      const organizationId = req.query.organizationId as string ||
                            (req.user?.organizations && req.user.organizations[0]?.organizationId);
      const userId = req.user?.userId;

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

      // Test all endpoints
      const results = await EndpointTestService.testAllEndpoints(serverId, {
        triggeredBy: userId,
        testType: 'manual'
      });

      res.json({
        success: true,
        data: {
          serverId,
          totalEndpoints: results.length,
          successfulTests: results.filter(r => r.success).length,
          failedTests: results.filter(r => !r.success).length,
          results
        }
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiServerController.testAllEndpoints');
    }
  }
}

export default ApiServerController;
