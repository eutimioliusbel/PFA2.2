/**
 * Debug Financial Masking Response Structure
 *
 * Checks what the service returns for both viewFinancialDetails = true and false
 *
 * @usage
 * npx tsx backend/scripts/debug-mask-response.ts
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3001';
const API_BASE = `${BASE_URL}/api`;

const testRecords = [
  {
    id: 'test-1',
    description: 'CAT 336 Excavator',
    category: 'Excavators',
    source: 'Rental',
    monthlyRate: 15000,
    duration: 60,
    cost: 29606.30,
  },
  {
    id: 'test-2',
    description: 'Komatsu PC200 Excavator',
    category: 'Excavators',
    source: 'Rental',
    monthlyRate: 8000,
    duration: 30,
    cost: 7888.89,
  },
];

async function login() {
  const response = await axios.post(`${API_BASE}/auth/login`, {
    username: 'admin',
    password: 'admin123',
  });
  return response.data.token;
}

async function testMask(token: string, viewFinancialDetails: boolean) {
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`Testing with viewFinancialDetails = ${viewFinancialDetails}`);
  console.log(`═══════════════════════════════════════════════════════════\n`);

  try {
    const response = await axios.post(
      `${API_BASE}/financial/mask`,
      {
        records: testRecords,
        viewFinancialDetails,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

async function main() {
  const token = await login();
  console.log('✅ Logged in successfully\n');

  await testMask(token, true);  // With permission
  await testMask(token, false); // Without permission
}

main();
