
import { useState, useMemo, useRef, useEffect } from 'react';
import { ClassificationRecord } from '../../types';
import { Search, Tag, Sparkles, Loader2, Image as ImageIcon, RefreshCw } from 'lucide-react';

interface ClassificationViewProps {
    data: ClassificationRecord[];
    onUpdate?: (recordId: string, updates: Partial<ClassificationRecord>) => void;
    onGenerateAiIcon?: (context: string) => Promise<string | null>;
    onBulkGenerateIcons?: () => void;
    onRefresh?: () => void;
}

export const ClassificationView: React.FC<ClassificationViewProps> = ({ data, onUpdate, onGenerateAiIcon, onBulkGenerateIcons, onRefresh }) => {
    const [search, setSearch] = useState('');
    const [generatingId, setGeneratingId] = useState<string | null>(null);
    const [isBulkGenerating, setIsBulkGenerating] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);

    const filtered = useMemo(() => data.filter(r =>
        String(r.className || '').toLowerCase().includes(search.toLowerCase()) ||
        String(r.categoryName || '').toLowerCase().includes(search.toLowerCase()) ||
        String(r.classId || '').toLowerCase().includes(search.toLowerCase())
    ), [data, search]);

    // Stats for summary bar
    const stats = useMemo(() => {
        const uniqueClasses = new Set(data.map(r => r.classId)).size;
        const uniqueCategories = new Set(data.map(r => r.categoryId)).size;
        const withIcons = data.filter(r => r.iconUrl).length;
        const withoutIcons = data.filter(r => !r.iconUrl).length;
        return { uniqueClasses, uniqueCategories, withIcons, withoutIcons };
    }, [data]);

    // Virtual scroll logic
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
        if (scrollContainerRef.current) setScrollTop(scrollContainerRef.current.scrollTop);
    }, []);

    const handleGenerate = async (record: ClassificationRecord) => {
        if (!onGenerateAiIcon || !onUpdate) return;
        setGeneratingId(record.id);
        const context = `${record.className} ${record.categoryName}`;
        const url = await onGenerateAiIcon(context);
        if (url) {
            onUpdate(record.id, { iconUrl: url });
        }
        setGeneratingId(null);
    };

    const handleBulk = async () => {
        if (!onBulkGenerateIcons) return;
        setIsBulkGenerating(true);
        await onBulkGenerateIcons();
        setIsBulkGenerating(false);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Tag className="w-8 h-8 text-blue-500" />
                    <div>
                        <h2 className="text-2xl font-bold text-slate-100">Class & Category</h2>
                        <p className="text-sm text-slate-400 mt-1">
                            Classification hierarchy for equipment categorization
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {onBulkGenerateIcons && (
                        <button
                            onClick={handleBulk}
                            disabled={isBulkGenerating}
                            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isBulkGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            Generate Icons
                        </button>
                    )}
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search classifications..."
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
                    <Tag className="w-5 h-5 text-blue-400" />
                    <span className="font-semibold">
                        Total Records: <span className="text-blue-400">{data.length}</span>
                    </span>
                    <span className="mx-2 text-slate-600">|</span>
                    <span className="font-semibold">
                        Classes: <span className="text-cyan-400">{stats.uniqueClasses}</span>
                    </span>
                    <span className="mx-2 text-slate-600">|</span>
                    <span className="font-semibold">
                        Categories: <span className="text-emerald-400">{stats.uniqueCategories}</span>
                    </span>
                    <span className="mx-2 text-slate-600">|</span>
                    <span className="font-semibold">
                        With Icons: <span className="text-violet-400">{stats.withIcons}</span>
                    </span>
                    <span className="mx-2 text-slate-600">|</span>
                    <span className="font-semibold">
                        Missing Icons: <span className="text-amber-400">{stats.withoutIcons}</span>
                    </span>
                </div>
            </div>

            {/* Classification Table */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto h-[calc(100vh-320px)]" ref={scrollContainerRef} onScroll={handleScroll}>
                    {/* Sticky Header */}
                    <table className="w-full text-left text-sm whitespace-nowrap sticky top-0 z-20 bg-slate-900 border-b border-slate-700">
                        <thead>
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[60px]">Icon</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[100px]">Class ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[180px]">Class Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[100px]">Category ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[180px]">Category Name</th>
                                {onGenerateAiIcon && <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[80px]">AI Action</th>}
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
                                <col style={{ width: 60 }} />
                                <col style={{ width: 100 }} />
                                <col style={{ width: 180 }} />
                                <col style={{ width: 100 }} />
                                <col style={{ width: 180 }} />
                                {onGenerateAiIcon && <col style={{ width: 80 }} />}
                            </colgroup>
                            <tbody className="divide-y divide-slate-700">
                                {visibleRows.map((record, idx) => (
                                    <tr key={record.id || idx} className="hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-600">
                                                {record.iconUrl ? (
                                                    <img src={record.iconUrl} className="w-full h-full object-cover" alt="Icon" />
                                                ) : (
                                                    <ImageIcon className="w-4 h-4 text-slate-500" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-slate-300">{record.classId}</td>
                                        <td className="px-6 py-4 font-medium text-slate-100">{record.className}</td>
                                        <td className="px-6 py-4 font-mono text-slate-300">{record.categoryId}</td>
                                        <td className="px-6 py-4 text-slate-300">{record.categoryName}</td>
                                        {onGenerateAiIcon && (
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleGenerate(record)}
                                                    disabled={generatingId === record.id}
                                                    className="p-1.5 text-violet-400 hover:bg-violet-500/20 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Generate Icon"
                                                >
                                                    {generatingId === record.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {filtered.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center text-slate-400 italic">No classifications found.</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
