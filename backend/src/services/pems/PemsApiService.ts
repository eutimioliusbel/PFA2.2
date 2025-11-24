import axios, { AxiosInstance } from 'axios';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

interface PemsConfig {
  endpoint: string;
  username: string;
  password: string;
  tenant: string;
}

interface PemsGridRequest {
  GRID: {
    GRID_NAME: string;
    GRID_ID: string;
    NUMBER_OF_ROWS_FIRST_RETURNED: number;
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

export class PemsApiService {
  private readClient: AxiosInstance;
  private writeClient: AxiosInstance;

  constructor() {
    // Read client configuration
    this.readClient = this.createClient({
      endpoint: env.PEMS_READ_ENDPOINT,
      username: env.PEMS_READ_USERNAME,
      password: env.PEMS_READ_PASSWORD,
      tenant: env.PEMS_READ_TENANT,
    });

    // Write client configuration (separate credentials/endpoint)
    this.writeClient = this.createClient({
      endpoint: env.PEMS_WRITE_ENDPOINT,
      username: env.PEMS_WRITE_USERNAME,
      password: env.PEMS_WRITE_PASSWORD,
      tenant: env.PEMS_WRITE_TENANT,
    });
  }

  /**
   * Create Axios instance with PEMS authentication
   */
  private createClient(config: PemsConfig): AxiosInstance {
    const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64');

    const client = axios.create({
      baseURL: config.endpoint,
      timeout: 60000, // 60 seconds for large datasets
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${credentials}`,
        'tenant': config.tenant,
      },
    });

    // Request interceptor for logging
    client.interceptors.request.use(
      (req) => {
        logger.debug(`PEMS Request: ${req.method?.toUpperCase()} ${req.url}`);
        return req;
      },
      (error) => {
        logger.error('PEMS Request error:', error.message);
        return Promise.reject(error);
      }
    );

    // Response interceptor with retry logic
    client.interceptors.response.use(
      (response) => {
        logger.debug(`PEMS Response: ${response.status}`);
        return response;
      },
      async (error) => {
        const config = error.config;

        // Retry logic with exponential backoff
        if (!config._retryCount) {
          config._retryCount = 0;
        }

        if (config._retryCount < 3) {
          config._retryCount++;
          const delay = Math.pow(2, config._retryCount) * 1000; // 2s, 4s, 8s
          logger.warn(`PEMS API error, retrying in ${delay}ms (attempt ${config._retryCount}/3)`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return client(config);
        }

        logger.error(`PEMS API error after 3 retries: ${error.message}`);
        return Promise.reject(error);
      }
    );

    return client;
  }

  /**
   * Fetch PFA data from PEMS (READ operation)
   */
  async fetchPfaData(
    organizationCode: string,
    offset: number = 0,
    limit: number = 10000
  ): Promise<any[]> {
    const requestBody: PemsGridRequest = {
      GRID: {
        GRID_NAME: 'CUPFAG',
        GRID_ID: '100541',
        NUMBER_OF_ROWS_FIRST_RETURNED: Math.min(limit, 10000),
        RESULT_IN_SAXORDER: 'TRUE',
      },
      ADDON_SORT: {
        ALIAS_NAME: 'pfs_id',
        TYPE: 'ASC',
      },
      ADDON_FILTER: {
        ALIAS_NAME: 'pfs_a_org',
        OPERATOR: 'BEGINS',
        VALUE: organizationCode,
      },
      GRID_TYPE: { TYPE: 'LIST' },
      LOV_PARAMETER: { ALIAS_NAME: 'pfs_id' },
      REQUEST_TYPE: 'LIST.DATA_ONLY.STORED',
    };

    try {
      logger.info(`Fetching PFA data for org: ${organizationCode} (offset: ${offset}, limit: ${limit})`);

      const response = await this.readClient.post('', requestBody);

      // Parse PEMS response structure
      const data = response.data?.Result?.ResultData?.GRID?.DATA?.ROW || [];

      logger.info(`Fetched ${data.length} PFA records for ${organizationCode}`);

      return data;
    } catch (error: any) {
      logger.error(`Failed to fetch PFA data for ${organizationCode}:`, error.message);
      throw new Error(`PEMS API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Fetch ALL PFA data with automatic pagination
   */
  async fetchAllPfaData(organizationCode: string): Promise<any[]> {
    let allRecords: any[] = [];
    let offset = 0;
    const batchSize = 10000;
    let hasMore = true;

    while (hasMore) {
      const batch = await this.fetchPfaData(organizationCode, offset, batchSize);

      if (batch.length === 0) {
        hasMore = false;
      } else {
        allRecords = allRecords.concat(batch);
        offset += batchSize;

        // Safety: Stop at 100K records (likely data issue if exceeded)
        if (allRecords.length > 100000) {
          logger.warn(`Fetched 100K+ records for ${organizationCode}, stopping pagination`);
          break;
        }

        // If less than batch size, we've reached the end
        if (batch.length < batchSize) {
          hasMore = false;
        }
      }
    }

    logger.info(`Total PFA records fetched for ${organizationCode}: ${allRecords.length}`);
    return allRecords;
  }

  /**
   * Update PFA records in PEMS (WRITE operation)
   */
  async updatePfaRecords(
    organizationCode: string,
    records: any[]
  ): Promise<{ success: boolean; updated: number; errors: any[] }> {
    try {
      logger.info(`Updating ${records.length} PFA records for ${organizationCode}`);

      // TODO: Implement actual PEMS update API call
      // This will depend on PEMS API specification for updates

      // For now, return mock response
      logger.warn('PEMS write API not yet implemented');

      return {
        success: true,
        updated: records.length,
        errors: [],
      };
    } catch (error: any) {
      logger.error(`Failed to update PFA records for ${organizationCode}:`, error.message);
      throw error;
    }
  }

  /**
   * Test connection to PEMS API
   */
  async testConnection(type: 'read' | 'write' = 'read'): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    const startTime = Date.now();
    const client = type === 'read' ? this.readClient : this.writeClient;

    try {
      // Simple test request (fetch 1 record)
      const testRequest: PemsGridRequest = {
        GRID: {
          GRID_NAME: 'CUPFAG',
          GRID_ID: '100541',
          NUMBER_OF_ROWS_FIRST_RETURNED: 1,
          RESULT_IN_SAXORDER: 'TRUE',
        },
        GRID_TYPE: { TYPE: 'LIST' },
        REQUEST_TYPE: 'LIST.DATA_ONLY.STORED',
      };

      await client.post('', testRequest);

      const latencyMs = Date.now() - startTime;
      logger.info(`PEMS ${type} connection test successful: ${latencyMs}ms`);

      return { success: true, latencyMs };
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      logger.error(`PEMS ${type} connection test failed:`, error.message);

      return {
        success: false,
        latencyMs,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Transform PEMS raw data to PfaRecord format
   */
  transformPemsData(rawData: any[]): any[] {
    return rawData.map((row, index) => {
      // PEMS returns data as object with column keys
      // Extract column values in order (73 columns based on C# reference)
      const columns = Object.values(row);

      return {
        id: `pfa-${index}-${Date.now()}`,
        pfaId: this.cleanValue(columns[1]),
        organization: this.cleanValue(columns[5]),
        areaSilo: this.cleanValue(columns[56]),
        category: this.cleanValue(columns[38]) || this.cleanValue(columns[9]),
        forecastCategory: this.cleanValue(columns[38]),
        class: this.cleanValue(columns[37]) || this.cleanValue(columns[8]),

        source: this.parseSource(this.cleanValue(columns[41]) || this.cleanValue(columns[13])),
        dor: this.parseDor(this.cleanValue(columns[42]) || this.cleanValue(columns[14])),

        isActualized: this.parseBoolean(this.cleanValue(columns[54])),
        isDiscontinued: this.parseBoolean(this.cleanValue(columns[55])),
        isFundsTransferable: this.parseBoolean(this.cleanValue(columns[64])),

        monthlyRate: this.parseFloat(this.cleanValue(columns[46]) || this.cleanValue(columns[19])),
        purchasePrice: this.parseFloat(this.cleanValue(columns[48]) || this.cleanValue(columns[24])),

        manufacturer: this.cleanValue(columns[39]) || this.cleanValue(columns[11]),
        model: this.cleanValue(columns[40]) || this.cleanValue(columns[12]),

        originalStart: this.parseDate(this.cleanValue(columns[17])),
        originalEnd: this.parseDate(this.cleanValue(columns[18])),
        hasPlan: !!this.cleanValue(columns[17]),

        forecastStart: this.parseDate(this.cleanValue(columns[43]) || this.cleanValue(columns[17])),
        forecastEnd: this.parseDate(this.cleanValue(columns[44]) || this.cleanValue(columns[18])),

        actualStart: this.parseDate(this.cleanValue(columns[43])),
        actualEnd: this.parseDate(this.cleanValue(columns[44])),
        hasActuals: this.parseBoolean(this.cleanValue(columns[54])),

        contract: this.cleanValue(columns[59]),
        equipment: this.cleanValue(columns[61]),
      };
    });
  }

  // Helper methods for data cleaning
  private cleanValue(value: any): string {
    if (!value) return '';
    return String(value).replace(/["']/g, '').trim();
  }

  private parseFloat(value: string): number | null {
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  private parseBoolean(value: string): boolean {
    return value.toLowerCase() === 'true';
  }

  private parseDate(value: string): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  private parseSource(value: string): string {
    if (!value) return 'Rental';
    return value.toLowerCase().includes('rental') ? 'Rental' : 'Purchase';
  }

  private parseDor(value: string): string {
    if (!value) return 'BEO';
    return value.toUpperCase() === 'PROJECT' ? 'PROJECT' : 'BEO';
  }
}

export default new PemsApiService();
