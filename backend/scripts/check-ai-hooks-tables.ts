import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAiHooksTables() {
  try {
    console.log('Checking for AI Intelligence & Hooks tables...\n');

    // Check AI tables
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('kpi_definitions', 'kpi_execution_logs', 'transformation_metrics', 'user_action_logs')
      ORDER BY tablename
    `;

    console.log('Found AI hook tables:');
    tables.forEach(t => console.log(`  ✓ ${t.tablename}`));

    if (tables.length < 4) {
      console.log('\n❌ Missing tables! Expected 4, found', tables.length);
      return;
    }

    // Check if tables have any data
    const kpiCount = await prisma.kpi_definitions.count();
    const executionCount = await prisma.kpi_execution_logs.count();
    const metricsCount = await prisma.transformation_metrics.count();
    const actionsCount = await prisma.user_action_logs.count();

    console.log('\nRecord counts:');
    console.log(`  KPI Definitions: ${kpiCount}`);
    console.log(`  KPI Executions: ${executionCount}`);
    console.log(`  Transformation Metrics: ${metricsCount}`);
    console.log(`  User Actions: ${actionsCount}`);

    console.log('\n✅ AI Intelligence & Hooks tables verified!');
  } catch (error: any) {
    console.error('❌ Error checking tables:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAiHooksTables();
