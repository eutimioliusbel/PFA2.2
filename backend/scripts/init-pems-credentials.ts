/**
 * Initialize PEMS Global Credentials
 *
 * NOTE: This script is currently disabled as it uses the old ApiConfiguration
 * architecture. With ADR-006 implementation, PEMS credentials are now stored
 * in the api_servers table and managed through the API Server UI.
 *
 * To configure PEMS credentials:
 * 1. Log into the application as admin
 * 2. Go to Admin Dashboard → API Servers
 * 3. Edit the PEMS_DEV server
 * 4. Add credentials there
 *
 * Usage: npx tsx init-pems-credentials.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🔐 PEMS Credentials Initialization\n');
  console.log('ℹ️  This script is currently disabled.');
  console.log('   PEMS credentials are now configured via Admin Dashboard → API Servers.\n');
  console.log('✅ Skipping credential initialization - configure via UI\n');

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
