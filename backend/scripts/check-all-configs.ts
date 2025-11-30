import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const configs = await prisma.api_configurations.findMany({
    select: { id: true, name: true, usage: true, feeds: true }
  });
  console.log('api_configurations:');
  configs.forEach(c => console.log(`  ${c.id} | ${c.name} | ${c.usage}`));
  
  const endpoints = await prisma.api_endpoints.findMany({
    select: { id: true, name: true, entity: true }
  });
  console.log('\napi_endpoints:');
  endpoints.forEach(e => console.log(`  ${e.id} | ${e.name} | ${e.entity}`));
  
  await prisma.$disconnect();
}
main();
