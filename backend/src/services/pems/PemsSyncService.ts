/**
 * PEMS Sync Service
 *
 * Safely syncs PFA data from PEMS griddata API to the database.
 * Handles batch processing for large datasets (millions of records).
 *
 * Architecture:
 * - Fetches data in pages (configurable batch size)
 * - Processes records in chunks to avoid memory overflow
 * - Tracks progress and provides real-time status
 * - Uses organization-based filtering from database
 */

import { randomUUID } from 'crypto';
import prisma from '../../config/database';
import { logger } from '../../utils/logger';
import { decrypt } from '../../utils/encryption';
import { DataCollectionService } from '../aiDataHooks/DataCollectionService';

export interface SyncProgress {
  syncId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  organizationId: string;
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

export interface OrganizationSyncResult {
  organizationId: string;
  organizationCode: string;
  skipped: boolean;
  reason?: string;
  syncProgress?: SyncProgress;
}

export interface AllOrganizationsSyncSummary {
  totalOrganizations: number;
  syncedOrganizations: number;
  skippedOrganizations: number;
  failedOrganizations: number;
  results: OrganizationSyncResult[];
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
}

export class PemsSyncService {
  private readonly BATCH_SIZE = 1000; // Process 1000 records at a time
  private readonly PAGE_SIZE = 10000;  // Fetch 10K records per API call

  /**
   * Sync PFA data from PEMS for a specific organization
   */
  async syncPfaData(
    organizationId: string,
    syncType: 'full' | 'incremental' = 'full',
    syncId?: string,
    apiConfigId?: string
  ): Promise<SyncProgress> {
    const finalSyncId = syncId || `pfa-sync-${Date.now()}`;
    const startTime = new Date();

    logger.info(`Starting PFA sync for organization ${organizationId}`, {
      syncId: finalSyncId,
      syncType
    });

    try {
      // Get organization details
      const organization = await prisma.organizations.findUnique({
        where: { id: organizationId }
      });

      if (!organization) {
        throw new Error(`Organization ${organizationId} not found`);
      }

      // Check organization status - skip suspended/inactive organizations
      if (organization.serviceStatus !== 'active') {
        const reason = `Organization status: ${organization.serviceStatus}`;
        logger.warn(`Sync skipped for organization ${organization.code}`, {
          organizationId,
          serviceStatus: organization.serviceStatus,
          reason
        });

        // Log skip to audit log
        await prisma.audit_logs.create({
          data: {
            id: randomUUID(),
            userId: 'system',
            organizationId,
            action: 'sync_skipped',
            resource: 'pfa_sync',
            method: 'POST',
            success: false,
            metadata: {
              reason,
              syncType,
              syncId: finalSyncId,
              timestamp: new Date().toISOString()
            }
          }
        });

        // Return a failed progress status
        return {
          syncId: finalSyncId,
          status: 'failed',
          organizationId,
          totalRecords: 0,
          processedRecords: 0,
          insertedRecords: 0,
          updatedRecords: 0,
          errorRecords: 0,
          startedAt: startTime,
          completedAt: new Date(),
          currentBatch: 0,
          totalBatches: 0,
          error: reason
        };
      }

      // Check if sync is enabled for this organization
      if (!organization.enableSync) {
        const reason = 'Sync is disabled for this organization';
        logger.warn(`Sync skipped for organization ${organization.code}`, {
          organizationId,
          enableSync: organization.enableSync,
          reason
        });

        // Log skip to audit log
        await prisma.audit_logs.create({
          data: {
            id: randomUUID(),
            userId: 'system',
            organizationId,
            action: 'sync_skipped',
            resource: 'pfa_sync',
            method: 'POST',
            success: false,
            metadata: {
              reason,
              syncType,
              syncId: finalSyncId,
              timestamp: new Date().toISOString()
            }
          }
        });

        // Return a failed progress status
        return {
          syncId: finalSyncId,
          status: 'failed',
          organizationId,
          totalRecords: 0,
          processedRecords: 0,
          insertedRecords: 0,
          updatedRecords: 0,
          errorRecords: 0,
          startedAt: startTime,
          completedAt: new Date(),
          currentBatch: 0,
          totalBatches: 0,
          error: reason
        };
      }

      // API Config ID is required
      if (!apiConfigId) {
        throw new Error('API Configuration ID is required for sync');
      }

      // Get API configuration from database
      const config = await prisma.api_configurations.findUnique({
        where: { id: apiConfigId }
      });

      if (!config) {
        throw new Error(`API Configuration '${apiConfigId}' not found`);
      }

      // Decrypt credentials
      let username = '';
      let password = '';
      let tenant = '';
      let gridCode = '';
      let gridId = '';

      if (config.authKeyEncrypted) {
        username = decrypt(config.authKeyEncrypted);
      }
      if (config.authValueEncrypted) {
        password = decrypt(config.authValueEncrypted);
      }

      // Check for organization-specific credentials first
      const orgCredentials = await prisma.organization_api_credentials.findUnique({
        where: {
          organizationId_apiConfigurationId: {
            organizationId: organizationId,
            apiConfigurationId: apiConfigId
          }
        }
      });

      // Parse customHeaders for tenant, gridCode, gridId, organization
      let pemsOrganizationCode = organization.code; // Default to database org code

      // Priority: org-specific customHeaders > global customHeaders > database org code
      if (orgCredentials?.customHeaders) {
        try {
          const headers = JSON.parse(orgCredentials.customHeaders);
          const orgHeader = headers.find((h: any) => h.key === 'organization');
          if (orgHeader) {
            pemsOrganizationCode = orgHeader.value;
            logger.info(`Using org-specific PEMS organization code: ${pemsOrganizationCode} for ${organization.code}`);
          }
        } catch (e) {
          logger.error('Failed to parse org-specific customHeaders:', e);
        }
      }

      if (config.customHeaders) {
        try {
          const headers = JSON.parse(config.customHeaders);
          const tenantHeader = headers.find((h: any) => h.key === 'tenant');
          if (tenantHeader) tenant = tenantHeader.value;
          const gridCodeHeader = headers.find((h: any) => h.key === 'gridCode');
          if (gridCodeHeader) gridCode = gridCodeHeader.value;
          const gridIdHeader = headers.find((h: any) => h.key === 'gridId');
          if (gridIdHeader) gridId = gridIdHeader.value;

          // Only use global org code if no org-specific one was found
          if (pemsOrganizationCode === organization.code) {
            const orgHeader = headers.find((h: any) => h.key === 'organization');
            if (orgHeader) {
              pemsOrganizationCode = orgHeader.value;
              logger.info(`Using global PEMS organization code: ${pemsOrganizationCode} for ${organization.code}`);
            }
          }
        } catch (e) {
          logger.error('Failed to parse customHeaders:', e);
        }
      }

      if (!username || !password) {
        throw new Error('PEMS credentials not configured');
      }

      if (!gridCode && !gridId) {
        throw new Error('Grid Code or Grid ID must be configured');
      }

      // Initialize progress tracking
      const progress: SyncProgress = {
        syncId: finalSyncId,
        status: 'running',
        organizationId,
        totalRecords: 0,
        processedRecords: 0,
        insertedRecords: 0,
        updatedRecords: 0,
        errorRecords: 0,
        startedAt: startTime,
        currentBatch: 0,
        totalBatches: 0
      };

      // Fetch total count first (using a separate query with COUNT)
      const totalCount = await this.getTotalRecordCount(
        config.url,
        username,
        password,
        tenant,
        pemsOrganizationCode,
        gridCode,
        gridId
      );

      // Handle two modes: known total count vs. fetch-until-empty
      const fetchUntilEmpty = totalCount === -1;

      if (fetchUntilEmpty) {
        progress.totalRecords = 0; // Will be updated as we fetch
        progress.totalBatches = 0; // Unknown
        logger.info(`Total count unknown - will fetch pages until empty`, {
          organizationId,
          databaseOrgCode: organization.code,
          pemsOrganizationCode: pemsOrganizationCode,
          searchingForPemsOrg: pemsOrganizationCode
        });
      } else {
        progress.totalRecords = totalCount;
        progress.totalBatches = Math.ceil(totalCount / this.PAGE_SIZE);
        logger.info(`Total PFA records to sync: ${totalCount}`, {
          organizationId,
          databaseOrgCode: organization.code,
          pemsOrganizationCode: pemsOrganizationCode,
          searchingForPemsOrg: pemsOrganizationCode,
          batches: progress.totalBatches
        });
      }

      // Full sync uses Bronze layer pruning after Silver promotion
      // No need to manually clear data - handled by BronzePruningService
      if (syncType === 'full') {
        logger.info(`Full sync mode - Bronze layer will be pruned after promotion`, {
          organizationCode: organization.code
        });
      }

      // Fetch and process data in pages
      if (fetchUntilEmpty) {
        // Fetch until we get an empty response
        let page = 0;
        let hasMoreData = true;

        while (hasMoreData) {
          progress.currentBatch = page + 1;
          logger.info(`Processing batch ${progress.currentBatch} (fetching until empty)`);

          const records = await this.fetchPfaPage(
            config.url,
            username,
            password,
            tenant,
            pemsOrganizationCode,
            gridCode,
            gridId,
            page * this.PAGE_SIZE,
            this.PAGE_SIZE
          );

          if (records.length === 0) {
            logger.info(`No more records found, stopping at page ${page + 1}`);
            hasMoreData = false;
            break;
          }

          // Process records in smaller chunks to avoid memory issues
          for (let i = 0; i < records.length; i += this.BATCH_SIZE) {
            const chunk = records.slice(i, i + this.BATCH_SIZE);
            const result = await this.processRecordChunk(chunk, organizationId, pemsOrganizationCode);

            progress.processedRecords += result.processed;
            progress.insertedRecords += result.inserted;
            progress.updatedRecords += result.updated;
            progress.errorRecords += result.errors;

            progress.totalRecords = progress.processedRecords; // Update total as we go
            logger.info(`Processed ${progress.processedRecords} records so far`);
          }

          page++;
        }

        progress.totalBatches = page;
      } else {
        // Use known total count to fetch exact number of pages
        for (let page = 0; page < progress.totalBatches; page++) {
          progress.currentBatch = page + 1;
          logger.info(`Processing batch ${progress.currentBatch} of ${progress.totalBatches}`);

          const records = await this.fetchPfaPage(
            config.url,
            username,
            password,
            tenant,
            pemsOrganizationCode,
            gridCode,
            gridId,
            page * this.PAGE_SIZE,
            this.PAGE_SIZE
          );

          // Process records in smaller chunks to avoid memory issues
          for (let i = 0; i < records.length; i += this.BATCH_SIZE) {
            const chunk = records.slice(i, i + this.BATCH_SIZE);
            const result = await this.processRecordChunk(chunk, organizationId, pemsOrganizationCode);

            progress.processedRecords += result.processed;
            progress.insertedRecords += result.inserted;
            progress.updatedRecords += result.updated;
            progress.errorRecords += result.errors;

            logger.info(`Processed ${progress.processedRecords}/${progress.totalRecords} records`);
          }
        }
      }

      // Mark sync as completed
      progress.status = 'completed';
      progress.completedAt = new Date();

      logger.info(`PFA sync completed for ${organization.code}`, {
        syncId: finalSyncId,
        totalRecords: progress.totalRecords,
        processedRecords: progress.processedRecords,
        insertedRecords: progress.insertedRecords,
        updatedRecords: progress.updatedRecords,
        errorRecords: progress.errorRecords,
        duration: progress.completedAt.getTime() - startTime.getTime()
      });

      return progress;

    } catch (error) {
      logger.error('PFA sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync Organization data from PEMS
   */
  async syncOrganizationData(
    organizationId: string,
    syncType: 'full' | 'incremental' = 'full',
    syncId?: string,
    apiConfigId?: string
  ): Promise<SyncProgress> {
    const finalSyncId = syncId || `org-sync-${Date.now()}`;
    const startTime = new Date();

    logger.info(`Starting Organization sync`, {
      syncId: finalSyncId,
      syncType
    });

    try {
      // API Config ID is required
      if (!apiConfigId) {
        throw new Error('API Configuration ID is required for sync');
      }

      // Get API configuration from database
      const config = await prisma.api_configurations.findUnique({
        where: { id: apiConfigId }
      });

      if (!config) {
        throw new Error(`API Configuration '${apiConfigId}' not found`);
      }

      // Decrypt credentials
      let username = '';
      let password = '';
      let tenant = '';

      if (config.authKeyEncrypted) {
        username = decrypt(config.authKeyEncrypted);
      }
      if (config.authValueEncrypted) {
        password = decrypt(config.authValueEncrypted);
      }

      // Parse customHeaders for tenant
      if (config.customHeaders) {
        try {
          const headers = JSON.parse(config.customHeaders);
          const tenantHeader = headers.find((h: any) => h.key === 'tenant');
          if (tenantHeader) tenant = tenantHeader.value;
        } catch (e) {
          logger.error('Failed to parse customHeaders:', e);
        }
      }

      if (!username || !password) {
        throw new Error('PEMS credentials not configured');
      }

      // Initialize progress tracking
      const progress: SyncProgress = {
        syncId: finalSyncId,
        status: 'running',
        organizationId,
        totalRecords: 0,
        processedRecords: 0,
        insertedRecords: 0,
        updatedRecords: 0,
        errorRecords: 0,
        startedAt: startTime,
        currentBatch: 1,
        totalBatches: 1
      };

      // Fetch organizations from PEMS
      const organizations = await this.fetchOrganizations(
        config.url,
        username,
        password,
        tenant
      );

      progress.totalRecords = organizations.length;

      logger.info(`Total organizations to sync: ${organizations.length}`);

      // Process organizations
      const result = await this.processOrganizations(organizations);

      progress.processedRecords = result.processed;
      progress.insertedRecords = result.inserted;
      progress.updatedRecords = result.updated;
      progress.errorRecords = result.errors;

      // Mark sync as completed
      progress.status = 'completed';
      progress.completedAt = new Date();

      logger.info(`Organization sync completed`, {
        syncId: finalSyncId,
        totalRecords: progress.totalRecords,
        processedRecords: progress.processedRecords,
        insertedRecords: progress.insertedRecords,
        updatedRecords: progress.updatedRecords,
        errorRecords: progress.errorRecords,
        duration: progress.completedAt.getTime() - startTime.getTime()
      });

      return progress;

    } catch (error) {
      logger.error('Organization sync failed:', error);
      throw error;
    }
  }

  /**
   * Fetch organizations from PEMS
   */
  private async fetchOrganizations(
    url: string,
    username: string,
    password: string,
    tenant: string
  ): Promise<any[]> {
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    const headers: any = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'tenant': tenant,
      'organization': 'BECH' // Use BECH for authentication
    };

    logger.info('Fetching organizations from PEMS', { url });

    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to fetch organizations:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Failed to fetch organizations: ${response.statusText}`);
    }

    const data = await response.json() as any;

    // Log the full response for debugging
    logger.info('PEMS API Response:', {
      hasResult: !!data.Result,
      hasResultData: !!data.Result?.ResultData,
      hasDATARECORD: !!data.Result?.ResultData?.DATARECORD,
      datarecordLength: data.Result?.ResultData?.DATARECORD?.length || 0,
      records: data.Result?.ResultData?.RECORDS,
      responseKeys: Object.keys(data),
      resultKeys: data.Result ? Object.keys(data.Result) : [],
      resultDataKeys: data.Result?.ResultData ? Object.keys(data.Result.ResultData) : []
    });

    // Parse PEMS response - organizations are in Result.ResultData.DATARECORD
    const organizations = data.Result?.ResultData?.DATARECORD || [];

    logger.info(`Fetched ${organizations.length} organizations from PEMS`);

    return organizations;
  }

  /**
   * Process organizations and upsert to database
   */
  private async processOrganizations(
    organizations: any[]
  ): Promise<{ processed: number; inserted: number; updated: number; errors: number }> {
    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (const org of organizations) {
      try {
        const orgData = this.mapPemsOrganization(org);

        // Upsert organization to database
        const existing = await prisma.organizations.findUnique({
          where: { code: orgData.code }
        });

        if (existing) {
          // Update existing organization (preserve some fields)
          const updatedOrg = await prisma.organizations.update({
            where: { code: orgData.code },
            data: {
              name: orgData.name,
              description: orgData.description,
              updatedAt: new Date()
              // Preserve: isActive, logoUrl, user associations
            }
          });
          updated++;
          logger.debug(`Updated organization: ${orgData.code}`);

          // AI Data Hook: Log external entity sync (non-blocking)
          DataCollectionService.logExternalEntitySync({
            userId: 'system',
            organizationId: updatedOrg.id,
            action: 'updated',
            entityType: 'Organization',
            entityId: updatedOrg.id,
            externalId: orgData.code,
            externalSystem: 'PEMS',
            syncMetadata: {
              recordsProcessed: 1,
              recordsInserted: 0,
              recordsUpdated: 1,
              recordsSkipped: 0
            }
          }).catch((err: unknown) => logger.error('Failed to log organization sync for AI', { error: err }));
        } else {
          // Create new organization
          const newOrg = await prisma.organizations.create({
            data: {
              id: `org_${orgData.code}_${Date.now()}`,
              code: orgData.code,
              name: orgData.name,
              description: orgData.description,
              logoUrl: `https://api.dicebear.com/7.x/shapes/svg?seed=${orgData.code}&backgroundColor=${this.getRandomColor()}`,
              isActive: true,
              isExternal: true,
              externalId: orgData.code,
              updatedAt: new Date()
            }
          });
          inserted++;
          logger.debug(`Inserted organization: ${orgData.code}`);

          // AI Data Hook: Log external entity sync (non-blocking)
          DataCollectionService.logExternalEntitySync({
            userId: 'system',
            organizationId: newOrg.id,
            action: 'created',
            entityType: 'Organization',
            entityId: newOrg.id,
            externalId: orgData.code,
            externalSystem: 'PEMS',
            syncMetadata: {
              recordsProcessed: 1,
              recordsInserted: 1,
              recordsUpdated: 0,
              recordsSkipped: 0
            }
          }).catch((err: unknown) => logger.error('Failed to log organization sync for AI', { error: err }));
        }

      } catch (error) {
        logger.error('Failed to process organization:', error);
        errors++;
      }
    }

    return {
      processed: organizations.length,
      inserted,
      updated,
      errors
    };
  }

  /**
   * Map PEMS organization to our structure
   */
  private mapPemsOrganization(pemsOrg: any): { code: string; name: string; description: string } {
    // PEMS organizations have ORGANIZATIONID.ORGANIZATIONCODE and ORGANIZATIONID.DESCRIPTION
    const orgId = pemsOrg.ORGANIZATIONID || {};

    return {
      code: orgId.ORGANIZATIONCODE || '',
      name: orgId.DESCRIPTION || orgId.ORGANIZATIONCODE || 'Unknown',
      description: orgId.DESCRIPTION || ''
    };
  }

  /**
   * Generate random color for organization logo
   */
  private getRandomColor(): string {
    const colors = ['3b82f6', 'f59e0b', '10b981', '8b5cf6', 'ef4444', '06b6d4'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Get total count of records without fetching all data
   */
  private async getTotalRecordCount(
    url: string,
    username: string,
    password: string,
    tenant: string,
    organizationCode: string,
    gridCode: string,
    gridId: string
  ): Promise<number> {
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    const headers: any = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'tenant': tenant,
      'organization': organizationCode // Use the actual organization code (e.g., RIO, HOLNG)
    };

    const requestBody = {
      GRID: {
        NUMBER_OF_ROWS_FIRST_RETURNED: 1, // Just get 1 record to get total count
        RESULT_IN_SAXORDER: "TRUE"
      },
      ADDON_FILTER: {
        ALIAS_NAME: "pfs_a_org",
        OPERATOR: "BEGINS",
        VALUE: organizationCode // Filter by the actual organization code
      },
      GRID_TYPE: {
        TYPE: "LIST"
      },
      LOV_PARAMETER: {
        ALIAS_NAME: "pfs_id"
      },
      REQUEST_TYPE: "LIST.DATA_ONLY.STORED"
    };

    if (gridCode) {
      (requestBody.GRID as any)['GRID_NAME'] = gridCode;
    }
    if (gridId) {
      (requestBody.GRID as any)['GRID_ID'] = gridId;
    }

    // Log the actual request for debugging
    logger.info('PEMS getTotalRecordCount Request:', {
      url,
      headers: { ...headers, Authorization: '[REDACTED]' },
      body: requestBody
    });

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch total count: ${response.statusText}`);
    }

    const data = await response.json() as any;

    // Log the full response for debugging
    logger.info('PEMS Grid Data API Count Response:', {
      hasResult: !!data.Result,
      hasResultData: !!data.Result?.ResultData,
      hasGRID: !!data.Result?.ResultData?.GRID,
      hasTOTALROWS: !!data.Result?.ResultData?.GRID?.TOTALROWS,
      totalRows: data.Result?.ResultData?.GRID?.TOTALROWS,
      totalCount: data.Result?.ResultData?.GRID?.['TOTAL-COUNT'],
      responseKeys: Object.keys(data),
      resultKeys: data.Result ? Object.keys(data.Result) : [],
      resultDataKeys: data.Result?.ResultData ? Object.keys(data.Result.ResultData) : [],
      gridKeys: data.Result?.ResultData?.GRID ? Object.keys(data.Result.ResultData.GRID) : [],
      errorAlert: data.ErrorAlert,
      warningAlert: data.Result?.WarningAlert,
      infoAlert: data.Result?.InfoAlert
    });

    // PEMS returns total count in Result.ResultData.GRID.TOTAL-COUNT (or TOTALROWS in some versions)
    // Try TOTAL-COUNT first (GridData API spec), then fall back to TOTALROWS
    const totalCountField = data.Result?.ResultData?.GRID?.['TOTAL-COUNT'] ?? data.Result?.ResultData?.GRID?.TOTALROWS;

    // If TOTAL-COUNT is null or undefined, check if there's actual data
    // Some PEMS APIs don't return a total count but do return data
    if (totalCountField === null || totalCountField === undefined) {
      const records = data.Result?.ResultData?.GRID?.DATA?.ROW || [];
      if (records.length > 0) {
        logger.info(`PEMS API returned NULL total count, but found ${records.length} records in first page`);
        logger.info(`Will fetch all pages until empty response`);
        return -1; // Special value meaning "fetch until empty"
      }
    }

    const totalCount = totalCountField || 0;

    logger.info(`Total count from PEMS: ${totalCount}`);

    return totalCount;
  }

  /**
   * Fetch a page of PFA records from PEMS
   */
  private async fetchPfaPage(
    url: string,
    username: string,
    password: string,
    tenant: string,
    organizationCode: string,
    gridCode: string,
    gridId: string,
    offset: number,
    limit: number
  ): Promise<any[]> {
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    const headers: any = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'tenant': tenant,
      'organization': organizationCode // Use the actual organization code (e.g., RIO, HOLNG)
    };

    const requestBody = {
      GRID: {
        NUMBER_OF_ROWS_FIRST_RETURNED: limit,
        ROW_OFFSET: offset,
        RESULT_IN_SAXORDER: "TRUE"
      },
      ADDON_SORT: {
        ALIAS_NAME: "pfs_id",
        TYPE: "ASC"
      },
      ADDON_FILTER: {
        ALIAS_NAME: "pfs_a_org",
        OPERATOR: "BEGINS",
        VALUE: organizationCode // Filter by organization
      },
      GRID_TYPE: {
        TYPE: "LIST"
      },
      LOV_PARAMETER: {
        ALIAS_NAME: "pfs_id"
      },
      REQUEST_TYPE: "LIST.DATA_ONLY.STORED"
    };

    if (gridCode) {
      (requestBody.GRID as any)['GRID_NAME'] = gridCode;
    }
    if (gridId) {
      (requestBody.GRID as any)['GRID_ID'] = gridId;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch PFA data: ${response.statusText}`);
    }

    const data = await response.json() as any;

    // Log the full response for debugging
    logger.info('PEMS Grid Data API Response:', {
      hasResult: !!data.Result,
      hasResultData: !!data.Result?.ResultData,
      hasGRID: !!data.Result?.ResultData?.GRID,
      hasDATA: !!data.Result?.ResultData?.GRID?.DATA,
      hasROW: !!data.Result?.ResultData?.GRID?.DATA?.ROW,
      rowLength: data.Result?.ResultData?.GRID?.DATA?.ROW?.length || 0,
      responseKeys: Object.keys(data),
      resultKeys: data.Result ? Object.keys(data.Result) : [],
      resultDataKeys: data.Result?.ResultData ? Object.keys(data.Result.ResultData) : [],
      gridKeys: data.Result?.ResultData?.GRID ? Object.keys(data.Result.ResultData.GRID) : []
    });

    return data.Result?.ResultData?.GRID?.DATA?.ROW || [];
  }

  /**
   * Process a chunk of records and save to database
   */
  private async processRecordChunk(
    records: any[],
    organizationId: string,
    organizationCode: string
  ): Promise<{ processed: number; inserted: number; updated: number; errors: number }> {
    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (const record of records) {
      try {
        const mirrorData = this.mapPemsRecordToMirrorData(record, organizationId, organizationCode);

        // Write to PfaMirror table with versioning (archive old version before update)
        const result = await prisma.$transaction(async (tx) => {
          // Check if record exists
          const existingMirror = await tx.pfa_mirror.findUnique({
            where: {
              organizationId_pfaId: {
                organizationId: organizationId,
                pfaId: mirrorData.pfaId
              }
            }
          });

          if (existingMirror) {
            // Archive current version to history before updating
            await tx.pfa_mirror_history.create({
              data: {
                id: `pfah_${existingMirror.id}_v${existingMirror.version}`,
                mirrorId: existingMirror.id,
                version: existingMirror.version,
                organizationId: existingMirror.organizationId,
                data: existingMirror.data as any,
                pfaId: existingMirror.pfaId,
                category: existingMirror.category,
                class: existingMirror.class,
                source: existingMirror.source,
                dor: existingMirror.dor,
                areaSilo: existingMirror.areaSilo,
                manufacturer: existingMirror.manufacturer,
                model: existingMirror.model,
                monthlyRate: existingMirror.monthlyRate,
                purchasePrice: existingMirror.purchasePrice,
                forecastStart: existingMirror.forecastStart,
                forecastEnd: existingMirror.forecastEnd,
                originalStart: existingMirror.originalStart,
                originalEnd: existingMirror.originalEnd,
                actualStart: existingMirror.actualStart,
                actualEnd: existingMirror.actualEnd,
                isActualized: existingMirror.isActualized,
                isDiscontinued: existingMirror.isDiscontinued,
                isFundsTransferable: existingMirror.isFundsTransferable,
                hasPlan: existingMirror.hasPlan,
                hasActuals: existingMirror.hasActuals,
                pemsVersion: existingMirror.pemsVersion,
                syncBatchId: existingMirror.syncBatchId,
                changedBy: 'PEMS_SYNC',
                changeReason: 'PEMS data sync update'
              }
            });

            // Update mirror with incremented version
            return tx.pfa_mirror.update({
              where: { id: existingMirror.id },
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
                forecastStart: mirrorData.forecastStart ? new Date(mirrorData.forecastStart) : null,
                forecastEnd: mirrorData.forecastEnd ? new Date(mirrorData.forecastEnd) : null,
                originalStart: mirrorData.originalStart ? new Date(mirrorData.originalStart) : null,
                originalEnd: mirrorData.originalEnd ? new Date(mirrorData.originalEnd) : null,
                actualStart: mirrorData.actualStart ? new Date(mirrorData.actualStart) : null,
                actualEnd: mirrorData.actualEnd ? new Date(mirrorData.actualEnd) : null,
                isActualized: mirrorData.isActualized,
                isDiscontinued: mirrorData.isDiscontinued,
                isFundsTransferable: mirrorData.isFundsTransferable,
                hasPlan: mirrorData.hasPlan,
                hasActuals: mirrorData.hasActuals,
                pemsVersion: mirrorData.pemsVersion,
                version: existingMirror.version + 1,
                lastSyncedAt: new Date()
              }
            });
          } else {
            // Create new mirror record
            return tx.pfa_mirror.create({
              data: {
                id: `pfam_${organizationId}_${mirrorData.pfaId}`,
                organizationId: organizationId,
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
                forecastStart: mirrorData.forecastStart ? new Date(mirrorData.forecastStart) : null,
                forecastEnd: mirrorData.forecastEnd ? new Date(mirrorData.forecastEnd) : null,
                originalStart: mirrorData.originalStart ? new Date(mirrorData.originalStart) : null,
                originalEnd: mirrorData.originalEnd ? new Date(mirrorData.originalEnd) : null,
                actualStart: mirrorData.actualStart ? new Date(mirrorData.actualStart) : null,
                actualEnd: mirrorData.actualEnd ? new Date(mirrorData.actualEnd) : null,
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

        // Track insert vs update
        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          inserted++;
        } else {
          updated++;
        }

        logger.debug('Synced PFA to mirror:', {
          pfaId: mirrorData.pfaId,
          organization: organizationCode
        });

      } catch (error) {
        logger.error('Failed to process PFA record:', error);
        errors++;
      }
    }

    return {
      processed: records.length,
      inserted,
      updated,
      errors
    };
  }

  /**
   * Map PEMS grid row to PfaMirrorData structure
   * This creates the immutable baseline that gets stored in pfa_mirror.data (JSONB)
   */
  private mapPemsRecordToMirrorData(pemsRow: any, _organizationId: string, organizationCode: string): any {
    // PEMS returns data as ROW.CELL array where each CELL has ALIAS_NAME and VALUE
    const getValue = (aliasName: string): string => {
      const cell = pemsRow.CELL?.find((c: any) => c.ALIAS_NAME === aliasName);
      return cell?.VALUE || '';
    };

    // Map PEMS fields to PfaMirrorData structure
    return {
      // Identity
      pfaId: getValue('pfs_id'),
      organization: organizationCode,

      // Classification
      areaSilo: getValue('pfs_f_area') || '',
      category: getValue('pfs_f_category') || '',
      forecastCategory: getValue('pfs_f_catdesc') || undefined,
      class: getValue('pfs_f_class') || '',

      // Source & Financial Type
      source: getValue('pfs_f_source') || 'Rental', // Rental or Purchase
      dor: getValue('pfs_f_dor') || 'PROJECT', // BEO or PROJECT

      // Status Flags (from PEMS)
      isActualized: getValue('pfs_f_actualized') === 'Y',
      isDiscontinued: getValue('pfs_f_discontinued') === 'Y',
      isFundsTransferable: getValue('pfs_f_fundstrans') === 'Y',

      // Financial Data (from PEMS)
      monthlyRate: parseFloat(getValue('pfs_f_rental')) || 0,
      purchasePrice: parseFloat(getValue('pfs_f_purchase')) || 0,

      // Equipment Details
      manufacturer: getValue('pfs_f_manufacturer') || '',
      model: getValue('pfs_f_model') || '',
      contract: getValue('pfs_p_projcode') || undefined,
      equipment: getValue('pfs_equipment_tag') || undefined,

      // Timeline - PLAN (Baseline - Locked)
      originalStart: this.parseDate(getValue('pfs_p_startdate')),
      originalEnd: this.parseDate(getValue('pfs_p_enddate')),
      hasPlan: !!(getValue('pfs_p_startdate') && getValue('pfs_p_enddate')),

      // Timeline - FORECAST (Editable)
      forecastStart: this.parseDate(getValue('pfs_f_startdate')),
      forecastEnd: this.parseDate(getValue('pfs_f_enddate')),

      // Timeline - ACTUALS (Historical)
      actualStart: this.parseDate(getValue('pfs_a_startdate')),
      actualEnd: this.parseDate(getValue('pfs_a_enddate')),
      hasActuals: !!(getValue('pfs_a_startdate') && getValue('pfs_a_enddate')),

      // PEMS Metadata
      pemsVersion: getValue('pfs_lastmodified') || undefined,
      lastSyncedAt: new Date().toISOString(),
      syncBatchId: undefined // Set by caller if needed
    };
  }

  /**
   * Parse PEMS date format
   */
  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    try {
      return new Date(dateStr);
    } catch {
      return null;
    }
  }

  /**
   * Sync all organizations that are eligible for sync
   * (external organizations with sync enabled and active status)
   *
   * Phase 3, Task 3.1: Organization-Based Sync Filtering
   */
  async syncAllOrganizations(apiConfigId: string): Promise<AllOrganizationsSyncSummary> {
    const startTime = new Date();
    const results: OrganizationSyncResult[] = [];

    logger.info('Starting sync for all eligible organizations', { apiConfigId });

    try {
      // Find all organizations that should be synced
      const organizations = await prisma.organizations.findMany({
        where: {
          isExternal: true,
          enableSync: true
        },
        orderBy: {
          code: 'asc'
        }
      });

      logger.info(`Found ${organizations.length} organizations with sync enabled`);

      for (const org of organizations) {
        logger.info(`Processing organization: ${org.code}`, {
          organizationId: org.id,
          serviceStatus: org.serviceStatus
        });

        // Check if organization is active
        if (org.serviceStatus !== 'active') {
          const reason = `Organization status: ${org.serviceStatus}`;

          logger.warn(`Skipping organization ${org.code} - ${reason}`);

          // Log skip to audit log
          await prisma.audit_logs.create({
            data: {
              id: randomUUID(),
              userId: 'system',
              organizationId: org.id,
              action: 'sync_skipped',
              resource: 'all_organizations_sync',
              method: 'POST',
              success: false,
              metadata: {
                reason,
                serviceStatus: org.serviceStatus,
                timestamp: new Date().toISOString()
              }
            }
          });

          results.push({
            organizationId: org.id,
            organizationCode: org.code,
            skipped: true,
            reason
          });

          continue;
        }

        // Attempt to sync this organization
        try {
          const syncProgress = await this.syncPfaData(
            org.id,
            'full',
            undefined,
            apiConfigId
          );

          results.push({
            organizationId: org.id,
            organizationCode: org.code,
            skipped: false,
            syncProgress
          });

          logger.info(`Successfully synced organization ${org.code}`, {
            totalRecords: syncProgress.totalRecords,
            processedRecords: syncProgress.processedRecords
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          logger.error(`Failed to sync organization ${org.code}`, {
            error: errorMessage
          });

          // Log failure to audit log
          await prisma.audit_logs.create({
            data: {
              id: randomUUID(),
              userId: 'system',
              organizationId: org.id,
              action: 'sync_failed',
              resource: 'all_organizations_sync',
              method: 'POST',
              success: false,
              metadata: {
                error: errorMessage,
                timestamp: new Date().toISOString()
              }
            }
          });

          results.push({
            organizationId: org.id,
            organizationCode: org.code,
            skipped: false,
            reason: `Sync failed: ${errorMessage}`
          });
        }
      }

      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      const summary: AllOrganizationsSyncSummary = {
        totalOrganizations: organizations.length,
        syncedOrganizations: results.filter(r => !r.skipped && r.syncProgress?.status === 'completed').length,
        skippedOrganizations: results.filter(r => r.skipped).length,
        failedOrganizations: results.filter(r => !r.skipped && (!r.syncProgress || r.syncProgress.status === 'failed')).length,
        results,
        startedAt: startTime,
        completedAt: endTime,
        durationMs
      };

      logger.info('Completed sync for all organizations', {
        totalOrganizations: summary.totalOrganizations,
        syncedOrganizations: summary.syncedOrganizations,
        skippedOrganizations: summary.skippedOrganizations,
        failedOrganizations: summary.failedOrganizations,
        durationMs
      });

      return summary;

    } catch (error) {
      logger.error('Failed to sync all organizations', { error });
      throw error;
    }
  }
}

export const pemsSyncService = new PemsSyncService();
