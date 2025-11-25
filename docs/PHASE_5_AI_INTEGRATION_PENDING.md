# Phase 5: AI Integration - PENDING

**Status**: Not Yet Started
**Estimated Duration**: 2-3 days
**Agent**: prompt-engineer
**Dependencies**: Phase 4 (Frontend Integration) must be complete

---

## 📋 Overview

Phase 5 will integrate AI-powered natural language query capabilities into the PFA Vanguard application, allowing users to interact with PFA data using conversational queries and receive intelligent suggestions for bulk operations.

---

## 🎯 Objectives

### 1. Natural Language Query Generation
Enable users to query PFA data using natural language instead of manual filters.

**Examples**:
- "Show me all rentals over $5,000 in Silo 4"
- "Find equipment forecast to arrive next month"
- "Which concrete equipment is discontinued?"

**Implementation**:
- Convert natural language to SQL queries
- Use AI to interpret user intent
- Validate generated queries for security
- Display results with explanations

### 2. AI-Powered Bulk Operations
Provide intelligent suggestions for bulk modifications.

**Examples**:
- "Extend all concrete equipment by 2 weeks"
- "Reduce monthly rates for idle cranes by 10%"
- "Move all Silo 4 rentals to Q3 2025"

**Implementation**:
- Parse bulk operation commands
- Generate preview of changes
- Require user confirmation
- Execute via existing draft system

### 3. Query Result Explanations
Help users understand why they're seeing specific results.

**Examples**:
- "This filter shows 127 records because they match category='Earthmoving' AND source='Rental'"
- "These 15 records have forecast dates in the next 30 days"

**Implementation**:
- Analyze applied filters
- Generate human-readable explanations
- Show record counts and breakdowns

---

## 🔧 Technical Architecture

### AI Service Layer

**File**: `backend/src/services/ai/AiQueryService.ts`

```typescript
class AiQueryService {
  // Convert natural language to SQL WHERE clause
  async generateSqlQuery(
    naturalLanguage: string,
    schema: DatabaseSchema
  ): Promise<SqlQuery>

  // Validate SQL query for security
  async validateQuery(
    query: SqlQuery
  ): Promise<ValidationResult>

  // Generate explanation for query results
  async explainResults(
    query: SqlQuery,
    results: PfaRecord[]
  ): Promise<string>

  // Suggest bulk operations
  async suggestBulkOperations(
    naturalLanguage: string,
    selectedRecords: PfaRecord[]
  ): Promise<BulkOperation>
}
```

### Security Validation

**Critical Requirements**:
- ✅ No SQL injection allowed
- ✅ Only SELECT queries (no UPDATE/DELETE/DROP)
- ✅ Queries scoped to user's organization
- ✅ Read-only database access
- ✅ Query timeout (max 5 seconds)
- ✅ Result limit (max 10,000 records)

**Validation Rules**:
```typescript
const ALLOWED_OPERATIONS = ['SELECT'];
const FORBIDDEN_KEYWORDS = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'TRUNCATE'];
const MAX_QUERY_COMPLEXITY = 5; // Max number of JOINs
```

### AI Provider Integration

**Supported Providers**:
- Google Gemini (primary)
- OpenAI GPT-4 (fallback)
- Anthropic Claude (fallback)

**Configuration**:
- Use existing `OrganizationAiConfig` for API keys
- Respect daily/monthly token limits
- Log all AI queries to `AiUsageLog` table

---

## 📦 Files to Create

### Backend Services
1. `backend/src/services/ai/AiQueryService.ts` - SQL generation
2. `backend/src/services/ai/QueryValidator.ts` - Security validation
3. `backend/src/services/ai/ExplanationGenerator.ts` - Result explanations
4. `backend/src/controllers/aiQueryController.ts` - API endpoints
5. `backend/src/routes/aiQueryRoutes.ts` - Route registration

### Backend Tests
6. `backend/tests/unit/ai-query-service.test.ts` - Unit tests
7. `backend/tests/integration/ai-query-api.test.ts` - Integration tests
8. `backend/tests/security/ai-query-validation.test.ts` - Security tests

### Frontend Components
9. `components/AiQueryPanel.tsx` - Natural language input
10. `components/AiSuggestions.tsx` - Bulk operation suggestions
11. `components/QueryExplanation.tsx` - Result explanations

### Documentation
12. `backend/docs/AI_QUERY_API.md` - API reference
13. `docs/AI_INTEGRATION_GUIDE.md` - Integration guide
14. `docs/AI_SECURITY_GUIDELINES.md` - Security best practices

---

## 🔌 API Endpoints (Planned)

### POST /api/ai/query
Generate SQL query from natural language

**Request**:
```typescript
{
  query: string,           // Natural language query
  organizationId: string   // User's org context
}
```

**Response**:
```typescript
{
  success: true,
  sql: {
    where: string,         // SQL WHERE clause
    params: any[],         // Parameterized values
    explanation: string    // What the query does
  },
  preview: {
    estimatedRecords: number,
    affectedCategories: string[]
  }
}
```

### POST /api/ai/suggest-bulk
Get AI suggestions for bulk operations

**Request**:
```typescript
{
  command: string,         // Natural language command
  selectedIds: string[]    // PFA record IDs
}
```

**Response**:
```typescript
{
  success: true,
  operation: {
    type: 'shift_time' | 'adjust_rate' | 'change_category',
    parameters: any,
    preview: {
      affectedRecords: number,
      changes: Change[]
    }
  },
  explanation: string
}
```

### POST /api/ai/explain
Get explanation for query results

**Request**:
```typescript
{
  filters: FilterState,
  resultCount: number
}
```

**Response**:
```typescript
{
  success: true,
  explanation: string,
  breakdown: {
    byCategory: Record<string, number>,
    bySource: Record<string, number>,
    timeline: string
  }
}
```

---

## 🧪 Testing Requirements

### Security Tests (Critical)
1. **SQL Injection Prevention**:
   - Test malicious inputs: `"; DROP TABLE pfas; --`
   - Test nested queries
   - Test UNION attacks

2. **Query Validation**:
   - Test forbidden keywords (UPDATE, DELETE, DROP)
   - Test query complexity limits
   - Test organization isolation

3. **Rate Limiting**:
   - Test API token limits
   - Test query frequency limits

### Functional Tests
1. **Query Generation**:
   - Test simple queries
   - Test complex queries with multiple filters
   - Test date range queries
   - Test aggregate queries

2. **Bulk Operations**:
   - Test shift time suggestions
   - Test rate adjustment suggestions
   - Test category change suggestions

3. **Explanations**:
   - Test filter explanations
   - Test result breakdowns
   - Test timeline summaries

---

## 🎯 Success Criteria

### Functional Requirements
- [ ] Natural language queries convert to valid SQL
- [ ] Security validation blocks malicious queries
- [ ] Bulk operation suggestions are accurate
- [ ] Query explanations are helpful
- [ ] All queries scoped to user's organization

### Performance Requirements
- [ ] Query generation < 1 second
- [ ] SQL execution < 2 seconds
- [ ] Explanation generation < 500ms
- [ ] API response < 3 seconds total

### Security Requirements
- [ ] No SQL injection vulnerabilities
- [ ] All queries validated before execution
- [ ] Read-only database access enforced
- [ ] Query timeout limits enforced
- [ ] Result limits enforced

### UX Requirements
- [ ] Clear error messages for invalid queries
- [ ] Preview of results before execution
- [ ] Loading states during AI processing
- [ ] Confirmation required for bulk operations

---

## 🚨 Known Challenges

### 1. Query Accuracy
**Challenge**: AI may generate incorrect SQL for complex queries
**Mitigation**:
- Validate against schema
- Show preview before execution
- Allow user to refine query

### 2. Security Risks
**Challenge**: SQL injection via natural language
**Mitigation**:
- Strict validation rules
- Parameterized queries only
- Read-only database connection
- Query complexity limits

### 3. Performance
**Challenge**: AI API calls add latency
**Mitigation**:
- Cache common queries
- Show loading states
- Implement timeouts
- Fall back to manual filters

### 4. Token Costs
**Challenge**: AI API usage can be expensive
**Mitigation**:
- Track usage per organization
- Enforce daily/monthly limits
- Cache results when possible
- Use cheaper models for simple queries

---

## 📚 Dependencies

### External Libraries
- `@anthropic-ai/sdk` - Claude API client
- `openai` - OpenAI API client
- `@google/generative-ai` - Gemini API client
- `sql-query-identifier` - Query validation
- `zod` - Schema validation

### Internal Dependencies
- Phase 3: Live Merge API (for executing queries)
- Phase 4: Frontend Integration (for UI components)
- Existing AI infrastructure (`OrganizationAiConfig`, `AiUsageLog`)

---

## 🗓️ Implementation Timeline

### Day 1: Backend Core
- Morning: Create `AiQueryService` with SQL generation
- Afternoon: Implement security validation
- Evening: Write unit tests

### Day 2: API Integration
- Morning: Create API endpoints
- Afternoon: Add integration tests
- Evening: Security testing

### Day 3: Frontend & Testing
- Morning: Create AI query panel component
- Afternoon: Add bulk operation suggestions
- Evening: End-to-end testing

---

## 🔗 Related Documentation

- **Phase 3**: `docs/PHASE_3_LIVE_MERGE_API.md` - API architecture
- **Phase 4**: `docs/PHASE_4_FRONTEND_INTEGRATION.md` - UI patterns
- **AI Assistant**: `components/AiAssistant.tsx` - Existing AI integration
- **Security**: `docs/CODING_STANDARDS.md` Section 11 - Security practices

---

## 📝 Notes

- Phase 5 builds on existing AI infrastructure (Gemini/OpenAI/Claude)
- Uses same authentication and rate limiting as Phase 3 API
- AI queries are logged to `AiUsageLog` for billing/analytics
- Natural language input complements (not replaces) manual filters

---

**Status**: PENDING
**Blocked By**: Phase 4 completion (testing in progress)
**Next Step**: Complete Phase 4 testing, then start Phase 5 with prompt-engineer agent

*Document created: 2025-11-25*
*Last updated: 2025-11-25*
