# Phase 10: Security & QA - Complete Prompt Bundles

**Purpose**: 8 concise, ready-to-use prompt bundles for remaining Phase 10 tasks.

**Generated**: 2025-11-27

---

## Bundle Index

**Phase 10A (Security)**:
1. [Task 10A.5: JWT Tampering Testing](#bundle-10a5-jwt-tampering-testing)
2. [Task 10A.6: Rate Limiting Bypass Testing](#bundle-10a6-rate-limiting-bypass-testing)

**Phase 10B (QA)**:
3. [Task 10B.1: Integration Test Suite](#bundle-10b1-integration-test-suite)
4. [Task 10B.2: E2E Permission Workflow Tests](#bundle-10b2-e2e-permission-workflow-tests)
5. [Task 10B.3: Load Testing](#bundle-10b3-load-testing)
6. [Task 10B.4: Performance Benchmarking](#bundle-10b4-performance-benchmarking)
7. [Task 10B.5: Accessibility Compliance Testing](#bundle-10b5-accessibility-compliance-testing)
8. [Task 10B.6: Documentation Review](#bundle-10b6-documentation-review)

---

# Bundle 10A.5: JWT Tampering Testing

**Agent**: @ai-security-red-teamer

## System Context

You are an adversarial security tester specializing in **authentication bypass** and **token manipulation attacks**. Your role is to simulate attackers attempting to exploit JWT implementation weaknesses in the Multi-Tenant Access Control system.

**What This System Does**:
- Uses JWT tokens for authentication (stored as `pfa_auth_token` in localStorage)
- Tokens contain userId, username, role, organizationIds, capabilities
- Backend validates tokens using `jsonwebtoken` library
- Token expiry: 7 days (configurable)
- Middleware `verifyToken()` checks signature and expiration

**Your Mission**: Find every possible way to bypass JWT authentication or escalate privileges through token manipulation.

## Business Context

**Attack Scenarios You'll Test**:

1. **Signature Tampering**: Modify token payload without valid signature → Should be rejected with 401
2. **Role Escalation**: Change `role: 'viewer'` to `role: 'admin'` in token → Should fail signature verification
3. **Organization Bypass**: Add unauthorized `organizationId` to `allowedOrganizationIds[]` → Should be rejected

**Real-World Impact**:
- **If successful**: Attacker gains admin access, steals data from unauthorized orgs, grants themselves permissions
- **If blocked**: Feature is production-ready for security-critical multi-tenant environment

## Technical Specification

**JWT Structure** (PFA Vanguard):
```typescript
// Token Payload
{
  userId: 'user-123',
  username: 'alice',
  role: 'editor',
  organizationId: 'HOLNG',  // Current active org
  allowedOrganizationIds: ['HOLNG', 'RIO'],
  capabilities: {
    perm_ManageUsers: false,
    perm_ManageSettings: true,
    // ... other capabilities
  },
  iat: 1700000000,  // Issued at
  exp: 1700604800   // Expires at (7 days later)
}
```

**Validation Flow**:
```typescript
// backend/src/middleware/auth.ts
export const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;  // Attach to request
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

**Test Cases** (from TEST_PLAN.md lines 63-77):

```typescript
describe('Security: JWT Token Integrity', () => {
  // Test 1: Signature Tampering
  it('should reject modified JWT tokens', async () => {
    const token = await loginAs('admin');
    const tamperedToken = token.replace('admin', 'super-admin');
    const response = await apiCall(tamperedToken);
    expect(response.status).toBe(401);
  });

  // Test 2: Expiration Bypass
  it('should reject expired tokens', async () => {
    const expiredToken = generateExpiredToken();
    const response = await apiCall(expiredToken);
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('TOKEN_EXPIRED');
  });

  // Test 3: None Algorithm Attack
  it('should reject tokens with "none" algorithm', async () => {
    const noneAlgToken = jwt.sign(payload, '', { algorithm: 'none' });
    const response = await apiCall(noneAlgToken);
    expect(response.status).toBe(401);
  });

  // Test 4: HS256 to RS256 Confusion
  it('should reject algorithm confusion attacks', async () => {
    const confusedToken = signWithWrongAlgorithm(payload);
    const response = await apiCall(confusedToken);
    expect(response.status).toBe(401);
  });

  // Test 5: Replay Attack
  it('should reject tokens after user logout', async () => {
    const token = await loginAs('alice');
    await logout(token);  // Invalidate session
    const response = await apiCall(token);
    expect(response.status).toBe(401);
  });
});
```

**Additional Attack Vectors**:

1. **Token Replay** (lines 78-90): Use valid token after user suspension/deletion
2. **Secret Brute Force**: Attempt to guess JWT_SECRET (simulate weak secret)
3. **Algorithm Confusion**: Change `alg` header from HS256 to RS256/none
4. **Payload Injection**: Inject SQL/XSS into username field, re-sign with guessed secret
5. **Time Manipulation**: Set `exp` 10 years in future, sign with guessed secret

**Expected Behavior**:
```typescript
// ✅ PASS: All attacks rejected with 401
{
  status: 401,
  body: {
    error: 'Invalid token' | 'TOKEN_EXPIRED' | 'TOKEN_MALFORMED'
  }
}

// ❌ FAIL: Attack succeeds
{
  status: 200,
  body: { /* authenticated response */ }
}
```

## Your Mission

**Execute these steps**:

1. **Setup Test Environment**:
   - Create test users with different roles (admin, editor, viewer)
   - Generate valid JWT tokens for each user
   - Set up automated test suite with `vitest` + `supertest`

2. **Signature Tampering Tests**:
   - Modify payload fields (role, organizationIds, capabilities)
   - Change signature bytes manually
   - Replace signature with empty string
   - Use signature from different token (token swapping)

3. **Algorithm Attacks**:
   - Change `alg` header to `none` (nullify signature verification)
   - Change HS256 to RS256 (algorithm confusion)
   - Use weak algorithms (MD5, SHA1 - if library allows)

4. **Expiration Bypass**:
   - Submit expired tokens (past `exp` timestamp)
   - Submit tokens with `exp` = 10 years in future (forged)
   - Remove `exp` field entirely

5. **Replay & Revocation**:
   - Use valid token after user logout
   - Use valid token after user suspension
   - Use valid token after user deletion
   - Use valid token after password change

6. **Secret Brute Force Simulation**:
   - Test common weak secrets (e.g., 'secret', '12345', 'jwt_secret')
   - Document recommended secret strength (minimum 256 bits)

7. **Document Results**:
   - Create `backend/tests/integration/jwtSecurity.test.ts`
   - Update TESTING_LOG.md with [TEST-JWT-001] entry
   - Add findings to TEST_PLAN.md (Security section)

## Deliverables

1. **Test Suite**: `backend/tests/integration/jwtSecurity.test.ts` (15+ test cases)
2. **Attack Report**: `docs/security/JWT_ATTACK_REPORT.md` with vulnerabilities found
3. **Remediation Plan**: If vulnerabilities found, provide fixes (e.g., stronger secret, algorithm whitelist)
4. **TESTING_LOG.md Update**: [TEST-JWT-001] status with execution results

## Constraints

**❌ DO NOT**:
- Use actual production tokens for testing
- Share JWT_SECRET values in test files (use .env.test)
- Submit test results to public repositories (security-sensitive)
- Test against production API endpoints

**✅ DO**:
- Use test database with isolated test users
- Generate tokens programmatically for each test
- Document every attack vector attempted (success or failure)
- Provide remediation recommendations for any vulnerabilities found

## Verification Questions

1. **Token Validation**: Can you modify a token payload and successfully authenticate? (Expected: NO)
2. **Expiration Enforcement**: Can you use a token with `exp` from 2 years ago? (Expected: NO)
3. **Algorithm Security**: Can you bypass signature verification using `alg: none`? (Expected: NO)
4. **Replay Prevention**: Can you use a valid token after user logout? (Expected: NO - if session invalidation implemented)
5. **Secret Strength**: If JWT_SECRET is 'password', can you forge tokens? (Expected: YES - document as vulnerability)

---

# Bundle 10A.6: Rate Limiting Bypass Testing

**Agent**: @ai-security-red-teamer

## System Context

You are an adversarial security tester specializing in **brute force attacks** and **rate limiting evasion**. Your role is to simulate attackers attempting to overwhelm authentication endpoints and bypass rate limits through distributed attacks.

**What This System Does**:
- Global rate limiting: 100 requests/15 minutes per IP (express-rate-limit)
- Account lockout: 5 failed login attempts → user suspended for 30 minutes
- Rate limit tracking: In-memory (development) or Redis (production)
- Endpoints protected: `/api/auth/login`, `/api/auth/register`

**Your Mission**: Find every way to bypass rate limits and test account lockout mechanisms.

## Business Context

**Attack Scenarios**:

1. **Credential Stuffing**: 1000+ login attempts/minute using stolen credentials → Should hit rate limit
2. **Account Enumeration**: Probe `/api/auth/login` to discover valid usernames → Rate limit + generic error messages
3. **Distributed Attack**: Rotate IP addresses to evade per-IP rate limits → Detect via behavioral analysis

**Real-World Impact**:
- **If vulnerable**: Attacker can brute force passwords, enumerate users, cause service downtime
- **If blocked**: Feature is production-ready for high-security environments

## Technical Specification

**Rate Limiting Implementation**:
```typescript
// backend/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});
```

**Account Lockout Logic** (TEST_PLAN.md lines 101-110):
```typescript
// backend/src/services/auth/authService.ts
async login(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user) {
    return { error: 'Invalid credentials' };  // Generic error
  }

  // Check lockout status
  if (user.serviceStatus === 'locked' && user.lockedUntil > new Date()) {
    return { error: 'Account locked. Try again later.' };
  }

  // Verify password
  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    // Increment failed attempts
    const failedAttempts = user.failedLoginAttempts + 1;

    if (failedAttempts >= 5) {
      // Lock account for 30 minutes
      await prisma.user.update({
        where: { id: user.id },
        data: {
          serviceStatus: 'locked',
          lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
          failedLoginAttempts: failedAttempts
        }
      });
      return { error: 'Account locked due to too many failed attempts' };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts }
    });

    return { error: 'Invalid credentials' };
  }

  // Successful login - reset failed attempts
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, serviceStatus: 'active' }
  });

  return { token: generateToken(user), user };
}
```

**Test Cases** (TEST_PLAN.md lines 89-110):

```typescript
describe('Security: Rate Limiting', () => {
  // Test 1: Global Rate Limit
  it('should rate limit failed login attempts', async () => {
    const attempts = Array(101).fill(null);  // 101 attempts
    const responses = [];

    for (const _ of attempts) {
      const res = await loginAs('admin', 'wrong-password');
      responses.push(res);
    }

    const rateLimited = responses.filter(r => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
    expect(rateLimited[0].body.error).toContain('Too many requests');
  });

  // Test 2: Account Lockout
  it('should lock account after 5 failed attempts', async () => {
    const user = await createUser({ username: 'bob' });

    // Attempt 5 failed logins
    for (let i = 0; i < 5; i++) {
      await loginAs('bob', 'wrong-password');
    }

    const userRecord = await getUser(user.id);
    expect(userRecord.serviceStatus).toBe('locked');
    expect(userRecord.lockedUntil).toBeInstanceOf(Date);
  });

  // Test 3: IP Rotation Evasion
  it('should detect distributed brute force attacks', async () => {
    // Simulate 1000 requests from 100 different IPs
    const ips = Array(100).fill(null).map((_, i) => `192.168.1.${i}`);
    const requests = [];

    for (let i = 0; i < 1000; i++) {
      const ip = ips[i % 100];
      requests.push(
        loginAs('admin', 'wrong-password', { headers: { 'X-Forwarded-For': ip } })
      );
    }

    const responses = await Promise.all(requests);

    // Should still trigger security alert (behavioral analysis)
    const alerts = await prisma.securityAlert.findMany({
      where: { type: 'DISTRIBUTED_BRUTE_FORCE' }
    });

    expect(alerts.length).toBeGreaterThan(0);
  });

  // Test 4: Lockout Duration
  it('should unlock account after 30 minutes', async () => {
    const user = await createUser({ username: 'charlie' });

    // Lock account
    for (let i = 0; i < 5; i++) {
      await loginAs('charlie', 'wrong-password');
    }

    // Fast-forward 30 minutes (mock Date.now)
    jest.useFakeTimers();
    jest.advanceTimersByTime(30 * 60 * 1000);

    // Should be unlocked
    const response = await loginAs('charlie', 'correct-password');
    expect(response.status).toBe(200);

    jest.useRealTimers();
  });
});
```

**Additional Attack Vectors**:

1. **Slowloris Attack**: Send partial requests to exhaust server connections
2. **User Enumeration**: Time-based attacks (username exists = 200ms, doesn't exist = 50ms)
3. **CAPTCHA Bypass**: If CAPTCHA exists, test for bypass techniques
4. **Session Fixation**: Force user to use attacker-controlled session ID

## Your Mission

**Execute these steps**:

1. **Setup Load Testing Environment**:
   - Install `artillery` or `k6` for load testing
   - Create test user accounts with known passwords
   - Set up test database with monitoring

2. **Brute Force Simulation**:
   - Generate 10,000 login attempts with random passwords
   - Measure at what point rate limit triggers (should be 100 requests)
   - Verify HTTP 429 response with appropriate headers

3. **Account Lockout Testing**:
   - Test 5 consecutive failed logins → user locked
   - Verify locked user cannot login even with correct password
   - Test lockout duration (30 minutes)
   - Verify failed attempt counter resets on successful login

4. **IP Rotation Bypass**:
   - Simulate distributed attack from 100+ IPs
   - Send 10 requests/IP (1000 total) within 5 minutes
   - Check if system detects attack pattern

5. **Response Time Analysis**:
   - Measure response time for valid vs invalid usernames
   - Document if timing leak reveals user existence

6. **Rate Limit Reset Testing**:
   - Hit rate limit → wait 15 minutes → verify limit resets
   - Test concurrent requests at limit boundary

7. **Document Results**:
   - Create `backend/tests/integration/rateLimitingSecurity.test.ts`
   - Update TESTING_LOG.md with [TEST-RL-001]
   - Create load test script: `scripts/load-test/brute-force-simulation.yml`

## Deliverables

1. **Test Suite**: `backend/tests/integration/rateLimitingSecurity.test.ts` (10+ test cases)
2. **Load Test Config**: `scripts/load-test/brute-force-simulation.yml` (Artillery or k6 script)
3. **Attack Report**: `docs/security/RATE_LIMITING_ATTACK_REPORT.md`
4. **TESTING_LOG.md Update**: [TEST-RL-001] status with performance metrics

## Constraints

**❌ DO NOT**:
- Run tests against production API
- Use real user credentials
- Exceed 10,000 requests/test (avoid actual DoS)
- Test during business hours (could affect shared dev environment)

**✅ DO**:
- Use isolated test environment
- Clean up test data after tests complete
- Monitor server resource usage (CPU, memory) during tests
- Document rate limit thresholds observed

## Verification Questions

1. **Rate Limit Enforcement**: After 100 requests, does the 101st return HTTP 429? (Expected: YES)
2. **Account Lockout**: After 5 failed logins, is the account locked? (Expected: YES)
3. **Lockout Duration**: Can user login after 30 minutes of lockout? (Expected: YES)
4. **IP Rotation Detection**: Can 1000 requests from 100 IPs bypass rate limit? (Expected: System detects pattern)
5. **Generic Errors**: Do error messages reveal if username exists? (Expected: NO - same error for all failures)
6. **Performance**: Does rate limiting add >50ms latency to requests? (Expected: NO)

---

# Bundle 10B.1: Integration Test Suite

**Agent**: @sdet-test-automation

## System Context

You are a Software Development Engineer in Test (SDET) specializing in **integration testing** for multi-tier applications. Your mission is to implement the **171+ test cases** defined in ADR-005-TEST_PLAN.md with **>80% code coverage** requirement.

**What This System Does**:
- Multi-tenant access control with RBAC (Role-Based Access Control)
- JWT authentication + permission middleware
- API Server Management (CRUD operations with org isolation)
- Organization status cascading (suspend org → disable API servers)
- External entity protection (PEMS-managed orgs/users cannot be deleted)

**Your Mission**: Create comprehensive integration tests covering all API endpoints, permission flows, and data integrity checks.

## Business Context

**Critical Scenarios**:

1. **Permission Grant Flow**: Admin grants `perm_ManageSettings` to user → User can create API server
2. **Organization Suspension**: Admin suspends org → All API servers in that org become unusable
3. **External Entity Protection**: Attempt to delete PEMS-managed organization → Blocked with 403 error

**Why This Matters**:
- **Security**: Ensure unauthorized users cannot escalate privileges or access other orgs' data
- **Data Integrity**: Verify cascading deletes don't orphan records
- **Multi-Tenancy**: Confirm organization isolation works (user in HOLNG cannot see RIO data)

## Technical Specification

**Test Plan Coverage** (ADR-005-TEST_PLAN.md):
- **Section 1**: Authentication & Authorization (lines 20-110)
- **Section 7**: API Server Management Authorization (lines 265-376)
- **Section 8**: Organization Status Cascading (lines 377-513)
- **Section 9**: API Server Multi-Tenant Isolation (lines 514-627)
- **Section 10**: External Organization Constraints (lines 628-728)

**Test Framework**:
```typescript
// backend/tests/integration/setup.ts
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import app from '../../src/server';

export const prisma = new PrismaClient();

export async function createTestUser(data: Partial<User>) {
  return prisma.user.create({
    data: {
      username: data.username || 'testuser',
      passwordHash: await bcrypt.hash(data.password || 'password', 10),
      role: data.role || 'viewer',
      organizationId: data.organizationId,
      allowedOrganizationIds: data.allowedOrganizationIds || [],
      capabilities: data.capabilities || {},
      ...data
    }
  });
}

export async function loginAs(username: string, password = 'password') {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username, password });

  return response.body.token;
}

export async function cleanup() {
  await prisma.apiServer.deleteMany({});
  await prisma.organization.deleteMany({ where: { isExternal: false } });
  await prisma.user.deleteMany({});
}
```

**Sample Test Case** (from TEST_PLAN.md lines 266-287):

```typescript
describe('API Server Management Authorization', () => {
  let adminToken: string;
  let viewerToken: string;
  let holngOrg: Organization;

  beforeEach(async () => {
    // Setup test data
    holngOrg = await prisma.organization.create({
      data: { code: 'HOLNG', name: 'Holcim Nigeria', serviceStatus: 'active' }
    });

    const admin = await createTestUser({
      username: 'admin',
      role: 'admin',
      organizationId: holngOrg.id,
      allowedOrganizationIds: [holngOrg.id],
      capabilities: { perm_ManageSettings: true }
    });

    const viewer = await createTestUser({
      username: 'viewer',
      role: 'viewer',
      organizationId: holngOrg.id,
      allowedOrganizationIds: [holngOrg.id],
      capabilities: { perm_ManageSettings: false }
    });

    adminToken = await loginAs('admin');
    viewerToken = await loginAs('viewer');
  });

  afterEach(async () => {
    await cleanup();
  });

  // TEST-API-001: Unauthorized Create
  it('should prevent create API Server without permission', async () => {
    const response = await request(app)
      .post('/api/api-servers')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        organizationId: holngOrg.id,
        name: 'Test Server',
        baseUrl: 'https://api.test.com',
        authType: 'bearer'
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Requires perm_ManageSettings permission');
  });

  // TEST-API-002: Authorized Create
  it('should allow create API Server with permission', async () => {
    const response = await request(app)
      .post('/api/api-servers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        organizationId: holngOrg.id,
        name: 'Test Server',
        baseUrl: 'https://api.test.com',
        authType: 'bearer'
      });

    expect(response.status).toBe(201);
    expect(response.body.organizationId).toBe(holngOrg.id);
    expect(response.body.name).toBe('Test Server');
  });

  // TEST-API-003: Cross-Org Access Prevention
  it('should prevent edit API Server in different org', async () => {
    const rioOrg = await prisma.organization.create({
      data: { code: 'RIO', name: 'Rio Tinto', serviceStatus: 'active' }
    });

    const holngServer = await prisma.apiServer.create({
      data: {
        organizationId: holngOrg.id,
        name: 'HOLNG Server',
        baseUrl: 'https://api.holng.com',
        authType: 'bearer'
      }
    });

    // Create user with permission for RIO, but not HOLNG
    const rioUser = await createTestUser({
      username: 'rio-user',
      organizationId: rioOrg.id,
      allowedOrganizationIds: [rioOrg.id],
      capabilities: { perm_ManageSettings: true }
    });

    const rioToken = await loginAs('rio-user');

    const response = await request(app)
      .patch(`/api/api-servers/${holngServer.id}`)
      .set('Authorization', `Bearer ${rioToken}`)
      .send({ name: 'Hacked' });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain("don't have permission to manage");
  });
});
```

**Key Test Categories**:

1. **Authentication Tests** (20+ tests):
   - Valid login, invalid credentials, token validation, expiration

2. **Authorization Tests** (30+ tests):
   - Permission enforcement, role-based access, capability checks

3. **API Server Management** (25+ tests):
   - CRUD operations, permission checks, org isolation, status cascading

4. **Organization Management** (20+ tests):
   - Create, suspend, delete, external entity protection

5. **Data Integrity Tests** (15+ tests):
   - Cascading deletes, foreign key constraints, transaction rollbacks

6. **Multi-Tenancy Tests** (20+ tests):
   - Org isolation, multi-org users, context switching

7. **External Entity Tests** (15+ tests):
   - PEMS org/user protection, unlinking, sync preservation

8. **Edge Cases** (26+ tests):
   - Null handling, boundary conditions, race conditions

## Your Mission

**Execute these steps**:

1. **Setup Test Infrastructure** (2 hours):
   - Create `backend/tests/integration/` folder structure
   - Set up test database (SQLite in-memory or separate test DB)
   - Configure `vitest` with coverage reporting
   - Create helper functions (createTestUser, loginAs, cleanup)

2. **Implement Core Test Suites** (12 hours):
   - Authentication & Authorization: `auth.integration.test.ts` (30+ tests)
   - API Server Management: `apiServerAuthorization.test.ts` (25+ tests)
   - Organization Management: `organizationManagement.test.ts` (20+ tests)
   - Multi-Tenancy: `multiTenantIsolation.test.ts` (20+ tests)

3. **Implement Advanced Test Suites** (8 hours):
   - External Entity Protection: `externalEntityProtection.test.ts` (15+ tests)
   - Organization Cascading: `organizationCascading.test.ts` (15+ tests)
   - Data Integrity: `dataIntegrity.test.ts` (15+ tests)
   - Edge Cases: `edgeCases.test.ts` (26+ tests)

4. **Code Coverage Analysis** (2 hours):
   - Run `vitest --coverage`
   - Identify uncovered code paths
   - Add tests to reach >80% coverage target
   - Generate HTML coverage report

5. **Performance Validation** (1 hour):
   - Verify test suite completes in <5 minutes
   - Optimize slow tests (mock external calls)
   - Parallelize independent test suites

6. **CI/CD Integration** (1 hour):
   - Create GitHub Actions workflow: `.github/workflows/integration-tests.yml`
   - Run tests on every PR
   - Fail PR if coverage drops below 80%

7. **Documentation** (1 hour):
   - Update `tests/README.md` with test suite index
   - Update `TESTING_LOG.md` with [TEST-INT-001] through [TEST-INT-171]
   - Document test execution instructions

## Deliverables

1. **Test Suites** (8 files, 171+ tests):
   - `backend/tests/integration/auth.integration.test.ts`
   - `backend/tests/integration/apiServerAuthorization.test.ts`
   - `backend/tests/integration/organizationManagement.test.ts`
   - `backend/tests/integration/multiTenantIsolation.test.ts`
   - `backend/tests/integration/externalEntityProtection.test.ts`
   - `backend/tests/integration/organizationCascading.test.ts`
   - `backend/tests/integration/dataIntegrity.test.ts`
   - `backend/tests/integration/edgeCases.test.ts`

2. **Coverage Report**: `coverage/index.html` (>80% backend coverage)

3. **CI Workflow**: `.github/workflows/integration-tests.yml`

4. **Documentation**:
   - `tests/README.md` (test suite index)
   - `TESTING_LOG.md` ([TEST-INT-001] through [TEST-INT-171] entries)

## Constraints

**❌ DO NOT**:
- Use production database for tests
- Hardcode credentials in test files (use environment variables)
- Skip cleanup after tests (causes test pollution)
- Commit failing tests to main branch

**✅ DO**:
- Use in-memory SQLite or isolated test database
- Mock external API calls (PEMS, AI providers)
- Clean up test data after each test (beforeEach/afterEach)
- Run tests before every commit (pre-commit hook)

## Verification Questions

1. **Coverage**: Does test suite achieve >80% code coverage? (Check: `vitest --coverage`)
2. **Test Count**: Are all 171+ test cases from TEST_PLAN.md implemented? (Check: test suite count)
3. **Performance**: Does full test suite run in <5 minutes? (Check: execution time)
4. **Isolation**: Do tests pass when run in random order? (Check: `vitest --sequence.shuffle`)
5. **CI Integration**: Do tests run automatically on every PR? (Check: GitHub Actions)
6. **Documentation**: Is TESTING_LOG.md updated with all test entries? (Check: log completeness)

---

# Bundle 10B.2: E2E Permission Workflow Tests

**Agent**: @sdet-test-automation

## System Context

You are a QA automation engineer specializing in **end-to-end (E2E) testing** of user workflows. Your mission is to verify that complete permission workflows work correctly from frontend to backend to database.

**What This System Does**:
- Frontend: User Management UI (components/admin/UserManagement.tsx)
- Backend: Permission grant API (POST /api/users/{id}/permissions)
- Database: User permissions stored in `capabilities` JSONB field

**Your Mission**: Test complete user journeys involving permission changes, ensuring frontend, backend, and database stay in sync.

## Business Context

**Critical Workflows**:

1. **Admin Grants Permission**:
   - Admin opens User Management → Selects user → Opens Permission Modal → Grants `perm_ManageSettings` → Saves
   - Backend updates database → User can now create API servers

2. **User Suspension**:
   - Admin suspends user → User's active session becomes invalid → User sees "Account suspended" error on next API call

3. **Organization Switch**:
   - Multi-org user switches from HOLNG to RIO → UI updates to show RIO data → User can manage RIO's API servers

**Real-World Impact**:
- **If broken**: User granted permission but cannot use it (UI/backend desync)
- **If working**: Feature is production-ready for multi-user environments

## Technical Specification

**Test Workflows** (from TEST_PLAN.md lines 929-1013):

```typescript
// Critical Flow 1: Admin Grants Permission
describe('E2E: Admin Grants Permission', () => {
  it('should complete full permission grant workflow', async () => {
    // 1. Admin logs in
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/dashboard');

    // 2. Admin navigates to User Management
    await page.click('a[href="/admin/users"]');
    await page.waitForSelector('table[data-testid="user-table"]');

    // 3. Admin opens permission modal for target user
    const targetRow = page.locator('tr', { hasText: 'alice' });
    await targetRow.locator('button[aria-label="Edit Permissions"]').click();
    await page.waitForSelector('div[data-testid="permission-modal"]');

    // 4. Admin grants perm_ManageSettings
    await page.click('input[name="perm_ManageSettings"]');
    await page.click('button:has-text("Save")');
    await page.waitForSelector('div:has-text("Permissions updated successfully")');

    // 5. Verify permission was granted (check database)
    const user = await prisma.user.findUnique({
      where: { username: 'alice' },
      select: { capabilities: true }
    });
    expect(user.capabilities.perm_ManageSettings).toBe(true);

    // 6. Verify user can now create API server (login as alice)
    await page.click('button[aria-label="Logout"]');
    await page.fill('input[name="username"]', 'alice');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    await page.goto('http://localhost:3000/admin/api-connectivity');
    await page.click('button:has-text("Add Server")');

    // Should see form (not permission error)
    await expect(page.locator('form[data-testid="server-form"]')).toBeVisible();
  });
});

// Critical Flow 2: User Suspension
describe('E2E: User Suspension', () => {
  it('should suspend user and revoke all access', async () => {
    // 1. User logs in successfully
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="username"]', 'bob');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/dashboard');

    // 2. Verify user can access data
    await page.goto('http://localhost:3000/pfa');
    await expect(page.locator('table[data-testid="pfa-table"]')).toBeVisible();

    // 3. Admin suspends user (in separate browser context)
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await adminPage.goto('http://localhost:3000/login');
    await adminPage.fill('input[name="username"]', 'admin');
    await adminPage.fill('input[name="password"]', 'admin123');
    await adminPage.click('button[type="submit"]');

    await adminPage.goto('http://localhost:3000/admin/users');
    const bobRow = adminPage.locator('tr', { hasText: 'bob' });
    await bobRow.locator('button[aria-label="Suspend User"]').click();
    await adminPage.click('button:has-text("Confirm")');
    await adminPage.waitForSelector('div:has-text("User suspended")');

    // 4. Verify user is suspended in database
    const user = await prisma.user.findUnique({
      where: { username: 'bob' },
      select: { serviceStatus: true, suspendedAt: true }
    });
    expect(user.serviceStatus).toBe('suspended');
    expect(user.suspendedAt).toBeTruthy();

    // 5. Verify user cannot access data anymore (back to original tab)
    await page.reload();  // Trigger API call

    // Should see suspension error
    await expect(page.locator('div:has-text("Account suspended")')).toBeVisible();
    await expect(page.locator('table[data-testid="pfa-table"]')).not.toBeVisible();
  });
});

// Critical Flow 3: Organization Switch
describe('E2E: Organization Switch', () => {
  it('should switch context and update UI data', async () => {
    // 1. User logs in (multi-org user)
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="username"]', 'multi-user');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // 2. User is initially in HOLNG context
    await page.waitForSelector('div[data-testid="org-selector"]');
    await expect(page.locator('div[data-testid="current-org"]')).toHaveText('HOLNG');

    // 3. Load API servers page (should show HOLNG servers)
    await page.goto('http://localhost:3000/admin/api-connectivity');
    await page.waitForSelector('table[data-testid="server-table"]');

    const holngServers = await page.locator('tr[data-org="HOLNG"]').count();
    expect(holngServers).toBe(2);  // HOLNG has 2 servers

    const rioServers = await page.locator('tr[data-org="RIO"]').count();
    expect(rioServers).toBe(0);  // RIO servers not visible yet

    // 4. Switch to RIO organization
    await page.click('div[data-testid="org-selector"]');
    await page.click('li:has-text("RIO")');
    await page.waitForSelector('div[data-testid="current-org"]:has-text("RIO")');

    // 5. Verify UI updated to show RIO servers
    await page.waitForSelector('table[data-testid="server-table"]');

    const rioServersAfterSwitch = await page.locator('tr[data-org="RIO"]').count();
    expect(rioServersAfterSwitch).toBe(1);  // RIO has 1 server

    const holngServersAfterSwitch = await page.locator('tr[data-org="HOLNG"]').count();
    expect(holngServersAfterSwitch).toBe(0);  // HOLNG servers now hidden

    // 6. Verify user can manage RIO servers
    await page.click('button:has-text("Add Server")');
    await page.fill('input[name="name"]', 'RIO Server 2');
    await page.fill('input[name="baseUrl"]', 'https://api.rio2.com');
    await page.click('button:has-text("Save")');

    // Should create server in RIO org
    const newServer = await prisma.apiServer.findFirst({
      where: { name: 'RIO Server 2', organizationId: 'RIO' }
    });
    expect(newServer).toBeTruthy();
  });
});
```

**Additional Workflows**:

1. **Permission Revocation**: Admin revokes permission → User loses access immediately
2. **Role Change**: Admin changes user role → Capabilities update → UI reflects new permissions
3. **Multi-Org Access Grant**: Admin adds user to new organization → User can switch to it
4. **Account Reactivation**: Admin unsuspends user → User can login again

## Your Mission

**Execute these steps**:

1. **Setup E2E Test Framework** (2 hours):
   - Install Playwright: `npm install -D @playwright/test`
   - Create `tests/e2e/` folder structure
   - Configure `playwright.config.ts` with base URL, timeouts
   - Set up test database seeding script

2. **Implement Permission Workflows** (6 hours):
   - Admin Grants Permission: `permissionGrant.e2e.test.ts`
   - Admin Revokes Permission: `permissionRevoke.e2e.test.ts`
   - User Suspension: `userSuspension.e2e.test.ts`
   - Account Reactivation: `accountReactivation.e2e.test.ts`

3. **Implement Org Workflows** (4 hours):
   - Organization Switch: `orgSwitch.e2e.test.ts`
   - Multi-Org Access Grant: `multiOrgAccess.e2e.test.ts`
   - Organization Suspension: `orgSuspension.e2e.test.ts`

4. **Visual Regression Testing** (2 hours):
   - Capture screenshots of key UI states (permission modal, user table)
   - Compare with baseline screenshots
   - Flag UI regressions

5. **Performance Testing** (1 hour):
   - Measure page load times
   - Verify permission grant completes in <2 seconds
   - Check for memory leaks (long-running sessions)

6. **Error Scenarios** (2 hours):
   - Test permission grant failure (backend error)
   - Test suspension mid-session (user has page open)
   - Test network failures during permission save

7. **Documentation** (1 hour):
   - Create `tests/e2e/README.md` with workflow descriptions
   - Update TESTING_LOG.md with [TEST-E2E-001] through [TEST-E2E-010]
   - Add screenshots to `docs/testing/screenshots/`

## Deliverables

1. **E2E Test Suites** (7 files, 30+ tests):
   - `tests/e2e/permissionGrant.e2e.test.ts`
   - `tests/e2e/permissionRevoke.e2e.test.ts`
   - `tests/e2e/userSuspension.e2e.test.ts`
   - `tests/e2e/accountReactivation.e2e.test.ts`
   - `tests/e2e/orgSwitch.e2e.test.ts`
   - `tests/e2e/multiOrgAccess.e2e.test.ts`
   - `tests/e2e/orgSuspension.e2e.test.ts`

2. **Playwright Config**: `playwright.config.ts`

3. **Test Data Seeding**: `tests/e2e/fixtures/seed.ts`

4. **Documentation**:
   - `tests/e2e/README.md` (workflow descriptions)
   - `TESTING_LOG.md` ([TEST-E2E-001] through [TEST-E2E-030] entries)
   - `docs/testing/screenshots/` (baseline UI screenshots)

## Constraints

**❌ DO NOT**:
- Run E2E tests against production
- Use production user credentials
- Commit test database state
- Run E2E tests in parallel (causes race conditions)

**✅ DO**:
- Use headless mode in CI (`headless: true`)
- Seed test database before each test suite
- Clean up test data after tests
- Use test-specific user accounts (test-admin, test-user)

## Verification Questions

1. **Workflow Coverage**: Are all 3 critical flows from TEST_PLAN.md implemented? (Check: test file count)
2. **Frontend-Backend Sync**: Do permission changes in UI reflect in database immediately? (Check: test assertions)
3. **Error Handling**: Do tests verify error states (suspension, permission denied)? (Check: negative test cases)
4. **Performance**: Does permission grant complete in <2 seconds? (Check: test timing)
5. **Visual Regression**: Are UI screenshots captured for key states? (Check: screenshots/ folder)
6. **CI Integration**: Do E2E tests run on every PR? (Check: GitHub Actions workflow)

---

# Bundle 10B.3: Load Testing

**Agent**: @sdet-test-automation

## System Context

You are a performance testing engineer specializing in **load testing** and **stress testing** for multi-tier applications. Your mission is to validate that the Multi-Tenant Access Control system can handle **1000 concurrent users** without degradation.

**What This System Does**:
- Handles concurrent permission checks (middleware on every API request)
- Manages database connection pool (Prisma with PostgreSQL)
- Processes permission grants/revocations (write-heavy operations)

**Your Mission**: Simulate real-world load and identify performance bottlenecks.

## Business Context

**Load Testing Scenarios**:

1. **Concurrent Permission Checks**: 1000 users simultaneously call `/api/pfa` → All requests complete in <200ms
2. **Permission Grant Storm**: 50 admins simultaneously grant permissions → No database deadlocks
3. **Organization Switch**: 100 users switch orgs concurrently → No race conditions

**Why This Matters**:
- **Production Readiness**: System must handle peak traffic without crashes
- **User Experience**: Slow permission checks (<50ms target) cause UI lag
- **Cost Optimization**: Identify if infrastructure scaling is needed

## Technical Specification

**Performance Targets** (from TEST_PLAN.md lines 863-878):

| Operation | P50 Latency | P95 Latency | Target Throughput | Max Concurrent Users |
|-----------|-------------|-------------|-------------------|----------------------|
| **Permission Check** | <50ms | <100ms | 2000 req/s | 200 |
| **Grant Permission** | <100ms | <200ms | 500 req/s | 50 |
| **API Server List** | <200ms | <400ms | 100 req/s | 50 |
| **Organization Status Check** | <100ms | <200ms | 500 req/s | 100 |

**Load Test Scenarios** (TEST_PLAN.md lines 880-906):

```typescript
// Scenario 1: Concurrent Permission Grants
describe('Load: Concurrent Permission Grants', () => {
  it('should handle 50 simultaneous permission grants without errors', async () => {
    const promises = Array(50).fill(null).map((_, i) =>
      grantPermission(adminToken, {
        userId: `user-${i}`,
        organizationId: 'org-1',
        role: 'editor'
      })
    );

    const start = Date.now();
    const results = await Promise.all(promises);
    const duration = Date.now() - start;

    // Verify all succeeded
    const failures = results.filter(r => r.status !== 200);
    expect(failures.length).toBe(0);

    // Verify P95 latency <200ms (95% completed within 200ms)
    expect(duration).toBeLessThan(200);
  });
});

// Scenario 2: Database Connection Pool Stress
describe('Load: Connection Pool Stress', () => {
  it('should not exhaust database connections under load', async () => {
    const operations = Array(200).fill(null).map(() =>
      checkUserPermission('user-1', 'org-1')  // Read-only query
    );

    // Should not throw "Connection pool exhausted" error
    await expect(Promise.all(operations)).resolves.not.toThrow();

    // Verify connection pool metrics
    const poolMetrics = await prisma.$metrics.json();
    expect(poolMetrics.connections.active).toBeLessThan(poolMetrics.connections.max);
  });
});

// Scenario 3: Memory Leak Detection
describe('Load: Memory Leak Detection', () => {
  it('should not leak memory over 1000 operations', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < 1000; i++) {
      await checkUserPermission('user-1', 'org-1');
    }

    global.gc();  // Force garbage collection
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024;

    // Memory growth should be <50MB
    expect(memoryGrowth).toBeLessThan(50);
  });
});
```

**Load Testing Tools**:

1. **Artillery** (Recommended):
```yaml
# load-tests/permission-check.yml
config:
  target: http://localhost:3001
  phases:
    - duration: 60
      arrivalRate: 10
      name: Warm up
    - duration: 120
      arrivalRate: 100
      name: Sustained load
    - duration: 60
      arrivalRate: 200
      name: Spike test

  defaults:
    headers:
      Authorization: "Bearer {{ $processEnvironment.TEST_TOKEN }}"

scenarios:
  - name: "Permission Check Load Test"
    flow:
      - get:
          url: "/api/pfa?organizationId=HOLNG"
          capture:
            - json: "$.length"
              as: "recordCount"
      - think: 1  # 1 second pause between requests
```

2. **k6** (Alternative):
```javascript
// load-tests/permission-check.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Warm up
    { duration: '2m', target: 100 },  // Sustained load
    { duration: '1m', target: 200 },  // Spike
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],  // 95% of requests <200ms
    http_req_failed: ['rate<0.01'],    // <1% failure rate
  },
};

export default function () {
  const token = __ENV.TEST_TOKEN;
  const res = http.get('http://localhost:3001/api/pfa?organizationId=HOLNG', {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time <200ms': (r) => r.timings.duration < 200,
  });

  sleep(1);
}
```

## Your Mission

**Execute these steps**:

1. **Setup Load Testing Environment** (2 hours):
   - Install Artillery: `npm install -D artillery`
   - Or install k6: Download from https://k6.io
   - Create test data: 1000 test users, 10 organizations
   - Set up performance monitoring (CPU, memory, DB connections)

2. **Permission Check Load Tests** (3 hours):
   - Test `/api/pfa` endpoint with 200 concurrent users
   - Measure P50, P95, P99 latencies
   - Monitor database connection pool usage
   - Identify bottlenecks (slow queries, missing indexes)

3. **Permission Grant Load Tests** (2 hours):
   - Test concurrent permission grants (50 admins)
   - Check for database deadlocks
   - Verify data integrity (no lost updates)

4. **Organization Switch Load Tests** (2 hours):
   - Simulate 100 users switching orgs simultaneously
   - Monitor API response times
   - Check for race conditions

5. **Database Stress Tests** (3 hours):
   - Test connection pool limits (default: 10 connections)
   - Simulate connection pool exhaustion
   - Test query performance under load (slow query log)

6. **Memory Leak Detection** (2 hours):
   - Run 1000+ operations monitoring heap usage
   - Force garbage collection
   - Identify memory leaks (use Node.js `--inspect`)

7. **Generate Load Test Report** (1 hour):
   - Create HTML report with Artillery/k6
   - Document P50, P95, P99 latencies
   - List bottlenecks found
   - Provide optimization recommendations

## Deliverables

1. **Load Test Scripts**:
   - `load-tests/permission-check.yml` (Artillery config)
   - `load-tests/permission-grant.yml`
   - `load-tests/org-switch.yml`
   - `load-tests/db-stress.yml`

2. **Performance Report**: `docs/performance/LOAD_TEST_REPORT.md` with:
   - Latency charts (P50, P95, P99)
   - Throughput metrics (requests/second)
   - Error rate analysis
   - Bottleneck identification
   - Optimization recommendations

3. **Monitoring Dashboard**: `docs/performance/MONITORING_SETUP.md`

4. **TESTING_LOG.md Update**: [TEST-LOAD-001] with execution results

## Constraints

**❌ DO NOT**:
- Run load tests against production
- Exceed database connection limits (crashes DB)
- Run tests during business hours (shared dev environment)
- Use real user data for tests

**✅ DO**:
- Use isolated test environment (staging/QA)
- Monitor server resources during tests (CPU, RAM, DB)
- Clean up test data after tests
- Document baseline performance metrics

## Verification Questions

1. **Concurrent Users**: Can system handle 1000 concurrent users? (Check: error rate <1%)
2. **Latency**: Do 95% of requests complete in <200ms? (Check: P95 latency)
3. **Connection Pool**: Does system avoid connection pool exhaustion? (Check: DB metrics)
4. **Memory**: Does memory usage stay stable over 1000+ operations? (Check: heap growth <50MB)
5. **Throughput**: Can system process 2000 permission checks/second? (Check: requests/second)
6. **Error Rate**: Do all permission grants succeed under load? (Check: <1% failure rate)

---

# Bundle 10B.4: Performance Benchmarking

**Agent**: @sdet-test-automation

## System Context

You are a performance engineering specialist focused on **latency measurement** and **optimization**. Your mission is to establish baseline performance metrics for the Multi-Tenant Access Control system and verify the **<50ms authorization overhead** requirement.

**What This System Does**:
- Middleware checks user permissions on every API request
- Database queries filtered by organizationId (indexes critical)
- Permission checks use JSONB field queries (capabilities JSONB)

**Your Mission**: Measure and optimize authorization overhead to meet <50ms target.

## Business Context

**Performance Requirements**:

1. **Authorization Overhead**: Permission check middleware must add <50ms to API requests
2. **Database Query Latency**: PfaRecord queries must return in <100ms
3. **API Response Time**: Protected endpoints must respond in <200ms

**Why This Matters**:
- **User Experience**: Every API call includes permission check → slow checks = slow app
- **Cost**: Slow queries = more database load = higher cloud costs
- **Scalability**: 50ms overhead × 10,000 requests/day = 500 seconds wasted

## Technical Specification

**Performance Targets** (from TEST_PLAN.md line 874):

| Operation | Target Latency | P95 Latency | P99 Latency |
|-----------|----------------|-------------|-------------|
| **Authorization Middleware** | <50ms | <75ms | <100ms |
| **Database Query (by org)** | <100ms | <150ms | <200ms |
| **API Response (protected)** | <200ms | <300ms | <400ms |

**Benchmarking Approach**:

```typescript
// backend/tests/performance/authorizationBenchmark.test.ts
import { performance } from 'perf_hooks';
import { verifyToken } from '../../src/middleware/auth';
import { checkPermission } from '../../src/middleware/requirePermission';

describe('Performance: Authorization Overhead', () => {
  let token: string;
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(async () => {
    // Create test user and generate token
    const user = await createTestUser({
      username: 'perftest',
      role: 'editor',
      capabilities: { perm_ManageSettings: true }
    });
    token = generateToken(user);

    // Mock Express request/response
    mockReq = {
      headers: { authorization: `Bearer ${token}` },
      user: null
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  it('should verify token in <50ms', async () => {
    const iterations = 1000;
    const timings = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await verifyToken(mockReq, mockRes, mockNext);
      const end = performance.now();
      timings.push(end - start);
    }

    // Calculate percentiles
    timings.sort((a, b) => a - b);
    const p50 = timings[Math.floor(iterations * 0.5)];
    const p95 = timings[Math.floor(iterations * 0.95)];
    const p99 = timings[Math.floor(iterations * 0.99)];

    console.log(`Token Verification Latency:
      P50: ${p50.toFixed(2)}ms
      P95: ${p95.toFixed(2)}ms
      P99: ${p99.toFixed(2)}ms
    `);

    expect(p95).toBeLessThan(50);  // P95 < 50ms
  });

  it('should check permission in <50ms', async () => {
    const iterations = 1000;
    const timings = [];

    // Pre-authenticate user
    await verifyToken(mockReq, mockRes, mockNext);

    for (let i = 0; i < iterations; i++) {
      mockReq.user = { capabilities: { perm_ManageSettings: true } };

      const start = performance.now();
      await checkPermission('perm_ManageSettings')(mockReq, mockRes, mockNext);
      const end = performance.now();
      timings.push(end - start);
    }

    timings.sort((a, b) => a - b);
    const p95 = timings[Math.floor(iterations * 0.95)];

    expect(p95).toBeLessThan(50);
  });

  it('should query PfaRecords by org in <100ms', async () => {
    // Seed database with 10,000 PFA records
    await seedPfaRecords(10000, 'HOLNG');

    const iterations = 100;
    const timings = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const records = await prisma.pfaRecord.findMany({
        where: { organizationId: 'HOLNG' },
        take: 100
      });
      const end = performance.now();
      timings.push(end - start);
    }

    timings.sort((a, b) => a - b);
    const p95 = timings[Math.floor(iterations * 0.95)];

    console.log(`Database Query Latency (10K records):
      P50: ${timings[Math.floor(iterations * 0.5)].toFixed(2)}ms
      P95: ${p95.toFixed(2)}ms
    `);

    expect(p95).toBeLessThan(100);
  });
});
```

**Database Optimization Checks**:

```sql
-- Verify indexes exist
EXPLAIN ANALYZE
SELECT * FROM pfa_records
WHERE "organizationId" = 'HOLNG'
LIMIT 100;

-- Expected: Index Scan using idx_pfa_org
-- NOT: Seq Scan (sequential scan = missing index)

-- Check JSONB query performance
EXPLAIN ANALYZE
SELECT * FROM users
WHERE capabilities @> '{"perm_ManageSettings": true}';

-- Expected: Index Scan using idx_user_capabilities (GIN index)
```

## Your Mission

**Execute these steps**:

1. **Setup Performance Testing Environment** (1 hour):
   - Create `backend/tests/performance/` folder
   - Install `perf_hooks` for timing (built-in Node.js)
   - Seed test database with realistic data (10K+ records)

2. **Measure Authorization Overhead** (3 hours):
   - Benchmark `verifyToken()` middleware (1000 iterations)
   - Benchmark `checkPermission()` middleware (1000 iterations)
   - Calculate P50, P95, P99 latencies
   - Identify bottlenecks (JWT verification, database lookup)

3. **Measure Database Query Performance** (3 hours):
   - Benchmark PfaRecord queries (by organizationId)
   - Benchmark User queries (JSONB capabilities filter)
   - Benchmark ApiServer queries (multi-tenant isolation)
   - Run EXPLAIN ANALYZE to verify index usage

4. **API Response Time Benchmarking** (2 hours):
   - Measure end-to-end latency for protected endpoints
   - Breakdown: Authorization (middleware) + Business Logic + Database + Serialization
   - Identify slowest component

5. **Optimization Recommendations** (2 hours):
   - If authorization >50ms: Optimize JWT library, cache decoded tokens
   - If database >100ms: Add indexes, optimize queries
   - If serialization >50ms: Use faster JSON library

6. **Database Index Validation** (1 hour):
   - Verify all critical indexes exist:
     - `idx_pfa_org` on `pfaRecords(organizationId)`
     - `idx_user_capabilities` on `users(capabilities)` (GIN index)
     - `idx_apiserver_org` on `apiServers(organizationId)`
   - Run EXPLAIN ANALYZE to confirm usage

7. **Create Performance Report** (1 hour):
   - Document baseline metrics
   - Compare against targets
   - List optimizations applied
   - Show before/after measurements

## Deliverables

1. **Performance Test Suites**:
   - `backend/tests/performance/authorizationBenchmark.test.ts`
   - `backend/tests/performance/databaseQueryBenchmark.test.ts`
   - `backend/tests/performance/apiResponseBenchmark.test.ts`

2. **Benchmark Report**: `docs/performance/BENCHMARK_REPORT.md` with:
   - Latency tables (P50, P95, P99)
   - Database query plans (EXPLAIN ANALYZE output)
   - Optimization recommendations
   - Before/after comparisons

3. **Index Validation Script**: `backend/scripts/db/verify-indexes.ts`

4. **TESTING_LOG.md Update**: [TEST-PERF-001] with benchmark results

## Constraints

**❌ DO NOT**:
- Run benchmarks on shared development database
- Use production data for benchmarks
- Optimize prematurely (measure first, then optimize)
- Ignore P99 latency (affects real users)

**✅ DO**:
- Use isolated test database with realistic data
- Run benchmarks multiple times (average results)
- Document hardware specs (affects absolute numbers)
- Compare relative improvements (10% faster = good)

## Verification Questions

1. **Authorization Overhead**: Is P95 latency <50ms? (Check: benchmark results)
2. **Database Performance**: Is P95 query latency <100ms? (Check: EXPLAIN ANALYZE)
3. **Index Usage**: Are all queries using indexes? (Check: EXPLAIN output shows "Index Scan")
4. **API Response Time**: Is P95 response time <200ms? (Check: end-to-end benchmark)
5. **Optimization Impact**: Did optimizations improve latency? (Check: before/after comparison)
6. **Scalability**: Does performance degrade with 10K+ records? (Check: benchmark with large dataset)

---

# Bundle 10B.5: Accessibility Compliance Testing

**Agent**: @design-review

## System Context

You are a UX accessibility specialist focused on **WCAG 2.1 AA compliance**. Your mission is to verify that the Multi-Tenant Access Control UI is accessible to users with disabilities, including screen reader users and keyboard-only navigation.

**What This System Does**:
- User Management UI (components/admin/UserManagement.tsx)
- Permission Modal (components/PermissionModal.tsx)
- API Server Manager (components/admin/ApiServerManager.tsx)

**Your Mission**: Ensure all UI components meet WCAG 2.1 AA standards.

## Business Context

**Accessibility Requirements** (from UX_SPEC.md):

1. **Keyboard Navigation**: All interactive elements must be keyboard-accessible (no mouse required)
2. **Screen Reader Support**: All information must be readable by screen readers (ARIA labels, semantic HTML)
3. **Color Contrast**: Text must have 4.5:1 contrast ratio (AA standard)
4. **Focus Management**: Focus order must be logical, focus indicators must be visible

**Real-World Impact**:
- **Legal**: WCAG compliance required for government contracts
- **Inclusion**: 15% of users have disabilities (WHO)
- **SEO**: Accessible sites rank higher in search

## Technical Specification

**WCAG 2.1 AA Criteria** (Priority Areas):

1. **Perceivable**:
   - Text alternatives for images (alt text)
   - Color contrast ≥4.5:1
   - Resize text up to 200% without loss of functionality

2. **Operable**:
   - Keyboard accessible (no mouse traps)
   - Focus visible (outline on focused elements)
   - Bypass blocks (skip to main content)

3. **Understandable**:
   - Readable text (clear language)
   - Predictable navigation (consistent layout)
   - Input assistance (error messages, labels)

4. **Robust**:
   - Valid HTML (no parsing errors)
   - ARIA attributes correct
   - Compatible with assistive technologies

**Test Cases**:

```typescript
describe('Accessibility: User Management', () => {
  // Test 1: Keyboard Navigation
  it('should navigate through user table using keyboard', async () => {
    await page.goto('http://localhost:3000/admin/users');

    // Tab through interactive elements
    await page.keyboard.press('Tab');  // First row "Edit" button
    await expect(page.locator('button:focus')).toHaveText('Edit Permissions');

    await page.keyboard.press('Tab');  // "Suspend" button
    await expect(page.locator('button:focus')).toHaveText('Suspend User');

    await page.keyboard.press('Tab');  // Next row
    // Should continue to next row, not skip outside table

    // No keyboard traps
    await page.keyboard.press('Escape');
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible();
  });

  // Test 2: Screen Reader Support
  it('should have proper ARIA labels for screen readers', async () => {
    await page.goto('http://localhost:3000/admin/users');

    // Table should have aria-label
    const table = page.locator('table[data-testid="user-table"]');
    await expect(table).toHaveAttribute('aria-label', 'User list');

    // Buttons should have aria-labels
    const editButton = page.locator('button[aria-label="Edit permissions for alice"]').first();
    await expect(editButton).toBeVisible();

    // Status indicators should have accessible text
    const statusBadge = page.locator('span:has-text("Active")').first();
    await expect(statusBadge).toHaveAttribute('role', 'status');
  });

  // Test 3: Color Contrast
  it('should meet WCAG AA color contrast requirements', async () => {
    await page.goto('http://localhost:3000/admin/users');

    // Check text contrast (4.5:1 minimum)
    const textColor = await page.locator('td').first().evaluate(el =>
      window.getComputedStyle(el).color
    );
    const bgColor = await page.locator('td').first().evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );

    const contrast = calculateContrast(textColor, bgColor);
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });

  // Test 4: Focus Management
  it('should trap focus inside modal when open', async () => {
    await page.goto('http://localhost:3000/admin/users');

    // Open permission modal
    await page.click('button[aria-label="Edit Permissions"]');
    await page.waitForSelector('div[role="dialog"]');

    // Focus should be on first interactive element (checkbox)
    await expect(page.locator('input[type="checkbox"]:focus')).toBeVisible();

    // Tab through modal elements
    await page.keyboard.press('Tab');  // Next checkbox
    await page.keyboard.press('Tab');  // Save button
    await page.keyboard.press('Tab');  // Cancel button
    await page.keyboard.press('Tab');  // Should loop back to first checkbox

    const focusedElement = await page.locator(':focus').getAttribute('name');
    expect(focusedElement).toBe('perm_ManageUsers');  // First checkbox
  });

  // Test 5: Form Validation Accessibility
  it('should announce form errors to screen readers', async () => {
    await page.goto('http://localhost:3000/admin/api-connectivity');

    // Open server form
    await page.click('button:has-text("Add Server")');

    // Submit without filling required fields
    await page.click('button:has-text("Save")');

    // Error message should have role="alert"
    const errorMessage = page.locator('div[role="alert"]:has-text("Base URL is required")');
    await expect(errorMessage).toBeVisible();

    // Error should be associated with input
    const input = page.locator('input[name="baseUrl"]');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveAttribute('aria-describedby', expect.stringContaining('error'));
  });
});
```

**Automated Accessibility Testing**:

```typescript
// Use axe-core for automated WCAG checks
import { injectAxe, checkA11y } from 'axe-playwright';

describe('Accessibility: Automated Checks', () => {
  beforeEach(async ({ page }) => {
    await injectAxe(page);
  });

  it('should have no WCAG violations on User Management page', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/users');
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true }
    });
  });

  it('should have no WCAG violations on Permission Modal', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/users');
    await page.click('button[aria-label="Edit Permissions"]');
    await checkA11y(page, 'div[role="dialog"]');
  });
});
```

## Your Mission

**Execute these steps**:

1. **Setup Accessibility Testing Tools** (1 hour):
   - Install `axe-playwright`: `npm install -D axe-playwright`
   - Install Lighthouse CLI: `npm install -D lighthouse`
   - Set up manual testing with NVDA (screen reader)

2. **Automated Accessibility Audits** (2 hours):
   - Run axe-core on all admin pages
   - Run Lighthouse accessibility audit
   - Document all violations found
   - Categorize by severity (Critical, High, Medium, Low)

3. **Keyboard Navigation Testing** (3 hours):
   - Test all interactive elements (buttons, inputs, links)
   - Verify tab order is logical
   - Check for keyboard traps (modals, dropdowns)
   - Test Escape key closes modals

4. **Screen Reader Testing** (4 hours):
   - Test with NVDA (Windows) or VoiceOver (Mac)
   - Verify all text is readable
   - Check ARIA labels are accurate
   - Test form validation announcements

5. **Color Contrast Validation** (1 hour):
   - Use WebAIM Color Contrast Checker
   - Verify all text meets 4.5:1 ratio (AA)
   - Check interactive states (hover, focus, disabled)

6. **Focus Management** (2 hours):
   - Test modal focus trap
   - Verify focus indicators visible
   - Check focus restoration after modal close

7. **Create Remediation Plan** (1 hour):
   - List all violations found
   - Prioritize fixes (Critical → Low)
   - Provide code examples for fixes
   - Estimate effort (hours per fix)

## Deliverables

1. **Accessibility Test Suite**: `tests/accessibility/a11y.test.ts` (20+ tests)

2. **Accessibility Audit Report**: `docs/accessibility/WCAG_AUDIT_REPORT.md` with:
   - Automated scan results (axe-core, Lighthouse)
   - Manual testing results (keyboard, screen reader)
   - Violations list with severity
   - Remediation plan with code examples

3. **WCAG Compliance Checklist**: `docs/accessibility/WCAG_CHECKLIST.md`

4. **TESTING_LOG.md Update**: [TEST-A11Y-001] with audit results

## Constraints

**❌ DO NOT**:
- Rely solely on automated tools (miss 30-50% of issues)
- Ignore keyboard navigation (critical for accessibility)
- Use color alone to convey information
- Auto-focus elements on page load (disorienting)

**✅ DO**:
- Test with real screen readers (NVDA, VoiceOver)
- Use semantic HTML (header, nav, main, button)
- Provide text alternatives for icons
- Test with keyboard only (no mouse)

## Verification Questions

1. **Keyboard Navigation**: Can user complete all tasks without mouse? (Test: navigate user table with Tab/Enter)
2. **Screen Reader Support**: Can screen reader user understand all information? (Test: NVDA announcement check)
3. **Color Contrast**: Does all text meet 4.5:1 contrast ratio? (Test: WebAIM contrast checker)
4. **Focus Management**: Is focus trapped in modals? (Test: Tab through modal)
5. **Form Accessibility**: Are form errors announced to screen readers? (Test: submit invalid form)
6. **WCAG Compliance**: Are all Critical/High violations fixed? (Test: axe-core scan = 0 violations)

---

# Bundle 10B.6: Documentation Review

**Agent**: @documentation-synthesizer

## System Context

You are a technical documentation specialist focused on **API documentation**, **user guides**, and **admin manuals**. Your mission is to ensure all documentation for the Multi-Tenant Access Control feature is complete, accurate, and user-friendly.

**What This System Does**:
- Multi-tenant RBAC system with permissions and capabilities
- API Server Management with organization isolation
- User and Organization Management with status control

**Your Mission**: Review and update all documentation to production-ready standards.

## Business Context

**Documentation Gaps**:

1. **API Documentation**: New endpoints (POST /api/users/{id}/permissions) missing from API_REFERENCE.md
2. **User Guide**: No instructions for admins on how to grant permissions
3. **Admin Manual**: No troubleshooting guide for permission issues

**Why This Matters**:
- **Onboarding**: New admins need clear instructions to manage users
- **Support**: Support team needs troubleshooting guides to resolve issues
- **Developer Experience**: API documentation must be accurate and complete

## Technical Specification

**Documentation Review Checklist** (DOCUMENTATION_STANDARDS.md):

1. **API Reference** (`docs/backend/API_REFERENCE.md`):
   - ✅ All endpoints documented with request/response examples
   - ✅ Authentication requirements specified
   - ✅ Error codes and messages listed
   - ✅ Query parameters and filters explained

2. **User Guide** (`docs/user/USER_GUIDE.md`):
   - ✅ Step-by-step instructions for common tasks
   - ✅ Screenshots for complex workflows
   - ✅ Troubleshooting section for common issues

3. **Admin Manual** (`docs/user/ADMIN_GUIDE.md`):
   - ✅ User management instructions (create, suspend, grant permissions)
   - ✅ Organization management (create, suspend, delete)
   - ✅ API Server management (add, test, edit, delete)
   - ✅ Security best practices

4. **Architecture Documentation** (`docs/ARCHITECTURE.md`):
   - ✅ Updated with Multi-Tenant Access Control design
   - ✅ Database schema reflects new tables/fields
   - ✅ API endpoints list updated

5. **README.md** (Project root):
   - ✅ Current features list includes Multi-Tenant Access Control
   - ✅ Getting started instructions updated
   - ✅ Links to new documentation sections

**Documentation Gaps to Fill**:

```markdown
# docs/backend/API_REFERENCE.md (ADD NEW SECTION)

## User Management Endpoints

### POST /api/users/{userId}/permissions
Grant or revoke permissions for a user.

**Authentication:** Required (JWT token with `perm_ManageUsers` capability)

**Request:**
```json
{
  "capabilities": {
    "perm_ManageUsers": true,
    "perm_ManageSettings": false,
    "viewFinancialDetails": true
  }
}
```

**Response (200 OK):**
```json
{
  "id": "user-123",
  "username": "alice",
  "capabilities": {
    "perm_ManageUsers": true,
    "perm_ManageSettings": false,
    "viewFinancialDetails": true
  },
  "updatedAt": "2025-11-27T10:30:00Z"
}
```

**Error Responses:**
- `401 Unauthorized` - No JWT token provided
- `403 Forbidden` - User lacks `perm_ManageUsers` capability
- `404 Not Found` - User ID does not exist

---

# docs/user/ADMIN_GUIDE.md (ADD NEW SECTION)

## Managing User Permissions

### How to Grant Permissions

1. **Navigate to User Management:**
   - Click "Administration" in sidebar
   - Select "User Management"

2. **Select User:**
   - Find the user in the table
   - Click the "Edit Permissions" button (pencil icon)

3. **Grant Permissions:**
   - Check the permissions you want to grant:
     - **Manage Users**: Create, edit, suspend users
     - **Manage Settings**: Create, edit API servers
     - **View Financial Details**: See cost data in PFA records
   - Click "Save"

4. **Verify:**
   - User should see new permissions immediately
   - Log in as the user to confirm access

**Screenshot:** [Insert screenshot of Permission Modal here]

### Troubleshooting Permission Issues

#### "User has permission but cannot perform action"

**Possible Causes:**
1. **Browser cache:** User needs to refresh page or re-login
2. **Permission not saved:** Check database (capabilities JSONB field)
3. **Bug in permission check:** Check backend logs

**Solution:**
1. Have user logout and login again
2. Verify permission in database:
   ```sql
   SELECT capabilities FROM users WHERE id = 'user-123';
   ```
3. If still broken, contact development team

#### "Permission modal shows loading indefinitely"

**Possible Causes:**
1. **API endpoint down:** Check backend server status
2. **Network error:** Check browser console

**Solution:**
1. Refresh page
2. Check backend logs for errors
3. Verify API endpoint: `GET /api/users/{id}`
```

**Documentation Quality Checklist**:

- [ ] **Accuracy**: All information is correct and up-to-date
- [ ] **Completeness**: No missing endpoints or features
- [ ] **Clarity**: Easy to understand for target audience
- [ ] **Examples**: Code examples for all API endpoints
- [ ] **Screenshots**: Visual guides for complex UI workflows
- [ ] **Searchability**: Good headings, table of contents, index
- [ ] **Consistency**: Consistent formatting and terminology
- [ ] **Accessibility**: Proper heading hierarchy (H1 → H2 → H3)

## Your Mission

**Execute these steps**:

1. **API Documentation Review** (3 hours):
   - Review `docs/backend/API_REFERENCE.md`
   - Add missing endpoints (POST /api/users/{id}/permissions, PATCH /api/users/{id}/suspend, etc.)
   - Verify request/response examples match actual implementation
   - Add error code documentation
   - Test all examples (copy-paste into Postman/curl)

2. **User Guide Creation** (4 hours):
   - Create `docs/user/USER_GUIDE.md` for end users
   - Write step-by-step instructions for:
     - Viewing user list
     - Checking permissions
     - Switching organizations
   - Add screenshots for each workflow
   - Include troubleshooting section

3. **Admin Manual Creation** (5 hours):
   - Create `docs/user/ADMIN_GUIDE.md` for administrators
   - Write step-by-step instructions for:
     - Creating users
     - Granting/revoking permissions
     - Suspending/unsuspending users
     - Managing organizations
     - Managing API servers
   - Add security best practices
   - Include troubleshooting guide

4. **Architecture Documentation Update** (2 hours):
   - Update `docs/ARCHITECTURE.md` with:
     - Multi-Tenant Access Control section
     - Database schema changes (capabilities JSONB, serviceStatus enum)
     - New API endpoints
   - Update architecture diagrams

5. **README.md Update** (1 hour):
   - Add "Multi-Tenant Access Control" to Features section
   - Update "Getting Started" with admin login
   - Add links to new documentation

6. **Cross-Reference Verification** (1 hour):
   - Verify all internal links work
   - Check that examples reference correct endpoints
   - Ensure terminology is consistent across docs

7. **Documentation Review Checklist** (1 hour):
   - Create `docs/DOCUMENTATION_REVIEW_CHECKLIST.md`
   - Run through checklist for all documents
   - Fix any issues found

## Deliverables

1. **Updated API Documentation**: `docs/backend/API_REFERENCE.md` (complete endpoint list)

2. **User Guide**: `docs/user/USER_GUIDE.md` (20+ pages)

3. **Admin Manual**: `docs/user/ADMIN_GUIDE.md` (30+ pages)

4. **Architecture Update**: `docs/ARCHITECTURE.md` (Multi-Tenant Access Control section)

5. **Updated README**: `README.md` (current features + links)

6. **Documentation Review Report**: `docs/DOCUMENTATION_REVIEW_REPORT.md` with:
   - Gaps found and filled
   - Documentation quality metrics
   - Recommendations for future improvements

7. **TESTING_LOG.md Update**: [TEST-DOC-001] with review status

## Constraints

**❌ DO NOT**:
- Copy outdated examples from old documentation
- Use technical jargon in user guides (write for non-technical audience)
- Skip screenshots (visual aids critical for users)
- Forget to update version numbers

**✅ DO**:
- Test all code examples before including
- Use clear, simple language
- Include screenshots for complex workflows
- Cross-reference related documentation

## Verification Questions

1. **API Completeness**: Are all new endpoints documented? (Check: API_REFERENCE.md has POST /api/users/{id}/permissions)
2. **User Guide Usability**: Can non-technical user follow instructions? (Test: give guide to non-developer)
3. **Example Accuracy**: Do all code examples work? (Test: copy-paste into Postman)
4. **Screenshot Currency**: Do screenshots match current UI? (Check: compare with live app)
5. **Cross-References**: Do all internal links work? (Test: click every link)
6. **README Accuracy**: Does README reflect current features? (Check: Multi-Tenant Access Control listed)

---

# Summary

**8 Complete Prompt Bundles** for Phase 10 remaining tasks:

**Security (2 bundles)**:
- 10A.5: JWT Tampering Testing (ai-security-red-teamer)
- 10A.6: Rate Limiting Bypass Testing (ai-security-red-teamer)

**QA (6 bundles)**:
- 10B.1: Integration Test Suite (sdet-test-automation) - 171+ tests
- 10B.2: E2E Permission Workflow Tests (sdet-test-automation)
- 10B.3: Load Testing (sdet-test-automation) - 1000 concurrent users
- 10B.4: Performance Benchmarking (sdet-test-automation) - <50ms overhead
- 10B.5: Accessibility Compliance Testing (design-review) - WCAG AA
- 10B.6: Documentation Review (documentation-synthesizer)

**Total Estimated Effort**: ~90 hours across 8 tasks

**Success Criteria**:
- All tests passing (171+ integration, 30+ E2E, 10+ load tests)
- >80% code coverage
- <50ms authorization overhead
- WCAG 2.1 AA compliance
- Complete documentation (API, User Guide, Admin Manual)

---

**Document Version**: 1.0
**Generated**: 2025-11-27
**Source**: ADR-005-TEST_PLAN.md, ADR-005-UX_SPEC.md, DOCUMENTATION_STANDARDS.md
