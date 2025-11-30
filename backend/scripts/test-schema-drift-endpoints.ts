/**
 * Test script for Schema Drift & Mapping Version API endpoints
 * Usage: npx ts-node scripts/test-schema-drift-endpoints.ts
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api';
const ENDPOINT_ID = 'test-endpoint-id'; // Replace with actual endpoint ID

async function login(): Promise<string> {
  const response = await axios.post(`${BASE_URL}/auth/login`, {
    email: 'admin@demo.com',
    password: 'admin123'
  });
  return response.data.token;
}

async function testSchemaDrift(token: string): Promise<void> {
  console.log('\n1. Testing GET /api/endpoints/:endpointId/schema-drift');
  try {
    const response = await axios.get(
      `${BASE_URL}/endpoints/${ENDPOINT_ID}/schema-drift`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    console.log('✓ Schema drift analysis:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.log('✗ Failed:', error.response?.data || error.message);
  }
}

async function testMappingVersions(token: string): Promise<void> {
  console.log('\n2. Testing GET /api/endpoints/:endpointId/mapping-versions');
  try {
    const response = await axios.get(
      `${BASE_URL}/endpoints/${ENDPOINT_ID}/mapping-versions`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    console.log('✓ Mapping versions:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.log('✗ Failed:', error.response?.data || error.message);
  }
}

async function testMappingVersionDetail(token: string, versionId: string): Promise<void> {
  console.log('\n3. Testing GET /api/endpoints/:endpointId/mapping-versions/:versionId');
  try {
    const response = await axios.get(
      `${BASE_URL}/endpoints/${ENDPOINT_ID}/mapping-versions/${versionId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    console.log('✓ Version detail:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.log('✗ Failed:', error.response?.data || error.message);
  }
}

async function testBatchCreate(token: string): Promise<void> {
  console.log('\n4. Testing POST /api/endpoints/:endpointId/mappings/batch');
  try {
    const response = await axios.post(
      `${BASE_URL}/endpoints/${ENDPOINT_ID}/mappings/batch`,
      {
        mappings: [
          {
            sourceField: 'test_field_1',
            destinationField: 'testField1',
            transformType: 'direct',
            dataType: 'string'
          },
          {
            sourceField: 'test_field_2',
            destinationField: 'testField2',
            transformType: 'uppercase',
            dataType: 'string'
          }
        ]
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    console.log('✓ Batch create result:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.log('✗ Failed:', error.response?.data || error.message);
  }
}

async function testRestoreVersion(token: string, versionId: string): Promise<void> {
  console.log('\n5. Testing POST /api/endpoints/:endpointId/mapping-versions/:versionId/restore');
  try {
    const response = await axios.post(
      `${BASE_URL}/endpoints/${ENDPOINT_ID}/mapping-versions/${versionId}/restore`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    console.log('✓ Restore result:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.log('✗ Failed:', error.response?.data || error.message);
  }
}

async function main() {
  try {
    console.log('Schema Drift & Mapping Version API Endpoint Tests');
    console.log('==================================================');

    const token = await login();
    console.log('✓ Authenticated successfully');

    await testSchemaDrift(token);
    await testMappingVersions(token);

    // Test version detail with a placeholder version ID
    // Replace with actual version ID from previous call
    await testMappingVersionDetail(token, 'version_2025-11-28T10:00:00.000Z');

    await testBatchCreate(token);

    // Test restore with a placeholder version ID
    await testRestoreVersion(token, 'version_2025-11-28T10:00:00.000Z');

    console.log('\n==================================================');
    console.log('All endpoint tests completed');
  } catch (error: any) {
    console.error('Test suite failed:', error.message);
    process.exit(1);
  }
}

main();
