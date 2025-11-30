# Phase 7 (UX Intelligence) - Complete Prompt Bundle Summary

**Generated**: 2025-11-27
**Requestor**: User
**Status**: ✅ Complete (All 5 Tasks)

---

## OVERVIEW

Phase 7 implements **5 AI-powered UX Intelligence features** from ADR-005. Each task has a complete, self-contained prompt bundle (600-1500 lines) ready for agent execution.

**Total Estimated Duration**: 10 days (2 days per task)
**Total Lines of Code**: ~6,500 lines across all deliverables

---

## PROMPT BUNDLE FILES

### Task 7.1: Context-Aware Access Explanation (UC 16)

**File**: `temp/agent-work/2025-11-27-phase7-task1-context-aware-tooltips-final.md`

**Agent**: @ux-technologist
**Duration**: 2 days
**Lines**: ~1,450 lines

**What It Does**:
- AI-powered tooltips that explain WHY users are denied access
- Chain-of-thought reasoning through 5 permission checks
- Actionable resolution steps with contact info and ETAs
- Example: "You cannot sync because your role (Field Engineer) lacks pems:sync capability. Request role upgrade from admin@company.com (ETA: 1 business day)"

**Deliverables**:
1. `backend/src/services/ai/PermissionExplanationService.ts` (350+ lines)
2. `backend/src/controllers/permissionExplanationController.ts` (80+ lines)
3. `components/PermissionTooltip.tsx` (300+ lines)
4. Integration updates to existing components
5. `backend/tests/integration/permissionExplanation.test.ts` (200+ lines)

**Success Metrics**:
- 100% of permission denials have context tooltips
- AI confidence >90% for explanations
- Cache hit rate >80% after warmup
- Latency <300ms for uncached tooltips

---

### Task 7.2: Financial Data Masking with Relative Indicators (UC 17)

**File**: `temp/agent-work/2025-11-27-phase7-task2-financial-masking-final.md`

**Agent**: @ux-technologist
**Duration**: 2 days
**Lines**: ~1,520 lines

**What It Does**:
- Hides absolute costs from non-privileged users (security compliance)
- Shows relative impact indicators instead (Top 5%, 3.2x average)
- AI generates cost optimization recommendations
- Example: "$450,000 crane" → "⚠️ High Budget Impact (Top 5%, 3.2x avg). Consider standard 150T model."

**Deliverables**:
1. `backend/src/services/ai/FinancialMaskingService.ts` (400+ lines)
2. `backend/src/controllers/financialMaskingController.ts` (80+ lines)
3. `components/FinancialImpactBadge.tsx` (100+ lines)
4. `components/MaskedCostField.tsx` (80+ lines)
5. `backend/tests/integration/financialMasking.test.ts` (250+ lines)

**Success Metrics**:
- 0% bypass rate (absolute costs never exposed)
- Percentile calculation accuracy >95%
- AI insight generation <500ms
- User decision quality maintained (A/B test)

---

### Task 7.3: Semantic Audit Search (UC 18)

**File**: `temp/agent-work/2025-11-27-phase7-tasks-3-4-5-consolidated-final.md` (Section 1)

**Agent**: @ai-systems-architect
**Duration**: 2 days
**Lines**: ~900 lines (in consolidated file)

**What It Does**:
- Natural language audit log queries ("Who changed crane duration last week?")
- Multi-turn context retention ("Why did they do it?" remembers previous query)
- External event correlation (weather, project milestones)
- Example: "Who modified PFA records yesterday?" → Shows 12 changes by John Doe, correlates with Nov 25 storm

**Deliverables**:
1. `backend/src/services/ai/SemanticAuditSearchService.ts` (400+ lines)
2. `backend/src/controllers/semanticAuditController.ts` (80+ lines)
3. `components/admin/SemanticAuditSearch.tsx` (150+ lines)
4. `backend/tests/integration/semanticAuditSearch.test.ts` (200+ lines)

**Success Metrics**:
- AI parses 90%+ of natural language queries correctly
- Multi-turn queries remember context
- Query execution <2 seconds
- External event correlation accuracy >80%

---

### Task 7.4: Role Drift Detection (UC 19)

**File**: `temp/agent-work/2025-11-27-phase7-tasks-3-4-5-consolidated-final.md` (Section 2)

**Agent**: @ai-systems-architect
**Duration**: 2 days
**Lines**: ~900 lines (in consolidated file)

**What It Does**:
- Detects when 5+ users have identical capability overrides
- Alerts admins: "5 Field Engineers have identical overrides (canManageUsers, canManageSettings)"
- Suggests creating "Senior Field Engineer" role
- One-click migration: Create role, move users, remove overrides

**Deliverables**:
1. `backend/src/services/ai/RoleDriftDetectionService.ts` (350+ lines)
2. `backend/src/controllers/roleDriftController.ts` (100+ lines)
3. `components/admin/RoleDriftAlerts.tsx` (120+ lines)
4. `backend/tests/integration/roleDriftDetection.test.ts` (180+ lines)

**Success Metrics**:
- Detects drift when 3+ users have 60%+ identical overrides
- One-click refactor creates new role and migrates users
- 7-day rollback window available
- False positive rate <10%

---

### Task 7.5: Behavioral Quiet Mode (UC 20)

**File**: `temp/agent-work/2025-11-27-phase7-tasks-3-4-5-consolidated-final.md` (Section 3)

**Agent**: @ux-technologist
**Duration**: 2 days
**Lines**: ~1,000 lines (in consolidated file)

**What It Does**:
- AI learns user engagement patterns over 4 months
- Identifies peak attention hours (14:00-16:00) and quiet hours (08:00-12:00)
- Defers routine notifications to peak hours, sends urgent alerts immediately
- Batches 10+ deferred notifications into daily digest

**Deliverables**:
1. `backend/src/services/ai/NotificationTimingService.ts` (450+ lines)
2. `backend/src/controllers/notificationTimingController.ts` (90+ lines)
3. `components/settings/NotificationPreferences.tsx` (140+ lines)
4. `backend/tests/integration/notificationTiming.test.ts` (220+ lines)

**Success Metrics**:
- AI learns peak/quiet hours after 4 months of data
- Routine notifications deferred during quiet hours
- Urgent notifications sent immediately
- User engagement rate increases by 20%+
- 30% reduction in interruptions

---

## EXECUTION WORKFLOW

### Sequential Execution (Recommended)

Execute tasks in order 7.1 → 7.2 → 7.3 → 7.4 → 7.5 because:
1. **Task 7.1** establishes AI service patterns (caching, fallback, prompt engineering)
2. **Task 7.2** builds on 7.1's security patterns (data masking, bypass detection)
3. **Tasks 7.3-7.5** are independent but use similar AI service architecture

**Timeline**:
```
Week 1: Tasks 7.1-7.2 (4 days + 1 day buffer)
Week 2: Tasks 7.3-7.5 (6 days + 1 day integration testing)
```

### Parallel Execution (Advanced)

If multiple agents are available:
- **Stream 1**: Tasks 7.1 + 7.2 (@ux-technologist)
- **Stream 2**: Tasks 7.3 + 7.4 (@ai-systems-architect)
- **Stream 3**: Task 7.5 (@ux-technologist)

**Timeline**: 4 days (with 2-3 agents working in parallel)

---

## COMMON DEPENDENCIES (All Tasks)

### Environment Variables

Add to `backend/.env`:
```bash
# Google AI (Gemini 1.5 Flash)
GOOGLE_AI_API_KEY=your_api_key_here
```

### NPM Packages

Install in backend:
```bash
cd backend
npm install @google/generative-ai lru-cache
npm install --save-dev @types/lru-cache
```

### Database Schema

No new tables required. All tasks use existing:
- `User` (Phase 1)
- `UserOrganization` (Phase 1)
- `Role` (Phase 1)
- `AuditLog` (Phase 3)
- `Notification` (existing, may need to add fields)

---

## COMMON AI PATTERNS (All Tasks)

### Pattern 1: LRU Cache

All AI services use LRU cache to reduce API calls:
```typescript
import { LRUCache } from 'lru-cache';

this.cache = new LRUCache<string, T>({
  max: 1000,        // Max entries
  ttl: 1000 * 60 * 15, // 15 minutes
  updateAgeOnGet: true
});
```

**Why**: AI API calls are expensive ($0.01-0.10 per request). Caching reduces costs by 80%+.

### Pattern 2: Fallback Logic

All AI services have rule-based fallback if AI unavailable:
```typescript
try {
  const aiResult = await this.genAI.generateContent(prompt);
  return aiResult;
} catch (error) {
  console.error('[AI Service] Failed:', error);
  return this.generateFallbackResult(); // Rule-based
}
```

**Why**: AI services can fail (rate limits, API downtime). Fallback ensures UX never breaks.

### Pattern 3: Response Validation

All AI services validate response schema:
```typescript
const validateResponse = (response: any): boolean => {
  if (!response || typeof response !== 'object') return false;
  if (!response.summary || typeof response.summary !== 'string') return false;
  // ... more checks
  return true;
};
```

**Why**: AI can return malformed JSON. Validation prevents runtime errors.

### Pattern 4: Prompt Injection Protection

All AI services sanitize user input:
```typescript
const sanitizeInput = (input: string): string => {
  return input
    .replace(/system:|assistant:|user:/gi, '') // Remove role markers
    .replace(/\n\n\n+/g, '\n\n') // Remove excessive newlines
    .substring(0, 500); // Limit length
};
```

**Why**: Prevents users from injecting malicious prompts that override AI instructions.

---

## TESTING STRATEGY (All Tasks)

### Unit Tests (Backend)

Test each service method independently:
```typescript
describe('PermissionExplanationService', () => {
  it('should analyze permission chain correctly', () => { ... });
  it('should generate AI explanation with >90% confidence', () => { ... });
  it('should use fallback when AI fails', () => { ... });
  it('should cache explanations', () => { ... });
});
```

**Coverage Target**: >80% for service classes

### Integration Tests (Backend)

Test API endpoints end-to-end:
```typescript
describe('POST /api/permissions/explain', () => {
  it('should return explanation for denied action', async () => {
    const response = await request(app)
      .post('/api/permissions/explain')
      .send({ userId: 'user-123', organizationId: 'org-456', action: 'pems:sync' });

    expect(response.status).toBe(200);
    expect(response.body.allowed).toBe(false);
    expect(response.body.explanation.confidence).toBeGreaterThan(0.9);
  });
});
```

**Coverage Target**: 100% of API endpoints

### E2E Tests (Frontend)

Test user flows in browser:
```typescript
test('User hovers disabled button and sees tooltip', async ({ page }) => {
  await page.goto('/admin/api-connectivity');
  await page.hover('button:has-text("Sync Data")');
  await expect(page.locator('text=Why can\'t I sync?')).toBeVisible();
});
```

**Coverage Target**: Critical user flows only (5-10 tests per task)

---

## DOCUMENTATION REQUIREMENTS (All Tasks)

### API Reference

Update `docs/backend/API_REFERENCE.md`:
```markdown
## POST /api/permissions/explain

Explain why a user is denied permission for a specific action.

**Request**:
```json
{
  "userId": "string",
  "organizationId": "string",
  "action": "string" // e.g., "pems:sync"
}
```

**Response**:
```json
{
  "allowed": false,
  "explanation": {
    "summary": "You cannot sync because...",
    "reasons": ["..."],
    "resolveActions": [{ "action": "...", "contact": "...", "eta": "..." }],
    "confidence": 0.95
  }
}
```
```

### Component Documentation

Update `docs/frontend/COMPONENTS.md`:
```markdown
## PermissionTooltip

AI-powered tooltip that explains permission denials.

**Props**:
- `action` (string): The action being attempted (e.g., 'pems:sync')
- `children` (ReactElement): The child element (usually a disabled button)
- `organizationId` (string, optional): Custom organization ID
- `debugMode` (boolean, optional): Show admin debug info

**Usage**:
```tsx
<PermissionTooltip action="pems:sync" organizationId={api.organizationId}>
  <Button disabled>Sync Data</Button>
</PermissionTooltip>
```
```

### User Guide

Update `README.md` or user-facing docs:
```markdown
## AI-Powered Features

### Smart Permission Tooltips
When you encounter a disabled button, hover over it to see why you don't have access and how to resolve it.

### Financial Data Masking
If you don't have financial access, costs are hidden but you'll see relative impact indicators (e.g., "Top 5% of crane costs").

### Natural Language Audit Search
Ask questions like "Who changed crane duration last week?" instead of writing SQL queries.
```

---

## ROLLOUT PLAN

### Phase 7.1 (Week 1)

**Days 1-2**: Task 7.1 (Context-Aware Tooltips)
- Backend AI service + API endpoint
- Frontend component
- Integration into existing UI
- Testing

**Days 3-4**: Task 7.2 (Financial Masking)
- Backend AI service + API endpoint
- Frontend components
- Update Timeline/Matrix views
- Security testing (bypass attempts)

**Day 5**: Buffer day for issues, integration testing

### Phase 7.2 (Week 2)

**Days 6-7**: Task 7.3 (Semantic Audit Search)
- Backend AI service + API endpoint
- Frontend search component
- Multi-turn context testing

**Days 8-9**: Task 7.4 (Role Drift Detection)
- Backend AI service + API endpoint
- Admin alerts component
- Rollback system testing

**Days 10-11**: Task 7.5 (Behavioral Quiet Mode)
- Backend AI service + API endpoint
- User preferences component
- Engagement analysis testing

**Day 12**: Integration testing, documentation

---

## SUCCESS CRITERIA (Phase 7 Complete)

### Functional Requirements

- ✅ All 5 UX Intelligence features implemented
- ✅ AI services have <500ms latency (p95)
- ✅ Cache hit rate >80% after warmup
- ✅ Fallback logic works when AI unavailable
- ✅ All security checks pass (financial masking, prompt injection)

### Quality Metrics

- ✅ Backend test coverage >80%
- ✅ Frontend E2E tests cover critical flows
- ✅ API documentation complete
- ✅ Component documentation complete
- ✅ User guide updated

### Performance Metrics

- ✅ Context tooltips: <300ms (uncached), <50ms (cached)
- ✅ Financial masking: <300ms (percentile calculation)
- ✅ Semantic search: <2 seconds (query execution)
- ✅ Role drift: <5 seconds (full analysis)
- ✅ Notification routing: <100ms (decision)

### Business Metrics (Post-Launch)

- ✅ 30% reduction in permission-related support tickets
- ✅ 0% financial data bypass attempts (or 100% detection rate)
- ✅ 80% audit query success rate (natural language)
- ✅ 20% increase in notification engagement rate
- ✅ Role drift detection finds 5+ optimization opportunities

---

## NEXT STEPS

1. **Review Prompt Bundles**: Read all 3 files to understand scope
2. **Setup Environment**: Install dependencies, configure API keys
3. **Execute Task 7.1**: Start with Context-Aware Tooltips (establishes patterns)
4. **Execute Remaining Tasks**: Follow sequential or parallel workflow
5. **Integration Testing**: Test all 5 features together
6. **Documentation**: Complete API docs, component docs, user guide
7. **Deploy to Staging**: Test with real users before production
8. **Monitor Metrics**: Track success criteria post-launch

---

## QUESTIONS OR ISSUES?

**For clarification on prompt bundles**:
- Refer to source ADR documents in `docs/ADRs/ADR-005-multi-tenant-access-control/`
- Check TEST_PLAN.md lines 1169-1676 for detailed test scenarios

**For technical issues during implementation**:
- Review CLAUDE.md for coding standards and common patterns
- Check existing AI service implementations (if any)
- Consult backend/frontend architecture docs

**For scope changes**:
- Update ADR-005 documents first (AI_OPPORTUNITIES.md, UX_SPEC.md)
- Regenerate prompt bundles using `/update-adr` command
- Re-run `/execute-adr` to update AGENT_WORKFLOW.md

---

**END OF SUMMARY**

Generated: 2025-11-27
Files Created: 3
Total Lines: ~6,500 lines
Ready for Execution: ✅ YES
