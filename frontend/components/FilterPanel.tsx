
import React, { useState, useRef } from 'react';
import { FilterState, ViewMode, Scale } from '../types';
import {
  Search, X, SlidersHorizontal, ChevronRight,
  Tag, MapPin,
  CalendarRange, Activity, PanelLeftClose, ChevronDown,
  ZoomIn, Plus, Minus, Crosshair, Lock, Eye
} from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';

interface FilterPanelProps {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  availableCategories: string[];
  availableClasses: string[];
  availableSources: string[];
  availableDors: string[];
  availableAreas?: string[];
  availableManufacturers?: string[];
  availableModels?: string[];
  collapsed: boolean;
  onExpand?: () => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  filteredCount?: number;
  totalCount?: number;
  onClose?: () => void;

  // View & Zoom Props
  viewMode: ViewMode; 
  zoomLevel: number;
  setZoomLevel: (level: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  scale?: Scale; // Added for header alignment

  // Selection & Focus
  selectedCount: number;
  focusMode: boolean;
  onToggleFocus: () => void;
}

interface FilterChipProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

const FilterChip: React.FC<FilterChipProps> = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all duration-200 border select-none whitespace-nowrap flex-none
      ${active 
        ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'}
    `}
  >
    {label}
  </button>
);

const DateInput = ({ label, value, onChange }: { label: string, value?: string, onChange: (val: string) => void }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    
    const handleContainerClick = () => {
        try {
            inputRef.current?.showPicker();
        } catch (e) {
            inputRef.current?.focus();
        }
    };

    return (
        <div className="relative group w-full">
           <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block ml-1">{label}</label>
           <div className="relative flex items-center cursor-pointer" onClick={handleContainerClick}>
              <input 
                  ref={inputRef}
                  type="date"
                  value={value || ''}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
              />
           </div>
        </div>
    );
};

const FilterSection = ({ 
    title, 
    icon: Icon, 
    children, 
    defaultOpen = false,
    activeCount = 0
}: { title: string, icon: any, children?: React.ReactNode, defaultOpen?: boolean, activeCount?: number }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
  
    return (
      <div className="border-b border-slate-100 dark:border-slate-800 last:border-0">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between py-3 px-1 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-lg group"
        >
          <div className="flex items-center gap-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            <div className={`p-1 rounded ${activeCount > 0 ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' : 'bg-transparent text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}>
                <Icon className="w-4 h-4" />
            </div>
            {title}
            {activeCount > 0 && (
               <span className="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded-full text-[9px] ml-1 font-extrabold">
                  {activeCount}
               </span>
            )}
          </div>
          {isOpen ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
        </button>
        
        {isOpen && (
          <div className="pb-4 pt-1 px-1 animate-in slide-in-from-top-1 duration-200">
            {children}
          </div>
        )}
      </div>
    );
};

const LimitedFilterList = ({ items, activeItems, onToggle, limit = 30 }: { items: string[], activeItems: string[], onToggle: (val: string) => void, limit?: number }) => {
    const [showAll, setShowAll] = useState(false);
    const visibleItems = showAll ? items : items.slice(0, limit);
    const hiddenCount = items.length - limit;

    return (
        <div className="flex flex-wrap gap-2">
            {visibleItems.map(item => (
                <FilterChip 
                    key={item} 
                    active={activeItems.includes(item)} 
                    label={item} 
                    onClick={() => onToggle(item)} 
                />
            ))}
            {!showAll && hiddenCount > 0 && (
                <button 
                    onClick={() => setShowAll(true)}
                    className="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent hover:border-slate-300 dark:hover:border-slate-600 transition-all"
                >
                    +{hiddenCount} more...
                </button>
            )}
        </div>
    );
};

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  setFilters,
  availableCategories,
  availableClasses,
  availableSources,
  availableDors,
  availableAreas = [],
  availableManufacturers = [],
  availableModels: _availableModels = [],
  onSelectAll: _onSelectAll,
  onClearSelection,
  filteredCount: _filteredCount = 0,
  totalCount: _totalCount = 0,
  onClose,
  viewMode,
  zoomLevel,
  setZoomLevel,
  onZoomIn,
  onZoomOut,
  scale = 'Month',
  selectedCount,
  focusMode,
  onToggleFocus
}) => {
  // Permission hooks
  const { isReadOnly, role: _role } = usePermissions();

  const toggleFilter = (key: keyof FilterState, value: string, _allowEmpty = true) => {
      const current = filters[key] as string[];
      const isSelected = current.includes(value);

      // Prevent deselecting the last item for certain filters
      const mandatoryFilters: (keyof FilterState)[] = ['status', 'dor', 'classType', 'category', 'areaSilo', 'source'];
      if (mandatoryFilters.includes(key) && isSelected && current.length === 1) {
          return;
      }

      const newValues = isSelected ? current.filter(v => v !== value) : [...current, value];
      setFilters({ ...filters, [key]: newValues });
  };

  const handleReset = () => {
    if (onClearSelection) onClearSelection();
    setFilters({ 
        ...filters, 
        search: '', 
        category: availableCategories, 
        classType: availableClasses,
        source: availableSources,
        dor: availableDors,
        status: ['Forecast', 'Actuals'],
        areaSilo: availableAreas, 
        startDateFrom: '', startDateTo: '', endDateFrom: '', endDateTo: '' 
    });
  };

  // Determine dynamic header height based on scale to align with Timeline
  const headerHeight = scale === 'Year' ? 40 : scale === 'Month' ? 60 : 80;

  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md h-full flex flex-col border-r border-slate-200 dark:border-slate-700 shadow-xl relative z-20">
        
        {/* Cockpit Header - Dynamically Sized */}
        <div
          className="flex-none px-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800"
          style={{ height: headerHeight }}
        >
            <div className="flex items-center gap-2.5">
                <div className="bg-slate-800 dark:bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-slate-900/10 dark:shadow-blue-900/20">
                    <SlidersHorizontal className="w-4 h-4 text-white" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Cockpit</h2>
                        {isReadOnly && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded text-[9px] font-bold text-yellow-700 dark:text-yellow-400">
                                <Eye className="w-2.5 h-2.5" />
                                Read-Only
                            </span>
                        )}
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold tracking-wide">
                        {isReadOnly ? 'View Mode' : 'Control Center'}
                    </p>
                </div>
            </div>
            {onClose && (
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" title="Hide Cockpit">
                    <PanelLeftClose className="w-4 h-4" />
                </button>
            )}
        </div>

        {/* Main Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1">
            
            {/* Zoom Controls - Only show if Timeline mode */}
            {viewMode === 'timeline' && (
                <div className="mb-5 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-200 dark:border-slate-700/50">
                        <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <ZoomIn className="w-3 h-3" /> Zoom Level
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{Math.round(zoomLevel * 100)}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                        <button onClick={onZoomOut} className="p-1.5 bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-500 dark:text-slate-400 transition-colors shadow-sm border border-slate-200 dark:border-slate-600">
                            <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                            type="range"
                            min="0.5"
                            max="3"
                            step="0.1"
                            value={zoomLevel}
                            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                            className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <button onClick={onZoomIn} className="p-1.5 bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-500 dark:text-slate-400 transition-colors shadow-sm border border-slate-200 dark:border-slate-600">
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                        </div>
                </div>
            )}

            {/* Global Search */}
            <div className="relative mb-5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500" />
                <input 
                    type="text" 
                    placeholder="Search PFA ID..." 
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                    className="w-full pl-9 pr-3 py-2.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all shadow-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                />
            </div>

            <div className="w-full h-px bg-slate-100 dark:bg-slate-800 my-4"></div>

            {/* Date Range Accordion */}
            <FilterSection title="Timeline Bounds" icon={CalendarRange} defaultOpen={true} activeCount={(filters.startDateFrom || filters.startDateTo || filters.endDateFrom || filters.endDateTo) ? 1 : 0}>
                <div className="space-y-3 pt-1">
                    <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-xl p-3 border border-slate-100 dark:border-slate-700/50">
                        <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Start Date
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <DateInput label="From" value={filters.startDateFrom} onChange={(v: string) => setFilters({...filters, startDateFrom: v})} />
                            <DateInput label="To" value={filters.startDateTo} onChange={(v: string) => setFilters({...filters, startDateTo: v})} />
                        </div>
                    </div>
                    <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-xl p-3 border border-slate-100 dark:border-slate-700/50">
                         <div className="text-[10px] font-bold text-orange-600 dark:text-orange-400 mb-2 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div> End Date
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <DateInput label="From" value={filters.endDateFrom} onChange={(v: string) => setFilters({...filters, endDateFrom: v})} />
                            <DateInput label="To" value={filters.endDateTo} onChange={(v: string) => setFilters({...filters, endDateTo: v})} />
                        </div>
                    </div>
                </div>
            </FilterSection>

            {/* Status & Phase Accordion */}
            <FilterSection title="Status & Phase" icon={Activity} defaultOpen={true} activeCount={filters.status.length + filters.dor.length + filters.source.length}>
                 <div className="space-y-4 pt-1">
                    <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-2 block">Record Type</label>
                        <LimitedFilterList 
                            items={['Forecast', 'Actuals', 'Discontinued', 'Funds Transferable']} 
                            activeItems={filters.status} 
                            onToggle={(v) => toggleFilter('status', v, false)} 
                        />
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-2 block">DOR</label>
                        <LimitedFilterList 
                            items={availableDors} 
                            activeItems={filters.dor} 
                            onToggle={(v) => toggleFilter('dor', v, false)} 
                        />
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-2 block">Source</label>
                        <LimitedFilterList 
                            items={availableSources} 
                            activeItems={filters.source} 
                            onToggle={(v) => toggleFilter('source', v, false)} 
                        />
                    </div>
                 </div>
            </FilterSection>

             {/* Attributes Accordion */}
            <FilterSection title="Classification" icon={Tag} defaultOpen={true} activeCount={filters.category.length + filters.classType.length}>
                <div className="space-y-4 pt-1">
                    <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-2 block">Class</label>
                        <LimitedFilterList 
                            items={availableClasses} 
                            activeItems={filters.classType} 
                            onToggle={(v) => toggleFilter('classType', v, false)} 
                        />
                    </div>

                    <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-2 block">Category</label>
                        <LimitedFilterList 
                            items={availableCategories} 
                            activeItems={filters.category} 
                            onToggle={(v) => toggleFilter('category', v, false)} 
                        />
                    </div>
                </div>
            </FilterSection>

             {/* Location Accordion */}
            <FilterSection title="Location & Origin" icon={MapPin} activeCount={filters.areaSilo.length + (availableManufacturers?.length && filters.search.includes('make') ? 1 : 0)}>
                <div className="space-y-4 pt-1">
                     <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-2 block">Area / Silo</label>
                        <LimitedFilterList 
                            items={availableAreas} 
                            activeItems={filters.areaSilo} 
                            onToggle={(v) => toggleFilter('areaSilo', v, false)} 
                        />
                    </div>
                </div>
            </FilterSection>

        </div>

        {/* Footer Actions */}
        <div className="flex-none p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 space-y-3 backdrop-blur">
            
            {/* Focus Mode Button */}
            <button 
                onClick={onToggleFocus}
                disabled={selectedCount === 0}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm
                    ${selectedCount === 0 
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700' 
                        : focusMode 
                            ? 'bg-blue-600 text-white border border-blue-600 shadow-blue-500/30' 
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500'
                    }
                `}
                title={selectedCount === 0 ? "Select assets to focus" : focusMode ? "Exit Focus Mode" : "Focus on selected assets"}
            >
                {selectedCount === 0 ? <Lock className="w-3.5 h-3.5" /> : <Crosshair className="w-3.5 h-3.5" />}
                {focusMode ? 'Exit Focus Mode' : 'Focus Selected'}
                {selectedCount > 0 && <span className="opacity-80">({selectedCount})</span>}
            </button>

            <button 
                onClick={handleReset}
                className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex items-center justify-center gap-1"
            >
                <X className="w-3 h-3" /> Reset Filters
            </button>
        </div>
    </div>
  );
};
