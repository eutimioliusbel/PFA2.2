# Phase 8 Task 8.5: Multiverse Scenario Simulator (UC 25) - Complete Prompt Bundle

**Agent Assignment**: `ai-systems-architect`
**Estimated Duration**: 1 day
**Status**: Ready for Execution
**Dependencies**: Phase 6 Complete (AI Foundation), Phase 8.1-8.4 Complete

---

## 🎯 Executive Summary

**Mission**: Implement an AI-powered what-if scenario simulator that allows BEO executives to model hypothetical changes to equipment schedules, vendor selections, or project timelines, and visualize the financial and operational impacts across the entire portfolio.

**Business Value**:
- **Risk Mitigation**: Model "what if weather delays all projects by 30 days?"
- **Strategic Planning**: Simulate vendor switches, equipment consolidation, timeline shifts
- **Monte Carlo Analysis**: Run 1,000+ scenarios to identify P50/P90 variance outcomes
- **Board Presentation**: Interactive scenario builder for executive decision-making

**Key Deliverables**:
1. `ScenarioSimulatorService.ts` - What-if analysis engine with Monte Carlo simulation
2. `ScenarioBuilder.tsx` - Interactive scenario configuration UI
3. Impact visualization dashboard (budget, timeline, resource utilization)
4. Scenario comparison table (compare 3-5 scenarios side-by-side)
5. PDF export for board presentations

---

## 📋 Context & Requirements

### Use Case 25: Multiverse Scenario Simulator

**User Story**:
> As a **CFO** (BEO user),
> I want to **simulate hypothetical changes to project schedules and vendor selections**,
> so that I can **understand financial and operational impacts before making decisions**.

**Key Features**:

1. **What-If Scenario Types**:
   - **Timeline Shift**: "What if all rentals shift by +30 days?"
   - **Vendor Switch**: "What if we switch all cranes from Vendor A to Vendor B?"
   - **Equipment Consolidation**: "What if we consolidate 3 cranes into 2?"
   - **Budget Cut**: "What if we reduce equipment budget by 15%?"
   - **Weather Delay**: "What if winter weather delays all projects by 2 weeks?"

2. **Interactive Scenario Builder**:
   - Step 1: Select scenario type (dropdown)
   - Step 2: Configure parameters (e.g., shift days, vendor selection)
   - Step 3: Select organizations to apply scenario (all or subset)
   - Step 4: Run simulation
   - Step 5: View impact dashboard

3. **Impact Visualization**:
   - **Financial Impact**: Total budget change, variance delta
   - **Timeline Impact**: Gantt chart showing shifted schedules
   - **Resource Utilization**: Equipment overlap analysis
   - **Risk Assessment**: Probability distribution of outcomes (Monte Carlo)

4. **Monte Carlo Simulation**:
   - Run 1,000 iterations with randomized variations
   - Example: Weather delay varies from 10-30 days (normal distribution)
   - Output: P50 (median), P90 (worst case), P10 (best case)

5. **Scenario Comparison**:
   - Compare up to 5 scenarios side-by-side
   - Example: "Vendor Switch" vs. "Equipment Consolidation" vs. "Timeline Shift"
   - Highlight best scenario (highest savings, lowest risk)

6. **Export & Presentation**:
   - Export scenario impact as PDF
   - Include charts: Budget impact, timeline visualization, risk distribution
   - Board-ready format with executive summary

---

## 🛠️ Technical Specifications

### Backend Implementation

**File**: `backend/src/services/ai/ScenarioSimulatorService.ts`

```typescript
export class ScenarioSimulatorService {
  /**
   * Simulate what-if scenario and calculate impacts
   *
   * Algorithm:
   * 1. Clone current PFA data (baseline)
   * 2. Apply scenario transformations (shift dates, switch vendors, etc.)
   * 3. Recalculate costs, timelines, resource utilization
   * 4. Compare scenario result vs. baseline
   * 5. Generate impact summary
   */
  async simulateScenario(params: {
    userId: string;
    scenarioType: 'timeline_shift' | 'vendor_switch' | 'consolidation' | 'budget_cut' | 'weather_delay';
    organizationIds: string[]; // 'ALL' or specific orgs
    parameters: {
      shiftDays?: number; // For timeline_shift
      targetVendor?: string; // For vendor_switch
      budgetReductionPercent?: number; // For budget_cut
      weatherDelayRange?: { min: number; max: number }; // For Monte Carlo
    };
    runMonteCarlo?: boolean; // Default: false
    iterations?: number; // Default: 1000 (for Monte Carlo)
  }): Promise<{
    scenarioId: string;
    scenarioType: string;
    baselineMetrics: {
      totalCost: number;
      totalDuration: number; // Days
      equipmentCount: number;
    };
    scenarioMetrics: {
      totalCost: number;
      totalDuration: number;
      equipmentCount: number;
    };
    impact: {
      costDelta: number; // $ change
      costDeltaPercent: number; // % change
      durationDelta: number; // Days change
      equipmentDelta: number; // Count change
    };
    riskAnalysis?: {
      p10: number; // Best case (10th percentile)
      p50: number; // Median
      p90: number; // Worst case (90th percentile)
      probabilityDistribution: Array<{ cost: number; probability: number }>;
    };
    affectedRecords: number; // Count of PFA records changed
    timeline: TimelineComparison; // Baseline vs. Scenario Gantt
  }>;

  /**
   * Apply scenario transformations to PFA data
   *
   * Transformations:
   * - Timeline Shift: Add N days to forecastStart/forecastEnd
   * - Vendor Switch: Replace vendorName, recalculate monthlyRate
   * - Consolidation: Merge overlapping rentals, reduce quantity
   * - Budget Cut: Reduce monthlyRate by X%, or remove low-priority items
   * - Weather Delay: Random delay (normal distribution)
   */
  private applyScenarioTransformations(
    pfaRecords: PfaRecord[],
    scenarioType: string,
    parameters: any
  ): PfaRecord[];

  /**
   * Run Monte Carlo simulation (1000 iterations)
   *
   * Logic:
   * - For each iteration, apply random variation to parameters
   * - Example: Weather delay varies from 10-30 days (μ=20, σ=5)
   * - Calculate cost for each iteration
   * - Aggregate results: P10, P50, P90
   */
  private runMonteCarloSimulation(
    pfaRecords: PfaRecord[],
    scenarioType: string,
    parameters: any,
    iterations: number
  ): Promise<{
    p10: number;
    p50: number;
    p90: number;
    probabilityDistribution: Array<{ cost: number; probability: number }>;
  }>;

  /**
   * Generate timeline comparison (baseline vs. scenario)
   *
   * Output:
   * - Gantt chart data showing:
   *   - Baseline bars (blue)
   *   - Scenario bars (orange)
   *   - Delta arrows showing shifts
   */
  private generateTimelineComparison(
    baselinePfa: PfaRecord[],
    scenarioPfa: PfaRecord[]
  ): TimelineComparison;

  /**
   * Save scenario for future comparison
   */
  async saveScenario(scenarioResult: any): Promise<void>;

  /**
   * Compare multiple scenarios side-by-side
   */
  async compareScenarios(scenarioIds: string[]): Promise<{
    scenarios: Array<{
      scenarioId: string;
      scenarioType: string;
      impact: {
        costDelta: number;
        costDeltaPercent: number;
        durationDelta: number;
      };
    }>;
    recommendation: string; // AI-generated recommendation for best scenario
  }>;
}

interface TimelineComparison {
  baselineStart: Date;
  baselineEnd: Date;
  scenarioStart: Date;
  scenarioEnd: Date;
  shiftDays: number;
  ganttData: Array<{
    pfaId: string;
    category: string;
    baselineBar: { start: Date; end: Date };
    scenarioBar: { start: Date; end: Date };
    delta: number; // Days shifted
  }>;
}
```

**Database Schema Updates**:

```prisma
model ScenarioSimulation {
  id                  String   @id @default(cuid())
  scenarioId          String   @unique
  scenarioType        String
  organizationIds     Json     // Array of org IDs
  parameters          Json     // Scenario configuration
  baselineMetrics     Json
  scenarioMetrics     Json
  impact              Json
  riskAnalysis        Json?    // Monte Carlo results
  timeline            Json     // TimelineComparison
  createdAt           DateTime @default(now())
  createdBy           String

  // Relations
  creator             User     @relation(fields: [createdBy], references: [id])

  @@index([createdBy, createdAt])
}
```

**API Endpoints**:

```typescript
// POST /api/beo/scenario/simulate
router.post('/simulate', requirePermission('perm_ViewAllOrgs'), async (req, res) => {
  const { scenarioType, organizationIds, parameters, runMonteCarlo, iterations } = req.body;

  const result = await scenarioSimulatorService.simulateScenario({
    userId: req.user!.id,
    scenarioType,
    organizationIds,
    parameters,
    runMonteCarlo,
    iterations,
  });

  // Auto-save scenario
  await scenarioSimulatorService.saveScenario(result);

  res.json(result);
});

// GET /api/beo/scenario/list
router.get('/list', requirePermission('perm_ViewAllOrgs'), async (req, res) => {
  const scenarios = await prisma.scenarioSimulation.findMany({
    where: { createdBy: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.json(scenarios);
});

// POST /api/beo/scenario/compare
router.post('/compare', requirePermission('perm_ViewAllOrgs'), async (req, res) => {
  const { scenarioIds } = req.body;

  const comparison = await scenarioSimulatorService.compareScenarios(scenarioIds);
  res.json(comparison);
});

// GET /api/beo/scenario/:scenarioId/export-pdf
router.get('/:scenarioId/export-pdf', async (req, res) => {
  const scenario = await prisma.scenarioSimulation.findUnique({
    where: { scenarioId: req.params.scenarioId },
  });

  const pdf = await generateScenarioPDF(scenario);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Scenario_${scenario!.scenarioType}.pdf"`);
  res.send(pdf);
});
```

---

### Frontend Implementation

**File**: `components/beo/ScenarioBuilder.tsx`

```tsx
import { useState } from 'react';
import { Play, Download, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface ScenarioResult {
  scenarioId: string;
  scenarioType: string;
  baselineMetrics: { totalCost: number; totalDuration: number; equipmentCount: number };
  scenarioMetrics: { totalCost: number; totalDuration: number; equipmentCount: number };
  impact: {
    costDelta: number;
    costDeltaPercent: number;
    durationDelta: number;
    equipmentDelta: number;
  };
  riskAnalysis?: {
    p10: number;
    p50: number;
    p90: number;
    probabilityDistribution: Array<{ cost: number; probability: number }>;
  };
  affectedRecords: number;
  timeline: any;
}

export function ScenarioBuilder() {
  const [scenarioType, setScenarioType] = useState('timeline_shift');
  const [shiftDays, setShiftDays] = useState(30);
  const [targetVendor, setTargetVendor] = useState('');
  const [budgetReduction, setBudgetReduction] = useState(15);
  const [organizationIds, setOrganizationIds] = useState<string[]>(['ALL']);
  const [runMonteCarlo, setRunMonteCarlo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScenarioResult | null>(null);

  const runSimulation = async () => {
    setLoading(true);
    try {
      const parameters: any = {};

      if (scenarioType === 'timeline_shift') {
        parameters.shiftDays = shiftDays;
      } else if (scenarioType === 'vendor_switch') {
        parameters.targetVendor = targetVendor;
      } else if (scenarioType === 'budget_cut') {
        parameters.budgetReductionPercent = budgetReduction;
      } else if (scenarioType === 'weather_delay') {
        parameters.weatherDelayRange = { min: 10, max: 30 }; // Randomized
      }

      const simulationResult = await apiClient.runScenarioSimulation({
        scenarioType,
        organizationIds,
        parameters,
        runMonteCarlo,
        iterations: runMonteCarlo ? 1000 : undefined,
      });

      setResult(simulationResult);
    } catch (error) {
      console.error('Simulation failed:', error);
      alert('Failed to run scenario simulation');
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    if (!result) return;
    const blob = await apiClient.exportScenarioPDF(result.scenarioId);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Scenario_${result.scenarioType}.pdf`;
    a.click();
  };

  return (
    <div className="scenario-builder max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🔮 Multiverse Scenario Simulator</h1>
        <p className="text-gray-600">Model what-if scenarios and visualize portfolio impacts</p>
      </div>

      {/* Scenario Configuration */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Configure Scenario</h2>

        {/* Step 1: Scenario Type */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Step 1: Scenario Type</label>
          <select
            value={scenarioType}
            onChange={(e) => setScenarioType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          >
            <option value="timeline_shift">Timeline Shift (Delay/Advance)</option>
            <option value="vendor_switch">Vendor Switch</option>
            <option value="consolidation">Equipment Consolidation</option>
            <option value="budget_cut">Budget Cut</option>
            <option value="weather_delay">Weather Delay (Monte Carlo)</option>
          </select>
        </div>

        {/* Step 2: Parameters */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Step 2: Parameters</label>

          {scenarioType === 'timeline_shift' && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Shift Days (positive = delay, negative = advance)</label>
              <input
                type="number"
                value={shiftDays}
                onChange={(e) => setShiftDays(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {scenarioType === 'vendor_switch' && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Target Vendor (switch all cranes to this vendor)</label>
              <input
                type="text"
                value={targetVendor}
                onChange={(e) => setTargetVendor(e.target.value)}
                placeholder="e.g., Vendor B"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {scenarioType === 'budget_cut' && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Budget Reduction (%)</label>
              <input
                type="number"
                value={budgetReduction}
                onChange={(e) => setBudgetReduction(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {scenarioType === 'weather_delay' && (
            <div className="bg-blue-50 p-3 rounded">
              <p className="text-sm text-blue-800">
                Monte Carlo simulation will randomize weather delays between 10-30 days (1,000 iterations)
              </p>
            </div>
          )}
        </div>

        {/* Step 3: Organizations */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Step 3: Apply to Organizations</label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={organizationIds.includes('ALL')}
                onChange={() => setOrganizationIds(['ALL'])}
              />
              <span className="text-sm">All Organizations</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={!organizationIds.includes('ALL')}
                onChange={() => setOrganizationIds(['HOLNG'])}
              />
              <span className="text-sm">Specific Organizations</span>
            </label>
          </div>
        </div>

        {/* Monte Carlo Toggle */}
        <div className="mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={runMonteCarlo}
              onChange={(e) => setRunMonteCarlo(e.target.checked)}
            />
            <span className="text-sm font-medium text-gray-700">
              Run Monte Carlo Simulation (1,000 iterations for risk analysis)
            </span>
          </label>
        </div>

        {/* Run Button */}
        <button
          onClick={runSimulation}
          disabled={loading}
          className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Running Simulation...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Run Simulation
            </>
          )}
        </button>
      </div>

      {/* Results Dashboard */}
      {result && (
        <div className="space-y-6">
          {/* Impact Summary */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Impact Summary</h2>
              <button
                onClick={exportPDF}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              {/* Cost Impact */}
              <div className={`p-4 rounded-lg ${result.impact.costDelta < 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-sm text-gray-600 mb-1">Cost Impact</p>
                <p
                  className={`text-2xl font-bold ${
                    result.impact.costDelta < 0 ? 'text-green-600' : 'text-red-600'
                  } flex items-center gap-2`}
                >
                  {result.impact.costDelta < 0 ? (
                    <TrendingDown className="w-6 h-6" />
                  ) : (
                    <TrendingUp className="w-6 h-6" />
                  )}
                  {result.impact.costDelta > 0 ? '+' : ''}${result.impact.costDelta.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">
                  {result.impact.costDeltaPercent > 0 ? '+' : ''}
                  {result.impact.costDeltaPercent.toFixed(1)}%
                </p>
              </div>

              {/* Duration Impact */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Timeline Impact</p>
                <p className="text-2xl font-bold text-blue-600">
                  {result.impact.durationDelta > 0 ? '+' : ''}
                  {result.impact.durationDelta} days
                </p>
                <p className="text-sm text-gray-600">
                  {result.scenarioMetrics.totalDuration} days total
                </p>
              </div>

              {/* Equipment Impact */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Equipment Impact</p>
                <p className="text-2xl font-bold text-gray-900">
                  {result.impact.equipmentDelta > 0 ? '+' : ''}
                  {result.impact.equipmentDelta}
                </p>
                <p className="text-sm text-gray-600">
                  {result.affectedRecords} records affected
                </p>
              </div>
            </div>

            {/* Baseline vs. Scenario */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Metric</th>
                  <th className="text-right py-2">Baseline</th>
                  <th className="text-right py-2">Scenario</th>
                  <th className="text-right py-2">Delta</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2">Total Cost</td>
                  <td className="text-right">${result.baselineMetrics.totalCost.toLocaleString()}</td>
                  <td className="text-right">${result.scenarioMetrics.totalCost.toLocaleString()}</td>
                  <td
                    className={`text-right font-semibold ${
                      result.impact.costDelta < 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {result.impact.costDelta > 0 ? '+' : ''}${result.impact.costDelta.toLocaleString()}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Duration (Days)</td>
                  <td className="text-right">{result.baselineMetrics.totalDuration}</td>
                  <td className="text-right">{result.scenarioMetrics.totalDuration}</td>
                  <td className="text-right font-semibold">
                    {result.impact.durationDelta > 0 ? '+' : ''}
                    {result.impact.durationDelta}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Monte Carlo Risk Analysis */}
          {result.riskAnalysis && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Risk Analysis (Monte Carlo Simulation)</h2>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Best Case (P10)</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${result.riskAnalysis.p10.toLocaleString()}
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Median (P50)</p>
                  <p className="text-2xl font-bold text-blue-600">
                    ${result.riskAnalysis.p50.toLocaleString()}
                  </p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Worst Case (P90)</p>
                  <p className="text-2xl font-bold text-red-600">
                    ${result.riskAnalysis.p90.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Probability Distribution Chart */}
              <div className="h-64 bg-gray-50 rounded flex items-center justify-center">
                <p className="text-gray-500">[Probability Distribution Chart - TODO: Use Chart.js]</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 🧪 Testing Requirements

```typescript
describe('Use Case 25: Multiverse Scenario Simulator', () => {
  // Test 1: Timeline shift scenario
  it('should simulate timeline shift scenario', async () => {
    const result = await scenarioSimulatorService.simulateScenario({
      userId: 'beo-user-id',
      scenarioType: 'timeline_shift',
      organizationIds: ['ALL'],
      parameters: { shiftDays: 30 },
    });

    expect(result.impact.durationDelta).toBe(30);
    expect(result.impact.costDelta).toBeGreaterThan(0); // Longer rentals = higher cost
  });

  // Test 2: Vendor switch scenario
  it('should simulate vendor switch scenario', async () => {
    const result = await scenarioSimulatorService.simulateScenario({
      userId: 'beo-user-id',
      scenarioType: 'vendor_switch',
      organizationIds: ['HOLNG'],
      parameters: { targetVendor: 'Vendor B' },
    });

    expect(result.impact.costDelta).toBeLessThan(0); // Cheaper vendor = cost savings
  });

  // Test 3: Monte Carlo simulation
  it('should run Monte Carlo simulation with 1000 iterations', async () => {
    const result = await scenarioSimulatorService.simulateScenario({
      userId: 'beo-user-id',
      scenarioType: 'weather_delay',
      organizationIds: ['ALL'],
      parameters: { weatherDelayRange: { min: 10, max: 30 } },
      runMonteCarlo: true,
      iterations: 1000,
    });

    expect(result.riskAnalysis).toBeTruthy();
    expect(result.riskAnalysis!.p50).toBeGreaterThan(result.riskAnalysis!.p10);
    expect(result.riskAnalysis!.p90).toBeGreaterThan(result.riskAnalysis!.p50);
  });

  // Test 4: Scenario comparison
  it('should compare multiple scenarios side-by-side', async () => {
    // Run 2 scenarios
    const scenario1 = await scenarioSimulatorService.simulateScenario({
      userId: 'beo-user-id',
      scenarioType: 'timeline_shift',
      organizationIds: ['ALL'],
      parameters: { shiftDays: 30 },
    });

    const scenario2 = await scenarioSimulatorService.simulateScenario({
      userId: 'beo-user-id',
      scenarioType: 'vendor_switch',
      organizationIds: ['ALL'],
      parameters: { targetVendor: 'Vendor B' },
    });

    // Save scenarios
    await scenarioSimulatorService.saveScenario(scenario1);
    await scenarioSimulatorService.saveScenario(scenario2);

    // Compare
    const comparison = await scenarioSimulatorService.compareScenarios([
      scenario1.scenarioId,
      scenario2.scenarioId,
    ]);

    expect(comparison.scenarios.length).toBe(2);
    expect(comparison.recommendation).toBeTruthy();
  });
});
```

---

## 🚀 Implementation Checklist

### Backend Tasks
- [ ] Create `ScenarioSimulatorService.ts`
- [ ] Implement `simulateScenario()` method
- [ ] Implement `applyScenarioTransformations()` logic
- [ ] Implement `runMonteCarloSimulation()` (1000 iterations)
- [ ] Implement `generateTimelineComparison()` Gantt data
- [ ] Implement `saveScenario()` persistence
- [ ] Implement `compareScenarios()` side-by-side
- [ ] Create `ScenarioSimulation` model
- [ ] Create API endpoints
- [ ] Implement PDF export (use Chart.js for charts)

### Frontend Tasks
- [ ] Create `ScenarioBuilder.tsx` component
- [ ] Implement scenario type selection
- [ ] Implement parameter configuration UI
- [ ] Implement impact dashboard
- [ ] Add Monte Carlo risk analysis visualization
- [ ] Add scenario comparison table
- [ ] Implement PDF export button

### Testing Tasks
- [ ] Test timeline shift simulation
- [ ] Test vendor switch simulation
- [ ] Test Monte Carlo simulation (1000 iterations)
- [ ] Test scenario comparison
- [ ] Test PDF export

---

## 🎯 Acceptance Criteria

✅ **Users can configure and run 5 scenario types**
✅ **Simulation calculates accurate cost/duration impacts**
✅ **Monte Carlo simulation runs 1,000 iterations in <30 seconds**
✅ **Risk analysis displays P10/P50/P90 outcomes**
✅ **Scenarios can be saved and compared side-by-side**
✅ **PDF export includes charts and executive summary**
✅ **Only BEO users can access scenario simulator**

---

**End of Prompt Bundle: Task 8.5 - Multiverse Scenario Simulator**

**Status**: Ready for Execution by `ai-systems-architect`
**Estimated Completion**: 1 day

---

## 🎉 Phase 8 Complete

**All 5 BEO Intelligence features are now specified:**
1. ✅ Boardroom Voice Analyst (UC 21)
2. ✅ Narrative Variance Generator (UC 22)
3. ✅ Asset Arbitrage Detector (UC 23)
4. ✅ Vendor Pricing Watchdog (UC 24)
5. ✅ Multiverse Scenario Simulator (UC 25)

**Total Estimated Duration**: 3 days
**Next Phase**: Phase 9 - AI Integration & Refinement
