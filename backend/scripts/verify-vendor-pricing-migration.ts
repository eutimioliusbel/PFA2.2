/**
 * Verify Vendor Pricing Watchdog Migration
 *
 * Checks that the database migration was successful and new tables exist.
 */

import prisma from '../src/config/database';
import { logger } from '../src/utils/logger';

async function verifyMigration() {
  try {
    logger.info('Verifying vendor pricing watchdog migration...');

    // Check vendor_pricing_snapshots table
    const snapshotCount = await prisma.vendor_pricing_snapshots.count();
    logger.info(`✓ vendor_pricing_snapshots table exists (count: ${snapshotCount})`);

    // Check pricing_anomalies table
    const anomalyCount = await prisma.pricing_anomalies.count();
    logger.info(`✓ pricing_anomalies table exists (count: ${anomalyCount})`);

    // Check vendorName field on pfa_records
    const pfaWithVendor = await prisma.pfa_records.findFirst({
      where: { vendorName: { not: null } },
    });
    logger.info(`✓ pfa_records.vendorName field exists`);

    logger.info('✓ All migration checks passed!');

    await prisma.$disconnect();
    process.exit(0);

  } catch (error) {
    logger.error('Migration verification failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

verifyMigration();
