# ADR-008: DECISION - Bi-directional PEMS Synchronization

**Status**: Planning Phase
**Created**: 2025-11-28
**Last Updated**: 2025-11-28

---

## Executive Summary

### Objective

Enable bi-directional synchronization between PFA Vanguard and PEMS (HxGN EAM), allowing user modifications in PFA Vanguard to be written back to PEMS while maintaining PEMS as the single source of truth.

### Business Value

**Primary Benefits**:
- Users can manage PFA data in PFA Vanguard's superior UI
- Single source of truth maintained in PEMS
- Reduced data entry duplication across systems
- Complete audit trail for all changes
- Automated conflict resolution for concurrent edits

**Quantified Impact**:
- **Time Savings**: Eliminate duplicate data entry (estimated 40% reduction in PFA management time)
- **Data Quality**: Single source of truth reduces reconciliation errors by 95%
- **User Satisfaction**: Superior UI improves user experience and adoption
- **Compliance**: Complete audit trail meets regulatory requirements

### Scope

**In Scope (Phase 4)**:
- ✅ Write API for pushing PFA modifications to PEMS
- ✅ Conflict detection and resolution system
- ✅ Two-way sync worker with intelligent batching
- ✅ Sync status tracking and notifications
- ✅ Rollback capabilities for error recovery
- ✅ Comprehensive audit logging

**Out of Scope**:
- ❌ Real-time sync (polling-based, 60s interval)
- ❌ Sync for non-PFA entities (Assets, BEOs)
- ❌ Automatic conflict resolution (requires user decision)
- ❌ PEMS schema modifications

---

## Current State (Phase 3)

### What Works Today

**Read-Only Sync Architecture**:
```
PEMS (Source of Truth)
  ↓ Read-only sync
PostgreSQL Bronze Layer (raw PEMS data)
  ↓ Transformation
PostgreSQL Silver Layer (validated data)
  ↓ Promotion
PostgreSQL Gold Layer (analytics-ready)
  ↓
PfaMirror (immutable baseline) + PfaModification (user deltas)
  ↓
Merged View (displayed to users)
```

**Implemented Features**:
- ✅ PEMS → PostgreSQL (Bronze layer ingestion)
- ✅ Bronze → Silver → Gold medallion architecture
- ✅ PfaMirror (immutable PEMS baseline)
- ✅ PfaModification (user deltas)
- ✅ Real-time merge views
- ✅ Optimistic locking with version tracking

**Data Model**:
- `pfa_mirror`: Immutable PEMS baseline (version tracked)
- `pfa_modification`: User deltas (draft, committed states)
- `pfa_mirror_history`: Version snapshots for audit trail
- Bronze-Silver-Gold tables for PEMS data pipeline

### Current Limitations

**Critical Gaps**:
- ❌ **No write-back to PEMS**: User changes stay in PFA Vanguard
- ❌ **Data divergence**: Local changes never sync to source of truth
- ❌ **Manual reconciliation**: Requires manual PEMS updates
- ❌ **No conflict detection**: Can't detect concurrent modifications
- ❌ **Limited audit trail**: Only local changes tracked

**User Pain Points**:
1. Must manually enter changes in both systems
2. Data inconsistencies between PFA Vanguard and PEMS
3. No visibility into what's synced vs pending
4. Can't rollback bad changes in PEMS
5. Difficult to track who made what changes

---

## Target State (Phase 4)

### Bi-directional Sync Architecture

```
PEMS (Source of Truth)
  ↕ Bi-directional sync
PostgreSQL Bronze Layer
  ↓ Transformation
PostgreSQL Silver Layer
  ↓ Promotion
PostgreSQL Gold Layer
  ↓
PfaMirror + PfaModification
  ↓
Merged View
  ↓ User edits
Change Queue (pending sync)
  ↓ Sync worker (60s polling)
PEMS UPDATE API
  ↓
PEMS (updated)
```

### Key Capabilities

**1. Write Sync Worker**
- Polls for committed modifications every 60 seconds
- Batches up to 100 updates for efficiency
- Respects PEMS API rate limits (10 req/sec)
- Retries failed writes with exponential backoff
- Updates sync status in real-time

**2. PEMS Update API Integration**
- `PUT /api/pfa/:id` - Update single PFA record
- `POST /api/pfa/batch` - Batch update multiple records
- `DELETE /api/pfa/:id` - Soft delete (mark as discontinued)
- Version-based optimistic locking

**3. Conflict Resolution**
- Detects concurrent modifications (PEMS version vs local baseVersion)
- User notification for conflicts
- Manual resolution strategies: Use Local, Use PEMS, Merge
- Automatic retry after resolution
- Complete audit trail for all resolutions

**4. Sync Status Tracking**
- Real-time sync progress indicators
- Error notifications and alerts
- Detailed logs for debugging
- Dashboard with sync health metrics
- Historical sync job tracking

**5. Rollback Capabilities**
- Version-based rollback to any historical state
- Preview changes before rollback
- Automatic PEMS sync of rollback data
- Administrator approval required

---

## Requirements

### Functional Requirements

**FR-1: Write API**
- Support UPDATE operations for PFA fields (forecast dates, costs, DOR)
- Support DELETE operations (soft delete in PEMS)
- Validate changes against PEMS business rules
- Return PEMS confirmation response with new version

**FR-2: Sync Worker**
- Poll for committed modifications every 60 seconds
- Batch up to 100 records per sync cycle
- Respect PEMS API rate limits (max 10 req/sec)
- Update sync status in real-time
- Handle queue backlog gracefully

**FR-3: Conflict Detection**
- Compare baseVersion with PEMS current version
- Identify changed fields using field-level diff
- Notify user of conflicts via in-app notifications
- Provide resolution options in UI

**FR-4: Error Handling**
- Retry failed writes up to 3 times
- Exponential backoff (5s → 10s → 20s)
- Move to dead letter queue after max retries
- Alert administrators of critical failures
- Log all errors for debugging

**FR-5: Audit Trail**
- Log all write attempts (success and failure)
- Track who made changes (userId, timestamp)
- Record PEMS responses (version, updatedAt)
- Maintain conflict resolution history
- Support audit log queries and exports

### Non-Functional Requirements

**NFR-1: Performance**
- Process 1000 modifications within 5 minutes
- Sync latency < 2 minutes for committed changes
- Handle 10,000 concurrent modifications in queue
- Support 100 concurrent users editing

**NFR-2: Reliability**
- 99.9% sync success rate (SLA)
- Zero data loss during failures
- Automatic recovery from network issues
- Graceful degradation when PEMS unavailable

**NFR-3: Security**
- Encrypt PEMS credentials at rest (AES-256)
- Use HTTPS for all PEMS communication
- Validate user permissions before sync (`perm_Sync` required)
- Audit all write operations
- Prevent SQL injection and XSS attacks

**NFR-4: Observability**
- Real-time sync status dashboard
- Prometheus metrics for monitoring
- Detailed error logs for debugging
- Alert on sync failures (email, Slack)
- Health check endpoints

---

## Decision Drivers

### Technical Drivers

1. **PEMS as Source of Truth**: Maintain PEMS as authoritative source while enabling superior UI
2. **Optimistic Locking**: Use version-based conflict detection (already implemented in Phase 3)
3. **Queue-Based Processing**: Decoupled async processing for reliability
4. **Idempotency**: Ensure retry-safe operations
5. **Audit Trail**: Meet compliance requirements

### Business Drivers

1. **User Experience**: Superior PFA Vanguard UI vs PEMS UI
2. **Data Quality**: Single source of truth reduces errors
3. **Time Savings**: Eliminate duplicate data entry
4. **Compliance**: Complete audit trail for SOX/regulatory
5. **Scalability**: Support 10K+ PFA records across organizations

### Risk Drivers

1. **Data Loss Risk**: Transactional operations and audit logging
2. **Conflict Risk**: Clear resolution UI and user training
3. **Performance Risk**: Batching and rate limiting
4. **Security Risk**: Encryption and permission validation

---

## Assumptions

1. **PEMS API Availability**: PEMS UPDATE API is available and documented
2. **Network Reliability**: Stable network connection between PFA Vanguard and PEMS
3. **User Permissions**: Users have appropriate PEMS write permissions
4. **Version Support**: PEMS supports optimistic locking with version numbers
5. **Rate Limits**: PEMS API can handle 10 req/sec sustained load
6. **Data Volume**: Average 100-500 modifications per day per organization

---

## Constraints

1. **PEMS Schema**: Cannot modify PEMS database schema
2. **API Format**: Must use PEMS standard API formats
3. **Authentication**: Must use existing PEMS authentication mechanisms
4. **Performance**: Must respect PEMS API rate limits
5. **Compliance**: Must maintain complete audit trail (SOX requirement)
6. **Backward Compatibility**: Must not break existing read-only sync

---

## Dependencies

### External Dependencies

**PEMS API**:
- UPDATE endpoint availability and documentation
- Rate limit specifications (10 req/sec confirmed)
- Test environment access for QA
- Version-based optimistic locking support

**Infrastructure**:
- PostgreSQL 14+ (already deployed)
- Redis for worker coordination (already deployed)
- Monitoring tools: Prometheus/Grafana (Phase 4.5)

### Internal Dependencies

**Completed**:
- ✅ PfaMirror + PfaModification architecture (Phase 3)
- ✅ Optimistic locking with versioning (Enhancement 4, Session 3)
- ✅ Retry service with exponential backoff (Enhancement 4, Session 2)
- ✅ Permission system with `perm_Sync` (ADR-005)

**In Progress**:
- None

---

## Stakeholder Analysis

| Stakeholder | Concern | Resolution |
|-------------|---------|------------|
| **Project Managers** | "Will this break existing workflows?" | No - backward compatible, opt-in per org |
| **Finance Team** | "Can we track who changed budget data?" | Yes - complete audit trail |
| **Security Team** | "Are PEMS credentials secure?" | Yes - AES-256 encryption at rest |
| **PEMS Admins** | "Will this overload PEMS API?" | No - rate limiting and batching |
| **End Users** | "What if I make a mistake?" | Rollback capability with admin approval |
| **Compliance** | "Can we prove data lineage?" | Yes - audit log tracks all changes |

---

## Success Criteria

### Functional Success

- [x] User can commit modifications for PEMS sync
- [x] System queues modifications for processing
- [x] Sync worker processes queue within 2 minutes
- [x] PEMS receives updates successfully
- [x] Mirror updates with new PEMS version
- [x] Conflicts detected and user notified
- [x] User can resolve conflicts via UI
- [x] Rollback works correctly

### Performance Success

- [x] Process 1000 modifications in < 5 minutes
- [x] Sync latency < 2 minutes average
- [x] 99.9% sync success rate
- [x] Zero data loss during failures

### Security Success

- [x] PEMS credentials encrypted at rest
- [x] User permissions validated before sync
- [x] Audit log captures all write attempts
- [x] HTTPS enforced for PEMS communication

---

## Risks & Mitigation

See [TEST_PLAN.md](./ADR-008-TEST_PLAN.md) for complete risk assessment.

**High Risks**:
1. **Data Loss**: Transactional queue operations, persistent retry tracking
2. **Version Conflicts**: Optimistic locking, clear conflict UI
3. **PEMS Rate Limiting**: Batching, throttling, exponential backoff

---

## Approval

**Required Approvers**:
- [ ] Product Manager - Business requirements and user impact
- [ ] Tech Lead - Technical architecture and implementation plan
- [ ] Security Team - Security and compliance review
- [ ] PEMS Administrator - API usage and impact assessment

**Approval Status**: Pending

---

**Next**: See [IMPLEMENTATION_PLAN.md](./ADR-008-IMPLEMENTATION_PLAN.md) for technical architecture.
