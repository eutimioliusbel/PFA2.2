/**
 * usePfaDataSync Hook
 * Handles syncing TanStack Query data to refs and state
 * Phase 1C: Large File Refactoring
 *
 * Consolidates three useEffects:
 * 1. Sync pfaQueryData to refs and clear drafts/history
 * 2. Sync loading state
 * 3. Sync error state
 */

import { useEffect, MutableRefObject } from 'react';
import type { PfaView } from '../types';

interface UsePfaDataSyncProps {
  pfaQueryData: PfaView[] | undefined;
  isPfaQueryLoading: boolean;
  pfaQueryError: Error | null;
  allPfaRef: MutableRefObject<PfaView[]>;
  baselinePfaRef: MutableRefObject<PfaView[]>;
  setDataVersion: React.Dispatch<React.SetStateAction<number>>;
  setIsLoadingData: (loading: boolean) => void;
  setDataError: (error: string | null) => void;
  clearModifications: () => void;
  resetHistory: (data: PfaView[]) => void;
}

export function usePfaDataSync({
  pfaQueryData,
  isPfaQueryLoading,
  pfaQueryError,
  allPfaRef,
  baselinePfaRef,
  setDataVersion,
  setIsLoadingData,
  setDataError,
  clearModifications,
  resetHistory,
}: UsePfaDataSyncProps) {
  // Sync TanStack Query data to refs for backward compatibility
  useEffect(() => {
    if (pfaQueryData) {
      allPfaRef.current = pfaQueryData;
      baselinePfaRef.current = JSON.parse(JSON.stringify(pfaQueryData)); // Deep clone for baseline
      setDataVersion((v) => v + 1);
      // Clear drafts and history when fresh data is loaded
      clearModifications();
      resetHistory(pfaQueryData);
    }
  }, [pfaQueryData, clearModifications, resetHistory, allPfaRef, baselinePfaRef, setDataVersion]);

  // Sync loading state
  useEffect(() => {
    setIsLoadingData(isPfaQueryLoading);
  }, [isPfaQueryLoading, setIsLoadingData]);

  // Sync error state
  useEffect(() => {
    if (pfaQueryError) {
      const errorMessage =
        pfaQueryError instanceof Error
          ? pfaQueryError.message
          : 'Failed to load PFA data';
      setDataError(errorMessage);
    } else {
      setDataError(null);
    }
  }, [pfaQueryError, setDataError]);
}
