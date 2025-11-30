import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkBronzeTables() {
  try {
    console.log('Checking for Bronze/Silver/Gold medallion tables...\n');

    // Check Bronze tables
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND (tablename LIKE 'bronze%' OR tablename LIKE 'data_lineage%')
      ORDER BY tablename
    `;

    console.log('Found medallion tables:');
    tables.forEach(t => console.log(`  ✓ ${t.tablename}`));

    // Check if BronzeBatch table has records
    const batchCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM bronze_batches
    `;
    console.log(`\nBronze batches: ${batchCount[0].count}`);

    // Check if BronzeRecord table has records
    const recordCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM bronze_records
    `;
    console.log(`Bronze records: ${recordCount[0].count}`);

    // Check if DataLineage table has records
    const lineageCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM data_lineage
    `;
    console.log(`Data lineage records: ${lineageCount[0].count}`);

    console.log('\n✅ Medallion layer tables verified!');
  } catch (error: any) {
    console.error('❌ Error checking tables:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkBronzeTables();
