import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updatePemsEndpoint() {
  // Update the PFA endpoint to include query parameters
  const endpoint = await prisma.apiEndpoint.update({
    where: {
      id: '23535721-9ab7-4ea5-9f30-18c6ad773352'
    },
    data: {
      path: '/griddata?gridCode=CUPFAG&gridID=100541',
      customHeaders: null  // Remove custom headers since they're now in the path
    }
  });

  console.log('Updated endpoint:');
  console.log(JSON.stringify(endpoint, null, 2));

  await prisma.$disconnect();
}

updatePemsEndpoint();
