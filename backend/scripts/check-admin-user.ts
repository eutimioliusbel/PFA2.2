/**
 * Check if admin user exists and verify password
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkAdmin() {
  console.log('🔍 Checking admin user...\n');

  try {
    const user = await prisma.users.findUnique({
      where: { username: 'admin' },
      select: {
        id: true,
        username: true,
        email: true,
        passwordHash: true,
        isActive: true,
        serviceStatus: true,
        authProvider: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      console.log('❌ Admin user NOT FOUND in database');
      console.log('\n🔧 To fix: Run npm run prisma:seed');
      return;
    }

    console.log('✅ Admin user found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Active: ${user.isActive}`);
    console.log(`   Service Status: ${user.serviceStatus}`);
    console.log(`   Auth Provider: ${user.authProvider}`);
    console.log(`   Created: ${user.createdAt}`);
    console.log(`   Password Hash: ${user.passwordHash ? user.passwordHash.substring(0, 20) + '...' : '(not set)'}`);

    // Test password verification
    console.log('\n🔐 Testing password verification...');
    if (!user.passwordHash) {
      console.log('⚠️  No password hash set - PEMS user or not yet initialized');
    } else {
      const isValid = await bcrypt.compare('admin123', user.passwordHash);

      if (isValid) {
        console.log('✅ Password "admin123" is CORRECT');
      } else {
        console.log('❌ Password "admin123" does NOT match');
        console.log('\n🔧 To fix: Delete user and re-seed database');
        console.log('   DELETE FROM "User" WHERE username = \'admin\';');
        console.log('   npm run prisma:seed');
      }
    }

    // Check organizations
    console.log('\n🏢 Checking organizations...');
    const orgCount = await prisma.user_organizations.count({
      where: { userId: user.id },
    });

    const orgs = await prisma.user_organizations.findMany({
      where: { userId: user.id },
      include: {
        organizations: {
          select: {
            code: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    console.log(`   Admin is linked to ${orgCount} organization(s):`);
    orgs.forEach((org) => {
      if (org.organizations) {
        console.log(`   - ${org.organizations.code} (${org.organizations.name}) - Active: ${org.organizations.isActive}`);
      }
    });

    if (orgCount === 0) {
      console.log('\n⚠️  WARNING: Admin has NO organizations assigned');
      console.log('   This might cause login issues');
      console.log('\n🔧 To fix: Run npm run prisma:seed');
    }

  } catch (error) {
    console.error('❌ Error checking admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdmin();
