# BEO Boardroom Voice Analyst Endpoints - Testing Guide

**Phase 8, Task 8.1 of ADR-005 Multi-Tenant Access Control**
**Use Case UC-21: Boardroom Voice Analyst**

---

## Overview

This document describes how to test the new BEO (Business Enterprise Overhead) Boardroom Voice Analyst endpoints that enable natural language portfolio queries with voice-optimized responses.

### New Endpoints

| Endpoint | Method | Description | Authentication | Authorization |
|----------|--------|-------------|----------------|---------------|
| `/api/beo/query` | POST | Answer natural language portfolio queries | JWT Required | `perm_ViewAllOrgs` capability |
| `/api/beo/recent-queries` | GET | Get user's recent portfolio queries | JWT Required | Any authenticated user |

---

## Prerequisites

### 1. Environment Setup

Ensure the backend server is running:

```bash
cd backend
npm run dev
```

Server should be running on `http://localhost:3001`

### 2. Test User Credentials

The test script uses the `admin` user by default, which has `perm_ViewAllOrgs` capability.

**Default Credentials:**
- Username: `admin`
- Password: `admin123`

**Environment Variables (Optional):**
```bash
export TEST_USERNAME=admin
export TEST_PASSWORD=admin123
export API_BASE_URL=http://localhost:3001
```

### 3. AI Service Configuration

The BEO Analytics Service requires Google Gemini API:

```bash
# In backend/.env
GEMINI_API_KEY=your_gemini_api_key_here
```

**Note:** If `GEMINI_API_KEY` is not set, the service will return an error.

---

## Running Tests

### Automated Test Suite

Run the comprehensive test suite:

```bash
cd backend
npx tsx scripts/test-beo-endpoints.ts
```

### Test Coverage

The test suite covers:

1. ✅ **Portfolio Query** - POST `/api/beo/query` with conversational format
2. ✅ **Recent Queries** - GET `/api/beo/recent-queries`
3. ✅ **Follow-up Query** - POST `/api/beo/query` with `contextQueryId`
4. ✅ **Authorization** - Verify `perm_ViewAllOrgs` requirement
5. ✅ **Input Validation** - Test missing query and query length >500 chars

### Expected Output

```
🚀 Testing BEO Boardroom Voice Analyst Endpoints
Base URL: http://localhost:3001

🔐 Authenticating...
✅ Authentication successful

📊 Test 1: POST /api/beo/query - Portfolio Query
✅ PASS: Portfolio query successful
   Query ID: abc123...
   Query Type: budget_variance
   Confidence: 0.85
   Organizations Analyzed: 3
   Records Analyzed: 1234
   Voice Response Length: 350 chars

📜 Test 2: GET /api/beo/recent-queries - Recent Queries
✅ PASS: Recent queries retrieved
   Queries Count: 1
   Latest Query: Which projects are over budget?
   Timestamp: 2025-11-27T...

🔄 Test 3: POST /api/beo/query - Follow-up Query
✅ PASS: Follow-up query with context successful
   Query ID: def456...
   Context Preserved: true

🚫 Test 4: Authorization - Non-BEO User
⚠️  SKIP: Test user has BEO access (cannot test denial)

🔍 Test 5: Input Validation
✅ PASS: Missing query rejected with 400
✅ PASS: Query >500 chars rejected with 400

============================================================
📊 TEST SUMMARY
============================================================
✅ POST /api/beo/query: Portfolio query successful
✅ GET /api/beo/recent-queries: Retrieved 1 queries
✅ POST /api/beo/query (follow-up): Follow-up query with context successful
✅ Authorization Check: Skipped (test user has BEO access)
✅ Input Validation (missing query): Missing query rejected correctly
✅ Input Validation (query too long): Query >500 chars rejected correctly

------------------------------------------------------------
Total: 6 | Passed: 6 | Failed: 0
============================================================
```

---

## Manual Testing with cURL

### 1. Authenticate

```bash
# Login and get JWT token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'

# Save token
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 2. Portfolio Query (Conversational)

```bash
curl -X POST http://localhost:3001/api/beo/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "Which projects are over budget?",
    "responseFormat": "conversational"
  }' | jq
```

**Expected Response:**
```json
{
  "success": true,
  "queryId": "abc123...",
  "response": "Based on the portfolio analysis across 3 organizations...",
  "voiceResponse": "Three projects are currently over budget. HOLNG is fifteen percent over...",
  "confidence": 0.85,
  "queryType": "budget_variance",
  "metadata": {
    "organizationsAnalyzed": 3,
    "recordsAnalyzed": 1234,
    "userPersona": "EXECUTIVE",
    "modelUsed": "gemini-1.5-flash",
    "latencyMs": 2450,
    "cached": false
  }
}
```

### 3. Portfolio Query (Structured)

```bash
curl -X POST http://localhost:3001/api/beo/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "Show me equipment utilization rates by category",
    "responseFormat": "structured"
  }' | jq
```

**Expected Response:**
```json
{
  "success": true,
  "queryId": "def456...",
  "response": "# Equipment Utilization Analysis...",
  "voiceResponse": "Equipment utilization varies significantly by category...",
  "confidence": 0.85,
  "queryType": "equipment_status",
  "data": {
    "queryType": "equipment_status",
    "summary": "Equipment utilization varies..."
  },
  "metadata": {
    "organizationsAnalyzed": 3,
    "recordsAnalyzed": 1234,
    "userPersona": "EXECUTIVE",
    "modelUsed": "gemini-1.5-flash",
    "latencyMs": 2800,
    "cached": false
  }
}
```

### 4. Follow-up Query with Context

```bash
# Use queryId from previous query
export QUERY_ID="abc123..."

curl -X POST http://localhost:3001/api/beo/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "Tell me more about the largest overrun",
    "responseFormat": "conversational",
    "contextQueryId": "'$QUERY_ID'"
  }' | jq
```

### 5. Get Recent Queries

```bash
curl -X GET http://localhost:3001/api/beo/recent-queries \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected Response:**
```json
{
  "success": true,
  "queries": [
    {
      "queryId": "abc123...",
      "query": "Which projects are over budget?",
      "timestamp": "2025-11-27T14:30:00.000Z"
    },
    {
      "queryId": "def456...",
      "query": "Tell me more about the largest overrun",
      "timestamp": "2025-11-27T14:32:00.000Z"
    }
  ]
}
```

---

## Testing Authorization

### Test 1: User WITHOUT perm_ViewAllOrgs

**Expected:** 403 Forbidden

```bash
# Create a test user without BEO access
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "username": "testuser",
    "password": "test123",
    "email": "test@example.com",
    "organizationId": "org123"
  }'

# Login as test user
export TEST_TOKEN="..."

# Attempt portfolio query (should fail)
curl -X POST http://localhost:3001/api/beo/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{
    "query": "Which projects are over budget?",
    "responseFormat": "conversational"
  }' | jq
```

**Expected Response:**
```json
{
  "success": false,
  "error": "FORBIDDEN",
  "message": "BEO portfolio access required (perm_ViewAllOrgs capability)"
}
```

### Test 2: User WITH perm_ViewAllOrgs

**Expected:** 200 OK with query results

```bash
# Grant perm_ViewAllOrgs capability to user
# (Admin must update user's role or capabilities)

# Retry query (should succeed)
curl -X POST http://localhost:3001/api/beo/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{
    "query": "Which projects are over budget?",
    "responseFormat": "conversational"
  }' | jq
```

---

## Testing Input Validation

### Test 1: Missing Query

```bash
curl -X POST http://localhost:3001/api/beo/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "responseFormat": "conversational"
  }' | jq
```

**Expected:** 400 Bad Request
```json
{
  "success": false,
  "error": "BAD_REQUEST",
  "message": "query is required and must be a string"
}
```

### Test 2: Query Too Long (>500 chars)

```bash
curl -X POST http://localhost:3001/api/beo/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "'$(python3 -c 'print("a" * 501)')'"
    "responseFormat": "conversational"
  }' | jq
```

**Expected:** 400 Bad Request
```json
{
  "success": false,
  "error": "BAD_REQUEST",
  "message": "query must be 500 characters or less"
}
```

### Test 3: Invalid Response Format

```bash
curl -X POST http://localhost:3001/api/beo/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "Which projects are over budget?",
    "responseFormat": "invalid_format"
  }' | jq
```

**Expected:** 400 Bad Request
```json
{
  "success": false,
  "error": "BAD_REQUEST",
  "message": "responseFormat must be \"conversational\" or \"structured\""
}
```

---

## Performance Testing

### Latency Requirements

**Requirement:** <3 seconds response time (per UC-21 specification)

**Test:**
```bash
# Measure response time
time curl -X POST http://localhost:3001/api/beo/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "Which projects are over budget?",
    "responseFormat": "conversational"
  }' > /dev/null
```

**Expected:** `real 0m2.5s` (or less)

### Cache Testing

**First Query:**
```bash
curl -X POST http://localhost:3001/api/beo/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "Which projects are over budget?",
    "responseFormat": "conversational"
  }' | jq '.metadata.cached'
# Output: false (not cached)
```

**Repeat Query (within 5 min):**
```bash
curl -X POST http://localhost:3001/api/beo/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "Which projects are over budget?",
    "responseFormat": "conversational"
  }' | jq '.metadata.cached'
# Output: true (cached)
```

---

## Troubleshooting

### Error: AI adapter not available

**Cause:** `GEMINI_API_KEY` not configured

**Fix:**
```bash
# Add to backend/.env
GEMINI_API_KEY=your_api_key_here

# Restart server
npm run dev
```

### Error: 403 Forbidden

**Cause:** User does not have `perm_ViewAllOrgs` capability

**Fix:** Grant capability via role assignment or direct user-organization permission

### Error: 401 Unauthorized

**Cause:** JWT token expired or invalid

**Fix:** Re-authenticate and get new token

### Error: Cannot find module 'BeoAnalyticsService'

**Cause:** Service file not found or build error

**Fix:**
```bash
# Rebuild TypeScript
npm run build

# Restart server
npm run dev
```

---

## Integration with Frontend

### React Example

```typescript
import { apiClient } from '@/services/apiClient';

// Portfolio query
async function askBeoQuestion(query: string) {
  const response = await apiClient.post('/beo/query', {
    query,
    responseFormat: 'conversational',
  });

  return {
    response: response.data.response,
    voiceResponse: response.data.voiceResponse,
    queryId: response.data.queryId,
  };
}

// Follow-up query
async function askFollowUp(query: string, contextQueryId: string) {
  const response = await apiClient.post('/beo/query', {
    query,
    responseFormat: 'conversational',
    contextQueryId,
  });

  return response.data;
}

// Get recent queries
async function getRecentQueries() {
  const response = await apiClient.get('/beo/recent-queries');
  return response.data.queries;
}
```

### Voice Interface Integration

```typescript
// Text-to-Speech (TTS) integration
function speakResponse(voiceResponse: string) {
  const utterance = new SpeechSynthesisUtterance(voiceResponse);
  utterance.rate = 0.9; // Slightly slower for clarity
  utterance.pitch = 1.0;
  speechSynthesis.speak(utterance);
}

// Speech-to-Text (STT) integration
async function listenForQuery(): Promise<string> {
  const recognition = new webkitSpeechRecognition();
  recognition.continuous = false;
  recognition.lang = 'en-US';

  return new Promise((resolve, reject) => {
    recognition.onresult = (event) => {
      const query = event.results[0][0].transcript;
      resolve(query);
    };
    recognition.onerror = reject;
    recognition.start();
  });
}

// Combined workflow
async function voiceQuery() {
  const query = await listenForQuery();
  const result = await askBeoQuestion(query);
  speakResponse(result.voiceResponse);
}
```

---

## Database Schema

### AiQueryLog Table

Queries are logged to the `AiQueryLog` table:

```prisma
model AiQueryLog {
  id              String   @id @default(cuid())
  userId          String
  organizationId  String?  // NULL for portfolio-wide queries
  query           String
  queryType       String   // budget_variance, equipment_status, etc.
  responseFormat  String   // conversational, structured
  contextQueryId  String?  // For follow-up questions
  userPersona     String?  // CFO, COO, PM, EXECUTIVE
  response        String   @db.Text
  confidence      Float
  modelUsed       String
  tokensUsed      Int
  costUsd         Float
  latencyMs       Int
  createdAt       DateTime @default(now())
}
```

---

## Next Steps

1. ✅ **Phase 8, Task 8.1 Complete** - BEO Analytics API layer implemented
2. 🔄 **Phase 8, Task 8.2** - Frontend BEO Glass Mode UI (in progress)
3. 📋 **Phase 8, Task 8.3** - Voice interface integration (planned)
4. 📋 **Phase 8, Task 8.4** - AI model fine-tuning for portfolio queries (planned)

---

## Related Documentation

- **ADR-005:** Multi-Tenant Access Control
- **UC-21:** Boardroom Voice Analyst
- **BeoAnalyticsService:** `backend/src/services/ai/BeoAnalyticsService.ts`
- **BeoController:** `backend/src/controllers/beoController.ts`
- **BeoRoutes:** `backend/src/routes/beoRoutes.ts`
