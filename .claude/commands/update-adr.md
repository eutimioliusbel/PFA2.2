# UPDATE-ADR: Manage Scope Change & Missed Functionality

**Command**: `/update-adr NNN "Change Title" "Description of New Functionality"`

**Description**: Invokes the **Change Management Orchestrator**. It analyzes the requested change against the existing "Blueprint Container" (DECISION, AI_OPPORTUNITIES, UX_SPEC, TEST_PLAN, IMPLEMENTATION_PLAN), identifies which documents are impacted, and generates specific **Update Prompts** for the specialist agents to surgically modify the plans.

**Purpose**: Prevents scope creep and "hacking in" features. Ensures all changes are properly specified before implementation.

**Usage Example**: `/update-adr 006 "Add CSV Export" "Users need to export the filtered grid to CSV. Must handle 20k rows without crashing browser."`

---

## 🤖 Instructions for Claude

### Step 1: 🔍 Impact Analysis (Context Ingestion)

**Your Task**: Understand the current state and analyze the change impact.

1. **Locate Target Folder**: `docs/adrs/ADR-{NNN}-*/`

2. **Read Current Blueprint Documents**:
   - `ADR-{NNN}-DECISION.md` - Current requirements and acceptance criteria
   - `ADR-{NNN}-AI_OPPORTUNITIES.md` - Current AI data hooks and use cases
   - `ADR-{NNN}-UX_SPEC.md` - Current UX rules and latency budgets
   - `ADR-{NNN}-TEST_PLAN.md` - Current security tests and critical flows
   - `ADR-{NNN}-IMPLEMENTATION_PLAN.md` - Current technical architecture

3. **Analyze the Change**: Compare the "Description of New Functionality" against current docs.

   **Questions to Ask**:
   - Does it change the User Stories? → Impacts `DECISION.md`
   - Does it need new API endpoints? → Impacts `IMPLEMENTATION_PLAN.md`
   - Does it have UI states/interactions? → Impacts `UX_SPEC.md`
   - Does it need new security tests? → Impacts `TEST_PLAN.md`
   - Does it create new AI data opportunities? → Impacts `AI_OPPORTUNITIES.md`

4. **Classify Impact Level**:
   - **HIGH**: Changes core business logic, requires multi-phase implementation
   - **MEDIUM**: Adds new functionality but doesn't change existing flows
   - **LOW**: UI polish, minor enhancements, no architectural changes

---

### Step 2: 🧠 Change Manager Invocation

**System Instruction**: Act as the **`orchestrator`** agent in **Change Management Mode**.

**Your Mission**: Generate a **"Remediation Plan"** (`ADR-{NNN}-UPDATE_PLAN.md`).

**Critical Constraint**:
- ❌ Do NOT simply rewrite the files yourself
- ✅ DO generate **Specific Prompt Bundles** for the specialist agents
- ✅ This ensures the *Backend Architect* designs the CSV stream, not a generic LLM

**Why This Matters**: Specialist agents bring domain expertise. The `backend-architecture-optimizer` knows how to handle streaming 20K rows efficiently. The `ux-technologist` knows how to make exports feel instant with progress indicators.

---

### Step 3: 📝 Generate the Update Plan

Using the template below, create a file: `docs/adrs/ADR-{NNN}-*/ADR-{NNN}-UPDATE_PLAN.md`

**Placeholder Rules**:
1. Replace all `{PLACEHOLDERS}` with specific content from your analysis
2. Include ONLY the sections for affected documents (skip sections if document is not impacted)
3. Extract specific quotes from existing documents to show where changes should be inserted
4. Include file paths and line numbers where possible

---

### Step 4: 💾 Output Handling

1. **Create File**: `docs/adrs/ADR-{NNN}-*/ADR-{NNN}-UPDATE_PLAN.md`
2. **Update README**: Update the ADR folder's `README.md` to note "Scope Change Pending"

---

### Step 5: ✅ Confirmation Output

Display to the user:

```
⚠️ **Scope Change Detected for ADR-{NNN}**

📋 **Update Plan Generated**: docs/adrs/ADR-{NNN}-{title}/ADR-{NNN}-UPDATE_PLAN.md

📊 **Impact Analysis**:
- Impact Level: {HIGH/MEDIUM/LOW}
- Affected Documents: {COUNT}
  - {DOCUMENT_1}: {REASON}
  - {DOCUMENT_2}: {REASON}

🔧 **Change Summary**:
- New User Stories: {COUNT}
- New API Endpoints: {COUNT}
- New UI Components: {COUNT}
- New Security Tests: {COUNT}
- New AI Hooks: {COUNT}

🚀 **Next Steps**:
1. Open the Update Plan: docs/adrs/ADR-{NNN}-{title}/ADR-{NNN}-UPDATE_PLAN.md
2. Execute each prompt bundle in order (they're numbered)
3. **CRITICAL**: Re-run `/execute-adr {NNN}` to regenerate the implementation workflow
4. The new workflow will include tasks for building this new functionality

⚠️ **Important Reminders**:
- DO NOT skip the blueprint updates and jump to code
- DO execute prompt bundles with the appropriate specialist agents
- DO re-run `/execute-adr` after all updates are complete
- The workflow will be out of sync until you re-orchestrate
```

---

## 📄 Template: ADR-{NNN}-UPDATE_PLAN.md

This file guides the user through patching their documentation.

````markdown
# ADR-{NNN}: Scope Change Remediation Plan

**Change Request**: "{CHANGE_TITLE}"
**Change Description**: "{CHANGE_DESCRIPTION}"
**Impact Analysis**: {HIGH/MEDIUM/LOW}
**Affected Documents**: {COUNT} of 5 blueprint documents
**Date Created**: {TIMESTAMP}

---

## 🛑 Critical Instruction

**DO NOT SKIP TO CODE IMPLEMENTATION**

You must update the Blueprint documents **BEFORE** you build the code.
This ensures:
- ✅ All stakeholders understand the new scope
- ✅ UX is designed before implementation
- ✅ Security is considered upfront
- ✅ AI data hooks are included from day one

Execute the Prompt Bundles below in order. Each bundle targets a specific specialist agent.

---

## 📊 Impact Summary

| Document | Impact Level | Changes Required |
|----------|-------------|------------------|
| DECISION.md | {HIGH/MEDIUM/LOW/NONE} | {BRIEF_DESCRIPTION} |
| AI_OPPORTUNITIES.md | {HIGH/MEDIUM/LOW/NONE} | {BRIEF_DESCRIPTION} |
| UX_SPEC.md | {HIGH/MEDIUM/LOW/NONE} | {BRIEF_DESCRIPTION} |
| TEST_PLAN.md | {HIGH/MEDIUM/LOW/NONE} | {BRIEF_DESCRIPTION} |
| IMPLEMENTATION_PLAN.md | {HIGH/MEDIUM/LOW/NONE} | {BRIEF_DESCRIPTION} |

**Total Estimated Time**: {HOURS} hours

---

## 🔄 Update Workflow

Follow these steps in order:

1. ✅ Execute Step 1 (DECISION.md update)
2. ✅ Execute Step 2 (AI_OPPORTUNITIES.md update) [if applicable]
3. ✅ Execute Step 3 (UX_SPEC.md update) [if applicable]
4. ✅ Execute Step 4 (TEST_PLAN.md update) [if applicable]
5. ✅ Execute Step 5 (IMPLEMENTATION_PLAN.md update)
6. ✅ Re-orchestrate: `/execute-adr {NNN}`

---

## Step 1: Update Requirements & Business Logic

**Target**: `ADR-{NNN}-DECISION.md`
**Agent**: `product-requirements-analyst`
**Reason**: {EXPLAIN_WHY_THIS_DOC_NEEDS_UPDATE}

**Current State** (from DECISION.md):
```
{EXTRACT_RELEVANT_SECTION_FROM_CURRENT_DECISION_MD}
```

**Required Changes**:
- Add new user story for "{CHANGE_TITLE}"
- Define acceptance criteria for {SPECIFIC_REQUIREMENT}
- {ADDITIONAL_CHANGE_1}
- {ADDITIONAL_CHANGE_2}

---

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@product-requirements-analyst

**SYSTEM CONTEXT**:
You are updating ADR-{NNN} to include new functionality: "{CHANGE_TITLE}".
This is a scope change to an existing architectural decision.

**CURRENT STATE** (Read for context):
File: `docs/adrs/ADR-{NNN}-{title}/ADR-{NNN}-DECISION.md`

Current User Stories:
{EXTRACT_CURRENT_USER_STORIES}

Current Acceptance Criteria:
{EXTRACT_CURRENT_ACCEPTANCE_CRITERIA}

**NEW REQUIREMENT**:
{CHANGE_DESCRIPTION}

**YOUR MISSION**:

**Step 1: Analyze the Change**
Review the new requirement. Does it:
- [ ] Contradict any existing user stories?
- [ ] Require new acceptance criteria?
- [ ] Change the success metrics?

If YES to any, explicitly note what needs to be overridden.

**Step 2: Write New User Stories**
Following the format in the existing DECISION.md:

**User Story {NEXT_NUMBER}**: {TITLE}
- **As a**: {USER_ROLE}
- **I want to**: {ACTION}
- **So that**: {BENEFIT}

**Acceptance Criteria**:
- [ ] {SPECIFIC_TESTABLE_CRITERION_1}
- [ ] {SPECIFIC_TESTABLE_CRITERION_2}
- [ ] {SPECIFIC_TESTABLE_CRITERION_3}

**Step 3: Update Success Metrics** (if applicable)
If this feature changes how we measure success, add/modify metrics.

**DELIVERABLES**:
1. Complete Markdown section for the new user story
2. Updated acceptance criteria list
3. Note any contradictions with existing requirements
4. Recommend where in DECISION.md to insert this content

**CONSTRAINT**:
Do NOT implement code. Only define WHAT we're building and WHY.
```

**Status**: ⬜ Not Started

**How to Execute**:
1. Copy the prompt bundle above
2. Paste into a new chat message
3. Wait for product-requirements-analyst output
4. Apply the recommended changes to ADR-{NNN}-DECISION.md
5. Commit the changes to git
6. Mark this step as ✅ Complete

---

## Step 2: Update AI Opportunities (If Applicable)

**Target**: `ADR-{NNN}-AI_OPPORTUNITIES.md`
**Agent**: `ai-systems-architect`
**Condition**: {IF_AI_DATA_HOOKS_NEEDED}

**Current State** (from AI_OPPORTUNITIES.md):
```
{EXTRACT_RELEVANT_SECTION_FROM_CURRENT_AI_OPPORTUNITIES_MD}
```

**Required Changes**:
- {SPECIFIC_AI_HOOK_NEEDED}
- {SPECIFIC_DATA_TO_CAPTURE}

---

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@ai-systems-architect

**SYSTEM CONTEXT**:
You are analyzing the AI implications of new functionality: "{CHANGE_TITLE}".

**CURRENT AI HOOKS** (Read for context):
File: `docs/adrs/ADR-{NNN}-{title}/ADR-{NNN}-AI_OPPORTUNITIES.md`

{EXTRACT_CURRENT_MANDATORY_HOOKS}

**NEW FUNCTIONALITY**:
{CHANGE_DESCRIPTION}

**YOUR MISSION**:

**Step 1: Identify New Data Hooks**
What data should we capture NOW (even if AI features come later)?

Examples:
- If adding CSV Export → Log: (userId, exportedColumns, rowCount, filters, timestamp)
- If adding Bulk Delete → Log: (userId, deletedRecordIds, reason, timestamp)

**Step 2: Design the Hook Structure**
For each hook, define:
```typescript
// Hook Name: {HOOK_NAME}
interface {HookName}Event {
  userId: string;
  timestamp: Date;
  // ... specific fields
}
```

**Step 3: Future Use Cases**
Brainstorm 2-3 AI use cases this data enables:
- Example: "Predict which columns users export most often to pre-select them"
- Example: "Detect anomalous bulk delete patterns to prevent accidents"

**Step 4: API Requirements**
Does this feature need:
- [ ] Dry-run API? (Preview export before downloading)
- [ ] Metadata tracking? (Track export frequency per user)

**DELIVERABLES**:
1. New "Mandatory Data Hooks" section for AI_OPPORTUNITIES.md
2. TypeScript interface definitions for data capture
3. 2-3 future AI use cases this data enables
4. API requirements for AI features

**CONSTRAINT**:
Think creatively. Even if AI features are "Phase 3," the data hooks must be built NOW.
```

**Status**: ⬜ Not Started

**Note**: If this new functionality doesn't have AI implications, skip this step.

---

## Step 3: Update UX & Interaction Model (If Applicable)

**Target**: `ADR-{NNN}-UX_SPEC.md`
**Agent**: `ux-technologist`
**Condition**: {IF_UI_AFFECTED}

**Current State** (from UX_SPEC.md):
```
{EXTRACT_RELEVANT_SECTION_FROM_CURRENT_UX_SPEC_MD}
```

**Required Changes**:
- Define perceived performance for {NEW_INTERACTION}
- Define loading states for {NEW_ACTION}
- Define error handling for {FAILURE_SCENARIO}

---

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@ux-technologist

**SYSTEM CONTEXT**:
You are defining the UX specification for new functionality: "{CHANGE_TITLE}".

**CURRENT UX RULES** (Read for context):
File: `docs/adrs/ADR-{NNN}-{title}/ADR-{NNN}-UX_SPEC.md`

{EXTRACT_CURRENT_LATENCY_BUDGETS_AND_OPTIMISTIC_UI_RULES}

**NEW FUNCTIONALITY**:
{CHANGE_DESCRIPTION}

**YOUR MISSION**:

**Step 1: Define Perceived Performance**

What should the user FEEL when using this feature?

For "{CHANGE_TITLE}":
- **Latency Budget**: {INTERACTION} should complete in <{TARGET}ms
- **Optimistic Update**: Should UI update immediately? Or wait for server?
- **Progressive Enhancement**: Can we show partial results as they load?

**Step 2: Define Loading States**

What does the user see while waiting?

- **Instant (<100ms)**: No loading indicator needed
- **Fast (100-500ms)**: Subtle spinner
- **Moderate (500-2000ms)**: Skeleton screen
- **Slow (>2000ms)**: Progress bar with "Cancel" option

For "{CHANGE_TITLE}":
{SPECIFY_WHICH_PATTERN_TO_USE}

**Step 3: Define Error States**

What happens if it fails?

For "{CHANGE_TITLE}":
- **Network Error**: {ERROR_MESSAGE_TO_SHOW}
- **Validation Error**: {ERROR_MESSAGE_TO_SHOW}
- **Permission Error**: {ERROR_MESSAGE_TO_SHOW}

**Step 4: Define Accessibility**

For "{CHANGE_TITLE}":
- [ ] Keyboard shortcut needed? (e.g., Ctrl+Shift+E for Export)
- [ ] Screen reader announcement? (e.g., "Export started. File will download.")
- [ ] Focus management? (Where does focus go after action?)

**DELIVERABLES**:
1. Perceived Performance rules section for UX_SPEC.md
2. Loading state specifications
3. Error handling specifications
4. Accessibility requirements

**CONSTRAINT**:
Focus on how it FEELS, not how it's built. Let the engineers figure out the implementation.
```

**Status**: ⬜ Not Started

**Note**: If this new functionality is backend-only (no UI), skip this step.

---

## Step 4: Update Security & Testing Guardrails

**Target**: `ADR-{NNN}-TEST_PLAN.md`
**Agent**: `sdet-test-automation`
**Always Required**: YES (every change needs testing)

**Current State** (from TEST_PLAN.md):
```
{EXTRACT_RELEVANT_SECTION_FROM_CURRENT_TEST_PLAN_MD}
```

**Required Changes**:
- Add red team scenarios for {NEW_ATTACK_SURFACE}
- Add critical user flow for {NEW_FUNCTIONALITY}
- Define performance thresholds for {NEW_OPERATION}

---

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@sdet-test-automation

**SYSTEM CONTEXT**:
You are defining the testing strategy for new functionality: "{CHANGE_TITLE}".

**CURRENT TEST PLAN** (Read for context):
File: `docs/adrs/ADR-{NNN}-{title}/ADR-{NNN}-TEST_PLAN.md`

{EXTRACT_CURRENT_ADVERSARIAL_TESTS_AND_CRITICAL_FLOWS}

**NEW FUNCTIONALITY**:
{CHANGE_DESCRIPTION}

**YOUR MISSION**:

**Step 1: Security Red Team Scenarios**

What new attack surfaces does this create?

For "{CHANGE_TITLE}":
- [ ] Can I export data I don't have permission to see?
- [ ] Can I inject malicious data into the export?
- [ ] Can I cause a Denial of Service with a massive export?
- [ ] Can I bypass rate limiting?

Write specific attack scenarios with expected defenses.

**Step 2: Critical User Flow Tests**

Define the end-to-end happy path:

**Flow: {CHANGE_TITLE}**
1. User navigates to {LOCATION}
2. User clicks {ACTION}
3. System performs {OPERATION}
4. User sees {RESULT}

**Acceptance**:
- [ ] {TESTABLE_CRITERION_1}
- [ ] {TESTABLE_CRITERION_2}

**Step 3: Performance Thresholds**

For "{CHANGE_TITLE}":
- Target latency: <{TARGET}ms
- Max concurrent operations: {COUNT}
- Resource constraints: {MEMORY_LIMIT}, {CPU_LIMIT}

**Step 4: Edge Cases**

What breaks this feature?
- [ ] Empty dataset (0 records)
- [ ] Massive dataset ({MAX} records)
- [ ] Concurrent requests (multiple users exporting simultaneously)
- [ ] Network failure mid-operation
- [ ] Corrupt data in database

**DELIVERABLES**:
1. Security red team scenarios section for TEST_PLAN.md
2. Critical user flow test case
3. Performance threshold specifications
4. Edge case test scenarios

**CONSTRAINT**:
Think adversarially. Your job is to BREAK this feature before users do.
```

**Status**: ⬜ Not Started

**How to Execute**:
1. Copy the prompt bundle above
2. Paste into a new chat message
3. Wait for sdet-test-automation output
4. Apply the recommended changes to ADR-{NNN}-TEST_PLAN.md
5. Commit the changes to git
6. Mark this step as ✅ Complete

---

## Step 5: Update Technical Implementation Plan

**Target**: `ADR-{NNN}-IMPLEMENTATION_PLAN.md`
**Agent**: `backend-architecture-optimizer` (and/or `react-ai-ux-specialist`)
**Always Required**: YES (every change needs technical design)

**Current State** (from IMPLEMENTATION_PLAN.md):
```
{EXTRACT_RELEVANT_SECTIONS_FROM_CURRENT_IMPLEMENTATION_PLAN}
```

**Required Changes**:
- {DESCRIBE_BACKEND_CHANGES_NEEDED}
- {DESCRIBE_FRONTEND_CHANGES_NEEDED}
- {DESCRIBE_DATABASE_CHANGES_NEEDED}

---

### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@backend-architecture-optimizer

**SYSTEM CONTEXT**:
You are designing the technical implementation for: "{CHANGE_TITLE}".

**CURRENT ARCHITECTURE** (Read for context):
File: `docs/adrs/ADR-{NNN}-{title}/ADR-{NNN}-IMPLEMENTATION_PLAN.md`

{EXTRACT_CURRENT_API_ENDPOINTS_AND_DATABASE_SCHEMA}

**NEW FUNCTIONALITY**:
{CHANGE_DESCRIPTION}

**PERFORMANCE CONSTRAINT**: {EXTRACT_FROM_CHANGE_DESCRIPTION}

**YOUR MISSION**:

**Step 1: API Design**

Does this require new endpoints or modifications to existing ones?

For "{CHANGE_TITLE}":
- [ ] New endpoint needed? (e.g., `GET /api/export/csv`)
- [ ] Modify existing endpoint? (e.g., add `?format=csv` query param)
- [ ] New request/response schemas?

Design:
```typescript
// API Endpoint: {METHOD} {PATH}
interface {RequestName} {
  // ... fields
}

interface {ResponseName} {
  // ... fields
}
```

**Step 2: Database Changes**

Does this require schema changes or new tables?

For "{CHANGE_TITLE}":
- [ ] New table needed? (e.g., `export_jobs`)
- [ ] New columns needed? (e.g., `last_exported_at`)
- [ ] New indexes needed? (for query performance)

**Step 3: AI Hooks Integration**

Read `ADR-{NNN}-AI_OPPORTUNITIES.md` for mandatory data hooks.

For "{CHANGE_TITLE}":
- [ ] Where in the code do we capture the AI data?
- [ ] What function/middleware handles logging?

Example:
```typescript
async function exportToCsv(req, res) {
  // REQUIRED: Log export event for AI
  await logAiEvent({
    userId: req.user.id,
    action: 'csv_export',
    metadata: { rowCount, columns, filters }
  });

  // Business logic here...
}
```

**Step 4: Performance Considerations**

For "{CHANGE_TITLE}":
- [ ] Streaming needed? (to avoid loading all 20K rows in memory)
- [ ] Caching strategy? (cache export result for 5 minutes)
- [ ] Rate limiting? (max 10 exports per user per hour)

**Step 5: Error Handling**

What can go wrong?
- [ ] Database query timeout
- [ ] Out of memory (too many rows)
- [ ] Network interruption mid-stream
- [ ] Invalid data format

For each error, define:
- HTTP status code to return
- Error message for user
- Logging/monitoring strategy

**DELIVERABLES**:
1. API endpoint specifications (request/response schemas)
2. Database schema changes (DDL or Prisma schema)
3. AI hook integration points (where to log events)
4. Performance optimization strategy
5. Error handling specifications

**CONSTRAINT**:
Focus on BACKEND architecture. If frontend changes are needed, note them but don't design them (that's for @react-ai-ux-specialist).
```

**Status**: ⬜ Not Started

**How to Execute**:
1. Copy the prompt bundle above
2. Paste into a new chat message
3. Wait for backend-architecture-optimizer output
4. If frontend changes are needed, also execute @react-ai-ux-specialist with similar prompt
5. Apply the recommended changes to ADR-{NNN}-IMPLEMENTATION_PLAN.md
6. Commit the changes to git
7. Mark this step as ✅ Complete

---

## 🔄 Step 6: Re-Orchestrate the Workflow

**After ALL blueprint updates are complete**, regenerate the implementation workflow:

```bash
/execute-adr {NNN}
```

**What This Does**:
- Reads your UPDATED blueprint documents
- Generates a NEW `ADR-{NNN}-AGENT_WORKFLOW.md` file
- Includes new phases/tasks for building the new functionality
- Updates dependency graph to reflect new work

**Why This Is CRITICAL**:
- ❌ Without re-orchestration, the old workflow is stale and incomplete
- ✅ Re-orchestration ensures implementation tasks are scheduled correctly
- ✅ New AI hooks, UX specs, and tests are enforced in the new workflow

---

## 📋 Completion Checklist

Use this checklist to track your progress:

**Blueprint Updates**:
- [ ] Step 1: DECISION.md updated
- [ ] Step 2: AI_OPPORTUNITIES.md updated (if applicable)
- [ ] Step 3: UX_SPEC.md updated (if applicable)
- [ ] Step 4: TEST_PLAN.md updated
- [ ] Step 5: IMPLEMENTATION_PLAN.md updated
- [ ] All changes committed to git

**Re-Orchestration**:
- [ ] Ran `/execute-adr {NNN}`
- [ ] New AGENT_WORKFLOW.md generated
- [ ] Reviewed new tasks in workflow
- [ ] Ready to begin implementation

**Documentation**:
- [ ] Updated ADR README.md status
- [ ] Updated DEVELOPMENT_LOG.md with scope change note

---

## 📚 Related Documentation

- **Original Decision**: [ADR-{NNN}-DECISION.md](./ADR-{NNN}-DECISION.md)
- **AI Opportunities**: [ADR-{NNN}-AI_OPPORTUNITIES.md](./ADR-{NNN}-AI_OPPORTUNITIES.md)
- **UX Specification**: [ADR-{NNN}-UX_SPEC.md](./ADR-{NNN}-UX_SPEC.md)
- **Test Plan**: [ADR-{NNN}-TEST_PLAN.md](./ADR-{NNN}-TEST_PLAN.md)
- **Implementation Plan**: [ADR-{NNN}-IMPLEMENTATION_PLAN.md](./ADR-{NNN}-IMPLEMENTATION_PLAN.md)

---

**Update Plan Generated**: {TIMESTAMP}
**Generated By**: Change Management Orchestrator
**Status**: ⏳ Awaiting Blueprint Updates

*This is a scope change management document. Complete all steps before proceeding to code.*
````

---

## 🎯 Special Instructions for Change Manager

### How to Determine Impact Level

**HIGH Impact** (requires multi-phase implementation):
- Changes core business logic or database schema
- Affects multiple existing features
- Requires new infrastructure (e.g., job queue for exports)
- Estimated time: >5 days

**MEDIUM Impact** (adds new functionality):
- Adds new endpoints but doesn't change existing ones
- Requires new UI components
- Moderate testing required
- Estimated time: 2-5 days

**LOW Impact** (minor enhancements):
- UI polish or small tweaks
- No architectural changes
- Minimal testing required
- Estimated time: <2 days

### How to Extract Content for Prompt Bundles

**For Technical Content** (Copy Verbatim):
- SQL schemas
- API endpoint definitions
- TypeScript interfaces
- Database table structures

**For Descriptive Content** (Summarize):
- Business requirements
- User stories
- Success criteria

**Always Include**:
- File path: `docs/adrs/ADR-{NNN}-{title}/FILENAME.md`
- Section headers: So agent knows where to look
- Example: "Read the 'Mandatory Data Hooks' section in AI_OPPORTUNITIES.md"

### When to Skip a Step

**Skip AI_OPPORTUNITIES Update If**:
- Change is purely UI (no data capture needed)
- Change is purely backend infrastructure (no user-facing data)

**Skip UX_SPEC Update If**:
- Change is backend-only (no UI changes)
- Change is API-only (no user interaction)

**NEVER Skip**:
- DECISION.md (always need acceptance criteria)
- TEST_PLAN.md (always need tests)
- IMPLEMENTATION_PLAN.md (always need technical design)

---

## ✅ Confirmation Template

After generating the update plan, output this exact format:

```
⚠️ **Scope Change Detected for ADR-{NNN}**

📋 **Update Plan Generated**: docs/adrs/ADR-{NNN}-{title}/ADR-{NNN}-UPDATE_PLAN.md

📊 **Impact Analysis**:
- Impact Level: {HIGH/MEDIUM/LOW}
- Affected Documents: {COUNT} of 5
  - DECISION.md: {BRIEF_REASON}
  - AI_OPPORTUNITIES.md: {BRIEF_REASON or "No changes needed"}
  - UX_SPEC.md: {BRIEF_REASON or "No changes needed"}
  - TEST_PLAN.md: {BRIEF_REASON}
  - IMPLEMENTATION_PLAN.md: {BRIEF_REASON}

🔧 **Change Summary**:
- New User Stories: {COUNT}
- New API Endpoints: {COUNT}
- New UI Components: {COUNT}
- New Security Tests: {COUNT}
- New AI Hooks: {COUNT}
- Estimated Additional Time: {HOURS} hours

🚀 **Next Steps**:
1. Open the Update Plan: docs/adrs/ADR-{NNN}-{title}/ADR-{NNN}-UPDATE_PLAN.md
2. Execute each numbered step in order:
   - Step 1: Update DECISION.md (@product-requirements-analyst)
   - Step 2: Update AI_OPPORTUNITIES.md (@ai-systems-architect) [if applicable]
   - Step 3: Update UX_SPEC.md (@ux-technologist) [if applicable]
   - Step 4: Update TEST_PLAN.md (@sdet-test-automation)
   - Step 5: Update IMPLEMENTATION_PLAN.md (@backend-architecture-optimizer)
3. **CRITICAL**: Re-run `/execute-adr {NNN}` to regenerate the implementation workflow
4. The new workflow will include tasks for building this new functionality

⚠️ **Important Reminders**:
- ❌ DO NOT skip the blueprint updates and jump to code
- ✅ DO execute prompt bundles with the appropriate specialist agents
- ✅ DO commit each blueprint update to git before proceeding
- ✅ DO re-run `/execute-adr` after ALL updates are complete
- ⚠️ The AGENT_WORKFLOW.md will be STALE until you re-orchestrate

🔗 **Documentation Standards**: See docs/DOCUMENTATION_STANDARDS.md Section 3.5
```

---

**Command Created**: {TIMESTAMP}
**Version**: 1.0
**Orchestrator**: Claude Code - Change Management Mode
