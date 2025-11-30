/**
 * Default Configuration Constants
 * Grid columns, export configs, and other app-wide defaults
 */

import type { GridColumn, DataExchangeConfig } from '../types';

export const DEFAULT_COLUMNS: GridColumn[] = [
  { id: 'pfaId', label: 'PFA ID', visible: true, width: 100 },
  { id: 'areaSilo', label: 'Area / Silo', visible: true, width: 120 },
  { id: 'class', label: 'Class', visible: true, width: 120 },
  { id: 'category', label: 'Category', visible: true, width: 120 },
  { id: 'source', label: 'Source', visible: true, width: 80 },
  { id: 'dor', label: 'DOR', visible: false, width: 80 },
  { id: 'estimatedStart', label: 'Est. Start', visible: true, width: 100 },
  { id: 'estimatedEnd', label: 'Est. End', visible: true, width: 100 },
  { id: 'ratePrice', label: 'Rate/Price', visible: true, width: 100 },
  { id: 'manufacturer', label: 'Make', visible: false, width: 100 },
  { id: 'model', label: 'Model', visible: false, width: 100 },
  { id: 'isActualized', label: 'Status/Eq', visible: true, width: 120 },
  { id: 'totalCost', label: 'Total Cost', visible: true, width: 100 }
];

export const DEFAULT_EXPORT_CONFIG: DataExchangeConfig = {
  fields: {
    forecast_export: [
      { id: 'pfa_id', label: 'PFA ID', internalKey: 'pfaId', enabled: true },
      { id: 'start_date', label: 'Start Date', internalKey: 'forecastStart', enabled: true },
      { id: 'end_date', label: 'End Date', internalKey: 'forecastEnd', enabled: true },
      { id: 'rate', label: 'Monthly Rate', internalKey: 'monthlyRate', enabled: true }
    ],
    actuals_export: [
      { id: 'pfa_id', label: 'PFA ID', internalKey: 'pfaId', enabled: true },
      { id: 'act_start', label: 'Actual Start', internalKey: 'actualStart', enabled: true },
      { id: 'act_end', label: 'Actual End', internalKey: 'actualEnd', enabled: true },
      { id: 'equipment', label: 'Equipment', internalKey: 'equipment', enabled: true }
    ],
    pfa_import: [
      { id: 'pfa_id', label: 'PFA ID', apiMap: 'PFA_ID', internalKey: 'pfaId', enabled: true },
      { id: 'desc', label: 'Class', apiMap: 'CLASS_DESC', internalKey: 'class', enabled: true }
    ],
    assets_import: [],
    class_cat_import: [],
    users_import: [],
    orgs_import: [],
    user_orgs_import: []
  }
};
