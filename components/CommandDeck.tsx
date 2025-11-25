
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Maximize2, 
  Minimize2, 
  RotateCcw, 
  CalendarClock,
  DollarSign,
  Users,
  Edit3,
  CheckCircle2,
  XCircle,
  Check,
  Calendar,
  ToggleLeft,
  ToggleRight,
  Lock,
  RefreshCw
} from 'lucide-react';
import { Asset, Scale, AssetMasterRecord } from '../types';
import { calculateCost, formatCurrency } from '../utils';

interface CommandDeckProps {
  selectedCount: number;
  selectedAssets: Asset[];
  onShiftTime: (days: number) => void;
  onAdjustDuration: (days: number) => void;
  onResetSelected: () => void;
  onBulkUpdate: (updates: Partial<Asset>) => void;
  scale: Scale;
  availableCategories: string[];
  availableDors: string[];
  assetMaster?: AssetMasterRecord[];
}

export const CommandDeck: React.FC<CommandDeckProps> = ({
  selectedCount,
  selectedAssets,
  onShiftTime,
  onAdjustDuration,
  onResetSelected,
  onBulkUpdate,
  scale,
  availableCategories,
  availableDors,
  assetMaster = []
}) => {
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [swapMode, setSwapMode] = useState(false);
  
  // Safe access to the first asset if available
  const primaryAsset = selectedAssets.length > 0 ? selectedAssets[0] : null;
  // Effective count of visible assets to operate on
  const visibleSelectedCount = selectedAssets.length;

  // Determine steps based on scale
  const { unitLabel, baseStep, largeStep, largeLabelMult } = useMemo(() => {
      switch(scale) {
          case 'Day': return { unitLabel: 'd', baseStep: 1, largeStep: 7, largeLabelMult: 7 };
          case 'Week': return { unitLabel: 'w', baseStep: 7, largeStep: 28, largeLabelMult: 4 };
          case 'Month': return { unitLabel: 'm', baseStep: 30, largeStep: 180, largeLabelMult: 6 };
          case 'Year': return { unitLabel: 'y', baseStep: 365, largeStep: 1825, largeLabelMult: 5 };
          default: return { unitLabel: 'd', baseStep: 1, largeStep: 7, largeLabelMult: 7 };
      }
  }, [scale]);

  useEffect(() => {
      if (selectedCount === 0) {
          setIsMinimized(false);
          setShowEditMenu(false);
          setSwapMode(false);
      }
  }, [selectedCount]);

  // Check if any selected asset is actualized
  const hasActualizedSelected = useMemo(() => selectedAssets.some(a => a.isActualized), [selectedAssets]);

  // Check current state for checkboxes (if all selected have it)
  const isAllFt = useMemo(() => selectedAssets.every(a => a.isFundsTransferable), [selectedAssets]);
  const isAllDisc = useMemo(() => selectedAssets.every(a => a.isDiscontinued), [selectedAssets]);

  // Filter Equipment for the primary asset based on class and category
  const availableEquipment = useMemo(() => {
      if (!primaryAsset) return [];
      return assetMaster.filter(eq => 
          eq.class === primaryAsset.class && 
          eq.category === primaryAsset.category && 
          eq.equipmentStatus === 'Active'
      );
  }, [primaryAsset, assetMaster]);

  // If nothing is selected (globally), hide.
  if (selectedCount === 0) return null;

  // If selected items are filtered out (visibleSelectedCount is 0), we can either hide the deck or show a "Hidden" state.
  if (visibleSelectedCount === 0) {
      return (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="bg-slate-900/90 backdrop-blur-md text-white rounded-full px-4 py-2 shadow-xl border border-slate-700 flex items-center gap-3 opacity-80">
                <Users className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold italic">{selectedCount} Selected (Hidden by Filter)</span>
                <div className="w-px h-4 bg-slate-700"></div>
                <button onClick={onResetSelected} className="text-xs text-red-400 hover:text-red-300 font-bold">Clear</button>
            </div>
        </div>
      );
  }

  // Minimized View
  if (isMinimized) {
    return (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div 
                className="bg-slate-900/90 backdrop-blur-md text-white rounded-full px-4 py-2 shadow-xl border border-slate-700 flex items-center gap-3 cursor-pointer hover:bg-slate-800 transition-colors group" 
                onClick={() => setIsMinimized(false)}
                title="Restore Command Deck"
            >
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold">{selectedCount} Selected</span>
                <div className="w-px h-4 bg-slate-700"></div>
                <Maximize2 className="w-3 h-3 text-slate-400 group-hover:text-white transition-colors" />
            </div>
        </div>
    );
  }

  // Calculate instantaneous impact of selected items
  const originalCost = selectedAssets.reduce((sum, a) => 
    sum + calculateCost(a.originalStart, a.originalEnd, a.monthlyRate, a.source, a.purchasePrice), 0);
  
  const forecastCost = selectedAssets.reduce((sum, a) => 
    sum + calculateCost(a.forecastStart, a.forecastEnd, a.monthlyRate, a.source, a.purchasePrice), 0);

  const delta = forecastCost - originalCost;

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center gap-2 animate-in slide-in-from-bottom-4 duration-300">
      
      {/* Bulk Edit Popover (FORECAST ONLY) */}
      {showEditMenu && !hasActualizedSelected && (
          <div className="bg-slate-800 text-white rounded-xl p-4 shadow-2xl border border-slate-600 w-[400px] mb-2 animate-in slide-in-from-bottom-2 zoom-in-95">
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-700">
                  <span className="font-bold text-sm">Bulk Edit Properties</span>
                  <button onClick={() => setShowEditMenu(false)}><XCircle className="w-4 h-4 text-slate-400 hover:text-white" /></button>
              </div>
              
              {/* Dates Section */}
              <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-slate-700 border-dashed">
                  <div>
                      <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Start Date
                      </label>
                      <input 
                          type="date" 
                          className="w-full bg-slate-900 border border-slate-600 rounded text-xs p-1.5 [color-scheme:dark]"
                          onChange={(e) => e.target.value && onBulkUpdate({ forecastStart: new Date(e.target.value) })}
                      />
                  </div>
                  <div>
                      <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> End Date
                      </label>
                      <input 
                          type="date" 
                          className="w-full bg-slate-900 border border-slate-600 rounded text-xs p-1.5 [color-scheme:dark]"
                          onChange={(e) => e.target.value && onBulkUpdate({ forecastEnd: new Date(e.target.value) })}
                      />
                  </div>
              </div>

              {/* Category Row - Full Width */}
              <div className="mb-3">
                  <label className="text-[10px] uppercase text-slate-400 font-bold">Category</label>
                  <select 
                    onChange={(e) => e.target.value && onBulkUpdate({ category: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded text-xs p-1.5 mt-1"
                  >
                      <option value="">No Change</option>
                      {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
              </div>

              {/* Source and DOR Row */}
              <div className="grid grid-cols-2 gap-4 mb-3">
                   <div>
                      <label className="text-[10px] uppercase text-slate-400 font-bold">Source</label>
                      <select 
                        onChange={(e) => e.target.value && onBulkUpdate({ source: e.target.value as any })}
                        className="w-full bg-slate-900 border border-slate-600 rounded text-xs p-1.5 mt-1"
                      >
                          <option value="">No Change</option>
                          <option value="Rental">Rental</option>
                          <option value="Purchase">Purchase</option>
                      </select>
                  </div>
                   <div>
                      <label className="text-[10px] uppercase text-slate-400 font-bold">DOR</label>
                      <select 
                        onChange={(e) => e.target.value && onBulkUpdate({ dor: e.target.value as any })}
                        className="w-full bg-slate-900 border border-slate-600 rounded text-xs p-1.5 mt-1"
                      >
                          <option value="">No Change</option>
                          {availableDors.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 {/* Checkboxes for Forecast Only */}
                  <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded border border-slate-700">
                      <input 
                        type="checkbox" 
                        id="chk_ft"
                        checked={isAllFt}
                        onChange={(e) => {
                            const checked = e.target.checked;
                            // Mutual Exclusion: If FT is checked, Discontinued must be false
                            onBulkUpdate({ 
                                isFundsTransferable: checked,
                                ...(checked ? { isDiscontinued: false } : {})
                            });
                        }}
                        className="rounded border-slate-500 bg-slate-800 text-blue-600 focus:ring-offset-slate-900"
                      />
                      <label htmlFor="chk_ft" className="text-xs text-slate-300 font-medium cursor-pointer">Funds Transferable</label>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded border border-slate-700">
                      <input 
                        type="checkbox" 
                        id="chk_disc"
                        checked={isAllDisc}
                        onChange={(e) => {
                            const checked = e.target.checked;
                            // Mutual Exclusion: If Discontinued is checked, FT must be false
                            onBulkUpdate({ 
                                isDiscontinued: checked,
                                ...(checked ? { isFundsTransferable: false } : {})
                            });
                        }}
                        className="rounded border-slate-500 bg-slate-800 text-red-600 focus:ring-offset-slate-900"
                      />
                      <label htmlFor="chk_disc" className="text-xs text-slate-300 font-medium cursor-pointer">Discontinue</label>
                  </div>
              </div>
          </div>
      )}

      <div className="bg-slate-900/90 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700/50 p-2 flex items-center gap-4 shadow-blue-900/20">
        
        {/* Section: Selection Info */}
        <div className="flex items-center gap-3 px-3 border-r border-slate-700">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Selected</div>
            <div className="font-bold">{selectedCount} Assets</div>
          </div>
        </div>

        {/* Section: Asset Selector (Single Selection Logic) */}
        {/* Check visibleSelectedCount to prevent accessing index 0 of empty array */}
        {visibleSelectedCount === 1 && primaryAsset && (
            <div className="flex items-center gap-2 px-2 border-r border-slate-700 pr-4">
                <div className="flex flex-col gap-1 w-48">
                    <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">
                        Asset / Equipment
                        {hasActualizedSelected && !swapMode && <Lock className="w-2.5 h-2.5" />}
                    </span>
                    
                    {!hasActualizedSelected || swapMode ? (
                        <select 
                            className="bg-slate-800 border border-slate-600 rounded text-xs py-1 px-2 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                            value={primaryAsset.equipment ? primaryAsset.equipment.split(' - ')[0] : ''}
                            onChange={(e) => {
                                const selectedTag = e.target.value;
                                const eq = assetMaster.find(am => am.assetTag === selectedTag);
                                if (eq) {
                                    onBulkUpdate({ equipment: `${eq.assetTag} - ${eq.description}` });
                                } else {
                                    onBulkUpdate({ equipment: '' });
                                }
                            }}
                        >
                            <option value="">Select Asset...</option>
                            {availableEquipment.map(eq => (
                                <option key={eq.id} value={eq.assetTag}>{eq.assetTag} - {eq.description}</option>
                            ))}
                        </select>
                    ) : (
                        <div className="text-xs font-bold text-slate-200 truncate" title={primaryAsset.equipment}>
                            {primaryAsset.equipment || 'No Equipment'}
                        </div>
                    )}
                </div>
                
                {hasActualizedSelected && (
                    <div className="flex items-center gap-2 ml-2">
                        <div className="w-px h-6 bg-slate-700 mx-1"></div>
                        <div className="flex flex-col items-center">
                            <input 
                                type="checkbox" 
                                id="swap_chk" 
                                checked={swapMode}
                                onChange={(e) => {
                                    setSwapMode(e.target.checked);
                                    // "Unlock and clear" behavior - visually we clear, but logically maybe we don't clear until selection
                                    if (e.target.checked) {
                                        // Optional: Clear immediately? User requested "unlock and clear"
                                        onBulkUpdate({ equipment: '' });
                                    }
                                }}
                                className="rounded border-slate-500 bg-slate-800 text-blue-500 focus:ring-offset-slate-900"
                            />
                            <label htmlFor="swap_chk" className="text-[9px] font-bold text-slate-400 uppercase cursor-pointer mt-0.5">Swap</label>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Section: Actions / Date Picker (Depends on Actuals) */}
        {hasActualizedSelected ? (
            <div className="flex items-center gap-2 px-1">
                 <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Set End Date</span>
                    <input 
                        type="date" 
                        className="bg-slate-800 border border-slate-600 rounded text-xs px-2 py-1 text-white [color-scheme:dark] hover:border-slate-500 transition-colors cursor-pointer focus:ring-1 focus:ring-blue-500 outline-none"
                        onChange={(e) => {
                            if(e.target.value) {
                                onBulkUpdate({ actualEnd: new Date(e.target.value), forecastEnd: new Date(e.target.value) });
                            }
                        }}
                    />
                 </div>
            </div>
        ) : (
            <button 
                onClick={() => setShowEditMenu(!showEditMenu)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors font-medium text-xs border ${showEditMenu ? 'bg-blue-900/50 border-blue-500 text-blue-200' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'}`}
            >
                <Edit3 className="w-3 h-3" />
                Bulk Edit
            </button>
        )}

        <div className="w-px h-8 bg-slate-700"></div>

        {/* Section: Time Travel (Shift) - ONLY FOR FORECAST */}
        {!hasActualizedSelected && (
            <>
                <div className="flex flex-col gap-1 px-2">
                    <div className="text-[10px] text-slate-400 font-medium text-center uppercase">Shift Timeline</div>
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={() => onShiftTime(-largeStep)}
                            className="p-2 hover:bg-white/10 rounded-md transition-colors text-slate-300 hover:text-white"
                            title={`Back ${largeLabelMult} ${scale}s`}
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => onShiftTime(-baseStep)}
                            className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors min-w-[40px]"
                        >
                            -1{unitLabel}
                        </button>
                        <CalendarClock className="w-4 h-4 text-blue-400" />
                        <button 
                            onClick={() => onShiftTime(baseStep)}
                            className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors min-w-[40px]"
                        >
                            +1{unitLabel}
                        </button>
                        <button 
                            onClick={() => onShiftTime(largeStep)}
                            className="p-2 hover:bg-white/10 rounded-md transition-colors text-slate-300 hover:text-white"
                            title={`Forward ${largeLabelMult} ${scale}s`}
                        >
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="w-px h-8 bg-slate-700"></div>
            </>
        )}

        {/* Section: Duration (Applies to both, but strictly End Date for Actuals) */}
        <div className="flex flex-col gap-1 px-2">
            <div className="text-[10px] text-slate-400 font-medium text-center uppercase">Duration ({scale})</div>
            <div className="flex items-center gap-2 justify-center">
                <button 
                    onClick={() => onAdjustDuration(-baseStep)}
                    className="flex items-center gap-1 px-2 py-1.5 hover:bg-white/10 rounded-md transition-colors text-slate-300 hover:text-white group text-xs font-bold border border-slate-700"
                    title={`Reduce by 1 ${scale}`}
                >
                    <Minimize2 className="w-3 h-3 group-active:scale-90 transition-transform" />
                    -1{unitLabel}
                </button>
                <button 
                    onClick={() => onAdjustDuration(baseStep)}
                    className="flex items-center gap-1 px-2 py-1.5 hover:bg-white/10 rounded-md transition-colors text-slate-300 hover:text-white group text-xs font-bold border border-slate-700"
                    title={`Extend by 1 ${scale}`}
                >
                    <Maximize2 className="w-3 h-3 group-active:scale-110 transition-transform" />
                    +1{unitLabel}
                </button>
            </div>
        </div>

        <div className="w-px h-8 bg-slate-700"></div>

        {/* Section: Impact Analysis */}
        <div className="px-3 min-w-[140px]">
           <div className="text-[10px] text-slate-400 font-medium uppercase flex items-center gap-1">
             <DollarSign className="w-3 h-3" /> Impact (Selection)
           </div>
           <div className={`text-lg font-bold tabular-nums ${delta > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
             {delta > 0 ? '+' : ''}{formatCurrency(delta)}
           </div>
        </div>

        {/* Section: Actions */}
        <div className="pl-2 border-l border-slate-700 flex items-center gap-2">
             <button 
                onClick={onResetSelected}
                className="flex flex-col items-center justify-center gap-1 px-3 py-1.5 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                title="Reset selected to original dates"
             >
                <RotateCcw className="w-4 h-4" />
                <span className="text-[9px] font-semibold">RESET</span>
             </button>
             
             {/* Save / Minimize Button - NEW */}
             <button 
                onClick={() => setIsMinimized(true)}
                className="flex flex-col items-center justify-center gap-1 px-3 py-1.5 hover:bg-emerald-500/20 rounded-lg text-slate-400 hover:text-emerald-400 transition-all"
                title="Hide Controls (Keep Selection)"
             >
                <Check className="w-4 h-4" />
                <span className="text-[9px] font-semibold">DONE</span>
             </button>
        </div>

      </div>
    </div>
  );
};
