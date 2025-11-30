import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Organizations ===');
  const orgs = await prisma.organizations.findMany();
  orgs.forEach(o => console.log(`${o.code} (${o.id}): ${o.name}`));

  console.log('\n=== API Configurations ===');
  const configs = await prisma.api_configurations.findMany();
  console.log(`Total API Configurations: ${configs.length}`);
  configs.forEach(c => console.log(`- ${c.name} (${c.usage}) for org: ${c.organizationId}`));

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
