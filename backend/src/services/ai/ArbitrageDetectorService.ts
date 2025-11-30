/**
 * Arbitrage Detector Service
 *
 * AI-powered cross-organization asset analysis system that detects when the same
 * equipment type is being rented multiple times across different projects, and
 * recommends consolidation opportunities to reduce costs.
 *
 * Use Case 23: Asset Arbitrage Detector
 * Phase 8, Task 8.3 of ADR-005 Multi-Tenant Access Control
 */

import prisma from '../../config/database';
import { logger } from '../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

interface Location {
  lat: number;
  lon: number;
  address: string;
}

interface IdlePeriod {
  pfaId: string;
  organizationId: string;
  category: string;
  class: string | null;
  idleStart: Date;
  idleEnd: Date;
  idleDays: number;
  monthlyRate: number;
  manufacturer: string | null;
  model: string | null;
}

interface Need {
  pfaId: string;
  organizationId: string;
  category: string;
  class: string | null;
  needStart: Date;
  needEnd: Date;
  needDays: number;
  monthlyRate: number;
  manufacturer: string | null;
  model: string | null;
}

interface ArbitrageOpportunityDetailed {
  id: string;
  type: 'idle_transfer' | 'duplicate_rental' | 'consolidation';
  sourceOrgId: string;
  sourceOrgCode: string;
  sourceOrgName: string;
  sourceLocation: Location | null;
  destOrgId: string;
  destOrgCode: string;
  destOrgName: string;
  destLocation: Location | null;
  equipmentCategory: string;
  equipmentClass: string | null;
  idlePeriod?: {
    start: Date;
    end: Date;
    days: number;
  };
  needPeriod: {
    start: Date;
    end: Date;
    days: number;
  };
  overlapPeriod: {
    start: Date;
    end: Date;
    days: number;
  };
  potentialSavings: number;
  transferCost: number;
  netSavings: number;
  feasibilityScore: number;
  feasibilityBreakdown: {
    compatibility: number;
    logistics: number;
    costSavings: number;
  };
  distance: number | null;
  pros: string[];
  cons: string[];
  isFeasible: boolean;
  status: 'detected' | 'approved' | 'rejected' | 'completed';
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Transport cost rates per mile by equipment type
const TRANSPORT_COST_RATES: Record<string, number> = {
  'Cranes': 2.00,
  'Scaffolds': 0.50,
  'Generators': 1.00,
  'Default': 1.00,
};

// Feasibility score weights
const FEASIBILITY_WEIGHTS = {
  compatibility: 0.40,
  logistics: 0.30,
  costSavings: 0.30,
};

// Distance thresholds for logistics scoring
const DISTANCE_THRESHOLDS = {
  high: 50,    // < 50 miles = high feasibility
  medium: 100, // 50-100 miles = medium feasibility
  low: 200,    // 100-200 miles = low feasibility
                // > 200 miles = very low feasibility
};

// ============================================================================
// ARBITRAGE DETECTOR SERVICE
// ============================================================================

export class ArbitrageDetectorService {
  /**
   * Detect all arbitrage opportunities across organizations
   *
   * @param userId - User ID requesting the analysis (for audit)
   * @returns List of detected opportunities with feasibility scores
   */
  async detectOpportunities(userId: string): Promise<ArbitrageOpportunityDetailed[]> {
    const startTime = Date.now();
    logger.info(`[ArbitrageDetector] Starting opportunity detection for user ${userId}`);

    try {
      // 1. Load all active organizations with location data
      const organizations = await this.loadOrganizations();
      logger.info(`[ArbitrageDetector] Loaded ${organizations.length} active organizations`);

      // 2. Find idle periods across all organizations
      const idlePeriods = await this.findIdlePeriods();
      logger.info(`[ArbitrageDetector] Found ${idlePeriods.length} idle periods`);

      // 3. Find equipment needs across all organizations
      const needs = await this.findEquipmentNeeds();
      logger.info(`[ArbitrageDetector] Found ${needs.length} equipment needs`);

      // 4. Match idle equipment with needs
      const opportunities: ArbitrageOpportunityDetailed[] = [];

      for (const idle of idlePeriods) {
        // Find matching needs from different organizations
        const matchingNeeds = needs.filter(
          need =>
            need.organizationId !== idle.organizationId &&
            need.category === idle.category &&
            (idle.class === null || need.class === null || need.class === idle.class)
        );

        for (const need of matchingNeeds) {
          // Calculate overlap period
          const overlapStart = new Date(
            Math.max(idle.idleStart.getTime(), need.needStart.getTime())
          );
          const overlapEnd = new Date(
            Math.min(idle.idleEnd.getTime(), need.needEnd.getTime())
          );

          // Only consider if there's actual overlap
          if (overlapStart < overlapEnd) {
            const overlapDays = Math.ceil(
              (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)
            );

            // Get organization details
            const sourceOrg = organizations.find(o => o.id === idle.organizationId);
            const destOrg = organizations.find(o => o.id === need.organizationId);

            if (!sourceOrg || !destOrg) continue;

            // Calculate financial impact
            const potentialSavings = this.calculatePotentialSavings(
              need.monthlyRate,
              overlapDays
            );

            // Calculate distance and transport cost
            const distance = this.getDistance(
              sourceOrg.location,
              destOrg.location
            );

            const transferCost = this.calculateTransportCost(
              distance,
              idle.category
            );

            const netSavings = potentialSavings - transferCost;

            // Calculate feasibility score
            const feasibility = this.calculateFeasibility({
              idle,
              need,
              distance,
              potentialSavings,
              transferCost,
            });

            // Generate pros and cons
            const { pros, cons } = this.generateProsAndCons({
              idle,
              need,
              distance,
              overlapDays,
              netSavings,
              feasibility,
            });

            opportunities.push({
              id: `arb-${idle.pfaId}-${need.pfaId}`,
              type: 'idle_transfer',
              sourceOrgId: idle.organizationId,
              sourceOrgCode: sourceOrg.code,
              sourceOrgName: sourceOrg.name,
              sourceLocation: sourceOrg.location as Location | null,
              destOrgId: need.organizationId,
              destOrgCode: destOrg.code,
              destOrgName: destOrg.name,
              destLocation: destOrg.location as Location | null,
              equipmentCategory: idle.category,
              equipmentClass: idle.class,
              idlePeriod: {
                start: idle.idleStart,
                end: idle.idleEnd,
                days: idle.idleDays,
              },
              needPeriod: {
                start: need.needStart,
                end: need.needEnd,
                days: need.needDays,
              },
              overlapPeriod: {
                start: overlapStart,
                end: overlapEnd,
                days: overlapDays,
              },
              potentialSavings,
              transferCost,
              netSavings,
              feasibilityScore: feasibility.total,
              feasibilityBreakdown: {
                compatibility: feasibility.compatibility,
                logistics: feasibility.logistics,
                costSavings: feasibility.costSavings,
              },
              distance,
              pros,
              cons,
              isFeasible: netSavings > 0 && feasibility.total >= 0.5,
              status: 'detected',
            });
          }
        }
      }

      // 5. Sort by net savings (highest first)
      opportunities.sort((a, b) => b.netSavings - a.netSavings);

      const latency = Date.now() - startTime;
      logger.info(
        `[ArbitrageDetector] Detected ${opportunities.length} opportunities in ${latency}ms`
      );

      return opportunities;
    } catch (error) {
      logger.error('[ArbitrageDetector] Error detecting opportunities:', error);
      throw new Error('Failed to detect arbitrage opportunities');
    }
  }

  /**
   * Propose a transfer based on detected opportunity
   *
   * @param opportunityId - ID of the opportunity (composite: arb-{sourceId}-{destId})
   * @param userId - User ID proposing the transfer
   * @returns Created arbitrage opportunity record
   */
  async proposeTransfer(opportunityId: string, userId: string) {
    logger.info(`[ArbitrageDetector] User ${userId} proposing transfer ${opportunityId}`);

    try {
      // Extract PFA IDs from opportunity ID
      const parts = opportunityId.split('-');
      if (parts.length !== 3) {
        throw new Error('Invalid opportunity ID format');
      }

      // Re-detect the specific opportunity to get fresh data
      const opportunities = await this.detectOpportunities(userId);
      const opportunity = opportunities.find(o => o.id === opportunityId);

      if (!opportunity) {
        throw new Error('Opportunity not found or no longer valid');
      }

      // Create arbitrage opportunity record in database
      const arbitrageOpportunity = await prisma.arbitrage_opportunities.create({
        data: {
          id: opportunityId,
          sourceOrgId: opportunity.sourceOrgId,
          destOrgId: opportunity.destOrgId,
          equipmentCategory: opportunity.equipmentCategory,
          equipmentClass: opportunity.equipmentClass,
          idleStart: opportunity.idlePeriod!.start,
          idleEnd: opportunity.idlePeriod!.end,
          idleDays: opportunity.idlePeriod!.days,
          needStart: opportunity.needPeriod.start,
          needEnd: opportunity.needPeriod.end,
          needDays: opportunity.needPeriod.days,
          overlapStart: opportunity.overlapPeriod.start,
          overlapEnd: opportunity.overlapPeriod.end,
          overlapDays: opportunity.overlapPeriod.days,
          potentialSavings: opportunity.potentialSavings,
          transferCost: opportunity.transferCost,
          netSavings: opportunity.netSavings,
          isFeasible: opportunity.isFeasible,
          distance: opportunity.distance,
          logisticsNotes: `Feasibility: ${Math.round(opportunity.feasibilityScore * 100)}%. ${opportunity.pros.join('. ')}`,
          status: 'detected',
        },
      });

      logger.info(`[ArbitrageDetector] Created transfer proposal ${arbitrageOpportunity.id}`);

      return arbitrageOpportunity;
    } catch (error) {
      logger.error('[ArbitrageDetector] Error proposing transfer:', error);
      throw new Error('Failed to propose transfer');
    }
  }

  // ==========================================================================
  // PRIVATE HELPER METHODS
  // ==========================================================================

  /**
   * Load all active organizations with location data
   */
  private async loadOrganizations() {
    return await prisma.organizations.findMany({
      where: {
        isActive: true,
        serviceStatus: 'active',
      },
      select: {
        id: true,
        code: true,
        name: true,
        location: true,
      },
    });
  }

  /**
   * Find idle periods (equipment that has finished but not yet needed again)
   */
  private async findIdlePeriods(): Promise<IdlePeriod[]> {
    const now = new Date();

    // Find PFA records that have ended but are not discontinued
    const completedRecords = await prisma.pfa_records.findMany({
      where: {
        isDiscontinued: false,
        forecastEnd: {
          lt: now,
        },
        source: 'Rental', // Only rentals can be transferred
      },
      select: {
        id: true,
        pfaId: true,
        organizationId: true,
        category: true,
        class: true,
        forecastEnd: true,
        monthlyRate: true,
        manufacturer: true,
        model: true,
      },
    });

    const idlePeriods: IdlePeriod[] = [];

    for (const record of completedRecords) {
      if (!record.category || !record.forecastEnd || !record.monthlyRate) continue;

      // Find next scheduled need for same equipment in same org (if any)
      const nextNeed = await prisma.pfa_records.findFirst({
        where: {
          organizationId: record.organizationId,
          category: record.category,
          forecastStart: {
            gt: record.forecastEnd,
          },
          isDiscontinued: false,
        },
        orderBy: {
          forecastStart: 'asc',
        },
        select: {
          forecastStart: true,
        },
      });

      const idleEnd = nextNeed?.forecastStart || new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // Default: 90 days
      const idleStart = record.forecastEnd;

      const idleDays = Math.ceil(
        (idleEnd.getTime() - idleStart.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Only consider idle periods > 7 days
      if (idleDays > 7) {
        idlePeriods.push({
          pfaId: record.pfaId,
          organizationId: record.organizationId,
          category: record.category,
          class: record.class,
          idleStart,
          idleEnd,
          idleDays,
          monthlyRate: record.monthlyRate,
          manufacturer: record.manufacturer,
          model: record.model,
        });
      }
    }

    return idlePeriods;
  }

  /**
   * Find equipment needs (current or future scheduled requirements)
   */
  private async findEquipmentNeeds(): Promise<Need[]> {
    const now = new Date();
    const futureWindow = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // 180 days

    const needs = await prisma.pfa_records.findMany({
      where: {
        isDiscontinued: false,
        source: 'Rental',
        forecastStart: {
          lte: futureWindow,
        },
        forecastEnd: {
          gte: now,
        },
      },
      select: {
        pfaId: true,
        organizationId: true,
        category: true,
        class: true,
        forecastStart: true,
        forecastEnd: true,
        monthlyRate: true,
        manufacturer: true,
        model: true,
      },
    });

    return needs
      .filter(n => n.category && n.forecastStart && n.forecastEnd && n.monthlyRate)
      .map(n => ({
        pfaId: n.pfaId,
        organizationId: n.organizationId,
        category: n.category!,
        class: n.class,
        needStart: n.forecastStart!,
        needEnd: n.forecastEnd!,
        needDays: Math.ceil(
          (n.forecastEnd!.getTime() - n.forecastStart!.getTime()) / (1000 * 60 * 60 * 24)
        ),
        monthlyRate: n.monthlyRate!,
        manufacturer: n.manufacturer,
        model: n.model,
      }));
  }

  /**
   * Calculate potential savings from using idle equipment
   *
   * @param monthlyRate - Monthly rental rate
   * @param days - Number of days to transfer
   * @returns Potential savings in USD
   */
  private calculatePotentialSavings(monthlyRate: number, days: number): number {
    return (days / 30.44) * monthlyRate;
  }

  /**
   * Calculate transport cost based on distance and equipment type
   *
   * @param distance - Distance in miles (null if location unknown)
   * @param category - Equipment category
   * @returns Transport cost in USD
   */
  private calculateTransportCost(distance: number | null, category: string): number {
    if (distance === null) return 0;

    const rate = TRANSPORT_COST_RATES[category] || TRANSPORT_COST_RATES['Default'];
    return distance * rate;
  }

  /**
   * Calculate distance between two locations using Haversine formula
   *
   * @param loc1 - First location (or null)
   * @param loc2 - Second location (or null)
   * @returns Distance in miles, or null if locations unknown
   */
  private getDistance(loc1: any, loc2: any): number | null {
    if (!loc1 || !loc2) return null;

    const location1 = loc1 as Location;
    const location2 = loc2 as Location;

    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(location2.lat - location1.lat);
    const dLon = this.toRadians(location2.lon - location1.lon);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(location1.lat)) *
        Math.cos(this.toRadians(location2.lat)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate feasibility score (0-1 scale)
   *
   * Breakdown:
   * - Compatibility (40%): Specs match, capacity meets requirements
   * - Logistics (30%): Distance-based (< 50mi = high, > 200mi = low)
   * - Cost Savings (30%): Savings vs. transport cost ratio
   */
  private calculateFeasibility(params: {
    idle: IdlePeriod;
    need: Need;
    distance: number | null;
    potentialSavings: number;
    transferCost: number;
  }): {
    compatibility: number;
    logistics: number;
    costSavings: number;
    total: number;
  } {
    const { idle, need, distance, potentialSavings, transferCost } = params;

    // 1. Compatibility Score (40%)
    let compatibilityScore = 0.7; // Base score for category match

    // Boost if class matches exactly
    if (idle.class && need.class && idle.class === need.class) {
      compatibilityScore = 1.0;
    }

    // Boost if manufacturer matches
    if (idle.manufacturer && need.manufacturer && idle.manufacturer === need.manufacturer) {
      compatibilityScore = Math.min(1.0, compatibilityScore + 0.1);
    }

    // Boost if model matches
    if (idle.model && need.model && idle.model === need.model) {
      compatibilityScore = 1.0;
    }

    // 2. Logistics Score (30%)
    let logisticsScore = 0.5; // Default if distance unknown

    if (distance !== null) {
      if (distance < DISTANCE_THRESHOLDS.high) {
        logisticsScore = 1.0; // High feasibility
      } else if (distance < DISTANCE_THRESHOLDS.medium) {
        logisticsScore = 0.8; // Medium-high feasibility
      } else if (distance < DISTANCE_THRESHOLDS.low) {
        logisticsScore = 0.5; // Medium feasibility
      } else {
        logisticsScore = 0.2; // Low feasibility
      }
    }

    // 3. Cost Savings Score (30%)
    const netSavings = potentialSavings - transferCost;
    const savingsRatio = transferCost > 0 ? netSavings / transferCost : 1.0;

    let costSavingsScore = 0;
    if (savingsRatio >= 5) {
      costSavingsScore = 1.0; // Excellent ROI
    } else if (savingsRatio >= 3) {
      costSavingsScore = 0.9;
    } else if (savingsRatio >= 2) {
      costSavingsScore = 0.7;
    } else if (savingsRatio >= 1) {
      costSavingsScore = 0.5;
    } else if (savingsRatio > 0) {
      costSavingsScore = 0.3;
    } else {
      costSavingsScore = 0; // Negative ROI
    }

    // 4. Calculate weighted total
    const totalScore =
      compatibilityScore * FEASIBILITY_WEIGHTS.compatibility +
      logisticsScore * FEASIBILITY_WEIGHTS.logistics +
      costSavingsScore * FEASIBILITY_WEIGHTS.costSavings;

    return {
      compatibility: compatibilityScore,
      logistics: logisticsScore,
      costSavings: costSavingsScore,
      total: totalScore,
    };
  }

  /**
   * Generate pros and cons for an opportunity
   */
  private generateProsAndCons(params: {
    idle: IdlePeriod;
    need: Need;
    distance: number | null;
    overlapDays: number;
    netSavings: number;
    feasibility: {
      compatibility: number;
      logistics: number;
      costSavings: number;
      total: number;
    };
  }): { pros: string[]; cons: string[] } {
    const { idle, need, distance, overlapDays, netSavings, feasibility } = params;

    const pros: string[] = [];
    const cons: string[] = [];

    // Pros
    if (netSavings > 0) {
      pros.push(`Save $${Math.round(netSavings).toLocaleString()} over ${overlapDays} days`);
    }

    if (distance !== null && distance < DISTANCE_THRESHOLDS.high) {
      pros.push(`Short distance transfer (${distance} miles)`);
    }

    if (idle.class && need.class && idle.class === need.class) {
      pros.push('Exact equipment class match');
    }

    if (feasibility.compatibility >= 0.9) {
      pros.push('High compatibility (specs match)');
    }

    if (overlapDays >= 30) {
      pros.push(`Long utilization period (${overlapDays} days)`);
    }

    // Cons
    if (netSavings <= 0) {
      cons.push(`Transfer cost exceeds savings ($${Math.abs(Math.round(netSavings)).toLocaleString()} loss)`);
    }

    if (distance !== null && distance > DISTANCE_THRESHOLDS.low) {
      cons.push(`Long distance transfer (${distance} miles)`);
    }

    if (!idle.class || !need.class || idle.class !== need.class) {
      cons.push('Equipment class mismatch (may require verification)');
    }

    if (overlapDays < 14) {
      cons.push(`Short utilization period (${overlapDays} days)`);
    }

    if (feasibility.logistics < 0.5) {
      cons.push('Logistics challenges (distance, transport complexity)');
    }

    // Default messages
    if (pros.length === 0) {
      pros.push('Opportunity identified');
    }

    if (cons.length === 0) {
      cons.push('No major concerns identified');
    }

    return { pros, cons };
  }
}
