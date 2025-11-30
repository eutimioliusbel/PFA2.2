/**
 * ScenarioBuilder.tsx
 *
 * Interactive wizard for creating and running what-if scenario simulations
 * Supports 5 scenario types with Monte Carlo risk analysis
 *
 * UC-25: Multiverse Scenario Simulator
 */

import React, { useState } from 'react';
import {
  Play,
  TrendingUp,
  Users,
  Package,
  DollarSign,
  Cloud,
  ChevronRight,
  ChevronLeft,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Info,
  Download
} from 'lucide-react';

// Types
interface ScenarioParameters {
  type: 'timeline_shift' | 'vendor_switch' | 'consolidation' | 'budget_cut' | 'weather_delay';
  shiftDays?: number;
  targetVendor?: string;
  sourceVendor?: string;
  consolidationPercent?: number;
  budgetCutPercent?: number;
  monteCarloEnabled?: boolean;
  iterations?: number;
}

interface SimulationResult {
  scenarioId: string;
  scenarioType: string;
  parameters: ScenarioParameters;
  baselineMetrics: Metrics;
  scenarioMetrics: Metrics;
  impact: ImpactSummary;
  riskAnalysis?: MonteCarloResult;
  timeline: any;
  metadata?: {
    latencyMs: number;
  };
}

interface Metrics {
  totalCost: number;
  totalDuration: number;
  equipmentCount: number;
  avgMonthlyRate: number;
  totalQuantity: number;
}

interface ImpactSummary {
  costDelta: number;
  costDeltaPercent: number;
  durationDelta: number;
  durationDeltaPercent: number;
  equipmentDelta: number;
  equipmentDeltaPercent: number;
}

interface MonteCarloResult {
  p10: number;
  p50: number;
  p90: number;
  mean: number;
  stdDev: number;
  distribution: number[];
}

interface Organization {
  id: string;
  code: string;
  name: string;
}

interface ScenarioBuilderProps {
  organizations: Organization[];
  onClose: () => void;
}

const SCENARIO_TYPES = [
  {
    type: 'timeline_shift' as const,
    label: 'Timeline Shift',
    icon: TrendingUp,
    description: 'Shift all equipment dates forward or backward',
    color: 'blue'
  },
  {
    type: 'vendor_switch' as const,
    label: 'Vendor Switch',
    icon: Users,
    description: 'Switch equipment from one vendor to another',
    color: 'purple'
  },
  {
    type: 'consolidation' as const,
    label: 'Equipment Consolidation',
    icon: Package,
    description: 'Reduce equipment count by consolidating overlapping rentals',
    color: 'green'
  },
  {
    type: 'budget_cut' as const,
    label: 'Budget Cut',
    icon: DollarSign,
    description: 'Reduce all equipment rates by a percentage',
    color: 'orange'
  },
  {
    type: 'weather_delay' as const,
    label: 'Weather Delay',
    icon: Cloud,
    description: 'Simulate random weather delays (Monte Carlo)',
    color: 'cyan'
  }
];

// Color mapping functions for Tailwind CSS (explicit classes for production build)
const getColorClasses = (color: string, isSelected: boolean) => {
  const selected = {
    blue: 'border-blue-500 bg-blue-900/20',
    purple: 'border-purple-500 bg-purple-900/20',
    green: 'border-green-500 bg-green-900/20',
    orange: 'border-orange-500 bg-orange-900/20',
    cyan: 'border-cyan-500 bg-cyan-900/20'
  }[color] || 'border-slate-500 bg-slate-700';

  return isSelected ? selected : 'border-slate-700 hover:border-slate-600';
};

const getIconBgClass = (color: string) => {
  return {
    blue: 'bg-blue-900/30',
    purple: 'bg-purple-900/30',
    green: 'bg-green-900/30',
    orange: 'bg-orange-900/30',
    cyan: 'bg-cyan-900/30'
  }[color] || 'bg-slate-700';
};

const getIconTextClass = (color: string) => {
  return {
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    green: 'text-green-400',
    orange: 'text-orange-400',
    cyan: 'text-cyan-400'
  }[color] || 'text-slate-400';
};

export function ScenarioBuilder({ organizations, onClose }: ScenarioBuilderProps) {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<ScenarioParameters['type'] | null>(null);
  const [parameters, setParameters] = useState<Partial<ScenarioParameters>>({
    monteCarloEnabled: false,
    iterations: 1000
  });
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);
  const [allOrgs, setAllOrgs] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Select Scenario Type
  const renderStep1 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Select Scenario Type</h3>
      <p className="text-sm text-slate-400">Choose the type of what-if analysis to run</p>

      <div className="grid grid-cols-1 gap-3">
        {SCENARIO_TYPES.map((scenario) => {
          const Icon = scenario.icon;
          const isSelected = selectedType === scenario.type;

          return (
            <button
              key={scenario.type}
              onClick={() => {
                setSelectedType(scenario.type);
                setParameters(prev => ({ ...prev, type: scenario.type }));
              }}
              className={`p-4 rounded-lg border-2 transition-all text-left ${getColorClasses(scenario.color, isSelected)}`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${getIconBgClass(scenario.color)}`}>
                  <Icon className={`w-5 h-5 ${getIconTextClass(scenario.color)}`} />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-white">{scenario.label}</h4>
                  <p className="text-sm text-slate-400 mt-1">{scenario.description}</p>
                </div>
                {isSelected && (
                  <CheckCircle2 className={`w-5 h-5 ${getIconTextClass(scenario.color)}`} />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // Step 2: Configure Parameters
  const renderStep2 = () => {
    if (!selectedType) return null;

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-white">Configure Parameters</h3>

        {selectedType === 'timeline_shift' && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Shift Days
            </label>
            <input
              type="number"
              value={parameters.shiftDays || 0}
              onChange={(e) => setParameters(prev => ({ ...prev, shiftDays: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-700 text-white"
              placeholder="e.g., 30 for 30-day delay"
              min="-365"
              max="365"
            />
            <p className="text-xs text-slate-500 mt-1">
              Positive = delay, Negative = advance. Range: -365 to +365 days
            </p>
          </div>
        )}

        {selectedType === 'vendor_switch' && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Source Vendor
              </label>
              <input
                type="text"
                value={parameters.sourceVendor || ''}
                onChange={(e) => setParameters(prev => ({ ...prev, sourceVendor: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-700 text-white"
                placeholder="e.g., Acme Rentals"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Target Vendor
              </label>
              <input
                type="text"
                value={parameters.targetVendor || ''}
                onChange={(e) => setParameters(prev => ({ ...prev, targetVendor: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-700 text-white"
                placeholder="e.g., Better Rentals"
              />
            </div>
            <p className="text-xs text-slate-500">
              Simulates switching equipment from source to target vendor with typical 15% rate reduction
            </p>
          </>
        )}

        {selectedType === 'consolidation' && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Consolidation Percentage
            </label>
            <input
              type="range"
              value={parameters.consolidationPercent || 0}
              onChange={(e) => setParameters(prev => ({ ...prev, consolidationPercent: parseInt(e.target.value) }))}
              className="w-full"
              min="0"
              max="100"
              step="5"
            />
            <div className="flex justify-between text-sm text-slate-400">
              <span>0%</span>
              <span className="font-semibold">{parameters.consolidationPercent || 0}%</span>
              <span>100%</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Remove bottom X% of equipment by cost (simulates consolidation)
            </p>
          </div>
        )}

        {selectedType === 'budget_cut' && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Budget Cut Percentage
            </label>
            <input
              type="range"
              value={parameters.budgetCutPercent || 0}
              onChange={(e) => setParameters(prev => ({ ...prev, budgetCutPercent: parseInt(e.target.value) }))}
              className="w-full"
              min="0"
              max="50"
              step="1"
            />
            <div className="flex justify-between text-sm text-slate-400">
              <span>0%</span>
              <span className="font-semibold">{parameters.budgetCutPercent || 0}%</span>
              <span>50%</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Reduce all equipment rates uniformly by this percentage
            </p>
          </div>
        )}

        {selectedType === 'weather_delay' && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Average Delay Days
            </label>
            <input
              type="number"
              value={parameters.shiftDays || 20}
              onChange={(e) => setParameters(prev => ({ ...prev, shiftDays: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-700 text-white"
              placeholder="e.g., 20"
              min="0"
              max="60"
            />
            <p className="text-xs text-slate-500 mt-1">
              Monte Carlo will randomize delays around this average (±5 days standard deviation)
            </p>
          </div>
        )}
      </div>
    );
  };

  // Step 3: Select Organizations
  const renderStep3 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Select Organizations</h3>

      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={allOrgs}
            onChange={() => setAllOrgs(true)}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium text-slate-300">All Organizations</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={!allOrgs}
            onChange={() => setAllOrgs(false)}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium text-slate-300">Specific Organizations</span>
        </label>
      </div>

      {!allOrgs && (
        <div className="mt-4 space-y-2 max-h-60 overflow-y-auto border border-slate-700 rounded-lg p-3 bg-slate-900">
          {organizations.map((org) => (
            <label key={org.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedOrgs.includes(org.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedOrgs([...selectedOrgs, org.id]);
                  } else {
                    setSelectedOrgs(selectedOrgs.filter(id => id !== org.id));
                  }
                }}
                className="w-4 h-4"
              />
              <span className="text-sm text-slate-300">
                {org.name} ({org.code})
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );

  // Step 4: Monte Carlo Settings
  const renderStep4 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Monte Carlo Simulation</h3>

      <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-300">
            <p className="font-medium">What is Monte Carlo?</p>
            <p className="mt-1">
              Runs 1,000 simulations with randomized parameters to calculate probability distributions (P10, P50, P90).
              Provides risk-adjusted forecasts instead of single-point estimates.
            </p>
          </div>
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={parameters.monteCarloEnabled}
          onChange={(e) => setParameters(prev => ({ ...prev, monteCarloEnabled: e.target.checked }))}
          className="w-4 h-4 mt-1"
        />
        <div>
          <span className="text-sm font-medium text-white">Enable Monte Carlo Simulation</span>
          <p className="text-xs text-slate-500 mt-1">
            Run 1,000 iterations for risk analysis (P10/P50/P90). May take up to 30 seconds.
          </p>
        </div>
      </label>

      {parameters.monteCarloEnabled && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Iterations
          </label>
          <input
            type="number"
            value={parameters.iterations || 1000}
            onChange={(e) => setParameters(prev => ({ ...prev, iterations: parseInt(e.target.value) }))}
            className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-700 text-white"
            min="100"
            max="10000"
            step="100"
          />
          <p className="text-xs text-slate-500 mt-1">
            More iterations = better accuracy but longer processing time
          </p>
        </div>
      )}
    </div>
  );

  // Step 5: Results Dashboard
  const renderStep5 = () => {
    if (!result) return null;

    const { baselineMetrics, scenarioMetrics, impact, riskAnalysis } = result;

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-white">Simulation Results</h3>

        {/* Impact Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Cost Impact</div>
            <div className={`text-2xl font-bold ${impact.costDelta > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {impact.costDelta > 0 ? '+' : ''}${Math.round(impact.costDelta).toLocaleString()}
            </div>
            <div className="text-xs text-slate-500">
              {impact.costDeltaPercent > 0 ? '+' : ''}{impact.costDeltaPercent.toFixed(1)}%
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Duration Impact</div>
            <div className={`text-2xl font-bold ${impact.durationDelta > 0 ? 'text-orange-400' : 'text-blue-400'}`}>
              {impact.durationDelta > 0 ? '+' : ''}{Math.round(impact.durationDelta).toLocaleString()} days
            </div>
            <div className="text-xs text-slate-500">
              {impact.durationDeltaPercent > 0 ? '+' : ''}{impact.durationDeltaPercent.toFixed(1)}%
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Equipment Impact</div>
            <div className={`text-2xl font-bold ${impact.equipmentDelta < 0 ? 'text-green-400' : 'text-white'}`}>
              {impact.equipmentDelta > 0 ? '+' : ''}{impact.equipmentDelta}
            </div>
            <div className="text-xs text-slate-500">
              {impact.equipmentDeltaPercent > 0 ? '+' : ''}{impact.equipmentDeltaPercent.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Baseline vs Scenario Comparison */}
        <div className="bg-slate-900 rounded-lg p-4">
          <h4 className="font-medium text-white mb-3">Baseline vs. Scenario</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 text-slate-400 font-medium">Metric</th>
                <th className="text-right py-2 text-slate-400 font-medium">Baseline</th>
                <th className="text-right py-2 text-slate-400 font-medium">Scenario</th>
                <th className="text-right py-2 text-slate-400 font-medium">Delta</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-700">
                <td className="py-2 text-slate-300">Total Cost</td>
                <td className="py-2 text-right text-white">${Math.round(baselineMetrics.totalCost).toLocaleString()}</td>
                <td className="py-2 text-right text-white">${Math.round(scenarioMetrics.totalCost).toLocaleString()}</td>
                <td className={`py-2 text-right font-medium ${impact.costDelta > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {impact.costDelta > 0 ? '+' : ''}${Math.round(impact.costDelta).toLocaleString()}
                </td>
              </tr>
              <tr className="border-b border-slate-700">
                <td className="py-2 text-slate-300">Total Duration</td>
                <td className="py-2 text-right text-white">{Math.round(baselineMetrics.totalDuration).toLocaleString()} days</td>
                <td className="py-2 text-right text-white">{Math.round(scenarioMetrics.totalDuration).toLocaleString()} days</td>
                <td className={`py-2 text-right font-medium ${impact.durationDelta > 0 ? 'text-orange-400' : 'text-blue-400'}`}>
                  {impact.durationDelta > 0 ? '+' : ''}{Math.round(impact.durationDelta)} days
                </td>
              </tr>
              <tr>
                <td className="py-2 text-slate-300">Equipment Count</td>
                <td className="py-2 text-right text-white">{baselineMetrics.equipmentCount}</td>
                <td className="py-2 text-right text-white">{scenarioMetrics.equipmentCount}</td>
                <td className={`py-2 text-right font-medium ${impact.equipmentDelta < 0 ? 'text-green-400' : 'text-slate-300'}`}>
                  {impact.equipmentDelta > 0 ? '+' : ''}{impact.equipmentDelta}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Monte Carlo Risk Analysis */}
        {riskAnalysis && (
          <div className="bg-gradient-to-br from-blue-900/20 to-indigo-900/20 border border-blue-800 rounded-lg p-4">
            <h4 className="font-medium text-white mb-3 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              Monte Carlo Risk Analysis
            </h4>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-slate-800 rounded-lg p-3 border border-blue-800">
                <div className="text-xs text-slate-400 mb-1">P10 (Best Case)</div>
                <div className="text-lg font-bold text-green-400">
                  ${Math.round(riskAnalysis.p10).toLocaleString()}
                </div>
                <div className="text-xs text-slate-500">10th percentile</div>
              </div>

              <div className="bg-slate-800 rounded-lg p-3 border border-blue-800">
                <div className="text-xs text-slate-400 mb-1">P50 (Median)</div>
                <div className="text-lg font-bold text-blue-400">
                  ${Math.round(riskAnalysis.p50).toLocaleString()}
                </div>
                <div className="text-xs text-slate-500">50th percentile</div>
              </div>

              <div className="bg-slate-800 rounded-lg p-3 border border-blue-800">
                <div className="text-xs text-slate-400 mb-1">P90 (Worst Case)</div>
                <div className="text-lg font-bold text-red-400">
                  ${Math.round(riskAnalysis.p90).toLocaleString()}
                </div>
                <div className="text-xs text-slate-500">90th percentile</div>
              </div>
            </div>

            <div className="text-sm text-slate-300 bg-slate-800 rounded-lg p-3 border border-blue-800">
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">Mean:</span>
                <span className="font-medium">${Math.round(riskAnalysis.mean).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Std. Dev:</span>
                <span className="font-medium">${Math.round(riskAnalysis.stdDev).toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-500">
              Based on {parameters.iterations?.toLocaleString()} Monte Carlo iterations
            </div>
          </div>
        )}

        {/* Metadata */}
        {result.metadata && (
          <div className="text-sm text-slate-500 text-center">
            Simulation completed in {result.metadata.latencyMs}ms
          </div>
        )}
      </div>
    );
  };

  // Run Simulation
  const runSimulation = async () => {
    setIsSimulating(true);
    setError(null);

    try {
      const orgIds = allOrgs
        ? organizations.map(org => org.id)
        : selectedOrgs;

      const response = await fetch('/api/beo/scenario/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('pfa_auth_token')}`
        },
        body: JSON.stringify({
          organizationIds: orgIds,
          parameters
        })
      });

      if (!response.ok) {
        throw new Error('Simulation failed');
      }

      const data = await response.json();
      setResult(data);
      setStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setIsSimulating(false);
    }
  };

  // Export scenario as PDF
  const handleExportPDF = async () => {
    if (!result?.scenarioId) return;
    try {
      const response = await fetch(`/api/beo/scenario/${result.scenarioId}/export-pdf`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('pfa_auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to export PDF');
      }

      // Get the HTML content
      const htmlContent = await response.text();

      // Open in new window for printing/saving as PDF
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
      } else {
        // Fallback: Download as HTML file
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scenario-${result.scenarioId}.html`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Failed to export PDF');
    }
  };

  // Navigation
  const canProceed = () => {
    if (step === 1) return selectedType !== null;
    if (step === 2) {
      if (selectedType === 'timeline_shift') return parameters.shiftDays !== undefined;
      if (selectedType === 'vendor_switch') return parameters.sourceVendor && parameters.targetVendor;
      if (selectedType === 'consolidation') return parameters.consolidationPercent !== undefined;
      if (selectedType === 'budget_cut') return parameters.budgetCutPercent !== undefined;
      if (selectedType === 'weather_delay') return parameters.shiftDays !== undefined;
    }
    if (step === 3) return allOrgs || selectedOrgs.length > 0;
    if (step === 4) return true;
    return false;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Scenario Simulator</h2>
          <p className="text-sm text-slate-400 mt-1">
            Run what-if analyses with Monte Carlo risk modeling
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="px-6 py-3 bg-slate-900 border-b border-slate-700">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <React.Fragment key={s}>
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${s === step ? 'bg-blue-600 text-white' : s < step ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-400'}
                `}>
                  {s < step ? <CheckCircle2 className="w-4 h-4" /> : s}
                </div>
                {s < 5 && <div className={`flex-1 h-1 ${s < step ? 'bg-green-500' : 'bg-slate-700'}`} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}

          {error && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="text-sm text-red-400">{error}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between">
          <button
            onClick={step === 1 ? onClose : () => setStep(step - 1)}
            disabled={isSimulating}
            className="px-4 py-2 text-slate-400 hover:text-white disabled:opacity-50"
          >
            <ChevronLeft className="w-5 h-5 inline" />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 4 && (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-5 h-5 inline" />
            </button>
          )}

          {step === 4 && (
            <button
              onClick={runSimulation}
              disabled={isSimulating || !canProceed()}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSimulating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Simulating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Simulation
                </>
              )}
            </button>
          )}

          {step === 5 && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportPDF}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
