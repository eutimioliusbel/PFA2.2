# ADR-006: API Server and Endpoint Architecture - Technical Implementation Plan

> **Primary Agents**: `backend-architecture-optimizer`, `postgres-jsonb-architect`, `react-ai-ux-specialist`
> **Instruction**: Define the technical build for the **Two-Tier API Architecture**. Include the *foundations* (data hooks) requested in `AI_OPPORTUNITIES.md`.

**Status**: 🔴 Draft
**Created**: 2025-11-26
**Dependencies**:
- Prisma ORM (existing)
- Encryption utilities (existing)
- NextUI components (existing)
- React Query (existing)

---

## 📋 1. Overview

### Goals
Refactor current API architecture from 7 duplicate `ApiConfiguration` records to a two-tier `ApiServer → ApiEndpoint` architecture, eliminating credential duplication and enabling per-endpoint testing and error tracking.

### Success Criteria
- [ ] All user stories from DECISION.md implemented
- [ ] Performance targets from UX_SPEC.md met (<1ms URL construction overhead)
- [ ] Security tests from TEST_PLAN.md passing (credentials encrypted, no IDOR)
- [ ] AI data hooks from AI_OPPORTUNITIES.md implemented (endpoint health tracking, test logging)
- [ ] Migration script successfully converts existing 7 PEMS configs

### Key Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Credential Entry | 1× per server (down from 7×) | Count of encrypted credential fields |
| URL Construction Time | <1ms | Performance benchmark |
| Migration Time | <5 seconds | Migration script execution |
| Test Coverage | >95% (services) | Jest coverage report |

---

## 🗄️ 2. Database Schema (PostgreSQL/Prisma)

### New Models

#### ApiServer Model
```prisma
model ApiServer {
  id                 String   @id @default(uuid())
  organizationId     String
  organization       Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Server Identification
  name               String   // "PEMS Production", "ESS Integration"
  baseUrl            String   // "https://pems.example.com:443/axis/restservices"

  // Authentication (Encrypted)
  authType           String   @default("basic") // "basic", "bearer", "apiKey", "oauth2"
  authKeyEncrypted   String?  // Username (encrypted)
  authValueEncrypted String?  // Password (encrypted)

  // Common Headers (JSON)
  commonHeaders      String?  // JSON: { "tenant": "BECHTEL_DEV", "gridCode": "PEMS", "gridId": "1234" }

  // Health Tracking (AI Hooks)
  healthStatus       String   @default("untested") // "healthy", "degraded", "down", "untested"
  healthScore        Int      @default(0)  // 0-100, based on endpoint success rates
  lastHealthCheckAt  DateTime?

  // Metadata
  status             String   @default("untested") // "active", "inactive", "untested"
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  // Relations
  endpoints          ApiEndpoint[]

  @@unique([organizationId, name])
  @@index([organizationId])
  @@map("api_servers")
}
```

---

#### ApiEndpoint Model
```prisma
model ApiEndpoint {
  id                 String   @id @default(uuid())
  serverId           String
  server             ApiServer @relation(fields: [serverId], references: [id], onDelete: Cascade)

  // Endpoint Identification
  name               String   // "Assets", "Users", "Categories"
  path               String   // "/assets", "/usersetup", "/categories"

  // Data Mapping
  entity             String   // "asset_master", "users", "classifications"
  operationType      String   @default("read") // "read", "write", "read-write"
  feeds              String?  // JSON: [{ entity: "asset_master", views: [...] }]

  // Endpoint-Specific Overrides (Optional)
  customHeaders      String?  // JSON: Endpoint-specific headers (override server defaults)

  // Health Tracking (AI Hooks)
  status             String   @default("untested") // "healthy", "degraded", "down", "untested"
  firstTestedAt      DateTime?
  lastTestedAt       DateTime?
  testCount          Int      @default(0)
  successCount       Int      @default(0)
  failureCount       Int      @default(0)
  avgResponseTimeMs  Int?     // Average response time
  lastKnownGoodAt    DateTime? // Last successful test
  lastErrorMessage   String?
  lastErrorAt        DateTime?

  // Metadata
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  // Relations
  dataSourceMappings DataSourceMapping[]
  testResults        EndpointTestResult[] // AI Hook: Detailed test history

  @@unique([serverId, path])
  @@index([serverId])
  @@index([entity])
  @@map("api_endpoints")
}
```

---

#### EndpointTestResult Model (AI Hook)
```prisma
model EndpointTestResult {
  id                 String   @id @default(uuid())
  endpointId         String
  endpoint           ApiEndpoint @relation(fields: [endpointId], references: [id], onDelete: Cascade)

  // Test Execution
  testTimestamp      DateTime @default(now())
  success            Boolean
  responseTimeMs     Int?
  statusCode         Int?

  // Error Details
  errorType          String?  // "NETWORK_TIMEOUT", "AUTH_FAILURE", "NOT_FOUND", "SERVER_ERROR"
  errorMessage       String?

  // Request/Response Details (AI Hook)
  requestUrl         String?
  requestMethod      String?  // "GET", "POST"
  requestHeaders     String?  // JSON
  requestPayload     String?  // JSON
  responseHeaders    String?  // JSON
  responseSample     String?  // First 1KB of response

  // Context (AI Hook)
  contextData        String?  // JSON: { serverHealthBefore, otherEndpointsStatus, userAction }

  @@index([endpointId])
  @@index([testTimestamp])
  @@map("endpoint_test_results")
}
```

---

### Schema Updates

#### DataSourceMapping Model (Update)
```prisma
model DataSourceMapping {
  // CHANGED: Point to ApiEndpoint instead of ApiConfiguration
  apiEndpointId   String?
  apiEndpoint     ApiEndpoint? @relation(fields: [apiEndpointId], references: [id], onDelete: SetNull)

  // DEPRECATED (keep for migration, remove after)
  apiConfigurationId String?
  apiConfiguration   ApiConfiguration? @relation(fields: [apiConfigurationId], references: [id], onDelete: SetNull)

  // ... rest unchanged
}
```

---

## 🔌 3. API Architecture (Backend)

### New Endpoints

#### Server Management

**GET /api/servers**
- Purpose: List all servers for organization
- Response: `{ servers: ApiServer[] }`

**POST /api/servers**
- Purpose: Create new server
- Request: `{ name, baseUrl, authType, authKey, authValue, commonHeaders }`
- Response: `{ server: ApiServer }`
- Security: Encrypt authKey/authValue before storage

**PUT /api/servers/:id**
- Purpose: Update server configuration
- Request: `{ name?, baseUrl?, authKey?, authValue?, commonHeaders? }`
- Response: `{ server: ApiServer }`

**DELETE /api/servers/:id**
- Purpose: Delete server (cascades to endpoints)
- Response: `{ success: true }`

**POST /api/servers/:id/test**
- Purpose: Test server connection (tests all endpoints)
- Response: `{ success, healthScore, endpointResults: [...] }`

---

#### Endpoint Management

**GET /api/servers/:serverId/endpoints**
- Purpose: List endpoints for server
- Response: `{ endpoints: ApiEndpoint[] }`

**POST /api/servers/:serverId/endpoints**
- Purpose: Create new endpoint
- Request: `{ name, path, entity, operationType, customHeaders? }`
- Response: `{ endpoint: ApiEndpoint }`

**PUT /api/servers/:serverId/endpoints/:id**
- Purpose: Update endpoint
- Request: `{ name?, path?, entity?, operationType?, customHeaders? }`
- Response: `{ endpoint: ApiEndpoint }`

**DELETE /api/servers/:serverId/endpoints/:id**
- Purpose: Delete endpoint
- Response: `{ success: true }`

**POST /api/servers/:serverId/endpoints/:id/test**
- Purpose: Test individual endpoint
- Request: `{ dryRun?: boolean }` (AI Hook)
- Response: `{ success, responseTimeMs, statusCode, errorMessage?, previewData? }`
- Side Effect: Creates EndpointTestResult record

---

#### Bulk Operations

**POST /api/servers/:serverId/endpoints/test-all**
- Purpose: Test all endpoints sequentially
- Response: `{ totalCount, successCount, failureCount, results: [...] }`

**GET /api/servers/:serverId/health**
- Purpose: Get server health summary (AI Hook)
- Response: `{ healthStatus, healthScore, endpoints: [...] }`

**GET /api/servers/:serverId/endpoints/:endpointId/history?days=7**
- Purpose: Get endpoint test history (AI Hook)
- Response: `{ testHistory: EndpointTestResult[], uptimePercentage }`

---

### Service Layer

#### apiServerService.ts
```typescript
export class ApiServerService {
  // CRUD operations
  async createServer(data: CreateServerDto): Promise<ApiServer>
  async updateServer(id: string, data: UpdateServerDto): Promise<ApiServer>
  async deleteServer(id: string): Promise<void>
  async getServers(organizationId: string): Promise<ApiServer[]>

  // Testing
  async testServer(id: string): Promise<ServerTestResult>
  async getServerHealth(id: string): Promise<ServerHealth>

  // URL Construction
  constructUrl(server: ApiServer, endpoint: ApiEndpoint): string {
    // Performance: <1ms
    const baseUrl = server.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    const path = endpoint.path.replace(/^\//, ''); // Remove leading slash
    return `${baseUrl}/${path}`;
  }
}
```

---

#### apiEndpointService.ts
```typescript
export class ApiEndpointService {
  // CRUD operations
  async createEndpoint(serverId: string, data: CreateEndpointDto): Promise<ApiEndpoint>
  async updateEndpoint(id: string, data: UpdateEndpointDto): Promise<ApiEndpoint>
  async deleteEndpoint(id: string): Promise<void>
  async getEndpoints(serverId: string): Promise<ApiEndpoint[]>

  // Testing (AI Hooks)
  async testEndpoint(id: string, dryRun: boolean = false): Promise<EndpointTestResult>
  async testAllEndpoints(serverId: string): Promise<BulkTestResult>

  // Health Tracking (AI Hooks)
  async getEndpointHealth(id: string): Promise<EndpointHealth>
  async getEndpointTestHistory(id: string, days: number): Promise<EndpointTestResult[]>

  // Metadata Updates
  async updateEndpointMetrics(id: string, result: EndpointTestResult): Promise<void> {
    // Update testCount, successCount, failureCount, avgResponseTimeMs
    // Update status based on recent results (healthy/degraded/down)
  }
}
```

---

## 🔄 4. Migration Strategy

### Migration Script: `migrate-api-servers.ts`

**Purpose**: Convert existing 7 `ApiConfiguration` records to 1 `ApiServer` + 7 `ApiEndpoint` records.

**Algorithm**:
```typescript
async function migrateApiServers() {
  console.log('Starting API Server Migration...');

  // Step 1: Find all PEMS API configurations
  const pemsConfigs = await prisma.apiConfiguration.findMany({
    where: {
      name: { contains: 'PEMS' },
      organizationId: 'pems-global'
    }
  });

  if (pemsConfigs.length === 0) {
    console.log('No PEMS configs found. Skipping migration.');
    return;
  }

  // Step 2: Extract common server details (from first config)
  const firstConfig = pemsConfigs[0];
  const baseUrl = extractBaseUrl(firstConfig.url); // "https://...com:443/axis/restservices"

  // Step 3: Create ApiServer
  const server = await prisma.apiServer.create({
    data: {
      organizationId: firstConfig.organizationId,
      name: 'PEMS Production',
      baseUrl: baseUrl,
      authType: 'basic',
      authKeyEncrypted: firstConfig.authKeyEncrypted,
      authValueEncrypted: firstConfig.authValueEncrypted,
      commonHeaders: firstConfig.customHeaders, // tenant, gridCode, gridId
      status: firstConfig.status
    }
  });

  console.log(`✓ Created ApiServer: ${server.name} (${server.id})`);

  // Step 4: Create ApiEndpoint for each config
  for (const config of pemsConfigs) {
    const path = extractPath(config.url); // "/assets", "/usersetup", etc.
    const endpoint = await prisma.apiEndpoint.create({
      data: {
        serverId: server.id,
        name: config.name.replace('PEMS - ', ''), // "Assets", "Users"
        path: path,
        entity: extractEntity(config.usage), // PEMS_ASSETS → "asset_master"
        operationType: config.operationType,
        feeds: config.feeds,
        status: config.status,
        // Copy metrics if available
        firstTestedAt: config.firstSyncAt,
        lastTestedAt: config.lastSyncAt
      }
    });

    console.log(`✓ Created ApiEndpoint: ${endpoint.name} (${path})`);

    // Step 5: Update DataSourceMappings
    await prisma.dataSourceMapping.updateMany({
      where: { apiConfigurationId: config.id },
      data: {
        apiEndpointId: endpoint.id,
        apiConfigurationId: null // Remove old reference
      }
    });

    console.log(`✓ Updated DataSourceMappings for ${endpoint.name}`);
  }

  // Step 6: Archive old ApiConfiguration records (soft delete)
  await prisma.apiConfiguration.updateMany({
    where: { id: { in: pemsConfigs.map(c => c.id) } },
    data: { status: 'archived' }
  });

  console.log(`✓ Archived ${pemsConfigs.length} old ApiConfiguration records`);
  console.log('Migration completed successfully!');
}

// Helper functions
function extractBaseUrl(fullUrl: string): string {
  // "https://...com:443/axis/restservices/assets" → "https://...com:443/axis/restservices"
  const url = new URL(fullUrl);
  const pathParts = url.pathname.split('/');
  const basePath = pathParts.slice(0, -1).join('/'); // Remove last segment
  return `${url.origin}${basePath}`;
}

function extractPath(fullUrl: string): string {
  // "https://...com:443/axis/restservices/assets" → "/assets"
  const url = new URL(fullUrl);
  const pathParts = url.pathname.split('/');
  return '/' + pathParts[pathParts.length - 1];
}

function extractEntity(usage: string): string {
  const map: Record<string, string> = {
    'PEMS_ASSETS': 'asset_master',
    'PEMS_CLASSES': 'classifications',
    'PEMS_MANUFACTURERS': 'manufacturers',
    'PEMS_ORGANIZATIONS': 'organizations',
    'PEMS_PFA_READ': 'pfa',
    'PEMS_PFA_WRITE': 'pfa',
    'PEMS_USER_SYNC': 'users'
  };
  return map[usage] || 'unknown';
}
```

**Rollback Strategy**:
```typescript
async function rollbackMigration() {
  // Restore ApiConfiguration records from archive
  await prisma.apiConfiguration.updateMany({
    where: { status: 'archived' },
    data: { status: 'active' }
  });

  // Restore DataSourceMappings
  // (Complex - need to store mapping before migration)

  // Delete new ApiServer and ApiEndpoint records
  await prisma.apiServer.deleteMany({
    where: { name: 'PEMS Production' }
  }); // Cascades to ApiEndpoint

  console.log('Rollback completed');
}
```

---

## 🎨 5. Frontend Architecture (React)

### Component Tree

```
<ApiConnectivity>
  ├─ <ServerList>
  │    ├─ <ServerCard> (expandable)
  │    │    ├─ <ServerHeader>
  │    │    │    ├─ Server Name
  │    │    │    ├─ Health Indicator (●●●●●●○ 6/7)
  │    │    │    └─ "Test All" Button
  │    │    └─ <EndpointList> (shown when expanded)
  │    │         └─ <EndpointRow> (repeatable)
  │    │              ├─ Status Icon (✅/❌/⏳)
  │    │              ├─ Name + Latency
  │    │              └─ "Test" Button
  │    └─ "+ Add Server" Button
  └─ <ServerModal> (create/edit)
       ├─ <ServerForm>
       └─ <EndpointForm> (nested)
```

---

### State Management

**React Query Keys**:
```typescript
['servers', organizationId]                           // List of servers
['server', serverId]                                  // Single server details
['endpoints', serverId]                               // Endpoints for server
['endpoint-health', endpointId]                       // Endpoint health status
['endpoint-test-history', endpointId, days]           // Test history (AI Hook)
```

**Mutations**:
```typescript
useMutation(['createServer'], createServer, {
  onSuccess: () => queryClient.invalidateQueries(['servers'])
});

useMutation(['testEndpoint'], testEndpoint, {
  onMutate: async (endpointId) => {
    // Optimistic update: Set status to "testing"
    await queryClient.cancelQueries(['endpoints', serverId]);
    const previous = queryClient.getQueryData(['endpoints', serverId]);
    queryClient.setQueryData(['endpoints', serverId], (old: Endpoint[]) =>
      old.map(ep => ep.id === endpointId ? { ...ep, status: 'testing' } : ep)
    );
    return { previous };
  },
  onError: (err, variables, context) => {
    // Revert optimistic update
    queryClient.setQueryData(['endpoints', serverId], context.previous);
  },
  onSuccess: (result, endpointId) => {
    // Update with real result
    queryClient.invalidateQueries(['endpoints', serverId]);
    queryClient.invalidateQueries(['endpoint-health', endpointId]);
  }
});
```

---

### URL Construction Utility (Frontend)

```typescript
// utils/urlConstructor.ts
export function constructApiUrl(server: ApiServer, endpoint: ApiEndpoint): string {
  const baseUrl = server.baseUrl.replace(/\/$/, '');
  const path = endpoint.path.replace(/^\//, '');
  return `${baseUrl}/${path}`;
}

// Add common headers
export function buildRequestHeaders(server: ApiServer, endpoint: ApiEndpoint): Headers {
  const headers = new Headers();

  // Add server common headers
  if (server.commonHeaders) {
    const commonHeaders = JSON.parse(server.commonHeaders);
    Object.entries(commonHeaders).forEach(([key, value]) => {
      headers.set(key, value as string);
    });
  }

  // Override with endpoint-specific headers
  if (endpoint.customHeaders) {
    const customHeaders = JSON.parse(endpoint.customHeaders);
    Object.entries(customHeaders).forEach(([key, value]) => {
      headers.set(key, value as string);
    });
  }

  return headers;
}
```

---

## 🚀 6. Implementation Phases

### Phase 1: Database Schema & Migration (1 day)
**Agent**: `postgres-jsonb-architect`

**Deliverables**:
- [ ] Create Prisma schema for ApiServer, ApiEndpoint, EndpointTestResult
- [ ] Update DataSourceMapping to reference ApiEndpoint
- [ ] Generate migration: `npx prisma migrate dev --name api_server_endpoint_architecture`
- [ ] Write migration script: `migrate-api-servers.ts`
- [ ] Write rollback script: `rollback-migration.ts`
- [ ] Test migration on development database

**Verification**:
- [ ] Migration runs successfully (<5 seconds)
- [ ] All 7 PEMS configs converted to 1 server + 7 endpoints
- [ ] DataSourceMappings updated correctly
- [ ] Rollback restores original state

---

### Phase 2: Backend Services & APIs (1 day)
**Agent**: `backend-architecture-optimizer`

**Deliverables**:
- [ ] Implement `apiServerService.ts`
- [ ] Implement `apiEndpointService.ts`
- [ ] Create API routes for server & endpoint management
- [ ] Implement endpoint testing logic (with AI hooks)
- [ ] Add input validation (Zod schemas)
- [ ] Unit tests (>95% coverage)

**Verification**:
- [ ] All endpoints return 200 for valid input
- [ ] Credentials encrypted before storage
- [ ] URL construction <1ms
- [ ] Security tests pass (SQL injection, IDOR)

---

### Phase 3: Frontend Components (1 day)
**Agent**: `react-ai-ux-specialist`

**Deliverables**:
- [ ] Refactor ApiConnectivity.tsx for hierarchical view
- [ ] Implement ServerCard with expand/collapse
- [ ] Implement EndpointRow with test button
- [ ] Add optimistic UI for endpoint testing
- [ ] Integrate React Query for data fetching
- [ ] Component tests (>70% coverage)

**Verification**:
- [ ] Hierarchical view renders correctly
- [ ] Expand/collapse animation <200ms
- [ ] Test button shows "Testing..." immediately
- [ ] UX matches UX_SPEC.md

---

### Phase 4: Testing & Documentation (0.5 days)
**Agents**: `sdet-test-automation` + `documentation-synthesizer`

**Deliverables**:
- [ ] E2E tests per TEST_PLAN.md
- [ ] Security red team tests
- [ ] Performance benchmarks
- [ ] Update TECHNICAL_DOCS.md

**Verification**:
- [ ] All tests passing
- [ ] Coverage targets met (>95% backend, >70% frontend)
- [ ] Docs accurate and complete

---

## 🔄 7. Rollback Plan

**If Critical Issues**:
```bash
# Revert database migration
npx prisma migrate resolve --rolled-back 20251126_api_server_endpoint_architecture

# Run rollback script
npm run migrate:rollback

# Restore DataSourceMappings from backup
npm run migrate:restore-mappings

# Deploy previous version
npm run deploy:rollback
```

**Data Preservation**:
- Old ApiConfiguration records archived (not deleted)
- DataSourceMappings backup created before migration
- Can restore to previous state within 5 minutes

---

## 📚 Related Documentation

- **Decision**: [ADR-006-DECISION.md](./ADR-006-DECISION.md)
- **AI Opportunities**: [ADR-006-AI_OPPORTUNITIES.md](./ADR-006-AI_OPPORTUNITIES.md)
- **UX Specification**: [ADR-006-UX_SPEC.md](./ADR-006-UX_SPEC.md)
- **Test Plan**: [ADR-006-TEST_PLAN.md](./ADR-006-TEST_PLAN.md)
- **Agent Workflow**: [ADR-006-AGENT_WORKFLOW.md](./ADR-006-AGENT_WORKFLOW.md)

---

**Status**: 🔴 Draft - Awaiting Architecture Review
**Next Step**: Review with backend and frontend architects, then proceed to orchestration

*Document created: 2025-11-26*
*Last updated: 2025-11-26*
