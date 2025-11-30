/**
 * SQL Injection Security Test
 * Tests CRITICAL-001: SQL Injection via organizationId parameter
 *
 * Run: npm test -- sql-injection.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/server';
import prisma from '../../src/config/database';

describe('SQL Injection Attack Tests', () => {
  let authToken: string;
  let validOrgId: string;
  let validApiConfigId: string;

  beforeAll(async () => {
    // Login as test user
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'admin123'
      });

    authToken = loginRes.body.token;

    // Get valid organization
    const org = await prisma.organization.findFirst({
      where: { isActive: true }
    });
    validOrgId = org!.id;

    // Get valid API config
    const apiConfig = await prisma.apiConfiguration.findFirst({
      where: { isActive: true }
    });
    validApiConfigId = apiConfig!.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('[CRITICAL-001] Should reject SQL injection in organizationId', async () => {
    const maliciousPayloads = [
      // Classic SQL injection
      "'; DROP TABLE pfa_write_queue; --",

      // Union-based injection
      "' UNION SELECT * FROM users; --",

      // Boolean-based blind injection
      "' OR '1'='1",

      // Time-based blind injection
      "'; SELECT pg_sleep(10); --",

      // Stacked queries
      "'; DELETE FROM pfa_mirror WHERE 1=1; --",

      // Comment injection
      "uuid'/**/OR/**/1=1--",

      // Hex encoding
      "0x27204f52203d3d20",

      // Null byte injection
      "uuid\0'; DROP TABLE users; --"
    ];

    for (const payload of maliciousPayloads) {
      const res = await request(app)
        .post('/api/pems/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          organizationId: payload,
          apiConfigId: validApiConfigId,
          syncType: 'full'
        });

      // Should return 400 Bad Request (validation error)
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');

      console.log(`✅ Blocked SQL injection: ${payload.substring(0, 30)}...`);
    }
  });

  it('[CRITICAL-001] Should validate UUID format for organizationId', async () => {
    const invalidUuids = [
      'not-a-uuid',
      '12345',
      'invalid-uuid-format',
      'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      ''
    ];

    for (const invalidId of invalidUuids) {
      const res = await request(app)
        .post('/api/pems/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          organizationId: invalidId,
          apiConfigId: validApiConfigId,
          syncType: 'full'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/VALIDATION_ERROR|INVALID_REQUEST/);
    }
  });

  it('[CRITICAL-001] Should sanitize organizationId in query parameters', async () => {
    const maliciousOrgId = "uuid' OR 1=1; --";

    const res = await request(app)
      .get('/api/pems/sync/history')
      .query({ organizationId: maliciousOrgId })
      .set('Authorization', `Bearer ${authToken}`);

    // Should reject invalid UUID format
    expect(res.status).toBe(400);
  });

  it('[CRITICAL-001] Should prevent NoSQL injection attempts', async () => {
    // MongoDB-style NoSQL injection (if ever migrated)
    const noSqlPayloads = [
      { $ne: null },
      { $gt: '' },
      { $regex: '.*' }
    ];

    for (const payload of noSqlPayloads) {
      const res = await request(app)
        .post('/api/pems/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          organizationId: payload,
          apiConfigId: validApiConfigId,
          syncType: 'full'
        });

      expect(res.status).toBe(400);
    }
  });

  it('[PASS] Should accept valid UUID organizationId', async () => {
    const res = await request(app)
      .post('/api/pems/sync')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        organizationId: validOrgId,
        apiConfigId: validApiConfigId,
        syncType: 'full'
      });

    // Should succeed (409 if already running, 200 if started)
    expect([200, 409]).toContain(res.status);
  });

  it('[CRITICAL-001] Should verify table integrity after attack attempts', async () => {
    // Verify critical tables still exist
    const tables = ['pfa_mirror', 'pfa_write_queue', 'organization', 'user'];

    for (const table of tables) {
      const result = await prisma.$queryRawUnsafe(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = '${table}'
        );`
      );

      expect(result[0].exists).toBe(true);
      console.log(`✅ Table ${table} intact`);
    }
  });
});
