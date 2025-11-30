import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkApiConfig() {
  // Get all API configurations
  const configs = await prisma.api_configurations.findMany({
    include: {
      organizations: true
    }
  });

  console.log(`Found ${configs.length} API configurations\n`);

  for (const config of configs) {
    console.log('='.repeat(80));
    console.log(`Name: ${config.name}`);
    console.log(`Organization: ${config.organizations?.name} (${config.organizations?.code})`);
    console.log(`URL: ${config.url}`);
    console.log(`Auth Type: ${config.authType}`);
    console.log(`Custom Headers: ${config.customHeaders}`);
    console.log(`Feeds: ${config.feeds}`);
    console.log(`Status: ${config.status}`);
    console.log(`Last Sync: ${config.lastSyncAt}`);
    console.log(`Total Records: ${config.totalSyncRecordCount}`);
    console.log();
  }

  await prisma.$disconnect();
}

checkApiConfig();
