/**
 * @file endpointTestService.ts
 * @description Service for testing API endpoints with AI-ready result logging
 * Implements all mandatory AI data hooks from ADR-006-AI_OPPORTUNITIES.md
 */

import { PrismaClient, endpoint_test_results, api_endpoints, api_servers } from '@prisma/client';
import axios, { AxiosError } from 'axios';
import { randomUUID } from 'crypto';
import ApiServerService from './apiServerService';
import ApiEndpointService from './apiEndpointService';

const prisma = new PrismaClient();

export interface TestEndpointOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  payload?: any;
  customHeaders?: Record<string, string>;
  triggeredBy?: string;  // User ID or 'system'
  testType?: 'manual' | 'scheduled' | 'health_check' | 'pre_sync';
  organizationId?: string;  // For global servers, which org to test with
}

export interface EndpointTestResponse {
  success: boolean;
  responseTimeMs: number;
  statusCode?: number;
  errorType?: string;
  errorMessage?: string;
  testResultId: string;
}

export class EndpointTestService {
  /**
   * Test a single endpoint and log results with AI hooks
   */
  static async testEndpoint(
    endpointId: string,
    options: TestEndpointOptions = {}
  ): Promise<EndpointTestResponse> {
    const startTime = Date.now();

    // Get endpoint and server details
    const endpoint = await prisma.api_endpoints.findUnique({
      where: { id: endpointId },
      include: {
        api_servers: true
      }
    });

    if (!endpoint) {
      throw new Error('Endpoint not found');
    }

    const server = endpoint.api_servers;

    // Get endpoint custom headers
    const endpointHeaders = ApiEndpointService.getCustomHeaders(endpoint);

    // Build full URL
    let requestUrl = ApiServerService.buildEndpointUrl(server, endpoint.path);

    // For PEMS grid data API, we need to use POST with JSON body, not GET with query params
    const isPemsGridData = endpoint.entity === 'pfa' && endpoint.operationType === 'read';

    if (!isPemsGridData && Object.keys(endpointHeaders).length > 0) {
      // For non-PEMS APIs, append custom headers as query parameters
      const separator = requestUrl.includes('?') ? '&' : '?';
      const queryParams = new URLSearchParams(endpointHeaders).toString();
      requestUrl = `${requestUrl}${separator}${queryParams}`;
    }

    // Get credentials
    const credentials = await ApiServerService.getDecryptedCredentials(
      server.id,
      server.organizationId
    );

    // Determine which organization to use for this request
    // Global servers (organizationId = NULL) use the test request's organizationId
    // Org-specific servers use their own organizationId
    const targetOrganizationId = server.organizationId || options.organizationId;

    // Look up organization code for dynamic injection
    let organizationCode: string | null = null;
    if (targetOrganizationId) {
      const organization = await prisma.organizations.findUnique({
        where: { id: targetOrganizationId },
        select: { code: true }
      });
      organizationCode = organization?.code || null;
    }

    // Merge headers (server common + request custom only)
    const serverHeaders = ApiServerService.getCommonHeaders(server);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...serverHeaders,
      ...(options.customHeaders || {})
    };

    // Inject organization code as header if available (for PEMS and other multi-tenant APIs)
    if (organizationCode) {
      headers['organization'] = organizationCode;
    }

    // Add authentication headers
    if (server.authType === 'basic' && credentials.authKey && credentials.authValue) {
      const authString = Buffer.from(
        `${credentials.authKey}:${credentials.authValue}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${authString}`;
    } else if (server.authType === 'bearer' && credentials.authValue) {
      headers['Authorization'] = `Bearer ${credentials.authValue}`;
    } else if (server.authType === 'apiKey' && credentials.authKey && credentials.authValue) {
      headers[credentials.authKey] = credentials.authValue;
    }

    // Gather AI context data BEFORE test
    const contextBefore = await this.gatherContextData(endpoint, server);

    // Build request payload for PEMS grid data API
    let requestPayload: any = options.payload;
    let requestMethod = options.method || 'GET';

    if (isPemsGridData) {
      requestMethod = 'POST';

      // Build PEMS grid data request body (same structure as PemsSyncService)
      requestPayload = {
        GRID: {
          NUMBER_OF_ROWS_FIRST_RETURNED: 10,  // Small test request
          ROW_OFFSET: 0,
          RESULT_IN_SAXORDER: "TRUE"
        },
        ADDON_SORT: {
          ALIAS_NAME: "pfs_id",
          TYPE: "ASC"
        },
        GRID_TYPE: {
          TYPE: "LIST"
        },
        LOV_PARAMETER: {
          ALIAS_NAME: "pfs_id"
        },
        REQUEST_TYPE: "LIST.DATA_ONLY.STORED"
      };

      // Add gridCode and gridID from endpoint custom headers
      if (endpointHeaders.gridCode) {
        requestPayload.GRID['GRID_NAME'] = endpointHeaders.gridCode;
      }
      if (endpointHeaders.gridID) {
        requestPayload.GRID['GRID_ID'] = endpointHeaders.gridID;
      }

      // Add organization filter if available
      if (organizationCode) {
        requestPayload.ADDON_FILTER = {
          ALIAS_NAME: "pfs_a_org",
          OPERATOR: "BEGINS",
          VALUE: organizationCode
        };
      }
    }

    let testResult: Partial<endpoint_test_results> = {
      endpointId: endpoint.id,
      testTimestamp: new Date(),
      requestUrl,
      requestMethod,
      requestHeaders: JSON.stringify(headers),
      requestPayload: requestPayload ? JSON.stringify(requestPayload).substring(0, 1024) : null,
      triggeredBy: options.triggeredBy || 'system',
      testType: options.testType || 'manual'
    };

    try {
      // Execute HTTP request
      const response = await axios({
        method: requestMethod,
        url: requestUrl,
        headers,
        data: requestPayload,
        timeout: endpoint.timeoutMs,
        validateStatus: () => true  // Don't throw on any status code
      });

      const responseTimeMs = Date.now() - startTime;

      // Capture response details (first 1KB)
      const responseSample = typeof response.data === 'string'
        ? response.data.substring(0, 1024)
        : JSON.stringify(response.data).substring(0, 1024);

      const success = response.status >= 200 && response.status < 300;

      // Complete test result with AI hooks
      testResult = {
        ...testResult,
        success,
        responseTimeMs,
        statusCode: response.status,
        responseHeaders: JSON.stringify(response.headers),
        responseSample,
        errorType: success ? null : this.classifyError(response.status),
        errorMessage: success ? null : `HTTP ${response.status}: ${response.statusText}`,
        contextData: JSON.stringify({
          ...contextBefore,
          serverHealthBefore: server.healthStatus,
          userAction: options.testType || 'manual_test'
        })
      };

      // Save test result to database
      const savedResult = await prisma.endpoint_test_results.create({
        data: {
          id: randomUUID(),
          ...testResult
        } as any
      });

      // Update endpoint metadata
      await ApiEndpointService.updateEndpointMetadata(endpoint.id, {
        success,
        responseTimeMs,
        statusCode: response.status
      });

      // Update server health aggregation
      await ApiServerService.updateServerHealth(server.id);

      return {
        success,
        responseTimeMs,
        statusCode: response.status,
        testResultId: savedResult.id
      };

    } catch (error: unknown) {
      const responseTimeMs = Date.now() - startTime;
      const axiosError = error as AxiosError;

      const errorType = this.classifyAxiosError(axiosError);
      const errorMessage = axiosError.message || 'Unknown error';

      // Complete test result with error details
      testResult = {
        ...testResult,
        success: false,
        responseTimeMs,
        statusCode: axiosError.response?.status,
        errorType,
        errorMessage,
        responseHeaders: axiosError.response
          ? JSON.stringify(axiosError.response.headers)
          : null,
        responseSample: axiosError.response?.data
          ? JSON.stringify(axiosError.response.data).substring(0, 1024)
          : null,
        contextData: JSON.stringify({
          ...contextBefore,
          serverHealthBefore: server.healthStatus,
          userAction: options.testType || 'manual_test',
          errorStack: (error as any).stack?.substring(0, 500)
        })
      };

      // Save test result
      const savedResult = await prisma.endpoint_test_results.create({
        data: {
          id: randomUUID(),
          ...testResult
        } as any
      });

      // Update endpoint metadata
      await ApiEndpointService.updateEndpointMetadata(endpoint.id, {
        success: false,
        responseTimeMs,
        statusCode: axiosError.response?.status,
        errorMessage
      });

      // Update server health
      await ApiServerService.updateServerHealth(server.id);

      return {
        success: false,
        responseTimeMs,
        statusCode: axiosError.response?.status,
        errorType,
        errorMessage,
        testResultId: savedResult.id
      };
    }
  }

  /**
   * Test all endpoints for a server
   */
  static async testAllEndpoints(
    serverId: string,
    options: Omit<TestEndpointOptions, 'method' | 'payload'> = {}
  ): Promise<EndpointTestResponse[]> {
    const endpoints = await ApiEndpointService.getEndpointsByServer(serverId);

    const results: EndpointTestResponse[] = [];

    for (const endpoint of endpoints) {
      if (!endpoint.isActive) {
        continue;
      }

      try {
        const result = await this.testEndpoint(endpoint.id, {
          ...options,
          method: endpoint.operationType === 'write' ? 'POST' : 'GET'
        });
        results.push(result);
      } catch (error) {
        console.error(`Failed to test endpoint ${endpoint.name}:`, error);
      }
    }

    return results;
  }

  /**
   * Get test results for an endpoint
   */
  static async getTestResults(
    endpointId: string,
    limit: number = 50
  ): Promise<endpoint_test_results[]> {
    const results = await prisma.endpoint_test_results.findMany({
      where: { endpointId },
      orderBy: { testTimestamp: 'desc' },
      take: limit
    });

    return results;
  }

  /**
   * Get latest test result for an endpoint
   */
  static async getLatestTestResult(endpointId: string): Promise<endpoint_test_results | null> {
    const result = await prisma.endpoint_test_results.findFirst({
      where: { endpointId },
      orderBy: { testTimestamp: 'desc' }
    });

    return result;
  }

  /**
   * Classify error type from HTTP status code
   */
  private static classifyError(statusCode: number): string {
    if (statusCode >= 400 && statusCode < 500) {
      if (statusCode === 401 || statusCode === 403) {
        return 'auth';
      }
      return 'client';
    } else if (statusCode >= 500) {
      return 'server';
    }
    return 'unknown';
  }

  /**
   * Classify error type from Axios error
   */
  private static classifyAxiosError(error: AxiosError): string {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return 'timeout';
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return 'network';
    } else if (error.response) {
      return this.classifyError(error.response.status);
    }
    return 'unknown';
  }

  /**
   * Gather AI context data (Hook #3: Context Data)
   * Captures system state before test for AI analysis
   */
  private static async gatherContextData(
    endpoint: api_endpoints,
    server: api_servers
  ): Promise<Record<string, any>> {
    // Get sibling endpoints status
    const siblingEndpoints = await prisma.api_endpoints.findMany({
      where: {
        serverId: server.id,
        id: { not: endpoint.id }
      },
      select: { status: true }
    });

    const otherEndpointsStatus = siblingEndpoints.map(e => e.status);

    // Get recent error count for this endpoint
    const recentErrors = await prisma.endpoint_test_results.count({
      where: {
        endpointId: endpoint.id,
        success: false,
        testTimestamp: {
          gte: new Date(Date.now() - 3600000)  // Last hour
        }
      }
    });

    // Get active session count (if applicable)
    // This would come from your session management system
    const activeSessionCount = 0;  // Placeholder

    return {
      serverHealthBefore: server.healthStatus,
      otherEndpointsStatus,
      recentErrorCount: recentErrors,
      activeSessionCount,
      serverHealthScore: server.healthScore,
      endpointTestCount: endpoint.testCount,
      endpointSuccessRate: endpoint.testCount > 0
        ? Math.round((endpoint.successCount / endpoint.testCount) * 100)
        : null
    };
  }
}

export default EndpointTestService;
