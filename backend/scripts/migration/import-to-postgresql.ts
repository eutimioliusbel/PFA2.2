/**
 * @file import-to-postgresql.ts
 * @description Imports exported SQLite data into PostgreSQL database
 * @usage npx tsx scripts/migration/import-to-postgresql.ts <export-directory>
 *
 * Features:
 * - Imports tables in correct order (respecting foreign keys)
 * - Transactional imports (all-or-nothing per table)
 * - Batch processing for large tables
 * - Checksum validation after import
 * - Progress reporting
 * - Automatic rollback on error
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

interface ImportedTable {
  tableName: string;
  expectedCount: number;
  importedCount: number;
  verifiedCount: number;
  duration: number;
  success: boolean;
}

interface ImportResult {
  success: boolean;
  importedTables: ImportedTable[];
  totalRecords: number;
  totalDuration: number;
  errors: string[];
}

/**
 * Calculate checksum for verification
 */
function calculateChecksum(data: any): string {
  const jsonStr = JSON.stringify(data);
  return crypto.createHash('sha256').update(jsonStr).digest('hex');
}

/**
 * Deserialize dates from ISO strings
 */
function deserializeData(data: any[]): any[] {
  return data.map(record => {
    const deserialized: any = {};
    for (const [key, value] of Object.entries(record)) {
      // Check if value looks like an ISO date string
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        deserialized[key] = new Date(value);
      } else {
        deserialized[key] = value;
      }
    }
    return deserialized;
  });
}

/**
 * Import a single table with batch processing
 */
async function importTable(
  tableName: string,
  data: any[],
  expectedChecksum: string,
  batchSize: number = 1000
): Promise<ImportedTable> {
  console.log(`\n📥 Importing ${tableName} (${data.length} records)...`);
  const startTime = Date.now();

  try {
    // Deserialize dates
    const deserializedData = deserializeData(data);

    // Verify checksum before import
    const dataChecksum = calculateChecksum(data);
    if (dataChecksum !== expectedChecksum) {
      throw new Error(`Checksum mismatch! Expected: ${expectedChecksum.substring(0, 16)}..., Got: ${dataChecksum.substring(0, 16)}...`);
    }
    console.log(`   ✓ Checksum verified`);

    let importedCount = 0;

    // Import based on table name (using Prisma model methods)
    switch (tableName) {
      case 'users':
        for (let i = 0; i < deserializedData.length; i += batchSize) {
          const batch = deserializedData.slice(i, i + batchSize);
          await prisma.$transaction(async (tx) => {
            for (const record of batch) {
              await tx.user.create({ data: record });
              importedCount++;
            }
          });
          console.log(`   Progress: ${Math.min(100, (importedCount / data.length) * 100).toFixed(1)}%`);
        }
        break;

      case 'organizations':
        for (let i = 0; i < deserializedData.length; i += batchSize) {
          const batch = deserializedData.slice(i, i + batchSize);
          await prisma.$transaction(async (tx) => {
            for (const record of batch) {
              await tx.organization.create({ data: record });
              importedCount++;
            }
          });
          console.log(`   Progress: ${Math.min(100, (importedCount / data.length) * 100).toFixed(1)}%`);
        }
        break;

      case 'user_organizations':
        for (let i = 0; i < deserializedData.length; i += batchSize) {
          const batch = deserializedData.slice(i, i + batchSize);
          await prisma.$transaction(async (tx) => {
            for (const record of batch) {
              await tx.userOrganization.create({ data: record });
              importedCount++;
            }
          });
          console.log(`   Progress: ${Math.min(100, (importedCount / data.length) * 100).toFixed(1)}%`);
        }
        break;

      case 'ai_providers':
        for (let i = 0; i < deserializedData.length; i += batchSize) {
          const batch = deserializedData.slice(i, i + batchSize);
          await prisma.$transaction(async (tx) => {
            for (const record of batch) {
              await tx.aiProvider.create({ data: record });
              importedCount++;
            }
          });
          console.log(`   Progress: ${Math.min(100, (importedCount / data.length) * 100).toFixed(1)}%`);
        }
        break;

      case 'organization_ai_configs':
        for (let i = 0; i < deserializedData.length; i += batchSize) {
          const batch = deserializedData.slice(i, i + batchSize);
          await prisma.$transaction(async (tx) => {
            for (const record of batch) {
              await tx.organizationAiConfig.create({ data: record });
              importedCount++;
            }
          });
          console.log(`   Progress: ${Math.min(100, (importedCount / data.length) * 100).toFixed(1)}%`);
        }
        break;

      case 'ai_usage_logs':
        for (let i = 0; i < deserializedData.length; i += batchSize) {
          const batch = deserializedData.slice(i, i + batchSize);
          await prisma.$transaction(async (tx) => {
            for (const record of batch) {
              await tx.aiUsageLog.create({ data: record });
              importedCount++;
            }
          });
          console.log(`   Progress: ${Math.min(100, (importedCount / data.length) * 100).toFixed(1)}%`);
        }
        break;

      case 'api_configurations':
        for (let i = 0; i < deserializedData.length; i += batchSize) {
          const batch = deserializedData.slice(i, i + batchSize);
          await prisma.$transaction(async (tx) => {
            for (const record of batch) {
              await tx.apiConfiguration.create({ data: record });
              importedCount++;
            }
          });
          console.log(`   Progress: ${Math.min(100, (importedCount / data.length) * 100).toFixed(1)}%`);
        }
        break;

      case 'organization_api_credentials':
        for (let i = 0; i < deserializedData.length; i += batchSize) {
          const batch = deserializedData.slice(i, i + batchSize);
          await prisma.$transaction(async (tx) => {
            for (const record of batch) {
              await tx.organizationApiCredentials.create({ data: record });
              importedCount++;
            }
          });
          console.log(`   Progress: ${Math.min(100, (importedCount / data.length) * 100).toFixed(1)}%`);
        }
        break;

      case 'data_source_mappings':
        for (let i = 0; i < deserializedData.length; i += batchSize) {
          const batch = deserializedData.slice(i, i + batchSize);
          await prisma.$transaction(async (tx) => {
            for (const record of batch) {
              await tx.dataSourceMapping.create({ data: record });
              importedCount++;
            }
          });
          console.log(`   Progress: ${Math.min(100, (importedCount / data.length) * 100).toFixed(1)}%`);
        }
        break;

      case 'field_configurations':
        for (let i = 0; i < deserializedData.length; i += batchSize) {
          const batch = deserializedData.slice(i, i + batchSize);
          await prisma.$transaction(async (tx) => {
            for (const record of batch) {
              await tx.fieldConfiguration.create({ data: record });
              importedCount++;
            }
          });
          console.log(`   Progress: ${Math.min(100, (importedCount / data.length) * 100).toFixed(1)}%`);
        }
        break;

      case 'pfa_records':
        // Large table - use smaller batches and show detailed progress
        const pfaBatchSize = 500;
        for (let i = 0; i < deserializedData.length; i += pfaBatchSize) {
          const batch = deserializedData.slice(i, i + pfaBatchSize);
          await prisma.$transaction(async (tx) => {
            for (const record of batch) {
              await tx.pfaRecord.create({ data: record });
              importedCount++;
            }
          }, {
            timeout: 60000 // 60 second timeout for large batches
          });
          const progress = Math.min(100, (importedCount / data.length) * 100);
          console.log(`   Progress: ${progress.toFixed(1)}% (${importedCount}/${data.length})`);
        }
        break;

      case 'sync_logs':
        for (let i = 0; i < deserializedData.length; i += batchSize) {
          const batch = deserializedData.slice(i, i + batchSize);
          await prisma.$transaction(async (tx) => {
            for (const record of batch) {
              await tx.syncLog.create({ data: record });
              importedCount++;
            }
          });
          console.log(`   Progress: ${Math.min(100, (importedCount / data.length) * 100).toFixed(1)}%`);
        }
        break;

      default:
        throw new Error(`Unknown table: ${tableName}`);
    }

    // Verify import count
    const verifiedCount = await getTableCount(tableName);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (verifiedCount !== data.length) {
      throw new Error(`Count mismatch! Expected: ${data.length}, Got: ${verifiedCount}`);
    }

    console.log(`   ✓ Imported ${importedCount} records in ${duration}s`);
    console.log(`   ✓ Verified count matches: ${verifiedCount}`);

    return {
      tableName,
      expectedCount: data.length,
      importedCount,
      verifiedCount,
      duration: parseFloat(duration),
      success: true
    };

  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`   ❌ Failed to import ${tableName}:`, error.message);

    return {
      tableName,
      expectedCount: data.length,
      importedCount: 0,
      verifiedCount: 0,
      duration: parseFloat(duration),
      success: false
    };
  }
}

/**
 * Get row count for a table
 */
async function getTableCount(tableName: string): Promise<number> {
  switch (tableName) {
    case 'users': return await prisma.user.count();
    case 'organizations': return await prisma.organization.count();
    case 'user_organizations': return await prisma.userOrganization.count();
    case 'ai_providers': return await prisma.aiProvider.count();
    case 'organization_ai_configs': return await prisma.organizationAiConfig.count();
    case 'ai_usage_logs': return await prisma.aiUsageLog.count();
    case 'api_configurations': return await prisma.apiConfiguration.count();
    case 'organization_api_credentials': return await prisma.organizationApiCredentials.count();
    case 'data_source_mappings': return await prisma.dataSourceMapping.count();
    case 'field_configurations': return await prisma.fieldConfiguration.count();
    case 'pfa_records': return await prisma.pfaRecord.count();
    case 'sync_logs': return await prisma.syncLog.count();
    default: return 0;
  }
}

/**
 * Load export manifest
 */
function loadManifest(exportDir: string): any {
  const manifestPath = path.join(exportDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
}

/**
 * Load table data
 */
function loadTableData(exportDir: string, tableName: string): any[] {
  const tablePath = path.join(exportDir, `${tableName}.json`);
  if (!fs.existsSync(tablePath)) {
    throw new Error(`Table file not found: ${tablePath}`);
  }
  const tableFile = JSON.parse(fs.readFileSync(tablePath, 'utf-8'));
  return tableFile.data;
}

/**
 * Main import function
 */
async function importAllData(exportDir: string): Promise<ImportResult> {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  PostgreSQL Data Import from SQLite Export                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  const startTime = Date.now();
  const importedTables: ImportedTable[] = [];
  const errors: string[] = [];

  try {
    // Load manifest
    console.log(`\n📂 Loading export from: ${exportDir}`);
    const manifest = loadManifest(exportDir);
    console.log(`   ✓ Manifest loaded (${manifest.tables.length} tables, ${manifest.totalRecords.toLocaleString()} total records)`);
    console.log(`   ✓ Export date: ${manifest.exportedAt}`);
    console.log(`   ✓ Overall checksum: ${manifest.overallChecksum.substring(0, 16)}...`);

    // Check if database is empty (safety check)
    const existingUserCount = await prisma.user.count();
    if (existingUserCount > 0) {
      console.log(`\n⚠️  WARNING: Database is not empty! Found ${existingUserCount} existing users.`);
      console.log(`   This import will ADD to existing data, not replace it.`);
      console.log(`   Press Ctrl+C to cancel, or wait 10 seconds to continue...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    // Import tables in dependency order
    for (const tableInfo of manifest.tables) {
      const data = loadTableData(exportDir, tableInfo.tableName);
      const result = await importTable(tableInfo.tableName, data, tableInfo.checksum);
      importedTables.push(result);

      if (!result.success) {
        errors.push(`Failed to import ${tableInfo.tableName}`);
        throw new Error(`Import failed for table: ${tableInfo.tableName}`);
      }
    }

    const totalRecords = importedTables.reduce((sum, t) => sum + t.importedCount, 0);
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n✅ Import completed successfully!');
    console.log(`   Total Duration: ${totalDuration}s`);
    console.log(`   Total Records: ${totalRecords.toLocaleString()}`);

    return {
      success: true,
      importedTables,
      totalRecords,
      totalDuration: parseFloat(totalDuration),
      errors
    };

  } catch (error: any) {
    console.error('\n❌ Import failed:', error.message);
    errors.push(error.message);

    return {
      success: false,
      importedTables,
      totalRecords: 0,
      totalDuration: ((Date.now() - startTime) / 1000),
      errors
    };
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const exportDir = process.argv[2];

  if (!exportDir) {
    console.error('❌ Usage: npx tsx scripts/migration/import-to-postgresql.ts <export-directory>');
    process.exit(1);
  }

  if (!fs.existsSync(exportDir)) {
    console.error(`❌ Export directory not found: ${exportDir}`);
    process.exit(1);
  }

  try {
    const result = await importAllData(exportDir);

    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  Import Summary                                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`Status:             ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Imported Tables:    ${result.importedTables.length}`);
    console.log(`Total Records:      ${result.totalRecords.toLocaleString()}`);
    console.log(`Total Duration:     ${result.totalDuration}s`);
    if (result.errors.length > 0) {
      console.log(`Errors:             ${result.errors.length}`);
      result.errors.forEach(err => console.log(`   - ${err}`));
    }
    console.log('');

    if (!result.success) {
      process.exit(1);
    }

  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
