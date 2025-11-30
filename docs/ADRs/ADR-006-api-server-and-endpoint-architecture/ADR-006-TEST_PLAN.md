# ADR-006: API Server and Endpoint Architecture - Test Strategy & Guardrails

> **Primary Agent**: `sdet-test-automation`
> **Instruction**: Define how we verify success BEFORE we write code. Include adversarial scenarios and security testing.

**Status**: 🔴 Draft
**Created**: 2025-11-26
**Last Updated**: 2025-11-26

---

## ✅ 1. Critical User Flows (E2E Tests)

### Flow 1: Create Server and Add Endpoints (Happy Path)
**Description**: Admin creates PEMS server and adds 7 endpoints successfully.

**Steps**:
1. Navigate to API Connectivity page
2. Click "+ Add Server"
3. Fill form:
   - Name: "PEMS Production"
   - Base URL: "https://pems.example.com"
   - Auth Type: "Basic"
   - Username: "APIUSER"
   - Password: "password123"
   - Tenant: "BECHTEL_DEV"
4. Click "Save Server"
5. Click "+ Add Endpoint"
6. Fill form:
   - Name: "Assets"
   - Path: "/assets"
   - Entity: "asset_master"
   - Operation: "read"
7. Click "Save Endpoint"
8. Repeat steps 5-7 for remaining 6 endpoints

**Assertions**:
```typescript
expect(serverList).toContain("PEMS Production");
expect(endpointCount).toBe(7);
expect(credentials).toBeEncrypted(); // Password not plaintext
expect(baseUrl).toBe("https://pems.example.com");
```

---

### Flow 2: Test Individual Endpoint
**Description**: Admin tests a single endpoint and sees health status.

**Steps**:
1. Expand "PEMS Production" server
2. Click "Test" button on "Assets" endpoint
3. Wait for test result

**Assertions**:
```typescript
expect(testButton).toShowLoadingState();
expect(responseTime).toBeLessThan(2000); // ms
expect(statusIndicator).toBeVisible();
expect(statusIndicator.text).toMatch(/Healthy|Failed/);
if (success) {
  expect(statusText).toMatch(/\d+ms/); // Shows latency
} else {
  expect(errorMessage).toBeVisible();
}
```

---

### Flow 3: Test All Endpoints (Bulk Test)
**Description**: Admin tests all 7 endpoints simultaneously.

**Steps**:
1. Click "Test All" button on server
2. Observe progress modal
3. Wait for completion

**Assertions**:
```typescript
expect(progressModal).toBeVisible();
expect(progressBar).toExist();
expect(testedEndpoints).toBe(7);
expect(summaryMessage).toMatch(/\d+\/7 passed/);
```

---

### Flow 4: Migrate Existing API Configs
**Description**: Migration script converts 7 old configs to 1 server + 7 endpoints.

**Steps**:
1. Verify 7 existing ApiConfiguration records exist
2. Run migration script: `npm run migrate:api-servers`
3. Verify migration results

**Assertions**:
```typescript
const oldConfigs = await prisma.apiConfiguration.count();
expect(oldConfigs).toBe(0); // Old configs archived/deleted

const newServers = await prisma.apiServer.count();
expect(newServers).toBe(1); // 1 PEMS server created

const newEndpoints = await prisma.apiEndpoint.count();
expect(newEndpoints).toBe(7); // 7 endpoints created

// Verify credentials transferred
const server = await prisma.apiServer.findFirst();
expect(server.authKeyEncrypted).toBeTruthy();
expect(server.baseUrl).toBe("https://us1.eam.hxgnsmartcloud.com:443/axis/restservices");

// Verify DataSourceMappings updated
const mappings = await prisma.dataSourceMapping.findMany();
expect(mappings.every(m => m.apiEndpointId)).toBe(true);
```

---

### Flow 5: Error Handling - Invalid Credentials
**Description**: Admin enters invalid credentials, test fails gracefully.

**Steps**:
1. Create server with invalid credentials
2. Test endpoint
3. Observe error handling

**Assertions**:
```typescript
expect(testResult.success).toBe(false);
expect(testResult.errorType).toBe("AUTH_FAILURE");
expect(errorMessage).toContain("401 Unauthorized");
expect(suggestedAction).toContain("Update credentials");
```

---

### Flow 6: Test Connection Before Save (Operational Safety)
**Description**: Admin must test connection before saving server with critical changes.

**Steps**:
1. Click "Edit Server" on PEMS Production (has 7 endpoints)
2. Change Base URL to new value
3. Observe "Save" button state
4. Click "Test Connection" button
5. Wait for connection test result
6. If successful, "Save" button becomes enabled

**Assertions**:
```typescript
// Initially, Save button should be disabled after critical field changes
expect(saveButton).toBeDisabled();
expect(testConnectionButton).toBeVisible();

// After successful connection test
await clickTestConnection();
expect(connectionStatus).toMatch(/Success|Connected/);
expect(saveButton).toBeEnabled();

// If connection test fails
await clickTestConnection(); // with invalid URL
expect(connectionStatus).toMatch(/Failed|Error/);
expect(saveButton).toBeDisabled(); // Still disabled
expect(errorMessage).toContain("Cannot connect to server");
```

**Critical Field Changes** (require test before save):
- Base URL modification
- Auth credentials (username/password) modification
- Auth Type change (Basic → Bearer, etc.)

**Non-Critical Changes** (can save immediately):
- Server name
- Description
- Status (active/inactive)

---

### Flow 7: Impact Warning for High-Risk Changes
**Description**: Admin sees warning when modifying server that affects multiple endpoints.

**Steps**:
1. Click "Edit Server" on PEMS Production (has 7 endpoints)
2. Change Base URL
3. Click "Test Connection" (succeeds)
4. Click "Save"
5. See impact warning modal

**Assertions**:
```typescript
expect(impactWarningModal).toBeVisible();
expect(warningMessage).toContain("7 endpoints"); // Blast radius shown
expect(warningMessage).toContain("active data syncs"); // Mentions syncs
expect(confirmButton).toHaveText("Yes, Update Server");
expect(cancelButton).toBeVisible();

// After confirmation
await clickConfirm();
expect(successMessage).toBeVisible();
expect(auditLog).toContain("User admin updated server PEMS Production");
```

**Impact Warning Criteria**:
- Server has >3 endpoints
- Server is used by active DataSourceMappings
- Change involves credentials or Base URL

---

## 🛡️ 2. Security Red Teaming

### Attack 1: SQL Injection via Server Name
**Scenario**: Attacker attempts SQL injection via server name field.

**Test**:
```typescript
const maliciousInput = "'; DROP TABLE api_servers; --";
const response = await createServer({ name: maliciousInput });

expect(response.status).not.toBe(500); // No internal server error
expect(await tableExists("api_servers")).toBe(true); // Table still exists
expect(response.data?.name).toBe(maliciousInput); // Stored as-is, not executed
```

---

### Attack 2: Credential Exposure in API Response
**Scenario**: Attacker tries to read server credentials via API.

**Test**:
```typescript
const server = await createServer({
  name: "Test",
  authKeyEncrypted: "encrypted_username",
  authValueEncrypted: "encrypted_password"
});

const response = await getServer(server.id);
expect(response.authKeyEncrypted).toBeUndefined(); // Not exposed in API
expect(response.authValueEncrypted).toBeUndefined(); // Not exposed in API
expect(response.baseUrl).toBeTruthy(); // Public fields still available
expect(response.hasCredentials).toBe(true); // Flag indicates credentials exist
```

**Write-Only Pattern**: When editing a server, the password field must follow the "write-only" pattern:
```typescript
// GET /api/servers/:id - Never return actual passwords
const editResponse = await getServer(serverId);
expect(editResponse.authKey).toBeUndefined(); // Password never sent to frontend
expect(editResponse.authValue).toBeUndefined();
expect(editResponse.hasCredentials).toBe(true); // Only flag

// PUT /api/servers/:id - Empty field preserves existing password
const updateResponse = await updateServer(serverId, {
  name: "Updated Name",
  authKey: "",  // Empty = keep existing password
  authValue: "" // Empty = keep existing password
});
expect(updateResponse.success).toBe(true);

// Verify old credentials still work
const testResult = await testEndpoint(endpointId);
expect(testResult.success).toBe(true); // Old credentials preserved

// PUT with new password - Only updates if explicitly provided
const updateWithNewPassword = await updateServer(serverId, {
  authKey: "new_username",
  authValue: "new_password"
});
expect(updateWithNewPassword.success).toBe(true);
```

---

### Attack 3: IDOR - Access Another Org's Server
**Scenario**: User A tries to access User B's server configuration.

**Test**:
```typescript
const userA = await loginAs("userA", "BECH");
const userB = await loginAs("userB", "HOLNG");

const serverB = await userB.createServer({ name: "HOLNG Server" });

const response = await userA.getServer(serverB.id);
expect(response.status).toBe(403); // Forbidden
expect(response.body.error).toBe("PERMISSION_DENIED");
```

---

### Attack 4: Endpoint Path Traversal
**Scenario**: Attacker tries path traversal via endpoint path field.

**Test**:
```typescript
const maliciousPath = "../../etc/passwd";
const endpoint = await createEndpoint({
  serverId: "valid-server-id",
  path: maliciousPath
});

// When testing endpoint, URL construction should fail safely
const testResult = await testEndpoint(endpoint.id);
expect(testResult.success).toBe(false);
expect(testResult.errorMessage).toContain("Invalid path");
expect(testResult.requestUrl).not.toContain("../../"); // Sanitized
```

---

### Attack 5: Credential Stuffing - Rate Limiting
**Scenario**: Attacker tries to brute force server credentials.

**Test**:
```typescript
const attempts = Array(100).fill(null).map((_, i) =>
  createServer({ name: `Test${i}`, authKey: `user${i}`, authValue: `pass${i}` })
);

const responses = await Promise.all(attempts);
const rateLimited = responses.filter(r => r.status === 429);
expect(rateLimited.length).toBeGreaterThan(0); // Some requests blocked
```

---

## ⚡ 3. Performance Benchmarks

### Benchmark 1: URL Construction Overhead
**Target**: <1ms per URL construction

**Test**:
```typescript
const server = { baseUrl: "https://pems.example.com" };
const endpoint = { path: "/assets" };

const iterations = 10000;
const startTime = performance.now();

for (let i = 0; i < iterations; i++) {
  const url = constructUrl(server, endpoint);
}

const endTime = performance.now();
const avgTime = (endTime - startTime) / iterations;

expect(avgTime).toBeLessThan(0.001); // <1ms per URL
```

---

### Benchmark 2: Test Single Endpoint
**Target**: <500ms for successful test

**Test**:
```typescript
const response = await measureLatency(async () =>
  await testEndpoint(endpointId)
);

expect(response.latency).toBeLessThan(500); // ms
expect(response.data.success).toBe(true);
expect(response.data.responseTimeMs).toBeLessThan(2000); // PEMS API latency
```

---

### Benchmark 3: Test All Endpoints (Sequential)
**Target**: <10 seconds for 7 endpoints

**Test**:
```typescript
const startTime = Date.now();
const results = await testAllEndpoints(serverId);
const endTime = Date.now();

expect(endTime - startTime).toBeLessThan(10000); // ms
expect(results.testedCount).toBe(7);
```

---

### Benchmark 4: Migration Script Performance
**Target**: <5 seconds to migrate 7 configs

**Test**:
```typescript
// Setup: Create 7 old ApiConfiguration records
await seedOldConfigs(7);

const startTime = Date.now();
await runMigration();
const endTime = Date.now();

expect(endTime - startTime).toBeLessThan(5000); // ms
expect(await prisma.apiServer.count()).toBe(1);
expect(await prisma.apiEndpoint.count()).toBe(7);
```

---

## 🔒 4. Data Integrity Tests

### Test 1: Credential Encryption
**Description**: Credentials must be encrypted before storage.

**Test**:
```typescript
const server = await createServer({
  authKey: "plaintext_username",
  authValue: "plaintext_password"
});

const dbRecord = await prisma.apiServer.findUnique({ where: { id: server.id } });
expect(dbRecord.authKeyEncrypted).not.toBe("plaintext_username");
expect(dbRecord.authValueEncrypted).not.toBe("plaintext_password");

// Decryption works
const decryptedKey = decrypt(dbRecord.authKeyEncrypted);
expect(decryptedKey).toBe("plaintext_username");
```

---

### Test 2: Cascading Delete - Server → Endpoints
**Description**: Deleting server should delete associated endpoints.

**Test**:
```typescript
const server = await createServer({ name: "Test Server" });
const endpoint1 = await createEndpoint({ serverId: server.id, name: "EP1" });
const endpoint2 = await createEndpoint({ serverId: server.id, name: "EP2" });

await deleteServer(server.id);

expect(await prisma.apiServer.count()).toBe(0);
expect(await prisma.apiEndpoint.count()).toBe(0); // Cascaded delete
```

---

### Test 3: Migration Preserves DataSourceMappings
**Description**: Migration must update DataSourceMappings to point to new endpoints.

**Test**:
```typescript
// Before migration
const oldMapping = await prisma.dataSourceMapping.findFirst();
expect(oldMapping.apiConfigurationId).toBeTruthy();
expect(oldMapping.apiEndpointId).toBeNull();

// Run migration
await runMigration();

// After migration
const newMapping = await prisma.dataSourceMapping.findFirst({ where: { id: oldMapping.id } });
expect(newMapping.apiConfigurationId).toBeNull();
expect(newMapping.apiEndpointId).toBeTruthy();

// Verify mapping still works (can resolve to URL)
const url = await resolveDataSourceUrl(newMapping.id);
expect(url).toContain("https://"); // Valid URL constructed
```

---

### Test 4: Unique Constraint - Server Path Uniqueness
**Description**: Cannot create duplicate endpoints (same path) on same server.

**Test**:
```typescript
const server = await createServer({ name: "Test" });
await createEndpoint({ serverId: server.id, path: "/assets" });

// Attempt duplicate
await expect(
  createEndpoint({ serverId: server.id, path: "/assets" })
).rejects.toThrow("Unique constraint violation");
```

---

## 📊 5. Test Coverage Requirements

### Minimum Coverage Targets

| Category | Target | Priority |
|----------|--------|----------|
| Server/Endpoint Services | 95% | P0 |
| API Endpoints | 90% | P0 |
| Migration Script | 100% | P0 |
| React Components | 70% | P1 |
| Integration Tests | 85% | P0 |

### Critical Code Paths (100% Coverage Required)

**Files that MUST have 100% coverage**:
- `backend/src/services/apiServerService.ts`
- `backend/src/services/apiEndpointService.ts`
- `backend/scripts/migrate-api-servers.ts`
- `backend/src/utils/urlConstructor.ts`

---

## 🧪 6. Test Automation Strategy

### Pre-Commit Hooks
```bash
npm run test:unit           # All unit tests
npm run test:integration    # Integration tests
npm run test:security       # Security tests (SQL injection, XSS)
npm run lint                # ESLint + Prettier
```

### CI Pipeline (GitHub Actions)
```yaml
on: [push, pull_request]
jobs:
  test:
    - Unit Tests (backend + frontend)
    - Integration Tests
    - Migration Tests (rollback safety)
    - Security Red Team Tests
    - Performance Benchmarks
    - Coverage Report (upload to Codecov)
```

### Migration Testing Strategy
```bash
# Test forward migration
npm run migrate:api-servers

# Test rollback
npm run migrate:api-servers:rollback

# Verify data integrity after rollback
npm run test:migration:verify
```

---

## 📋 7. Test Execution Checklist

**Before Feature Launch**:
- [ ] All E2E tests passing (100%)
- [ ] All security tests passing (100%)
- [ ] Performance benchmarks met (100%)
- [ ] Migration tested on staging data (7 PEMS configs)
- [ ] Migration rollback tested and verified
- [ ] Code coverage >95% (backend services), >70% (frontend)
- [ ] Manual QA testing complete
- [ ] Security audit by `ai-security-red-teamer` agent
- [ ] Load testing at 50 concurrent endpoint tests
- [ ] Credential encryption verified (no plaintext in DB)

---

## 📚 Related Documentation

- **Decision**: [ADR-006-DECISION.md](./ADR-006-DECISION.md)
- **AI Opportunities**: [ADR-006-AI_OPPORTUNITIES.md](./ADR-006-AI_OPPORTUNITIES.md)
- **UX Specification**: [ADR-006-UX_SPEC.md](./ADR-006-UX_SPEC.md)
- **Implementation Plan**: [ADR-006-IMPLEMENTATION_PLAN.md](./ADR-006-IMPLEMENTATION_PLAN.md)

---

**Status**: 🔴 Draft - Awaiting QA Review
**Next Action**: Implement test suites before starting development

*Document created: 2025-11-26*
*Test Plan Version: 1.0*
