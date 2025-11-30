// backend/src/services/ai/AICircuitBreaker.ts
/**
 * AI Circuit Breaker & Fallback Service
 *
 * Phase 9, Task 9.4 of ADR-005 Multi-Tenant Access Control
 * Provides resilience and fault tolerance for AI services
 *
 * Features:
 * - Circuit breaker pattern (closed/open/half-open states)
 * - Provider failover (Gemini -> OpenAI -> Claude -> fallback)
 * - Graceful degradation with rule-based fallbacks
 * - Retry with exponential backoff
 * - Health monitoring and auto-recovery
 * - 99.9% uptime target
 */

import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export type AiProvider = 'gemini' | 'openai' | 'claude' | 'fallback';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes to close from half-open
  timeout: number; // Milliseconds before trying half-open
  monitoringWindow: number; // Milliseconds to track failures
}

export interface ProviderHealth {
  provider: AiProvider;
  state: CircuitState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  totalRequests: number;
  totalFailures: number;
  averageLatency: number;
  lastError?: string;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  exponentialBase: number;
}

export interface FallbackResponse<T> {
  data: T;
  source: 'ai' | 'fallback';
  provider?: AiProvider;
  degraded: boolean;
  latencyMs: number;
  retries: number;
}

// ============================================================================
// Default Configurations
// ============================================================================

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000, // 30 seconds
  monitoringWindow: 60000, // 1 minute
};

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  exponentialBase: 2,
};

// Provider priority order for failover
const PROVIDER_PRIORITY: AiProvider[] = ['gemini', 'openai', 'claude', 'fallback'];

// ============================================================================
// AICircuitBreaker Class
// ============================================================================

export class AICircuitBreaker extends EventEmitter {
  private circuitConfig: CircuitBreakerConfig;
  private retryConfig: RetryConfig;
  private providerHealth: Map<AiProvider, ProviderHealth> = new Map();
  private openCircuitTimers: Map<AiProvider, NodeJS.Timeout> = new Map();
  private recentFailures: Map<AiProvider, number[]> = new Map();

  constructor(
    circuitConfig?: Partial<CircuitBreakerConfig>,
    retryConfig?: Partial<RetryConfig>
  ) {
    super();

    this.circuitConfig = { ...DEFAULT_CIRCUIT_CONFIG, ...circuitConfig };
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };

    // Initialize provider health
    for (const provider of PROVIDER_PRIORITY) {
      if (provider !== 'fallback') {
        this.initializeProviderHealth(provider);
      }
    }

    logger.info('AI Circuit Breaker initialized', {
      failureThreshold: this.circuitConfig.failureThreshold,
      timeout: this.circuitConfig.timeout,
    });
  }

  /**
   * Execute an AI operation with circuit breaker protection
   */
  async execute<T>(
    useCase: string,
    operation: (provider: AiProvider) => Promise<T>,
    fallback: () => T
  ): Promise<FallbackResponse<T>> {
    const startTime = Date.now();
    let retries = 0;

    // Try each provider in priority order
    for (const provider of PROVIDER_PRIORITY) {
      if (provider === 'fallback') {
        // Use fallback if all providers failed
        return {
          data: fallback(),
          source: 'fallback',
          degraded: true,
          latencyMs: Date.now() - startTime,
          retries,
        };
      }

      const health = this.providerHealth.get(provider);
      if (!health) continue;

      // Skip if circuit is open
      if (health.state === 'OPEN') {
        logger.debug(`Circuit OPEN for ${provider}, skipping`);
        continue;
      }

      // Try this provider with retries
      try {
        const result = await this.executeWithRetry(provider, operation);

        // Success - record and return
        this.recordSuccess(provider, Date.now() - startTime);

        return {
          data: result,
          source: 'ai',
          provider,
          degraded: health.state === 'HALF_OPEN',
          latencyMs: Date.now() - startTime,
          retries,
        };
      } catch (error: unknown) {
        retries++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.recordFailure(provider, errorMessage);

        // If this provider is now open, try next provider
        if (this.providerHealth.get(provider)?.state === 'OPEN') {
          logger.warn(`Provider ${provider} circuit opened, trying next provider`);
          continue;
        }
      }
    }

    // All providers failed, use fallback
    logger.warn(`All AI providers failed for ${useCase}, using fallback`);

    return {
      data: fallback(),
      source: 'fallback',
      degraded: true,
      latencyMs: Date.now() - startTime,
      retries,
    };
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry<T>(
    provider: AiProvider,
    operation: (provider: AiProvider) => Promise<T>
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation(provider);
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          throw lastError;
        }

        if (attempt < this.retryConfig.maxRetries) {
          const delay = this.calculateBackoff(attempt);
          logger.debug(`Retry ${attempt + 1} for ${provider} after ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Unknown error');
  }

  /**
   * Record a successful operation
   */
  recordSuccess(provider: AiProvider, latencyMs: number): void {
    const health = this.providerHealth.get(provider);
    if (!health) return;

    health.consecutiveFailures = 0;
    health.consecutiveSuccesses++;
    health.lastSuccess = new Date();
    health.totalRequests++;

    // Update average latency (exponential moving average)
    health.averageLatency = health.averageLatency * 0.9 + latencyMs * 0.1;

    // Check if we should close circuit from half-open
    if (health.state === 'HALF_OPEN') {
      if (health.consecutiveSuccesses >= this.circuitConfig.successThreshold) {
        this.closeCircuit(provider);
      }
    }
  }

  /**
   * Record a failed operation
   */
  recordFailure(provider: AiProvider, errorMessage?: string): void {
    const health = this.providerHealth.get(provider);
    if (!health) return;

    const now = Date.now();

    health.consecutiveFailures++;
    health.consecutiveSuccesses = 0;
    health.lastFailure = new Date();
    health.totalRequests++;
    health.totalFailures++;
    health.lastError = errorMessage;

    // Track recent failures for monitoring window
    const recentFailures = this.recentFailures.get(provider) || [];
    recentFailures.push(now);

    // Remove failures outside monitoring window
    const cutoff = now - this.circuitConfig.monitoringWindow;
    const activeFailures = recentFailures.filter(t => t > cutoff);
    this.recentFailures.set(provider, activeFailures);

    // Check if we should open the circuit
    if (health.state === 'CLOSED' || health.state === 'HALF_OPEN') {
      if (activeFailures.length >= this.circuitConfig.failureThreshold) {
        this.openCircuit(provider);
      }
    }
  }

  /**
   * Get provider health status
   */
  getProviderHealth(provider: AiProvider): ProviderHealth | undefined {
    return this.providerHealth.get(provider);
  }

  /**
   * Get all provider health statuses
   */
  getAllProviderHealth(): ProviderHealth[] {
    return Array.from(this.providerHealth.values());
  }

  /**
   * Manually open a circuit (for testing or emergency)
   */
  manuallyOpenCircuit(provider: AiProvider): void {
    this.openCircuit(provider);
    logger.warn(`Manually opened circuit for ${provider}`);
  }

  /**
   * Manually close a circuit (for testing or recovery)
   */
  manuallyCloseCircuit(provider: AiProvider): void {
    this.closeCircuit(provider);
    logger.info(`Manually closed circuit for ${provider}`);
  }

  /**
   * Reset provider health
   */
  resetProviderHealth(provider: AiProvider): void {
    this.initializeProviderHealth(provider);

    // Clear any open circuit timer
    const timer = this.openCircuitTimers.get(provider);
    if (timer) {
      clearTimeout(timer);
      this.openCircuitTimers.delete(provider);
    }

    this.recentFailures.delete(provider);

    logger.info(`Reset health for ${provider}`);
  }

  /**
   * Get overall system health
   */
  getSystemHealth(): {
    status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
    healthyProviders: number;
    totalProviders: number;
    message: string;
  } {
    const providers = Array.from(this.providerHealth.values());
    const healthyCount = providers.filter(p => p.state === 'CLOSED').length;
    const totalCount = providers.length;

    let status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
    let message: string;

    if (healthyCount === totalCount) {
      status = 'HEALTHY';
      message = 'All AI providers operational';
    } else if (healthyCount > 0) {
      status = 'DEGRADED';
      const unhealthy = providers
        .filter(p => p.state !== 'CLOSED')
        .map(p => p.provider);
      message = `Degraded: ${unhealthy.join(', ')} circuits open`;
    } else {
      status = 'CRITICAL';
      message = 'All AI providers unavailable, using fallback mode';
    }

    return {
      status,
      healthyProviders: healthyCount,
      totalProviders: totalCount,
      message,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private initializeProviderHealth(provider: AiProvider): void {
    this.providerHealth.set(provider, {
      provider,
      state: 'CLOSED',
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastFailure: null,
      lastSuccess: null,
      totalRequests: 0,
      totalFailures: 0,
      averageLatency: 0,
    });
  }

  private openCircuit(provider: AiProvider): void {
    const health = this.providerHealth.get(provider);
    if (!health || health.state === 'OPEN') return;

    health.state = 'OPEN';

    // Clear any existing timer
    const existingTimer = this.openCircuitTimers.get(provider);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set timer to try half-open
    const timer = setTimeout(() => {
      this.halfOpenCircuit(provider);
    }, this.circuitConfig.timeout);

    this.openCircuitTimers.set(provider, timer);

    this.emit('circuit-open', { provider, health });
    logger.warn(`Circuit OPENED for ${provider}`, {
      consecutiveFailures: health.consecutiveFailures,
      lastError: health.lastError,
    });
  }

  private halfOpenCircuit(provider: AiProvider): void {
    const health = this.providerHealth.get(provider);
    if (!health || health.state !== 'OPEN') return;

    health.state = 'HALF_OPEN';
    health.consecutiveSuccesses = 0;

    this.emit('circuit-half-open', { provider, health });
    logger.info(`Circuit HALF-OPEN for ${provider}, testing recovery`);
  }

  private closeCircuit(provider: AiProvider): void {
    const health = this.providerHealth.get(provider);
    if (!health || health.state === 'CLOSED') return;

    health.state = 'CLOSED';
    health.consecutiveFailures = 0;

    // Clear timer if exists
    const timer = this.openCircuitTimers.get(provider);
    if (timer) {
      clearTimeout(timer);
      this.openCircuitTimers.delete(provider);
    }

    // Clear recent failures
    this.recentFailures.delete(provider);

    this.emit('circuit-close', { provider, health });
    logger.info(`Circuit CLOSED for ${provider}, provider recovered`);
  }

  private isNonRetryableError(error: any): boolean {
    // Don't retry on authentication errors
    if (error.status === 401 || error.status === 403) return true;

    // Don't retry on bad request
    if (error.status === 400) return true;

    // Don't retry on content policy violations
    if (error.message?.includes('content policy')) return true;

    return false;
  }

  private calculateBackoff(attempt: number): number {
    const delay = this.retryConfig.initialDelayMs *
      Math.pow(this.retryConfig.exponentialBase, attempt);

    // Add jitter (10% random variation)
    const jitter = delay * 0.1 * Math.random();

    return Math.min(delay + jitter, this.retryConfig.maxDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const aiCircuitBreaker = new AICircuitBreaker();

export default aiCircuitBreaker;
