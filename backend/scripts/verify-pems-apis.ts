/**
 * Verify PEMS API Configurations
 *
 * Check the actual URLs and configuration in the database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🔍 Verifying PEMS API Configurations...\n');

  const pemsApis = await prisma.api_configurations.findMany({
    where: {
      usage: {
        startsWith: 'PEMS_'
      }
    },
    select: {
      id: true,
      name: true,
      usage: true,
      url: true,
      authType: true,
      operationType: true,
      feeds: true,
      status: true
    },
    orderBy: {
      name: 'asc'
    }
  });

  console.log(`Found ${pemsApis.length} PEMS API configurations:\n`);

  pemsApis.forEach((api, index) => {
    console.log(`${index + 1}. ${api.name}`);
    console.log(`   ID:        ${api.id}`);
    console.log(`   Usage:     ${api.usage}`);
    console.log(`   URL:       ${api.url}`);
    console.log(`   Auth:      ${api.authType}`);
    console.log(`   Operation: ${api.operationType}`);
    console.log(`   Status:    ${api.status}`);
    console.log(`   Feeds:     ${api.feeds?.substring(0, 100)}${api.feeds && api.feeds.length > 100 ? '...' : ''}`);
    console.log('');
  });

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
