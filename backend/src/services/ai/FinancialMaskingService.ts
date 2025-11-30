// backend/src/services/ai/FinancialMaskingService.ts
/**
 * Financial Masking Service
 *
 * Phase 7, Task 7.2 of ADR-005 Multi-Tenant Access Control
 * AI Use Case 17: Financial Data Masking with Relative Indicators
 *
 * Translates absolute cost data into relative indicators for users
 * without viewFinancialDetails capability. Provides decision-making
 * insights without exposing actual costs.
 *
 * Key Features:
 * - Percentile calculation within category
 * - Impact level classification (LOW/MODERATE/HIGH/CRITICAL)
 * - AI-generated cost optimization recommendations
 * - Portfolio-level insights
 * - 5-minute LRU cache for performance
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../../utils/logger';
import { lazyAiClient } from './AiProviderHelper';

// ============================================================================
// Types
// ============================================================================

export interface PfaRecordForMasking {
  id: string;
  description: string;
  category: string | null;
  class?: string | null;
  source: 'Rental' | 'Purchase';
  cost: number;
  monthlyRate?: number;
  purchasePrice?: number;
  duration?: number;
  forecastStart?: Date | null;
  forecastEnd?: Date | null;
  actualStart?: Date | null;
  actualEnd?: Date | null;
  isActualized?: boolean;
  [key: string]: any;
}

export interface MaskedPfaRecord extends Omit<PfaRecordForMasking, 'cost' | 'monthlyRate' | 'purchasePrice'> {
  cost: '***masked***';
  monthlyRate?: '***masked***';
  purchasePrice?: '***masked***';

  // Relative indicators (computed)
  impactLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  percentile: number; // 0-100 (95 = Top 5%)
  relativeComparison: string; // "3.2x average"
  impactDescription: string; // "Top 5% of crane costs"
  aiInsight: string; // AI-generated recommendation
}

export interface TranslateParams {
  userId: string;
  organizationId: string;
  records: PfaRecordForMasking[];
  viewFinancialDetails: boolean;
}

export interface PortfolioInsight {
  totalItems: number;
  highImpactCount: number;
  moderateImpactCount: number;
  lowImpactCount: number;
  criticalImpactCount: number;
  summary: string; // "3 high-impact items account for 42% of total budget"
  topCategoryByImpact?: string;
}

// ============================================================================
// Simple LRU Cache for Financial Masking
// ============================================================================

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

class SimpleLRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number = 500, ttlMinutes: number = 5) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    // Delete if exists (will be re-added at end)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// Financial Masking Service
// ============================================================================

class FinancialMaskingService {
  private cache: SimpleLRUCache<MaskedPfaRecord[]>;

  constructor() {
    // Cache masked records for 5 minutes (percentiles change infrequently)
    this.cache = new SimpleLRUCache<MaskedPfaRecord[]>(500, 5);
    // AI client is lazily loaded from database-configured providers
  }

  /**
   * Get AI client (lazy-loaded from database-configured providers)
   */
  private async getAiClient(): Promise<GoogleGenerativeAI | null> {
    return lazyAiClient.getClient();
  }

  /**
   * Translate financial data to relative indicators for masked users
   *
   * @returns Original records if user has viewFinancialDetails, masked records otherwise
   */
  async translateFinancialData(params: TranslateParams): Promise<{
    records: PfaRecordForMasking[] | MaskedPfaRecord[];
    masked: boolean;
    portfolioInsight: PortfolioInsight;
  }> {
    const { userId, organizationId, records, viewFinancialDetails } = params;

    // If user has viewFinancialDetails, return original records
    if (viewFinancialDetails) {
      logger.debug('[FinancialMaskingService] User has viewFinancialDetails - no masking');
      return {
        records,
        masked: false,
        portfolioInsight: this.calculatePortfolioInsight(records),
      };
    }

    // Check cache first
    const cacheKey = `${userId}:${organizationId}:${records.length}:${records[0]?.id || 'empty'}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      logger.debug(`[FinancialMaskingService] Cache hit for ${cacheKey}`);
      return {
        records: cached,
        masked: true,
        portfolioInsight: this.calculatePortfolioInsight(records),
      };
    }

    // Translate to relative indicators
    const maskedRecords = await this.maskRecords(records);

    // Cache result
    this.cache.set(cacheKey, maskedRecords);

    return {
      records: maskedRecords,
      masked: true,
      portfolioInsight: this.calculatePortfolioInsight(records),
    };
  }

  /**
   * Mask multiple records in parallel (with batching)
   */
  private async maskRecords(records: PfaRecordForMasking[]): Promise<MaskedPfaRecord[]> {
    // Process records in batches of 20 for AI insight generation
    const batchSize = 20;
    const results: MaskedPfaRecord[] = [];

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const maskedBatch = await Promise.all(
        batch.map(record => this.maskRecord(record, records))
      );
      results.push(...maskedBatch);
    }

    return results;
  }

  /**
   * Mask a single record with relative indicators
   */
  private async maskRecord(
    record: PfaRecordForMasking,
    allRecords: PfaRecordForMasking[]
  ): Promise<MaskedPfaRecord> {
    const cost = record.cost || 0;
    const category = record.category || 'Unknown';

    // Calculate percentile within category
    const percentile = this.calculatePercentile(cost, category, allRecords);

    // Determine impact level
    const impactLevel = this.getImpactLevel(percentile);

    // Calculate average cost for category
    const avgCost = this.calculateAverageCost(category, allRecords);

    // Generate relative comparison
    const relativeComparison = this.getRelativeComparison(cost, avgCost);

    // Generate impact description
    const impactDescription = this.getImpactDescription(percentile, category);

    // Generate AI insight (only for high-impact items to save API costs)
    const aiInsight = await this.generateAiInsight(record, percentile, avgCost, impactLevel);

    // Return masked record (spread first to preserve all fields, then override)
    const masked: MaskedPfaRecord = {
      ...record,
      cost: '***masked***',
      monthlyRate: record.source === 'Rental' ? '***masked***' : undefined,
      purchasePrice: record.source === 'Purchase' ? '***masked***' : undefined,

      // Relative indicators
      impactLevel,
      percentile,
      relativeComparison,
      impactDescription,
      aiInsight,
    };

    return masked;
  }

  /**
   * Calculate percentile within category (0-100)
   * Higher percentile = more expensive relative to category
   */
  private calculatePercentile(
    cost: number,
    category: string,
    allRecords: PfaRecordForMasking[]
  ): number {
    // Filter records in same category
    const categoryRecords = allRecords.filter(
      r => r.category?.toLowerCase() === category?.toLowerCase()
    );

    if (categoryRecords.length === 0) {
      return 50; // Default to median if no comparisons
    }

    // Sort by cost ascending and get costs array
    const sortedCosts = categoryRecords
      .map(r => r.cost || 0)
      .sort((a, b) => a - b);

    // Find position of current cost
    const position = sortedCosts.filter(c => c <= cost).length;

    // Calculate percentile (0-100)
    return Math.round((position / sortedCosts.length) * 100);
  }

  /**
   * Determine impact level based on percentile
   */
  private getImpactLevel(
    percentile: number
  ): 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
    if (percentile >= 90) return 'CRITICAL'; // Top 10%
    if (percentile >= 70) return 'HIGH';     // 70-90%
    if (percentile >= 50) return 'MODERATE'; // 50-70%
    return 'LOW';                            // Bottom 50%
  }

  /**
   * Calculate average cost for category
   */
  private calculateAverageCost(
    category: string,
    allRecords: PfaRecordForMasking[]
  ): number {
    const categoryRecords = allRecords.filter(
      r => r.category?.toLowerCase() === category?.toLowerCase()
    );

    if (categoryRecords.length === 0) return 0;

    const sum = categoryRecords.reduce((acc, r) => acc + (r.cost || 0), 0);
    return sum / categoryRecords.length;
  }

  /**
   * Generate relative comparison string
   */
  private getRelativeComparison(cost: number, avgCost: number): string {
    if (avgCost === 0) return 'No comparison data';

    const ratio = cost / avgCost;

    if (ratio >= 3) return `${ratio.toFixed(1)}x average`;
    if (ratio >= 1.5) return `${Math.round((ratio - 1) * 100)}% above average`;
    if (ratio >= 1.1) return `Slightly above average`;
    if (ratio >= 0.9) return 'Near average';
    if (ratio >= 0.5) return `${Math.round((1 - ratio) * 100)}% below average`;
    return 'Well below average';
  }

  /**
   * Generate impact description
   */
  private getImpactDescription(percentile: number, category: string): string {
    const categoryName = category?.toLowerCase() || 'equipment';

    if (percentile >= 95) return `Top 5% of ${categoryName} costs`;
    if (percentile >= 90) return `Top 10% of ${categoryName} costs`;
    if (percentile >= 75) return `Top 25% of ${categoryName} costs`;
    if (percentile >= 50) return `Above average for ${categoryName}`;
    if (percentile >= 25) return `Below average for ${categoryName}`;
    return `Well below average for ${categoryName}`;
  }

  /**
   * Generate AI insight using Google Gemini
   */
  private async generateAiInsight(
    record: PfaRecordForMasking,
    percentile: number,
    avgCost: number,
    impactLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
  ): Promise<string> {
    // Skip AI for low/moderate impact items (save API costs)
    if (impactLevel === 'LOW') {
      return 'This equipment is within typical budget range.';
    }

    if (impactLevel === 'MODERATE') {
      return 'This equipment has moderate budget impact. Consider reviewing if optimization is needed.';
    }

    // Only call AI for HIGH and CRITICAL impact items
    const genAI = await this.getAiClient();
    if (!genAI) {
      return this.generateFallbackInsight(impactLevel, record.source);
    }

    const prompt = `You are a cost optimization advisor for construction equipment.

Equipment Context:
- Description: ${record.description || 'Unknown equipment'}
- Category: ${record.category || 'Unknown'}
- Source: ${record.source || 'Unknown'} (Rental or Purchase)
- Duration: ${record.duration || 'Unknown'} days
- Budget Impact: Top ${100 - percentile}% (${impactLevel.toLowerCase()} impact)

Cost Analysis:
- This item is ${this.getRelativeComparison(record.cost || 0, avgCost)}
- Percentile: ${percentile}th within category

Instructions:
1. Explain WHY this equipment has high budget impact (1 sentence)
2. Suggest ONE actionable optimization (e.g., reduce duration, consider alternative model)
3. Be specific and constructive (avoid generic advice)
4. Keep response under 50 words
5. Do NOT mention specific dollar amounts

Response (plain text, no formatting):`;

    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 100,
        },
      });

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      // Truncate and sanitize response
      const sanitized = response
        .trim()
        .replace(/\$[\d,]+/g, '[amount]') // Remove any dollar amounts
        .substring(0, 200);

      return sanitized || this.generateFallbackInsight(impactLevel, record.source);
    } catch (error) {
      logger.error('[FinancialMaskingService] AI insight generation failed:', error);
      return this.generateFallbackInsight(impactLevel, record.source);
    }
  }

  /**
   * Fallback insight if AI unavailable
   */
  private generateFallbackInsight(
    impactLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL',
    source?: string
  ): string {
    if (impactLevel === 'CRITICAL') {
      return source === 'Rental'
        ? 'This equipment is significantly more expensive than typical rentals. Consider reviewing duration or exploring alternatives.'
        : 'This purchase price is significantly higher than typical equipment. Consider evaluating alternative models.';
    }

    if (impactLevel === 'HIGH') {
      return source === 'Rental'
        ? 'This rental cost is above average for this category. Review duration to optimize costs.'
        : 'This purchase price is above average. Evaluate if a lower-cost alternative meets requirements.';
    }

    return 'This equipment has moderate budget impact.';
  }

  /**
   * Calculate portfolio-level insights
   */
  private calculatePortfolioInsight(records: PfaRecordForMasking[]): PortfolioInsight {
    if (records.length === 0) {
      return {
        totalItems: 0,
        highImpactCount: 0,
        moderateImpactCount: 0,
        lowImpactCount: 0,
        criticalImpactCount: 0,
        summary: 'No equipment records to analyze',
      };
    }

    // Calculate percentiles for all records
    const recordsWithPercentiles = records.map(r => ({
      record: r,
      percentile: this.calculatePercentile(r.cost || 0, r.category || 'Unknown', records),
    }));

    const criticalImpactCount = recordsWithPercentiles.filter(r => r.percentile >= 90).length;
    const highImpactCount = recordsWithPercentiles.filter(r => r.percentile >= 70 && r.percentile < 90).length;
    const moderateImpactCount = recordsWithPercentiles.filter(r => r.percentile >= 50 && r.percentile < 70).length;
    const lowImpactCount = recordsWithPercentiles.filter(r => r.percentile < 50).length;

    // Calculate total cost and high-impact cost (for % calculations)
    const totalCost = records.reduce((sum, r) => sum + (r.cost || 0), 0);
    const highImpactCost = recordsWithPercentiles
      .filter(r => r.percentile >= 70)
      .reduce((sum, r) => sum + (r.record.cost || 0), 0);

    const highImpactPct = totalCost > 0 ? Math.round((highImpactCost / totalCost) * 100) : 0;

    // Find top category by impact
    const categoryImpact = new Map<string, number>();
    recordsWithPercentiles
      .filter(r => r.percentile >= 70)
      .forEach(r => {
        const category = r.record.category || 'Unknown';
        categoryImpact.set(category, (categoryImpact.get(category) || 0) + 1);
      });

    let topCategoryByImpact: string | undefined;
    let maxImpactCount = 0;
    categoryImpact.forEach((count, category) => {
      if (count > maxImpactCount) {
        maxImpactCount = count;
        topCategoryByImpact = category;
      }
    });

    // Generate summary
    const totalHighImpact = criticalImpactCount + highImpactCount;
    let summary: string;

    if (totalHighImpact === 0) {
      summary = 'All items are within typical budget range';
    } else {
      summary = `${totalHighImpact} high-impact items account for ${highImpactPct}% of total budget`;
      if (topCategoryByImpact) {
        summary += `. Top category: ${topCategoryByImpact}`;
      }
    }

    return {
      totalItems: records.length,
      criticalImpactCount,
      highImpactCount,
      moderateImpactCount,
      lowImpactCount,
      summary,
      topCategoryByImpact,
    };
  }

  /**
   * Clear the cache (useful for testing or when data changes)
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('[FinancialMaskingService] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number } {
    return {
      size: this.cache.size,
    };
  }
}

// Export singleton instance
export const financialMaskingService = new FinancialMaskingService();

export default financialMaskingService;
