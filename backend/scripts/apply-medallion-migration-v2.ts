import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('Applying Medallion Architecture migration...\n');

    const migrationPath = path.join(
      __dirname,
      '..',
      'prisma',
      'migrations',
      '20251128000000_add_medallion_bronze_silver_gold',
      'migration.sql'
    );

    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Remove comments and execute as one transaction
    const cleanSql = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
      .join('\n');

    console.log('Executing migration in single transaction...');
    await prisma.$executeRawUnsafe(cleanSql);

    console.log('\n✅ Migration applied successfully!');
    console.log('\nVerifying tables...');

    // Verify tables exist
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('bronze_batches', 'bronze_records', 'data_lineage')
      ORDER BY tablename
    `;

    console.log('Created tables:');
    tables.forEach(t => console.log(`  ✓ ${t.tablename}`));

    // Verify lineage fields on pfa_records
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'pfa_records'
      AND column_name IN ('lastSeenAt', 'bronzeRecordId')
      ORDER BY column_name
    `;

    console.log('\nLineage fields on pfa_records:');
    columns.forEach(c => console.log(`  ✓ ${c.column_name}`));

  } catch (error: any) {
    console.error('❌ Error applying migration:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
