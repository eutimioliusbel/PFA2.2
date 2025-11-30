# Quick Reference: Multi-Tenant Access Control

**Version**: 1.0
**Status**: Ready to Implement
**Total Duration**: 5-6 days
**Parallel Execution**: Yes (up to 3 agents simultaneously)

---

## 📋 TL;DR - Executive Summary

### What We're Building
A comprehensive multi-tenant access control system with:
- **Organization-level service control** (suspend/activate organizations)
- **User-level service control** (suspend/activate users)
- **Granular permissions** (read-only vs. read-write per user per organization)
- **Efficient PEMS sync** (only sync active organizations)
- **Admin UI** (manage users, organizations, permissions)

### Timeline
- **5-6 days** (vs. 6-8 days original plan)
- **25% time savings** through parallel execution
- **3 agents running simultaneously** on Day 2

### Key Benefits
✅ Immediate user suspension capability (security)
✅ Reduce PEMS API costs (skip inactive organizations)
✅ Read-only stakeholder access (compliance)
✅ Foundation for per-organization billing
✅ Backward compatible (existing users continue working)

---

## 🚀 Quick Start Commands

### Day 1: Database Schema
```bash
Task(
  subagent_type: "postgres-jsonb-architect",
  description: "Implement access control schema",
  model: "sonnet",
  prompt: "See: docs/implementation/IMPLEMENTATION-PLAN-ACCESS-CONTROL.md Phase 1"
)
```

### Day 2: Triple Parallel Execution 🔥
```bash
# Launch all three simultaneously for parallel execution
Task(subagent_type: "devsecops-engineer", description: "Backend authorization", model: "sonnet", prompt: "See Phase 2");
Task(subagent_type: "backend-architecture-optimizer", description: "PEMS sync filtering", model: "haiku", prompt: "See Phase 3");
Task(subagent_type: "ai-security-red-teamer", description: "Authorization security testing", model: "sonnet", prompt: "See Phase 2.5");
```

### Day 4: Frontend Permissions
```bash
Task(
  subagent_type: "react-ai-ux-specialist",
  description: "Enforce permissions in UI",
  model: "sonnet",
  prompt: "See: docs/implementation/IMPLEMENTATION-PLAN-ACCESS-CONTROL.md Phase 4"
)
```

### Day 5: Admin UI
```bash
Task(
  subagent_type: "react-ai-ux-specialist",
  description: "Build admin UI for access control",
  model: "sonnet",
  prompt: "See: docs/implementation/IMPLEMENTATION-PLAN-ACCESS-CONTROL.md Phase 5"
)
```

### Day 6: Testing + Docs (Dual Parallel)
```bash
Task(subagent_type: "sdet-test-automation", description: "Test access control", model: "sonnet", prompt: "See Phase 6.1");
Task(subagent_type: "prompt-engineer", description: "Document features", model: "haiku", prompt: "See Phase 6.2");
```

---

## 📊 Optimized Workflow at a Glance

```
Day 1: Phase 1 (Database Schema)
       └─> postgres-jsonb-architect

Day 2: TRIPLE PARALLEL 🔥
       ├─> Phase 2: Backend Auth (devsecops-engineer)
       ├─> Phase 3: Sync Filtering (backend-architecture-optimizer)
       └─> Phase 2.5: Security Testing (ai-security-red-teamer)

Day 3: Security Fixes (0.5 day)

Day 4: Phase 4.1 (Frontend Permissions)
       └─> react-ai-ux-specialist

Day 5: Phase 5 (Admin UI)
       └─> react-ai-ux-specialist

Day 6: DUAL PARALLEL
       ├─> Phase 6.1: Testing (sdet-test-automation)
       └─> Phase 6.2: Documentation (prompt-engineer)

DONE: 5-6 days ✅
```

---

## 🎯 Agent Assignments (Optimized)

| Phase | Agent | Rationale | Model |
|-------|-------|-----------|-------|
| 1 | `postgres-jsonb-architect` | Database schema expert | sonnet |
| 2 | `devsecops-engineer` | **Security-critical** auth middleware | sonnet |
| 3 | `backend-architecture-optimizer` | Performance optimization | haiku |
| 2.5 | `ai-security-red-teamer` | Security validation | sonnet |
| 4.1 | `react-ai-ux-specialist` | React hooks + state | sonnet |
| 5 | `react-ai-ux-specialist` | **Continues** from Phase 4 | sonnet |
| 6.1 | `sdet-test-automation` | Testing strategy | sonnet |
| 6.2 | `prompt-engineer` | **Documentation expert** | haiku |

**Key Changes from Original**:
- 🔄 Phase 2: `devsecops-engineer` (was backend-architecture-optimizer) - **Security focus**
- 🆕 Phase 2.5: `ai-security-red-teamer` - **New security testing phase**
- 🔄 Phase 6.2: `prompt-engineer` (was same as 6.1) - **Better documentation**

---

## 📦 Deliverables Checklist

### Phase 1: Database Schema ✅
- [ ] Updated `schema.prisma` with access control fields
- [ ] Migration script (`YYYYMMDDHHMMSS_add_access_control.sql`)
- [ ] Seed script for default permissions
- [ ] Migration verification tests
- [ ] Performance indexes created

### Phase 2: Backend Authorization ✅
- [ ] `middleware/authorize.ts` - Permission checking
- [ ] Updated `authService.ts` - Load permissions on login
- [ ] Authorization applied to all API routes
- [ ] JWT token includes permissions
- [ ] Unit tests (>80% coverage)

### Phase 3: PEMS Sync Filtering ✅
- [ ] Updated `PemsSyncWorker.ts` - Filter by status
- [ ] Organization sync status endpoint
- [ ] No performance degradation (<50ms overhead)
- [ ] Sync logs show filtered organizations

### Phase 2.5: Security Testing ✅
- [ ] Security test suite for authorization
- [ ] Penetration testing results
- [ ] Vulnerability assessment report
- [ ] Hardening recommendations

### Phase 4.1: Frontend Permissions ✅
- [ ] Updated `AuthContext.tsx` - Store permissions
- [ ] Permission hooks (`useCanWrite`, `useCanDelete`)
- [ ] Disabled UI controls for read-only users
- [ ] `PermissionBadge.tsx` component
- [ ] 403 error handling

### Phase 5: Admin UI ✅
- [ ] `UserManagement.tsx` - CRUD users
- [ ] `OrganizationManagement.tsx` - CRUD orgs
- [ ] `UserOrgPermissions.tsx` - Assign roles
- [ ] `AuditLog.tsx` - View permission history
- [ ] Admin API endpoints (8 new endpoints)

### Phase 6.1: Testing ✅
- [ ] Unit tests (>80% coverage)
- [ ] Integration tests (auth flows)
- [ ] E2E tests (UI enforcement)
- [ ] Performance benchmarks met

### Phase 6.2: Documentation ✅
- [ ] `API_AUTHORIZATION.md` - API docs
- [ ] Updated `USER_GUIDE.md` - User permissions
- [ ] Updated `ADMIN_GUIDE.md` - Admin features
- [ ] Updated `CLAUDE.md` - AI assistant guidance

---

## 🔐 Key Features Summary

### Organization Service Control
```typescript
serviceStatus: 'active' | 'suspended' | 'archived'
enableSync: boolean  // Control PEMS sync independently

// Suspended organizations:
- ❌ No PEMS sync
- ❌ Users cannot access data
- ❌ Hidden from organization list
```

### User Service Control
```typescript
serviceStatus: 'active' | 'suspended' | 'locked'

// Suspended users:
- ❌ Cannot login
- ❌ Existing sessions invalidated
- ✅ Audit trail preserved
```

### Permission Model
```typescript
// Predefined Roles
viewer: { canRead: true, all others: false }
editor: { canRead: true, canWrite: true, canDelete: false }
admin: { all permissions: true }

// Granular Permissions (per user per organization)
- canRead: View data
- canWrite: Modify data (draft/commit)
- canDelete: Delete records
- canManageUsers: Assign permissions
- canSync: Trigger PEMS sync
- canManageSettings: Change org settings
```

### PEMS Sync Filtering
```sql
-- Only sync organizations where:
SELECT * FROM organizations
WHERE isActive = true
  AND serviceStatus = 'active'
  AND enableSync = true;
```

---

## ⚡ Performance Targets

| Metric | Target | Critical? |
|--------|--------|-----------|
| Migration success rate | 100% | ✅ YES |
| Authorization overhead | <50ms | ⚠️ WARN |
| Test coverage | >80% | ✅ YES |
| UI permission check | <100ms | ⚠️ WARN |
| Sync filtering overhead | <50ms | ⚠️ WARN |

---

## 🚨 Critical Success Factors

### Must Have (Go/No-Go)
1. ✅ **100% migration success** - All existing users have permissions
2. ✅ **Zero data loss** - Migration is reversible
3. ✅ **Security validated** - No privilege escalation vulnerabilities
4. ✅ **Test coverage >80%** - Comprehensive test suite

### Should Have (Quality)
1. ⚠️ **Authorization <50ms** - Fast permission checks
2. ⚠️ **UI responsive** - No lag from permission hooks
3. ⚠️ **Documentation complete** - All features documented

### Nice to Have (Polish)
1. ❌ **Admin UI mobile-friendly** - Responsive design
2. ❌ **Audit log export** - CSV/PDF export functionality
3. ❌ **Permission templates** - Pre-defined role templates

---

## 🔄 Rollback Plan

### If Critical Issues in Phase 1-2
```bash
# Immediate rollback
git checkout master
npx prisma migrate reset --force
npm run seed
```

### If Issues in Phase 3-6
```bash
# Rollback just the problematic phase
git revert <commit-hash>
npx prisma migrate down  # Only if schema changed
```

### Data Preservation
- ✅ All new fields have default values
- ✅ No data deleted (only additions)
- ✅ Existing users continue working with defaults

---

## 📖 Documentation Links

### Architecture
- **ADR**: [ADR-005-MULTI_TENANT_ACCESS_CONTROL.md](./architecture/ADR-005-MULTI_TENANT_ACCESS_CONTROL.md)

### Implementation
- **Detailed Plan**: [IMPLEMENTATION-PLAN-ACCESS-CONTROL.md](./implementation/IMPLEMENTATION-PLAN-ACCESS-CONTROL.md)
- **Agent Workflow**: [AGENT_WORKFLOW_ACCESS_CONTROL.md](./AGENT_WORKFLOW_ACCESS_CONTROL.md)
- **Optimized Workflow**: [OPTIMIZED_AGENT_WORKFLOW.md](./OPTIMIZED_AGENT_WORKFLOW.md) ⭐

### Project Tracking
- **Development Log**: [DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md) (updated)

---

## 🎓 Lessons Learned (Optimizations)

### Agent Selection
1. **Use devsecops-engineer for security-critical work** (not generic backend)
2. **Add ai-security-red-teamer for validation** (parallel execution)
3. **Use prompt-engineer for documentation** (not testing agent)

### Parallel Execution
1. **Day 2: 3 agents simultaneously** saves 1 day
2. **Day 6: 2 agents simultaneously** saves 0.5 day
3. **Total savings: 25%** (6-8 days → 5-6 days)

### Risk Mitigation
1. **Security testing in parallel** catches issues early
2. **Same agent continuity** (Phase 4→5) reduces context switching
3. **Incremental testing** after each phase

---

## 📞 Quick Contact Points

### Stakeholder Checkpoints
- **Day 1**: After database migration - Verify migration success
- **Day 3**: After backend authorization - Security review
- **Day 4**: After frontend permissions - UX demo
- **Day 6**: After testing complete - Production readiness review

### Emergency Contacts
- **Security Issues**: Immediate escalation to security team
- **Data Loss**: Immediate rollback, restore from backup
- **Performance Issues**: Acceptable warning (fix in next iteration)

---

**Status**: ✅ Ready to Start
**Next Action**: Launch Phase 1 with postgres-jsonb-architect
**Estimated Completion**: 5-6 days from start
**Success Rate**: High (comprehensive planning + proven patterns)

*Document created: 2025-11-26*
*Quick reference version: 1.0*
