/**
 * Test all configured endpoints using PemsSyncServiceV2
 * Tests both Grid API endpoints (PFA) and REST API endpoints (assets, users, etc.)
 *
 * Usage: npx ts-node scripts/test-all-endpoints-v2.ts
 */

import { PrismaClient } from '@prisma/client';
import { pemsSyncServiceV2 } from '../src/services/pems/PemsSyncServiceV2';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(70));
  console.log('PEMS V2 - Test All Endpoints');
  console.log('='.repeat(70));

  // Get all configured endpoints
  const endpoints = await prisma.api_endpoints.findMany({
    include: {
      api_servers: { select: { id: true, name: true } }
    },
    where: {
      status: { not: 'inactive' }
    }
  });

  console.log(`\n📋 Found ${endpoints.length} endpoints to test:\n`);

  endpoints.forEach(ep => {
    const hasGrid = ep.customHeaders?.includes('gridCode');
    console.log(`  [${hasGrid ? 'GRID' : 'REST'}] ${ep.entity.padEnd(15)} - ${ep.name}`);
  });

  // Get active organizations
  const activeOrgs = await pemsSyncServiceV2.getActiveOrganizations();
  console.log(`\n🏢 Active organizations: ${activeOrgs.map(o => o.code).join(', ')}`);

  if (activeOrgs.length === 0) {
    console.log('\n⚠️  No active organizations found. Enable sync for at least one org.');
    return;
  }

  const orgCode = activeOrgs[0].code;
  console.log(`\n✅ Using organization: ${orgCode}`);

  // Test each endpoint
  console.log('\n' + '='.repeat(70));
  console.log('TESTING ENDPOINTS');
  console.log('='.repeat(70));

  const results: Array<{
    endpoint: string;
    entity: string;
    type: string;
    success: boolean;
    records: number;
    time: number;
    error?: string;
  }> = [];

  for (const endpoint of endpoints) {
    const hasGrid = endpoint.customHeaders?.includes('gridCode');
    const type = hasGrid ? 'GRID' : 'REST';

    console.log(`\n📡 Testing: ${endpoint.name} (${endpoint.entity}) [${type}]`);
    console.log(`   Path: ${endpoint.path}`);

    try {
      const result = await pemsSyncServiceV2.fetchRawData(
        endpoint.api_servers.id,
        endpoint.id,
        orgCode,
        { limit: 5, offset: 0, includeRawResponse: false }
      );

      if (result.success) {
        console.log(`   ✅ Success: ${result.data.length} records in ${result.responseTimeMs}ms`);

        // Show sample data structure
        if (result.data.length > 0) {
          const sample = result.data[0];
          if (sample.CELL) {
            // Grid API format
            console.log(`   📄 Fields: ${sample.CELL.slice(0, 3).map((c: any) => c.ALIAS_NAME).join(', ')}...`);
          } else {
            // REST API format
            const keys = Object.keys(sample).slice(0, 5);
            console.log(`   📄 Fields: ${keys.join(', ')}...`);
          }
        }

        results.push({
          endpoint: endpoint.name,
          entity: endpoint.entity,
          type,
          success: true,
          records: result.data.length,
          time: result.responseTimeMs
        });
      } else {
        console.log(`   ❌ Failed: ${result.error}`);
        results.push({
          endpoint: endpoint.name,
          entity: endpoint.entity,
          type,
          success: false,
          records: 0,
          time: result.responseTimeMs,
          error: result.error
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ Exception: ${errorMsg}`);
      results.push({
        endpoint: endpoint.name,
        entity: endpoint.entity,
        type,
        success: false,
        records: 0,
        time: 0,
        error: errorMsg
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\n✅ Successful: ${successful.length}/${results.length}`);
  if (successful.length > 0) {
    successful.forEach(r => {
      console.log(`   - ${r.entity}: ${r.records} records (${r.time}ms)`);
    });
  }

  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}/${results.length}`);
    failed.forEach(r => {
      console.log(`   - ${r.entity}: ${r.error}`);
    });
  }

  // API Usage examples
  console.log('\n' + '='.repeat(70));
  console.log('API USAGE EXAMPLES');
  console.log('='.repeat(70));

  const workingEndpoint = endpoints.find(ep =>
    results.find(r => r.endpoint === ep.name && r.success)
  );

  if (workingEndpoint) {
    console.log(`
# List active organizations
curl http://localhost:3001/api/endpoints/active-organizations \\
  -H "Authorization: Bearer <token>"

# Fetch raw data from any endpoint
curl -X POST http://localhost:3001/api/endpoints/${workingEndpoint.id}/fetch-raw \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"serverId": "${workingEndpoint.api_servers.id}", "limit": 10}'
`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
