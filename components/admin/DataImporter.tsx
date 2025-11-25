
import React, { useState } from 'react';
import { FileSpreadsheet, Monitor, ShieldCheck, Database, Download, FileUp, Users, Building2, Link2, FileDown, TrendingDown, CheckCircle } from 'lucide-react';
import { DataExchangeConfig, DataCategory, Asset } from '../../types';
import { generateMockData } from '../../mockData';
import { formatDate } from '../../utils';

interface DataImporterProps {
  onImportExcel: (file: File, type: string) => Promise<void> | void;
  config: DataExchangeConfig; 
  assets?: Asset[];
}

export const DataImporter: React.FC<DataImporterProps> = ({ onImportExcel, config, assets }) => {
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
      const file = e.target.files?.[0];
      if (file) {
          if (!file.name.toLowerCase().endsWith('.csv')) {
              alert("Please select a valid CSV file.");
              return;
          }
          setProcessingId(type);
          
          // Use simple timeout to clear in case it's synchronous, or await if async
          try {
              await onImportExcel(file, type);
          } finally {
              setProcessingId(null);
              e.target.value = ''; // Reset input
          }
      }
  };

  // Generate Real CSV Content based on Config
  const generateCSV = (category: DataCategory) => {
      const fields = config.fields[category];
      if (!fields || fields.length === 0) return null;

      const enabledFields = fields.filter(f => f.enabled);
      
      // Header Row (Uses Field Label or API Map if available)
      const headers = enabledFields.map(f => f.apiMap || f.label).join(',');

      // Use passed assets or fall back to mock data if not provided
      const dataToExport = assets || generateMockData(50);
      
      const rows = dataToExport.map(asset => {
          return enabledFields.map(f => {
              if (!f.internalKey) return '';
              
              let val = asset[f.internalKey];
              
              // Format Dates
              if (val instanceof Date) {
                  return formatDate(val);
              }
              
              // Format Booleans to 1/0
              if (typeof val === 'boolean') {
                  return val ? '1' : '0';
              }

              // Handle null/undefined
              if (val === undefined || val === null) return '';

              // Escape commas in strings
              const strVal = String(val);
              if (strVal.includes(',')) return `"${strVal}"`;
              
              return strVal;
          }).join(',');
      });

      return [headers, ...rows].join('\n');
  };

  const handleExport = (type: DataCategory) => {
      setProcessingId(type);
      setTimeout(() => {
           const csvContent = generateCSV(type);
           
           if (csvContent) {
               const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
               const url = URL.createObjectURL(blob);
               const link = document.createElement("a");
               link.setAttribute("href", url);
               link.setAttribute("download", `${type}_${new Date().toISOString().split('T')[0]}.csv`);
               document.body.appendChild(link);
               link.click();
               document.body.removeChild(link);
           } else {
               alert(`Configuration missing for ${type}. Please configure fields first.`);
           }
           setProcessingId(null);
      }, 1000);
  };

  const downloadTemplate = (category: DataCategory) => {
      const fields = config.fields[category];
      if (!fields) {
          alert("No fields configured for this template.");
          return;
      }
      
      // Headers only
      const header = fields.filter(f => f.enabled).map(f => f.apiMap || f.label).join(',');
      const csvContent = "data:text/csv;charset=utf-8," + header + "\n";
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${category}_template.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const ActionCard = ({ 
      title, 
      desc, 
      icon: Icon, 
      type, 
      actionType,
      colorClass, 
      bgClass, 
      borderClass 
  }: { 
      title: string, desc: string, icon: any, type: DataCategory, actionType: 'import' | 'export', colorClass: string, bgClass: string, borderClass: string 
  }) => (
      <div className="relative flex flex-col h-full">
        <div className={`border-2 ${actionType === 'import' ? 'border-dashed' : 'border-solid'} ${borderClass} dark:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-all group relative cursor-pointer flex-1`}>
                <div className={`p-3 ${bgClass} rounded-full mb-3 ${colorClass} group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-1">{title}</h4>
                <p className="text-[10px] text-slate-400 mb-4 leading-tight">{desc}</p>
                
                {processingId === type ? (
                    <div className={`px-3 py-1.5 ${bgClass} rounded-lg text-xs ${colorClass} font-bold animate-pulse flex items-center gap-2`}>
                        <div className={`w-1.5 h-1.5 ${colorClass.replace('text', 'bg')} rounded-full animate-bounce`}></div>
                        Processing...
                    </div>
                ) : (
                    <div className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${actionType === 'import' ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-700' : `${bgClass} ${colorClass}`}`}>
                        {actionType === 'import' ? <><FileUp className="w-3 h-3" /> Select CSV</> : <><Download className="w-3 h-3" /> Download CSV</>}
                    </div>
                )}
                
                {actionType === 'import' ? (
                     <input 
                        type="file" 
                        accept=".csv"
                        disabled={!!processingId}
                        onChange={(e) => handleImport(e, type)}
                        className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                ) : (
                    <button 
                        onClick={() => handleExport(type)}
                        disabled={!!processingId}
                        className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                )}
        </div>
        {actionType === 'import' && (
            <button 
                onClick={() => downloadTemplate(type)}
                className={`mt-2 w-full py-1.5 flex items-center justify-center gap-2 text-[10px] font-bold ${colorClass} hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors opacity-60 hover:opacity-100`}
            >
                <Download className="w-3 h-3" /> Template
            </button>
        )}
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-4">
            <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Database className="w-5 h-5" /> Manual Data Import & Export
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Manage bulk data operations manually. Import CSVs or download reports.
                </p>
            </div>
        </div>
        
        {/* Export Section */}
        <div>
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileDown className="w-4 h-4" /> Export Data
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
                <ActionCard 
                    title="Forecast Changes" 
                    desc="Export current forecast state including quantities and costs."
                    icon={FileSpreadsheet}
                    type="forecast_export"
                    actionType="export"
                    colorClass="text-blue-600 dark:text-blue-400"
                    bgClass="bg-blue-100 dark:bg-blue-900/30"
                    borderClass="border-blue-200 hover:border-blue-400"
                />
                <ActionCard 
                    title="Actual Changes" 
                    desc="Export incurred costs and actual utilization data."
                    icon={TrendingDown}
                    type="actuals_export"
                    actionType="export"
                    colorClass="text-orange-600 dark:text-orange-400"
                    bgClass="bg-orange-100 dark:bg-orange-900/30"
                    borderClass="border-orange-200 hover:border-orange-400"
                />
            </div>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800"></div>

        {/* Import Section */}
        <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileUp className="w-4 h-4" /> Import Data
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                
                <ActionCard 
                    title="PFA / Ledger Import" 
                    desc="Financial Approvals & Initial Plans"
                    icon={ShieldCheck}
                    type="pfa_import"
                    actionType="import"
                    colorClass="text-emerald-600 dark:text-emerald-400"
                    bgClass="bg-emerald-100 dark:bg-emerald-900/30"
                    borderClass="border-slate-300 hover:border-emerald-400"
                />

                <ActionCard 
                    title="Assets Master" 
                    desc="Equipment & Vehicles"
                    icon={Monitor}
                    type="assets_import"
                    actionType="import"
                    colorClass="text-blue-600 dark:text-blue-400"
                    bgClass="bg-blue-100 dark:bg-blue-900/30"
                    borderClass="border-slate-300 hover:border-blue-400"
                />

                <ActionCard 
                    title="Class & Category" 
                    desc="Hierarchy Definitions"
                    icon={FileSpreadsheet}
                    type="class_cat_import"
                    actionType="import"
                    colorClass="text-amber-600 dark:text-amber-400"
                    bgClass="bg-amber-100 dark:bg-amber-900/30"
                    borderClass="border-slate-300 hover:border-amber-400"
                />

                <ActionCard 
                    title="Users" 
                    desc="System User Accounts"
                    icon={Users}
                    type="users_import"
                    actionType="import"
                    colorClass="text-violet-600 dark:text-violet-400"
                    bgClass="bg-violet-100 dark:bg-violet-900/30"
                    borderClass="border-slate-300 hover:border-violet-400"
                />

                <ActionCard 
                    title="Organizations" 
                    desc="Business Entities"
                    icon={Building2}
                    type="orgs_import"
                    actionType="import"
                    colorClass="text-cyan-600 dark:text-cyan-400"
                    bgClass="bg-cyan-100 dark:bg-cyan-900/30"
                    borderClass="border-slate-300 hover:border-cyan-400"
                />

                <ActionCard 
                    title="User-Org Links" 
                    desc="Access Assignments"
                    icon={Link2}
                    type="user_orgs_import"
                    actionType="import"
                    colorClass="text-rose-600 dark:text-rose-400"
                    bgClass="bg-rose-100 dark:bg-rose-900/30"
                    borderClass="border-slate-300 hover:border-rose-400"
                />

            </div>
        </div>
    </div>
  );
};
