
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Asset } from '../../types';
import { Search, Database } from 'lucide-react';
import { formatDate, formatCurrency } from '../../utils';

interface PfaMasterViewProps {
    assets: Asset[];
}

export const PfaMasterView: React.FC<PfaMasterViewProps> = ({ assets }) => {
    const [search, setSearch] = useState('');
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);

    const filtered = useMemo(() => assets.filter(r => 
        String(r.pfaId || '').toLowerCase().includes(search.toLowerCase()) ||
        String(r.class || '').toLowerCase().includes(search.toLowerCase()) ||
        String(r.equipment || '').toLowerCase().includes(search.toLowerCase())
    ), [assets, search]);

    // --- VIRTUAL SCROLL LOGIC ---
    const ROW_HEIGHT = 40; // Fixed row height
    const OVERSCAN = 10; // Buffer rows
    const totalHeight = filtered.length * ROW_HEIGHT;
    
    const visibleRowCount = Math.ceil((scrollContainerRef.current?.clientHeight || 600) / ROW_HEIGHT);
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const endIndex = Math.min(filtered.length, Math.floor((scrollTop + (scrollContainerRef.current?.clientHeight || 600)) / ROW_HEIGHT) + OVERSCAN);
    
    const visibleRows = filtered.slice(startIndex, endIndex);
    const startOffset = startIndex * ROW_HEIGHT;

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    };

    // Initial ref update
    useEffect(() => {
       if(scrollContainerRef.current) setScrollTop(scrollContainerRef.current.scrollTop); 
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Database className="w-5 h-5" /> PFA Master Data
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Read-only view of the PFA Ledger records imported into the system.
                        <span className="ml-2 text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{filtered.length} records</span>
                    </p>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search PFA..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm flex flex-col h-[calc(100vh-200px)]">
                <div className="flex-1 overflow-auto custom-scrollbar relative" ref={scrollContainerRef} onScroll={handleScroll}>
                    
                    {/* Sticky Header Table (Separate for layout, but visually integrated) */}
                    <table className="w-full text-left text-sm whitespace-nowrap sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
                        <thead className="text-xs uppercase font-bold text-slate-500">
                            <tr>
                                <th className="px-4 h-10 min-w-[120px]">PFA ID</th>
                                <th className="px-4 h-10 min-w-[100px]">Status</th>
                                <th className="px-4 h-10 min-w-[150px]">Organization</th>
                                <th className="px-4 h-10 min-w-[120px]">Area / Silo</th>
                                <th className="px-4 h-10 min-w-[150px]">Class</th>
                                <th className="px-4 h-10 min-w-[150px]">Category</th>
                                <th className="px-4 h-10 min-w-[100px]">Source</th>
                                <th className="px-4 h-10 min-w-[80px]">DOR</th>
                                <th className="px-4 h-10 min-w-[120px]">Plan Start</th>
                                <th className="px-4 h-10 min-w-[120px]">Plan End</th>
                                <th className="px-4 h-10 min-w-[120px]">Forecast Start</th>
                                <th className="px-4 h-10 min-w-[120px]">Forecast End</th>
                                <th className="px-4 h-10 min-w-[120px]">Actual Start</th>
                                <th className="px-4 h-10 min-w-[120px]">Actual End</th>
                                <th className="px-4 h-10 min-w-[120px] text-right">Rate / Price</th>
                                <th className="px-4 h-10 min-w-[150px]">Equipment</th>
                            </tr>
                        </thead>
                    </table>

                    {/* Virtual Content */}
                    <div style={{ height: totalHeight, position: 'relative' }}>
                        <table 
                            className="w-full text-left text-sm whitespace-nowrap absolute top-0 left-0 table-fixed" 
                            style={{ transform: `translateY(${startOffset}px)` }}
                        >
                            {/* Replicate Column Widths implicitly via layout or fixed sizes */}
                            <colgroup>
                                <col style={{width: 120}} />
                                <col style={{width: 100}} />
                                <col style={{width: 150}} />
                                <col style={{width: 120}} />
                                <col style={{width: 150}} />
                                <col style={{width: 150}} />
                                <col style={{width: 100}} />
                                <col style={{width: 80}} />
                                <col style={{width: 120}} />
                                <col style={{width: 120}} />
                                <col style={{width: 120}} />
                                <col style={{width: 120}} />
                                <col style={{width: 120}} />
                                <col style={{width: 120}} />
                                <col style={{width: 120}} />
                                <col style={{width: 150}} />
                            </colgroup>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {visibleRows.map((record, idx) => (
                                    <tr key={record.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 h-[40px]">
                                        <td className="px-4 font-bold text-slate-700 dark:text-slate-200 truncate">{record.pfaId}</td>
                                        <td className="px-4 text-xs">
                                            {record.isActualized ? <span className="text-emerald-500 font-bold">Actual</span> : 
                                            record.isDiscontinued ? <span className="text-red-500 font-bold">Disc.</span> : 
                                            <span className="text-blue-500 font-bold">Forecast</span>}
                                        </td>
                                        <td className="px-4 text-slate-600 dark:text-slate-300 truncate" title={record.organization}>{record.organization}</td>
                                        <td className="px-4 text-slate-600 dark:text-slate-300 truncate">{record.areaSilo}</td>
                                        <td className="px-4 text-slate-600 dark:text-slate-300 truncate">{record.class}</td>
                                        <td className="px-4 text-slate-600 dark:text-slate-300 truncate">{record.category}</td>
                                        <td className="px-4 text-slate-600 dark:text-slate-300">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${record.source === 'Rental' ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' : 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'}`}>
                                                {record.source}
                                            </span>
                                        </td>
                                        <td className="px-4 text-slate-600 dark:text-slate-300 font-mono">{record.dor}</td>
                                        {/* Plan Dates: Show only if hasPlan is true */}
                                        <td className="px-4 text-slate-500 dark:text-slate-400 font-mono text-xs">{record.hasPlan ? formatDate(record.originalStart) : '-'}</td>
                                        <td className="px-4 text-slate-500 dark:text-slate-400 font-mono text-xs">{record.hasPlan ? formatDate(record.originalEnd) : '-'}</td>
                                        <td className="px-4 text-blue-600 dark:text-blue-400 font-mono text-xs font-medium">{formatDate(record.forecastStart)}</td>
                                        <td className="px-4 text-blue-600 dark:text-blue-400 font-mono text-xs font-medium">{formatDate(record.forecastEnd)}</td>
                                        <td className="px-4 text-emerald-600 dark:text-emerald-400 font-mono text-xs">{record.hasActuals ? formatDate(record.actualStart) : '-'}</td>
                                        <td className="px-4 text-emerald-600 dark:text-emerald-400 font-mono text-xs">{record.hasActuals ? formatDate(record.actualEnd) : '-'}</td>
                                        <td className="px-4 text-slate-600 dark:text-slate-300 font-mono text-right">
                                            {formatCurrency(record.source === 'Rental' ? record.monthlyRate : record.purchasePrice)}
                                        </td>
                                        <td className="px-4 text-slate-600 dark:text-slate-300 font-bold truncate" title={record.equipment}>
                                            {record.equipment || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {filtered.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center text-slate-400 italic">No PFA records found.</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
