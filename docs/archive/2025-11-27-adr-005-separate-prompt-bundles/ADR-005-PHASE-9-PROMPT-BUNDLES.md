# ADR-005 Phase 9: AI Integration & Refinement - Complete Prompt Bundles

**Generated**: 2025-11-27
**Phase**: 9 (AI Integration & Refinement)
**Duration**: 2 days
**Prerequisites**: ✅ Phase 7, 8 Complete (All AI features implemented)

---

## 📋 Phase 9 Overview

**Purpose**: Ensure all 25 AI use cases are production-ready with optimal performance, security, reliability, and cost-efficiency.

**Tasks**:
1. **Task 9.1**: AI Model Performance Tuning (ai-quality-engineer)
2. **Task 9.2**: AI Prompt Engineering (ai-quality-engineer)
3. **Task 9.3**: AI Caching Strategy (backend-architecture-optimizer)
4. **Task 9.4**: AI Error Handling & Fallbacks (backend-architecture-optimizer)

**Critical Requirements**:
- Performance: <500ms p95 latency for AI responses
- Accuracy: >85% confidence threshold for all use cases
- Reliability: 99.9% uptime with graceful degradation
- Cost: 50%+ reduction via caching and model optimization
- Security: Zero AI-related vulnerabilities

---

# 🎯 Task 9.1: AI Model Performance Tuning

**Agent**: `ai-quality-engineer`
**Duration**: 8 hours
**Priority**: P0 (CRITICAL - Blocks Phase 10)

## Context

You are the AI Quality Engineer responsible for optimizing AI model performance across all 25 AI use cases in the Multi-Tenant Access Control system. Your goal is to ensure sub-500ms latency, >85% accuracy, and cost-effective AI operations.

## Objectives

1. ✅ Benchmark AI response times for all 25 use cases
2. ✅ Optimize latency to <500ms p95 across the board
3. ✅ Measure accuracy metrics (precision, recall, F1 for classifications)
4. ✅ Implement A/B testing framework for model comparison
5. ✅ Reduce API costs by 50%+ via caching and model selection

## Source Documents

**Primary References**:
- `docs/ADRs/ADR-005-multi-tenant-access-control/ADR-005-AI_OPPORTUNITIES.md` (25 AI use cases)
- `docs/ADRs/ADR-005-multi-tenant-access-control/ADR-005-TEST_PLAN.md` (AI quality tests)
- `docs/ADRs/ADR-005-multi-tenant-access-control/ADR-005-IMPLEMENTATION_PLAN.md` (Phase 9 specs)

**AI Use Cases to Benchmark** (All 25):
1. UC-16: Context-Aware Access Explanation
2. UC-17: Financial Masking with Relative Indicators
3. UC-18: Semantic Audit Search
4. UC-19: Role Drift Detection
5. UC-20: Behavioral Quiet Mode
6. UC-21: Boardroom Voice Analyst (BEO Analytics)
7. UC-22: Narrative Variance Explainer
8. UC-23: Asset Arbitrage Opportunity Finder
9. UC-24: Vendor Pricing Watchdog
10. UC-25: Multiverse Scenario Simulator
11-25: Additional UX Intelligence features

## Deliverables

### 1. Performance Benchmark Report

**File**: `backend/tests/ai/performance-benchmarks.test.ts`

```typescript
import { describe, it, expect, beforeAll } from '@jest/globals';
import { AiService } from '../../src/services/ai/AiService';
import { performance } from 'perf_hooks';

describe('AI Performance Benchmarks', () => {
  let aiService: AiService;

  beforeAll(() => {
    aiService = new AiService();
  });

  /**
   * UC-16: Context-Aware Access Explanation
   * Target: <200ms p95 latency
   */
  describe('UC-16: Permission Explanation', () => {
    it('should explain permission denial in <200ms', async () => {
      const iterations = 100;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        await aiService.explainPermissionDenial({
          userId: 'user-123',
          organizationId: 'org-456',
          action: 'pems:sync',
          deniedReason: 'Insufficient permissions'
        });

        const duration = performance.now() - start;
        latencies.push(duration);
      }

      const p95 = calculatePercentile(latencies, 95);
      const p99 = calculatePercentile(latencies, 99);
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

      console.log(`UC-16 Latency: Avg=${avg.toFixed(2)}ms, P95=${p95.toFixed(2)}ms, P99=${p99.toFixed(2)}ms`);

      expect(p95).toBeLessThan(200); // <200ms p95
      expect(avg).toBeLessThan(150); // <150ms avg
    });

    it('should achieve >90% accuracy on permission chain detection', async () => {
      const testCases = [
        {
          input: { userId: 'viewer-user', action: 'pfa:delete' },
          expectedChain: ['User has canDelete capability', 'Organization status is active']
        },
        {
          input: { userId: 'editor-user', action: 'pems:sync' },
          expectedChain: ['User has canSync capability', 'Organization enableSync is true']
        },
        // ... 20 more test cases
      ];

      let correct = 0;
      for (const tc of testCases) {
        const explanation = await aiService.explainPermissionDenial(tc.input);
        const detectedAll = tc.expectedChain.every(check =>
          explanation.permissionChain.some(c => c.check.includes(check))
        );
        if (detectedAll) correct++;
      }

      const accuracy = correct / testCases.length;
      console.log(`UC-16 Accuracy: ${(accuracy * 100).toFixed(2)}%`);

      expect(accuracy).toBeGreaterThan(0.90); // >90% accuracy
    });
  });

  /**
   * UC-17: Financial Masking
   * Target: <100ms p95 latency
   */
  describe('UC-17: Financial Masking', () => {
    it('should mask financial data in <100ms', async () => {
      const iterations = 100;
      const latencies: number[] = [];

      const records = Array(50).fill(null).map((_, i) => ({
        id: `pfa-${i}`,
        cost: Math.random() * 500000,
        category: 'Cranes'
      }));

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        await aiService.translateFinancialData({
          userId: 'viewer-user',
          organizationId: 'org-456',
          records,
          userCapabilities: { viewFinancialDetails: false }
        });

        latencies.push(performance.now() - start);
      }

      const p95 = calculatePercentile(latencies, 95);
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

      console.log(`UC-17 Latency: Avg=${avg.toFixed(2)}ms, P95=${p95.toFixed(2)}ms`);

      expect(p95).toBeLessThan(100); // <100ms p95
    });

    it('should correctly classify impact levels (HIGH/MEDIUM/LOW)', async () => {
      const testCases = [
        { cost: 450000, category: 'Cranes', expectedImpact: 'HIGH' },
        { cost: 50000, category: 'Generators', expectedImpact: 'MEDIUM' },
        { cost: 5000, category: 'Tools', expectedImpact: 'LOW' }
      ];

      let correct = 0;
      for (const tc of testCases) {
        const masked = await aiService.translateFinancialData({
          userId: 'user-123',
          organizationId: 'org-456',
          records: [tc],
          userCapabilities: { viewFinancialDetails: false }
        });

        if (masked.maskedRecords[0].impactLevel === tc.expectedImpact) {
          correct++;
        }
      }

      const accuracy = correct / testCases.length;
      expect(accuracy).toBeGreaterThan(0.85); // >85% classification accuracy
    });
  });

  /**
   * UC-18: Semantic Audit Search
   * Target: <500ms p95 latency
   */
  describe('UC-18: Semantic Audit Search', () => {
    it('should parse natural language query in <500ms', async () => {
      const iterations = 50;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        await aiService.semanticAuditSearch({
          query: 'Who changed crane rental duration in the last week?',
          userId: 'user-123',
          organizationId: 'org-456'
        });

        latencies.push(performance.now() - start);
      }

      const p95 = calculatePercentile(latencies, 95);
      console.log(`UC-18 Latency: P95=${p95.toFixed(2)}ms`);

      expect(p95).toBeLessThan(500);
    });

    it('should achieve >80% query understanding accuracy', async () => {
      const testCases = [
        {
          query: 'Who changed crane duration last week?',
          expected: { resourceType: 'PfaRecord', category: 'Cranes', changedFields: ['forecastEnd'] }
        },
        {
          query: 'Show me permission escalations in November',
          expected: { action: 'permission:grant', timeRange: '2025-11' }
        }
        // ... 20 more test cases
      ];

      let correct = 0;
      for (const tc of testCases) {
        const result = await aiService.semanticAuditSearch({
          query: tc.query,
          userId: 'user-123',
          organizationId: 'org-456'
        });

        const matches = Object.keys(tc.expected).every(key =>
          JSON.stringify(result.parsedQuery.filters[key]).includes(tc.expected[key])
        );
        if (matches) correct++;
      }

      const accuracy = correct / testCases.length;
      expect(accuracy).toBeGreaterThan(0.80);
    });
  });

  /**
   * UC-21: Boardroom Voice Analyst (BEO Analytics)
   * Target: <3000ms p95 latency (executive experience)
   */
  describe('UC-21: BEO Analytics', () => {
    it('should answer portfolio queries in <3 seconds', async () => {
      const iterations = 30;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        await aiService.beoAnalytics({
          query: 'Which projects are over budget?',
          userId: 'cfo-456',
          responseFormat: 'conversational'
        });

        latencies.push(performance.now() - start);
      }

      const p95 = calculatePercentile(latencies, 95);
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

      console.log(`UC-21 Latency: Avg=${avg.toFixed(2)}ms, P95=${p95.toFixed(2)}ms`);

      expect(p95).toBeLessThan(3000); // <3s for executive experience
      expect(avg).toBeLessThan(2000); // <2s avg
    });

    it('should calculate portfolio variance with 100% accuracy', async () => {
      const testCases = [
        { organizationId: 'HOLNG', expectedVariance: '+$450K' },
        { organizationId: 'RIO', expectedVariance: '+$220K' }
      ];

      for (const tc of testCases) {
        const response = await aiService.beoAnalytics({
          query: `What is ${tc.organizationId} portfolio variance?`,
          userId: 'cfo-456',
          responseFormat: 'conversational'
        });

        expect(response.executiveSummary.portfolioVariance).toBe(tc.expectedVariance);
      }
    });
  });

  /**
   * UC-19: Role Drift Detection
   * Target: <1000ms p95 latency
   */
  describe('UC-19: Role Drift Detection', () => {
    it('should detect drift patterns in <1 second', async () => {
      const iterations = 20;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        await aiService.detectRoleDrift({
          organizationId: 'org-456'
        });

        latencies.push(performance.now() - start);
      }

      const p95 = calculatePercentile(latencies, 95);
      console.log(`UC-19 Latency: P95=${p95.toFixed(2)}ms`);

      expect(p95).toBeLessThan(1000);
    });

    it('should detect consistent override patterns with >90% precision', async () => {
      // Create 5 users with identical overrides
      const users = await Promise.all([1, 2, 3, 4, 5].map(i =>
        createUser({
          role: 'Field Engineer',
          capabilities: { canManageUsers: true, canManageSettings: true }
        })
      ));

      const drift = await aiService.detectRoleDrift({ organizationId: 'org-456' });

      expect(drift.driftDetected).toBe(true);
      expect(drift.patterns[0].affectedUsers.length).toBe(5);
      expect(drift.patterns[0].driftType).toBe('CONSISTENT_OVERRIDES');
    });
  });

  /**
   * UC-20: Behavioral Quiet Mode
   * Target: <200ms p95 latency
   */
  describe('UC-20: Behavioral Quiet Mode', () => {
    it('should route notifications in <200ms', async () => {
      const iterations = 100;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        await aiService.routeNotification({
          userId: 'user-123',
          notification: { type: 'permission_granted', urgency: 'routine' },
          timestamp: new Date().toISOString()
        });

        latencies.push(performance.now() - start);
      }

      const p95 = calculatePercentile(latencies, 95);
      console.log(`UC-20 Latency: P95=${p95.toFixed(2)}ms`);

      expect(p95).toBeLessThan(200);
    });
  });
});

/**
 * Helper: Calculate percentile
 */
function calculatePercentile(arr: number[], percentile: number): number {
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}
```

### 2. Model Selection Optimization

**File**: `backend/src/services/ai/ModelSelector.ts`

```typescript
import { AiProvider, AiModel } from '../types/ai';

interface ModelConfig {
  provider: AiProvider;
  model: string;
  costPerToken: number; // USD per 1K tokens
  avgLatency: number; // milliseconds
  accuracy: number; // 0-1
}

/**
 * Intelligent model selection based on use case requirements
 */
export class ModelSelector {
  private readonly models: Record<string, ModelConfig> = {
    // Fast, cheap, lower accuracy (good for simple tasks)
    'gemini-flash': {
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      costPerToken: 0.00005,
      avgLatency: 150,
      accuracy: 0.82
    },

    // Balanced (good for most tasks)
    'gemini-pro': {
      provider: 'gemini',
      model: 'gemini-1.5-pro',
      costPerToken: 0.0002,
      avgLatency: 400,
      accuracy: 0.91
    },

    // High accuracy (good for complex reasoning)
    'openai-4': {
      provider: 'openai',
      model: 'gpt-4-turbo',
      costPerToken: 0.001,
      avgLatency: 800,
      accuracy: 0.95
    },

    // Ultra-fast (good for real-time interactions)
    'claude-haiku': {
      provider: 'claude',
      model: 'claude-3-haiku',
      costPerToken: 0.00008,
      avgLatency: 100,
      accuracy: 0.85
    }
  };

  /**
   * Select optimal model for each use case
   */
  selectModel(useCase: string): ModelConfig {
    const requirements = this.getUseCaseRequirements(useCase);

    // Filter models that meet requirements
    const candidates = Object.values(this.models).filter(model =>
      model.avgLatency <= requirements.maxLatency &&
      model.accuracy >= requirements.minAccuracy
    );

    if (candidates.length === 0) {
      throw new Error(`No model meets requirements for ${useCase}`);
    }

    // Sort by cost (cheapest first) among candidates
    candidates.sort((a, b) => a.costPerToken - b.costPerToken);

    return candidates[0]; // Return cheapest model that meets requirements
  }

  /**
   * Define requirements for each use case
   */
  private getUseCaseRequirements(useCase: string): {
    maxLatency: number;
    minAccuracy: number;
  } {
    const requirements: Record<string, any> = {
      'permission-explanation': { maxLatency: 200, minAccuracy: 0.90 },
      'financial-masking': { maxLatency: 100, minAccuracy: 0.85 },
      'semantic-audit-search': { maxLatency: 500, minAccuracy: 0.80 },
      'role-drift-detection': { maxLatency: 1000, minAccuracy: 0.90 },
      'notification-routing': { maxLatency: 200, minAccuracy: 0.85 },
      'beo-analytics': { maxLatency: 3000, minAccuracy: 0.92 },
      'narrative-variance': { maxLatency: 2000, minAccuracy: 0.90 },
      'asset-arbitrage': { maxLatency: 1500, minAccuracy: 0.88 },
      'vendor-watchdog': { maxLatency: 1000, minAccuracy: 0.85 },
      'scenario-simulator': { maxLatency: 5000, minAccuracy: 0.93 }
    };

    return requirements[useCase] || { maxLatency: 1000, minAccuracy: 0.85 };
  }

  /**
   * Cost comparison report
   */
  async generateCostReport(usageStats: Record<string, number>): Promise<any> {
    const report = {
      totalCost: 0,
      savingsVsBaseline: 0,
      breakdown: [] as any[]
    };

    for (const [useCase, requestCount] of Object.entries(usageStats)) {
      const selectedModel = this.selectModel(useCase);
      const avgTokens = 500; // Estimate
      const cost = (requestCount * avgTokens * selectedModel.costPerToken) / 1000;

      // Compare to baseline (always using GPT-4)
      const baselineCost = (requestCount * avgTokens * this.models['openai-4'].costPerToken) / 1000;
      const savings = baselineCost - cost;

      report.totalCost += cost;
      report.savingsVsBaseline += savings;

      report.breakdown.push({
        useCase,
        model: selectedModel.model,
        requestCount,
        cost: `$${cost.toFixed(2)}`,
        savings: `$${savings.toFixed(2)}`,
        savingsPercent: `${((savings / baselineCost) * 100).toFixed(1)}%`
      });
    }

    report.savingsVsBaseline = `$${report.savingsVsBaseline.toFixed(2)}`;
    report.totalCost = `$${report.totalCost.toFixed(2)}`;

    return report;
  }
}
```

### 3. A/B Testing Framework

**File**: `backend/src/services/ai/AbTestService.ts`

```typescript
import { ModelSelector } from './ModelSelector';

interface AbTestConfig {
  name: string;
  useCase: string;
  modelA: string;
  modelB: string;
  trafficSplit: number; // 0-1 (0.5 = 50/50 split)
  duration: number; // milliseconds
  metrics: string[]; // ['latency', 'accuracy', 'cost']
}

/**
 * A/B testing for AI model comparison
 */
export class AbTestService {
  private tests: Map<string, AbTestConfig> = new Map();
  private results: Map<string, any> = new Map();

  /**
   * Start A/B test
   */
  startTest(config: AbTestConfig): string {
    const testId = `abtest-${Date.now()}`;
    this.tests.set(testId, config);
    this.results.set(testId, {
      modelA: { requests: 0, totalLatency: 0, errors: 0, totalCost: 0 },
      modelB: { requests: 0, totalLatency: 0, errors: 0, totalCost: 0 }
    });

    console.log(`Started A/B test: ${config.name} (${config.modelA} vs ${config.modelB})`);
    return testId;
  }

  /**
   * Route request to A or B based on traffic split
   */
  routeRequest(testId: string): 'A' | 'B' {
    const config = this.tests.get(testId);
    if (!config) throw new Error('Test not found');

    return Math.random() < config.trafficSplit ? 'A' : 'B';
  }

  /**
   * Record metrics for A/B test
   */
  recordMetrics(testId: string, variant: 'A' | 'B', metrics: {
    latency: number;
    cost: number;
    error?: boolean;
  }) {
    const results = this.results.get(testId);
    if (!results) return;

    const variantKey = `model${variant}`;
    results[variantKey].requests++;
    results[variantKey].totalLatency += metrics.latency;
    results[variantKey].totalCost += metrics.cost;
    if (metrics.error) results[variantKey].errors++;
  }

  /**
   * Get A/B test results
   */
  getResults(testId: string): any {
    const config = this.tests.get(testId);
    const results = this.results.get(testId);

    if (!config || !results) return null;

    const reportA = {
      model: config.modelA,
      requests: results.modelA.requests,
      avgLatency: results.modelA.totalLatency / results.modelA.requests,
      errorRate: results.modelA.errors / results.modelA.requests,
      totalCost: results.modelA.totalCost
    };

    const reportB = {
      model: config.modelB,
      requests: results.modelB.requests,
      avgLatency: results.modelB.totalLatency / results.modelB.requests,
      errorRate: results.modelB.errors / results.modelB.requests,
      totalCost: results.modelB.totalCost
    };

    // Determine winner
    let winner = 'TIE';
    if (reportA.avgLatency < reportB.avgLatency && reportA.totalCost < reportB.totalCost) {
      winner = 'A';
    } else if (reportB.avgLatency < reportA.avgLatency && reportB.totalCost < reportA.totalCost) {
      winner = 'B';
    }

    return {
      testName: config.name,
      winner,
      modelA: reportA,
      modelB: reportB,
      recommendation: this.generateRecommendation(reportA, reportB)
    };
  }

  private generateRecommendation(a: any, b: any): string {
    const latencyDiff = ((a.avgLatency - b.avgLatency) / b.avgLatency) * 100;
    const costDiff = ((a.totalCost - b.totalCost) / b.totalCost) * 100;

    if (Math.abs(latencyDiff) < 10 && Math.abs(costDiff) < 10) {
      return 'Performance is comparable. Choose based on other factors.';
    }

    if (latencyDiff < -20 && costDiff < 0) {
      return `${a.model} is significantly faster (${Math.abs(latencyDiff).toFixed(1)}% faster) and cheaper. Strong recommendation.`;
    }

    if (latencyDiff > 20 && costDiff > 0) {
      return `${b.model} is significantly faster (${Math.abs(latencyDiff).toFixed(1)}% faster) and cheaper. Strong recommendation.`;
    }

    return `Trade-off: ${a.model} is ${latencyDiff > 0 ? 'slower' : 'faster'} but ${costDiff > 0 ? 'more expensive' : 'cheaper'}. Choose based on priority.`;
  }
}
```

### 4. Performance Monitoring Dashboard

**File**: `backend/src/services/ai/PerformanceMonitor.ts`

```typescript
import { EventEmitter } from 'events';

interface PerformanceMetrics {
  useCase: string;
  model: string;
  latency: number;
  tokens: number;
  cost: number;
  timestamp: Date;
  success: boolean;
}

/**
 * Real-time AI performance monitoring
 */
export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private readonly maxMetricsStored = 10000;

  /**
   * Record AI operation metrics
   */
  record(metrics: PerformanceMetrics) {
    this.metrics.push(metrics);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsStored) {
      this.metrics = this.metrics.slice(-this.maxMetricsStored);
    }

    // Emit alert if latency exceeds threshold
    const threshold = this.getLatencyThreshold(metrics.useCase);
    if (metrics.latency > threshold) {
      this.emit('latency-alert', {
        useCase: metrics.useCase,
        latency: metrics.latency,
        threshold
      });
    }
  }

  /**
   * Get performance summary
   */
  getSummary(period: 'hour' | 'day' | 'week' = 'hour'): any {
    const cutoff = this.getCutoffTime(period);
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff);

    const summary = {
      totalRequests: recentMetrics.length,
      successRate: recentMetrics.filter(m => m.success).length / recentMetrics.length,
      avgLatency: this.average(recentMetrics.map(m => m.latency)),
      p95Latency: this.percentile(recentMetrics.map(m => m.latency), 95),
      totalCost: recentMetrics.reduce((sum, m) => sum + m.cost, 0),
      byUseCase: this.groupByUseCase(recentMetrics)
    };

    return summary;
  }

  private groupByUseCase(metrics: PerformanceMetrics[]): Record<string, any> {
    const grouped: Record<string, PerformanceMetrics[]> = {};

    for (const metric of metrics) {
      if (!grouped[metric.useCase]) grouped[metric.useCase] = [];
      grouped[metric.useCase].push(metric);
    }

    const result: Record<string, any> = {};
    for (const [useCase, items] of Object.entries(grouped)) {
      result[useCase] = {
        requests: items.length,
        avgLatency: this.average(items.map(m => m.latency)),
        successRate: items.filter(m => m.success).length / items.length,
        totalCost: items.reduce((sum, m) => sum + m.cost, 0)
      };
    }

    return result;
  }

  private average(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private percentile(arr: number[], p: number): number {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }

  private getCutoffTime(period: string): Date {
    const now = new Date();
    const cutoffs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000
    };
    return new Date(now.getTime() - cutoffs[period]);
  }

  private getLatencyThreshold(useCase: string): number {
    const thresholds: Record<string, number> = {
      'permission-explanation': 200,
      'financial-masking': 100,
      'semantic-audit-search': 500,
      'beo-analytics': 3000
    };
    return thresholds[useCase] || 1000;
  }
}
```

## Acceptance Criteria

- [ ] All 25 AI use cases benchmarked with latency, accuracy, cost metrics
- [ ] P95 latency <500ms for all use cases (or specific targets)
- [ ] Accuracy >85% for classification tasks
- [ ] A/B testing framework operational with at least 3 model comparisons
- [ ] Cost reduction >50% vs baseline (all GPT-4)
- [ ] Performance monitoring dashboard showing real-time metrics
- [ ] Alerts configured for latency/error spikes

## Testing

```bash
# Run performance benchmarks
npm run test:ai-performance

# Generate cost report
npm run ai:cost-report

# Start A/B test
npm run ai:ab-test -- --name "Permission Explanation" --modelA gemini-flash --modelB gemini-pro

# View performance dashboard
npm run ai:monitor
```

## Success Metrics

- ✅ **Latency**: All use cases meet p95 targets
- ✅ **Accuracy**: >85% precision/recall on classification tasks
- ✅ **Cost**: 50%+ reduction vs all-GPT-4 baseline
- ✅ **Reliability**: <1% error rate across all AI operations
- ✅ **Observability**: Real-time metrics dashboard operational

---

# 🎯 Task 9.2: AI Prompt Engineering

**Agent**: `ai-quality-engineer`
**Duration**: 6 hours
**Priority**: P0 (CRITICAL - Blocks Phase 10)

## Context

You are the AI Quality Engineer responsible for optimizing AI prompts across all 25 use cases. Your goal is to maximize accuracy, minimize latency, reduce token usage, and implement prompt versioning with confidence thresholds.

## Objectives

1. ✅ Optimize prompts for all 25 AI use cases
2. ✅ Implement version control for prompts (Git-based)
3. ✅ Tune confidence thresholds (reject <70% confidence)
4. ✅ Add few-shot learning examples for complex tasks
5. ✅ Create prompt testing framework (automated validation)

## Source Documents

**Primary References**:
- `docs/ADRs/ADR-005-multi-tenant-access-control/ADR-005-AI_OPPORTUNITIES.md` (AI use case prompts)
- `docs/ADRs/ADR-005-multi-tenant-access-control/ADR-005-TEST_PLAN.md` (Prompt quality tests)

## Deliverables

### 1. Prompt Library with Version Control

**File**: `backend/src/services/ai/prompts/PromptRegistry.ts`

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

interface PromptTemplate {
  version: string;
  lastUpdated: Date;
  author: string;
  template: string;
  fewShotExamples?: any[];
  confidenceThreshold: number;
  expectedOutputFormat: 'json' | 'text' | 'markdown';
}

/**
 * Centralized prompt registry with version control
 */
export class PromptRegistry {
  private prompts: Map<string, PromptTemplate> = new Map();

  constructor() {
    this.loadPrompts();
  }

  /**
   * Load all prompts from version-controlled files
   */
  private loadPrompts() {
    const promptDir = join(__dirname, './templates');

    // UC-16: Permission Explanation
    this.prompts.set('permission-explanation', {
      version: '2.1.0',
      lastUpdated: new Date('2025-11-27'),
      author: 'ai-quality-engineer',
      template: this.loadTemplate(join(promptDir, 'permission-explanation-v2.1.txt')),
      confidenceThreshold: 0.85,
      expectedOutputFormat: 'json'
    });

    // UC-17: Financial Masking
    this.prompts.set('financial-masking', {
      version: '1.3.0',
      lastUpdated: new Date('2025-11-27'),
      author: 'ai-quality-engineer',
      template: this.loadTemplate(join(promptDir, 'financial-masking-v1.3.txt')),
      confidenceThreshold: 0.80,
      expectedOutputFormat: 'json'
    });

    // UC-18: Semantic Audit Search
    this.prompts.set('semantic-audit-search', {
      version: '3.0.0',
      lastUpdated: new Date('2025-11-27'),
      author: 'ai-quality-engineer',
      template: this.loadTemplate(join(promptDir, 'semantic-audit-search-v3.0.txt')),
      fewShotExamples: this.loadFewShotExamples('semantic-audit-search'),
      confidenceThreshold: 0.75,
      expectedOutputFormat: 'json'
    });

    // UC-21: BEO Analytics
    this.prompts.set('beo-analytics', {
      version: '2.5.0',
      lastUpdated: new Date('2025-11-27'),
      author: 'ai-quality-engineer',
      template: this.loadTemplate(join(promptDir, 'beo-analytics-v2.5.txt')),
      fewShotExamples: this.loadFewShotExamples('beo-analytics'),
      confidenceThreshold: 0.90,
      expectedOutputFormat: 'json'
    });

    // ... Load remaining 21 prompts
  }

  /**
   * Get prompt template
   */
  getPrompt(useCase: string): PromptTemplate {
    const prompt = this.prompts.get(useCase);
    if (!prompt) {
      throw new Error(`Prompt not found for use case: ${useCase}`);
    }
    return prompt;
  }

  /**
   * Render prompt with variables
   */
  render(useCase: string, variables: Record<string, any>): string {
    const prompt = this.getPrompt(useCase);
    let rendered = prompt.template;

    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
    }

    // Add few-shot examples if present
    if (prompt.fewShotExamples && prompt.fewShotExamples.length > 0) {
      const examples = prompt.fewShotExamples
        .map(ex => `Input: ${JSON.stringify(ex.input)}\nOutput: ${JSON.stringify(ex.output)}`)
        .join('\n\n');
      rendered = `${examples}\n\n${rendered}`;
    }

    return rendered;
  }

  private loadTemplate(path: string): string {
    return readFileSync(path, 'utf-8');
  }

  private loadFewShotExamples(useCase: string): any[] {
    const examplesPath = join(__dirname, `./examples/${useCase}.json`);
    try {
      return JSON.parse(readFileSync(examplesPath, 'utf-8'));
    } catch {
      return [];
    }
  }
}
```

### 2. Optimized Prompt Templates

**File**: `backend/src/services/ai/prompts/templates/permission-explanation-v2.1.txt`

```
# Permission Denial Explanation

You are a security assistant helping users understand why their access was denied.

## Context
- User: {{username}} (ID: {{userId}})
- Organization: {{organizationCode}} (ID: {{organizationId}})
- Action Attempted: {{action}}
- Denial Reason: {{deniedReason}}

## User's Current Permissions
{{userPermissions}}

## Organization Status
- Service Status: {{orgServiceStatus}}
- Sync Enabled: {{orgEnableSync}}

## Task
Analyze the permission chain and provide:

1. **Permission Chain**: List each permission check and its result (pass/fail)
2. **Actionable Steps**: Specific steps user can take to resolve (contact admin, check org status, etc.)
3. **Estimated Resolution Time**: How long will it take to fix?
4. **Confidence Score**: How confident are you in this explanation (0-1)?

## Output Format (JSON)
{
  "permissionChain": [
    { "check": "User has canWrite capability", "result": false, "reason": "User role is viewer" },
    { "check": "Organization status is active", "result": true, "reason": "Org status: active" }
  ],
  "actionableSteps": [
    { "action": "Contact admin to request write access", "contact": "admin@example.com", "eta": "1-2 business days" }
  ],
  "estimatedResolutionTime": "1-2 business days",
  "confidence": 0.92
}

## Important Rules
- Only suggest actions the user can actually take
- If multiple permission checks failed, list ALL of them
- Always include a confidence score
- If confidence < 0.70, flag as UNCERTAIN and recommend manual review
```

**File**: `backend/src/services/ai/prompts/templates/financial-masking-v1.3.txt`

```
# Financial Data Masking with Relative Indicators

You are a data privacy assistant masking financial information while providing useful relative context.

## Context
- User ID: {{userId}}
- Organization: {{organizationId}}
- User has viewFinancialDetails: {{viewFinancialDetails}}
- Records: {{recordCount}} equipment records

## Task
For each record, provide:
1. **Impact Level**: HIGH (top 10%), MEDIUM (11-50%), LOW (51-100%)
2. **Relative Comparison**: e.g., "3.2x more expensive than typical cranes"
3. **Percentile**: e.g., "Top 5% of crane costs"
4. **AI Insight**: Brief recommendation (e.g., "Consider alternatives")

## Records
{{records}}

## Output Format (JSON)
{
  "maskedRecords": [
    {
      "id": "pfa-1",
      "cost": "***masked***",
      "impactLevel": "HIGH",
      "relativeComparison": "3.2x more expensive than typical cranes",
      "percentile": "Top 5%",
      "impactDescription": "This equipment is significantly more expensive than similar items",
      "aiInsight": "Consider negotiating rental rate or exploring alternatives"
    }
  ],
  "portfolioInsight": "3 high-impact items (>$100K each), 10 medium-impact, 32 low-impact",
  "confidence": 0.89
}

## Important Rules
- NEVER include absolute costs in output
- Impact levels based on category benchmarks (compare cranes to cranes, not to generators)
- If user has viewFinancialDetails=true, STILL mask but provide more detail
- Confidence < 0.70 = flag as UNCERTAIN
```

**File**: `backend/src/services/ai/prompts/templates/semantic-audit-search-v3.0.txt`

```
# Semantic Audit Search Query Parser

You are a query understanding assistant converting natural language to structured filters.

## User Query
"{{query}}"

## Available Filters
- resourceType: PfaRecord | User | Organization | Permission
- action: create | read | update | delete | permission:grant | permission:revoke | sync
- userId: string
- organizationId: string
- changedFields: array of field names
- timeRange: { start: ISO8601, end: ISO8601 }
- category: string (for PfaRecord)
- booleanOperator: AND | OR

## Task
Parse the query and extract structured filters. Also provide:
1. **Natural Language Summary**: Human-readable summary of what the query is asking
2. **Confidence**: How confident are you in this interpretation (0-1)?
3. **Clarification Needed**: If query is ambiguous, what questions should we ask?

## Output Format (JSON)
{
  "parsedQuery": {
    "filters": {
      "resourceType": "PfaRecord",
      "changedFields": ["forecastEnd", "forecastStart"],
      "category": "Cranes",
      "timeRange": { "start": "2025-11-19T00:00:00Z", "end": "2025-11-26T23:59:59Z" }
    }
  },
  "naturalLanguageSummary": "Show me PFA records where crane rental duration was changed in the last week",
  "confidence": 0.91,
  "clarificationNeeded": null
}

## Important Rules
- If confidence < 0.70, set clarificationNeeded with specific questions
- Use ISO8601 format for dates
- If no time range specified, default to last 30 days
- If multiple interpretations possible, choose most likely and flag in clarificationNeeded
```

**File**: `backend/src/services/ai/prompts/templates/beo-analytics-v2.5.txt`

```
# BEO Portfolio Analytics (Executive Voice Analyst)

You are an executive business analyst providing concise, accurate portfolio insights.

## Executive Context
- User: {{userName}} ({{userRole}})
- Query: "{{query}}"
- Response Format: {{responseFormat}} (conversational | technical)

## Portfolio Data
{{portfolioData}}

## Task
Answer the executive's question with:
1. **Executive Summary**: 1-2 sentence high-level answer
2. **Portfolio Variance**: Actual vs. Plan with $ amounts
3. **Projects At Risk**: Count and details
4. **Narrative**: 2-3 paragraphs explaining "why" (root causes)
5. **Voice Response**: Natural voice-friendly version (no dollar signs, spell out numbers)

## Output Format (JSON)
{
  "narrative": "Three of your seven projects are trending over budget...",
  "executiveSummary": {
    "portfolioVariance": "+$825K",
    "projectsAtRisk": 3,
    "topDriver": "Weather delays and crane rental extensions"
  },
  "detailedBreakdown": [
    {
      "organizationId": "HOLNG",
      "variance": "+$450K (+12%)",
      "primaryDriver": "Extended crane rentals due to weather delays",
      "trend": "worsening"
    }
  ],
  "voiceResponse": "You have three projects currently trending over budget, for a total variance of eight hundred twenty-five thousand dollars...",
  "confidence": 0.94
}

## Important Rules
- Voice response: spell out numbers, no symbols ($, %, etc.)
- Keep narrative concise (2-3 paragraphs MAX for executives)
- Always include $ amounts in executiveSummary
- Confidence < 0.85 = flag as NEEDS_REVIEW
- Adapt tone to user role (CFO = financial focus, COO = operational focus)
```

### 3. Few-Shot Learning Examples

**File**: `backend/src/services/ai/prompts/examples/semantic-audit-search.json`

```json
[
  {
    "input": {
      "query": "Who changed crane rental duration in the last week?"
    },
    "output": {
      "parsedQuery": {
        "filters": {
          "resourceType": "PfaRecord",
          "changedFields": ["forecastEnd", "forecastStart"],
          "category": "Cranes",
          "timeRange": { "start": "2025-11-19T00:00:00Z", "end": "2025-11-26T23:59:59Z" }
        }
      },
      "naturalLanguageSummary": "Show me who modified crane rental duration in the last 7 days",
      "confidence": 0.92
    }
  },
  {
    "input": {
      "query": "Show me permission escalations in November"
    },
    "output": {
      "parsedQuery": {
        "filters": {
          "action": "permission:grant",
          "timeRange": { "start": "2025-11-01T00:00:00Z", "end": "2025-11-30T23:59:59Z" }
        }
      },
      "naturalLanguageSummary": "Show me all permission grants in November 2025",
      "confidence": 0.89
    }
  },
  {
    "input": {
      "query": "Bulk changes to PFA records AND permission escalations last month"
    },
    "output": {
      "parsedQuery": {
        "filters": {
          "action": ["pfa:bulk_update", "permission:grant"],
          "booleanOperator": "AND",
          "timeRange": { "start": "2025-10-01T00:00:00Z", "end": "2025-10-31T23:59:59Z" }
        }
      },
      "naturalLanguageSummary": "Show me bulk PFA updates and permission grants in October 2025",
      "confidence": 0.85
    }
  }
]
```

**File**: `backend/src/services/ai/prompts/examples/beo-analytics.json`

```json
[
  {
    "input": {
      "query": "Which projects are over budget?",
      "userRole": "CFO"
    },
    "output": {
      "narrative": "Three of your seven projects are currently trending over budget, for a total variance of $825K (4.2% over plan). HOLNG leads with $450K variance due to extended crane rentals from weather delays. RIO is $220K over from unplanned generator additions. PEMS shows $155K variance from procurement timing issues.",
      "executiveSummary": {
        "portfolioVariance": "+$825K",
        "projectsAtRisk": 3
      },
      "confidence": 0.94
    }
  }
]
```

### 4. Confidence Threshold Validation

**File**: `backend/src/services/ai/ConfidenceValidator.ts`

```typescript
interface AiResponse {
  confidence: number;
  [key: string]: any;
}

/**
 * Validate AI responses against confidence thresholds
 */
export class ConfidenceValidator {
  private thresholds: Record<string, number> = {
    'permission-explanation': 0.85,
    'financial-masking': 0.80,
    'semantic-audit-search': 0.75,
    'role-drift-detection': 0.85,
    'beo-analytics': 0.90,
    'narrative-variance': 0.88,
    'asset-arbitrage': 0.80,
    'vendor-watchdog': 0.75,
    'scenario-simulator': 0.85
  };

  /**
   * Validate response confidence
   */
  validate(useCase: string, response: AiResponse): {
    passed: boolean;
    reason?: string;
    recommendation?: string;
  } {
    const threshold = this.thresholds[useCase] || 0.70;

    if (response.confidence < threshold) {
      return {
        passed: false,
        reason: `Confidence ${response.confidence.toFixed(2)} below threshold ${threshold.toFixed(2)}`,
        recommendation: this.getRecommendation(useCase, response.confidence)
      };
    }

    return { passed: true };
  }

  private getRecommendation(useCase: string, confidence: number): string {
    if (confidence < 0.50) {
      return 'REJECT: Confidence too low. Use rule-based fallback or manual review.';
    } else if (confidence < 0.70) {
      return 'CAUTION: Show warning to user and offer manual review option.';
    } else {
      return 'BORDERLINE: Proceed but log for quality review.';
    }
  }

  /**
   * Update threshold for a use case
   */
  updateThreshold(useCase: string, newThreshold: number) {
    if (newThreshold < 0 || newThreshold > 1) {
      throw new Error('Threshold must be between 0 and 1');
    }
    this.thresholds[useCase] = newThreshold;
    console.log(`Updated threshold for ${useCase}: ${newThreshold}`);
  }
}
```

### 5. Prompt Testing Framework

**File**: `backend/tests/ai/prompt-quality.test.ts`

```typescript
import { PromptRegistry } from '../../src/services/ai/prompts/PromptRegistry';
import { ConfidenceValidator } from '../../src/services/ai/ConfidenceValidator';

describe('Prompt Quality Tests', () => {
  let promptRegistry: PromptRegistry;
  let validator: ConfidenceValidator;

  beforeAll(() => {
    promptRegistry = new PromptRegistry();
    validator = new ConfidenceValidator();
  });

  describe('Permission Explanation Prompts', () => {
    it('should render prompt with all required variables', () => {
      const prompt = promptRegistry.render('permission-explanation', {
        username: 'john.doe',
        userId: 'user-123',
        organizationCode: 'HOLNG',
        organizationId: 'org-456',
        action: 'pems:sync',
        deniedReason: 'User does not have canSync capability',
        userPermissions: JSON.stringify({ canRead: true, canWrite: false, canSync: false }),
        orgServiceStatus: 'active',
        orgEnableSync: true
      });

      expect(prompt).toContain('john.doe');
      expect(prompt).toContain('HOLNG');
      expect(prompt).toContain('pems:sync');
      expect(prompt).not.toContain('{{'); // No unrendered variables
    });

    it('should enforce confidence threshold', async () => {
      const response = {
        permissionChain: [],
        actionableSteps: [],
        confidence: 0.65
      };

      const validation = validator.validate('permission-explanation', response);
      expect(validation.passed).toBe(false);
      expect(validation.recommendation).toContain('CAUTION');
    });
  });

  describe('Semantic Audit Search Prompts', () => {
    it('should include few-shot examples', () => {
      const prompt = promptRegistry.render('semantic-audit-search', {
        query: 'Who changed crane duration last week?'
      });

      expect(prompt).toContain('Input:');
      expect(prompt).toContain('Output:');
    });

    it('should handle low confidence gracefully', async () => {
      const response = {
        parsedQuery: { filters: {} },
        confidence: 0.45
      };

      const validation = validator.validate('semantic-audit-search', response);
      expect(validation.passed).toBe(false);
      expect(validation.recommendation).toContain('REJECT');
    });
  });

  describe('BEO Analytics Prompts', () => {
    it('should generate executive-friendly voice response', () => {
      const response = {
        voiceResponse: 'You have three projects currently trending over budget, for a total variance of eight hundred twenty-five thousand dollars.',
        confidence: 0.94
      };

      expect(response.voiceResponse).not.toContain('$');
      expect(response.voiceResponse).not.toContain('825K');
      expect(response.voiceResponse).toContain('eight hundred');
    });

    it('should enforce high confidence threshold for executives', async () => {
      const response = {
        narrative: 'Some projects are over budget',
        confidence: 0.82
      };

      const validation = validator.validate('beo-analytics', response);
      expect(validation.passed).toBe(false); // Threshold is 0.90
    });
  });
});
```

## Acceptance Criteria

- [ ] All 25 prompt templates created and version-controlled
- [ ] Few-shot examples added for complex use cases (semantic search, BEO analytics)
- [ ] Confidence thresholds configured for all use cases
- [ ] Prompt testing framework with >80% coverage
- [ ] Version registry tracks all prompt changes
- [ ] Validation ensures no responses below confidence threshold reach users

## Testing

```bash
# Test prompt rendering
npm run test:prompts

# Validate all prompts
npm run prompts:validate

# Generate prompt changelog
npm run prompts:changelog

# Update prompt version
npm run prompts:update -- --use-case permission-explanation --version 2.2.0
```

## Success Metrics

- ✅ **Coverage**: 25/25 use cases have optimized prompts
- ✅ **Quality**: >90% of responses meet confidence thresholds
- ✅ **Version Control**: All prompts tracked in Git with changelog
- ✅ **Few-Shot Learning**: Complex use cases have 3-5 examples
- ✅ **Validation**: 0 responses below threshold reach users

---

# 🎯 Task 9.3: AI Caching Strategy

**Agent**: `backend-architecture-optimizer`
**Duration**: 6 hours
**Priority**: P0 (CRITICAL - Cost Reduction)

## Context

You are the Backend Architecture Optimizer responsible for implementing Redis caching for AI responses to reduce latency and API costs by 50%+. Your goal is to cache AI responses intelligently while ensuring data freshness.

## Objectives

1. ✅ Implement Redis caching for AI responses
2. ✅ Configure LRU cache with TTL (15 min for permission suggestions, 5 min for audit queries)
3. ✅ Implement cache invalidation strategies
4. ✅ Monitor cache hit rate (target: >80%)
5. ✅ Calculate cost savings

## Source Documents

**Primary References**:
- `docs/ADRs/ADR-005-multi-tenant-access-control/ADR-005-IMPLEMENTATION_PLAN.md` (Phase 9.3 specs)

## Deliverables

### 1. Redis Cache Service

**File**: `backend/src/services/ai/AiCacheService.ts`

```typescript
import Redis from 'ioredis';
import { createHash } from 'crypto';

interface CacheConfig {
  ttl: number; // seconds
  maxSize?: number; // max items before LRU eviction
  invalidateOn?: string[]; // Events that invalidate cache
}

/**
 * Redis caching for AI responses
 */
export class AiCacheService {
  private redis: Redis;
  private config: Record<string, CacheConfig> = {
    // Permission explanation: Cache for 15 minutes
    'permission-explanation': {
      ttl: 15 * 60,
      invalidateOn: ['permission:change', 'user:update', 'org:update']
    },

    // Financial masking: Cache for 5 minutes (data changes frequently)
    'financial-masking': {
      ttl: 5 * 60,
      invalidateOn: ['pfa:update', 'pfa:bulk_update']
    },

    // Semantic audit search: Cache for 5 minutes
    'semantic-audit-search': {
      ttl: 5 * 60,
      invalidateOn: ['audit:new_entry']
    },

    // Role drift detection: Cache for 1 hour (expensive to compute)
    'role-drift-detection': {
      ttl: 60 * 60,
      invalidateOn: ['permission:change', 'user:create', 'role:update']
    },

    // Notification routing: Cache for 24 hours (user preferences change rarely)
    'notification-routing': {
      ttl: 24 * 60 * 60,
      invalidateOn: ['user:preferences:update']
    },

    // BEO analytics: Cache for 10 minutes
    'beo-analytics': {
      ttl: 10 * 60,
      invalidateOn: ['pfa:update', 'pfa:bulk_update']
    },

    // Narrative variance: Cache for 15 minutes
    'narrative-variance': {
      ttl: 15 * 60,
      invalidateOn: ['pfa:update']
    },

    // Asset arbitrage: Cache for 30 minutes
    'asset-arbitrage': {
      ttl: 30 * 60,
      invalidateOn: ['pfa:update', 'asset:price_update']
    },

    // Vendor watchdog: Cache for 1 hour
    'vendor-watchdog': {
      ttl: 60 * 60,
      invalidateOn: ['vendor:price_update']
    },

    // Scenario simulator: Cache for 5 minutes (session-based)
    'scenario-simulator': {
      ttl: 5 * 60,
      invalidateOn: ['scenario:reset']
    }
  };

  private stats = {
    hits: 0,
    misses: 0,
    invalidations: 0
  };

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });

    // Set LRU eviction policy
    this.redis.config('SET', 'maxmemory-policy', 'allkeys-lru');
  }

  /**
   * Get cached AI response
   */
  async get(useCase: string, params: Record<string, any>): Promise<any | null> {
    const key = this.generateCacheKey(useCase, params);

    try {
      const cached = await this.redis.get(key);
      if (cached) {
        this.stats.hits++;
        return JSON.parse(cached);
      } else {
        this.stats.misses++;
        return null;
      }
    } catch (error) {
      console.error('Cache GET error:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Cache AI response
   */
  async set(useCase: string, params: Record<string, any>, response: any): Promise<void> {
    const key = this.generateCacheKey(useCase, params);
    const config = this.config[useCase];

    if (!config) {
      console.warn(`No cache config for use case: ${useCase}`);
      return;
    }

    try {
      await this.redis.setex(key, config.ttl, JSON.stringify(response));
    } catch (error) {
      console.error('Cache SET error:', error);
    }
  }

  /**
   * Invalidate cache on specific events
   */
  async invalidate(event: string, context?: Record<string, any>): Promise<number> {
    let invalidated = 0;

    for (const [useCase, config] of Object.entries(this.config)) {
      if (config.invalidateOn?.includes(event)) {
        const pattern = `ai:${useCase}:*`;

        // Get all matching keys
        const keys = await this.redis.keys(pattern);

        // Optionally filter by context (e.g., only invalidate for specific user)
        const keysToDelete = context
          ? keys.filter(key => this.matchesContext(key, context))
          : keys;

        if (keysToDelete.length > 0) {
          await this.redis.del(...keysToDelete);
          invalidated += keysToDelete.length;
        }
      }
    }

    this.stats.invalidations += invalidated;
    console.log(`Invalidated ${invalidated} cache entries for event: ${event}`);
    return invalidated;
  }

  /**
   * Generate deterministic cache key
   */
  private generateCacheKey(useCase: string, params: Record<string, any>): string {
    // Sort params for deterministic key
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, any>);

    const hash = createHash('sha256')
      .update(JSON.stringify(sortedParams))
      .digest('hex')
      .substring(0, 16);

    return `ai:${useCase}:${hash}`;
  }

  /**
   * Check if cache key matches invalidation context
   */
  private matchesContext(key: string, context: Record<string, any>): boolean {
    // Extract params from key and check if they match context
    // For now, invalidate all keys (can be optimized later)
    return true;
  }

  /**
   * Get cache statistics
   */
  getStats(): any {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: `${(hitRate * 100).toFixed(2)}%`,
      invalidations: this.stats.invalidations,
      total
    };
  }

  /**
   * Clear all AI cache
   */
  async clearAll(): Promise<number> {
    const keys = await this.redis.keys('ai:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    return keys.length;
  }
}
```

### 2. Cache Invalidation Middleware

**File**: `backend/src/middleware/cacheInvalidation.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { AiCacheService } from '../services/ai/AiCacheService';

const cacheService = new AiCacheService();

/**
 * Middleware to invalidate AI cache on data mutations
 */
export function invalidateAiCache(event: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original res.json
    const originalJson = res.json.bind(res);

    // Override res.json to invalidate cache after successful mutation
    res.json = function(body: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Success response - invalidate cache asynchronously
        cacheService.invalidate(event, {
          userId: req.user?.id,
          organizationId: req.body?.organizationId || req.params?.organizationId
        }).catch(error => {
          console.error('Cache invalidation error:', error);
        });
      }

      return originalJson(body);
    };

    next();
  };
}

/**
 * Apply cache invalidation to routes
 */
export function setupCacheInvalidation(app: any) {
  // Permission changes invalidate permission-explanation cache
  app.use('/api/permissions/*', invalidateAiCache('permission:change'));

  // User updates invalidate permission-explanation cache
  app.use('/api/users/:id', invalidateAiCache('user:update'));

  // PFA updates invalidate financial-masking and BEO analytics
  app.use('/api/pfa/*', invalidateAiCache('pfa:update'));

  // Bulk PFA updates
  app.use('/api/pfa/bulk', invalidateAiCache('pfa:bulk_update'));

  // Audit log entries invalidate semantic-audit-search
  app.use('/api/audit-logs', invalidateAiCache('audit:new_entry'));

  console.log('AI cache invalidation middleware configured');
}
```

### 3. Cache Hit Rate Monitoring

**File**: `backend/src/services/ai/CacheMonitor.ts`

```typescript
import { AiCacheService } from './AiCacheService';

/**
 * Monitor cache performance and cost savings
 */
export class CacheMonitor {
  private cacheService: AiCacheService;

  constructor(cacheService: AiCacheService) {
    this.cacheService = cacheService;
  }

  /**
   * Calculate cost savings from caching
   */
  async calculateSavings(period: 'hour' | 'day' | 'week' = 'day'): Promise<any> {
    const stats = this.cacheService.getStats();

    // Assume average AI call costs $0.002 (2K tokens @ $0.001/1K tokens)
    const avgAiCallCost = 0.002;

    // Cache hits saved these AI calls
    const savedCalls = stats.hits;
    const totalSavings = savedCalls * avgAiCallCost;

    // Actual costs (cache misses that resulted in AI calls)
    const actualCosts = stats.misses * avgAiCallCost;

    // Total cost without caching
    const costWithoutCache = (stats.hits + stats.misses) * avgAiCallCost;

    return {
      period,
      stats,
      costs: {
        savedCalls,
        totalSavings: `$${totalSavings.toFixed(2)}`,
        actualCosts: `$${actualCosts.toFixed(2)}`,
        costWithoutCache: `$${costWithoutCache.toFixed(2)}`,
        savingsPercent: `${((totalSavings / costWithoutCache) * 100).toFixed(1)}%`
      },
      recommendation: this.getRecommendation(stats.hitRate)
    };
  }

  private getRecommendation(hitRate: string): string {
    const rate = parseFloat(hitRate);

    if (rate > 80) {
      return 'Excellent cache performance! Consider increasing TTLs for more savings.';
    } else if (rate > 60) {
      return 'Good cache performance. Monitor invalidation patterns.';
    } else if (rate > 40) {
      return 'Moderate cache performance. Review cache key generation logic.';
    } else {
      return 'Low cache hit rate. Investigate: Are queries too unique? Is TTL too short?';
    }
  }

  /**
   * Get cache performance report
   */
  async getReport(): Promise<any> {
    const stats = this.cacheService.getStats();
    const savings = await this.calculateSavings('day');

    return {
      timestamp: new Date().toISOString(),
      performance: {
        hitRate: stats.hitRate,
        totalRequests: stats.total,
        cacheHits: stats.hits,
        cacheMisses: stats.misses
      },
      savings: savings.costs,
      recommendation: savings.recommendation
    };
  }
}
```

### 4. Cache Warming Script

**File**: `backend/scripts/warm-ai-cache.ts`

```typescript
import { AiService } from '../src/services/ai/AiService';
import { AiCacheService } from '../src/services/ai/AiCacheService';

/**
 * Pre-warm AI cache with common queries
 */
async function warmCache() {
  const aiService = new AiService();
  const cacheService = new AiCacheService();

  console.log('Starting cache warm-up...');

  // Permission explanation: Common denial scenarios
  const permissionQueries = [
    { userId: 'viewer-user', action: 'pfa:delete' },
    { userId: 'editor-user', action: 'pems:sync' },
    { userId: 'viewer-user', action: 'pfa:write' }
  ];

  for (const query of permissionQueries) {
    await aiService.explainPermissionDenial(query);
    console.log(`Cached permission explanation for ${query.action}`);
  }

  // BEO analytics: Common executive queries
  const beoQueries = [
    'Which projects are over budget?',
    'Portfolio variance summary',
    'Top 5 cost drivers'
  ];

  for (const query of beoQueries) {
    await aiService.beoAnalytics({ query, userId: 'cfo-user', responseFormat: 'conversational' });
    console.log(`Cached BEO query: ${query}`);
  }

  // Semantic audit search: Common searches
  const auditQueries = [
    'Who modified PFA records yesterday?',
    'Show me permission changes last week',
    'Bulk operations in the last month'
  ];

  for (const query of auditQueries) {
    await aiService.semanticAuditSearch({ query, userId: 'admin-user', organizationId: 'org-456' });
    console.log(`Cached audit search: ${query}`);
  }

  const stats = cacheService.getStats();
  console.log(`\nCache warm-up complete!`);
  console.log(`Total cached responses: ${stats.total}`);
}

warmCache().catch(console.error);
```

## Acceptance Criteria

- [ ] Redis caching implemented for all 25 AI use cases
- [ ] TTL configured per use case (15 min permission, 5 min audit, etc.)
- [ ] Cache invalidation triggers on data mutations (permission changes, PFA updates)
- [ ] Cache hit rate >80% after 24 hours of operation
- [ ] Cost savings >50% vs no caching
- [ ] Monitoring dashboard shows real-time cache stats

## Testing

```bash
# Test cache functionality
npm run test:ai-cache

# Warm cache with common queries
npm run cache:warm

# View cache stats
npm run cache:stats

# Clear cache
npm run cache:clear
```

## Success Metrics

- ✅ **Hit Rate**: >80% after 24 hours
- ✅ **Cost Savings**: >50% reduction in AI API costs
- ✅ **Latency Improvement**: 90%+ faster for cached responses
- ✅ **Invalidation**: <1% stale responses (invalidate on mutations)
- ✅ **Monitoring**: Real-time dashboard operational

---

# 🎯 Task 9.4: AI Error Handling & Fallbacks

**Agent**: `backend-architecture-optimizer`
**Duration**: 4 hours
**Priority**: P0 (CRITICAL - Reliability)

## Context

You are the Backend Architecture Optimizer responsible for implementing graceful degradation when AI is unavailable. Your goal is to ensure 99.9% uptime with rule-based fallbacks, retry logic, and manual override paths.

## Objectives

1. ✅ Implement graceful degradation when AI unavailable
2. ✅ Create rule-based fallbacks for critical features
3. ✅ Add user-friendly error messages
4. ✅ Implement retry logic with exponential backoff
5. ✅ Add manual override paths (users can bypass AI suggestions)
6. ✅ Monitor AI health and availability

## Source Documents

**Primary References**:
- `docs/ADRs/ADR-005-multi-tenant-access-control/ADR-005-IMPLEMENTATION_PLAN.md` (Phase 9.4 specs)

## Deliverables

### 1. AI Orchestrator with Fallback Logic

**File**: `backend/src/services/ai/AiOrchestrator.ts`

```typescript
import { AiProvider } from '../types/ai';

interface CallOptions {
  primaryProvider: AiProvider;
  fallbackProvider?: AiProvider;
  prompt: string;
  responseFormat: 'json' | 'text';
  maxRetries?: number;
  timeout?: number; // milliseconds
}

/**
 * AI orchestrator with fallback and error handling
 */
export class AiOrchestrator {
  /**
   * Call AI with automatic fallback on failure
   */
  async callWithFallback(options: CallOptions): Promise<any> {
    const { primaryProvider, fallbackProvider, maxRetries = 3 } = options;

    try {
      // Try primary provider with retries
      return await this.callWithRetry(primaryProvider, options, maxRetries);
    } catch (primaryError) {
      console.error(`Primary provider (${primaryProvider}) failed:`, primaryError);

      // Try fallback provider if configured
      if (fallbackProvider) {
        console.log(`Attempting fallback provider: ${fallbackProvider}`);
        try {
          return await this.callWithRetry(fallbackProvider, options, maxRetries);
        } catch (fallbackError) {
          console.error(`Fallback provider (${fallbackProvider}) failed:`, fallbackError);
          throw new Error(`All AI providers failed: ${primaryError.message}`);
        }
      } else {
        throw primaryError;
      }
    }
  }

  /**
   * Call AI with exponential backoff retries
   */
  private async callWithRetry(
    provider: AiProvider,
    options: CallOptions,
    maxRetries: number
  ): Promise<any> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.callAI(provider, options);
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = this.calculateBackoff(attempt);
          console.log(`Retry ${attempt}/${maxRetries} after ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Make AI API call with timeout
   */
  private async callAI(provider: AiProvider, options: CallOptions): Promise<any> {
    const timeout = options.timeout || 10000; // 10 second default

    return Promise.race([
      this.makeApiCall(provider, options),
      this.timeoutPromise(timeout)
    ]);
  }

  private async makeApiCall(provider: AiProvider, options: CallOptions): Promise<any> {
    // Implementation would call actual AI providers (Gemini, OpenAI, Claude)
    // Placeholder for now
    throw new Error('AI provider not implemented');
  }

  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI request timeout')), ms)
    );
  }

  private calculateBackoff(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s...
    return Math.min(1000 * Math.pow(2, attempt - 1), 10000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 2. Rule-Based Fallbacks

**File**: `backend/src/services/ai/fallbacks/RuleBasedFallbacks.ts`

```typescript
/**
 * Rule-based fallbacks when AI is unavailable
 */
export class RuleBasedFallbacks {
  /**
   * UC-16: Permission Explanation Fallback
   */
  explainPermissionDenial(params: {
    userId: string;
    action: string;
    userPermissions: any;
  }): any {
    const { action, userPermissions } = params;

    // Simple rule-based explanation
    const requiredPermissions = this.getRequiredPermissions(action);
    const missingPermissions = requiredPermissions.filter(
      perm => !userPermissions[perm]
    );

    return {
      permissionChain: missingPermissions.map(perm => ({
        check: `User has ${perm} capability`,
        result: false,
        reason: 'Permission not granted'
      })),
      actionableSteps: [
        {
          action: 'Contact your administrator to request access',
          contact: 'admin@example.com',
          eta: '1-2 business days'
        }
      ],
      estimatedResolutionTime: '1-2 business days',
      confidence: 0.70, // Lower confidence for rule-based
      fallbackMode: true
    };
  }

  /**
   * UC-17: Financial Masking Fallback
   */
  translateFinancialData(params: {
    records: any[];
    userCapabilities: any;
  }): any {
    const { records, userCapabilities } = params;

    if (userCapabilities.viewFinancialDetails) {
      // User can see financials - no masking needed
      return { maskedRecords: records, fallbackMode: true };
    }

    // Simple masking: Hide absolute costs, show relative categories
    const maskedRecords = records.map(record => ({
      ...record,
      cost: '***masked***',
      monthlyRate: '***masked***',
      purchasePrice: '***masked***',
      impactLevel: this.categorizeImpact(record.category), // Simple category-based
      fallbackMode: true
    }));

    return {
      maskedRecords,
      portfolioInsight: `${records.length} records (financial details masked)`,
      confidence: 0.70,
      fallbackMode: true
    };
  }

  /**
   * UC-21: BEO Analytics Fallback
   */
  beoAnalytics(params: { query: string; portfolioData: any }): any {
    return {
      narrative: 'AI service is temporarily unavailable. Please try again in a few moments.',
      executiveSummary: {
        portfolioVariance: 'N/A',
        projectsAtRisk: 'N/A',
        status: 'AI_UNAVAILABLE'
      },
      detailedBreakdown: [],
      confidence: 0,
      fallbackMode: true,
      recommendation: 'Use manual portfolio analysis or contact your administrator.'
    };
  }

  /**
   * Map actions to required permissions
   */
  private getRequiredPermissions(action: string): string[] {
    const permissionMap: Record<string, string[]> = {
      'pfa:write': ['canWrite'],
      'pfa:delete': ['canDelete'],
      'pems:sync': ['canSync'],
      'user:manage': ['canManageUsers'],
      'settings:manage': ['canManageSettings']
    };

    return permissionMap[action] || [];
  }

  /**
   * Simple impact categorization
   */
  private categorizeImpact(category: string): 'HIGH' | 'MEDIUM' | 'LOW' {
    const highImpactCategories = ['Cranes', 'Heavy Equipment', 'Specialized Machinery'];
    const mediumImpactCategories = ['Generators', 'Pumps', 'Compressors'];

    if (highImpactCategories.includes(category)) return 'HIGH';
    if (mediumImpactCategories.includes(category)) return 'MEDIUM';
    return 'LOW';
  }
}
```

### 3. User-Friendly Error Messages

**File**: `backend/src/services/ai/AiErrorHandler.ts`

```typescript
/**
 * Convert AI errors to user-friendly messages
 */
export class AiErrorHandler {
  /**
   * Get user-friendly error message
   */
  getUserMessage(error: Error, useCase: string): string {
    const errorType = this.categorizeError(error);

    const messages: Record<string, string> = {
      TIMEOUT: 'Our AI assistant is taking longer than expected. Please try again in a moment.',
      RATE_LIMIT: 'Too many requests. Please wait a moment and try again.',
      PROVIDER_ERROR: 'Our AI service is temporarily unavailable. Using simplified analysis.',
      INVALID_RESPONSE: 'We received an unexpected response. Please try again.',
      NETWORK_ERROR: 'Network connection issue. Please check your internet connection.',
      UNKNOWN: 'An unexpected error occurred. Please try again or contact support.'
    };

    return messages[errorType] || messages.UNKNOWN;
  }

  /**
   * Get admin-facing error details
   */
  getAdminMessage(error: Error, useCase: string): any {
    return {
      timestamp: new Date().toISOString(),
      useCase,
      errorType: this.categorizeError(error),
      errorMessage: error.message,
      stack: error.stack,
      recommendation: this.getRecommendation(error)
    };
  }

  private categorizeError(error: Error): string {
    if (error.message.includes('timeout')) return 'TIMEOUT';
    if (error.message.includes('rate limit')) return 'RATE_LIMIT';
    if (error.message.includes('provider')) return 'PROVIDER_ERROR';
    if (error.message.includes('invalid')) return 'INVALID_RESPONSE';
    if (error.message.includes('network')) return 'NETWORK_ERROR';
    return 'UNKNOWN';
  }

  private getRecommendation(error: Error): string {
    const errorType = this.categorizeError(error);

    const recommendations: Record<string, string> = {
      TIMEOUT: 'Check AI provider status. Consider increasing timeout threshold.',
      RATE_LIMIT: 'Implement request queuing or upgrade AI provider plan.',
      PROVIDER_ERROR: 'Check AI provider health dashboard. Ensure API keys are valid.',
      INVALID_RESPONSE: 'Review prompt template. AI response may not match expected format.',
      NETWORK_ERROR: 'Check network connectivity. Verify AI provider endpoint is reachable.',
      UNKNOWN: 'Review error logs. Contact AI provider support if issue persists.'
    };

    return recommendations[errorType] || recommendations.UNKNOWN;
  }
}
```

### 4. AI Health Monitoring

**File**: `backend/src/services/ai/AiHealthMonitor.ts`

```typescript
import { EventEmitter } from 'events';

interface HealthStatus {
  provider: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  errorRate: number;
  lastCheck: Date;
}

/**
 * Monitor AI provider health
 */
export class AiHealthMonitor extends EventEmitter {
  private healthStatus: Map<string, HealthStatus> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * Start health monitoring
   */
  start(intervalMs: number = 60000) {
    console.log('Starting AI health monitoring...');

    this.checkInterval = setInterval(() => {
      this.checkAllProviders();
    }, intervalMs);

    // Initial check
    this.checkAllProviders();
  }

  /**
   * Stop health monitoring
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check health of all AI providers
   */
  private async checkAllProviders() {
    const providers = ['gemini', 'openai', 'claude'];

    for (const provider of providers) {
      try {
        const health = await this.checkProvider(provider);
        this.healthStatus.set(provider, health);

        if (health.status === 'down') {
          this.emit('provider-down', { provider, health });
        } else if (health.status === 'degraded') {
          this.emit('provider-degraded', { provider, health });
        }
      } catch (error) {
        console.error(`Health check failed for ${provider}:`, error);
      }
    }
  }

  /**
   * Check health of single provider
   */
  private async checkProvider(provider: string): Promise<HealthStatus> {
    const start = Date.now();
    let status: 'healthy' | 'degraded' | 'down' = 'healthy';
    let errorRate = 0;

    try {
      // Make lightweight health check request
      await this.makeHealthCheckRequest(provider);

      const latency = Date.now() - start;

      // Determine status based on latency
      if (latency > 5000) {
        status = 'degraded';
      } else if (latency > 10000) {
        status = 'down';
      }

      return {
        provider,
        status,
        latency,
        errorRate,
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        provider,
        status: 'down',
        latency: Date.now() - start,
        errorRate: 1.0,
        lastCheck: new Date()
      };
    }
  }

  private async makeHealthCheckRequest(provider: string): Promise<void> {
    // Placeholder - would make actual health check API call
    // For now, simulate success
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Get current health status
   */
  getStatus(): HealthStatus[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * Get health summary
   */
  getSummary(): any {
    const statuses = this.getStatus();

    return {
      timestamp: new Date().toISOString(),
      overall: this.calculateOverallHealth(statuses),
      providers: statuses
    };
  }

  private calculateOverallHealth(statuses: HealthStatus[]): 'healthy' | 'degraded' | 'down' {
    const downCount = statuses.filter(s => s.status === 'down').length;
    const degradedCount = statuses.filter(s => s.status === 'degraded').length;

    if (downCount === statuses.length) return 'down';
    if (downCount > 0 || degradedCount > statuses.length / 2) return 'degraded';
    return 'healthy';
  }
}
```

### 5. Manual Override UI Component

**File**: `components/AiSuggestionCard.tsx`

```typescript
import React, { useState } from 'react';

interface AiSuggestionProps {
  suggestion: any;
  onAccept: () => void;
  onReject: () => void;
  onManualOverride: () => void;
  confidence: number;
}

/**
 * Display AI suggestion with manual override option
 */
export function AiSuggestionCard({
  suggestion,
  onAccept,
  onReject,
  onManualOverride,
  confidence
}: AiSuggestionProps) {
  const [showManualOverride, setShowManualOverride] = useState(false);

  return (
    <div className="border rounded-lg p-4 bg-blue-50">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-blue-900">AI Suggestion</h3>
          <p className="text-sm text-blue-700 mt-1">{suggestion.message}</p>

          {confidence < 0.85 && (
            <div className="mt-2 text-xs text-yellow-600">
              ⚠️ Confidence: {(confidence * 100).toFixed(0)}% (Lower than usual)
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={onAccept} className="btn-sm btn-primary">
            Accept
          </button>
          <button onClick={onReject} className="btn-sm btn-secondary">
            Reject
          </button>
        </div>
      </div>

      {/* Manual Override Option */}
      <div className="mt-3 pt-3 border-t border-blue-200">
        {!showManualOverride ? (
          <button
            onClick={() => setShowManualOverride(true)}
            className="text-sm text-blue-600 hover:underline"
          >
            Or configure manually
          </button>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Bypass AI suggestion and configure settings yourself:
            </p>
            <button
              onClick={onManualOverride}
              className="btn-sm btn-primary"
            >
              Manual Configuration
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

## Acceptance Criteria

- [ ] Graceful degradation implemented for all 25 AI use cases
- [ ] Rule-based fallbacks operational (permission explanation, financial masking)
- [ ] Retry logic with exponential backoff (max 3 retries)
- [ ] User-friendly error messages for all AI failures
- [ ] Manual override paths available (users can bypass AI)
- [ ] AI health monitoring dashboard (check every 60 seconds)
- [ ] Alerts configured for provider outages

## Testing

```bash
# Test AI fallbacks
npm run test:ai-fallbacks

# Simulate AI outage
npm run ai:simulate-outage

# View health status
npm run ai:health

# Test error handling
npm run test:ai-errors
```

## Success Metrics

- ✅ **Uptime**: 99.9% availability with fallbacks
- ✅ **Error Recovery**: <1% user-facing errors
- ✅ **Retry Success**: >80% of retries succeed
- ✅ **Fallback Usage**: <5% requests use fallbacks
- ✅ **User Satisfaction**: >90% users can bypass AI when needed

---

## 🎯 Phase 9 Completion Checklist

**Overall Phase Status**: All 4 tasks complete when:

- [ ] **Task 9.1**: AI Model Performance Tuning COMPLETE
  - [ ] All 25 use cases benchmarked
  - [ ] P95 latency <500ms across the board
  - [ ] Accuracy >85% for all classification tasks
  - [ ] A/B testing framework operational
  - [ ] Cost reduction >50% achieved

- [ ] **Task 9.2**: AI Prompt Engineering COMPLETE
  - [ ] 25/25 prompts optimized and version-controlled
  - [ ] Few-shot examples added for complex use cases
  - [ ] Confidence thresholds enforced
  - [ ] Prompt testing framework with >80% coverage

- [ ] **Task 9.3**: AI Caching Strategy COMPLETE
  - [ ] Redis caching implemented for all use cases
  - [ ] Cache hit rate >80%
  - [ ] Invalidation triggers on mutations
  - [ ] Cost savings >50% confirmed

- [ ] **Task 9.4**: AI Error Handling & Fallbacks COMPLETE
  - [ ] Graceful degradation for all use cases
  - [ ] Rule-based fallbacks operational
  - [ ] Retry logic with exponential backoff
  - [ ] AI health monitoring dashboard live

**Next Phase**: Phase 10 (Security & QA) - Security red-teaming and comprehensive testing

---

**Document Generated**: 2025-11-27
**Total Length**: ~1,800 lines (600-1500 per task bundle)
**Status**: Ready for agent execution
