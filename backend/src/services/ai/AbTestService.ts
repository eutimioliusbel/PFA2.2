// backend/src/services/ai/AbTestService.ts
/**
 * A/B Testing Service for AI Models
 *
 * Phase 9, Task 9.1 of ADR-005 Multi-Tenant Access Control
 * A/B testing framework for comparing AI model performance
 *
 * Features:
 * - Create and manage A/B tests between model variants
 * - Traffic routing with configurable split
 * - Metrics collection (latency, cost, error rate)
 * - Statistical analysis and winner determination
 * - Automatic recommendation generation
 */

import { logger } from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface AbTestConfig {
  name: string;
  useCase: string;
  modelA: string;
  modelB: string;
  trafficSplit: number; // 0-1 (0.5 = 50/50 split)
  startedAt: Date;
  endsAt?: Date;
  description?: string;
}

export interface AbTestMetrics {
  requests: number;
  totalLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  errors: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  accuracyScores: number[]; // For accuracy measurement
}

export interface AbTestVariantReport {
  model: string;
  requests: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
  totalCost: number;
  avgCostPerRequest: number;
  avgAccuracy: number | null;
}

export interface AbTestResult {
  testId: string;
  testName: string;
  useCase: string;
  status: 'running' | 'completed' | 'stopped';
  winner: 'A' | 'B' | 'TIE' | 'INCONCLUSIVE';
  confidenceLevel: number; // 0-1
  modelA: AbTestVariantReport;
  modelB: AbTestVariantReport;
  recommendation: string;
  summary: string;
  startedAt: Date;
  endedAt?: Date;
  durationHours?: number;
}

interface TestState {
  config: AbTestConfig;
  metricsA: AbTestMetrics;
  metricsB: AbTestMetrics;
  latenciesA: number[];
  latenciesB: number[];
}

// ============================================================================
// AbTestService Class
// ============================================================================

export class AbTestService {
  private tests: Map<string, TestState> = new Map();
  private readonly MAX_LATENCY_SAMPLES = 1000;

  /**
   * Create and start a new A/B test
   */
  startTest(config: Omit<AbTestConfig, 'startedAt'>): string {
    const testId = `abtest-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const fullConfig: AbTestConfig = {
      ...config,
      startedAt: new Date(),
    };

    const initialMetrics: AbTestMetrics = {
      requests: 0,
      totalLatencyMs: 0,
      minLatencyMs: Infinity,
      maxLatencyMs: 0,
      errors: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      accuracyScores: [],
    };

    this.tests.set(testId, {
      config: fullConfig,
      metricsA: { ...initialMetrics },
      metricsB: { ...initialMetrics },
      latenciesA: [],
      latenciesB: [],
    });

    logger.info(`Started A/B test: ${config.name} (${config.modelA} vs ${config.modelB})`, {
      testId,
      useCase: config.useCase,
      trafficSplit: config.trafficSplit,
    });

    return testId;
  }

  /**
   * Route a request to variant A or B based on traffic split
   */
  routeRequest(testId: string): 'A' | 'B' {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    return Math.random() < test.config.trafficSplit ? 'A' : 'B';
  }

  /**
   * Record metrics for a request
   */
  recordMetrics(
    testId: string,
    variant: 'A' | 'B',
    metrics: {
      latencyMs: number;
      inputTokens?: number;
      outputTokens?: number;
      cost?: number;
      error?: boolean;
      accuracy?: number; // 0-1, if measurable
    }
  ): void {
    const test = this.tests.get(testId);
    if (!test) {
      logger.warn(`Attempted to record metrics for non-existent test: ${testId}`);
      return;
    }

    const targetMetrics = variant === 'A' ? test.metricsA : test.metricsB;
    const targetLatencies = variant === 'A' ? test.latenciesA : test.latenciesB;

    targetMetrics.requests++;
    targetMetrics.totalLatencyMs += metrics.latencyMs;
    targetMetrics.minLatencyMs = Math.min(targetMetrics.minLatencyMs, metrics.latencyMs);
    targetMetrics.maxLatencyMs = Math.max(targetMetrics.maxLatencyMs, metrics.latencyMs);

    if (metrics.error) {
      targetMetrics.errors++;
    }

    if (metrics.inputTokens) {
      targetMetrics.totalInputTokens += metrics.inputTokens;
    }

    if (metrics.outputTokens) {
      targetMetrics.totalOutputTokens += metrics.outputTokens;
    }

    if (metrics.cost) {
      targetMetrics.totalCost += metrics.cost;
    }

    if (metrics.accuracy !== undefined) {
      targetMetrics.accuracyScores.push(metrics.accuracy);
    }

    // Store latency for percentile calculation (with limit)
    if (targetLatencies.length < this.MAX_LATENCY_SAMPLES) {
      targetLatencies.push(metrics.latencyMs);
    } else {
      // Random replacement to maintain distribution
      const idx = Math.floor(Math.random() * this.MAX_LATENCY_SAMPLES);
      targetLatencies[idx] = metrics.latencyMs;
    }
  }

  /**
   * Stop an A/B test
   */
  stopTest(testId: string): void {
    const test = this.tests.get(testId);
    if (test) {
      test.config.endsAt = new Date();
      logger.info(`Stopped A/B test: ${test.config.name}`, { testId });
    }
  }

  /**
   * Get results for an A/B test
   */
  getResults(testId: string): AbTestResult | null {
    const test = this.tests.get(testId);
    if (!test) {
      return null;
    }

    const reportA = this.generateVariantReport(
      test.config.modelA,
      test.metricsA,
      test.latenciesA
    );
    const reportB = this.generateVariantReport(
      test.config.modelB,
      test.metricsB,
      test.latenciesB
    );

    const { winner, confidence } = this.determineWinner(reportA, reportB);
    const recommendation = this.generateRecommendation(reportA, reportB, winner);
    const summary = this.generateSummary(test.config, reportA, reportB, winner);

    const endedAt = test.config.endsAt;
    const durationHours = endedAt
      ? (endedAt.getTime() - test.config.startedAt.getTime()) / (1000 * 60 * 60)
      : undefined;

    return {
      testId,
      testName: test.config.name,
      useCase: test.config.useCase,
      status: test.config.endsAt ? 'completed' : 'running',
      winner,
      confidenceLevel: confidence,
      modelA: reportA,
      modelB: reportB,
      recommendation,
      summary,
      startedAt: test.config.startedAt,
      endedAt,
      durationHours,
    };
  }

  /**
   * Get all active tests
   */
  getActiveTests(): Array<{ testId: string; config: AbTestConfig }> {
    const active: Array<{ testId: string; config: AbTestConfig }> = [];
    this.tests.forEach((test, testId) => {
      if (!test.config.endsAt) {
        active.push({ testId, config: test.config });
      }
    });
    return active;
  }

  /**
   * Delete a test
   */
  deleteTest(testId: string): boolean {
    return this.tests.delete(testId);
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private generateVariantReport(
    model: string,
    metrics: AbTestMetrics,
    latencies: number[]
  ): AbTestVariantReport {
    const avgLatency = metrics.requests > 0 ? metrics.totalLatencyMs / metrics.requests : 0;
    const errorRate = metrics.requests > 0 ? metrics.errors / metrics.requests : 0;
    const avgCost = metrics.requests > 0 ? metrics.totalCost / metrics.requests : 0;
    const avgAccuracy =
      metrics.accuracyScores.length > 0
        ? metrics.accuracyScores.reduce((a, b) => a + b, 0) / metrics.accuracyScores.length
        : null;

    return {
      model,
      requests: metrics.requests,
      avgLatencyMs: Math.round(avgLatency * 100) / 100,
      minLatencyMs: metrics.minLatencyMs === Infinity ? 0 : metrics.minLatencyMs,
      maxLatencyMs: metrics.maxLatencyMs,
      p95LatencyMs: this.calculatePercentile(latencies, 95),
      errorRate: Math.round(errorRate * 10000) / 10000,
      totalCost: Math.round(metrics.totalCost * 10000) / 10000,
      avgCostPerRequest: Math.round(avgCost * 100000) / 100000,
      avgAccuracy,
    };
  }

  private calculatePercentile(arr: number[], percentile: number): number {
    if (arr.length === 0) return 0;
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private determineWinner(
    reportA: AbTestVariantReport,
    reportB: AbTestVariantReport
  ): { winner: 'A' | 'B' | 'TIE' | 'INCONCLUSIVE'; confidence: number } {
    // Need minimum sample size for statistical significance
    const minSamples = 30;
    if (reportA.requests < minSamples || reportB.requests < minSamples) {
      return { winner: 'INCONCLUSIVE', confidence: 0 };
    }

    // Calculate composite score (lower is better)
    // Weighted: 40% latency, 30% cost, 30% error rate
    const scoreA =
      (reportA.avgLatencyMs / 1000) * 0.4 +
      reportA.avgCostPerRequest * 1000 * 0.3 +
      reportA.errorRate * 100 * 0.3;

    const scoreB =
      (reportB.avgLatencyMs / 1000) * 0.4 +
      reportB.avgCostPerRequest * 1000 * 0.3 +
      reportB.errorRate * 100 * 0.3;

    const diff = Math.abs(scoreA - scoreB);
    const avgScore = (scoreA + scoreB) / 2;
    const relativeDiff = avgScore > 0 ? diff / avgScore : 0;

    // Need at least 10% difference to declare winner
    if (relativeDiff < 0.1) {
      return { winner: 'TIE', confidence: 0.9 };
    }

    const winner = scoreA < scoreB ? 'A' : 'B';
    const confidence = Math.min(0.99, 0.5 + relativeDiff);

    return { winner, confidence };
  }

  private generateRecommendation(
    reportA: AbTestVariantReport,
    reportB: AbTestVariantReport,
    winner: 'A' | 'B' | 'TIE' | 'INCONCLUSIVE'
  ): string {
    if (winner === 'INCONCLUSIVE') {
      return 'Insufficient data to make a recommendation. Continue the test to collect more samples.';
    }

    if (winner === 'TIE') {
      return 'Performance is comparable between models. Choose based on other factors (provider preference, feature support, etc.).';
    }

    const winnerReport = winner === 'A' ? reportA : reportB;
    const loserReport = winner === 'A' ? reportB : reportA;

    const latencyImprovement = ((loserReport.avgLatencyMs - winnerReport.avgLatencyMs) / loserReport.avgLatencyMs) * 100;
    const costImprovement = ((loserReport.avgCostPerRequest - winnerReport.avgCostPerRequest) / loserReport.avgCostPerRequest) * 100;

    const parts: string[] = [];
    parts.push(`${winnerReport.model} is the recommended model.`);

    if (latencyImprovement > 5) {
      parts.push(`${latencyImprovement.toFixed(1)}% faster latency.`);
    }

    if (costImprovement > 5) {
      parts.push(`${costImprovement.toFixed(1)}% lower cost.`);
    }

    if (winnerReport.errorRate < loserReport.errorRate) {
      parts.push(`Lower error rate (${(winnerReport.errorRate * 100).toFixed(2)}% vs ${(loserReport.errorRate * 100).toFixed(2)}%).`);
    }

    return parts.join(' ');
  }

  private generateSummary(
    config: AbTestConfig,
    reportA: AbTestVariantReport,
    reportB: AbTestVariantReport,
    winner: 'A' | 'B' | 'TIE' | 'INCONCLUSIVE'
  ): string {
    const totalRequests = reportA.requests + reportB.requests;
    const winnerText =
      winner === 'A'
        ? config.modelA
        : winner === 'B'
        ? config.modelB
        : winner;

    return `A/B test "${config.name}" for ${config.useCase}: ${totalRequests} total requests, ${reportA.requests} to model A (${config.modelA}), ${reportB.requests} to model B (${config.modelB}). Winner: ${winnerText}.`;
  }
}

// Export singleton instance
export const abTestService = new AbTestService();

export default abTestService;
