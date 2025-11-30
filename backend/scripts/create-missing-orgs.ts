/**
 * Create Missing Organizations
 *
 * Creates BECH and HOLNG organizations needed for PEMS user sync testing.
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function createMissingOrgs() {
  console.log('\n🏢 Creating missing organizations for PEMS user sync...\n');

  // Create BECH organization
  const bech = await prisma.organizations.upsert({
    where: { code: 'BECH' },
    update: {},
    create: {
      id: randomUUID(),
      code: 'BECH',
      name: 'Bechtel Project',
      description: 'Bechtel construction project organization',
      isActive: true,
      updatedAt: new Date(),
    },
  });

  console.log(`  ✓ Created organization: ${bech.name} (${bech.code}) - ${bech.id}`);

  // Create HOLNG organization
  const holng = await prisma.organizations.upsert({
    where: { code: 'HOLNG' },
    update: {},
    create: {
      id: randomUUID(),
      code: 'HOLNG',
      name: 'Holland Project',
      description: 'Holland construction project organization',
      isActive: true,
      updatedAt: new Date(),
    },
  });

  console.log(`  ✓ Created organization: ${holng.name} (${holng.code}) - ${holng.id}\n`);

  console.log('✅ Missing organizations created successfully!\n');
}

createMissingOrgs()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
