
import React, { useState } from 'react';
import { ClassificationRecord } from '../../types';
import { Search, Tag, Sparkles, Loader2, Image as ImageIcon } from 'lucide-react';

interface ClassificationViewProps {
    data: ClassificationRecord[];
    onUpdate?: (recordId: string, updates: Partial<ClassificationRecord>) => void;
    onGenerateAiIcon?: (context: string) => Promise<string | null>;
    onBulkGenerateIcons?: () => void;
}

export const ClassificationView: React.FC<ClassificationViewProps> = ({ data, onUpdate, onGenerateAiIcon, onBulkGenerateIcons }) => {
    const [search, setSearch] = useState('');
    const [generatingId, setGeneratingId] = useState<string | null>(null);
    const [isBulkGenerating, setIsBulkGenerating] = useState(false);

    const filtered = data.filter(r => 
        String(r.className || '').toLowerCase().includes(search.toLowerCase()) ||
        String(r.categoryName || '').toLowerCase().includes(search.toLowerCase()) ||
        String(r.classId || '').toLowerCase().includes(search.toLowerCase())
    );

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
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Tag className="w-5 h-5" /> Class & Category Master
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Read-only view of the classification hierarchy loaded into the system.
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    {onBulkGenerateIcons && (
                        <button 
                            onClick={handleBulk}
                            disabled={isBulkGenerating}
                            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold shadow-lg shadow-violet-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isBulkGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            Generate Missing Icons
                        </button>
                    )}
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search classifications..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-3 font-bold text-slate-500 uppercase text-xs">Icon</th>
                                <th className="px-6 py-3 font-bold text-slate-500 uppercase text-xs">Class ID</th>
                                <th className="px-6 py-3 font-bold text-slate-500 uppercase text-xs">Class Name</th>
                                <th className="px-6 py-3 font-bold text-slate-500 uppercase text-xs">Category ID</th>
                                <th className="px-6 py-3 font-bold text-slate-500 uppercase text-xs">Category Name</th>
                                {onGenerateAiIcon && <th className="px-6 py-3 font-bold text-slate-500 uppercase text-xs text-right">AI Action</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {filtered.map(record => (
                                <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                    <td className="px-6 py-4">
                                        <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600">
                                            {record.iconUrl ? (
                                                <img src={record.iconUrl} className="w-full h-full object-cover" alt="Icon" />
                                            ) : (
                                                <ImageIcon className="w-4 h-4 text-slate-300" />
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-300">{record.classId}</td>
                                    <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">{record.className}</td>
                                    <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-300">{record.categoryId}</td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{record.categoryName}</td>
                                    {onGenerateAiIcon && (
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => handleGenerate(record)}
                                                disabled={generatingId === record.id}
                                                className="p-1.5 text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/20 rounded-lg transition-colors disabled:opacity-50"
                                                title="Generate Icon"
                                            >
                                                {generatingId === record.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic">No records found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
