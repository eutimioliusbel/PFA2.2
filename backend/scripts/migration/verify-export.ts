/**
 * @file verify-export.ts
 * @description Verifies exported data integrity before PostgreSQL import
 * @usage npx tsx scripts/migration/verify-export.ts <export-directory>
 *
 * Checks:
 * - All expected table files exist
 * - Checksums match manifest
 * - Row counts match manifest
 * - Data structure is valid
 * - Foreign key references exist
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface VerificationResult {
  tableName: string;
  fileExists: boolean;
  checksumMatch: boolean;
  rowCountMatch: boolean;
  structureValid: boolean;
  foreignKeysValid: boolean;
  errors: string[];
}

/**
 * Calculate checksum
 */
function calculateChecksum(data: any): string {
  const jsonStr = JSON.stringify(data);
  return crypto.createHash('sha256').update(jsonStr).digest('hex');
}

/**
 * Load manifest
 */
function loadManifest(exportDir: string): any {
  const manifestPath = path.join(exportDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
}

/**
 * Verify single table file
 */
function verifyTable(
  exportDir: string,
  tableInfo: any,
  allData: Map<string, any[]>
): VerificationResult {
  const result: VerificationResult = {
    tableName: tableInfo.tableName,
    fileExists: false,
    checksumMatch: false,
    rowCountMatch: false,
    structureValid: false,
    foreignKeysValid: false,
    errors: []
  };

  try {
    // Check file exists
    const tablePath = path.join(exportDir, `${tableInfo.tableName}.json`);
    if (!fs.existsSync(tablePath)) {
      result.errors.push(`File not found: ${tablePath}`);
      return result;
    }
    result.fileExists = true;

    // Load table data
    const tableFile = JSON.parse(fs.readFileSync(tablePath, 'utf-8'));
    const data = tableFile.data;
    allData.set(tableInfo.tableName, data);

    // Verify row count
    if (data.length !== tableInfo.rowCount) {
      result.errors.push(`Row count mismatch: expected ${tableInfo.rowCount}, got ${data.length}`);
    } else {
      result.rowCountMatch = true;
    }

    // Verify checksum
    const calculatedChecksum = calculateChecksum(data);
    if (calculatedChecksum !== tableInfo.checksum) {
      result.errors.push(`Checksum mismatch: expected ${tableInfo.checksum.substring(0, 16)}..., got ${calculatedChecksum.substring(0, 16)}...`);
    } else {
      result.checksumMatch = true;
    }

    // Verify structure
    if (data.length > 0) {
      const firstRecord = data[0];
      if (typeof firstRecord !== 'object' || firstRecord === null) {
        result.errors.push('Invalid data structure: records must be objects');
      } else if (!firstRecord.id) {
        result.errors.push('Invalid data structure: missing id field');
      } else {
        result.structureValid = true;
      }
    } else {
      result.structureValid = true; // Empty tables are valid
    }

    // Verify foreign keys (basic check)
    result.foreignKeysValid = true; // Will be checked after all tables loaded

  } catch (error: any) {
    result.errors.push(`Verification failed: ${error.message}`);
  }

  return result;
}

/**
 * Verify foreign key references
 */
function verifyForeignKeys(allData: Map<string, any[]>): string[] {
  const errors: string[] = [];

  // Helper to check if ID exists in table
  const idExists = (tableName: string, id: string | null): boolean => {
    if (!id) return true; // Nullable foreign keys
    const table = allData.get(tableName);
    if (!table) return false;
    return table.some(record => record.id === id);
  };

  // UserOrganizations
  const userOrgs = allData.get('user_organizations') || [];
  for (const record of userOrgs) {
    if (!idExists('users', record.userId)) {
      errors.push(`user_organizations: userId '${record.userId}' not found in users table`);
    }
    if (!idExists('organizations', record.organizationId)) {
      errors.push(`user_organizations: organizationId '${record.organizationId}' not found in organizations table`);
    }
  }

  // OrganizationAiConfigs
  const orgAiConfigs = allData.get('organization_ai_configs') || [];
  for (const record of orgAiConfigs) {
    if (!idExists('organizations', record.organizationId)) {
      errors.push(`organization_ai_configs: organizationId '${record.organizationId}' not found in organizations table`);
    }
  }

  // AiUsageLogs
  const aiUsageLogs = allData.get('ai_usage_logs') || [];
  for (const record of aiUsageLogs) {
    if (!idExists('users', record.userId)) {
      errors.push(`ai_usage_logs: userId '${record.userId}' not found in users table`);
    }
  }

  // ApiConfigurations (nullable organizationId)
  const apiConfigs = allData.get('api_configurations') || [];
  for (const record of apiConfigs) {
    if (record.organizationId && !idExists('organizations', record.organizationId)) {
      errors.push(`api_configurations: organizationId '${record.organizationId}' not found in organizations table`);
    }
  }

  // OrganizationApiCredentials
  const orgApiCreds = allData.get('organization_api_credentials') || [];
  for (const record of orgApiCreds) {
    if (!idExists('organizations', record.organizationId)) {
      errors.push(`organization_api_credentials: organizationId '${record.organizationId}' not found in organizations table`);
    }
    if (!idExists('api_configurations', record.apiConfigurationId)) {
      errors.push(`organization_api_credentials: apiConfigurationId '${record.apiConfigurationId}' not found in api_configurations table`);
    }
  }

  // DataSourceMappings
  const dataSourceMappings = allData.get('data_source_mappings') || [];
  for (const record of dataSourceMappings) {
    if (!idExists('api_configurations', record.apiConfigId)) {
      errors.push(`data_source_mappings: apiConfigId '${record.apiConfigId}' not found in api_configurations table`);
    }
  }

  // FieldConfigurations (nullable organizationId)
  const fieldConfigs = allData.get('field_configurations') || [];
  for (const record of fieldConfigs) {
    if (record.organizationId && !idExists('organizations', record.organizationId)) {
      errors.push(`field_configurations: organizationId '${record.organizationId}' not found in organizations table`);
    }
  }

  // PfaRecords
  const pfaRecords = allData.get('pfa_records') || [];
  for (const record of pfaRecords) {
    if (!idExists('organizations', record.organizationId)) {
      errors.push(`pfa_records: organizationId '${record.organizationId}' not found in organizations table`);
    }
  }

  return errors;
}

/**
 * Main verification
 */
async function verifyExport(exportDir: string): Promise<void> {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  Export Data Verification                                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  try {
    // Load manifest
    console.log(`\n📂 Loading export from: ${exportDir}`);
    const manifest = loadManifest(exportDir);
    console.log(`   ✓ Manifest loaded (${manifest.tables.length} tables)`);
    console.log(`   ✓ Export date: ${manifest.exportedAt}`);
    console.log(`   ✓ Total records: ${manifest.totalRecords.toLocaleString()}`);
    console.log(`   ✓ Overall checksum: ${manifest.overallChecksum.substring(0, 16)}...`);

    // Verify each table
    console.log('\n📊 Verifying tables...\n');
    const allData = new Map<string, any[]>();
    const results: VerificationResult[] = [];

    for (const tableInfo of manifest.tables) {
      const result = verifyTable(exportDir, tableInfo, allData);
      results.push(result);

      const status = result.errors.length === 0 ? '✅' : '❌';
      console.log(`${status} ${result.tableName} (${tableInfo.rowCount} records)`);
      if (result.errors.length > 0) {
        result.errors.forEach(err => console.log(`   ⚠️  ${err}`));
      }
    }

    // Verify foreign keys
    console.log('\n🔗 Verifying foreign key references...');
    const fkErrors = verifyForeignKeys(allData);
    if (fkErrors.length > 0) {
      console.log('   ❌ Foreign key violations found:');
      fkErrors.slice(0, 10).forEach(err => console.log(`   ⚠️  ${err}`));
      if (fkErrors.length > 10) {
        console.log(`   ... and ${fkErrors.length - 10} more errors`);
      }
    } else {
      console.log('   ✅ All foreign key references valid');
    }

    // Summary
    const allValid = results.every(r => r.errors.length === 0) && fkErrors.length === 0;

    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  Verification Summary                                         ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`Status:             ${allValid ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Tables Verified:    ${results.length}`);
    console.log(`Tables Passed:      ${results.filter(r => r.errors.length === 0).length}`);
    console.log(`Tables Failed:      ${results.filter(r => r.errors.length > 0).length}`);
    console.log(`FK Violations:      ${fkErrors.length}`);
    console.log('');

    if (allValid) {
      console.log('✅ Export data is valid and ready for import!');
      console.log('\n📋 Next Steps:');
      console.log('   1. Setup PostgreSQL database');
      console.log('   2. Update DATABASE_URL in .env');
      console.log('   3. Run: npx prisma migrate deploy');
      console.log(`   4. Run: npx tsx scripts/migration/import-to-postgresql.ts ${exportDir}`);
    } else {
      console.log('❌ Export data has errors. Please fix and re-export.');
      process.exit(1);
    }

  } catch (error: any) {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const exportDir = process.argv[2];

  if (!exportDir) {
    console.error('❌ Usage: npx tsx scripts/migration/verify-export.ts <export-directory>');
    process.exit(1);
  }

  if (!fs.existsSync(exportDir)) {
    console.error(`❌ Export directory not found: ${exportDir}`);
    process.exit(1);
  }

  await verifyExport(exportDir);
}

main();
