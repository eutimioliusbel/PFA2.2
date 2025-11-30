/**
 * usePfaDataState Hook
 * Phase 6: Large File Refactoring
 *
 * Manages PFA data state (refs, visible records, loading, errors, sync state)
 */

import { useState, useRef } from 'react';
import type { PfaView } from '../types';

interface UsePfaDataStateReturn {
  allPfaRef: React.MutableRefObject<PfaView[]>;
  baselinePfaRef: React.MutableRefObject<PfaView[]>;
  visiblePfaRecords: PfaView[];
  setVisiblePfaRecords: React.Dispatch<React.SetStateAction<PfaView[]>>;
  visibleBaselinePfaRecords: PfaView[];
  setVisibleBaselinePfaRecords: React.Dispatch<React.SetStateAction<PfaView[]>>;
  dataVersion: number;
  setDataVersion: React.Dispatch<React.SetStateAction<number>>;
  isLoadingData: boolean;
  setIsLoadingData: React.Dispatch<React.SetStateAction<boolean>>;
  dataError: string | null;
  setDataError: React.Dispatch<React.SetStateAction<string | null>>;
  syncState: { pristineCount: number; modifiedCount: number; pendingSyncCount: number };
  setSyncState: React.Dispatch<React.SetStateAction<{ pristineCount: number; modifiedCount: number; pendingSyncCount: number }>>;
}

export function usePfaDataState(): UsePfaDataStateReturn {
  const allPfaRef = useRef<PfaView[]>([]);
  const baselinePfaRef = useRef<PfaView[]>([]);
  const [visiblePfaRecords, setVisiblePfaRecords] = useState<PfaView[]>([]);
  const [visibleBaselinePfaRecords, setVisibleBaselinePfaRecords] = useState<PfaView[]>([]);
  const [dataVersion, setDataVersion] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState({ pristineCount: 0, modifiedCount: 0, pendingSyncCount: 0 });

  return {
    allPfaRef,
    baselinePfaRef,
    visiblePfaRecords,
    setVisiblePfaRecords,
    visibleBaselinePfaRecords,
    setVisibleBaselinePfaRecords,
    dataVersion,
    setDataVersion,
    isLoadingData,
    setIsLoadingData,
    dataError,
    setDataError,
    syncState,
    setSyncState,
  };
}
