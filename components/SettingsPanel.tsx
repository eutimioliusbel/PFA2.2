
import React, { useState } from 'react';
import { X, Layers, Tag, Calendar, Clock, DollarSign, PaintBucket, Columns, GripVertical } from 'lucide-react';
import { Scale, SeriesVisibility, DisplayMetric, ViewMode, GridColumn, GroupingField, ColorConfig } from '../types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  appMode: string; // Added to control visibility of sections
  scale: Scale;
  setScale: (scale: Scale) => void;
  visibleSeries: SeriesVisibility;
  setVisibleSeries: (v: SeriesVisibility | ((prev: SeriesVisibility) => SeriesVisibility)) => void;
  barDisplayMode: DisplayMetric;
  setBarDisplayMode: (mode: DisplayMetric) => void;
  viewMode: ViewMode; // Kept for Scale logic, but no longer switchable here
  gridColumns: GridColumn[];
  setGridColumns: (cols: GridColumn[]) => void;
  grouping: GroupingField[];
  setGrouping: (g: GroupingField[]) => void;
  colors: ColorConfig;
  setColors: (c: ColorConfig) => void;
}

const SCALE_ORDER: Scale[] = ['Year', 'Month', 'Week', 'Day'];

const GROUPING_OPTIONS: {id: GroupingField, label: string}[] = [
    {id: 'none', label: 'None'},
    {id: 'areaSilo', label: 'Area / Silo'},
    {id: 'category', label: 'Category'},
    {id: 'class', label: 'Class'},
    {id: 'source', label: 'Source'},
    {id: 'dor', label: 'DOR'},
    {id: 'status', label: 'Status'},
    {id: 'manufacturer', label: 'Manufacturer'},
    {id: 'model', label: 'Model'}
];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  appMode,
  scale,
  setScale,
  visibleSeries,
  setVisibleSeries,
  barDisplayMode,
  setBarDisplayMode,
  viewMode,
  gridColumns,
  setGridColumns,
  grouping,
  setGrouping,
  colors,
  setColors
}) => {

  // Simple column reorder state logic (without DnD library)
  const [draggedColIndex, setDraggedColIndex] = useState<number | null>(null);

  const toggleColumn = (id: string) => {
      setGridColumns(gridColumns.map(col => {
          if (col.id === 'pfaId') return col; // Lock PFA ID
          return col.id === id ? { ...col, visible: !col.visible } : col;
      }));
  };

  const handleDragStart = (index: number) => {
      setDraggedColIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedColIndex === null || draggedColIndex === index) return;
      // PFA ID (index 0) is locked
      if (index === 0 || draggedColIndex === 0) return;

      const newCols = [...gridColumns];
      const item = newCols.splice(draggedColIndex, 1)[0];
      newCols.splice(index, 0, item);
      setGridColumns(newCols);
      setDraggedColIndex(index);
  };

  const handleDragEnd = () => {
      setDraggedColIndex(null);
  };

  const updateGrouping = (level: number, value: GroupingField) => {
      const newGrouping = [...grouping];
      newGrouping[level] = value;
      if (value === 'none') {
          if (level === 0) setGrouping([]);
          else setGrouping(newGrouping.slice(0, level));
      } else {
          setGrouping(newGrouping);
      }
  };

  const isPfa1Lab = appMode === 'pfa-1.0-lab';

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div className={`fixed inset-y-0 right-0 w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-bold text-slate-800 dark:text-white text-lg">View Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">
          
          {/* Section: Grouping - HIDDEN in PFA 1.0 */}
          {!isPfa1Lab && (
            <div>
               <div className="flex items-center gap-2 mb-3 text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <Layers className="w-4 h-4" /> Grouping Levels
              </div>
              <div className="space-y-2">
                  {[0, 1, 2].map(level => (
                      <div key={level} className={`transition-all ${level > 0 && (!grouping[level-1] || grouping[level-1] === 'none') ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Level {level + 1}</label>
                          <select 
                              value={grouping[level] || 'none'} 
                              onChange={(e) => updateGrouping(level, e.target.value as GroupingField)}
                              className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                          >
                              {GROUPING_OPTIONS.map(opt => (
                                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                              ))}
                          </select>
                      </div>
                  ))}
              </div>
              <div className="w-full h-px bg-slate-100 dark:bg-slate-800 my-4"></div>
            </div>
          )}

           {/* Section: Colors - ALWAYS VISIBLE */}
           <div>
             <div className="flex items-center gap-2 mb-3 text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <PaintBucket className="w-4 h-4" /> Bar Colors
            </div>
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Plan</span>
                    <input type="color" value={colors.plan} onChange={e => setColors({...colors, plan: e.target.value})} className="w-8 h-8 rounded cursor-pointer border-none bg-transparent" />
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Forecast</span>
                    <input type="color" value={colors.forecast} onChange={e => setColors({...colors, forecast: e.target.value})} className="w-8 h-8 rounded cursor-pointer border-none bg-transparent" />
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Actual</span>
                    <input type="color" value={colors.actual} onChange={e => setColors({...colors, actual: e.target.value})} className="w-8 h-8 rounded cursor-pointer border-none bg-transparent" />
                </div>
            </div>
           </div>

          <div className="w-full h-px bg-slate-100 dark:bg-slate-800 my-4"></div>

          {/* Section: Scale - ONLY TIMELINE MODE & NOT PFA 1.0 (Since PFA 1.0 is Matrix) */}
          {viewMode === 'timeline' && !isPfa1Lab && (
            <div className="mt-4">
                <div className="flex items-center gap-2 mb-3 text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <Calendar className="w-4 h-4" /> Timeline Scale
                </div>
                <div className="grid grid-cols-4 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    {SCALE_ORDER.map(s => (
                        <button 
                            key={s}
                            onClick={() => setScale(s)}
                            className={`py-2 rounded-lg text-xs font-bold transition-all ${scale === s ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
                <div className="w-full h-px bg-slate-100 dark:bg-slate-800 my-4"></div>
            </div>
          )}

          {/* Section: Grid Columns - HIDDEN in PFA 1.0 */}
          {!isPfa1Lab && (
            <div>
               <div className="flex items-center gap-2 mb-3 text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <Columns className="w-4 h-4" /> Grid Columns (Drag to Order)
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                  {gridColumns.map((col, idx) => (
                      <div 
                          key={col.id} 
                          draggable={col.id !== 'pfaId'}
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center justify-between p-2 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors ${col.id === 'pfaId' ? 'opacity-80 bg-slate-100/50' : 'hover:bg-white dark:hover:bg-slate-800 cursor-move'}`}
                      >
                          <div className="flex items-center gap-3">
                               {col.id !== 'pfaId' && <GripVertical className="w-4 h-4 text-slate-300" />}
                              <input 
                                  type="checkbox" 
                                  checked={col.visible} 
                                  onChange={() => toggleColumn(col.id)}
                                  disabled={col.id === 'pfaId'}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                              />
                              <span className={`text-xs font-medium ${col.id === 'pfaId' ? 'text-slate-400 italic' : 'text-slate-700 dark:text-slate-200'}`}>
                                  {col.label}
                              </span>
                          </div>
                      </div>
                  ))}
              </div>
              <div className="w-full h-px bg-slate-100 dark:bg-slate-800 my-4"></div>
            </div>
          )}

          {/* Section: Labels - HIDDEN in PFA 1.0 */}
          {!isPfa1Lab && (
            <div>
              <div className="flex items-center gap-2 mb-3 text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <Tag className="w-4 h-4" /> Data Labels
              </div>
              <div className="grid grid-cols-2 gap-3">
                  <button 
                      onClick={() => setBarDisplayMode('cost')}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border font-bold text-sm transition-all ${barDisplayMode === 'cost' ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-slate-800 dark:border-white shadow-lg' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                  >
                      <DollarSign className="w-4 h-4" /> Cost
                  </button>
                  <button 
                      onClick={() => setBarDisplayMode('duration')}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border font-bold text-sm transition-all ${barDisplayMode === 'duration' ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-slate-800 dark:border-white shadow-lg' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                  >
                      <Clock className="w-4 h-4" /> Duration
                  </button>
              </div>
            </div>
          )}

        </div>
        
        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <button 
                onClick={onClose}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95"
            >
                Done
            </button>
        </div>

      </div>
    </>
  );
};
