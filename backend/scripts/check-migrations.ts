import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMigrations() {
  try {
    const migrations = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
      SELECT migration_name, finished_at
      FROM "_prisma_migrations"
      WHERE migration_name LIKE '%medallion%' OR migration_name LIKE '%bronze%'
      ORDER BY finished_at DESC NULLS LAST
    `;

    console.log('Medallion-related migrations:');
    if (migrations.length === 0) {
      console.log('  (none found)');
    } else {
      migrations.forEach(m => {
        const status = m.finished_at ? '✅ Applied' : '❌ Pending';
        console.log(`  ${status}: ${m.migration_name}`);
      });
    }

    console.log('\nAll migrations:');
    const all = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM "_prisma_migrations"
      ORDER BY finished_at DESC NULLS LAST
      LIMIT 5
    `;
    all.forEach(m => console.log(`  - ${m.migration_name}`));

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkMigrations();
