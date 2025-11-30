/**
 * Direct test of PEMS V2 service - bypasses other services
 *
 * Usage: npx ts-node scripts/test-pems-v2-direct.ts
 */

import { PrismaClient } from '@prisma/client';
import { encryptionService } from '../src/utils/encryption';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(60));
  console.log('PEMS V2 Direct Test - Using Active Organizations from DB');
  console.log('='.repeat(60));

  // Check active organizations
  console.log('\n🏢 Checking Active Organizations...');
  const activeOrgs = await prisma.organizations.findMany({
    where: {
      enableSync: true,
      serviceStatus: 'active'
    },
    select: {
      id: true,
      code: true,
      name: true,
      enableSync: true,
      serviceStatus: true
    }
  });

  console.log(`  Found ${activeOrgs.length} active organizations:`);
  activeOrgs.forEach(org => {
    console.log(`    - ${org.code}: ${org.name} (sync: ${org.enableSync}, status: ${org.serviceStatus})`);
  });

  // If no active orgs, check what orgs exist
  if (activeOrgs.length === 0) {
    console.log('\n⚠️  No active organizations found. Checking all organizations...');
    const allOrgs = await prisma.organizations.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        enableSync: true,
        serviceStatus: true
      }
    });
    console.log(`  All organizations (${allOrgs.length}):`);
    allOrgs.forEach(org => {
      console.log(`    - ${org.code}: enableSync=${org.enableSync}, status=${org.serviceStatus}`);
    });

    console.log('\n📝 To enable sync for an organization, run:');
    console.log('  UPDATE organizations SET "enableSync" = true, "serviceStatus" = \'active\' WHERE code = \'RIO\';');
  }

  // Use first active org, or default to RIO
  const targetOrgCode = activeOrgs.length > 0 ? activeOrgs[0].code : 'RIO';
  console.log(`\n✅ Will use organization: ${targetOrgCode}`);

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

  // Decrypt credentials
  const authKey = server.authKeyEncrypted
    ? encryptionService.decrypt(server.authKeyEncrypted)
    : null;
  const authValue = server.authValueEncrypted
    ? encryptionService.decrypt(server.authValueEncrypted)
    : null;

  console.log(`\n🔐 Credentials:`);
  console.log(`  - Auth Key: ${authKey ? authKey.slice(0, 3) + '***' : 'N/A'}`);
  console.log(`  - Auth Value: ${authValue ? '***' + authValue.slice(-4) : 'N/A'}`);

  // Parse headers
  const serverHeaders = server.commonHeaders ? JSON.parse(server.commonHeaders) : {};
  const endpointHeaders = pfaEndpoint.customHeaders ? JSON.parse(pfaEndpoint.customHeaders) : {};

  console.log(`\n📋 Parsed Headers:`);
  console.log(`  - Server (common): ${JSON.stringify(serverHeaders)}`);
  console.log(`  - Endpoint (custom): ${JSON.stringify(endpointHeaders)}`);

  // Build request URL
  const baseUrl = server.baseUrl.endsWith('/') ? server.baseUrl.slice(0, -1) : server.baseUrl;
  const path = pfaEndpoint.path.startsWith('/') ? pfaEndpoint.path : `/${pfaEndpoint.path}`;
  const requestUrl = `${baseUrl}${path}`;

  console.log(`\n🌐 Request URL: ${requestUrl}`);

  // Build auth header - use targetOrgCode from active organizations
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...serverHeaders,
    'organization': targetOrgCode  // PEMS requires organization header for authorization
  };

  if (server.authType === 'basic' && authKey && authValue) {
    const authString = Buffer.from(`${authKey}:${authValue}`).toString('base64');
    headers['Authorization'] = `Basic ${authString}`;
  }

  console.log(`\n📋 Final Headers:`);
  console.log(JSON.stringify({ ...headers, Authorization: '[REDACTED]' }, null, 2));

  // Build PEMS grid request
  const requestBody = {
    GRID: {
      GRID_NAME: endpointHeaders.gridCode,
      GRID_ID: endpointHeaders.gridID,
      NUMBER_OF_ROWS_FIRST_RETURNED: 5,
      ROW_OFFSET: 0,
      RESULT_IN_SAXORDER: 'TRUE'
    },
    ADDON_SORT: {
      ALIAS_NAME: 'pfs_id',
      TYPE: 'ASC'
    },
    ADDON_FILTER: {
      ALIAS_NAME: 'pfs_a_org',
      OPERATOR: 'BEGINS',
      VALUE: targetOrgCode
    },
    GRID_TYPE: { TYPE: 'LIST' },
    LOV_PARAMETER: { ALIAS_NAME: 'pfs_id' },
    REQUEST_TYPE: 'LIST.DATA_ONLY.STORED'
  };

  console.log(`\n📤 Request Body:`);
  console.log(JSON.stringify(requestBody, null, 2));

  console.log(`\n🚀 Making request...`);
  const startTime = Date.now();

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    const responseTimeMs = Date.now() - startTime;

    console.log(`\n✅ Response received in ${responseTimeMs}ms`);
    console.log(`  - Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json() as any;

      // Extract records
      const records = data.Result?.ResultData?.GRID?.DATA?.ROW || [];
      const totalCount = data.Result?.ResultData?.GRID?.['TOTAL-COUNT'] ?? 'Unknown';

      console.log(`\n📊 Data Summary:`);
      console.log(`  - Total Records (from API): ${totalCount}`);
      console.log(`  - Records Returned: ${records.length}`);

      if (records.length > 0) {
        console.log(`\n📄 First Record (sample):`);
        const firstRecord = records[0];

        // Show first few cells
        if (firstRecord.CELL) {
          console.log(`  Cells in record: ${firstRecord.CELL.length}`);
          const sampleCells = firstRecord.CELL.slice(0, 5);
          sampleCells.forEach((cell: any) => {
            console.log(`    - ${cell.ALIAS_NAME}: ${cell.VALUE || '(empty)'}`);
          });
          console.log('    ...');
        }
      }

      console.log('\n' + '='.repeat(60));
      console.log('✅ SUCCESS - Raw data fetch working!');
      console.log('='.repeat(60));

    } else {
      const errorText = await response.text();
      console.log(`\n❌ Error Response: ${errorText}`);
    }

  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    console.log(`\n❌ Request failed after ${responseTimeMs}ms`);
    console.log(`  Error: ${error instanceof Error ? error.message : error}`);
  }

  // Print usage instructions
  console.log('\n📖 New API Endpoints Available:');
  console.log(`\ncurl -X POST http://localhost:3001/api/endpoints/${pfaEndpoint.id}/fetch-raw \\`);
  console.log(`  -H "Authorization: Bearer <token>" \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"serverId": "${server.id}", "organizationCode": "RIO", "limit": 10}'`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
