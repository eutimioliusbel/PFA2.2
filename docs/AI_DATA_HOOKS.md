# AI Data Hooks: Intelligence & Learning Infrastructure

> **ADR-007 Task 1.3**: Enable KPI formulas and AI learning hooks for continuous system improvement

---

## Table of Contents

1. [Overview](#overview)
2. [KPI Formula Engine](#kpi-formula-engine)
3. [AI Learning Hooks](#ai-learning-hooks)
4. [Hybrid Calculation Model](#hybrid-calculation-model)
5. [Data Collection](#data-collection)
6. [AI Enhancement Opportunities](#ai-enhancement-opportunities)
7. [Privacy & Ethics](#privacy--ethics)

---

## Overview

The AI Data Hooks system provides infrastructure for:
- **Custom Metrics**: User-defined KPI formulas calculated on demand
- **Performance Tracking**: Transformation latency, error rates, execution times
- **Behavior Analysis**: User action patterns, intent inference, personalization
- **Continuous Learning**: Model improvement via execution feedback and ratings

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERACTIONS                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ KPI Formula  │  │ Bronze→Silver│  │ User Actions │      │
│  │ Execution    │  │ Transformation│  │ (filter/sort)│      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │               │
│         ▼                  ▼                  ▼               │
├─────────────────────────────────────────────────────────────┤
│                   AI LEARNING HOOKS                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ kpi_execution_logs                                     │  │
│  │ - Input sample, output value, execution time          │  │
│  │ - User rating (1-5 stars)                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ transformation_metrics                                 │  │
│  │ - Records processed, latency, error count             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ user_action_logs                                       │  │
│  │ - Action type, context, inferred intent               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                  AI ENHANCEMENT LAYER                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  • Formula Suggestion (based on execution patterns)         │
│  • Mapping Optimization (detect slow/error-prone rules)     │
│  • Intent Prediction (suggest next actions)                 │
│  • Personalization (adapt UI to user patterns)              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## KPI Formula Engine

### KpiDefinition Model

User-defined formulas for custom metrics using Math.js expressions.

```prisma
model KpiDefinition {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  description    String?

  formula        String   // "{monthlyRate} * {quantity} * 1.15"
  formulaType    String   @default("mathjs") // "mathjs" | "jsonlogic"

  format         String   @default("number") // "number" | "currency" | "percent"
  colorScale     Boolean  @default(false)
  sortOrder      Int      @default(0)

  // Performance metrics (AI Hook)
  executionCount   Int      @default(0)
  avgExecutionTime Int?
  lastExecutedAt   DateTime?

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  createdBy      String
  isActive       Boolean  @default(true)
}
```

### Formula Syntax

**Math.js Expressions** (default):
```typescript
// Simple arithmetic
"{cost} * 1.15"

// Date calculations (timestamps in milliseconds)
"({forecastEnd} - {forecastStart}) / 86400000"  // Duration in days

// Conditional logic
"{source} == 'Rental' ? {monthlyRate} * ({days} / 30.44) : {purchasePrice}"

// Math functions
"sqrt({cost}) * 2.5"
"max({planCost}, {forecastCost})"
```

**Available Variables**:
All `PfaRecord` fields are available as variables:
- `{monthlyRate}`, `{purchasePrice}`, `{cost}`
- `{forecastStart}`, `{forecastEnd}`, `{actualStart}`, `{actualEnd}`
- `{originalStart}`, `{originalEnd}`
- `{category}`, `{source}`, `{dor}`, `{areaSilo}`
- Custom fields: `{quantity}`, `{days}`, etc.

### Example KPIs

#### 1. Overhead Markup (15%)
```typescript
await prisma.kpiDefinition.create({
  data: {
    name: 'Overhead Markup (15%)',
    formula: '{cost} * 1.15',
    format: 'currency',
    organizationId: 'RIO',
    createdBy: userId,
  },
});
```

#### 2. Rental Duration
```typescript
await prisma.kpiDefinition.create({
  data: {
    name: 'Rental Duration (Days)',
    formula: '({forecastEnd} - {forecastStart}) / 86400000',
    format: 'number',
    organizationId: 'RIO',
    createdBy: userId,
  },
});
```

#### 3. Utilization Rate
```typescript
await prisma.kpiDefinition.create({
  data: {
    name: 'Utilization Rate (%)',
    formula: '(({actualEnd} - {actualStart}) / ({forecastEnd} - {forecastStart})) * 100',
    format: 'percent',
    colorScale: true,
    organizationId: 'RIO',
    createdBy: userId,
  },
});
```

---

## AI Learning Hooks

### 1. KpiExecutionLog

Tracks **every** KPI calculation for AI-driven formula optimization.

```prisma
model KpiExecutionLog {
  id                String   @id @default(cuid())
  kpiId             String
  userId            String
  organizationId    String
  executedAt        DateTime @default(now())

  inputRecordCount  Int
  inputSample       Json     @db.JsonB  // First 10 records for debugging
  outputValue       Float
  executionTime     Int      // milliseconds

  // User feedback for AI learning
  userRating        Int?     // 1-5 rating
}
```

**AI Use Cases**:
- **Formula Suggestion**: "Users with similar roles use this formula instead"
- **Performance Optimization**: "This formula is slow; here's a faster equivalent"
- **Accuracy Validation**: "Users rate this formula 2/5 stars; review for errors"

**Example**:
```typescript
// After executing KPI formula
await prisma.kpiExecutionLog.create({
  data: {
    kpiId: kpi.id,
    userId: user.id,
    organizationId: org.id,
    inputRecordCount: pfaRecords.length,
    inputSample: pfaRecords.slice(0, 10), // First 10 records
    outputValue: calculatedValue,
    executionTime: Date.now() - startTime,
  },
});
```

### 2. TransformationMetrics

Tracks Bronze→Silver transformation performance for mapping rule optimization.

```prisma
model TransformationMetrics {
  id               String   @id @default(cuid())
  mappingId        String   // ApiFieldMapping ID
  batchId          String   // BronzeBatch syncBatchId
  executedAt       DateTime @default(now())

  recordsProcessed Int
  totalLatency     Int      // milliseconds
  avgLatency       Float
  errorCount       Int
}
```

**AI Use Cases**:
- **Slow Mapping Detection**: "Rule `udf_char_01 → category` is 10x slower than average"
- **Error Pattern Analysis**: "This mapping fails for 15% of records; review transform logic"
- **Proactive Alerts**: "Transformation latency increased 200% in last hour"

**Example**:
```typescript
// After applying field mappings to Bronze batch
await prisma.transformationMetrics.create({
  data: {
    mappingId: fieldMapping.id,
    batchId: bronzeBatch.syncBatchId,
    recordsProcessed: records.length,
    totalLatency: transformDuration,
    avgLatency: transformDuration / records.length,
    errorCount: failedRecords.length,
  },
});
```

### 3. UserActionLog

Tracks user behaviors for AI-powered intent inference and personalization.

```prisma
model UserActionLog {
  id             String   @id @default(cuid())
  userId         String
  organizationId String
  actionType     String   // "filter" | "sort" | "bulk_edit" | "export" | etc.
  actionContext  Json     @db.JsonB  // Action-specific data

  timestamp      DateTime @default(now())

  // AI enrichment
  userIntent     String?  // AI-inferred intent
  wasSuccessful  Boolean  @default(true)
  errorMessage   String?
}
```

**Action Types**:
- `filter`: Applied filter criteria
- `sort`: Changed sort order
- `bulk_edit`: Bulk operation performed
- `export`: Data exported
- `drag_drop`: Timeline drag-and-drop
- `search`: Search query
- `kpi_execute`: KPI formula executed

**AI Use Cases**:
- **Intent Prediction**: "User filtering by category + cost suggests intent: 'find_rental_cost_anomalies'"
- **Next Action Suggestion**: "Users who filter by cost often export next; suggest export button?"
- **Personalization**: "User prefers timeline view over grid; default to timeline"

**Example**:
```typescript
// When user applies filter
await prisma.userActionLog.create({
  data: {
    userId: user.id,
    organizationId: org.id,
    actionType: 'filter',
    actionContext: {
      filters: { category: 'TRUCKS', costRange: [5000, 10000] },
      resultCount: 42,
    },
    userIntent: 'find_high_cost_trucks', // AI-inferred
    wasSuccessful: true,
  },
});
```

---

## Hybrid Calculation Model

### Critical Design Constraint

KPI formulas must work in **two execution contexts**:

| Context | Data Source | Use Case |
|---------|-------------|----------|
| **Backend** | Silver layer (committed data) | Historical reports, analytics, batch processing |
| **Frontend** | `allPfaRef` (sandbox draft changes) | Real-time preview, "what-if" analysis, unsaved edits |

### Backend Execution (Silver Layer)

```typescript
// Backend service: Calculate KPI on committed Silver layer data
async function executeKpiBackend(kpiId: string, orgId: string) {
  const kpi = await prisma.kpiDefinition.findUnique({ where: { id: kpiId } });
  const pfaRecords = await prisma.pfaRecord.findMany({
    where: { organizationId: orgId },
  });

  const result = evaluateFormula(kpi.formula, pfaRecords);

  // Log execution
  await prisma.kpiExecutionLog.create({
    data: {
      kpiId: kpi.id,
      userId: requestUser.id,
      organizationId: orgId,
      inputRecordCount: pfaRecords.length,
      inputSample: pfaRecords.slice(0, 10),
      outputValue: result,
      executionTime: executionTime,
    },
  });

  return result;
}
```

### Frontend Execution (Sandbox Mode)

```typescript
// Frontend: Calculate KPI on in-memory draft changes (allPfaRef)
function executeKpiFrontend(kpi: KpiDefinition, allPfaRef: PfaRecord[]) {
  // Apply formula to sandbox data (unsaved edits)
  const result = evaluateFormula(kpi.formula, allPfaRef.current);

  // Optionally log to backend (async, non-blocking)
  apiClient.logKpiExecution({
    kpiId: kpi.id,
    inputRecordCount: allPfaRef.current.length,
    outputValue: result,
  });

  return result;
}
```

### Formula Evaluation (Math.js)

```typescript
import { evaluate } from 'mathjs';

function evaluateFormula(formula: string, records: PfaRecord[]): number {
  // Replace {fieldName} placeholders with actual values
  const scope = records.reduce((acc, record) => {
    Object.keys(record).forEach(key => {
      acc[key] = record[key];
    });
    return acc;
  }, {});

  // Evaluate Math.js expression
  return evaluate(formula, scope);
}
```

---

## Data Collection

### When to Log

**Always Log**:
- KPI formula execution (both backend and frontend)
- Bronze→Silver transformations (every batch)
- High-impact user actions (bulk edit, export, sync)

**Conditionally Log**:
- Low-impact actions (filter, sort) - sample at 10% rate
- Failed actions - always log for debugging
- Slow operations (>1s) - always log for performance tracking

### Sampling Strategy

```typescript
// Sample low-impact actions at 10% rate
const shouldLog = Math.random() < 0.1;
if (shouldLog || action.executionTime > 1000 || !action.wasSuccessful) {
  await prisma.userActionLog.create({ data: actionData });
}
```

### Data Retention

| Table | Retention | Rationale |
|-------|-----------|-----------|
| `kpi_execution_logs` | 90 days | AI training, performance analysis |
| `transformation_metrics` | 180 days | Long-term performance trends |
| `user_action_logs` | 30 days | Recent behavior patterns only |

---

## AI Enhancement Opportunities

### 1. Formula Suggestion Engine

**Goal**: Suggest better KPI formulas based on user patterns

**Approach**:
```sql
-- Find similar users (same org, similar role)
SELECT DISTINCT kd.formula, COUNT(*) as usage_count, AVG(kel.userRating) as avg_rating
FROM kpi_execution_logs kel
JOIN kpi_definitions kd ON kel.kpiId = kd.id
WHERE kel.organizationId = 'RIO'
  AND kel.userId IN (SELECT id FROM users WHERE role = 'Project Manager')
GROUP BY kd.formula
ORDER BY avg_rating DESC, usage_count DESC
LIMIT 5;
```

**Output**: "Project Managers at Rio Tinto also use: `{cost} * 1.12` (4.5★, used 127 times)"

### 2. Transformation Optimization

**Goal**: Detect slow/error-prone field mappings

**Approach**:
```sql
-- Find mappings with high error rates or slow performance
SELECT
  mappingId,
  AVG(avgLatency) as avg_latency_ms,
  SUM(errorCount) * 100.0 / SUM(recordsProcessed) as error_rate_pct
FROM transformation_metrics
WHERE executedAt > NOW() - INTERVAL '7 days'
GROUP BY mappingId
HAVING error_rate_pct > 5 OR avg_latency_ms > 100
ORDER BY error_rate_pct DESC;
```

**Output**: "Mapping `udf_char_01 → category` has 12% error rate and 250ms avg latency"

### 3. Intent Prediction

**Goal**: Predict next user action based on behavior patterns

**Approach**:
```sql
-- Find common action sequences
SELECT
  a1.actionType as first_action,
  a2.actionType as next_action,
  COUNT(*) as frequency
FROM user_action_logs a1
JOIN user_action_logs a2 ON a2.userId = a1.userId
  AND a2.timestamp > a1.timestamp
  AND a2.timestamp < a1.timestamp + INTERVAL '5 minutes'
WHERE a1.userId = 'current-user-id'
GROUP BY a1.actionType, a2.actionType
ORDER BY frequency DESC;
```

**Output**: "After filtering by cost, users typically export (78% probability)"

### 4. Personalization

**Goal**: Adapt UI based on user preferences

**Approach**:
```sql
-- Detect user's preferred view mode
SELECT actionContext->>'viewMode' as view_mode, COUNT(*) as usage_count
FROM user_action_logs
WHERE userId = 'current-user-id'
  AND actionType = 'view_change'
  AND timestamp > NOW() - INTERVAL '30 days'
GROUP BY view_mode
ORDER BY usage_count DESC
LIMIT 1;
```

**Output**: "Default to Timeline view (user prefers this 85% of the time)"

---

## Privacy & Ethics

### Data Minimization

**Collect**:
- Aggregated metrics (count, avg, sum)
- Sample records (first 10, not all)
- Action outcomes (success/failure)

**Do NOT Collect**:
- Full PFA record contents (privacy risk)
- User passwords or credentials
- Personal identifiable information (PII)

### User Consent

**Opt-In by Default**:
- All users participate in AI learning unless opted out
- Setting: `UserNotificationPreferences.aiLearningEnabled`

**Opt-Out Process**:
1. User goes to Settings → Privacy
2. Toggles "Share anonymized usage data for AI improvements"
3. Backend stops logging `UserActionLog` for that user
4. Existing logs remain for aggregate analysis

### Transparency

**User-Facing Explanations**:
- "This formula suggestion is based on 127 similar users"
- "This warning appears because 12% of recent transformations failed"
- "We suggest exporting next because 78% of users do this after filtering"

**AI Explainability**: All AI-driven suggestions include:
- Data source (which logs were analyzed)
- Confidence level (e.g., 78% probability)
- User control (ability to dismiss or customize)

---

## Migration & Deployment

**Migration**: `backend/prisma/migrations/20251128000001_add_intelligence_ai_hooks/migration.sql`

**Tables Created**:
- `kpi_definitions`: User-defined formulas
- `kpi_execution_logs`: Execution tracking + ratings
- `transformation_metrics`: Bronze→Silver performance
- `user_action_logs`: Behavior patterns

**Seeding**:
```bash
cd backend
npx tsx scripts/seed-test-kpi.ts
```

**Verification**:
```bash
cd backend
npx tsx scripts/check-ai-hooks-tables.ts
```

---

## Next Steps (Phase 5: AI Features)

1. **KPI Calculator Service** (Task 2.1)
   - Implement Math.js formula evaluation
   - Add frontend execution support
   - Create KPI dashboard UI

2. **Transformation Optimizer** (Task 2.2)
   - Detect slow/error-prone mappings
   - Auto-suggest optimizations
   - Performance alerts

3. **Intent Predictor** (Task 2.3)
   - Analyze action sequences
   - Predict next actions
   - Suggest UI shortcuts

4. **Personalization Engine** (Task 2.4)
   - User preference learning
   - Adaptive UI defaults
   - Custom dashboard layouts

---

**Generated**: 2025-11-28
**ADR**: ADR-007 API Connectivity & Intelligence Layer
**Phase**: Phase 1 - Task 1.3 (Intelligence & AI Hooks)
**Status**: ✅ Complete
