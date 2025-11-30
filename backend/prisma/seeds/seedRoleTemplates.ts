/**
 * Seed Role Templates
 * ADR-005 Missing Components - Initial System Roles
 *
 * Creates default role templates for the system.
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

export async function seedRoleTemplates() {
  console.log('Seeding role templates...');

  const systemRoles = [
    {
      id: randomUUID(),
      name: 'Viewer',
      description: 'Read-only access to PFA data. Can export reports but cannot modify data.',
      isSystem: true,
      updatedAt: new Date(),
      perm_Read: true,
      perm_EditForecast: false,
      perm_EditActuals: false,
      perm_Delete: false,
      perm_Import: false,
      perm_RefreshData: false,
      perm_Export: true,
      perm_ViewFinancials: false,
      perm_SaveDraft: false,
      perm_Sync: false,
      perm_ManageUsers: false,
      perm_ManageSettings: false,
      perm_ConfigureAlerts: false,
      perm_Impersonate: false,
      capabilities: {
        export_csv: true,
        export_pdf: false,
        // Screen Access - Data Views only
        screen_TimelineLab: true,
        screen_MatrixLab: true,
        screen_GridLab: true,
        screen_Pfa10Lab: true,
        screen_Export: true,
      },
      createdBy: 'system',
    },
    {
      id: randomUUID(),
      name: 'Editor',
      description: 'Can edit forecast dates and costs. Cannot modify actuals or delete records.',
      isSystem: true,
      updatedAt: new Date(),
      perm_Read: true,
      perm_EditForecast: true,
      perm_EditActuals: false,
      perm_Delete: false,
      perm_Import: true,
      perm_RefreshData: false,
      perm_Export: true,
      perm_ViewFinancials: false,
      perm_SaveDraft: true,
      perm_Sync: false,
      perm_ManageUsers: false,
      perm_ManageSettings: false,
      perm_ConfigureAlerts: false,
      perm_Impersonate: false,
      capabilities: {
        export_csv: true,
        export_pdf: true,
        bulk_operations: true,
        // Screen Access - Data Views + Import
        screen_TimelineLab: true,
        screen_MatrixLab: true,
        screen_GridLab: true,
        screen_Pfa10Lab: true,
        screen_Export: true,
        screen_DataImport: true,
      },
      createdBy: 'system',
    },
    {
      id: randomUUID(),
      name: 'Portfolio Manager',
      description: 'Full data access including financials. Can edit forecasts and actuals.',
      isSystem: true,
      updatedAt: new Date(),
      perm_Read: true,
      perm_EditForecast: true,
      perm_EditActuals: true,
      perm_Delete: false,
      perm_Import: true,
      perm_RefreshData: true,
      perm_Export: true,
      perm_ViewFinancials: true,
      perm_SaveDraft: true,
      perm_Sync: true,
      perm_ManageUsers: false,
      perm_ManageSettings: false,
      perm_ConfigureAlerts: false,
      perm_Impersonate: false,
      capabilities: {
        export_csv: true,
        export_pdf: true,
        bulk_operations: true,
        advanced_filters: true,
        // Screen Access - Data Views + Operations + Master Data
        screen_TimelineLab: true,
        screen_MatrixLab: true,
        screen_GridLab: true,
        screen_Pfa10Lab: true,
        screen_Export: true,
        screen_DataImport: true,
        screen_MappingStudio: true,
        screen_MasterData: true,
        screen_SyncLogs: true,
        screen_SyncHealth: true,
      },
      createdBy: 'system',
    },
    {
      id: randomUUID(),
      name: 'BEO Analyst',
      description: 'Business Excellence Office role with financial access and cross-org analytics.',
      isSystem: true,
      updatedAt: new Date(),
      perm_Read: true,
      perm_EditForecast: true,
      perm_EditActuals: true,
      perm_Delete: false,
      perm_Import: true,
      perm_RefreshData: true,
      perm_Export: true,
      perm_ViewFinancials: true,
      perm_SaveDraft: true,
      perm_Sync: false,
      perm_ManageUsers: false,
      perm_ManageSettings: false,
      perm_ConfigureAlerts: true,
      perm_Impersonate: false,
      perm_ViewAllOrgs: true, // CVE-2024-BEO-001 fix: BEO needs cross-org access
      capabilities: {
        export_csv: true,
        export_pdf: true,
        bulk_operations: true,
        advanced_filters: true,
        kpi_analytics: true,
        // Screen Access - Data Views + Operations + BEO Intelligence
        screen_TimelineLab: true,
        screen_MatrixLab: true,
        screen_GridLab: true,
        screen_Pfa10Lab: true,
        screen_Export: true,
        screen_DataImport: true,
        screen_BeoGlass: true,
        screen_MasterData: true,
        screen_SyncLogs: true,
        screen_SyncHealth: true,
        // BEO Intelligence screens
        screen_NarrativeReader: true,
        screen_ArbitrageOpportunities: true,
        screen_VendorPricing: true,
        screen_ScenarioBuilder: true,
      },
      createdBy: 'system',
    },
    {
      id: randomUUID(),
      name: 'Administrator',
      description: 'Full system access including user management, settings, and impersonation.',
      isSystem: true,
      updatedAt: new Date(),
      perm_Read: true,
      perm_EditForecast: true,
      perm_EditActuals: true,
      perm_Delete: true,
      perm_Import: true,
      perm_RefreshData: true,
      perm_Export: true,
      perm_ViewFinancials: true,
      perm_SaveDraft: true,
      perm_Sync: true,
      perm_ManageUsers: true,
      perm_ManageSettings: true,
      perm_ConfigureAlerts: true,
      perm_Impersonate: true,
      perm_ViewAllOrgs: true, // CVE-2024-BEO-001 fix: Admin has full BEO access
      capabilities: {
        export_csv: true,
        export_pdf: true,
        bulk_operations: true,
        advanced_filters: true,
        kpi_analytics: true,
        system_diagnostics: true,
        // Screen Access - Full Access to All Screens
        screen_TimelineLab: true,
        screen_MatrixLab: true,
        screen_GridLab: true,
        screen_Pfa10Lab: true,
        screen_Export: true,
        screen_ApiConnectivity: true,
        screen_ApiServers: true,
        screen_DataImport: true,
        screen_MappingStudio: true,
        screen_FieldConfig: true,
        screen_BeoGlass: true,
        screen_Organizations: true,
        screen_SystemSettings: true,
        screen_Notifications: true,
        screen_UserManagement: true,
        screen_RoleTemplates: true,
        screen_MasterData: true,
        screen_AuditSearch: true,
        screen_RoleDrift: true,
        screen_AiUsageLogs: true,
        screen_SyncLogs: true,
        screen_SyncHealth: true,
        screen_NarrativeReader: true,
        screen_ArbitrageOpportunities: true,
        screen_VendorPricing: true,
        screen_ScenarioBuilder: true,
      },
      createdBy: 'system',
    },
  ];

  for (const role of systemRoles) {
    const existing = await prisma.role_templates.findUnique({
      where: { name: role.name },
    });

    if (existing) {
      console.log(`  ✓ Role template "${role.name}" already exists`);
      continue;
    }

    await prisma.role_templates.create({
      data: role,
    });

    console.log(`  ✓ Created role template: ${role.name}`);
  }

  console.log('✅ Role templates seeded successfully');
}

// Run if called directly
if (require.main === module) {
  seedRoleTemplates()
    .catch((error) => {
      console.error('Error seeding role templates:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
