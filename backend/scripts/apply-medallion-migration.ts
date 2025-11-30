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

    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.length > 0) {
        console.log(`Executing: ${statement.substring(0, 60)}...`);
        await prisma.$executeRawUnsafe(statement);
      }
    }

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

  } catch (error: any) {
    console.error('❌ Error applying migration:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
