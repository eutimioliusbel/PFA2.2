/**
 * Master Data Seed Script
 *
 * Seeds the master data tables with initial reference data:
 * - master_manufacturers
 * - master_models
 * - master_dors
 * - master_sources
 * - master_class_categories
 *
 * Usage:
 *   npx tsx backend/prisma/seeds/master-data.seed.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// SEED DATA
// ============================================================================

const DORS = [
  { code: 'BEO', description: 'Base Engineering Operations' },
  { code: 'PROJECT', description: 'Specific Project Allocation' },
  { code: 'CORP', description: 'Corporate Overhead' },
];

const SOURCES = [
  { code: 'PURCHASE', description: 'Purchased Equipment', type: 'Capex' },
  { code: 'RENTAL', description: 'Rental Equipment', type: 'Opex' },
  { code: 'LEASE', description: 'Leased Equipment', type: 'Opex' },
];

const MANUFACTURERS = [
  { code: 'FORD', description: 'Ford Motor Company' },
  { code: 'FONTAINE', description: 'Fontaine Trailer Company' },
  { code: 'KUBOTA', description: 'Kubota Corporation' },
  { code: 'CAT', description: 'Caterpillar Inc.' },
  { code: 'CATERPILLAR', description: 'Caterpillar Inc.' },
  { code: 'JOHN DEERE', description: 'Deere & Company' },
  { code: 'KOMATSU', description: 'Komatsu Ltd.' },
  { code: 'TAKEUCHI', description: 'Takeuchi Manufacturing' },
  { code: 'TEREX', description: 'Terex Corporation' },
  { code: 'GROVE', description: 'Grove (Manitowoc)' },
  { code: 'LINKBELT', description: 'Link-Belt Cranes' },
  { code: 'TADANO', description: 'Tadano Ltd.' },
  { code: 'MULTI POWER', description: 'Multi Power Products' },
  { code: 'VOLVO', description: 'Volvo Group' },
  { code: 'LIEBHERR', description: 'Liebherr Group' },
  { code: 'HITACHI', description: 'Hitachi Construction Machinery' },
  { code: 'CASE', description: 'Case IH / CNH Industrial' },
  { code: 'BOBCAT', description: 'Bobcat Company' },
  { code: 'JCB', description: 'J C Bamford Excavators Ltd' },
  { code: 'HYUNDAI', description: 'Hyundai Construction Equipment' },
  { code: 'DOOSAN', description: 'Doosan Infracore' },
  { code: 'NEW HOLLAND', description: 'New Holland Agriculture' },
  { code: 'CHEVROLET', description: 'Chevrolet' },
  { code: 'RAM', description: 'Ram Trucks' },
  { code: 'TOYOTA', description: 'Toyota Motor Corporation' },
  { code: 'KENWORTH', description: 'Kenworth Truck Company' },
  { code: 'PETERBILT', description: 'Peterbilt Motors Company' },
  { code: 'FREIGHTLINER', description: 'Freightliner Trucks' },
  { code: 'MACK', description: 'Mack Trucks' },
  { code: 'INTERNATIONAL', description: 'International Trucks' },
  { code: 'WACKER NEUSON', description: 'Wacker Neuson SE' },
  { code: 'GENIE', description: 'Genie (Terex)' },
  { code: 'JLG', description: 'JLG Industries' },
  { code: 'SKYJACK', description: 'Skyjack Inc.' },
  { code: 'VERMEER', description: 'Vermeer Corporation' },
  { code: 'DITCH WITCH', description: 'The Charles Machine Works' },
  { code: 'ATLAS COPCO', description: 'Atlas Copco' },
  { code: 'INGERSOLL RAND', description: 'Ingersoll Rand' },
  { code: 'SULLAIR', description: 'Sullair LLC' },
  { code: 'GENERAC', description: 'Generac Power Systems' },
  { code: 'CUMMINS', description: 'Cummins Inc.' },
  { code: 'DORSEY', description: 'Dorsey Trailer' },
  { code: 'UTILITY', description: 'Utility Trailer Manufacturing' },
  { code: 'GREAT DANE', description: 'Great Dane Trailers' },
  { code: 'WABASH', description: 'Wabash National' },
  { code: 'HYSTER', description: 'Hyster-Yale Materials Handling' },
  { code: 'YALE', description: 'Yale Materials Handling' },
  { code: 'CROWN', description: 'Crown Equipment Corporation' },
  { code: 'RAYMOND', description: 'The Raymond Corporation' },
  { code: 'UNKNOWN', description: 'Unknown Manufacturer' },
];

const MODELS = [
  // Ford
  { manufacturer: 'FORD', model: 'F-150', description: 'Ford F-150 Pickup' },
  { manufacturer: 'FORD', model: 'F-250', description: 'Ford F-250 Super Duty' },
  { manufacturer: 'FORD', model: 'F-350', description: 'Ford F-350 Super Duty' },
  { manufacturer: 'FORD', model: 'T350XLPASSGRWD', description: 'Ford Transit 350 XL Passenger' },
  { manufacturer: 'FORD', model: 'TRANSIT', description: 'Ford Transit Van' },
  // Fontaine
  { manufacturer: 'FONTAINE', model: '4880SS2', description: 'Fontaine Flatbed Trailer' },
  { manufacturer: 'FONTAINE', model: 'REVOLUTION', description: 'Fontaine Revolution Trailer' },
  // Kubota
  { manufacturer: 'KUBOTA', model: 'RTV-X1140', description: 'Kubota RTV Utility Vehicle' },
  { manufacturer: 'KUBOTA', model: 'SVL75', description: 'Kubota Track Loader' },
  { manufacturer: 'KUBOTA', model: 'KX040', description: 'Kubota Mini Excavator' },
  // Caterpillar
  { manufacturer: 'CATERPILLAR', model: 'D6T', description: 'Cat D6T Dozer' },
  { manufacturer: 'CATERPILLAR', model: '320', description: 'Cat 320 Excavator' },
  { manufacturer: 'CATERPILLAR', model: '336', description: 'Cat 336 Excavator' },
  { manufacturer: 'CATERPILLAR', model: '966', description: 'Cat 966 Wheel Loader' },
  { manufacturer: 'CATERPILLAR', model: '815', description: 'Cat 815 Soil Compactor' },
  { manufacturer: 'CATERPILLAR', model: '140M', description: 'Cat 140M Motor Grader' },
  // John Deere
  { manufacturer: 'JOHN DEERE', model: '8R 340', description: 'John Deere 8R Tractor' },
  { manufacturer: 'JOHN DEERE', model: '850K', description: 'John Deere 850K Dozer' },
  { manufacturer: 'JOHN DEERE', model: '310SL', description: 'John Deere 310SL Backhoe' },
  // Tadano
  { manufacturer: 'TADANO', model: 'GR-1600XL', description: 'Tadano Rough Terrain Crane' },
  { manufacturer: 'TADANO', model: 'GR1600', description: 'Tadano 160T Crane' },
  // Takeuchi
  { manufacturer: 'TAKEUCHI', model: 'TB260C', description: 'Takeuchi Compact Excavator' },
  { manufacturer: 'TAKEUCHI', model: 'TL12R2', description: 'Takeuchi Track Loader' },
];

const CLASS_CATEGORIES = [
  // Class 01 - Automotive
  { classCode: '01', classDescription: 'Automotive', categoryCode: '01003', categoryDescription: 'SEDAN MEDIUM G' },
  { classCode: '01', classDescription: 'Automotive', categoryCode: '01005', categoryDescription: 'SEDAN LARGE G' },
  { classCode: '01', classDescription: 'Automotive', categoryCode: '01010', categoryDescription: 'SUV COMPACT 4WD G' },

  // Class 02 - Trucks Light Duty
  { classCode: '02', classDescription: 'Trucks - Light Duty', categoryCode: '02012', categoryDescription: 'PICKUP COMPACT 4X4 SUPERCREW 4DR G' },
  { classCode: '02', classDescription: 'Trucks - Light Duty', categoryCode: '02036', categoryDescription: 'PICKUP 1/2 TON 4X4 SUPERCREW 4DR G' },
  { classCode: '02', classDescription: 'Trucks - Light Duty', categoryCode: '02059', categoryDescription: 'PICKUP 3/4 TON 4X4 CREW CAB 4DR G' },
  { classCode: '02', classDescription: 'Trucks - Light Duty', categoryCode: '02065', categoryDescription: 'PICKUP 1 TON 4X4 CREW CAB 4DR G' },
  { classCode: '02', classDescription: 'Trucks - Light Duty', categoryCode: '02090', categoryDescription: 'VAN CARGO 1 TON G' },
  { classCode: '02', classDescription: 'Trucks - Light Duty', categoryCode: '02095', categoryDescription: 'VAN 8-15 PASSENGER 1 TON G' },

  // Class 04 - Trailers
  { classCode: '04', classDescription: 'Trailers', categoryCode: '04150', categoryDescription: 'TRAILER FLATBED 40-53FT' },
  { classCode: '04', classDescription: 'Trailers', categoryCode: '04700', categoryDescription: 'TRAILER PLTFRM 40-53FT' },
  { classCode: '04', classDescription: 'Trailers', categoryCode: '04705', categoryDescription: 'TRAILER PLTFRM EXT48-83FT' },

  // Class 06 - Utility Vehicles
  { classCode: '06', classDescription: 'Utility Vehicles', categoryCode: '06050', categoryDescription: 'ROUGH TERRAIN UTILITY VEHICLE 4 SEATER 4WD D' },
  { classCode: '06', classDescription: 'Utility Vehicles', categoryCode: '06055', categoryDescription: 'ROUGH TERRAIN UTILITY VEHICLE 6 SEATER 4WD D' },

  // Class 10 - Earthmoving
  { classCode: '10', classDescription: 'Earthmoving', categoryCode: '10100', categoryDescription: 'DOZER CRAWLER 100-150HP D' },
  { classCode: '10', classDescription: 'Earthmoving', categoryCode: '10200', categoryDescription: 'EXCAVATOR CRAWLER 20-30T D' },
  { classCode: '10', classDescription: 'Earthmoving', categoryCode: '10300', categoryDescription: 'WHEEL LOADER 3.5-4.5CY D' },

  // Class 14 - Cranes
  { classCode: '14', classDescription: 'Cranes', categoryCode: '14100', categoryDescription: 'CRANE MOBILE 25T D' },
  { classCode: '14', classDescription: 'Cranes', categoryCode: '14200', categoryDescription: 'CRANE MOBILE 50T D' },
  { classCode: '14', classDescription: 'Cranes', categoryCode: '14500', categoryDescription: 'CRANE CARRY DECK 8.5-10t D' },

  // Class 20 - Compaction
  { classCode: '20', classDescription: 'Compaction', categoryCode: '20100', categoryDescription: 'ROLLER VIBRATORY SINGLE DRUM D' },
  { classCode: '20', classDescription: 'Compaction', categoryCode: '20200', categoryDescription: 'ROLLER VIBRATORY TANDEM D' },

  // Class 28 - Containers
  { classCode: '28', classDescription: 'Containers', categoryCode: '28152', categoryDescription: 'CONTAINER 40 X 8 X 8' },
  { classCode: '28', classDescription: 'Containers', categoryCode: '28160', categoryDescription: 'CONTAINER OFFICE 40FT' },

  // Class 40 - Aerial Lifts
  { classCode: '40', classDescription: 'Aerial Lifts', categoryCode: '40100', categoryDescription: 'BOOM LIFT ARTICULATED 40-60FT D' },
  { classCode: '40', classDescription: 'Aerial Lifts', categoryCode: '40200', categoryDescription: 'SCISSOR LIFT ELECTRIC 26-32FT' },

  // Class 53 - Lighting
  { classCode: '53', classDescription: 'Lighting', categoryCode: '53200', categoryDescription: 'LIGHT PLNT 6KW 14HP 4 METAL HALIDE LAMP D' },
  { classCode: '53', classDescription: 'Lighting', categoryCode: '53300', categoryDescription: 'LIGHT TOWER 6KW D' },

  // Class 55 - Electronics
  { classCode: '55', classDescription: 'Electronics', categoryCode: '55007', categoryDescription: 'CLOCK BADGE SCAN UNIT' },
  { classCode: '55', classDescription: 'Electronics', categoryCode: '55010', categoryDescription: 'RADIO 2-WAY PORTABLE' },

  // Class 57 - Forklifts
  { classCode: '57', classDescription: 'Forklifts', categoryCode: '57000', categoryDescription: 'FORKLIFT 5000LB PROPANE' },
  { classCode: '57', classDescription: 'Forklifts', categoryCode: '57100', categoryDescription: 'FORKLIFT 8000LB DIESEL' },
  { classCode: '57', classDescription: 'Forklifts', categoryCode: '57200', categoryDescription: 'TELEHANDLER 6000LB D' },
];

// ============================================================================
// SEED FUNCTIONS
// ============================================================================

async function seedDors() {
  console.log('Seeding DORs...');
  for (const dor of DORS) {
    await prisma.master_dors.upsert({
      where: { code: dor.code },
      update: { description: dor.description },
      create: dor,
    });
  }
  console.log(`  ✓ ${DORS.length} DORs seeded`);
}

async function seedSources() {
  console.log('Seeding Sources...');
  for (const source of SOURCES) {
    await prisma.master_sources.upsert({
      where: { code: source.code },
      update: { description: source.description, type: source.type },
      create: source,
    });
  }
  console.log(`  ✓ ${SOURCES.length} Sources seeded`);
}

async function seedManufacturers() {
  console.log('Seeding Manufacturers...');
  for (const mfg of MANUFACTURERS) {
    await prisma.master_manufacturers.upsert({
      where: { code: mfg.code },
      update: { description: mfg.description },
      create: mfg,
    });
  }
  console.log(`  ✓ ${MANUFACTURERS.length} Manufacturers seeded`);
}

async function seedModels() {
  console.log('Seeding Models...');
  let count = 0;
  for (const model of MODELS) {
    try {
      await prisma.master_models.upsert({
        where: {
          manufacturer_model: {
            manufacturer: model.manufacturer,
            model: model.model,
          },
        },
        update: { description: model.description },
        create: model,
      });
      count++;
    } catch (error) {
      // Skip if manufacturer doesn't exist
      console.warn(`  ⚠ Skipped model ${model.model} - manufacturer ${model.manufacturer} not found`);
    }
  }
  console.log(`  ✓ ${count} Models seeded`);
}

async function seedClassCategories() {
  console.log('Seeding Class/Categories...');
  for (const cc of CLASS_CATEGORIES) {
    await prisma.master_class_categories.upsert({
      where: {
        classCode_categoryCode: {
          classCode: cc.classCode,
          categoryCode: cc.categoryCode,
        },
      },
      update: {
        classDescription: cc.classDescription,
        categoryDescription: cc.categoryDescription,
      },
      create: cc,
    });
  }
  console.log(`  ✓ ${CLASS_CATEGORIES.length} Class/Categories seeded`);
}

// Area Silos - Organization-specific (need to look up org IDs dynamically)
const AREA_SILOS_RIO = [
  { areaSilo: 'SILO-1', description: 'Silo 1 - North Operations' },
  { areaSilo: 'SILO-2', description: 'Silo 2 - South Operations' },
  { areaSilo: 'SILO-3', description: 'Silo 3 - East Operations' },
  { areaSilo: 'SILO-4', description: 'Silo 4 - West Operations' },
  { areaSilo: 'YARD-A', description: 'Yard A - Main Equipment Yard' },
  { areaSilo: 'YARD-B', description: 'Yard B - Secondary Equipment Yard' },
  { areaSilo: 'SHOP', description: 'Maintenance Shop' },
  { areaSilo: 'LAYDOWN', description: 'Laydown Area' },
  { areaSilo: 'STAGING', description: 'Staging Area' },
  { areaSilo: 'OFFICE', description: 'Office Compound' },
];

async function seedAreaSilos() {
  console.log('Seeding Area Silos...');

  // Get RIO organization
  const rio = await prisma.organizations.findFirst({
    where: { code: 'RIO' },
    select: { id: true },
  });

  if (!rio) {
    console.warn('  ⚠ RIO organization not found, skipping area silos');
    return 0;
  }

  let count = 0;
  for (const silo of AREA_SILOS_RIO) {
    await prisma.master_area_silos.upsert({
      where: {
        organizationId_areaSilo: {
          organizationId: rio.id,
          areaSilo: silo.areaSilo,
        },
      },
      update: { description: silo.description },
      create: {
        organizationId: rio.id,
        areaSilo: silo.areaSilo,
        description: silo.description,
      },
    });
    count++;
  }
  console.log(`  ✓ ${count} Area Silos seeded for RIO`);
  return count;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n🌱 Seeding Master Data Tables...\n');

  try {
    await seedDors();
    await seedSources();
    await seedManufacturers();
    await seedModels();
    await seedClassCategories();
    const areaSiloCount = await seedAreaSilos();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📋 Master Data Seed Summary:');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`   DORs:              ${DORS.length}`);
    console.log(`   Sources:           ${SOURCES.length}`);
    console.log(`   Manufacturers:     ${MANUFACTURERS.length}`);
    console.log(`   Models:            ${MODELS.length}`);
    console.log(`   Class/Categories:  ${CLASS_CATEGORIES.length}`);
    console.log(`   Area Silos (RIO):  ${areaSiloCount}`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n✅ Master data seed completed!\n');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
