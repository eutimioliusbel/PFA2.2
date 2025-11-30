
import React, { useState, useEffect, useMemo } from 'react';
import { Asset, ClassificationRecord } from '../types';
import { X, Save, Sparkles, Copy, Calendar } from 'lucide-react';

interface NewForecastFormProps {
  onClose: () => void;
  onSave: (assets: Asset[]) => void;
  existingCount: number;
  initialValues?: Partial<typeof defaultFormData> & { quantity?: number };
  classificationData?: ClassificationRecord[];
}

const AREAS = ['North Area', 'South Silo', 'East Expansion', 'West Plant', 'Logistics Hub'];

const defaultFormData = {
    organization: 'PEMS Organization',
    class: '',
    areaSilo: AREAS[0],
    category: '',
    source: 'Rental' as 'Rental' | 'Purchase',
    dor: 'BEO' as 'BEO' | 'PROJECT',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 6)).toISOString().split('T')[0],
    rate: 1000,
    price: 50000,
    manufacturer: '',
    model: ''
};

export const NewForecastForm: React.FC<NewForecastFormProps> = ({ onClose, onSave, existingCount, initialValues, classificationData = [] }) => {
  const [quantity, setQuantity] = useState(initialValues?.quantity || 1);
  
  // Derived options from Master Data
  const availableCategories = useMemo(() => {
      const cats = new Set(classificationData.map(c => c.categoryName));
      return Array.from(cats).sort();
  }, [classificationData]);

  const [formData, setFormData] = useState({
    ...defaultFormData,
    category: initialValues?.category || (availableCategories.length > 0 ? availableCategories[0] : ''),
    pfaId: `PFA-${2000 + existingCount + 1}`,
    ...initialValues
  });

  // Dynamic Classes based on selected Category
  const availableClasses = useMemo(() => {
      if (!formData.category) return [];
      return classificationData
          .filter(c => c.categoryName === formData.category)
          .map(c => c.classId)
          .sort();
  }, [classificationData, formData.category]);

  // Initial load of Class if not set or category changes
  useEffect(() => {
      if (!formData.class && availableClasses.length > 0) {
          setFormData(prev => ({ ...prev, class: availableClasses[0] }));
      } else if (formData.class && !availableClasses.includes(formData.class) && availableClasses.length > 0) {
          // Reset class if current selection is invalid for new category
          setFormData(prev => ({ ...prev, class: availableClasses[0] }));
      }
  }, [availableClasses, formData.category]);

  // If initialValues provides a start date but no end date, default end date to 1 month after
  useEffect(() => {
      if (initialValues?.startDate && !initialValues.endDate) {
          const start = new Date(initialValues.startDate);
          const end = new Date(start);
          end.setMonth(end.getMonth() + 1);
          setFormData(prev => ({
              ...prev,
              endDate: end.toISOString().split('T')[0]
          }));
      }
  }, [initialValues]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const newAssets: Asset[] = [];

    for (let i = 0; i < quantity; i++) {
        const newAsset: Asset = {
            id: `new-${Date.now()}-${i}`,
            pfaId: `PFA-${2000 + existingCount + 1 + i}`,
            organization: formData.organization,
            areaSilo: formData.areaSilo,
            category: formData.category,
            class: formData.class,
            source: formData.source,
            dor: formData.dor,
            manufacturer: formData.manufacturer,
            model: formData.model,
            
            monthlyRate: formData.source === 'Rental' ? Number(formData.rate) : 0,
            purchasePrice: formData.source === 'Purchase' ? Number(formData.price) : 0,
            
            // Flags default to false for new forecast
            isActualized: false,
            isDiscontinued: false,
            isFundsTransferable: false,

            originalStart: start, // Baseline = Forecast for new
            originalEnd: end,
            forecastStart: start,
            forecastEnd: end,
            actualStart: start,
            actualEnd: end,
            hasActuals: false
        };
        newAssets.push(newAsset);
    }

    onSave(newAssets);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-600/20">
                <Sparkles className="w-5 h-5 text-white" />
             </div>
             <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">New Forecast Entry</h2>
                <p className="text-xs text-slate-500">Create a new asset record in the ledger.</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <form id="forecast-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Section 1: Quantity & ID */}
            <div className="grid grid-cols-3 gap-4">
                <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantity</label>
                     <div className="relative">
                        <Copy className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="number" 
                            min="1" 
                            max="100" 
                            value={quantity} 
                            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                            className="w-full pl-9 pr-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg text-sm font-bold text-blue-700 dark:text-blue-400 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                     </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Organization</label>
                    <input 
                        type="text" 
                        value={formData.organization} 
                        disabled 
                        className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-500 select-none cursor-not-allowed"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start PFA ID</label>
                    <input 
                        type="text" 
                        value={`PFA-${2000 + existingCount + 1}`} 
                        disabled 
                        className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-500 select-none cursor-not-allowed"
                    />
                </div>
            </div>

            {/* Section 2: Classification */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Area / Silo</label>
                    <select 
                        value={formData.areaSilo}
                        onChange={e => setFormData({...formData, areaSilo: e.target.value})}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                    >
                        {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
                
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-800"></div>

            {/* Section 3: Plan Details */}
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                    <select 
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value, class: ''})}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                    >
                        {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Class</label>
                    <select 
                        value={formData.class}
                        onChange={e => setFormData({...formData, class: e.target.value})}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                        disabled={!formData.category}
                    >
                        {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Source</label>
                    <select 
                        value={formData.source}
                        onChange={e => setFormData({...formData, source: e.target.value as any})}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                    >
                        <option value="Rental">Rental</option>
                        <option value="Purchase">Purchase</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">DOR</label>
                    <select 
                        value={formData.dor}
                        onChange={e => setFormData({...formData, dor: e.target.value as any})}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                    >
                        <option value="BEO">BEO</option>
                        <option value="PROJECT">Project</option>
                    </select>
                </div>
            </div>

            {/* Section 4: Financials & Dates */}
            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                <input 
                                    type="date" 
                                    required 
                                    value={formData.startDate} 
                                    onChange={e => setFormData({...formData, startDate: e.target.value})} 
                                    className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]" 
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                <input 
                                    type="date" 
                                    required 
                                    value={formData.endDate} 
                                    onChange={e => setFormData({...formData, endDate: e.target.value})} 
                                    className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]" 
                                />
                            </div>
                        </div>
                     </div>
                     <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Manufacturer</label>
                            <input type="text" placeholder="Optional" value={formData.manufacturer} onChange={e => setFormData({...formData, manufacturer: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Model</label>
                            <input type="text" placeholder="Optional" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white" />
                        </div>
                     </div>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Cost Estimation</h4>
                    {formData.source === 'Rental' ? (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Monthly Rental Rate</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                <input 
                                    type="number" 
                                    min="0"
                                    required
                                    value={formData.rate} 
                                    onChange={e => setFormData({...formData, rate: Number(e.target.value)})} 
                                    className="w-full pl-6 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>
                    ) : (
                         <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Purchase Price</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                <input 
                                    type="number" 
                                    min="0"
                                    required
                                    value={formData.price} 
                                    onChange={e => setFormData({...formData, price: Number(e.target.value)})} 
                                    className="w-full pl-6 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-amber-600"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 rounded-b-2xl">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit"
            form="forecast-form"
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-600/20 transition-all transform hover:scale-105"
          >
            <Save className="w-4 h-4" />
            Create Forecast {quantity > 1 ? `(${quantity})` : ''}
          </button>
        </div>

      </div>
    </div>
  );
};
