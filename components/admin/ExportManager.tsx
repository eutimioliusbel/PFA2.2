
import React from 'react';
import { DataExchangeConfig, FieldDefinition, DataCategory } from '../../types';
import { FileDown, CheckSquare, Square } from 'lucide-react';

interface ExportManagerProps {
  config: DataExchangeConfig;
  setConfig: (c: DataExchangeConfig) => void;
}

export const ExportManager: React.FC<ExportManagerProps> = ({ config, setConfig }) => {
  
  const toggleField = (category: DataCategory, fieldId: string) => {
      const list = config.fields?.[category] || [];
      const updatedList = list.map(f => f.id === fieldId ? { ...f, enabled: !f.enabled } : f);
      
      setConfig({ 
          ...config, 
          fields: {
              ...config.fields,
              [category]: updatedList
          }
      });
  };

  const renderList = (category: DataCategory, fields: FieldDefinition[] | undefined) => (
      <div className="space-y-2">
          {(fields || []).map(field => (
              <div 
                key={field.id}
                onClick={() => toggleField(category, field.id)}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${field.enabled ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
              >
                  {field.enabled ? <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" /> : <Square className="w-4 h-4 text-slate-300" />}
                  <span className={`text-sm font-bold ${field.enabled ? 'text-slate-800 dark:text-white' : 'text-slate-500'}`}>{field.label}</span>
              </div>
          ))}
          {(!fields || fields.length === 0) && (
              <div className="text-xs text-slate-400 italic p-2">No fields configured for this category.</div>
          )}
      </div>
  );

  return (
    <div className="space-y-8">
        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-4">
            <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <FileDown className="w-5 h-5" /> Export Configuration
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Define the columns included in the Excel exports for standard users.
                </p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Forecast Changes Export</h3>
                {renderList('forecast_export', config.fields ? config.fields['forecast_export'] : [])}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Actual Changes Export</h3>
                {renderList('actuals_export', config.fields ? config.fields['actuals_export'] : [])}
            </div>
        </div>
    </div>
  );
};
