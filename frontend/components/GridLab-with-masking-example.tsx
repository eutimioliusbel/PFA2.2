/**
 * GridLab with Financial Masking Example
 *
 * This is a demonstration file showing how to integrate FinancialMaskingBadge
 * into the GridLab component. This file is NOT meant to replace GridLab.tsx,
 * but rather to serve as a reference implementation.
 *
 * TO INTEGRATE INTO GridLab.tsx:
 * 1. Add import: import { FinancialMaskingBadge } from './FinancialMaskingBadge';
 * 2. Add props: viewFinancialDetails: boolean; organizationId: string;
 * 3. Replace line 185-187 (the cost cell) with the example below
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Asset } from '../types';
import { formatDate } from '../utils';
import { ArrowUpDown, CheckSquare, Square } from 'lucide-react';
import { FinancialMaskingBadge } from './FinancialMaskingBadge';

interface GridLabProps {
  assets: Asset[];
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectMultiple: (ids: string[], selected: boolean) => void;

  // NEW PROPS FOR FINANCIAL MASKING
  viewFinancialDetails: boolean; // User's capability
  organizationId: string; // Current organization context
}

type SortKey = keyof Asset | 'cost';

export const GridLab: React.FC<GridLabProps> = ({
    assets,
    selectedIds,
    onToggleSelection,
    onSelectMultiple,
    viewFinancialDetails,
    organizationId
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('pfaId');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Virtual Scroll State
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleSelectAll = () => {
      const allSelected = assets.every(a => selectedIds.has(a.id));
      onSelectMultiple(assets.map(a => a.id), !allSelected);
  };

  const sortedAssets = useMemo(() => {
    const result = [...assets];

    result.sort((a, b) => {
      let valA: any = a[sortKey as keyof Asset];
      let valB: any = b[sortKey as keyof Asset];

      if (sortKey === 'cost') {
         valA = a.source === 'Purchase' ? a.purchasePrice : a.monthlyRate;
         valB = b.source === 'Purchase' ? b.purchasePrice : b.monthlyRate;
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [assets, sortKey, sortDir]);

  // Virtualization Calculation
  const ROW_HEIGHT = 40;
  const OVERSCAN = 10;
  const totalHeight = sortedAssets.length * ROW_HEIGHT;

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
      sortedAssets.length,
      Math.floor((scrollTop + (scrollRef.current?.clientHeight || 800)) / ROW_HEIGHT) + OVERSCAN
  );

  const visibleAssets = sortedAssets.slice(startIndex, endIndex);
  const startOffset = startIndex * ROW_HEIGHT;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
  };

  useEffect(() => {
      if (scrollRef.current) setScrollTop(scrollRef.current.scrollTop);
  }, []);

  const Th = ({ label, sKey, width }: { label: string, sKey: SortKey, width?: string }) => (
    <th
      className="px-4 py-3 bg-slate-100 dark:bg-slate-800 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700"
      onClick={() => handleSort(sKey)}
      style={{ width }}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === sKey && <ArrowUpDown className="w-3 h-3" />}
      </div>
    </th>
  );

  const isAllSelected = assets.length > 0 && assets.every(a => selectedIds.has(a.id));

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-black/50 select-none relative">

      <div className="flex-1 overflow-auto custom-scrollbar relative" ref={scrollRef} onScroll={handleScroll}>

          {/* Header Table (Sticky) */}
          <table className="w-full whitespace-nowrap absolute top-0 left-0 z-20 bg-slate-100 dark:bg-slate-800 shadow-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 w-10 border-b border-slate-200 dark:border-slate-700">
                    <button onClick={handleSelectAll} className="flex items-center justify-center w-full">
                        {isAllSelected
                            ? <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            : <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                        }
                    </button>
                </th>
                <Th label="PFA ID" sKey="pfaId" width="120px" />
                <Th label="Org" sKey="organization" width="150px" />
                <Th label="Area / Silo" sKey="areaSilo" />
                <Th label="Class" sKey="class" />
                <Th label="Category" sKey="category" />
                <Th label="Source" sKey="source" width="100px" />
                <Th label="Forecast Start" sKey="forecastStart" width="120px" />
                <Th label="Forecast End" sKey="forecastEnd" width="120px" />
                <Th label="Rate/Price" sKey="monthlyRate" width="180px" /> {/* UPDATED WIDTH */}
                <Th label="Status" sKey="isActualized" width="150px" />
              </tr>
            </thead>
          </table>

          {/* Virtual Content */}
          <div style={{ height: totalHeight, paddingTop: 45 }} className="relative">
             <table className="w-full whitespace-nowrap absolute top-0 left-0" style={{ transform: `translateY(${startOffset + 45}px)` }}>
                 <colgroup>
                    <col style={{width: 40}} />
                    <col style={{width: 120}} />
                    <col style={{width: 150}} />
                    <col />
                    <col />
                    <col />
                    <col style={{width: 100}} />
                    <col style={{width: 120}} />
                    <col style={{width: 120}} />
                    <col style={{width: 180}} /> {/* UPDATED WIDTH */}
                    <col style={{width: 150}} />
                 </colgroup>
                 <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleAssets.map((asset) => {
                    const isSelected = selectedIds.has(asset.id);
                    return (
                        <tr
                            key={asset.id}
                            className={`h-[40px] transition-colors cursor-pointer ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                            onClick={() => onToggleSelection(asset.id)}
                        >
                        <td className="px-4 py-3 text-center border-r border-slate-100 dark:border-slate-800/50">
                            <button onClick={(e) => { e.stopPropagation(); onToggleSelection(asset.id); }}>
                                {isSelected
                                    ? <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    : <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                                }
                            </button>
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800/50 truncate">
                            {asset.pfaId}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 truncate">{asset.organization}</td>
                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 truncate">{asset.areaSilo}</td>
                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 truncate">{asset.class}</td>
                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 truncate">{asset.category}</td>
                        <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                                asset.source === 'Rental'
                                ? 'bg-blue-50 border-blue-100 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
                                : 'bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400'
                            }`}>
                                {asset.source}
                            </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-600 dark:text-slate-400">{formatDate(asset.forecastStart)}</td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-600 dark:text-slate-400">{formatDate(asset.forecastEnd)}</td>

                        {/* ============================================ */}
                        {/* UPDATED COST CELL WITH FINANCIAL MASKING     */}
                        {/* ============================================ */}
                        <td className="px-4 py-3 text-xs" onClick={(e) => e.stopPropagation()}>
                            <FinancialMaskingBadge
                                record={asset}
                                viewFinancialDetails={viewFinancialDetails}
                                variant="badge" // Use 'badge' variant for compact table view
                                organizationId={organizationId}
                            />
                        </td>
                        {/* ============================================ */}

                        <td className="px-4 py-3 text-xs">
                            <div className="flex gap-1 items-center">
                                {asset.isActualized && <span className="w-2 h-2 rounded-full bg-emerald-500" title="Actualized"></span>}
                                {asset.isDiscontinued && <span className="w-2 h-2 rounded-full bg-red-500" title="Discontinued"></span>}
                                {asset.isFundsTransferable && <span className="w-2 h-2 rounded-full bg-blue-500" title="Funds Transferable"></span>}
                                {!asset.isActualized && !asset.isDiscontinued && !asset.isFundsTransferable && <span className="w-2 h-2 rounded-full bg-slate-300" title="Planned"></span>}
                                <span className="ml-1 text-slate-500">
                                    {asset.isActualized ? 'Active' : asset.isDiscontinued ? 'Discontinued' : 'Forecast'}
                                </span>
                            </div>
                        </td>
                        </tr>
                    );
                  })}
                 </tbody>
             </table>
          </div>
      </div>

      {/* Stats Footer */}
      <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-between items-center text-xs text-slate-500">
        <span>{sortedAssets.length} records {selectedIds.size > 0 && `(${selectedIds.size} selected)`}</span>
        <span>Virtualized: {visibleAssets.length} visible</span>
      </div>
    </div>
  );
};

/**
 * INTEGRATION NOTES:
 *
 * 1. To use this in App.tsx or parent component:
 *
 *    import { GridLab } from './components/GridLab';
 *
 *    <GridLab
 *      assets={visiblePfaRecords}
 *      selectedIds={selectedAssetIds}
 *      onToggleSelection={handleToggleSelection}
 *      onSelectMultiple={handleSelectMultiple}
 *      viewFinancialDetails={currentUser?.permissions?.perm_ViewFinancials || false}
 *      organizationId={currentUser?.organizationId || ''}
 *    />
 *
 * 2. The FinancialMaskingBadge component will:
 *    - Show actual cost if user has viewFinancialDetails capability
 *    - Show masked cost with impact badge if user lacks capability
 *    - Display tooltip on hover with relative indicators
 *    - Open portfolio insights modal on click
 *
 * 3. For detail views (e.g., modal or sidebar), use variant="full":
 *
 *    <FinancialMaskingBadge
 *      record={selectedRecord}
 *      viewFinancialDetails={hasCapability('viewFinancialDetails')}
 *      variant="full"
 *      organizationId={organizationId}
 *    />
 *
 * 4. For inline text displays, use variant="inline" (default):
 *
 *    <FinancialMaskingBadge
 *      record={pfaRecord}
 *      viewFinancialDetails={hasCapability('viewFinancialDetails')}
 *      variant="inline"
 *      organizationId={organizationId}
 *    />
 */
