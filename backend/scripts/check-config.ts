import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const endpoints = await prisma.api_endpoints.findMany({
    where: { entity: 'pfa' },
    select: { id: true, name: true, entity: true, operationType: true }
  });
  console.log('PFA Endpoints:');
  endpoints.forEach(e => console.log(`  ${e.id} | ${e.name} | ${e.operationType}`));
  
  await prisma.$disconnect();
}
main();
