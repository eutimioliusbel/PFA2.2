import { useState, useMemo, useRef, useEffect } from 'react';
import { AssetMasterRecord } from '../../types';
import { Search, Monitor, RefreshCw } from 'lucide-react';

interface AssetMasterViewProps {
    data: AssetMasterRecord[];
    onRefresh?: () => void;
}

export const AssetMasterView: React.FC<AssetMasterViewProps> = ({ data, onRefresh }) => {
    const [search, setSearch] = useState('');
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);

    const filtered = useMemo(() => data.filter(r =>
        String(r.assetCode || r.assetTag || '').toLowerCase().includes(search.toLowerCase()) ||
        String(r.description || '').toLowerCase().includes(search.toLowerCase()) ||
        String(r.model || '').toLowerCase().includes(search.toLowerCase()) ||
        String(r.serialNumber || '').toLowerCase().includes(search.toLowerCase())
    ), [data, search]);

    // Stats for summary bar
    const stats = useMemo(() => {
        const inUse = data.filter(r => r.equipmentStatus === 'In Use' || r.equipmentStatus === 'IN USE').length;
        const available = data.filter(r => r.equipmentStatus === 'Available' || r.equipmentStatus === 'AVAILABLE').length;
        const outOfService = data.filter(r => r.outOfService).length;
        const owned = data.filter(r => r.source === 'OWNED').length;
        const thirdParty = data.filter(r => r.source === 'THIRD PARTY').length;
        return { inUse, available, outOfService, owned, thirdParty };
    }, [data]);

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
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Monitor className="w-8 h-8 text-blue-500" />
                    <div>
                        <h2 className="text-2xl font-bold text-slate-100">Asset Master</h2>
                        <p className="text-sm text-slate-400 mt-1">
                            Equipment assets available in the system
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search assets..."
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
                    <Monitor className="w-5 h-5 text-blue-400" />
                    <span className="font-semibold">
                        Total Assets: <span className="text-blue-400">{data.length}</span>
                    </span>
                    <span className="mx-2 text-slate-600">|</span>
                    <span className="font-semibold">
                        In Use: <span className="text-green-400">{stats.inUse}</span>
                    </span>
                    <span className="mx-2 text-slate-600">|</span>
                    <span className="font-semibold">
                        Available: <span className="text-cyan-400">{stats.available}</span>
                    </span>
                    <span className="mx-2 text-slate-600">|</span>
                    <span className="font-semibold">
                        Out of Service: <span className="text-yellow-400">{stats.outOfService}</span>
                    </span>
                    <span className="mx-2 text-slate-600">|</span>
                    <span className="font-semibold">
                        Owned: <span className="text-emerald-400">{stats.owned}</span>
                    </span>
                    <span className="mx-2 text-slate-600">|</span>
                    <span className="font-semibold">
                        Third Party: <span className="text-orange-400">{stats.thirdParty}</span>
                    </span>
                </div>
            </div>

            {/* Assets Table */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto h-[calc(100vh-320px)]" ref={scrollContainerRef} onScroll={handleScroll}>
                    {/* Sticky Header */}
                    <table className="w-full text-left text-sm whitespace-nowrap sticky top-0 z-20 bg-slate-900 border-b border-slate-700">
                        <thead>
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[120px]">Asset Tag</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[250px]">Description</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[120px]">Org</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[100px]">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[100px]">Dept</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[100px]">Class</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[120px]">Category</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[100px]">Source</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[100px]">Make</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[100px]">Model</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[120px]">Serial</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[110px]">Comm. Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[120px]">Assigned To</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[110px]">On Site</th>
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
                                <col style={{width: 120}} />
                                <col style={{width: 100}} />
                                <col style={{width: 100}} />
                                <col style={{width: 100}} />
                                <col style={{width: 120}} />
                                <col style={{width: 100}} />
                                <col style={{width: 100}} />
                                <col style={{width: 100}} />
                                <col style={{width: 120}} />
                                <col style={{width: 110}} />
                                <col style={{width: 120}} />
                                <col style={{width: 110}} />
                            </colgroup>
                            <tbody className="divide-y divide-slate-700">
                                {visibleRows.map((record, idx) => (
                                    <tr key={record.id || idx} className="hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-100 truncate">{record.assetCode || record.assetTag}</td>
                                        <td className="px-6 py-4 text-slate-300 truncate" title={record.description || ''}>{record.description}</td>
                                        <td className="px-6 py-4 text-slate-300 truncate">{record.organization || record.organizationId}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                record.equipmentStatus === 'In Use' || record.equipmentStatus === 'IN USE'
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : record.equipmentStatus === 'Available' || record.equipmentStatus === 'AVAILABLE'
                                                    ? 'bg-cyan-500/20 text-cyan-400'
                                                    : record.outOfService
                                                    ? 'bg-yellow-500/20 text-yellow-400'
                                                    : 'bg-slate-600 text-slate-300'
                                            }`}>
                                                {record.equipmentStatus || (record.outOfService ? 'Out of Service' : '-')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-300 truncate">{record.department}</td>
                                        <td className="px-6 py-4 text-slate-300 truncate">{record.class}</td>
                                        <td className="px-6 py-4 text-slate-300 truncate">{record.category}</td>
                                        <td className="px-6 py-4">
                                            <span className={`text-xs ${record.source === 'OWNED' ? 'text-emerald-400' : 'text-orange-400'}`}>
                                                {record.source || '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-300 truncate">{record.manufacturer}</td>
                                        <td className="px-6 py-4 text-slate-300 truncate">{record.model}</td>
                                        <td className="px-6 py-4 text-slate-300 font-mono truncate">{record.serialNumber || '-'}</td>
                                        <td className="px-6 py-4 text-right text-slate-300 font-mono truncate">{record.commissionDate ? new Date(record.commissionDate).toLocaleDateString() : '-'}</td>
                                        <td className="px-6 py-4 text-slate-300 truncate">{record.assignedTo}</td>
                                        <td className="px-6 py-4 text-right text-slate-300 font-mono truncate">{record.onSiteDate ? new Date(record.onSiteDate).toLocaleDateString() : '-'}</td>
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
