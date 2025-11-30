import { PrismaClient } from '@prisma/client';
import EndpointTestService from '../src/services/endpointTestService';

const prisma = new PrismaClient();

async function testAllEndpoints() {
  try {
    // Get the RIO organization ID
    const org = await prisma.organizations.findUnique({
      where: { code: 'RIO' }
    });

    if (!org) {
      console.error('RIO organization not found');
      return;
    }

    // Get all endpoints for PEMS_DEV server
    const server = await prisma.api_servers.findFirst({
      where: { name: 'PEMS_DEV' },
      include: { endpoints: true }
    });

    if (!server) {
      console.error('PEMS_DEV server not found');
      return;
    }

    console.log(`Testing ${server.endpoints.length} endpoints for organization: ${org.code}\n`);
    console.log('='.repeat(80));

    const results = [];

    for (const endpoint of server.endpoints) {
      console.log(`\nTesting: ${endpoint.name}`);
      console.log('-'.repeat(80));

      try {
        const result = await EndpointTestService.testEndpoint(
          endpoint.id,
          {
            testType: 'manual',
            triggeredBy: 'script',
            organizationId: org.id
          }
        );

        const summary = {
          name: endpoint.name,
          path: endpoint.path,
          entity: endpoint.entity,
          success: result.success,
          statusCode: result.statusCode,
          responseTimeMs: result.responseTimeMs,
          errorMessage: result.errorMessage || null
        };

        results.push(summary);

        console.log(`✓ Success: ${result.success}`);
        console.log(`  Status: ${result.statusCode}`);
        console.log(`  Time: ${result.responseTimeMs}ms`);

        if (!result.success) {
          console.log(`  Error: ${result.errorMessage}`);
        }

      } catch (error: any) {
        console.error(`✗ Test failed: ${error.message}`);
        results.push({
          name: endpoint.name,
          path: endpoint.path,
          entity: endpoint.entity,
          success: false,
          statusCode: null,
          responseTimeMs: null,
          errorMessage: error.message
        });
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`\nTotal: ${results.length} | Success: ${successful} | Failed: ${failed}\n`);

    results.forEach(result => {
      const status = result.success ? '✓' : '✗';
      const statusCode = result.statusCode || 'N/A';
      const time = result.responseTimeMs ? `${result.responseTimeMs}ms` : 'N/A';
      console.log(`${status} ${result.name.padEnd(25)} [${statusCode}] ${time}`);
    });

  } catch (error: any) {
    console.error('Test suite failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testAllEndpoints();
