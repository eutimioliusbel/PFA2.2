/**
 * Initialize PEMS Global Credentials
 *
 * This script sets up the system-wide PEMS credentials from the testing environment.
 * Run this ONCE after seeding to configure PEMS access for all organizations.
 *
 * Usage: npx tsx init-pems-credentials.ts
 */

import { PrismaClient } from '@prisma/client';
import { encrypt } from './src/utils/encryption';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🔐 Initializing PEMS Global Credentials...\n');

  // PEMS Credentials from C:\Users\eutim\OneDrive\Desktop\pfa\PEMS_API_TESTING 1\PEMS_API_TESTING\PEMS_API_TESTING\Form1.cs
  const PEMS_USERNAME = 'APIUSER';
  const PEMS_PASSWORD = 'BEOSugarland2025!';
  const PEMS_TENANT = 'BECHTEL_DEV';
  const PEMS_ORGANIZATION = 'BECH';

  // Encrypt credentials
  const usernameEncrypted = encrypt(PEMS_USERNAME);
  const passwordEncrypted = encrypt(PEMS_PASSWORD);

  // Store tenant and organization as custom headers
  const customHeaders = JSON.stringify([
    { key: 'tenant', value: PEMS_TENANT },
    { key: 'organization', value: PEMS_ORGANIZATION }
  ]);

  // ============================================================================
  // 1. Update Global PEMS API Configurations with Credentials
  // ============================================================================

  console.log('📌 Setting up global PEMS API configurations...\n');

  // Update PEMS PFA Read API
  await prisma.apiConfiguration.update({
    where: { id: 'pems-global-pfa-read' },
    data: {
      authKeyEncrypted: usernameEncrypted,
      authValueEncrypted: passwordEncrypted,
      customHeaders,
      status: 'untested'
    }
  });
  console.log('✓ PEMS PFA Read - Credentials configured');

  // Update PEMS PFA Write API
  await prisma.apiConfiguration.update({
    where: { id: 'pems-global-pfa-write' },
    data: {
      authKeyEncrypted: usernameEncrypted,
      authValueEncrypted: passwordEncrypted,
      customHeaders,
      status: 'untested'
    }
  });
  console.log('✓ PEMS PFA Write - Credentials configured');

  // Update PEMS Assets API
  await prisma.apiConfiguration.update({
    where: { id: 'pems-global-assets' },
    data: {
      authKeyEncrypted: usernameEncrypted,
      authValueEncrypted: passwordEncrypted,
      customHeaders,
      status: 'untested'
    }
  });
  console.log('✓ PEMS Assets - Credentials configured');

  // Update PEMS Classes API
  await prisma.apiConfiguration.update({
    where: { id: 'pems-global-classes' },
    data: {
      authKeyEncrypted: usernameEncrypted,
      authValueEncrypted: passwordEncrypted,
      customHeaders,
      status: 'untested'
    }
  });
  console.log('✓ PEMS Classes - Credentials configured\n');

  // ============================================================================
  // Summary
  // ============================================================================

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ PEMS Global Credentials Configured Successfully!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('📋 Configured APIs:');
  console.log('   • PEMS PFA Read  (griddata endpoint)');
  console.log('   • PEMS PFA Write (UserDefinedScreenService)');
  console.log('   • PEMS Assets    (equipment/assets)');
  console.log('   • PEMS Classes   (equipment/categories)');
  console.log('');
  console.log('🔐 Credentials:');
  console.log(`   Username:     ${PEMS_USERNAME}`);
  console.log(`   Password:     ${'*'.repeat(PEMS_PASSWORD.length)}`);
  console.log(`   Tenant:       ${PEMS_TENANT}`);
  console.log(`   Organization: ${PEMS_ORGANIZATION}`);
  console.log('');
  console.log('🚀 Next Steps:');
  console.log('   1. Test PEMS connections in Admin Dashboard → API Connectivity');
  console.log('   2. All organizations will use these shared credentials');
  console.log('   3. Organizations can configure their own AI provider API keys');
  console.log('');

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
