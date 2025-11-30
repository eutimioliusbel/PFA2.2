import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const mappings = await prisma.api_field_mappings.count({
    where: { endpointId: 'pems-endpoint-pfa-read' }
  });
  console.log('Field mappings for pems-endpoint-pfa-read:', mappings);
  
  // Check all endpoint mappings
  const allMappings = await prisma.api_field_mappings.groupBy({
    by: ['endpointId'],
    _count: true
  });
  console.log('All endpoint mappings:', JSON.stringify(allMappings, null, 2));
  
  await prisma.$disconnect();
}
main();
