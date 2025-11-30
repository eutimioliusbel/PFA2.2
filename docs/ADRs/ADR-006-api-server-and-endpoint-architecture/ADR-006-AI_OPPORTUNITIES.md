# ADR-006: API Server and Endpoint Architecture - AI Opportunities & Future Strategy

> **Primary Agent**: `ai-systems-architect`
> **Instruction**: Be extremely creative. How could an LLM or Agent revolutionize this specific feature in Phase 2? Focus on *innovative* capabilities, not just "AI can do what humans do."

**Status**: 🔴 Draft
**Created**: 2025-11-26
**Last Updated**: 2025-11-26

---

## 🧠 1. Innovative Use Cases (Brainstorming)

**Think beyond automation. How can AI make this feature 10x better?**

### Use Case 1: Auto-Discovery of API Endpoints
**Scenario**: AI analyzes PEMS API documentation (OpenAPI/Swagger) and auto-generates endpoint configurations.

**AI Capability**:
- User provides PEMS server URL + credentials
- AI fetches OpenAPI spec from `/swagger.json` or `/api-docs`
- Analyzes available endpoints and their schemas
- Auto-creates ApiEndpoint records with proper paths, entities, operation types
- Suggests field mappings for DataSourceMappings

**Business Value**: Reduces setup time from hours to minutes, eliminates manual endpoint configuration errors

---

### Use Case 2: Intelligent Endpoint Health Monitoring
**Scenario**: AI continuously monitors endpoint health and predicts failures before they happen.

**AI Capability**:
- Tracks endpoint response times, error rates, and patterns
- Detects anomalies (e.g., "Assets endpoint usually responds in 200ms, now taking 2000ms")
- Predicts failures: "Based on pattern, User Sync endpoint will timeout in next 30 minutes"
- Proactively suggests switching to fallback server or retrying failed requests

**Business Value**: Prevents data sync failures, reduces downtime, improves reliability

---

### Use Case 3: Auto-Healing Endpoint Configurations
**Scenario**: AI detects endpoint failures and automatically tries alternate configurations.

**AI Capability**:
- Endpoint test fails with 404
- AI analyzes error message and PEMS API documentation
- Suggests fix: "Path changed from `/assets` to `/v2/assets`. Update endpoint?"
- Optionally auto-applies fix if confidence score >95%

**Business Value**: Self-healing integrations, reduces manual troubleshooting time by 80%

---

### Use Case 4: Natural Language Endpoint Configuration
**Scenario**: Admin types "Add endpoint for PEMS manufacturers data" instead of filling forms.

**AI Capability**:
- Parses natural language request
- Maps to technical requirements: `entity: 'manufacturers', path: '/manufacturers', operationType: 'read'`
- Auto-fills form or creates endpoint directly
- Asks clarifying questions if ambiguous: "Should this be read-only or read-write?"

**Business Value**: 10x faster endpoint setup, accessible to non-technical admins

---

### Use Case 5: Predictive Error Root Cause Analysis
**Scenario**: Multiple endpoints fail simultaneously. AI identifies the root cause.

**AI Capability**:
- Detects pattern: All PEMS endpoints failing at same time
- Analyzes logs and error messages
- Root cause: "PEMS server credential expired (401 errors across all endpoints)"
- Suggests fix: "Update server credentials, all endpoints will automatically recover"

**Business Value**: Instant diagnostics, fixes systemic issues in seconds instead of hours

---

## 🔌 2. Mandatory Data Hooks (Phase 1 Requirements)

**⚠️ CRITICAL: To make the AI use cases above possible in Phase 2, the Backend Architect MUST implement these data hooks NOW in Phase 1.**

### Hook 1: Endpoint Test Result Logging
**Requirement**: Store detailed test results for each endpoint, not just pass/fail.

**Implementation**:
```typescript
// ❌ DON'T just store boolean
{ testPassed: true }

// ✅ DO store detailed telemetry
{
  endpointId: "uuid",
  testTimestamp: "2025-11-26T10:30:00Z",
  success: true,
  responseTimeMs: 215,
  statusCode: 200,
  errorMessage: null,
  responseHeaders: { "content-type": "application/json" },
  responseSample: { ... },  // First 1KB of response
  requestPayload: { ... }    // What we sent
}
```

**Why**: Enables AI to analyze patterns, detect anomalies, and predict failures.

---

### Hook 2: Endpoint Metadata Tracking
**Requirement**: Track endpoint usage, performance, and reliability metrics.

**Implementation**:
```typescript
// Add to ApiEndpoint model
{
  firstTestedAt: "2025-11-26T10:00:00Z",
  lastTestedAt: "2025-11-26T15:45:00Z",
  testCount: 47,
  successCount: 45,
  failureCount: 2,
  avgResponseTimeMs: 215,
  lastKnownGoodAt: "2025-11-26T15:45:00Z",  // Last successful test
  lastErrorMessage: "404 Not Found",
  lastErrorAt: "2025-11-26T12:30:00Z"
}
```

**Why**: AI can identify slow/unreliable endpoints and suggest optimizations.

---

### Hook 3: Server Health Aggregation
**Requirement**: Track overall server health based on endpoint statuses.

**Implementation**:
```typescript
// Add to ApiServer model
{
  healthStatus: "healthy" | "degraded" | "down",
  healthScore: 95,  // 0-100, based on endpoint success rates
  totalEndpoints: 7,
  healthyEndpoints: 6,
  degradedEndpoints: 1,
  downEndpoints: 0,
  lastHealthCheckAt: "2025-11-26T15:45:00Z"
}
```

**Why**: Enables AI to detect systemic server issues vs individual endpoint failures.

---

### Hook 4: Endpoint Dry-Run API Support
**Requirement**: API must support testing endpoints without modifying data or triggering sync.

**Implementation**:
```typescript
POST /api/servers/:serverId/endpoints/:endpointId/test?dryRun=true
Response: {
  success: true,
  responseTimeMs: 215,
  statusCode: 200,
  previewData: [...],  // Sample of what would be synced
  warnings: []
}
```

**Why**: Allows AI to safely test endpoint changes before applying them.

---

### Hook 5: Contextual Error Tracking
**Requirement**: Log the context when endpoint failures occur.

**Implementation**:
```typescript
{
  endpointId: "uuid",
  errorTimestamp: "2025-11-26T12:30:00Z",
  errorType: "NETWORK_TIMEOUT" | "AUTH_FAILURE" | "NOT_FOUND" | "SERVER_ERROR",
  errorMessage: "404 Not Found",
  httpStatusCode: 404,
  requestUrl: "https://pems.example.com/assets",
  requestMethod: "GET",
  requestHeaders: { ... },
  responseBody: "...",
  contextData: {
    serverHealthBefore: "healthy",
    otherEndpointsStatus: ["healthy", "healthy", "down"],  // Sibling endpoints
    userAction: "manual_test" | "scheduled_sync" | "api_call"
  }
}
```

**Why**: AI can correlate failures across endpoints and identify patterns (e.g., "All endpoints failed after credential change").

---

## 📊 3. API Granularity Requirements

### Requirement 1: Headless Server & Endpoint API
**Purpose**: Allow AI to manage servers and endpoints programmatically.

**Endpoints Needed**:
```typescript
// Server Management
GET    /api/servers                 // List all servers
POST   /api/servers                 // Create server
PUT    /api/servers/:id             // Update server
DELETE /api/servers/:id             // Delete server
POST   /api/servers/:id/test        // Test server connection

// Endpoint Management
GET    /api/servers/:serverId/endpoints           // List endpoints for server
POST   /api/servers/:serverId/endpoints           // Create endpoint
PUT    /api/servers/:serverId/endpoints/:id       // Update endpoint
DELETE /api/servers/:serverId/endpoints/:id       // Delete endpoint
POST   /api/servers/:serverId/endpoints/:id/test  // Test specific endpoint

// Bulk Operations
POST   /api/servers/:serverId/endpoints/test-all  // Test all endpoints
POST   /api/servers/:serverId/endpoints/import    // Import from OpenAPI spec
```

---

### Requirement 2: Endpoint Health API
**Purpose**: AI can query endpoint health and history.

**Endpoints**:
```typescript
GET /api/servers/:serverId/health
Response: {
  serverId: "uuid",
  healthStatus: "healthy",
  healthScore: 95,
  endpoints: [
    { id: "uuid", name: "Assets", status: "healthy", avgLatency: 200 },
    { id: "uuid", name: "Users", status: "degraded", avgLatency: 800 }
  ]
}

GET /api/servers/:serverId/endpoints/:endpointId/history?days=7
Response: {
  endpointId: "uuid",
  testHistory: [
    { timestamp: "...", success: true, latency: 215 },
    { timestamp: "...", success: false, error: "404" }
  ],
  uptimePercentage: 98.5
}
```

---

### Requirement 3: Error Pattern Analysis API
**Purpose**: AI can query common error patterns across endpoints.

**Endpoints**:
```typescript
GET /api/servers/:serverId/errors?period=24h
Response: {
  totalErrors: 12,
  errorsByType: {
    "AUTH_FAILURE": 8,
    "NOT_FOUND": 3,
    "TIMEOUT": 1
  },
  affectedEndpoints: [
    { endpointId: "uuid", name: "Assets", errorCount: 8 }
  ],
  suggestedActions: [
    "Check server credentials (8 auth failures)",
    "Verify endpoint paths (3× 404 errors)"
  ]
}
```

---

### Requirement 4: OpenAPI Import API
**Purpose**: AI can auto-discover endpoints from API documentation.

**Endpoints**:
```typescript
POST /api/servers/:serverId/discover
Body: {
  openapiUrl: "https://pems.example.com/swagger.json"
}
Response: {
  discoveredEndpoints: [
    { path: "/assets", entity: "asset_master", method: "GET" },
    { path: "/users", entity: "users", method: "GET" }
  ],
  suggestions: [
    "Create 7 new endpoints?",
    "Map to existing DataSourceMappings?"
  ]
}
```

---

## 🚀 4. Implementation Priorities

### Phase 1 (Must-Have - Implement Now):
1. ✅ Endpoint test result logging
2. ✅ Endpoint metadata tracking (success rate, latency)
3. ✅ Server health aggregation
4. ✅ Dry-run API support
5. ✅ Headless server & endpoint CRUD APIs

### Phase 2 (High Value - Next Quarter):
6. 📋 Endpoint health monitoring and alerting
7. 📋 Error pattern analysis API
8. 📋 Natural language endpoint configuration
9. 📋 OpenAPI auto-discovery

### Phase 3 (Future - Nice to Have):
10. 📋 Predictive failure detection
11. 📋 Auto-healing endpoint configurations
12. 📋 AI-powered root cause analysis
13. 📋 Intelligent load balancing across servers

---

## 🔗 5. Integration with Existing AI System

The existing AI assistant (Gemini/OpenAI/Claude) can be augmented to:

1. **Diagnose Endpoint Failures**: "Why is the Assets endpoint failing?"
2. **Suggest Configurations**: "Based on PEMS docs, you need these 3 endpoints"
3. **Auto-Generate Endpoints**: "Create endpoints for all PEMS entities"
4. **Monitor Health**: "Alert me if any endpoint has >10% error rate"

**Required Changes**:
- Add `api_servers` and `api_endpoints` entities to AI context
- Train AI on PEMS API documentation patterns
- Add endpoint testing capability to AI prompts
- Enable AI to read endpoint health metrics

---

## 📚 Related Documentation

- **Decision**: [ADR-006-DECISION.md](./ADR-006-DECISION.md)
- **UX Specification**: [ADR-006-UX_SPEC.md](./ADR-006-UX_SPEC.md)
- **Test Plan**: [ADR-006-TEST_PLAN.md](./ADR-006-TEST_PLAN.md)
- **Implementation Plan**: [ADR-006-IMPLEMENTATION_PLAN.md](./ADR-006-IMPLEMENTATION_PLAN.md)

---

**Status**: 🔴 Draft - Awaiting AI Architect Review
**Next Action**: Backend architect must review and include data hooks in implementation plan

*Document created: 2025-11-26*
*AI Readiness Version: 1.0*
