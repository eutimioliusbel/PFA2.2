import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAllEndpoints() {
  // Get all API servers with their endpoints
  const servers = await prisma.api_servers.findMany({
    include: {
      api_endpoints: true
    }
  });

  console.log(`Found ${servers.length} API servers\n`);

  for (const server of servers) {
    console.log('='.repeat(80));
    console.log(`Server: ${server.name}`);
    console.log(`Base URL: ${server.baseUrl}`);
    console.log(`Organization ID: ${server.organizationId}`);
    console.log(`Auth Type: ${server.authType}`);
    console.log(`Common Headers: ${server.commonHeaders}`);
    console.log(`Status: ${server.status}`);
    console.log(`Endpoints: ${server.api_endpoints.length}`);
    console.log('-'.repeat(80));

    for (const endpoint of server.api_endpoints) {
      console.log(`  Endpoint: ${endpoint.name}`);
      console.log(`  Path: ${endpoint.path}`);
      console.log(`  Entity: ${endpoint.entity}`);
      console.log(`  Operation: ${endpoint.operationType}`);
      console.log(`  Custom Headers: ${endpoint.customHeaders}`);
      console.log(`  Status: ${endpoint.status}`);
      console.log(`  Test Count: ${endpoint.testCount}, Successes: ${endpoint.successCount}`);
      console.log(`  Last Status Code: ${endpoint.lastStatusCode}`);
      console.log();
    }
  }

  await prisma.$disconnect();
}

checkAllEndpoints();
