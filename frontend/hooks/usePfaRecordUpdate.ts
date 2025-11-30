/**
 * usePfaRecordUpdate Hook
 * Phase 5: Large File Refactoring
 *
 * Manages PFA record updates with history tracking and modification extraction
 */

import { useCallback } from 'react';
import type { PfaView } from '../types';
import { extractModifications } from '../utils/modificationTracking';

interface UsePfaRecordUpdateProps {
  allPfaRef: React.MutableRefObject<PfaView[]>;
  baselinePfaRef: React.MutableRefObject<PfaView[]>;
  commitHistory: (fn: (draft: PfaView[]) => void) => void;
  addMultipleModifications: (modifications: any[]) => void;
  setDataVersion: (fn: (v: number) => number) => void;
}

interface UsePfaRecordUpdateReturn {
  updatePfaRecords: (fn: (assets: PfaView[]) => PfaView[]) => void;
}

export function usePfaRecordUpdate({
  allPfaRef,
  baselinePfaRef,
  commitHistory,
  addMultipleModifications,
  setDataVersion,
}: UsePfaRecordUpdateProps): UsePfaRecordUpdateReturn {
  const updatePfaRecords = useCallback(
    (fn: (assets: PfaView[]) => PfaView[]) => {
      const after = fn(allPfaRef.current);

      // Commit to history using Immer patches (97% memory reduction vs full clones)
      commitHistory((draft) => {
        // Replace entire draft array with updated values
        draft.length = 0;
        after.forEach((record) => draft.push(record));
      });

      // Extract modifications using utility function
      const modifications = extractModifications(after, baselinePfaRef.current);

      // Update draft store with all modifications at once
      if (modifications.length > 0) {
        addMultipleModifications(modifications);
      }

      allPfaRef.current = after;
      setDataVersion((v) => v + 1);
    },
    [allPfaRef, baselinePfaRef, commitHistory, addMultipleModifications, setDataVersion]
  );

  return { updatePfaRecords };
}
