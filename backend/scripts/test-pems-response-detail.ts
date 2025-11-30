import fetch from 'node-fetch';
import { getPrismaClient } from './src/config/database';
import { decrypt } from './src/utils/encryption';
import { config } from 'dotenv';

config();

const prisma = getPrismaClient();

async function testPemsResponseDetail() {
  try {
    // Get RIO organization
    const org = await prisma.organization.findFirst({
      where: { code: 'RIO' }
    });

    if (!org) {
      throw new Error('RIO organization not found');
    }

    console.log(`Testing PEMS Grid Data API for ${org.code}\n`);

    // Get API configuration
    const apiConfig = await prisma.apiConfiguration.findFirst({
      where: {
        usage: 'PEMS_PFA_READ',
        operationType: 'read'
      }
    });

    if (!apiConfig) {
      throw new Error('PEMS PFA Read API configuration not found');
    }

    // Extract credentials
    const username = apiConfig.authKeyEncrypted ? decrypt(apiConfig.authKeyEncrypted) : '';
    const password = apiConfig.authValueEncrypted ? decrypt(apiConfig.authValueEncrypted) : '';
    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    // Parse custom headers
    const customHeaders = JSON.parse(apiConfig.customHeaders || '[]');
    const tenant = customHeaders.find((h: any) => h.key === 'tenant')?.value || 'BECHTEL_DEV';

    console.log('=== REQUEST DETAILS ===');
    console.log(`URL: ${apiConfig.url}`);
    console.log(`Username: ${username}`);
    console.log(`Tenant: ${tenant}`);
    console.log(`Organization Header: ${org.code}`);
    console.log(`\n`);

    // Test 1: With filter for RIO
    console.log('TEST 1: With ADDON_FILTER for RIO\n');
    const requestBody1 = {
      GRID: {
        NUMBER_OF_ROWS_FIRST_RETURNED: 10,
        RESULT_IN_SAXORDER: 'TRUE',
        GRID_NAME: 'CUPFAG',
        GRID_ID: '100541'
      },
      ADDON_FILTER: {
        ALIAS_NAME: 'pfs_a_org',
        OPERATOR: 'BEGINS',
        VALUE: 'RIO'
      },
      GRID_TYPE: {
        TYPE: 'LIST'
      },
      LOV_PARAMETER: {
        ALIAS_NAME: 'pfs_id'
      },
      REQUEST_TYPE: 'LIST.DATA_ONLY.STORED'
    };

    console.log('Request Body:', JSON.stringify(requestBody1, null, 2));

    const response1 = await fetch(apiConfig.url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'tenant': tenant,
        'organization': org.code
      },
      body: JSON.stringify(requestBody1)
    });

    console.log(`\nResponse Status: ${response1.status} ${response1.statusText}`);

    const data1 = await response1.json() as any;

    console.log('\n=== RESPONSE STRUCTURE ===');
    console.log('Response Keys:', Object.keys(data1));

    if (data1.Result) {
      console.log('Result Keys:', Object.keys(data1.Result));
      if (data1.Result.ResultData) {
        console.log('ResultData Keys:', Object.keys(data1.Result.ResultData));
        if (data1.Result.ResultData.GRID) {
          console.log('GRID Keys:', Object.keys(data1.Result.ResultData.GRID));
          console.log('TOTAL-COUNT:', data1.Result.ResultData.GRID['TOTAL-COUNT']);
          console.log('DATA.ROW count:', data1.Result.ResultData.GRID.DATA?.ROW?.length || 0);

          if (data1.Result.ResultData.GRID.DATA?.ROW?.length > 0) {
            console.log('\n=== FIRST RECORD ===');
            console.log(JSON.stringify(data1.Result.ResultData.GRID.DATA.ROW[0], null, 2));
          }
        }
      }
    }

    if (data1.ErrorAlert && data1.ErrorAlert.length > 0) {
      console.log('\n=== ERRORS ===');
      data1.ErrorAlert.forEach((err: any) => {
        console.log(`- ${err.Name}: ${err.Message}`);
      });
    }

    // Test 2: Without filter (first 10 records from any org)
    console.log('\n\n=== TEST 2: Without ADDON_FILTER (any org) ===\n');
    const requestBody2 = {
      GRID: {
        NUMBER_OF_ROWS_FIRST_RETURNED: 10,
        RESULT_IN_SAXORDER: 'TRUE',
        GRID_NAME: 'CUPFAG',
        GRID_ID: '100541'
      },
      GRID_TYPE: {
        TYPE: 'LIST'
      },
      LOV_PARAMETER: {
        ALIAS_NAME: 'pfs_id'
      },
      REQUEST_TYPE: 'LIST.DATA_ONLY.STORED'
    };

    const response2 = await fetch(apiConfig.url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'tenant': tenant,
        'organization': org.code
      },
      body: JSON.stringify(requestBody2)
    });

    const data2 = await response2.json() as any;

    console.log('Response Status:', response2.status, response2.statusText);
    console.log('TOTAL-COUNT:', data2.Result?.ResultData?.GRID?.['TOTAL-COUNT']);
    console.log('DATA.ROW count:', data2.Result?.ResultData?.GRID?.DATA?.ROW?.length || 0);

    if (data2.Result?.ResultData?.GRID?.DATA?.ROW?.length > 0) {
      console.log('\n=== FIRST RECORD (without filter) ===');
      const firstRecord = data2.Result.ResultData.GRID.DATA.ROW[0];
      console.log(JSON.stringify(firstRecord, null, 2));
      console.log('\nOrganization field value:', firstRecord.PFS_A_ORG || 'NOT FOUND');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testPemsResponseDetail();
