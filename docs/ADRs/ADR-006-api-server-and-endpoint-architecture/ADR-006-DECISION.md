# ADR-006: API Server and Endpoint Architecture - Decision & Requirements

> **Primary Agent**: `product-requirements-analyst`
> **Instruction**: Translate the problem into rigorous user stories. If requirements are ambiguous, populate the "Discovery Questions" section first.

**Status**: 🔴 Draft
**Date**: 2025-11-26
**Deciders**: Development Team, Product Team
**Related ADRs**:
- [ADR-005: Multi-Tenant Access Control](../ADR-005-multi-tenant-access-control/)

---

## 1. Context & Problem Statement

**Problem**: Current implementation duplicates PEMS server credentials across 7 separate API configurations. Need two-tier architecture (Server → Endpoints) with individual endpoint testing and error tracking capabilities.

**Current State**:
- 7 separate `ApiConfiguration` records for PEMS APIs
- Each record stores identical credentials (baseUrl, username, password, tenant)
- Each record has duplicate common headers (tenant, gridCode, gridId)
- Credential updates require changing 7 records
- No way to test individual endpoints independently
- Error tracking is at API level, not endpoint level

**Why Now?** (Business Driver)
- Credential management is error-prone and time-consuming
- Adding new PEMS endpoints requires duplicating all configuration
- Cannot diagnose which specific endpoint is failing
- Violates DRY (Don't Repeat Yourself) principle
- Maintenance overhead increases with each new endpoint

**Success Metrics**:
- Reduce credential entry from 7× to 1× per server
- Enable per-endpoint testing with specific error messages
- Reduce time to add new endpoint from 5 minutes to 30 seconds
- Support multiple API servers (PEMS, ESS, Procurement) with same architecture

---

## 2. ❓ Discovery Questions (If Ambiguous)

**⚠️ IMPORTANT: If the user's initial request is vague, the product-requirements-analyst agent must ask clarifying questions before proceeding.**

### Questions for the User:
- [x] Should we support pointing different entities to different servers?
  - **Answer**: Yes - flexibility to point entities to different servers if needed (e.g., PEMS Production vs PEMS Test)
- [x] Do we need per-endpoint testing capabilities?
  - **Answer**: Yes - must be able to test each endpoint individually with specific error messages
- [x] Should DataSourceMappings be updated to point to endpoints?
  - **Answer**: Yes - DataSourceMappings should reference ApiEndpoint instead of ApiConfiguration
- [ ] Should we support endpoint-specific authentication overrides (e.g., different API key per endpoint)?
  - **Answer**: [To be determined - default to server-level auth, allow overrides if needed]
- [ ] Do we need to migrate existing 7 PEMS configs automatically?
  - **Answer**: [To be determined - likely yes for seamless transition]

**Answers**:
- User confirmed need for per-endpoint testing and error tracking
- User confirmed need to update DataSourceMappings
- User confirmed flexibility to point entities to different servers

---

## 3. User Stories

### Primary User Stories:

* **As an** [Admin], **I want to** [configure PEMS server credentials once], **so that** [I don't have to enter the same credentials 7 times].

* **As an** [Admin], **I want to** [test individual endpoints (Assets, Users, Categories)], **so that** [I can identify which specific endpoint is failing].

* **As an** [Admin], **I want to** [see endpoint-specific error messages], **so that** [I can quickly diagnose and fix issues].

* **As an** [Admin], **I want to** [add new PEMS endpoints without re-entering credentials], **so that** [I can configure new data sources in 30 seconds instead of 5 minutes].

* **As a** [Developer], **I want to** [point different entities to different servers (e.g., PEMS Production vs Test)], **so that** [I can test data integrations safely].

* **As a** [System], **I want to** [construct full URLs from server.baseUrl + endpoint.path], **so that** [URL changes are managed in one place].

### Edge Cases & Error States:

* **As an** [Admin], **I want to** [see helpful error messages when endpoint test fails], **so that** [I know if it's an auth issue, network issue, or endpoint issue].

* **As an** [Admin], **I want to** [migrate existing API configurations automatically], **so that** [I don't lose existing setup].

* **As a** [System], **I want to** [handle endpoints with custom headers (overrides)], **so that** [special endpoints like User Sync can have unique tenant headers].

---

## 4. Acceptance Criteria (Definition of Done)

**Feature is NOT complete until ALL criteria are met:**

- [ ] **Functional**: All user stories pass acceptance tests
- [ ] **Data Model**: ApiServer and ApiEndpoint models created in Prisma
- [ ] **Migration**: Existing 7 PEMS configs automatically converted to 1 Server + 7 Endpoints
- [ ] **UI**: Admin UI shows hierarchical server → endpoints view
- [ ] **Testing**: Each endpoint has individual "Test Connection" button with specific error messages
- [ ] **Performance**: URL construction adds <1ms overhead
- [ ] **Security**: Credentials still encrypted, no plaintext exposure
- [ ] **Documentation**: TECHNICAL_DOCS.md explains new architecture

---

## 5. Decision Drivers

### Business Requirements:
- **Reduce maintenance overhead**: Single credential entry per server
- **Improve diagnostics**: Per-endpoint error tracking
- **Support scalability**: Easy to add new endpoints
- **Enable flexibility**: Point entities to different servers if needed

### Technical Requirements:
- **Data integrity**: Must migrate existing configs without data loss
- **Backward compatibility**: DataSourceMappings must work after migration
- **Security**: Maintain encryption for credentials
- **Performance**: No noticeable latency increase

---

## 6. Considered Options

### Option 1: Two-Tier Architecture (Server → Endpoints)

**Pros**:
- ✅ Eliminates credential duplication
- ✅ Enables per-endpoint testing
- ✅ Easy to add new endpoints
- ✅ Flexible (can point to different servers)
- ✅ Clear separation of concerns

**Cons**:
- ⚠️ Requires database migration
- ⚠️ More complex UI (hierarchical view)
- ⚠️ Need to update services to construct URLs

**Estimated Effort**: 3 days

---

### Option 2: Keep Current Architecture with "Template" Feature

**Pros**:
- ✅ No database migration
- ✅ Simpler UI (flat list)
- ✅ No service changes

**Cons**:
- ❌ Still duplicates credentials (just copies from template)
- ❌ No per-endpoint testing
- ❌ Doesn't solve the root problem
- ❌ Maintenance overhead remains

**Estimated Effort**: 1 day

---

### Option 3: Single API Config with Multiple Endpoints Array

**Pros**:
- ✅ Credentials stored once
- ✅ Simpler than two tables

**Cons**:
- ❌ Harder to query specific endpoints
- ❌ JSON array less flexible than relational model
- ❌ Difficult to track per-endpoint metadata (test status, errors)
- ❌ Cannot reference endpoints in DataSourceMapping

**Estimated Effort**: 2 days

---

## 7. Decision Outcome

**Chosen Option**: Option 1 - Two-Tier Architecture (Server → Endpoints)

**Rationale**:
We chose Option 1 because it properly solves the root problem (credential duplication) while enabling future capabilities (per-endpoint testing, error tracking, flexible server assignment). The additional effort (3 days vs 1-2 days) is justified by the long-term maintainability gains and diagnostic improvements.

**Trade-offs Accepted**:
- ⚠️ Requires database migration (but automated, low risk)
- ⚠️ More complex UI (but clearer mental model)
- ⚠️ Service updates required (but simple URL construction)
- ✅ But: Eliminates 6× credential duplication permanently

---

## 8. Consequences

### Positive Consequences:
✅ Admins configure credentials once per server instead of per endpoint
✅ Per-endpoint testing enables precise diagnostics
✅ Adding new endpoints takes 30 seconds (not 5 minutes)
✅ Error messages are endpoint-specific (e.g., "Assets endpoint: 404 Not Found")
✅ Flexible architecture supports multiple servers (PEMS, ESS, Procurement)

### Negative Consequences:
⚠️ Database migration required (automated script needed)
⚠️ UI redesign for hierarchical server → endpoints view
⚠️ Services must be updated to construct URLs from server.baseUrl + endpoint.path
⚠️ Slightly more complex mental model (two entities instead of one)

### Neutral Consequences:
🔄 DataSourceMappings updated to point to ApiEndpoint instead of ApiConfiguration
🔄 Existing test connection logic refactored for per-endpoint testing
🔄 Documentation updated to explain new architecture

---

## 9. Implementation Roadmap Summary

**See**: [ADR-006-IMPLEMENTATION_PLAN.md](./ADR-006-IMPLEMENTATION_PLAN.md) for full details.

**Estimated Duration**: 3 days
**Complexity**: Medium
**Risk**: Low (migration can be rolled back)

**Phases**:
1. Database schema (ApiServer, ApiEndpoint models) - 0.5 days
2. Migration script (convert 7 configs → 1 server + 7 endpoints) - 0.5 days
3. Service layer updates (URL construction) - 0.5 days
4. UI refactor (hierarchical view, per-endpoint testing) - 1 day
5. Testing & documentation - 0.5 days

---

## 10. Related Documentation

- **AI Opportunities**: [ADR-006-AI_OPPORTUNITIES.md](./ADR-006-AI_OPPORTUNITIES.md)
- **UX Specification**: [ADR-006-UX_SPEC.md](./ADR-006-UX_SPEC.md)
- **Test Plan**: [ADR-006-TEST_PLAN.md](./ADR-006-TEST_PLAN.md)
- **Implementation Plan**: [ADR-006-IMPLEMENTATION_PLAN.md](./ADR-006-IMPLEMENTATION_PLAN.md)
- **Agent Workflow**: [ADR-006-AGENT_WORKFLOW.md](./ADR-006-AGENT_WORKFLOW.md)
- **Development Log**: [../../DEVELOPMENT_LOG.md](../../DEVELOPMENT_LOG.md)

---

**Status**: 🔴 Draft - Awaiting Product Review
**Decision Date**: 2025-11-26
**Review Date**: [To be scheduled]

*Document created: 2025-11-26*
*Last updated: 2025-11-26*
