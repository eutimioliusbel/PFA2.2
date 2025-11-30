import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedTestKpi() {
  try {
    console.log('Seeding test KPI definitions...\n');

    // Get first organization (should be RIO or similar)
    const org = await prisma.organizations.findFirst({
      where: { isActive: true },
    });

    if (!org) {
      console.log('❌ No active organization found. Run seed script first.');
      return;
    }

    console.log(`Using organization: ${org.name} (${org.code})`);

    // Get first user for createdBy
    const user = await prisma.users.findFirst({
      where: { isActive: true },
    });

    if (!user) {
      console.log('❌ No active user found. Run seed script first.');
      return;
    }

    console.log(`Using user: ${user.username}`);

    // Test KPI 1: Simple overhead markup (cost * 1.15)
    const kpi1 = await prisma.kpi_definitions.upsert({
      where: { id: 'test-kpi-overhead-markup' },
      update: {},
      create: {
        id: 'test-kpi-overhead-markup',
        organizationId: org.id,
        name: 'Overhead Markup (15%)',
        description: 'Calculates total cost with 15% overhead markup',
        formula: '{cost} * 1.15',
        formulaType: 'mathjs',
        format: 'currency',
        colorScale: false,
        sortOrder: 1,
        createdBy: user.id,
        isActive: true,
      },
    });
    console.log(`\n✓ Created KPI: ${kpi1.name}`);
    console.log(`  Formula: ${kpi1.formula}`);

    // Test KPI 2: Rental days calculation
    const kpi2 = await prisma.kpi_definitions.upsert({
      where: { id: 'test-kpi-rental-days' },
      update: {},
      create: {
        id: 'test-kpi-rental-days',
        organizationId: org.id,
        name: 'Rental Duration (Days)',
        description: 'Calculates rental duration in days from forecast dates',
        formula: '({forecastEnd} - {forecastStart}) / 86400000',
        formulaType: 'mathjs',
        format: 'number',
        colorScale: false,
        sortOrder: 2,
        createdBy: user.id,
        isActive: true,
      },
    });
    console.log(`\n✓ Created KPI: ${kpi2.name}`);
    console.log(`  Formula: ${kpi2.formula}`);

    // Test KPI 3: Utilization rate (actual / forecast)
    const kpi3 = await prisma.kpi_definitions.upsert({
      where: { id: 'test-kpi-utilization-rate' },
      update: {},
      create: {
        id: 'test-kpi-utilization-rate',
        organizationId: org.id,
        name: 'Utilization Rate (%)',
        description: 'Percentage of forecasted time actually utilized',
        formula: '(({actualEnd} - {actualStart}) / ({forecastEnd} - {forecastStart})) * 100',
        formulaType: 'mathjs',
        format: 'percent',
        colorScale: true,
        sortOrder: 3,
        createdBy: user.id,
        isActive: true,
      },
    });
    console.log(`\n✓ Created KPI: ${kpi3.name}`);
    console.log(`  Formula: ${kpi3.formula}`);

    console.log('\n🎉 Test KPIs seeded successfully!');
    console.log('\nNext steps:');
    console.log('- Test KPI execution in backend service');
    console.log('- Test KPI execution in frontend (sandbox mode)');
    console.log('- Verify execution logs are created');

  } catch (error: any) {
    console.error('\n❌ Error seeding KPIs:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

seedTestKpi();
