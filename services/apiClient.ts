/**
 * API Client Service
 *
 * Centralized HTTP client for communicating with the backend API.
 * Handles authentication, token management, and error handling.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Token management
const TOKEN_KEY = 'pfa_auth_token';
const USER_KEY = 'pfa_user_data';

export interface ApiUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'user' | 'viewer';
  organizations: Array<{
    id: string;
    code: string;
    name: string;
    role: string;
  }>;
}

export interface LoginResponse {
  token: string;
  user: ApiUser;
}

export interface AiChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AiChatRequest {
  messages: AiChatMessage[];
  organizationId: string;
  userId?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiChatResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: {
    usd: number;
  };
  model: string;
  provider: string;
  latencyMs: number;
}

export interface AiUsageStats {
  today: {
    requests: number;
    totalCost: number;
    totalTokens: number;
  };
  thisMonth: {
    requests: number;
    totalCost: number;
    totalTokens: number;
  };
  budgetStatus: {
    dailyLimit: number;
    monthlyLimit: number;
    dailyUsed: number;
    monthlyUsed: number;
    dailyPercentage: number;
    monthlyPercentage: number;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // ============================================================================
  // Token Management
  // ============================================================================

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  getUser(): ApiUser | null {
    const userData = localStorage.getItem(USER_KEY);
    return userData ? JSON.parse(userData) : null;
  }

  setUser(user: ApiUser): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // ============================================================================
  // HTTP Request Wrapper
  // ============================================================================

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle HTTP errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: 'UNKNOWN_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
        }));

        // If unauthorized, clear tokens
        if (response.status === 401) {
          this.removeToken();
        }

        throw new Error(errorData.message || `Request failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // If it's already an Error with a message, re-throw it
      if (error instanceof Error && error.message && !error.message.includes('Failed to fetch')) {
        throw error;
      }

      // Network errors (CORS, connection refused, etc.)
      throw new Error('Network request failed');
    }
  }

  // ============================================================================
  // Authentication Endpoints
  // ============================================================================

  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    // Store token and user data
    this.setToken(response.token);
    this.setUser(response.user);

    return response;
  }

  async register(userData: {
    username: string;
    email?: string;
    password: string;
    firstName?: string;
    lastName?: string;
    role?: 'admin' | 'user' | 'viewer';
  }): Promise<LoginResponse> {
    return this.request<LoginResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async verifyToken(): Promise<{ valid: boolean; user?: ApiUser }> {
    try {
      return await this.request<{ valid: boolean; user?: ApiUser }>('/api/auth/verify', {
        method: 'POST',
      });
    } catch {
      return { valid: false };
    }
  }

  logout(): void {
    this.removeToken();
  }

  // ============================================================================
  // AI Endpoints
  // ============================================================================

  async aiChat(request: AiChatRequest): Promise<AiChatResponse> {
    return this.request<AiChatResponse>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getAiUsage(organizationId: string, period?: 'today' | 'month'): Promise<AiUsageStats> {
    const params = new URLSearchParams({
      organizationId,
      ...(period && { period }),
    });

    return this.request<AiUsageStats>(`/api/ai/usage?${params.toString()}`);
  }

  // ============================================================================
  // API Configuration Management
  // ============================================================================

  async getApiConfigs(organizationId: string): Promise<{ configs: any[] }> {
    return this.request<{ configs: any[] }>(`/api/configs?organizationId=${organizationId}`);
  }

  async createApiConfig(config: {
    organizationId: string;
    type: string;
    name: string;
    url: string;
    authType: string;
    username?: string;
    password?: string;
    apiKey?: string;
    tenant?: string;
    organization?: string;
    gridCode?: string;
    gridId?: string;
    operationType?: string;
  }): Promise<{ success: boolean; config: any }> {
    return this.request('/api/configs', {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }

  async updateApiConfig(id: string, config: {
    name?: string;
    url?: string;
    authType?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    tenant?: string;
    organization?: string;
    gridCode?: string;
    gridId?: string;
    operationType?: string;
  }): Promise<{ success: boolean; config: any }> {
    return this.request(`/api/configs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(config)
    });
  }

  async deleteApiConfig(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/configs/${id}`, {
      method: 'DELETE'
    });
  }

  async testApiConfig(id: string, organizationId: string): Promise<{
    success: boolean;
    message: string;
    latencyMs?: number;
  }> {
    return this.request(`/api/configs/${id}/test`, {
      method: 'POST',
      body: JSON.stringify({ organizationId })
    });
  }

  async upsertOrgCredentials(id: string, credentials: {
    organizationId: string;
    username?: string;
    password?: string;
    apiKey?: string;
    tenant?: string;
  }): Promise<{ success: boolean; credentials: any }> {
    return this.request(`/api/configs/${id}/credentials`, {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  }

  async deleteOrgCredentials(id: string, organizationId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request(`/api/configs/${id}/credentials?organizationId=${organizationId}`, {
      method: 'DELETE'
    });
  }

  // ============================================================================
  // PEMS API Management (Legacy - keeping for backward compatibility)
  // ============================================================================

  async getPemsConfigs(organizationId: string): Promise<{ configs: any[] }> {
    return this.request<{ configs: any[] }>(`/api/pems/configs?organizationId=${organizationId}`);
  }

  async testPemsConnection(organizationId: string): Promise<{
    success: boolean;
    status: string;
    recordsFetched?: number;
    latencyMs?: number;
    message: string;
  }> {
    return this.request('/api/pems/test', {
      method: 'POST',
      body: JSON.stringify({ organizationId })
    });
  }

  async syncPemsData(organizationId: string, apiConfigId: string, syncType: 'full' | 'incremental' = 'full'): Promise<{
    success: boolean;
    syncId: string;
    message: string;
    status: string;
  }> {
    return this.request('/api/pems/sync', {
      method: 'POST',
      body: JSON.stringify({ organizationId, apiConfigId, syncType })
    });
  }

  async getSyncStatus(syncId: string): Promise<{
    syncId: string;
    status: string;
    organizationId: string;
    progress: {
      total: number;
      processed: number;
      inserted: number;
      updated: number;
      errors: number;
      percentage: number;
    };
    batch: {
      current: number;
      total: number;
    };
    timing: {
      startedAt: string;
      completedAt: string | null;
      duration: number;
    };
    error: string | null;
  }> {
    return this.request(`/api/pems/sync/${syncId}`);
  }

  async getSyncHistory(organizationId: string, limit: number = 10): Promise<{ history: any[] }> {
    return this.request(`/api/pems/history?organizationId=${organizationId}&limit=${limit}`);
  }

  async syncGlobalApi(apiConfigId: string, syncType: 'full' | 'incremental' = 'full'): Promise<{
    success: boolean;
    message: string;
    batchId: string;
    syncs: Array<{ syncId: string; organizationId: string }>;
  }> {
    return this.request(`/api/pems/sync-global`, {
      method: 'POST',
      body: JSON.stringify({ apiConfigId, syncType })
    });
  }

  async syncOrgApis(organizationId: string, syncType: 'full' | 'incremental' = 'full'): Promise<{
    success: boolean;
    message: string;
    batchId: string;
    syncs: Array<{ syncId: string; apiConfigId?: string }>;
  }> {
    return this.request(`/api/pems/sync-org`, {
      method: 'POST',
      body: JSON.stringify({ organizationId, syncType })
    });
  }

  async getBatchStatus(batchId: string): Promise<{
    batchId: string;
    type: 'global-api' | 'org-all-apis';
    status: 'running' | 'completed' | 'failed' | 'partial';
    totalSyncs: number;
    completedSyncs: number;
    failedSyncs: number;
    timing: {
      startedAt: string;
      completedAt: string | null;
      duration: number;
    };
    aggregated: {
      totalRecords: number;
      processedRecords: number;
      insertedRecords: number;
      updatedRecords: number;
      errorRecords: number;
    };
    syncs: Array<{
      syncId: string;
      organizationId: string;
      apiConfigId?: string;
      status: 'running' | 'completed' | 'failed';
      progress: {
        total: number;
        processed: number;
        inserted: number;
        updated: number;
        errors: number;
        percentage: number;
      } | null;
    }>;
  }> {
    return this.request(`/api/pems/sync-batch/${batchId}`);
  }

  // ============================================================================
  // Logs API
  // ============================================================================

  async getAiUsageLogs(organizationId?: string, userId?: string, limit: number = 100): Promise<{ logs: any[] }> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (organizationId) params.append('organizationId', organizationId);
    if (userId) params.append('userId', userId);
    return this.request(`/api/logs/ai-usage?${params.toString()}`);
  }

  async getAiUsageStats(organizationId?: string): Promise<{
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    averageLatency: number;
    successRate: number;
  }> {
    const params = new URLSearchParams();
    if (organizationId) params.append('organizationId', organizationId);
    return this.request(`/api/logs/ai-usage/stats?${params.toString()}`);
  }

  async getSyncLogs(organizationId?: string, limit: number = 100): Promise<{ logs: any[] }> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (organizationId) params.append('organizationId', organizationId);
    return this.request(`/api/logs/sync?${params.toString()}`);
  }

  async getSyncStats(organizationId?: string): Promise<{
    totalSyncs: number;
    successfulSyncs: number;
    successRate: number;
    totalRecordsProcessed: number;
    totalRecordsInserted: number;
    totalRecordsUpdated: number;
    totalRecordsDeleted: number;
    averageDuration: number;
  }> {
    const params = new URLSearchParams();
    if (organizationId) params.append('organizationId', organizationId);
    return this.request(`/api/logs/sync/stats?${params.toString()}`);
  }

  // ============================================================================
  // User Management
  // ============================================================================

  async getUsers(): Promise<{ users: any[] }> {
    return this.request<{ users: any[] }>('/api/users');
  }

  async createUser(userData: {
    username: string;
    email?: string;
    password: string;
    firstName?: string;
    lastName?: string;
    role?: 'admin' | 'user' | 'viewer';
    organizationIds?: string[];
  }): Promise<{ success: boolean; user: any }> {
    return this.request('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(id: string, userData: {
    username?: string;
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    role?: 'admin' | 'user' | 'viewer';
    isActive?: boolean;
    organizationIds?: string[];
  }): Promise<{ success: boolean; user: any }> {
    return this.request(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/users/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Organization Management
  // ============================================================================

  async getOrganizations(): Promise<{ organizations: any[] }> {
    return this.request<{ organizations: any[] }>('/api/organizations');
  }

  async createOrganization(orgData: {
    code: string;
    name: string;
    description?: string;
  }): Promise<{ success: boolean; organization: any }> {
    return this.request('/api/organizations', {
      method: 'POST',
      body: JSON.stringify(orgData),
    });
  }

  async updateOrganization(id: string, orgData: {
    name?: string;
    description?: string;
    isActive?: boolean;
  }): Promise<{ success: boolean; organization: any }> {
    return this.request(`/api/organizations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(orgData),
    });
  }

  async deleteOrganization(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/organizations/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Data Source Mappings
  // ============================================================================

  async getDataSourceMappings(): Promise<any[]> {
    return this.request('/api/data-sources/mappings');
  }

  async getDataSourceMapping(id: string): Promise<any> {
    return this.request(`/api/data-sources/mappings/${id}`);
  }

  async getDataSourceMappingMetrics(id: string): Promise<any> {
    return this.request(`/api/data-sources/mappings/${id}/metrics`);
  }

  async createDataSourceMapping(data: {
    entityType: string;
    organizationId?: string;
    apiConfigId: string;
    priority?: number;
    isActive?: boolean;
  }): Promise<any> {
    return this.request('/api/data-sources/mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  async updateDataSourceMapping(id: string, updates: any): Promise<any> {
    return this.request(`/api/data-sources/mappings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  }

  async deleteDataSourceMapping(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/data-sources/mappings/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Phase 3: PFA Data API (Mirror + Delta Architecture)
  // ============================================================================

  /**
   * Get merged PFA data (mirror + user modifications)
   * @param orgId Organization ID
   * @param filters Optional filters for category, class, DOR, source, date ranges, etc.
   * @returns PfaDataResponse with merged records, pagination, and sync state
   */
  async getPfaData(orgId: string, filters?: {
    category?: string[];
    class?: string[];
    dor?: string[];
    source?: string[];
    forecastStartFrom?: string;
    forecastStartTo?: string;
    forecastEndFrom?: string;
    forecastEndTo?: string;
    isActualized?: boolean;
    isDiscontinued?: boolean;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<any> {
    const params = new URLSearchParams();

    // Add filters to query params
    if (filters) {
      if (filters.category && filters.category.length > 0) {
        params.append('category', filters.category.join(','));
      }
      if (filters.class && filters.class.length > 0) {
        params.append('class', filters.class.join(','));
      }
      if (filters.dor && filters.dor.length > 0) {
        params.append('dor', filters.dor.join(','));
      }
      if (filters.source && filters.source.length > 0) {
        params.append('source', filters.source.join(','));
      }
      if (filters.forecastStartFrom) {
        params.append('forecastStartFrom', filters.forecastStartFrom);
      }
      if (filters.forecastStartTo) {
        params.append('forecastStartTo', filters.forecastStartTo);
      }
      if (filters.forecastEndFrom) {
        params.append('forecastEndFrom', filters.forecastEndFrom);
      }
      if (filters.forecastEndTo) {
        params.append('forecastEndTo', filters.forecastEndTo);
      }
      if (filters.isActualized !== undefined) {
        params.append('isActualized', String(filters.isActualized));
      }
      if (filters.isDiscontinued !== undefined) {
        params.append('isDiscontinued', String(filters.isDiscontinued));
      }
      if (filters.page !== undefined) {
        params.append('page', String(filters.page));
      }
      if (filters.pageSize !== undefined) {
        params.append('pageSize', String(filters.pageSize));
      }
      if (filters.sortBy) {
        params.append('sortBy', filters.sortBy);
      }
      if (filters.sortOrder) {
        params.append('sortOrder', filters.sortOrder);
      }
    }

    const queryString = params.toString();
    const endpoint = `/api/pfa/${orgId}${queryString ? `?${queryString}` : ''}`;

    return this.request(endpoint);
  }

  /**
   * Save draft modifications
   * @param orgId Organization ID
   * @param sessionId UUID for grouping related changes
   * @param modifications Array of PFA modifications
   * @returns SaveDraftResponse with count of saved records
   */
  async saveDraft(orgId: string, sessionId: string, modifications: Array<{
    pfaId: string;
    changes: Record<string, any>;
  }>): Promise<any> {
    return this.request(`/api/pfa/${orgId}/draft`, {
      method: 'POST',
      body: JSON.stringify({ sessionId, modifications })
    });
  }

  /**
   * Commit draft modifications (update syncState to 'committed')
   * @param orgId Organization ID
   * @param options Optional sessionId or pfaIds to commit specific records
   * @returns CommitDraftResponse with count of committed records
   */
  async commitDrafts(orgId: string, options?: {
    sessionId?: string;
    pfaIds?: string[];
  }): Promise<any> {
    return this.request(`/api/pfa/${orgId}/commit`, {
      method: 'POST',
      body: JSON.stringify(options || {})
    });
  }

  /**
   * Discard draft modifications
   * @param orgId Organization ID
   * @param options Optional sessionId or pfaIds to discard specific records
   * @returns DiscardDraftResponse with count of discarded records
   */
  async discardDrafts(orgId: string, options?: {
    sessionId?: string;
    pfaIds?: string[];
  }): Promise<any> {
    return this.request(`/api/pfa/${orgId}/discard`, {
      method: 'POST',
      body: JSON.stringify(options || {})
    });
  }

  /**
   * Get KPI statistics for organization
   * @param orgId Organization ID
   * @returns PfaStatsResponse with totals, variance, and breakdown by category/source
   */
  async getStats(orgId: string): Promise<any> {
    return this.request(`/api/pfa/${orgId}/stats`);
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  async healthCheck(): Promise<{ status: string; timestamp: string; environment: string }> {
    return this.request<{ status: string; timestamp: string; environment: string }>('/health');
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for testing
export default ApiClient;
