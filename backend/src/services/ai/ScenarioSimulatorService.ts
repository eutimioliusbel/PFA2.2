/**
 * @file ScenarioSimulatorService.ts
 * @description AI-powered what-if scenario simulator for BEO executives
 *
 * Capabilities:
 * - Timeline shift analysis (weather delays, schedule changes)
 * - Vendor switch impact modeling
 * - Equipment consolidation scenarios
 * - Budget cut simulations
 * - Monte Carlo risk analysis (1,000+ iterations)
 *
 * Performance targets:
 * - Single scenario: <5 seconds
 * - Monte Carlo: <30 seconds (1,000 iterations)
 */

import { PrismaClient } from '@prisma/client';
import logger from '../../utils/logger';

const prisma = new PrismaClient();

// Types
interface ScenarioParameters {
  type: 'timeline_shift' | 'vendor_switch' | 'consolidation' | 'budget_cut' | 'weather_delay';
  shiftDays?: number;
  targetVendor?: string;
  sourceVendor?: string;
  consolidationPercent?: number;
  budgetCutPercent?: number;
  monteCarloEnabled?: boolean;
  iterations?: number;
}

interface PfaRecord {
  id: string;
  equipment: string | null;
  category: string | null;
  forecastStart: Date | null;
  forecastEnd: Date | null;
  monthlyRate: number | null;
  source: string | null;
  vendorName: string | null;
  organizationId: string;
}

interface Metrics {
  totalCost: number;
  totalDuration: number;
  equipmentCount: number;
  avgMonthlyRate: number;
}

interface ImpactSummary {
  costDelta: number;
  costDeltaPercent: number;
  durationDelta: number;
  durationDeltaPercent: number;
  equipmentDelta: number;
  equipmentDeltaPercent: number;
}

interface MonteCarloResult {
  p10: number;
  p50: number;
  p90: number;
  mean: number;
  stdDev: number;
  distribution: number[];
}

interface ScenarioResult {
  scenarioId: string;
  scenarioType: string;
  parameters: ScenarioParameters;
  baselineMetrics: Metrics;
  scenarioMetrics: Metrics;
  impact: ImpactSummary;
  riskAnalysis?: MonteCarloResult;
  timeline: TimelineComparison;
  createdAt: Date;
}

interface TimelineComparison {
  baseline: TimelineData[];
  scenario: TimelineData[];
}

interface TimelineData {
  equipmentId: string;
  equipment: string | null;
  start: Date | null;
  end: Date | null;
  cost: number;
}

/**
 * Scenario Simulator Service
 * Implements what-if analysis with Monte Carlo simulation
 */
export class ScenarioSimulatorService {
  /**
   * Run scenario simulation
   *
   * @param organizationIds - Organizations to include
   * @param parameters - Scenario configuration
   * @param userId - User running simulation
   * @returns Scenario result with impact analysis
   */
  async simulateScenario(
    organizationIds: string[],
    parameters: ScenarioParameters,
    userId: string
  ): Promise<ScenarioResult> {
    const startTime = Date.now();

    // 1. Load baseline PFA data
    const baselinePfas = await this.loadPfaData(organizationIds);

    // 2. Calculate baseline metrics
    const baselineMetrics = this.calculateMetrics(baselinePfas);

    // 3. Apply scenario transformations
    let scenarioPfas: PfaRecord[];
    let riskAnalysis: MonteCarloResult | undefined;

    if (parameters.monteCarloEnabled && parameters.iterations && parameters.iterations > 0) {
      // Run Monte Carlo simulation
      const mcResult = await this.runMonteCarloSimulation(
        baselinePfas,
        parameters,
        parameters.iterations
      );

      // Use median scenario for comparison
      scenarioPfas = mcResult.medianScenario;
      riskAnalysis = mcResult.analysis;
    } else {
      // Single scenario run
      scenarioPfas = this.applyScenarioTransformations(baselinePfas, parameters);
    }

    // 4. Calculate scenario metrics
    const scenarioMetrics = this.calculateMetrics(scenarioPfas);

    // 5. Calculate impact
    const impact = this.calculateImpact(baselineMetrics, scenarioMetrics);

    // 6. Generate timeline comparison
    const timeline = this.generateTimelineComparison(baselinePfas, scenarioPfas);

    // 7. Save scenario to database
    const scenarioId = await this.saveScenario({
      scenarioType: parameters.type,
      organizationIds,
      parameters,
      baselineMetrics,
      scenarioMetrics,
      impact,
      riskAnalysis,
      timeline,
      createdBy: userId,
    });

    const duration = Date.now() - startTime;
    logger.debug(`Scenario simulation completed in ${duration}ms`);

    return {
      scenarioId,
      scenarioType: parameters.type,
      parameters,
      baselineMetrics,
      scenarioMetrics,
      impact,
      riskAnalysis,
      timeline,
      createdAt: new Date(),
    };
  }

  /**
   * Load PFA data for organizations
   */
  private async loadPfaData(organizationIds: string[]): Promise<PfaRecord[]> {
    const pfas = await prisma.pfa_records.findMany({
      where: {
        organizationId: { in: organizationIds },
        isDiscontinued: false,
      },
      select: {
        id: true,
        equipment: true, // Use equipment field instead of equipmentDescription
        category: true,
        forecastStart: true,
        forecastEnd: true,
        monthlyRate: true,
        source: true,
        vendorName: true,
        organizationId: true,
      },
    });

    return pfas.map((pfa: { id: string; equipment: string | null; category: string | null; forecastStart: Date | null; forecastEnd: Date | null; monthlyRate: number | null; source: string | null; vendorName: string | null; organizationId: string }) => ({
      ...pfa,
      forecastStart: pfa.forecastStart ? new Date(pfa.forecastStart) : null,
      forecastEnd: pfa.forecastEnd ? new Date(pfa.forecastEnd) : null,
    }));
  }

  /**
   * Apply scenario transformations
   */
  private applyScenarioTransformations(
    pfas: PfaRecord[],
    parameters: ScenarioParameters,
    variationFactor?: number // For Monte Carlo
  ): PfaRecord[] {
    const transformed = [...pfas];

    switch (parameters.type) {
      case 'timeline_shift':
        return this.applyTimelineShift(transformed, parameters.shiftDays || 0);

      case 'vendor_switch':
        return this.applyVendorSwitch(
          transformed,
          parameters.sourceVendor || '',
          parameters.targetVendor || ''
        );

      case 'consolidation':
        return this.applyConsolidation(transformed, parameters.consolidationPercent || 0);

      case 'budget_cut':
        return this.applyBudgetCut(transformed, parameters.budgetCutPercent || 0);

      case 'weather_delay':
        // Use variation factor for Monte Carlo, or fixed shift for single run
        const delay = variationFactor !== undefined
          ? variationFactor
          : parameters.shiftDays || 0;
        return this.applyTimelineShift(transformed, delay);

      default:
        return transformed;
    }
  }

  /**
   * Apply timeline shift
   */
  private applyTimelineShift(pfas: PfaRecord[], shiftDays: number): PfaRecord[] {
    return pfas.map(pfa => ({
      ...pfa,
      forecastStart: pfa.forecastStart ? this.addDays(pfa.forecastStart, shiftDays) : null,
      forecastEnd: pfa.forecastEnd ? this.addDays(pfa.forecastEnd, shiftDays) : null,
    }));
  }

  /**
   * Apply vendor switch
   */
  private applyVendorSwitch(
    pfas: PfaRecord[],
    sourceVendor: string,
    targetVendor: string
  ): PfaRecord[] {
    // Average rate reduction: 15% (simplified vendor pricing model)
    const rateReduction = 0.85;

    return pfas.map(pfa => {
      if (pfa.vendorName === sourceVendor) {
        return {
          ...pfa,
          vendorName: targetVendor,
          monthlyRate: pfa.monthlyRate ? pfa.monthlyRate * rateReduction : null,
        };
      }
      return pfa;
    });
  }

  /**
   * Apply equipment consolidation
   */
  private applyConsolidation(pfas: PfaRecord[], consolidationPercent: number): PfaRecord[] {
    // Remove bottom X% of equipment by cost
    const sortedByCost = [...pfas].sort((a, b) => {
      const costA = this.calculateEquipmentCost(a);
      const costB = this.calculateEquipmentCost(b);
      return costA - costB;
    });

    const removeCount = Math.floor(pfas.length * (consolidationPercent / 100));
    const remaining = sortedByCost.slice(removeCount);

    return remaining;
  }

  /**
   * Apply budget cut
   */
  private applyBudgetCut(pfas: PfaRecord[], budgetCutPercent: number): PfaRecord[] {
    const rateReduction = 1 - (budgetCutPercent / 100);

    return pfas.map(pfa => ({
      ...pfa,
      monthlyRate: pfa.monthlyRate ? pfa.monthlyRate * rateReduction : null,
    }));
  }

  /**
   * Calculate equipment cost
   */
  private calculateEquipmentCost(pfa: PfaRecord): number {
    if (!pfa.forecastStart || !pfa.forecastEnd || !pfa.monthlyRate) {
      return 0;
    }
    const days = this.daysBetween(pfa.forecastStart, pfa.forecastEnd);
    const months = days / 30.44;
    // Note: quantity field doesn't exist in schema, using 1 as default
    return months * pfa.monthlyRate;
  }

  /**
   * Calculate metrics for PFA set
   */
  private calculateMetrics(pfas: PfaRecord[]): Metrics {
    let totalCost = 0;
    let totalDuration = 0;
    let rateSum = 0;

    for (const pfa of pfas) {
      const cost = this.calculateEquipmentCost(pfa);
      totalCost += cost;

      if (pfa.forecastStart && pfa.forecastEnd) {
        const duration = this.daysBetween(pfa.forecastStart, pfa.forecastEnd);
        totalDuration += duration;
      }

      if (pfa.monthlyRate) {
        rateSum += pfa.monthlyRate;
      }
    }

    return {
      totalCost,
      totalDuration,
      equipmentCount: pfas.length,
      avgMonthlyRate: pfas.length > 0 ? rateSum / pfas.length : 0,
    };
  }

  /**
   * Calculate impact summary
   */
  private calculateImpact(baseline: Metrics, scenario: Metrics): ImpactSummary {
    return {
      costDelta: scenario.totalCost - baseline.totalCost,
      costDeltaPercent: baseline.totalCost > 0
        ? ((scenario.totalCost - baseline.totalCost) / baseline.totalCost) * 100
        : 0,
      durationDelta: scenario.totalDuration - baseline.totalDuration,
      durationDeltaPercent: baseline.totalDuration > 0
        ? ((scenario.totalDuration - baseline.totalDuration) / baseline.totalDuration) * 100
        : 0,
      equipmentDelta: scenario.equipmentCount - baseline.equipmentCount,
      equipmentDeltaPercent: baseline.equipmentCount > 0
        ? ((scenario.equipmentCount - baseline.equipmentCount) / baseline.equipmentCount) * 100
        : 0,
    };
  }

  /**
   * Run Monte Carlo simulation
   *
   * @param pfas - Baseline PFA data
   * @param parameters - Scenario parameters
   * @param iterations - Number of iterations (default: 1000)
   */
  private async runMonteCarloSimulation(
    pfas: PfaRecord[],
    parameters: ScenarioParameters,
    iterations: number = 1000
  ): Promise<{ analysis: MonteCarloResult; medianScenario: PfaRecord[] }> {
    const results: number[] = [];
    const scenarios: PfaRecord[][] = [];

    // Monte Carlo parameters (for weather delay)
    const mean = parameters.shiftDays || 20;
    const stdDev = 5;

    for (let i = 0; i < iterations; i++) {
      // Generate random variation
      const variation = this.gaussianRandom(mean, stdDev);

      // Apply transformation with variation
      const scenarioPfas = this.applyScenarioTransformations(pfas, parameters, variation);
      scenarios.push(scenarioPfas);

      // Calculate total cost for this iteration
      const metrics = this.calculateMetrics(scenarioPfas);
      results.push(metrics.totalCost);
    }

    // Sort results for percentile calculation
    const sortedResults = [...results].sort((a, b) => a - b);

    // Calculate statistics
    const p10 = this.percentile(sortedResults, 10);
    const p50 = this.percentile(sortedResults, 50);
    const p90 = this.percentile(sortedResults, 90);
    const mean_result = results.reduce((sum, val) => sum + val, 0) / results.length;
    const variance = results.reduce((sum, val) => sum + Math.pow(val - mean_result, 2), 0) / results.length;
    const stdDev_result = Math.sqrt(variance);

    // Find median scenario
    const medianIndex = Math.floor(iterations / 2);
    const medianScenario = scenarios[sortedResults.indexOf(p50)] || scenarios[medianIndex];

    return {
      analysis: {
        p10,
        p50,
        p90,
        mean: mean_result,
        stdDev: stdDev_result,
        distribution: sortedResults,
      },
      medianScenario,
    };
  }

  /**
   * Gaussian random number generator (Box-Muller transform)
   */
  private gaussianRandom(mean: number, stdDev: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedArray: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sortedArray[lower];
    }

    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Generate timeline comparison
   */
  private generateTimelineComparison(
    baselinePfas: PfaRecord[],
    scenarioPfas: PfaRecord[]
  ): TimelineComparison {
    const baseline = baselinePfas.map(pfa => ({
      equipmentId: pfa.id,
      equipment: pfa.equipment,
      start: pfa.forecastStart,
      end: pfa.forecastEnd,
      cost: this.calculateEquipmentCost(pfa),
    }));

    const scenario = scenarioPfas.map(pfa => ({
      equipmentId: pfa.id,
      equipment: pfa.equipment,
      start: pfa.forecastStart,
      end: pfa.forecastEnd,
      cost: this.calculateEquipmentCost(pfa),
    }));

    return { baseline, scenario };
  }

  /**
   * Save scenario to database
   */
  private async saveScenario(data: {
    scenarioType: string;
    organizationIds: string[];
    parameters: ScenarioParameters;
    baselineMetrics: Metrics;
    scenarioMetrics: Metrics;
    impact: ImpactSummary;
    riskAnalysis?: MonteCarloResult;
    timeline: TimelineComparison;
    createdBy: string;
  }): Promise<string> {
    const scenarioId = this.generateScenarioId();
    const scenario = await prisma.scenario_simulations.create({
      data: {
        id: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        scenarioId,
        scenarioType: data.scenarioType,
        organizationIds: data.organizationIds as any,
        parameters: data.parameters as any,
        baselineMetrics: data.baselineMetrics as any,
        scenarioMetrics: data.scenarioMetrics as any,
        impact: data.impact as any,
        riskAnalysis: data.riskAnalysis as any,
        timeline: data.timeline as any,
        createdBy: data.createdBy,
      },
    });

    return scenario.scenarioId;
  }

  /**
   * Generate unique scenario ID
   */
  private generateScenarioId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `SIM-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * List user scenarios
   */
  async listUserScenarios(userId: string, limit: number = 50): Promise<any[]> {
    const scenarios = await prisma.scenario_simulations.findMany({
      where: { createdBy: userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        scenarioId: true,
        scenarioType: true,
        organizationIds: true,
        parameters: true,
        baselineMetrics: true,
        scenarioMetrics: true,
        impact: true,
        riskAnalysis: true,
        createdAt: true,
      },
    });

    return scenarios;
  }

  /**
   * Compare multiple scenarios
   */
  async compareScenarios(scenarioIds: string[]): Promise<any> {
    const scenarios = await prisma.scenario_simulations.findMany({
      where: {
        scenarioId: { in: scenarioIds },
      },
      select: {
        scenarioId: true,
        scenarioType: true,
        parameters: true,
        baselineMetrics: true,
        scenarioMetrics: true,
        impact: true,
        riskAnalysis: true,
        createdAt: true,
      },
    });

    return {
      scenarios,
      comparisonMatrix: this.buildComparisonMatrix(scenarios),
    };
  }

  /**
   * Build comparison matrix
   */
  private buildComparisonMatrix(scenarios: any[]): any {
    if (scenarios.length === 0) return {};

    const matrix: any = {
      scenarioIds: scenarios.map(s => s.scenarioId),
      metrics: {},
    };

    // Extract common metrics
    const metricKeys = ['totalCost', 'totalDuration', 'equipmentCount'];

    for (const key of metricKeys) {
      matrix.metrics[key] = {
        baseline: scenarios.map(s => s.baselineMetrics[key]),
        scenario: scenarios.map(s => s.scenarioMetrics[key]),
        delta: scenarios.map(s => s.impact[`${key}Delta`] || 0),
      };
    }

    return matrix;
  }

  /**
   * Get scenario by ID
   */
  async getScenario(scenarioId: string): Promise<any> {
    const scenario = await prisma.scenario_simulations.findUnique({
      where: { scenarioId },
    });

    return scenario;
  }

  /**
   * Utility: Add days to date
   */
  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Utility: Days between dates
   */
  private daysBetween(start: Date | null, end: Date | null): number {
    if (!start || !end) return 0;
    const diffMs = end.getTime() - start.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }
}

export const scenarioSimulatorService = new ScenarioSimulatorService();
