/**
 * @file generate-test-data.ts
 * @description Generate test data for load testing (1000 users, 10 organizations)
 * @usage tsx load-tests/generate-test-data.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TEST_ORGS = [
  { code: 'LOAD_TEST_01', name: 'Load Test Organization 01' },
  { code: 'LOAD_TEST_02', name: 'Load Test Organization 02' },
  { code: 'LOAD_TEST_03', name: 'Load Test Organization 03' },
  { code: 'LOAD_TEST_04', name: 'Load Test Organization 04' },
  { code: 'LOAD_TEST_05', name: 'Load Test Organization 05' },
  { code: 'LOAD_TEST_06', name: 'Load Test Organization 06' },
  { code: 'LOAD_TEST_07', name: 'Load Test Organization 07' },
  { code: 'LOAD_TEST_08', name: 'Load Test Organization 08' },
  { code: 'LOAD_TEST_09', name: 'Load Test Organization 09' },
  { code: 'LOAD_TEST_10', name: 'Load Test Organization 10' },
];

async function generateTestData() {
  console.log('🚀 Generating load test data...');

  // 1. Create test organizations
  console.log('\n📦 Creating test organizations...');
  const createdOrgs = [];
  for (const org of TEST_ORGS) {
    const existingOrg = await prisma.organization.findUnique({
      where: { code: org.code },
    });

    if (existingOrg) {
      console.log(`  ✅ Organization ${org.code} already exists`);
      createdOrgs.push(existingOrg);
    } else {
      const newOrg = await prisma.organization.create({
        data: {
          code: org.code,
          name: org.name,
          description: `Load testing organization`,
          isActive: true,
        },
      });
      console.log(`  ✅ Created organization ${org.code}`);
      createdOrgs.push(newOrg);
    }
  }

  // 2. Create test users (100 per organization = 1000 total)
  console.log('\n👥 Creating test users...');
  const passwordHash = await bcrypt.hash('testpass123', 10);
  let totalUsers = 0;

  const createdUsers = [];

  for (const org of createdOrgs) {
    for (let i = 1; i <= 100; i++) {
      const username = `loadtest_${org.code.toLowerCase()}_user${i.toString().padStart(3, '0')}`;

      const existingUser = await prisma.user.findUnique({
        where: { username },
      });

      if (existingUser) {
        createdUsers.push(existingUser);
        continue;
      }

      const user = await prisma.user.create({
        data: {
          username,
          email: `${username}@loadtest.example.com`,
          passwordHash,
          firstName: `Load`,
          lastName: `Test User ${i}`,
          role: i <= 10 ? 'admin' : 'user', // First 10 users per org are admins
          isActive: true,
        },
      });

      createdUsers.push(user);
      totalUsers++;

      if (totalUsers % 100 === 0) {
        console.log(`  ✅ Created ${totalUsers} users...`);
      }
    }
  }

  console.log(`  ✅ Created ${totalUsers} total users`);

  // 3. Assign users to organizations with permissions
  console.log('\n🔗 Assigning users to organizations...');
  let totalAssignments = 0;

  for (const org of createdOrgs) {
    const orgUsers = createdUsers.filter(u =>
      u.username.includes(org.code.toLowerCase())
    );

    for (const user of orgUsers) {
      const existingAssignment = await prisma.userOrganization.findFirst({
        where: {
          userId: user.id,
          organizationId: org.id,
        },
      });

      if (existingAssignment) {
        continue;
      }

      // First 10 users are admins, next 40 are editors, rest are viewers
      const userIndex = parseInt(user.username.split('user')[1]);
      let role = 'viewer';
      let permissions = {
        perm_Read: true,
        perm_Export: true,
        perm_EditForecast: false,
        perm_EditActuals: false,
        perm_Delete: false,
        perm_Import: false,
        perm_RefreshData: false,
        perm_ViewFinancials: false,
        perm_SaveDraft: false,
        perm_Sync: false,
        perm_ManageUsers: false,
        perm_ManageSettings: false,
        perm_ConfigureAlerts: false,
        perm_Impersonate: false,
      };

      if (userIndex <= 10) {
        // Admin permissions
        role = 'admin';
        permissions = {
          perm_Read: true,
          perm_EditForecast: true,
          perm_EditActuals: true,
          perm_Delete: true,
          perm_Import: true,
          perm_RefreshData: true,
          perm_Export: true,
          perm_ViewFinancials: true,
          perm_SaveDraft: true,
          perm_Sync: true,
          perm_ManageUsers: true,
          perm_ManageSettings: true,
          perm_ConfigureAlerts: true,
          perm_Impersonate: false,
        };
      } else if (userIndex <= 50) {
        // Editor permissions
        role = 'editor';
        permissions = {
          perm_Read: true,
          perm_EditForecast: true,
          perm_EditActuals: false,
          perm_Delete: false,
          perm_Import: true,
          perm_RefreshData: false,
          perm_Export: true,
          perm_ViewFinancials: false,
          perm_SaveDraft: true,
          perm_Sync: false,
          perm_ManageUsers: false,
          perm_ManageSettings: false,
          perm_ConfigureAlerts: false,
          perm_Impersonate: false,
        };
      }

      await prisma.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role,
          assignmentSource: 'local',
          ...permissions,
        },
      });

      totalAssignments++;

      if (totalAssignments % 100 === 0) {
        console.log(`  ✅ Created ${totalAssignments} assignments...`);
      }
    }
  }

  console.log(`  ✅ Created ${totalAssignments} total assignments`);

  // 4. Generate credentials file for Artillery
  console.log('\n🔐 Generating credentials file...');
  const credentials = createdUsers.map(u => ({
    username: u.username,
    password: 'testpass123',
  }));

  const fs = require('fs');
  fs.writeFileSync(
    'load-tests/test-credentials.json',
    JSON.stringify(credentials, null, 2)
  );

  console.log(`  ✅ Saved ${credentials.length} credentials to load-tests/test-credentials.json`);

  // 5. Generate admin credentials (first 10 users per org)
  const adminCredentials = createdUsers
    .filter(u => u.role === 'admin')
    .map(u => ({
      username: u.username,
      password: 'testpass123',
    }));

  fs.writeFileSync(
    'load-tests/admin-credentials.json',
    JSON.stringify(adminCredentials, null, 2)
  );

  console.log(`  ✅ Saved ${adminCredentials.length} admin credentials to load-tests/admin-credentials.json`);

  console.log('\n✅ Test data generation complete!');
  console.log(`
Summary:
  - Organizations: ${createdOrgs.length}
  - Users: ${createdUsers.length}
  - User-Org Assignments: ${totalAssignments}
  - Admin Users: ${adminCredentials.length}
  `);
}

generateTestData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
