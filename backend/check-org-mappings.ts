import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkOrgMappings() {
  try {
    // Get all organizations
    const orgs = await prisma.organization.findMany();
    console.log('=== Organizations ===');
    console.log(JSON.stringify(orgs, null, 2));

    // Get organization data source mappings
    const mappings = await prisma.dataSourceMapping.findMany({
      where: { entityType: 'organizations' },
      include: { apiConfig: true }
    });
    console.log('\n=== Organization Data Source Mappings ===');
    console.log(JSON.stringify(mappings, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrgMappings();
