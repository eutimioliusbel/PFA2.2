
import React, { useState } from 'react';
import { DataExchangeConfig, FieldDefinition, DataCategory, InternalKey } from '../../types';
import { FileDown, FileUp, CheckSquare, Square, Plus, Trash2, AlertCircle, Settings, Link, Database } from 'lucide-react';

interface FieldConfigManagerProps {
  config: DataExchangeConfig;
  setConfig: (c: DataExchangeConfig) => void;
}

const CATEGORIES: { id: DataCategory, label: string, type: 'import' | 'export' }[] = [
    { id: 'forecast_export', label: 'Forecast Changes', type: 'export' },
    { id: 'actuals_export', label: 'Actual Changes', type: 'export' },
    { id: 'pfa_import', label: 'PFA Import', type: 'import' },
    { id: 'assets_import', label: 'Asset Master', type: 'import' },
    { id: 'class_cat_import', label: 'Class & Category', type: 'import' },
    { id: 'users_import', label: 'Users', type: 'import' },
    { id: 'orgs_import', label: 'Organizations', type: 'import' },
    { id: 'user_orgs_import', label: 'User-Org Links', type: 'import' },
];

// Comprehensive list of internal properties for mapping across all data types
const INTERNAL_KEYS: InternalKey[] = [
    // Asset / PFA
    'pfaId', 'organization', 'areaSilo', 'category', 'class', 'source', 'dor', 
    'monthlyRate', 'purchasePrice', 'manufacturer', 'model', 
    'originalStart', 'originalEnd', 'forecastStart', 'forecastEnd', 
    'actualStart', 'actualEnd', 'isActualized', 'isDiscontinued', 'isFundsTransferable', 
    'equipment',
    
    // Asset Master
    'assetTag', 'description', 'year', 'serialNumber',

    // Classification
    'classId', 'className', 'categoryId', 'categoryName',

    // User
    'username', 'email', 'role', 'jobTitle', 'name',

    // Org
    'id', 'status', 'submitMode'
];

export const FieldConfigManager: React.FC<FieldConfigManagerProps> = ({ config, setConfig }) => {
  const [activeCategory, setActiveCategory] = useState<DataCategory>('pfa_import');
  const [newFieldInput, setNewFieldInput] = useState('');
  const [newFieldMap, setNewFieldMap] = useState('');
  const [newInternalKey, setNewInternalKey] = useState<string>('');

  const activeList = config.fields[activeCategory];

  const updateField = (id: string, updates: Partial<FieldDefinition>) => {
      const updatedList = activeList.map(f => f.id === id ? { ...f, ...updates } : f);
      setConfig({
          ...config,
          fields: {
              ...config.fields,
              [activeCategory]: updatedList
          }
      });
  };

  const addField = () => {
      if (!newFieldInput.trim()) return;
      const id = newFieldInput.toLowerCase().replace(/\s+/g, '_');
      
      if (activeList.some(f => f.id === id)) {
          alert('Field ID already exists!');
          return;
      }

      const newField: FieldDefinition = {
          id: id,
          label: newFieldInput,
          apiMap: newFieldMap || undefined,
          internalKey: newInternalKey as any,
          enabled: true,
          isCustom: true
      };
      
      setConfig({
          ...config,
          fields: {
              ...config.fields,
              [activeCategory]: [...activeList, newField]
          }
      });
      setNewFieldInput('');
      setNewFieldMap('');
      setNewInternalKey('');
  };

  const deleteField = (id: string) => {
      if(window.confirm("Remove this field from configuration?")) {
          setConfig({
              ...config,
              fields: {
                  ...config.fields,
                  [activeCategory]: activeList.filter(f => f.id !== id)
              }
          });
      }
  };

  return (
    <div className="flex h-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        
        {/* Sidebar */}
        <div className="w-64 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700 flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Configuration Areas
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
                <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Exports</div>
                {CATEGORIES.filter(c => c.type === 'export').map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`w-full text-left px-4 py-2 text-sm font-medium border-l-4 transition-colors ${activeCategory === cat.id ? 'bg-white dark:bg-slate-800 border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        {cat.label}
                    </button>
                ))}
                
                <div className="px-4 py-2 mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Imports</div>
                {CATEGORIES.filter(c => c.type === 'import').map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`w-full text-left px-4 py-2 text-sm font-medium border-l-4 transition-colors ${activeCategory === cat.id ? 'bg-white dark:bg-slate-800 border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30">
                <div className="flex items-center gap-2 mb-4">
                    {activeCategory.includes('import') ? <FileUp className="w-5 h-5 text-emerald-500" /> : <FileDown className="w-5 h-5 text-blue-500" />}
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                        {CATEGORIES.find(c => c.id === activeCategory)?.label}
                    </h2>
                </div>
                
                {/* Add New Field */}
                <div className="grid grid-cols-3 gap-2">
                    <input 
                        type="text" 
                        value={newFieldInput}
                        onChange={(e) => setNewFieldInput(e.target.value)}
                        placeholder="UI Label (e.g. 'Discontinued')"
                        className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <div className="relative">
                        <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                        <input 
                            type="text" 
                            value={newFieldMap}
                            onChange={(e) => setNewFieldMap(e.target.value)}
                            placeholder="File/API Key (e.g. 'PFA_DIS')"
                            className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                        />
                    </div>
                    <div className="flex gap-2">
                         <div className="relative flex-1">
                            <Database className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                            <select
                                value={newInternalKey}
                                onChange={(e) => setNewInternalKey(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
                            >
                                <option value="">- Internal Prop -</option>
                                {INTERNAL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                        </div>
                        <button 
                            onClick={addField}
                            disabled={!newFieldInput.trim()}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-bold text-sm flex items-center gap-2 transition-colors flex-none"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="space-y-2">
                    {/* Header Row */}
                    <div className="grid grid-cols-12 gap-4 px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <div className="col-span-1 text-center">Active</div>
                        <div className="col-span-3">Field Label</div>
                        <div className="col-span-4">External Key (Header/API)</div>
                        <div className="col-span-3">Internal Property</div>
                        <div className="col-span-1 text-right">Action</div>
                    </div>

                    {activeList.map(field => (
                        <div 
                            key={field.id}
                            className={`grid grid-cols-12 gap-4 items-center p-3 rounded-lg border transition-all ${field.enabled ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm' : 'bg-slate-50 dark:bg-slate-900/50 border-transparent opacity-60'}`}
                        >
                            <div className="col-span-1 flex justify-center">
                                <button onClick={() => updateField(field.id, { enabled: !field.enabled })}>
                                    {field.enabled ? (
                                        <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" /> 
                                    ) : (
                                        <Square className="w-5 h-5 text-slate-300" />
                                    )}
                                </button>
                            </div>
                            
                            <div className="col-span-3">
                                <div className={`text-sm font-bold ${field.enabled ? 'text-slate-800 dark:text-white' : 'text-slate-500'}`}>{field.label}</div>
                                <div className="text-[10px] font-mono text-slate-400">id: {field.id}</div>
                            </div>
                            
                            <div className="col-span-4">
                                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 rounded px-2 py-1">
                                    <Link className="w-3 h-3 text-slate-400 flex-none" />
                                    <input 
                                        type="text"
                                        value={field.apiMap || ''}
                                        onChange={(e) => updateField(field.id, { apiMap: e.target.value })}
                                        placeholder="Unmapped"
                                        className="bg-transparent border-none focus:ring-0 p-0 w-full text-xs font-mono text-slate-600 dark:text-slate-300"
                                    />
                                </div>
                            </div>

                            <div className="col-span-3">
                                <div className="flex items-center gap-2 px-2 py-1">
                                    <Database className="w-3 h-3 text-slate-400 flex-none" />
                                    <select
                                        value={field.internalKey || ''}
                                        onChange={(e) => updateField(field.id, { internalKey: e.target.value as any })}
                                        className="bg-transparent border-b border-slate-200 dark:border-slate-700 focus:border-blue-500 text-xs text-slate-600 dark:text-slate-300 w-full outline-none p-0 appearance-none cursor-pointer hover:text-blue-600"
                                    >
                                        <option value="" className="text-slate-400 italic">-- None --</option>
                                        {INTERNAL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="col-span-1 text-right">
                                {field.isCustom ? (
                                    <button 
                                        onClick={() => deleteField(field.id)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Remove Field"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <span className="text-[10px] text-slate-400 font-medium px-2 bg-slate-100 dark:bg-slate-700 rounded">Sys</span>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {activeList.length === 0 && (
                        <div className="text-center py-12 text-slate-400 flex flex-col items-center">
                            <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                            <p className="text-sm">No fields configured for this category.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};