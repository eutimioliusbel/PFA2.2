import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRecentTests() {
  // Get the 5 most recent tests
  const recentTests = await prisma.endpoint_test_results.findMany({
    where: {
      endpointId: '23535721-9ab7-4ea5-9f30-18c6ad773352'
    },
    orderBy: {
      testTimestamp: 'desc'
    },
    take: 5
  });

  console.log(`Found ${recentTests.length} recent tests\n`);

  for (const test of recentTests) {
    console.log('Test Result:');
    console.log('============');
    console.log(`Test ID: ${test.id}`);
    console.log(`Timestamp: ${test.testTimestamp}`);
    console.log(`Success: ${test.success}`);
    console.log(`URL: ${test.requestUrl}`);
    console.log(`Method: ${test.requestMethod}`);
    console.log(`Status Code: ${test.statusCode}`);
    console.log(`Error Type: ${test.errorType}`);
    console.log(`Error Message: ${test.errorMessage}`);
    console.log(`Headers: ${test.requestHeaders}`);
    console.log(`Response: ${test.responseSample?.substring(0, 200)}\n`);
  }

  await prisma.$disconnect();
}

checkRecentTests();
