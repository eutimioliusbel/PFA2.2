/**
 * API Client Service
 *
 * Centralized HTTP client for communicating with the backend API.
 * Handles authentication, token management, and error handling.
 */

import type {
  // Core data types used by API methods
  PfaView,
  PfaModificationDelta,
  AssetMasterRecord,
  // API response types used by API methods
  ApiUser,
  ApiOrganization,
  LoginResponse,
  ApiServerConfig,
  PemsCredentials,
  SyncHistoryItem,
  SyncLog,
  AiUsageLog,
  AiChatRequest,
  AiChatResponse,
  AiUsageStats,
  UserSession,
  UserOrganization,
  AuditLog,
  AuditChange,
  AuditReview,
  AuditStats,
  RevertLog,
  PermissionExplanation,
  ApiRoleTemplate,
  ApiPersonalAccessToken,
  Webhook,
  DictionaryEntry,
  ApiTrashItem,
  Pagination,
  PfaMetadata,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

/**
 * Custom error for permission-related failures
 * Thrown when backend returns 403 with permission denial
 */
export class PermissionError extends Error {
  constructor(
    message: string,
    public permission: string,
    public errorCode?: string
  ) {
    super(message);
    this.name = 'PermissionError';
  }
}

// Token management
const TOKEN_KEY = 'pfa_auth_token';
const USER_KEY = 'pfa_user_data';

// Re-export types for backward compatibility (files importing from apiClient.ts)
// Note: Only export types that are actually used by other files importing from apiClient
export { type Permissions, type ApiUser, type ApiUserOrganization as OrganizationWithPermissions, type JWTPayload } from '../types';

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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
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

        // If forbidden, check for permission denial
        if (response.status === 403) {
          // Check if it's a permission error (has 'permission' or 'permissions' field)
          if (errorData.permission || errorData.permissions) {
            throw new PermissionError(
              errorData.message || 'Insufficient permissions',
              errorData.permission || errorData.permissions?.join(', ') || 'unknown',
              errorData.error
            );
          }
        }

        throw new Error(errorData.message || `Request failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // If it's a PermissionError, re-throw it
      if (error instanceof PermissionError) {
        throw error;
      }

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
  // Impersonation Endpoints (ADR-005: View As)
  // ============================================================================

  /**
   * Start impersonating another user
   * @param userId - Target user ID to impersonate
   * @returns Impersonation token and user details
   */
  async startImpersonation(userId: string): Promise<{
    success: boolean;
    token: string;
    impersonating: {
      userId: string;
      username: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      role: string;
      organizations: Array<{ id: string; code: string; role: string }>;
    };
    expiresAt: string;
    expiresInMinutes: number;
    message: string;
  }> {
    const response = await this.request<{
      success: boolean;
      token: string;
      impersonating: {
        userId: string;
        username: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        role: string;
        organizations: Array<{ id: string; code: string; role: string }>;
      };
      expiresAt: string;
      expiresInMinutes: number;
      message: string;
    }>(`/api/auth/impersonate/${userId}`, {
      method: 'POST',
    });

    // Store the impersonation token
    if (response.success && response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  /**
   * End impersonation and return to original user
   * @returns Original user's token and details
   */
  async endImpersonation(): Promise<{
    success: boolean;
    token: string;
    user: {
      userId: string;
      username: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      role: string;
      organizations: Array<{ id: string; code: string; role: string }>;
    };
    message: string;
  }> {
    const response = await this.request<{
      success: boolean;
      token: string;
      user: {
        userId: string;
        username: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        role: string;
        organizations: Array<{ id: string; code: string; role: string }>;
      };
      message: string;
    }>('/api/auth/end-impersonation', {
      method: 'POST',
    });

    // Restore original user's token
    if (response.success && response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  /**
   * Check current impersonation status
   * @returns Impersonation status and details
   */
  async getImpersonationStatus(): Promise<{
    isImpersonating: boolean;
    impersonatedBy?: {
      userId: string;
      username: string;
      name: string;
    };
    expiresAt?: string;
    remainingMinutes?: number;
    currentUser?: {
      userId: string;
      username: string;
    };
  }> {
    return this.request<{
      isImpersonating: boolean;
      impersonatedBy?: {
        userId: string;
        username: string;
        name: string;
      };
      expiresAt?: string;
      remainingMinutes?: number;
      currentUser?: {
        userId: string;
        username: string;
      };
    }>('/api/auth/impersonation-status');
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

  async getApiConfigs(organizationId: string): Promise<{ configs: ApiServerConfig[] }> {
    return this.request<{ configs: ApiServerConfig[] }>(`/api/configs?organizationId=${organizationId}`);
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
  }): Promise<{ success: boolean; config: ApiServerConfig }> {
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
  }): Promise<{ success: boolean; config: ApiServerConfig }> {
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
  }): Promise<{ success: boolean; credentials: PemsCredentials }> {
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

  async getPemsConfigs(organizationId: string): Promise<{ configs: ApiServerConfig[] }> {
    return this.request<{ configs: ApiServerConfig[] }>(`/api/pems/configs?organizationId=${organizationId}`);
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

  async getSyncHistory(organizationId: string, limit: number = 10): Promise<{ history: SyncHistoryItem[] }> {
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

  /**
   * Get sync dashboard data with active syncs and recent history
   * Returns empty arrays if the dashboard endpoint is not available
   */
  async getSyncDashboard(): Promise<{
    activeSyncs: Array<{
      syncBatchId: string;
      endpointName: string;
      organizationId: string;
      organizationName: string;
      status: 'queued' | 'ingesting' | 'transforming' | 'completed' | 'failed';
      progress: {
        percentage: number;
        processed: number;
        total: number;
        inserted: number;
        updated: number;
        errors: number;
      };
      timing: {
        startedAt: string;
        completedAt?: string;
        duration: string;
      };
      error?: string;
    }>;
    recentHistory: Array<{
      syncBatchId: string;
      endpointName: string;
      organizationId: string;
      organizationName: string;
      status: 'queued' | 'ingesting' | 'transforming' | 'completed' | 'failed';
      progress: {
        percentage: number;
        processed: number;
        total: number;
        inserted: number;
        updated: number;
        errors: number;
      };
      timing: {
        startedAt: string;
        completedAt?: string;
        duration: string;
      };
      error?: string;
    }>;
  }> {
    try {
      return await this.request('/api/pems/sync-dashboard');
    } catch {
      // Return empty dashboard if endpoint not available
      return { activeSyncs: [], recentHistory: [] };
    }
  }

  // ============================================================================
  // Logs API
  // ============================================================================

  async getAiUsageLogs(organizationId?: string, userId?: string, limit: number = 100): Promise<{ logs: AiUsageLog[] }> {
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

  async getSyncLogs(organizationId?: string, limit: number = 100): Promise<{ logs: SyncLog[] }> {
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

  async getUsers(): Promise<{ users: ApiUser[] }> {
    return this.request<{ users: ApiUser[] }>('/api/users');
  }

  async createUser(userData: {
    username: string;
    email?: string;
    password: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    jobTitle?: string;
    role?: 'admin' | 'user' | 'viewer';
    organizationIds?: string[];
  }): Promise<{ success: boolean; user: ApiUser }> {
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
    avatarUrl?: string;
    jobTitle?: string;
    role?: 'admin' | 'user' | 'viewer';
    isActive?: boolean;
    organizationIds?: string[];
  }): Promise<{ success: boolean; user: ApiUser }> {
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

  async suspendUser(id: string, reason?: string, organizationId?: string): Promise<{ success: boolean; message: string; user: ApiUser }> {
    return this.request(`/api/users/${id}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason, organizationId }),
    });
  }

  async activateUser(id: string, organizationId?: string): Promise<{ success: boolean; message: string; user: ApiUser }> {
    return this.request(`/api/users/${id}/activate`, {
      method: 'POST',
      body: JSON.stringify({ organizationId }),
    });
  }

  // ============================================================================
  // Organization Management
  // ============================================================================

  async getOrganizations(): Promise<{ organizations: ApiOrganization[] }> {
    return this.request<{ organizations: ApiOrganization[] }>('/api/organizations');
  }

  async createOrganization(orgData: {
    code: string;
    name: string;
    description?: string;
    logoUrl?: string;
    features?: Record<string, unknown>;
    aiFeatures?: Record<string, boolean>;
    submitMode?: string;
    headerConfig?: Record<string, unknown>;
    serviceStatus?: string;
    enableSync?: boolean;
  }): Promise<{ success: boolean; organization: ApiOrganization }> {
    return this.request('/api/organizations', {
      method: 'POST',
      body: JSON.stringify(orgData),
    });
  }

  async updateOrganization(id: string, orgData: {
    name?: string;
    description?: string;
    isActive?: boolean;
    logoUrl?: string | null;
    features?: Record<string, unknown>;
    aiFeatures?: Record<string, boolean>;
    aiConnectionId?: string | null;
    aiRules?: string[];
    submitMode?: string;
    headerConfig?: Record<string, unknown>;
    serviceStatus?: string;
    enableSync?: boolean;
  }): Promise<{ success: boolean; organization: ApiOrganization }> {
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

  async suspendOrganization(id: string, reason?: string): Promise<{ success: boolean; message: string; organization: ApiOrganization }> {
    return this.request(`/api/organizations/${id}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async activateOrganization(id: string): Promise<{ success: boolean; message: string; organization: ApiOrganization }> {
    return this.request(`/api/organizations/${id}/activate`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async archiveOrganization(id: string, reason?: string): Promise<{ success: boolean; message: string; organization: ApiOrganization }> {
    return this.request(`/api/organizations/${id}/archive`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async toggleOrganizationSync(id: string, enableSync: boolean): Promise<{ success: boolean; message: string; organization: ApiOrganization }> {
    return this.request(`/api/organizations/${id}/sync`, {
      method: 'PATCH',
      body: JSON.stringify({ enableSync }),
    });
  }

  async unlinkOrganization(id: string, reason?: string): Promise<{ success: boolean; message: string; organization: ApiOrganization }> {
    return this.request(`/api/organizations/${id}/unlink`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // ============================================================================
  // User-Organization Management (Phase 5, Task 5.3)
  // ============================================================================

  async getUserOrganizations(userId: string): Promise<{ userOrganizations: UserOrganization[] }> {
    return this.request(`/api/users/${userId}/organizations`);
  }

  async assignUserToOrganization(
    userId: string,
    organizationId: string,
    role?: string
  ): Promise<{ success: boolean; message: string; userOrganization: UserOrganization }> {
    return this.request(`/api/users/${userId}/organizations`, {
      method: 'POST',
      body: JSON.stringify({ organizationId, role }),
    });
  }

  async updateUserOrgRole(
    userOrgId: string,
    role: string,
    organizationId: string
  ): Promise<{ success: boolean; message: string; userOrganization: UserOrganization }> {
    return this.request(`/api/user-organizations/${userOrgId}/role?organizationId=${organizationId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  async updateUserOrgCapabilities(
    userOrgId: string,
    capabilities: Record<string, boolean>,
    organizationId: string
  ): Promise<{ success: boolean; message: string; userOrganization: UserOrganization }> {
    return this.request(`/api/user-organizations/${userOrgId}/capabilities?organizationId=${organizationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ capabilities }),
    });
  }

  async revokeUserOrganization(
    userOrgId: string,
    organizationId: string,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/user-organizations/${userOrgId}?organizationId=${organizationId}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
  }

  async getRoleTemplate(role: string): Promise<{
    role: string;
    template: Record<string, boolean>;
    availableRoles: string[];
  }> {
    return this.request(`/api/role-templates/${role}`);
  }

  // ============================================================================
  // Audit API (Phase 5, Task 5.4 - Pre-Flight Reviews)
  // ============================================================================

  async logPreFlightReview(data: {
    operationType: string;
    description: string;
    affectedRecordCount: number;
    organizations?: string[];
    categories?: string[];
    changes?: AuditChange[];
    estimatedImpact?: {
      costDelta?: number;
      durationDelta?: number;
      affectedUsers?: number;
    };
    comment: string;
    confirmed: boolean;
    bypassedBy?: string;
    organizationId: string;
  }): Promise<{ success: boolean; message: string; auditLog: AuditLog }> {
    return this.request('/api/audit/pre-flight-review', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPreFlightReviews(params: {
    organizationId?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ reviews: AuditReview[]; pagination: Pagination }> {
    const queryParams = new URLSearchParams();
    if (params.organizationId) queryParams.append('organizationId', params.organizationId);
    if (params.userId) queryParams.append('userId', params.userId);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.offset) queryParams.append('offset', params.offset.toString());

    return this.request(`/api/audit/pre-flight-reviews?${queryParams.toString()}`);
  }

  async getPreFlightStats(params?: {
    organizationId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ stats: AuditStats }> {
    const queryParams = new URLSearchParams();
    if (params?.organizationId) queryParams.append('organizationId', params.organizationId);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);

    return this.request(`/api/audit/pre-flight-stats?${queryParams.toString()}`);
  }

  /**
   * Get audit logs
   * @param params Query parameters for filtering
   * @returns Array of audit logs with pagination
   */
  async getAuditLogs(params: {
    organizationId?: string;
    userId?: string;
    action?: string;
    limit?: number;
    offset?: number;
    orderBy?: string;
  }): Promise<{ logs: AuditLog[]; pagination: Pagination }> {
    const queryParams = new URLSearchParams();
    if (params.organizationId) queryParams.append('organizationId', params.organizationId);
    if (params.userId) queryParams.append('userId', params.userId);
    if (params.action) queryParams.append('action', params.action);
    if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
    if (params.offset !== undefined) queryParams.append('offset', params.offset.toString());
    if (params.orderBy) queryParams.append('orderBy', params.orderBy);

    return this.request(`/api/audit/logs?${queryParams.toString()}`);
  }

  /**
   * Get revert preview for a transaction
   * @param transactionId Transaction ID to preview
   * @param organizationId Organization context
   * @returns Preview of changes that will be reverted
   */
  async getRevertPreview(
    transactionId: string,
    organizationId: string
  ): Promise<{
    changes: Array<{
      recordId: string;
      field: string;
      currentValue: unknown;
      revertValue: unknown;
    }>;
    affectedRecordCount: number;
    estimatedImpact?: {
      costDelta?: number;
      durationDelta?: number;
    };
  }> {
    return this.request(`/api/audit/revert/${transactionId}/preview?organizationId=${organizationId}`);
  }

  /**
   * Revert a transaction (Time Travel)
   * @param transactionId Transaction ID to revert
   * @param data Comment and organization context
   * @returns Revert confirmation with new audit log entry
   */
  async revertTransaction(
    transactionId: string,
    data: {
      comment: string;
      organizationId: string;
    }
  ): Promise<{ success: boolean; message: string; revertLog: RevertLog }> {
    return this.request(`/api/audit/revert/${transactionId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================================================
  // Phase 3: PFA Data API (Mirror + Delta Architecture)
  // ============================================================================

  /**
   * Get merged PFA data (Mirror + Delta architecture)
   * Returns PfaView objects with runtime merge of PfaMirror + PfaModification
   * @param orgId Organization ID
   * @param filters Optional filters for category, class, DOR, source, date ranges, etc.
   * @returns Response with PfaView array, pagination info, and metadata
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
  }): Promise<{ success: boolean; data: PfaView[]; pagination: Pagination; metadata: PfaMetadata }> {
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
   * Save draft modifications (Mirror + Delta architecture)
   * @param orgId Organization ID
   * @param sessionId UUID for grouping related changes
   * @param modifications Array of PFA modifications with delta (only changed fields)
   * @returns SaveDraftResponse with count of saved records
   */
  async saveDraft(orgId: string, sessionId: string, modifications: Array<{
    pfaId: string;
    delta: PfaModificationDelta;
    changeReason?: string;
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
  // Sync Health API
  // ============================================================================

  async getSyncHealthStats(): Promise<{
    totalOrganizations: number;
    activeOrgs: number;
    syncing: number;
    skipped: number;
    suspended: number;
    archived: number;
    syncDisabled: number;
    organizations: Array<{
      id: string;
      code: string;
      name: string;
      serviceStatus: string;
      enableSync: boolean;
      syncEnabled: boolean;
      skipReason?: string;
      lastSyncAt?: string;
      lastSyncStatus?: 'completed' | 'failed' | 'running';
      lastSyncRecordCount?: number;
      lastSyncSkippedCount?: number;
      lastSyncErrorCount?: number;
      skipReasonBreakdown?: Record<string, number>;
    }>;
    lastUpdated: string;
  }> {
    return this.request('/api/sync/health');
  }

  async getSyncSkipReasons(): Promise<{
    summary: Record<string, number>;
    organizations: Array<{
      id: string;
      code: string;
      name: string;
      skipReason: string;
      lastSyncAt?: string;
    }>;
  }> {
    return this.request('/api/sync/health/skip-reasons');
  }

  async getSyncHealthHistory(organizationId: string): Promise<{
    organization: {
      id: string;
      code: string;
      name: string;
    };
    history: Array<{
      syncId: string;
      startedAt: string;
      completedAt: string;
      status: 'completed' | 'failed' | 'running';
      recordCount: number;
      skippedCount: number;
      errorCount: number;
      skipReason?: string;
    }>;
  }> {
    return this.request(`/api/sync/health/${organizationId}/history`);
  }

  // ============================================================================
  // Sync Status API (ADR-007, Phase 5, Task 5.4)
  // ============================================================================

  async getAllActiveSyncs(): Promise<{
    activeSyncs: Array<{
      syncBatchId: string;
      endpointName: string;
      organizationId: string;
      organizationName: string;
      status: 'queued' | 'ingesting' | 'transforming' | 'completed' | 'failed';
      progress: {
        percentage: number;
        processed: number;
        total: number;
        inserted: number;
        updated: number;
        errors: number;
      };
      timing: {
        startedAt: string;
        completedAt?: string;
        duration: string;
      };
      error?: string;
    }>;
    recentHistory: Array<{
      syncBatchId: string;
      endpointName: string;
      organizationId: string;
      organizationName: string;
      status: 'queued' | 'ingesting' | 'transforming' | 'completed' | 'failed';
      progress: {
        percentage: number;
        processed: number;
        total: number;
        inserted: number;
        updated: number;
        errors: number;
      };
      timing: {
        startedAt: string;
        completedAt?: string;
        duration: string;
      };
      error?: string;
    }>;
  }> {
    return this.request('/api/sync/status');
  }

  async cancelSync(syncBatchId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request(`/api/sync/cancel/${syncBatchId}`, {
      method: 'POST'
    });
  }

  async retrySync(syncBatchId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request(`/api/sync/retry/${syncBatchId}`, {
      method: 'POST'
    });
  }

  // ============================================================================
  // Import Wizard (Phase 5, Task 5.6)
  // ============================================================================

  async analyzeImportFile(
    file: File,
    organizationId: string,
    entity?: string
  ): Promise<{
    suggestedMappings: Array<{
      sourceField: string;
      targetField: string;
      confidence: number;
      transformation?: string;
      sampleValues: string[];
    }>;
    dataQualityIssues: Array<{
      severity: 'critical' | 'high' | 'medium' | 'low';
      issue: string;
      affectedRows?: number;
      affectedColumn?: string;
      recommendation: string;
    }>;
    fileInfo: {
      totalRows: number;
      totalColumns: number;
      detectedFormat: string;
    };
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('organizationId', organizationId);
    if (entity) {
      formData.append('entity', entity);
    }

    const token = this.getToken();
    const response = await fetch(`${this.baseUrl}/api/ai/analyze-import-file`, {
      method: 'POST',
      body: formData,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to analyze file' }));
      throw new Error(errorData.message || 'Failed to analyze file');
    }

    return response.json();
  }

  async previewImport(data: {
    file: File;
    mappings: Array<{ sourceField: string; targetField: string; transformation?: string }>;
    organizationId: string;
    entity?: string;
  }): Promise<{
    previewRows?: Array<{
      rowNumber: number;
      data: Record<string, unknown>;
      hasError: boolean;
      errors?: Array<{ field: string; message: string }>;
    }>;
    rows?: Array<Record<string, unknown>>;
    validationErrors?: Array<{
      rowNumber: number;
      field: string;
      message: string;
      severity: 'error' | 'warning';
    }>;
    summary: {
      totalRows: number;
      validRows: number;
      errorRows: number;
      warningRows?: number;
    };
  }> {
    const formData = new FormData();
    formData.append('file', data.file);
    formData.append('mappings', JSON.stringify(data.mappings));
    formData.append('organizationId', data.organizationId);
    if (data.entity) {
      formData.append('entity', data.entity);
    }

    const token = this.getToken();
    const response = await fetch(`${this.baseUrl}/api/admin/preview-import`, {
      method: 'POST',
      body: formData,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to preview import' }));
      throw new Error(errorData.message || 'Failed to preview import');
    }

    return response.json();
  }

  async importData(data: {
    file: File;
    mappings: Array<{ sourceField: string; targetField: string; transformation?: string }>;
    organizationId: string;
    entity?: string;
    validateOnly?: boolean;
  }): Promise<{
    success: boolean;
    importedRows: number;
    skippedRows: number;
    errors?: Array<{ rowNumber: number; message: string }>;
    durationMs?: number;
  }> {
    const formData = new FormData();
    formData.append('file', data.file);
    formData.append('mappings', JSON.stringify(data.mappings));
    formData.append('organizationId', data.organizationId);
    if (data.entity) {
      formData.append('entity', data.entity);
    }
    if (data.validateOnly !== undefined) {
      formData.append('validateOnly', String(data.validateOnly));
    }

    const token = this.getToken();
    const response = await fetch(`${this.baseUrl}/api/admin/import-data`, {
      method: 'POST',
      body: formData,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to import data' }));
      throw new Error(errorData.message || 'Failed to import data');
    }

    return response.json();
  }

  // ============================================================================
  // BEO Glass Mode (Phase 5, Task 5.7)
  // ============================================================================

  async getPortfolioHealth(): Promise<{
    totalOrganizations: number;
    activeOrganizations: number;
    healthScore: number;
    previousHealthScore?: number;
    totalBudget: number;
    totalActual: number;
    totalVariance: number;
    activeUsers: number;
    organizations: Array<{
      id: string;
      code: string;
      name: string;
      healthScore: number;
      previousHealthScore?: number;
      status: string;
      serviceStatus: 'operational' | 'degraded' | 'down';
      budgetTotal: number;
      actualTotal: number;
      variance: number;
      activeUsers: number;
      lastSyncAt?: string;
      syncStatus: 'success' | 'failed' | 'pending' | 'never';
      recordCount: number;
    }>;
    trends: {
      organizations: number;
      healthScore: number;
      variance: number;
      users: number;
    };
  }> {
    return this.request('/api/beo/portfolio-health');
  }

  async getPriorityItems(): Promise<{
    items: Array<{
      id: string;
      organizationId: string;
      organizationCode: string;
      organizationName: string;
      severity: 'critical' | 'high' | 'medium';
      category: 'budget' | 'schedule' | 'data_quality' | 'sync' | 'activity';
      title: string;
      description: string;
      impactValue: string;
      impactLabel: string;
      affectedRecords: number;
      detectedAt: string;
      metadata?: Record<string, any>;
    }>;
    summary: {
      critical: number;
      high: number;
      medium: number;
      total: number;
    };
  }> {
    return this.request('/api/beo/priority-items');
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  async healthCheck(): Promise<{ status: string; timestamp: string; environment: string }> {
    return this.request<{ status: string; timestamp: string; environment: string }>('/health');
  }

  // ============================================================================
  // AI Permission Suggestion (Phase 6, Task 6.1)
  // ============================================================================

  /**
   * Get AI-powered permission suggestions for user-org assignment
   */
  async suggestPermissions(data: {
    userId: string;
    organizationId: string;
    role?: string;
    department?: string;
  }): Promise<{
    id?: string;
    suggestedRole: 'viewer' | 'editor' | 'admin' | 'beo' | 'member';
    suggestedCapabilities: {
      perm_Read: boolean;
      perm_EditForecast: boolean;
      perm_EditActuals: boolean;
      perm_Delete: boolean;
      perm_Import: boolean;
      perm_RefreshData: boolean;
      perm_Export: boolean;
      perm_ViewFinancials: boolean;
      perm_SaveDraft: boolean;
      perm_Sync: boolean;
      perm_ManageUsers: boolean;
      perm_ManageSettings: boolean;
      perm_ConfigureAlerts: boolean;
      perm_Impersonate: boolean;
    };
    confidence: number;
    reasoning: string;
    basedOnUsers: number;
    securityWarnings: Array<{
      capability: string;
      risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      message: string;
    }>;
  }> {
    return this.request('/api/ai/suggest-permissions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Record AI suggestion acceptance/rejection for training
   */
  async acceptSuggestion(data: {
    suggestionId: string;
    accepted: boolean;
    actualPermissions?: Record<string, boolean>;
  }): Promise<{ success: boolean }> {
    return this.request('/api/ai/accept-suggestion', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get AI suggestion quality statistics
   */
  async getSuggestionStats(organizationId?: string): Promise<{
    totalSuggestions: number;
    acceptedCount: number;
    acceptanceRate: number;
    averageConfidence: number;
    byRole: Record<string, { total: number; accepted: number }>;
  }> {
    const params = new URLSearchParams();
    if (organizationId) params.append('organizationId', organizationId);
    return this.request(`/api/ai/suggestion-stats?${params.toString()}`);
  }

  /**
   * Get AI-suggested predefined role templates with capabilities
   */
  async getAiRoleTemplates(): Promise<{
    templates: Record<string, {
      name: string;
      description: string;
      capabilities: Record<string, boolean>;
    }>;
  }> {
    return this.request('/api/ai/role-templates');
  }

  // ============================================================================
  // AI Security Anomaly Detection (Phase 6, Task 6.2)
  // ============================================================================

  /**
   * Get security anomalies for organization
   */
  async getSecurityAnomalies(params?: {
    organizationId?: string;
    userId?: string;
    alertType?: string;
    risk?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    limit?: number;
    offset?: number;
  }): Promise<{
    anomalies: Array<{
      id: string;
      alertType: string;
      userId: string;
      organizationId?: string;
      risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      anomaly: string;
      details: Record<string, any>;
      reasoning: string;
      suggestedAction: string;
      confidence: number;
      detectedAt: string;
      acknowledged: boolean;
      acknowledgedBy?: string;
      acknowledgedAt?: string;
    }>;
    pagination: {
      total: number;
      limit: number;
      offset: number;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.organizationId) queryParams.append('organizationId', params.organizationId);
    if (params?.userId) queryParams.append('userId', params.userId);
    if (params?.alertType) queryParams.append('alertType', params.alertType);
    if (params?.risk) queryParams.append('risk', params.risk);
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
    if (params?.offset !== undefined) queryParams.append('offset', params.offset.toString());
    return this.request(`/api/ai/anomalies?${queryParams.toString()}`);
  }

  /**
   * Acknowledge a security anomaly
   */
  async acknowledgeAnomaly(anomalyId: string, data: {
    action: 'dismiss' | 'investigate' | 'resolve';
    comment?: string;
  }): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/ai/anomalies/${anomalyId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================================================
  // AI Financial Access Monitoring (Phase 6, Task 6.3)
  // ============================================================================

  /**
   * Get financial access report
   */
  async getFinancialAccessReport(params?: {
    organizationId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    summary: {
      totalAccesses: number;
      uniqueUsers: number;
      exportCount: number;
      anomalyCount: number;
    };
    userAccess: Array<{
      userId: string;
      username: string;
      accessCount: number;
      lastAccess: string;
      hasExported: boolean;
    }>;
    recentActivity: Array<{
      userId: string;
      username: string;
      action: string;
      timestamp: string;
      recordCount?: number;
    }>;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.organizationId) queryParams.append('organizationId', params.organizationId);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    return this.request(`/api/ai/financial-access?${queryParams.toString()}`);
  }

  /**
   * Get financial access alerts
   */
  async getFinancialAccessAlerts(params?: {
    organizationId?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    limit?: number;
  }): Promise<{
    alerts: Array<{
      id: string;
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      userId: string;
      username: string;
      detectedAt: string;
      details: Record<string, any>;
    }>;
    summary: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.organizationId) queryParams.append('organizationId', params.organizationId);
    if (params?.severity) queryParams.append('severity', params.severity);
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
    return this.request(`/api/ai/financial-access/alerts?${queryParams.toString()}`);
  }

  // ============================================================================
  // Permission Explanation (Phase 7, Task 7.1)
  // ============================================================================

  /**
   * Explain why a user is denied permission for a specific action
   * AI-powered explanation with cache support
   */
  async explainPermissionDenial(data: {
    userId: string;
    organizationId: string;
    action: string;
  }): Promise<{
    allowed: boolean;
    explanation: {
      summary: string;
      reasons: string[];
      resolveActions: Array<{
        action: string;
        contact: string;
        eta: string;
      }>;
      confidence: number;
      permissionChain: Array<{
        check: string;
        result: boolean;
        reason: string;
      }>;
      cached?: boolean;
      generationTimeMs?: number;
    } | null;
  }> {
    return this.request('/api/permissions/explain', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Batch explain multiple permission denials
   * Useful for pre-loading explanations for multiple buttons
   */
  async explainBatchPermissions(data: {
    userId: string;
    organizationId: string;
    actions: string[];
  }): Promise<{
    results: Record<string, {
      allowed: boolean;
      explanation: PermissionExplanation;
    }>;
  }> {
    return this.request('/api/permissions/explain/batch', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get permission explanation cache statistics (admin only)
   */
  async getPermissionCacheStats(): Promise<{
    success: boolean;
    cache: {
      size: number;
      hitRate: number;
      avgGenerationTimeMs: number;
    };
  }> {
    return this.request('/api/permissions/explain/cache-stats');
  }

  /**
   * Clear permission explanation cache (admin only)
   */
  async clearPermissionCache(): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request('/api/permissions/explain/cache/clear', {
      method: 'POST',
    });
  }

  // ============================================================================
  // Role Template Management (ADR-005)
  // ============================================================================

  async getRoleTemplates(): Promise<{ templates: ApiRoleTemplate[] }> {
    return this.request('/api/role-templates');
  }

  async createRoleTemplate(template: {
    name: string;
    description?: string;
    permissions: Record<string, boolean>;
    capabilities: Record<string, boolean>;
  }): Promise<{ success: boolean; template: ApiRoleTemplate }> {
    return this.request('/api/role-templates', {
      method: 'POST',
      body: JSON.stringify(template),
    });
  }

  async updateRoleTemplate(id: string, updates: {
    name?: string;
    description?: string;
    permissions?: Record<string, boolean>;
    capabilities?: Record<string, boolean>;
    applyToUsers?: boolean;
  }): Promise<{ success: boolean; template: ApiRoleTemplate }> {
    return this.request(`/api/role-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteRoleTemplate(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/role-templates/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Personal Access Tokens (ADR-005)
  // ============================================================================

  async getPersonalAccessTokens(userId?: string): Promise<{ tokens: ApiPersonalAccessToken[] }> {
    const endpoint = userId ? `/api/pats?userId=${userId}` : '/api/pats';
    return this.request(endpoint);
  }

  async createPersonalAccessToken(data: {
    name: string;
    scopes: string[];
    expiresAt?: string;
  }): Promise<{ success: boolean; token: string; pat: ApiPersonalAccessToken }> {
    return this.request('/api/pats', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async revokePersonalAccessToken(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/pats/${id}/revoke`, {
      method: 'POST',
    });
  }

  async deletePersonalAccessToken(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/pats/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Session Management (ADR-005)
  // ============================================================================

  async getUserSessions(userId: string): Promise<{ sessions: UserSession[] }> {
    return this.request(`/api/sessions?userId=${userId}`);
  }

  async revokeSession(sessionId: string): Promise<{ success: boolean }> {
    return this.request(`/api/sessions/${sessionId}/revoke`, {
      method: 'POST',
    });
  }

  async revokeAllSessions(userId: string, exceptCurrent?: boolean): Promise<{ success: boolean; revokedCount: number }> {
    return this.request(`/api/sessions/revoke-all`, {
      method: 'POST',
      body: JSON.stringify({ userId, exceptCurrent }),
    });
  }

  // ============================================================================
  // Webhook Configuration (ADR-005)
  // ============================================================================

  async getWebhooks(organizationId: string): Promise<{ webhooks: Webhook[] }> {
    return this.request(`/api/webhooks?organizationId=${organizationId}`);
  }

  async createWebhook(data: {
    organizationId: string;
    type: 'slack' | 'teams' | 'custom';
    webhookUrl: string;
    channelName?: string;
    events: string[];
  }): Promise<{ success: boolean; webhook: Webhook }> {
    return this.request('/api/webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWebhook(id: string, data: {
    webhookUrl?: string;
    channelName?: string;
    events?: string[];
    isActive?: boolean;
  }): Promise<{ success: boolean; webhook: Webhook }> {
    return this.request(`/api/webhooks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async testWebhook(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/webhooks/${id}/test`, {
      method: 'POST',
    });
  }

  async deleteWebhook(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/webhooks/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // System Dictionary (ADR-005)
  // ============================================================================

  async getDictionaryCategories(): Promise<{ categories: string[] }> {
    return this.request('/api/dictionary/categories');
  }

  async getDictionaryEntries(category: string): Promise<{ entries: DictionaryEntry[] }> {
    return this.request(`/api/dictionary/entries?category=${category}`);
  }

  async createDictionaryEntry(data: {
    category: string;
    value: string;
    label: string;
    order: number;
    metadata?: Record<string, unknown>;
  }): Promise<{ success: boolean; entry: DictionaryEntry }> {
    return this.request('/api/dictionary/entries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDictionaryEntry(id: string, data: {
    value?: string;
    label?: string;
    order?: number;
    isActive?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<{ success: boolean; entry: DictionaryEntry }> {
    return this.request(`/api/dictionary/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async reorderDictionaryEntries(category: string, orderedIds: string[]): Promise<{ success: boolean }> {
    return this.request('/api/dictionary/entries/reorder', {
      method: 'POST',
      body: JSON.stringify({ category, orderedIds }),
    });
  }

  async deleteDictionaryEntry(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/dictionary/entries/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Trash Can (Soft Delete Recovery) (ADR-005)
  // ============================================================================

  async getTrashItems(entityType?: string): Promise<{ items: ApiTrashItem[] }> {
    const endpoint = entityType ? `/api/trash?entityType=${entityType}` : '/api/trash';
    return this.request(endpoint);
  }

  async restoreTrashItem(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/trash/${id}/restore`, {
      method: 'POST',
    });
  }

  async purgeTrashItem(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/trash/${id}/purge`, {
      method: 'DELETE',
    });
  }

  async emptyTrash(entityType?: string, olderThan?: string): Promise<{ success: boolean; purgedCount: number }> {
    return this.request('/api/trash/empty', {
      method: 'POST',
      body: JSON.stringify({ entityType, olderThan }),
    });
  }

  // ============================================================================
  // Asset Master Data
  // ============================================================================

  /**
   * Get asset master records for an organization
   * @param orgId Organization code (e.g., "BECH", "CCL3")
   * @param filters Optional filters for status, category, manufacturer, search
   */
  async getAssetMaster(orgId: string, filters?: {
    page?: number;
    pageSize?: number;
    status?: string;
    category?: string;
    manufacturer?: string;
    search?: string;
  }): Promise<{ success: boolean; data: AssetMasterRecord[]; pagination: Pagination }> {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.page) params.append('page', String(filters.page));
      if (filters.pageSize) params.append('pageSize', String(filters.pageSize));
      if (filters.status) params.append('status', filters.status);
      if (filters.category) params.append('category', filters.category);
      if (filters.manufacturer) params.append('manufacturer', filters.manufacturer);
      if (filters.search) params.append('search', filters.search);
    }
    const queryString = params.toString();
    return this.request(`/api/assets/${orgId}${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get all asset master records (admin/cross-org view)
   */
  async getAllAssets(filters?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }): Promise<{ success: boolean; data: AssetMasterRecord[]; pagination: Pagination }> {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.page) params.append('page', String(filters.page));
      if (filters.pageSize) params.append('pageSize', String(filters.pageSize));
      if (filters.search) params.append('search', filters.search);
    }
    const queryString = params.toString();
    return this.request(`/api/assets/all${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get a single asset by code
   */
  async getAssetByCode(orgId: string, assetCode: string): Promise<{ success: boolean; data: AssetMasterRecord }> {
    return this.request(`/api/assets/${orgId}/${encodeURIComponent(assetCode)}`);
  }

  /**
   * Get asset statistics for an organization
   */
  async getAssetStats(orgId: string): Promise<{
    success: boolean;
    data: {
      total: number;
      byStatus: Array<{ status: string; count: number }>;
      bySource: Array<{ source: string; count: number }>;
      topManufacturers: Array<{ manufacturer: string; count: number }>;
    };
  }> {
    return this.request(`/api/assets/${orgId}/stats`);
  }

  // ============================================================================
  // Master Data Methods
  // ============================================================================

  /**
   * Get all master data in a single request (for initial load)
   */
  async getAllMasterData(organizationId?: string): Promise<{
    success: boolean;
    data: {
      manufacturers: Array<{ id: string; code: string; description: string | null }>;
      models: Array<{ id: string; manufacturer: string; model: string; description: string | null }>;
      dors: Array<{ id: string; code: string; description: string | null }>;
      sources: Array<{ id: string; code: string; description: string | null; type: string | null }>;
      classifications: Array<{
        id: string;
        classCode: string;
        classDescription: string | null;
        categoryCode: string;
        categoryDescription: string | null;
      }>;
      areaSilos: Array<{
        id: string;
        organizationId: string;
        areaSilo: string;
        description: string | null;
      }>;
    };
  }> {
    const params = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';
    return this.request(`/api/master-data/all${params}`);
  }

  /**
   * Get all manufacturers
   */
  async getManufacturers(): Promise<{
    success: boolean;
    data: Array<{ id: string; code: string; description: string | null }>;
    count: number;
  }> {
    return this.request('/api/master-data/manufacturers');
  }

  /**
   * Get models, optionally filtered by manufacturer
   */
  async getModels(manufacturer?: string): Promise<{
    success: boolean;
    data: Array<{ id: string; manufacturer: string; model: string; description: string | null }>;
    count: number;
  }> {
    const params = manufacturer ? `?manufacturer=${encodeURIComponent(manufacturer)}` : '';
    return this.request(`/api/master-data/models${params}`);
  }

  /**
   * Get all DORs
   */
  async getDors(): Promise<{
    success: boolean;
    data: Array<{ id: string; code: string; description: string | null }>;
    count: number;
  }> {
    return this.request('/api/master-data/dors');
  }

  /**
   * Get all sources
   */
  async getSources(): Promise<{
    success: boolean;
    data: Array<{ id: string; code: string; description: string | null; type: string | null }>;
    count: number;
  }> {
    return this.request('/api/master-data/sources');
  }

  // ============================================================================
  // Master Data CRUD Operations (DOR, Source)
  // ============================================================================

  /**
   * Create a new DOR
   */
  async createDor(data: { code: string; description?: string }): Promise<{
    success: boolean;
    dor: { id: string; code: string; description: string | null; isActive: boolean };
  }> {
    return this.request('/api/master-data/dors', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update an existing DOR
   */
  async updateDor(
    id: string,
    data: { code?: string; description?: string; isActive?: boolean }
  ): Promise<{
    success: boolean;
    dor: { id: string; code: string; description: string | null; isActive: boolean };
  }> {
    return this.request(`/api/master-data/dors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a DOR (soft delete via isActive=false)
   */
  async deleteDor(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/master-data/dors/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Create a new Source
   */
  async createSource(data: {
    code: string;
    description?: string;
    type?: 'Capex' | 'Opex';
  }): Promise<{
    success: boolean;
    source: { id: string; code: string; description: string | null; type: string | null; isActive: boolean };
  }> {
    return this.request('/api/master-data/sources', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update an existing Source
   */
  async updateSource(
    id: string,
    data: { code?: string; description?: string; type?: 'Capex' | 'Opex'; isActive?: boolean }
  ): Promise<{
    success: boolean;
    source: { id: string; code: string; description: string | null; type: string | null; isActive: boolean };
  }> {
    return this.request(`/api/master-data/sources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a Source (soft delete via isActive=false)
   */
  async deleteSource(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/master-data/sources/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get all class/category classifications
   */
  async getClassifications(classCode?: string): Promise<{
    success: boolean;
    data: Array<{
      id: string;
      classCode: string;
      classDescription: string | null;
      categoryCode: string;
      categoryDescription: string | null;
    }>;
    count: number;
  }> {
    const params = classCode ? `?classCode=${encodeURIComponent(classCode)}` : '';
    return this.request(`/api/master-data/classifications${params}`);
  }

  /**
   * Get distinct classes (for class dropdown)
   */
  async getClasses(): Promise<{
    success: boolean;
    data: Array<{ classCode: string; classDescription: string | null }>;
    count: number;
  }> {
    return this.request('/api/master-data/classes');
  }

  /**
   * Get categories, optionally filtered by class
   */
  async getCategories(classCode?: string): Promise<{
    success: boolean;
    data: Array<{ categoryCode: string; categoryDescription: string | null; classCode: string }>;
    count: number;
  }> {
    const params = classCode ? `?classCode=${encodeURIComponent(classCode)}` : '';
    return this.request(`/api/master-data/categories${params}`);
  }

  /**
   * Get area silos (organization-specific)
   */
  async getAreaSilos(organizationId?: string): Promise<{
    success: boolean;
    data: Array<{
      id: string;
      organizationId: string;
      areaSilo: string;
      description: string | null;
      isActive: boolean;
      organization?: { code: string; name: string };
    }>;
    count: number;
  }> {
    const params = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';
    return this.request(`/api/master-data/area-silos${params}`);
  }

  // ============================================================================
  // Field Mapping API (PEMS -> PFA transformations)
  // ============================================================================

  /**
   * Get field mappings for an endpoint
   */
  async getFieldMappings(endpointId: string): Promise<{
    success: boolean;
    mappings: Array<{
      id: string;
      endpointId: string;
      sourceField: string;
      destinationField: string;
      dataType: string;
      transformType: string | null;
      transformParams: Record<string, unknown> | null;
      defaultValue: string | null;
      isActive: boolean;
      validFrom: string;
      validTo: string | null;
      createdBy: string;
      updatedAt: string;
    }>;
    count: number;
  }> {
    return this.request(`/api/field-mappings/endpoint/${endpointId}`);
  }

  /**
   * Get default field mappings (for new endpoints)
   */
  async getDefaultFieldMappings(): Promise<{
    success: boolean;
    mappings: Array<{
      sourceField: string;
      destinationField: string;
      dataType: string;
      transformType: string;
      defaultValue: string | null;
      description: string;
    }>;
  }> {
    return this.request('/api/field-mappings/defaults');
  }

  /**
   * Initialize default field mappings for an endpoint
   */
  async initializeFieldMappings(endpointId: string): Promise<{
    success: boolean;
    created: number;
    message: string;
  }> {
    return this.request(`/api/field-mappings/endpoint/${endpointId}/initialize`, {
      method: 'POST',
    });
  }

  /**
   * Create a new field mapping
   */
  async createFieldMapping(data: {
    endpointId: string;
    sourceField: string;
    destinationField: string;
    dataType?: string;
    transformType?: string;
    transformParams?: Record<string, unknown>;
    defaultValue?: string | null;
  }): Promise<{
    success: boolean;
    mapping: {
      id: string;
      endpointId: string;
      sourceField: string;
      destinationField: string;
      dataType: string;
      transformType: string | null;
      transformParams: Record<string, unknown> | null;
      defaultValue: string | null;
      isActive: boolean;
    };
  }> {
    return this.request('/api/field-mappings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update a field mapping
   */
  async updateFieldMapping(
    id: string,
    data: {
      sourceField?: string;
      destinationField?: string;
      dataType?: string;
      transformType?: string;
      transformParams?: Record<string, unknown>;
      defaultValue?: string | null;
      isActive?: boolean;
    }
  ): Promise<{
    success: boolean;
    mapping: {
      id: string;
      endpointId: string;
      sourceField: string;
      destinationField: string;
      dataType: string;
      transformType: string | null;
      transformParams: Record<string, unknown> | null;
      defaultValue: string | null;
      isActive: boolean;
    };
  }> {
    return this.request(`/api/field-mappings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a field mapping
   */
  async deleteFieldMapping(id: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request(`/api/field-mappings/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Bulk save field mappings for an endpoint
   */
  async bulkSaveFieldMappings(
    endpointId: string,
    mappings: Array<{
      id?: string;
      sourceField: string;
      destinationField: string;
      dataType?: string;
      transformType?: string;
      transformParams?: Record<string, unknown>;
      defaultValue?: string | null;
      isActive?: boolean;
    }>
  ): Promise<{
    success: boolean;
    created: number;
    updated: number;
    total: number;
  }> {
    return this.request('/api/field-mappings/bulk', {
      method: 'POST',
      body: JSON.stringify({ endpointId, mappings }),
    });
  }

  // ============================================================================
  // Generic HTTP Methods (for dynamic endpoints)
  // ============================================================================

  /**
   * Generic POST request
   * @param endpoint API endpoint path
   * @param body Request body data
   */
  async post<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Generic GET request
   * @param endpoint API endpoint path
   * @param params Query parameters
   */
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request<T>(`${endpoint}${queryString}`);
  }

  /**
   * Generic PUT request
   * @param endpoint API endpoint path
   * @param body Request body data
   */
  async put<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  /**
   * Generic DELETE request
   * @param endpoint API endpoint path
   */
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for testing
export default ApiClient;
