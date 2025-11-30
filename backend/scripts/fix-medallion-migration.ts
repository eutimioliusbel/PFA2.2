import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMigration() {
  try {
    console.log('Removing incorrectly marked migration...\n');

    await prisma.$executeRawUnsafe(`
      DELETE FROM "_prisma_migrations"
      WHERE migration_name = '20251128000000_add_medallion_bronze_silver_gold'
    `);

    console.log('✅ Migration record removed');
    console.log('\nNow run: cd backend && npx prisma migrate deploy');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixMigration();
