/**
 * E2E Test Database Seeding Script
 *
 * Seeds the test database with test users and organizations
 * Run before E2E tests to ensure clean test state
 *
 * Usage:
 *   cd backend
 *   npx tsx ../tests/e2e/fixtures/seed.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  TEST_ADMIN,
  TEST_USER,
  TEST_USER_SUSPEND,
  TEST_VIEWER,
  TEST_ORG_PRIMARY,
  TEST_ORG_SECONDARY,
  PERMISSION_SETS,
} from './testData';

const prisma = new PrismaClient();

async function seedTestDatabase() {
  console.log('🌱 Seeding E2E test database...\n');

  try {
    // 1. Clean up existing test data
    console.log('🧹 Cleaning up existing test data...');
    await prisma.userOrganization.deleteMany({
      where: {
        OR: [
          { user: { username: { startsWith: 'test-' } } },
          { organization: { code: { startsWith: 'TEST-' } } },
        ],
      },
    });

    await prisma.user.deleteMany({
      where: { username: { startsWith: 'test-' } },
    });

    await prisma.organization.deleteMany({
      where: { code: { startsWith: 'TEST-' } },
    });

    console.log('✅ Cleanup complete\n');

    // 2. Create test organizations
    console.log('🏢 Creating test organizations...');

    const orgPrimary = await prisma.organization.create({
      data: {
        id: TEST_ORG_PRIMARY.id,
        code: TEST_ORG_PRIMARY.code,
        name: TEST_ORG_PRIMARY.name,
        description: TEST_ORG_PRIMARY.description,
        isActive: true,
        isExternal: false,
        serviceStatus: 'active',
      },
    });

    const orgSecondary = await prisma.organization.create({
      data: {
        id: TEST_ORG_SECONDARY.id,
        code: TEST_ORG_SECONDARY.code,
        name: TEST_ORG_SECONDARY.name,
        description: TEST_ORG_SECONDARY.description,
        isActive: true,
        isExternal: false,
        serviceStatus: 'active',
      },
    });

    console.log(`✅ Created: ${orgPrimary.code}, ${orgSecondary.code}\n`);

    // 3. Create test users
    console.log('👤 Creating test users...');

    const adminUser = await prisma.user.create({
      data: {
        id: TEST_ADMIN.id,
        username: TEST_ADMIN.username,
        passwordHash: await bcrypt.hash(TEST_ADMIN.password, 10),
        email: TEST_ADMIN.email,
        firstName: TEST_ADMIN.firstName,
        lastName: TEST_ADMIN.lastName,
        role: TEST_ADMIN.role,
        isActive: true,
        authProvider: 'local',
        serviceStatus: TEST_ADMIN.serviceStatus,
      },
    });

    const regularUser = await prisma.user.create({
      data: {
        id: TEST_USER.id,
        username: TEST_USER.username,
        passwordHash: await bcrypt.hash(TEST_USER.password, 10),
        email: TEST_USER.email,
        firstName: TEST_USER.firstName,
        lastName: TEST_USER.lastName,
        role: TEST_USER.role,
        isActive: true,
        authProvider: 'local',
        serviceStatus: TEST_USER.serviceStatus,
      },
    });

    const suspendUser = await prisma.user.create({
      data: {
        id: TEST_USER_SUSPEND.id,
        username: TEST_USER_SUSPEND.username,
        passwordHash: await bcrypt.hash(TEST_USER_SUSPEND.password, 10),
        email: TEST_USER_SUSPEND.email,
        firstName: TEST_USER_SUSPEND.firstName,
        lastName: TEST_USER_SUSPEND.lastName,
        role: TEST_USER_SUSPEND.role,
        isActive: true,
        authProvider: 'local',
        serviceStatus: TEST_USER_SUSPEND.serviceStatus,
      },
    });

    const viewerUser = await prisma.user.create({
      data: {
        id: TEST_VIEWER.id,
        username: TEST_VIEWER.username,
        passwordHash: await bcrypt.hash(TEST_VIEWER.password, 10),
        email: TEST_VIEWER.email,
        firstName: TEST_VIEWER.firstName,
        lastName: TEST_VIEWER.lastName,
        role: TEST_VIEWER.role,
        isActive: true,
        authProvider: 'local',
        serviceStatus: TEST_VIEWER.serviceStatus,
      },
    });

    console.log(
      `✅ Created: ${adminUser.username}, ${regularUser.username}, ${suspendUser.username}, ${viewerUser.username}\n`
    );

    // 4. Assign users to organizations with permissions
    console.log('🔐 Assigning users to organizations with permissions...');

    // Admin User: Full access to both organizations
    await prisma.userOrganization.create({
      data: {
        userId: adminUser.id,
        organizationId: orgPrimary.id,
        role: 'admin',
        assignmentSource: 'local',
        isCustom: false,
        ...PERMISSION_SETS.ADMIN,
      },
    });

    await prisma.userOrganization.create({
      data: {
        userId: adminUser.id,
        organizationId: orgSecondary.id,
        role: 'admin',
        assignmentSource: 'local',
        isCustom: false,
        ...PERMISSION_SETS.ADMIN,
      },
    });

    // Regular User: Editor access to primary org only
    await prisma.userOrganization.create({
      data: {
        userId: regularUser.id,
        organizationId: orgPrimary.id,
        role: 'editor',
        assignmentSource: 'local',
        isCustom: false,
        ...PERMISSION_SETS.EDITOR,
      },
    });

    // Suspend User: Viewer access to primary org (will be suspended in tests)
    await prisma.userOrganization.create({
      data: {
        userId: suspendUser.id,
        organizationId: orgPrimary.id,
        role: 'viewer',
        assignmentSource: 'local',
        isCustom: false,
        ...PERMISSION_SETS.VIEWER,
      },
    });

    // Viewer User: Read-only access to both orgs
    await prisma.userOrganization.create({
      data: {
        userId: viewerUser.id,
        organizationId: orgPrimary.id,
        role: 'viewer',
        assignmentSource: 'local',
        isCustom: false,
        ...PERMISSION_SETS.VIEWER,
      },
    });

    await prisma.userOrganization.create({
      data: {
        userId: viewerUser.id,
        organizationId: orgSecondary.id,
        role: 'viewer',
        assignmentSource: 'local',
        isCustom: false,
        ...PERMISSION_SETS.VIEWER,
      },
    });

    console.log('✅ User-organization assignments complete\n');

    // 5. Verify seeded data
    console.log('🔍 Verifying seeded data...');
    const userCount = await prisma.user.count({
      where: { username: { startsWith: 'test-' } },
    });

    const orgCount = await prisma.organization.count({
      where: { code: { startsWith: 'TEST-' } },
    });

    const userOrgCount = await prisma.userOrganization.count({
      where: {
        OR: [
          { user: { username: { startsWith: 'test-' } } },
          { organization: { code: { startsWith: 'TEST-' } } },
        ],
      },
    });

    console.log(`✅ Verification complete:`);
    console.log(`   - Test Users: ${userCount}`);
    console.log(`   - Test Organizations: ${orgCount}`);
    console.log(`   - User-Org Assignments: ${userOrgCount}\n`);

    // 6. Display test credentials
    console.log('📋 Test Credentials:');
    console.log(`   Admin:  ${TEST_ADMIN.username} / ${TEST_ADMIN.password}`);
    console.log(`   User:   ${TEST_USER.username} / ${TEST_USER.password}`);
    console.log(`   Viewer: ${TEST_VIEWER.username} / ${TEST_VIEWER.password}`);
    console.log(`   Suspend: ${TEST_USER_SUSPEND.username} / ${TEST_USER_SUSPEND.password}\n`);

    console.log('✅ E2E test database seeding complete!\n');
  } catch (error) {
    console.error('❌ Error seeding test database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedTestDatabase()
    .then(() => {
      console.log('✅ Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

export default seedTestDatabase;
