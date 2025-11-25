/**
 * Update Feeds Field Script
 *
 * Adds feeds configuration to existing API configurations
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateFeeds() {
  try {
    console.log('📊 Updating API configurations with feeds...\n');

    // Update PEMS PFA Read API
    await prisma.apiConfiguration.update({
      where: { id: 'pems-global-pfa-read' },
      data: {
        feeds: JSON.stringify([{
          entity: 'pfa',
          views: ['Timeline Lab', 'Matrix', 'Grid Lab', 'PFA 1.0 Lab', 'PFA Master Data']
        }])
      }
    });
    console.log('✓ Updated PEMS - PFA Data (Read) with feeds');

    // Update PEMS PFA Write API
    await prisma.apiConfiguration.update({
      where: { id: 'pems-global-pfa-write' },
      data: {
        feeds: JSON.stringify([{
          entity: 'pfa',
          operation: 'write'
        }])
      }
    });
    console.log('✓ Updated PEMS - PFA Data (Write) with feeds');

    // Update PEMS Assets API
    await prisma.apiConfiguration.update({
      where: { id: 'pems-global-assets' },
      data: {
        feeds: JSON.stringify([{
          entity: 'asset_master',
          views: ['Asset Master']
        }])
      }
    });
    console.log('✓ Updated PEMS - Asset Master with feeds');

    // Update PEMS Classes API
    await prisma.apiConfiguration.update({
      where: { id: 'pems-global-classes' },
      data: {
        feeds: JSON.stringify([{
          entity: 'classifications',
          views: ['Classifications Master Data']
        }])
      }
    });
    console.log('✓ Updated PEMS - Classes & Categories with feeds');

    console.log('\n✅ All feeds updated successfully!');

  } catch (error) {
    console.error('❌ Error updating feeds:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateFeeds()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Update failed:', error);
    process.exit(1);
  });
