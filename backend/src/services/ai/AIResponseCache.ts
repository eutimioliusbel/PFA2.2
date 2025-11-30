// backend/src/services/ai/AIResponseCache.ts
/**
 * AI Response Cache Service
 *
 * Phase 9, Task 9.3 of ADR-005 Multi-Tenant Access Control
 * Intelligent caching for AI responses
 *
 * Features:
 * - Multi-tier caching (memory + Redis planned)
 * - Semantic key generation based on prompt content
 * - TTL management per use case
 * - Cache invalidation strategies
 * - Cache hit/miss statistics
 * - 50%+ cost reduction target via caching
 */

import { createHash } from 'crypto';
import { logger } from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface CacheEntry<T = any> {
  value: T;
  createdAt: number;
  expiresAt: number;
  useCase: string;
  hits: number;
  promptHash: string;
  modelUsed: string;
  tokensSaved?: number;
  costSaved?: number;
}

export interface CacheConfig {
  useCase: string;
  ttlMs: number;
  maxEntries: number;
  enabled: boolean;
  semanticMatching: boolean; // Use semantic similarity for cache keys
}

export interface CacheStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  totalTokensSaved: number;
  totalCostSaved: number;
  entriesCount: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
  byUseCase: Record<string, {
    hits: number;
    misses: number;
    hitRate: number;
    entries: number;
  }>;
}

// ============================================================================
// Default Cache Configurations
// ============================================================================

const DEFAULT_CACHE_CONFIGS: Record<string, CacheConfig> = {
  // Permission explanations are stable for same user/org/action
  'permission-explanation': {
    useCase: 'permission-explanation',
    ttlMs: 15 * 60 * 1000, // 15 minutes
    maxEntries: 1000,
    enabled: true,
    semanticMatching: false,
  },

  // Financial masking percentiles change infrequently
  'financial-masking': {
    useCase: 'financial-masking',
    ttlMs: 5 * 60 * 1000, // 5 minutes
    maxEntries: 500,
    enabled: true,
    semanticMatching: false,
  },

  // Semantic search queries can be cached if exact match
  'semantic-audit-search': {
    useCase: 'semantic-audit-search',
    ttlMs: 10 * 60 * 1000, // 10 minutes
    maxEntries: 200,
    enabled: true,
    semanticMatching: true,
  },

  // Role drift is analyzed periodically (longer cache)
  'role-drift-detection': {
    useCase: 'role-drift-detection',
    ttlMs: 60 * 60 * 1000, // 1 hour
    maxEntries: 100,
    enabled: true,
    semanticMatching: false,
  },

  // Notification routing profiles are stable
  'notification-routing': {
    useCase: 'notification-routing',
    ttlMs: 30 * 60 * 1000, // 30 minutes
    maxEntries: 500,
    enabled: true,
    semanticMatching: false,
  },

  // BEO analytics (executive queries)
  'beo-analytics': {
    useCase: 'beo-analytics',
    ttlMs: 5 * 60 * 1000, // 5 minutes (data freshness important)
    maxEntries: 100,
    enabled: true,
    semanticMatching: true,
  },

  // Default for unknown use cases
  'default': {
    useCase: 'default',
    ttlMs: 5 * 60 * 1000, // 5 minutes
    maxEntries: 100,
    enabled: true,
    semanticMatching: false,
  },
};

// ============================================================================
// AIResponseCache Class
// ============================================================================

export class AIResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private configs: Map<string, CacheConfig> = new Map();
  private stats: {
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    totalTokensSaved: number;
    totalCostSaved: number;
    byUseCase: Record<string, { hits: number; misses: number }>;
  };

  constructor(customConfigs?: Partial<Record<string, CacheConfig>>) {
    // Initialize configs
    for (const [key, config] of Object.entries(DEFAULT_CACHE_CONFIGS)) {
      this.configs.set(key, customConfigs?.[key] || config);
    }

    // Initialize stats
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalTokensSaved: 0,
      totalCostSaved: 0,
      byUseCase: {},
    };

    // Start cleanup interval
    this.startCleanupInterval();

    logger.info('AI Response Cache initialized');
  }

  /**
   * Get cached response
   */
  get<T>(useCase: string, promptOrKey: string, variables?: Record<string, any>): T | null {
    const config = this.getConfig(useCase);
    if (!config.enabled) {
      return null;
    }

    const cacheKey = this.generateCacheKey(useCase, promptOrKey, variables);
    const entry = this.cache.get(cacheKey);

    // Track stats
    this.trackRequest(useCase);

    if (!entry) {
      this.trackMiss(useCase);
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      this.trackMiss(useCase);
      return null;
    }

    // Cache hit!
    entry.hits++;
    this.trackHit(useCase, entry);

    logger.debug(`Cache hit for ${useCase}`, { cacheKey: cacheKey.substring(0, 16) });

    return entry.value as T;
  }

  /**
   * Set cached response
   */
  set<T>(
    useCase: string,
    promptOrKey: string,
    value: T,
    options?: {
      variables?: Record<string, any>;
      modelUsed?: string;
      tokensSaved?: number;
      costSaved?: number;
      ttlMs?: number;
    }
  ): void {
    const config = this.getConfig(useCase);
    if (!config.enabled) {
      return;
    }

    const cacheKey = this.generateCacheKey(useCase, promptOrKey, options?.variables);
    const ttl = options?.ttlMs || config.ttlMs;

    const entry: CacheEntry<T> = {
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      useCase,
      hits: 0,
      promptHash: cacheKey,
      modelUsed: options?.modelUsed || 'unknown',
      tokensSaved: options?.tokensSaved,
      costSaved: options?.costSaved,
    };

    // Enforce max entries for this use case
    this.enforceMaxEntries(useCase, config.maxEntries);

    this.cache.set(cacheKey, entry);

    logger.debug(`Cached response for ${useCase}`, {
      cacheKey: cacheKey.substring(0, 16),
      ttlMs: ttl,
    });
  }

  /**
   * Invalidate cache entries
   */
  invalidate(options: {
    useCase?: string;
    keyPattern?: string;
    olderThan?: Date;
  }): number {
    let invalidated = 0;

    this.cache.forEach((entry, key) => {
      let shouldInvalidate = false;

      if (options.useCase && entry.useCase === options.useCase) {
        shouldInvalidate = true;
      }

      if (options.keyPattern && key.includes(options.keyPattern)) {
        shouldInvalidate = true;
      }

      if (options.olderThan && entry.createdAt < options.olderThan.getTime()) {
        shouldInvalidate = true;
      }

      if (shouldInvalidate) {
        this.cache.delete(key);
        invalidated++;
      }
    });

    if (invalidated > 0) {
      logger.info(`Invalidated ${invalidated} cache entries`, options);
    }

    return invalidated;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    const count = this.cache.size;
    this.cache.clear();
    logger.info(`Cleared all ${count} cache entries`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const timestamps = entries.map(e => e.createdAt);

    // Group by use case
    const byUseCase: Record<string, { hits: number; misses: number; hitRate: number; entries: number }> = {};
    const entriesByUseCase: Record<string, number> = {};

    entries.forEach(e => {
      entriesByUseCase[e.useCase] = (entriesByUseCase[e.useCase] || 0) + 1;
    });

    for (const [useCase, useCaseStats] of Object.entries(this.stats.byUseCase)) {
      const total = useCaseStats.hits + useCaseStats.misses;
      byUseCase[useCase] = {
        hits: useCaseStats.hits,
        misses: useCaseStats.misses,
        hitRate: total > 0 ? useCaseStats.hits / total : 0,
        entries: entriesByUseCase[useCase] || 0,
      };
    }

    return {
      totalRequests: this.stats.totalRequests,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      hitRate: this.stats.totalRequests > 0
        ? this.stats.cacheHits / this.stats.totalRequests
        : 0,
      totalTokensSaved: this.stats.totalTokensSaved,
      totalCostSaved: this.stats.totalCostSaved,
      entriesCount: this.cache.size,
      oldestEntry: timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null,
      newestEntry: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null,
      byUseCase,
    };
  }

  /**
   * Update cache configuration
   */
  updateConfig(useCase: string, updates: Partial<CacheConfig>): void {
    const existing = this.configs.get(useCase) || DEFAULT_CACHE_CONFIGS['default'];
    this.configs.set(useCase, { ...existing, ...updates, useCase });
    logger.info(`Updated cache config for ${useCase}`, updates);
  }

  /**
   * Get cache configuration
   */
  getConfig(useCase: string): CacheConfig {
    return this.configs.get(useCase) || DEFAULT_CACHE_CONFIGS['default'];
  }

  /**
   * Check if cache is enabled for use case
   */
  isEnabled(useCase: string): boolean {
    return this.getConfig(useCase).enabled;
  }

  /**
   * Get entry TTL remaining
   */
  getTTLRemaining(useCase: string, promptOrKey: string, variables?: Record<string, any>): number | null {
    const cacheKey = this.generateCacheKey(useCase, promptOrKey, variables);
    const entry = this.cache.get(cacheKey);

    if (!entry) return null;

    const remaining = entry.expiresAt - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private generateCacheKey(
    useCase: string,
    promptOrKey: string,
    variables?: Record<string, any>
  ): string {
    // Config is available via this.getConfig(useCase) if needed for cache key generation

    // Create deterministic key from content
    let keyContent = `${useCase}:${promptOrKey}`;

    if (variables) {
      // Sort keys for deterministic hashing
      const sortedVars = Object.keys(variables)
        .sort()
        .reduce((obj, key) => {
          obj[key] = variables[key];
          return obj;
        }, {} as Record<string, any>);

      keyContent += `:${JSON.stringify(sortedVars)}`;
    }

    // Hash the content
    const hash = createHash('sha256')
      .update(keyContent)
      .digest('hex')
      .substring(0, 32);

    return `${useCase}:${hash}`;
  }

  private trackRequest(useCase: string): void {
    this.stats.totalRequests++;

    if (!this.stats.byUseCase[useCase]) {
      this.stats.byUseCase[useCase] = { hits: 0, misses: 0 };
    }
  }

  private trackHit(useCase: string, entry: CacheEntry): void {
    this.stats.cacheHits++;
    this.stats.byUseCase[useCase].hits++;

    if (entry.tokensSaved) {
      this.stats.totalTokensSaved += entry.tokensSaved;
    }
    if (entry.costSaved) {
      this.stats.totalCostSaved += entry.costSaved;
    }
  }

  private trackMiss(useCase: string): void {
    this.stats.cacheMisses++;

    if (!this.stats.byUseCase[useCase]) {
      this.stats.byUseCase[useCase] = { hits: 0, misses: 0 };
    }
    this.stats.byUseCase[useCase].misses++;
  }

  private enforceMaxEntries(useCase: string, maxEntries: number): void {
    // Count entries for this use case
    const useCaseEntries: Array<[string, CacheEntry]> = [];
    this.cache.forEach((entry, key) => {
      if (entry.useCase === useCase) {
        useCaseEntries.push([key, entry]);
      }
    });

    // If over limit, remove oldest entries
    if (useCaseEntries.length >= maxEntries) {
      const sortedByAge = useCaseEntries.sort((a, b) => a[1].createdAt - b[1].createdAt);
      const toRemove = sortedByAge.slice(0, useCaseEntries.length - maxEntries + 1);

      for (const [key] of toRemove) {
        this.cache.delete(key);
      }

      logger.debug(`Evicted ${toRemove.length} cache entries for ${useCase}`);
    }
  }

  private startCleanupInterval(): void {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      this.cache.forEach((entry, key) => {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
          cleaned++;
        }
      });

      if (cleaned > 0) {
        logger.debug(`Cleaned up ${cleaned} expired cache entries`);
      }
    }, 5 * 60 * 1000);
  }
}

// Export singleton instance
export const aiResponseCache = new AIResponseCache();

export default aiResponseCache;
