import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n✓ Current Organizations in Database:\n');

  const orgs = await prisma.organization.findMany({
    include: {
      _count: {
        select: {
          userOrganizations: true,
          pfaRecords: true
        }
      }
    }
  });

  if (orgs.length === 0) {
    console.log('  No organizations found');
  } else {
    orgs.forEach(org => {
      console.log(`📁 ${org.code} - ${org.name}`);
      console.log(`   Users: ${org._count.userOrganizations}`);
      console.log(`   PFA Records: ${org._count.pfaRecords}`);
      console.log(`   Status: ${org.isActive ? 'Active' : 'Inactive'}\n`);
    });
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
