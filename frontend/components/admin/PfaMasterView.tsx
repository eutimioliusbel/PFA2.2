import { useState, useMemo, useRef, useEffect } from 'react';
import { Asset } from '../../types';
import { Search, Database, RefreshCw } from 'lucide-react';
import { formatDate, formatCurrency } from '../../utils';

interface PfaMasterViewProps {
    assets: Asset[];
    onRefresh?: () => void;
}

export const PfaMasterView: React.FC<PfaMasterViewProps> = ({ assets, onRefresh }) => {
    const [search, setSearch] = useState('');
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);

    const filtered = useMemo(() => assets.filter(r =>
        String(r.pfaId || '').toLowerCase().includes(search.toLowerCase()) ||
        String(r.class || '').toLowerCase().includes(search.toLowerCase()) ||
        String(r.equipment || '').toLowerCase().includes(search.toLowerCase())
    ), [assets, search]);

    // Stats for summary bar
    const stats = useMemo(() => {
        const actualized = assets.filter(r => r.isActualized).length;
        const forecast = assets.filter(r => !r.isActualized && !r.isDiscontinued).length;
        const discontinued = assets.filter(r => r.isDiscontinued).length;
        const rentals = assets.filter(r => r.source === 'Rental').length;
        const purchases = assets.filter(r => r.source === 'Purchase').length;
        const beo = assets.filter(r => r.dor === 'BEO').length;
        return { actualized, forecast, discontinued, rentals, purchases, beo };
    }, [assets]);

    // --- VIRTUAL SCROLL LOGIC ---
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
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Database className="w-8 h-8 text-blue-500" />
                    <div>
                        <h2 className="text-2xl font-bold text-slate-100">PFA Records</h2>
                        <p className="text-sm text-slate-400 mt-1">
                            Plan-Forecast-Actual ledger records in the system
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search PFA..."
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
                <div className="flex items-center gap-2 text-slate-300 flex-wrap">
                    <Database className="w-5 h-5 text-blue-400" />
                    <span className="font-semibold">
                        Total PFAs: <span className="text-blue-400">{assets.length}</span>
                    </span>
                    <span className="mx-2 text-slate-600">|</span>
                    <span className="font-semibold">
                        Actualized: <span className="text-emerald-400">{stats.actualized}</span>
                    </span>
                    <span className="mx-2 text-slate-600">|</span>
                    <span className="font-semibold">
                        Forecast: <span className="text-blue-400">{stats.forecast}</span>
                    </span>
                    <span className="mx-2 text-slate-600">|</span>
                    <span className="font-semibold">
                        Discontinued: <span className="text-red-400">{stats.discontinued}</span>
                    </span>
                    <span className="mx-2 text-slate-600">|</span>
                    <span className="font-semibold">
                        Rentals: <span className="text-cyan-400">{stats.rentals}</span>
                    </span>
                    <span className="mx-2 text-slate-600">|</span>
                    <span className="font-semibold">
                        Purchases: <span className="text-amber-400">{stats.purchases}</span>
                    </span>
                    <span className="mx-2 text-slate-600">|</span>
                    <span className="font-semibold">
                        BEO: <span className="text-purple-400">{stats.beo}</span>
                    </span>
                </div>
            </div>

            {/* PFA Table */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto h-[calc(100vh-320px)]" ref={scrollContainerRef} onScroll={handleScroll}>

                    {/* Sticky Header Table */}
                    <table className="w-full text-left text-sm whitespace-nowrap sticky top-0 z-20 bg-slate-900 border-b border-slate-700">
                        <thead>
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[120px]">PFA ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[100px]">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[120px]">Organization</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[100px]">Area / Silo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[120px]">Class</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[120px]">Category</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[80px]">Source</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[60px]">DOR</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[100px]">Plan Start</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[100px]">Plan End</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[100px]">Fcst Start</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[100px]">Fcst End</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[100px]">Act Start</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[100px]">Act End</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[100px]">Rate/Price</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[150px]">Equipment</th>
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
                                <col style={{width: 100}} />
                                <col style={{width: 120}} />
                                <col style={{width: 100}} />
                                <col style={{width: 120}} />
                                <col style={{width: 120}} />
                                <col style={{width: 80}} />
                                <col style={{width: 60}} />
                                <col style={{width: 100}} />
                                <col style={{width: 100}} />
                                <col style={{width: 100}} />
                                <col style={{width: 100}} />
                                <col style={{width: 100}} />
                                <col style={{width: 100}} />
                                <col style={{width: 100}} />
                                <col style={{width: 150}} />
                            </colgroup>
                            <tbody className="divide-y divide-slate-700">
                                {visibleRows.map((record, idx) => (
                                    <tr key={record.id || idx} className="hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-100 truncate">{record.pfaId}</td>
                                        <td className="px-6 py-4">
                                            {record.isActualized ? (
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400">Actual</span>
                                            ) : record.isDiscontinued ? (
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">Disc.</span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400">Forecast</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-slate-300 truncate" title={record.organization}>{record.organization}</td>
                                        <td className="px-6 py-4 text-slate-300 truncate">{record.areaSilo}</td>
                                        <td className="px-6 py-4 text-slate-300 truncate">{record.class}</td>
                                        <td className="px-6 py-4 text-slate-300 truncate">{record.category}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${record.source === 'Rental' ? 'bg-blue-900/30 text-blue-400 border-blue-700' : 'bg-amber-900/30 text-amber-400 border-amber-700'}`}>
                                                {record.source}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-300 font-mono text-xs">{record.dor}</td>
                                        <td className="px-6 py-4 text-right text-slate-400 font-mono text-xs">{record.hasPlan ? formatDate(record.originalStart) : '-'}</td>
                                        <td className="px-6 py-4 text-right text-slate-400 font-mono text-xs">{record.hasPlan ? formatDate(record.originalEnd) : '-'}</td>
                                        <td className="px-6 py-4 text-right text-blue-400 font-mono text-xs font-medium">{formatDate(record.forecastStart)}</td>
                                        <td className="px-6 py-4 text-right text-blue-400 font-mono text-xs font-medium">{formatDate(record.forecastEnd)}</td>
                                        <td className="px-6 py-4 text-right text-emerald-400 font-mono text-xs">{record.hasActuals ? formatDate(record.actualStart) : '-'}</td>
                                        <td className="px-6 py-4 text-right text-emerald-400 font-mono text-xs">{record.hasActuals ? formatDate(record.actualEnd) : '-'}</td>
                                        <td className="px-6 py-4 text-slate-300 font-mono text-right text-xs">
                                            {formatCurrency(record.source === 'Rental' ? record.monthlyRate : record.purchasePrice)}
                                        </td>
                                        <td className="px-6 py-4 text-slate-300 truncate" title={record.equipment}>
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
