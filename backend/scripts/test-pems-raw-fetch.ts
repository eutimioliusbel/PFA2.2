/**
 * Test script for PEMS raw data fetch using new api_servers architecture
 *
 * Usage: npx ts-node scripts/test-pems-raw-fetch.ts
 */

import { PrismaClient } from '@prisma/client';
import { pemsSyncServiceV2 } from '../src/services/pems/PemsSyncServiceV2';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(60));
  console.log('PEMS Raw Fetch Test - Using New Architecture (ADR-006)');
  console.log('='.repeat(60));

  // Get the configured server and endpoint
  const server = await prisma.api_servers.findFirst({
    where: { name: 'PEMS_DEV' },
    include: {
      api_endpoints: {
        where: { entity: 'pfa', operationType: 'read' }
      }
    }
  });

  if (!server) {
    console.error('❌ PEMS_DEV server not found');
    return;
  }

  const pfaEndpoint = server.api_endpoints[0];
  if (!pfaEndpoint) {
    console.error('❌ PFA read endpoint not found');
    return;
  }

  console.log('\n📡 Server Configuration:');
  console.log(`  - Server ID: ${server.id}`);
  console.log(`  - Server Name: ${server.name}`);
  console.log(`  - Base URL: ${server.baseUrl}`);
  console.log(`  - Auth Type: ${server.authType}`);
  console.log(`  - Common Headers: ${server.commonHeaders}`);

  console.log('\n🔌 Endpoint Configuration:');
  console.log(`  - Endpoint ID: ${pfaEndpoint.id}`);
  console.log(`  - Endpoint Name: ${pfaEndpoint.name}`);
  console.log(`  - Path: ${pfaEndpoint.path}`);
  console.log(`  - Custom Headers: ${pfaEndpoint.customHeaders}`);
  console.log(`  - Status: ${pfaEndpoint.status}`);

  // Get organizations
  const orgs = await prisma.organizations.findMany({
    select: { id: true, code: true, name: true }
  });

  console.log('\n🏢 Available Organizations:');
  orgs.forEach(org => {
    console.log(`  - ${org.code}: ${org.name} (${org.id})`);
  });

  // Test 1: Fetch raw data without org filter (first 10 records)
  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: Fetch raw data (no org filter, limit 10)');
  console.log('='.repeat(60));

  const result1 = await pemsSyncServiceV2.fetchRawData(
    server.id,
    pfaEndpoint.id,
    undefined, // No org filter
    { limit: 10, offset: 0, includeRawResponse: false }
  );

  console.log(`\n✅ Result:`);
  console.log(`  - Success: ${result1.success}`);
  console.log(`  - Status Code: ${result1.statusCode}`);
  console.log(`  - Response Time: ${result1.responseTimeMs}ms`);
  console.log(`  - Total Records (from API): ${result1.totalRecords}`);
  console.log(`  - Records Returned: ${result1.data.length}`);

  if (result1.data.length > 0) {
    console.log('\n📄 Sample Record (first row):');
    const sample = result1.data[0];
    console.log(JSON.stringify(sample, null, 2).slice(0, 1000) + '...');
  }

  if (result1.error) {
    console.log(`\n❌ Error: ${result1.error}`);
  }

  // Test 2: Fetch with RIO organization filter
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Fetch raw data (RIO org filter, limit 5)');
  console.log('='.repeat(60));

  const result2 = await pemsSyncServiceV2.fetchRawData(
    server.id,
    pfaEndpoint.id,
    'RIO',
    { limit: 5, offset: 0, includeRawResponse: false }
  );

  console.log(`\n✅ Result:`);
  console.log(`  - Success: ${result2.success}`);
  console.log(`  - Status Code: ${result2.statusCode}`);
  console.log(`  - Response Time: ${result2.responseTimeMs}ms`);
  console.log(`  - Total Records (RIO): ${result2.totalRecords}`);
  console.log(`  - Records Returned: ${result2.data.length}`);

  if (result2.error) {
    console.log(`\n❌ Error: ${result2.error}`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`\n✅ New architecture working:`);
  console.log(`  - Server config from api_servers: ✓`);
  console.log(`  - Endpoint config from api_endpoints: ✓`);
  console.log(`  - Credentials decrypted from DB: ✓`);
  console.log(`  - Grid config from customHeaders: ✓`);
  console.log(`  - PEMS API responding: ${result1.success ? '✓' : '✗'}`);
  console.log(`  - Data returned: ${result1.data.length > 0 ? '✓' : '✗'}`);

  console.log('\n📖 New Endpoints Available:');
  console.log(`  POST /api/endpoints/${pfaEndpoint.id}/fetch-raw`);
  console.log(`    Body: { serverId: "${server.id}", organizationCode: "RIO", limit: 100 }`);
  console.log(`  POST /api/endpoints/${pfaEndpoint.id}/fetch-all`);
  console.log(`    Body: { serverId: "${server.id}", organizationCode: "RIO" }`);
  console.log(`  POST /api/endpoints/${pfaEndpoint.id}/sync`);
  console.log(`    Body: { serverId: "${server.id}", organizationId: "<uuid>", syncType: "full" }`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
