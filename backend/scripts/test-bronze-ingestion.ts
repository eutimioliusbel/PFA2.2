/**
 * Test Bronze Layer Ingestion with Unified Fetch
 *
 * Verifies that PemsIngestionService can ingest data from ALL endpoint types:
 * - Grid API endpoints (PFA)
 * - REST API endpoints (assets, users, manufacturers, etc.)
 *
 * Usage: npx ts-node scripts/test-bronze-ingestion.ts
 */

import { PrismaClient } from '@prisma/client';
import { PemsIngestionService } from '../src/services/pems/PemsIngestionService';

const prisma = new PrismaClient();
const ingestionService = new PemsIngestionService();

interface TestResult {
  endpoint: string;
  entity: string;
  type: 'Grid API' | 'REST API';
  success: boolean;
  recordCount: number;
  duration: number;
  syncBatchId?: string;
  error?: string;
}

async function main() {
  console.log('='.repeat(70));
  console.log('BRONZE LAYER INGESTION TEST - Unified Fetch');
  console.log('='.repeat(70));

  // Get all active read endpoints
  const endpoints = await prisma.api_endpoints.findMany({
    where: {
      status: { not: 'inactive' },
      operationType: { in: ['read', 'read-write'] }
    },
    include: {
      api_servers: { select: { id: true, name: true, organizationId: true } }
    },
    orderBy: { entity: 'asc' }
  });

  console.log(`\n📋 Found ${endpoints.length} read endpoints to test:\n`);

  endpoints.forEach(ep => {
    const hasGrid = ep.customHeaders?.includes('gridCode');
    console.log(`  [${hasGrid ? 'GRID' : 'REST'}] ${ep.entity.padEnd(18)} - ${ep.name}`);
  });

  // Test each endpoint
  console.log('\n' + '='.repeat(70));
  console.log('INGESTING TO BRONZE LAYER');
  console.log('='.repeat(70));

  const results: TestResult[] = [];

  for (const endpoint of endpoints) {
    const hasGrid = endpoint.customHeaders?.includes('gridCode');
    const type = hasGrid ? 'Grid API' : 'REST API';

    console.log(`\n📡 Ingesting: ${endpoint.name} (${endpoint.entity}) [${type}]`);
    console.log(`   Endpoint ID: ${endpoint.id}`);

    const startTime = Date.now();

    try {
      // Use the ingestion service - limited to 50 records for testing
      // In production, this would fetch all records
      const result = await ingestionService.ingestBatch(endpoint.id, 'full');

      const duration = Date.now() - startTime;

      if (result.success) {
        console.log(`   ✅ Success: ${result.recordCount} records ingested in ${duration}ms`);
        console.log(`   📦 Batch ID: ${result.syncBatchId}`);

        results.push({
          endpoint: endpoint.name,
          entity: endpoint.entity,
          type,
          success: true,
          recordCount: result.recordCount,
          duration,
          syncBatchId: result.syncBatchId
        });
      } else {
        console.log(`   ❌ Failed: ${result.error}`);
        results.push({
          endpoint: endpoint.name,
          entity: endpoint.entity,
          type,
          success: false,
          recordCount: 0,
          duration,
          error: result.error
        });
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ Exception: ${errorMsg}`);
      results.push({
        endpoint: endpoint.name,
        entity: endpoint.entity,
        type,
        success: false,
        recordCount: 0,
        duration,
        error: errorMsg
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\n✅ Successful: ${successful.length}/${results.length}`);
  if (successful.length > 0) {
    console.log('\n   Entity             Records    Duration   Batch ID');
    console.log('   ' + '-'.repeat(60));
    successful.forEach(r => {
      console.log(`   ${r.entity.padEnd(18)} ${String(r.recordCount).padStart(7)}    ${String(r.duration + 'ms').padStart(8)}   ${r.syncBatchId?.slice(0, 25)}...`);
    });
  }

  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}/${results.length}`);
    failed.forEach(r => {
      console.log(`   - ${r.entity}: ${r.error}`);
    });
  }

  // Check Bronze records
  console.log('\n' + '='.repeat(70));
  console.log('BRONZE LAYER STATUS');
  console.log('='.repeat(70));

  const batchCount = await prisma.bronze_batches.count();
  const recordCount = await prisma.bronze_records.count();

  console.log(`\n📊 Bronze Layer Statistics:`);
  console.log(`   Total Batches: ${batchCount}`);
  console.log(`   Total Records: ${recordCount}`);

  // Show records by entity type
  const recordsByEntity = await prisma.bronze_records.groupBy({
    by: ['entityType'],
    _count: { id: true }
  });

  if (recordsByEntity.length > 0) {
    console.log(`\n   Records by Entity Type:`);
    recordsByEntity.forEach(r => {
      console.log(`   - ${r.entityType}: ${r._count.id}`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('TEST COMPLETE');
  console.log('='.repeat(70));

  // Return exit code based on results
  const exitCode = failed.length > 0 ? 1 : 0;
  process.exit(exitCode);
}

main()
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
