/**
 * Seed System Dictionary
 * ADR-005 Missing Components - Default Dictionary Entries
 *
 * Creates default dictionary entries for dropdown options.
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

export async function seedSystemDictionary() {
  console.log('Seeding system dictionary...');

  const entries = [
    // Equipment Classes
    {
      category: 'equipment_class',
      value: 'VEHICLE',
      label: 'Vehicles & Transportation',
      sortOrder: 0,
      metadata: { icon: 'truck', color: 'blue' },
      createdBy: 'system',
    },
    {
      category: 'equipment_class',
      value: 'HEAVY_MACHINERY',
      label: 'Heavy Machinery',
      sortOrder: 1,
      metadata: { icon: 'cog', color: 'orange' },
      createdBy: 'system',
    },
    {
      category: 'equipment_class',
      value: 'TOOLS',
      label: 'Tools & Equipment',
      sortOrder: 2,
      metadata: { icon: 'wrench', color: 'gray' },
      createdBy: 'system',
    },
    {
      category: 'equipment_class',
      value: 'ELECTRONICS',
      label: 'Electronics & IT',
      sortOrder: 3,
      metadata: { icon: 'laptop', color: 'purple' },
      createdBy: 'system',
    },
    {
      category: 'equipment_class',
      value: 'SAFETY',
      label: 'Safety Equipment',
      sortOrder: 4,
      metadata: { icon: 'shield', color: 'green' },
      createdBy: 'system',
    },

    // Status Types
    {
      category: 'status_type',
      value: 'ACTIVE',
      label: 'Active',
      sortOrder: 0,
      metadata: { color: 'green', badgeStyle: 'success' },
      createdBy: 'system',
    },
    {
      category: 'status_type',
      value: 'INACTIVE',
      label: 'Inactive',
      sortOrder: 1,
      metadata: { color: 'gray', badgeStyle: 'neutral' },
      createdBy: 'system',
    },
    {
      category: 'status_type',
      value: 'PENDING',
      label: 'Pending',
      sortOrder: 2,
      metadata: { color: 'yellow', badgeStyle: 'warning' },
      createdBy: 'system',
    },
    {
      category: 'status_type',
      value: 'DISCONTINUED',
      label: 'Discontinued',
      sortOrder: 3,
      metadata: { color: 'red', badgeStyle: 'danger' },
      createdBy: 'system',
    },

    // Cost Centers
    {
      category: 'cost_center',
      value: 'PROJECT',
      label: 'Project Direct',
      sortOrder: 0,
      metadata: { accountCode: '1000', description: 'Direct project costs' },
      createdBy: 'system',
    },
    {
      category: 'cost_center',
      value: 'BEO',
      label: 'Business Excellence Office',
      sortOrder: 1,
      metadata: { accountCode: '2000', description: 'Overhead and shared services' },
      createdBy: 'system',
    },
    {
      category: 'cost_center',
      value: 'MAINTENANCE',
      label: 'Maintenance & Repair',
      sortOrder: 2,
      metadata: { accountCode: '3000', description: 'Maintenance operations' },
      createdBy: 'system',
    },
    {
      category: 'cost_center',
      value: 'CAPITAL',
      label: 'Capital Investment',
      sortOrder: 3,
      metadata: { accountCode: '4000', description: 'Capital expenditures' },
      createdBy: 'system',
    },

    // Source Types
    {
      category: 'source_type',
      value: 'RENTAL',
      label: 'Rental',
      sortOrder: 0,
      metadata: { rateType: 'monthly', taxable: true },
      createdBy: 'system',
    },
    {
      category: 'source_type',
      value: 'PURCHASE',
      label: 'Purchase',
      sortOrder: 1,
      metadata: { rateType: 'one-time', taxable: true },
      createdBy: 'system',
    },
    {
      category: 'source_type',
      value: 'LEASE',
      label: 'Lease',
      sortOrder: 2,
      metadata: { rateType: 'monthly', taxable: true },
      createdBy: 'system',
    },
    {
      category: 'source_type',
      value: 'OWNED',
      label: 'Owned',
      sortOrder: 3,
      metadata: { rateType: 'none', taxable: false },
      createdBy: 'system',
    },

    // Notification Types
    {
      category: 'notification_type',
      value: 'SYNC_SUCCESS',
      label: 'Sync Successful',
      sortOrder: 0,
      metadata: { urgency: 'routine', channel: 'in_app' },
      createdBy: 'system',
    },
    {
      category: 'notification_type',
      value: 'SYNC_FAILED',
      label: 'Sync Failed',
      sortOrder: 1,
      metadata: { urgency: 'urgent', channel: 'email' },
      createdBy: 'system',
    },
    {
      category: 'notification_type',
      value: 'USER_ADDED',
      label: 'User Added',
      sortOrder: 2,
      metadata: { urgency: 'routine', channel: 'in_app' },
      createdBy: 'system',
    },
    {
      category: 'notification_type',
      value: 'PERMISSION_CHANGED',
      label: 'Permission Changed',
      sortOrder: 3,
      metadata: { urgency: 'important', channel: 'email' },
      createdBy: 'system',
    },
    {
      category: 'notification_type',
      value: 'SESSION_REVOKED',
      label: 'Session Revoked',
      sortOrder: 4,
      metadata: { urgency: 'urgent', channel: 'email' },
      createdBy: 'system',
    },

    // Units
    {
      category: 'unit',
      value: 'METER',
      label: 'Meters',
      sortOrder: 0,
      metadata: { conversionFactor: 1.0, unit: 'm', system: 'metric' },
      createdBy: 'system',
    },
    {
      category: 'unit',
      value: 'FEET',
      label: 'Feet',
      sortOrder: 1,
      metadata: { conversionFactor: 0.3048, unit: 'ft', system: 'imperial' },
      createdBy: 'system',
    },
    {
      category: 'unit',
      value: 'KILOGRAM',
      label: 'Kilograms',
      sortOrder: 2,
      metadata: { conversionFactor: 1.0, unit: 'kg', system: 'metric' },
      createdBy: 'system',
    },
    {
      category: 'unit',
      value: 'POUND',
      label: 'Pounds',
      sortOrder: 3,
      metadata: { conversionFactor: 0.453592, unit: 'lb', system: 'imperial' },
      createdBy: 'system',
    },
  ];

  let created = 0;
  let skipped = 0;

  for (const entry of entries) {
    const existing = await prisma.system_dictionary_entries.findUnique({
      where: {
        category_value: {
          category: entry.category,
          value: entry.value,
        },
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.system_dictionary_entries.create({
      data: {
        ...entry,
        id: randomUUID(),
        updatedAt: new Date(),
      },
    });

    created++;
  }

  console.log(`  ✓ Created ${created} dictionary entries`);
  console.log(`  ✓ Skipped ${skipped} existing entries`);
  console.log('✅ System dictionary seeded successfully');
}

// Run if called directly
if (require.main === module) {
  seedSystemDictionary()
    .catch((error) => {
      console.error('Error seeding system dictionary:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
