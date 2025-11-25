/**
 * Seed Data Source Mappings
 *
 * This script creates initial DataSourceMapping records based on existing
 * API configurations and their feeds. It establishes the relationship between
 * data entities and API endpoints.
 *
 * Run: npx tsx seed-data-source-mappings.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Seeding Data Source Mappings...\n');

  try {
    // Get all API configurations with feeds
    const apiConfigs = await prisma.apiConfiguration.findMany({
      where: {
        feeds: { not: null }
      }
    });

    console.log(`Found ${apiConfigs.length} API configurations with feeds\n`);

    let created = 0;
    let skipped = 0;

    for (const config of apiConfigs) {
      try {
        const feeds = JSON.parse(config.feeds!);

        for (const feed of feeds) {
          const entityType = feed.entity;

          // Check if mapping already exists
          // Note: When organizationId is null, we use findFirst instead of findUnique
          // because Prisma's unique constraint doesn't work well with null values
          const existing = await prisma.dataSourceMapping.findFirst({
            where: {
              entityType,
              organizationId: config.organizationId,
              priority: 1
            }
          });

          if (existing) {
            console.log(`   ⏭️  Mapping already exists: ${entityType} → ${config.name}`);
            skipped++;
            continue;
          }

          // Create new mapping
          await prisma.dataSourceMapping.create({
            data: {
              entityType,
              organizationId: config.organizationId,
              apiConfigId: config.id,
              priority: 1,
              isActive: true
            }
          });

          console.log(`   ✅ Created mapping: ${entityType} → ${config.name}`);
          created++;
        }
      } catch (error) {
        console.error(`   ❌ Error processing ${config.name}:`, error);
      }
    }

    console.log(`\n✨ Seeding complete!`);
    console.log(`   Created: ${created} mappings`);
    console.log(`   Skipped: ${skipped} existing mappings\n`);

    // Display current mappings
    console.log('📊 Current Data Source Mappings:\n');

    const mappings = await prisma.dataSourceMapping.findMany({
      include: {
        apiConfig: {
          select: {
            name: true,
            usage: true
          }
        }
      },
      orderBy: [
        { entityType: 'asc' },
        { priority: 'asc' }
      ]
    });

    const groupedMappings = mappings.reduce((acc, mapping) => {
      if (!acc[mapping.entityType]) {
        acc[mapping.entityType] = [];
      }
      acc[mapping.entityType].push(mapping);
      return acc;
    }, {} as Record<string, typeof mappings>);

    for (const [entityType, entityMappings] of Object.entries(groupedMappings)) {
      console.log(`   ${entityType}:`);
      for (const mapping of entityMappings) {
        const status = mapping.isActive ? '🟢 Active' : '⚪ Inactive';
        const scope = mapping.organizationId ? `Org: ${mapping.organizationId}` : 'Global';
        console.log(`      ${status} [Priority ${mapping.priority}] ${mapping.apiConfig.name} (${scope})`);
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error seeding data source mappings:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
