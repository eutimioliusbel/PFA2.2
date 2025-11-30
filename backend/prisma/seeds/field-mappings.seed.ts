/**
 * Seed file for default PEMS PFA field mappings
 *
 * Creates default api_field_mappings for PFA endpoints.
 * These mappings transform PEMS Grid API response (CELL format) to PFA mirror data.
 *
 * Run: npm run prisma:seed
 * Or standalone: npx ts-node prisma/seeds/field-mappings.seed.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Default PEMS PFA field mappings
 * Maps PEMS Grid API fields to PFA mirror fields
 */
const DEFAULT_PFA_MAPPINGS = [
  // Core identifiers
  { sourceField: 'pfs_id', destinationField: 'pfaId', dataType: 'string', transformType: 'direct', defaultValue: null, description: 'Primary PFA identifier' },

  // Location/Classification
  { sourceField: 'pfs_f_area', destinationField: 'areaSilo', dataType: 'string', transformType: 'direct', defaultValue: '', description: 'Area/Silo location' },
  { sourceField: 'pfs_f_category', destinationField: 'category', dataType: 'string', transformType: 'direct', defaultValue: '', description: 'Equipment category' },
  { sourceField: 'pfs_f_catdesc', destinationField: 'forecastCategory', dataType: 'string', transformType: 'direct', defaultValue: null, description: 'Category description' },
  { sourceField: 'pfs_f_class', destinationField: 'class', dataType: 'string', transformType: 'direct', defaultValue: '', description: 'Equipment class' },

  // Source/Type
  { sourceField: 'pfs_f_source', destinationField: 'source', dataType: 'string', transformType: 'direct', defaultValue: 'Rental', description: 'Rental or Purchase' },
  { sourceField: 'pfs_f_dor', destinationField: 'dor', dataType: 'string', transformType: 'direct', defaultValue: 'PROJECT', description: 'BEO or PROJECT designation' },

  // Status flags (Y/N to boolean)
  { sourceField: 'pfs_f_actualized', destinationField: 'isActualized', dataType: 'boolean', transformType: 'equals_y', defaultValue: 'false', description: 'Whether item is actualized' },
  { sourceField: 'pfs_f_discontinued', destinationField: 'isDiscontinued', dataType: 'boolean', transformType: 'equals_y', defaultValue: 'false', description: 'Whether item is discontinued' },
  { sourceField: 'pfs_f_fundstrans', destinationField: 'isFundsTransferable', dataType: 'boolean', transformType: 'equals_y', defaultValue: 'false', description: 'Whether funds are transferable' },

  // Financial
  { sourceField: 'pfs_f_rental', destinationField: 'monthlyRate', dataType: 'number', transformType: 'direct', defaultValue: '0', description: 'Monthly rental rate' },
  { sourceField: 'pfs_f_purchase', destinationField: 'purchasePrice', dataType: 'number', transformType: 'direct', defaultValue: '0', description: 'Purchase price' },

  // Equipment details
  { sourceField: 'pfs_f_manufacturer', destinationField: 'manufacturer', dataType: 'string', transformType: 'direct', defaultValue: '', description: 'Equipment manufacturer' },
  { sourceField: 'pfs_f_model', destinationField: 'model', dataType: 'string', transformType: 'direct', defaultValue: '', description: 'Equipment model' },
  { sourceField: 'pfs_p_projcode', destinationField: 'contract', dataType: 'string', transformType: 'direct', defaultValue: null, description: 'Project/Contract code' },
  { sourceField: 'pfs_equipment_tag', destinationField: 'equipment', dataType: 'string', transformType: 'direct', defaultValue: null, description: 'Equipment tag/identifier' },

  // Plan dates (original/baseline)
  { sourceField: 'pfs_p_startdate', destinationField: 'originalStart', dataType: 'date', transformType: 'direct', defaultValue: null, description: 'Original plan start date' },
  { sourceField: 'pfs_p_enddate', destinationField: 'originalEnd', dataType: 'date', transformType: 'direct', defaultValue: null, description: 'Original plan end date' },

  // Forecast dates (editable)
  { sourceField: 'pfs_f_startdate', destinationField: 'forecastStart', dataType: 'date', transformType: 'direct', defaultValue: null, description: 'Forecast start date' },
  { sourceField: 'pfs_f_enddate', destinationField: 'forecastEnd', dataType: 'date', transformType: 'direct', defaultValue: null, description: 'Forecast end date' },

  // Actual dates (billing reality)
  { sourceField: 'pfs_a_startdate', destinationField: 'actualStart', dataType: 'date', transformType: 'direct', defaultValue: null, description: 'Actual start date' },
  { sourceField: 'pfs_a_enddate', destinationField: 'actualEnd', dataType: 'date', transformType: 'direct', defaultValue: null, description: 'Actual end date' },

  // Version tracking
  { sourceField: 'pfs_lastmodified', destinationField: 'pemsVersion', dataType: 'string', transformType: 'direct', defaultValue: null, description: 'PEMS last modified timestamp' }
];

/**
 * Seed field mappings for all PFA endpoints
 */
export async function seedFieldMappings(): Promise<void> {
  console.log('🗺️  Seeding field mappings...');

  // Find all PFA endpoints (entity = 'pfa' or 'PFA')
  const pfaEndpoints = await prisma.api_endpoints.findMany({
    where: {
      OR: [
        { entity: 'pfa' },
        { entity: 'PFA' },
        { targetModel: 'pfa_mirror' },
        { targetModel: 'pfa_records' }
      ]
    },
    select: { id: true, name: true, serverId: true }
  });

  if (pfaEndpoints.length === 0) {
    console.log('  ⚠ No PFA endpoints found. Create api_endpoints first.');
    return;
  }

  console.log(`  Found ${pfaEndpoints.length} PFA endpoint(s)`);

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const endpoint of pfaEndpoints) {
    console.log(`\n  Processing endpoint: ${endpoint.name} (${endpoint.id})`);

    for (const mapping of DEFAULT_PFA_MAPPINGS) {
      const mappingId = `afm_${endpoint.id}_${mapping.sourceField}_${mapping.destinationField}`.substring(0, 64);

      try {
        // Check if mapping already exists
        const existing = await prisma.api_field_mappings.findFirst({
          where: {
            endpointId: endpoint.id,
            sourceField: mapping.sourceField,
            destinationField: mapping.destinationField
          }
        });

        if (existing) {
          totalSkipped++;
          continue;
        }

        // Create new mapping
        await prisma.api_field_mappings.create({
          data: {
            id: mappingId,
            endpointId: endpoint.id,
            sourceField: mapping.sourceField,
            destinationField: mapping.destinationField,
            dataType: mapping.dataType,
            transformType: mapping.transformType,
            transformParams: {},
            defaultValue: mapping.defaultValue,
            isActive: true,
            validFrom: new Date(),
            validTo: null,
            createdBy: 'seed',
            updatedAt: new Date()
          }
        });

        totalCreated++;
      } catch (err) {
        console.error(`    ✗ Failed to create mapping ${mapping.sourceField} -> ${mapping.destinationField}:`, err);
      }
    }
  }

  console.log(`\n✓ Field mappings seeded: ${totalCreated} created, ${totalSkipped} skipped (already exist)`);
}

/**
 * Create mappings for a specific endpoint
 */
export async function createMappingsForEndpoint(endpointId: string, createdBy: string = 'system'): Promise<number> {
  let created = 0;

  for (const mapping of DEFAULT_PFA_MAPPINGS) {
    const mappingId = `afm_${endpointId}_${mapping.sourceField}_${mapping.destinationField}`.substring(0, 64);

    try {
      await prisma.api_field_mappings.upsert({
        where: {
          endpointId_sourceField_destinationField: {
            endpointId,
            sourceField: mapping.sourceField,
            destinationField: mapping.destinationField
          }
        },
        update: {
          dataType: mapping.dataType,
          transformType: mapping.transformType,
          defaultValue: mapping.defaultValue,
          updatedAt: new Date()
        },
        create: {
          id: mappingId,
          endpointId,
          sourceField: mapping.sourceField,
          destinationField: mapping.destinationField,
          dataType: mapping.dataType,
          transformType: mapping.transformType,
          transformParams: {},
          defaultValue: mapping.defaultValue,
          isActive: true,
          validFrom: new Date(),
          validTo: null,
          createdBy,
          updatedAt: new Date()
        }
      });
      created++;
    } catch (err) {
      console.error(`Failed to create mapping ${mapping.sourceField}:`, err);
    }
  }

  return created;
}

/**
 * Get default mappings as array (for API responses)
 */
export function getDefaultPfaMappings() {
  return DEFAULT_PFA_MAPPINGS;
}

// Run standalone if executed directly
if (require.main === module) {
  seedFieldMappings()
    .then(() => {
      console.log('\n✅ Field mapping seed complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}
