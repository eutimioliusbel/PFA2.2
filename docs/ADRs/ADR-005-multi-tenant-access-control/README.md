# ADR-005: Multi-Tenant Access Control

**Status**: Proposed (Pending Implementation)
**Date Created**: 2025-11-26
**Decision Owner**: Development Team

---

## 📁 Folder Contents

This ADR folder contains all documentation related to the Multi-Tenant Access Control architecture decision.

### Required Documents (7-Document Blueprint Container)

| Document | Purpose | Status |
|----------|---------|--------|
| [ADR-005-DECISION.md](./ADR-005-DECISION.md) | The "Why" - Architecture decision & business logic | ✅ Complete |
| [ADR-005-AI_OPPORTUNITIES.md](./ADR-005-AI_OPPORTUNITIES.md) | The "Future-Proofing" - AI readiness & data hooks | ✅ Complete |
| [ADR-005-UX_SPEC.md](./ADR-005-UX_SPEC.md) | The "Feel" - Interaction model & perceived performance | ✅ Complete |
| [ADR-005-TEST_PLAN.md](./ADR-005-TEST_PLAN.md) | The "Guardrails" - Security & testing requirements | ✅ Complete |
| [ADR-005-IMPLEMENTATION_PLAN.md](./ADR-005-IMPLEMENTATION_PLAN.md) | The "How" - Technical blueprint (6 phases) | ✅ Complete |
| [ADR-005-AGENT_WORKFLOW.md](./ADR-005-AGENT_WORKFLOW.md) | The "Schedule" - Agent orchestration & execution | ✅ Complete (47 tasks, 21 days) |
| [ADR-005-TECHNICAL_DOCS.md](./ADR-005-TECHNICAL_DOCS.md) | The "As-Built" - Post-implementation documentation | 📋 Pending |

### Quick Reference

For a quick overview, see: [docs/QUICK_REFERENCE_ACCESS_CONTROL.md](../../QUICK_REFERENCE_ACCESS_CONTROL.md)

---

## 📖 Reading Order

**If you're new to this ADR**, read in this order:

1. **Quick Reference** (5 min read) - TL;DR summary
2. **ADR-005-DECISION.md** (15 min read) - Why we're doing this & business logic
3. **ADR-005-AI_OPPORTUNITIES.md** (10 min read) - Future AI integration points
4. **ADR-005-UX_SPEC.md** (15 min read) - How it should feel to users
5. **ADR-005-TEST_PLAN.md** (10 min read) - Security & testing strategy
6. **ADR-005-IMPLEMENTATION_PLAN.md** (30 min read) - Technical blueprint
7. **ADR-005-AGENT_WORKFLOW.md** (15 min read) - Execution schedule

**If you're implementing this ADR**:

1. Review ADR-005-IMPLEMENTATION_PLAN.md for technical details
2. Review ADR-005-TEST_PLAN.md for testing requirements
3. Follow ADR-005-UX_SPEC.md for UI implementation
4. Use ADR-005-AGENT_WORKFLOW.md for agent orchestration
5. Track progress in [docs/DEVELOPMENT_LOG.md](../../DEVELOPMENT_LOG.md)

**If you're planning AI features**:

1. Review ADR-005-AI_OPPORTUNITIES.md for data hooks and API requirements

---

## 🎯 Summary

This ADR implements a comprehensive multi-tenant access control system with:

### Key Features
- ✅ Organization-level service control (suspend/activate)
- ✅ User-level service control (suspend/activate/lock)
- ✅ Granular RBAC permissions (viewer/editor/admin)
- ✅ Efficient PEMS sync (skip inactive organizations)
- ✅ Read-only user support
- ✅ Admin UI for user/org management

### Timeline
- **Duration**: 21 days (expanded scope: Core Access Control + AI Intelligence + BEO Analytics)
- **Phases**: 10 implementation phases
- **Agents**: 7 specialized agents
- **Parallel Work**: 3 opportunities for simultaneous execution
- **Tasks**: 47 total (all with self-contained prompt bundles)

### Success Metrics
- ✅ 100% migration success rate
- ✅ Authorization overhead <50ms
- ✅ Test coverage >80%
- ✅ Zero data loss
- ✅ Backward compatible

---

## 🚀 Implementation Status

### Current Phase: ⚠️ SCOPE CHANGE PENDING - PEMS Hybrid Integration
- [x] ADR-005-DECISION.md written (expanded scope)
- [x] ADR-005-AI_OPPORTUNITIES.md written (25 AI use cases)
- [x] ADR-005-UX_SPEC.md written (29 total use cases with mockups)
- [x] ADR-005-TEST_PLAN.md written (comprehensive security + AI tests)
- [x] ADR-005-IMPLEMENTATION_PLAN.md written (10 phases, optimized timeline)
- [x] ADR-005-AGENT_WORKFLOW.md written (47 tasks with prompt bundles)
- [ ] **NEW**: Execute ADR-005-UPDATE_PLAN.md for PEMS Hybrid Source of Truth
- [ ] ADR approved by stakeholders
- [ ] Implementation started

### ✅ SCOPE EXPANSION COMPLETE
**Date**: 2025-11-26
**Status**: Blueprint Complete - Ready for Stakeholder Approval
**Impact**: **HIGH** - 3.5x complexity increase from original plan

**Scope Evolution**:
- ~~Original Scope~~: Basic RBAC (6-8 days, 6 phases)
- **Current Scope**: Enterprise Access Control + AI Intelligence + BEO Analytics (21 days, 10 phases)
- **New Features**:
  - **Core Access Control**: 14 permission flags, hybrid role-override, temporal access, session management
  - **UX Intelligence**: Context tooltips, financial masking, semantic audit search, role drift detection, smart notifications
  - **BEO Analytics**: Voice analyst, narrative variance, asset arbitrage, vendor watchdog, scenario simulator
  - **Governance**: Pre-flight review, time travel revert, import wizard, BEO glass mode

### ⚠️ NEW SCOPE CHANGE: PEMS Hybrid Source of Truth
**Date**: 2025-11-26
**Status**: Update Plan Generated - Awaiting Blueprint Updates
**Impact**: **HIGH** - Adds external identity management and sync conflict resolution

**Additional Scope**:
- **Hybrid Identity**: PEMS users with optional local passwords, SSO support, JIT provisioning
- **Hybrid Tenancy**: PEMS-managed organizations with read-only identity fields
- **Hybrid Access**: Sync conflict detection, local permission overrides (`isCustom` flag)
- **Security Intelligence**: Orphan account detection, automated suspension recommendations
- **Database Changes**:
  - User: nullable `passwordHash`, `externalId`, `authProvider`
  - Organization: `externalId`, `isExternal` flag
  - UserOrganization: `assignmentSource`, `externalRoleId`, `isCustom`
- **New AI Use Cases**: Sync conflict resolution (UC 26), Orphan account detection (UC 27)
- **Estimated Additional Time**: +3-5 days for hybrid features (24-26 days total)

**Action Required**: Execute all 5 steps in [ADR-005-UPDATE_PLAN.md](./ADR-005-UPDATE_PLAN.md)

### Next Steps
1. **IMMEDIATE**: Review ADR-005-UPDATE_PLAN.md for PEMS hybrid integration scope
2. Execute prompt bundles in UPDATE_PLAN (Steps 1-5) to update all blueprint documents
3. Re-run `/execute-adr 005` to regenerate workflow with hybrid features
4. Review all updated blueprint documents with stakeholders
5. Get approval to proceed with 24-26 day implementation (21 days + 3-5 days hybrid)
6. Create Git branch: `feature/adr-005-access-control`
7. Configure AI API keys (Gemini, OpenAI, Claude)
8. Launch Phase 1: Database Schema (postgres-jsonb-architect agent)
9. Use regenerated ADR-005-AGENT_WORKFLOW.md for execution

---

## 📊 Decision Tracking

| Aspect | Details |
|--------|---------|
| **Problem** | Need multi-tenant access control with organization/user-level service management |
| **Decision** | Implement RBAC with folder-based ADR structure |
| **Alternatives** | Simple boolean flags (rejected - insufficient granularity) |
| **Status** | Proposed |
| **Impact** | High (affects all organizations and users) |
| **Risk** | Medium (database migration required) |

---

## 📞 Related Documentation

### Primary References
- **Development Log**: [docs/DEVELOPMENT_LOG.md](../../DEVELOPMENT_LOG.md)
- **Documentation Standards**: [docs/DOCUMENTATION_STANDARDS.md](../../DOCUMENTATION_STANDARDS.md)
- **Quick Reference**: [docs/QUICK_REFERENCE_ACCESS_CONTROL.md](../../QUICK_REFERENCE_ACCESS_CONTROL.md)

### Implementation Context
- **Current System**: Phase 3 complete (Live Merge API operational)
- **Dependencies**: None (can start immediately)
- **Blockers**: None

---

## 🔗 External Links

- **Architecture Decision**: [ADR-005-DECISION.md](./ADR-005-DECISION.md)
- **Implementation Plan**: [ADR-005-IMPLEMENTATION_PLAN.md](./ADR-005-IMPLEMENTATION_PLAN.md)
- **Agent Workflow**: [ADR-005-AGENT_WORKFLOW.md](./ADR-005-AGENT_WORKFLOW.md)

---

**Folder Created**: 2025-11-26
**Last Updated**: 2025-11-26
**Maintainer**: Development Team
