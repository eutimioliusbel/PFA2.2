/**
 * Direct PFA Sync Script
 * Bypasses the controller and calls PemsSyncService directly
 */
import { PrismaClient } from '@prisma/client';
import { PemsSyncService } from '../src/services/pems/PemsSyncService';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const pemsSyncService = new PemsSyncService();

async function runDirectSync() {
  try {
    // Get RIO organization
    const rioOrg = await prisma.organizations.findUnique({
      where: { code: 'RIO' }
    });

    if (!rioOrg) {
      console.error('RIO organization not found');
      return;
    }

    console.log(`🔄 Starting direct PFA sync for ${rioOrg.code}...`);
    console.log(`   Organization ID: ${rioOrg.id}`);

    const syncId = randomUUID();
    const apiConfigId = 'pems-endpoint-pfa-read';

    console.log(`   Sync ID: ${syncId}`);
    console.log(`   API Config: ${apiConfigId}`);

    // Call sync service directly
    const result = await pemsSyncService.syncPfaData(
      rioOrg.id,
      'full',
      syncId,
      apiConfigId
    );

    console.log('\n✅ Sync completed!');
    console.log('═════════════════════════════════════════════════════');
    console.log(`  Status: ${result.status}`);
    console.log(`  Total Records: ${result.totalRecords}`);
    console.log(`  Inserted: ${result.inserted}`);
    console.log(`  Updated: ${result.updated}`);
    console.log(`  Errors: ${result.errors}`);
    if (result.errorMessage) {
      console.log(`  Error Message: ${result.errorMessage}`);
    }
    console.log('═════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Sync failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runDirectSync();
