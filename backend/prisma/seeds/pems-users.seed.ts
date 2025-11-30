/**
 * PEMS Users Test Seed Data
 *
 * Creates test users that simulate PEMS user sync scenarios.
 * Demonstrates the 4-tier filtering criteria:
 * 1. Active users only (ISACTIVE = '+')
 * 2. Specific user groups (PROJECT_MANAGERS, COST_ENGINEERS, ADMINISTRATORS, BEO_USERS)
 * 3. Specific organizations (BECH, HOLNG, RIO)
 * 4. PFA Access Flag (UDFCHAR01 = 'Y')
 *
 * Test users included:
 * - PM001: Project Manager with PFA access (SHOULD SYNC)
 * - CE002: Cost Engineer with PFA access (SHOULD SYNC)
 * - ADM003: Administrator with PFA access (SHOULD SYNC)
 * - INACTIVE001: Inactive user (SHOULD SKIP)
 * - CONTRACTOR001: Contractor role (SHOULD SKIP)
 * - NOACCESS001: No PFA access flag (SHOULD SKIP)
 *
 * Usage:
 *   npx tsx backend/prisma/seeds/pems-users.seed.ts
 *
 * @see docs/PEMS_USER_SYNC_FILTERING.md for filtering rules
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function seedPemsUsers() {
  console.log('\n🌱 Seeding PEMS test users...\n');

  // ============================================================================
  // SCENARIO 1: USERS THAT SHOULD SYNC
  // ============================================================================

  console.log('✓ Creating users that SHOULD SYNC...\n');

  // PM001 - Project Manager (BECH, HOLNG)
  const pm001 = await prisma.users.upsert({
    where: { username: 'PM001' },
    update: { updatedAt: new Date() },
    create: {
      id: randomUUID(),
      username: 'PM001',
      email: 'pm001@pems.generated',
      passwordHash: '', // PEMS users have no local password (hybrid auth)
      firstName: 'John',
      lastName: 'ProjectManager',
      role: 'admin', // Maps from PROJECT_MANAGERS
      isActive: true,
      updatedAt: new Date(),
    },
  });

  console.log(`  ✓ PM001 (Project Manager) - ${pm001.id}`);
  console.log(`    • USERGROUP: PROJECT_MANAGERS`);
  console.log(`    • ISACTIVE: +`);
  console.log(`    • UDFCHAR01: Y`);
  console.log(`    • Organizations: BECH, HOLNG\n`);

  // CE002 - Cost Engineer (BECH)
  const ce002 = await prisma.users.upsert({
    where: { username: 'CE002' },
    update: { updatedAt: new Date() },
    create: {
      id: randomUUID(),
      username: 'CE002',
      email: 'ce002@pems.generated',
      passwordHash: '',
      firstName: 'Jane',
      lastName: 'CostEngineer',
      role: 'user', // Maps from COST_ENGINEERS
      isActive: true,
      updatedAt: new Date(),
    },
  });

  console.log(`  ✓ CE002 (Cost Engineer) - ${ce002.id}`);
  console.log(`    • USERGROUP: COST_ENGINEERS`);
  console.log(`    • ISACTIVE: +`);
  console.log(`    • UDFCHAR01: Y`);
  console.log(`    • Organizations: BECH\n`);

  // ADM003 - Administrator (BECH, HOLNG, RIO)
  const adm003 = await prisma.users.upsert({
    where: { username: 'ADM003' },
    update: { updatedAt: new Date() },
    create: {
      id: randomUUID(),
      username: 'ADM003',
      email: 'adm003@pems.generated',
      passwordHash: '',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin', // Maps from ADMINISTRATORS
      isActive: true,
      updatedAt: new Date(),
    },
  });

  console.log(`  ✓ ADM003 (Administrator) - ${adm003.id}`);
  console.log(`    • USERGROUP: ADMINISTRATORS`);
  console.log(`    • ISACTIVE: +`);
  console.log(`    • UDFCHAR01: Y`);
  console.log(`    • Organizations: BECH, HOLNG, RIO\n`);

  // ============================================================================
  // SCENARIO 2: USERS THAT SHOULD BE SKIPPED
  // ============================================================================

  console.log('✗ Creating users that SHOULD BE SKIPPED...\n');

  // INACTIVE001 - Inactive user (fails filter 1)
  const inactive001 = await prisma.users.upsert({
    where: { username: 'INACTIVE001' },
    update: { updatedAt: new Date() },
    create: {
      id: randomUUID(),
      username: 'INACTIVE001',
      email: 'inactive001@pems.generated',
      passwordHash: '',
      firstName: 'Inactive',
      lastName: 'User',
      role: 'user',
      isActive: false, // ISACTIVE = '-' in PEMS
      updatedAt: new Date(),
    },
  });

  console.log(`  ✗ INACTIVE001 (Inactive) - ${inactive001.id}`);
  console.log(`    • USERGROUP: PROJECT_MANAGERS`);
  console.log(`    • ISACTIVE: - (FAILS FILTER 1)`);
  console.log(`    • UDFCHAR01: Y`);
  console.log(`    • Skip reason: Inactive user\n`);

  // CONTRACTOR001 - Contractor role (fails filter 2)
  const contractor001 = await prisma.users.upsert({
    where: { username: 'CONTRACTOR001' },
    update: { updatedAt: new Date() },
    create: {
      id: randomUUID(),
      username: 'CONTRACTOR001',
      email: 'contractor001@pems.generated',
      passwordHash: '',
      firstName: 'Bob',
      lastName: 'Contractor',
      role: 'viewer',
      isActive: true,
      updatedAt: new Date(),
    },
  });

  console.log(`  ✗ CONTRACTOR001 (Contractor) - ${contractor001.id}`);
  console.log(`    • USERGROUP: CONTRACTORS (FAILS FILTER 2)`);
  console.log(`    • ISACTIVE: +`);
  console.log(`    • UDFCHAR01: Y`);
  console.log(`    • Skip reason: User group not allowed\n`);

  // NOACCESS001 - No PFA access flag (fails filter 4)
  const noaccess001 = await prisma.users.upsert({
    where: { username: 'NOACCESS001' },
    update: { updatedAt: new Date() },
    create: {
      id: randomUUID(),
      username: 'NOACCESS001',
      email: 'noaccess001@pems.generated',
      passwordHash: '',
      firstName: 'NoAccess',
      lastName: 'User',
      role: 'user',
      isActive: true,
      updatedAt: new Date(),
    },
  });

  console.log(`  ✗ NOACCESS001 (No PFA Access) - ${noaccess001.id}`);
  console.log(`    • USERGROUP: COST_ENGINEERS`);
  console.log(`    • ISACTIVE: +`);
  console.log(`    • UDFCHAR01: N (FAILS FILTER 4)`);
  console.log(`    • Skip reason: Custom field filter not met\n`);

  // ============================================================================
  // CREATE ORGANIZATION ASSIGNMENTS
  // ============================================================================

  console.log('🏢 Creating organization assignments...\n');

  // Get organizations from database
  const bech = await prisma.organizations.findUnique({ where: { code: 'BECH' } });
  const holng = await prisma.organizations.findUnique({ where: { code: 'HOLNG' } });
  const rio = await prisma.organizations.findUnique({ where: { code: 'RIO' } });

  if (!bech || !holng || !rio) {
    console.warn('⚠️  Organizations not found. Run main seed first: npm run prisma:seed');
    return;
  }

  // PM001 assignments
  await prisma.user_organizations.upsert({
    where: {
      userId_organizationId: { userId: pm001.id, organizationId: bech.id }
    },
    update: {},
    create: {
      id: randomUUID(),
      userId: pm001.id,
      organizationId: bech.id,
      role: 'admin',
      modifiedAt: new Date(),
    },
  });

  await prisma.user_organizations.upsert({
    where: {
      userId_organizationId: { userId: pm001.id, organizationId: holng.id }
    },
    update: {},
    create: {
      id: randomUUID(),
      userId: pm001.id,
      organizationId: holng.id,
      role: 'admin',
      modifiedAt: new Date(),
    },
  });

  console.log(`  ✓ PM001 → BECH, HOLNG`);

  // CE002 assignments
  await prisma.user_organizations.upsert({
    where: {
      userId_organizationId: { userId: ce002.id, organizationId: bech.id }
    },
    update: {},
    create: {
      id: randomUUID(),
      userId: ce002.id,
      organizationId: bech.id,
      role: 'user',
      modifiedAt: new Date(),
    },
  });

  console.log(`  ✓ CE002 → BECH`);

  // ADM003 assignments
  await prisma.user_organizations.upsert({
    where: {
      userId_organizationId: { userId: adm003.id, organizationId: bech.id }
    },
    update: {},
    create: {
      id: randomUUID(),
      userId: adm003.id,
      organizationId: bech.id,
      role: 'admin',
      modifiedAt: new Date(),
    },
  });

  await prisma.user_organizations.upsert({
    where: {
      userId_organizationId: { userId: adm003.id, organizationId: holng.id }
    },
    update: {},
    create: {
      id: randomUUID(),
      userId: adm003.id,
      organizationId: holng.id,
      role: 'admin',
      modifiedAt: new Date(),
    },
  });

  await prisma.user_organizations.upsert({
    where: {
      userId_organizationId: { userId: adm003.id, organizationId: rio.id }
    },
    update: {},
    create: {
      id: randomUUID(),
      userId: adm003.id,
      organizationId: rio.id,
      role: 'admin',
      modifiedAt: new Date(),
    },
  });

  console.log(`  ✓ ADM003 → BECH, HOLNG, RIO\n`);

  // ============================================================================
  // SUMMARY
  // ============================================================================

  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 PEMS Users Seed Summary:');
  console.log('───────────────────────────────────────────────────────────');
  console.log(`   Users Created:          6`);
  console.log(`   Should Sync:            3 (PM001, CE002, ADM003)`);
  console.log(`   Should Skip:            3 (INACTIVE001, CONTRACTOR001, NOACCESS001)`);
  console.log(`   Organization Links:     6`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('✅ PEMS users seed completed!\n');
  console.log('📌 Next Steps:');
  console.log('   1. Run user sync: npx tsx backend/scripts/test-user-sync.ts');
  console.log('   2. Verify filtering: Check logs for skipped users');
  console.log('   3. Review sync stats: 3 synced, 3 skipped\n');
}

seedPemsUsers()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
