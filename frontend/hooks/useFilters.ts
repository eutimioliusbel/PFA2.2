/**
 * useFilters Hook
 * Phase 3: Large File Refactoring
 *
 * Manages filter derivation and organization-specific filter state
 */

import { useMemo, useCallback } from 'react';
import type { FilterState, ClassificationRecord, DorRecord, SourceRecord, ManufacturerRecord, ModelRecord } from '../types';
import { createDefaultFilters } from '../stores/filterStore';

interface UseFiltersProps {
  currentOrgId: string;
  classificationData: ClassificationRecord[];
  dorData: DorRecord[];
  sourceData: SourceRecord[];
  manufacturerData: ManufacturerRecord[];
  modelData: ModelRecord[];
  allPfaRecords: Array<{ areaSilo: string }>;
  dataVersion: number;
  getOrgFilters: (orgId: string) => FilterState | undefined;
  setOrgFilters: (orgId: string, filters: FilterState) => void;
}

interface UseFiltersReturn {
  derivedFilters: {
    availableCategories: string[];
    availableClasses: string[];
    availableDors: string[];
    availableSources: string[];
    availableAreas: string[];
    availableManufacturers: string[];
    availableModels: string[];
  };
  filters: FilterState;
  handleSetFilters: (newFilters: FilterState | ((prev: FilterState) => FilterState)) => void;
}

export function useFilters({
  currentOrgId,
  classificationData,
  dorData,
  sourceData,
  manufacturerData,
  modelData,
  allPfaRecords,
  dataVersion,
  getOrgFilters,
  setOrgFilters,
}: UseFiltersProps): UseFiltersReturn {
  // Derive unique filter values from master data
  const derivedFilters = useMemo(() => {
    const uniqueCats = Array.from(new Set(classificationData.map(c => c.categoryName).filter(Boolean))).sort();
    const uniqueClasses = Array.from(new Set(classificationData.map(c => c.classId).filter(Boolean))).sort();
    const uniqueDors = dorData.map(d => d.code).sort();
    const uniqueSources = sourceData.map(s => s.name).sort();
    const uniqueAreas = Array.from(new Set(allPfaRecords.map(p => p.areaSilo).filter(Boolean))).sort();
    const uniqueManufacturers = manufacturerData.map(m => m.name).sort();
    const uniqueModels = modelData.map(m => m.name).sort();

    return {
      availableCategories: uniqueCats,
      availableClasses: uniqueClasses,
      availableDors: uniqueDors,
      availableSources: uniqueSources,
      availableAreas: uniqueAreas,
      availableManufacturers: uniqueManufacturers,
      availableModels: uniqueModels,
    };
  }, [classificationData, dorData, sourceData, manufacturerData, modelData, dataVersion]);

  // Get active filters for current organization
  const filters = useMemo(() => {
    const storedFilters = getOrgFilters(currentOrgId);

    if (!storedFilters && derivedFilters.availableCategories.length > 0) {
      return createDefaultFilters(
        derivedFilters.availableCategories,
        derivedFilters.availableClasses,
        derivedFilters.availableDors,
        derivedFilters.availableSources,
        derivedFilters.availableAreas
      );
    }
    return storedFilters || createDefaultFilters([], [], [], [], []);
  }, [currentOrgId, derivedFilters, getOrgFilters]);

  // Handler to update filters for the specific organization
  const handleSetFilters = useCallback(
    (newFilters: FilterState | ((prev: FilterState) => FilterState)) => {
      if (!currentOrgId) return;

      const current = getOrgFilters(currentOrgId) || createDefaultFilters([], [], [], [], []);
      const updated = typeof newFilters === 'function' ? newFilters(current) : newFilters;
      setOrgFilters(currentOrgId, updated);
    },
    [currentOrgId, getOrgFilters, setOrgFilters]
  );

  return {
    derivedFilters,
    filters,
    handleSetFilters,
  };
}
