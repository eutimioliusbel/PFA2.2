import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTestResult() {
  const result = await prisma.endpoint_test_results.findFirst({
    where: {
      endpointId: '23535721-9ab7-4ea5-9f30-18c6ad773352'
    },
    orderBy: {
      testTimestamp: 'desc'
    }
  });

  console.log('Latest test result:');
  console.log(JSON.stringify(result, null, 2));

  await prisma.$disconnect();
}

checkTestResult();
