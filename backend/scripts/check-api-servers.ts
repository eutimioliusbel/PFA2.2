import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check API configurations (OLD architecture)
  const configs = await prisma.api_configurations.findMany();
  console.log('=== API CONFIGURATIONS (OLD) ===');
  console.log(JSON.stringify(configs, null, 2));

  // Check API servers (NEW architecture)
  const servers = await prisma.api_servers.findMany({
    include: { api_endpoints: true }
  });
  console.log('\n=== API SERVERS (NEW) ===');
  console.log(JSON.stringify(servers.map(s => ({
    id: s.id,
    name: s.name,
    baseUrl: s.baseUrl,
    authType: s.authType,
    commonHeaders: s.commonHeaders,
    endpoints: s.api_endpoints.map(e => ({
      id: e.id,
      name: e.name,
      path: e.path,
      entity: e.entity,
      customHeaders: e.customHeaders,
      status: e.status
    }))
  })), null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
