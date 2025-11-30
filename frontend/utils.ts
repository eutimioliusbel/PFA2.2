
import { TimelineBounds, PfaRecord, GroupingField, Scale, GroupNode } from './types';

// Helper to ensure we have a valid Date object
const toDate = (d: Date | string | number | null | undefined): Date | null => {
    if (!d) return null;
    if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
    const newDate = new Date(d);
    return isNaN(newDate.getTime()) ? null : newDate;
};

export const formatDate = (date: Date | string | number | undefined | null): string => {
  const d = toDate(date);
  if (!d) return '-';
  return d.toISOString().split('T')[0];
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatCurrencyCompact = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(amount);
};

export const getDaysDiff = (start: Date | string | number, end: Date | string | number): number => {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e) return 0;
  
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((e.getTime() - s.getTime()) / oneDay);
};

export const addDays = (date: Date | string | number, days: number): Date => {
  const result = toDate(date) || new Date();
  result.setDate(result.getDate() + days);
  return result;
};

export const addMonths = (date: Date | string | number, months: number): Date => {
  const result = toDate(date) || new Date();
  result.setMonth(result.getMonth() + months);
  return result;
};

export const calculateCost = (start: Date | string, end: Date | string, monthlyRate: number, source: 'Purchase' | 'Rental' = 'Rental', purchasePrice: number = 0): number => {
  if (source === 'Purchase') {
    return purchasePrice || 0;
  }
  // Rental Calculation
  const days = Math.max(0, getDaysDiff(start, end));
  // Approximation: 30.44 days per month standard
  return (days / 30.44) * (monthlyRate || 0);
};

// Reverse Engineering: Given a Target Cost and a Rate, find the End Date (Only works for Rental)
export const calculateEndDateFromCost = (start: Date | string, monthlyRate: number, targetCost: number): Date => {
  const s = toDate(start) || new Date();
  if (!monthlyRate || monthlyRate <= 0) return s; 
  const months = targetCost / monthlyRate;
  const days = Math.round(months * 30.44);
  return addDays(s, days);
};

export const getTimelineBounds = (startStr: string, endStr: string): TimelineBounds => {
  const start = new Date(startStr);
  const end = new Date(endStr);
  
  // Safety check
  if (isNaN(start.getTime())) start.setTime(Date.now());
  if (isNaN(end.getTime())) end.setTime(Date.now() + 30*24*60*60*1000);

  start.setMonth(start.getMonth() - 1);
  end.setMonth(end.getMonth() + 1);
  
  const totalDays = getDaysDiff(start, end);
  return { start, end, totalDays };
};

export const getTimelineTicks = (bounds: TimelineBounds, scale: Scale): Date[] => {
  const ticks = [];
  const current = new Date(bounds.start);
  const end = new Date(bounds.end);
  const MAX_TICKS = 2500; // Absolute safety cap to prevent browser freeze

  if (isNaN(current.getTime()) || isNaN(end.getTime())) return [];

  // Reset to clean start
  if (scale === 'Year') current.setMonth(0, 1);
  else if (scale === 'Month') current.setDate(1);
  else if (scale === 'Week') {
     const day = current.getDay(); // 0 is Sun
     // Adjust to prev Monday
     const diff = current.getDate() - day + (day === 0 ? -6 : 1);
     current.setDate(diff);
  }

  while (current <= end) {
    ticks.push(new Date(current));
    if (scale === 'Year') current.setFullYear(current.getFullYear() + 1);
    else if (scale === 'Month') current.setMonth(current.getMonth() + 1);
    else if (scale === 'Week') current.setDate(current.getDate() + 7);
    else current.setDate(current.getDate() + 1);
    
    if (ticks.length >= MAX_TICKS) break;
  }
  return ticks;
};

// Calibrated base pixels for smooth transitions (factors of approx 4-5)
export const getPixelsPerDay = (scale: Scale): number => {
  switch(scale) {
    case 'Day': return 40;   // Base for Day
    case 'Week': return 8;   // Base for Week (40 / 5)
    case 'Month': return 1.6;  // Base for Month (8 / 5)
    case 'Year': return 0.4; // Base for Year (1.6 / 4)
  }
  return 1.6;
};

export const formatTick = (date: Date, scale: Scale): string => {
    if (scale === 'Year') return date.getFullYear().toString();
    if (scale === 'Month') return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    if (scale === 'Week') return `${date.getDate()} ${date.toLocaleDateString('en-US', { month: 'short' })}`;
    if (scale === 'Day') return `${date.getDate()}`;
    return '';
};

// For compatibility with existing Matrix view (always months for now)
export const getMonthLabels = (bounds: TimelineBounds) => {
    return getTimelineTicks(bounds, 'Month');
};

// --- Aggregation Helpers ---

type CostSummary = {
  purchase: number;
  rental: number;
  total: number;
};

export const aggregateCosts = (assets: PfaRecord[], type: 'original' | 'forecast' | 'actual'): CostSummary => {
  return assets.reduce(
    (acc, asset) => {
      let start, end;
      
      if (type === 'original') {
        start = asset.originalStart;
        end = asset.originalEnd;
      } else if (type === 'forecast') {
        start = asset.forecastStart;
        end = asset.forecastEnd;
      } else {
        if (!asset.hasActuals) return acc;
        start = asset.actualStart;
        end = asset.actualEnd;
      }

      const cost = calculateCost(start, end, asset.monthlyRate, asset.source, asset.purchasePrice);

      if (asset.source === 'Purchase') {
        acc.purchase += cost;
      } else {
        acc.rental += cost;
      }
      acc.total += cost;
      return acc;
    },
    { purchase: 0, rental: 0, total: 0 }
  );
};

// --- Grouping Engine ---

const calculateGroupStats = (groupAssets: PfaRecord[]) => {
    const plan = aggregateCosts(groupAssets, 'original').total;
    const forecast = aggregateCosts(groupAssets, 'forecast').total;
    const actual = aggregateCosts(groupAssets, 'actual').total;
    
    // Bounds Calculation
    let minPlanStart = new Date(8640000000000000);
    let maxPlanEnd = new Date(-8640000000000000);
    let minFcstStart = new Date(8640000000000000);
    let maxFcstEnd = new Date(-8640000000000000);
    let minActStart = new Date(8640000000000000);
    let maxActEnd = new Date(-8640000000000000);
    let hasActuals = false;

    if (groupAssets.length > 0) {
        groupAssets.forEach(a => {
            if (a.originalStart < minPlanStart) minPlanStart = a.originalStart;
            if (a.originalEnd > maxPlanEnd) maxPlanEnd = a.originalEnd;
            
            if (a.forecastStart < minFcstStart) minFcstStart = a.forecastStart;
            if (a.forecastEnd > maxFcstEnd) maxFcstEnd = a.forecastEnd;

            if (a.hasActuals) {
                hasActuals = true;
                if (a.actualStart < minActStart) minActStart = a.actualStart;
                if (a.actualEnd > maxActEnd) maxActEnd = a.actualEnd;
            }
        });
    } else {
        minPlanStart = new Date();
        maxPlanEnd = new Date();
        minFcstStart = new Date();
        maxFcstEnd = new Date();
    }

    // Fallback if empty group (unlikely)
    if (minPlanStart.getFullYear() >= 275760) minPlanStart = new Date();
    if (maxPlanEnd.getFullYear() <= -271821) maxPlanEnd = new Date();

    return {
        totals: { plan, forecast, actual, delta: forecast - plan, count: groupAssets.length },
        bounds: {
            plan: { start: minPlanStart, end: maxPlanEnd },
            forecast: { start: minFcstStart, end: maxFcstEnd },
            actual: hasActuals ? { start: minActStart, end: maxActEnd } : null
        }
    };
};

export const groupAssets = (assets: PfaRecord[], grouping: GroupingField[]): GroupNode[] => {
  if (!grouping || grouping.length === 0 || grouping[0] === 'none') {
    return [{
      id: 'all',
      label: 'All Assets',
      field: 'none',
      level: 0,
      assets,
      children: [],
      ...calculateGroupStats(assets)
    }];
  }

  const groupRecursive = (currentAssets: PfaRecord[], level: number): GroupNode[] => {
      if (level >= grouping.length) return [];
      
      const field = grouping[level];
      if (field === 'none') return [];

      const groups: Record<string, PfaRecord[]> = {};

      currentAssets.forEach(asset => {
        let key = '';
        if (field === 'category') key = asset.category;
        else if (field === 'class') key = asset.class;
        else if (field === 'source') key = asset.source;
        else if (field === 'dor') key = asset.dor;
        else if (field === 'areaSilo') key = asset.areaSilo;
        else if (field === 'manufacturer') key = asset.manufacturer || 'Unknown';
        else if (field === 'model') key = asset.model || 'Unknown';
        else if (field === 'status') {
            if (asset.isDiscontinued) key = 'Discontinued';
            else if (asset.isActualized) key = 'Actualized';
            else if (asset.isFundsTransferable) key = 'Funds Transferable';
            else key = 'Planned/Forecast';
        }
        
        if (!groups[key]) groups[key] = [];
        groups[key].push(asset);
      });

      return Object.entries(groups).map(([label, grpAssets]) => {
          const children = groupRecursive(grpAssets, level + 1);
          
          return {
              id: `${field}-${label}-${level}`,
              label,
              field,
              level,
              assets: grpAssets,
              children,
              ...calculateGroupStats(grpAssets)
          };
      }).sort((a, b) => a.label.localeCompare(b.label));
  };

  return groupRecursive(assets, 0);
};
