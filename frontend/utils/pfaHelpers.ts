/**
 * PFA Helper Utilities
 * Functions for cloning, parsing, and transforming PFA records
 */

import type { PfaRecord, PfaView, FilterState } from '../types';

/**
 * Clone PFA records (supports both legacy PfaRecord and new PfaView types)
 * Ensures Date objects are properly cloned
 */
export const cloneAssets = (assets: (PfaRecord | PfaView)[]): (PfaRecord | PfaView)[] => {
  return assets.map(a => ({
    ...a,
    originalStart: new Date(a.originalStart),
    originalEnd: new Date(a.originalEnd),
    forecastStart: new Date(a.forecastStart),
    forecastEnd: new Date(a.forecastEnd),
    actualStart: new Date(a.actualStart),
    actualEnd: new Date(a.actualEnd),
    // Clone _metadata if it exists (PfaView)
    _metadata: (a as any)._metadata ? {
      ...(a as any)._metadata,
      modifiedAt: (a as any)._metadata.modifiedAt ? new Date((a as any)._metadata.modifiedAt) : undefined
    } : undefined
  }));
};

/**
 * Parse CSV text into a 2D array
 * Handles quoted commas within fields
 */
export const parseCSV = (text: string): string[][] => {
  const lines = text.split('\n').filter(l => l.trim());
  return lines.map(line => {
    // This regex handles quoted commas
    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    if (matches) {
      return matches.map(m => m.replace(/^"|"$/g, '').trim());
    }
    return line.split(',').map(s => s.trim());
  });
};

/**
 * Normalize header string for comparison
 * Converts to lowercase and removes non-alphanumeric characters
 */
export const normalizeHeader = (h: string): string =>
  h.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Create default filter state from available values
 */
export const createDefaultFilters = (
  cats: string[],
  classes: string[],
  dors: string[],
  sources: string[],
  areas: string[]
): FilterState => ({
  category: cats,
  classType: classes,
  source: sources,
  dor: dors,
  status: ['Forecast', 'Actuals'],
  areaSilo: areas,
  search: '',
  startDateFrom: '',
  startDateTo: '',
  endDateFrom: '',
  endDateTo: ''
});
