import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function revertPemsEndpoint() {
  // Revert the PFA endpoint back to original path and restore custom headers
  const endpoint = await prisma.apiEndpoint.update({
    where: {
      id: '23535721-9ab7-4ea5-9f30-18c6ad773352'
    },
    data: {
      path: '/griddata',
      customHeaders: JSON.stringify({ gridCode: 'CUPFAG', gridID: '100541' })
    }
  });

  console.log('Reverted endpoint:');
  console.log(JSON.stringify(endpoint, null, 2));

  await prisma.$disconnect();
}

revertPemsEndpoint();
