# Architecture Decision Records (ADRs)

**Last Updated:** 2025-11-25
**Status:** Current

> **Purpose**: Document significant architectural decisions with context, rationale, and consequences. ADRs are immutable once accepted - use new ADRs to supersede old ones.

---

## 📖 What are ADRs?

Architecture Decision Records capture **why** we made certain architectural choices, not just **what** we built. Each ADR documents:

1. **Context**: The problem or situation requiring a decision
2. **Decision**: The architectural choice made
3. **Rationale**: Why this choice over alternatives
4. **Consequences**: Trade-offs, benefits, and future implications
5. **Status**: Proposed, Accepted, Deprecated, Superseded

---

## 📋 Active ADRs

| ADR | Title | Status | Date | Impact |
|-----|-------|--------|------|--------|
| **[ADR-004](./ADR-004-database-architecture-hybrid.md)** | Database Architecture: Hybrid Approach | ✅ Accepted | 2025-11-25 | High |
| **[ADR-005](./ADR-005-CACHED-MIRROR-DELTA-ARCHITECTURE.md)** | Cached Mirror-Delta Architecture | ✅ Accepted | 2025-11-25 | High |

---

## 📄 ADR Details

### ADR-004: Database Architecture - Hybrid Approach

**Decision**: 3-tier hybrid architecture (PostgreSQL + Redis + React state)

**Context**: System needs to handle 1M+ PFA records with sub-100ms query times and bi-directional sync with PEMS.

**Rationale**:
- PostgreSQL: Source of truth with ACID guarantees
- Redis: Hot data cache (15-min TTL) for active organizations
- React state: Active session data (~1000 records)

**Consequences**:
- ✅ Scales to 1M+ records
- ✅ Sub-100ms query performance
- ❌ Requires Redis infrastructure
- ❌ Cache invalidation complexity

**Related**: [../backend/MIGRATION-GUIDE-POSTGRESQL.md](../backend/MIGRATION-GUIDE-POSTGRESQL.md)

---

### ADR-005: Cached Mirror-Delta Architecture

**Decision**: Track changes in database with `syncState` field for bi-directional sync

**Context**: Need to sync local modifications back to PEMS while avoiding overwriting user changes with PEMS updates.

**Rationale**:
- Track record state: pristine, modified, pending_sync, sync_error
- Store modified fields in JSON array for incremental sync
- PEMS version tracking for conflict detection

**Consequences**:
- ✅ Bi-directional sync without data loss
- ✅ Conflict detection and resolution
- ❌ Schema complexity (extra tracking fields)
- ❌ Sync state machine complexity

**Related**: [../implementation/IMPLEMENTATION-PLAN-MIRROR-DELTA.md](../implementation/IMPLEMENTATION-PLAN-MIRROR-DELTA.md)

---

## 📋 Planned ADRs

| ADR | Title | Status | Priority |
|-----|-------|--------|----------|
| **ADR-001** | Sandbox Pattern for State Management | 📋 Planned | High |
| **ADR-002** | Multi-Organization Isolation Strategy | 📋 Planned | Medium |
| **ADR-003** | PEMS Integration Architecture | 📋 Planned | Medium |
| **ADR-006** | Frontend State Migration (Refs → Zustand) | 📋 Planned | High |

---

## 🔧 ADR Process

### When to Write an ADR

Write an ADR when making decisions about:

✅ **Architecture**: Database choice, caching strategy, state management
✅ **Integration Patterns**: External API design, sync strategies
✅ **Technology Choices**: Framework selection, library adoption
✅ **Performance**: Optimization strategies with trade-offs
✅ **Security**: Authentication, encryption, secrets management

❌ **Don't write ADRs for**: Code style, minor refactoring, bug fixes, documentation changes

---

### ADR Template

```markdown
# ADR-XXX: [Title]

**Status**: Proposed | Accepted | Deprecated | Superseded by [ADR-###]
**Date**: YYYY-MM-DD
**Deciders**: [List of people involved]
**Impact**: Low | Medium | High

## Context

[Describe the problem or situation requiring a decision]

## Decision

[State the architectural decision clearly and concisely]

## Rationale

[Explain why this decision was made over alternatives]

**Alternatives Considered**:
1. **Option A**: [Description] - Rejected because [reason]
2. **Option B**: [Description] - Rejected because [reason]
3. **Option C**: [Selected] - Chosen because [reason]

## Consequences

**Positive**:
- ✅ Benefit 1
- ✅ Benefit 2

**Negative**:
- ❌ Trade-off 1
- ❌ Trade-off 2

**Neutral**:
- Changes required: [List]
- Migration path: [Steps]

## Implementation

[High-level implementation approach if applicable]

## Related

- [Link to implementation plan]
- [Link to related ADRs]
- [Link to relevant documentation]

---

**Questions?** See [ADR process documentation](../DOCUMENTATION_STANDARDS.md#architecture-decision-records)
```

---

### ADR Lifecycle

```
Proposed → Discussion → Accepted → Implemented
                ↓
            Rejected (document why)

Later:
Accepted → Deprecated (new approach emerging)
        → Superseded by ADR-XXX (explicit replacement)
```

**Rules**:
1. **Immutable**: Once accepted, ADRs are not edited (except typos)
2. **Superseded**: New ADRs supersede old ones, don't modify old ADRs
3. **Traceable**: Always link related ADRs and implementation docs
4. **Dated**: Include decision date for historical context

---

## 🔗 Related Documentation

- **[../ARCHITECTURE.md](../ARCHITECTURE.md)** - Current system architecture
- **[../ARCHITECTURE_CHANGELOG.md](../ARCHITECTURE_CHANGELOG.md)** - History of changes
- **[../implementation/](../implementation/)** - Implementation plans for ADR decisions
- **[../DOCUMENTATION_STANDARDS.md](../DOCUMENTATION_STANDARDS.md)** - Documentation guidelines

---

## 📝 Contributing

When creating an ADR:

1. **Copy Template**: Use template above or `template.md` in this folder
2. **Number Sequentially**: Next number is ADR-006
3. **Get Feedback**: Discuss in team before marking "Accepted"
4. **Link Implementation**: Reference implementation plans and guides
5. **Update This Index**: Add entry to "Active ADRs" table

---

**Questions?** See [DOCUMENTATION_STANDARDS.md](../DOCUMENTATION_STANDARDS.md) or [docs/README.md](../README.md)
