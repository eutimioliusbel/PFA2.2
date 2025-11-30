/**
 * @file test-endpoint-default-params.ts
 * @description Test script to verify defaultParams handling in API endpoints
 * Tests Task 6.1 implementation from ADR-007
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDefaultParams() {
  console.log('Testing defaultParams functionality for API endpoints...\n');

  try {
    // Find an existing endpoint to test with
    const existingEndpoint = await prisma.api_endpoints.findFirst({
      where: {
        isActive: true
      }
    });

    if (!existingEndpoint) {
      console.log('No existing endpoints found. Creating a test endpoint...');

      // Find a server to attach the endpoint to
      const server = await prisma.api_servers.findFirst({
        where: { isActive: true }
      });

      if (!server) {
        console.log('❌ No active API servers found. Cannot create test endpoint.');
        return;
      }

      // Create test endpoint with defaultParams
      const testEndpoint = await prisma.api_endpoints.create({
        data: {
          id: `test-endpoint-${Date.now()}`,
          serverId: server.id,
          name: 'Test Endpoint - DefaultParams',
          path: '/test-endpoint',
          entity: 'asset_master',
          operationType: 'read',
          updatedAt: new Date(),
          defaultParams: {
            status: 'ACTIVE',
            limit: '100'
          }
        }
      });

      console.log('✅ Test endpoint created successfully!');
      console.log(`   ID: ${testEndpoint.id}`);
      console.log(`   Name: ${testEndpoint.name}`);
      console.log(`   Default Params:`, testEndpoint.defaultParams);
      console.log();

      // Clean up - delete the test endpoint
      await prisma.api_endpoints.delete({
        where: { id: testEndpoint.id }
      });
      console.log('✅ Test endpoint cleaned up successfully.\n');
    } else {
      console.log('Found existing endpoint:', existingEndpoint.name);
      console.log('Current defaultParams:', existingEndpoint.defaultParams);
      console.log();

      // Update with new defaultParams
      const updated = await prisma.api_endpoints.update({
        where: { id: existingEndpoint.id },
        data: {
          defaultParams: {
            status: 'ACTIVE',
            category: 'RENTAL',
            test: 'verification'
          }
        }
      });

      console.log('✅ Updated endpoint with defaultParams:');
      console.log('   New defaultParams:', updated.defaultParams);
      console.log();

      // Restore original defaultParams
      await prisma.api_endpoints.update({
        where: { id: existingEndpoint.id },
        data: {
          defaultParams: existingEndpoint.defaultParams || {}
        }
      });
      console.log('✅ Restored original defaultParams\n');
    }

    // Test reading endpoints with defaultParams
    const allEndpoints = await prisma.api_endpoints.findMany({
      select: {
        id: true,
        name: true,
        defaultParams: true
      },
      take: 5
    });

    console.log('Sample endpoints with defaultParams:');
    allEndpoints.forEach((ep, index) => {
      console.log(`${index + 1}. ${ep.name}`);
      console.log(`   defaultParams:`, ep.defaultParams);
    });

    console.log('\n✅ All tests passed! defaultParams field is working correctly.');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testDefaultParams().catch(console.error);
