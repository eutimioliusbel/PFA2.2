# ADR-007: API Connectivity & Intelligence Layer - Test Strategy & Guardrails

> **Primary Agent**: `sdet-test-automation`
> **Instruction**: Define comprehensive testing for 3-layer architecture. Include security, performance, and data integrity tests.

**Status**: 🔴 Draft
**Created**: 2025-11-27
**Last Updated**: 2025-11-27

---

## ✅ 1. Critical User Flows (E2E Tests)

### Flow 1: Connect to PEMS Server (Happy Path)
**Description**: Admin successfully connects to PEMS and syncs data.

**Steps**:
1. Navigate to API Connectivity page
2. Click "+ Add Server"
3. Fill in: Name="PEMS Prod", URL="https://eam.test.com", Auth="Basic", User="admin", Pass="test123"
4. Click "Test Connection"
5. Verify success message: "✅ Connection successful"
6. Click "Save Server"
7. Verify server appears in list
8. Click "Sync Data" button
9. Wait for sync completion
10. Verify records appear in Bronze layer

**Assertions**:
```typescript
// Connection test
expect(connectionTestResponse.status).toBe(200);
expect(connectionTestResponse.data.sampleRecordCount).toBeGreaterThan(0);

// Server saved
const servers = await apiClient.getApiServers();
expect(servers.find(s => s.name === "PEMS Prod")).toBeDefined();

// Sync completed
const bronzeRecords = await prisma.bronzeRecord.count({
  where: { organizationId: testOrg.id }
});
expect(bronzeRecords).toBeGreaterThan(0);

// Response time
expect(connectionTestLatency).toBeLessThan(5000); // ms
```

---

### Flow 2: Create Field Mapping (Happy Path)
**Description**: Admin maps PEMS field to PFA field via Mapping Studio.

**Steps**:
1. Navigate to Mapping Studio
2. Select endpoint: "PEMS Production → PFA Records"
3. Wait for sample Bronze data to load
4. Drag "udf_char_01" field to "category" field
5. Verify preview shows mapped data
6. Click "Apply Mapping"
7. Verify success toast
8. Navigate to Transformation Service
9. Run transformation
10. Verify PfaRecord.category populated with values from udf_char_01

**Assertions**:
```typescript
// Mapping created
const mapping = await prisma.apiFieldMapping.findFirst({
  where: {
    sourceField: "udf_char_01",
    destinationField: "category"
  }
});
expect(mapping).toBeDefined();

// Preview works
const preview = await apiClient.previewMapping(mapping.id);
expect(preview.sampleRecords.length).toBe(100);
expect(preview.sampleRecords[0].category).toBeDefined();

// Transformation applied
const pfaRecords = await prisma.pfaRecord.findMany({
  where: { category: { not: null } }
});
expect(pfaRecords.length).toBeGreaterThan(0);
```

---

### Flow 3: Create Custom KPI (Happy Path)
**Description**: Admin creates KPI with mathjs formula.

**Steps**:
1. Navigate to KPI Manager
2. Click "New KPI"
3. Enter name: "Total Spend with Tax"
4. Enter formula: `{cost} * 1.15`
5. Click "Test Formula"
6. Verify preview shows sample result
7. Select format: "Currency"
8. Click "Save KPI"
9. Navigate to KPI Board
10. Verify KPI appears and calculates correctly

**Assertions**:
```typescript
// KPI created
const kpi = await prisma.kpiDefinition.findFirst({
  where: { name: "Total Spend with Tax" }
});
expect(kpi).toBeDefined();
expect(kpi.formula).toBe("{cost} * 1.15");

// Formula valid
const testResult = await apiClient.testKpiFormula({
  formula: "{cost} * 1.15",
  sampleData: { cost: 5000 }
});
expect(testResult.result).toBe(5750);

// KPI Board shows result
const kpiValue = await calculateKpi(kpi.id, testOrgId);
expect(kpiValue).toBeCloseTo(expected, 2); // Within $0.01
```

---

### Flow 4: Error Handling - Invalid PEMS Credentials
**Description**: System gracefully handles connection failures.

**Steps**:
1. Navigate to API Connectivity
2. Click "+ Add Server"
3. Enter invalid credentials
4. Click "Test Connection"
5. Verify error message

**Assertions**:
```typescript
expect(errorMessage).toContain("Connection Failed");
expect(errorMessage).toContain("401: Unauthorized");
expect(errorSuggestions).toContain("Check Credentials");

// No server saved
const servers = await apiClient.getApiServers();
expect(servers.find(s => s.baseUrl === testUrl)).toBeUndefined();
```

---

### Flow 5: Data Integrity - Bronze to Silver
**Description**: Transformation preserves data integrity from Bronze to Silver.

**Steps**:
1. Create Bronze records with known values
2. Create field mappings
3. Run transformation
4. Verify Silver records match Bronze

**Assertions**:
```typescript
// Bronze record
const bronze = await prisma.bronzeRecord.create({
  data: {
    rawJson: { id: "PFA-001", udf_char_01: "RENTAL", udf_num_01: 5000 },
    organizationId: testOrg.id,
    entityType: "PFA"
  }
});

// Run transformation
await transformationService.processBatch(bronze.syncBatchId);

// Verify Silver
const silver = await prisma.pfaRecord.findUnique({
  where: { id: "PFA-001" }
});
expect(silver.category).toBe("Rental"); // Transformed from "RENTAL"
expect(silver.cost).toBe(5000);
```

---

## 🛡️ 2. Security Red Teaming

### Attack 1: SQL Injection in Field Mapping
**Scenario**: Attacker tries SQL injection via sourceField.

**Test**:
```typescript
const maliciousInput = "'; DROP TABLE bronze_records; --";
const response = await apiClient.createFieldMapping({
  sourceField: maliciousInput,
  destinationField: "category"
});

// Should reject invalid input
expect(response.status).toBe(400);
expect(response.error).toContain("Invalid field name");

// Table still exists
const tableExists = await prisma.$queryRaw`SELECT 1 FROM bronze_records LIMIT 1`;
expect(tableExists).toBeDefined();
```

---

### Attack 2: XSS via API Server Name
**Scenario**: Attacker injects script tag in server name.

**Test**:
```typescript
const xssPayload = "<script>alert('XSS')</script>";
const server = await apiClient.createApiServer({
  name: xssPayload,
  baseUrl: "https://test.com",
  authType: "BASIC"
});

// Check UI rendering
const serverElement = await page.locator(`text=${xssPayload}`).first();
const innerHTML = await serverElement.innerHTML();
expect(innerHTML).not.toContain("<script"); // Escaped
expect(window.alertCalled).toBe(false);
```

---

### Attack 3: IDOR - Access Another Org's Mappings
**Scenario**: User A tries to access User B's field mappings.

**Test**:
```typescript
const userA = await loginAs("userA", "orgA");
const userB = await loginAs("userB", "orgB");

// UserB creates mapping
const mapping = await userB.createFieldMapping({
  sourceField: "test",
  destinationField: "category"
});

// UserA tries to access
const response = await userA.getFieldMapping(mapping.id);
expect(response.status).toBe(403); // Forbidden
expect(response.error).toBe("PERMISSION_DENIED");
```

---

### Attack 4: Formula Injection in KPI
**Scenario**: Attacker tries to execute arbitrary code via KPI formula.

**Test**:
```typescript
const maliciousFormula = "require('fs').readFileSync('/etc/passwd')";
const response = await apiClient.createKpi({
  name: "Malicious KPI",
  formula: maliciousFormula
});

// Should reject
expect(response.status).toBe(400);
expect(response.error).toContain("Invalid formula");

// Mathjs should sandbox execution
const testResult = await safeEvaluateFormula(maliciousFormula);
expect(testResult.error).toContain("require is not defined");
```

---

### Attack 5: Credential Extraction from Database
**Scenario**: Attacker gains database access and tries to extract API credentials.

**Test**:
```typescript
// Store credentials
const server = await prisma.apiServer.create({
  data: {
    name: "Test",
    baseUrl: "https://test.com",
    authType: "BASIC",
    encryptedCredentials: encrypt(JSON.stringify({
      username: "admin",
      password: "secret123"
    }))
  }
});

// Query database directly
const rawData = await prisma.$queryRaw`SELECT encrypted_credentials FROM api_servers WHERE id = ${server.id}`;
const encryptedCreds = rawData[0].encrypted_credentials;

// Should be encrypted
expect(encryptedCreds).not.toContain("admin");
expect(encryptedCreds).not.toContain("secret123");

// Decryption should require key
expect(() => JSON.parse(encryptedCreds)).toThrow();

// Valid decryption
const decrypted = decrypt(encryptedCreds);
expect(JSON.parse(decrypted).username).toBe("admin");
```

---

## ⚡ 3. Performance Benchmarks

### Benchmark 1: Ingestion Throughput
**Target**: 10,000 records per API call

**Test**:
```typescript
const startTime = Date.now();
await ingestionService.ingestBatch({
  endpointId: testEndpoint.id,
  recordCount: 10000
});
const duration = Date.now() - startTime;

expect(duration).toBeLessThan(30000); // 30 seconds max
const recordsPerSecond = 10000 / (duration / 1000);
expect(recordsPerSecond).toBeGreaterThan(300); // >300 rec/sec
```

---

### Benchmark 2: Transformation Latency
**Target**: <2 seconds per 1,000 records

**Test**:
```typescript
// Create 1,000 Bronze records
await createBronzeRecords(1000);

const startTime = Date.now();
await transformationService.processBatch(testBatchId);
const duration = Date.now() - startTime;

expect(duration).toBeLessThan(2000); // 2 seconds max
```

---

### Benchmark 3: Mapping Preview Speed
**Target**: <500ms for 100 sample records

**Test**:
```typescript
const startTime = Date.now();
const preview = await apiClient.previewMapping(mapping.id, { sampleSize: 100 });
const duration = Date.now() - startTime;

expect(duration).toBeLessThan(500); // 500ms max
expect(preview.sampleRecords.length).toBe(100);
```

---

### Benchmark 4: KPI Calculation Performance
**Target**: <500ms for 20K records

**Test**:
```typescript
const kpi = await createKpi({ formula: "{cost} * 1.15" });
const records = await createPfaRecords(20000);

const startTime = Date.now();
const result = await calculateKpi(kpi.id, testOrg.id);
const duration = Date.now() - startTime;

expect(duration).toBeLessThan(500); // 500ms max
expect(result.value).toBeGreaterThan(0);
```

---

## 🔒 4. Data Integrity Tests

### Test 1: Bronze Layer Immutability
**Description**: Bronze records are never updated or deleted.

**Test**:
```typescript
const bronze = await prisma.bronzeRecord.create({
  data: { rawJson: { id: "test" }, organizationId: testOrg.id, entityType: "PFA" }
});

// Attempt update (should fail)
await expect(
  prisma.bronzeRecord.update({
    where: { id: bronze.id },
    data: { rawJson: { id: "modified" } }
  })
).rejects.toThrow("Bronze records are immutable");

// Attempt delete (should fail)
await expect(
  prisma.bronzeRecord.delete({ where: { id: bronze.id } })
).rejects.toThrow("Bronze records cannot be deleted");
```

---

### Test 2: Idempotent Transformation
**Description**: Running transformation twice produces same result.

**Test**:
```typescript
// First transformation
await transformationService.processBatch(testBatchId);
const firstResult = await prisma.pfaRecord.findMany();

// Second transformation (same batch)
await transformationService.processBatch(testBatchId);
const secondResult = await prisma.pfaRecord.findMany();

expect(firstResult).toEqual(secondResult);
```

---

### Test 3: No Data Loss During Transformation
**Description**: Every Bronze record produces exactly one Silver record.

**Test**:
```typescript
const bronzeCount = await prisma.bronzeRecord.count({
  where: { syncBatchId: testBatchId }
});

await transformationService.processBatch(testBatchId);

const silverCount = await prisma.pfaRecord.count({
  where: { id: { in: /* IDs from Bronze */ } }
});

expect(silverCount).toBe(bronzeCount);
```

---

### Test 4: Orphan Detection
**Description**: Records not in PEMS sync are flagged as orphaned.

**Test**:
```typescript
// Create existing Silver records
await createPfaRecords([
  { id: "PFA-001" },
  { id: "PFA-002" },
  { id: "PFA-003" }
]);

// Sync only includes PFA-001 and PFA-002
await transformationService.processBatch(testBatchId, { fullSync: true });

// PFA-003 should be flagged
const orphan = await prisma.pfaRecord.findUnique({
  where: { id: "PFA-003" }
});
expect(orphan.isDiscontinued).toBe(true);
expect(orphan.lastSeenAt).toBeLessThan(new Date());
```

---

## 📊 5. Test Coverage Requirements

### Minimum Coverage Targets

| Category | Target | Priority |
|----------|--------|----------|
| Ingestion Service | 95% | P0 |
| Transformation Service | 95% | P0 |
| KPI Calculator | 90% | P0 |
| API Endpoints | 90% | P0 |
| React Components | 70% | P1 |

### Critical Code Paths (100% Coverage Required)

**Files that MUST have 100% coverage**:
- `backend/src/services/pems/PemsIngestionService.ts`
- `backend/src/services/pems/PemsTransformationService.ts`
- `backend/src/services/kpi/KpiCalculator.ts`
- `backend/src/utils/encryption.ts`

---

## 🧪 6. Test Automation Strategy

### Pre-Commit Hooks
```bash
npm run test:unit           # All unit tests
npm run test:security       # Security tests
npm run test:performance    # Performance benchmarks
npm run lint                # ESLint + Prettier
```

### CI Pipeline (GitHub Actions)
```yaml
on: [push, pull_request]
jobs:
  test:
    - Unit Tests (Services, Utils, API)
    - Integration Tests (E2E flows)
    - Security Tests (Red teaming)
    - Performance Benchmarks
    - Coverage Report (upload to Codecov)

  deploy:
    needs: test
    if: branch == 'main'
    - Deploy to staging
    - Run smoke tests
    - Deploy to production
```

---

## 📋 7. Test Execution Checklist

**Before Phase Launch**:
- [ ] All E2E tests passing (100%)
- [ ] All security tests passing (100%)
- [ ] Performance benchmarks met (100%)
- [ ] Code coverage >95% (backend services)
- [ ] Code coverage >90% (API endpoints)
- [ ] Code coverage >70% (React components)
- [ ] Manual QA testing complete
- [ ] Security audit by `ai-security-red-teamer` agent
- [ ] Load testing at 2x expected traffic (20K records)
- [ ] Rollback plan tested
- [ ] Data migration tested on staging
- [ ] Monitoring dashboards configured

---

## 📚 Related Documentation

- **Decision**: [ADR-007-DECISION.md](./ADR-007-DECISION.md)
- **AI Opportunities**: [ADR-007-AI_OPPORTUNITIES.md](./ADR-007-AI_OPPORTUNITIES.md)
- **UX Specification**: [ADR-007-UX_SPEC.md](./ADR-007-UX_SPEC.md)
- **Implementation Plan**: [ADR-007-IMPLEMENTATION_PLAN.md](./ADR-007-IMPLEMENTATION_PLAN.md)

---

**Status**: 🔴 Draft - Awaiting QA Review
**Next Action**: Implement test suites before starting development

*Document created: 2025-11-27*
*Test Plan Version: 1.0*
