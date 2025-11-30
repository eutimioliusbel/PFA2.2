# ADR-008: TEST PLAN - Bi-directional PEMS Synchronization

**Status**: Planning Phase
**Created**: 2025-11-28
**Last Updated**: 2025-11-28

---

## Testing Strategy Overview

**Testing Pyramid**:
```
      /\
     /  \  E2E Tests (10 tests)
    /____\
   /      \  Integration Tests (30 tests)
  /________\
 /          \  Unit Tests (100+ tests)
/____________\
```

**Coverage Goals**:
- Unit Test Coverage: 90%
- Integration Test Coverage: 80%
- Critical Path E2E Coverage: 100%

---

## Unit Tests

### 1. Write Sync Worker Tests

**File**: `backend/tests/unit/PemsWriteSyncWorker.test.ts`

**Test Cases**:

```typescript
describe('PemsWriteSyncWorker', () => {
  describe('Batch Processing', () => {
    it('should batch modifications for sync', async () => {
      const modifications = createMockModifications(150);
      const batches = worker.createBatches(modifications, 100);
      expect(batches).toHaveLength(2);
      expect(batches[0]).toHaveLength(100);
      expect(batches[1]).toHaveLength(50);
    });

    it('should respect batch size limit', async () => {
      const modifications = createMockModifications(500);
      const batches = worker.createBatches(modifications, 100);
      expect(batches.every(b => b.length <= 100)).toBe(true);
    });

    it('should maintain modification order in batches', async () => {
      const modifications = [
        createModification({ priority: 1 }),
        createModification({ priority: 2 }),
        createModification({ priority: 0 }),
      ];
      const batches = worker.createBatches(modifications, 10);
      expect(batches[0][0].priority).toBe(2); // Highest priority first
    });
  });

  describe('Conflict Detection', () => {
    it('should detect version conflicts', async () => {
      const modification = createModification({ baseVersion: 1 });
      const mirror = createMirror({ version: 3 });
      const conflict = worker.detectConflict(modification, mirror);
      expect(conflict).toBeTruthy();
      expect(conflict.localVersion).toBe(1);
      expect(conflict.pemsVersion).toBe(3);
    });

    it('should not flag conflicts when versions match', async () => {
      const modification = createModification({ baseVersion: 2 });
      const mirror = createMirror({ version: 2 });
      const conflict = worker.detectConflict(modification, mirror);
      expect(conflict).toBeFalsy();
    });

    it('should identify conflicting fields', async () => {
      const modification = createModification({
        baseVersion: 1,
        delta: { forecastStart: new Date('2025-01-15') }
      });
      const mirror = createMirror({
        version: 2,
        data: { forecastStart: new Date('2025-01-20') }
      });
      const conflict = worker.detectConflict(modification, mirror);
      expect(conflict.conflictFields).toContain('forecastStart');
    });
  });

  describe('Retry Logic', () => {
    it('should retry transient errors with exponential backoff', async () => {
      let attempts = 0;
      const operation = jest.fn(() => {
        attempts++;
        if (attempts < 3) throw new NetworkError('Connection timeout');
        return Promise.resolve({ success: true });
      });

      await worker.syncWithRetry(operation);
      expect(attempts).toBe(3);
    });

    it('should respect max retry attempts', async () => {
      const operation = jest.fn(() => {
        throw new NetworkError('Always fails');
      });

      await expect(worker.syncWithRetry(operation, { maxRetries: 3 }))
        .rejects.toThrow(NetworkError);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry permanent errors', async () => {
      const operation = jest.fn(() => {
        throw new ValidationError('Invalid data');
      });

      await expect(worker.syncWithRetry(operation))
        .rejects.toThrow(ValidationError);
      expect(operation).toHaveBeenCalledTimes(1); // No retries
    });

    it('should calculate exponential backoff correctly', () => {
      const delays = [1, 2, 3].map(attempt =>
        worker.calculateBackoff(attempt, { baseDelay: 5000 })
      );
      expect(delays).toEqual([5000, 10000, 20000]); // 5s, 10s, 20s
    });
  });

  describe('Rate Limiting', () => {
    it('should throttle requests to respect rate limits', async () => {
      const startTime = Date.now();
      const requests = Array(25).fill(null).map(() => worker.syncOne({}));
      await Promise.all(requests);
      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThan(2000); // 25 req / 10 req/s = 2.5s minimum
    });
  });
});
```

### 2. Conflict Detection Service Tests

**File**: `backend/tests/unit/ConflictDetectionService.test.ts`

```typescript
describe('ConflictDetectionService', () => {
  it('should detect field-level conflicts', async () => {
    const local = { forecastStart: '2025-01-15', monthlyRate: 5500 };
    const pems = { forecastStart: '2025-01-20', monthlyRate: 5500 };
    const conflicts = service.detectFieldConflicts(local, pems);
    expect(conflicts).toEqual(['forecastStart']);
  });

  it('should handle nested object conflicts', async () => {
    const local = { data: { category: 'Rental' } };
    const pems = { data: { category: 'Purchase' } };
    const conflicts = service.detectFieldConflicts(local, pems);
    expect(conflicts).toContain('data.category');
  });

  it('should auto-resolve non-conflicting merges', async () => {
    const local = { forecastStart: '2025-01-15' }; // Changed
    const pems = { monthlyRate: 6000 };              // Changed
    const resolution = service.autoResolve(local, pems);
    expect(resolution.strategy).toBe('merge');
    expect(resolution.mergedData).toEqual({
      forecastStart: '2025-01-15',
      monthlyRate: 6000,
    });
  });
});
```

### 3. Validation Service Tests

**File**: `backend/tests/unit/PfaValidationService.test.ts`

```typescript
describe('PfaValidationService', () => {
  it('should validate forecast date ordering', () => {
    const invalid = {
      forecastStart: new Date('2025-06-30'),
      forecastEnd: new Date('2025-01-15'),
    };
    const result = service.validate(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Forecast end must be after forecast start');
  });

  it('should validate required fields', () => {
    const invalid = { monthlyRate: null, source: 'Rental' };
    const result = service.validate(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Monthly rate required for rentals');
  });

  it('should validate enum values', () => {
    const invalid = { dor: 'INVALID' };
    const result = service.validate(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('DOR must be BEO or PROJECT');
  });
});
```

---

## Integration Tests

### 1. Full Sync Cycle Test

**File**: `backend/tests/integration/pemsWriteSync.test.ts`

```typescript
describe('Bi-directional Sync Integration', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedTestData();
  });

  it('should complete full sync cycle: commit → queue → sync → verify', async () => {
    // 1. Create modification
    const modification = await createModification({
      pfaId: 'PFA-12345',
      delta: { forecastStart: new Date('2025-01-15') },
      baseVersion: 1,
      organizationId: 'org-rio',
    });

    expect(modification.syncStatus).toBe('draft');

    // 2. Commit modification
    await commitModification(modification.id);
    const committed = await getModification(modification.id);
    expect(committed.syncStatus).toBe('committed');

    // 3. Verify queue entry created
    const queueItem = await getQueueItem({ modificationId: modification.id });
    expect(queueItem).toBeTruthy();
    expect(queueItem.status).toBe('pending');

    // 4. Trigger sync worker manually (don't wait for cron)
    await worker.processQueue();

    // 5. Wait for async sync to complete
    await waitFor(() => getQueueItem({ modificationId: modification.id }), {
      condition: (item) => item.status === 'completed',
      timeout: 10000,
    });

    // 6. Verify PEMS was updated (mock API check)
    const pemsData = await mockPemsClient.getPfa('PFA-12345');
    expect(pemsData.forecastStart).toBe('2025-01-15T00:00:00Z');

    // 7. Verify modification status updated
    const synced = await getModification(modification.id);
    expect(synced.syncStatus).toBe('synced');
    expect(synced.syncedAt).toBeTruthy();
    expect(synced.pemsVersion).toBe(2);

    // 8. Verify mirror updated with new version
    const mirror = await getMirror('PFA-12345');
    expect(mirror.version).toBe(2);
    expect(mirror.lastSyncedAt).toBeTruthy();
  });

  it('should handle conflict detection and resolution', async () => {
    // Setup: Create modification based on version 1
    const modification = await createModification({
      pfaId: 'PFA-12345',
      delta: { forecastStart: new Date('2025-01-15') },
      baseVersion: 1,
    });

    // Simulate concurrent PEMS update (version 1 → 2)
    await updateMirror('PFA-12345', {
      version: 2,
      data: { forecastStart: new Date('2025-01-20') },
    });

    // Commit and trigger sync
    await commitModification(modification.id);
    await worker.processQueue();

    // Verify conflict detected
    const conflicts = await getConflicts({ pfaId: 'PFA-12345' });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].status).toBe('unresolved');
    expect(conflicts[0].conflictFields).toContain('forecastStart');

    // Verify modification marked as conflict
    const mod = await getModification(modification.id);
    expect(mod.syncStatus).toBe('conflict');

    // Resolve conflict (use local)
    await resolveConflict(conflicts[0].id, {
      resolution: 'use_local',
    });

    // Verify re-queued
    const queueItem = await getQueueItem({ modificationId: modification.id });
    expect(queueItem.status).toBe('pending');

    // Re-run sync worker
    await worker.processQueue();

    // Verify successful sync
    await waitFor(() => getModification(modification.id), {
      condition: (mod) => mod.syncStatus === 'synced',
      timeout: 10000,
    });
  });

  it('should handle retry and dead letter queue', async () => {
    // Setup: Mock PEMS API to fail 3 times, then succeed
    let attempts = 0;
    mockPemsClient.updatePfa = jest.fn(() => {
      attempts++;
      if (attempts <= 3) {
        throw new Error('PEMS temporarily unavailable');
      }
      return Promise.resolve({ success: true, newVersion: 2 });
    });

    const modification = await createModification({
      pfaId: 'PFA-12345',
      delta: { forecastStart: new Date('2025-01-15') },
      baseVersion: 1,
    });

    await commitModification(modification.id);
    await worker.processQueue();

    // After 3 failed attempts, should move to DLQ
    const queueItem = await getQueueItem({ modificationId: modification.id });
    expect(queueItem.status).toBe('failed');
    expect(queueItem.retryCount).toBe(3);

    // Verify DLQ entry
    const dlqItem = await getDlqItem({ modificationId: modification.id });
    expect(dlqItem).toBeTruthy();
    expect(dlqItem.errorMessage).toContain('PEMS temporarily unavailable');

    // Admin manually retries from DLQ
    await retryFromDlq(dlqItem.id);

    // This time it should succeed (4th attempt)
    await worker.processQueue();

    await waitFor(() => getModification(modification.id), {
      condition: (mod) => mod.syncStatus === 'synced',
      timeout: 10000,
    });
  });
});
```

---

## Load Tests

### Load Test Scenarios

**File**: `load-tests/sync-worker-load.ts`

```typescript
import { Artillery } from 'artillery';

export const loadTestConfig = {
  scenarios: [
    {
      name: '1000 Concurrent Modifications',
      duration: 60,
      arrivalRate: 16, // 16 modifications/sec = ~1000 in 60s
      requests: [
        {
          post: {
            url: '/api/pfa-data/commit-drafts',
            json: {
              modificationIds: ['{{ modificationId }}'],
            },
          },
        },
      ],
    },
    {
      name: '10K Queue Backlog',
      duration: 300,
      arrivalRate: 33, // 33/sec for 5 min = 10K items
      requests: [
        {
          post: {
            url: '/api/pfa-data/save-draft',
            json: {
              pfaId: '{{ pfaId }}',
              changes: {
                forecastStart: '{{ randomDate }}',
              },
            },
          },
        },
      ],
    },
  ],

  assertions: [
    { metric: 'http.response_time.p95', threshold: 2000 }, // 95th percentile < 2s
    { metric: 'http.codes.200', threshold: 99.9 },         // 99.9% success rate
  ],
};
```

**Performance Benchmarks**:
| Metric | Target | Measurement |
|--------|--------|-------------|
| 1000 modifications | < 5 min | Artillery + worker logs |
| Avg sync latency | < 2 min | Queue creation to completion |
| Queue size (peak) | < 10K items | PostgreSQL count query |
| PEMS API success rate | > 99% | API response codes |

---

## Security Testing

### 1. Authentication & Authorization Tests

```typescript
describe('Security - Write Sync Authorization', () => {
  it('should require perm_Sync permission to commit changes', async () => {
    const userWithoutPerm = createUser({ permissions: ['Read', 'EditForecast'] });
    const response = await request(app)
      .post('/api/pfa-data/commit-drafts')
      .set('Authorization', `Bearer ${userWithoutPerm.token}`)
      .send({ modificationIds: ['mod-1'] });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Missing required permission: perm_Sync');
  });

  it('should encrypt PEMS credentials at rest', async () => {
    const creds = await getOrganizationCredentials('org-rio');
    expect(creds.apiKey).toMatch(/^encrypted:/); // Encrypted prefix
    const decrypted = decrypt(creds.apiKey);
    expect(decrypted).toMatch(/^sk-/); // Real API key format
  });

  it('should validate user owns modification before sync', async () => {
    const userA = createUser({ userId: 'user-a' });
    const userB = createUser({ userId: 'user-b' });
    const modification = await createModification({ createdBy: 'user-a' });

    const response = await request(app)
      .post('/api/pfa-data/commit-drafts')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ modificationIds: [modification.id] });

    expect(response.status).toBe(403);
  });
});
```

### 2. Input Validation & Injection Prevention

```typescript
describe('Security - Input Validation', () => {
  it('should prevent SQL injection in queue queries', async () => {
    const maliciousInput = "'; DROP TABLE pfa_write_queue; --";
    const response = await request(app)
      .get('/api/pems/sync-status')
      .query({ organizationId: maliciousInput });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid organizationId');

    // Verify table still exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM pg_tables WHERE tablename = 'pfa_write_queue'
      );
    `;
    expect(tableExists).toBe(true);
  });

  it('should sanitize PEMS API payload', async () => {
    const modification = await createModification({
      delta: {
        forecastStart: new Date('2025-01-15'),
        maliciousField: '<script>alert("xss")</script>',
      },
    });

    await commitModification(modification.id);
    const queueItem = await getQueueItem({ modificationId: modification.id });

    expect(queueItem.payload).not.toContain('<script>');
  });
});
```

### 3. PEMS API Security

```typescript
describe('Security - PEMS API Integration', () => {
  it('should use HTTPS for all PEMS requests', async () => {
    const spy = jest.spyOn(https, 'request');
    await pemsClient.updatePfa('PFA-12345', {});
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toMatch(/^https:/);
  });

  it('should include authentication header', async () => {
    const spy = jest.spyOn(axios, 'put');
    await pemsClient.updatePfa('PFA-12345', {});
    expect(spy.mock.calls[0][1].headers['Authorization']).toBeTruthy();
  });

  it('should timeout long-running requests', async () => {
    // Mock slow PEMS response
    jest.spyOn(axios, 'put').mockImplementation(() =>
      new Promise((resolve) => setTimeout(resolve, 60000))
    );

    await expect(
      pemsClient.updatePfa('PFA-12345', {}, { timeout: 5000 })
    ).rejects.toThrow('Request timeout');
  });
});
```

---

## Risk Assessment

### High Risks

**R-1: Data Loss During Sync Failures**
- **Probability**: Medium
- **Impact**: Critical
- **Test Coverage**:
  - Unit: Transactional queue operations
  - Integration: Rollback on failure test
  - Load: 1000 concurrent modifications with random failures

**Mitigation Validation**:
```typescript
it('should rollback transaction on sync failure', async () => {
  const modification = await createModification({ pfaId: 'PFA-12345' });
  mockPemsClient.updatePfa = jest.fn(() => { throw new Error('PEMS error'); });

  await expect(worker.syncOne(modification)).rejects.toThrow();

  // Verify no partial updates
  const queueItem = await getQueueItem({ modificationId: modification.id });
  expect(queueItem.status).toBe('pending'); // Not marked as completed
  const mod = await getModification(modification.id);
  expect(mod.syncStatus).toBe('committed'); // Not marked as synced
});
```

---

**R-2: Version Conflicts**
- **Probability**: High
- **Impact**: Medium
- **Test Coverage**:
  - Unit: Conflict detection algorithm
  - Integration: Concurrent modification scenario
  - E2E: User conflict resolution flow

**Mitigation Validation**:
```typescript
it('should handle concurrent modifications gracefully', async () => {
  const modification = await createModification({ baseVersion: 1 });
  await updateMirror('PFA-12345', { version: 2 }); // Concurrent PEMS update

  await commitModification(modification.id);
  await worker.processQueue();

  const conflicts = await getConflicts({ pfaId: 'PFA-12345' });
  expect(conflicts).toHaveLength(1);
  expect(conflicts[0].status).toBe('unresolved');
});
```

---

**R-3: PEMS API Rate Limiting**
- **Probability**: Medium
- **Impact**: Medium
- **Test Coverage**:
  - Unit: Rate limiter logic
  - Load: 1000 req/min sustained load

**Mitigation Validation**:
```typescript
it('should handle 429 rate limit responses', async () => {
  mockPemsClient.updatePfa = jest.fn()
    .mockRejectedValueOnce({ status: 429, message: 'Rate limit exceeded' })
    .mockResolvedValueOnce({ success: true, newVersion: 2 });

  const result = await worker.syncWithRetry(() => mockPemsClient.updatePfa('PFA-12345', {}));

  expect(result.success).toBe(true);
  expect(mockPemsClient.updatePfa).toHaveBeenCalledTimes(2);
});
```

---

## Compliance Testing

### SOX Compliance - Audit Trail Verification

```typescript
describe('Compliance - Audit Trail', () => {
  it('should log all write attempts', async () => {
    const modification = await createModification({ pfaId: 'PFA-12345' });
    await commitModification(modification.id);
    await worker.processQueue();

    const auditLogs = await getAuditLogs({
      eventType: 'WRITE_ATTEMPT',
      pfaId: 'PFA-12345',
    });

    expect(auditLogs.length).toBeGreaterThan(0);
    expect(auditLogs[0]).toMatchObject({
      userId: expect.any(String),
      organizationId: expect.any(String),
      changes: expect.any(Object),
      pemsResponse: expect.any(Object),
      timestamp: expect.any(Date),
    });
  });

  it('should track conflict resolutions in audit log', async () => {
    const conflict = await createConflict({ pfaId: 'PFA-12345' });
    await resolveConflict(conflict.id, { resolution: 'use_local' });

    const auditLogs = await getAuditLogs({
      eventType: 'CONFLICT_RESOLVED',
      pfaId: 'PFA-12345',
    });

    expect(auditLogs[0]).toMatchObject({
      resolution: 'use_local',
      resolvedBy: expect.any(String),
      timestamp: expect.any(Date),
    });
  });
});
```

---

## Acceptance Criteria Validation

### Functional Acceptance

**AC-1: Write Sync**
- [x] User can commit modifications for PEMS sync
  - Test: `integration/pemsWriteSync.test.ts::full sync cycle`
- [x] System queues modifications for processing
  - Test: `unit/PemsWriteSyncWorker.test.ts::batch processing`
- [x] Sync worker processes queue within 2 minutes
  - Test: `load-tests/sync-worker-load.ts::latency check`
- [x] PEMS receives updates successfully
  - Test: `integration/pemsWriteSync.test.ts::verify PEMS update`
- [x] Mirror updates with new PEMS version
  - Test: `integration/pemsWriteSync.test.ts::verify mirror update`

### Performance Acceptance

**AC-5: Throughput**
- [x] Process 1000 modifications in < 5 minutes
  - Test: `load-tests/sync-worker-load.ts::1000 concurrent modifications`
- [x] Handle 10,000 queued items without degradation
  - Test: `load-tests/sync-worker-load.ts::10K queue backlog`
- [x] Sync latency < 2 minutes average
  - Test: `load-tests/sync-worker-load.ts::p95 latency`

### Security Acceptance

**AC-7: Authentication & Authorization**
- [x] PEMS credentials encrypted at rest
  - Test: `security/encryption.test.ts::credential encryption`
- [x] User permissions validated before sync
  - Test: `security/authorization.test.ts::perm_Sync required`
- [x] Audit log captures all write attempts
  - Test: `compliance/audit-trail.test.ts::all writes logged`
- [x] HTTPS enforced for PEMS communication
  - Test: `security/pems-api.test.ts::HTTPS enforcement`

---

## Test Execution Plan

### Phase 4.5: Testing & QA (Week 5)

**Day 1-2: Unit Tests**
- Execute all unit test suites
- Achieve 90% code coverage
- Fix any failing tests

**Day 3-4: Integration Tests**
- Execute integration test suite
- Test all happy path and error scenarios
- Verify database state consistency

**Day 5: Load Tests**
- Run Artillery load tests
- Monitor system resources (CPU, memory, DB connections)
- Verify performance benchmarks met

**Day 6: Security Audit**
- Execute security test suite
- Manual penetration testing (prompt injection, XSS, SQL injection)
- Review audit log completeness

**Day 7: User Acceptance Testing**
- Provide test environment to stakeholders
- Execute UAT test cases with real users
- Collect feedback and file bugs

---

**Next**: See [IMPLEMENTATION_PLAN.md](./ADR-008-IMPLEMENTATION_PLAN.md) for technical architecture.
