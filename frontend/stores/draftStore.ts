/**
 * Draft Management Store (Zustand)
 *
 * Manages pending modifications to PFA records before they are saved/committed:
 * - Tracks changes per PfaRecord via pendingModifications Map
 * - Session management for draft lifecycle
 * - Optimistic update tracking
 * - Change detection and dirty state
 *
 * Benefits:
 * - Centralized draft state management
 * - Better change tracking
 * - Easier integration with TanStack Query mutations
 * - Automatic dirty state calculation
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { PfaRecord } from '../types';

interface DraftState {
  // Draft tracking
  pendingModifications: Map<string, Partial<PfaRecord>>;
  sessionId: string;
  hasUnsavedChanges: boolean;

  // Actions
  addModification: (pfaId: string, changes: Partial<PfaRecord>) => void;
  addMultipleModifications: (
    modifications: Array<{ pfaId: string; changes: Partial<PfaRecord> }>
  ) => void;
  removeModification: (pfaId: string) => void;
  clearModifications: () => void;

  // Getters
  getModification: (pfaId: string) => Partial<PfaRecord> | undefined;
  getModificationsArray: () => Array<{
    pfaId: string;
    changes: Partial<PfaRecord>;
  }>;
  getModificationCount: () => number;

  // Session management
  resetSession: () => void;

  // Manual dirty flag control (for edge cases)
  setHasUnsavedChanges: (value: boolean) => void;
}

export const useDraftStore = create<DraftState>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      pendingModifications: new Map(),
      sessionId: crypto.randomUUID(),
      hasUnsavedChanges: false,

      // Add or update a single modification
      addModification: (pfaId, changes) =>
        set(
          (state) => {
            const existing = state.pendingModifications.get(pfaId);
            state.pendingModifications.set(pfaId, {
              ...existing,
              ...changes,
            });
            state.hasUnsavedChanges = state.pendingModifications.size > 0;
          },
          false,
          'addModification'
        ),

      // Add multiple modifications at once (batch operation)
      addMultipleModifications: (modifications) =>
        set(
          (state) => {
            modifications.forEach(({ pfaId, changes }) => {
              const existing = state.pendingModifications.get(pfaId);
              state.pendingModifications.set(pfaId, {
                ...existing,
                ...changes,
              });
            });
            state.hasUnsavedChanges = state.pendingModifications.size > 0;
          },
          false,
          'addMultipleModifications'
        ),

      // Remove a modification
      removeModification: (pfaId) =>
        set(
          (state) => {
            state.pendingModifications.delete(pfaId);
            state.hasUnsavedChanges = state.pendingModifications.size > 0;
          },
          false,
          'removeModification'
        ),

      // Clear all modifications
      clearModifications: () =>
        set(
          (state) => {
            state.pendingModifications.clear();
            state.hasUnsavedChanges = false;
          },
          false,
          'clearModifications'
        ),

      // Getters
      getModification: (pfaId) => {
        return get().pendingModifications.get(pfaId);
      },

      getModificationsArray: () => {
        const modifications = get().pendingModifications;
        return Array.from(modifications.entries()).map(([pfaId, changes]) => ({
          pfaId,
          changes,
        }));
      },

      getModificationCount: () => {
        return get().pendingModifications.size;
      },

      // Reset session (new draft session)
      resetSession: () =>
        set(
          (state) => {
            state.pendingModifications.clear();
            state.sessionId = crypto.randomUUID();
            state.hasUnsavedChanges = false;
          },
          false,
          'resetSession'
        ),

      // Manual dirty flag control
      setHasUnsavedChanges: (value) =>
        set(
          (state) => {
            state.hasUnsavedChanges = value;
          },
          false,
          'setHasUnsavedChanges'
        ),
    })),
    { name: 'PFA Draft Store' }
  )
);
