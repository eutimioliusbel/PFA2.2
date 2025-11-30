/**
 * Vendor Pricing Watchdog Integration Tests
 *
 * Tests the vendor pricing analysis system including:
 * - Overpriced vendor detection (>15% above market avg)
 * - Vendor scorecard ranking (lowest price = highest rank)
 * - Month-over-month rate change tracking (>10% increase)
 *
 * Phase 8, Task 8.4 (UC-24) of ADR-005 Multi-Tenant Access Control
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../src/config/database';
import { VendorPricingWatchdogService } from '../../src/services/ai/VendorPricingWatchdogService';

describe('Vendor Pricing Watchdog', () => {
  const service = new VendorPricingWatchdogService();

  // Test organization
  let testOrgId: string;

  // Test PFA records
  let vendorAPfaId: string;
  let vendorBPfaId: string;
  let vendorCPfaId: string;

  beforeAll(async () => {
    // Create test organization
    const org = await prisma.organization.create({
      data: {
        code: 'TEST_PRICING',
        name: 'Test Pricing Organization',
        isActive: true,
      },
    });
    testOrgId = org.id;

    // Create test PFA records with different vendors and rates
    // Vendor A: $12,000/mo (overpriced, market avg will be $10,000)
    // Vendor B: $9,000/mo (good price)
    // Vendor C: $10,000/mo (market avg)

    const vendorAPfa = await prisma.pfaRecord.create({
      data: {
        id: `test-vendor-a-${Date.now()}`,
        pfaId: `VPA-001`,
        organizationId: testOrgId,
        category: 'Cranes',
        source: 'Rental',
        vendorName: 'Acme Rentals',
        monthlyRate: 12000,
        isDiscontinued: false,
      },
    });
    vendorAPfaId = vendorAPfa.id;

    const vendorBPfa = await prisma.pfaRecord.create({
      data: {
        id: `test-vendor-b-${Date.now()}`,
        pfaId: `VPB-001`,
        organizationId: testOrgId,
        category: 'Cranes',
        source: 'Rental',
        vendorName: 'Best Equipment Co',
        monthlyRate: 9000,
        isDiscontinued: false,
      },
    });
    vendorBPfaId = vendorBPfa.id;

    const vendorCPfa = await prisma.pfaRecord.create({
      data: {
        id: `test-vendor-c-${Date.now()}`,
        pfaId: `VPC-001`,
        organizationId: testOrgId,
        category: 'Cranes',
        source: 'Rental',
        vendorName: 'Standard Suppliers',
        monthlyRate: 10000,
        isDiscontinued: false,
      },
    });
    vendorCPfaId = vendorCPfa.id;

    // Create historical snapshot for Vendor A (30 days ago with lower rate)
    // This will trigger suspicious increase detection
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await prisma.vendorPricingSnapshot.create({
      data: {
        vendorName: 'Acme Rentals',
        category: 'Cranes',
        avgMonthlyRate: 10000, // Was $10,000, now $12,000 = 20% increase
        equipmentCount: 1,
        organizationIds: [testOrgId],
        snapshotDate: thirtyDaysAgo,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.pricingAnomaly.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.vendorPricingSnapshot.deleteMany({
      where: { vendorName: { in: ['Acme Rentals', 'Best Equipment Co', 'Standard Suppliers'] } },
    });
    await prisma.pfaRecord.deleteMany({
      where: { id: { in: [vendorAPfaId, vendorBPfaId, vendorCPfaId] } },
    });
    await prisma.organization.delete({
      where: { id: testOrgId },
    });
  });

  it('should detect overpriced vendor (>15% above market avg)', async () => {
    // Run pricing analysis
    const analysis = await service.analyzeVendorPricing();

    // Market avg should be (12000 + 9000 + 10000) / 3 = $10,333
    const cranesMarket = analysis.marketData.find(m => m.category === 'Cranes');
    expect(cranesMarket).toBeDefined();
    expect(cranesMarket!.marketAvgRate).toBeCloseTo(10333, 0);

    // Vendor A ($12,000) should be flagged as overpriced
    // Deviation: (12000 - 10333) / 10333 = 16.1%
    const overpricedAnomaly = analysis.anomalies.find(
      a => a.vendorName === 'Acme Rentals' && a.type === 'overpriced'
    );

    expect(overpricedAnomaly).toBeDefined();
    expect(overpricedAnomaly!.currentRate).toBe(12000);
    expect(overpricedAnomaly!.deviationPercent).toBeGreaterThan(15);
    expect(overpricedAnomaly!.severity).toBe('medium'); // 16.1% is in medium range (15-20%)
  });

  it('should rank vendors by price competitiveness (lowest price = highest rank)', async () => {
    // Run pricing analysis
    const analysis = await service.analyzeVendorPricing();

    // Find scorecards for our test vendors
    const vendorAScorecard = analysis.vendorScorecards.find(s => s.vendorName === 'Acme Rentals');
    const vendorBScorecard = analysis.vendorScorecards.find(s => s.vendorName === 'Best Equipment Co');
    const vendorCScorecard = analysis.vendorScorecards.find(s => s.vendorName === 'Standard Suppliers');

    expect(vendorAScorecard).toBeDefined();
    expect(vendorBScorecard).toBeDefined();
    expect(vendorCScorecard).toBeDefined();

    // Vendor B ($9,000) should have highest rank (best price)
    // Vendor C ($10,000) should be middle
    // Vendor A ($12,000) should have lowest rank (worst price)
    expect(vendorBScorecard!.rank).toBeLessThan(vendorCScorecard!.rank);
    expect(vendorCScorecard!.rank).toBeLessThan(vendorAScorecard!.rank);

    // Verify price competitiveness scores
    expect(vendorBScorecard!.priceCompetitiveness).toBeGreaterThan(vendorAScorecard!.priceCompetitiveness);
  });

  it('should detect month-over-month rate increase >10%', async () => {
    // Run pricing analysis
    const analysis = await service.analyzeVendorPricing();

    // Vendor A increased from $10,000 to $12,000 = 20% increase
    const suspiciousIncreaseAnomaly = analysis.anomalies.find(
      a => a.vendorName === 'Acme Rentals' && a.type === 'suspicious_increase'
    );

    expect(suspiciousIncreaseAnomaly).toBeDefined();
    expect(suspiciousIncreaseAnomaly!.currentRate).toBe(12000);
    expect(suspiciousIncreaseAnomaly!.deviationPercent).toBeCloseTo(20, 1); // 20% increase
    expect(suspiciousIncreaseAnomaly!.severity).toBe('high'); // >20% is high severity
    expect(suspiciousIncreaseAnomaly!.recommendation).toContain('increased rates');
    expect(suspiciousIncreaseAnomaly!.recommendation).toContain('20');
  });

  it('should persist anomalies to database', async () => {
    // Run analysis
    const analysis = await service.analyzeVendorPricing();

    // Persist anomalies
    await service.persistAnomalies(analysis.anomalies);

    // Verify anomalies were saved
    const savedAnomalies = await prisma.pricingAnomaly.findMany({
      where: { organizationId: testOrgId },
    });

    expect(savedAnomalies.length).toBeGreaterThan(0);

    // Should have both overpriced and suspicious_increase anomalies
    const overpricedCount = savedAnomalies.filter(a => a.type === 'overpriced').length;
    const suspiciousCount = savedAnomalies.filter(a => a.type === 'suspicious_increase').length;

    expect(overpricedCount).toBeGreaterThan(0);
    expect(suspiciousCount).toBeGreaterThan(0);
  });

  it('should dismiss anomaly and update status', async () => {
    // Get an active anomaly
    const activeAnomalies = await service.getActiveAnomalies();
    expect(activeAnomalies.length).toBeGreaterThan(0);

    const anomalyId = activeAnomalies[0].id;

    // Dismiss the anomaly
    await service.dismissAnomaly(anomalyId, 'test-user-id');

    // Verify status changed
    const dismissedAnomaly = await prisma.pricingAnomaly.findUnique({
      where: { id: anomalyId },
    });

    expect(dismissedAnomaly).toBeDefined();
    expect(dismissedAnomaly!.status).toBe('dismissed');
    expect(dismissedAnomaly!.resolvedBy).toBe('test-user-id');
    expect(dismissedAnomaly!.resolvedAt).toBeDefined();
  });

  it('should create pricing snapshot for historical tracking', async () => {
    // Create snapshot
    await service.createPricingSnapshot();

    // Verify snapshots were created
    const snapshots = await prisma.vendorPricingSnapshot.findMany({
      where: {
        vendorName: { in: ['Acme Rentals', 'Best Equipment Co', 'Standard Suppliers'] },
        category: 'Cranes',
      },
      orderBy: {
        snapshotDate: 'desc',
      },
    });

    // Should have at least 3 snapshots (one for each vendor)
    // Plus the historical one we created in beforeAll
    expect(snapshots.length).toBeGreaterThanOrEqual(3);

    // Find the latest snapshot for Vendor A
    const vendorASnapshot = snapshots.find(s => s.vendorName === 'Acme Rentals');
    expect(vendorASnapshot).toBeDefined();
    expect(vendorASnapshot!.avgMonthlyRate).toBe(12000);
    expect(vendorASnapshot!.equipmentCount).toBe(1);
    expect(vendorASnapshot!.organizationIds).toContain(testOrgId);
  });

  it('should calculate vendor scorecard correctly', async () => {
    const analysis = await service.analyzeVendorPricing();

    // Verify scorecard structure
    expect(analysis.vendorScorecards.length).toBeGreaterThan(0);

    const scorecard = analysis.vendorScorecards[0];

    // Verify all required fields
    expect(scorecard.vendorName).toBeDefined();
    expect(scorecard.priceCompetitiveness).toBeGreaterThanOrEqual(0);
    expect(scorecard.priceCompetitiveness).toBeLessThanOrEqual(1);
    expect(scorecard.rateStability).toBeGreaterThanOrEqual(0);
    expect(scorecard.rateStability).toBeLessThanOrEqual(1);
    expect(scorecard.equipmentCoverage).toBeGreaterThanOrEqual(0);
    expect(scorecard.equipmentCoverage).toBeLessThanOrEqual(1);
    expect(scorecard.overallScore).toBeGreaterThanOrEqual(0);
    expect(scorecard.overallScore).toBeLessThanOrEqual(1);
    expect(scorecard.rank).toBeGreaterThan(0);
    expect(scorecard.categories).toBeDefined();
    expect(scorecard.categories.length).toBeGreaterThan(0);

    // Overall score should be weighted average
    const expectedScore =
      scorecard.priceCompetitiveness * 0.40 +
      scorecard.rateStability * 0.30 +
      scorecard.equipmentCoverage * 0.30;

    expect(scorecard.overallScore).toBeCloseTo(expectedScore, 2);
  });

  it('should calculate summary statistics correctly', async () => {
    const analysis = await service.analyzeVendorPricing();

    // Verify summary
    expect(analysis.summary.totalVendors).toBeGreaterThanOrEqual(3);
    expect(analysis.summary.totalCategories).toBeGreaterThanOrEqual(1);
    expect(analysis.summary.anomaliesDetected).toBeGreaterThan(0);
    expect(analysis.summary.avgDeviationPercent).toBeGreaterThan(0);

    // Verify anomalies count matches
    expect(analysis.summary.anomaliesDetected).toBe(analysis.anomalies.length);

    // Verify avg deviation calculation
    const totalDeviation = analysis.anomalies.reduce((sum, a) => sum + Math.abs(a.deviationPercent), 0);
    const expectedAvgDeviation = totalDeviation / analysis.anomalies.length;
    expect(analysis.summary.avgDeviationPercent).toBeCloseTo(expectedAvgDeviation, 1);
  });
});
