
import React, { useState, useMemo } from 'react';
import { Organization, ApiConfig } from '../../types';
import { Building2, Plus, Trash2, Edit2, Upload, Search, Power, CloudLightning, Download, Image as ImageIcon, Link2, Cpu, Sparkles, Loader2 } from 'lucide-react';

interface OrgManagerProps {
  orgs: Organization[];
  setOrgs: React.Dispatch<React.SetStateAction<Organization[]>>;
  availableAiApis?: ApiConfig[];
  onGenerateAiLogo?: (context: string) => Promise<string | null>;
}

export const OrgManager: React.FC<OrgManagerProps> = ({ orgs, setOrgs, availableAiApis = [], onGenerateAiLogo }) => {
  const [editingOrg, setEditingOrg] = useState<Partial<Organization> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [logoInputType, setLogoInputType] = useState<'file' | 'url'>('url');
  const [isGeneratingLogo, setIsGeneratingLogo] = useState(false);

  const filteredOrgs = useMemo(() => {
      return orgs.filter(o => 
          (o.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
          (o.id || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [orgs, searchQuery]);

  const handleSave = () => {
      if (editingOrg && editingOrg.name) {
          const orgToSave = {
               ...editingOrg, 
               status: editingOrg.status || 'active',
               aiRules: editingOrg.aiRules || [],
               submitMode: editingOrg.submitMode || 'api',
               features: editingOrg.features || { ai: false, aiAccessLevel: 'full-access', aiIconGeneration: false },
               permissions: editingOrg.permissions || { viewTimeline: true, viewMatrix: true, viewGrid: true, canExport: true },
               headerConfig: editingOrg.headerConfig || { showLogo: true, showId: true, showName: false, showDescription: false }
          } as Organization;

          if (!orgToSave.id) {
              orgToSave.id = `org-${Date.now()}`;
          }

          const existingIndex = orgs.findIndex(o => o.id === orgToSave.id);
          if (existingIndex >= 0) {
              const updated = [...orgs];
              updated[existingIndex] = orgToSave;
              setOrgs(updated);
          } else {
              if (orgs.some(o => o.id === orgToSave.id)) {
                  alert(`Organization ID '${orgToSave.id}' already exists. Please choose another.`);
                  return;
              }
              setOrgs([...orgs, orgToSave]);
          }
          setEditingOrg(null);
      }
  };

  const handleDelete = (id: string) => {
    if(window.confirm("Are you sure you want to remove this organization? This action cannot be undone.")) {
        setOrgs(orgs.filter(o => o.id !== id));
    }
  }

  const toggleStatus = (org: Organization) => {
      const newStatus = org.status === 'active' ? 'out_of_service' : 'active';
      setOrgs(orgs.map(o => o.id === org.id ? { ...o, status: newStatus } : o));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingOrg) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setEditingOrg({ ...editingOrg, logoUrl: reader.result as string });
        };
        reader.readAsDataURL(file);
    }
  };

  const handleGenerateLogo = async () => {
      if (!onGenerateAiLogo || !editingOrg?.name) return;
      setIsGeneratingLogo(true);
      const context = `${editingOrg.id || ''} ${editingOrg.name} ${editingOrg.description || ''}`;
      const url = await onGenerateAiLogo(context);
      if (url) {
          setEditingOrg(prev => ({ ...prev, logoUrl: url }));
      }
      setIsGeneratingLogo(false);
  };

  const isEditingExisting = editingOrg && orgs.some(o => o.id === editingOrg.id);

  return (
    <div className="space-y-6">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                    Organization Management
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Search, view, and manage system organizations.</p>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
                 <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search organizations..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-white"
                    />
                 </div>
                <button 
                    onClick={() => setEditingOrg({ status: 'active', aiRules: [], submitMode: 'api', features: { ai: false, aiAccessLevel: 'full-access', aiIconGeneration: false }, permissions: { viewTimeline: true, viewMatrix: true, viewGrid: true, canExport: true }, headerConfig: { showLogo: true, showId: true, showName: false, showDescription: false } })}
                    className="flex-none flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-600/20 transition-all"
                >
                    <Plus className="w-4 h-4" /> New
                </button>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                        <th className="px-6 py-3 font-bold text-slate-500 uppercase text-xs">Organization</th>
                        <th className="px-6 py-3 font-bold text-slate-500 uppercase text-xs">ID</th>
                        <th className="px-6 py-3 font-bold text-slate-500 uppercase text-xs">Status</th>
                         <th className="px-6 py-3 font-bold text-slate-500 uppercase text-xs">Mode</th>
                        <th className="px-6 py-3 font-bold text-slate-500 uppercase text-xs text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredOrgs.map(org => {
                        const isOutOfService = org.status === 'out_of_service';
                        return (
                            <tr 
                                key={org.id} 
                                onDoubleClick={() => setEditingOrg(org)}
                                className={`group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer ${isOutOfService ? 'bg-slate-50/50 dark:bg-slate-800/50' : ''}`}
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 flex items-center justify-center p-0.5 overflow-hidden flex-none ${isOutOfService ? 'grayscale opacity-50' : ''}`}>
                                            {org.logoUrl ? (
                                                <img src={org.logoUrl} alt={org.name} className="w-full h-full object-contain" />
                                            ) : (
                                                <Building2 className={`w-6 h-6 ${isOutOfService ? 'text-slate-300' : 'text-slate-400'}`} />
                                            )}
                                        </div>
                                        <div className="min-w-0 max-w-xs">
                                            <div className={`font-bold truncate ${isOutOfService ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-white'}`}>{org.name}</div>
                                            <div className="text-xs text-slate-400 truncate">{org.description || 'No description provided'}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-mono text-xs text-slate-500">
                                    {org.id}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                        isOutOfService 
                                        ? 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600' 
                                        : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                                    }`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${isOutOfService ? 'bg-slate-400' : 'bg-emerald-500'}`}></div>
                                        {isOutOfService ? 'Out of Service' : 'Active'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-xs font-mono text-slate-600 dark:text-slate-400 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                        {org.submitMode || 'API'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                        <button 
                                            onClick={() => toggleStatus(org)}
                                            className={`p-1.5 rounded-lg transition-colors ${isOutOfService ? 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                                            title={isOutOfService ? "Enable Service" : "Disable Service"}
                                        >
                                            <Power className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => setEditingOrg(org)}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                            title="Edit"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(org.id)}
                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    {filteredOrgs.length === 0 && (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic bg-slate-50/30">
                                No organizations found matching your search.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

         {editingOrg && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{isEditingExisting ? 'Edit Organization' : 'New Organization'}</h3>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                        <section>
                            <h4 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-wider">General Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Organization Name</label>
                                    <input 
                                        type="text" 
                                        value={editingOrg.name || ''} 
                                        onChange={e => setEditingOrg({...editingOrg, name: e.target.value})}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-800 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Organization ID</label>
                                    <input 
                                        type="text" 
                                        value={editingOrg.id || ''} 
                                        onChange={e => setEditingOrg({...editingOrg, id: e.target.value})}
                                        disabled={!!isEditingExisting}
                                        placeholder={isEditingExisting ? "ID is Locked" : "Enter Unique ID (e.g. HOLNG)"}
                                        className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none transition-all ${isEditingExisting ? 'text-slate-500 cursor-not-allowed bg-slate-100' : 'text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500'}`}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                     <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Organization Description</label>
                                     <textarea 
                                        value={editingOrg.description || ''}
                                        onChange={e => setEditingOrg({...editingOrg, description: e.target.value})}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm h-24 resize-none focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-800 dark:text-white"
                                        placeholder="Enter a brief description of the organization..."
                                     />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Logo</label>
                                    <div className="flex gap-4">
                                        <div className="flex-1 space-y-3">
                                            <div className="flex gap-2">
                                                <button onClick={() => setLogoInputType('url')} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${logoInputType === 'url' ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white' : 'border-transparent text-slate-400'}`}>URL</button>
                                                <button onClick={() => setLogoInputType('file')} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${logoInputType === 'file' ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white' : 'border-transparent text-slate-400'}`}>Upload</button>
                                                {editingOrg.features?.aiIconGeneration && onGenerateAiLogo && (
                                                    <button 
                                                        onClick={handleGenerateLogo} 
                                                        disabled={isGeneratingLogo || !editingOrg.name}
                                                        className="px-3 py-1.5 text-xs font-bold rounded-lg border border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 flex items-center gap-1"
                                                    >
                                                        {isGeneratingLogo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                                        Generate with AI
                                                    </button>
                                                )}
                                            </div>

                                            {logoInputType === 'url' ? (
                                                <div className="relative">
                                                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                    <input 
                                                        type="text" 
                                                        value={editingOrg.logoUrl || ''}
                                                        onChange={(e) => setEditingOrg({ ...editingOrg, logoUrl: e.target.value })}
                                                        placeholder="https://..."
                                                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white"
                                                    />
                                                </div>
                                            ) : (
                                                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                    <Upload className="w-5 h-5 text-slate-400 mb-1" />
                                                    <span className="text-xs text-slate-500">Choose File</span>
                                                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                                                </label>
                                            )}
                                        </div>
                                        <div className="w-24 h-24 bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden">
                                            {editingOrg.logoUrl ? (
                                                <img src={editingOrg.logoUrl} className="w-full h-full object-contain" alt="Preview" />
                                            ) : (
                                                <ImageIcon className="w-8 h-8 text-slate-200" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                        
                        <div className="h-px bg-slate-100 dark:bg-slate-800"></div>

                         <section>
                             <h4 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-wider">Top Bar Branding</h4>
                             <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                 <p className="text-xs text-slate-500 mb-3">Select what to display in the center of the application header for this organization.</p>
                                 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                     <label className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
                                         <input 
                                            type="checkbox" 
                                            checked={editingOrg.headerConfig?.showLogo ?? true}
                                            onChange={(e) => setEditingOrg({...editingOrg, headerConfig: { ...editingOrg.headerConfig!, showLogo: e.target.checked }})}
                                            className="rounded border-slate-300"
                                         />
                                         <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Logo</span>
                                     </label>
                                     <label className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
                                         <input 
                                            type="checkbox" 
                                            checked={editingOrg.headerConfig?.showName ?? false}
                                            onChange={(e) => setEditingOrg({...editingOrg, headerConfig: { ...editingOrg.headerConfig!, showName: e.target.checked }})}
                                            className="rounded border-slate-300"
                                         />
                                         <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Name</span>
                                     </label>
                                     <label className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
                                         <input 
                                            type="checkbox" 
                                            checked={editingOrg.headerConfig?.showId ?? true}
                                            onChange={(e) => setEditingOrg({...editingOrg, headerConfig: { ...editingOrg.headerConfig!, showId: e.target.checked }})}
                                            className="rounded border-slate-300"
                                         />
                                         <span className="text-xs font-bold text-slate-700 dark:text-slate-200">ID</span>
                                     </label>
                                     <label className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
                                         <input 
                                            type="checkbox" 
                                            checked={editingOrg.headerConfig?.showDescription ?? false}
                                            onChange={(e) => setEditingOrg({...editingOrg, headerConfig: { ...editingOrg.headerConfig!, showDescription: e.target.checked }})}
                                            className="rounded border-slate-300"
                                         />
                                         <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Description</span>
                                     </label>
                                 </div>
                             </div>
                         </section>

                        <div className="h-px bg-slate-100 dark:bg-slate-800"></div>

                        <section>
                            <h4 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-wider">Features & AI</h4>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                                    <div className="flex items-center justify-between mb-4">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={editingOrg.features?.ai ?? false}
                                                onChange={e => setEditingOrg({...editingOrg, features: { ...editingOrg.features!, ai: e.target.checked }})}
                                                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-slate-300" 
                                            />
                                            <div>
                                                <span className="text-sm font-bold text-slate-800 dark:text-white block">Enable AI "Side Brain"</span>
                                                <span className="text-xs text-slate-500">Allows users to interact with data via chat and voice.</span>
                                            </div>
                                        </label>
                                    </div>
                                    
                                    {editingOrg.features?.ai && (
                                        <div className="mt-4 pl-8 space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-2">
                                                    <Cpu className="w-3 h-3" /> AI Service Provider
                                                </label>
                                                {availableAiApis.length > 0 ? (
                                                    <select
                                                        value={editingOrg.aiConnectionId || ''}
                                                        onChange={(e) => setEditingOrg({...editingOrg, aiConnectionId: e.target.value})}
                                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                    >
                                                        <option value="">-- Select AI API --</option>
                                                        {availableAiApis.map(api => (
                                                            <option key={api.id} value={api.id}>{api.name} ({api.provider})</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                                                        No AI APIs configured. Please set up an AI connection in API Connectivity first.
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <label className="flex items-center gap-2 cursor-pointer mb-2">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={editingOrg.features?.aiIconGeneration ?? false}
                                                        onChange={e => setEditingOrg({...editingOrg, features: { ...editingOrg.features!, aiIconGeneration: e.target.checked }})}
                                                        className="rounded border-slate-300" 
                                                    />
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Enable AI Icon Generation</span>
                                                </label>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Access Level</label>
                                                <div className="flex gap-3">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input 
                                                            type="radio" 
                                                            name="aiAccess"
                                                            checked={editingOrg.features?.aiAccessLevel === 'full-access'}
                                                            onChange={() => setEditingOrg({...editingOrg, features: { ...editingOrg.features!, aiAccessLevel: 'full-access' }})}
                                                            className="text-blue-600"
                                                        />
                                                        <span className="text-xs text-slate-700 dark:text-slate-300">Full Access (Read & Write)</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input 
                                                            type="radio" 
                                                            name="aiAccess"
                                                            checked={editingOrg.features?.aiAccessLevel === 'read-only'}
                                                            onChange={() => setEditingOrg({...editingOrg, features: { ...editingOrg.features!, aiAccessLevel: 'read-only' }})}
                                                            className="text-blue-600"
                                                        />
                                                        <span className="text-xs text-slate-700 dark:text-slate-300">Read-Only (Q&A Only)</span>
                                                    </label>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                                                    Organization Rules (AI Instructions)
                                                </label>
                                                <textarea 
                                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm h-32 resize-none focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-800 dark:text-white"
                                                    placeholder="e.g., 'Approvals over $10k need VP sign-off', 'Rental is preferred over Purchase for projects under 6 months'."
                                                    value={editingOrg.aiRules?.join('\n') || ''}
                                                    onChange={(e) => setEditingOrg({...editingOrg, aiRules: e.target.value.split('\n')})}
                                                />
                                                <p className="text-[10px] text-slate-400 mt-2">
                                                    Enter one rule per line. The AI will strictly follow these guidelines when answering questions or proposing actions.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        <div className="h-px bg-slate-100 dark:bg-slate-800"></div>

                        <section>
                            <h4 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-wider">Submit Workflow</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Action Mode</label>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setEditingOrg({...editingOrg, submitMode: 'api'})}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold flex flex-col items-center gap-1 border ${editingOrg.submitMode !== 'download' ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400'}`}
                                        >
                                            <CloudLightning className="w-4 h-4" /> Direct API
                                        </button>
                                        <button 
                                            onClick={() => setEditingOrg({...editingOrg, submitMode: 'download'})}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold flex flex-col items-center gap-1 border ${editingOrg.submitMode === 'download' ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400'}`}
                                        >
                                            <Download className="w-4 h-4" /> Download CSV
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2 text-center">
                                        {editingOrg.submitMode === 'download' ? 'Users will download an Excel/CSV file of changes upon submit.' : 'Changes will be sent directly to the configured PEMS API endpoint.'}
                                    </p>
                                </div>
                            </div>
                        </section>
                    </div>

                    <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl">
                        <button onClick={() => setEditingOrg(null)} className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                        <button onClick={handleSave} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20 transition-transform active:scale-95">Save Organization</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
