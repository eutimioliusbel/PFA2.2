
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Database } from 'lucide-react';

interface Column {
    key: string;
    label: string;
    width?: string;
}

interface GenericMasterViewProps {
    title: string;
    description: string;
    data: any[];
    columns: Column[];
    icon?: any;
}

export const GenericMasterView: React.FC<GenericMasterViewProps> = ({ title, description, data, columns, icon: Icon }) => {
    const [search, setSearch] = useState('');
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);

    const filtered = useMemo(() => data.filter(r => 
        columns.some(col => String(r[col.key] || '').toLowerCase().includes(search.toLowerCase()))
    ), [data, search, columns]);

    const ROW_HEIGHT = 40;
    const OVERSCAN = 10;
    const totalHeight = filtered.length * ROW_HEIGHT;
    const startOffset = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN) * ROW_HEIGHT;
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const endIndex = Math.min(filtered.length, Math.floor((scrollTop + (scrollContainerRef.current?.clientHeight || 600)) / ROW_HEIGHT) + OVERSCAN);
    const visibleRows = filtered.slice(startIndex, endIndex);

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
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        {Icon && <Icon className="w-5 h-5" />} {title}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {description} <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{filtered.length} records</span>
                    </p>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder={`Search ${title}...`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all text-gray-900 dark:text-white"
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col h-[calc(100vh-200px)]">
                <div className="flex-1 overflow-auto custom-scrollbar relative" ref={scrollContainerRef} onScroll={handleScroll}>
                    <table className="w-full text-left text-sm whitespace-nowrap sticky top-0 z-20 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                        <thead>
                            <tr>
                                {columns.map((col) => (
                                    <th key={col.key} className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider" style={{ width: col.width || 'auto' }}>{col.label}</th>
                                ))}
                            </tr>
                        </thead>
                    </table>
                    <div style={{ height: totalHeight, position: 'relative' }}>
                        <table className="w-full text-left text-sm whitespace-nowrap absolute top-0 left-0 table-fixed" style={{ transform: `translateY(${startOffset}px)` }}>
                            <colgroup>
                                {columns.map((col) => <col key={col.key} style={{ width: col.width || 'auto' }} />)}
                            </colgroup>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {visibleRows.map((record, idx) => (
                                    <tr key={record.id || idx} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        {columns.map((col) => (
                                            <td key={col.key} className="px-6 py-4 text-gray-600 dark:text-gray-300 truncate">{record[col.key]}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {filtered.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center text-gray-400 italic">No records found.</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
