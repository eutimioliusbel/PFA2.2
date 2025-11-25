/**
 * Database Seed Script
 *
 * Creates initial data for PFA Vanguard:
 * - Admin user (username: admin, password: admin123)
 * - Default organizations (HOLNG, PEMS_Global)
 * - AI provider configurations
 *
 * Run: npm run prisma:seed
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // ============================================================================
  // 1. Create Admin User
  // ============================================================================

  console.log('👤 Creating admin user...');
  const adminPassword = await bcrypt.hash('admin123', 10);

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@pfavanguard.com',
      passwordHash: adminPassword,
      firstName: 'System',
      lastName: 'Administrator',
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=System%20Administrator&backgroundColor=3b82f6',
      role: 'admin',
      isActive: true,
    },
  });

  console.log(`✓ Admin user created: ${adminUser.username} (${adminUser.id})`);
  console.log('  Login credentials: admin / admin123\n');

  // ============================================================================
  // Create Additional Users
  // ============================================================================

  console.log('👥 Creating additional users...');

  const rickRector = await prisma.user.upsert({
    where: { username: 'RRECTOR' },
    update: {},
    create: {
      username: 'RRECTOR',
      email: 'rick.rector@pfavanguard.com',
      passwordHash: await bcrypt.hash('password123', 10),
      firstName: 'Rick',
      lastName: 'Rector',
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Rick%20Rector&backgroundColor=10b981',
      role: 'user',
      isActive: true,
    },
  });

  const ubiRosa = await prisma.user.upsert({
    where: { username: 'UROSA' },
    update: {},
    create: {
      username: 'UROSA',
      email: 'ubi.rosa@pfavanguard.com',
      passwordHash: await bcrypt.hash('password123', 10),
      firstName: 'Ubi',
      lastName: 'Rosa',
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Ubi%20Rosa&backgroundColor=f59e0b',
      role: 'user',
      isActive: true,
    },
  });

  const calvinHurford = await prisma.user.upsert({
    where: { username: 'CHURFORD' },
    update: {},
    create: {
      username: 'CHURFORD',
      email: 'calvin.hurford@pfavanguard.com',
      passwordHash: await bcrypt.hash('password123', 10),
      firstName: 'Calvin',
      lastName: 'Hurford',
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Calvin%20Hurford&backgroundColor=8b5cf6',
      role: 'user',
      isActive: true,
    },
  });

  const tonyEstrada = await prisma.user.upsert({
    where: { username: 'TESTRADA' },
    update: {},
    create: {
      username: 'TESTRADA',
      email: 'tony.estrada@pfavanguard.com',
      passwordHash: await bcrypt.hash('password123', 10),
      firstName: 'Tony',
      lastName: 'Estrada',
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Tony%20Estrada&backgroundColor=ef4444',
      role: 'user',
      isActive: true,
    },
  });

  const steveBryson = await prisma.user.upsert({
    where: { username: 'SBRYSON' },
    update: {},
    create: {
      username: 'SBRYSON',
      email: 'steve.bryson@pfavanguard.com',
      passwordHash: await bcrypt.hash('password123', 10),
      firstName: 'Steve',
      lastName: 'Bryson',
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Steve%20Bryson&backgroundColor=06b6d4',
      role: 'user',
      isActive: true,
    },
  });

  console.log(`✓ User created: ${rickRector.firstName} ${rickRector.lastName} (${rickRector.username})`);
  console.log(`✓ User created: ${ubiRosa.firstName} ${ubiRosa.lastName} (${ubiRosa.username})`);
  console.log(`✓ User created: ${calvinHurford.firstName} ${calvinHurford.lastName} (${calvinHurford.username})`);
  console.log(`✓ User created: ${tonyEstrada.firstName} ${tonyEstrada.lastName} (${tonyEstrada.username})`);
  console.log(`✓ User created: ${steveBryson.firstName} ${steveBryson.lastName} (${steveBryson.username})`);
  console.log('  Default password for all users: password123\n');

  // ============================================================================
  // 2. Create Organizations
  // ============================================================================

  console.log('🏢 Creating organizations...');

  const holngOrg = await prisma.organization.upsert({
    where: { code: 'HOLNG' },
    update: {},
    create: {
      code: 'HOLNG',
      name: 'Houston LNG Project',
      description: 'Large-scale LNG facility construction project',
      logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=HOLNG&backgroundColor=3b82f6',
      isActive: true,
    },
  });

  const globalOrg = await prisma.organization.upsert({
    where: { code: 'PEMS_Global' },
    update: {},
    create: {
      code: 'PEMS_Global',
      name: 'Global PEMS Organization',
      description: 'System-wide organization for testing and development',
      logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=PEMS_Global&backgroundColor=10b981',
      isActive: true,
    },
  });

  const rioOrg = await prisma.organization.upsert({
    where: { code: 'RIO' },
    update: {},
    create: {
      code: 'RIO',
      name: 'RIO',
      description: 'RIO',
      logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=RIO&backgroundColor=f59e0b',
      isActive: true,
    },
  });

  const portArthurOrg = await prisma.organization.upsert({
    where: { code: 'PORTARTHUR' },
    update: {},
    create: {
      code: 'PORTARTHUR',
      name: 'PORTARTHUR',
      description: 'PORTARTHUR',
      logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=PORTARTHUR&backgroundColor=8b5cf6',
      isActive: true,
    },
  });

  console.log(`✓ Created organization: ${holngOrg.name} (${holngOrg.code})`);
  console.log(`✓ Created organization: ${globalOrg.name} (${globalOrg.code})`);
  console.log(`✓ Created organization: ${rioOrg.name} (${rioOrg.code})`);
  console.log(`✓ Created organization: ${portArthurOrg.name} (${portArthurOrg.code})\n`);

  // ============================================================================
  // 3. Link Admin to Organizations
  // ============================================================================

  console.log('🔗 Linking admin to organizations...');

  await prisma.userOrganization.upsert({
    where: {
      userId_organizationId: {
        userId: adminUser.id,
        organizationId: holngOrg.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      organizationId: holngOrg.id,
      role: 'owner',
    },
  });

  await prisma.userOrganization.upsert({
    where: {
      userId_organizationId: {
        userId: adminUser.id,
        organizationId: globalOrg.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      organizationId: globalOrg.id,
      role: 'owner',
    },
  });

  await prisma.userOrganization.upsert({
    where: {
      userId_organizationId: {
        userId: adminUser.id,
        organizationId: rioOrg.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      organizationId: rioOrg.id,
      role: 'owner',
    },
  });

  await prisma.userOrganization.upsert({
    where: {
      userId_organizationId: {
        userId: adminUser.id,
        organizationId: portArthurOrg.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      organizationId: portArthurOrg.id,
      role: 'owner',
    },
  });

  console.log(`✓ Admin linked to ${holngOrg.code}`);
  console.log(`✓ Admin linked to ${globalOrg.code}`);
  console.log(`✓ Admin linked to ${rioOrg.code}`);
  console.log(`✓ Admin linked to ${portArthurOrg.code}\n`);

  // ============================================================================
  // Link Users to HOLNG Organization
  // ============================================================================

  console.log('🔗 Linking users to organizations...');

  const users = [rickRector, ubiRosa, calvinHurford, tonyEstrada, steveBryson];

  for (const user of users) {
    await prisma.userOrganization.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: holngOrg.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        organizationId: holngOrg.id,
        role: 'member',
      },
    });
    console.log(`✓ ${user.username} linked to ${holngOrg.code}`);
  }

  console.log('');

  // ============================================================================
  // 4. Create AI Provider Configurations
  // ============================================================================

  console.log('🤖 Creating AI provider configurations...');

  const geminiProvider = await prisma.aiProvider.upsert({
    where: { id: 'gemini-default' },
    update: {},
    create: {
      id: 'gemini-default',
      type: 'gemini',
      name: 'Google Gemini (Default)',
      enabled: true,
      defaultModel: 'gemini-1.5-flash-002',
      availableModels: JSON.stringify([
        'gemini-1.5-flash-002',
        'gemini-1.5-pro-002',
        'gemini-2.0-flash-exp',
      ]),
      pricingInput: 0.075,   // $0.075 per 1M input tokens (Flash)
      pricingOutput: 0.30,   // $0.30 per 1M output tokens
      pricingCached: 0.01875, // 75% discount for cached tokens
      maxTokensPerRequest: 32768,
      maxRequestsPerMinute: 60,
      status: 'untested',
    },
  });

  const openaiProvider = await prisma.aiProvider.upsert({
    where: { id: 'openai-default' },
    update: {},
    create: {
      id: 'openai-default',
      type: 'openai',
      name: 'OpenAI GPT-4',
      enabled: false, // Disabled by default (requires API key)
      defaultModel: 'gpt-4-turbo-preview',
      availableModels: JSON.stringify([
        'gpt-4-turbo-preview',
        'gpt-4',
        'gpt-3.5-turbo',
      ]),
      pricingInput: 10.00,  // $10 per 1M input tokens (GPT-4 Turbo)
      pricingOutput: 30.00, // $30 per 1M output tokens
      maxTokensPerRequest: 128000,
      maxRequestsPerMinute: 60,
      status: 'untested',
    },
  });

  const anthropicProvider = await prisma.aiProvider.upsert({
    where: { id: 'anthropic-default' },
    update: {},
    create: {
      id: 'anthropic-default',
      type: 'anthropic',
      name: 'Anthropic Claude',
      enabled: false, // Disabled by default (requires API key)
      defaultModel: 'claude-3-5-sonnet-20241022',
      availableModels: JSON.stringify([
        'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229',
        'claude-3-haiku-20240307',
      ]),
      pricingInput: 3.00,   // $3 per 1M input tokens (Sonnet)
      pricingOutput: 15.00, // $15 per 1M output tokens
      maxTokensPerRequest: 200000,
      maxRequestsPerMinute: 60,
      status: 'untested',
    },
  });

  console.log(`✓ Created provider: ${geminiProvider.name}`);
  console.log(`✓ Created provider: ${openaiProvider.name} (disabled)`);
  console.log(`✓ Created provider: ${anthropicProvider.name} (disabled)\n`);

  // ============================================================================
  // 5. Create Organization AI Configurations
  // ============================================================================

  console.log('⚙️  Creating organization AI configurations...');

  await prisma.organizationAiConfig.upsert({
    where: { organizationId: holngOrg.id },
    update: {},
    create: {
      organizationId: holngOrg.id,
      enabled: true,
      accessLevel: 'full-access',
      primaryProviderId: geminiProvider.id,
      fallbackProviderIds: JSON.stringify([]),
      dailyLimitUsd: 10.00,
      monthlyLimitUsd: 100.00,
      alertThresholdPercent: 80,
      maxContextRecords: 50,
      includeHistoricalData: false,
      enableSemanticCache: true,
      cacheExpirationHours: 24,
    },
  });

  await prisma.organizationAiConfig.upsert({
    where: { organizationId: globalOrg.id },
    update: {},
    create: {
      organizationId: globalOrg.id,
      enabled: true,
      accessLevel: 'full-access',
      primaryProviderId: geminiProvider.id,
      fallbackProviderIds: JSON.stringify([]),
      dailyLimitUsd: 5.00,
      monthlyLimitUsd: 50.00,
      alertThresholdPercent: 80,
      maxContextRecords: 50,
      includeHistoricalData: false,
      enableSemanticCache: true,
      cacheExpirationHours: 24,
    },
  });

  console.log(`✓ AI config created for ${holngOrg.code} (daily: $10, monthly: $100)`);
  console.log(`✓ AI config created for ${globalOrg.code} (daily: $5, monthly: $50)\n`);

  // ============================================================================
  // 6. Create Global PEMS API Configurations (System-Wide, Admin-Only)
  // ============================================================================

  console.log('🔌 Creating global PEMS API configurations (system-wide)...');

  // PEMS PFA Read API - griddata endpoint for reading PFA records
  await prisma.apiConfiguration.upsert({
    where: { id: 'pems-global-pfa-read' },
    update: {},
    create: {
      id: 'pems-global-pfa-read',
      organizationId: null,  // NULL = global/system-wide
      name: 'PEMS - PFA Data (Read)',
      usage: 'PEMS_PFA_READ',
      url: 'https://us1.eam.hxgnsmartcloud.com:443/axis/restservices/griddata',
      authType: 'basic',
      operationType: 'read',
      feeds: JSON.stringify([{ entity: 'pfa', views: ['Timeline Lab', 'Matrix', 'Grid Lab', 'PFA 1.0 Lab', 'PFA Master Data'] }]),
      status: 'untested',
    },
  });

  // PEMS PFA Write API - UserDefinedScreenService for creating/updating PFA records
  await prisma.apiConfiguration.upsert({
    where: { id: 'pems-global-pfa-write' },
    update: {},
    create: {
      id: 'pems-global-pfa-write',
      organizationId: null,
      name: 'PEMS - PFA Data (Write)',
      usage: 'PEMS_PFA_WRITE',
      url: 'https://us1.eam.hxgnsmartcloud.com:443/axis/services/UserDefinedScreenService',
      authType: 'basic',
      operationType: 'write',
      feeds: JSON.stringify([{ entity: 'pfa', operation: 'write' }]),
      status: 'untested',
    },
  });

  // PEMS Assets API - assetdefaults endpoint (OpenAPI spec)
  await prisma.apiConfiguration.upsert({
    where: { id: 'pems-global-assets' },
    update: {},
    create: {
      id: 'pems-global-assets',
      organizationId: null,
      name: 'PEMS - Asset Master',
      usage: 'PEMS_ASSETS',
      url: 'https://us1.eam.hxgnsmartcloud.com:443/axis/restservices/assetdefaults',
      authType: 'basic',
      operationType: 'read',
      feeds: JSON.stringify([{ entity: 'asset_master', views: ['Asset Master'] }]),
      status: 'untested',
    },
  });

  // PEMS Classes API - categories endpoint (OpenAPI spec)
  await prisma.apiConfiguration.upsert({
    where: { id: 'pems-global-classes' },
    update: {},
    create: {
      id: 'pems-global-classes',
      organizationId: null,
      name: 'PEMS - Classes & Categories',
      usage: 'PEMS_CLASSES',
      url: 'https://us1.eam.hxgnsmartcloud.com:443/axis/restservices/categories',
      authType: 'basic',
      operationType: 'read',
      feeds: JSON.stringify([{ entity: 'classifications', views: ['Classifications Master Data'] }]),
      status: 'untested',
    },
  });

  console.log(`✓ PEMS PFA Read  (griddata endpoint)`);
  console.log(`✓ PEMS PFA Write (UserDefinedScreenService)`);
  console.log(`✓ PEMS Assets    (equipment/assets)`);
  console.log(`✓ PEMS Classes   (equipment/categories)\n`);

  // ============================================================================
  // 7. Create Global AI Provider API Configurations (Templates)
  // ============================================================================

  console.log('🤖 Creating global AI provider API templates...');

  // Google Gemini (Global Template)
  await prisma.apiConfiguration.upsert({
    where: { id: 'ai-global-gemini' },
    update: {},
    create: {
      id: 'ai-global-gemini',
      organizationId: null,  // NULL = global template
      name: 'Google Gemini AI',
      usage: 'AI_GEMINI',
      url: 'https://generativelanguage.googleapis.com/v1beta/models',
      authType: 'apiKey',
      operationType: 'read-write',
      status: 'untested',
    },
  });

  // OpenAI (Global Template)
  await prisma.apiConfiguration.upsert({
    where: { id: 'ai-global-openai' },
    update: {},
    create: {
      id: 'ai-global-openai',
      organizationId: null,
      name: 'OpenAI GPT',
      usage: 'AI_OPENAI',
      url: 'https://api.openai.com/v1',
      authType: 'apiKey',
      operationType: 'read-write',
      status: 'untested',
    },
  });

  // Anthropic Claude (Global Template)
  await prisma.apiConfiguration.upsert({
    where: { id: 'ai-global-anthropic' },
    update: {},
    create: {
      id: 'ai-global-anthropic',
      organizationId: null,
      name: 'Anthropic Claude',
      usage: 'AI_ANTHROPIC',
      url: 'https://api.anthropic.com/v1',
      authType: 'apiKey',
      operationType: 'read-write',
      status: 'untested',
    },
  });

  // Azure OpenAI (Global Template)
  await prisma.apiConfiguration.upsert({
    where: { id: 'ai-global-azure' },
    update: {},
    create: {
      id: 'ai-global-azure',
      organizationId: null,
      name: 'Azure OpenAI',
      usage: 'AI_AZURE',
      url: 'https://<your-resource>.openai.azure.com',
      authType: 'apiKey',
      operationType: 'read-write',
      status: 'untested',
    },
  });

  // xAI Grok (Global Template)
  await prisma.apiConfiguration.upsert({
    where: { id: 'ai-global-grok' },
    update: {},
    create: {
      id: 'ai-global-grok',
      organizationId: null,
      name: 'xAI Grok',
      usage: 'AI_GROK',
      url: 'https://api.x.ai/v1',
      authType: 'apiKey',
      operationType: 'read-write',
      status: 'untested',
    },
  });

  console.log(`✓ Google Gemini AI (global template)`);
  console.log(`✓ OpenAI GPT (global template)`);
  console.log(`✓ Anthropic Claude (global template)`);
  console.log(`✓ Azure OpenAI (global template)`);
  console.log(`✓ xAI Grok (global template)\n`);

  // ============================================================================
  // 8. Create Default Field Configuration
  // ============================================================================

  console.log('📋 Creating default field configuration...');

  const defaultFieldMappings = [
    { field: 'pfaId', label: 'PFA ID', enabled: true, order: 1 },
    { field: 'organization', label: 'Organization', enabled: true, order: 2 },
    { field: 'areaSilo', label: 'Area/Silo', enabled: true, order: 3 },
    { field: 'category', label: 'Category', enabled: true, order: 4 },
    { field: 'class', label: 'Class', enabled: true, order: 5 },
    { field: 'source', label: 'Source', enabled: true, order: 6 },
    { field: 'dor', label: 'DOR', enabled: true, order: 7 },
    { field: 'monthlyRate', label: 'Monthly Rate', enabled: true, order: 8 },
    { field: 'purchasePrice', label: 'Purchase Price', enabled: true, order: 9 },
    { field: 'manufacturer', label: 'Manufacturer', enabled: true, order: 10 },
    { field: 'model', label: 'Model', enabled: true, order: 11 },
    { field: 'originalStart', label: 'Plan Start', enabled: true, order: 12 },
    { field: 'originalEnd', label: 'Plan End', enabled: true, order: 13 },
    { field: 'forecastStart', label: 'Forecast Start', enabled: true, order: 14 },
    { field: 'forecastEnd', label: 'Forecast End', enabled: true, order: 15 },
    { field: 'actualStart', label: 'Actual Start', enabled: true, order: 16 },
    { field: 'actualEnd', label: 'Actual End', enabled: true, order: 17 },
    { field: 'equipment', label: 'Equipment', enabled: true, order: 18 },
    { field: 'contract', label: 'Contract', enabled: false, order: 19 },
    { field: 'isActualized', label: 'Is Actualized', enabled: false, order: 20 },
    { field: 'isDiscontinued', label: 'Is Discontinued', enabled: false, order: 21 },
    { field: 'isFundsTransferable', label: 'Is Funds Transferable', enabled: false, order: 22 }
  ];

  await prisma.fieldConfiguration.upsert({
    where: { id: 'default-pfa-config' },
    update: {},
    create: {
      id: 'default-pfa-config',
      organizationId: null, // Global default
      name: 'Standard PFA Export',
      description: 'Default field configuration for PFA data export/import',
      isDefault: true,
      fieldMappings: JSON.stringify(defaultFieldMappings),
      includeHeaders: true,
      dateFormat: 'YYYY-MM-DD',
      delimiter: ',',
      encoding: 'UTF-8',
    },
  });

  console.log(`✓ Default field configuration created\n`);

  // ============================================================================
  // Summary
  // ============================================================================

  console.log('✅ Database seed completed successfully!\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 Summary:');
  console.log('───────────────────────────────────────────────────────────');
  console.log(`   Users:                    6 (admin + 5 users)`);
  console.log(`   Organizations:            4 (HOLNG, PEMS_Global, RIO, PORTARTHUR)`);
  console.log(`   Global PEMS APIs:         4 (Read/Write PFA, Assets, Classes)`);
  console.log(`   Global AI API Templates:  5 (Gemini, OpenAI, Claude, Azure, Grok)`);
  console.log(`   AI Providers:             3 (Gemini enabled, OpenAI/Claude disabled)`);
  console.log(`   Field Configurations:     1 (Standard PFA Export)`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('🔐 Login Credentials:');
  console.log('   Admin:');
  console.log('     Username: admin');
  console.log('     Password: admin123');
  console.log('   ');
  console.log('   Users:');
  console.log('     RRECTOR, UROSA, CHURFORD, TESTRADA, SBRYSON');
  console.log('     Password: password123');
  console.log('');
  console.log('📌 New Architecture:');
  console.log('   • PEMS APIs are GLOBAL (admin-only, shared by all orgs)');
  console.log('   • AI providers are TEMPLATES (orgs add their own API keys)');
  console.log('   • Organizations add credentials via OrganizationApiCredentials');
  console.log('');
  console.log('🚀 IMPORTANT - Next Steps:');
  console.log('   1. Run: npx tsx init-pems-credentials.ts');
  console.log('      This will configure PEMS credentials for all organizations');
  console.log('   2. Start backend: cd backend && npm run dev');
  console.log('   3. Orgs: Add AI API keys for providers they want to use');
  console.log('   4. Test PEMS connections in Admin Dashboard');
  console.log('');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
