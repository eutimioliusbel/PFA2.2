import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSuccessfulTests() {
  // Look for any successful test results
  const successfulTests = await prisma.endpoint_test_results.findMany({
    where: {
      success: true
    },
    orderBy: {
      testTimestamp: 'desc'
    },
    take: 5
  });

  console.log(`Found ${successfulTests.length} successful tests\n`);

  for (const test of successfulTests) {
    console.log('Successful Test:');
    console.log('================');
    console.log(`Test ID: ${test.id}`);
    console.log(`Endpoint ID: ${test.endpointId}`);
    console.log(`Timestamp: ${test.testTimestamp}`);
    console.log(`URL: ${test.requestUrl}`);
    console.log(`Method: ${test.requestMethod}`);
    console.log(`Headers: ${test.requestHeaders}`);
    console.log(`Status Code: ${test.statusCode}`);
    console.log(`Response Time: ${test.responseTimeMs}ms`);
    console.log(`Response Sample: ${test.responseSample?.substring(0, 200)}\n`);
  }

  await prisma.$disconnect();
}

checkSuccessfulTests();
