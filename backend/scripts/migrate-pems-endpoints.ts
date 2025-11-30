import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function migrateEndpoints() {
  try {
    // Get the existing PEMS server
    const server = await prisma.api_servers.findFirst({
      where: { name: 'PEMS_DEV' }
    });

    if (!server) {
      console.error('PEMS_DEV server not found');
      return;
    }

    console.log(`Using server: ${server.name} (${server.id})\n`);

    // Define endpoints to create based on API Configuration setup
    const endpointsToCreate = [
      {
        name: 'Organizations',
        path: '/organization',
        entity: 'organizations',
        operationType: 'read',
        description: 'Fetch organization data from PEMS',
        customHeaders: JSON.stringify({ gridCode: 'CUPFAG', gridID: '100541' })
      },
      {
        name: 'User Sync',
        path: '/usersetup',
        entity: 'users',
        operationType: 'read',
        description: 'Fetch user setup data from PEMS',
        customHeaders: JSON.stringify({ gridCode: 'CUPFAG', gridID: '100541' })
      },
      {
        name: 'Manufacturers',
        path: '/manufacturers',
        entity: 'manufacturers',
        operationType: 'read',
        description: 'Fetch manufacturer data from PEMS',
        customHeaders: JSON.stringify({ gridCode: 'CUPFAG', gridID: '100541' })
      },
      {
        name: 'Asset Master',
        path: '/assets',
        entity: 'asset_master',
        operationType: 'read',
        description: 'Fetch asset master data from PEMS',
        customHeaders: JSON.stringify({ gridCode: 'CUPFAG', gridID: '100541' })
      },
      {
        name: 'Classes & Categories',
        path: '/categories',
        entity: 'classifications',
        operationType: 'read',
        description: 'Fetch classification data from PEMS',
        customHeaders: JSON.stringify({ gridCode: 'CUPFAG', gridID: '100541' })
      },
      {
        name: 'PFA Write',
        path: '/UserDefinedScreenService',
        entity: 'pfa',
        operationType: 'write',
        description: 'Write PFA data updates to PEMS',
        customHeaders: JSON.stringify({ gridCode: 'CUPFAG', gridID: '100541' })
      }
    ];

    console.log(`Creating ${endpointsToCreate.length} endpoints...\n`);

    for (const endpointData of endpointsToCreate) {
      // Check if endpoint already exists
      const existing = await prisma.api_endpoints.findFirst({
        where: {
          serverId: server.id,
          name: endpointData.name
        }
      });

      if (existing) {
        console.log(`✓ Endpoint "${endpointData.name}" already exists (${existing.id})`);
        continue;
      }

      // Create the endpoint
      const endpoint = await prisma.api_endpoints.create({
        data: {
          id: randomUUID(),
          serverId: server.id,
          name: endpointData.name,
          path: endpointData.path,
          entity: endpointData.entity,
          operationType: endpointData.operationType,
          description: endpointData.description,
          customHeaders: endpointData.customHeaders,
          status: 'untested',
          timeoutMs: 30000,
          retryAttempts: 3,
          isActive: true,
          updatedAt: new Date(),
        }
      });

      console.log(`✓ Created endpoint: ${endpoint.name} (${endpoint.id})`);
      console.log(`  Path: ${endpoint.path}`);
      console.log(`  Entity: ${endpoint.entity}`);
      console.log(`  Operation: ${endpoint.operationType}\n`);
    }

    console.log('Migration completed successfully!');

  } catch (error: any) {
    console.error('Migration failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

migrateEndpoints();
