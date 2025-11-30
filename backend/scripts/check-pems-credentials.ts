import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPemsCredentials() {
  try {
    // Get PEMS API configurations
    const configs = await prisma.api_configurations.findMany({
      where: {
        name: {
          contains: 'PEMS'
        }
      },
      select: {
        id: true,
        name: true,
        url: true,
        authType: true,
        usage: true,
        operationType: true,
        customHeaders: true
      }
    });

    console.log('=== PEMS API Configurations in Database ===');
    console.log(JSON.stringify(configs, null, 2));

    // Check .env credentials
    console.log('\n=== .env File Credentials ===');
    console.log('PEMS_READ_ENDPOINT:', process.env.PEMS_READ_ENDPOINT || 'NOT SET');
    console.log('PEMS_READ_USERNAME:', process.env.PEMS_READ_USERNAME || 'NOT SET');
    console.log('PEMS_READ_PASSWORD:', process.env.PEMS_READ_PASSWORD ? '[SET]' : 'NOT SET');
    console.log('PEMS_READ_TENANT:', process.env.PEMS_READ_TENANT || 'NOT SET');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPemsCredentials();
