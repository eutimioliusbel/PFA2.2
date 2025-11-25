import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPfaMappings() {
  try {
    // Get PFA data source mappings
    const mappings = await prisma.dataSourceMapping.findMany({
      where: { entityType: 'pfa' },
      include: { apiConfig: true }
    });
    console.log('=== PFA Data Source Mappings ===');
    console.log(JSON.stringify(mappings, null, 2));

    // Get count of PFA records
    const pfaCount = await prisma.pfaRecord.count();
    console.log(`\n=== Current PFA Records Count: ${pfaCount} ===`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPfaMappings();
