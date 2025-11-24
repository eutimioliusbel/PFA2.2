
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AssetMasterRecord } from '../../types';
import { Search, Monitor } from 'lucide-react';

interface AssetMasterViewProps {
    data: AssetMasterRecord[];
}

export const AssetMasterView: React.FC<AssetMasterViewProps> = ({ data }) => {
    const [search, setSearch] = useState('');
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);

    const filtered = useMemo(() => data.filter(r => 
        String(r.assetTag || '').toLowerCase().includes(search.toLowerCase()) ||
        String(r.description || '').toLowerCase().includes(search.toLowerCase()) ||
        String(r.model || '').toLowerCase().includes(search.toLowerCase())
    ), [data, search]);

    // --- VIRTUAL SCROLL ---
    const ROW_HEIGHT = 40;
    const OVERSCAN = 10;
    const totalHeight = filtered.length * ROW_HEIGHT;
    
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const endIndex = Math.min(filtered.length, Math.floor((scrollTop + (scrollContainerRef.current?.clientHeight || 600)) / ROW_HEIGHT) + OVERSCAN);
    
    const visibleRows = filtered.slice(startIndex, endIndex);
    const startOffset = startIndex * ROW_HEIGHT;

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    };

    useEffect(() => {
       if(scrollContainerRef.current) setScrollTop(scrollContainerRef.current.scrollTop); 
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Monitor className="w-5 h-5" /> Asset Master Data
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Read-only view of available equipment assets in the system.
                        <span className="ml-2 text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{filtered.length} records</span>
                    </p>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search assets..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm flex flex-col h-[calc(100vh-200px)]">
                <div className="flex-1 overflow-auto custom-scrollbar relative" ref={scrollContainerRef} onScroll={handleScroll}>
                    
                    {/* Sticky Header */}
                    <table className="w-full text-left text-sm whitespace-nowrap sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
                        <thead className="text-xs uppercase font-bold text-slate-500">
                            <tr>
                                <th className="px-4 h-10 min-w-[120px]">Asset Tag</th>
                                <th className="px-4 h-10 min-w-[250px]">Description</th>
                                <th className="px-4 h-10 min-w-[150px]">Org</th>
                                <th className="px-4 h-10 min-w-[100px]">Status</th>
                                <th className="px-4 h-10 min-w-[120px]">Dept</th>
                                <th className="px-4 h-10 min-w-[150px]">Class</th>
                                <th className="px-4 h-10 min-w-[150px]">Category</th>
                                <th className="px-4 h-10 min-w-[100px]">Source</th>
                                <th className="px-4 h-10 min-w-[120px]">Make</th>
                                <th className="px-4 h-10 min-w-[120px]">Model</th>
                                <th className="px-4 h-10 min-w-[120px]">Serial</th>
                                <th className="px-4 h-10 min-w-[120px]">Comm. Date</th>
                                <th className="px-4 h-10 min-w-[150px]">Assigned To</th>
                                <th className="px-4 h-10 min-w-[120px]">On Site</th>
                            </tr>
                        </thead>
                    </table>

                    {/* Virtual Content */}
                    <div style={{ height: totalHeight, position: 'relative' }}>
                        <table 
                            className="w-full text-left text-sm whitespace-nowrap absolute top-0 left-0 table-fixed"
                            style={{ transform: `translateY(${startOffset}px)` }}
                        >
                            <colgroup>
                                <col style={{width: 120}} />
                                <col style={{width: 250}} />
                                <col style={{width: 150}} />
                                <col style={{width: 100}} />
                                <col style={{width: 120}} />
                                <col style={{width: 150}} />
                                <col style={{width: 150}} />
                                <col style={{width: 100}} />
                                <col style={{width: 120}} />
                                <col style={{width: 120}} />
                                <col style={{width: 120}} />
                                <col style={{width: 120}} />
                                <col style={{width: 150}} />
                                <col style={{width: 120}} />
                            </colgroup>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {visibleRows.map((record, idx) => (
                                    <tr key={record.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 h-[40px]">
                                        <td className="px-4 font-bold text-slate-700 dark:text-slate-200 truncate">{record.assetTag}</td>
                                        <td className="px-4 text-slate-600 dark:text-slate-300 truncate" title={record.description}>{record.description}</td>
                                        <td className="px-4 text-slate-600 dark:text-slate-300 truncate">{record.organization}</td>
                                        <td className="px-4 text-slate-600 dark:text-slate-300 truncate">{record.equipmentStatus}</td>
                                        <td className="px-4 text-slate-600 dark:text-slate-300 truncate">{record.department}</td>
                                        <td className="px-4 text-slate-600 dark:text-slate-300 truncate">{record.class}</td>
                                        <td className="px-4 text-slate-600 dark:text-slate-300 truncate">{record.category}</td>
                                        <td className="px-4 text-slate-600 dark:text-slate-300 truncate">{record.source}</td>
                                        <td className="px-4 text-slate-600 dark:text-slate-300 truncate">{record.manufacturer}</td>
                                        <td className="px-4 text-slate-600 dark:text-slate-300 truncate">{record.model}</td>
                                        <td className="px-4 text-slate-600 dark:text-slate-300 font-mono truncate">{record.serialNumber || '-'}</td>
                                        <td className="px-4 text-slate-600 dark:text-slate-300 font-mono truncate">{record.commissionDate ? new Date(record.commissionDate).toLocaleDateString() : '-'}</td>
                                        <td className="px-4 text-slate-600 dark:text-slate-300 truncate">{record.assignedTo}</td>
                                        <td className="px-4 text-slate-600 dark:text-slate-300 font-mono truncate">{record.onSiteDate ? new Date(record.onSiteDate).toLocaleDateString() : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {filtered.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center text-slate-400 italic">No assets found.</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
