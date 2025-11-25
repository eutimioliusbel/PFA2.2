/**
 * @file export-sqlite-data.ts
 * @description Exports all data from SQLite database to JSON for PostgreSQL migration
 * @usage npx tsx scripts/migration/export-sqlite-data.ts
 *
 * Features:
 * - Exports tables in correct order (respecting foreign keys)
 * - Validates data integrity (row counts, checksums)
 * - Handles JSON fields correctly
 * - Includes rollback data for safety
 * - Progress reporting
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

interface ExportedTable {
  tableName: string;
  rowCount: number;
  checksum: string;
  data: any[];
  exportedAt: string;
}

interface ExportManifest {
  version: string;
  exportedAt: string;
  databaseType: 'sqlite';
  tables: ExportedTable[];
  totalRecords: number;
  overallChecksum: string;
  schemaVersion?: string;
}

/**
 * Calculate checksum for data integrity verification
 */
function calculateChecksum(data: any): string {
  const jsonStr = JSON.stringify(data);
  return crypto.createHash('sha256').update(jsonStr).digest('hex');
}

/**
 * Serialize dates and ensure JSON-safe format
 */
function serializeData(data: any[]): any[] {
  return data.map(record => {
    const serialized: any = {};
    for (const [key, value] of Object.entries(record)) {
      if (value instanceof Date) {
        serialized[key] = value.toISOString();
      } else if (value === null || value === undefined) {
        serialized[key] = null;
      } else {
        serialized[key] = value;
      }
    }
    return serialized;
  });
}

/**
 * Export a single table with progress reporting
 */
async function exportTable(
  tableName: string,
  fetchFn: () => Promise<any[]>,
  batchSize: number = 1000
): Promise<ExportedTable> {
  console.log(`\n📦 Exporting ${tableName}...`);

  try {
    const data = await fetchFn();
    const serializedData = serializeData(data);
    const checksum = calculateChecksum(serializedData);

    console.log(`   ✓ Exported ${data.length} records`);
    console.log(`   ✓ Checksum: ${checksum.substring(0, 16)}...`);

    return {
      tableName,
      rowCount: data.length,
      checksum,
      data: serializedData,
      exportedAt: new Date().toISOString()
    };
  } catch (error: any) {
    console.error(`   ❌ Failed to export ${tableName}:`, error.message);
    throw error;
  }
}

/**
 * Main export function
 */
async function exportAllData(): Promise<ExportManifest> {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  SQLite Data Export for PostgreSQL Migration                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  const exportedTables: ExportedTable[] = [];
  const startTime = Date.now();

  try {
    // Export tables in dependency order (no foreign key violations)

    // 1. Users (no dependencies)
    exportedTables.push(
      await exportTable('users', () => prisma.user.findMany())
    );

    // 2. Organizations (no dependencies)
    exportedTables.push(
      await exportTable('organizations', () => prisma.organization.findMany())
    );

    // 3. UserOrganizations (depends on: users, organizations)
    exportedTables.push(
      await exportTable('user_organizations', () => prisma.userOrganization.findMany())
    );

    // 4. AiProviders (no dependencies)
    exportedTables.push(
      await exportTable('ai_providers', () => prisma.aiProvider.findMany())
    );

    // 5. OrganizationAiConfig (depends on: organizations)
    exportedTables.push(
      await exportTable('organization_ai_configs', () => prisma.organizationAiConfig.findMany())
    );

    // 6. AiUsageLogs (depends on: users)
    exportedTables.push(
      await exportTable('ai_usage_logs', () => prisma.aiUsageLog.findMany())
    );

    // 7. ApiConfigurations (depends on: organizations - nullable)
    exportedTables.push(
      await exportTable('api_configurations', () => prisma.apiConfiguration.findMany())
    );

    // 8. OrganizationApiCredentials (depends on: organizations, api_configurations)
    exportedTables.push(
      await exportTable('organization_api_credentials', () => prisma.organizationApiCredentials.findMany())
    );

    // 9. DataSourceMappings (depends on: api_configurations)
    exportedTables.push(
      await exportTable('data_source_mappings', () => prisma.dataSourceMapping.findMany())
    );

    // 10. FieldConfigurations (depends on: organizations - nullable)
    exportedTables.push(
      await exportTable('field_configurations', () => prisma.fieldConfiguration.findMany())
    );

    // 11. PfaRecords (depends on: organizations) - Large table, handle carefully
    const pfaCount = await prisma.pfaRecord.count();
    console.log(`\n📦 Exporting pfa_records (${pfaCount} records - may take time)...`);
    const BATCH_SIZE = 5000;
    let allPfaRecords: any[] = [];

    for (let skip = 0; skip < pfaCount; skip += BATCH_SIZE) {
      const batch = await prisma.pfaRecord.findMany({
        skip,
        take: BATCH_SIZE
      });
      allPfaRecords = allPfaRecords.concat(batch);
      const progress = Math.min(100, ((skip + batch.length) / pfaCount) * 100);
      console.log(`   Progress: ${progress.toFixed(1)}% (${skip + batch.length}/${pfaCount})`);
    }

    const serializedPfa = serializeData(allPfaRecords);
    const pfaChecksum = calculateChecksum(serializedPfa);
    console.log(`   ✓ Exported ${allPfaRecords.length} records`);
    console.log(`   ✓ Checksum: ${pfaChecksum.substring(0, 16)}...`);

    exportedTables.push({
      tableName: 'pfa_records',
      rowCount: allPfaRecords.length,
      checksum: pfaChecksum,
      data: serializedPfa,
      exportedAt: new Date().toISOString()
    });

    // 12. SyncLogs (no dependencies)
    exportedTables.push(
      await exportTable('sync_logs', () => prisma.syncLog.findMany())
    );

    // Calculate totals
    const totalRecords = exportedTables.reduce((sum, table) => sum + table.rowCount, 0);
    const overallChecksum = calculateChecksum(exportedTables.map(t => ({
      tableName: t.tableName,
      rowCount: t.rowCount,
      checksum: t.checksum
    })));

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n✅ Export completed successfully!');
    console.log(`   Duration: ${duration}s`);
    console.log(`   Total Records: ${totalRecords.toLocaleString()}`);
    console.log(`   Overall Checksum: ${overallChecksum.substring(0, 16)}...`);

    // Build manifest
    const manifest: ExportManifest = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      databaseType: 'sqlite',
      tables: exportedTables,
      totalRecords,
      overallChecksum,
      schemaVersion: 'prisma-schema-2025-11-25'
    };

    return manifest;

  } catch (error: any) {
    console.error('\n❌ Export failed:', error.message);
    throw error;
  }
}

/**
 * Save manifest and individual table files
 */
function saveExportFiles(manifest: ExportManifest): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const exportDir = path.join(__dirname, `export-${timestamp}`);

  // Create export directory
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  console.log(`\n💾 Saving export files to: ${exportDir}`);

  // Save manifest
  const manifestPath = path.join(exportDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    version: manifest.version,
    exportedAt: manifest.exportedAt,
    databaseType: manifest.databaseType,
    totalRecords: manifest.totalRecords,
    overallChecksum: manifest.overallChecksum,
    schemaVersion: manifest.schemaVersion,
    tables: manifest.tables.map(t => ({
      tableName: t.tableName,
      rowCount: t.rowCount,
      checksum: t.checksum,
      exportedAt: t.exportedAt
    }))
  }, null, 2));
  console.log(`   ✓ Saved manifest.json`);

  // Save individual table files
  for (const table of manifest.tables) {
    const tablePath = path.join(exportDir, `${table.tableName}.json`);
    fs.writeFileSync(tablePath, JSON.stringify({
      tableName: table.tableName,
      rowCount: table.rowCount,
      checksum: table.checksum,
      exportedAt: table.exportedAt,
      data: table.data
    }, null, 2));
    console.log(`   ✓ Saved ${table.tableName}.json (${table.rowCount} records, ${(fs.statSync(tablePath).size / 1024).toFixed(2)} KB)`);
  }

  // Save complete export in single file (for convenience)
  const completePath = path.join(exportDir, 'complete-export.json');
  fs.writeFileSync(completePath, JSON.stringify(manifest, null, 2));
  console.log(`   ✓ Saved complete-export.json (${(fs.statSync(completePath).size / 1024 / 1024).toFixed(2)} MB)`);

  console.log(`\n✅ All files saved successfully!`);
  console.log(`\n📋 Next Steps:`);
  console.log(`   1. Verify export integrity: npx tsx scripts/migration/verify-export.ts ${exportDir}`);
  console.log(`   2. Setup PostgreSQL database`);
  console.log(`   3. Update DATABASE_URL in .env to PostgreSQL connection string`);
  console.log(`   4. Run migrations: npx prisma migrate deploy`);
  console.log(`   5. Import data: npx tsx scripts/migration/import-to-postgresql.ts ${exportDir}`);
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  try {
    const manifest = await exportAllData();
    saveExportFiles(manifest);

    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  Export Summary                                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`Exported Tables:    ${manifest.tables.length}`);
    console.log(`Total Records:      ${manifest.totalRecords.toLocaleString()}`);
    console.log(`Checksum:           ${manifest.overallChecksum.substring(0, 32)}...`);
    console.log(`Exported At:        ${manifest.exportedAt}`);
    console.log('');

  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
