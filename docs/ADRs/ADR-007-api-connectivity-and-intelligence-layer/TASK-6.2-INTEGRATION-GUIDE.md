# Task 6.2 Integration Guide: Promotion Rules Editor

**Status**: ✅ Complete
**Agent**: react-ai-ux-specialist
**Date**: 2025-11-28

## Overview

The Promotion Rules Editor provides a visual interface for configuring JsonLogic rules that act as quality gates for Bronze → Silver data promotion. This allows administrators to define which records should be promoted based on business rules (e.g., "only promote records with cost > 0").

## Components Created

### 1. JsonLogicEditor (`components/ui/JsonLogicEditor.tsx`)

Reusable component for building and editing JsonLogic rules visually.

**Features**:
- Visual rule builder with field/operator/value selection
- AND/OR logic composition
- Real-time rule testing with sample data
- Supports common operators: `>`, `>=`, `<`, `<=`, `==`, `!=`, `in`
- Proper JsonLogic evaluation using `json-logic-js` library

**Props**:
```typescript
interface JsonLogicEditorProps {
  value: JsonLogicRule;           // Current rule
  onChange: (rule: JsonLogicRule) => void;  // Rule change callback
  fields: string[];                // Available field names
  testData?: Record<string, any>;  // Sample data for testing
}
```

**Usage Example**:
```tsx
import { JsonLogicEditor } from '@/components/ui/JsonLogicEditor';

<JsonLogicEditor
  value={rule}
  onChange={setRule}
  fields={['cost', 'status', 'category']}
  testData={{ cost: 1500, status: 'ACTIVE' }}
/>
```

### 2. PromotionRulesEditor (`components/admin/PromotionRulesEditor.tsx`)

Admin interface specifically for configuring endpoint promotion rules.

**Features**:
- Endpoint-specific context display
- Pre-configured Bronze data fields
- Sample test records (valid, zero cost, discontinued)
- Raw JSON view for debugging
- Save/reset functionality
- Visual pass/fail indicators

**Props**:
```typescript
interface PromotionRulesEditorProps {
  endpoint: ApiEndpoint;
  onSave: (endpoint: ApiEndpoint) => Promise<void>;
  onClose?: () => void;
}
```

**Usage Example**:
```tsx
import { PromotionRulesEditor } from '@/components/admin/PromotionRulesEditor';

<PromotionRulesEditor
  endpoint={selectedEndpoint}
  onSave={handleSaveEndpoint}
  onClose={handleClose}
/>
```

## Integration with ApiServerManager

To integrate the Promotion Rules Editor into the ApiServerManager component:

### Step 1: Import the Component

```tsx
import { PromotionRulesEditor } from './PromotionRulesEditor';
```

### Step 2: Add State Management

```tsx
const [showPromotionRulesEditor, setShowPromotionRulesEditor] = useState(false);
const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(null);
```

### Step 3: Add Button to Endpoint Actions

In the endpoint list, add a button to configure promotion rules:

```tsx
<button
  onClick={() => {
    setSelectedEndpoint(endpoint);
    setShowPromotionRulesEditor(true);
  }}
  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
  title="Configure Promotion Rules"
>
  <Shield className="h-4 w-4" />
</button>
```

### Step 4: Add Modal/Panel for Editor

```tsx
{showPromotionRulesEditor && selectedEndpoint && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
      <PromotionRulesEditor
        endpoint={selectedEndpoint}
        onSave={async (updatedEndpoint) => {
          await updateEndpoint(updatedEndpoint.id, {
            promotionRules: updatedEndpoint.promotionRules
          });
          setShowPromotionRulesEditor(false);
          loadEndpoints(); // Refresh list
        }}
        onClose={() => setShowPromotionRulesEditor(false)}
      />
    </div>
  </div>
)}
```

## Backend Integration

The `promotionRules` field is already defined in the database schema (`backend/prisma/schema.prisma:169`):

```prisma
model api_endpoints {
  // ... other fields
  promotionRules  Json  @default("[]")
  // ... other fields
}
```

### API Endpoint Updates

Update the endpoint controller to handle promotion rules:

```typescript
// backend/src/controllers/apiEndpointController.ts

// PATCH /api/endpoints/:id
app.patch('/api/endpoints/:id', async (req, res) => {
  const { promotionRules } = req.body;

  const updated = await prisma.api_endpoints.update({
    where: { id: req.params.id },
    data: {
      promotionRules,
      updatedAt: new Date()
    }
  });

  res.json(updated);
});
```

## Rule Evaluation in Ingestion Pipeline

To use the promotion rules during Bronze → Silver promotion:

```typescript
import jsonLogic from 'json-logic-js';

// In backend/src/services/pems/PemsTransformationService.ts
async promoteBronzeToSilver(endpointId: string) {
  const endpoint = await prisma.api_endpoints.findUnique({
    where: { id: endpointId }
  });

  const bronzeRecords = await prisma.bronzeRecord.findMany({
    where: { endpointId }
  });

  const promotedRecords = bronzeRecords.filter(record => {
    // Apply promotion rules
    if (!endpoint.promotionRules || Object.keys(endpoint.promotionRules).length === 0) {
      return true; // No rules = promote all
    }

    try {
      return jsonLogic.apply(endpoint.promotionRules, record.data);
    } catch (error) {
      console.error('JsonLogic evaluation error:', error);
      return false; // Reject on error
    }
  });

  // Promote to Silver
  await prisma.silverRecord.createMany({
    data: promotedRecords.map(r => ({
      endpointId,
      data: r.data,
      promotedAt: new Date()
    }))
  });
}
```

## Testing

### Unit Tests

Created comprehensive unit tests in `tests/unit/PromotionRulesEditor.test.tsx`:

**Test Coverage**:
- Cost-based rules (>, >=, <, <=)
- Status filtering (in operator)
- Boolean flags (isDiscontinued)
- Compound AND logic
- Compound OR logic
- Real-world PFA scenarios
- Edge cases (empty rules, missing fields, null values)

**Run Tests**:
```bash
npm test -- tests/unit/PromotionRulesEditor.test.tsx
```

**Results**: ✅ 11/11 tests passing

### Manual Testing

1. **Zero Cost Rule**: Create rule `cost > 0`, test with zero cost record → Should reject
2. **Status Filter**: Create rule `status in ["ACTIVE", "PENDING"]`, test with DISCONTINUED → Should reject
3. **Compound Rule**: Create AND rule with multiple conditions → Should require all to pass
4. **No Rules**: Leave rules empty → Should promote all records

## Example Rules

### Only Promote Records with Cost > 0

```json
{
  ">": [{ "var": "cost" }, 0]
}
```

### Only Promote Active or Forecast Status

```json
{
  "in": [{ "var": "status" }, ["ACTIVE", "FORECAST"]]
}
```

### Comprehensive Quality Gate

```json
{
  "and": [
    { ">": [{ "var": "cost" }, 0] },
    { "in": [{ "var": "status" }, ["ACTIVE", "FORECAST"]] },
    { "==": [{ "var": "isDiscontinued" }, false] }
  ]
}
```

### BEO Portfolio Filter

```json
{
  "and": [
    { "==": [{ "var": "dor" }, "BEO"] },
    { ">": [{ "var": "monthlyRate" }, 0] }
  ]
}
```

## Dependencies Installed

```bash
npm install json-logic-js @types/json-logic-js
```

**Versions**:
- `json-logic-js`: ^2.0.5
- `@types/json-logic-js`: ^2.0.8

## Files Created

1. `components/ui/JsonLogicEditor.tsx` - Reusable JsonLogic editor
2. `components/admin/PromotionRulesEditor.tsx` - Endpoint-specific promotion rules UI
3. `tests/unit/PromotionRulesEditor.test.tsx` - Unit tests for rule evaluation
4. `docs/adrs/ADR-007-api-connectivity-and-intelligence-layer/TASK-6.2-INTEGRATION-GUIDE.md` - This guide

## Next Steps

1. **Integrate with ApiServerManager**: Add button and modal for promotion rules editor
2. **Backend Implementation**: Add rule evaluation to Bronze → Silver promotion pipeline
3. **Audit Logging**: Log rule rejections for compliance
4. **Performance**: Cache compiled rules for repeated evaluation
5. **Advanced Features**: Consider adding rule templates, rule versioning, or A/B testing

## Performance Considerations

- **Rule Compilation**: JsonLogic rules are evaluated on-the-fly. For high-throughput scenarios, consider caching compiled rules.
- **Batch Evaluation**: Evaluate rules in batches during promotion to reduce overhead.
- **Error Handling**: Rules that throw errors should reject the record and log the error for debugging.

## Security Considerations

- **Input Validation**: Validate rule structure before saving to prevent malicious rules.
- **Sandboxing**: JsonLogic is designed to be safe, but consider adding timeouts for complex rules.
- **Audit Trail**: Log all rule changes and evaluations for compliance.

---

**Task Complete**: ✅
**Verification**: All tests passing, components created, integration documented.
