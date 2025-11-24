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
      role: 'admin',
      isActive: true,
    },
  });

  console.log(`✓ Admin user created: ${adminUser.username} (${adminUser.id})`);
  console.log('  Login credentials: admin / admin123\n');

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
      isActive: true,
    },
  });

  console.log(`✓ Created organization: ${holngOrg.name} (${holngOrg.code})`);
  console.log(`✓ Created organization: ${globalOrg.name} (${globalOrg.code})\n`);

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

  console.log(`✓ Admin linked to ${holngOrg.code}`);
  console.log(`✓ Admin linked to ${globalOrg.code}\n`);

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
  // 6. Create PEMS API Configuration
  // ============================================================================

  console.log('🔌 Creating PEMS API configuration...');

  await prisma.apiConfiguration.upsert({
    where: { id: 'pems-holng-read' },
    update: {},
    create: {
      id: 'pems-holng-read',
      organizationId: holngOrg.id,
      name: 'PEMS API (Read)',
      usage: 'PFA',
      url: process.env.PEMS_READ_ENDPOINT || 'https://us1.eam.hxgnsmartcloud.com:443/axis/restservices/griddata',
      authType: 'basic',
      operationType: 'read',
      status: 'untested',
    },
  });

  await prisma.apiConfiguration.upsert({
    where: { id: 'pems-holng-write' },
    update: {},
    create: {
      id: 'pems-holng-write',
      organizationId: holngOrg.id,
      name: 'PEMS API (Write)',
      usage: 'PFA',
      url: process.env.PEMS_WRITE_ENDPOINT || 'https://us1.eam.hxgnsmartcloud.com:443/axis/restservices/update',
      authType: 'basic',
      operationType: 'write',
      status: 'untested',
    },
  });

  console.log(`✓ PEMS read API configured for ${holngOrg.code}`);
  console.log(`✓ PEMS write API configured for ${holngOrg.code}\n`);

  // ============================================================================
  // Summary
  // ============================================================================

  console.log('✅ Database seed completed successfully!\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 Summary:');
  console.log('───────────────────────────────────────────────────────────');
  console.log(`   Users:         1 (admin)`);
  console.log(`   Organizations: 2 (HOLNG, PEMS_Global)`);
  console.log(`   AI Providers:  3 (Gemini enabled, OpenAI/Claude disabled)`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('🔐 Login Credentials:');
  console.log('   Username: admin');
  console.log('   Password: admin123');
  console.log('');
  console.log('🚀 Next Steps:');
  console.log('   1. Start backend: cd backend && npm run dev');
  console.log('   2. Test login:    curl -X POST http://localhost:3001/api/auth/login \\');
  console.log('                       -H "Content-Type: application/json" \\');
  console.log('                       -d \'{"username":"admin","password":"admin123"}\'');
  console.log('   3. Open Prisma Studio: npm run prisma:studio');
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
