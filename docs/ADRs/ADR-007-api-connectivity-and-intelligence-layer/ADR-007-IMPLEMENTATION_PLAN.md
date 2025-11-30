# ADR-007: API Connectivity & Intelligence Layer - Technical Implementation Plan

> **Primary Agents**: `backend-architecture-optimizer`, `postgres-jsonb-architect`, `react-ai-ux-specialist`
> **Instruction**: Implement the 3-tier Medallion Architecture with full Admin UI support. This is the complete technical specification.

**Status**: 🔴 Draft
**Created**: 2025-11-27
**Dependencies**:
- ADR-005 (Multi-Tenant Access Control) - ✅ Complete
- ADR-006 (API Server Architecture) - ✅ Complete
- Redis (Optional, can defer to Phase 2)

---

## 📋 1. Overview

### Goals
Transform PFA Vanguard from a rigid sync tool into a configurable data platform by implementing:
1. **3-Tier Connectivity** (ApiServer → ApiEndpoint → ApiFieldMapping)
2. **Medallion Architecture** (Bronze → Silver → Gold layers)
3. **Intelligence Engine** (Custom KPI formulas with mathjs)
4. **Admin UI** (Connectivity Manager, Mapping Studio, Formula Builder)

### Success Criteria
- [ ] All user stories from DECISION.md implemented
- [ ] Performance targets from UX_SPEC.md met (10K rec/call, <2s transform)
- [ ] Security tests from TEST_PLAN.md passing (100%)
- [ ] AI data hooks from AI_OPPORTUNITIES.md implemented (BronzeBatch, TransformationMetrics, etc.)

### Key Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Ingestion Throughput | 10K records/API call | Backend logs |
| Transformation Latency | <2s per 1K records | Backend logs |
| Mapping Preview Speed | <500ms | Chrome DevTools |
| KPI Calculation Speed | <500ms for 20K records | Chrome DevTools |
| Test Coverage (Backend) | >95% | Jest |
| Test Coverage (Frontend) | >70% | Vitest |
| Bundle Size Impact | <100KB | Webpack Bundle Analyzer |

---

## 🗄️ 2. Database Schema (PostgreSQL/JSONB)

### Phase 1A: 3-Tier Connectivity Configuration

```prisma
// ========================================
// TIER 1: CONNECTION (ApiServer)
// ========================================
model ApiServer {
  id                   String   @id @default(cuid())
  organizationId       String
  name                 String   // "PEMS Production"
  baseUrl              String   // "https://eam.example.com"
  authType             String   // "BASIC" | "OAUTH" | "API_KEY"
  encryptedCredentials String   // AES-256 encrypted JSON

  // Health Monitoring
  isActive             Boolean  @default(true)
  lastHealthCheck      DateTime?
  healthStatus         String?  @default("unknown") // "healthy" | "degraded" | "down"

  // Audit
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  createdBy            String

  // Relations
  endpoints            ApiEndpoint[]
  organization         Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([isActive])
}

// ========================================
// TIER 2: RESOURCE & FILTERING (ApiEndpoint)
// ========================================
model ApiEndpoint {
  id              String   @id @default(cuid())
  serverId        String
  name            String   // "Active PFA Records"
  path            String   // "/api/grid-data/pfa"
  method          String   @default("GET") // "GET" | "POST"
  targetModel     String   // "PfaRecord" | "AssetMaster" | "User"

  // SOURCE FILTERS (Bandwidth Optimization)
  defaultParams   Json     @default("{}") // { "status": "A", "date_gte": "2025-01-01" }

  // DELTA STRATEGY (Speed Optimization)
  supportsDelta   Boolean  @default(true)
  deltaField      String?  // "last_update_date" (PEMS field name)
  deltaStrategy   String   @default("timestamp") // "timestamp" | "checksum" | "version"

  // PROMOTION FILTERS (Quality Gate)
  // JsonLogic rules to skip invalid records before Silver layer
  promotionRules  Json     @default("[]") // [{ "!=": [{ "var": "status" }, "SCRAPPED"] }]

  // Performance Tracking
  lastSyncAt      DateTime?
  avgLatency      Int?     // milliseconds
  errorRate       Float?   // 0.0 - 1.0

  // Audit
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  mappings        ApiFieldMapping[]
  server          ApiServer @relation(fields: [serverId], references: [id], onDelete: Cascade)

  @@index([serverId])
  @@index([targetModel])
}

// ========================================
// TIER 3: TRANSFORMATION (ApiFieldMapping)
// ========================================
model ApiFieldMapping {
  id               String   @id @default(cuid())
  endpointId       String

  // THE TRANSLATION RULE
  sourceField      String   // PEMS Key: "udf_char_01"
  destinationField String   // PFA Column: "category"
  dataType         String   @default("string") // "string" | "number" | "date" | "boolean"

  // Transformation Logic (Optional)
  transformType    String?  @default("direct") // "direct" | "uppercase" | "lowercase" | "date_format" | "custom"
  transformParams  Json?    @default("{}") // { "dateFormat": "YYYY-MM-DD" }

  // Default Value (Fallback)
  defaultValue     String?

  // GOVERNANCE: Effective Dating (Support schema changes over time)
  validFrom        DateTime @default(now())
  validTo          DateTime?
  isActive         Boolean  @default(true)

  // AI Hook: Performance Tracking
  avgTransformTime Int?     // microseconds per record
  errorCount       Int      @default(0)

  // Audit
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  createdBy        String

  // Relations
  endpoint         ApiEndpoint @relation(fields: [endpointId], references: [id], onDelete: Cascade)

  @@unique([endpointId, sourceField, destinationField])
  @@index([endpointId, isActive])
  @@index([validFrom, validTo])
}
```

### Phase 1B: Medallion Storage Layers

```prisma
// ========================================
// BRONZE LAYER: Immutable Raw History
// ========================================
model BronzeRecord {
  id             String   @id @default(uuid())
  syncBatchId    String   // Links all records from one sync run
  organizationId String
  entityType     String   // "PFA" | "ASSET" | "USER"
  ingestedAt     DateTime @default(now())

  // THE RAW PAYLOAD
  rawJson        Json     @db.JsonB

  // AI Hook: Schema Fingerprint (for anomaly detection)
  schemaVersion  String?  // Hash of field names (detect schema drift)

  // Relations
  lineage        DataLineage[] // For tracing Bronze → Silver

  @@index([syncBatchId])
  @@index([organizationId, ingestedAt])
  @@index([organizationId, entityType])
}

// AI Hook: Batch-Level Metadata
model BronzeBatch {
  id                 String   @id @default(cuid())
  syncBatchId        String   @unique
  organizationId     String
  endpointId         String
  entityType         String
  ingestedAt         DateTime @default(now())
  completedAt        DateTime?

  // Record Counts
  recordCount        Int
  validRecordCount   Int
  invalidRecordCount Int

  // AI Hook: Schema Fingerprint (for anomaly detection)
  schemaFingerprint  Json     // { fields: ["id", "cost", ...], types: { cost: "number" } }

  // AI Hook: Quality Metrics
  warnings           Json     @default("[]") // [{ field: "cost", issue: "non-numeric", count: 47 }]
  errors             Json     @default("[]")

  @@index([organizationId, ingestedAt])
}

// ========================================
// SILVER LAYER: Transformed Application Data
// ========================================
// NOTE: PfaRecord is the existing Silver layer.
// We ADD these fields to support the new architecture.

// ADD TO EXISTING PfaRecord MODEL:
model PfaRecord {
  // ... existing fields (id, category, monthlyRate, etc.) ...

  // AI Hook: Touch Logic (Orphan Detection)
  lastSeenAt     DateTime @default(now())

  // AI Hook: Data Lineage
  bronzeRecordId String?
  lineage        DataLineage?
}

// ========================================
// DATA LINEAGE: Tracing Bronze → Silver
// ========================================
model DataLineage {
  id              String   @id @default(cuid())
  silverRecordId  String   @unique // FK to PfaRecord (or other Silver table)
  silverModel     String   // "PfaRecord" | "AssetMaster"
  bronzeRecordId  String   // FK to BronzeRecord

  // Snapshot of Mapping Rules Applied
  mappingRules    Json     // Copy of ApiFieldMapping at transform time

  // Transformation Metadata
  transformedAt   DateTime @default(now())
  transformedBy   String   // Service/User ID

  // Relations
  bronzeRecord    BronzeRecord @relation(fields: [bronzeRecordId], references: [id])
  pfaRecord       PfaRecord?   @relation(fields: [silverRecordId], references: [id])

  @@index([silverRecordId])
  @@index([bronzeRecordId])
}
```

### Phase 1C: Intelligence Layer (KPIs)

```prisma
// ========================================
// GOLD LAYER: User-Defined Analytics
// ========================================
model KpiDefinition {
  id             String   @id @default(cuid())
  organizationId String
  name           String   // "Total Spend with Tax"
  description    String?

  // THE FORMULA
  formula        String   // "{monthlyRate} * {quantity} * 1.15"
  formulaType    String   @default("mathjs") // "mathjs" | "jsonlogic" (future)

  // Display Options
  format         String   @default("number") // "currency" | "percentage" | "number"
  colorScale     Boolean  @default(false) // Use red/green based on value
  sortOrder      Int      @default(0)

  // AI Hook: Usage Tracking
  executionCount Int      @default(0)
  avgExecutionTime Int?   // milliseconds
  lastExecutedAt DateTime?

  // Audit
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  createdBy      String
  isActive       Boolean  @default(true)

  // Relations
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  executions     KpiExecutionLog[]

  @@index([organizationId, isActive])
}

// AI Hook: Execution History
model KpiExecutionLog {
  id                String   @id @default(cuid())
  kpiId             String
  userId            String
  executedAt        DateTime @default(now())

  // Input/Output for AI Learning
  inputRecordCount  Int
  inputSample       Json     // Sample of input records (first 10)
  outputValue       Float    // Calculated result
  executionTime     Int      // milliseconds

  // AI Hook: User Feedback
  userRating        Int?     // 1-5 stars

  // Relations
  kpi               KpiDefinition @relation(fields: [kpiId], references: [id], onDelete: Cascade)

  @@index([kpiId, executedAt])
}
```

### Phase 1D: AI Data Hooks

```prisma
// ========================================
// AI HOOK: Transformation Performance
// ========================================
model TransformationMetrics {
  id               String   @id @default(cuid())
  mappingId        String
  batchId          String
  executedAt       DateTime @default(now())

  // Performance Tracking
  recordsProcessed Int
  totalLatency     Int      // milliseconds
  avgLatency       Float    // ms per record
  errorCount       Int

  @@index([mappingId, executedAt])
  @@index([batchId])
}

// ========================================
// AI HOOK: User Intent Logging
// ========================================
model UserActionLog {
  id             String   @id @default(cuid())
  userId         String
  actionType     String   // "create_mapping" | "create_kpi" | "view_lineage"
  actionContext  Json     // { endpointId: "...", mappingId: "..." }
  timestamp      DateTime @default(now())

  // Natural Language Intent (Optional)
  userIntent     String?  // "I want to map cost field"

  // Success Tracking
  wasSuccessful  Boolean  @default(true)
  errorMessage   String?

  @@index([userId, actionType])
  @@index([timestamp])
}
```

---

## 🔌 3. API Architecture (Backend)

### Service A: Ingestion Service (The Courier)

**File**: `backend/src/services/pems/PemsIngestionService.ts`

**Goal**: Fetch data from PEMS and dump to BronzeRecord as fast as possible.

**Implementation**:
```typescript
export class PemsIngestionService {
  /**
   * Ingest data from PEMS endpoint to Bronze layer
   * @param endpointId - ApiEndpoint to sync from
   * @param syncType - "full" or "delta"
   * @returns Batch metadata
   */
  async ingestBatch(
    endpointId: string,
    syncType: "full" | "delta"
  ): Promise<BronzeBatch> {
    const endpoint = await this.loadEndpointConfig(endpointId);
    const server = await this.loadServerConfig(endpoint.serverId);

    // 1. Calculate Delta (if supported)
    let lastSyncTime: Date | null = null;
    if (syncType === "delta" && endpoint.supportsDelta) {
      lastSyncTime = await this.getLastSyncTime(endpointId);
    }

    // 2. Build Request URL
    const url = this.buildRequestUrl(server, endpoint, lastSyncTime);

    // 3. Fetch from PEMS (paginated, 10K records per page)
    const records: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.fetchPage(url, page, 10000);
      records.push(...response.data);
      hasMore = response.hasMore;
      page++;
    }

    // 4. Generate Batch ID
    const syncBatchId = `batch-${Date.now()}-${endpoint.id}`;

    // 5. Bulk Insert to BronzeRecord (NO VALIDATION)
    await prisma.bronzeRecord.createMany({
      data: records.map(rawJson => ({
        id: uuid(),
        syncBatchId,
        organizationId: server.organizationId,
        entityType: endpoint.targetModel,
        rawJson,
        schemaVersion: this.computeSchemaHash(rawJson)
      }))
    });

    // 6. Create Batch Metadata (AI Hook)
    const batch = await prisma.bronzeBatch.create({
      data: {
        syncBatchId,
        organizationId: server.organizationId,
        endpointId: endpoint.id,
        entityType: endpoint.targetModel,
        recordCount: records.length,
        validRecordCount: records.length, // Validation happens in Transformation
        invalidRecordCount: 0,
        schemaFingerprint: this.computeSchemaFingerprint(records),
        warnings: [],
        completedAt: new Date()
      }
    });

    return batch;
  }

  /**
   * Compute schema fingerprint for anomaly detection
   */
  private computeSchemaFingerprint(records: any[]): object {
    const sample = records.slice(0, 100);
    const fields = new Set<string>();
    const types: Record<string, string> = {};

    sample.forEach(record => {
      Object.keys(record).forEach(key => {
        fields.add(key);
        if (!(key in types)) {
          types[key] = typeof record[key];
        }
      });
    });

    return {
      fields: Array.from(fields).sort(),
      types
    };
  }
}
```

---

### Service B: Transformation Service (The Factory)

**File**: `backend/src/services/pems/PemsTransformationService.ts`

**Goal**: Clean data from Bronze and promote to Silver (PfaRecord).

**Implementation**:
```typescript
export class PemsTransformationService {
  /**
   * Transform Bronze records to Silver layer
   * @param syncBatchId - Batch to process
   * @param options - { fullSync: boolean }
   */
  async transformBatch(
    syncBatchId: string,
    options: { fullSync?: boolean } = {}
  ): Promise<TransformationResult> {
    // 1. Load Rules
    const batch = await prisma.bronzeBatch.findUnique({
      where: { syncBatchId }
    });
    const endpoint = await prisma.apiEndpoint.findUnique({
      where: { id: batch.endpointId },
      include: {
        mappings: {
          where: {
            isActive: true
            // NOTE: For "Time Travel" replay operations, ensure mapping lookup
            // respects validFrom/validTo dates matching Bronze.ingestedAt timestamp.
            // Example: Replaying March 2025 Bronze data should use March 2025 rules.
          }
        }
      }
    });

    // 2. Stream Bronze Records (chunk by 1,000)
    const bronzeRecords = await prisma.bronzeRecord.findMany({
      where: { syncBatchId },
      orderBy: { ingestedAt: 'asc' }
    });

    const results = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    // 3. Process in Batches
    for (let i = 0; i < bronzeRecords.length; i += 1000) {
      const chunk = bronzeRecords.slice(i, i + 1000);

      await prisma.$transaction(async (tx) => {
        for (const bronze of chunk) {
          // 3a. Apply Promotion Filters (Quality Gate)
          if (!this.passesPromotionRules(bronze.rawJson, endpoint.promotionRules)) {
            results.skipped++;
            continue;
          }

          // 3b. Map Fields
          const mapped = this.applyFieldMappings(bronze.rawJson, endpoint.mappings);

          // 3c. Upsert to Silver
          try {
            const silver = await tx.pfaRecord.upsert({
              where: { id: mapped.id },
              create: {
                ...mapped,
                lastSeenAt: new Date(),
                bronzeRecordId: bronze.id
              },
              update: {
                ...mapped,
                lastSeenAt: new Date()
              }
            });

            // 3d. Create Data Lineage (AI Hook)
            await tx.dataLineage.upsert({
              where: { silverRecordId: silver.id },
              create: {
                silverRecordId: silver.id,
                silverModel: "PfaRecord",
                bronzeRecordId: bronze.id,
                mappingRules: endpoint.mappings,
                transformedAt: new Date(),
                transformedBy: "PemsTransformationService"
              },
              update: {
                mappingRules: endpoint.mappings,
                transformedAt: new Date()
              }
            });

            results.updated++;
          } catch (error) {
            results.errors.push({
              recordId: bronze.id,
              error: error.message
            });
          }
        }
      });
    }

    // 4. Orphan Detection (Full Sync Only)
    if (options.fullSync) {
      await this.flagOrphanedRecords(batch.organizationId, syncBatchId);
    }

    return results;
  }

  /**
   * Apply field mappings with transformation
   */
  private applyFieldMappings(
    rawJson: any,
    mappings: ApiFieldMapping[]
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const mapping of mappings) {
      let value = rawJson[mapping.sourceField];

      // Apply default if missing
      if (value === null || value === undefined) {
        value = mapping.defaultValue;
      }

      // Apply transformation
      if (mapping.transformType && value !== null) {
        value = this.transform(value, mapping.transformType, mapping.transformParams);
      }

      // Cast data type
      value = this.castType(value, mapping.dataType);

      result[mapping.destinationField] = value;
    }

    return result;
  }

  /**
   * Transform value based on transformType
   */
  private transform(value: any, type: string, params: any): any {
    switch (type) {
      case "uppercase":
        return String(value).toUpperCase();
      case "lowercase":
        return String(value).toLowerCase();
      case "date_format":
        return moment(value).format(params.dateFormat || "YYYY-MM-DD");
      default:
        return value;
    }
  }

  /**
   * Flag records not seen in this sync as orphaned
   */
  private async flagOrphanedRecords(organizationId: string, syncBatchId: string): Promise<void> {
    const cutoffTime = await prisma.bronzeBatch.findUnique({
      where: { syncBatchId },
      select: { ingestedAt: true }
    });

    await prisma.pfaRecord.updateMany({
      where: {
        organizationId,
        lastSeenAt: { lt: cutoffTime.ingestedAt }
      },
      data: {
        isDiscontinued: true
      }
    });
  }
}
```

---

### Service C: Intelligence Service (The Brain)

**File**: `backend/src/services/kpi/KpiCalculator.ts`

**Goal**: Calculate KPIs using mathjs formulas.

**Implementation**:
```typescript
import { create, all } from 'mathjs';

const math = create(all);

// Sandbox: Disable dangerous functions
const limitedMath = math.create({
  ...all,
  import: undefined,
  createUnit: undefined,
  eval: undefined,
  parse: undefined,
  simplify: undefined,
  derivative: undefined
});

export class KpiCalculator {
  /**
   * Calculate KPI for organization
   * @param kpiId - KpiDefinition ID
   * @param organizationId - Filter records by org
   * @returns Calculated value
   */
  async calculate(kpiId: string, organizationId: string): Promise<number> {
    // 1. Load KPI Definition
    const kpi = await prisma.kpiDefinition.findUnique({
      where: { id: kpiId }
    });

    if (!kpi || kpi.organizationId !== organizationId) {
      throw new Error("KPI not found or access denied");
    }

    // 2. Fetch Silver Records
    const records = await prisma.pfaRecord.findMany({
      where: { organizationId }
    });

    // 3. Evaluate Formula for Each Record
    const results: number[] = [];
    const startTime = Date.now();

    for (const record of records) {
      try {
        const value = this.evaluateFormula(kpi.formula, record);
        results.push(value);
      } catch (error) {
        console.error(`KPI calculation error for record ${record.id}:`, error);
      }
    }

    // 4. Aggregate Results (Sum by default)
    const total = results.reduce((sum, val) => sum + val, 0);

    // 5. Log Execution (AI Hook)
    await prisma.kpiExecutionLog.create({
      data: {
        kpiId: kpi.id,
        userId: "system", // Or pass from request context
        inputRecordCount: records.length,
        inputSample: records.slice(0, 10),
        outputValue: total,
        executionTime: Date.now() - startTime
      }
    });

    return total;
  }

  /**
   * Evaluate mathjs formula with record data
   * @param formula - e.g., "{cost} * 1.15"
   * @param record - PfaRecord
   * @returns Calculated value
   */
  evaluateFormula(formula: string, record: any): number {
    // Replace {fieldName} with actual values
    const scope: Record<string, any> = {};
    const placeholders = formula.match(/\{(\w+)\}/g) || [];

    for (const placeholder of placeholders) {
      const fieldName = placeholder.slice(1, -1); // Remove { }
      scope[fieldName] = record[fieldName] || 0;
    }

    // Replace placeholders with variable names
    let mathExpression = formula;
    for (const placeholder of placeholders) {
      const fieldName = placeholder.slice(1, -1);
      mathExpression = mathExpression.replace(placeholder, fieldName);
    }

    // Evaluate safely
    try {
      return limitedMath.evaluate(mathExpression, scope);
    } catch (error) {
      throw new Error(`Formula evaluation failed: ${error.message}`);
    }
  }
}
```

---

### API Endpoints

**File**: `backend/src/controllers/connectivityController.ts`

```typescript
// ========================================
// API SERVERS
// ========================================
router.post("/api/servers", requirePermission("admin"), async (req, res) => {
  const { name, baseUrl, authType, credentials } = req.body;

  // Validate
  const schema = z.object({
    name: z.string().min(1),
    baseUrl: z.string().url(),
    authType: z.enum(["BASIC", "OAUTH", "API_KEY"]),
    credentials: z.object({
      username: z.string().optional(),
      password: z.string().optional(),
      apiKey: z.string().optional()
    })
  });

  const validated = schema.parse(req.body);

  // Encrypt credentials
  const encryptedCredentials = encrypt(JSON.stringify(validated.credentials));

  // Create server
  const server = await prisma.apiServer.create({
    data: {
      organizationId: req.user.organizationId,
      name: validated.name,
      baseUrl: validated.baseUrl,
      authType: validated.authType,
      encryptedCredentials,
      createdBy: req.user.id
    }
  });

  res.json({ success: true, server });
});

// ========================================
// FIELD MAPPINGS
// ========================================
router.post("/api/mappings", requirePermission("admin"), async (req, res) => {
  const { endpointId, sourceField, destinationField, dataType } = req.body;

  const mapping = await prisma.apiFieldMapping.create({
    data: {
      endpointId,
      sourceField,
      destinationField,
      dataType: dataType || "string",
      createdBy: req.user.id
    }
  });

  res.json({ success: true, mapping });
});

// ========================================
// KPI DEFINITIONS
// ========================================
router.post("/api/kpis", requirePermission("admin"), async (req, res) => {
  const { name, formula, format } = req.body;

  // Validate formula
  const kpiCalc = new KpiCalculator();
  const isValid = kpiCalc.validateFormula(formula);

  if (!isValid) {
    return res.status(400).json({ error: "Invalid formula syntax" });
  }

  const kpi = await prisma.kpiDefinition.create({
    data: {
      organizationId: req.user.organizationId,
      name,
      formula,
      format: format || "number",
      createdBy: req.user.id
    }
  });

  res.json({ success: true, kpi });
});

// ========================================
// INGESTION (Start Sync)
// ========================================
router.post("/api/sync/ingest", requirePermission("admin"), async (req, res) => {
  const { endpointId, syncType } = req.body;

  const service = new PemsIngestionService();
  const batch = await service.ingestBatch(endpointId, syncType);

  res.json({ success: true, batch });
});

// ========================================
// TRANSFORMATION
// ========================================
router.post("/api/sync/transform", requirePermission("admin"), async (req, res) => {
  const { syncBatchId, fullSync } = req.body;

  const service = new PemsTransformationService();
  const result = await service.transformBatch(syncBatchId, { fullSync });

  res.json({ success: true, result });
});
```

---

## 🎨 4. Frontend Architecture (React)

### Component Tree

```
<AdminDashboard>
  ├─ <ConnectivityManager>
  │    ├─ <ApiServerList>
  │    │    ├─ <ServerCard> (repeatable)
  │    │    │    ├─ Server name, status, health
  │    │    │    └─ [Edit] [Delete] [Test] buttons
  │    │    └─ [+ Add Server] button
  │    └─ <ServerFormModal>
  │         ├─ Name, Base URL, Auth Type inputs
  │         ├─ Credentials inputs (dynamic based on authType)
  │         └─ [Test Connection] [Cancel] [Save] buttons
  │
  ├─ <MappingStudio>
  │    ├─ <EndpointSelector>
  │    ├─ <MappingPanel>
  │    │    ├─ <PemsFieldsList> (left column)
  │    │    ├─ <PfaFieldsList> (right column)
  │    │    └─ <MappingLine> (visual connection)
  │    ├─ <PreviewPanel>
  │    │    ├─ Sample Bronze data
  │    │    ├─ Sample mapped data
  │    │    └─ Warnings list
  │    └─ <MappingActions>
  │         └─ [Apply Mapping] [Reset] [Cancel]
  │
  ├─ <FormulaBuilder>
  │    ├─ <KpiList>
  │    │    └─ <KpiCard> (repeatable)
  │    ├─ <KpiFormModal>
  │    │    ├─ Name input
  │    │    ├─ Formula input (with autocomplete)
  │    │    ├─ Format selector
  │    │    ├─ <PreviewPanel>
  │    │    │    ├─ Sample calculation
  │    │    │    └─ Validation errors
  │    │    └─ [Test Formula] [Save KPI] buttons
  │    └─ [+ New KPI] button
  │
  └─ <SyncStatusDashboard>
       ├─ <IngestionProgress>
       ├─ <TransformationProgress>
       └─ <SyncHistory>
```

### State Management

**Tool**: React Query + Zustand

**React Query Keys**:
```typescript
['servers', organizationId]
['endpoints', serverId]
['mappings', endpointId]
['kpis', organizationId]
['bronze-preview', endpointId]
```

---

## 🚀 5. Implementation Phases

### Phase 1: Database Foundation (2 days)
**Agent**: `postgres-jsonb-architect`

**Deliverables**:
- [ ] Create 3-tier connectivity tables (ApiServer, ApiEndpoint, ApiFieldMapping)
- [ ] Create Bronze layer tables (BronzeRecord, BronzeBatch)
- [ ] Add lastSeenAt to PfaRecord
- [ ] Create DataLineage table
- [ ] Create KpiDefinition and KpiExecutionLog
- [ ] Create AI hook tables (TransformationMetrics, UserActionLog)
- [ ] Run Prisma migrations
- [ ] Seed test data
- [ ] **Docker Compose**: Create `docker-compose.yml` for local Postgres (and optional Redis) setup to ensure consistent dev environments across team

**Verification**:
- [ ] All migrations apply without errors
- [ ] Can query all new tables
- [ ] Indexes created correctly
- [ ] Docker Compose brings up Postgres successfully (`docker-compose up -d`)

---

### Phase 2: Ingestion Service (3 days)
**Agent**: `backend-architecture-optimizer`

**Deliverables**:
- [ ] Implement PemsIngestionService
- [ ] Delta sync logic (check last timestamp)
- [ ] Schema fingerprinting
- [ ] Bulk insert optimization
- [ ] Test connection endpoint
- [ ] Unit tests (>95% coverage)

**Verification**:
- [ ] Can ingest 10K records in <30 seconds
- [ ] Bronze records contain raw PEMS JSON
- [ ] BronzeBatch metadata populated correctly

---

### Phase 3: Transformation Service (4 days)
**Agent**: `backend-architecture-optimizer`

**Deliverables**:
- [ ] Implement PemsTransformationService
- [ ] Field mapping logic
- [ ] Data type casting
- [ ] Transformation functions (uppercase, date_format, etc.)
- [ ] Promotion filters (JsonLogic integration)
- [ ] Orphan detection
- [ ] Data lineage tracking
- [ ] Unit tests (>95% coverage)

**Verification**:
- [ ] Can transform 1K records in <2 seconds
- [ ] Silver records match Bronze via DataLineage
- [ ] Orphaned records flagged correctly

---

### Phase 4: Intelligence Engine (3 days)
**Agent**: `backend-architecture-optimizer`

**Deliverables**:
- [ ] Implement KpiCalculator
- [ ] Mathjs integration with sandboxing
- [ ] Formula validation
- [ ] KPI execution logging
- [ ] Unit tests (>90% coverage)

**Verification**:
- [ ] Can calculate KPI on 20K records in <500ms
- [ ] Formula errors caught and reported
- [ ] KpiExecutionLog populated

---

### Phase 5: Admin UI (5 days)
**Agent**: `react-ai-ux-specialist`

**Deliverables**:
- [ ] ConnectivityManager component (Server CRUD)
- [ ] MappingStudio component (Drag-and-drop)
- [ ] FormulaBuilder component (KPI editor)
- [ ] SyncStatusDashboard component
- [ ] **Real-Time Feedback**: Implement `useSyncStatus` hook (polling every 3s or SSE) to update dashboard progress bars automatically when long-running syncs complete
- [ ] React Query integration
- [ ] Optimistic UI for all mutations
- [ ] Component tests (>70% coverage)

**Verification**:
- [ ] All CRUD operations work
- [ ] Drag-and-drop mapping intuitive
- [ ] Formula autocomplete works
- [ ] UI matches UX_SPEC.md
- [ ] Sync dashboard updates automatically without page refresh

---

### Phase 6: Safety & Optimization (3 days)
**Agents**: `backend-architecture-optimizer` + `ai-security-red-teamer`

**Deliverables**:
- [ ] Source filters UI (edit defaultParams)
- [ ] Promotion filters UI (JsonLogic editor)
- [ ] Bronze pruning cron job (archive after 90 days)
- [ ] Security audit (SQL injection, XSS, IDOR)
- [ ] Performance optimization
- [ ] Load testing

**Verification**:
- [ ] All security tests passing
- [ ] Performance benchmarks met
- [ ] Pruning cron job works

---

## 📚 Related Documentation

- **Decision**: [ADR-007-DECISION.md](./ADR-007-DECISION.md)
- **AI Opportunities**: [ADR-007-AI_OPPORTUNITIES.md](./ADR-007-AI_OPPORTUNITIES.md)
- **UX Specification**: [ADR-007-UX_SPEC.md](./ADR-007-UX_SPEC.md)
- **Test Plan**: [ADR-007-TEST_PLAN.md](./ADR-007-TEST_PLAN.md)
- **Agent Workflow**: [ADR-007-AGENT_WORKFLOW.md](./ADR-007-AGENT_WORKFLOW.md)

---

**Status**: 🔴 Draft - Awaiting Architecture Review
**Total Estimated Duration**: 20 days
**Next Step**: Review with backend and frontend architects

*Document created: 2025-11-27*
*Last updated: 2025-11-27 (Enhanced with Docker Compose, Real-Time Sync Feedback, and Rule Versioning Notes)*
