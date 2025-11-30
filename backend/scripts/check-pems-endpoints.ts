import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPemsEndpoints() {
  const servers = await prisma.api_servers.findMany({
    where: {
      name: {
        contains: 'PEMS'
      }
    },
    include: {
      api_endpoints: true
    }
  });

  console.log(JSON.stringify(servers, null, 2));

  await prisma.$disconnect();
}

checkPemsEndpoints();
