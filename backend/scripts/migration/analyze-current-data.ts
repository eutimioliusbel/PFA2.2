/**
 * @file analyze-current-data.ts
 * @description Analyzes current SQLite database content before migration
 * @usage npx tsx scripts/migration/analyze-current-data.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface TableAnalysis {
  tableName: string;
  rowCount: number;
  sampleData?: any;
  foreignKeys: string[];
  indexes: string[];
}

interface DatabaseAnalysis {
  timestamp: string;
  databaseSize: string;
  tables: TableAnalysis[];
  totalRecords: number;
  foreignKeyRelationships: string[];
  warnings: string[];
}

async function analyzeTables(): Promise<TableAnalysis[]> {
  const analyses: TableAnalysis[] = [];

  console.log('\n📊 Analyzing Database Tables...\n');

  // Users
  const userCount = await prisma.user.count();
  const sampleUser = await prisma.user.findFirst();
  console.log(`✓ Users: ${userCount} records`);
  analyses.push({
    tableName: 'users',
    rowCount: userCount,
    sampleData: sampleUser ? { id: sampleUser.id, username: sampleUser.username } : null,
    foreignKeys: [],
    indexes: ['username', 'email']
  });

  // Organizations
  const orgCount = await prisma.organization.count();
  const sampleOrg = await prisma.organization.findFirst();
  console.log(`✓ Organizations: ${orgCount} records`);
  analyses.push({
    tableName: 'organizations',
    rowCount: orgCount,
    sampleData: sampleOrg ? { id: sampleOrg.id, code: sampleOrg.code, name: sampleOrg.name } : null,
    foreignKeys: [],
    indexes: ['code']
  });

  // UserOrganizations (junction table)
  const userOrgCount = await prisma.userOrganization.count();
  console.log(`✓ UserOrganizations: ${userOrgCount} records`);
  analyses.push({
    tableName: 'user_organizations',
    rowCount: userOrgCount,
    sampleData: null,
    foreignKeys: ['userId -> users.id', 'organizationId -> organizations.id'],
    indexes: ['userId, organizationId (unique)']
  });

  // AiProviders
  const aiProviderCount = await prisma.aiProvider.count();
  const sampleProvider = await prisma.aiProvider.findFirst();
  console.log(`✓ AiProviders: ${aiProviderCount} records`);
  analyses.push({
    tableName: 'ai_providers',
    rowCount: aiProviderCount,
    sampleData: sampleProvider ? { id: sampleProvider.id, type: sampleProvider.type, name: sampleProvider.name } : null,
    foreignKeys: [],
    indexes: []
  });

  // OrganizationAiConfig
  const orgAiConfigCount = await prisma.organizationAiConfig.count();
  console.log(`✓ OrganizationAiConfigs: ${orgAiConfigCount} records`);
  analyses.push({
    tableName: 'organization_ai_configs',
    rowCount: orgAiConfigCount,
    sampleData: null,
    foreignKeys: ['organizationId -> organizations.id (unique)'],
    indexes: ['organizationId']
  });

  // AiUsageLogs
  const aiUsageCount = await prisma.aiUsageLog.count();
  console.log(`✓ AiUsageLogs: ${aiUsageCount} records`);
  analyses.push({
    tableName: 'ai_usage_logs',
    rowCount: aiUsageCount,
    sampleData: null,
    foreignKeys: ['userId -> users.id'],
    indexes: ['organizationId, createdAt', 'userId, createdAt', 'queryHash']
  });

  // ApiConfigurations
  const apiConfigCount = await prisma.apiConfiguration.count();
  const sampleApiConfig = await prisma.apiConfiguration.findFirst();
  console.log(`✓ ApiConfigurations: ${apiConfigCount} records`);
  analyses.push({
    tableName: 'api_configurations',
    rowCount: apiConfigCount,
    sampleData: sampleApiConfig ? {
      id: sampleApiConfig.id,
      name: sampleApiConfig.name,
      usage: sampleApiConfig.usage,
      organizationId: sampleApiConfig.organizationId
    } : null,
    foreignKeys: ['organizationId -> organizations.id (nullable)'],
    indexes: ['organizationId, usage']
  });

  // OrganizationApiCredentials
  const orgApiCredCount = await prisma.organizationApiCredentials.count();
  console.log(`✓ OrganizationApiCredentials: ${orgApiCredCount} records`);
  analyses.push({
    tableName: 'organization_api_credentials',
    rowCount: orgApiCredCount,
    sampleData: null,
    foreignKeys: [
      'organizationId -> organizations.id',
      'apiConfigurationId -> api_configurations.id'
    ],
    indexes: ['organizationId', 'apiConfigurationId', 'organizationId, apiConfigurationId (unique)']
  });

  // DataSourceMappings
  const dataSourceCount = await prisma.dataSourceMapping.count();
  console.log(`✓ DataSourceMappings: ${dataSourceCount} records`);
  analyses.push({
    tableName: 'data_source_mappings',
    rowCount: dataSourceCount,
    sampleData: null,
    foreignKeys: ['apiConfigId -> api_configurations.id'],
    indexes: ['entityType, organizationId, priority (unique)', 'entityType, isActive, priority', 'apiConfigId']
  });

  // FieldConfigurations
  const fieldConfigCount = await prisma.fieldConfiguration.count();
  console.log(`✓ FieldConfigurations: ${fieldConfigCount} records`);
  analyses.push({
    tableName: 'field_configurations',
    rowCount: fieldConfigCount,
    sampleData: null,
    foreignKeys: ['organizationId -> organizations.id (nullable)'],
    indexes: ['organizationId']
  });

  // PfaRecords
  const pfaCount = await prisma.pfaRecord.count();
  const samplePfa = await prisma.pfaRecord.findFirst();
  console.log(`✓ PfaRecords: ${pfaCount} records`);
  analyses.push({
    tableName: 'pfa_records',
    rowCount: pfaCount,
    sampleData: samplePfa ? {
      id: samplePfa.id,
      pfaId: samplePfa.pfaId,
      organizationId: samplePfa.organizationId,
      syncState: samplePfa.syncState
    } : null,
    foreignKeys: ['organizationId -> organizations.id'],
    indexes: [
      'organizationId',
      'updatedAt',
      'organizationId, syncState',
      'organizationId, modifiedAt',
      'organizationId, pfaId (unique)'
    ]
  });

  // SyncLogs
  const syncLogCount = await prisma.syncLog.count();
  console.log(`✓ SyncLogs: ${syncLogCount} records`);
  analyses.push({
    tableName: 'sync_logs',
    rowCount: syncLogCount,
    sampleData: null,
    foreignKeys: [],
    indexes: ['organizationId, createdAt']
  });

  return analyses;
}

function identifyDependencies(analyses: TableAnalysis[]): string[] {
  const dependencies: string[] = [];

  // Define migration order based on foreign keys
  dependencies.push('Migration Order (respecting foreign keys):');
  dependencies.push('1. users (no dependencies)');
  dependencies.push('2. organizations (no dependencies)');
  dependencies.push('3. user_organizations (depends on: users, organizations)');
  dependencies.push('4. ai_providers (no dependencies)');
  dependencies.push('5. organization_ai_configs (depends on: organizations)');
  dependencies.push('6. ai_usage_logs (depends on: users)');
  dependencies.push('7. api_configurations (depends on: organizations - nullable)');
  dependencies.push('8. organization_api_credentials (depends on: organizations, api_configurations)');
  dependencies.push('9. data_source_mappings (depends on: api_configurations)');
  dependencies.push('10. field_configurations (depends on: organizations - nullable)');
  dependencies.push('11. pfa_records (depends on: organizations)');
  dependencies.push('12. sync_logs (no dependencies)');

  return dependencies;
}

function identifyWarnings(analyses: TableAnalysis[]): string[] {
  const warnings: string[] = [];

  // Check for potential issues
  const pfaTable = analyses.find(a => a.tableName === 'pfa_records');
  if (pfaTable && pfaTable.rowCount > 10000) {
    warnings.push(`⚠️  Large PFA dataset (${pfaTable.rowCount} records) - Consider batch processing`);
  }

  const aiUsageTable = analyses.find(a => a.tableName === 'ai_usage_logs');
  if (aiUsageTable && aiUsageTable.rowCount > 1000) {
    warnings.push(`⚠️  Large AI usage log dataset (${aiUsageTable.rowCount} records) - May take time to migrate`);
  }

  // Check for encrypted fields
  warnings.push('⚠️  Encrypted fields detected (apiKeyEncrypted, authKeyEncrypted, authValueEncrypted)');
  warnings.push('    → Verify encryption keys are consistent between SQLite and PostgreSQL environments');

  // Check for JSON fields
  warnings.push('⚠️  JSON string fields detected (availableModels, routingRules, customHeaders, fieldMappings, modifiedFields)');
  warnings.push('    → SQLite stores as TEXT, PostgreSQL can use native JSON type (current schema uses String)');

  return warnings;
}

async function main(): Promise<void> {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  SQLite Database Pre-Migration Analysis                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  try {
    // Get database file size
    const dbPath = path.join(__dirname, '../../prisma/dev.db');
    let dbSize = 'N/A';
    try {
      const stats = fs.statSync(dbPath);
      dbSize = `${(stats.size / 1024).toFixed(2)} KB`;
    } catch (err) {
      dbSize = 'Unable to read file size';
    }

    console.log(`\n📁 Database File: ${dbPath}`);
    console.log(`📏 Database Size: ${dbSize}`);

    // Analyze all tables
    const analyses = await analyzeTables();
    const totalRecords = analyses.reduce((sum, a) => sum + a.rowCount, 0);

    console.log(`\n📈 Total Records Across All Tables: ${totalRecords.toLocaleString()}`);

    // Identify dependencies
    const dependencies = identifyDependencies(analyses);
    console.log('\n🔗 Foreign Key Relationships & Migration Order:\n');
    dependencies.forEach(dep => console.log(`   ${dep}`));

    // Identify warnings
    const warnings = identifyWarnings(analyses);
    if (warnings.length > 0) {
      console.log('\n⚠️  Warnings & Considerations:\n');
      warnings.forEach(warning => console.log(`   ${warning}`));
    }

    // Build analysis report
    const analysis: DatabaseAnalysis = {
      timestamp: new Date().toISOString(),
      databaseSize: dbSize,
      tables: analyses,
      totalRecords,
      foreignKeyRelationships: dependencies,
      warnings
    };

    // Save analysis to file
    const outputPath = path.join(__dirname, 'pre-migration-analysis.json');
    fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2));

    console.log(`\n✅ Analysis complete!`);
    console.log(`📄 Full report saved to: ${outputPath}\n`);

    // Print summary
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  Summary                                                      ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`Database Size:     ${dbSize}`);
    console.log(`Total Tables:      ${analyses.length}`);
    console.log(`Total Records:     ${totalRecords.toLocaleString()}`);
    console.log(`Warnings:          ${warnings.length}`);
    console.log('');

  } catch (error: any) {
    console.error('\n❌ Analysis failed:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
