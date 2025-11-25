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
  const PEMS_GRID_CODE = 'CUPFAG';
  const PEMS_GRID_ID = '100541';

  // Encrypt credentials
  const usernameEncrypted = encrypt(PEMS_USERNAME);
  const passwordEncrypted = encrypt(PEMS_PASSWORD);

  // Store tenant, gridCode, and gridId as custom headers
  // NOTE: Do NOT set global 'organization' here - each org uses its own database code
  // (RIO syncs as "RIO", HOLNG as "HOLNG", etc.)
  const customHeaders = JSON.stringify([
    { key: 'tenant', value: PEMS_TENANT },
    { key: 'gridCode', value: PEMS_GRID_CODE },
    { key: 'gridId', value: PEMS_GRID_ID }
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
  console.log('✓ PEMS Classes - Credentials configured');

  // Update PEMS Organizations API
  await prisma.apiConfiguration.update({
    where: { id: 'pems-global-organizations' },
    data: {
      authKeyEncrypted: usernameEncrypted,
      authValueEncrypted: passwordEncrypted,
      customHeaders,
      status: 'untested'
    }
  });
  console.log('✓ PEMS Organizations - Credentials configured\n');

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
  console.log('   • PEMS Organizations (organization endpoint)');
  console.log('');
  console.log('🔐 Credentials:');
  console.log(`   Username:     ${PEMS_USERNAME}`);
  console.log(`   Password:     ${'*'.repeat(PEMS_PASSWORD.length)}`);
  console.log(`   Tenant:       ${PEMS_TENANT}`);
  console.log(`   Organization: <uses database org code> (RIO, HOLNG, PORTARTHUR, etc.)`);
  console.log(`   Grid Code:    ${PEMS_GRID_CODE}`);
  console.log(`   Grid ID:      ${PEMS_GRID_ID}`);
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
