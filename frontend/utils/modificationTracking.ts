/**
 * Modification Tracking Utilities
 * Phase 1D: Large File Refactoring
 *
 * Extracts modification tracking and comparison logic from App.tsx
 * Handles change detection and draft management
 */

import type { PfaView } from '../types';

export interface Modification {
  pfaId: string;
  changes: Partial<PfaView>;
}

/**
 * Extract modifications by comparing current records with baseline
 */
export function extractModifications(
  currentRecords: PfaView[],
  baselineRecords: PfaView[]
): Modification[] {
  const modifications: Modification[] = [];

  currentRecords.forEach((record) => {
    const originalRecord = baselineRecords.find((r) => r.id === record.id);

    if (
      originalRecord &&
      JSON.stringify(record) !== JSON.stringify(originalRecord)
    ) {
      // Extract only the changed fields
      const changes: Partial<PfaView> = {};
      Object.keys(record).forEach((key) => {
        const k = key as keyof PfaView;
        if (JSON.stringify(record[k]) !== JSON.stringify(originalRecord[k])) {
          changes[k] = record[k] as any;
        }
      });

      modifications.push({ pfaId: record.pfaId, changes });
    }
  });

  return modifications;
}

/**
 * Apply bulk updates to records using update map
 */
export function applyBulkUpdates<T extends { id: string }>(
  records: T[],
  updates: Partial<T>[]
): T[] {
  const updateMap = new Map(updates.map((u) => [u.id!, u]));

  return records.map((record) => {
    const update = updateMap.get(record.id);
    return update ? { ...record, ...update } : record;
  });
}

/**
 * Update single asset dates
 */
export function updateAssetDates(
  records: PfaView[],
  id: string,
  start: Date,
  end: Date,
  layer: 'forecast' | 'actual'
): PfaView[] {
  return records.map((a) =>
    a.id === id
      ? layer === 'actual'
        ? { ...a, actualStart: start, actualEnd: end, hasActuals: true }
        : { ...a, forecastStart: start, forecastEnd: end }
      : a
  );
}

/**
 * Update multiple assets dates
 */
export function updateMultipleAssetDates(
  records: PfaView[],
  updates: { id: string; start: Date; end: Date; layer: 'forecast' | 'actual' }[]
): PfaView[] {
  const map = new Map(updates.map((u) => [u.id, u]));

  return records.map((a) => {
    const u = map.get(a.id);
    return u
      ? u.layer === 'actual'
        ? { ...a, actualStart: u.start, actualEnd: u.end, hasActuals: true }
        : { ...a, forecastStart: u.start, forecastEnd: u.end }
      : a;
  });
}
