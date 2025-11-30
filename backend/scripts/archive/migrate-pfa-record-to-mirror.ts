/**
 * Migrate existing PfaRecord data to PfaMirror + PfaModification
 *
 * Strategy:
 * 1. For each PfaRecord with syncState = 'pristine':
 *    - Create PfaMirror with full data
 *    - Mark as migrated
 *
 * 2. For each PfaRecord with syncState = 'modified':
 *    - Create PfaMirror with original data (reconstruct from modifiedFields)
 *    - Create PfaModification with delta
 *    - Mark as migrated
 *
 * 3. Run in batches of 1000 to avoid memory overflow
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const BATCH_SIZE = 1000;

interface MigrationStats {
  totalRecords: number;
  migratedCount: number;
  errorCount: number;
  skippedCount: number;
  errors: Array<{ pfaId: string; error: string }>;
}

/**
 * Extract mirror data from PfaRecord
 */
function extractMirrorData(record: any): any {
  return {
    pfaId: record.pfaId,
    organization: record.organizationId,
    areaSilo: record.areaSilo,
    category: record.category,
    forecastCategory: record.forecastCategory,
    class: record.class,
    source: record.source,
    dor: record.dor,
    isActualized: record.isActualized,
    isDiscontinued: record.isDiscontinued,
    isFundsTransferable: record.isFundsTransferable,
    monthlyRate: record.monthlyRate,
    purchasePrice: record.purchasePrice,
    manufacturer: record.manufacturer,
    model: record.model,
    originalStart: record.originalStart?.toISOString(),
    originalEnd: record.originalEnd?.toISOString(),
    hasPlan: record.hasPlan,
    forecastStart: record.forecastStart?.toISOString(),
    forecastEnd: record.forecastEnd?.toISOString(),
    actualStart: record.actualStart?.toISOString(),
    actualEnd: record.actualEnd?.toISOString(),
    hasActuals: record.hasActuals,
    contract: record.contract,
    equipment: record.equipment,
    pemsVersion: record.pemsVersion,
    lastSyncedAt: record.lastSyncedAt?.toISOString()
  };
}

/**
 * Extract delta from modified record
 */
function extractDelta(record: any): any {
  if (!record.modifiedFields) {
    return {};
  }

  const delta: any = {};
  let modifiedFieldsArray: string[] = [];

  try {
    modifiedFieldsArray = JSON.parse(record.modifiedFields);
  } catch (e) {
    console.warn(`Failed to parse modifiedFields for ${record.pfaId}, treating as empty`);
    return {};
  }

  // Only include editable fields in delta
  const editableFields = ['forecastStart', 'forecastEnd', 'forecastCategory', 'isDiscontinued'];

  for (const field of modifiedFieldsArray) {
    if (editableFields.includes(field) && record[field] !== undefined) {
      if (field.includes('Start') || field.includes('End')) {
        delta[field] = record[field]?.toISOString();
      } else {
        delta[field] = record[field];
      }
    }
  }

  return delta;
}

async function migratePfaRecordToMirror(): Promise<MigrationStats> {
  console.log('===================================');
  console.log('PFA Record Migration to Mirror + Delta');
  console.log('===================================\n');

  const stats: MigrationStats = {
    totalRecords: 0,
    migratedCount: 0,
    errorCount: 0,
    skippedCount: 0,
    errors: []
  };

  try {
    // Count total records to migrate
    stats.totalRecords = await prisma.pfa_records.count({
      where: { migratedToMirror: false }
    });

    console.log(`Total records to migrate: ${stats.totalRecords}\n`);

    if (stats.totalRecords === 0) {
      console.log('No records to migrate. Exiting.');
      return stats;
    }

    // Process in batches
    for (let offset = 0; offset < stats.totalRecords; offset += BATCH_SIZE) {
      console.log(`Processing batch ${Math.floor(offset / BATCH_SIZE) + 1} (offset: ${offset})`);

      const batch = await prisma.pfa_records.findMany({
        where: { migratedToMirror: false },
        take: BATCH_SIZE,
        skip: offset
      });

      for (const record of batch) {
        try {
          // Extract mirror data
          const mirrorData = extractMirrorData(record);

          // Check if mirror already exists
          const existingMirror = await prisma.pfa_mirror.findUnique({
            where: {
              pfa_mirror_org_pfa_unique: {
                organizationId: record.organizationId,
                pfaId: record.pfaId
              }
            }
          });

          let mirror;

          if (existingMirror) {
            // Update existing mirror
            mirror = await prisma.pfa_mirror.update({
              where: { id: existingMirror.id },
              data: {
                data: mirrorData as Prisma.InputJsonValue,
                category: record.category,
                class: record.class,
                source: record.source,
                dor: record.dor,
                forecastStart: record.forecastStart,
                forecastEnd: record.forecastEnd,
                pemsVersion: record.pemsVersion,
                lastSyncedAt: record.lastSyncedAt
              }
            });
          } else {
            // Create new mirror
            mirror = await prisma.pfa_mirror.create({
              data: {
                organizationId: record.organizationId,
                pfaId: record.pfaId,
                data: mirrorData as Prisma.InputJsonValue,
                category: record.category,
                class: record.class,
                source: record.source,
                dor: record.dor,
                forecastStart: record.forecastStart,
                forecastEnd: record.forecastEnd,
                originalStart: record.originalStart,
                originalEnd: record.originalEnd,
                actualStart: record.actualStart,
                actualEnd: record.actualEnd,
                pemsVersion: record.pemsVersion,
                lastSyncedAt: record.lastSyncedAt
              }
            });
          }

          // If record was modified, create PfaModification
          if (record.syncState === 'modified' && record.modifiedBy) {
            const delta = extractDelta(record);

            if (Object.keys(delta).length > 0) {
              // Check if modification already exists
              const existingMod = await prisma.pfa_modifications.findFirst({
                where: {
                  mirrorId: mirror.id,
                  userId: record.modifiedBy,
                  syncState: 'draft'
                }
              });

              if (!existingMod) {
                await prisma.pfa_modifications.create({
                  data: {
                    mirrorId: mirror.id,
                    organizationId: record.organizationId,
                    userId: record.modifiedBy,
                    delta: delta as Prisma.InputJsonValue,
                    syncState: 'draft',
                    modifiedFields: record.modifiedFields ? JSON.parse(record.modifiedFields) : [],
                    baseVersion: 1,
                    currentVersion: 1
                  }
                });
              }
            }
          }

          // Mark as migrated
          await prisma.pfa_records.update({
            where: { id: record.id },
            data: { migratedToMirror: true }
          });

          stats.migratedCount++;

        } catch (error: any) {
          console.error(`Failed to migrate record ${record.pfaId}:`, error.message);
          stats.errorCount++;
          stats.errors.push({
            pfaId: record.pfaId,
            error: error.message
          });
        }
      }

      console.log(`Batch complete. Migrated: ${stats.migratedCount}/${stats.totalRecords} (${stats.errorCount} errors)\n`);
    }

    console.log('===================================');
    console.log('Migration Summary');
    console.log('===================================');
    console.log(`Total Records: ${stats.totalRecords}`);
    console.log(`Migrated: ${stats.migratedCount}`);
    console.log(`Errors: ${stats.errorCount}`);
    console.log(`Skipped: ${stats.skippedCount}`);

    if (stats.errors.length > 0) {
      console.log('\nErrors:');
      stats.errors.forEach(err => {
        console.log(`  - ${err.pfaId}: ${err.error}`);
      });
    }

    return stats;

  } catch (error: any) {
    console.error('Migration failed with fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
if (require.main === module) {
  migratePfaRecordToMirror()
    .then((stats) => {
      if (stats.errorCount === 0) {
        console.log('\n✅ Migration completed successfully!');
        process.exit(0);
      } else {
        console.log(`\n⚠️  Migration completed with ${stats.errorCount} errors.`);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}
