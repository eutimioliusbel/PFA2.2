/**
 * @file migrate-to-two-tier-api.ts
 * @description Migration script to convert ApiConfiguration records to ApiServer + ApiEndpoint architecture
 *
 * @usage npx tsx scripts/migrations/migrate-to-two-tier-api.ts [--dry-run] [--org=ORG_CODE]
 *
 * @example
 * # Dry run to see what would be created
 * npx tsx scripts/migrations/migrate-to-two-tier-api.ts --dry-run
 *
 * # Migrate specific organization
 * npx tsx scripts/migrations/migrate-to-two-tier-api.ts --org=BECHTEL_DEV
 *
 * # Migrate all organizations
 * npx tsx scripts/migrations/migrate-to-two-tier-api.ts
 */

import { PrismaClient } from '@prisma/client';
import { encryptionService } from '../../src/services/encryptionService';

const prisma = new PrismaClient();

interface MigrationResult {
  organizationCode: string;
  serverCreated: boolean;
  serverId?: string;
  serverName?: string;
  endpointsCreated: number;
  endpoints: Array<{
    name: string;
    path: string;
    entity: string;
  }>;
  dataSourceMappingsUpdated: number;
  errors: string[];
}

/**
 * Extract base URL from full API endpoint URL
 * Example: "https://pems.example.com:443/axis/restservices/assets" → "https://pems.example.com:443/axis/restservices"
 */
function extractBaseUrl(fullUrl: string): string {
  try {
    const url = new URL(fullUrl);
    const pathParts = url.pathname.split('/').filter(p => p);
    // Remove last segment (endpoint path like 'assets', 'users')
    const basePath = pathParts.slice(0, -1).join('/');
    return `${url.origin}/${basePath}`;
  } catch (error) {
    console.error(`Failed to parse URL: ${fullUrl}`, error);
    return fullUrl;
  }
}

/**
 * Extract endpoint path from full URL
 * Example: "https://pems.example.com:443/axis/restservices/assets" → "/assets"
 */
function extractEndpointPath(fullUrl: string): string {
  try {
    const url = new URL(fullUrl);
    const pathParts = url.pathname.split('/').filter(p => p);
    return `/${pathParts[pathParts.length - 1]}`; // Last segment
  } catch (error) {
    console.error(`Failed to parse URL: ${fullUrl}`, error);
    return '/unknown';
  }
}

/**
 * Map ApiConfiguration.usage to entity type and friendly name
 */
function mapUsageToEntity(usage: string): { entity: string; name: string } {
  const mapping: Record<string, { entity: string; name: string }> = {
    'PEMS_ASSETS': { entity: 'asset_master', name: 'Assets' },
    'PEMS_CLASSES': { entity: 'classifications', name: 'Categories & Classes' },
    'PEMS_MANUFACTURERS': { entity: 'manufacturers', name: 'Manufacturers' },
    'PEMS_ORGANIZATIONS': { entity: 'organizations', name: 'Organizations' },
    'PEMS_PFA_READ': { entity: 'pfa', name: 'PFA Read' },
    'PEMS_PFA_WRITE': { entity: 'pfa', name: 'PFA Write' },
    'PEMS_USER_SYNC': { entity: 'users', name: 'Users' }
  };

  return mapping[usage] || { entity: 'unknown', name: usage };
}

/**
 * Parse custom headers JSON string to extract common headers
 */
function parseCustomHeaders(headersJson: string | null): Record<string, string> {
  if (!headersJson) return {};

  try {
    const headers = JSON.parse(headersJson);
    if (Array.isArray(headers)) {
      // Convert [{"key": "x", "value": "y"}] to {"x": "y"}
      return headers.reduce((acc, h) => {
        if (h.key && h.value !== undefined) {
          acc[h.key] = h.value;
        }
        return acc;
      }, {} as Record<string, string>);
    }
    return headers;
  } catch (error) {
    console.error('Failed to parse custom headers:', error);
    return {};
  }
}

/**
 * Main migration function
 */
async function migrateToTwoTierApi(dryRun: boolean = false, targetOrg?: string): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  try {
    // Get all organizations with PEMS API configurations
    const orgsQuery = targetOrg
      ? { where: { code: targetOrg } }
      : {};

    const organizations = await prisma.organization.findMany({
      ...orgsQuery,
      include: {
        apiConfigs: {
          where: {
            usage: {
              startsWith: 'PEMS_'
            }
          },
          orderBy: {
            usage: 'asc'
          }
        }
      }
    });

    console.log(`\n📊 Found ${organizations.length} organization(s) with PEMS API configurations\n`);

    for (const org of organizations) {
      const result: MigrationResult = {
        organizationCode: org.code,
        serverCreated: false,
        endpointsCreated: 0,
        endpoints: [],
        dataSourceMappingsUpdated: 0,
        errors: []
      };

      if (org.apiConfigs.length === 0) {
        console.log(`⏭️  Skipping ${org.code}: No PEMS API configurations found`);
        continue;
      }

      console.log(`\n🏢 Processing Organization: ${org.name} (${org.code})`);
      console.log(`   Found ${org.apiConfigs.length} PEMS API configuration(s)`);

      // Use first config to extract server-level details
      const firstConfig = org.apiConfigs[0];
      const baseUrl = extractBaseUrl(firstConfig.url);

      // Parse common headers from first config
      const commonHeaders = parseCustomHeaders(firstConfig.customHeaders);

      console.log(`\n📡 Server Details:`);
      console.log(`   Base URL: ${baseUrl}`);
      console.log(`   Auth Type: ${firstConfig.authType}`);
      console.log(`   Common Headers: ${Object.keys(commonHeaders).length} header(s)`);

      let serverId: string;

      if (!dryRun) {
        // Create ApiServer
        try {
          const server = await prisma.apiServer.create({
            data: {
              organizationId: org.id,
              name: 'PEMS Production',
              baseUrl: baseUrl,
              description: `Migrated from ${org.apiConfigs.length} API configurations`,
              authType: firstConfig.authType,
              authKeyEncrypted: firstConfig.authKeyEncrypted,
              authValueEncrypted: firstConfig.authValueEncrypted,
              commonHeaders: Object.keys(commonHeaders).length > 0
                ? JSON.stringify(commonHeaders)
                : null,
              status: firstConfig.status,
              isActive: true
            }
          });

          serverId = server.id;
          result.serverCreated = true;
          result.serverId = serverId;
          result.serverName = server.name;

          console.log(`\n✅ Created ApiServer: ${server.name} (ID: ${serverId})`);
        } catch (error: any) {
          const errorMsg = `Failed to create ApiServer: ${error.message}`;
          result.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
          results.push(result);
          continue;
        }
      } else {
        serverId = 'dry-run-server-id';
        result.serverCreated = true;
        result.serverName = 'PEMS Production';
        console.log(`\n✅ [DRY RUN] Would create ApiServer: PEMS Production`);
      }

      // Create ApiEndpoint for each config
      console.log(`\n🔗 Creating Endpoints:`);

      for (const config of org.apiConfigs) {
        const endpointPath = extractEndpointPath(config.url);
        const { entity, name } = mapUsageToEntity(config.usage);

        console.log(`\n   📍 ${name}`);
        console.log(`      Path: ${endpointPath}`);
        console.log(`      Entity: ${entity}`);
        console.log(`      Operation: ${config.operationType}`);

        if (!dryRun) {
          try {
            const endpoint = await prisma.apiEndpoint.create({
              data: {
                serverId: serverId,
                name: name,
                path: endpointPath,
                description: `Migrated from ${config.usage}`,
                entity: entity,
                operationType: config.operationType,
                status: config.status,
                isActive: true,
                // Preserve test metadata if available
                firstTestedAt: config.firstSyncAt || undefined,
                lastTestedAt: config.lastSyncAt || undefined
              }
            });

            result.endpointsCreated++;
            result.endpoints.push({
              name: endpoint.name,
              path: endpoint.path,
              entity: endpoint.entity
            });

            console.log(`      ✅ Created endpoint (ID: ${endpoint.id})`);

            // Update DataSourceMapping to point to new endpoint
            const mappingsUpdated = await prisma.dataSourceMapping.updateMany({
              where: {
                apiConfigId: config.id,
                entityType: entity
              },
              data: {
                apiEndpointId: endpoint.id
              }
            });

            if (mappingsUpdated.count > 0) {
              result.dataSourceMappingsUpdated += mappingsUpdated.count;
              console.log(`      ✅ Updated ${mappingsUpdated.count} DataSourceMapping record(s)`);
            }
          } catch (error: any) {
            const errorMsg = `Failed to create endpoint ${name}: ${error.message}`;
            result.errors.push(errorMsg);
            console.error(`      ❌ ${errorMsg}`);
          }
        } else {
          result.endpointsCreated++;
          result.endpoints.push({
            name: name,
            path: endpointPath,
            entity: entity
          });
          console.log(`      ✅ [DRY RUN] Would create endpoint`);
        }
      }

      results.push(result);
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }

  return results;
}

/**
 * Print migration summary
 */
function printSummary(results: MigrationResult[], dryRun: boolean) {
  console.log('\n' + '='.repeat(80));
  console.log(`📊 MIGRATION SUMMARY ${dryRun ? '(DRY RUN)' : ''}`);
  console.log('='.repeat(80));

  const totalServers = results.filter(r => r.serverCreated).length;
  const totalEndpoints = results.reduce((sum, r) => sum + r.endpointsCreated, 0);
  const totalMappings = results.reduce((sum, r) => sum + r.dataSourceMappingsUpdated, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  console.log(`\n✅ API Servers Created: ${totalServers}`);
  console.log(`✅ API Endpoints Created: ${totalEndpoints}`);
  console.log(`✅ DataSourceMappings Updated: ${totalMappings}`);

  if (totalErrors > 0) {
    console.log(`\n❌ Errors Encountered: ${totalErrors}`);
    results.forEach(r => {
      if (r.errors.length > 0) {
        console.log(`\n   ${r.organizationCode}:`);
        r.errors.forEach(err => console.log(`      - ${err}`));
      }
    });
  }

  console.log('\n' + '='.repeat(80));

  if (dryRun) {
    console.log('\n💡 This was a dry run. No changes were made to the database.');
    console.log('💡 Run without --dry-run to apply the migration.');
  } else {
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Verify new ApiServer and ApiEndpoint records in database');
    console.log('   2. Test endpoints via Admin → API Connectivity UI');
    console.log('   3. Update frontend DataSourceMappings UI to use ApiEndpoint');
    console.log('   4. After verification, optionally archive old ApiConfiguration records');
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const orgArg = args.find(a => a.startsWith('--org='));
  const targetOrg = orgArg ? orgArg.split('=')[1] : undefined;

  console.log('\n🚀 Starting API Architecture Migration');
  console.log('📝 Converting ApiConfiguration → ApiServer + ApiEndpoint\n');

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE: No changes will be made to the database\n');
  }

  if (targetOrg) {
    console.log(`🎯 Target Organization: ${targetOrg}\n`);
  }

  const startTime = Date.now();

  try {
    const results = await migrateToTwoTierApi(dryRun, targetOrg);

    const duration = Date.now() - startTime;

    printSummary(results, dryRun);

    console.log(`\n⏱️  Migration completed in ${duration}ms\n`);
  } catch (error) {
    console.error('\n❌ Fatal error during migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

export { migrateToTwoTierApi, MigrationResult };
