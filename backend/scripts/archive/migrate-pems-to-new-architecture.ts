/**
 * @file migrate-pems-to-new-architecture.ts
 * @description Migrates PEMS configurations from api_configurations to api_servers/api_endpoints
 * Run: npx tsx backend/scripts/migrate-pems-to-new-architecture.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  console.log('\n🔄 Migrating PEMS configurations to new architecture...\n');

  try {
    // Get first organization (RIO)
    const firstOrg = await prisma.organizations.findFirst({
      orderBy: { createdAt: 'asc' }
    });

    if (!firstOrg) {
      throw new Error('No organizations found in database. Run seed script first.');
    }

    console.log(`Using organization: ${firstOrg.name} (${firstOrg.code})`);

    // Get all PEMS configurations from api_configurations
    const pemsConfigs = await prisma.api_configurations.findMany({
      where: {
        usage: 'pems'
      }
    });

    console.log(`Found ${pemsConfigs.length} PEMS configurations to migrate`);

    if (pemsConfigs.length === 0) {
      console.log('\n⚠️  No PEMS configurations found.');
      console.log('   Run "npm run prisma:seed" first to create API configurations');
      return;
    }

    // Create PEMS server (if it doesn't exist)
    let pemsServer = await prisma.api_servers.findFirst({
      where: {
        name: 'PEMS_DEV',
        organizationId: firstOrg.id
      }
    });

    if (!pemsServer) {
      console.log('\n📡 Creating PEMS server...');

      // Get credentials and common headers from the first PEMS config
      const firstConfig = pemsConfigs[0];

      pemsServer = await prisma.api_servers.create({
        data: {
          name: 'PEMS_DEV',
          baseUrl: 'https://us1.eam.hxgnsmartcloud.com:443/axis/restservices',
          description: 'PEMS Development Server (HxGN EAM)',
          authType: firstConfig.authType,
          authKeyEncrypted: firstConfig.authKeyEncrypted,
          authValueEncrypted: firstConfig.authValueEncrypted,
          commonHeaders: firstConfig.customHeaders, // Tenant is stored here
          status: 'active',
          isActive: true,
          organizationId: firstOrg.id,
          healthStatus: 'unknown',
          healthScore: 0
        }
      });

      console.log(`✓ Created PEMS server: ${pemsServer.id}`);
    } else {
      console.log(`✓ PEMS server already exists: ${pemsServer.id}`);
    }

    // Create endpoints for each configuration
    console.log('\n📌 Creating endpoints...');
    let created = 0;
    let skipped = 0;

    for (const config of pemsConfigs) {
      // Parse path from URL
      const urlObj = new URL(config.url);
      const path = urlObj.pathname;

      // Check if endpoint already exists
      const existing = await prisma.api_endpoints.findFirst({
        where: {
          serverId: pemsServer.id,
          path: path
        }
      });

      if (existing) {
        console.log(`  ⊝ Skipped: ${config.name} (already exists)`);
        skipped++;
        continue;
      }

      // Determine entity and operation type from name
      let entity = 'pfa';
      let operationType = 'read';

      if (config.name.includes('PFA Read') || config.name.includes('griddata')) {
        entity = 'pfa';
        operationType = 'read';
      } else if (config.name.includes('PFA Write')) {
        entity = 'pfa';
        operationType = 'write';
      } else if (config.name.includes('Assets')) {
        entity = 'asset_master';
        operationType = 'read';
      } else if (config.name.includes('Classes')) {
        entity = 'classifications';
        operationType = 'read';
      } else if (config.name.includes('Organizations')) {
        entity = 'organizations';
        operationType = 'read';
      } else if (config.name.includes('User Sync')) {
        entity = 'users';
        operationType = 'read';
      } else if (config.name.includes('Manufacturers')) {
        entity = 'manufacturers';
        operationType = 'read';
      }

      // Parse feeds to get custom headers (gridCode, gridID)
      let customHeaders: any = {};
      if (config.feeds) {
        try {
          const feeds = JSON.parse(config.feeds);
          if (Array.isArray(feeds) && feeds[0]) {
            const feed = feeds[0];
            // Extract gridCode and gridID if present
            if (config.name.includes('griddata')) {
              customHeaders = {
                gridCode: 'CUPFAG',
                gridID: '100541'
              };
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      // Create endpoint
      const endpoint = await prisma.api_endpoints.create({
        data: {
          serverId: pemsServer.id,
          name: config.name,
          path: path,
          description: `Migrated from api_configurations (${config.id})`,
          entity: entity,
          operationType: operationType,
          method: operationType === 'write' ? 'POST' : 'GET',
          customHeaders: Object.keys(customHeaders).length > 0 ? JSON.stringify(customHeaders) : null,
          timeoutMs: 30000,
          isActive: true,
          status: 'active',
          testCount: 0,
          successCount: 0,
          failureCount: 0
        }
      });

      console.log(`  ✓ Created: ${config.name} → ${path} (${entity}:${operationType})`);
      created++;
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Created: ${created} endpoints`);
    console.log(`   Skipped: ${skipped} endpoints (already existed)`);
    console.log(`\n📋 Server: ${pemsServer.name} (${pemsServer.id})`);
    console.log(`   Endpoints: ${created + skipped} total`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
