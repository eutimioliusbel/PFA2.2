/**
 * @file migrate-to-mirror.ts
 * @description Migrate existing PfaRecord data to Mirror + Delta architecture
 * @usage npx tsx scripts/db/migrate-to-mirror.ts
 *
 * WARNING: This script assumes:
 * 1. PostgreSQL is running and DATABASE_URL is configured
 * 2. Mirror + Delta migration has been applied (schema exists)
 * 3. Existing PfaRecord table has data to migrate
 *
 * This script will:
 * - Read all PfaRecord data from old table
 * - Transform to JSONB format
 * - Insert into pfa_mirror table in batches
 * - Refresh materialized views
 * - Verify data integrity
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const BATCH_SIZE = 1000;

interface MigrationStats {
  totalRecords: number;
  migratedRecords: number;
  failedRecords: number;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  errors: { pfaId: string; error: string }[];
}

async function migrateToMirror(): Promise<MigrationStats> {
  console.log('========================================');
  console.log('PFA VANGUARD: Mirror Migration');
  console.log('========================================\n');

  const stats: MigrationStats = {
    totalRecords: 0,
    migratedRecords: 0,
    failedRecords: 0,
    startTime: new Date(),
    errors: [],
  };

  try {
    // Step 1: Check if Mirror table exists
    console.log('[1/6] Checking if pfa_mirror table exists...');
    const tableExists = await prisma.$queryRaw<
      { exists: boolean }[]
    >`SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'pfa_mirror'
    )`;

    if (!tableExists[0].exists) {
      throw new Error(
        'pfa_mirror table does not exist. Run migration first: npx prisma migrate dev'
      );
    }
    console.log('   ✓ pfa_mirror table exists\n');

    // Step 2: Count existing records
    console.log('[2/6] Counting existing PfaRecord data...');
    stats.totalRecords = await prisma.pfa_records.count();
    console.log(`   ✓ Found ${stats.totalRecords} records to migrate\n`);

    if (stats.totalRecords === 0) {
      console.log('   ⚠ No records to migrate. Exiting.');
      return stats;
    }

    // Step 3: Check if mirror already has data (prevent duplicate migration)
    console.log('[3/6] Checking for existing mirror data...');
    const existingMirrorCount = await prisma.pfa_mirror.count();
    if (existingMirrorCount > 0) {
      console.log(`   ⚠ Warning: pfa_mirror already has ${existingMirrorCount} records`);
      const response = await confirm(
        'Do you want to skip existing records and only migrate new ones? (y/n): '
      );
      if (!response) {
        throw new Error('Migration cancelled by user');
      }
    } else {
      console.log('   ✓ pfa_mirror is empty, ready to migrate\n');
    }

    // Step 4: Migrate data in batches
    console.log('[4/6] Migrating data to pfa_mirror...');
    console.log(`   Batch size: ${BATCH_SIZE} records`);
    console.log('   This may take several minutes for large datasets...\n');

    const totalBatches = Math.ceil(stats.totalRecords / BATCH_SIZE);
    let currentBatch = 0;

    for (let offset = 0; offset < stats.totalRecords; offset += BATCH_SIZE) {
      currentBatch++;
      const progressPercent = ((offset / stats.totalRecords) * 100).toFixed(1);

      // Fetch batch
      const batch = await prisma.pfa_records.findMany({
        skip: offset,
        take: BATCH_SIZE,
        orderBy: { createdAt: 'asc' },
      });

      // Transform and insert
      for (const record of batch) {
        try {
          // Check if already migrated
          const existing = await prisma.pfa_mirror.findFirst({
            where: {
              organizationId: record.organizationId,
              pfaId: record.pfaId,
            },
          });

          if (existing) {
            // Skip already migrated record
            stats.migratedRecords++;
            continue;
          }

          // Transform to JSONB structure
          const jsonbData = {
            pfaId: record.pfaId,
            areaSilo: record.areaSilo,
            category: record.category,
            forecastCategory: record.forecastCategory,
            class: record.class,
            source: record.source,
            dor: record.dor,
            isActualized: record.isActualized,
            isDiscontinued: record.isDiscontinued,
            isFundsTransferable: record.isFundsTransferable,
            monthlyRate: record.monthlyRate,
            purchasePrice: record.purchasePrice,
            manufacturer: record.manufacturer,
            model: record.model,
            originalStart: record.originalStart?.toISOString(),
            originalEnd: record.originalEnd?.toISOString(),
            hasPlan: record.hasPlan,
            forecastStart: record.forecastStart?.toISOString(),
            forecastEnd: record.forecastEnd?.toISOString(),
            actualStart: record.actualStart?.toISOString(),
            actualEnd: record.actualEnd?.toISOString(),
            hasActuals: record.hasActuals,
            contract: record.contract,
            equipment: record.equipment,
          };

          // Insert into pfa_mirror
          await prisma.pfa_mirror.create({
            data: {
              id: randomUUID(),
              organizationId: record.organizationId,
              pfaId: record.pfaId,
              data: jsonbData,
              pemsVersion: record.lastModified?.toISOString() || null,
              lastSyncedAt: new Date(),
              syncBatchId: 'migration-batch',
              updatedAt: new Date(),
            },
          });

          stats.migratedRecords++;
        } catch (error) {
          stats.failedRecords++;
          stats.errors.push({
            pfaId: record.pfaId,
            error: error instanceof Error ? error.message : String(error),
          });

          console.error(`   ✗ Failed to migrate record ${record.pfaId}:`, error);
        }
      }

      // Progress update
      console.log(
        `   [Batch ${currentBatch}/${totalBatches}] ${progressPercent}% - Migrated: ${stats.migratedRecords}, Failed: ${stats.failedRecords}`
      );
    }

    console.log(`\n   ✓ Migration complete!\n`);

    // Step 5: Refresh materialized views
    console.log('[5/6] Refreshing materialized views...');
    try {
      await prisma.$executeRaw`SELECT refresh_pfa_materialized_views()`;
      console.log('   ✓ Materialized views refreshed\n');
    } catch (error) {
      console.error('   ✗ Failed to refresh materialized views:', error);
      console.log(
        '   ⚠ You may need to manually refresh: SELECT refresh_pfa_materialized_views();\n'
      );
    }

    // Step 6: Verify data integrity
    console.log('[6/6] Verifying data integrity...');
    const mirrorCount = await prisma.pfa_mirror.count();
    const recordCount = await prisma.pfa_records.count();

    console.log(`   Original records: ${recordCount}`);
    console.log(`   Migrated records: ${mirrorCount}`);

    if (mirrorCount === recordCount) {
      console.log('   ✓ Data integrity verified: All records migrated\n');
    } else {
      console.log(
        `   ⚠ Warning: Record count mismatch (${mirrorCount} vs ${recordCount})`
      );
      console.log('   Check errors below for failed records\n');
    }

    // Step 7: Sample verification query
    console.log('[VERIFICATION] Sample merged view query...');
    const sampleRecords = await prisma.$queryRaw<any[]>`
      SELECT
        organization_id,
        pfa_id,
        category,
        source,
        is_actualized,
        forecast_start,
        forecast_end
      FROM pfa_merged_live
      LIMIT 5
    `;

    console.log('   Sample records from pfa_merged_live:');
    console.table(sampleRecords);

    // Completion stats
    stats.endTime = new Date();
    stats.durationMs =
      stats.endTime.getTime() - stats.startTime.getTime();

    console.log('\n========================================');
    console.log('MIGRATION SUMMARY');
    console.log('========================================');
    console.log(`Total records: ${stats.totalRecords}`);
    console.log(`Successfully migrated: ${stats.migratedRecords}`);
    console.log(`Failed: ${stats.failedRecords}`);
    console.log(`Duration: ${(stats.durationMs / 1000).toFixed(2)}s`);
    console.log(
      `Average: ${(stats.durationMs / stats.migratedRecords).toFixed(2)}ms per record`
    );

    if (stats.failedRecords > 0) {
      console.log('\nFailed Records:');
      stats.errors.slice(0, 10).forEach((err) => {
        console.log(`  - ${err.pfaId}: ${err.error}`);
      });
      if (stats.errors.length > 10) {
        console.log(`  ... and ${stats.errors.length - 10} more errors`);
      }
    }

    console.log('\n========================================');
    console.log('NEXT STEPS');
    console.log('========================================');
    console.log('1. Verify data in pfa_merged_live view');
    console.log('2. Test KPI dashboard: SELECT * FROM pfa_kpi_summary;');
    console.log('3. Test timeline bounds: SELECT * FROM pfa_timeline_bounds;');
    console.log('4. Update application code to use pfa_merged_live');
    console.log('5. Setup cron job for materialized view refresh');
    console.log('6. Consider archiving old PfaRecord table (DO NOT DELETE YET)');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }

  return stats;
}

// Helper function for user confirmation
async function confirm(message: string): Promise<boolean> {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    readline.question(message, (answer: string) => {
      readline.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// Main execution
if (require.main === module) {
  migrateToMirror()
    .then((stats) => {
      if (stats.failedRecords > 0) {
        console.error(
          `\n⚠ Migration completed with ${stats.failedRecords} errors`
        );
        process.exit(1);
      } else {
        console.log('\n✓ Migration completed successfully!');
        process.exit(0);
      }
    })
    .catch((error) => {
      console.error('\n✗ Migration failed:', error);
      process.exit(1);
    });
}

export { migrateToMirror };
