/**
 * PEMS Sync Service V2
 *
 * Uses the new api_servers + api_endpoints architecture (ADR-006)
 * instead of the legacy api_configurations table.
 *
 * Key differences from V1:
 * - Server config comes from api_servers (baseUrl, auth, commonHeaders)
 * - Endpoint config comes from api_endpoints (path, customHeaders with gridCode/gridID)
 * - Credentials are per-server, not per-config
 * - Supports raw JSON fetch without transformation
 * - Generic for all entity types (pfa, assets, users, etc.)
 */

import { PrismaClient, api_endpoints, api_servers } from '@prisma/client';
import { logger } from '../../utils/logger';
import ApiServerService from '../apiServerService';
import ApiEndpointService from '../apiEndpointService';
import { format, parse, add, sub } from 'date-fns';

const prisma = new PrismaClient();

/**
 * Field mapping with transform configuration
 */
interface FieldMappingConfig {
  sourceField: string;
  destinationField: string;
  dataType: string;
  transformType: string | null;
  transformParams: Record<string, unknown> | null;
  defaultValue: string | null;
}

/**
 * Mapped PFA data from PEMS after field mappings applied
 */
interface MappedPfaData {
  pfaId: string;
  organization?: string;
  category?: string | null;
  class?: string | null;
  source?: string | null;
  dor?: string | null;
  areaSilo?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  monthlyRate?: number | null;
  purchasePrice?: number | null;
  forecastStart?: string | Date | null;
  forecastEnd?: string | Date | null;
  originalStart?: string | Date | null;
  originalEnd?: string | Date | null;
  actualStart?: string | Date | null;
  actualEnd?: string | Date | null;
  isActualized?: boolean;
  isDiscontinued?: boolean;
  isFundsTransferable?: boolean;
  hasPlan?: boolean;
  hasActuals?: boolean;
  lastSyncedAt?: string;
  [key: string]: unknown;
}

/**
 * Helper to safely convert date values to Date objects
 */
function toDateOrNull(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  return new Date(value);
}

export interface SyncProgressV2 {
  syncId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  organizationId: string;
  serverId: string;
  endpointId: string;
  totalRecords: number;
  processedRecords: number;
  insertedRecords: number;
  updatedRecords: number;
  errorRecords: number;
  startedAt: Date;
  completedAt?: Date;
  currentBatch: number;
  totalBatches: number;
  error?: string;
}

export interface RawFetchResult {
  success: boolean;
  statusCode: number;
  responseTimeMs: number;
  totalRecords: number;
  data: any[];
  rawResponse?: any;
  error?: string;
  entity?: string;
  endpointName?: string;
}

export interface PemsGridRequest {
  GRID: {
    GRID_NAME?: string;
    GRID_ID?: string;
    NUMBER_OF_ROWS_FIRST_RETURNED: number;
    ROW_OFFSET?: number;
    RESULT_IN_SAXORDER: string;
  };
  ADDON_SORT?: {
    ALIAS_NAME: string;
    TYPE: 'ASC' | 'DESC';
  };
  ADDON_FILTER?: {
    ALIAS_NAME: string;
    OPERATOR: string;
    VALUE: string;
  };
  GRID_TYPE: { TYPE: string };
  LOV_PARAMETER?: { ALIAS_NAME: string };
  REQUEST_TYPE: string;
}

/**
 * Grid API configuration interface
 * These values can be set in endpoint's customHeaders:
 * - gridCode: PEMS grid name (e.g., "CUPFAG")
 * - gridID: PEMS grid ID (e.g., "100541")
 * - sortField: Field to sort by (e.g., "pfs_id")
 * - idField: Primary ID field (e.g., "pfs_id")
 * - orgFilterField: Field for organization filter (e.g., "pfs_a_org")
 */
interface GridApiConfig {
  sortField: string;
  idField: string;
  orgFilterField?: string;
}

export class PemsSyncServiceV2 {
  private readonly BATCH_SIZE = 1000;
  private readonly PAGE_SIZE = 10000;

  /**
   * Get active organizations for sync
   * Returns organizations with enableSync=true and serviceStatus='active'
   */
  async getActiveOrganizations(): Promise<Array<{ id: string; code: string; name: string }>> {
    const orgs = await prisma.organizations.findMany({
      where: {
        enableSync: true,
        serviceStatus: 'active'
      },
      select: {
        id: true,
        code: true,
        name: true
      },
      orderBy: { code: 'asc' }
    });

    return orgs;
  }

  /**
   * Determine if endpoint uses PEMS Grid API based on customHeaders
   */
  private isGridApiEndpoint(endpoint: api_endpoints): boolean {
    const customHeaders = ApiEndpointService.getCustomHeaders(endpoint);
    return !!(customHeaders.gridCode || customHeaders.gridID);
  }

  /**
   * Build authentication headers based on server config
   */
  private async buildAuthHeaders(
    server: api_servers,
    organizationCode: string
  ): Promise<Record<string, string>> {
    const credentials = await ApiServerService.getDecryptedCredentials(
      server.id,
      server.organizationId
    );

    const serverHeaders = ApiServerService.getCommonHeaders(server);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...serverHeaders,
      'organization': organizationCode
    };

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

    return headers;
  }

  /**
   * Fetch raw JSON from PEMS using the configured server/endpoint
   * Automatically detects endpoint type (Grid API vs REST API) based on configuration
   *
   * Grid API endpoints have gridCode/gridID in customHeaders
   * REST API endpoints use standard GET/POST requests
   *
   * If organizationCode is not provided, uses the first active organization from DB
   */
  async fetchRawData(
    serverId: string,
    endpointId: string,
    organizationCode?: string,
    options: {
      limit?: number;
      offset?: number;
      includeRawResponse?: boolean;
    } = {}
  ): Promise<RawFetchResult> {
    const startTime = Date.now();
    const { limit = 100, offset = 0, includeRawResponse = false } = options;

    try {
      // Get server and endpoint config
      const endpoint = await prisma.api_endpoints.findUnique({
        where: { id: endpointId },
        include: { api_servers: true }
      });

      if (!endpoint) {
        throw new Error(`Endpoint ${endpointId} not found`);
      }

      const server = endpoint.api_servers;
      if (server.id !== serverId) {
        throw new Error(`Endpoint ${endpointId} does not belong to server ${serverId}`);
      }

      // If no organizationCode provided, get from active organizations in DB
      let effectiveOrgCode = organizationCode;
      if (!effectiveOrgCode) {
        const activeOrgs = await this.getActiveOrganizations();
        if (activeOrgs.length === 0) {
          throw new Error('No active organizations found with sync enabled');
        }
        effectiveOrgCode = activeOrgs[0].code;
        logger.info(`Using first active organization: ${effectiveOrgCode}`);
      }

      // Build auth headers
      const headers = await this.buildAuthHeaders(server, effectiveOrgCode);

      // Build request URL
      const requestUrl = ApiServerService.buildEndpointUrl(server, endpoint.path);

      // Detect endpoint type and execute appropriate request
      const isGridApi = this.isGridApiEndpoint(endpoint);

      logger.info(`Fetching from endpoint: ${endpoint.name} (${endpoint.entity})`, {
        isGridApi,
        url: requestUrl,
        entity: endpoint.entity
      });

      if (isGridApi) {
        // Grid API request (PFA and similar endpoints)
        return await this.fetchGridApiData(
          endpoint, server, headers, requestUrl,
          effectiveOrgCode, limit, offset, includeRawResponse, startTime
        );
      } else {
        // REST API request (assets, users, etc.)
        return await this.fetchRestApiData(
          endpoint, server, headers, requestUrl,
          effectiveOrgCode, limit, offset, includeRawResponse, startTime
        );
      }

    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('PEMS Raw Fetch Failed:', { error: errorMessage });

      return {
        success: false,
        statusCode: 0,
        responseTimeMs,
        totalRecords: 0,
        data: [],
        error: errorMessage
      };
    }
  }

  /**
   * Fetch data from PEMS Grid API endpoint
   *
   * Grid API configuration is read from endpoint's customHeaders:
   * - gridCode: Required - PEMS grid name
   * - gridID: Required - PEMS grid ID
   * - sortField: Optional - field to sort by (defaults to 'id')
   * - idField: Optional - primary ID field (defaults to 'id')
   * - orgFilterField: Optional - field for org filter (if set, adds ADDON_FILTER)
   */
  private async fetchGridApiData(
    endpoint: api_endpoints & { api_servers: api_servers },
    _server: api_servers,
    headers: Record<string, string>,
    requestUrl: string,
    organizationCode: string,
    limit: number,
    offset: number,
    includeRawResponse: boolean,
    startTime: number
  ): Promise<RawFetchResult> {
    const endpointHeaders = ApiEndpointService.getCustomHeaders(endpoint);

    // Get grid config from endpoint customHeaders (fully configurable from UI)
    const gridConfig: GridApiConfig = {
      sortField: endpointHeaders.sortField || 'id',
      idField: endpointHeaders.idField || 'id',
      orgFilterField: endpointHeaders.orgFilterField
    };

    // Validate required grid settings
    if (!endpointHeaders.gridCode || !endpointHeaders.gridID) {
      logger.warn(`Grid API endpoint ${endpoint.name} missing gridCode or gridID in customHeaders`);
    }

    // Build PEMS grid request body
    const requestBody: PemsGridRequest = {
      GRID: {
        NUMBER_OF_ROWS_FIRST_RETURNED: limit,
        ROW_OFFSET: offset,
        RESULT_IN_SAXORDER: 'TRUE'
      },
      ADDON_SORT: {
        ALIAS_NAME: gridConfig.sortField,
        TYPE: 'ASC'
      },
      GRID_TYPE: { TYPE: 'LIST' },
      LOV_PARAMETER: { ALIAS_NAME: gridConfig.idField },
      REQUEST_TYPE: 'LIST.DATA_ONLY.STORED'
    };

    // Add grid code/ID from endpoint custom headers
    if (endpointHeaders.gridCode) {
      requestBody.GRID.GRID_NAME = endpointHeaders.gridCode;
    }
    if (endpointHeaders.gridID) {
      requestBody.GRID.GRID_ID = endpointHeaders.gridID;
    }

    // Add organization filter if configured in endpoint
    if (gridConfig.orgFilterField) {
      requestBody.ADDON_FILTER = {
        ALIAS_NAME: gridConfig.orgFilterField,
        OPERATOR: 'BEGINS',
        VALUE: organizationCode
      };
    }

    logger.info('PEMS Grid API Request:', {
      url: requestUrl,
      entity: endpoint.entity,
      headers: { ...headers, Authorization: '[REDACTED]' },
      body: requestBody
    });

    // Execute request
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    const responseTimeMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('PEMS Grid API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });

      return {
        success: false,
        statusCode: response.status,
        responseTimeMs,
        totalRecords: 0,
        data: [],
        error: `HTTP ${response.status}: ${response.statusText}`,
        entity: endpoint.entity,
        endpointName: endpoint.name
      };
    }

    const responseData = await response.json() as any;

    // Extract records from PEMS response structure
    const records = responseData.Result?.ResultData?.GRID?.DATA?.ROW || [];
    const totalCount = responseData.Result?.ResultData?.GRID?.['TOTAL-COUNT'] ??
                      responseData.Result?.ResultData?.GRID?.TOTALROWS ??
                      records.length;

    logger.info('PEMS Grid API Response:', {
      entity: endpoint.entity,
      statusCode: response.status,
      responseTimeMs,
      recordsReturned: records.length,
      totalCount
    });

    return {
      success: true,
      statusCode: response.status,
      responseTimeMs,
      totalRecords: totalCount,
      data: records,
      rawResponse: includeRawResponse ? responseData : undefined,
      entity: endpoint.entity,
      endpointName: endpoint.name
    };
  }

  /**
   * Fetch data from REST API endpoint (non-Grid API)
   */
  private async fetchRestApiData(
    endpoint: api_endpoints & { api_servers: api_servers },
    _server: api_servers,
    headers: Record<string, string>,
    requestUrl: string,
    organizationCode: string,
    limit: number,
    offset: number,
    includeRawResponse: boolean,
    startTime: number
  ): Promise<RawFetchResult> {
    // Build query parameters for REST API
    const queryParams = new URLSearchParams();
    if (limit) queryParams.set('limit', String(limit));
    if (offset) queryParams.set('offset', String(offset));
    queryParams.set('organization', organizationCode);

    const urlWithParams = `${requestUrl}?${queryParams.toString()}`;

    logger.info('PEMS REST API Request:', {
      url: urlWithParams,
      entity: endpoint.entity,
      headers: { ...headers, Authorization: '[REDACTED]' },
      method: endpoint.operationType === 'write' ? 'POST' : 'GET'
    });

    // Use GET for read operations, POST for write
    const method = endpoint.operationType === 'write' ? 'POST' : 'GET';
    const fetchOptions: RequestInit = {
      method,
      headers
    };

    // Execute request
    const response = await fetch(urlWithParams, fetchOptions);

    const responseTimeMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('PEMS REST API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });

      return {
        success: false,
        statusCode: response.status,
        responseTimeMs,
        totalRecords: 0,
        data: [],
        error: `HTTP ${response.status}: ${response.statusText}`,
        entity: endpoint.entity,
        endpointName: endpoint.name
      };
    }

    const responseData = await response.json() as any;

    // REST APIs typically return data directly or in a data/items array
    let records: any[] = [];
    let totalCount = 0;

    if (Array.isArray(responseData)) {
      records = responseData;
      totalCount = responseData.length;
    } else if (responseData.data && Array.isArray(responseData.data)) {
      records = responseData.data;
      totalCount = responseData.total || responseData.count || records.length;
    } else if (responseData.items && Array.isArray(responseData.items)) {
      records = responseData.items;
      totalCount = responseData.total || responseData.count || records.length;
    } else if (responseData.Result?.ResultData) {
      // Handle nested PEMS-style response even for REST endpoints
      records = responseData.Result.ResultData.items ||
                responseData.Result.ResultData.data ||
                [responseData.Result.ResultData];
      totalCount = records.length;
    } else {
      // Single object response
      records = [responseData];
      totalCount = 1;
    }

    logger.info('PEMS REST API Response:', {
      entity: endpoint.entity,
      statusCode: response.status,
      responseTimeMs,
      recordsReturned: records.length,
      totalCount
    });

    return {
      success: true,
      statusCode: response.status,
      responseTimeMs,
      totalRecords: totalCount,
      data: records,
      rawResponse: includeRawResponse ? responseData : undefined,
      entity: endpoint.entity,
      endpointName: endpoint.name
    };
  }

  /**
   * Fetch all pages of raw data from PEMS
   */
  async fetchAllRawData(
    serverId: string,
    endpointId: string,
    organizationCode?: string
  ): Promise<RawFetchResult> {
    const startTime = Date.now();
    let allRecords: any[] = [];
    let offset = 0;
    let hasMore = true;
    let totalCount = 0;

    try {
      // First fetch to get total count
      const firstPage = await this.fetchRawData(serverId, endpointId, organizationCode, {
        limit: this.PAGE_SIZE,
        offset: 0
      });

      if (!firstPage.success) {
        return firstPage;
      }

      allRecords = firstPage.data;
      totalCount = firstPage.totalRecords;

      // If we got all records in first page, return
      if (allRecords.length >= totalCount || allRecords.length < this.PAGE_SIZE) {
        return {
          success: true,
          statusCode: 200,
          responseTimeMs: Date.now() - startTime,
          totalRecords: allRecords.length,
          data: allRecords
        };
      }

      // Fetch remaining pages
      offset = this.PAGE_SIZE;
      while (offset < totalCount && hasMore) {
        const page = await this.fetchRawData(serverId, endpointId, organizationCode, {
          limit: this.PAGE_SIZE,
          offset
        });

        if (!page.success) {
          logger.warn(`Failed to fetch page at offset ${offset}`, { error: page.error });
          break;
        }

        if (page.data.length === 0) {
          hasMore = false;
        } else {
          allRecords = allRecords.concat(page.data);
          offset += this.PAGE_SIZE;
        }

        // Safety limit
        if (allRecords.length > 100000) {
          logger.warn('Hit 100K record safety limit');
          break;
        }
      }

      return {
        success: true,
        statusCode: 200,
        responseTimeMs: Date.now() - startTime,
        totalRecords: allRecords.length,
        data: allRecords
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        statusCode: 0,
        responseTimeMs: Date.now() - startTime,
        totalRecords: allRecords.length,
        data: allRecords,
        error: errorMessage
      };
    }
  }

  /**
   * Sync PFA data from PEMS using new architecture
   * Creates pfa_sync_log entries and updates api_endpoints sync dates
   */
  async syncPfaData(
    organizationId: string,
    serverId: string,
    endpointId: string,
    syncType: 'full' | 'incremental' = 'full'
  ): Promise<SyncProgressV2> {
    const syncId = `pfa-sync-v2-${Date.now()}`;
    const startTime = new Date();

    logger.info(`Starting PFA sync V2 for organization ${organizationId}`, {
      syncId,
      serverId,
      endpointId,
      syncType
    });

    // Create sync log entry at start
    await prisma.pfa_sync_log.create({
      data: {
        id: syncId,
        organizationId,
        syncType: syncType === 'full' ? 'manual' : 'incremental',
        syncDirection: 'read',
        batchId: `batch-${syncId}`,
        status: 'running',
        startedAt: startTime
      }
    });

    try {
      // Get organization
      const organization = await prisma.organizations.findUnique({
        where: { id: organizationId }
      });

      if (!organization) {
        await this.updateSyncLogFailed(syncId, startTime, `Organization ${organizationId} not found`);
        throw new Error(`Organization ${organizationId} not found`);
      }

      // Check organization status
      if (organization.serviceStatus !== 'active') {
        const errorMsg = `Organization status: ${organization.serviceStatus}`;
        await this.updateSyncLogFailed(syncId, startTime, errorMsg);
        return this.createFailedProgress(syncId, organizationId, serverId, endpointId, startTime, errorMsg);
      }

      if (!organization.enableSync) {
        const errorMsg = 'Sync is disabled for this organization';
        await this.updateSyncLogFailed(syncId, startTime, errorMsg);
        return this.createFailedProgress(syncId, organizationId, serverId, endpointId, startTime, errorMsg);
      }

      // Initialize progress
      const progress: SyncProgressV2 = {
        syncId,
        status: 'running',
        organizationId,
        serverId,
        endpointId,
        totalRecords: 0,
        processedRecords: 0,
        insertedRecords: 0,
        updatedRecords: 0,
        errorRecords: 0,
        startedAt: startTime,
        currentBatch: 0,
        totalBatches: 0
      };

      // Fetch all data
      const fetchResult = await this.fetchAllRawData(serverId, endpointId, organization.code);

      if (!fetchResult.success) {
        progress.status = 'failed';
        progress.error = fetchResult.error;
        progress.completedAt = new Date();
        await this.updateSyncLogFailed(syncId, startTime, fetchResult.error || 'Fetch failed');
        return progress;
      }

      progress.totalRecords = fetchResult.data.length;
      progress.totalBatches = Math.ceil(fetchResult.data.length / this.BATCH_SIZE);

      logger.info(`Fetched ${progress.totalRecords} records, processing in ${progress.totalBatches} batches`);

      // Load field mappings for this endpoint (database-driven or defaults)
      const fieldMappings = await this.loadFieldMappings(endpointId);
      logger.info(`Using ${fieldMappings.length} field mappings for transformation`);

      // Process in batches
      for (let i = 0; i < fetchResult.data.length; i += this.BATCH_SIZE) {
        progress.currentBatch = Math.floor(i / this.BATCH_SIZE) + 1;
        const batch = fetchResult.data.slice(i, i + this.BATCH_SIZE);

        const result = await this.processRecordBatch(batch, organizationId, organization.code, fieldMappings);

        progress.processedRecords += result.processed;
        progress.insertedRecords += result.inserted;
        progress.updatedRecords += result.updated;
        progress.errorRecords += result.errors;

        logger.info(`Processed batch ${progress.currentBatch}/${progress.totalBatches}`, {
          processed: progress.processedRecords,
          inserted: progress.insertedRecords,
          updated: progress.updatedRecords
        });
      }

      progress.status = 'completed';
      progress.completedAt = new Date();

      // Update sync log with success
      await this.updateSyncLogSuccess(syncId, startTime, progress);

      // Update api_endpoints with sync dates
      await this.updateEndpointSyncDates(endpointId, progress);

      logger.info(`PFA sync V2 completed for ${organization.code}`, {
        syncId,
        totalRecords: progress.totalRecords,
        processedRecords: progress.processedRecords,
        duration: progress.completedAt.getTime() - startTime.getTime()
      });

      return progress;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('PFA sync V2 failed:', { error: errorMessage });

      await this.updateSyncLogFailed(syncId, startTime, errorMessage);
      return this.createFailedProgress(syncId, organizationId, serverId, endpointId, startTime, errorMessage);
    }
  }

  /**
   * Update sync log entry with failure status
   */
  private async updateSyncLogFailed(syncId: string, startTime: Date, errorMessage: string): Promise<void> {
    try {
      const completedAt = new Date();
      await prisma.pfa_sync_log.update({
        where: { id: syncId },
        data: {
          status: 'failed',
          errorMessage,
          completedAt,
          durationMs: completedAt.getTime() - startTime.getTime()
        }
      });
    } catch (err) {
      logger.error('Failed to update sync log:', err);
    }
  }

  /**
   * Update sync log entry with success status
   */
  private async updateSyncLogSuccess(syncId: string, startTime: Date, progress: SyncProgressV2): Promise<void> {
    try {
      const completedAt = new Date();
      await prisma.pfa_sync_log.update({
        where: { id: syncId },
        data: {
          status: 'completed',
          recordsTotal: progress.totalRecords,
          recordsProcessed: progress.processedRecords,
          recordsInserted: progress.insertedRecords,
          recordsUpdated: progress.updatedRecords,
          recordsErrored: progress.errorRecords,
          completedAt,
          durationMs: completedAt.getTime() - startTime.getTime()
        }
      });
    } catch (err) {
      logger.error('Failed to update sync log:', err);
    }
  }

  /**
   * Update api_endpoints with firstSyncAt/lastSyncAt
   */
  private async updateEndpointSyncDates(endpointId: string, progress: SyncProgressV2): Promise<void> {
    try {
      const endpoint = await prisma.api_endpoints.findUnique({
        where: { id: endpointId },
        select: { firstUsedAt: true }
      });

      const now = new Date();
      const isFirstSync = !endpoint?.firstUsedAt;

      await prisma.api_endpoints.update({
        where: { id: endpointId },
        data: {
          firstUsedAt: isFirstSync ? now : endpoint?.firstUsedAt,
          lastUsedAt: now,
          lastSyncAt: now,
          lastUsedRecordCount: progress.insertedRecords + progress.updatedRecords,
          totalRecordsSinceFirstUse: isFirstSync
            ? progress.insertedRecords + progress.updatedRecords
            : { increment: progress.insertedRecords }
        }
      });

      logger.info(`Updated endpoint sync dates for ${endpointId}`, {
        isFirstSync,
        recordCount: progress.insertedRecords + progress.updatedRecords
      });
    } catch (err) {
      logger.error('Failed to update endpoint sync dates:', err);
    }
  }

  /**
   * Load field mappings for an endpoint from database
   * Falls back to default PEMS mappings if none configured
   */
  async loadFieldMappings(endpointId: string): Promise<FieldMappingConfig[]> {
    const now = new Date();

    // Load active mappings for this endpoint (Time Travel aware)
    const mappings = await prisma.api_field_mappings.findMany({
      where: {
        endpointId,
        isActive: true,
        validFrom: { lte: now },
        OR: [
          { validTo: null },
          { validTo: { gte: now } }
        ]
      },
      orderBy: { destinationField: 'asc' }
    });

    if (mappings.length > 0) {
      logger.info(`Loaded ${mappings.length} field mappings for endpoint ${endpointId}`);
      return mappings.map(m => ({
        sourceField: m.sourceField,
        destinationField: m.destinationField,
        dataType: m.dataType,
        transformType: m.transformType,
        transformParams: m.transformParams as Record<string, unknown> | null,
        defaultValue: m.defaultValue
      }));
    }

    // Return default PEMS PFA mappings if none configured
    logger.info(`No mappings found for endpoint ${endpointId}, using defaults`);
    return this.getDefaultPemsMappings();
  }

  /**
   * Default PEMS PFA field mappings (fallback when no DB mappings exist)
   */
  private getDefaultPemsMappings(): FieldMappingConfig[] {
    return [
      { sourceField: 'pfs_id', destinationField: 'pfaId', dataType: 'string', transformType: 'direct', transformParams: null, defaultValue: null },
      { sourceField: 'pfs_f_area', destinationField: 'areaSilo', dataType: 'string', transformType: 'direct', transformParams: null, defaultValue: '' },
      { sourceField: 'pfs_f_category', destinationField: 'category', dataType: 'string', transformType: 'direct', transformParams: null, defaultValue: '' },
      { sourceField: 'pfs_f_catdesc', destinationField: 'forecastCategory', dataType: 'string', transformType: 'direct', transformParams: null, defaultValue: null },
      { sourceField: 'pfs_f_class', destinationField: 'class', dataType: 'string', transformType: 'direct', transformParams: null, defaultValue: '' },
      { sourceField: 'pfs_f_source', destinationField: 'source', dataType: 'string', transformType: 'direct', transformParams: null, defaultValue: 'Rental' },
      { sourceField: 'pfs_f_dor', destinationField: 'dor', dataType: 'string', transformType: 'direct', transformParams: null, defaultValue: 'PROJECT' },
      { sourceField: 'pfs_f_actualized', destinationField: 'isActualized', dataType: 'boolean', transformType: 'equals_y', transformParams: null, defaultValue: 'false' },
      { sourceField: 'pfs_f_discontinued', destinationField: 'isDiscontinued', dataType: 'boolean', transformType: 'equals_y', transformParams: null, defaultValue: 'false' },
      { sourceField: 'pfs_f_fundstrans', destinationField: 'isFundsTransferable', dataType: 'boolean', transformType: 'equals_y', transformParams: null, defaultValue: 'false' },
      { sourceField: 'pfs_f_rental', destinationField: 'monthlyRate', dataType: 'number', transformType: 'direct', transformParams: null, defaultValue: '0' },
      { sourceField: 'pfs_f_purchase', destinationField: 'purchasePrice', dataType: 'number', transformType: 'direct', transformParams: null, defaultValue: '0' },
      { sourceField: 'pfs_f_manufacturer', destinationField: 'manufacturer', dataType: 'string', transformType: 'direct', transformParams: null, defaultValue: '' },
      { sourceField: 'pfs_f_model', destinationField: 'model', dataType: 'string', transformType: 'direct', transformParams: null, defaultValue: '' },
      { sourceField: 'pfs_p_projcode', destinationField: 'contract', dataType: 'string', transformType: 'direct', transformParams: null, defaultValue: null },
      { sourceField: 'pfs_equipment_tag', destinationField: 'equipment', dataType: 'string', transformType: 'direct', transformParams: null, defaultValue: null },
      { sourceField: 'pfs_p_startdate', destinationField: 'originalStart', dataType: 'date', transformType: 'direct', transformParams: null, defaultValue: null },
      { sourceField: 'pfs_p_enddate', destinationField: 'originalEnd', dataType: 'date', transformType: 'direct', transformParams: null, defaultValue: null },
      { sourceField: 'pfs_f_startdate', destinationField: 'forecastStart', dataType: 'date', transformType: 'direct', transformParams: null, defaultValue: null },
      { sourceField: 'pfs_f_enddate', destinationField: 'forecastEnd', dataType: 'date', transformType: 'direct', transformParams: null, defaultValue: null },
      { sourceField: 'pfs_a_startdate', destinationField: 'actualStart', dataType: 'date', transformType: 'direct', transformParams: null, defaultValue: null },
      { sourceField: 'pfs_a_enddate', destinationField: 'actualEnd', dataType: 'date', transformType: 'direct', transformParams: null, defaultValue: null },
      { sourceField: 'pfs_lastmodified', destinationField: 'pemsVersion', dataType: 'string', transformType: 'direct', transformParams: null, defaultValue: null }
    ];
  }

  /**
   * Apply field mappings to a PEMS record (Grid API format)
   */
  private applyMappings(
    pemsRow: any,
    mappings: FieldMappingConfig[],
    organizationCode: string
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {
      organization: organizationCode,
      lastSyncedAt: new Date().toISOString()
    };

    // Extract value from PEMS Grid API cell format
    const getValue = (aliasName: string): string => {
      const cell = pemsRow.CELL?.find((c: any) => c.ALIAS_NAME === aliasName);
      return cell?.VALUE || '';
    };

    for (const mapping of mappings) {
      try {
        let value: unknown = getValue(mapping.sourceField);

        // Apply default if empty
        if ((value === '' || value === null || value === undefined) && mapping.defaultValue !== null) {
          value = mapping.defaultValue;
        }

        // Apply transformation
        if (mapping.transformType && mapping.transformType !== 'direct') {
          value = this.applyTransform(value, mapping.transformType, mapping.transformParams, pemsRow);
        }

        // Cast to target data type
        value = this.castType(value, mapping.dataType);

        result[mapping.destinationField] = value;
      } catch (err) {
        logger.warn(`Mapping error for ${mapping.sourceField} -> ${mapping.destinationField}:`, err);
      }
    }

    // Compute derived fields
    result.hasPlan = !!(result.originalStart && result.originalEnd);
    result.hasActuals = !!(result.actualStart && result.actualEnd);

    return result;
  }

  /**
   * Apply transformation to a value
   */
  private applyTransform(
    value: unknown,
    transformType: string,
    params: Record<string, unknown> | null,
    fullRecord?: any
  ): unknown {
    switch (transformType) {
      case 'direct':
        return value;

      case 'uppercase':
        return String(value || '').toUpperCase();

      case 'lowercase':
        return String(value || '').toLowerCase();

      case 'trim':
        return String(value || '').trim();

      case 'equals_y':
        return String(value).toUpperCase() === 'Y';

      case 'equals_true':
        return String(value).toLowerCase() === 'true' || value === '1';

      case 'replace': {
        const pattern = String(params?.pattern || '');
        const flags = String(params?.flags || 'g');
        const replacement = String(params?.replacement || '');
        return String(value || '').replace(new RegExp(pattern, flags), replacement);
      }

      case 'substring': {
        const start = Number(params?.start) || 0;
        const end = params?.end ? Number(params.end) : undefined;
        return String(value || '').substring(start, end);
      }

      case 'multiply': {
        const multiplier = Number(params?.multiplier) || 1;
        return Number(value) * multiplier;
      }

      case 'divide': {
        const divisor = Number(params?.divisor) || 1;
        return divisor !== 0 ? Number(value) / divisor : 0;
      }

      case 'round': {
        const decimals = Number(params?.decimals) || 0;
        const factor = Math.pow(10, decimals);
        return Math.round(Number(value) * factor) / factor;
      }

      case 'date_format': {
        if (!value) return null;
        const formatStr = String(params?.format || 'yyyy-MM-dd');
        const dateValue = value instanceof Date ? value : new Date(value as string);
        return format(dateValue, formatStr);
      }

      case 'date_parse': {
        if (!value) return null;
        const inputFormat = String(params?.inputFormat || 'yyyy-MM-dd');
        return parse(String(value), inputFormat, new Date());
      }

      case 'date_add': {
        if (!value) return null;
        const amount = Number(params?.amount) || 0;
        const unit = String(params?.unit || 'days');
        const dateValue = value instanceof Date ? value : new Date(value as string);
        return add(dateValue, { [unit]: amount });
      }

      case 'date_subtract': {
        if (!value) return null;
        const amount = Number(params?.amount) || 0;
        const unit = String(params?.unit || 'days');
        const dateValue = value instanceof Date ? value : new Date(value as string);
        return sub(dateValue, { [unit]: amount });
      }

      case 'map': {
        const mapping = (params?.mapping as Record<string, unknown>) || {};
        return mapping[String(value)] ?? value;
      }

      case 'concat': {
        const fields = (params?.fields as string[]) || [];
        const separator = String(params?.separator || '');
        if (fullRecord && fields.length > 0) {
          const getValue = (aliasName: string): string => {
            const cell = fullRecord.CELL?.find((c: any) => c.ALIAS_NAME === aliasName);
            return cell?.VALUE || '';
          };
          return fields.map(f => getValue(f)).join(separator);
        }
        return value;
      }

      default:
        return value;
    }
  }

  /**
   * Cast value to target data type
   */
  private castType(value: unknown, dataType: string): unknown {
    if (value === null || value === undefined || value === '') {
      return dataType === 'string' ? '' : null;
    }

    switch (dataType) {
      case 'string':
        return String(value);

      case 'number':
        const num = parseFloat(String(value));
        return isNaN(num) ? 0 : num;

      case 'boolean':
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true' || value === '1' || value.toUpperCase() === 'Y';
        }
        return Boolean(value);

      case 'date':
        if (!value) return null;
        if (value instanceof Date) return value;
        try {
          const d = new Date(value as string);
          return isNaN(d.getTime()) ? null : d;
        } catch {
          return null;
        }

      case 'json':
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        }
        return value;

      default:
        return value;
    }
  }

  /**
   * Process a batch of PEMS records using database-driven field mappings
   */
  private async processRecordBatch(
    records: any[],
    organizationId: string,
    organizationCode: string,
    fieldMappings: FieldMappingConfig[]
  ): Promise<{ processed: number; inserted: number; updated: number; errors: number }> {
    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (const record of records) {
      try {
        const mirrorData = this.applyMappings(record, fieldMappings, organizationCode) as MappedPfaData;

        const result = await prisma.$transaction(async (tx) => {
          const existing = await tx.pfa_mirror.findUnique({
            where: {
              organizationId_pfaId: {
                organizationId,
                pfaId: mirrorData.pfaId
              }
            }
          });

          if (existing) {
            // Archive and update
            await tx.pfa_mirror_history.create({
              data: {
                id: `pfah_${existing.id}_v${existing.version}`,
                mirrorId: existing.id,
                version: existing.version,
                organizationId: existing.organizationId,
                data: existing.data as any,
                pfaId: existing.pfaId,
                category: existing.category,
                class: existing.class,
                source: existing.source,
                dor: existing.dor,
                areaSilo: existing.areaSilo,
                manufacturer: existing.manufacturer,
                model: existing.model,
                monthlyRate: existing.monthlyRate,
                purchasePrice: existing.purchasePrice,
                forecastStart: existing.forecastStart,
                forecastEnd: existing.forecastEnd,
                originalStart: existing.originalStart,
                originalEnd: existing.originalEnd,
                actualStart: existing.actualStart,
                actualEnd: existing.actualEnd,
                isActualized: existing.isActualized,
                isDiscontinued: existing.isDiscontinued,
                isFundsTransferable: existing.isFundsTransferable,
                hasPlan: existing.hasPlan,
                hasActuals: existing.hasActuals,
                pemsVersion: existing.pemsVersion,
                syncBatchId: existing.syncBatchId,
                changedBy: 'PEMS_SYNC_V2',
                changeReason: 'PEMS data sync update'
              }
            });

            return tx.pfa_mirror.update({
              where: { id: existing.id },
              data: {
                data: mirrorData as any,
                category: mirrorData.category,
                class: mirrorData.class,
                source: mirrorData.source,
                dor: mirrorData.dor,
                areaSilo: mirrorData.areaSilo,
                manufacturer: mirrorData.manufacturer,
                model: mirrorData.model,
                monthlyRate: mirrorData.monthlyRate,
                purchasePrice: mirrorData.purchasePrice,
                forecastStart: toDateOrNull(mirrorData.forecastStart),
                forecastEnd: toDateOrNull(mirrorData.forecastEnd),
                originalStart: toDateOrNull(mirrorData.originalStart),
                originalEnd: toDateOrNull(mirrorData.originalEnd),
                actualStart: toDateOrNull(mirrorData.actualStart),
                actualEnd: toDateOrNull(mirrorData.actualEnd),
                isActualized: mirrorData.isActualized,
                isDiscontinued: mirrorData.isDiscontinued,
                isFundsTransferable: mirrorData.isFundsTransferable,
                hasPlan: mirrorData.hasPlan,
                hasActuals: mirrorData.hasActuals,
                version: existing.version + 1,
                lastSyncedAt: new Date()
              }
            });
          } else {
            return tx.pfa_mirror.create({
              data: {
                id: `pfam_${organizationId}_${mirrorData.pfaId}`,
                organizationId,
                pfaId: mirrorData.pfaId,
                data: mirrorData as any,
                category: mirrorData.category,
                class: mirrorData.class,
                source: mirrorData.source,
                dor: mirrorData.dor,
                areaSilo: mirrorData.areaSilo,
                manufacturer: mirrorData.manufacturer,
                model: mirrorData.model,
                monthlyRate: mirrorData.monthlyRate,
                purchasePrice: mirrorData.purchasePrice,
                forecastStart: toDateOrNull(mirrorData.forecastStart),
                forecastEnd: toDateOrNull(mirrorData.forecastEnd),
                originalStart: toDateOrNull(mirrorData.originalStart),
                originalEnd: toDateOrNull(mirrorData.originalEnd),
                actualStart: toDateOrNull(mirrorData.actualStart),
                actualEnd: toDateOrNull(mirrorData.actualEnd),
                isActualized: mirrorData.isActualized,
                isDiscontinued: mirrorData.isDiscontinued,
                isFundsTransferable: mirrorData.isFundsTransferable,
                hasPlan: mirrorData.hasPlan,
                hasActuals: mirrorData.hasActuals,
                version: 1,
                lastSyncedAt: new Date(),
                updatedAt: new Date()
              }
            });
          }
        });

        if (result.version === 1) {
          inserted++;
        } else {
          updated++;
        }

      } catch (error) {
        logger.error('Failed to process record:', error);
        errors++;
      }
    }

    return { processed: records.length, inserted, updated, errors };
  }

  private createFailedProgress(
    syncId: string,
    organizationId: string,
    serverId: string,
    endpointId: string,
    startTime: Date,
    error: string
  ): SyncProgressV2 {
    return {
      syncId,
      status: 'failed',
      organizationId,
      serverId,
      endpointId,
      totalRecords: 0,
      processedRecords: 0,
      insertedRecords: 0,
      updatedRecords: 0,
      errorRecords: 0,
      startedAt: startTime,
      completedAt: new Date(),
      currentBatch: 0,
      totalBatches: 0,
      error
    };
  }
}

export const pemsSyncServiceV2 = new PemsSyncServiceV2();
