/**
 * PostgreSQL Mirror + Delta Seed Script
 *
 * This script seeds the new PostgreSQL-specific PfaMirror and PfaModification tables
 * with sample data for testing the Cached Mirror + Delta architecture.
 *
 * Prerequisites:
 * - PostgreSQL database running
 * - Prisma schema updated with PfaMirror and PfaModification models
 * - Migrations applied: npx prisma migrate deploy
 *
 * Run: npx tsx scripts/db/seed-postgres-mirror-delta.ts
 *
 * @file seed-postgres-mirror-delta.ts
 * @description Seeds Mirror + Delta tables with sample PFA data
 * @usage npx tsx scripts/db/seed-postgres-mirror-delta.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Sample PFA record data (baseline from PEMS)
 */
const samplePfaData = [
  {
    id: 'PFA-RIO-001',
    organizationId: 'RIO',
    pfaId: 'PFA-001',
    organization: 'RIO',
    areaSilo: 'Silo 1',
    category: 'Earthmoving',
    class: 'Excavator',
    source: 'Rental',
    dor: 'PROJECT',
    monthlyRate: 15000.00,
    manufacturer: 'Caterpillar',
    model: '336F L',
    originalStart: '2025-01-15',
    originalEnd: '2025-06-30',
    forecastStart: '2025-01-15',
    forecastEnd: '2025-06-30',
    quantity: 2,
    isActualized: false,
    isDiscontinued: false,
    isFundsTransferable: false,
  },
  {
    id: 'PFA-RIO-002',
    organizationId: 'RIO',
    pfaId: 'PFA-002',
    organization: 'RIO',
    areaSilo: 'Silo 2',
    category: 'Lifting',
    class: 'Crane',
    source: 'Rental',
    dor: 'BEO',
    monthlyRate: 45000.00,
    manufacturer: 'Liebherr',
    model: 'LTM 1250-6.1',
    originalStart: '2025-02-01',
    originalEnd: '2025-08-31',
    forecastStart: '2025-02-01',
    forecastEnd: '2025-08-31',
    quantity: 1,
    isActualized: false,
    isDiscontinued: false,
    isFundsTransferable: true,
  },
  {
    id: 'PFA-PORTARTHUR-001',
    organizationId: 'PORTARTHUR',
    pfaId: 'PFA-PA-001',
    organization: 'PORTARTHUR',
    areaSilo: 'Area A',
    category: 'Earthmoving',
    class: 'Bulldozer',
    source: 'Purchase',
    dor: 'PROJECT',
    purchasePrice: 350000.00,
    manufacturer: 'Komatsu',
    model: 'D375A-8',
    originalStart: '2025-01-10',
    originalEnd: '2025-12-31',
    forecastStart: '2025-01-10',
    forecastEnd: '2025-12-31',
    quantity: 1,
    isActualized: false,
    isDiscontinued: false,
    isFundsTransferable: false,
  },
];

/**
 * Sample user modifications (draft changes not yet synced to PEMS)
 */
const sampleModifications = [
  {
    userId: 'admin',
    recordId: 'PFA-RIO-001',
    changes: {
      forecastStart: '2025-01-20', // Shifted 5 days forward
      forecastEnd: '2025-07-05',
    },
    sessionId: 'session-001',
    baseVersion: 'v1',
  },
  {
    userId: 'RRECTOR',
    recordId: 'PFA-RIO-002',
    changes: {
      monthlyRate: 42000.00, // Negotiated lower rate
      forecastEnd: '2025-09-15', // Extended 2 weeks
    },
    sessionId: 'session-002',
    baseVersion: 'v1',
  },
];

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  PostgreSQL Mirror + Delta Seed Script                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  try {
    // Check if database is PostgreSQL
    const result = await prisma.$queryRaw<any[]>`SELECT version()`;
    const dbVersion = result[0]?.version || '';

    if (!dbVersion.toLowerCase().includes('postgresql')) {
      console.error('❌ This script requires PostgreSQL database');
      console.error(`   Current database: ${dbVersion}`);
      console.error('   Update DATABASE_URL in .env to point to PostgreSQL\n');
      process.exit(1);
    }

    console.log('✓ PostgreSQL database detected');
    console.log(`  Version: ${dbVersion.split(',')[0]}\n`);

    // Verify required tables exist
    const tableCheck = await prisma.$queryRaw<any[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('pfa_mirror', 'pfa_modification', 'sync_log')
      ORDER BY table_name
    `;

    const existingTables = tableCheck.map(row => row.table_name);
    console.log('📊 Checking required tables...');
    console.log(`   ✓ Found ${existingTables.length} Mirror + Delta tables: ${existingTables.join(', ')}\n`);

    if (existingTables.length < 3) {
      console.error('❌ Missing required tables. Run migrations first:');
      console.error('   npx prisma migrate deploy\n');
      process.exit(1);
    }

    // =========================================================================
    // 1. Seed PfaMirror (Cached baseline from PEMS)
    // =========================================================================

    console.log('📦 Seeding PfaMirror table (PEMS baseline data)...\n');

    let mirrorCreated = 0;
    let mirrorSkipped = 0;

    for (const pfaData of samplePfaData) {
      try {
        // Check if record already exists
        const existing = await prisma.$queryRaw<any[]>`
          SELECT id FROM pfa_mirror WHERE id = ${pfaData.id}
        `;

        if (existing.length > 0) {
          console.log(`   ⏭️  Mirror record already exists: ${pfaData.id}`);
          mirrorSkipped++;
          continue;
        }

        // Insert into pfa_mirror using raw query (for JSONB demonstration)
        await prisma.$executeRaw`
          INSERT INTO pfa_mirror (
            id,
            organization_id,
            data,
            last_synced_at,
            pems_version
          ) VALUES (
            ${pfaData.id},
            ${pfaData.organizationId},
            ${JSON.stringify(pfaData)}::jsonb,
            NOW(),
            'v1'
          )
        `;

        console.log(`   ✅ Created mirror: ${pfaData.id} (${pfaData.organization} - ${pfaData.category})`);
        mirrorCreated++;
      } catch (error: any) {
        console.error(`   ❌ Error creating mirror ${pfaData.id}:`, error.message);
      }
    }

    console.log(`\n   Summary: Created ${mirrorCreated}, Skipped ${mirrorSkipped}\n`);

    // =========================================================================
    // 2. Seed PfaModification (User draft changes)
    // =========================================================================

    console.log('📝 Seeding PfaModification table (user drafts)...\n');

    let modCreated = 0;
    let modSkipped = 0;

    for (const modification of sampleModifications) {
      try {
        // Check if modification already exists
        const existing = await prisma.$queryRaw<any[]>`
          SELECT id FROM pfa_modification
          WHERE user_id = ${modification.userId}
            AND record_id = ${modification.recordId}
        `;

        if (existing.length > 0) {
          console.log(`   ⏭️  Modification already exists: ${modification.userId} → ${modification.recordId}`);
          modSkipped++;
          continue;
        }

        // Insert into pfa_modification
        await prisma.$executeRaw`
          INSERT INTO pfa_modification (
            user_id,
            record_id,
            changes,
            modified_at,
            session_id,
            base_version
          ) VALUES (
            ${modification.userId},
            ${modification.recordId},
            ${JSON.stringify(modification.changes)}::jsonb,
            NOW(),
            ${modification.sessionId},
            ${modification.baseVersion}
          )
        `;

        console.log(`   ✅ Created modification: ${modification.userId} → ${modification.recordId}`);
        console.log(`      Changes: ${Object.keys(modification.changes).join(', ')}`);
        modCreated++;
      } catch (error: any) {
        console.error(`   ❌ Error creating modification:`, error.message);
      }
    }

    console.log(`\n   Summary: Created ${modCreated}, Skipped ${modSkipped}\n`);

    // =========================================================================
    // 3. Create sample sync log entry
    // =========================================================================

    console.log('📊 Creating sample sync log...\n');

    await prisma.$executeRaw`
      INSERT INTO sync_log (
        organization_id,
        sync_type,
        started_at,
        completed_at,
        duration_ms,
        status,
        records_processed,
        records_inserted,
        records_updated,
        error_count
      ) VALUES (
        'RIO',
        'full',
        NOW() - INTERVAL '5 minutes',
        NOW() - INTERVAL '2 minutes',
        180000,
        'completed',
        3,
        3,
        0,
        0
      )
      ON CONFLICT DO NOTHING
    `;

    console.log('   ✅ Sample sync log created\n');

    // =========================================================================
    // 4. Demonstrate live merge query
    // =========================================================================

    console.log('🔗 Demonstrating live merge (Mirror + User Modifications)...\n');

    const mergedRecords = await prisma.$queryRaw<any[]>`
      SELECT
        COALESCE(m.record_id, mir.id) as id,
        CASE
          WHEN m.id IS NOT NULL THEN mir.data || m.changes
          ELSE mir.data
        END as data,
        CASE WHEN m.id IS NOT NULL THEN true ELSE false END as has_draft,
        m.user_id as modified_by,
        m.modified_at
      FROM pfa_mirror mir
      LEFT JOIN pfa_modification m
        ON mir.id = m.record_id AND m.user_id = 'admin'
      WHERE mir.organization_id = 'RIO'
      ORDER BY mir.id
    `;

    console.log(`   Found ${mergedRecords.length} merged records:\n`);

    for (const record of mergedRecords) {
      const data = record.data;
      const draftIndicator = record.has_draft ? '✏️  (has draft)' : '✅ (pristine)';
      console.log(`   ${draftIndicator} ${record.id}: ${data.category} - ${data.class}`);

      if (record.has_draft) {
        console.log(`      Modified by: ${record.modified_by} at ${record.modified_at}`);
      }
    }

    console.log('\n');

    // =========================================================================
    // Summary
    // =========================================================================

    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  Seed Complete                                                ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    console.log('📋 Summary:');
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`   Mirror Records:      ${mirrorCreated} created, ${mirrorSkipped} existing`);
    console.log(`   Modifications:       ${modCreated} created, ${modSkipped} existing`);
    console.log(`   Sync Logs:           1 sample`);
    console.log('───────────────────────────────────────────────────────────────\n');

    console.log('🧪 Test Queries:');
    console.log('');
    console.log('   1. View pristine records (no modifications):');
    console.log('      SELECT * FROM pfa_mirror mir');
    console.log('      WHERE NOT EXISTS (');
    console.log('        SELECT 1 FROM pfa_modification m');
    console.log('        WHERE m.record_id = mir.id');
    console.log('      );');
    console.log('');
    console.log('   2. View all user drafts:');
    console.log('      SELECT * FROM pfa_modification;');
    console.log('');
    console.log('   3. Merged view (Mirror + Modifications):');
    console.log('      SELECT');
    console.log('        COALESCE(m.record_id, mir.id) as id,');
    console.log('        CASE WHEN m.id IS NOT NULL');
    console.log('          THEN mir.data || m.changes');
    console.log('          ELSE mir.data');
    console.log('        END as data,');
    console.log('        CASE WHEN m.id IS NOT NULL THEN true ELSE false END as has_draft');
    console.log('      FROM pfa_mirror mir');
    console.log('      LEFT JOIN pfa_modification m ON mir.id = m.record_id');
    console.log('      WHERE mir.organization_id = \'RIO\';');
    console.log('');

    console.log('✅ Seed completed successfully!\n');

  } catch (error: any) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Fatal error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
