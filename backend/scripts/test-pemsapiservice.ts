import { PemsApiService } from './src/services/pems/PemsApiService';

async function testPemsApiService() {
  console.log('Testing PemsApiService.fetchPfaData() for RIO...\n');

  const pemsService = new PemsApiService();

  try {
    const data = await pemsService.fetchPfaData('RIO', 0, 10);

    console.log(`\n✅ SUCCESS! Fetched ${data.length} PFA records for RIO`);
    console.log('\n===== FIRST RECORD =====');
    console.log(JSON.stringify(data[0], null, 2));

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testPemsApiService();
