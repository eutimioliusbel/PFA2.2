/**
 * Scenario Simulator Integration Tests
 *
 * Tests UC-25: Multiverse Scenario Simulator
 *
 * Test Coverage:
 * 1. Timeline shift simulation
 * 2. Vendor switch simulation
 * 3. Monte Carlo simulation
 * 4. Scenario comparison
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../src/config/database';
import { scenarioSimulatorService } from '../../src/services/ai/ScenarioSimulatorService';

// Test data setup
let testUserId: string;
let testOrgId: string;
const testPfaRecords: any[] = [];

beforeAll(async () => {
  // Create test organization
  const org = await prisma.organization.create({
    data: {
      code: 'TEST_SCENARIO',
      name: 'Test Scenario Organization',
      description: 'Organization for scenario simulation testing',
      isActive: true
    }
  });
  testOrgId = org.id;

  // Create test user
  const user = await prisma.user.create({
    data: {
      username: 'scenario_tester',
      email: 'scenario@test.com',
      passwordHash: 'test_hash',
      role: 'admin',
      isActive: true
    }
  });
  testUserId = user.id;

  // Create test PFA records (10 records with known costs)
  const baseDate = new Date('2025-01-01');

  for (let i = 0; i < 10; i++) {
    const pfa = await prisma.pfaRecord.create({
      data: {
        id: `test-pfa-${i}`,
        pfaId: `PFA-SCENARIO-${i}`,
        organizationId: testOrgId,
        category: 'Cranes',
        source: 'Rental',
        dor: 'BEO',
        monthlyRate: 10000, // $10K/month each
        forecastStart: new Date(baseDate.getTime() + (i * 86400000)), // Stagger by 1 day
        forecastEnd: new Date(baseDate.getTime() + (i * 86400000) + (30 * 86400000)), // 30 days each
        vendorName: i < 5 ? 'Vendor A' : 'Vendor B',
        quantity: 1,
        isActualized: false,
        isDiscontinued: false
      }
    });
    testPfaRecords.push(pfa);
  }
});

afterAll(async () => {
  // Cleanup test data
  await prisma.pfaRecord.deleteMany({
    where: { organizationId: testOrgId }
  });

  await prisma.scenarioSimulation.deleteMany({
    where: { createdBy: testUserId }
  });

  await prisma.organization.delete({
    where: { id: testOrgId }
  });

  await prisma.user.delete({
    where: { id: testUserId }
  });

  await prisma.$disconnect();
});

describe('Scenario Simulator Service', () => {
  /**
   * TEST 1: Timeline Shift Simulation
   * Verify +30 day shift increases duration by 30 days
   */
  it('should simulate timeline shift correctly', async () => {
    const result = await scenarioSimulatorService.simulateScenario(
      [testOrgId],
      {
        type: 'timeline_shift',
        shiftDays: 30
      },
      testUserId
    );

    // Verify scenario was created
    expect(result.scenarioId).toBeDefined();
    expect(result.scenarioType).toBe('timeline_shift');

    // Verify baseline metrics
    expect(result.baselineMetrics.equipmentCount).toBe(10);
    expect(result.baselineMetrics.totalCost).toBeGreaterThan(0);

    // Verify scenario metrics (cost should remain same for timeline shift)
    expect(result.scenarioMetrics.totalCost).toBeCloseTo(result.baselineMetrics.totalCost, 0);

    // Verify impact (duration should increase by ~300 days: 30 days * 10 records)
    expect(result.impact.durationDelta).toBeGreaterThan(0);
    expect(result.impact.equipmentDelta).toBe(0); // No equipment change

    // Verify timeline comparison
    expect(result.timeline.baseline).toHaveLength(10);
    expect(result.timeline.scenario).toHaveLength(10);

    console.log('Timeline Shift Test Results:');
    console.log(`  Baseline Cost: $${Math.round(result.baselineMetrics.totalCost).toLocaleString()}`);
    console.log(`  Scenario Cost: $${Math.round(result.scenarioMetrics.totalCost).toLocaleString()}`);
    console.log(`  Duration Delta: ${Math.round(result.impact.durationDelta)} days`);
    console.log(`  Equipment Count: ${result.baselineMetrics.equipmentCount}`);
  }, 10000); // 10 second timeout

  /**
   * TEST 2: Vendor Switch Simulation
   * Verify switching to cheaper vendor reduces total cost
   */
  it('should simulate vendor switch with cost reduction', async () => {
    const result = await scenarioSimulatorService.simulateScenario(
      [testOrgId],
      {
        type: 'vendor_switch',
        sourceVendor: 'Vendor A',
        targetVendor: 'Vendor B'
      },
      testUserId
    );

    // Verify scenario was created
    expect(result.scenarioId).toBeDefined();
    expect(result.scenarioType).toBe('vendor_switch');

    // Verify cost reduction (vendor switch applies 15% reduction)
    expect(result.impact.costDelta).toBeLessThan(0); // Negative delta = savings
    expect(result.impact.costDeltaPercent).toBeLessThan(0);

    // Vendor switch affects 5 records (Vendor A → Vendor B)
    // Expected savings: 5 records × $10K/month × 15% × ~1 month = ~$7,500
    const expectedSavings = 5 * 10000 * 0.15 * 1; // Approximate
    expect(Math.abs(result.impact.costDelta)).toBeGreaterThan(expectedSavings * 0.5); // Within 50% tolerance

    console.log('Vendor Switch Test Results:');
    console.log(`  Baseline Cost: $${Math.round(result.baselineMetrics.totalCost).toLocaleString()}`);
    console.log(`  Scenario Cost: $${Math.round(result.scenarioMetrics.totalCost).toLocaleString()}`);
    console.log(`  Cost Savings: $${Math.round(Math.abs(result.impact.costDelta)).toLocaleString()}`);
    console.log(`  Savings Percent: ${Math.abs(result.impact.costDeltaPercent).toFixed(1)}%`);
  }, 10000);

  /**
   * TEST 3: Monte Carlo Simulation
   * Verify P10 < P50 < P90 distribution for weather delay scenario
   */
  it('should run Monte Carlo simulation with correct distribution', async () => {
    const result = await scenarioSimulatorService.simulateScenario(
      [testOrgId],
      {
        type: 'weather_delay',
        shiftDays: 20, // Mean delay
        monteCarloEnabled: true,
        iterations: 1000
      },
      testUserId
    );

    // Verify Monte Carlo was enabled
    expect(result.riskAnalysis).toBeDefined();

    if (result.riskAnalysis) {
      // Verify distribution is correctly ordered
      expect(result.riskAnalysis.p10).toBeLessThan(result.riskAnalysis.p50);
      expect(result.riskAnalysis.p50).toBeLessThan(result.riskAnalysis.p90);

      // Verify mean is close to P50 (median)
      const meanDiff = Math.abs(result.riskAnalysis.mean - result.riskAnalysis.p50);
      const meanDiffPercent = (meanDiff / result.riskAnalysis.p50) * 100;
      expect(meanDiffPercent).toBeLessThan(10); // Within 10% tolerance

      // Verify standard deviation is reasonable
      expect(result.riskAnalysis.stdDev).toBeGreaterThan(0);

      // Verify distribution array has 1000 entries
      expect(result.riskAnalysis.distribution).toHaveLength(1000);

      console.log('Monte Carlo Test Results (1,000 iterations):');
      console.log(`  P10 (Best Case):  $${Math.round(result.riskAnalysis.p10).toLocaleString()}`);
      console.log(`  P50 (Median):     $${Math.round(result.riskAnalysis.p50).toLocaleString()}`);
      console.log(`  P90 (Worst Case): $${Math.round(result.riskAnalysis.p90).toLocaleString()}`);
      console.log(`  Mean:             $${Math.round(result.riskAnalysis.mean).toLocaleString()}`);
      console.log(`  Std. Dev:         $${Math.round(result.riskAnalysis.stdDev).toLocaleString()}`);
      console.log(`  Distribution:     ${result.riskAnalysis.distribution.length} data points`);
    }
  }, 30000); // 30 second timeout for Monte Carlo

  /**
   * TEST 4: Scenario Comparison
   * Verify 2+ scenarios can be compared side-by-side
   */
  it('should compare multiple scenarios side-by-side', async () => {
    // Create scenario 1: Timeline shift +15 days
    const scenario1 = await scenarioSimulatorService.simulateScenario(
      [testOrgId],
      {
        type: 'timeline_shift',
        shiftDays: 15
      },
      testUserId
    );

    // Create scenario 2: Timeline shift +30 days
    const scenario2 = await scenarioSimulatorService.simulateScenario(
      [testOrgId],
      {
        type: 'timeline_shift',
        shiftDays: 30
      },
      testUserId
    );

    // Compare scenarios
    const comparison = await scenarioSimulatorService.compareScenarios([
      scenario1.scenarioId,
      scenario2.scenarioId
    ]);

    // Verify comparison structure
    expect(comparison.scenarios).toHaveLength(2);
    expect(comparison.comparisonMatrix).toBeDefined();

    // Verify comparison matrix has metrics
    expect(comparison.comparisonMatrix.scenarioIds).toHaveLength(2);
    expect(comparison.comparisonMatrix.metrics.totalCost).toBeDefined();
    expect(comparison.comparisonMatrix.metrics.totalDuration).toBeDefined();
    expect(comparison.comparisonMatrix.metrics.equipmentCount).toBeDefined();

    // Verify metric arrays have correct length
    expect(comparison.comparisonMatrix.metrics.totalCost.baseline).toHaveLength(2);
    expect(comparison.comparisonMatrix.metrics.totalCost.scenario).toHaveLength(2);
    expect(comparison.comparisonMatrix.metrics.totalCost.delta).toHaveLength(2);

    console.log('Scenario Comparison Test Results:');
    console.log(`  Scenarios Compared: ${comparison.scenarios.length}`);
    console.log(`  Scenario 1: ${scenario1.scenarioType} (+15 days)`);
    console.log(`  Scenario 2: ${scenario2.scenarioType} (+30 days)`);
    console.log(`  Comparison Matrix Keys: ${Object.keys(comparison.comparisonMatrix.metrics).join(', ')}`);
  }, 15000);

  /**
   * TEST 5: Budget Cut Simulation
   * Verify budget cut reduces costs proportionally
   */
  it('should simulate budget cut with proportional cost reduction', async () => {
    const cutPercent = 20; // 20% budget cut

    const result = await scenarioSimulatorService.simulateScenario(
      [testOrgId],
      {
        type: 'budget_cut',
        budgetCutPercent: cutPercent
      },
      testUserId
    );

    // Verify cost reduction is close to cutPercent
    const expectedDelta = result.baselineMetrics.totalCost * (cutPercent / 100);
    const actualDelta = Math.abs(result.impact.costDelta);

    // Should be within 1% tolerance
    expect(actualDelta).toBeCloseTo(expectedDelta, -2);

    // Verify equipment count remains same
    expect(result.impact.equipmentDelta).toBe(0);

    console.log('Budget Cut Test Results:');
    console.log(`  Cut Percentage: ${cutPercent}%`);
    console.log(`  Expected Savings: $${Math.round(expectedDelta).toLocaleString()}`);
    console.log(`  Actual Savings: $${Math.round(actualDelta).toLocaleString()}`);
    console.log(`  Equipment Count: ${result.baselineMetrics.equipmentCount} (unchanged)`);
  }, 10000);

  /**
   * TEST 6: Equipment Consolidation
   * Verify consolidation removes low-cost equipment
   */
  it('should consolidate equipment by removing bottom percentage', async () => {
    const consolidatePercent = 30; // Remove bottom 30%

    const result = await scenarioSimulatorService.simulateScenario(
      [testOrgId],
      {
        type: 'consolidation',
        consolidationPercent: consolidatePercent
      },
      testUserId
    );

    // Verify equipment count decreased
    expect(result.impact.equipmentDelta).toBeLessThan(0);

    // Expected reduction: 30% of 10 = 3 equipment
    const expectedReduction = Math.floor(10 * (consolidatePercent / 100));
    expect(Math.abs(result.impact.equipmentDelta)).toBe(expectedReduction);

    // Verify cost also decreased
    expect(result.impact.costDelta).toBeLessThan(0);

    console.log('Equipment Consolidation Test Results:');
    console.log(`  Consolidation Percentage: ${consolidatePercent}%`);
    console.log(`  Baseline Equipment: ${result.baselineMetrics.equipmentCount}`);
    console.log(`  Scenario Equipment: ${result.scenarioMetrics.equipmentCount}`);
    console.log(`  Equipment Removed: ${Math.abs(result.impact.equipmentDelta)}`);
    console.log(`  Cost Savings: $${Math.round(Math.abs(result.impact.costDelta)).toLocaleString()}`);
  }, 10000);
});

describe('Scenario List and Retrieval', () => {
  let scenarioId: string;

  it('should save scenario to database', async () => {
    const result = await scenarioSimulatorService.simulateScenario(
      [testOrgId],
      {
        type: 'timeline_shift',
        shiftDays: 10
      },
      testUserId
    );

    scenarioId = result.scenarioId;

    // Verify scenario was saved
    const saved = await scenarioSimulatorService.getScenario(scenarioId);
    expect(saved).toBeDefined();
    expect(saved.scenarioId).toBe(scenarioId);
  }, 10000);

  it('should list user scenarios', async () => {
    const scenarios = await scenarioSimulatorService.listUserScenarios(testUserId);

    // Should have at least 1 scenario from previous tests
    expect(scenarios.length).toBeGreaterThan(0);

    // Verify scenario structure
    const firstScenario = scenarios[0];
    expect(firstScenario.scenarioId).toBeDefined();
    expect(firstScenario.scenarioType).toBeDefined();
    expect(firstScenario.parameters).toBeDefined();
    expect(firstScenario.baselineMetrics).toBeDefined();
    expect(firstScenario.scenarioMetrics).toBeDefined();
    expect(firstScenario.impact).toBeDefined();

    console.log(`User has ${scenarios.length} saved scenarios`);
  }, 10000);
});
