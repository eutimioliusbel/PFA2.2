# Multiverse Scenario Simulator - Quick Start Guide

**For**: BEO Executives
**Feature**: UC-25 What-If Analysis with Monte Carlo Risk Modeling
**Access Level**: Requires `perm_ViewAllOrgs` capability

---

## What is the Scenario Simulator?

The Scenario Simulator lets you ask "what if?" questions about your equipment portfolio:

- **"What if weather delays all projects by 2 weeks?"**
- **"What if we switch to a cheaper vendor?"**
- **"What if we consolidate equipment to reduce costs?"**

Instead of guessing, you get:
- ✅ Exact cost impact ($)
- ✅ Timeline impact (days)
- ✅ Equipment impact (count)
- ✅ Risk analysis (P10/P50/P90 probability distribution)

---

## 5 Scenario Types

### 1. Timeline Shift
**Question**: "What if all equipment dates shift by X days?"

**Use Cases**:
- Weather delays
- Project schedule changes
- Supply chain disruptions

**Example**: Shift all rentals forward by 30 days
```json
{
  "type": "timeline_shift",
  "shiftDays": 30
}
```

**Impact**: Duration increases, cost stays same

---

### 2. Vendor Switch
**Question**: "What if we switch from Vendor A to Vendor B?"

**Use Cases**:
- Vendor pricing negotiations
- Contract renewals
- Alternative sourcing analysis

**Example**: Switch all cranes from Acme to Better Rentals
```json
{
  "type": "vendor_switch",
  "sourceVendor": "Acme Rentals",
  "targetVendor": "Better Rentals"
}
```

**Impact**: Cost typically decreases by ~15% (industry average)

---

### 3. Equipment Consolidation
**Question**: "What if we consolidate overlapping equipment rentals?"

**Use Cases**:
- Cost reduction initiatives
- Equipment sharing between projects
- Budget optimization

**Example**: Remove bottom 30% of equipment by cost
```json
{
  "type": "consolidation",
  "consolidationPercent": 30
}
```

**Impact**: Equipment count decreases, cost decreases

---

### 4. Budget Cut
**Question**: "What if we reduce equipment budget by X%?"

**Use Cases**:
- Budget shortfall scenarios
- Cost containment planning
- Rate negotiation targets

**Example**: Reduce all equipment rates by 15%
```json
{
  "type": "budget_cut",
  "budgetCutPercent": 15
}
```

**Impact**: Cost decreases proportionally

---

### 5. Weather Delay (Monte Carlo)
**Question**: "What if random weather delays affect all projects?"

**Use Cases**:
- Risk assessment for board presentations
- Contingency planning
- P50/P90 budget forecasting

**Example**: Model weather delays averaging 20 days (with randomization)
```json
{
  "type": "weather_delay",
  "shiftDays": 20,
  "monteCarloEnabled": true,
  "iterations": 1000
}
```

**Impact**: Provides probability distribution (P10 = best case, P90 = worst case)

---

## How to Use (API)

### Step 1: Run a Simulation

**Endpoint**: `POST /api/beo/scenario/simulate`

**Request**:
```bash
curl -X POST http://localhost:3001/api/beo/scenario/simulate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "organizationIds": ["org-id-1", "org-id-2"],
    "parameters": {
      "type": "timeline_shift",
      "shiftDays": 30
    }
  }'
```

**Response**:
```json
{
  "success": true,
  "scenarioId": "SIM-12ABC-XYZ",
  "scenarioType": "timeline_shift",
  "impact": {
    "costDelta": 50000,
    "costDeltaPercent": 10.5,
    "durationDelta": 30,
    "durationDeltaPercent": 8.2,
    "equipmentDelta": 0,
    "equipmentDeltaPercent": 0
  },
  "baselineMetrics": {
    "totalCost": 476000,
    "totalDuration": 365,
    "equipmentCount": 10
  },
  "scenarioMetrics": {
    "totalCost": 526000,
    "totalDuration": 395,
    "equipmentCount": 10
  }
}
```

### Step 2: Compare Scenarios

**Endpoint**: `POST /api/beo/scenario/compare`

**Request**:
```bash
curl -X POST http://localhost:3001/api/beo/scenario/compare \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "scenarioIds": ["SIM-12ABC-XYZ", "SIM-45DEF-UVW"]
  }'
```

**Response**:
```json
{
  "success": true,
  "scenarios": [...],
  "comparisonMatrix": {
    "scenarioIds": ["SIM-12ABC-XYZ", "SIM-45DEF-UVW"],
    "metrics": {
      "totalCost": {
        "baseline": [476000, 476000],
        "scenario": [526000, 498000],
        "delta": [50000, 22000]
      }
    }
  }
}
```

---

## How to Use (UI)

### Step 1: Open Scenario Builder
- Navigate to BEO Dashboard
- Click "Scenario Simulator" button
- Wizard opens

### Step 2: Select Scenario Type
- Choose from 5 visual cards
- Each card shows icon, title, and description
- Click to select

### Step 3: Configure Parameters
- **Timeline Shift**: Enter days (positive = delay, negative = advance)
- **Vendor Switch**: Enter source and target vendor names
- **Consolidation**: Slide percentage (0-100%)
- **Budget Cut**: Slide percentage (0-50%)
- **Weather Delay**: Enter average delay days

### Step 4: Select Organizations
- Radio: "All Organizations" or "Specific Organizations"
- If specific: Check boxes to select

### Step 5: Enable Monte Carlo (Optional)
- Check "Enable Monte Carlo Simulation"
- Runs 1,000 iterations for risk analysis
- Takes ~25 seconds (vs. <2 seconds for single run)

### Step 6: Run Simulation
- Click "Run Simulation"
- Wait for results (2-25 seconds)
- Dashboard displays automatically

### Step 7: Review Results
- **Impact Cards**: Cost, Duration, Equipment (color-coded)
- **Comparison Table**: Baseline vs. Scenario
- **Monte Carlo**: P10/P50/P90 cards (if enabled)

---

## Understanding Results

### Impact Summary

**Positive Delta (Red)**: Increase (bad)
- Cost Delta: +$50,000 means budget EXCEEDED by $50K
- Duration Delta: +30 days means schedule DELAYED by 30 days

**Negative Delta (Green)**: Decrease (good)
- Cost Delta: -$50,000 means budget SAVED $50K
- Equipment Delta: -3 means 3 fewer equipment items

### Monte Carlo Risk Analysis

**P10 (Best Case)**: 10% chance cost will be BELOW this
**P50 (Median)**: 50% chance cost will be BELOW this (typical case)
**P90 (Worst Case)**: 90% chance cost will be BELOW this (only 10% chance of exceeding)

**Example**:
```
P10: $480,000  (Optimistic - weather cooperates)
P50: $520,000  (Expected - average weather)
P90: $580,000  (Pessimistic - bad weather)
```

**For Board Presentations**:
- Use P50 for "most likely" scenario
- Use P90 for "contingency budget"
- Range: P10 to P90 shows risk exposure

---

## Common Use Cases

### Use Case 1: Budget Shortfall Planning
**Scenario**: Board cuts equipment budget by 15%

**Steps**:
1. Select "Budget Cut"
2. Set `budgetCutPercent: 15`
3. Select all organizations
4. Run simulation
5. Review equipment impact (how many items must be cut)

**Decision**: If equipment delta is acceptable, proceed with cuts

---

### Use Case 2: Vendor Negotiation
**Scenario**: Evaluating switch from expensive Vendor A to cheaper Vendor B

**Steps**:
1. Select "Vendor Switch"
2. Set `sourceVendor: "Acme Rentals"` and `targetVendor: "Better Rentals"`
3. Select affected organizations
4. Run simulation
5. Review cost savings

**Decision**: If savings > switching costs, negotiate with Vendor B

---

### Use Case 3: Winter Weather Risk Assessment
**Scenario**: Estimating P90 budget for winter delays (for board presentation)

**Steps**:
1. Select "Weather Delay"
2. Set `shiftDays: 20` (average winter delay)
3. Check "Enable Monte Carlo"
4. Select all winter-affected organizations
5. Run simulation (wait 25 seconds)
6. Review P10/P50/P90 results

**Decision**: Use P90 value for contingency budget recommendation

---

### Use Case 4: Equipment Consolidation Analysis
**Scenario**: CFO wants to know impact of cutting bottom 25% of equipment

**Steps**:
1. Select "Equipment Consolidation"
2. Set `consolidationPercent: 25`
3. Select target organizations
4. Run simulation
5. Review which equipment is removed (lowest cost items first)

**Decision**: If affected equipment is non-critical, proceed with consolidation

---

## Advanced: Comparing Multiple Scenarios

### Example: Compare 3 Budget Cut Options

**Scenario 1**: 10% budget cut
**Scenario 2**: 15% budget cut
**Scenario 3**: 20% budget cut

**Steps**:
1. Run 3 separate simulations (save scenarioIds)
2. Use Compare API with all 3 scenarioIds
3. Review comparison matrix

**Output**:
```
Scenario      Cost Impact   Equipment Impact
10% Cut       -$50,000      -2 items
15% Cut       -$75,000      -4 items
20% Cut       -$100,000     -7 items
```

**Decision**: Choose scenario that balances cost savings vs. operational impact

---

## Tips & Best Practices

### Tip 1: Start with Timeline Shift
- Simplest scenario type
- Good for testing the feature
- Zero cost impact, only timeline

### Tip 2: Use Monte Carlo for Board Presentations
- Executives expect P50/P90 analysis
- Shows you've considered risk
- Demonstrates due diligence

### Tip 3: Compare 2-3 Scenarios (Not 5)
- More than 3 is hard to visualize
- Focus on "low/medium/high" variants
- Example: 10%, 15%, 20% budget cuts

### Tip 4: Name Your Scenarios Clearly
- Frontend auto-generates scenarioId
- Keep track of which scenario is which
- Use descriptive parameters

### Tip 5: Run Simulations in Sequence
- Don't run 10 simulations simultaneously
- Each simulation locks database resources
- Run, review, then run next

---

## Troubleshooting

### Error: "BEO portfolio access required"
**Cause**: User lacks `perm_ViewAllOrgs` capability
**Fix**: Contact admin to grant BEO access

### Error: "organizationIds must be a non-empty array"
**Cause**: No organizations selected
**Fix**: Select at least one organization

### Error: "shiftDays must be between -365 and 365"
**Cause**: Invalid parameter range
**Fix**: Use valid range (-365 to +365)

### Simulation takes >30 seconds
**Cause**: Monte Carlo with >1000 iterations, or slow database
**Fix**:
- Reduce iterations to 1000 (default)
- Check database performance
- Reduce organization count

### Results seem incorrect
**Cause**: Missing or incorrect PFA data in database
**Fix**:
- Verify PFA records exist for selected organizations
- Check `monthlyRate` and `forecastStart/End` fields
- Run PEMS sync to refresh data

---

## API Reference

### Endpoints

```
POST   /api/beo/scenario/simulate           Run scenario simulation
GET    /api/beo/scenario/list               List user's scenarios
POST   /api/beo/scenario/compare            Compare scenarios
GET    /api/beo/scenario/:scenarioId        Get specific scenario
GET    /api/beo/scenario/:scenarioId/export-pdf  Export PDF (501 placeholder)
```

### Authentication
All endpoints require:
- JWT token in `Authorization: Bearer <token>` header
- User must have `perm_ViewAllOrgs` capability

### Rate Limiting
- 100 requests per 15 minutes (global)
- Single scenarios: ~2 seconds each
- Monte Carlo scenarios: ~25 seconds each

---

## Support

**Questions**: Contact BEO support team
**Bug Reports**: File issue in project repository
**Feature Requests**: Submit via product feedback form

**Documentation**:
- Full specification: `docs/UC-25-SPECIFICATION.md` (this file)
- Implementation summary: `temp/UC25_SCENARIO_SIMULATOR_IMPLEMENTATION_SUMMARY.md`
- Acceptance criteria: `temp/UC25_ACCEPTANCE_CRITERIA_VERIFICATION.md`
