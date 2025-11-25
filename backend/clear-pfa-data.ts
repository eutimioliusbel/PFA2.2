/**
 * Clear PFA Data Script
 *
 * Removes all existing PFA records from the database before sync
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearPfaData() {
  try {
    console.log('📊 Counting existing PFA records...');
    const count = await prisma.pfaRecord.count();
    console.log(`Found ${count} PFA records in database`);

    if (count === 0) {
      console.log('✅ No PFA records to delete');
      return;
    }

    console.log(`🗑️  Deleting ${count} PFA records...`);
    const result = await prisma.pfaRecord.deleteMany({});
    console.log(`✅ Deleted ${result.count} PFA records successfully`);

  } catch (error) {
    console.error('❌ Error clearing PFA data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearPfaData()
  .then(() => {
    console.log('\n✅ PFA data cleared successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed to clear PFA data:', error);
    process.exit(1);
  });
