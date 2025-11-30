import fetch from 'node-fetch';
import { config } from 'dotenv';

config();

async function testPemsGridData() {
  // Use PEMS_READ credentials (same as PemsApiService which works for test connection)
  const url = process.env.PEMS_READ_ENDPOINT || 'https://us1.eam.hxgnsmartcloud.com:443/axis/restservices/griddata';
  const username = process.env.PEMS_READ_USERNAME || 'APIUSER';
  const password = process.env.PEMS_READ_PASSWORD;
  const tenant = process.env.PEMS_READ_TENANT || 'BECHTEL_DEV';

  console.log('Using PEMS_READ credentials:');
  console.log('  Endpoint:', url);
  console.log('  Username:', username);
  console.log('  Tenant:', tenant);

  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  const requestBody = {
    GRID: {
      NUMBER_OF_ROWS_FIRST_RETURNED: 10,
      RESULT_IN_SAXORDER: "TRUE",
      GRID_NAME: "CUPFAG",
      GRID_ID: "100541"
    },
    ADDON_FILTER: {
      ALIAS_NAME: "pfs_a_org",  // Use lowercase like PemsApiService
      OPERATOR: "BEGINS",
      VALUE: "RIO"
    },
    GRID_TYPE: {
      TYPE: "LIST"
    },
    REQUEST_TYPE: "LIST.DATA_ONLY.STORED"
  };

  console.log('\n===== REQUEST =====');
  console.log('URL:', url);
  console.log('Headers:');
  console.log('  Authorization: Basic [REDACTED]');
  console.log('  tenant:', tenant);
  console.log('  NOTE: NO organization header (like PemsApiService)');
  console.log('Body:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'tenant': tenant
        // NO organization header - PemsApiService doesn't use it
      },
      body: JSON.stringify(requestBody)
    });

    console.log('\n===== RESPONSE =====');
    console.log('Status:', response.status, response.statusText);

    const data = await response.json();
    console.log('\n===== RESPONSE BODY =====');
    console.log(JSON.stringify(data, null, 2));

    // Check for errors
    if (data.ErrorAlert && data.ErrorAlert.length > 0) {
      console.log('\n===== ERRORS =====');
      data.ErrorAlert.forEach((err: any) => {
        console.log(`- ${err.Name}: ${err.Message}`);
      });
    }

    // Check for warnings
    if (data.Result?.WarningAlert) {
      console.log('\n===== WARNINGS =====');
      console.log(JSON.stringify(data.Result.WarningAlert, null, 2));
    }

    // Check for info
    if (data.Result?.InfoAlert) {
      console.log('\n===== INFO =====');
      console.log(JSON.stringify(data.Result.InfoAlert, null, 2));
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testPemsGridData();
