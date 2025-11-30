import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkColumn() {
  try {
    // Try to query the column
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'pfa_records'
      AND column_name LIKE '%migrat%'
    `;

    console.log('Migration columns in pfa_records:');
    console.log(result);

    // Check if we can query with the column
    const count = await prisma.$queryRaw`
      SELECT COUNT(*)
      FROM pfa_records
      WHERE migrated_to_mirror = false
    `;

    console.log('\nRecords pending migration:', count);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkColumn();
