
import React, { useState } from 'react';
import { ApiConfig, ApiUsage, Organization, FeedFrequency, DataCategory, ApiFeedConfig } from '../../types';
import { Plug, Activity, XCircle, Plus, Trash2, RefreshCw, ArrowRight, Database, Cpu, Layers, Users, Server, Lock, Shield, Globe, PlusCircle } from 'lucide-react';

interface ApiManagerProps {
  apis: ApiConfig[];
  setApis: React.Dispatch<React.SetStateAction<ApiConfig[]>>;
  orgs?: Organization[];
}

const USAGE_TYPES: { id: ApiUsage, label: string, icon: any }[] = [
    { id: 'PFA', label: 'PFA Ledger Data', icon: Database },
    { id: 'Assets', label: 'Asset Master', icon: Server },
    { id: 'Classes', label: 'Class & Category', icon: Layers },
    { id: 'AI', label: 'AI Provider (LLM)', icon: Cpu },
    { id: 'Users', label: 'User Directory', icon: Users },
];

const FREQUENCIES: { id: FeedFrequency, label: string }[] = [
    { id: 'manual', label: 'Manual Only' },
    { id: 'realtime', label: 'Real-Time / Push' },
    { id: '15min', label: 'Every 15 Minutes' },
    { id: 'hourly', label: 'Hourly' },
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
];

const DATA_CATEGORIES: { id: DataCategory, label: string }[] = [
    { id: 'pfa_import', label: 'PFA Ledger' },
    { id: 'assets_import', label: 'Asset Master' },
    { id: 'class_cat_import', label: 'Class/Category' },
    { id: 'users_import', label: 'Users' },
    { id: 'orgs_import', label: 'Organizations' },
    { id: 'user_orgs_import', label: 'User-Org Links' },
];

export const ApiManager: React.FC<ApiManagerProps> = ({ apis, setApis, orgs: _orgs = [] }) => {
  const [editingApi, setEditingApi] = useState<Partial<ApiConfig> | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleSave = () => {
    if (editingApi && editingApi.name) {
        const apiToSave = {
            ...editingApi,
            feeds: editingApi.feeds || [],
            status: editingApi.status || 'untested'
        } as ApiConfig;

        if (editingApi.id) {
            setApis(apis.map(a => a.id === editingApi.id ? apiToSave : a));
        } else {
            setApis([...apis, { ...apiToSave, id: `api-${Date.now()}` }]);
        }
        setEditingApi(null);
    }
  };

  const handleDelete = (id: string) => {
      setApis(apis.filter(a => a.id !== id));
  };

  const addFeed = () => {
      if (editingApi) {
          setEditingApi({
              ...editingApi,
              feeds: [...(editingApi.feeds || []), { category: 'pfa_import', frequency: 'manual' }]
          });
      }
  };

  const updateFeed = (index: number, updates: Partial<ApiFeedConfig>) => {
      if (editingApi && editingApi.feeds) {
          const newFeeds = [...editingApi.feeds];
          newFeeds[index] = { ...newFeeds[index], ...updates };
          setEditingApi({ ...editingApi, feeds: newFeeds });
      }
  };

  const removeFeed = (index: number) => {
      if (editingApi && editingApi.feeds) {
          const newFeeds = [...editingApi.feeds];
          newFeeds.splice(index, 1);
          setEditingApi({ ...editingApi, feeds: newFeeds });
      }
  };

  // Custom Header Management
  const addHeader = () => {
      if (editingApi) {
          setEditingApi({
              ...editingApi,
              customHeaders: [...(editingApi.customHeaders || []), { key: '', value: '' }]
          });
      }
  };

  const updateHeader = (index: number, field: 'key' | 'value', val: string) => {
      if (editingApi && editingApi.customHeaders) {
          const newHeaders = [...editingApi.customHeaders];
          newHeaders[index] = { ...newHeaders[index], [field]: val };
          setEditingApi({ ...editingApi, customHeaders: newHeaders });
      }
  };

  const removeHeader = (index: number) => {
      if (editingApi && editingApi.customHeaders) {
          const newHeaders = [...editingApi.customHeaders];
          newHeaders.splice(index, 1);
          setEditingApi({ ...editingApi, customHeaders: newHeaders });
      }
  };

  const handleTest = async (api: ApiConfig) => {
      const target = api.usage === 'AI' ? `${api.provider} (${api.model})` : api.url;
      setTestResult(`Testing connection to ${target}...`);
      setTimeout(() => {
          const success = Math.random() > 0.3;
          if (success) {
             setTestResult(JSON.stringify({ status: 200, ok: true, data: { connected: true, timestamp: new Date(), tenant: api.tenantId } }, null, 2));
             setApis(prev => prev.map(a => a.id === api.id ? { ...a, status: 'connected', lastChecked: new Date(), lastResponse: '200 OK' } : a));
          } else {
              setTestResult(`Error: Connection timeout or 401 Unauthorized.`);
              setApis(prev => prev.map(a => a.id === api.id ? { ...a, status: 'error', lastChecked: new Date() } : a));
          }
      }, 1500);
  };

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Plug className="w-5 h-5" /> API Connectivity
            </h2>
            <button 
                onClick={() => setEditingApi({ usage: 'PFA', status: 'untested', feeds: [], authType: 'none', customHeaders: [] })}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-600/20 transition-all"
            >
                <Plus className="w-4 h-4" /> Add Endpoint
            </button>
        </div>

        {/* List */}
        <div className="grid grid-cols-1 gap-4">
            {apis.map(api => (
                <div 
                    key={api.id} 
                    onDoubleClick={() => setEditingApi(api)}
                    className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                >
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${api.status === 'connected' ? 'bg-emerald-100 text-emerald-600' : api.status === 'error' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                            <Activity className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-800 dark:text-white">{api.name}</h3>
                                <span className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded font-bold border border-blue-100 dark:border-blue-800">
                                    {api.usage}
                                </span>
                                {api.authType !== 'none' && <Lock className="w-3 h-3 text-slate-400" />}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                <span className="font-mono">{api.url || 'No URL'}</span>
                                {api.feeds && api.feeds.length > 0 && (
                                    <>
                                        <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                                        <span>{api.feeds.length} Active Feeds</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleTest(api); }} 
                            className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-400 hover:text-blue-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100" 
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(api.id); }} 
                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100" 
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}
        </div>

        {/* Test Console */}
        {testResult && (
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 shadow-lg mt-6 font-mono text-xs text-green-400 overflow-auto max-h-40">
                <div className="flex justify-between border-b border-slate-800 pb-2 mb-2">
                     <span>Console Output</span>
                     <button onClick={() => setTestResult(null)} className="text-slate-500 hover:text-white"><XCircle className="w-3 h-3"/></button>
                </div>
                <pre>{testResult}</pre>
            </div>
        )}

        {/* Edit Modal */}
        {editingApi && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl p-6 border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                    <div className="flex-none mb-4">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">{editingApi.id ? 'Edit API Connection' : 'New API Connection'}</h3>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
                        {/* Basic Config */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Connection Name</label>
                                <input 
                                    type="text" 
                                    value={editingApi.name || ''} 
                                    onChange={e => setEditingApi({...editingApi, name: e.target.value})}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-white"
                                    placeholder="e.g., ERP Production"
                                />
                            </div>
                            
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Primary Usage</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {USAGE_TYPES.map(usage => {
                                        const Icon = usage.icon;
                                        const isSelected = editingApi.usage === usage.id;
                                        return (
                                            <button
                                                key={usage.id}
                                                onClick={() => setEditingApi({...editingApi, usage: usage.id})}
                                                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${isSelected ? 'bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-500' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                            >
                                                <Icon className="w-5 h-5 mb-1" />
                                                <span className="text-xs font-bold">{usage.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Endpoint URL / Provider</label>
                                <input 
                                    type="text" 
                                    value={editingApi.url || ''} 
                                    onChange={e => setEditingApi({...editingApi, url: e.target.value})}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder={editingApi.usage === 'AI' ? "Provider Name (e.g., Google Gemini)" : "https://api.example.com/v1"}
                                />
                            </div>
                        </div>

                        <div className="h-px bg-slate-100 dark:bg-slate-800"></div>

                        {/* Auth & Security */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                                <Shield className="w-4 h-4" /> Security & Authentication
                            </h4>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Auth Type</label>
                                    <select
                                        value={editingApi.authType || 'none'}
                                        onChange={(e) => setEditingApi({...editingApi, authType: e.target.value as any})}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="none">None (Public)</option>
                                        <option value="basic">Basic Auth (User/Pass)</option>
                                        <option value="bearer">Bearer Token</option>
                                        <option value="apiKey">API Key</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Tenant ID (Optional)</label>
                                    <input 
                                        type="text" 
                                        value={editingApi.tenantId || ''}
                                        onChange={(e) => setEditingApi({...editingApi, tenantId: e.target.value})}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="EAM_TENANT_1"
                                    />
                                </div>
                            </div>

                            {editingApi.authType !== 'none' && (
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                    <div className={editingApi.authType === 'bearer' ? 'hidden' : ''}>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1">
                                            {editingApi.authType === 'apiKey' ? 'Key Name (Header)' : 'Username / Client ID'}
                                        </label>
                                        <input 
                                            type="text" 
                                            value={editingApi.authKey || ''}
                                            onChange={(e) => setEditingApi({...editingApi, authKey: e.target.value})}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg p-2 text-sm outline-none"
                                            placeholder={editingApi.authType === 'apiKey' ? 'x-api-key' : 'username'}
                                        />
                                    </div>
                                    <div className={editingApi.authType === 'bearer' ? 'col-span-2' : ''}>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1">
                                            {editingApi.authType === 'apiKey' ? 'Key Value' : editingApi.authType === 'bearer' ? 'Token' : 'Password / Secret'}
                                        </label>
                                        <input 
                                            type="password" 
                                            value={editingApi.authValue || ''}
                                            onChange={(e) => setEditingApi({...editingApi, authValue: e.target.value})}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg p-2 text-sm outline-none font-mono"
                                            placeholder="••••••••••••"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Custom Headers */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-[10px] font-bold text-slate-400">Custom Headers</label>
                                    <button onClick={addHeader} className="text-[10px] text-blue-500 hover:text-blue-400 font-bold flex items-center gap-1">
                                        <PlusCircle className="w-3 h-3" /> Add
                                    </button>
                                </div>
                                {editingApi.customHeaders?.map((header, idx) => (
                                    <div key={idx} className="flex gap-2 mb-2">
                                        <input 
                                            placeholder="Header-Name"
                                            value={header.key}
                                            onChange={(e) => updateHeader(idx, 'key', e.target.value)}
                                            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs"
                                        />
                                        <input 
                                            placeholder="Value"
                                            value={header.value}
                                            onChange={(e) => updateHeader(idx, 'value', e.target.value)}
                                            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs"
                                        />
                                        <button onClick={() => removeHeader(idx)} className="text-slate-400 hover:text-red-500"><XCircle className="w-4 h-4" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="h-px bg-slate-100 dark:bg-slate-800"></div>

                        {/* Data Feeds */}
                        <div>
                             <div className="flex justify-between items-center mb-3">
                                <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                                    <Globe className="w-4 h-4" /> Data Feeds & Frequency
                                </h4>
                                <button onClick={addFeed} className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                    <Plus className="w-3 h-3" /> Add Feed
                                </button>
                             </div>
                             
                             <div className="space-y-3">
                                 {editingApi.feeds?.map((feed, idx) => (
                                     <div key={idx} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                         <div className="flex-1">
                                             <label className="text-[10px] font-bold text-slate-400 block mb-1">Data Category</label>
                                             <select 
                                                 value={feed.category}
                                                 onChange={(e) => updateFeed(idx, { category: e.target.value as DataCategory })}
                                                 className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-xs px-2 py-1.5 text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                                             >
                                                 {DATA_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                             </select>
                                         </div>
                                         <div className="flex-none flex items-center justify-center pt-5">
                                             <ArrowRight className="w-4 h-4 text-slate-400" />
                                         </div>
                                         <div className="flex-1">
                                             <label className="text-[10px] font-bold text-slate-400 block mb-1">Update Frequency</label>
                                             <select 
                                                 value={feed.frequency}
                                                 onChange={(e) => updateFeed(idx, { frequency: e.target.value as FeedFrequency })}
                                                 className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-xs px-2 py-1.5 text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                                             >
                                                 {FREQUENCIES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                             </select>
                                         </div>
                                         <div className="flex-none pt-5">
                                             <button onClick={() => removeFeed(idx)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                                 <Trash2 className="w-4 h-4" />
                                             </button>
                                         </div>
                                     </div>
                                 ))}
                                 {(!editingApi.feeds || editingApi.feeds.length === 0) && (
                                     <div className="text-center py-6 text-slate-400 italic text-sm bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                                         No data feeds configured. Add a feed to pull data from this API.
                                     </div>
                                 )}
                             </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button onClick={() => setEditingApi(null)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">Cancel</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-600/20 transition-all">Save API</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
