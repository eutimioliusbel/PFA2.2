import fetch from 'node-fetch';
import { config } from 'dotenv';

config();

async function testExactRequest() {
  const url = process.env.PEMS_READ_ENDPOINT || 'https://us1.eam.hxgnsmartcloud.com:443/axis/restservices/griddata';
  const username = process.env.PEMS_READ_USERNAME || 'APIUSER';
  const password = process.env.PEMS_READ_PASSWORD;
  const tenant = process.env.PEMS_READ_TENANT || 'BECHTEL_DEV';

  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  // EXACT request from PemsApiService
  const requestBody = {
    GRID: {
      GRID_NAME: 'CUPFAG',
      GRID_ID: '100541',
      NUMBER_OF_ROWS_FIRST_RETURNED: 10,
      RESULT_IN_SAXORDER: 'TRUE',
    },
    ADDON_SORT: {
      ALIAS_NAME: 'pfs_id',
      TYPE: 'ASC',
    },
    ADDON_FILTER: {
      ALIAS_NAME: 'pfs_a_org',
      OPERATOR: 'BEGINS',
      VALUE: 'RIO',
    },
    GRID_TYPE: { TYPE: 'LIST' },
    LOV_PARAMETER: { ALIAS_NAME: 'pfs_id' },
    REQUEST_TYPE: 'LIST.DATA_ONLY.STORED',
  };

  console.log('===== REQUEST (EXACT PemsApiService) =====');
  console.log('URL:', url);
  console.log('Headers:');
  console.log('  Authorization: Basic [REDACTED]');
  console.log('  tenant:', tenant);
  console.log('  NO organization header (like PemsApiService)');
  console.log('Body:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'tenant': tenant,
        // NO organization header
      },
      body: JSON.stringify(requestBody)
    });

    console.log('\n===== RESPONSE =====');
    console.log('Status:', response.status, response.statusText);

    const data = await response.json();

    // Extract data
    const records = data.Result?.ResultData?.GRID?.DATA?.ROW || [];
    const totalCount = data.Result?.ResultData?.GRID?.['TOTAL-COUNT'] || 0;

    console.log('\n===== SUMMARY =====');
    console.log('Total Count:', totalCount);
    console.log('Records Returned:', records.length);

    if (records.length > 0) {
      console.log('\n===== FIRST RECORD =====');
      console.log(JSON.stringify(records[0], null, 2));
    }

    if (data.ErrorAlert && data.ErrorAlert.length > 0) {
      console.log('\n===== ERRORS =====');
      data.ErrorAlert.forEach((err: any) => {
        console.log(`- ${err.Name}: ${err.Message}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testExactRequest();
