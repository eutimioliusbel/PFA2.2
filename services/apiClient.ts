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
      if (error instanceof Error) {
        throw error;
      }
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
  // PEMS API Management
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

  async syncPemsData(organizationId: string, syncType: 'full' | 'incremental' = 'full'): Promise<{
    success: boolean;
    syncId: string;
    message: string;
    status: string;
  }> {
    return this.request('/api/pems/sync', {
      method: 'POST',
      body: JSON.stringify({ organizationId, syncType })
    });
  }

  async getSyncStatus(syncId: string): Promise<{
    syncId: string;
    status: string;
    syncType: string;
    recordsProcessed: number;
    recordsInserted: number;
    recordsUpdated: number;
    recordsDeleted: number;
    durationMs: number | null;
    errorMessage: string | null;
    createdAt: string;
  }> {
    return this.request(`/api/pems/sync/${syncId}`);
  }

  async getSyncHistory(organizationId: string, limit: number = 10): Promise<{ history: any[] }> {
    return this.request(`/api/pems/history?organizationId=${organizationId}&limit=${limit}`);
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
