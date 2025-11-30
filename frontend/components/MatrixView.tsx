import React, { useMemo, useState, useRef, useEffect } from 'react';
import { PfaView, TimelineBounds, GroupingField, SeriesVisibility, DisplayMetric, GridColumn, GroupNode, AssetMasterRecord, ClassificationRecord } from '../types';
import { getMonthLabels, groupAssets, formatCurrencyCompact } from '../utils';
import { ChevronDown, ChevronRight, Layers, Lock } from 'lucide-react';

interface MatrixViewProps {
  pfaRecords: PfaView[];
  bounds: TimelineBounds;
  grouping: GroupingField[];
  visibleSeries: SeriesVisibility;
  onUpdateAsset: (id: string, newStart: Date, newEnd: Date, layer: 'forecast' | 'actual') => void;
  onUpdateAssetRate: (id: string, newRate: number) => void;
  barDisplayMode: DisplayMetric;
  onInitiateAddForecast?: (details: { quantity: number, startDate: Date, areaSilo: string, class: string, category: string, source: string, dor: string }) => void;
  gridColumns: GridColumn[];
  assetMaster?: AssetMasterRecord[];
  classificationData?: ClassificationRecord[];
}

const COLUMN_WIDTH = 60;

const MatrixInput = ({ 
  value, 
  onChange, 
  type = "text",
  min,
  disabled
}: { 
  value: string | number; 
  onChange: (val: any) => void; 
  type?: "text" | "number" | "date",
  min?: number,
  disabled?: boolean
}) => {
    const [localValue, setLocalValue] = useState(value);
    
    useEffect(() => { setLocalValue(value), [value] });

    if (disabled) {
        return <span className="text-xs text-slate-500">{value}</span>;
    }

    return (
        <input 
            type={type}
            min={min}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-300 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-0 text-[10px] h-5 rounded text-center font-bold text-blue-700 dark:text-blue-400 transition-all"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => {
                if (localValue !== value) onChange(localValue);
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
        />
    )
};

// --- Helper for rendering grid cells consistently ---
const renderCellContent = (col: GridColumn, meta: any) => {
    switch (col.id) {
        case 'pfaId': return <span className="font-bold text-slate-700 dark:text-slate-200">{meta.pfaId || '-'}</span>;
        case 'areaSilo': return <span className="text-slate-600 dark:text-slate-400">{meta.areaSilo}</span>;
        case 'class': return <span className="text-slate-600 dark:text-slate-400">{meta.class}</span>;
        case 'category': return <span className="text-slate-600 dark:text-slate-400">{meta.category}</span>;
        case 'source': 
            return (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${meta.source === 'Rental' ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' : 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'}`}>
                    {meta.source}
                </span>
            );
        case 'dor': return <span className="text-slate-500 font-mono">{meta.dor}</span>;
        case 'manufacturer': return <span className="text-slate-600 dark:text-slate-400">{meta.manufacturer}</span>;
        case 'model': return <span className="text-slate-600 dark:text-slate-400">{meta.model}</span>;
        case 'isActualized': // Equipment
             if (meta.equipment) {
                   return (
                       <div className="flex items-center w-full gap-1.5 text-slate-600 dark:text-slate-300 select-none overflow-hidden">
                           <Lock className="w-3 h-3 flex-none text-slate-400" />
                           <span className="text-[10px] font-bold truncate" title={meta.equipment}>{meta.equipment}</span>
                       </div>
                   );
             }
             return <span className="text-slate-400 italic text-[10px]">Unassigned</span>;
        case 'ratePrice': return <span className="text-slate-600 dark:text-slate-400">{meta.ratePrice !== undefined ? formatCurrencyCompact(meta.ratePrice) : '-'}</span>;
        default: return null;
    }
};


// --- High Density Compact Matrix Logic ---

interface AssetBlock {
    id: string;
    key: string;
    meta: any;
    series: {
        plan: number[];
        forecast: number[];
        actual: number[];
    };
}

const CompactQuantityMatrix = ({ pfaRecords, months, onInitiateAddForecast, gridColumns, visibleSeries }: {
    pfaRecords: PfaView[],
    months: Date[],
    onInitiateAddForecast?: MatrixViewProps['onInitiateAddForecast'],
    gridColumns: GridColumn[],
    visibleSeries: SeriesVisibility
}) => {
    const headerRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);

    const handleScroll = () => {
        if (headerRef.current && bodyRef.current) {
            headerRef.current.scrollLeft = bodyRef.current.scrollLeft;
        }
    };

    // Filter columns relevant for Quantity View
    const quantityColumns = useMemo(() => gridColumns.filter(c => 
        c.visible && 
        !['pfaId', 'estimatedStart', 'estimatedEnd', 'totalCost', 'isActualized'].includes(c.id)
    ), [gridColumns]);

    const fixedWidth = useMemo(() => quantityColumns.reduce((sum, col) => sum + col.width, 0), [quantityColumns]);

    // 1. Aggregate Data into Flat Blocks
    const blocks = useMemo(() => {
        const blockMap = new Map<string, AssetBlock>();

        const isInRange = (m: Date, s: Date, e: Date) => {
            const mTime = new Date(m.getFullYear(), m.getMonth(), 1).getTime();
            const sTime = new Date(s.getFullYear(), s.getMonth(), 1).getTime();
            const eTime = new Date(e.getFullYear(), e.getMonth(), 1).getTime();
            return mTime >= sTime && mTime <= eTime;
        };

        pfaRecords.forEach(asset => {
            // Create unique signature for the "Asset Block"
            const make = asset.manufacturer || '';
            const model = asset.model || '';
            const key = `${asset.areaSilo}|${asset.class}|${asset.category}|${make}|${model}|${asset.source}|${asset.dor}`;

            if (!blockMap.has(key)) {
                blockMap.set(key, {
                    id: key,
                    key,
                    meta: {
                        areaSilo: asset.areaSilo,
                        class: asset.class,
                        category: asset.category,
                        manufacturer: make,
                        model: model,
                        source: asset.source,
                        dor: asset.dor,
                        ratePrice: asset.source === 'Rental' ? asset.monthlyRate : asset.purchasePrice
                    },
                    series: {
                        plan: new Array(months.length).fill(0),
                        forecast: new Array(months.length).fill(0),
                        actual: new Array(months.length).fill(0)
                    }
                });
            }

            const block = blockMap.get(key)!;

            months.forEach((m, i) => {
                if (isInRange(m, asset.originalStart, asset.originalEnd)) block.series.plan[i]++;
                if (isInRange(m, asset.forecastStart, asset.forecastEnd)) block.series.forecast[i]++;
                if (asset.isActualized && isInRange(m, asset.actualStart, asset.actualEnd)) block.series.actual[i]++;
            });
        });

        const result = Array.from(blockMap.values());
        
        result.sort((a, b) => {
            if (a.meta.areaSilo !== b.meta.areaSilo) return a.meta.areaSilo.localeCompare(b.meta.areaSilo);
            if (a.meta.class !== b.meta.class) return a.meta.class.localeCompare(b.meta.class);
            return a.key.localeCompare(b.key);
        });

        return result;
    }, [pfaRecords, months]);

    const rowHeightClass = "h-14"; // Fixed height for the merged row

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-black/50 font-sans text-xs">
             
             {/* Toolbar */}
             <div className="flex-none h-10 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 justify-between">
                 <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                     <Layers className="w-3.5 h-3.5" /> Compact Quantity Matrix
                 </div>
                 <div className="text-[10px] text-slate-400 font-medium flex items-center gap-4">
                     {visibleSeries.plan && <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400"></div> Plan</div>}
                     {visibleSeries.actual && <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Actual</div>}
                     {visibleSeries.forecast && <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Forecast (Editable)</div>}
                 </div>
             </div>

             {/* Table Header */}
             <div className="flex flex-none h-8 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 z-20 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
                 <div className="flex-none flex sticky left-0 z-30 bg-slate-100 dark:bg-slate-800 shadow-[4px_0_8px_rgba(0,0,0,0.05)]" style={{ width: fixedWidth }}>
                     {quantityColumns.map(col => (
                         <div key={col.id} className="flex items-center px-2 border-r border-slate-200 dark:border-slate-700 truncate" style={{ width: col.width }}>
                             {col.label}
                         </div>
                     ))}
                 </div>
                 <div className="flex-1 overflow-hidden relative" ref={headerRef}>
                    <div className="flex" style={{ width: months.length * COLUMN_WIDTH }}>
                        {months.map((m, i) => (
                             <div key={i} className="flex-none flex items-center justify-center border-r border-slate-200 dark:border-slate-700" style={{ width: COLUMN_WIDTH }}>
                                 {m.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                             </div>
                        ))}
                    </div>
                 </div>
             </div>

             {/* Table Body */}
             <div className="flex-1 overflow-auto custom-scrollbar bg-white dark:bg-slate-900" ref={bodyRef} onScroll={handleScroll}>
                 <div style={{ width: fixedWidth + (months.length * COLUMN_WIDTH) }}>
                     {blocks.map((block, idx) => {
                         const isEven = idx % 2 === 0;
                         const blockBg = isEven ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/30 dark:bg-slate-800/20';
                         
                         return (
                             <div key={block.id} className={`flex border-b border-slate-100 dark:border-slate-800 ${blockBg} hover:bg-slate-50 dark:hover:bg-slate-800/50 group`}>
                                 
                                 {/* Sticky Context Columns */}
                                 <div className={`flex-none flex sticky left-0 z-10 shadow-[4px_0_8px_rgba(0,0,0,0.03)] ${blockBg} group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 transition-colors ${rowHeightClass}`} style={{ width: fixedWidth }}>
                                     {quantityColumns.map(col => (
                                         <div key={col.id} className="flex-none flex items-center px-2 border-r border-slate-100 dark:border-slate-800 overflow-hidden" style={{ width: col.width }}>
                                              {renderCellContent(col, block.meta)}
                                         </div>
                                     ))}
                                 </div>

                                 {/* Timeline Data Row (Merged) */}
                                 <div className={`flex flex-1 items-center ${rowHeightClass}`}>
                                     {months.map((_m, i) => {
                                        const planVal = block.series.plan[i];
                                        const forecastVal = block.series.forecast[i];
                                        const actualVal = block.series.actual[i];

                                        return (
                                            <div key={i} className="flex-none border-r border-slate-100 dark:border-slate-800 flex flex-col justify-center px-1 h-full" style={{ width: COLUMN_WIDTH }}>
                                                
                                                {/* Top Row: Plan & Actual (Small) */}
                                                <div className="flex justify-between items-end w-full mb-0.5 px-0.5">
                                                    {visibleSeries.plan ? (
                                                        <span className={`text-[9px] leading-none font-bold ${planVal > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-slate-200 dark:text-slate-700'}`}>
                                                            {planVal > 0 ? planVal : '-'}
                                                        </span>
                                                    ) : <span />}
                                                    
                                                    {visibleSeries.actual ? (
                                                        <span className={`text-[9px] leading-none font-bold ${actualVal > 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-slate-200 dark:text-slate-700'}`}>
                                                            {actualVal > 0 ? actualVal : '-'}
                                                        </span>
                                                    ) : <span />}
                                                </div>

                                                {/* Bottom Row: Forecast Input (Editable) */}
                                                {visibleSeries.forecast && (
                                                    <MatrixInput 
                                                        type="number"
                                                        min={forecastVal}
                                                        value={forecastVal}
                                                        onChange={(newVal) => {
                                                            const num = parseInt(newVal) || 0;
                                                            // Calculate diff to add new assets if increased
                                                            if (num > forecastVal && onInitiateAddForecast) {
                                                                onInitiateAddForecast({
                                                                    quantity: num - forecastVal,
                                                                    startDate: months[i],
                                                                    ...block.meta
                                                                });
                                                            }
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        );
                                     })}
                                 </div>

                             </div>
                         )
                     })}
                 </div>
             </div>
        </div>
    );
}

export const MatrixView: React.FC<MatrixViewProps> = ({
  pfaRecords,
  bounds,
  grouping,
  visibleSeries,
  onUpdateAsset: _onUpdateAsset,
  onUpdateAssetRate: _onUpdateAssetRate,
  barDisplayMode,
  onInitiateAddForecast,
  gridColumns,
  assetMaster: _assetMaster,
  classificationData: _classificationData
}) => {
  // --- Shared Logic ---
  const months = useMemo(() => getMonthLabels(bounds), [bounds]);
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (headerRef.current && bodyRef.current) {
        headerRef.current.scrollLeft = bodyRef.current.scrollLeft;
    }
  };

  const isInRange = (monthDate: Date, start: Date, end: Date) => {
      const m = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const s = new Date(start.getFullYear(), start.getMonth(), 1);
      const e = new Date(end.getFullYear(), end.getMonth(), 1);
      return m >= s && m <= e;
  };

  // --- 1. STANDARD HIERARCHICAL VIEW (Cost / Duration) ---
  const hierarchicalData = useMemo(() => {
      if (barDisplayMode === 'quantity') return []; // Skip if in quantity mode
      return groupAssets(pfaRecords, grouping);
  }, [pfaRecords, grouping, barDisplayMode]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupId: string) => {
    const newSet = new Set(collapsedGroups);
    if (newSet.has(groupId)) newSet.delete(groupId);
    else newSet.add(groupId);
    setCollapsedGroups(newSet);
  };

  // Use visible columns from settings for Standard View
  const visibleColumns = useMemo(() => gridColumns.filter(c => c.visible), [gridColumns]);
  const metaWidth = useMemo(() => visibleColumns.reduce((sum, col) => sum + col.width, 0), [visibleColumns]);

  // --- QUANTITY MODE ---
  if (barDisplayMode === 'quantity') {
      return (
        <CompactQuantityMatrix
            pfaRecords={pfaRecords}
            months={months}
            onInitiateAddForecast={onInitiateAddForecast}
            gridColumns={gridColumns}
            visibleSeries={visibleSeries}
        />
      );
  }

  // --- STANDARD MATRIX RENDER (Timeline Details) ---
  
  const renderMatrixGroup = (node: GroupNode) => {
      const isCollapsed = collapsedGroups.has(node.id);
      const paddingLeft = node.level * 16;
      const showAssets = node.children.length === 0;

      return (
          <div key={node.id}>
              <div 
                  className="sticky left-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center h-8 px-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 z-10 transition-colors"
                  style={{ width: metaWidth + (months.length * COLUMN_WIDTH) }}
                  onClick={() => toggleGroup(node.id)}
              >
                  <div className="flex items-center gap-2 sticky left-0" style={{ paddingLeft }}>
                      {isCollapsed ? <ChevronRight className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{node.label}</span>
                      <span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1.5 rounded-full text-slate-600 dark:text-slate-300">{node.totals.count}</span>
                  </div>
              </div>

              {!isCollapsed && (
                  <>
                     {node.children.map((child: GroupNode) => renderMatrixGroup(child))}
                     {showAssets && node.assets.map((asset: PfaView) => {
                         return (
                            <div key={asset.id} className="border-b border-slate-100 dark:border-slate-800 group flex">
                                {/* Sticky Columns Container - Full Height of Asset Entry */}
                                <div className="sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 flex-none border-r border-slate-200 dark:border-slate-700 flex items-center z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors" style={{ width: metaWidth }}>
                                        {visibleColumns.map(col => (
                                            <div key={col.id} className="flex-none flex items-center px-2 border-r border-slate-100 dark:border-slate-800 h-full overflow-hidden text-xs" style={{ width: col.width }}>
                                                {renderCellContent(col, {
                                                    ...asset,
                                                    ratePrice: asset.source === 'Rental' ? asset.monthlyRate : asset.purchasePrice
                                                })}
                                            </div>
                                        ))}
                                </div>

                                {/* Data Rows Column */}
                                <div className="flex-1 flex flex-col">
                                    {/* Plan */}
                                    {visibleSeries.plan && (
                                        <div className="flex h-8 hover:bg-slate-50 dark:hover:bg-slate-800/50 items-center">
                                                <div className="flex-none w-10 flex items-center justify-center border-r border-slate-100 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-900/10">
                                                    <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400">PLN</span>
                                                </div>
                                                <div className="flex">
                                                {months.map((monthDate, i) => {
                                                    const active = isInRange(monthDate, asset.originalStart, asset.originalEnd);
                                                    return (
                                                        <div key={i} className={`flex-none border-r border-slate-100 dark:border-slate-800 flex items-center justify-center text-[9px] h-8 ${active ? 'bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 font-medium' : ''}`} style={{ width: COLUMN_WIDTH }}>
                                                            {active ? formatCurrencyCompact(asset.monthlyRate) : ''}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Forecast */}
                                    {visibleSeries.forecast && (
                                            <div className="flex h-8 hover:bg-slate-50 dark:hover:bg-slate-800/50 items-center bg-blue-50/5 dark:bg-blue-900/5">
                                            <div className="flex-none w-10 flex items-center justify-center border-r border-slate-100 dark:border-slate-800 bg-blue-50/50 dark:bg-blue-900/10">
                                                    <span className="text-[9px] font-bold text-blue-700 dark:text-blue-400">FCS</span>
                                                </div>
                                                <div className="flex">
                                                {months.map((monthDate, i) => {
                                                    const active = isInRange(monthDate, asset.forecastStart, asset.forecastEnd);
                                                    return (
                                                        <div key={i} className={`flex-none border-r border-slate-100 dark:border-slate-800 flex items-center justify-center text-[9px] h-8 ${active ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-bold' : ''}`} style={{ width: COLUMN_WIDTH }}>
                                                            {active ? formatCurrencyCompact(asset.monthlyRate) : ''}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            </div>
                                    )}

                                    {/* Actual */}
                                    {visibleSeries.actual && asset.hasActuals && (
                                            <div className="flex h-8 hover:bg-slate-50 dark:hover:bg-slate-800/50 items-center">
                                            <div className="flex-none w-10 flex items-center justify-center border-r border-slate-100 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-900/10">
                                                    <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400">ACT</span>
                                                </div>
                                                <div className="flex">
                                                {months.map((monthDate, i) => {
                                                    const active = isInRange(monthDate, asset.actualStart, asset.actualEnd);
                                                    return (
                                                        <div key={i} className={`flex-none border-r border-slate-100 dark:border-slate-800 flex items-center justify-center text-[9px] h-8 ${active ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 font-medium' : ''}`} style={{ width: COLUMN_WIDTH }}>
                                                            {active ? formatCurrencyCompact(asset.monthlyRate) : ''}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            </div>
                                    )}
                                </div>
                            </div>
                        );
                     })}
                  </>
              )}
          </div>
      );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-black/40 text-slate-800 dark:text-slate-200">
        {/* Header */}
        <div className="flex flex-none border-b border-slate-300 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/50 h-10">
            <div className="flex-none border-r border-slate-300 dark:border-slate-700 flex bg-slate-100 dark:bg-slate-800 z-20 shadow-[4px_0_8px_rgba(0,0,0,0.05)]" style={{ width: metaWidth }}>
                {visibleColumns.map(col => (
                     <div key={col.id} className="flex items-center px-2 border-r border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase truncate" style={{ width: col.width }}>
                         {col.label}
                     </div>
                 ))}
            </div>
            <div className="flex-1 overflow-hidden relative" ref={headerRef}>
                 <div className="flex" style={{ width: months.length * COLUMN_WIDTH }}>
                    {months.map((m, i) => (
                        <div key={i} className="flex-none flex items-center justify-center border-r border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase" style={{ width: COLUMN_WIDTH }}>
                            {m.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                        </div>
                    ))}
                 </div>
            </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto custom-scrollbar bg-white dark:bg-slate-900" ref={bodyRef} onScroll={handleScroll}>
            <div style={{ width: metaWidth + (months.length * COLUMN_WIDTH) }}>
                {hierarchicalData.map(node => renderMatrixGroup(node))}
            </div>
        </div>
    </div>
  );
};
