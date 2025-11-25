import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Adding API configurations for PEMS_Global...\n');

  // Get PEMS_Global organization
  const globalOrg = await prisma.organization.findUnique({
    where: { code: 'PEMS_Global' }
  });

  if (!globalOrg) {
    console.error('❌ PEMS_Global organization not found');
    process.exit(1);
  }

  console.log(`Found organization: ${globalOrg.name} (${globalOrg.id})\n`);

  // Create PEMS API configurations
  await prisma.apiConfiguration.upsert({
    where: { id: 'pems-global-pfa' },
    update: {},
    create: {
      id: 'pems-global-pfa',
      organizationId: globalOrg.id,
      name: 'PEMS - PFA Data',
      usage: 'PEMS_PFA',
      url: 'https://us1.eam.hxgnsmartcloud.com:443/axis/restservices/griddata',
      authType: 'basic',
      operationType: 'read-write',
      status: 'untested',
    },
  });

  await prisma.apiConfiguration.upsert({
    where: { id: 'pems-global-assets' },
    update: {},
    create: {
      id: 'pems-global-assets',
      organizationId: globalOrg.id,
      name: 'PEMS - Asset Master',
      usage: 'PEMS_ASSETS',
      url: 'https://us1.eam.hxgnsmartcloud.com:443/axis/restservices/griddata',
      authType: 'basic',
      operationType: 'read',
      status: 'untested',
    },
  });

  await prisma.apiConfiguration.upsert({
    where: { id: 'pems-global-classes' },
    update: {},
    create: {
      id: 'pems-global-classes',
      organizationId: globalOrg.id,
      name: 'PEMS - Classes & Categories',
      usage: 'PEMS_CLASSES',
      url: 'https://us1.eam.hxgnsmartcloud.com:443/axis/restservices/griddata',
      authType: 'basic',
      operationType: 'read',
      status: 'untested',
    },
  });

  await prisma.apiConfiguration.upsert({
    where: { id: 'pems-global-users' },
    update: {},
    create: {
      id: 'pems-global-users',
      organizationId: globalOrg.id,
      name: 'PEMS - User Directory',
      usage: 'PEMS_USERS',
      url: 'https://us1.eam.hxgnsmartcloud.com:443/axis/restservices/griddata',
      authType: 'basic',
      operationType: 'read',
      status: 'untested',
    },
  });

  // Create AI provider configurations
  await prisma.apiConfiguration.upsert({
    where: { id: 'ai-global-gemini' },
    update: {},
    create: {
      id: 'ai-global-gemini',
      organizationId: globalOrg.id,
      name: 'Google Gemini AI',
      usage: 'AI_GEMINI',
      url: 'https://generativelanguage.googleapis.com/v1beta/models',
      authType: 'apiKey',
      operationType: 'read-write',
      status: 'untested',
    },
  });

  await prisma.apiConfiguration.upsert({
    where: { id: 'ai-global-openai' },
    update: {},
    create: {
      id: 'ai-global-openai',
      organizationId: globalOrg.id,
      name: 'OpenAI GPT',
      usage: 'AI_OPENAI',
      url: 'https://api.openai.com/v1',
      authType: 'apiKey',
      operationType: 'read-write',
      status: 'untested',
    },
  });

  await prisma.apiConfiguration.upsert({
    where: { id: 'ai-global-anthropic' },
    update: {},
    create: {
      id: 'ai-global-anthropic',
      organizationId: globalOrg.id,
      name: 'Anthropic Claude',
      usage: 'AI_ANTHROPIC',
      url: 'https://api.anthropic.com/v1',
      authType: 'apiKey',
      operationType: 'read-write',
      status: 'untested',
    },
  });

  await prisma.apiConfiguration.upsert({
    where: { id: 'ai-global-azure' },
    update: {},
    create: {
      id: 'ai-global-azure',
      organizationId: globalOrg.id,
      name: 'Azure OpenAI',
      usage: 'AI_AZURE',
      url: 'https://<your-resource>.openai.azure.com',
      authType: 'apiKey',
      operationType: 'read-write',
      status: 'untested',
    },
  });

  await prisma.apiConfiguration.upsert({
    where: { id: 'ai-global-grok' },
    update: {},
    create: {
      id: 'ai-global-grok',
      organizationId: globalOrg.id,
      name: 'xAI Grok',
      usage: 'AI_GROK',
      url: 'https://api.x.ai/v1',
      authType: 'apiKey',
      operationType: 'read-write',
      status: 'untested',
    },
  });

  console.log('✅ API configurations added for PEMS_Global!');
  console.log('\n📋 Summary:');
  console.log('   PEMS APIs: 4 (PFA, Assets, Classes, Users)');
  console.log('   AI APIs:   5 (Gemini, OpenAI, Claude, Azure, Grok)');

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
