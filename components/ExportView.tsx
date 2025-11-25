
import React, { useState } from 'react';
import { DataExchangeConfig, Asset, DataCategory } from '../types';
import { FileDown, FileSpreadsheet, Download, TrendingDown } from 'lucide-react';

interface ExportViewProps {
  config: DataExchangeConfig;
  assets: Asset[];
  baselineAssets?: Asset[]; // Added for Diff comparison
}

export const ExportView: React.FC<ExportViewProps> = ({ config, assets, baselineAssets = [] }) => {
  const [isExporting, setIsExporting] = useState<string | null>(null);

  // Helper to compare values loosely (handling dates and loose equality)
  const isDifferent = (val1: any, val2: any): boolean => {
      if (val1 instanceof Date && val2 instanceof Date) {
          return val1.getTime() !== val2.getTime();
      }
      return val1 != val2; // Loose equality for numbers/strings match
  };

  const generateCSV = (category: DataCategory, dataToExport: Asset[]) => {
      const fields = config.fields[category];
      if (!fields) return null;

      const enabledFields = fields.filter(f => f.enabled);
      const headers = enabledFields.map(f => f.apiMap || f.label).join(',');

      const rows = dataToExport.map(asset => {
          return enabledFields.map(f => {
              if (!f.internalKey) return '';
              let val = asset[f.internalKey];
              if (val instanceof Date) return val.toISOString().split('T')[0];
              if (typeof val === 'boolean') return val ? '1' : '0';
              if (val === undefined || val === null) return '';
              const strVal = String(val);
              if (strVal.includes(',')) return `"${strVal}"`;
              return strVal;
          }).join(',');
      });

      return [headers, ...rows].join('\n');
  };

  const handleExport = (type: DataCategory) => {
      setIsExporting(type);
      
      setTimeout(() => {
          // 1. Determine Fields to Check based on Config
          const fields = config.fields[type]?.filter(f => f.enabled && f.internalKey);
          if (!fields || fields.length === 0) {
              alert(`Configuration missing for ${type}. Please check Field Configuration.`);
              setIsExporting(null);
              return;
          }

          // 2. Filter Assets: Find changed items
          let changedAssets: Asset[] = [];

          if (baselineAssets.length === 0) {
              // No baseline? Everything is a "change" (or just new)
              changedAssets = assets;
          } else {
              changedAssets = assets.filter(current => {
                  const baseline = baselineAssets.find(b => b.id === current.id);
                  // If new asset (no baseline), it's a change
                  if (!baseline) return true;

                  // Check if ANY configured field matches
                  const hasDiff = fields.some(f => {
                      if (!f.internalKey) return false;
                      return isDifferent(current[f.internalKey], baseline[f.internalKey]);
                  });

                  return hasDiff;
              });
          }

          let finalExportData = changedAssets;
          let filePrefix = `${type}_changes`;

          // 3. User Prompt if Empty
          if (changedAssets.length === 0) {
               const confirmFull = window.confirm("No changes detected based on the current export configuration.\n\nDo you want to export the complete list instead?");
               if (confirmFull) {
                   finalExportData = assets;
                   filePrefix = `${type}_full`;
               } else {
                   setIsExporting(null);
                   return; // Cancel export
               }
          }

          // 4. Generate CSV
          const csvContent = generateCSV(type, finalExportData);
          
          if (csvContent) {
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.setAttribute("href", url);
              link.setAttribute("download", `${filePrefix}_${new Date().toISOString().split('T')[0]}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          }
          
          setIsExporting(null);
      }, 800);
  };

  return (
    <div className="flex flex-col h-full p-8 bg-slate-50 dark:bg-slate-950 overflow-y-auto custom-scrollbar">
        <div className="max-w-5xl mx-auto w-full">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <FileDown className="w-8 h-8 text-blue-600" /> Data Export
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2">
                    Download system data reports. By default, only modified records are exported.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Forecast Export Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col items-center text-center hover:border-blue-500 dark:hover:border-blue-500 transition-colors group">
                    <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                        <FileSpreadsheet className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Forecast Changes</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
                        Export only records where forecast dates, rates, or status flags have changed from baseline.
                    </p>
                    <button 
                        onClick={() => handleExport('forecast_export')}
                        disabled={!!isExporting}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
                    >
                        {isExporting === 'forecast_export' ? 'Analyzing...' : <><Download className="w-4 h-4" /> Export Forecast</>}
                    </button>
                </div>

                {/* Actuals Export Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col items-center text-center hover:border-orange-500 dark:hover:border-orange-500 transition-colors group">
                    <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                        <TrendingDown className="w-10 h-10 text-orange-600 dark:text-orange-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Actual Changes</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
                        Export only records where actual dates, utilization, or equipment assignment have changed.
                    </p>
                    <button 
                        onClick={() => handleExport('actuals_export')}
                        disabled={!!isExporting}
                        className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-400 text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
                    >
                        {isExporting === 'actuals_export' ? 'Analyzing...' : <><Download className="w-4 h-4" /> Export Actuals</>}
                    </button>
                </div>

            </div>
        </div>
    </div>
  );
};
