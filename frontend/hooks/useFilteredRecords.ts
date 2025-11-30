/**
 * useFilteredRecords Hook
 * Handles filtering logic for PFA records
 * Phase 1C: Large File Refactoring
 *
 * Extracts the large filtering useEffect from App.tsx
 * Applies organization isolation, focus mode, search, date ranges, and category filters
 */

import { useEffect, MutableRefObject } from 'react';
import type { PfaRecord, PfaView, FilterState } from '../types';

interface UseFilteredRecordsProps {
  allPfaRef: MutableRefObject<PfaView[]>;
  baselinePfaRef: MutableRefObject<PfaView[]>;
  dataVersion: number;
  filters: FilterState;
  focusMode: boolean;
  selectedIds: Set<string>;
  currentOrganizationId?: string;
  setVisiblePfaRecords: (records: PfaView[]) => void;
  setVisibleBaselinePfaRecords: (records: PfaView[]) => void;
}

export function useFilteredRecords({
  allPfaRef,
  baselinePfaRef,
  dataVersion,
  filters,
  focusMode,
  selectedIds,
  currentOrganizationId,
  setVisiblePfaRecords,
  setVisibleBaselinePfaRecords,
}: UseFilteredRecordsProps) {
  useEffect(() => {
    const source = allPfaRef.current;
    const baseline = baselinePfaRef.current;
    if (!source.length) return;

    const isVisible = (a: PfaRecord) => {
      // Organization Isolation Context
      if (currentOrganizationId && a.organization !== currentOrganizationId) {
        return false;
      }

      if (selectedIds.has(a.id)) return true;
      if (focusMode && !selectedIds.has(a.id)) return false;

      // Search filter
      const searchStr = String(filters.search || '').toLowerCase();
      if (searchStr && !String(a.pfaId || '').toLowerCase().includes(searchStr)) return false;

      // Date range filters
      const fStart = new Date(a.forecastStart);
      fStart.setHours(0, 0, 0, 0);
      const fEnd = new Date(a.forecastEnd);
      fEnd.setHours(0, 0, 0, 0);

      if (filters.startDateFrom && fStart < new Date(filters.startDateFrom)) return false;
      if (filters.startDateTo && fStart > new Date(filters.startDateTo)) return false;
      if (filters.endDateFrom && fEnd < new Date(filters.endDateFrom)) return false;
      if (filters.endDateTo && fEnd > new Date(filters.endDateTo)) return false;

      // Status filters
      if (filters.status.length > 0) {
        const isAct = a.isActualized && filters.status.includes('Actuals');
        const isFcst = !a.isActualized && !a.isDiscontinued && filters.status.includes('Forecast');
        const isDisc = a.isDiscontinued && filters.status.includes('Discontinued');
        const isFt = a.isFundsTransferable && filters.status.includes('Funds Transferable');
        if (!isAct && !isFcst && !isDisc && !isFt) return false;
      }

      // Category filters
      if (filters.category.length && !filters.category.includes(a.category)) return false;
      if (filters.classType.length && !filters.classType.includes(a.class)) return false;
      if (filters.dor.length && !filters.dor.includes(a.dor)) return false;
      if (filters.areaSilo.length && !filters.areaSilo.includes(a.areaSilo)) return false;
      if (filters.source.length && !filters.source.includes(a.source)) return false;

      return true;
    };

    const filteredSource = source.filter(isVisible);
    const filteredBaseline = baseline.filter(isVisible);

    // Phase 5: Removed 800-record slice limit
    // Now supporting up to 5000 records (API pageSize)
    setVisiblePfaRecords(filteredSource);
    setVisibleBaselinePfaRecords(filteredBaseline);
  }, [
    dataVersion,
    filters,
    focusMode,
    selectedIds,
    currentOrganizationId,
    allPfaRef,
    baselinePfaRef,
    setVisiblePfaRecords,
    setVisibleBaselinePfaRecords,
  ]);
}
