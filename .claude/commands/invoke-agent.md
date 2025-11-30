# INVOKE-AGENT: Execute ADR Workflow Task with Specialist Agent

**Command**: `/invoke-agent <agent-name> <task-id>`

**Description**: Invokes a specialist agent to execute a specific task from an ADR workflow. The agent receives the task's prompt bundle and executes it according to the workflow specification.

**Example Usage**:
- `/invoke-agent backend-architecture-optimizer 3.1`
- `/invoke-agent sdet-test-automation 3.4`
- `/invoke-agent react-ai-ux-specialist 5.1`

---

## Instructions for Claude

### Step 1: Parse Arguments

Extract from command arguments:
- `agent-name`: The specialist agent to invoke (e.g., `backend-architecture-optimizer`)
- `task-id`: The task identifier from the workflow (e.g., `3.1`, `4.2`)

### Step 2: Load Agent Persona

Read the agent definition from `.claude/agents/{agent-name}.md` to adopt the specialist persona.

### Step 3: Locate Task in Workflow

1. Find the active ADR workflow: `docs/adrs/ADR-*-*/ADR-*-AGENT_WORKFLOW.md`
2. Search for `Task {task-id}:` section
3. Extract the complete prompt bundle

### Step 4: Execute as Agent

**System Instruction**: You are now the `{agent-name}` agent. Execute the task according to:
1. The agent persona from `.claude/agents/{agent-name}.md`
2. The prompt bundle from the workflow
3. Project coding standards from `CODING_STANDARDS.md`
4. Project documentation standards from `DOCUMENTATION_STANDARDS.md`

### Step 5: Implementation

Execute the task by:
1. Reading all referenced files in the prompt bundle
2. Creating/modifying files as specified
3. Following the technical specification exactly
4. Implementing all required features
5. Running verification commands

### Step 6: Verification

After implementation:
1. Run any specified test commands
2. Verify file existence
3. Check for compilation errors
4. Validate against acceptance criteria

### Step 7: Report Completion

Output format:
```
## Task {task-id} Execution Complete

**Agent**: {agent-name}
**Status**: [SUCCESS/PARTIAL/FAILED]

### Files Created/Modified:
- {file-path-1}
- {file-path-2}

### Verification Results:
- [PASS/FAIL] {verification-item-1}
- [PASS/FAIL] {verification-item-2}

### Notes:
{any-important-observations}

### Next Task:
Task {next-task-id}: {next-task-name}
```

---

## Available Agents

| Agent | Specialization |
|-------|----------------|
| `backend-architecture-optimizer` | Node.js backend, APIs, database design, caching |
| `postgres-jsonb-architect` | Database schema, Prisma, migrations |
| `react-ai-ux-specialist` | React components, state management, UI |
| `ux-technologist` | UX patterns, accessibility, perceived performance |
| `sdet-test-automation` | Test suites, E2E tests, integration tests |
| `ai-security-red-teamer` | Security testing, vulnerability analysis |
| `ai-systems-architect` | System design, architecture decisions |
| `devsecops-engineer` | CI/CD, deployment, infrastructure |

---

**Command Created**: 2025-11-27
**Version**: 1.0
