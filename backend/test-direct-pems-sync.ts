import { PemsSyncService } from './src/services/pems/PemsSyncService';
import { getPrismaClient } from './src/config/database';
import { config } from 'dotenv';

config();

const prisma = getPrismaClient();

async function testDirectPemsSync() {
  try {
    console.log('═════════════════════════════════════════════════════');
    console.log('🔍 Testing PemsSyncService directly');
    console.log('═════════════════════════════════════════════════════\n');

    // Get RIO organization
    const org = await prisma.organization.findFirst({
      where: { code: 'RIO' }
    });

    if (!org) {
      throw new Error('RIO organization not found');
    }

    console.log(`📊 Organization: ${org.name} (${org.code})`);
    console.log(`   ID: ${org.id}\n`);

    // Get API configuration
    const apiConfig = await prisma.apiConfiguration.findFirst({
      where: {
        usage: 'PEMS_PFA_READ',
        operationType: 'read'
      }
    });

    if (!apiConfig) {
      throw new Error('PEMS PFA Read API configuration not found');
    }

    console.log(`🔌 API Configuration: ${apiConfig.name}`);
    console.log(`   ID: ${apiConfig.id}`);
    console.log(`   URL: ${apiConfig.url}`);
    console.log(`   Auth Type: ${apiConfig.authType}\n`);

    // Create sync service
    const pemsSync = new PemsSyncService();

    console.log('🔄 Starting PFA data sync...\n');

    const result = await pemsSync.syncPfaData(
      org.id,
      'full',
      `direct-test-${Date.now()}`,
      apiConfig.id
    );

    console.log('\n═════════════════════════════════════════════════════');
    console.log('✅ Sync Result:');
    console.log('═════════════════════════════════════════════════════');
    console.log(`Status: ${result.status}`);
    console.log(`Sync ID: ${result.syncId}`);
    console.log(`Total Records: ${result.totalRecords}`);
    console.log(`Inserted: ${result.inserted}`);
    console.log(`Updated: ${result.updated}`);
    console.log(`Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      result.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err}`);
      });
    }

    if (result.errorMessage) {
      console.log(`\n❌ Error Message: ${result.errorMessage}`);
    }

    console.log('═════════════════════════════════════════════════════');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Stack:', error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testDirectPemsSync();
