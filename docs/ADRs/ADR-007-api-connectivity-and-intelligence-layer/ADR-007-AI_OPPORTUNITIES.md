# ADR-007: API Connectivity & Intelligence Layer - AI Opportunities & Future Strategy

> **Primary Agent**: `ai-systems-architect`
> **Instruction**: Define AI capabilities that will leverage the Medallion Architecture's rich data layers.

**Status**: 🔴 Draft
**Created**: 2025-11-27
**Last Updated**: 2025-11-27

---

## 🧠 1. Innovative Use Cases (Brainstorming)

### Use Case 1: Intelligent Field Mapping (Auto-Suggest)
**Scenario**: Admin connects to a new PEMS instance. AI analyzes the first 100 records from Bronze layer and suggests field mappings based on data patterns.

**AI Capability**:
- Analyzes sample BronzeRecord entries
- Detects data types (date, number, string) from content
- Compares field names to PFA schema using semantic similarity
- Suggests mappings: "udf_char_01 looks like 'category' (95% confidence)"

**Business Value**: Reduces mapping configuration time from 2 hours to 5 minutes

**Example**:
```typescript
POST /api/ai/suggest-mappings
Body: { endpointId: "endpoint-123" }
Response: {
  suggestions: [
    {
      sourceField: "udf_char_01",
      destinationField: "category",
      confidence: 0.95,
      reasoning: "Contains values matching PFA category enum"
    },
    {
      sourceField: "last_update_date",
      destinationField: "updatedAt",
      confidence: 0.99,
      reasoning: "ISO date format detected"
    }
  ]
}
```

---

### Use Case 2: Anomaly Detection in Bronze Layer
**Scenario**: AI monitors BronzeRecord ingestion and alerts when data quality degrades.

**AI Capability**:
- Learns baseline schema from first 1,000 BronzeRecords
- Detects schema drift (new fields, missing fields, type changes)
- Identifies outliers (e.g., "cost" field suddenly contains text instead of numbers)
- Proactively alerts: "⚠️ Detected 47 records with invalid 'cost' field in batch-xyz"

**Business Value**: Prevents bad data from reaching Silver layer, reduces support tickets

**Example Alert**:
```
⚠️ Data Quality Alert (Batch: batch-20251127-001)

Issue: 47 records have non-numeric 'cost' field
Expected: number (e.g., 5000.00)
Actual: string (e.g., "TBD", "N/A")

Action: Review ApiFieldMapping for 'cost' field
Affected Records: [View in Bronze Layer Explorer]
```

---

### Use Case 3: Predictive Transformation Optimization
**Scenario**: AI analyzes Transformation Service performance and recommends optimizations.

**AI Capability**:
- Monitors transformation latency per field mapping
- Identifies slow mappings (e.g., date parsing taking 500ms per record)
- Suggests optimizations: "Precompile date format regex for 10x speedup"
- Auto-generates optimized transformation code

**Business Value**: Reduces transformation time from 10 minutes to 2 minutes for 100K records

**Example Suggestion**:
```typescript
// Current (Slow)
const date = moment(rawJson.last_update_date, 'YYYY-MM-DD').toDate();

// AI Suggested (Fast)
const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/; // Precompiled
const [_, y, m, d] = rawJson.last_update_date.match(dateRegex);
const date = new Date(+y, +m - 1, +d); // 10x faster
```

---

### Use Case 4: Natural Language KPI Builder
**Scenario**: User types "Show me total rental cost with 15% tax" instead of writing mathjs formula.

**AI Capability**:
- Parses natural language query
- Identifies required fields: `monthlyRate`, `quantity`
- Generates mathjs formula: `({monthlyRate} * {quantity}) * 1.15`
- Validates formula on sample data
- Saves as KpiDefinition

**Business Value**: Non-technical users can create KPIs, reduces training time

**Example**:
```
User Input: "Calculate total spend including 15% overhead"

AI Output:
✅ Formula Generated: (cost * 1.15)
✅ Tested on 100 sample records
✅ Average result: $5,750.00

[Save as KPI] [Edit Formula] [Cancel]
```

---

### Use Case 5: Automated Data Lineage Visualization
**Scenario**: User asks "Where does the 'category' field come from?" AI traces lineage from PEMS → Bronze → Silver.

**AI Capability**:
- Queries BronzeRecord to find original PEMS field (`udf_char_01`)
- Queries ApiFieldMapping to show transformation rule
- Queries PfaRecord to show final value
- Generates interactive flowchart

**Business Value**: Instant debugging, reduces support time from 30 minutes to 30 seconds

**Example Lineage**:
```
PEMS API (udf_char_01)
  → Bronze (rawJson.udf_char_01 = "RENTAL")
  → Mapping Rule (udf_char_01 → category, uppercase transform)
  → Silver (PfaRecord.category = "Rental")
```

---

## 🔌 2. Mandatory Data Hooks (Phase 1 Requirements)

**⚠️ CRITICAL: To enable AI use cases above, the Backend Architect MUST implement these data hooks NOW in Phase 1.**

### Hook 1: Bronze Layer Metadata
**Requirement**: Store schema metadata for each Bronze batch.

**Implementation**:
```typescript
model BronzeBatch {
  id             String   @id @default(cuid())
  syncBatchId    String   @unique
  organizationId String
  entityType     String
  ingestedAt     DateTime @default(now())
  recordCount    Int

  // AI Hook: Schema fingerprint for anomaly detection
  schemaFingerprint Json   // { fields: ["id", "cost", ...], types: { cost: "number" } }

  // AI Hook: Quality metrics
  validRecordCount   Int
  invalidRecordCount Int
  warnings           Json   @default("[]")  // [{ field: "cost", issue: "non-numeric", count: 47 }]
}
```

**Why**: Enables AI to learn schema baseline and detect drift.

---

### Hook 2: Transformation Performance Metrics
**Requirement**: Log latency per field mapping.

**Implementation**:
```typescript
model TransformationMetrics {
  id             String   @id @default(cuid())
  mappingId      String   // FK to ApiFieldMapping
  batchId        String   // FK to BronzeBatch
  executedAt     DateTime @default(now())

  // AI Hook: Performance tracking
  recordsProcessed Int
  totalLatency     Int      // milliseconds
  avgLatency       Float    // ms per record
  errorCount       Int

  mapping        ApiFieldMapping @relation(fields: [mappingId], references: [id])
}
```

**Why**: Enables AI to identify slow mappings and suggest optimizations.

---

### Hook 3: KPI Execution History
**Requirement**: Store every KPI calculation with inputs/outputs.

**Implementation**:
```typescript
model KpiExecutionLog {
  id             String   @id @default(cuid())
  kpiId          String   // FK to KpiDefinition
  userId         String
  executedAt     DateTime @default(now())

  // AI Hook: Input/output for learning
  inputRecordCount Int
  inputSample      Json     // Sample of input records (first 10)
  outputValue      Float    // Calculated result
  executionTime    Int      // milliseconds

  // AI Hook: User feedback
  userRating       Int?     // 1-5 stars (did user find this useful?)

  kpi            KpiDefinition @relation(fields: [kpiId], references: [id])
}
```

**Why**: Enables AI to learn which KPIs are useful and suggest similar ones.

---

### Hook 4: User Intent Logging
**Requirement**: Log user actions in Admin UI for AI learning.

**Implementation**:
```typescript
model UserActionLog {
  id             String   @id @default(cuid())
  userId         String
  actionType     String   // "create_mapping" | "create_kpi" | "view_lineage"
  actionContext  Json     // { endpointId: "...", mappingId: "..." }
  timestamp      DateTime @default(now())

  // AI Hook: Natural language intent
  userIntent     String?  // Optional: "I want to map cost field"

  // AI Hook: Success tracking
  wasSuccessful  Boolean  @default(true)
  errorMessage   String?
}
```

**Why**: Enables AI to learn user patterns and provide proactive suggestions.

---

### Hook 5: Data Lineage Graph
**Requirement**: Store relationships between Bronze/Silver/Gold for tracing.

**Implementation**:
```typescript
model DataLineage {
  id              String   @id @default(cuid())
  silverRecordId  String   // FK to PfaRecord
  bronzeRecordId  String   // FK to BronzeRecord
  mappingRules    Json     // Snapshot of ApiFieldMapping at transform time
  transformedAt   DateTime @default(now())

  @@index([silverRecordId])
  @@index([bronzeRecordId])
}
```

**Why**: Enables AI to trace data lineage for "Where does this value come from?" queries.

---

## 📊 3. API Granularity Requirements

### Requirement 1: Bronze Layer Explorer API
**Purpose**: Allow AI to analyze raw PEMS data before transformation.

**Endpoints Needed**:
```typescript
GET    /api/bronze/batches              // List recent batches
GET    /api/bronze/batches/:id/records  // View records in batch
GET    /api/bronze/batches/:id/schema   // Get schema fingerprint
POST   /api/bronze/analyze               // Run anomaly detection
```

---

### Requirement 2: Mapping Suggestion API
**Purpose**: AI suggests field mappings based on Bronze data.

**Endpoint**:
```typescript
POST /api/ai/suggest-mappings
Body: {
  endpointId: string,
  sampleSize?: number  // Default 100 records
}
Response: {
  suggestions: Array<{
    sourceField: string,
    destinationField: string,
    confidence: number,  // 0-1
    reasoning: string
  }>
}
```

---

### Requirement 3: Transformation Optimization API
**Purpose**: AI analyzes slow mappings and suggests fixes.

**Endpoint**:
```typescript
POST /api/ai/optimize-transformations
Body: {
  endpointId: string,
  minLatency?: number  // Only analyze mappings >X ms
}
Response: {
  optimizations: Array<{
    mappingId: string,
    currentLatency: number,
    suggestedLatency: number,
    improvement: string,  // "10x faster"
    codeSnippet: string   // Optimized code
  }>
}
```

---

### Requirement 4: KPI Natural Language API
**Purpose**: Convert natural language to mathjs formula.

**Endpoint**:
```typescript
POST /api/ai/kpi/parse
Body: {
  naturalLanguage: string,  // "Total cost with 15% tax"
  availableFields: string[] // ["cost", "monthlyRate", ...]
}
Response: {
  formula: string,          // "(cost * 1.15)"
  explanation: string,      // "Multiplies cost by 1.15 (15% tax)"
  confidence: number,       // 0-1
  testResult: {
    sampleInput: object,
    output: number
  }
}
```

---

### Requirement 5: Data Lineage Trace API
**Purpose**: Trace field from Silver back to Bronze.

**Endpoint**:
```typescript
POST /api/lineage/trace
Body: {
  recordId: string,  // PfaRecord ID
  field: string      // e.g., "category"
}
Response: {
  lineage: {
    silver: { value: "Rental", timestamp: "..." },
    mapping: { sourceField: "udf_char_01", destinationField: "category" },
    bronze: { value: "RENTAL", rawJson: {...}, ingestedAt: "..." },
    pems: { endpoint: "/api/grid-data/pfa", lastSync: "..." }
  }
}
```

---

## 🚀 4. Implementation Priorities

### Phase 1 (Must-Have - Implement Now):
1. ✅ Bronze layer metadata (BronzeBatch.schemaFingerprint)
2. ✅ Transformation metrics (TransformationMetrics table)
3. ✅ Data lineage tracking (DataLineage table)
4. ✅ User action logging (UserActionLog table)
5. ✅ Bronze Layer Explorer API

### Phase 2 (High Value - Next Quarter):
6. 📋 Intelligent field mapping suggestions
7. 📋 Anomaly detection in Bronze layer
8. 📋 Transformation optimization AI
9. 📋 Natural language KPI builder
10. 📋 Data lineage visualization

### Phase 3 (Future - Nice to Have):
11. 📋 Predictive sync scheduling (predict optimal sync times)
12. 📋 Auto-healing transformations (fix mapping errors automatically)
13. 📋 Semantic search across Bronze layer
14. 📋 Cross-organization pattern learning (learn from RIO to improve HOLNG)

---

## 🔗 5. Integration with Existing AI System

The existing AI assistant (Gemini/OpenAI/Claude) can be augmented to:

1. **Answer Connectivity Questions**: "Why is the sync failing?" (analyze BronzeBatch warnings)
2. **Suggest Optimizations**: "This mapping is slow. Try this..." (use TransformationMetrics)
3. **Explain Data Flow**: "Where does 'category' come from?" (use DataLineage)
4. **Create KPIs**: "Calculate total cost with tax" (generate mathjs formula)

**Required Changes**:
- Add `connectivity` and `intelligence` entities to AI context
- Train AI on BronzeRecord schema and ApiFieldMapping structure
- Add SQL generation capability for Bronze layer queries

---

## 📚 Related Documentation

- **Decision**: [ADR-007-DECISION.md](./ADR-007-DECISION.md)
- **UX Specification**: [ADR-007-UX_SPEC.md](./ADR-007-UX_SPEC.md)
- **Test Plan**: [ADR-007-TEST_PLAN.md](./ADR-007-TEST_PLAN.md)
- **Implementation Plan**: [ADR-007-IMPLEMENTATION_PLAN.md](./ADR-007-IMPLEMENTATION_PLAN.md)

---

**Status**: 🔴 Draft - Awaiting AI Architect Review
**Next Action**: Backend architect must review and include data hooks in implementation plan

*Document created: 2025-11-27*
*AI Readiness Version: 1.0*
