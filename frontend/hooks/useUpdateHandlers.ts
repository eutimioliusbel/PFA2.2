/**
 * useUpdateHandlers Hook
 * Phase 4: Large File Refactoring
 *
 * Manages PFA record update operations (undo/redo, bulk updates, asset date updates)
 */

import { useCallback } from 'react';
import type { PfaRecord, PfaView } from '../types';
import { applyBulkUpdates, updateAssetDates, updateMultipleAssetDates } from '../utils/modificationTracking';

interface UseUpdateHandlersProps {
  allPfaRef: React.MutableRefObject<PfaView[]>;
  undoHistory: () => PfaView[] | null;
  redoHistory: () => PfaView[] | null;
  updatePfaRecords: (fn: (assets: PfaView[]) => PfaView[]) => void;
  setDataVersion: (fn: (v: number) => number) => void;
}

interface UseUpdateHandlersReturn {
  handleUndo: () => void;
  handleRedo: () => void;
  handleBulkUpdate: (updates: Partial<PfaRecord>[]) => void;
  handleUpdateAsset: (id: string, start: Date, end: Date, layer: 'forecast' | 'actual') => void;
  handleUpdateAssets: (updates: { id: string; start: Date; end: Date; layer: 'forecast' | 'actual' }[]) => void;
}

export function useUpdateHandlers({
  allPfaRef,
  undoHistory,
  redoHistory,
  updatePfaRecords,
  setDataVersion,
}: UseUpdateHandlersProps): UseUpdateHandlersReturn {
  const handleUndo = useCallback(() => {
    const previousState = undoHistory();
    if (previousState) {
      allPfaRef.current = previousState;
      setDataVersion((v) => v + 1);
    }
  }, [allPfaRef, undoHistory, setDataVersion]);

  const handleRedo = useCallback(() => {
    const nextState = redoHistory();
    if (nextState) {
      allPfaRef.current = nextState;
      setDataVersion((v) => v + 1);
    }
  }, [allPfaRef, redoHistory, setDataVersion]);

  const handleBulkUpdate = useCallback(
    (updates: Partial<PfaRecord>[]) => {
      updatePfaRecords((prev) => applyBulkUpdates(prev, updates));
    },
    [updatePfaRecords]
  );

  const handleUpdateAsset = useCallback(
    (id: string, start: Date, end: Date, layer: 'forecast' | 'actual') => {
      updatePfaRecords((prev) => updateAssetDates(prev, id, start, end, layer));
    },
    [updatePfaRecords]
  );

  const handleUpdateAssets = useCallback(
    (updates: { id: string; start: Date; end: Date; layer: 'forecast' | 'actual' }[]) => {
      updatePfaRecords((prev) => updateMultipleAssetDates(prev, updates));
    },
    [updatePfaRecords]
  );

  return {
    handleUndo,
    handleRedo,
    handleBulkUpdate,
    handleUpdateAsset,
    handleUpdateAssets,
  };
}
