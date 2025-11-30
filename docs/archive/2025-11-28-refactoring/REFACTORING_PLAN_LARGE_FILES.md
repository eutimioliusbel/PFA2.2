# Refactoring Plan: Large Files

**Status:** PENDING
**Priority:** Medium
**Created:** 2025-11-28
**Related:** CODING_STANDARDS.md Section 1 (20-Line Rule)

---

## Executive Summary

Multiple files in the codebase exceed the recommended limits from CODING_STANDARDS.md:
- **Functions:** Should not exceed 20 lines
- **Files:** Should not exceed 500 lines (recommendation)

This document provides a structured refactoring plan to decompose large files into smaller, more maintainable modules.

---

## Critical Files Requiring Refactoring

### Frontend (React Components)

| File | Current Lines | Target | Priority | Complexity |
|------|--------------|--------|----------|------------|
| App.tsx | 1,651 | <500 | CRITICAL | Very High |
| Timeline.tsx | 833 | <500 | HIGH | High |
| KpiBoard.tsx | 581 | <500 | HIGH | Medium |
| FinancialMaskingBadge.tsx | 559 | <500 | HIGH | Medium |
| AiAssistant.tsx | 558 | <500 | HIGH | Medium |
| MatrixView.tsx | 505 | <500 | HIGH | Medium |
| CommandDeck.tsx | 484 | <300 | MEDIUM | Medium |
| AdminDashboard.tsx | 437 | <300 | MEDIUM | Low |
| FilterPanel.tsx | 419 | <300 | MEDIUM | Low |

### Backend (Services)

| File | Current Lines | Target | Priority | Complexity |
|------|--------------|--------|----------|------------|
| NaturalLanguagePermissionService.ts | 933 | <500 | HIGH | Very High |
| NotificationTimingService.ts | 912 | <500 | HIGH | High |
| SemanticAuditSearchService.ts | 883 | <500 | HIGH | High |
| PermissionSuggestionService.ts | 824 | <500 | HIGH | High |
| AnomalyDetectionService.ts | 817 | <500 | HIGH | High |

---

## Phase 1: App.tsx Decomposition (CRITICAL)

**Current:** 1,651 lines - Root component with sandbox state, undo/redo, routing

**Target Architecture:**
```
App.tsx (150 lines)
├── hooks/
│   ├── usePfaData.ts (100 lines) - Data fetching & caching
│   ├── useSandbox.ts (150 lines) - Sandbox state management
│   ├── useUndoRedo.ts (100 lines) - History management
│   └── useFilters.ts (120 lines) - Filter state & logic
├── context/
│   └── PfaContext.tsx (80 lines) - Centralized state provider
├── routes/
│   └── AppRoutes.tsx (100 lines) - Route configuration
└── utils/
    ├── exportHelpers.ts (80 lines) - CSV/Excel export
    └── pfaTransforms.ts (100 lines) - Data transformations
```

**Benefits:**
- Clearer separation of concerns
- Easier testing (isolated hooks)
- Better code reusability
- Reduced cognitive load

**Estimated Effort:** 24 hours

---

## Phase 2: Timeline.tsx Decomposition (HIGH)

**Current:** 833 lines - Gantt chart with drag-and-drop

**Target Architecture:**
```
Timeline.tsx (200 lines) - Main component
├── components/
│   ├── TimelineHeader.tsx (80 lines)
│   ├── TimelineRow.tsx (100 lines)
│   ├── TimelineBar.tsx (120 lines)
│   └── TimelineTooltip.tsx (60 lines)
├── hooks/
│   ├── useTimelineDrag.ts (100 lines)
│   └── useTimelineZoom.ts (80 lines)
└── utils/
    └── timelineCalculations.ts (100 lines)
```

**Estimated Effort:** 16 hours

---

## Phase 3: Backend AI Services Decomposition (HIGH)

### NaturalLanguagePermissionService.ts (933 lines)

**Target Architecture:**
```
NaturalLanguagePermissionService.ts (200 lines) - Orchestrator
├── parsers/
│   ├── QueryParser.ts (150 lines)
│   └── ContextExtractor.ts (120 lines)
├── generators/
│   ├── PromptGenerator.ts (100 lines)
│   └── ResponseFormatter.ts (100 lines)
└── validators/
    └── PermissionValidator.ts (150 lines)
```

**Estimated Effort:** 20 hours

### NotificationTimingService.ts (912 lines)

**Target Architecture:**
```
NotificationTimingService.ts (150 lines) - Orchestrator
├── analyzers/
│   ├── UserBehaviorAnalyzer.ts (200 lines)
│   ├── TimeSlotAnalyzer.ts (150 lines)
│   └── ImpactAnalyzer.ts (150 lines)
└── schedulers/
    └── NotificationScheduler.ts (200 lines)
```

**Estimated Effort:** 18 hours

---

## Implementation Strategy

### Approach 1: Extract-and-Refactor (Recommended)

1. **Identify cohesive units** - Group related functions
2. **Extract to separate files** - Maintain functionality
3. **Create tests** - Ensure behavior unchanged
4. **Refactor internals** - Apply 20-line rule
5. **Update imports** - Fix all references

**Pros:** Lower risk, incremental progress
**Cons:** Takes longer

### Approach 2: Rewrite-from-Scratch

1. **Design new architecture**
2. **Implement in parallel**
3. **Feature flag switch**
4. **Deprecate old code**

**Pros:** Cleaner result, better architecture
**Cons:** Higher risk, requires comprehensive testing

---

## Prioritization Matrix

### Critical Priority (Start Immediately)

- **App.tsx** - Blocks maintainability of entire frontend
- Estimated: 24 hours
- Dependencies: None

### High Priority (Next Sprint)

- **Timeline.tsx** - Most complex component
- **Backend AI Services** - High cognitive complexity
- Estimated: 54 hours total
- Dependencies: None

### Medium Priority (Future Sprints)

- Remaining large components
- Estimated: 40 hours total
- Dependencies: None

---

## Success Criteria

**File Size:**
- All files <500 lines
- All functions <20 lines (where practical)

**Quality Metrics:**
- Cyclomatic complexity <10 per function
- Test coverage >80% for refactored modules
- No regression in functionality

**Developer Experience:**
- Reduced time to understand code
- Easier to locate specific functionality
- Simpler debugging

---

## Risk Mitigation

### Risks:

1. **Breaking Changes** - Refactoring introduces bugs
   - **Mitigation:** Comprehensive test suite before starting
   - **Mitigation:** Feature flags for gradual rollout

2. **Merge Conflicts** - Active development on same files
   - **Mitigation:** Coordinate with team, use feature branches
   - **Mitigation:** Refactor during low-activity periods

3. **Import Hell** - Too many small files
   - **Mitigation:** Maintain logical grouping (max 3 levels deep)
   - **Mitigation:** Use barrel exports (index.ts)

4. **Scope Creep** - Refactoring turns into feature work
   - **Mitigation:** Strict "extract-only" policy
   - **Mitigation:** Defer optimizations to separate tickets

---

## Timeline Estimate

| Phase | Files | Hours | Calendar |
|-------|-------|-------|----------|
| Phase 1 | App.tsx | 24 | Week 1-2 |
| Phase 2 | Timeline.tsx | 16 | Week 2-3 |
| Phase 3 | AI Services (3 files) | 54 | Week 3-6 |
| Phase 4 | Remaining Components | 40 | Week 7-9 |
| **Total** | **15+ files** | **134** | **9 weeks** |

---

## Next Steps

1. **Create ADR** - Document architectural decisions
2. **Write Tests** - For modules being refactored
3. **Create Branches** - One per phase
4. **Assign Ownership** - Distribute across team
5. **Track Progress** - Weekly check-ins

---

**Status:** PLANNED
**Approval Required:** Tech Lead
**Related ADR:** TBD
