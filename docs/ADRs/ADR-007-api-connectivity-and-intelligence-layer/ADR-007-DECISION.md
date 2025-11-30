# ADR-007: API Connectivity & Intelligence Layer - Decision & Requirements

> **Primary Agent**: `product-requirements-analyst`
> **Instruction**: This document defines the business requirements for transforming PFA Vanguard from a rigid sync tool into a configurable data platform.

**Status**: 🔴 Draft
**Date**: 2025-11-27
**Deciders**: Development Team, Product Team, Infrastructure Team
**Related ADRs**:
- [ADR-005: Multi-Tenant Access Control](../ADR-005-multi-tenant-access-control/README.md)
- [ADR-006: API Server and Endpoint Architecture](../ADR-006-api-server-and-endpoint-architecture/README.md)

---

## 1. Context & Problem Statement

**Problem**: The current PEMS synchronization architecture is tightly coupled and brittle:

1. **Rigid Mapping**: PEMS field names are hardcoded in sync service. When PEMS changes `udf_char_01` to `category`, the app breaks.
2. **No Audit Trail**: Raw PEMS data is transformed immediately and discarded. We can't "replay" history if mapping rules change.
3. **Hardcoded KPIs**: Cost calculations are in TypeScript. Adding tax calculation requires code deployment.
4. **Monolithic Sync**: Ingestion, transformation, and validation happen in one service. Performance bottlenecks affect everything.
5. **No Configuration UI**: Admins can't map fields, define filters, or create KPIs without developer intervention.

**Why Now?** (Business Driver)
- **Scalability**: Supporting multiple organizations (RIO, HOLNG, BECH) requires flexible field mappings
- **Compliance**: Audit requirements demand immutable record of all data received from external systems
- **Agility**: Business users need to define KPIs without 2-week deployment cycles
- **Reliability**: Decoupling ingestion from transformation prevents one failure from blocking everything

**Success Metrics**:
- **Configurability**: 100% of PEMS field mappings managed via Admin UI (no code changes)
- **Auditability**: 100% of raw PEMS data preserved in immutable BronzeRecord layer
- **Performance**: Ingestion throughput increases by 3x (from 3K to 10K records/API call)
- **Agility**: Time to create new KPI reduced from 2 weeks (code + deploy) to 5 minutes (Admin UI)
- **Reliability**: 99.9% uptime for ingestion service (independent of transformation failures)

---

## 2. ❓ Discovery Questions

**⚠️ IMPORTANT: These questions must be answered before proceeding with implementation.**

### Questions for the Product Team:

- [x] **Q1**: Should we support multiple PEMS instances per organization (e.g., PEMS Production + PEMS Staging)?
  - **Answer**: Yes. Each organization may have test and production PEMS servers. Use `ApiServer` model to support multiple connections.

- [x] **Q2**: What's the retention policy for BronzeRecord data? Keep forever or archive after N days?
  - **Answer**: Keep 90 days online, archive to cold storage after that. Implement cron job in Phase 6.

- [x] **Q3**: Should KPI formulas support complex logic (if/then/else) or just math expressions?
  - **Answer**: Start with math expressions using `mathjs`. Complex logic (if/then/else) is Phase 2 (future).

- [x] **Q4**: How do we handle conflicts when PEMS data differs from local edits?
  - **Answer**: PEMS is source of truth for `pristine` records. Local edits (syncState=modified) are never overwritten by sync. User must manually resolve conflicts.

- [ ] **Q5**: Should the Mapping Studio support batch operations (e.g., "Map all UDF fields at once")?
  - **Answer**: [To be determined - needs UX input]

- [ ] **Q6**: Do we need versioning for ApiFieldMapping (track changes over time)?
  - **Answer**: [To be determined - needs compliance input]

---

## 3. User Stories

### Primary User Stories:

#### Admin Users (Data Stewards)

* **As an** Admin, **I want to** connect to a new PEMS server without writing code, **so that** I can onboard new organizations in minutes instead of days.
  - **Acceptance**: Can add new ApiServer via Admin UI, test connection, and start sync

* **As an** Admin, **I want to** map PEMS field `udf_char_01` to PFA field `category` via drag-and-drop, **so that** I don't need to wait for developer deployments.
  - **Acceptance**: Can create ApiFieldMapping via Mapping Studio, see preview of mapped data, and apply mapping

* **As an** Admin, **I want to** define a KPI formula like `{monthlyRate} * {quantity} * 1.15` (tax), **so that** I can calculate custom metrics without code.
  - **Acceptance**: Can create KpiDefinition via Formula Builder, test formula on sample data, and see results on KPI Board

* **As an** Admin, **I want to** see raw PEMS data before and after transformation, **so that** I can debug mapping issues.
  - **Acceptance**: Can view BronzeRecord (raw JSON) and corresponding PfaRecord (transformed) side-by-side

#### Power Users (Project Managers)

* **As a** PM, **I want to** see real-time sync status (Ingested → Transformed), **so that** I know when data is ready to use.
  - **Acceptance**: Sync Status Dashboard shows batch progress, records ingested vs. transformed, and errors

* **As a** PM, **I want to** filter at the source (e.g., "Only sync Active assets"), **so that** we don't waste bandwidth on scrapped equipment.
  - **Acceptance**: Can configure `defaultParams` on ApiEndpoint (e.g., `?status=ACTIVE`)

#### Developers

* **As a** Developer, **I want to** ingestion and transformation services to be independent, **so that** one service failure doesn't block the other.
  - **Acceptance**: Ingestion writes to BronzeRecord, Transformation reads from BronzeRecord. Services can run at different times.

* **As a** Developer, **I want to** replay transformation with updated rules, **so that** I can fix mapping bugs without re-syncing from PEMS.
  - **Acceptance**: Can run Transformation Service with new ApiFieldMapping rules on existing BronzeRecord data

### Edge Cases & Error States:

* **As a** User, **I want to** see helpful error messages when PEMS API is down, **so that** I know it's an external issue, not our app.
  - **Acceptance**: Error toast shows "PEMS server unreachable. Retrying in 30s..." instead of generic "500 error"

* **As an** Admin, **I want to** be warned when a mapping rule creates duplicate records, **so that** I can fix it before applying.
  - **Acceptance**: Mapping Studio shows preview with warnings: "⚠️ 5 duplicate IDs detected. Check mapping logic."

* **As a** User, **I want to** orphaned records (no longer in PEMS) to be flagged, not deleted, **so that** I can review them before cleanup.
  - **Acceptance**: Transformation Service sets `isDiscontinued=true` for records not seen in full sync, doesn't delete them

* **As an** Admin, **I want to** be alerted immediately if the PEMS API schema changes drastically (e.g., missing critical columns like "id" or "cost"), **so that** I can update field mappings before data quality degrades.
  - **Acceptance**: Ingestion Service compares new batch schema fingerprint to baseline. If >20% of expected fields are missing or >5 new unexpected fields appear, create alert in Sync Status Dashboard: "⚠️ Schema Drift Detected - 5 expected fields missing: [id, cost, category, status, updated_at]"

---

## 4. Acceptance Criteria (Definition of Done)

**Feature is NOT complete until ALL criteria are met:**

### Functional Requirements
- [ ] **Connectivity**: Admin can add/edit/delete ApiServer and ApiEndpoint via UI
- [ ] **Mapping**: Admin can create ApiFieldMapping via drag-and-drop Mapping Studio
- [ ] **Ingestion**: Service writes raw PEMS data to BronzeRecord (10K records/batch)
- [ ] **Transformation**: Service reads BronzeRecord, applies mappings, writes to PfaRecord
- [ ] **KPI Engine**: Backend can calculate KPIs using mathjs formulas from KpiDefinition
- [ ] **Orphan Detection**: Transformation flags records not seen in full sync
- [ ] **Hybrid Calculation**: KPI formulas must be executable by BOTH the Backend (for committed data reports) and the Frontend (for real-time Draft/What-If scenarios). The same mathjs formula should work on server-side Silver layer and client-side allPfaRef state.

### Performance Requirements
- [ ] **Ingestion Throughput**: 10,000 records per API call (3x current)
- [ ] **Transformation Latency**: <2 seconds per 1,000 record batch
- [ ] **Mapping Studio Preview**: <100ms to show sample mapped data
- [ ] **KPI Calculation**: <500ms for 20K record dataset

### Security Requirements
- [ ] **Credentials Encryption**: AES-256 encryption for ApiServer credentials
- [ ] **API Authorization**: All endpoints require valid JWT token
- [ ] **Input Validation**: Zod schemas validate all API inputs
- [ ] **SQL Injection Protection**: Prisma ORM prevents SQL injection
- [ ] **XSS Protection**: All user input sanitized before display

### Accessibility Requirements
- [ ] **Keyboard Navigation**: All Admin UI forms navigable by keyboard
- [ ] **Screen Reader Support**: ARIA labels on all interactive elements
- [ ] **WCAG 2.1 AA Compliance**: Passes automated accessibility audit

### Data Integrity Requirements
- [ ] **Immutable Bronze**: BronzeRecord table is append-only (no updates/deletes)
- [ ] **Idempotent Transformation**: Running transformation twice produces same result
- [ ] **No Data Loss**: All PEMS data preserved in BronzeRecord before transformation
- [ ] **Conflict Handling**: Local edits (syncState=modified) never overwritten by sync
- [ ] **Rule Versioning**: ApiFieldMapping must support `validFrom`/`validTo` dates so historical replays use the rules active at that time. When replaying a Bronze batch from March 2025, use the mappings that were active in March 2025, not today's mappings.

### Documentation Requirements
- [ ] **API Documentation**: OpenAPI spec for all new endpoints
- [ ] **User Guide**: Admin guide for Mapping Studio and Formula Builder
- [ ] **Technical Docs**: TECHNICAL_DOCS.md completed (as-built)

---

## 5. Decision Drivers

### Business Requirements:
1. **Multi-Organization Support**: Must support different PEMS schemas per organization (RIO, HOLNG, BECH)
2. **Compliance**: Must maintain audit trail of all raw data for 90 days
3. **Agility**: Business users must be able to create KPIs without code changes
4. **Reliability**: 99.9% uptime target requires fault-tolerant architecture
5. **Scalability**: Must handle 1M+ PFA records across all organizations

### Technical Requirements:
1. **Decoupling**: Ingestion, Transformation, and KPI services must be independent
2. **Performance**: Must support 10K records per API call (up from 3K)
3. **Auditability**: Must support "time travel" (replay transformation with new rules)
4. **Extensibility**: Must support adding new entities (Users, AssetMaster) without code changes
5. **Maintainability**: Must reduce complexity of sync service codebase

---

## 6. Considered Options

### Option 1: Keep Current Monolithic Sync (Status Quo)
**Pros**:
- No migration effort required
- Developers understand current codebase
- Works for current data volume

**Cons**:
- ❌ Can't support multiple organizations with different schemas
- ❌ No audit trail (can't replay history)
- ❌ KPI changes require code deployment
- ❌ Field mapping changes require code deployment
- ❌ One service failure blocks everything

**Estimated Effort**: 0 days
**Verdict**: ❌ **Rejected** - Doesn't meet business requirements

---

### Option 2: Medallion Architecture (Bronze → Silver → Gold)
**Pros**:
- ✅ Industry-standard data platform pattern
- ✅ Immutable audit trail in Bronze layer
- ✅ Decoupled services (Ingestion → Transformation → Analytics)
- ✅ Supports "time travel" (replay transformation)
- ✅ Scalable to millions of records

**Cons**:
- ⚠️ Requires database migration (new tables)
- ⚠️ More complex than current architecture
- ⚠️ Higher storage requirements (Bronze + Silver)

**Estimated Effort**: 20 days
**Verdict**: ✅ **Selected** - Best long-term solution

---

### Option 3: Hybrid Architecture (Bronze + Silver, no Gold)
**Pros**:
- ✅ Same benefits as Option 2
- ✅ Lower storage requirements (no Gold layer)
- ✅ Simpler implementation (skip aggregation layer)

**Cons**:
- ⚠️ KPI calculations always run on Silver (slower)
- ⚠️ Can't pre-aggregate reports for fast queries

**Estimated Effort**: 18 days
**Verdict**: ⚠️ **Alternative** - Consider if storage is constrained

---

## 7. Decision Outcome

**Chosen Option**: Option 2 - Medallion Architecture (Bronze → Silver → Gold)

**Rationale**:
We chose the full Medallion Architecture because:

1. **Auditability**: Bronze layer provides immutable record for compliance
2. **Flexibility**: Silver layer decouples transformation from ingestion
3. **Performance**: Gold layer (KpiDefinition) enables fast analytics
4. **Scalability**: Proven pattern for 1M+ record datasets
5. **Future-Proof**: Supports advanced use cases (AI, real-time analytics)

**Trade-offs Accepted**:
- ⚠️ Higher storage requirements (Bronze + Silver ≈ 2x current size)
- ⚠️ More complex architecture (3 layers vs. 1)
- ⚠️ Longer implementation timeline (20 days vs. 0)
- ✅ But: Meets all business requirements and scales to 10x data volume

**Key Architectural Decisions**:
1. **Bronze Layer**: Append-only, stores raw PEMS JSON in JSONB column
2. **Silver Layer**: Current `PfaRecord` table becomes Silver (transformed data)
3. **Gold Layer**: Logical layer (KpiDefinition formulas, no physical tables)
4. **Services**: Independent microservices for Ingestion, Transformation, Intelligence

---

## 8. Consequences

### Positive Consequences:
✅ **Configurability**: Admins can change mappings without code deployment
✅ **Auditability**: Complete audit trail of all PEMS data received
✅ **Reliability**: Ingestion service can run independently of transformation
✅ **Performance**: 3x throughput increase (10K records per API call)
✅ **Agility**: KPI creation time reduced from 2 weeks to 5 minutes
✅ **Scalability**: Architecture proven to handle 10M+ records

### Negative Consequences:
⚠️ **Complexity**: More services to deploy and monitor
⚠️ **Storage**: 2x storage requirements (Bronze + Silver)
⚠️ **Migration**: Requires one-time data migration to populate Bronze layer
⚠️ **Learning Curve**: Team must learn new architecture patterns
⚠️ **Monitoring**: Need to monitor 3 services instead of 1

### Neutral Consequences:
🔄 **Configuration Management**: Need UI for managing ApiServer, ApiEndpoint, ApiFieldMapping
🔄 **Testing Strategy**: Need to test Ingestion, Transformation, Intelligence independently
🔄 **Documentation**: Need to document all 3 layers and their interactions

---

## 9. Implementation Roadmap Summary

**See**: [ADR-007-IMPLEMENTATION_PLAN.md](./ADR-007-IMPLEMENTATION_PLAN.md) for full details.

**Estimated Duration**: 20 days (4 weeks)
**Complexity**: High
**Risk**: Medium (requires careful data migration)

**Phases**:
1. **Database Foundation** (2 days): Create new tables for 3-tier connectivity + Bronze layer
2. **Ingestion Service** (3 days): Implement PEMS → BronzeRecord pipeline
3. **Transformation Service** (4 days): Implement BronzeRecord → PfaRecord pipeline
4. **Intelligence Engine** (3 days): Implement KPI calculation with mathjs
5. **Admin UI** (5 days): Build Connectivity Manager, Mapping Studio, Formula Builder
6. **Safety & Optimization** (3 days): Source filters, promotion filters, pruning cron job

**Dependencies**:
- ✅ ADR-005 (Multi-Tenant Access Control) must be complete
- ✅ ADR-006 (API Server Architecture) provides foundation
- ⏳ Redis cache (optional, can defer to Phase 2)

---

## 10. Related Documentation

- **AI Opportunities**: [ADR-007-AI_OPPORTUNITIES.md](./ADR-007-AI_OPPORTUNITIES.md)
- **UX Specification**: [ADR-007-UX_SPEC.md](./ADR-007-UX_SPEC.md)
- **Test Plan**: [ADR-007-TEST_PLAN.md](./ADR-007-TEST_PLAN.md)
- **Implementation Plan**: [ADR-007-IMPLEMENTATION_PLAN.md](./ADR-007-IMPLEMENTATION_PLAN.md)
- **Agent Workflow**: [ADR-007-AGENT_WORKFLOW.md](./ADR-007-AGENT_WORKFLOW.md)
- **Development Log**: [docs/DEVELOPMENT_LOG.md](../../DEVELOPMENT_LOG.md)

---

**Status**: 🔴 Draft - Awaiting Product Review
**Decision Date**: 2025-11-27
**Review Date**: [To be scheduled]

*Document created: 2025-11-27*
*Last updated: 2025-11-27 (Enhanced with Rule Versioning, Hybrid KPI Calculation, and Schema Drift Detection)*
