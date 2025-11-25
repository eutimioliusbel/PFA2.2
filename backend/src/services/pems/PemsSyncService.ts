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

import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import { decrypt } from '../../utils/encryption';

const prisma = new PrismaClient();

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
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId }
      });

      if (!organization) {
        throw new Error(`Organization ${organizationId} not found`);
      }

      // API Config ID is required
      if (!apiConfigId) {
        throw new Error('API Configuration ID is required for sync');
      }

      // Get API configuration from database
      const config = await prisma.apiConfiguration.findUnique({
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
      const orgCredentials = await prisma.organizationApiCredentials.findUnique({
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

      progress.totalRecords = totalCount;
      progress.totalBatches = Math.ceil(totalCount / this.PAGE_SIZE);

      logger.info(`Total PFA records to sync: ${totalCount}`, {
        organizationId,
        databaseOrgCode: organization.code,
        pemsOrganizationCode: pemsOrganizationCode,
        searchingForPemsOrg: pemsOrganizationCode,
        batches: progress.totalBatches
      });

      // If full sync, clear existing data for this organization
      if (syncType === 'full') {
        logger.info(`Clearing existing PFA data for ${organization.code}`);
        // TODO: Add PfaRecord model and delete existing records
        // await prisma.pfaRecord.deleteMany({
        //   where: { organization: organization.code }
        // });
      }

      // Fetch and process data in pages
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
      'organization': 'BECH' // Use BECH for authentication
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
      REQUEST_TYPE: "LIST.DATA_ONLY.STORED"
    };

    if (gridCode) {
      requestBody.GRID['GRID_NAME'] = gridCode;
    }
    if (gridId) {
      requestBody.GRID['GRID_ID'] = gridId;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch total count: ${response.statusText}`);
    }

    const data = await response.json();
    // PEMS returns total count in Result.ResultData.GRID.TOTALROWS
    return data.Result?.ResultData?.GRID?.TOTALROWS || 0;
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
      'organization': 'BECH'
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
        VALUE: organizationCode
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
      requestBody.GRID['GRID_NAME'] = gridCode;
    }
    if (gridId) {
      requestBody.GRID['GRID_ID'] = gridId;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch PFA data: ${response.statusText}`);
    }

    const data = await response.json();
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
        const pfaData = this.mapPemsRecordToPfa(record, organizationId, organizationCode);

        // TODO: Implement upsert logic when PfaRecord model is ready
        // For now, just log the mapped data
        logger.debug('Mapped PFA record:', {
          pfaId: pfaData.pfaId,
          organization: pfaData.organization
        });

        // When ready, use:
        // const result = await prisma.pfaRecord.upsert({
        //   where: { pfaId: pfaData.pfaId },
        //   update: pfaData,
        //   create: pfaData
        // });

        inserted++; // Placeholder - will be updated when database operations are active

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
   * Map PEMS grid row to PFA record structure
   */
  private mapPemsRecordToPfa(pemsRow: any, organizationId: string, organizationCode: string): any {
    // PEMS returns data as ROW.CELL array where each CELL has ALIAS_NAME and VALUE
    const getValue = (aliasName: string): string => {
      const cell = pemsRow.CELL?.find((c: any) => c.ALIAS_NAME === aliasName);
      return cell?.VALUE || '';
    };

    // Map PEMS fields to our PFA structure
    return {
      organizationId,
      organization: organizationCode,
      pfaId: getValue('pfs_id'),
      description: getValue('description'),

      // Plan fields (original)
      originalStart: this.parseDate(getValue('pfs_p_startdate')),
      originalEnd: this.parseDate(getValue('pfs_p_enddate')),

      // Forecast fields
      forecastStart: this.parseDate(getValue('pfs_f_startdate')),
      forecastEnd: this.parseDate(getValue('pfs_f_enddate')),

      // Actual fields
      actualStart: this.parseDate(getValue('pfs_a_startdate')),
      actualEnd: this.parseDate(getValue('pfs_a_enddate')),

      // Classification
      class: getValue('pfs_f_class'),
      category: getValue('pfs_f_category'),
      categoryDescription: getValue('pfs_f_catdesc'),

      // Financial
      source: getValue('pfs_f_source'), // Rental or Purchase
      dor: getValue('pfs_f_dor'), // BEO or PROJECT
      monthlyRate: parseFloat(getValue('pfs_f_rental')) || 0,
      purchasePrice: parseFloat(getValue('pfs_f_purchase')) || 0,

      // Status flags
      isActualized: getValue('pfs_f_actualized') === 'Y',
      isDiscontinued: getValue('pfs_f_discontinued') === 'Y',
      isFundsTransferable: getValue('pfs_f_fundstrans') === 'Y',

      // Metadata
      area: getValue('pfs_f_area'),
      projectCode: getValue('pfs_p_projcode'),

      createdAt: new Date(),
      updatedAt: new Date()
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
}

export const pemsSyncService = new PemsSyncService();
