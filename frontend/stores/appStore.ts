/**
 * Application UI State Store (Zustand)
 *
 * Manages global UI state including:
 * - App mode (timeline-lab, grid-lab, kpi-board, etc.)
 * - Navigation state (open/closed)
 * - Selection state (selectedIds, focusMode)
 * - Modal/panel visibility
 *
 * Benefits over useState:
 * - Components only re-render when subscribed slices change
 * - Persistent state across sessions (via persist middleware)
 * - Time-travel debugging via Redux DevTools
 * - No prop drilling
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { AppMode } from '../types';

interface AppState {
  // Mode & Navigation
  appMode: AppMode;
  isNavOpen: boolean;
  isFilterOpen: boolean;

  // Modals & Panels
  showSettings: boolean;
  showProfile: boolean;
  showNewForecastModal: boolean;

  // AI Assistant
  aiMode: 'hidden' | 'panel' | 'voice';

  // Selection State
  selectedIds: Set<string>;
  focusMode: boolean;

  // Actions - Mode & Navigation
  setAppMode: (mode: AppMode) => void;
  toggleNavigation: () => void;
  toggleFilter: () => void;

  // Actions - Modals
  setShowSettings: (show: boolean) => void;
  setShowProfile: (show: boolean) => void;
  setShowNewForecastModal: (show: boolean) => void;

  // Actions - AI
  setAiMode: (mode: 'hidden' | 'panel' | 'voice') => void;

  // Actions - Selection
  toggleSelection: (id: string) => void;
  selectMultiple: (ids: string[], selected: boolean) => void;
  clearSelection: () => void;
  selectAll: (ids: string[]) => void;
  setFocusMode: (enabled: boolean) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  appMode: 'timeline-lab' as AppMode,
  isNavOpen: true,
  isFilterOpen: true,
  showSettings: false,
  showProfile: false,
  showNewForecastModal: false,
  aiMode: 'hidden' as 'hidden' | 'panel' | 'voice',
  selectedIds: new Set<string>(),
  focusMode: false,
};

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      immer((set) => ({
        // Initial state
        ...initialState,

        // Mode & Navigation actions
        setAppMode: (mode) =>
          set(
            (state) => {
              state.appMode = mode;
            },
            false,
            'setAppMode'
          ),

        toggleNavigation: () =>
          set(
            (state) => {
              state.isNavOpen = !state.isNavOpen;
            },
            false,
            'toggleNavigation'
          ),

        toggleFilter: () =>
          set(
            (state) => {
              state.isFilterOpen = !state.isFilterOpen;
            },
            false,
            'toggleFilter'
          ),

        // Modal actions
        setShowSettings: (show) =>
          set(
            (state) => {
              state.showSettings = show;
            },
            false,
            'setShowSettings'
          ),

        setShowProfile: (show) =>
          set(
            (state) => {
              state.showProfile = show;
            },
            false,
            'setShowProfile'
          ),

        setShowNewForecastModal: (show) =>
          set(
            (state) => {
              state.showNewForecastModal = show;
            },
            false,
            'setShowNewForecastModal'
          ),

        // AI actions
        setAiMode: (mode) =>
          set(
            (state) => {
              state.aiMode = mode;
            },
            false,
            'setAiMode'
          ),

        // Selection actions
        toggleSelection: (id) =>
          set(
            (state) => {
              const newIds = new Set(state.selectedIds);
              if (newIds.has(id)) {
                newIds.delete(id);
              } else {
                newIds.add(id);
              }
              state.selectedIds = newIds;
            },
            false,
            'toggleSelection'
          ),

        selectMultiple: (ids, selected) =>
          set(
            (state) => {
              const newIds = new Set(state.selectedIds);
              ids.forEach((id) => {
                if (selected) {
                  newIds.add(id);
                } else {
                  newIds.delete(id);
                }
              });
              state.selectedIds = newIds;
            },
            false,
            'selectMultiple'
          ),

        clearSelection: () =>
          set(
            (state) => {
              state.selectedIds = new Set();
            },
            false,
            'clearSelection'
          ),

        selectAll: (ids) =>
          set(
            (state) => {
              state.selectedIds = new Set(ids);
            },
            false,
            'selectAll'
          ),

        setFocusMode: (enabled) =>
          set(
            (state) => {
              state.focusMode = enabled;
            },
            false,
            'setFocusMode'
          ),

        // Reset to initial state
        reset: () =>
          set(
            () => ({ ...initialState }),
            false,
            'reset'
          ),
      })),
      {
        name: 'pfa-app-storage',
        // Only persist specific fields (not transient UI state like modals)
        partialize: (state) => ({
          appMode: state.appMode,
          isNavOpen: state.isNavOpen,
          isFilterOpen: state.isFilterOpen,
          aiMode: state.aiMode,
        }),
      }
    ),
    { name: 'PFA App Store' }
  )
);
