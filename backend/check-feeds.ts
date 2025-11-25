/**
 * Check Feeds Field Script
 *
 * Checks if feeds field exists and has data in API configurations
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkFeeds() {
  try {
    console.log('📊 Checking API configurations for feeds field...\n');

    const configs = await prisma.apiConfiguration.findMany({
      where: { organizationId: null },
      select: {
        id: true,
        name: true,
        usage: true,
        feeds: true,
        firstSyncAt: true,
        lastSyncAt: true,
        lastSyncRecordCount: true,
        totalSyncRecordCount: true
      }
    });

    console.log(`Found ${configs.length} API configurations\n`);

    configs.forEach(config => {
      console.log('─────────────────────────────────────');
      console.log(`Name: ${config.name}`);
      console.log(`ID: ${config.id}`);
      console.log(`Usage: ${config.usage}`);
      console.log(`Feeds: ${config.feeds || 'NULL'}`);
      console.log(`First Sync: ${config.firstSyncAt || 'NULL'}`);
      console.log(`Last Sync: ${config.lastSyncAt || 'NULL'}`);
      console.log(`Last Sync Count: ${config.lastSyncRecordCount || 'NULL'}`);
      console.log(`Total Sync Count: ${config.totalSyncRecordCount || 'NULL'}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error checking feeds:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkFeeds()
  .then(() => {
    console.log('✅ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });
