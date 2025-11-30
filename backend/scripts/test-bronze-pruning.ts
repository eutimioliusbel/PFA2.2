/**
 * Test Script: Bronze Layer Pruning
 *
 * Tests the Bronze pruning service by:
 * 1. Creating test Bronze records with old timestamps
 * 2. Running pruning service in dry-run mode
 * 3. Running actual pruning
 * 4. Verifying records are deleted
 *
 * Usage:
 *   npx tsx backend/scripts/test-bronze-pruning.ts
 */

import prisma from '../src/config/database';
import { BronzePruningService } from '../src/services/cron/BronzePruningService';
import { subDays } from 'date-fns';

async function createTestBronzeRecords() {
  console.log('📦 Creating test Bronze records...');

  // Create bronze_batches first (required foreign key)
  const oldBatchId = 'test-batch-old';
  const recentBatchId = 'test-batch-recent';

  await prisma.bronze_batches.create({
    data: {
      id: oldBatchId,
      syncBatchId: oldBatchId,
      organizationId: 'test-org',
      endpointId: 'test-endpoint',
      entityType: 'PFA',
      ingestedAt: subDays(new Date(), 100),
      completedAt: subDays(new Date(), 100),
      recordCount: 5,
      validRecordCount: 5,
      invalidRecordCount: 0,
      syncType: 'full',
    },
  });

  await prisma.bronze_batches.create({
    data: {
      id: recentBatchId,
      syncBatchId: recentBatchId,
      organizationId: 'test-org',
      endpointId: 'test-endpoint',
      entityType: 'PFA',
      ingestedAt: subDays(new Date(), 10),
      completedAt: subDays(new Date(), 10),
      recordCount: 3,
      validRecordCount: 3,
      invalidRecordCount: 0,
      syncType: 'full',
    },
  });

  // Create 5 records older than 90 days
  const oldRecords = [];
  for (let i = 0; i < 5; i++) {
    const record = await prisma.bronze_records.create({
      data: {
        id: `test-bronze-old-${i}`,
        syncBatchId: oldBatchId,
        organizationId: 'test-org',
        entityType: 'PFA',
        ingestedAt: subDays(new Date(), 100 + i), // 100-104 days old
        rawJson: {
          id: `test-old-${i}`,
          equipment: `Test Equipment ${i}`,
          cost: 1000 + i * 100,
        },
        schemaVersion: '1.0',
      },
    });
    oldRecords.push(record);
  }

  // Create 3 recent records (within 90 days)
  const recentRecords = [];
  for (let i = 0; i < 3; i++) {
    const record = await prisma.bronze_records.create({
      data: {
        id: `test-bronze-recent-${i}`,
        syncBatchId: recentBatchId,
        organizationId: 'test-org',
        entityType: 'PFA',
        ingestedAt: subDays(new Date(), 10 + i), // 10-12 days old
        rawJson: {
          id: `test-recent-${i}`,
          equipment: `Recent Equipment ${i}`,
          cost: 2000 + i * 100,
        },
        schemaVersion: '1.0',
      },
    });
    recentRecords.push(record);
  }

  console.log(`✅ Created ${oldRecords.length} old records and ${recentRecords.length} recent records`);

  return { oldRecords, recentRecords };
}

async function testPruningStats() {
  console.log('\n📊 Testing pruning statistics...');

  const pruningService = new BronzePruningService({
    retentionDays: 90,
  });

  const stats = await pruningService.getPruningStats();

  console.log('Statistics:', {
    totalBronzeRecords: stats.totalBronzeRecords,
    eligibleForPruning: stats.eligibleForPruning,
    oldestRecord: stats.oldestRecord?.toISOString(),
    newestRecord: stats.newestRecord?.toISOString(),
  });

  return stats;
}

async function testDryRun() {
  console.log('\n🧪 Testing dry run mode...');

  const pruningService = new BronzePruningService({
    retentionDays: 90,
    dryRun: true,
  });

  const result = await pruningService.pruneBronzeRecords();

  console.log('Dry run result:', {
    archived: result.archived,
    deleted: result.deleted,
    errors: result.errors,
    durationMs: result.duration,
  });

  return result;
}

async function testActualPruning() {
  console.log('\n🗑️ Testing actual pruning...');

  const pruningService = new BronzePruningService({
    retentionDays: 90,
    enableArchival: false,
    dryRun: false,
  });

  const result = await pruningService.pruneBronzeRecords();

  console.log('Actual pruning result:', {
    archived: result.archived,
    deleted: result.deleted,
    errors: result.errors,
    durationMs: result.duration,
  });

  return result;
}

async function verifyResults(expectedDeleted: number, expectedRemaining: number) {
  console.log('\n✅ Verifying results...');

  const totalRecords = await prisma.bronze_records.count();
  const cutoffDate = subDays(new Date(), 90);

  const oldRecordsRemaining = await prisma.bronze_records.count({
    where: {
      ingestedAt: { lt: cutoffDate },
    },
  });

  const recentRecords = await prisma.bronze_records.count({
    where: {
      ingestedAt: { gte: cutoffDate },
    },
  });

  console.log('Verification:', {
    totalRecords,
    oldRecordsRemaining,
    recentRecords,
  });

  // Assertions
  const deletedMatches = totalRecords === expectedRemaining;
  const oldRecordsGone = oldRecordsRemaining === 0;
  const recentRecordsIntact = recentRecords === expectedRemaining;

  if (deletedMatches && oldRecordsGone && recentRecordsIntact) {
    console.log('✅ All verifications passed!');
    return true;
  } else {
    console.error('❌ Verification failed:');
    if (!deletedMatches) console.error(`  - Expected ${expectedRemaining} total records, got ${totalRecords}`);
    if (!oldRecordsGone) console.error(`  - Expected 0 old records, got ${oldRecordsRemaining}`);
    if (!recentRecordsIntact) console.error(`  - Expected ${expectedRemaining} recent records, got ${recentRecords}`);
    return false;
  }
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');

  // Delete bronze_records first (foreign key constraint)
  await prisma.bronze_records.deleteMany({
    where: {
      organizationId: 'test-org',
    },
  });

  // Then delete bronze_batches
  await prisma.bronze_batches.deleteMany({
    where: {
      organizationId: 'test-org',
    },
  });

  console.log('✅ Cleanup complete');
}

async function main() {
  console.log('🚀 Starting Bronze Pruning Tests\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Create test data
    const { oldRecords, recentRecords } = await createTestBronzeRecords();

    // Step 2: Get pruning stats
    const stats = await testPruningStats();

    if (stats.eligibleForPruning !== oldRecords.length) {
      throw new Error(
        `Expected ${oldRecords.length} records eligible for pruning, got ${stats.eligibleForPruning}`
      );
    }

    // Step 3: Test dry run
    const dryRunResult = await testDryRun();

    if (dryRunResult.deleted !== oldRecords.length) {
      throw new Error(`Dry run expected to delete ${oldRecords.length}, got ${dryRunResult.deleted}`);
    }

    // Verify dry run didn't actually delete
    const statsAfterDryRun = await testPruningStats();
    if (statsAfterDryRun.totalBronzeRecords !== oldRecords.length + recentRecords.length) {
      throw new Error('Dry run should not have deleted records');
    }

    // Step 4: Test actual pruning
    const actualResult = await testActualPruning();

    if (actualResult.deleted !== oldRecords.length) {
      throw new Error(`Expected to delete ${oldRecords.length}, got ${actualResult.deleted}`);
    }

    // Step 5: Verify results
    const verificationPassed = await verifyResults(actualResult.deleted, recentRecords.length);

    if (!verificationPassed) {
      throw new Error('Verification failed');
    }

    // Step 6: Cleanup
    await cleanup();

    console.log('\n' + '='.repeat(60));
    console.log('🎉 All tests passed!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ Test failed:', error);

    // Cleanup on failure
    try {
      await cleanup();
    } catch (cleanupError) {
      console.error('Failed to cleanup:', cleanupError);
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
