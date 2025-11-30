import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function fixPfaWriteEndpoint() {
  try {
    // The PFA Write endpoint needs a different base path
    // Original: /axis/restservices/UserDefinedScreenService
    // Correct: /axis/services/UserDefinedScreenService

    // Option 1: Create a separate server for SOAP services
    // Option 2: Update the endpoint path to include the full path override

    // Let's check if there's a SOAP server already
    const soapServer = await prisma.api_servers.findFirst({
      where: {
        name: 'PEMS_SOAP'
      }
    });

    if (soapServer) {
      console.log('PEMS_SOAP server already exists');
    } else {
      // Get the PEMS_DEV server to copy its settings
      const restServer = await prisma.api_servers.findFirst({
        where: { name: 'PEMS_DEV' }
      });

      if (!restServer) {
        console.error('PEMS_DEV server not found');
        return;
      }

      // Create PEMS_SOAP server
      const newServer = await prisma.api_servers.create({
        data: {
          id: randomUUID(),
          organizationId: restServer.organizationId,
          name: 'PEMS_SOAP',
          baseUrl: 'https://us1.eam.hxgnsmartcloud.com:443/axis/services',
          description: 'PEMS SOAP services for write operations',
          authType: restServer.authType,
          authKeyEncrypted: restServer.authKeyEncrypted,
          authValueEncrypted: restServer.authValueEncrypted,
          commonHeaders: restServer.commonHeaders,
          healthStatus: 'untested',
          healthScore: 0,
          totalEndpoints: 0,
          healthyEndpoints: 0,
          degradedEndpoints: 0,
          downEndpoints: 0,
          status: 'active',
          isActive: true,
          updatedAt: new Date(),
        }
      });

      console.log(`✓ Created PEMS_SOAP server (${newServer.id})`);

      // Move PFA Write endpoint to the new server
      const writeEndpoint = await prisma.api_endpoints.findFirst({
        where: {
          name: 'PFA Write'
        }
      });

      if (writeEndpoint) {
        await prisma.api_endpoints.update({
          where: { id: writeEndpoint.id },
          data: {
            serverId: newServer.id
          }
        });

        console.log(`✓ Moved PFA Write endpoint to PEMS_SOAP server`);
      }
    }

    console.log('\nFixed PFA Write endpoint configuration');

  } catch (error: any) {
    console.error('Fix failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

fixPfaWriteEndpoint();
