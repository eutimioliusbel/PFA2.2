/**
 * Integration Tests: Asset Arbitrage Detector
 *
 * Tests for UC-23: Cross-organization equipment arbitrage detection
 * Phase 8, Task 8.3 of ADR-005 Multi-Tenant Access Control
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../src/config/database';
import { ArbitrageDetectorService } from '../../src/services/ai/ArbitrageDetectorService';

// ============================================================================
// TEST SETUP
// ============================================================================

let testUserId: string;
let org1Id: string; // Houston
let org2Id: string; // San Antonio
let arbitrageService: ArbitrageDetectorService;

beforeAll(async () => {
  arbitrageService = new ArbitrageDetectorService();

  // Create test user
  const testUser = await prisma.user.create({
    data: {
      username: 'test-arbitrage-user',
      email: 'arbitrage@test.com',
      passwordHash: 'test-hash',
      role: 'admin',
      isActive: true,
    },
  });
  testUserId = testUser.id;

  // Create Organization 1: Houston
  const org1 = await prisma.organization.create({
    data: {
      code: 'HOUSTON_TEST',
      name: 'Houston Test Project',
      isActive: true,
      serviceStatus: 'active',
      location: {
        lat: 29.7604,
        lon: -95.3698,
        address: 'Houston, TX',
      },
    },
  });
  org1Id = org1.id;

  // Create Organization 2: San Antonio (~200 miles from Houston)
  const org2 = await prisma.organization.create({
    data: {
      code: 'SANANTONIO_TEST',
      name: 'San Antonio Test Project',
      isActive: true,
      serviceStatus: 'active',
      location: {
        lat: 29.4241,
        lon: -98.4936,
        address: 'San Antonio, TX',
      },
    },
  });
  org2Id = org2.id;
});

afterAll(async () => {
  // Clean up test data
  await prisma.pfaRecord.deleteMany({
    where: {
      organizationId: {
        in: [org1Id, org2Id],
      },
    },
  });

  await prisma.arbitrageOpportunity.deleteMany({
    where: {
      OR: [
        { sourceOrgId: org1Id },
        { destOrgId: org1Id },
        { sourceOrgId: org2Id },
        { destOrgId: org2Id },
      ],
    },
  });

  await prisma.organization.deleteMany({
    where: {
      id: {
        in: [org1Id, org2Id],
      },
    },
  });

  await prisma.user.delete({
    where: { id: testUserId },
  });

  await prisma.$disconnect();
});

// ============================================================================
// TEST 1: IDLE TRANSFER DETECTION
// ============================================================================

describe('Asset Arbitrage Detector - Idle Transfer Detection', () => {
  it('should detect idle equipment and match with needs', async () => {
    // Setup: Houston has idle crane (ended 30 days ago)
    const idleEndDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const idleStartDate = new Date(idleEndDate.getTime() - 60 * 24 * 60 * 60 * 1000);

    await prisma.pfaRecord.create({
      data: {
        id: 'idle-crane-houston-test',
        pfaId: 'IDLE-CRANE-001',
        organizationId: org1Id,
        category: 'Cranes',
        class: '150T Crawler Crane',
        source: 'Rental',
        forecastStart: idleStartDate,
        forecastEnd: idleEndDate,
        monthlyRate: 50000,
        isDiscontinued: false,
        manufacturer: 'Liebherr',
        model: 'LR 1500',
      },
    });

    // Setup: San Antonio needs crane (starting 15 days ago, ending in 15 days)
    const needStartDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    const needEndDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

    await prisma.pfaRecord.create({
      data: {
        id: 'need-crane-sanantonio-test',
        pfaId: 'NEED-CRANE-001',
        organizationId: org2Id,
        category: 'Cranes',
        class: '150T Crawler Crane',
        source: 'Rental',
        forecastStart: needStartDate,
        forecastEnd: needEndDate,
        monthlyRate: 50000,
        isDiscontinued: false,
        manufacturer: 'Liebherr',
        model: 'LR 1500',
      },
    });

    // Execute: Detect opportunities
    const opportunities = await arbitrageService.detectOpportunities(testUserId);

    // Assert: Should detect idle transfer opportunity
    expect(opportunities.length).toBeGreaterThan(0);

    const opportunity = opportunities.find(
      (o) => o.sourceOrgCode === 'HOUSTON_TEST' && o.destOrgCode === 'SANANTONIO_TEST'
    );

    expect(opportunity).toBeDefined();
    expect(opportunity!.type).toBe('idle_transfer');
    expect(opportunity!.equipmentCategory).toBe('Cranes');
    expect(opportunity!.equipmentClass).toBe('150T Crawler Crane');
    expect(opportunity!.overlapPeriod.days).toBeGreaterThan(0);
  });
});

// ============================================================================
// TEST 2: FEASIBILITY CALCULATION
// ============================================================================

describe('Asset Arbitrage Detector - Feasibility Calculation', () => {
  it('should calculate accurate feasibility scores', async () => {
    // Setup similar to Test 1 (reuse data if exists)
    const opportunities = await arbitrageService.detectOpportunities(testUserId);

    const opportunity = opportunities.find(
      (o) => o.sourceOrgCode === 'HOUSTON_TEST' && o.destOrgCode === 'SANANTONIO_TEST'
    );

    if (!opportunity) {
      throw new Error('Opportunity not found - ensure Test 1 data exists');
    }

    // Assert: Feasibility score breakdown
    expect(opportunity.feasibilityScore).toBeGreaterThan(0);
    expect(opportunity.feasibilityScore).toBeLessThanOrEqual(1);

    // Compatibility should be high (exact class match + same manufacturer/model)
    expect(opportunity.feasibilityBreakdown.compatibility).toBeGreaterThanOrEqual(0.9);

    // Logistics should be medium-low (Houston to San Antonio ~200 miles)
    expect(opportunity.feasibilityBreakdown.logistics).toBeGreaterThan(0);
    expect(opportunity.feasibilityBreakdown.logistics).toBeLessThanOrEqual(1);

    // Cost savings should be positive (depends on overlap days)
    expect(opportunity.feasibilityBreakdown.costSavings).toBeGreaterThan(0);
  });
});

// ============================================================================
// TEST 3: TRANSPORT COST CALCULATION
// ============================================================================

describe('Asset Arbitrage Detector - Transport Cost Calculation', () => {
  it('should calculate distance-based transport cost correctly', async () => {
    const opportunities = await arbitrageService.detectOpportunities(testUserId);

    const opportunity = opportunities.find(
      (o) => o.sourceOrgCode === 'HOUSTON_TEST' && o.destOrgCode === 'SANANTONIO_TEST'
    );

    if (!opportunity) {
      throw new Error('Opportunity not found - ensure Test 1 data exists');
    }

    // Assert: Distance calculation (Houston to San Antonio ~195-200 miles)
    expect(opportunity.distance).not.toBeNull();
    expect(opportunity.distance).toBeGreaterThan(190);
    expect(opportunity.distance).toBeLessThan(210);

    // Assert: Transport cost (Cranes: $2/mile, so ~$400 for 200 miles)
    const expectedCost = (opportunity.distance || 200) * 2; // $2/mile for cranes
    expect(opportunity.transferCost).toBeCloseTo(expectedCost, -1); // Within $10
  });
});

// ============================================================================
// TEST 4: TRANSFER PROPOSAL
// ============================================================================

describe('Asset Arbitrage Detector - Transfer Proposal', () => {
  it('should create transfer proposal and save to database', async () => {
    // Detect opportunities
    const opportunities = await arbitrageService.detectOpportunities(testUserId);

    const opportunity = opportunities.find(
      (o) => o.sourceOrgCode === 'HOUSTON_TEST' && o.destOrgCode === 'SANANTONIO_TEST'
    );

    if (!opportunity) {
      throw new Error('Opportunity not found - ensure Test 1 data exists');
    }

    // Execute: Propose transfer
    const proposal = await arbitrageService.proposeTransfer(opportunity.id, testUserId);

    // Assert: Proposal created
    expect(proposal).toBeDefined();
    expect(proposal.id).toBeDefined();
    expect(proposal.sourceOrgId).toBe(org1Id);
    expect(proposal.destOrgId).toBe(org2Id);
    expect(proposal.equipmentCategory).toBe('Cranes');
    expect(proposal.status).toBe('detected');

    // Assert: Proposal saved to database
    const savedProposal = await prisma.arbitrageOpportunity.findUnique({
      where: { id: proposal.id },
    });

    expect(savedProposal).toBeDefined();
    expect(savedProposal!.sourceOrgId).toBe(org1Id);
    expect(savedProposal!.destOrgId).toBe(org2Id);
    expect(savedProposal!.potentialSavings).toBeGreaterThan(0);
    expect(savedProposal!.netSavings).toBeDefined();
  });
});
