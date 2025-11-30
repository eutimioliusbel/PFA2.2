
import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { PfaRecord, PfaView, TimelineBounds, DragState, GroupingField, SeriesVisibility, Scale, DisplayMetric, GridColumn, GroupNode, ColorConfig, SortConfig, ColumnId, AssetMasterRecord } from '../types';
import { getDaysDiff, getTimelineTicks, getPixelsPerDay, calculateCost, formatCurrencyCompact, groupAssets, formatDate, calculateEndDateFromCost, addDays } from '../utils';
import { CheckSquare, Square, ChevronDown, ChevronRight, Edit2, Lock, PanelLeftClose, PanelLeftOpen, MinusSquare, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';

interface TimelineProps {
  pfaRecords: PfaView[];
  onUpdateAsset: (id: string, newStart: Date, newEnd: Date, layer: 'forecast' | 'actual') => void;
  onUpdateAssets: (updates: {id: string, start: Date, end: Date, layer: 'forecast' | 'actual'}[]) => void;
  onUpdateAssetRate: (id: string, newRate: number) => void; 
  onUpdateAssetStatus?: (id: string, isActualized: boolean) => void;
  onUpdateAssetEquipment: (id: string, equipment: string) => void;
  onDragChange: (updates: Map<string, { start: Date; end: Date; layer: 'forecast' | 'actual' }> | null) => void;
  bounds: TimelineBounds;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectMultiple: (ids: string[], selected: boolean) => void;
  grouping: GroupingField[];
  visibleSeries: SeriesVisibility;
  scale: Scale;
  onScaleChange: (scale: Scale) => void;
  barDisplayMode: DisplayMetric;
  zoomLevel: number;
  gridColumns: GridColumn[];
  isGridCollapsed: boolean;
  onToggleGridCollapse: () => void;
  colors: ColorConfig;
  assetMaster?: AssetMasterRecord[];
  sortConfig?: SortConfig;
  onSort?: (columnId: ColumnId) => void;
}

// --- Inline Editor Component ---
const EditableCell = ({ 
    value, 
    type, 
    onSave,
    prefix = '',
    highlight = false,
    disabled = false
}: { 
    value: string | number, 
    type: 'text' | 'number' | 'date', 
    onSave: (val: any) => void,
    prefix?: string,
    highlight?: boolean,
    disabled?: boolean
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setTempValue(value); }, [value]);
    useEffect(() => { if (isEditing) inputRef.current?.focus(); }, [isEditing]);

    const handleSave = () => {
        setIsEditing(false);
        if (tempValue !== value) {
            onSave(type === 'number' ? Number(tempValue) : type === 'date' ? new Date(String(tempValue)) : tempValue);
        }
    };

    if (disabled) {
       return <div className="w-full truncate opacity-70 font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
            {prefix}{type === 'number' ? Number(value).toLocaleString() : String(value)}
            {highlight && <Lock className="w-2 h-2 opacity-50" />}
       </div>
    }

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type={type}
                value={type === 'date' ? String(tempValue).split('T')[0] : tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="w-full h-7 px-2 text-xs font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-2 border-blue-500 rounded-md shadow-xl focus:outline-none z-50 relative"
            />
        );
    }

    return (
        <div 
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            className={`w-full h-7 flex items-center cursor-text group/cell px-2 rounded-md truncate transition-all relative border border-transparent
              ${highlight 
                ? 'hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-200 dark:hover:border-blue-700 text-blue-700 dark:text-blue-400 font-bold bg-slate-50 dark:bg-slate-800/50' 
                : 'hover:bg-white dark:hover:bg-slate-700 hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-sm text-slate-600 dark:text-slate-300 font-medium'}
            `}
        >
            <span className="truncate">{prefix}{type === 'number' ? Number(value).toLocaleString() : String(value)}</span>
            {!disabled && <Edit2 className="w-3 h-3 ml-auto text-slate-300 dark:text-slate-600 opacity-0 group-hover/cell:opacity-100 transition-opacity" />}
        </div>
    );
};

// Define types for flattened list items
type FlatItemType = 'group' | 'asset';
interface FlatItem {
    id: string;
    type: FlatItemType;
    data: GroupNode | PfaRecord;
    level: number;
    parent?: GroupNode;
}

export const Timeline: React.FC<TimelineProps> = ({
  pfaRecords,
  onUpdateAsset,
  onUpdateAssets,
  onUpdateAssetRate,
  onUpdateAssetStatus: _onUpdateAssetStatus,
  onUpdateAssetEquipment,
  onDragChange,
  bounds,
  selectedIds,
  onToggleSelection,
  onSelectMultiple,
  grouping,
  visibleSeries,
  scale,
  onScaleChange,
  barDisplayMode,
  zoomLevel,
  gridColumns,
  isGridCollapsed,
  onToggleGridCollapse,
  colors,
  assetMaster = [],
  sortConfig,
  onSort
}) => {
  // Helper function to get sync state border styling
  const getSyncStateBorder = (pfa: PfaView): string => {
    const syncState = pfa._metadata?.syncState || 'pristine';
    switch (syncState) {
      case 'draft':
        return 'border-2 border-yellow-400 dark:border-yellow-500'; // Unsaved changes
      case 'committed':
        return 'border-2 border-blue-400 dark:border-blue-500'; // Ready to sync to PEMS
      case 'syncing':
        return 'border-2 border-purple-400 dark:border-purple-500 animate-pulse'; // In progress
      case 'sync_error':
        return 'border-2 border-red-400 dark:border-red-500'; // Failed
      default:
        return 'border border-white/20'; // Pristine (no changes)
    }
  };

  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  
  // LARGE DATASET SAFEGUARD:
  // Initial State function runs ONCE before render.
  const isLargeDataset = pfaRecords.length > 1000;
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(() => 
      isLargeDataset ? new Set() : new Set(['ALL_OPEN'])
  );

  const [snapLabel, setSnapLabel] = useState<string | null>(null);
  
  // Ref to hold static drag data to avoid dependency cycles in mousemove
  const dragInfoRef = useRef<{
      assetId: string | null;
      edge: 'start' | 'end' | 'move' | null;
      startX: number;
      originalDates: { start: Date; end: Date } | null;
      snapshot: Map<string, { start: Date; end: Date }> | null;
  }>({ assetId: null, edge: null, startX: 0, originalDates: null, snapshot: null });

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false, assetId: null, edge: null, startX: 0, originalDates: null, snapshot: undefined, currentUpdates: undefined
  });

  // --- Resize Logic ---
  const [customGridWidth, setCustomGridWidth] = useState<number | null>(null);
  const resizeRef = useRef({ startX: 0, startWidth: 0, isDragging: false, hasMoved: false });

  useEffect(() => { setCustomGridWidth(null); }, [isGridCollapsed]);

  const enabledColumns = useMemo(() => gridColumns.filter(c => c.visible), [gridColumns]);
  const maxGridWidth = useMemo(() => enabledColumns.reduce((sum, col) => sum + col.width, 0) + 40, [enabledColumns]);
  const collapsedWidth = useMemo(() => enabledColumns.slice(0, 2).reduce((sum, c) => sum + c.width, 0) + 40, [enabledColumns]);
  const gridWidth = useMemo(() => {
      if (customGridWidth !== null) return customGridWidth;
      return isGridCollapsed ? collapsedWidth : maxGridWidth;
  }, [customGridWidth, isGridCollapsed, collapsedWidth, maxGridWidth]);

  const visibleCount = useMemo(() => {
      if (isGridCollapsed) return 2;
      if (gridWidth >= maxGridWidth) return enabledColumns.length;
      let count = 0;
      let w = 40;
      for (const col of enabledColumns) {
          if (w < gridWidth) { count++; w += col.width; } else break;
      }
      return count;
  }, [isGridCollapsed, gridWidth, maxGridWidth, enabledColumns]);

  const visibleColumns = useMemo(() => enabledColumns.slice(0, visibleCount), [enabledColumns, visibleCount]);

  // --- AUTO SCALE SAFETY ---
  const basePixelsPerDay = getPixelsPerDay(scale);
  const pixelsPerDay = basePixelsPerDay * zoomLevel;
  const estimatedWidth = bounds.totalDays * pixelsPerDay;
  const SAFE_MAX_WIDTH = 6000000; 
  const isUnsafeWidth = estimatedWidth > SAFE_MAX_WIDTH;

  useEffect(() => {
      if (isUnsafeWidth) {
          console.warn("Timeline too wide, auto-adjusting scale.");
          if (scale === 'Day' || scale === 'Week') {
              onScaleChange('Month');
          } else if (scale === 'Month') {
              onScaleChange('Year');
          }
      }
  }, [isUnsafeWidth, scale, onScaleChange]);

  if (isUnsafeWidth) {
      return (
          <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 items-center justify-center p-8">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Optimizing View...</h3>
              <p className="text-slate-500 dark:text-slate-400 text-center max-w-md">
                  The data range is too wide for the current scale ({scale}). Adjusting to a higher level view to prevent performance issues.
              </p>
          </div>
      );
  }

  const totalWidth = Math.min(SAFE_MAX_WIDTH, estimatedWidth);
  
  const groupedData = useMemo(() => groupAssets(pfaRecords, grouping), [pfaRecords, grouping]);

  // --- FLATTENED DATA FOR VIRTUALIZATION ---
  const flatData = useMemo(() => {
      const result: FlatItemType extends 'group' ? FlatItem : FlatItem[] = [];
      const isAllOpen = expandedGroupIds.has('ALL_OPEN');

      const processNode = (node: GroupNode) => {
          (result as any).push({ type: 'group', data: node, id: node.id, level: node.level });
          const isExpanded = isAllOpen || expandedGroupIds.has(node.id);

          if (isExpanded) {
              if (node.children.length > 0) {
                  node.children.forEach(processNode);
              } else {
                  node.assets.forEach(asset => {
                      (result as any).push({ type: 'asset', data: asset, id: asset.id, level: node.level + 1, parent: node });
                  });
              }
          }
      };
      groupedData.forEach(processNode);
      return result as FlatItem[];
  }, [groupedData, expandedGroupIds]);

  // Virtual Scroll State
  const [scrollTop, setScrollTop] = useState(0);
  const GROUP_HEIGHT = 40;
  const ASSET_HEIGHT = 48;
  
  const viewportHeight = bodyRef.current?.clientHeight || 800;
  const totalListHeight = flatData.reduce((sum, item) => sum + (item.type === 'group' ? GROUP_HEIGHT : ASSET_HEIGHT), 0);
  
  const visibleItems = useMemo(() => {
      const items: { item: FlatItem, top: number }[] = [];
      let currentTop = 0;
      const buffer = 600; 
      
      for (let i = 0; i < flatData.length; i++) {
          const item = flatData[i];
          const height = item.type === 'group' ? GROUP_HEIGHT : ASSET_HEIGHT;
          
          if (currentTop + height > scrollTop - buffer && currentTop < scrollTop + viewportHeight + buffer) {
              items.push({ item, top: currentTop });
          }
          
          currentTop += height;
          if (currentTop > scrollTop + viewportHeight + buffer) break;
      }
      return items;
  }, [flatData, scrollTop, viewportHeight]);

  const handleResizeStart = (e: React.MouseEvent) => {
      e.preventDefault(); 
      e.stopPropagation();
      resizeRef.current = { startX: e.clientX, startWidth: gridWidth, isDragging: true, hasMoved: false };
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
      if (!resizeRef.current.isDragging) return;
      const dx = e.clientX - resizeRef.current.startX;
      if (Math.abs(dx) > 3) resizeRef.current.hasMoved = true;
      if (resizeRef.current.hasMoved) {
          const newWidth = Math.min(maxGridWidth, Math.max(150, resizeRef.current.startWidth + dx));
          setCustomGridWidth(newWidth);
      }
  };

  const handleResizeEnd = (_e: MouseEvent) => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      resizeRef.current.isDragging = false;
      if (!resizeRef.current.hasMoved) onToggleGridCollapse();
  };

  const getActiveLayer = (asset: PfaRecord): 'forecast' | 'actual' | null => {
      if (visibleSeries.actual && asset.hasActuals) return 'actual';
      if (visibleSeries.forecast && !asset.isActualized) return 'forecast'; 
      if (visibleSeries.forecast && asset.isActualized) return 'forecast'; 
      return null; 
  };

  const toggleGroup = (groupId: string) => {
    const newSet = new Set(expandedGroupIds);
    if (newSet.has('ALL_OPEN')) {
        newSet.delete('ALL_OPEN');
        const addAllIds = (nodes: GroupNode[]) => {
            nodes.forEach(n => {
                if (n.id !== groupId) {
                    newSet.add(n.id);
                    addAllIds(n.children);
                }
            });
        };
        addAllIds(groupedData);
    } else {
        if (newSet.has(groupId)) newSet.delete(groupId);
        else newSet.add(groupId);
    }
    setExpandedGroupIds(newSet);
  };

  const getAllGroupAssetIds = (node: GroupNode): string[] => {
      let ids = node.assets.map(a => a.id);
      for (const child of node.children) { ids = ids.concat(getAllGroupAssetIds(child)); }
      return ids;
  };

  const dateToPixels = useCallback((date: Date) => {
    const days = getDaysDiff(bounds.start, date);
    return days * pixelsPerDay;
  }, [bounds.start, pixelsPerDay]);

  const handleCostUpdate = (asset: PfaRecord, newCost: number, layer: 'forecast' | 'actual') => {
      if (asset.source === 'Purchase') { onUpdateAssetRate(asset.id, newCost); return; }
      const start = layer === 'actual' ? asset.actualStart : asset.forecastStart;
      const newEndDate = calculateEndDateFromCost(start, asset.monthlyRate, newCost);
      if (newEndDate > start) { onUpdateAsset(asset.id, start, newEndDate, layer); }
  };

  const handleScroll = () => {
      if (headerRef.current && bodyRef.current) {
          requestAnimationFrame(() => {
              if(headerRef.current && bodyRef.current) {
                  headerRef.current.scrollLeft = bodyRef.current.scrollLeft;
                  setScrollTop(bodyRef.current.scrollTop);
              }
          });
      }
  };

  const handleMouseDown = (e: React.MouseEvent, asset: PfaRecord, edge: 'start' | 'end' | 'move', layer: 'forecast' | 'actual') => {
    e.preventDefault(); // Prevent text selection and native drag
    e.stopPropagation();
    const isAlreadySelected = selectedIds.has(asset.id);
    const assetsToDrag = isAlreadySelected ? pfaRecords.filter(a => selectedIds.has(a.id)) : [asset]; 
    const snapshot = new Map<string, { start: Date, end: Date }>();
    const currentUpdates = new Map<string, {start: Date, end: Date, layer: 'forecast' | 'actual'}>();

    assetsToDrag.forEach(a => {
        const activeLayer = getActiveLayer(a);
        if (!activeLayer) return;
        const s = activeLayer === 'actual' ? a.actualStart : a.forecastStart;
        const e = activeLayer === 'actual' ? a.actualEnd : a.forecastEnd;
        snapshot.set(a.id, { start: new Date(s), end: new Date(e) });
        currentUpdates.set(a.id, { start: new Date(s), end: new Date(e), layer: activeLayer });
    });
    
    // Store static info in ref for efficient mousemove
    dragInfoRef.current = {
        assetId: asset.id,
        edge,
        startX: e.clientX,
        originalDates: { start: new Date(layer === 'actual' ? asset.actualStart : asset.forecastStart), end: new Date(layer === 'actual' ? asset.actualEnd : asset.forecastEnd) },
        snapshot
    };

    setDragState({
      isDragging: true, assetId: asset.id, edge, startX: e.clientX,
      originalDates: dragInfoRef.current.originalDates,
      snapshot, currentUpdates
    });
    
    if (!isAlreadySelected) onToggleSelection(asset.id);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const info = dragInfoRef.current;
    if (!info.assetId || !info.originalDates || !info.snapshot) return;
    
    const asset = pfaRecords.find(a => a.id === info.assetId);
    if (!asset) return;

    // Use precise floating point math for 1:1 tracking
    const deltaPixels = e.clientX - info.startX;
    const msPerPixel = (24 * 60 * 60 * 1000) / pixelsPerDay;
    const deltaMs = deltaPixels * msPerPixel;
    
    const days = Math.round(deltaPixels / pixelsPerDay); // Approximate for label
    let label = `${days > 0 ? '+' : ''}${days} d`;

    if (info.edge !== 'move' && barDisplayMode === 'cost') {
        const oldCost = calculateCost(info.originalDates.start, info.originalDates.end, asset.monthlyRate, asset.source, asset.purchasePrice);
        
        // Calculate cost based on projected dates
        let sTs = info.originalDates.start.getTime();
        let eTs = info.originalDates.end.getTime();
        if (info.edge === 'start') sTs += deltaMs;
        if (info.edge === 'end') eTs += deltaMs;
        
        const newCost = calculateCost(new Date(sTs), new Date(eTs), asset.monthlyRate, asset.source, asset.purchasePrice);
        const diff = newCost - oldCost;
        label = `${diff > 0 ? '+' : ''}${formatCurrencyCompact(diff)}`;
    }
    
    const newUpdates = new Map<string, { start: Date, end: Date, layer: 'forecast' | 'actual' }>();
    info.snapshot.forEach((dates, id) => {
        const snapAsset = pfaRecords.find(a => a.id === id);
        if (!snapAsset) return;
        const activeLayer = getActiveLayer(snapAsset);
        if (!activeLayer) return;

        let newStartTs = dates.start.getTime();
        let newEndTs = dates.end.getTime();

        if (info.edge === 'move') { 
            newStartTs += deltaMs; 
            newEndTs += deltaMs; 
        }
        else if (info.edge === 'start') newStartTs += deltaMs;
        else if (info.edge === 'end') newEndTs += deltaMs;
        
        // Safety constraint: End > Start
        if (info.edge === 'start' && newStartTs >= newEndTs) newStartTs = newEndTs - (24 * 60 * 60 * 1000);
        if (info.edge === 'end' && newEndTs <= newStartTs) newEndTs = newStartTs + (24 * 60 * 60 * 1000);

        newUpdates.set(id, { start: new Date(newStartTs), end: new Date(newEndTs), layer: activeLayer });
    });

    // 1. Immediate Visual Update (Local State)
    setDragState(prev => ({ ...prev, currentUpdates: newUpdates }));
    setSnapLabel(label);

    // 2. Throttled Parent Update (KPIs) to avoid heavy re-renders
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
        onDragChange(newUpdates);
    });

  }, [pfaRecords, pixelsPerDay, barDisplayMode, onDragChange]);

  const handleMouseUp = useCallback(() => {
    if (dragState.isDragging) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        
        if (dragState.currentUpdates && dragState.currentUpdates.size > 0) {
            // Quantize to midnight on drop to ensure clean data
            const updates = Array.from(dragState.currentUpdates.entries()).map(([id, data]) => {
                const s = new Date(data.start); s.setHours(0,0,0,0);
                const e = new Date(data.end); e.setHours(0,0,0,0);
                return {
                    id, start: s, end: e, layer: data.layer
                };
            });
            onUpdateAssets(updates);
        }
        
        // Clear Ref
        dragInfoRef.current = { assetId: null, edge: null, startX: 0, originalDates: null, snapshot: null };
        
        setDragState(prev => ({ ...prev, isDragging: false, assetId: null, snapshot: undefined, currentUpdates: undefined }));
        setSnapLabel(null);
        onDragChange(null);
    }
  }, [dragState.isDragging, dragState.currentUpdates, onUpdateAssets, onDragChange]);

  useEffect(() => {
    if (dragState.isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [dragState.isDragging, handleMouseMove, handleMouseUp]);

  const renderCell = (col: GridColumn, asset: PfaRecord, activeLayer: 'forecast' | 'actual' | null) => {
      const canEdit = !!activeLayer;
      let start = asset.forecastStart;
      let end = asset.forecastEnd;
      if (activeLayer === 'actual') { start = asset.actualStart; end = asset.actualEnd; }
      
      switch (col.id) {
          case 'pfaId': return <span className="font-bold text-slate-700 dark:text-slate-200">{asset.pfaId}</span>;
          case 'areaSilo': return <span className="text-slate-600 dark:text-slate-400">{asset.areaSilo}</span>;
          case 'class': return <span className="text-slate-600 dark:text-slate-400">{asset.class}</span>;
          case 'category': return <span className="text-slate-600 dark:text-slate-400">{asset.category}</span>;
          case 'source': return <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${asset.source === 'Rental' ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' : 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'}`}>{asset.source}</span>;
          case 'dor': return <span className="text-slate-500 font-mono">{asset.dor}</span>;
          case 'estimatedStart': return <EditableCell type="date" value={formatDate(start)} onSave={(val) => activeLayer && onUpdateAsset(asset.id, val, end, activeLayer)} disabled={!canEdit || activeLayer === 'actual'} />;
          case 'estimatedEnd': return <EditableCell type="date" value={formatDate(end)} onSave={(val) => activeLayer && onUpdateAsset(asset.id, start, val, activeLayer)} disabled={!canEdit} />;
          case 'ratePrice':
               const val = asset.source === 'Rental' ? asset.monthlyRate : asset.purchasePrice;
               if (asset.source !== 'Rental' && asset.source !== 'Purchase') return <span className="text-slate-300">-</span>;
               return <EditableCell type="number" value={val} onSave={(v) => onUpdateAssetRate(asset.id, v)} disabled={!canEdit || activeLayer === 'actual'} />;
          case 'manufacturer': return <span className="text-slate-600 dark:text-slate-400">{asset.manufacturer}</span>;
          case 'model': return <span className="text-slate-600 dark:text-slate-400">{asset.model}</span>;
          case 'isActualized':
               if (asset.isActualized) return <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 select-none overflow-hidden"><Lock className="w-3 h-3 flex-none text-slate-400" /><span className="text-[10px] font-bold truncate" title={asset.equipment}>{asset.equipment || 'Unknown'}</span></div>;
               // Filter relevant equipment from Asset Master (Prop Drilled)
               // Match class AND category
               const relevantEq = assetMaster.filter(eq => eq.class === asset.class && eq.category === asset.category && eq.equipmentStatus === 'Active');
               
               return (
                   <div className="w-full px-1" onClick={(e) => e.stopPropagation()}>
                       <select 
                            className="w-full h-6 text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-blue-600 dark:text-blue-400 focus:outline-none cursor-pointer" 
                            value={asset.equipment?.split(' - ')[0] || ''} 
                            onChange={(e) => {
                                const selectedTag = e.target.value;
                                const eq = assetMaster.find(am => am.assetTag === selectedTag);
                                if (eq) {
                                    onUpdateAssetEquipment(asset.id, `${eq.assetTag} - ${eq.description}`);
                                } else {
                                    onUpdateAssetEquipment(asset.id, '');
                                }
                            }}
                        >
                            <option value="">Select...</option>
                            {relevantEq.map(eq => (
                                <option key={eq.id} value={eq.assetTag}>
                                    {eq.assetTag} - {eq.description}
                                </option>
                            ))}
                       </select>
                   </div>
               );
          case 'totalCost':
               const cost = calculateCost(start, end, asset.monthlyRate, asset.source, asset.purchasePrice);
               let isTotalLocked = !canEdit;
               if (activeLayer === 'actual' && asset.source === 'Purchase') isTotalLocked = true;
               return <EditableCell type="number" value={Math.round(cost)} onSave={(val) => activeLayer && handleCostUpdate(asset, val, activeLayer)} disabled={isTotalLocked} highlight />;
          default: return null;
      }
  };

  // Optimization: Only calculate heavy ticks if not absurdly large
  const { years, months, bottom } = useMemo(() => {
      const MAX_TICKS = 2500; 
      const safeEnd = bounds.totalDays > MAX_TICKS && scale === 'Day' 
          ? addDays(bounds.start, MAX_TICKS) 
          : bounds.end;

      const years = [];
      const months = [];
      const bottom = getTimelineTicks({ ...bounds, end: safeEnd }, scale); 
      
      let current = new Date(bounds.start);
      while(current <= bounds.end) {
          const year = current.getFullYear();
          const nextYear = new Date(year + 1, 0, 1);
          const end = nextYear < bounds.end ? nextYear : bounds.end;
          const start = current < bounds.start ? bounds.start : current;
          const days = getDaysDiff(start, end);
          if(days > 0) years.push({ label: year.toString(), width: days * pixelsPerDay, left: dateToPixels(start) });
          current = nextYear;
          if (years.length > 100) break; 
      }
      
      if (scale !== 'Year') {
          current = new Date(bounds.start);
          current.setDate(1); 
          while(current <= bounds.end) {
              const monthStart = new Date(current);
              if (monthStart < bounds.start) monthStart.setTime(bounds.start.getTime());
              const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1);
              const monthEnd = nextMonth < bounds.end ? nextMonth : bounds.end;
              const days = getDaysDiff(monthStart, monthEnd);
              if (days > 0) months.push({ label: current.toLocaleDateString('en-US', { month: 'short' }), width: days * pixelsPerDay, left: dateToPixels(monthStart) });
              current = nextMonth;
              if (months.length > 500) break; 
          }
      }
      return { years, months, bottom };
  }, [bounds, scale, pixelsPerDay, dateToPixels]);

  const headerHeight = scale === 'Year' ? 40 : scale === 'Month' ? 60 : 80;

  const getBarLabel = (start: Date, end: Date, monthlyRate: number, mode: DisplayMetric, source: 'Purchase' | 'Rental', price: number) => {
      if (mode === 'none' || mode === 'quantity') return '';
      const days = Math.max(0, getDaysDiff(start, end));
      const cost = calculateCost(start, end, monthlyRate, source, price);
      let durationStr = '';
      if (scale === 'Day') durationStr = `${days}d`;
      else if (scale === 'Week') durationStr = `${(days/7).toFixed(1)}w`;
      else if (scale === 'Month') durationStr = `${(days/30.44).toFixed(1)}m`;
      else if (scale === 'Year') durationStr = `${(days/30.44).toFixed(1)}m`; 
      if (mode === 'cost') return formatCurrencyCompact(cost);
      if (mode === 'duration') return durationStr;
      return `${formatCurrencyCompact(cost)} • ${durationStr}`;
  };

  const renderGroupRow = (node: GroupNode, top: number) => {
      const isExpanded = expandedGroupIds.has('ALL_OPEN') || expandedGroupIds.has(node.id);
      const deltaPercent = node.totals.plan > 0 ? (node.totals.delta / node.totals.plan) * 100 : 0;
      const isOverBudget = node.totals.delta > 0;
      const planStart = dateToPixels(node.bounds.plan.start);
      const planWidth = Math.max(4, dateToPixels(node.bounds.plan.end) - planStart);
      const activeBound = node.bounds.actual || node.bounds.forecast;
      const activeStart = dateToPixels(activeBound.start);
      const activeWidth = Math.max(4, dateToPixels(activeBound.end) - activeStart);
      const paddingLeft = node.level * 16 + 8;
      const groupAssetIds = getAllGroupAssetIds(node);
      const selectedInGroup = groupAssetIds.filter(id => selectedIds.has(id)).length;
      const isAllSelected = groupAssetIds.length > 0 && selectedInGroup === groupAssetIds.length;
      const isIndeterminate = selectedInGroup > 0 && !isAllSelected;

      const handleGroupSelect = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (isAllSelected) onSelectMultiple(groupAssetIds, false);
          else onSelectMultiple(groupAssetIds, true);
      };

      return (
          <div 
              key={node.id} 
              className="absolute left-0 flex items-center h-10 border-b border-slate-100 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors z-10"
              style={{ width: `calc(${gridWidth}px + ${totalWidth}px)`, top }}
              onClick={() => toggleGroup(node.id)}
          >
              {/* Sticky Left Grid */}
              <div className="flex-none flex items-center px-2 gap-2 sticky left-0 z-30 border-r border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 overflow-hidden h-full" style={{ width: gridWidth, paddingLeft }}>
                  <div className="w-6 flex justify-center flex-none">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                  <button onClick={handleGroupSelect} className="p-1 mr-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex-none">
                     {isAllSelected ? <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" /> : isIndeterminate ? <MinusSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" /> : <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />}
                  </button>
                  <div className="flex-1 flex items-center gap-2 overflow-hidden min-w-0">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">{node.label}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full font-semibold border border-slate-200 dark:border-slate-600 flex-none">{node.totals.count}</span>
                  </div>
                  {!isGridCollapsed && (
                      <div className="flex-none flex items-center gap-4 text-[10px] font-medium text-slate-500 dark:text-slate-400 ml-auto pl-2">
                          <div className="flex flex-col items-end leading-none">
                              <span className="text-[9px] opacity-60 uppercase font-bold tracking-wider truncate max-w-[60px]">Plan</span>
                              <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">{formatCurrencyCompact(node.totals.plan)}</span>
                          </div>
                          <div className="w-px h-4 bg-slate-200 dark:bg-slate-600"></div>
                          <div className="flex flex-col items-end leading-none">
                              <span className="text-[9px] opacity-60 uppercase font-bold tracking-wider truncate max-w-[60px]">{node.totals.actual > 0 ? 'Actual' : 'Forecast'}</span>
                              <span className="font-bold text-xs" style={{ color: node.totals.actual > 0 ? colors.actual : colors.forecast }}>{formatCurrencyCompact(node.totals.actual || node.totals.forecast)}</span>
                          </div>
                          <div className="w-px h-4 bg-slate-200 dark:bg-slate-600"></div>
                          <div className={`flex flex-col items-end leading-none font-bold ${isOverBudget ? 'text-red-500 dark:text-red-400' : 'text-emerald-500 dark:text-emerald-400'}`}>
                              <span className="text-[9px] opacity-60 uppercase font-bold tracking-wider truncate max-w-[60px]">Variance</span>
                              <div className="flex items-center gap-1 text-xs"><span>{isOverBudget ? '+' : ''}{formatCurrencyCompact(node.totals.delta)}</span><span className="opacity-80 text-[9px]">({Math.abs(deltaPercent).toFixed(0)}%)</span></div>
                          </div>
                      </div>
                  )}
              </div>
              {/* Timeline Bars */}
               <div className="flex-1 h-full relative">
                  {visibleSeries.plan && <div className="absolute top-1/2 -translate-y-1/2 h-3 rounded-full opacity-50 border border-black/10" style={{ left: planStart, width: planWidth, backgroundColor: colors.plan }} />}
                  <div className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full shadow-sm opacity-80" style={{ left: activeStart, width: activeWidth, marginTop: '1px', backgroundColor: node.bounds.actual ? colors.actual : colors.forecast }} />
               </div>
          </div>
      );
  };

  const renderAssetRow = (asset: PfaRecord, top: number, parentLevel: number) => {
        const isSelected = selectedIds.has(asset.id);
        const currentDragUpdate = dragState.currentUpdates ? dragState.currentUpdates.get(asset.id) : null;
        const isBeingDragged = !!currentDragUpdate;
        const isPrimaryDrag = dragState.assetId === asset.id;
        const activeLayer = getActiveLayer(asset);
        
        let visualForecastStart = asset.forecastStart;
        let visualForecastEnd = asset.forecastEnd;
        let visualActualStart = asset.actualStart;
        let visualActualEnd = asset.actualEnd;

        if (currentDragUpdate) {
            if (currentDragUpdate.layer === 'forecast') { visualForecastStart = currentDragUpdate.start; visualForecastEnd = currentDragUpdate.end; }
            else if (currentDragUpdate.layer === 'actual') { visualActualStart = currentDragUpdate.start; visualActualEnd = currentDragUpdate.end; }
        }

        const planStart = dateToPixels(asset.originalStart);
        const planWidth = Math.max(4, dateToPixels(asset.originalEnd) - planStart);
        const foreStart = dateToPixels(visualForecastStart);
        const foreWidth = Math.max(4, dateToPixels(visualForecastEnd) - foreStart);
        const actStart = dateToPixels(visualActualStart);
        const actWidth = Math.max(4, dateToPixels(visualActualEnd) - actStart);
        const originalSnapshot = dragState.snapshot ? dragState.snapshot.get(asset.id) : null;
        const paddingLeft = parentLevel * 16 + 24;

        return (
            <div 
                key={asset.id}
                className={`absolute left-0 flex h-12 border-b border-slate-50 dark:border-slate-800 group transition-colors ${isSelected ? 'bg-blue-50/30 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 bg-white dark:bg-slate-900'}`}
                style={{ width: `calc(${gridWidth}px + ${totalWidth}px)`, top }}
                onClick={() => onToggleSelection(asset.id)}
            >
                {/* Left Grid */}
                <div className={`sticky left-0 flex-none flex items-center text-xs border-r border-slate-200 dark:border-slate-700 z-10 transition-all duration-300 overflow-hidden ${isSelected ? 'bg-blue-50/90 dark:bg-blue-900/90 backdrop-blur' : 'bg-white/90 dark:bg-slate-900/90 backdrop-blur group-hover:bg-slate-50/90 dark:group-hover:bg-slate-800/90'}`} style={{ width: gridWidth, paddingLeft }}>
                    <div className="w-10 flex justify-center flex-none -ml-8">
                         <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors" onClick={(e) => { e.stopPropagation(); onToggleSelection(asset.id); }}>
                            {isSelected ? <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" /> : <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />}
                        </button>
                    </div>
                    {visibleColumns.map(col => (
                        <div key={col.id} className="px-2 truncate flex items-center border-r border-transparent hover:border-slate-100 dark:hover:border-slate-700/50 h-full flex-none" style={{ width: col.width }}>
                            {renderCell(col, asset, activeLayer)}
                        </div>
                    ))}
                </div>

                {/* Right Timeline Visuals */}
                <div className="relative flex-1 h-full">
                     {/* Plan Ghost */}
                     {visibleSeries.plan && <div className="absolute h-4 top-4 rounded-full opacity-60" style={{ left: planStart, width: planWidth, backgroundColor: colors.plan }} />}
                     
                     {/* Drag Ghost */}
                     {dragState.isDragging && originalSnapshot && (
                        <div className="absolute top-3 h-6 border-2 border-dashed border-slate-400/50 dark:border-slate-500/50 rounded-full z-0" style={{ left: dateToPixels(originalSnapshot.start), width: Math.max(4, dateToPixels(originalSnapshot.end) - dateToPixels(originalSnapshot.start)) }} />
                     )}

                     {/* Background Layer */}
                     {activeLayer === 'actual' && visibleSeries.forecast && <div className="absolute top-5 h-2 rounded-full pointer-events-none opacity-30" style={{ left: foreStart, width: foreWidth, backgroundColor: colors.forecast }} />}
                     {activeLayer === 'forecast' && visibleSeries.actual && asset.hasActuals && <div className="absolute top-5 h-2 rounded-full pointer-events-none opacity-30" style={{ left: actStart, width: actWidth, backgroundColor: colors.actual }} />}
                     
                     {/* ACTIVE BAR */}
                     {activeLayer && (
                         <div
                            className={`absolute top-3 h-6 rounded-full shadow-sm flex items-center px-2 transition-all ${getSyncStateBorder(asset)} ${isBeingDragged ? 'z-20 ring-4 ring-opacity-50 shadow-lg scale-[1.02] ring-blue-400' : 'cursor-grab hover:shadow-md hover:scale-[1.01]'} ${isPrimaryDrag ? 'cursor-grabbing' : isBeingDragged ? 'cursor-default' : ''}`}
                            style={{ left: activeLayer === 'actual' ? actStart : foreStart, width: activeLayer === 'actual' ? actWidth : foreWidth, backgroundColor: activeLayer === 'actual' ? colors.actual : colors.forecast }}
                            onMouseDown={(e) => activeLayer !== 'actual' && handleMouseDown(e, asset, 'move', activeLayer)}
                        >
                            <div className="absolute inset-x-2 top-0.5 h-2 bg-gradient-to-b from-white/30 to-transparent rounded-full pointer-events-none"></div>
                            {activeLayer !== 'actual' && <div className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize group/handle hover:bg-white/20 rounded-l-full z-10" onMouseDown={(e) => handleMouseDown(e, asset, 'start', activeLayer)} />}
                            <div className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize group/handle hover:bg-white/20 rounded-r-full z-10" onMouseDown={(e) => handleMouseDown(e, asset, 'end', activeLayer)} />
                            {((activeLayer === 'actual' ? actWidth : foreWidth) > 50) && (
                                <span className="text-[10px] font-bold text-white drop-shadow-md pointer-events-none select-none whitespace-nowrap truncate mx-auto relative z-10">
                                    {getBarLabel(activeLayer === 'actual' ? visualActualStart : visualForecastStart, activeLayer === 'actual' ? visualActualEnd : visualForecastEnd, asset.monthlyRate, barDisplayMode, asset.source, asset.purchasePrice)}
                                </span>
                            )}
                            {isPrimaryDrag && snapLabel && (
                                <div className={`absolute -top-12 bg-slate-900/95 backdrop-blur text-white px-3 py-1.5 rounded-lg shadow-2xl z-50 pointer-events-none min-w-[80px] text-center border border-slate-700 animate-in fade-in zoom-in-95 duration-200 ${dragState.edge === 'start' ? 'left-0 -translate-x-1/2' : dragState.edge === 'end' ? 'right-0 translate-x-1/2' : 'left-1/2 -translate-x-1/2'}`}>
                                    <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-0.5">{dragState.edge === 'move' ? 'Shift' : barDisplayMode === 'cost' ? 'Cost Impact' : 'Duration Change'}</div>
                                    <div className="text-sm font-bold">{snapLabel}</div>
                                </div>
                            )}
                        </div>
                     )}
                </div>
            </div>
        );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-black/50 select-none relative">
      
      <div style={{ left: gridWidth }} className="absolute top-0 bottom-0 w-6 -ml-3 z-50 cursor-col-resize group/resize flex flex-col items-center" onMouseDown={handleResizeStart}>
           <div className="w-px h-full bg-slate-200 dark:bg-slate-700 group-hover/resize:bg-blue-500 transition-colors" />
            <div className="absolute flex items-center justify-center" style={{ top: (headerHeight - 28) / 2, height: 28, width: 28 }}>
                 <div className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:shadow transition-all transform group-hover/resize:scale-110">
                    {isGridCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
                 </div>
            </div>
      </div>

      <div className={`flex-none border-b border-slate-200 dark:border-slate-700 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur z-30 relative shadow-sm`} style={{ height: headerHeight }}>
        <div className="absolute top-0 left-0 h-full border-r border-slate-200 dark:border-slate-700 flex flex-col z-40 bg-slate-50 dark:bg-slate-800 transition-all duration-300 overflow-hidden" style={{ width: gridWidth }}>
            <div className="flex-1 flex items-end pb-2">
                <div className="w-10 px-2 flex-none"></div>
                {visibleColumns.map((col) => (
                    <div key={col.id} className="px-2 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate border-r border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors flex-none cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 flex items-center gap-1 group" style={{ width: col.width }} onClick={() => onSort && onSort(col.id)}>
                        <span className="truncate">{col.label}</span>
                        {sortConfig?.key === col.id && <div className="flex-none text-blue-500">{sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}</div>}
                    </div>
                ))}
            </div>
        </div>
        <div className="overflow-hidden h-full absolute top-0 right-0" style={{ left: gridWidth }} ref={headerRef}>
           <div className="relative h-full" style={{ width: totalWidth }}>
              {years.map((y, i) => <div key={`y-${i}`} className="absolute top-0 border-l border-b border-slate-300 dark:border-slate-600 bg-slate-200/50 dark:bg-slate-700/50 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300" style={{ left: y.left, width: y.width, height: scale === 'Year' ? '100%' : '24px' }}>{y.label}</div>)}
              {scale !== 'Year' && months.map((m, i) => <div key={`m-${i}`} className="absolute border-l border-b border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide" style={{ left: m.left, width: m.width, top: '24px', height: scale === 'Month' ? '36px' : '24px' }}>{m.label}</div>)}
              {(scale === 'Day' || scale === 'Week') && bottom.map((tick, i) => <div key={`d-${i}`} className="absolute bottom-0 border-l border-slate-200/50 dark:border-slate-700/50 flex items-center justify-center text-[9px] text-slate-400 dark:text-slate-500" style={{ left: dateToPixels(tick), width: pixelsPerDay * (scale === 'Week' ? 7 : 1), height: '32px' }}>{scale === 'Week' ? `W${Math.ceil(tick.getDate()/7)}` : tick.getDate()}</div>)}
           </div>
        </div>
      </div>

      {/* Virtual Scroll Body */}
      <div className="flex-1 overflow-auto custom-scrollbar relative bg-slate-50/30 dark:bg-slate-900/50" ref={bodyRef} onScroll={handleScroll}>
        <div className="relative" style={{ height: totalListHeight, width: `calc(${gridWidth}px + ${totalWidth}px)` }}>
          <div className="absolute top-0 bottom-0 right-0 pointer-events-none z-0" style={{ left: gridWidth }}>
             {bottom.map((tick, i) => <div key={`grid-${i}`} className="absolute top-0 bottom-0 border-l border-slate-200/40 dark:border-slate-700/40" style={{ left: `${dateToPixels(tick)}px` }} />)}
          </div>
          
          {/* Render Visible Items */}
          {visibleItems.map(({ item, top }) => {
              if (item.type === 'group') return renderGroupRow(item.data as GroupNode, top);
              return renderAssetRow(item.data as PfaRecord, top, (item.parent as GroupNode)?.level || 0);
          })}
        </div>
      </div>
    </div>
  );
};
