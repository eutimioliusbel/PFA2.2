# PLAN-ADR: Architecture Decision Record Scaffolding

**Command**: `/plan-adr NNN "Feature Title" "Problem Description"`

**Description**: Creates a comprehensive "Blueprint Container" for a new architectural decision. It scaffolds all 7 files required for the agent swarm to work in parallel, ensuring that Product, UX, AI, and Engineering concerns are isolated and detailed before implementation begins.

**Example**: `/plan-adr 006 "Smart Grid Filtering" "Users need to filter 20K+ records in <100ms with complex AND/OR logic"`

---

## 🤖 Instructions for Claude

When this command is invoked, follow these steps:

### Step 1: 📂 Infrastructure Setup

1. **Parse Arguments**:
   - `NNN`: The 3-digit ADR number (e.g., `006`, `007`)
   - `TITLE`: The feature name (e.g., "Smart Grid Filtering")
   - `PROBLEM`: The core problem statement

2. **Generate Folder Name**: Convert title to kebab-case
   - Lowercase all characters
   - Replace spaces with hyphens
   - Remove special characters
   - Example: "Smart Grid Filtering" → "smart-grid-filtering"

3. **Create Directory**:
   ```bash
   mkdir -p "docs/adrs/ADR-NNN-folder-name"
   ```

### Step 2: 📄 File Generation (The 7 Pillars)

Create the following **7 files** inside the new folder using the **Exact Templates** provided below:

1. `README.md` (The Index & Status Dashboard)
2. `ADR-NNN-DECISION.md` (The Requirements & "Why")
3. `ADR-NNN-AI_OPPORTUNITIES.md` (The Innovation Layer)
4. `ADR-NNN-UX_SPEC.md` (The Experience & Polish)
5. `ADR-NNN-TEST_PLAN.md` (The Guardrails & Security)
6. `ADR-NNN-IMPLEMENTATION_PLAN.md` (The Technical Build)
7. `ADR-NNN-AGENT_WORKFLOW.md` (The Execution Schedule)

### Step 3: 🔗 Index Update

Update `docs/adrs/README.md`:
- Add new ADR to the "Active ADRs" table
- Update total count
- Set status to `🏗️ In Design`
- Add link to ADR folder

### Step 4: ✅ Confirmation Output

Show the user:
```
✅ ADR-NNN Blueprint Container Created!

📂 Location: docs/adrs/ADR-NNN-folder-name/

📄 Files Created (7):
  ✅ README.md - Status dashboard
  ✅ ADR-NNN-DECISION.md - Requirements & business logic
  ✅ ADR-NNN-AI_OPPORTUNITIES.md - Future AI integration points
  ✅ ADR-NNN-UX_SPEC.md - UX design & perceived performance
  ✅ ADR-NNN-TEST_PLAN.md - Testing & security strategy
  ✅ ADR-NNN-IMPLEMENTATION_PLAN.md - Technical blueprint
  ✅ ADR-NNN-AGENT_WORKFLOW.md - Execution schedule (placeholder)

🎯 Next Steps:
  1. Fill out ADR-NNN-DECISION.md with detailed requirements
  2. Invoke product-requirements-analyst agent to refine user stories
  3. Invoke ai-systems-architect for AI opportunity brainstorming
  4. Invoke ux-technologist for UX specification
  5. Complete ADR-NNN-TEST_PLAN.md and ADR-NNN-IMPLEMENTATION_PLAN.md
  6. **When all blueprint documents are complete, generate the executable workflow**:
     `/execute-adr NNN`
     This will create AGENT_WORKFLOW.md with self-contained prompt bundles for each agent

📋 ADRs Index Updated: docs/adrs/README.md
```

---

## 📝 Template 1: README.md

```markdown
# ADR-{NNN}: {FEATURE_TITLE}

**Status**: 🏗️ In Design
**Created**: {CURRENT_DATE}
**Problem**: {PROBLEM_DESCRIPTION}

---

## 📂 The Blueprint Container

This ADR folder contains all documentation for the **{FEATURE_TITLE}** architectural decision, following the 7-document Blueprint Container pattern.

| Component | Purpose | Responsible Agent | Status |
|-----------|---------|-------------------|--------|
| [**DECISION**](./ADR-{NNN}-DECISION.md) | Requirements & "Why" | `product-requirements-analyst` | 🔴 Draft |
| [**AI OPPORTUNITIES**](./ADR-{NNN}-AI_OPPORTUNITIES.md) | Innovation & Future-Proofing | `ai-systems-architect` | 🔴 Draft |
| [**UX SPEC**](./ADR-{NNN}-UX_SPEC.md) | Interaction Model & Polish | `ux-technologist` | 🔴 Draft |
| [**TEST PLAN**](./ADR-{NNN}-TEST_PLAN.md) | QA & Security Guardrails | `sdet-test-automation` | 🔴 Draft |
| [**IMPLEMENTATION**](./ADR-{NNN}-IMPLEMENTATION_PLAN.md) | Technical Specification | `backend-architecture-optimizer` | 🔴 Draft |
| [**WORKFLOW**](./ADR-{NNN}-AGENT_WORKFLOW.md) | Execution Schedule | `orchestrator` | ⏳ Pending |
| [**TECHNICAL DOCS**](./ADR-{NNN}-TECHNICAL_DOCS.md) | As-Built Documentation | `documentation-synthesizer` | ⏳ Pending |

---

## 📖 Reading Order

**For Stakeholders**:
1. DECISION.md (5 min) - Business case and requirements

**For Product Team**:
1. DECISION.md (10 min) - Full requirements
2. UX_SPEC.md (10 min) - User experience design

**For Engineering Team**:
1. DECISION.md (10 min) - Requirements
2. AI_OPPORTUNITIES.md (5 min) - Data hooks to implement
3. IMPLEMENTATION_PLAN.md (20 min) - Technical details
4. TEST_PLAN.md (10 min) - Testing requirements
5. AGENT_WORKFLOW.md (5 min) - Execution schedule

**For AI Team**:
1. AI_OPPORTUNITIES.md (10 min) - Future AI features
2. DECISION.md (context)
3. IMPLEMENTATION_PLAN.md (current implementation)

---

## 🚀 Implementation Workflow

### Phase 1: Planning & Design (Current)
- [ ] Requirements defined in DECISION.md
- [ ] AI opportunities identified in AI_OPPORTUNITIES.md
- [ ] UX design completed in UX_SPEC.md
- [ ] Test strategy defined in TEST_PLAN.md
- [ ] Technical plan completed in IMPLEMENTATION_PLAN.md
- [ ] Stakeholder approval obtained

### Phase 2: Orchestration
- [ ] Orchestrator generates AGENT_WORKFLOW.md
- [ ] Agent dependencies mapped
- [ ] Parallel execution opportunities identified

### Phase 3: Implementation
- [ ] Agents execute tasks per AGENT_WORKFLOW.md
- [ ] Tests pass per TEST_PLAN.md
- [ ] UX matches UX_SPEC.md specifications

### Phase 4: Documentation
- [ ] TECHNICAL_DOCS.md completed (as-built)
- [ ] Deviations documented
- [ ] Lessons learned captured

---

**Folder Created**: {CURRENT_DATE}
**Last Updated**: {CURRENT_DATE}
**Maintainer**: Development Team
```

---

## 📝 Template 2: ADR-{NNN}-DECISION.md

```markdown
# ADR-{NNN}: {FEATURE_TITLE} - Decision & Requirements

> **Primary Agent**: `product-requirements-analyst`
> **Instruction**: Translate the problem into rigorous user stories. If requirements are ambiguous, populate the "Discovery Questions" section first.

**Status**: 🔴 Draft
**Date**: {CURRENT_DATE}
**Deciders**: Development Team, Product Team
**Related ADRs**: [List related ADRs if applicable]

---

## 1. Context & Problem Statement

**Problem**: {PROBLEM_DESCRIPTION}

**Why Now?** (Business Driver)
- [What triggered this decision?]
- [Why is this a priority now?]
- [What's the business impact of not solving this?]

**Success Metrics**:
- [Metric 1: e.g., "Reduce time to filter from 5s to <100ms"]
- [Metric 2: e.g., "Increase user satisfaction score to 4.5/5"]
- [Metric 3: e.g., "Support 50K records without performance degradation"]

---

## 2. ❓ Discovery Questions (If Ambiguous)

**⚠️ IMPORTANT: If the user's initial request is vague, the product-requirements-analyst agent must ask clarifying questions before proceeding.**

### Questions for the User:
- [ ] [Question 1: e.g., "Do we need to support mobile layouts for this feature?"]
- [ ] [Question 2: e.g., "What's the expected data volume: 10K, 100K, 1M records?"]
- [ ] [Question 3: e.g., "Should filters persist across sessions?"]
- [ ] [Question 4: e.g., "What's the priority: Speed or Flexibility?"]

**Answers**:
- [To be filled after user responds]

---

## 3. User Stories

### Primary User Stories:
* **As a** [Project Manager], **I want to** [filter 20K records by category AND date range], **so that** [I can focus on critical equipment].
* **As a** [Admin], **I want to** [save filter presets], **so that** [I don't have to recreate complex filters daily].
* **As a** [Viewer], **I want to** [see filtered results in <100ms], **so that** [the UI feels instant].

### Edge Cases & Error States:
* **As a** [User], **I want to** [see helpful messages when no results match my filter], **so that** [I know the system is working].
* **As a** [User], **I want to** [recover gracefully if a filter query times out], **so that** [I don't lose my work].

---

## 4. Acceptance Criteria (Definition of Done)

**Feature is NOT complete until ALL criteria are met:**

- [ ] **Functional**: All user stories pass acceptance tests
- [ ] **Performance**: Meets latency budgets from UX_SPEC.md
- [ ] **Security**: Passes security tests from TEST_PLAN.md
- [ ] **Accessibility**: WCAG 2.1 AA compliant (per UX_SPEC.md)
- [ ] **AI-Ready**: Data hooks implemented per AI_OPPORTUNITIES.md
- [ ] **Documented**: TECHNICAL_DOCS.md completed

---

## 5. Decision Drivers

### Business Requirements:
- [Requirement 1: e.g., "Must support 20K+ records"]
- [Requirement 2: e.g., "Must feel 'instant' (<100ms perceived latency)"]
- [Requirement 3: e.g., "Must reduce support tickets by 30%"]

### Technical Requirements:
- [Requirement 1: e.g., "Must integrate with existing Prisma schema"]
- [Requirement 2: e.g., "Must not require database migration"]
- [Requirement 3: e.g., "Must work offline (client-side filtering)"]

---

## 6. Considered Options

### Option 1: [Client-Side Filtering with Virtualization]
**Pros**:
- No backend changes required
- Works offline
- Instant results

**Cons**:
- Doesn't scale to 100K+ records
- No server-side validation
- High memory usage

**Estimated Effort**: 3 days

---

### Option 2: [Server-Side Filtering with Query Builder]
**Pros**:
- Scales to millions of records
- Server validates input
- Lower client memory

**Cons**:
- Requires network round-trip (latency)
- Needs backend API changes
- More complex error handling

**Estimated Effort**: 5 days

---

### Option 3: [Hybrid: Client-Side with Server Fallback]
**Pros**:
- Best of both: Fast for <20K records, scalable beyond
- Graceful degradation
- Can add complex queries later

**Cons**:
- More complex implementation
- Two codepaths to maintain

**Estimated Effort**: 6 days

---

## 7. Decision Outcome

**Chosen Option**: Option 3 - Hybrid Approach

**Rationale**:
[Explain why this option was chosen. Example: "We chose Option 3 because it meets the immediate performance requirements (<100ms for 20K records) while future-proofing for larger datasets. The additional 1 day of effort is worth the flexibility."]

**Trade-offs Accepted**:
- ⚠️ Increased complexity (two codepaths)
- ⚠️ Requires thorough testing of fallback logic
- ✅ But: Best user experience across all data scales

---

## 8. Consequences

### Positive Consequences:
✅ Users get instant filtering for typical datasets
✅ System scales to future data growth
✅ No database migration required
✅ AI can leverage both client and server filtering

### Negative Consequences:
⚠️ Two filtering implementations to maintain
⚠️ More complex testing matrix
⚠️ Slightly higher initial development time

### Neutral Consequences:
🔄 Frontend and backend teams must coordinate
🔄 Documentation must explain both codepaths

---

## 9. Implementation Roadmap Summary

**See**: [ADR-{NNN}-IMPLEMENTATION_PLAN.md](./ADR-{NNN}-IMPLEMENTATION_PLAN.md) for full details.

**Estimated Duration**: 6 days
**Complexity**: Medium
**Risk**: Low (can fall back to existing behavior)

**Phases**:
1. Client-side filter logic (2 days)
2. Server-side API endpoint (2 days)
3. Hybrid orchestration layer (1 day)
4. Testing & polish (1 day)

---

## 10. Related Documentation

- **AI Opportunities**: [ADR-{NNN}-AI_OPPORTUNITIES.md](./ADR-{NNN}-AI_OPPORTUNITIES.md)
- **UX Specification**: [ADR-{NNN}-UX_SPEC.md](./ADR-{NNN}-UX_SPEC.md)
- **Test Plan**: [ADR-{NNN}-TEST_PLAN.md](./ADR-{NNN}-TEST_PLAN.md)
- **Implementation Plan**: [ADR-{NNN}-IMPLEMENTATION_PLAN.md](./ADR-{NNN}-IMPLEMENTATION_PLAN.md)
- **Agent Workflow**: [ADR-{NNN}-AGENT_WORKFLOW.md](./ADR-{NNN}-AGENT_WORKFLOW.md)
- **Development Log**: [docs/DEVELOPMENT_LOG.md](../../DEVELOPMENT_LOG.md)

---

**Status**: 🔴 Draft - Awaiting Product Review
**Decision Date**: {CURRENT_DATE}
**Review Date**: [To be scheduled]

*Document created: {CURRENT_DATE}*
*Last updated: {CURRENT_DATE}*
```

---

## 📝 Template 3: ADR-{NNN}-AI_OPPORTUNITIES.md

```markdown
# ADR-{NNN}: {FEATURE_TITLE} - AI Opportunities & Future Strategy

> **Primary Agent**: `ai-systems-architect`
> **Instruction**: Be extremely creative. How could an LLM or Agent revolutionize this specific feature in Phase 2? Focus on *innovative* capabilities, not just "AI can do what humans do."

**Status**: 🔴 Draft
**Created**: {CURRENT_DATE}
**Last Updated**: {CURRENT_DATE}

---

## 🧠 1. Innovative Use Cases (Brainstorming)

**Think beyond automation. How can AI make this feature 10x better?**

### Use Case 1: [Predictive Insights]
**Scenario**: [e.g., "Based on filtering patterns, AI predicts which equipment will exceed budget before it happens."]

**AI Capability**:
- Analyzes historical filter queries
- Identifies patterns (e.g., "Users frequently filter for 'over-budget' items in Q4")
- Proactively alerts: "Based on your patterns, you may want to review these 15 items"

**Business Value**: Prevents budget overruns, saves 10+ hours/week

---

### Use Case 2: [Agentic Actions]
**Scenario**: [e.g., "AI automatically creates filtered views when anomalies are detected."]

**AI Capability**:
- Monitors data changes in real-time
- Detects anomalies (e.g., "Forecast date shifted by >30 days on 50+ records")
- Automatically creates saved filter: "Suspicious Forecast Changes - Last 24h"
- Notifies user via toast notification

**Business Value**: Instant anomaly detection, no manual monitoring required

---

### Use Case 3: [Natural Language Queries]
**Scenario**: [e.g., "User types 'show me all red items from last week' instead of using filter UI."]

**AI Capability**:
- Parses natural language query
- Translates to filter logic (status=error, date>7 days ago)
- Executes filter and explains results: "Found 23 items with errors from Nov 19-26"

**Business Value**: 5x faster than manual filtering, accessible to non-technical users

---

### Use Case 4: [Generative Reporting]
**Scenario**: [e.g., "AI writes a summary paragraph of filtered results."]

**AI Capability**:
- User applies complex filter (category=Rental, budget>50K, status=active)
- AI generates: "You're viewing 47 active rental items with budgets exceeding $50K. The top 3 categories are..."
- User can copy summary for reports

**Business Value**: Instant executive summaries, reduces report writing time by 80%

---

## 🔌 2. Mandatory Data Hooks (Phase 1 Requirements)

**⚠️ CRITICAL: To make the AI use cases above possible in Phase 2, the Backend Architect MUST implement these data hooks NOW in Phase 1.**

### Hook 1: User Intent Logging
**Requirement**: Store the raw user query intent, not just the result.

**Implementation**:
```typescript
// ❌ DON'T just store the result
{ filteredRecords: [...] }

// ✅ DO store the intent + result
{
  userIntent: "show me rentals over $5000",
  filterApplied: { category: "Rental", minCost: 5000 },
  resultCount: 47,
  executionTime: 85ms,
  timestamp: "2025-11-26T10:30:00Z"
}
```

**Why**: Enables AI to learn filtering patterns and provide suggestions.

---

### Hook 2: Dry Run API
**Requirement**: API must support "preview mode" where AI can test filters without executing them.

**Implementation**:
```typescript
POST /api/filter?dryRun=true
Body: { filters: {...} }
Response: { estimatedResults: 47, estimatedLatency: 85ms, warnings: [] }
```

**Why**: Allows AI to safely test complex queries before running them.

---

### Hook 3: Filter Metadata
**Requirement**: Store metadata about each filter execution.

**Implementation**:
```typescript
{
  filterId: "filter-uuid",
  createdBy: "user-123",
  createdAt: "2025-11-26T10:30:00Z",
  filterName: "My Complex Filter",
  filterLogic: {...},
  executionCount: 47,  // How many times used
  avgLatency: 92ms,
  lastUsed: "2025-11-26T15:45:00Z"
}
```

**Why**: Enables AI to recommend popular filters and optimize slow ones.

---

### Hook 4: Contextual Logging
**Requirement**: Log the user's context when they create a filter.

**Implementation**:
```typescript
{
  pageUrl: "/timeline",
  selectedRecords: ["rec-1", "rec-2"],
  timeSpentOnPage: 120s,  // Indicates user was struggling
  previousAction: "bulk_edit_failed",  // Context matters!
  deviceType: "mobile"
}
```

**Why**: AI can provide context-aware suggestions (e.g., "Looks like you're on mobile - try this simpler filter").

---

## 📊 3. API Granularity Requirements

### Requirement 1: Headless Filter API
**Purpose**: Allow AI to manipulate filters without UI interaction.

**Endpoints Needed**:
```typescript
GET    /api/filters             // List all saved filters
POST   /api/filters             // Create filter
PUT    /api/filters/:id         // Update filter
DELETE /api/filters/:id         // Delete filter
POST   /api/filters/:id/execute // Execute filter (returns results)
POST   /api/filters/preview     // Preview results without saving
```

---

### Requirement 2: Filter Explanation API
**Purpose**: AI can explain a complex filter in plain English.

**Endpoint**:
```typescript
POST /api/filters/explain
Body: { filterLogic: {...} }
Response: {
  plainEnglish: "Show me rental items over $5000 that are active",
  complexity: "medium",
  estimatedLatency: 85ms
}
```

---

### Requirement 3: Filter Optimization API
**Purpose**: AI can suggest optimizations for slow filters.

**Endpoint**:
```typescript
POST /api/filters/optimize
Body: { filterLogic: {...} }
Response: {
  optimizedLogic: {...},
  speedup: "3x faster",
  explanation: "Moved date filter before category filter to reduce dataset early"
}
```

---

## 🚀 4. Implementation Priorities

### Phase 1 (Must-Have - Implement Now):
1. ✅ User intent logging
2. ✅ Filter metadata storage
3. ✅ Dry run API support
4. ✅ Headless filter endpoints

### Phase 2 (High Value - Next Quarter):
5. 📋 Natural language query parsing
6. 📋 Predictive insights engine
7. 📋 Filter explanation API
8. 📋 Anomaly detection

### Phase 3 (Future - Nice to Have):
9. 📋 Generative reporting
10. 📋 Agentic automation
11. 📋 Filter optimization suggestions

---

## 🔗 5. Integration with Existing AI System

The existing AI assistant (Gemini/OpenAI/Claude) can be augmented to:

1. **Answer Filter Questions**: "Why is this filter slow?"
2. **Suggest Filters**: "Based on your past behavior, try this filter"
3. **Generate Filters**: "Create a filter for active rentals over $5K"

**Required Changes**:
- Add `filtering` entity to AI context
- Train AI on filter schema structure
- Add SQL/filter generation capability to AI prompts

---

## 📚 Related Documentation

- **Decision**: [ADR-{NNN}-DECISION.md](./ADR-{NNN}-DECISION.md)
- **UX Specification**: [ADR-{NNN}-UX_SPEC.md](./ADR-{NNN}-UX_SPEC.md)
- **Test Plan**: [ADR-{NNN}-TEST_PLAN.md](./ADR-{NNN}-TEST_PLAN.md)
- **Implementation Plan**: [ADR-{NNN}-IMPLEMENTATION_PLAN.md](./ADR-{NNN}-IMPLEMENTATION_PLAN.md)

---

**Status**: 🔴 Draft - Awaiting AI Architect Review
**Next Action**: Backend architect must review and include data hooks in implementation plan

*Document created: {CURRENT_DATE}*
*AI Readiness Version: 1.0*
```

---

## 📝 Template 4: ADR-{NNN}-UX_SPEC.md

```markdown
# ADR-{NNN}: {FEATURE_TITLE} - UX Specification & Best Practices

> **Primary Agent**: `ux-technologist`
> **Instruction**: Ensure the design is intuitive, accessible, and feels instant. Focus on perceived performance over actual performance.

**Status**: 🔴 Draft
**Created**: {CURRENT_DATE}
**Last Updated**: {CURRENT_DATE}

---

## ⚡ 1. Perceived Performance Rules

### Rule 1: Optimistic Updates
**Principle**: Update the UI immediately on user action, revert only on error.

**Example**:
```typescript
// User clicks "Apply Filter"
IMMEDIATELY (0ms):
  ✅ Show filtered results (optimistic)
  ✅ Show subtle loading indicator
  ✅ Disable filter inputs (prevent race conditions)

AFTER SERVER (200ms):
  ✅ Replace optimistic results with real data
  ✅ Remove loading indicator
  ✅ Re-enable inputs

ON ERROR:
  ❌ Revert to previous results
  ❌ Show error toast
  ❌ Re-enable inputs
```

---

### Rule 2: Latency Budget
**Target Latency**: <100ms for all interactions

| Interaction | Target | Max Acceptable | Strategy |
|-------------|--------|----------------|----------|
| Apply filter | <50ms | 100ms | Optimistic UI |
| Save filter | <100ms | 300ms | Show "Saving..." toast |
| Load filter list | <200ms | 500ms | Skeleton screen |
| Delete filter | <50ms | 100ms | Optimistic removal |

**Enforcement**: Log slow interactions to identify bottlenecks.

---

### Rule 3: Loading Strategy
**Skeleton Screens > Spinners > Blank States**

**Filter Dropdown Loading**:
```
┌─────────────────────────┐
│ Saved Filters ▼         │
├─────────────────────────┤
│ ███████████ Loading     │
│ ███████████ Loading     │
│ ███████████ Loading     │
└─────────────────────────┘
```

**Never show**:
- ❌ Blank white screen
- ❌ Generic "Loading..." text
- ❌ Spinner that lasts >2 seconds without explanation

---

## 🎨 2. Interaction Model

### Happy Path: Apply Filter

**User Flow**:
1. User opens filter panel
2. User selects "Category = Rental"
3. User clicks "Apply"
4. Results update instantly (optimistic)
5. Success toast: "Filter applied (47 results)"

**Timing**:
- Step 1 → 2: <16ms (instant panel open)
- Step 2 → 3: <16ms (instant selection)
- Step 3 → 4: <50ms (instant results)
- Step 4 → 5: 200ms (server confirmation)

---

### Empty States

**Scenario**: Filter returns 0 results

**UI**:
```
┌───────────────────────────────────┐
│  🔍 No Results Found              │
│                                   │
│  Try adjusting your filters:      │
│  • Remove some criteria           │
│  • Change date range              │
│  • Clear all filters              │
│                                   │
│  [Clear Filters] [Help]           │
└───────────────────────────────────┘
```

**Never show**:
- ❌ Just "No results" (not helpful)
- ❌ Technical error messages
- ❌ Blank table

---

### Error States

**Scenario**: Filter query fails (network error)

**UI**:
```
┌───────────────────────────────────┐
│  ⚠️ Filter Failed                 │
│                                   │
│  The filter couldn't be applied   │
│  due to a network error.          │
│                                   │
│  [Try Again] [Use Cached Data]    │
└───────────────────────────────────┘
```

**Recovery Options**:
- Retry with exponential backoff
- Fall back to cached results (if available)
- Allow user to continue without filter

---

## ♿ 3. Accessibility & Inclusion (Best Practices)

### Keyboard Navigation
**Tab Order**:
1. Filter panel toggle button
2. Category dropdown
3. Date range start input
4. Date range end input
5. "Apply Filter" button
6. "Clear Filters" button

**Keyboard Shortcuts**:
- `Ctrl+F` (or `Cmd+F`): Open filter panel
- `Esc`: Close filter panel
- `Enter` on focused filter: Apply filter
- `Ctrl+Shift+X`: Clear all filters

---

### Screen Reader Support
**ARIA Labels Required**:
```html
<button
  aria-label="Open filter panel to filter 20,280 PFA records"
  aria-expanded="false"
  aria-controls="filter-panel"
>
  <FilterIcon aria-hidden="true" />
  Filters
</button>

<div
  id="filter-panel"
  role="dialog"
  aria-labelledby="filter-title"
  aria-describedby="filter-description"
>
  <h2 id="filter-title">Filter PFA Records</h2>
  <p id="filter-description">
    Apply filters to narrow down 20,280 records
  </p>
  <!-- Filter inputs here -->
</div>
```

**Live Regions for Results**:
```html
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  Filter applied. Showing 47 of 20,280 records.
</div>
```

---

### Mobile Considerations
**Touch Targets**: Minimum 44px × 44px

**Filter Panel on Mobile**:
- Full-screen modal (not dropdown)
- Large, tappable buttons
- Sticky "Apply" button at bottom
- Swipe down to close

**Responsive Breakpoints**:
- Mobile: 320px - 767px (full-screen panel)
- Tablet: 768px - 1023px (side panel)
- Desktop: 1024px+ (inline panel)

---

## 🎯 4. Visual Feedback Patterns

### Success Feedback
**Toast Message**:
```
┌──────────────────────────────┐
│ ✅ Filter Applied            │
│ Showing 47 of 20,280 records │
└──────────────────────────────┘
```
- Duration: 3 seconds
- Position: Top-right
- Auto-dismiss: Yes

---

### Error Feedback
**Inline Error** (preferred for validation):
```
Category: [Dropdown ▼]
          ⚠️ Please select a category
```

**Toast Error** (for system errors):
```
┌──────────────────────────────┐
│ ❌ Filter Failed             │
│ Network error. Try again.    │
│ [Retry] [Dismiss]            │
└──────────────────────────────┘
```
- Duration: 5 seconds (longer for errors)
- Dismissible: Yes
- Action button: Optional

---

### Loading Feedback
**Progress Indicators**:
- <100ms: No indicator (feels instant)
- 100-500ms: Subtle spinner
- >500ms: Skeleton screen + "Loading filters..."
- >2000ms: Warning "This is taking longer than usual"

---

## 🧪 5. UX Testing Scenarios

### Scenario 1: Fast Filter (Happy Path)
**Steps**:
1. Open filter panel
2. Select "Category = Rental"
3. Click "Apply"

**Expected**:
- ✅ Panel opens in <16ms (1 frame)
- ✅ Dropdown responds instantly
- ✅ Results update in <50ms (optimistic)
- ✅ Success toast after 200ms

---

### Scenario 2: Slow Network
**Steps**:
1. Throttle network to 3G speed
2. Apply complex filter

**Expected**:
- ⏳ Show "Filtering..." after 500ms
- ⏳ Show progress: "Filtering 20,280 records..."
- ⏳ Option to "Cancel" after 2 seconds
- ✅ Results appear even if slow

---

### Scenario 3: Empty Results
**Steps**:
1. Apply filter that returns 0 results

**Expected**:
- ℹ️ Helpful empty state with suggestions
- ℹ️ "Clear Filters" button prominent
- ℹ️ Offer to broaden search

---

## 📚 Related Documentation

- **Decision**: [ADR-{NNN}-DECISION.md](./ADR-{NNN}-DECISION.md)
- **AI Opportunities**: [ADR-{NNN}-AI_OPPORTUNITIES.md](./ADR-{NNN}-AI_OPPORTUNITIES.md)
- **Test Plan**: [ADR-{NNN}-TEST_PLAN.md](./ADR-{NNN}-TEST_PLAN.md)
- **Implementation Plan**: [ADR-{NNN}-IMPLEMENTATION_PLAN.md](./ADR-{NNN}-IMPLEMENTATION_PLAN.md)

---

**Status**: 🔴 Draft - Awaiting UX Review
**Next Action**: Frontend developer must implement optimistic UI patterns

*Document created: {CURRENT_DATE}*
*UX Spec Version: 1.0*
```

---

## 📝 Template 5: ADR-{NNN}-TEST_PLAN.md

```markdown
# ADR-{NNN}: {FEATURE_TITLE} - Test Strategy & Guardrails

> **Primary Agent**: `sdet-test-automation`
> **Instruction**: Define how we verify success BEFORE we write code. Include adversarial scenarios and security testing.

**Status**: 🔴 Draft
**Created**: {CURRENT_DATE}
**Last Updated**: {CURRENT_DATE}

---

## ✅ 1. Critical User Flows (E2E Tests)

### Flow 1: Apply Simple Filter (Happy Path)
**Description**: User applies a single-criterion filter successfully.

**Steps**:
1. Navigate to PFA grid view
2. Open filter panel
3. Select "Category = Rental"
4. Click "Apply Filter"
5. Verify results are filtered

**Assertions**:
```typescript
expect(filterPanel).toBeVisible();
expect(resultCount).toBe(47);
expect(allVisibleRecords).toMatchFilter({ category: "Rental" });
expect(filterAppliedToast).toBeVisible();
expect(responseTime).toBeLessThan(100); // ms
```

---

### Flow 2: Apply Complex Filter (AND/OR Logic)
**Description**: User applies multi-criterion filter with AND/OR logic.

**Steps**:
1. Open filter panel
2. Add filter: "Category = Rental" AND "Cost > 5000"
3. Add OR condition: "Status = Error"
4. Apply filter

**Assertions**:
```typescript
const results = getFilteredRecords();
expect(results.every(r =>
  (r.category === "Rental" && r.cost > 5000) || r.status === "Error"
)).toBe(true);
```

---

### Flow 3: Save and Load Filter
**Description**: User saves a filter preset and loads it later.

**Steps**:
1. Apply filter
2. Click "Save Filter"
3. Enter name: "My Complex Filter"
4. Navigate away
5. Return and load saved filter

**Assertions**:
```typescript
expect(savedFilters).toContain("My Complex Filter");
await loadFilter("My Complex Filter");
expect(appliedFilters).toEqual(originalFilters);
```

---

### Flow 4: Error Handling (Network Failure)
**Description**: Filter gracefully handles network errors.

**Steps**:
1. Disconnect network
2. Apply filter
3. Observe error handling

**Assertions**:
```typescript
expect(errorToast).toBeVisible();
expect(errorToast.text).toBe("Filter failed due to network error");
expect(fallbackToCachedData).toBeTrue(); // if cached data available
```

---

## 🛡️ 2. Security Red Teaming

### Attack 1: SQL Injection
**Scenario**: Attacker attempts SQL injection via filter input.

**Test**:
```typescript
const maliciousInput = "'; DROP TABLE pfa_records; --";
const response = await applyFilter({ category: maliciousInput });

expect(response.status).not.toBe(500); // No internal server error
expect(await tableExists("pfa_records")).toBe(true); // Table still exists
expect(response.data).toEqual([]); // No results for invalid input
```

---

### Attack 2: XSS via Saved Filter Names
**Scenario**: Attacker tries to inject script via filter name.

**Test**:
```typescript
const xssPayload = "<script>alert('XSS')</script>";
await saveFilter({ name: xssPayload, logic: {...} });
await loadFilterList();

const filterElement = getFilterByName(xssPayload);
expect(filterElement.innerHTML).not.toContain("<script"); // Escaped
expect(window.alertCalled).toBe(false); // Script not executed
```

---

### Attack 3: IDOR (Insecure Direct Object Reference)
**Scenario**: User A tries to access User B's saved filters.

**Test**:
```typescript
const userA = await loginAs("userA");
const userBFilterId = await createFilterAs("userB");

const response = await userA.loadFilter(userBFilterId);
expect(response.status).toBe(403); // Forbidden
expect(response.body.error).toBe("PERMISSION_DENIED");
```

---

### Attack 4: Rate Limiting Bypass
**Scenario**: Attacker tries to spam filter API.

**Test**:
```typescript
const requests = Array(100).fill(null).map(() => applyFilter({...}));
const responses = await Promise.all(requests);

const rateLimited = responses.filter(r => r.status === 429);
expect(rateLimited.length).toBeGreaterThan(0); // Some requests blocked
```

---

## ⚡ 3. Performance Benchmarks

### Benchmark 1: Filter 20K Records (Client-Side)
**Target**: <100ms

**Test**:
```typescript
const records = generate20KRecords();
const startTime = performance.now();
const filtered = applyFilterClientSide(records, { category: "Rental" });
const endTime = performance.now();

expect(endTime - startTime).toBeLessThan(100); // ms
```

---

### Benchmark 2: Complex Query (Server-Side)
**Target**: <500ms

**Test**:
```typescript
const response = await measureLatency(async () =>
  await applyFilterServerSide({
    category: "Rental",
    cost: { gte: 5000 },
    status: { in: ["Active", "Warning"] },
    dateRange: { start: "2025-01-01", end: "2025-12-31" }
  })
);

expect(response.latency).toBeLessThan(500); // ms
```

---

### Benchmark 3: Concurrent Users
**Target**: Support 50 concurrent filter requests

**Test**:
```typescript
const users = Array(50).fill(null);
const requests = users.map(() => applyFilter({ category: "Rental" }));
const responses = await Promise.all(requests);

const failures = responses.filter(r => r.status !== 200);
expect(failures.length).toBe(0); // All succeed
```

---

## 🔒 4. Data Integrity Tests

### Test 1: Filter Doesn't Mutate Source Data
**Description**: Applying filter should not modify the original dataset.

**Test**:
```typescript
const originalData = cloneDeep(pfaRecords);
await applyFilter({ category: "Rental" });
expect(pfaRecords).toEqual(originalData); // Unchanged
```

---

### Test 2: Concurrent Filters Don't Interfere
**Description**: Multiple users filtering simultaneously should get isolated results.

**Test**:
```typescript
const userA = applyFilter({ category: "Rental" });
const userB = applyFilter({ category: "Purchase" });

const [resultsA, resultsB] = await Promise.all([userA, userB]);
expect(resultsA.every(r => r.category === "Rental")).toBe(true);
expect(resultsB.every(r => r.category === "Purchase")).toBe(true);
```

---

## 📊 5. Test Coverage Requirements

### Minimum Coverage Targets

| Category | Target | Priority |
|----------|--------|----------|
| Filter Logic (utils) | 95% | P0 |
| API Endpoints | 90% | P0 |
| React Components | 70% | P1 |
| Integration Tests | 80% | P0 |

### Critical Code Paths (100% Coverage Required)

**Files that MUST have 100% coverage**:
- `backend/src/services/filterService.ts`
- `backend/src/utils/queryBuilder.ts`
- `components/FilterPanel.tsx` (logic, not JSX)

---

## 🧪 6. Test Automation Strategy

### Pre-Commit Hooks
```bash
npm run test:unit           # All unit tests
npm run test:security       # Security tests
npm run lint                # ESLint + Prettier
```

### CI Pipeline (GitHub Actions)
```yaml
on: [push, pull_request]
jobs:
  test:
    - Unit Tests
    - Integration Tests
    - Security Tests
    - Performance Benchmarks
    - Coverage Report (upload to Codecov)
```

---

## 📋 7. Test Execution Checklist

**Before Feature Launch**:
- [ ] All E2E tests passing (100%)
- [ ] All security tests passing (100%)
- [ ] Performance benchmarks met (100%)
- [ ] Code coverage >90% (backend), >70% (frontend)
- [ ] Manual QA testing complete
- [ ] Security audit by `ai-security-red-teamer` agent
- [ ] Load testing at 2x expected traffic
- [ ] Rollback plan tested

---

## 📚 Related Documentation

- **Decision**: [ADR-{NNN}-DECISION.md](./ADR-{NNN}-DECISION.md)
- **AI Opportunities**: [ADR-{NNN}-AI_OPPORTUNITIES.md](./ADR-{NNN}-AI_OPPORTUNITIES.md)
- **UX Specification**: [ADR-{NNN}-UX_SPEC.md](./ADR-{NNN}-UX_SPEC.md)
- **Implementation Plan**: [ADR-{NNN}-IMPLEMENTATION_PLAN.md](./ADR-{NNN}-IMPLEMENTATION_PLAN.md)

---

**Status**: 🔴 Draft - Awaiting QA Review
**Next Action**: Implement test suites before starting development

*Document created: {CURRENT_DATE}*
*Test Plan Version: 1.0*
```

---

## 📝 Template 6: ADR-{NNN}-IMPLEMENTATION_PLAN.md

```markdown
# ADR-{NNN}: {FEATURE_TITLE} - Technical Implementation Plan

> **Primary Agents**: `backend-architecture-optimizer`, `postgres-jsonb-architect`, `react-ai-ux-specialist`
> **Instruction**: Define the technical build for the **Standard Feature**. Include the *foundations* (data hooks) requested in `AI_OPPORTUNITIES.md`, but do NOT implement the AI features themselves yet.

**Status**: 🔴 Draft
**Created**: {CURRENT_DATE}
**Dependencies**: [List external dependencies]

---

## 📋 1. Overview

### Goals
[What are we trying to achieve technically?]

### Success Criteria
- [ ] All user stories from DECISION.md implemented
- [ ] Performance targets from UX_SPEC.md met
- [ ] Security tests from TEST_PLAN.md passing
- [ ] AI data hooks from AI_OPPORTUNITIES.md implemented

### Key Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Response Time | <100ms | Chrome DevTools |
| Test Coverage | >90% | Jest/Vitest |
| Bundle Size Impact | <50KB | Webpack Bundle Analyzer |

---

## 🗄️ 2. Database Schema (PostgreSQL/JSONB)

### New Tables (if applicable)
```sql
CREATE TABLE saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  filter_logic JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  execution_count INT DEFAULT 0,  -- AI Hook: Track usage
  avg_latency_ms INT,              -- AI Hook: Track performance
  last_used_at TIMESTAMP           -- AI Hook: Track recency
);

-- Indexes for performance
CREATE INDEX idx_saved_filters_user ON saved_filters(user_id);
CREATE INDEX idx_saved_filters_org ON saved_filters(organization_id);
CREATE GIN INDEX idx_saved_filters_logic ON saved_filters USING GIN (filter_logic); -- JSONB search
```

### Schema Updates (if modifying existing tables)
```sql
-- Add filter metadata to existing table
ALTER TABLE pfa_records ADD COLUMN filterable_metadata JSONB;

-- AI Hook: Store user intent
CREATE TABLE filter_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_intent TEXT,          -- AI Hook: Natural language query
  filter_applied JSONB,      -- The actual filter used
  result_count INT,
  execution_time_ms INT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔌 3. API Architecture (Backend)

### New Endpoints

#### POST /api/filters
**Purpose**: Create a new saved filter

**Request**:
```typescript
{
  name: string;
  filterLogic: FilterCriteria;
}
```

**Response**:
```typescript
{
  id: string;
  name: string;
  filterLogic: FilterCriteria;
  createdAt: string;
}
```

**AI Hooks Implemented**:
- ✅ Stores user_intent if provided
- ✅ Initializes execution_count to 0

---

#### POST /api/filters/apply
**Purpose**: Apply filter to dataset (with dry-run support)

**Request**:
```typescript
{
  filterLogic: FilterCriteria;
  dryRun?: boolean;  // AI Hook: Allows AI to preview results
  userIntent?: string;  // AI Hook: Natural language query
}
```

**Response**:
```typescript
{
  results: PfaRecord[];
  count: number;
  latency: number;  // AI Hook: Performance tracking
  warnings?: string[];  // AI Hook: Optimization suggestions
}
```

---

#### GET /api/filters
**Purpose**: List user's saved filters

**Response**:
```typescript
{
  filters: SavedFilter[];
  // AI Hook: Sorted by execution_count (popular first)
}
```

---

### Caching Strategy
- Use React Query for client-side caching
- TTL: 5 minutes for filter list
- Invalidate on: Create, Update, Delete
- Server-side: Redis cache for frequently used filters (>10 executions)

---

## 🎨 4. Frontend Architecture (React)

### Component Tree
```
<FilterPanel>
  ├─ <FilterHeader>
  │    ├─ Title
  │    └─ Close Button
  ├─ <FilterBuilder>
  │    ├─ <FilterRow> (repeatable)
  │    │    ├─ Field Selector
  │    │    ├─ Operator Selector
  │    │    └─ Value Input
  │    └─ Add Filter Button
  ├─ <SavedFiltersList>
  │    └─ <SavedFilterItem> (repeatable)
  └─ <FilterActions>
       ├─ Apply Button
       ├─ Clear Button
       └─ Save Button
```

### State Management
**Tool**: React Query + Zustand

**Why**: React Query for server state, Zustand for UI state (panel open/closed)

**State Shape**:
```typescript
// Server State (React Query)
const { data: savedFilters } = useQuery(['filters', userId]);

// UI State (Zustand)
interface FilterStore {
  isPanelOpen: boolean;
  activeFilters: FilterCriteria[];
  tempFilters: FilterCriteria[];  // During edit
  setFilter: (filter: FilterCriteria) => void;
  applyFilters: () => void;
}
```

---

### Data Fetching Strategy
**React Query Keys**:
```typescript
['filters', userId]                    // List of saved filters
['filter-results', filterLogic]        // Applied filter results
['filter-preview', filterLogic]        // Dry-run preview (AI Hook)
```

**Invalidation**:
- On filter save: Invalidate `['filters', userId]`
- On filter apply: Invalidate `['filter-results']`
- On data change (PFA update): Invalidate all filter results

---

## 📦 5. Dependencies

### Backend
- `express` (existing) - API server
- `prisma` (existing) - Database ORM
- `zod` (new) - Input validation

### Frontend
- `react-query` (existing) - Server state
- `zustand` (new) - UI state
- `date-fns` (existing) - Date filtering

**Bundle Size Impact**: ~30KB (acceptable per Key Metrics)

---

## 🚀 6. Implementation Phases

### Phase 1: Backend API (2 days)
**Agent**: `backend-architecture-optimizer`

**Deliverables**:
- [ ] Database migrations
- [ ] API endpoints
- [ ] Input validation (Zod schemas)
- [ ] Unit tests (>90% coverage)

**Verification**:
- [ ] All endpoints return 200 for valid input
- [ ] Security tests pass (SQL injection, XSS)

---

### Phase 2: Frontend Components (2 days)
**Agent**: `react-ai-ux-specialist`

**Deliverables**:
- [ ] FilterPanel component
- [ ] Optimistic UI for apply/save
- [ ] React Query integration
- [ ] Component tests (>70% coverage)

**Verification**:
- [ ] Filter applies in <100ms (optimistic)
- [ ] UX matches UX_SPEC.md

---

### Phase 3: Integration & Polish (1 day)
**Agent**: `react-ai-ux-specialist`

**Deliverables**:
- [ ] Connect frontend to backend
- [ ] Error handling
- [ ] Loading states
- [ ] Accessibility audit (WCAG 2.1 AA)

**Verification**:
- [ ] E2E tests passing
- [ ] No console errors
- [ ] Keyboard navigation works

---

### Phase 4: Testing & Documentation (1 day)
**Agents**: `sdet-test-automation` + `documentation-synthesizer`

**Deliverables**:
- [ ] Test suites per TEST_PLAN.md
- [ ] Performance benchmarks
- [ ] TECHNICAL_DOCS.md completed

**Verification**:
- [ ] All tests passing
- [ ] Coverage targets met
- [ ] Docs accurate

---

## 🔄 7. Rollback Plan

**If Critical Issues**:
```bash
# Revert database migration
npx prisma migrate resolve --rolled-back 20251126_add_saved_filters

# Revert frontend changes
git revert <commit-hash>

# Deploy previous version
npm run deploy:rollback
```

**Data Preservation**:
- Saved filters stored in database (not lost on rollback)
- User's active filters stored in localStorage (temporary)

---

## 📚 Related Documentation

- **Decision**: [ADR-{NNN}-DECISION.md](./ADR-{NNN}-DECISION.md)
- **AI Opportunities**: [ADR-{NNN}-AI_OPPORTUNITIES.md](./ADR-{NNN}-AI_OPPORTUNITIES.md)
- **UX Specification**: [ADR-{NNN}-UX_SPEC.md](./ADR-{NNN}-UX_SPEC.md)
- **Test Plan**: [ADR-{NNN}-TEST_PLAN.md](./ADR-{NNN}-TEST_PLAN.md)
- **Agent Workflow**: [ADR-{NNN}-AGENT_WORKFLOW.md](./ADR-{NNN}-AGENT_WORKFLOW.md)

---

**Status**: 🔴 Draft - Awaiting Architecture Review
**Next Step**: Review with backend and frontend architects

*Document created: {CURRENT_DATE}*
*Last updated: {CURRENT_DATE}*
```

---

## 📝 Template 7: ADR-{NNN}-AGENT_WORKFLOW.md

```markdown
# ADR-{NNN}: {FEATURE_TITLE} - Agent Workflow & Schedule

**Status**: ⏳ Pending Architecture Definition
**Orchestration Command**: (To be run by orchestrator agent)

---

## 🛑 Waiting for Architecture

**This file is a placeholder.**

The `orchestrator` agent cannot generate the work schedule until the planning documents in this folder are complete.

---

## ✅ Prerequisites for Orchestration

Before the orchestrator can generate this workflow, the following documents must be completed:

- [ ] **ADR-{NNN}-DECISION.md** - Requirements defined, user stories written
- [ ] **ADR-{NNN}-AI_OPPORTUNITIES.md** - Data hooks identified
- [ ] **ADR-{NNN}-UX_SPEC.md** - UX design finalized
- [ ] **ADR-{NNN}-TEST_PLAN.md** - Test strategy defined
- [ ] **ADR-{NNN}-IMPLEMENTATION_PLAN.md** - Technical plan complete

---

## 🚀 Next Steps for the Human Architect

1. **Fill out DECISION.md** with detailed requirements
   - Invoke `product-requirements-analyst` if requirements are ambiguous
   - Get stakeholder sign-off on user stories

2. **Fill out AI_OPPORTUNITIES.md** with creative AI ideas
   - Invoke `ai-systems-architect` for brainstorming
   - Identify mandatory data hooks for backend

3. **Fill out UX_SPEC.md** with interaction design
   - Invoke `ux-technologist` for perceived performance rules
   - Define latency budgets and optimistic UI patterns

4. **Fill out TEST_PLAN.md** with security testing
   - Invoke `sdet-test-automation` for critical flows
   - Include adversarial scenarios (SQL injection, XSS, etc.)

5. **Fill out IMPLEMENTATION_PLAN.md** with technical details
   - Invoke `backend-architecture-optimizer` for API design
   - Invoke `postgres-jsonb-architect` for database schema
   - Invoke `react-ai-ux-specialist` for frontend architecture

6. **Run Orchestration**:
   Once all 5 planning documents are complete, invoke the orchestrator:
   ```
   /orchestrate-adr {NNN}
   ```
   The orchestrator will:
   - Analyze dependencies between phases
   - Identify parallel execution opportunities
   - Generate this AGENT_WORKFLOW.md file with Task() commands
   - Optimize timeline for fastest completion

---

## 📋 Placeholder Workflow (Example)

Once orchestration is complete, this file will contain a detailed workflow like:

### Phase 1: Database Schema (1 day)
**Agent**: `postgres-jsonb-architect`
**Command**:
```
Task(
  subagent_type: "postgres-jsonb-architect",
  description: "Create saved filters schema",
  model: "sonnet",
  prompt: "See ADR-{NNN}-IMPLEMENTATION_PLAN.md Section 2 for schema details"
)
```

### Phase 2 & 3: Backend + Frontend (Parallel - 2 days)
**Agent 1**: `backend-architecture-optimizer`
**Agent 2**: `react-ai-ux-specialist`

[Detailed task commands would be here]

---

**Status**: ⏳ Awaiting Planning Documents
**Next Action**: Complete DECISION.md, AI_OPPORTUNITIES.md, UX_SPEC.md, TEST_PLAN.md, IMPLEMENTATION_PLAN.md

*Document template created: {CURRENT_DATE}*
```
---
## 📝 Template 8: ADR-{NNN}-TECHNICAL_DOCS.md

```markdown
# ADR-{NNN}: {FEATURE_TITLE} - Technical Documentation

> **Primary Agent**: `documentation-synthesizer`
> **Status**: ⏳ Placeholder
> **Purpose**: To be populated AFTER Phase 4 is complete.

## 1. System Architecture
[To be filled after build]

## 2. Key Decisions & Deviations
[Did we diverge from the original plan? Why?]

## 3. Maintenance Guide
[How to troubleshoot this feature]

```
---

## 🔧 Execution Instructions

### Placeholders to Replace:

| Placeholder | Replacement | Example |
|-------------|-------------|---------|
| `{NNN}` | ADR number | `006` |
| `{FEATURE_TITLE}` | Feature title | `Smart Grid Filtering` |
| `{PROBLEM_DESCRIPTION}` | Problem statement | `Users need to filter 20K+ records...` |
| `{CURRENT_DATE}` | Today's date | `2025-11-26` |
| `{folder-name}` | Kebab-case title | `smart-grid-filtering` |

### File Creation Steps:

1. Create folder: `docs/adrs/ADR-{NNN}-{folder-name}/`
2. Create all 7 files using templates above
3. Replace all placeholders with actual values
4. Update `docs/adrs/README.md` with new ADR entry
5. Show confirmation output to user

---

**Command Version**: 2.0 (7-Document Blueprint Container)
**Last Updated**: 2025-11-26
