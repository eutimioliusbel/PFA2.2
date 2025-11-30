// backend/src/services/ai/ModelSelector.ts
/**
 * AI Model Selector
 *
 * Phase 9, Task 9.1 of ADR-005 Multi-Tenant Access Control
 * Intelligent model selection based on use case requirements
 *
 * Features:
 * - Selects optimal model based on latency, accuracy, and cost requirements
 * - Supports multiple providers (Gemini, OpenAI, Claude)
 * - Generates cost comparison reports
 * - Optimizes for 50%+ cost reduction vs baseline
 */

import { logger } from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export type AiProvider = 'gemini' | 'openai' | 'claude';

export interface ModelConfig {
  id: string;
  provider: AiProvider;
  model: string;
  costPer1kInputTokens: number; // USD
  costPer1kOutputTokens: number; // USD
  avgLatencyMs: number;
  accuracy: number; // 0-1
  maxTokens: number;
  contextWindow: number;
  capabilities: string[]; // ['text', 'json', 'vision', 'function_calling']
}

export interface UseCaseRequirements {
  maxLatencyMs: number;
  minAccuracy: number;
  prioritizeCost: boolean;
  requiredCapabilities: string[];
}

export interface CostReport {
  totalCost: string;
  savingsVsBaseline: string;
  savingsPercent: string;
  breakdown: Array<{
    useCase: string;
    model: string;
    requestCount: number;
    avgTokens: number;
    cost: string;
    baselineCost: string;
    savings: string;
    savingsPercent: string;
  }>;
}

// ============================================================================
// Model Configurations
// ============================================================================

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  // Gemini Models
  'gemini-flash': {
    id: 'gemini-flash',
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    costPer1kInputTokens: 0.000075, // $0.075 per 1M
    costPer1kOutputTokens: 0.0003, // $0.30 per 1M
    avgLatencyMs: 150,
    accuracy: 0.82,
    maxTokens: 8192,
    contextWindow: 1000000,
    capabilities: ['text', 'json', 'vision', 'function_calling'],
  },
  'gemini-pro': {
    id: 'gemini-pro',
    provider: 'gemini',
    model: 'gemini-1.5-pro',
    costPer1kInputTokens: 0.00125, // $1.25 per 1M
    costPer1kOutputTokens: 0.005, // $5.00 per 1M
    avgLatencyMs: 400,
    accuracy: 0.91,
    maxTokens: 8192,
    contextWindow: 2000000,
    capabilities: ['text', 'json', 'vision', 'function_calling'],
  },

  // OpenAI Models
  'gpt-4-turbo': {
    id: 'gpt-4-turbo',
    provider: 'openai',
    model: 'gpt-4-turbo',
    costPer1kInputTokens: 0.01, // $10 per 1M
    costPer1kOutputTokens: 0.03, // $30 per 1M
    avgLatencyMs: 800,
    accuracy: 0.95,
    maxTokens: 4096,
    contextWindow: 128000,
    capabilities: ['text', 'json', 'vision', 'function_calling'],
  },
  'gpt-4o': {
    id: 'gpt-4o',
    provider: 'openai',
    model: 'gpt-4o',
    costPer1kInputTokens: 0.005, // $5 per 1M
    costPer1kOutputTokens: 0.015, // $15 per 1M
    avgLatencyMs: 500,
    accuracy: 0.93,
    maxTokens: 4096,
    contextWindow: 128000,
    capabilities: ['text', 'json', 'vision', 'function_calling'],
  },
  'gpt-3.5-turbo': {
    id: 'gpt-3.5-turbo',
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    costPer1kInputTokens: 0.0005, // $0.50 per 1M
    costPer1kOutputTokens: 0.0015, // $1.50 per 1M
    avgLatencyMs: 200,
    accuracy: 0.80,
    maxTokens: 4096,
    contextWindow: 16385,
    capabilities: ['text', 'json', 'function_calling'],
  },

  // Claude Models
  'claude-haiku': {
    id: 'claude-haiku',
    provider: 'claude',
    model: 'claude-3-haiku-20240307',
    costPer1kInputTokens: 0.00025, // $0.25 per 1M
    costPer1kOutputTokens: 0.00125, // $1.25 per 1M
    avgLatencyMs: 100,
    accuracy: 0.85,
    maxTokens: 4096,
    contextWindow: 200000,
    capabilities: ['text', 'json', 'vision'],
  },
  'claude-sonnet': {
    id: 'claude-sonnet',
    provider: 'claude',
    model: 'claude-sonnet-4-20250514',
    costPer1kInputTokens: 0.003, // $3 per 1M
    costPer1kOutputTokens: 0.015, // $15 per 1M
    avgLatencyMs: 400,
    accuracy: 0.92,
    maxTokens: 4096,
    contextWindow: 200000,
    capabilities: ['text', 'json', 'vision', 'function_calling'],
  },
};

// ============================================================================
// Use Case Requirements
// ============================================================================

const USE_CASE_REQUIREMENTS: Record<string, UseCaseRequirements> = {
  // Phase 7 - UX Intelligence
  'permission-explanation': {
    maxLatencyMs: 200,
    minAccuracy: 0.90,
    prioritizeCost: false,
    requiredCapabilities: ['text', 'json'],
  },
  'financial-masking': {
    maxLatencyMs: 100,
    minAccuracy: 0.85,
    prioritizeCost: true, // High volume, optimize cost
    requiredCapabilities: ['text'],
  },
  'semantic-audit-search': {
    maxLatencyMs: 500,
    minAccuracy: 0.80,
    prioritizeCost: false,
    requiredCapabilities: ['text', 'json'],
  },
  'role-drift-detection': {
    maxLatencyMs: 1000,
    minAccuracy: 0.90,
    prioritizeCost: true, // Batch processing
    requiredCapabilities: ['text', 'json'],
  },
  'notification-routing': {
    maxLatencyMs: 200,
    minAccuracy: 0.85,
    prioritizeCost: true, // High volume
    requiredCapabilities: ['text'],
  },

  // Phase 8 - BEO Analytics (if implemented)
  'beo-analytics': {
    maxLatencyMs: 3000,
    minAccuracy: 0.92,
    prioritizeCost: false, // Executive experience
    requiredCapabilities: ['text', 'json'],
  },
  'narrative-variance': {
    maxLatencyMs: 2000,
    minAccuracy: 0.90,
    prioritizeCost: false,
    requiredCapabilities: ['text'],
  },
  'asset-arbitrage': {
    maxLatencyMs: 1500,
    minAccuracy: 0.88,
    prioritizeCost: false,
    requiredCapabilities: ['text', 'json'],
  },
  'vendor-watchdog': {
    maxLatencyMs: 1000,
    minAccuracy: 0.85,
    prioritizeCost: true,
    requiredCapabilities: ['text', 'json'],
  },
  'scenario-simulator': {
    maxLatencyMs: 5000,
    minAccuracy: 0.93,
    prioritizeCost: false,
    requiredCapabilities: ['text', 'json'],
  },

  // Default fallback
  'default': {
    maxLatencyMs: 1000,
    minAccuracy: 0.85,
    prioritizeCost: true,
    requiredCapabilities: ['text'],
  },
};

// ============================================================================
// ModelSelector Class
// ============================================================================

export class ModelSelector {
  private baselineModel: ModelConfig;

  constructor() {
    // Use GPT-4 Turbo as baseline for cost comparison
    this.baselineModel = MODEL_CONFIGS['gpt-4-turbo'];
  }

  /**
   * Select optimal model for a given use case
   */
  selectModel(useCase: string): ModelConfig {
    const requirements = USE_CASE_REQUIREMENTS[useCase] || USE_CASE_REQUIREMENTS['default'];

    // Filter models that meet requirements
    const candidates = Object.values(MODEL_CONFIGS).filter(model => {
      // Check latency
      if (model.avgLatencyMs > requirements.maxLatencyMs) return false;

      // Check accuracy
      if (model.accuracy < requirements.minAccuracy) return false;

      // Check capabilities
      const hasAllCapabilities = requirements.requiredCapabilities.every(
        cap => model.capabilities.includes(cap)
      );
      if (!hasAllCapabilities) return false;

      return true;
    });

    if (candidates.length === 0) {
      logger.warn(`No model meets requirements for ${useCase}, using baseline`);
      return this.baselineModel;
    }

    // Sort by cost if prioritizing cost, otherwise by accuracy
    if (requirements.prioritizeCost) {
      candidates.sort((a, b) => this.calculateAvgCost(a) - this.calculateAvgCost(b));
    } else {
      // Sort by accuracy (descending), then by latency (ascending)
      candidates.sort((a, b) => {
        if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
        return a.avgLatencyMs - b.avgLatencyMs;
      });
    }

    logger.debug(`Selected model for ${useCase}: ${candidates[0].model}`);
    return candidates[0];
  }

  /**
   * Get all available models
   */
  getAvailableModels(): ModelConfig[] {
    return Object.values(MODEL_CONFIGS);
  }

  /**
   * Get model by ID
   */
  getModel(modelId: string): ModelConfig | undefined {
    return MODEL_CONFIGS[modelId];
  }

  /**
   * Calculate average cost per request (assuming 500 input, 200 output tokens)
   */
  private calculateAvgCost(model: ModelConfig, inputTokens = 500, outputTokens = 200): number {
    return (
      (inputTokens * model.costPer1kInputTokens) / 1000 +
      (outputTokens * model.costPer1kOutputTokens) / 1000
    );
  }

  /**
   * Generate cost comparison report
   */
  generateCostReport(usageStats: Record<string, { requestCount: number; avgTokens?: number }>): CostReport {
    let totalCost = 0;
    let totalBaselineCost = 0;
    const breakdown: CostReport['breakdown'] = [];

    for (const [useCase, stats] of Object.entries(usageStats)) {
      const selectedModel = this.selectModel(useCase);
      const avgTokens = stats.avgTokens || 500;
      const inputTokens = avgTokens * 0.7; // Estimate 70% input
      const outputTokens = avgTokens * 0.3; // Estimate 30% output

      // Calculate actual cost with selected model
      const cost =
        stats.requestCount *
        (
          (inputTokens * selectedModel.costPer1kInputTokens) / 1000 +
          (outputTokens * selectedModel.costPer1kOutputTokens) / 1000
        );

      // Calculate baseline cost (if using GPT-4 Turbo for everything)
      const baselineCost =
        stats.requestCount *
        (
          (inputTokens * this.baselineModel.costPer1kInputTokens) / 1000 +
          (outputTokens * this.baselineModel.costPer1kOutputTokens) / 1000
        );

      const savings = baselineCost - cost;
      const savingsPercent = baselineCost > 0 ? (savings / baselineCost) * 100 : 0;

      totalCost += cost;
      totalBaselineCost += baselineCost;

      breakdown.push({
        useCase,
        model: selectedModel.model,
        requestCount: stats.requestCount,
        avgTokens,
        cost: `$${cost.toFixed(4)}`,
        baselineCost: `$${baselineCost.toFixed(4)}`,
        savings: `$${savings.toFixed(4)}`,
        savingsPercent: `${savingsPercent.toFixed(1)}%`,
      });
    }

    const totalSavings = totalBaselineCost - totalCost;
    const totalSavingsPercent = totalBaselineCost > 0 ? (totalSavings / totalBaselineCost) * 100 : 0;

    return {
      totalCost: `$${totalCost.toFixed(4)}`,
      savingsVsBaseline: `$${totalSavings.toFixed(4)}`,
      savingsPercent: `${totalSavingsPercent.toFixed(1)}%`,
      breakdown,
    };
  }

  /**
   * Get use case requirements
   */
  getUseCaseRequirements(useCase: string): UseCaseRequirements {
    return USE_CASE_REQUIREMENTS[useCase] || USE_CASE_REQUIREMENTS['default'];
  }

  /**
   * Get all supported use cases
   */
  getSupportedUseCases(): string[] {
    return Object.keys(USE_CASE_REQUIREMENTS).filter(uc => uc !== 'default');
  }
}

// Export singleton instance
export const modelSelector = new ModelSelector();

export default modelSelector;
