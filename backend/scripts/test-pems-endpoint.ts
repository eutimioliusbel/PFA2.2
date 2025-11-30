import { PrismaClient } from '@prisma/client';
import EndpointTestService from '../src/services/endpointTestService';

const prisma = new PrismaClient();

async function testPemsEndpoint() {
  try {
    // Get the RIO organization ID
    const org = await prisma.organizations.findUnique({
      where: { code: 'RIO' }
    });

    if (!org) {
      console.error('RIO organization not found');
      return;
    }

    console.log(`Testing PEMS endpoint for organization: ${org.code} (${org.id})\n`);

    // Test the endpoint
    const result = await EndpointTestService.testEndpoint(
      '23535721-9ab7-4ea5-9f30-18c6ad773352',
      {
        testType: 'manual',
        triggeredBy: 'script',
        organizationId: org.id
      }
    );

    console.log('Test Result:');
    console.log('============');
    console.log(`Success: ${result.success}`);
    console.log(`Response Time: ${result.responseTimeMs}ms`);
    console.log(`Status Code: ${result.statusCode}`);

    if (!result.success) {
      console.log(`Error Type: ${result.errorType}`);
      console.log(`Error Message: ${result.errorMessage}`);
    }

    // Get the full test result from database
    const testResult = await prisma.endpoint_test_results.findUnique({
      where: { id: result.testResultId }
    });

    console.log('\nRequest Details:');
    console.log('================');
    console.log(`URL: ${testResult?.requestUrl}`);
    console.log(`Method: ${testResult?.requestMethod}`);
    console.log(`Headers: ${testResult?.requestHeaders}`);

    if (testResult?.responseSample) {
      console.log('\nResponse Sample:');
      console.log('================');
      console.log(testResult.responseSample.substring(0, 500));
    }

  } catch (error: any) {
    console.error('Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testPemsEndpoint();
