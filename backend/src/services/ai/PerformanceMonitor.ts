// backend/src/services/ai/PerformanceMonitor.ts
/**
 * AI Performance Monitor
 *
 * Phase 9, Task 9.1 of ADR-005 Multi-Tenant Access Control
 * Real-time monitoring of AI service performance
 *
 * Features:
 * - Record metrics for all AI operations
 * - Calculate percentile latencies (p50, p95, p99)
 * - Group metrics by use case
 * - Emit alerts when thresholds are exceeded
 * - Generate performance summaries
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface PerformanceMetrics {
  useCase: string;
  model: string;
  provider: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: Date;
  success: boolean;
  errorType?: string;
  cached?: boolean;
}

export interface LatencyThresholds {
  [useCase: string]: {
    p50: number;
    p95: number;
    p99: number;
  };
}

export interface UseCaseSummary {
  useCase: string;
  totalRequests: number;
  successRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  totalCost: number;
  avgCostPerRequest: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  cacheHitRate: number;
  topModels: Array<{ model: string; requests: number; avgLatency: number }>;
  errorBreakdown: Record<string, number>;
}

export interface PerformanceSummary {
  period: string;
  startTime: Date;
  endTime: Date;
  totalRequests: number;
  totalSuccessful: number;
  successRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  totalCost: number;
  cacheHitRate: number;
  byUseCase: Record<string, UseCaseSummary>;
  alerts: Array<{
    type: 'latency' | 'error_rate' | 'cost';
    useCase: string;
    message: string;
    timestamp: Date;
  }>;
}

// ============================================================================
// Default Thresholds
// ============================================================================

const DEFAULT_LATENCY_THRESHOLDS: LatencyThresholds = {
  'permission-explanation': { p50: 100, p95: 200, p99: 500 },
  'financial-masking': { p50: 50, p95: 100, p99: 200 },
  'semantic-audit-search': { p50: 200, p95: 500, p99: 1000 },
  'role-drift-detection': { p50: 500, p95: 1000, p99: 2000 },
  'notification-routing': { p50: 100, p95: 200, p99: 400 },
  'beo-analytics': { p50: 1500, p95: 3000, p99: 5000 },
  'default': { p50: 500, p95: 1000, p99: 2000 },
};

const ERROR_RATE_THRESHOLD = 0.05; // 5% error rate triggers alert
const COST_SPIKE_MULTIPLIER = 2; // 2x average cost triggers alert

// ============================================================================
// PerformanceMonitor Class
// ============================================================================

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private readonly maxMetricsStored = 50000;
  private thresholds: LatencyThresholds;
  private alerts: Array<{
    type: 'latency' | 'error_rate' | 'cost';
    useCase: string;
    message: string;
    timestamp: Date;
  }> = [];
  private avgCostPerUseCase: Map<string, number> = new Map();

  constructor(customThresholds?: Partial<LatencyThresholds>) {
    super();
    this.thresholds = { ...DEFAULT_LATENCY_THRESHOLDS, ...customThresholds } as LatencyThresholds;
  }

  /**
   * Record AI operation metrics
   */
  record(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsStored) {
      this.metrics = this.metrics.slice(-this.maxMetricsStored);
    }

    // Check for threshold violations
    this.checkThresholds(metrics);

    // Update average cost
    this.updateAvgCost(metrics.useCase, metrics.cost);

    logger.debug('AI metrics recorded', {
      useCase: metrics.useCase,
      model: metrics.model,
      latencyMs: metrics.latencyMs,
      success: metrics.success,
    });
  }

  /**
   * Get performance summary for a time period
   */
  getSummary(period: 'hour' | 'day' | 'week' = 'hour'): PerformanceSummary {
    const cutoff = this.getCutoffTime(period);
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff);

    if (recentMetrics.length === 0) {
      return this.createEmptySummary(period, cutoff);
    }

    const allLatencies = recentMetrics.map(m => m.latencyMs);
    const successfulMetrics = recentMetrics.filter(m => m.success);
    const cachedMetrics = recentMetrics.filter(m => m.cached);

    return {
      period,
      startTime: cutoff,
      endTime: new Date(),
      totalRequests: recentMetrics.length,
      totalSuccessful: successfulMetrics.length,
      successRate: successfulMetrics.length / recentMetrics.length,
      avgLatencyMs: this.average(allLatencies),
      p50LatencyMs: this.percentile(allLatencies, 50),
      p95LatencyMs: this.percentile(allLatencies, 95),
      p99LatencyMs: this.percentile(allLatencies, 99),
      totalCost: recentMetrics.reduce((sum, m) => sum + m.cost, 0),
      cacheHitRate: cachedMetrics.length / recentMetrics.length,
      byUseCase: this.groupByUseCase(recentMetrics),
      alerts: this.alerts.filter(a => a.timestamp >= cutoff),
    };
  }

  /**
   * Get summary for a specific use case
   */
  getUseCaseSummary(useCase: string, period: 'hour' | 'day' | 'week' = 'hour'): UseCaseSummary | null {
    const cutoff = this.getCutoffTime(period);
    const useCaseMetrics = this.metrics.filter(
      m => m.useCase === useCase && m.timestamp >= cutoff
    );

    if (useCaseMetrics.length === 0) {
      return null;
    }

    return this.calculateUseCaseSummary(useCase, useCaseMetrics);
  }

  /**
   * Get alerts
   */
  getAlerts(period: 'hour' | 'day' | 'week' = 'day'): typeof this.alerts {
    const cutoff = this.getCutoffTime(period);
    return this.alerts.filter(a => a.timestamp >= cutoff);
  }

  /**
   * Clear old metrics (for memory management)
   */
  clearOldMetrics(olderThan: Date): number {
    const initialCount = this.metrics.length;
    this.metrics = this.metrics.filter(m => m.timestamp >= olderThan);
    const removedCount = initialCount - this.metrics.length;

    if (removedCount > 0) {
      logger.info(`Cleared ${removedCount} old AI metrics`);
    }

    return removedCount;
  }

  /**
   * Get raw metrics (for export)
   */
  getRawMetrics(
    filter?: {
      useCase?: string;
      model?: string;
      startTime?: Date;
      endTime?: Date;
    },
    limit = 1000
  ): PerformanceMetrics[] {
    let filtered = this.metrics;

    if (filter?.useCase) {
      filtered = filtered.filter(m => m.useCase === filter.useCase);
    }
    if (filter?.model) {
      filtered = filtered.filter(m => m.model === filter.model);
    }
    if (filter?.startTime) {
      filtered = filtered.filter(m => m.timestamp >= filter.startTime!);
    }
    if (filter?.endTime) {
      filtered = filtered.filter(m => m.timestamp <= filter.endTime!);
    }

    return filtered.slice(-limit);
  }

  /**
   * Set custom thresholds
   */
  setThresholds(thresholds: Partial<LatencyThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds } as LatencyThresholds;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private checkThresholds(metrics: PerformanceMetrics): void {
    const thresholds = this.thresholds[metrics.useCase] || this.thresholds['default'];

    // Check latency threshold
    if (metrics.latencyMs > thresholds.p95) {
      const alert = {
        type: 'latency' as const,
        useCase: metrics.useCase,
        message: `High latency detected: ${metrics.latencyMs}ms exceeds p95 threshold of ${thresholds.p95}ms`,
        timestamp: new Date(),
      };
      this.alerts.push(alert);
      this.emit('latency-alert', alert);
      logger.warn('AI latency threshold exceeded', alert);
    }

    // Check for errors
    if (!metrics.success) {
      // Check recent error rate
      const recentMetrics = this.metrics.filter(
        m => m.useCase === metrics.useCase && m.timestamp >= new Date(Date.now() - 5 * 60 * 1000)
      );
      const errorRate = recentMetrics.filter(m => !m.success).length / recentMetrics.length;

      if (errorRate > ERROR_RATE_THRESHOLD && recentMetrics.length >= 10) {
        const alert = {
          type: 'error_rate' as const,
          useCase: metrics.useCase,
          message: `High error rate detected: ${(errorRate * 100).toFixed(1)}% in last 5 minutes`,
          timestamp: new Date(),
        };
        this.alerts.push(alert);
        this.emit('error-rate-alert', alert);
        logger.warn('AI error rate threshold exceeded', alert);
      }
    }

    // Check cost spike
    const avgCost = this.avgCostPerUseCase.get(metrics.useCase);
    if (avgCost && metrics.cost > avgCost * COST_SPIKE_MULTIPLIER) {
      const alert = {
        type: 'cost' as const,
        useCase: metrics.useCase,
        message: `Cost spike detected: $${metrics.cost.toFixed(4)} is ${(metrics.cost / avgCost).toFixed(1)}x average`,
        timestamp: new Date(),
      };
      this.alerts.push(alert);
      this.emit('cost-alert', alert);
      logger.warn('AI cost spike detected', alert);
    }

    // Limit alerts array size
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }
  }

  private updateAvgCost(useCase: string, cost: number): void {
    const current = this.avgCostPerUseCase.get(useCase);
    if (current) {
      // Exponential moving average
      this.avgCostPerUseCase.set(useCase, current * 0.9 + cost * 0.1);
    } else {
      this.avgCostPerUseCase.set(useCase, cost);
    }
  }

  private groupByUseCase(metrics: PerformanceMetrics[]): Record<string, UseCaseSummary> {
    const grouped: Record<string, PerformanceMetrics[]> = {};

    for (const metric of metrics) {
      if (!grouped[metric.useCase]) {
        grouped[metric.useCase] = [];
      }
      grouped[metric.useCase].push(metric);
    }

    const result: Record<string, UseCaseSummary> = {};
    for (const [useCase, items] of Object.entries(grouped)) {
      result[useCase] = this.calculateUseCaseSummary(useCase, items);
    }

    return result;
  }

  private calculateUseCaseSummary(useCase: string, metrics: PerformanceMetrics[]): UseCaseSummary {
    const latencies = metrics.map(m => m.latencyMs);
    const successfulMetrics = metrics.filter(m => m.success);
    const cachedMetrics = metrics.filter(m => m.cached);

    // Calculate top models
    const modelCounts: Record<string, { requests: number; totalLatency: number }> = {};
    for (const m of metrics) {
      if (!modelCounts[m.model]) {
        modelCounts[m.model] = { requests: 0, totalLatency: 0 };
      }
      modelCounts[m.model].requests++;
      modelCounts[m.model].totalLatency += m.latencyMs;
    }
    const topModels = Object.entries(modelCounts)
      .map(([model, data]) => ({
        model,
        requests: data.requests,
        avgLatency: data.totalLatency / data.requests,
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 5);

    // Calculate error breakdown
    const errorBreakdown: Record<string, number> = {};
    for (const m of metrics.filter(m => !m.success)) {
      const errorType = m.errorType || 'unknown';
      errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + 1;
    }

    return {
      useCase,
      totalRequests: metrics.length,
      successRate: successfulMetrics.length / metrics.length,
      avgLatencyMs: this.average(latencies),
      p50LatencyMs: this.percentile(latencies, 50),
      p95LatencyMs: this.percentile(latencies, 95),
      p99LatencyMs: this.percentile(latencies, 99),
      minLatencyMs: Math.min(...latencies),
      maxLatencyMs: Math.max(...latencies),
      totalCost: metrics.reduce((sum, m) => sum + m.cost, 0),
      avgCostPerRequest: metrics.reduce((sum, m) => sum + m.cost, 0) / metrics.length,
      totalInputTokens: metrics.reduce((sum, m) => sum + m.inputTokens, 0),
      totalOutputTokens: metrics.reduce((sum, m) => sum + m.outputTokens, 0),
      cacheHitRate: cachedMetrics.length / metrics.length,
      topModels,
      errorBreakdown,
    };
  }

  private createEmptySummary(period: string, cutoff: Date): PerformanceSummary {
    return {
      period,
      startTime: cutoff,
      endTime: new Date(),
      totalRequests: 0,
      totalSuccessful: 0,
      successRate: 0,
      avgLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      totalCost: 0,
      cacheHitRate: 0,
      byUseCase: {},
      alerts: [],
    };
  }

  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private getCutoffTime(period: string): Date {
    const now = new Date();
    const cutoffs: Record<string, number> = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
    };
    return new Date(now.getTime() - (cutoffs[period] || cutoffs.hour));
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;
