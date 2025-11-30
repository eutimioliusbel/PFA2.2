import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, RefreshCw, Database } from 'lucide-react';

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
    onRefresh?: () => void;
}

export const GenericMasterView: React.FC<GenericMasterViewProps> = ({
    title,
    description,
    data,
    columns,
    icon: Icon = Database,
    onRefresh
}) => {
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
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Icon className="w-8 h-8 text-blue-500" />
                    <div>
                        <h2 className="text-2xl font-bold text-slate-100">{title}</h2>
                        <p className="text-sm text-slate-400 mt-1">{description}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={`Search ${title.toLowerCase()}...`}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all text-slate-100 placeholder-slate-500"
                        />
                    </div>
                    {onRefresh && (
                        <button
                            onClick={onRefresh}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Stats Bar */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 text-slate-300">
                    <Icon className="w-5 h-5 text-blue-400" />
                    <span className="font-semibold">
                        Total Records: <span className="text-blue-400">{data.length}</span>
                    </span>
                    {search && (
                        <>
                            <span className="mx-2 text-slate-600">|</span>
                            <span className="font-semibold">
                                Filtered: <span className="text-cyan-400">{filtered.length}</span>
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto h-[calc(100vh-320px)]" ref={scrollContainerRef} onScroll={handleScroll}>
                    <table className="w-full text-left text-sm whitespace-nowrap sticky top-0 z-20 bg-slate-900 border-b border-slate-700">
                        <thead>
                            <tr>
                                {columns.map((col) => (
                                    <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider" style={{ width: col.width || 'auto' }}>{col.label}</th>
                                ))}
                            </tr>
                        </thead>
                    </table>
                    <div style={{ height: totalHeight, position: 'relative' }}>
                        <table className="w-full text-left text-sm whitespace-nowrap absolute top-0 left-0 table-fixed" style={{ transform: `translateY(${startOffset}px)` }}>
                            <colgroup>
                                {columns.map((col) => <col key={col.key} style={{ width: col.width || 'auto' }} />)}
                            </colgroup>
                            <tbody className="divide-y divide-slate-700">
                                {visibleRows.map((record, idx) => (
                                    <tr key={record.id || idx} className="hover:bg-slate-700/50 transition-colors">
                                        {columns.map((col, colIdx) => (
                                            <td key={col.key} className={`px-6 py-4 truncate ${colIdx === 0 ? 'font-medium text-slate-100' : 'text-slate-300'}`}>{record[col.key] || '-'}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {filtered.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center text-slate-400 italic">No records found.</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
