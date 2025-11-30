
import React, { ReactNode } from 'react';
import { Asset, Scale } from '../types';
import { aggregateCosts, formatCurrencyCompact } from '../utils';
import { TrendingUp, TrendingDown, CircleDollarSign, Maximize2, Minimize2, ArrowRight } from 'lucide-react';
// import { kpiCalculator } from '../services/kpiCalculator'; // ADR-007 Task 4.2: For custom KPI formulas

interface KpiBoardProps {
  assets: Asset[]; // Pending/Live state (Working Copy)
  committedAssets: Asset[]; // Original/Baseline state
  compact: boolean;
  onToggleCompact: () => void;
  customToolbar?: ReactNode;
  scale: Scale;
  // kpiDefinitions?: Array<{ name: string; formula: string }>; // ADR-007 Task 4.2: For custom KPI formulas
}

interface StatMetrics {
  total: number;
  purchase: number;
  rental: number;
  duration: string;
  aggregateDuration: number; // Sum of milliseconds for precise change detection
}

// Extracted StatGroup
const StatGroup = ({ 
  label, 
  current,
  pending,
  accentColor, 
  icon: Icon,
  className = "flex-1 min-w-[260px]" 
}: {
  label: string;
  current: StatMetrics;
  pending?: StatMetrics; 
  accentColor: string;
  icon: any;
  className?: string;
}) => {
  // Check for any change in metrics 
  const hasChange = pending && (
    current.total !== pending.total || 
    current.purchase !== pending.purchase || 
    current.rental !== pending.rental || 
    current.aggregateDuration !== pending.aggregateDuration
  );

  return (
    <div className={`flex flex-col p-5 relative overflow-hidden group transition-all hover:bg-slate-50/50 dark:hover:bg-slate-800/30 justify-center ${className}`}>
      <div className={`absolute top-0 left-0 w-1 h-full ${accentColor} opacity-80`}></div>
      
      {/* Header Label */}
      <div className="flex items-center justify-between mb-3 z-10">
        <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${accentColor} bg-opacity-10 dark:bg-opacity-20`}>
                <Icon className={`w-4 h-4 ${accentColor.replace('bg-', 'text-').replace('600', '500')}`} />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</span>
        </div>
      </div>

      <div className="z-10 flex items-center gap-8"> 
        {/* Current State (Baseline) */}
        <div className={hasChange ? 'opacity-40 grayscale transition-all' : ''}>
            <div className={`font-black text-slate-800 dark:text-slate-100 tracking-tight mb-3 -ml-1 leading-none ${className.includes('min-w-[200px]') ? 'text-4xl xl:text-5xl' : 'text-5xl xl:text-6xl'}`}>
              {formatCurrencyCompact(current.total)}
            </div>
            
            <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
              <div className="flex flex-col">
                <span className="opacity-60 uppercase text-[9px] mb-0.5">Purchase</span>
                <span className="text-slate-700 dark:text-slate-300 text-sm font-bold">{formatCurrencyCompact(current.purchase)}</span>
              </div>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
              <div className="flex flex-col">
                <span className="opacity-60 uppercase text-[9px] mb-0.5">Rental</span>
                <span className="text-slate-700 dark:text-slate-300 text-sm font-bold">{formatCurrencyCompact(current.rental)}</span>
              </div>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
              <div className="flex flex-col">
                <span className="opacity-60 uppercase text-[9px] mb-0.5">Duration</span>
                <span className="text-slate-700 dark:text-slate-300 text-sm font-bold">{current.duration}</span>
              </div>
            </div>
        </div>

        {/* Pending State (If changed) */}
        {hasChange && pending && (
            <>
                <div className="flex items-center justify-center text-slate-300 dark:text-slate-600">
                    <ArrowRight className="w-8 h-8" />
                </div>
                
                <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                    <div className={`text-5xl xl:text-6xl font-black tracking-tight mb-3 -ml-1 leading-none ${accentColor.replace('bg-', 'text-')}`}>
                        {formatCurrencyCompact(pending.total)}
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                        <div className="flex flex-col">
                            <span className="opacity-60 uppercase text-[9px] mb-0.5">Purchase</span>
                            <span className={`text-sm font-bold ${pending.purchase !== current.purchase ? 'text-slate-900 dark:text-white' : ''}`}>{formatCurrencyCompact(pending.purchase)}</span>
                        </div>
                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
                        <div className="flex flex-col">
                            <span className="opacity-60 uppercase text-[9px] mb-0.5">Rental</span>
                            <span className={`text-sm font-bold ${pending.rental !== current.rental ? 'text-slate-900 dark:text-white' : ''}`}>{formatCurrencyCompact(pending.rental)}</span>
                        </div>
                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
                        <div className="flex flex-col">
                            <span className="opacity-60 uppercase text-[9px] mb-0.5">Duration</span>
                            <span className={`text-sm font-bold ${pending.aggregateDuration !== current.aggregateDuration ? 'text-slate-900 dark:text-white' : ''}`}>{pending.duration}</span>
                        </div>
                    </div>
                </div>
            </>
        )}
      </div>

      {/* Background Decoration */}
      <div className={`absolute -right-6 -bottom-6 w-28 h-28 rounded-full ${accentColor} opacity-5 dark:opacity-10 group-hover:scale-110 transition-transform duration-500 pointer-events-none`}></div>
    </div>
  );
};

export const KpiBoard: React.FC<KpiBoardProps> = ({ assets, committedAssets, compact, onToggleCompact, customToolbar, scale }) => {
  
  // Helper to compute full metrics object for a dataset
  const computeMetrics = (data: Asset[], type: 'original' | 'forecast' | 'actual'): StatMetrics => {
    const isMassive = data.length > 2000;
    
    // NOTE: KPI Logic ignores Discontinued and Funds Transferable
    const activeData = data.filter(a => !a.isDiscontinued && !a.isFundsTransferable);

    const costs = aggregateCosts(activeData, type);
    
    let durationStr = '-';
    let aggregateDuration = 0;

    if (!isMassive && activeData.length > 0) {
        let minStart = new Date(8640000000000000);
        let maxEnd = new Date(-8640000000000000);
        let hasData = false;

        for (const asset of activeData) {
            if (type === 'actual' && !asset.hasActuals) continue;
            const start = type === 'original' ? asset.originalStart : (type === 'forecast' ? asset.forecastStart : asset.actualStart);
            const end = type === 'original' ? asset.originalEnd : (type === 'forecast' ? asset.forecastEnd : asset.actualEnd);
            
            // Guard against strings or invalid dates
            if (start && end && start instanceof Date && end instanceof Date && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
                if (start < minStart) minStart = start;
                if (end > maxEnd) maxEnd = end;
                
                // Sum aggregate duration (ms)
                aggregateDuration += (end.getTime() - start.getTime());
                hasData = true;
            }
        }

        if (hasData) {
            const diffTime = Math.max(0, maxEnd.getTime() - minStart.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            switch(scale) {
                case 'Year': durationStr = (diffDays / 365).toFixed(1) + ' yr'; break;
                case 'Month': durationStr = (diffDays / 30.44).toFixed(1) + ' mo'; break;
                case 'Week': durationStr = (diffDays / 7).toFixed(1) + ' wk'; break;
                default: durationStr = diffDays + ' d';
            }
        }
    } else if (isMassive) {
        durationStr = 'N/A (Fast Mode)';
    }

    return {
        total: costs.total,
        purchase: costs.purchase,
        rental: costs.rental,
        duration: durationStr,
        aggregateDuration
    };
  };

  // 'Current' represents the committed baseline (before current unsaved edits)
  const currentPlan = computeMetrics(committedAssets, 'original');
  const currentForecast = computeMetrics(committedAssets, 'forecast');
  const currentActual = computeMetrics(committedAssets, 'actual');
  
  // 'Pending' represents the live view with unsaved edits
  const pendingForecast = computeMetrics(assets, 'forecast');
  const pendingActual = computeMetrics(assets, 'actual');
  
  // Variances: Compare Pending (Live) vs Current (Baseline Plan) OR Pending vs Current Forecast
  // Standard practice: Variance is usually Forecast vs Plan. 
  // But for the "Variance Panel", we want to show the DELTA of the edits.
  // Wait, typically "Variance" in PFA means Forecast vs Budget(Plan).
  // The visual requested is "Changes".
  // Let's interpret: 
  // 1. The main "Forecast" card shows the Live Forecast value. If it differs from Baseline Forecast, show arrow.
  // 2. The "Variance" card usually shows Forecast vs Plan.
  // 3. If the user is editing, they want to see how their *edits* change the Variance.
  
  // Variance = Forecast - Plan
  const currentVarianceVal = currentForecast.total - currentPlan.total;
  const pendingVarianceVal = pendingForecast.total - currentPlan.total;
  const pendingVariancePercent = currentPlan.total > 0 ? (pendingVarianceVal / currentPlan.total) * 100 : 0;
  
  // Change detection for variance box (Did the variance amount change?)
  const hasVarianceChange = currentVarianceVal !== pendingVarianceVal;

  // Detailed Variances
  const varPurchase = pendingForecast.purchase - currentPlan.purchase;
  const varRental = pendingForecast.rental - currentPlan.rental;
  
  // Calculate Duration Variance (approx)
  const parseDuration = (str: string) => parseFloat(str) || 0;
  const planDurationVal = parseDuration(currentPlan.duration);
  const pendingDurationVal = parseDuration(pendingForecast.duration);
  const varDurationVal = pendingDurationVal - planDurationVal;
  const varDurationStr = varDurationVal === 0 ? '-' : `${varDurationVal > 0 ? '+' : ''}${varDurationVal.toFixed(1)} ${scale === 'Year' ? 'yr' : scale === 'Month' ? 'mo' : scale === 'Week' ? 'wk' : 'd'}`;

  // Percent Variances
  const varPurchasePercent = currentPlan.purchase > 0 ? (varPurchase / currentPlan.purchase) * 100 : 0;
  const varRentalPercent = currentPlan.rental > 0 ? (varRental / currentPlan.rental) * 100 : 0;
  const varDurationPercent = planDurationVal > 0 ? (varDurationVal / planDurationVal) * 100 : 0;

  // Helper for coloring
  const getVarColor = (val: number) => val > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-500 dark:text-emerald-400';
  const getPctColor = (val: number) => val > 0.1 ? 'text-red-600 dark:text-red-400' : val < -0.1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400';

  // --- Compact Render (Ticker) ---
  if (compact) {
    return (
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center h-16 shadow-sm transition-all duration-300 text-slate-900 dark:text-slate-100 rounded-xl gap-6">
            <div className="flex items-center gap-6 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] flex-1 min-w-0">
                
                {/* Plan */}
                <div className="flex items-center gap-3 flex-none">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-md flex-shrink-0"><CircleDollarSign className="w-4 h-4" /></div>
                    <div className="min-w-0">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Plan</div>
                        <div className="text-xl font-bold text-slate-700 dark:text-slate-300 leading-none whitespace-nowrap">{formatCurrencyCompact(currentPlan.total)}</div>
                    </div>
                </div>
                
                <div className="w-px h-8 bg-slate-100 dark:bg-slate-800 shrink-0"></div>
                
                {/* Forecast */}
                <div className="flex items-center gap-3 flex-none">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md flex-shrink-0"><TrendingUp className="w-4 h-4" /></div>
                    <div className="min-w-0">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Forecast</div>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                            {(currentForecast.total !== pendingForecast.total || currentForecast.aggregateDuration !== pendingForecast.aggregateDuration) && (
                                <div className="flex items-center gap-1">
                                    <span className="text-sm font-medium opacity-60 line-through decoration-slate-400/50 text-slate-500">
                                        {formatCurrencyCompact(currentForecast.total)}
                                    </span>
                                    <ArrowRight className="w-3 h-3 text-slate-400/50" />
                                </div>
                            )}
                            <div className="text-xl font-bold text-blue-700 dark:text-blue-400 leading-none">{formatCurrencyCompact(pendingForecast.total)}</div>
                        </div>
                    </div>
                </div>
                
                <div className="w-px h-8 bg-slate-100 dark:bg-slate-800 shrink-0"></div>
                
                {/* Actuals */}
                 <div className="flex items-center gap-3 flex-none">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-md flex-shrink-0"><TrendingDown className="w-4 h-4" /></div>
                    <div className="min-w-0">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Actuals</div>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                            {(currentActual.total !== pendingActual.total || currentActual.aggregateDuration !== pendingActual.aggregateDuration) && (
                                <div className="flex items-center gap-1">
                                    <span className="text-sm font-medium opacity-60 line-through decoration-slate-400/50 text-slate-500">
                                        {formatCurrencyCompact(currentActual.total)}
                                    </span>
                                    <ArrowRight className="w-3 h-3 text-slate-400/50" />
                                </div>
                            )}
                            <div className="text-xl font-bold text-slate-700 dark:text-slate-300 leading-none">{formatCurrencyCompact(pendingActual.total)}</div>
                        </div>
                    </div>
                </div>
                
                {/* Variance */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ml-2 flex-none ${pendingVarianceVal > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400'}`}>
                    <span className="text-[10px] font-bold uppercase truncate max-w-[80px]">Variance</span>
                    <div className="flex items-center gap-2 whitespace-nowrap">
                         {hasVarianceChange && (
                             <>
                                <span className="text-xs font-medium opacity-60 strike-through decoration-slate-400 line-through">
                                    {formatCurrencyCompact(currentVarianceVal)}
                                </span>
                                <ArrowRight className="w-3 h-3 opacity-50" />
                             </>
                         )}
                         <span className="text-base font-bold tabular-nums">{pendingVarianceVal > 0 ? '+' : ''}{formatCurrencyCompact(pendingVarianceVal)}</span>
                    </div>
                </div>
            </div>
            
            <div className="flex-none flex items-center gap-4 pl-4 border-l border-slate-100 dark:border-slate-800">
                <button onClick={onToggleCompact} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors" title="Expand Stats">
                    <Maximize2 className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg shadow-slate-200/50 dark:shadow-black/40 border border-slate-100 dark:border-slate-700 flex flex-col overflow-hidden relative animate-in fade-in zoom-in-95 duration-300">
      
      {/* Stats Row */}
      <div className="flex flex-col md:flex-row divide-y md:divide-y-0 relative">
        <div className="absolute top-2 right-2 z-20">
            <button 
                onClick={onToggleCompact}
                className="p-1.5 bg-white/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors"
                title="Compact View"
            >
                <Minimize2 className="w-4 h-4" />
            </button>
        </div>

        {/* Plan (Baseline) - Always static from Committed State */}
        <StatGroup 
            label="Plan Baseline" 
            current={currentPlan}
            accentColor="bg-amber-500"
            icon={CircleDollarSign}
        />

        <div className="hidden md:block w-px bg-slate-200 dark:bg-slate-700 my-4" />

        {/* Forecast - Compare Committed vs Live */}
        <StatGroup 
            label="Live Forecast" 
            current={currentForecast}
            pending={pendingForecast}
            accentColor="bg-blue-600"
            icon={TrendingUp}
        />

        <div className="hidden md:block w-px bg-slate-200 dark:bg-slate-700 my-4" />

        {/* Actuals - Compare Committed vs Live */}
        <StatGroup 
            label="Actuals To Date" 
            current={currentActual}
            pending={pendingActual}
            accentColor="bg-orange-500"
            icon={TrendingDown}
        />

        {/* Variance Panel */}
        <div className={`w-full md:w-auto md:flex-1 bg-slate-50 dark:bg-slate-800/50 p-5 flex flex-col justify-center relative overflow-hidden border-l-0 md:border-l border-slate-100 dark:border-slate-700 transition-all duration-300 ${hasVarianceChange ? 'min-w-[300px]' : 'min-w-[280px]'}`}>
            
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Total Variance</div>
            
            <div className="flex flex-col">
                {/* Big Number + Percent Stack Row */}
                <div className="flex items-start gap-4 mb-3">
                    
                    <div className="flex items-center gap-3">
                        {/* Current Variance (If Changed) */}
                        {hasVarianceChange && (
                            <div className="opacity-40 grayscale transition-all hidden xl:block">
                                <div className={`text-2xl font-bold tracking-tight leading-none ${getVarColor(currentVarianceVal)}`}>
                                    {currentVarianceVal > 0 ? '+' : ''}{formatCurrencyCompact(currentVarianceVal)}
                                </div>
                            </div>
                        )}
                        
                        {hasVarianceChange && <ArrowRight className="w-4 h-4 text-slate-300 hidden xl:block" />}

                        {/* Pending Variance Big Number */}
                        <div className={`text-5xl xl:text-6xl font-black tracking-tight leading-none ${getVarColor(pendingVarianceVal)}`}>
                            {pendingVarianceVal > 0 ? '+' : ''}{formatCurrencyCompact(pendingVarianceVal)}
                        </div>
                    </div>

                    {/* Percent Stack - Right Aligned - ONLY TOTAL */}
                    <div className="flex flex-col items-start gap-0.5 mt-1">
                         {/* Total % */}
                         <div className={`text-xl font-bold ${getPctColor(pendingVariancePercent)}`}>
                             {Math.abs(pendingVariancePercent).toFixed(1)}% <span className="text-[10px] text-slate-400 uppercase font-semibold">Total</span>
                         </div>
                    </div>
                </div>

                {/* Breakdown Row - Matching other panels */}
                <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {/* Purchase */}
                    <div className="flex flex-col">
                        <span className="opacity-60 uppercase text-[9px] mb-0.5">Purchase</span>
                        <span className={`text-sm font-bold ${getVarColor(varPurchase)}`}>
                            {varPurchase > 0 ? '+' : ''}{formatCurrencyCompact(varPurchase)}
                        </span>
                        <span className={`text-[10px] font-medium ${getPctColor(varPurchasePercent)}`}>
                             {Math.abs(varPurchasePercent).toFixed(1)}%
                        </span>
                    </div>
                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
                    {/* Rental */}
                    <div className="flex flex-col">
                        <span className="opacity-60 uppercase text-[9px] mb-0.5">Rental</span>
                        <span className={`text-sm font-bold ${getVarColor(varRental)}`}>
                             {varRental > 0 ? '+' : ''}{formatCurrencyCompact(varRental)}
                        </span>
                        <span className={`text-[10px] font-medium ${getPctColor(varRentalPercent)}`}>
                             {Math.abs(varRentalPercent).toFixed(1)}%
                        </span>
                    </div>
                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
                    {/* Duration */}
                    <div className="flex flex-col">
                        <span className="opacity-60 uppercase text-[9px] mb-0.5">Duration</span>
                        <span className={`text-sm font-bold ${getVarColor(varDurationVal)}`}>
                            {varDurationStr}
                        </span>
                         <span className={`text-[10px] font-medium ${getPctColor(varDurationPercent)}`}>
                             {Math.abs(varDurationPercent).toFixed(1)}%
                        </span>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {customToolbar && (
        <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 px-4 py-2 flex flex-wrap items-center justify-end gap-6 text-xs">
           {customToolbar}
        </div>
      )}

    </div>
  );
};

/**
 * ===============================================================================
 * ADR-007 Task 4.2: INTEGRATION EXAMPLE - FrontendKpiCalculator
 * ===============================================================================
 *
 * Below is a usage example showing how to integrate custom KPI formulas
 * using the FrontendKpiCalculator for real-time sandbox calculations.
 *
 * WHEN TO USE:
 * - When users define custom KPI formulas (e.g., "{monthlyRate} * 1.15")
 * - During sandbox/draft mode to preview KPI values instantly
 * - To avoid backend API calls for every sandbox change
 *
 * EXAMPLE USAGE:
 *
 * ```tsx
 * import { kpiCalculator } from '../services/kpiCalculator';
 *
 * interface CustomKpiProps extends KpiBoardProps {
 *   kpiDefinitions: Array<{ name: string; formula: string; format: 'currency' | 'number' | 'percent' }>;
 * }
 *
 * export const CustomKpiBoard: React.FC<CustomKpiProps> = ({
 *   assets,
 *   committedAssets,
 *   kpiDefinitions
 * }) => {
 *   // Calculate custom KPIs on live sandbox data
 *   const liveKpis = kpiDefinitions.map(kpi => {
 *     const result = kpiCalculator.calculate(kpi.formula, assets);
 *     return {
 *       name: kpi.name,
 *       value: result.value,
 *       formatted: kpiCalculator.formatValue(result.value || 0, kpi.format),
 *       recordCount: result.recordCount,
 *       error: result.error
 *     };
 *   });
 *
 *   // Calculate on baseline (committed) data for comparison
 *   const baselineKpis = kpiDefinitions.map(kpi => {
 *     const result = kpiCalculator.calculate(kpi.formula, committedAssets);
 *     return {
 *       name: kpi.name,
 *       value: result.value,
 *       formatted: kpiCalculator.formatValue(result.value || 0, kpi.format)
 *     };
 *   });
 *
 *   return (
 *     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 *       {liveKpis.map((kpi, idx) => {
 *         const baseline = baselineKpis[idx];
 *         const hasChange = kpi.value !== baseline.value;
 *
 *         return (
 *           <div key={kpi.name} className="bg-white rounded-lg p-4 shadow">
 *             <div className="text-xs font-bold text-slate-400 mb-2">{kpi.name}</div>
 *
 *             {hasChange ? (
 *               <div className="flex items-center gap-2">
 *                 <span className="text-sm opacity-60 line-through">{baseline.formatted}</span>
 *                 <ArrowRight className="w-3 h-3" />
 *                 <span className="text-2xl font-bold text-blue-600">{kpi.formatted}</span>
 *               </div>
 *             ) : (
 *               <div className="text-2xl font-bold">{kpi.formatted}</div>
 *             )}
 *
 *             {kpi.error && (
 *               <div className="text-xs text-red-500 mt-1">Error: {kpi.error}</div>
 *             )}
 *           </div>
 *         );
 *       })}
 *     </div>
 *   );
 * };
 * ```
 *
 * TESTING FORMULA VALIDITY:
 *
 * ```tsx
 * import { kpiCalculator } from '../services/kpiCalculator';
 *
 * const FormulaBuilder = () => {
 *   const [formula, setFormula] = useState('');
 *
 *   const handleValidate = () => {
 *     const validation = kpiCalculator.validateFormula(formula);
 *
 *     if (validation.valid) {
 *       console.log('Valid formula!', validation.variables);
 *
 *       // Test with sample data
 *       const test = kpiCalculator.testFormula(formula);
 *       console.log('Sample result:', test.value);
 *     } else {
 *       console.error('Invalid formula:', validation.error);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <input value={formula} onChange={(e) => setFormula(e.target.value)} />
 *       <button onClick={handleValidate}>Validate</button>
 *     </div>
 *   );
 * };
 * ```
 *
 * AVAILABLE FIELDS:
 * - {monthlyRate} - Monthly rental rate
 * - {purchasePrice} - Purchase price
 * - {forecastStart} - Forecast start date (timestamp)
 * - {forecastEnd} - Forecast end date (timestamp)
 * - {originalStart} - Original start date (timestamp)
 * - {originalEnd} - Original end date (timestamp)
 * - {actualStart} - Actual start date (timestamp)
 * - {actualEnd} - Actual end date (timestamp)
 *
 * EXAMPLE FORMULAS:
 * - Cost with Tax: "{monthlyRate} * 1.15"
 * - Annual Cost: "{monthlyRate} * 12"
 * - Daily Rate: "{monthlyRate} / 30.44"
 * - Total Value: "{purchasePrice} + ({monthlyRate} * 12)"
 * - Rental vs Purchase: "{monthlyRate} * 36 - {purchasePrice}"
 *
 * CRITICAL NOTES:
 * 1. Frontend calculator uses SAME mathjs evaluation as backend
 * 2. Security: Dangerous functions are sandboxed (no eval, import, etc.)
 * 3. Performance: Instant calculation on sandbox data (no API calls)
 * 4. Consistency: Results match backend KpiCalculator exactly
 *
 * ===============================================================================
 */
