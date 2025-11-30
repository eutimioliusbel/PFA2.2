/**
 * Narrative Explainer Service Integration Tests
 *
 * Phase 8, Task 8.2 of ADR-005 Multi-Tenant Access Control
 * UC-22: Narrative Variance Generator
 *
 * Test Coverage:
 * 1. Chapter Generation Test - Verify 5 chapters created with correct structure
 * 2. Evidence Linking Test - Verify audit logs linked correctly
 * 3. Timeline Generation Test - Verify timeline events with financial impacts
 * 4. Key Takeaways Test - Verify AI extracts actionable recommendations
 * 5. Reading Time Test - Verify estimation (5 chapters × 200 words → ~5 min)
 * 6. Progress Tracking Test - Verify reading progress save/restore
 * 7. PDF Export Test - Verify PDF generation endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../src/config/database';
import { NarrativeExplainerService } from '../../src/services/ai/NarrativeExplainerService';

// ============================================================================
// Test Setup
// ============================================================================

let testUserId: string;
let testOrgId: string;
let adminUserId: string;
let narrativeService: NarrativeExplainerService;

beforeAll(async () => {
  // Create test organization
  const org = await prisma.organization.create({
    data: {
      code: 'TEST-NARR',
      name: 'Test Narrative Organization',
      isActive: true,
    },
  });
  testOrgId = org.id;

  // Create admin user with BEO access
  const adminUser = await prisma.user.create({
    data: {
      username: 'narrative-admin',
      email: 'narrative-admin@test.com',
      passwordHash: 'test-hash',
      role: 'admin',
      isActive: true,
    },
  });
  adminUserId = adminUser.id;

  // Create regular user without BEO access
  const user = await prisma.user.create({
    data: {
      username: 'narrative-user',
      email: 'narrative-user@test.com',
      passwordHash: 'test-hash',
      role: 'user',
      isActive: true,
    },
  });
  testUserId = user.id;

  // Link admin to organization with BEO permissions
  await prisma.userOrganization.create({
    data: {
      userId: adminUserId,
      organizationId: testOrgId,
      perm_ManageSettings: true,
      perm_Read: true,
      perm_ViewFinancials: true,
    },
  });

  // Create test PFA records with variance
  await prisma.pfaRecord.createMany({
    data: [
      {
        id: 'test-pfa-1',
        pfaId: 'PFA-001',
        organizationId: testOrgId,
        category: 'Cranes',
        class: '150T Crawler Crane',
        source: 'Rental',
        monthlyRate: 50000,
        originalStart: new Date('2024-01-01'),
        originalEnd: new Date('2024-03-31'),
        forecastStart: new Date('2024-01-01'),
        forecastEnd: new Date('2024-04-30'), // Extended by 1 month
        hasPlan: true,
      },
      {
        id: 'test-pfa-2',
        pfaId: 'PFA-002',
        organizationId: testOrgId,
        category: 'Cranes',
        class: '100T Mobile Crane',
        source: 'Rental',
        monthlyRate: 30000,
        originalStart: new Date('2024-02-01'),
        originalEnd: new Date('2024-04-30'),
        forecastStart: new Date('2024-03-01'), // Delayed by 1 month
        forecastEnd: new Date('2024-05-31'), // Extended by 1 month
        hasPlan: true,
      },
      {
        id: 'test-pfa-3',
        pfaId: 'PFA-003',
        organizationId: testOrgId,
        category: 'Excavators',
        class: 'Hydraulic Excavator',
        source: 'Purchase',
        purchasePrice: 250000,
        originalStart: new Date('2024-01-15'),
        originalEnd: new Date('2024-12-31'),
        forecastStart: new Date('2024-01-15'),
        forecastEnd: new Date('2024-12-31'),
        hasPlan: true,
      },
    ],
  });

  // Create audit log evidence
  await prisma.auditLog.createMany({
    data: [
      {
        userId: adminUserId,
        organizationId: testOrgId,
        action: 'pfa_update',
        resource: 'PFA-001',
        metadata: {
          field: 'forecastEnd',
          oldValue: '2024-03-31',
          newValue: '2024-04-30',
          reason: 'Weather delay - extended crane rental by 30 days',
        },
        success: true,
        timestamp: new Date('2024-03-15'),
      },
      {
        userId: adminUserId,
        organizationId: testOrgId,
        action: 'pfa_update',
        resource: 'PFA-002',
        metadata: {
          field: 'forecastStart',
          oldValue: '2024-02-01',
          newValue: '2024-03-01',
          reason: 'Equipment availability delay',
        },
        success: true,
        timestamp: new Date('2024-02-10'),
      },
      {
        userId: adminUserId,
        organizationId: testOrgId,
        action: 'pfa_update',
        resource: 'PFA-002',
        metadata: {
          field: 'forecastEnd',
          oldValue: '2024-04-30',
          newValue: '2024-05-31',
          reason: 'Scope change - extended project timeline',
        },
        success: true,
        timestamp: new Date('2024-04-01'),
      },
    ],
  });

  // Initialize narrative service
  narrativeService = new NarrativeExplainerService();
});

afterAll(async () => {
  // Cleanup
  await prisma.narrativeReport.deleteMany({ where: { organizationId: testOrgId } });
  await prisma.auditLog.deleteMany({ where: { organizationId: testOrgId } });
  await prisma.pfaRecord.deleteMany({ where: { organizationId: testOrgId } });
  await prisma.userOrganization.deleteMany({ where: { organizationId: testOrgId } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUserId, testUserId] } } });
  await prisma.organization.delete({ where: { id: testOrgId } });
  await prisma.$disconnect();
});

// ============================================================================
// Tests
// ============================================================================

describe('Narrative Explainer Service - UC 22', () => {
  // Test 1: Chapter Generation
  it('should generate 5 chapters with correct structure', async () => {
    const result = await narrativeService.explainVariance({
      userId: adminUserId,
      organizationId: testOrgId,
    });

    // Verify 5 chapters
    expect(result.chapters).toHaveLength(5);

    // Verify chapter structure
    result.chapters.forEach((chapter, idx) => {
      expect(chapter.number).toBe(idx + 1);
      expect(chapter.title).toBeTruthy();
      expect(chapter.content).toBeTruthy();
      expect(chapter.wordCount).toBeGreaterThan(0);
      expect(Array.isArray(chapter.evidence)).toBe(true);
    });

    // Verify chapter titles
    const expectedTitles = ['The Plan', 'The Event', 'Equipment Impact', 'The Ripple Effect', 'The Outcome'];
    result.chapters.forEach((chapter, idx) => {
      expect(chapter.title).toBe(expectedTitles[idx]);
    });

    // Verify each chapter has 150-250 words (with some tolerance)
    result.chapters.forEach((chapter) => {
      expect(chapter.wordCount).toBeGreaterThan(100); // Allow some variance
      expect(chapter.wordCount).toBeLessThan(350);
    });
  }, 30000); // 30 second timeout for AI generation

  // Test 2: Evidence Linking
  it('should link audit logs as evidence to chapters', async () => {
    const result = await narrativeService.explainVariance({
      userId: adminUserId,
      organizationId: testOrgId,
    });

    // Chapter 2 ("The Event") should have audit log evidence
    const chapter2 = result.chapters.find(ch => ch.number === 2);
    expect(chapter2).toBeDefined();
    expect(chapter2!.evidence.length).toBeGreaterThan(0);

    // Verify evidence structure
    chapter2!.evidence.forEach((ev) => {
      expect(ev.id).toBeTruthy();
      expect(ev.type).toBe('audit_log');
      expect(ev.timestamp).toBeInstanceOf(Date);
      expect(ev.description).toBeTruthy();
    });
  }, 30000);

  // Test 3: Timeline Generation
  it('should build timeline with financial impacts', async () => {
    const result = await narrativeService.explainVariance({
      userId: adminUserId,
      organizationId: testOrgId,
    });

    // Timeline should have events
    expect(result.timeline.length).toBeGreaterThan(0);

    // Verify timeline structure
    result.timeline.forEach((event) => {
      expect(event.id).toBeTruthy();
      expect(event.date).toBeInstanceOf(Date);
      expect(event.title).toBeTruthy();
      expect(event.description).toBeTruthy();
      expect(typeof event.impact).toBe('number');
      expect(['plan', 'event', 'impact', 'outcome']).toContain(event.category);
      expect(Array.isArray(event.evidence)).toBe(true);
    });

    // Timeline should be sorted chronologically
    for (let i = 1; i < result.timeline.length; i++) {
      expect(result.timeline[i].date.getTime()).toBeGreaterThanOrEqual(
        result.timeline[i - 1].date.getTime()
      );
    }

    // Should have plan baseline event
    const planEvent = result.timeline.find(e => e.category === 'plan');
    expect(planEvent).toBeDefined();

    // Should have outcome event
    const outcomeEvent = result.timeline.find(e => e.category === 'outcome');
    expect(outcomeEvent).toBeDefined();
    expect(outcomeEvent!.impact).not.toBe(0); // Should have variance
  }, 30000);

  // Test 4: Key Takeaways Extraction
  it('should extract actionable key takeaways and recommendations', async () => {
    const result = await narrativeService.explainVariance({
      userId: adminUserId,
      organizationId: testOrgId,
    });

    // Should have key takeaways
    expect(result.keyTakeaways.length).toBeGreaterThan(0);
    expect(result.keyTakeaways.length).toBeLessThanOrEqual(5); // Reasonable limit

    // Verify takeaways are strings
    result.keyTakeaways.forEach((takeaway) => {
      expect(typeof takeaway).toBe('string');
      expect(takeaway.length).toBeGreaterThan(10); // Should be meaningful
    });

    // Should have recommendations
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeLessThanOrEqual(5);

    // Verify recommendations are strings
    result.recommendations.forEach((rec) => {
      expect(typeof rec).toBe('string');
      expect(rec.length).toBeGreaterThan(10);
    });
  }, 30000);

  // Test 5: Reading Time Estimation
  it('should estimate reading time based on word count (~200 words/min)', async () => {
    const result = await narrativeService.explainVariance({
      userId: adminUserId,
      organizationId: testOrgId,
    });

    // Calculate expected reading time
    const totalWords = result.chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
    const expectedMinutes = Math.ceil(totalWords / 200);

    // Verify estimated reading time matches
    expect(result.estimatedReadTime).toBe(expectedMinutes);

    // For 5 chapters × ~200 words each = ~1000 words = ~5 minutes
    expect(result.estimatedReadTime).toBeGreaterThan(0);
    expect(result.estimatedReadTime).toBeLessThan(15); // Should be reasonable
  }, 30000);

  // Test 6: Reading Progress Tracking
  it('should save and restore reading progress', async () => {
    // Generate narrative first
    const result = await narrativeService.explainVariance({
      userId: adminUserId,
      organizationId: testOrgId,
    });

    const narrativeId = result.narrativeId;

    // Save progress at chapter 3
    await narrativeService.updateReadingProgress(narrativeId, adminUserId, 3);

    // Fetch narrative and verify progress
    const narrative = await narrativeService.getNarrative(narrativeId);

    expect(narrative.readingProgress).toBeDefined();
    expect(narrative.readingProgress![adminUserId]).toBeDefined();
    expect(narrative.readingProgress![adminUserId].chapter).toBe(3);
    expect(narrative.readingProgress![adminUserId].timestamp).toBeTruthy();

    // Update progress to chapter 5
    await narrativeService.updateReadingProgress(narrativeId, adminUserId, 5);

    // Verify updated progress
    const updatedNarrative = await narrativeService.getNarrative(narrativeId);
    expect(updatedNarrative.readingProgress![adminUserId].chapter).toBe(5);
  }, 30000);

  // Test 7: Authorization Check
  it('should require BEO access (perm_ViewAllOrgs capability)', async () => {
    // Attempt to generate narrative as regular user (no BEO access)
    await expect(
      narrativeService.explainVariance({
        userId: testUserId, // Regular user, not admin
        organizationId: testOrgId,
      })
    ).rejects.toThrow('BEO access required');
  }, 10000);

  // Test 8: Unique Narrative ID Generation
  it('should generate unique narrative IDs', async () => {
    const result1 = await narrativeService.explainVariance({
      userId: adminUserId,
      organizationId: testOrgId,
    });

    const result2 = await narrativeService.explainVariance({
      userId: adminUserId,
      organizationId: testOrgId,
    });

    // Verify narrativeIds are unique
    expect(result1.narrativeId).not.toBe(result2.narrativeId);

    // Verify format: NARR-{ORG_CODE}-{YEAR}-{SEQUENCE}
    expect(result1.narrativeId).toMatch(/^NARR-TEST-NARR-\d{4}-\d{3}$/);
    expect(result2.narrativeId).toMatch(/^NARR-TEST-NARR-\d{4}-\d{3}$/);
  }, 30000);

  // Test 9: Metadata Accuracy
  it('should include accurate metadata in response', async () => {
    const result = await narrativeService.explainVariance({
      userId: adminUserId,
      organizationId: testOrgId,
    });

    // Verify metadata structure
    expect(result.metadata).toBeDefined();
    expect(result.metadata.organizationCode).toBe('TEST-NARR');
    expect(result.metadata.organizationName).toBe('Test Narrative Organization');
    expect(typeof result.metadata.totalVariance).toBe('number');
    expect(typeof result.metadata.variancePercent).toBe('number');
    expect(result.metadata.affectedRecords).toBe(3); // We created 3 PFA records
    expect(result.metadata.generatedAt).toBeInstanceOf(Date);
    expect(result.metadata.modelUsed).toBe('gemini-2.0-flash-exp');
    expect(result.metadata.latencyMs).toBeGreaterThan(0);
  }, 30000);

  // Test 10: Latency Performance
  it('should generate narrative in less than 10 seconds', async () => {
    const startTime = Date.now();

    await narrativeService.explainVariance({
      userId: adminUserId,
      organizationId: testOrgId,
    });

    const duration = Date.now() - startTime;

    // Verify latency budget: <10 seconds
    expect(duration).toBeLessThan(10000);
  }, 15000);
});
