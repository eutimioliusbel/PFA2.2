/**
 * PEMS UserDefinedScreenService API Client
 *
 * Handles single-record CRUD operations via the UserDefinedScreenService endpoint.
 * Used for writing PFA changes back to PEMS (bi-directional sync).
 *
 * Screen: CUPFA2
 * Endpoint: /axis/restservices/userdefinedscreenservices
 *
 * Configuration: Loaded from database (api_servers + api_endpoints tables)
 *
 * Capabilities:
 * - GET: Retrieve single record by PFS_ID
 * - UPDATE: Modify existing record (requires write permission)
 * - ADD: Create new record (requires write permission)
 * - DELETE: Remove record (requires write permission)
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';
import prisma from '../../config/database';
import { decrypt } from '../../utils/encryption';

// PEMS field names (uppercase as returned by API)
export interface PemsFieldValue {
  TEXTDATA?: string | null;
  NUMERICDATA?: {
    VALUE: number;
    NUMOFDEC?: number;
    SIGN?: string;
    CURRENCY?: string;
    DRCR?: string;
    qualifier?: string;
  } | null;
  DATETIMEDATA?: {
    YEAR: number;
    MONTH: number;
    DAY: number;
    HOUR?: number;
    MINUTE?: number;
    SECOND?: number;
    SUBSECOND?: number;
    TIMEZONE?: string;
    qualifier?: string;
  } | null;
}

export interface PemsFieldPair {
  USERDEFINEDSCREENFIELDNAME: string;
  USERDEFINEDSCREENFIELDVALUE: PemsFieldValue;
}

export interface PemsScreenRequest {
  USERDEFINEDSCREENNAME: string;
  USERDEFINEDSERVICEACTION: 'GET' | 'ADD' | 'UPDATE' | 'DELETE';
  USERDEFINEDSCREENFIELDVALUELIST: {
    USERDEFINEDSCREENFIELDVALUEPAIR: PemsFieldPair[];
  };
}

export interface PemsScreenResponse {
  Result: {
    SessionID: string | null;
    ResultData: {
      UserDefinedScreenService: {
        USERDEFINEDSCREENNAME: string;
        USERDEFINEDSERVICEACTION: string;
        USERDEFINEDSCREENFIELDVALUELIST: {
          USERDEFINEDSCREENFIELDVALUEPAIR: PemsFieldPair[];
        };
        CREATEDDATE: any;
        CREATEDBY: { USERCODE: string; DESCRIPTION: string | null };
        DATEUPDATED: any;
        UPDATEDBY: { USERCODE: string; DESCRIPTION: string | null };
        recordid: number;
      };
    };
    InfoAlert: any;
    WarningAlert: any;
  } | null;
  ConfirmationAlert: any;
  ErrorAlert: Array<{ Message: string; Name: string }>;
}

// PFA Vanguard to PEMS field mapping
export const PFA_TO_PEMS_FIELD_MAP: Record<string, string> = {
  // Identity
  pfaId: 'PFS_ID',
  organization: 'PFS_A_ORG',
  description: 'DESCRIPTION',

  // Classification
  class: 'PFS_F_CLASS',
  category: 'PFS_F_CATEGORY',
  categoryDescription: 'PFS_F_CATDESC',
  manufacturer: 'PFS_F_MANUFACT',
  model: 'PFS_F_MODEL',

  // Source & DOR
  source: 'PFS_F_SOURCE',
  dor: 'PFS_F_DOR',

  // Dates (Forecast)
  forecastStart: 'PFS_F_STARTDATE',
  forecastEnd: 'PFS_F_ENDDATE',

  // Financial
  duration: 'PFS_F_DURATION',
  monthlyRate: 'PFS_F_RATE',
  rateUom: 'PFS_F_RATE_UOM',
  purchasePrice: 'PFS_F_PRICE',
  estimatedAmount: 'PFS_F_ESTIMATEDAMT',
  consumables: 'PFS_F_CONSUMABLES',
  freight: 'PFS_F_FREIGHT',

  // Status flags
  isActualized: 'PFA_ACT',
  isDiscontinued: 'PFA_DIS',
  isFundsTransferable: 'PFS_FT',

  // References
  contract: 'PFA_CA_CONTRACT',
  contractRevision: 'PFA_CA_CONTRACTRE',
  equipment: 'PFS_EQUIPMENT',

  // Tracking
  leadTimeRental: 'PFS_A_LEADTIMERENTAL',
  corporate: 'PFS_A_CORPORATE',
  lastRevision: 'PFS_F_LAST_REVISION',
  lastChangeBy: 'PFS_F_LAST_CHANGE_BY',
  lastUpdated: 'PFS_F_INTLASTUPDATED',
};

// Reverse mapping for reading PEMS data
export const PEMS_TO_PFA_FIELD_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(PFA_TO_PEMS_FIELD_MAP).map(([k, v]) => [v, k])
);

interface PemsServerConfig {
  baseUrl: string;
  username: string;
  password: string;
  tenant: string;
  screenName: string;
}

export class PemsScreenService {
  private client: AxiosInstance | null = null;
  private screenName = 'CUPFA2';
  private maxRetries = 3;
  private retryDelayMs = 2000;
  private configLoaded = false;
  private serverConfig: PemsServerConfig | null = null;

  /**
   * Load configuration from database (api_servers + api_endpoints tables)
   */
  private async loadConfig(): Promise<PemsServerConfig> {
    if (this.serverConfig) {
      return this.serverConfig;
    }

    // Find the PFA write endpoint
    const endpoint = await prisma.api_endpoints.findFirst({
      where: {
        entity: 'pfa',
        operationType: 'write',
        isActive: true,
      },
      include: {
        api_servers: true,
      },
    });

    if (!endpoint || !endpoint.api_servers) {
      throw new Error('PEMS PFA write endpoint not configured. Run database seed or configure in Admin.');
    }

    const server = endpoint.api_servers;

    // Decrypt credentials
    const username = server.authKeyEncrypted ? decrypt(server.authKeyEncrypted) : '';
    const password = server.authValueEncrypted ? decrypt(server.authValueEncrypted) : '';

    // Get tenant from common headers
    const commonHeaders = server.commonHeaders ? JSON.parse(server.commonHeaders as string) : {};
    const tenant = commonHeaders.tenant || 'BECHTEL_DEV';

    // Get screen name from endpoint custom headers
    const customHeaders = endpoint.customHeaders ? JSON.parse(endpoint.customHeaders as string) : {};
    const screenName = customHeaders.screenName || 'CUPFA2';

    this.serverConfig = {
      baseUrl: `${server.baseUrl}${endpoint.path}`,
      username,
      password,
      tenant,
      screenName,
    };

    this.screenName = screenName;

    logger.info('PEMS Screen Service config loaded from database', {
      baseUrl: this.serverConfig.baseUrl,
      tenant: this.serverConfig.tenant,
      screenName: this.screenName,
    });

    return this.serverConfig;
  }

  /**
   * Get or create axios client with database configuration
   */
  private async getClient(): Promise<AxiosInstance> {
    if (this.client && this.configLoaded) {
      return this.client;
    }

    const config = await this.loadConfig();

    const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64');

    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${credentials}`,
        'tenant': config.tenant,
      },
    });

    // Request logging
    this.client.interceptors.request.use((req) => {
      logger.debug(`PEMS Screen API Request: ${req.method?.toUpperCase()} ${req.baseURL}`);
      return req;
    });

    // Response logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`PEMS Screen API Response: ${response.status}`);
        return response;
      },
      (error) => {
        logger.error(`PEMS Screen API Error: ${error.response?.status} - ${error.message}`);
        return Promise.reject(error);
      }
    );

    this.configLoaded = true;
    return this.client;
  }

  /**
   * Execute a screen service request with retry logic
   */
  private async executeRequest(
    action: 'GET' | 'ADD' | 'UPDATE' | 'DELETE',
    fields: PemsFieldPair[],
    organization?: string
  ): Promise<PemsScreenResponse> {
    // Load config and get client (lazy initialization from database)
    const client = await this.getClient();

    const request: PemsScreenRequest = {
      USERDEFINEDSCREENNAME: this.screenName,
      USERDEFINEDSERVICEACTION: action,
      USERDEFINEDSCREENFIELDVALUELIST: {
        USERDEFINEDSCREENFIELDVALUEPAIR: fields,
      },
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const headers: Record<string, string> = {};
        if (organization) {
          headers['organization'] = organization;
        }

        const response = await client.post<PemsScreenResponse>('', request, { headers });

        // Check for error alerts in successful response
        if (response.data.ErrorAlert && response.data.ErrorAlert.length > 0) {
          const errorMsg = response.data.ErrorAlert[0].Message;
          throw new Error(`PEMS Error: ${errorMsg}`);
        }

        return response.data;
      } catch (error: any) {
        lastError = error;
        const errorMsg = error.response?.data?.ErrorAlert?.[0]?.Message || error.message;

        // Don't retry on certain errors
        if (errorMsg.includes('Record not found') ||
            errorMsg.includes('Authorization failed') ||
            errorMsg.includes('not a valid')) {
          throw new Error(`PEMS ${action} failed: ${errorMsg}`);
        }

        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
          logger.warn(`PEMS ${action} attempt ${attempt} failed, retrying in ${delay}ms: ${errorMsg}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`PEMS ${action} failed after ${this.maxRetries} attempts`);
  }

  /**
   * Get a single PFA record by ID
   */
  async getPfaRecord(pfaId: string, organization?: string): Promise<Record<string, any> | null> {
    try {
      const response = await this.executeRequest('GET', [
        { USERDEFINEDSCREENFIELDNAME: 'PFS_ID', USERDEFINEDSCREENFIELDVALUE: { TEXTDATA: pfaId } }
      ], organization);

      if (!response.Result?.ResultData?.UserDefinedScreenService) {
        return null;
      }

      return this.parseScreenResponse(response);
    } catch (error: any) {
      if (error.message.includes('Record not found')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update a PFA record in PEMS
   */
  async updatePfaRecord(
    pfaId: string,
    organization: string,
    updates: Record<string, any>
  ): Promise<{ success: boolean; recordId?: number; error?: string }> {
    try {
      // Build field list with ID + org (required for identification) + updated fields
      const fields: PemsFieldPair[] = [
        { USERDEFINEDSCREENFIELDNAME: 'PFS_ID', USERDEFINEDSCREENFIELDVALUE: { TEXTDATA: pfaId } },
        { USERDEFINEDSCREENFIELDNAME: 'PFS_A_ORG', USERDEFINEDSCREENFIELDVALUE: { TEXTDATA: organization } },
      ];

      // Add updated fields
      for (const [pfaField, value] of Object.entries(updates)) {
        const pemsField = PFA_TO_PEMS_FIELD_MAP[pfaField];
        if (!pemsField) {
          logger.warn(`Unknown PFA field: ${pfaField}, skipping`);
          continue;
        }

        const fieldValue = this.convertToPemsValue(pfaField, value);
        if (fieldValue) {
          fields.push({
            USERDEFINEDSCREENFIELDNAME: pemsField,
            USERDEFINEDSCREENFIELDVALUE: fieldValue,
          });
        }
      }

      logger.info(`Updating PFA record ${pfaId} in PEMS with ${fields.length - 2} field changes`);

      const response = await this.executeRequest('UPDATE', fields, organization);

      const recordId = response.Result?.ResultData?.UserDefinedScreenService?.recordid;
      logger.info(`Successfully updated PFA record ${pfaId} (recordid: ${recordId})`);

      return { success: true, recordId };
    } catch (error: any) {
      logger.error(`Failed to update PFA record ${pfaId}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new PFA record in PEMS
   */
  async createPfaRecord(
    organization: string,
    data: Record<string, any>
  ): Promise<{ success: boolean; pfaId?: string; recordId?: number; error?: string }> {
    try {
      const fields: PemsFieldPair[] = [
        { USERDEFINEDSCREENFIELDNAME: 'PFS_A_ORG', USERDEFINEDSCREENFIELDVALUE: { TEXTDATA: organization } },
      ];

      // Add all provided fields
      for (const [pfaField, value] of Object.entries(data)) {
        const pemsField = PFA_TO_PEMS_FIELD_MAP[pfaField];
        if (!pemsField || pemsField === 'PFS_A_ORG') continue;

        const fieldValue = this.convertToPemsValue(pfaField, value);
        if (fieldValue) {
          fields.push({
            USERDEFINEDSCREENFIELDNAME: pemsField,
            USERDEFINEDSCREENFIELDVALUE: fieldValue,
          });
        }
      }

      logger.info(`Creating new PFA record in PEMS for org ${organization}`);

      const response = await this.executeRequest('ADD', fields, organization);

      const result = response.Result?.ResultData?.UserDefinedScreenService;
      const pfaId = result?.USERDEFINEDSCREENFIELDVALUELIST?.USERDEFINEDSCREENFIELDVALUEPAIR
        ?.find(f => f.USERDEFINEDSCREENFIELDNAME === 'PFS_ID')?.USERDEFINEDSCREENFIELDVALUE?.TEXTDATA;

      logger.info(`Successfully created PFA record ${pfaId} (recordid: ${result?.recordid})`);

      return { success: true, pfaId: pfaId || undefined, recordId: result?.recordid };
    } catch (error: any) {
      logger.error(`Failed to create PFA record: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a PFA record in PEMS
   */
  async deletePfaRecord(
    pfaId: string,
    organization: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const fields: PemsFieldPair[] = [
        { USERDEFINEDSCREENFIELDNAME: 'PFS_ID', USERDEFINEDSCREENFIELDVALUE: { TEXTDATA: pfaId } },
        { USERDEFINEDSCREENFIELDNAME: 'PFS_A_ORG', USERDEFINEDSCREENFIELDVALUE: { TEXTDATA: organization } },
      ];

      logger.info(`Deleting PFA record ${pfaId} from PEMS`);

      await this.executeRequest('DELETE', fields, organization);

      logger.info(`Successfully deleted PFA record ${pfaId}`);
      return { success: true };
    } catch (error: any) {
      logger.error(`Failed to delete PFA record ${pfaId}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Batch update multiple PFA records (sequential, one at a time)
   */
  async batchUpdatePfaRecords(
    updates: Array<{ pfaId: string; organization: string; changes: Record<string, any> }>
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    errors: Array<{ pfaId: string; error: string }>;
  }> {
    const results = {
      total: updates.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ pfaId: string; error: string }>,
    };

    for (const update of updates) {
      const result = await this.updatePfaRecord(update.pfaId, update.organization, update.changes);

      if (result.success) {
        results.successful++;
      } else {
        results.failed++;
        results.errors.push({ pfaId: update.pfaId, error: result.error || 'Unknown error' });
      }

      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info(`Batch update complete: ${results.successful}/${results.total} successful`);
    return results;
  }

  /**
   * Convert PFA Vanguard value to PEMS field value format
   */
  private convertToPemsValue(fieldName: string, value: any): PemsFieldValue | null {
    if (value === null || value === undefined) {
      return null;
    }

    // Date fields
    if (['forecastStart', 'forecastEnd', 'lastUpdated'].includes(fieldName)) {
      const date = value instanceof Date ? value : new Date(value);
      if (isNaN(date.getTime())) return null;

      return {
        DATETIMEDATA: {
          YEAR: date.getTime(),
          MONTH: date.getMonth() + 1,
          DAY: date.getDate(),
          HOUR: date.getHours(),
          MINUTE: date.getMinutes(),
          SECOND: date.getSeconds(),
          SUBSECOND: 0,
          TIMEZONE: '-0500',
          qualifier: 'OTHER',
        },
      };
    }

    // Numeric fields
    if (['duration', 'monthlyRate', 'purchasePrice', 'estimatedAmount',
         'consumables', 'freight', 'leadTimeRental', 'lastRevision'].includes(fieldName)) {
      const numValue = typeof value === 'number' ? value : parseFloat(value);
      if (isNaN(numValue)) return null;

      return {
        NUMERICDATA: {
          VALUE: numValue,
          NUMOFDEC: fieldName === 'purchasePrice' ? 1 : 0,
          SIGN: '+',
          CURRENCY: 'XXX',
          DRCR: 'D',
          qualifier: 'OTHER',
        },
      };
    }

    // Boolean fields (stored as text in PEMS)
    if (['isActualized', 'isDiscontinued', 'isFundsTransferable'].includes(fieldName)) {
      return { TEXTDATA: value ? 'true' : 'false' };
    }

    // Text fields (default)
    return { TEXTDATA: String(value) };
  }

  /**
   * Parse PEMS screen response to PFA Vanguard format
   */
  private parseScreenResponse(response: PemsScreenResponse): Record<string, any> {
    const result: Record<string, any> = {};
    const service = response.Result?.ResultData?.UserDefinedScreenService;

    if (!service) return result;

    result.recordId = service.recordid;
    result.createdDate = this.parsePemsDate(service.CREATEDDATE);
    result.createdBy = service.CREATEDBY?.USERCODE;
    result.updatedDate = this.parsePemsDate(service.DATEUPDATED);
    result.updatedBy = service.UPDATEDBY?.USERCODE;

    const fields = service.USERDEFINEDSCREENFIELDVALUELIST?.USERDEFINEDSCREENFIELDVALUEPAIR || [];

    for (const field of fields) {
      const pfaFieldName = PEMS_TO_PFA_FIELD_MAP[field.USERDEFINEDSCREENFIELDNAME];
      if (!pfaFieldName) continue;

      const value = field.USERDEFINEDSCREENFIELDVALUE;

      if (value.TEXTDATA !== null && value.TEXTDATA !== undefined) {
        // Handle boolean text values
        if (['isActualized', 'isDiscontinued', 'isFundsTransferable'].includes(pfaFieldName)) {
          result[pfaFieldName] = value.TEXTDATA === 'true';
        } else {
          result[pfaFieldName] = value.TEXTDATA;
        }
      } else if (value.NUMERICDATA) {
        result[pfaFieldName] = value.NUMERICDATA.VALUE;
      } else if (value.DATETIMEDATA) {
        result[pfaFieldName] = this.parsePemsDate(value.DATETIMEDATA);
      }
    }

    return result;
  }

  /**
   * Parse PEMS datetime format to JavaScript Date
   */
  private parsePemsDate(dateData: any): Date | null {
    if (!dateData) return null;

    // PEMS returns YEAR as timestamp in milliseconds
    if (typeof dateData.YEAR === 'number' && dateData.YEAR > 1000000000000) {
      // It's a timestamp, but MONTH/DAY are still separate
      const date = new Date(0);
      date.setFullYear(new Date(dateData.YEAR).getFullYear());
      date.setMonth((dateData.MONTH || 1) - 1);
      date.setDate(dateData.DAY || 1);
      date.setHours(dateData.HOUR || 0);
      date.setMinutes(dateData.MINUTE || 0);
      date.setSeconds(dateData.SECOND || 0);
      return date;
    }

    return null;
  }

  /**
   * Test connection to PEMS UserDefinedScreenService
   */
  async testConnection(): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    const startTime = Date.now();

    try {
      // Try to get a record by org (should return first match)
      await this.executeRequest('GET', [
        { USERDEFINEDSCREENFIELDNAME: 'PFS_A_ORG', USERDEFINEDSCREENFIELDVALUE: { TEXTDATA: 'RIO' } }
      ], 'RIO');

      return { success: true, latencyMs: Date.now() - startTime };
    } catch (error: any) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * Test write capability (attempts a no-op update)
   */
  async testWriteCapability(pfaId: string, organization: string): Promise<{
    canWrite: boolean;
    error?: string
  }> {
    try {
      // Try to update with no actual changes
      await this.executeRequest('UPDATE', [
        { USERDEFINEDSCREENFIELDNAME: 'PFS_ID', USERDEFINEDSCREENFIELDVALUE: { TEXTDATA: pfaId } },
        { USERDEFINEDSCREENFIELDNAME: 'PFS_A_ORG', USERDEFINEDSCREENFIELDVALUE: { TEXTDATA: organization } },
      ], organization);

      return { canWrite: true };
    } catch (error: any) {
      return { canWrite: false, error: error.message };
    }
  }
}

// Export singleton instance
export const pemsScreenService = new PemsScreenService();
export default pemsScreenService;
