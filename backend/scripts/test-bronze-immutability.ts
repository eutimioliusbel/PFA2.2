import { getPrismaClient } from '../src/config/database';

const prisma = getPrismaClient();

async function testBronzeImmutability() {
  try {
    console.log('Testing Bronze Layer Immutability Middleware...\n');

    // Step 1: Create a test Bronze batch
    console.log('1. Creating test Bronze batch...');
    const batch = await prisma.bronzeBatch.create({
      data: {
        syncBatchId: `test-batch-${Date.now()}`,
        organizationId: 'test-org',
        endpointId: 'test-endpoint',
        entityType: 'PFA',
        recordCount: 1,
        validRecordCount: 1,
        invalidRecordCount: 0,
      },
    });
    console.log(`   ✓ Created batch: ${batch.syncBatchId}`);

    // Step 2: Create a test Bronze record
    console.log('\n2. Creating test Bronze record...');
    const record = await prisma.bronzeRecord.create({
      data: {
        syncBatchId: batch.syncBatchId,
        organizationId: 'test-org',
        entityType: 'PFA',
        rawJson: {
          pfaId: 'TEST-001',
          category: 'TEST',
          cost: 1000,
        },
        schemaVersion: 'v1',
      },
    });
    console.log(`   ✓ Created record: ${record.id}`);

    // Step 3: Try to UPDATE Bronze record (should FAIL)
    console.log('\n3. Testing UPDATE prohibition...');
    try {
      await prisma.bronzeRecord.update({
        where: { id: record.id },
        data: { schemaVersion: 'v2' },
      });
      console.log('   ❌ FAIL: Update was allowed (middleware not working!)');
      return false;
    } catch (error: any) {
      if (error.message.includes('immutable')) {
        console.log('   ✅ PASS: Update blocked by middleware');
      } else {
        console.log(`   ❌ FAIL: Unexpected error: ${error.message}`);
        return false;
      }
    }

    // Step 4: Try to DELETE Bronze record (should FAIL)
    console.log('\n4. Testing DELETE prohibition...');
    try {
      await prisma.bronzeRecord.delete({
        where: { id: record.id },
      });
      console.log('   ❌ FAIL: Delete was allowed (middleware not working!)');
      return false;
    } catch (error: any) {
      if (error.message.includes('immutable')) {
        console.log('   ✅ PASS: Delete blocked by middleware');
      } else {
        console.log(`   ❌ FAIL: Unexpected error: ${error.message}`);
        return false;
      }
    }

    // Step 5: Verify record is still readable
    console.log('\n5. Verifying record is still readable...');
    const verifyRecord = await prisma.bronzeRecord.findUnique({
      where: { id: record.id },
    });
    if (verifyRecord) {
      console.log('   ✓ Record still exists and is readable');
    } else {
      console.log('   ❌ FAIL: Record not found');
      return false;
    }

    // Cleanup: Delete batch (cascades to record)
    console.log('\n6. Cleanup: Deleting batch (cascade allowed at batch level)...');
    await prisma.bronzeBatch.delete({
      where: { id: batch.id },
    });
    console.log('   ✓ Batch deleted successfully');

    console.log('\n🎉 All tests passed! Bronze layer is properly immutable.');
    return true;

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

testBronzeImmutability().then(success => {
  process.exit(success ? 0 : 1);
});
