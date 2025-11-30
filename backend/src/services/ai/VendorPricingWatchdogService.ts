/**
 * Vendor Pricing Watchdog Service
 *
 * AI-powered vendor pricing analysis system that:
 * - Monitors equipment rental rates across organizations
 * - Detects pricing discrepancies (vendors charging >15% above market avg)
 * - Tracks month-over-month rate changes
 * - Generates vendor performance scorecards
 *
 * Phase 8, Task 8.4 (UC-24) of ADR-005 Multi-Tenant Access Control
 */

import prisma from '../../config/database';
import { logger } from '../../utils/logger';
import { randomUUID } from 'crypto';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface VendorCategoryData {
  vendorName: string;
  category: string;
  avgMonthlyRate: number;
  equipmentCount: number;
  organizationIds: string[];
}

interface MarketData {
  category: string;
  marketAvgRate: number;
  vendors: VendorCategoryData[];
}

interface PricingAnomaly {
  type: 'overpriced' | 'suspicious_increase' | 'market_shift';
  severity: 'high' | 'medium' | 'low';
  vendorName: string;
  category: string;
  organizationId: string;
  currentRate: number;
  marketRate: number;
  deviationPercent: number;
  recommendation: string;
}

interface VendorScorecard {
  vendorName: string;
  priceCompetitiveness: number; // 0-1
  rateStability: number; // 0-1
  equipmentCoverage: number; // 0-1
  overallScore: number; // 0-1
  rank: number;
  categories: string[];
}

interface PricingAnalysisResult {
  marketData: MarketData[];
  anomalies: PricingAnomaly[];
  vendorScorecards: VendorScorecard[];
  summary: {
    totalVendors: number;
    totalCategories: number;
    anomaliesDetected: number;
    avgDeviationPercent: number;
  };
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class VendorPricingWatchdogService {

  /**
   * Analyze vendor pricing across all organizations
   * Returns market data, anomalies, and vendor scorecards
   */
  async analyzeVendorPricing(): Promise<PricingAnalysisResult> {
    const startTime = Date.now();
    logger.info('Starting vendor pricing analysis');

    try {
      // Step 1: Query all rental PFA records
      const rentalRecords = await prisma.pfa_records.findMany({
        where: {
          source: 'Rental',
          monthlyRate: { not: null },
          vendorName: { not: null },
          category: { not: null },
          isDiscontinued: false,
        },
        select: {
          id: true,
          vendorName: true,
          category: true,
          monthlyRate: true,
          organizationId: true,
          createdAt: true,
        },
      });

      logger.info(`Found ${rentalRecords.length} rental records for analysis`);

      // Step 2: Group by vendor and category
      const vendorCategoryMap = new Map<string, VendorCategoryData>();

      for (const record of rentalRecords) {
        const key = `${record.vendorName}|${record.category}`;

        if (!vendorCategoryMap.has(key)) {
          vendorCategoryMap.set(key, {
            vendorName: record.vendorName!,
            category: record.category!,
            avgMonthlyRate: 0,
            equipmentCount: 0,
            organizationIds: [],
          });
        }

        const data = vendorCategoryMap.get(key)!;
        data.equipmentCount++;
        data.avgMonthlyRate += record.monthlyRate!;

        if (!data.organizationIds.includes(record.organizationId)) {
          data.organizationIds.push(record.organizationId);
        }
      }

      // Calculate averages
      for (const data of vendorCategoryMap.values()) {
        data.avgMonthlyRate = data.avgMonthlyRate / data.equipmentCount;
      }

      // Step 3: Group by category for market analysis
      const categoryMap = new Map<string, MarketData>();

      for (const data of vendorCategoryMap.values()) {
        if (!categoryMap.has(data.category)) {
          categoryMap.set(data.category, {
            category: data.category,
            marketAvgRate: 0,
            vendors: [],
          });
        }

        const marketData = categoryMap.get(data.category)!;
        marketData.vendors.push(data);
      }

      // Calculate market averages
      for (const marketData of categoryMap.values()) {
        const totalRate = marketData.vendors.reduce((sum, v) => sum + v.avgMonthlyRate, 0);
        marketData.marketAvgRate = totalRate / marketData.vendors.length;
      }

      const marketData = Array.from(categoryMap.values());

      // Step 4: Detect anomalies
      const anomalies = await this.detectAnomalies(marketData);

      // Step 5: Calculate vendor scorecards
      const vendorScorecards = await this.calculateVendorScorecard(marketData);

      // Step 6: Calculate summary statistics
      const uniqueVendors = new Set(rentalRecords.map((r: any) => r.vendorName!));
      const uniqueCategories = new Set(rentalRecords.map((r: any) => r.category!));
      const avgDeviation = anomalies.length > 0
        ? anomalies.reduce((sum, a) => sum + Math.abs(a.deviationPercent), 0) / anomalies.length
        : 0;

      const summary = {
        totalVendors: uniqueVendors.size,
        totalCategories: uniqueCategories.size,
        anomaliesDetected: anomalies.length,
        avgDeviationPercent: avgDeviation,
      };

      const duration = Date.now() - startTime;
      logger.info(`Vendor pricing analysis completed in ${duration}ms`);

      return {
        marketData,
        anomalies,
        vendorScorecards,
        summary,
      };

    } catch (error) {
      logger.error('Error in vendor pricing analysis:', error);
      throw error;
    }
  }

  /**
   * Detect pricing anomalies
   * - Overpriced: Vendor charges >15% above market avg
   * - Suspicious Increase: MoM change >10%
   * - Market Shift: All vendors increased >5%
   */
  private async detectAnomalies(marketData: MarketData[]): Promise<PricingAnomaly[]> {
    const anomalies: PricingAnomaly[] = [];
    const OVERPRICED_THRESHOLD = 0.15; // 15%
    // Note: SUSPICIOUS_INCREASE_THRESHOLD (0.10 / 10%) used in detectSuspiciousIncreases method

    for (const market of marketData) {
      // Detect overpriced vendors
      for (const vendor of market.vendors) {
        const deviation = (vendor.avgMonthlyRate - market.marketAvgRate) / market.marketAvgRate;

        if (deviation > OVERPRICED_THRESHOLD) {
          const severity = deviation > 0.30 ? 'high' : deviation > 0.20 ? 'medium' : 'low';

          // Create anomaly for each affected organization
          for (const orgId of vendor.organizationIds) {
            anomalies.push({
              type: 'overpriced',
              severity,
              vendorName: vendor.vendorName,
              category: market.category,
              organizationId: orgId,
              currentRate: vendor.avgMonthlyRate,
              marketRate: market.marketAvgRate,
              deviationPercent: deviation * 100,
              recommendation: this.generateRecommendation(
                'overpriced',
                vendor.vendorName,
                market.category,
                deviation * 100,
                market.marketAvgRate
              ),
            });
          }
        }
      }

      // Detect suspicious month-over-month increases
      await this.detectSuspiciousIncreases(market, anomalies);
    }

    return anomalies;
  }

  /**
   * Detect suspicious month-over-month rate increases
   */
  private async detectSuspiciousIncreases(
    market: MarketData,
    anomalies: PricingAnomaly[]
  ): Promise<void> {
    const SUSPICIOUS_INCREASE_THRESHOLD = 0.10; // 10%
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    for (const vendor of market.vendors) {
      // Get historical snapshot from 30 days ago
      const historicalSnapshot = await prisma.vendor_pricing_snapshots.findFirst({
        where: {
          vendorName: vendor.vendorName,
          category: market.category,
          snapshotDate: { lte: thirtyDaysAgo },
        },
        orderBy: {
          snapshotDate: 'desc',
        },
      });

      if (historicalSnapshot) {
        const previousRate = historicalSnapshot.avgMonthlyRate;
        const currentRate = vendor.avgMonthlyRate;
        const increase = (currentRate - previousRate) / previousRate;

        if (increase > SUSPICIOUS_INCREASE_THRESHOLD) {
          const severity = increase > 0.20 ? 'high' : increase > 0.15 ? 'medium' : 'low';

          for (const orgId of vendor.organizationIds) {
            anomalies.push({
              type: 'suspicious_increase',
              severity,
              vendorName: vendor.vendorName,
              category: market.category,
              organizationId: orgId,
              currentRate,
              marketRate: market.marketAvgRate,
              deviationPercent: increase * 100,
              recommendation: this.generateRecommendation(
                'suspicious_increase',
                vendor.vendorName,
                market.category,
                increase * 100,
                previousRate
              ),
            });
          }
        }
      }
    }
  }

  /**
   * Generate AI-style recommendation text for anomaly
   */
  private generateRecommendation(
    type: 'overpriced' | 'suspicious_increase' | 'market_shift',
    vendorName: string,
    category: string,
    percent: number,
    comparisonRate: number
  ): string {
    const percentStr = `${percent.toFixed(1)}%`;
    const rateStr = `$${comparisonRate.toLocaleString()}`;

    if (type === 'overpriced') {
      return `${vendorName} is charging ${percentStr} above market average (${rateStr}/mo) for ${category}. Consider renegotiating or switching vendors.`;
    } else if (type === 'suspicious_increase') {
      return `${vendorName} increased rates for ${category} by ${percentStr} in the last 30 days (was ${rateStr}/mo). Investigate cause and consider renegotiation.`;
    } else {
      return `Industry-wide rate increase detected for ${category}. Multiple vendors raised prices by ${percentStr}. Budget adjustment may be required.`;
    }
  }

  /**
   * Calculate vendor performance scorecard
   * Scores based on: price competitiveness (40%), rate stability (30%), equipment coverage (30%)
   */
  private async calculateVendorScorecard(marketData: MarketData[]): Promise<VendorScorecard[]> {
    const vendorMap = new Map<string, {
      categories: Set<string>;
      totalCompetitiveness: number;
      totalStability: number;
      count: number;
    }>();

    // Calculate total categories across all markets
    const totalCategories = marketData.length;

    // Build vendor data
    for (const market of marketData) {
      // Find highest rate in this category for normalization
      const highestRate = Math.max(...market.vendors.map(v => v.avgMonthlyRate));

      for (const vendor of market.vendors) {
        if (!vendorMap.has(vendor.vendorName)) {
          vendorMap.set(vendor.vendorName, {
            categories: new Set(),
            totalCompetitiveness: 0,
            totalStability: 0,
            count: 0,
          });
        }

        const data = vendorMap.get(vendor.vendorName)!;
        data.categories.add(market.category);

        // Price competitiveness: Lower price = higher score
        const competitiveness = 1 - (vendor.avgMonthlyRate / highestRate);
        data.totalCompetitiveness += competitiveness;

        // Rate stability: Check historical variance (mock for now)
        const stability = await this.calculateRateStability(vendor.vendorName, market.category);
        data.totalStability += stability;

        data.count++;
      }
    }

    // Calculate final scores
    const scorecards: VendorScorecard[] = [];

    for (const [vendorName, data] of vendorMap.entries()) {
      const avgCompetitiveness = data.totalCompetitiveness / data.count;
      const avgStability = data.totalStability / data.count;
      const coverage = data.categories.size / totalCategories;

      const overallScore =
        avgCompetitiveness * 0.40 +
        avgStability * 0.30 +
        coverage * 0.30;

      scorecards.push({
        vendorName,
        priceCompetitiveness: avgCompetitiveness,
        rateStability: avgStability,
        equipmentCoverage: coverage,
        overallScore,
        rank: 0, // Will be set after sorting
        categories: Array.from(data.categories),
      });
    }

    // Sort by overall score and assign ranks
    scorecards.sort((a, b) => b.overallScore - a.overallScore);
    scorecards.forEach((scorecard, index) => {
      scorecard.rank = index + 1;
    });

    return scorecards;
  }

  /**
   * Calculate rate stability for a vendor/category combo
   * Returns 0-1 score based on historical variance (1 = most stable)
   */
  private async calculateRateStability(vendorName: string, category: string): Promise<number> {
    // Get last 3 months of snapshots
    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const snapshots = await prisma.vendor_pricing_snapshots.findMany({
      where: {
        vendorName,
        category,
        snapshotDate: { gte: threeMonthsAgo },
      },
      orderBy: {
        snapshotDate: 'asc',
      },
    });

    if (snapshots.length < 2) {
      // Not enough data, assume moderate stability
      return 0.7;
    }

    // Calculate standard deviation of rates
    const rates = snapshots.map((s: any) => s.avgMonthlyRate);
    const mean = rates.reduce((sum: number, r: number) => sum + r, 0) / rates.length;
    const variance = rates.reduce((sum: number, r: number) => sum + Math.pow(r - mean, 2), 0) / rates.length;
    const stdDev = Math.sqrt(variance);

    // Normalize: Lower stdDev relative to mean = higher stability
    const coefficientOfVariation = stdDev / mean;

    // Convert to 0-1 scale (0.1 CV or higher = 0 stability, 0 CV = 1 stability)
    const stability = Math.max(0, 1 - (coefficientOfVariation / 0.1));

    return stability;
  }

  /**
   * Track current pricing data as historical snapshot
   * Should be called daily via background job
   */
  async createPricingSnapshot(): Promise<void> {
    logger.info('Creating vendor pricing snapshot');

    try {
      // Query all rental records
      const rentalRecords = await prisma.pfa_records.findMany({
        where: {
          source: 'Rental',
          monthlyRate: { not: null },
          vendorName: { not: null },
          category: { not: null },
          isDiscontinued: false,
        },
        select: {
          vendorName: true,
          category: true,
          monthlyRate: true,
          organizationId: true,
        },
      });

      // Group by vendor and category
      const vendorCategoryMap = new Map<string, {
        vendorName: string;
        category: string;
        totalRate: number;
        count: number;
        organizationIds: Set<string>;
      }>();

      for (const record of rentalRecords) {
        const key = `${record.vendorName}|${record.category}`;

        if (!vendorCategoryMap.has(key)) {
          vendorCategoryMap.set(key, {
            vendorName: record.vendorName!,
            category: record.category!,
            totalRate: 0,
            count: 0,
            organizationIds: new Set(),
          });
        }

        const data = vendorCategoryMap.get(key)!;
        data.totalRate += record.monthlyRate!;
        data.count++;
        data.organizationIds.add(record.organizationId);
      }

      // Create snapshots
      const snapshots = Array.from(vendorCategoryMap.values()).map(data => ({
        id: randomUUID(),
        vendorName: data.vendorName,
        category: data.category,
        avgMonthlyRate: data.totalRate / data.count,
        equipmentCount: data.count,
        organizationIds: JSON.stringify(Array.from(data.organizationIds)),
      }));

      // Batch insert
      await prisma.vendor_pricing_snapshots.createMany({
        data: snapshots,
      });

      logger.info(`Created ${snapshots.length} vendor pricing snapshots`);

    } catch (error) {
      logger.error('Error creating pricing snapshot:', error);
      throw error;
    }
  }

  /**
   * Persist detected anomalies to database
   */
  async persistAnomalies(anomalies: PricingAnomaly[]): Promise<void> {
    logger.info(`Persisting ${anomalies.length} pricing anomalies`);

    try {
      // Delete old active anomalies (to avoid duplicates)
      await prisma.pricing_anomalies.deleteMany({
        where: {
          status: 'active',
        },
      });

      // Insert new anomalies
      await prisma.pricing_anomalies.createMany({
        data: anomalies.map(anomaly => ({
          id: randomUUID(),
          ...anomaly,
        })),
      });

      logger.info('Anomalies persisted successfully');

    } catch (error) {
      logger.error('Error persisting anomalies:', error);
      throw error;
    }
  }

  /**
   * Get active pricing anomalies
   */
  async getActiveAnomalies(): Promise<any[]> {
    return prisma.pricing_anomalies.findMany({
      where: {
        status: 'active',
      },
      orderBy: [
        { severity: 'desc' },
        { deviationPercent: 'desc' },
      ],
    });
  }

  /**
   * Dismiss a pricing anomaly
   */
  async dismissAnomaly(anomalyId: string, userId: string): Promise<void> {
    await prisma.pricing_anomalies.update({
      where: { id: anomalyId },
      data: {
        status: 'dismissed',
        resolvedAt: new Date(),
        resolvedBy: userId,
      },
    });

    logger.info(`Anomaly ${anomalyId} dismissed by user ${userId}`);
  }
}
