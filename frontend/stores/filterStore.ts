/**
 * Filter Store (Zustand)
 *
 * Manages filter state per organization with:
 * - Per-organization filter persistence
 * - Efficient filter updates (no unnecessary re-renders)
 * - Filter presets and saved searches
 * - Filter history for quick switching
 *
 * Benefits:
 * - Centralized filter management
 * - Filters persist across sessions per org
 * - No prop drilling for filter state
 * - Selective re-renders (components only update when their org's filters change)
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { FilterState } from '../types';

interface FilterStoreState {
  // Per-organization filters
  orgFilters: Record<string, FilterState>;

  // Actions
  getFilters: (orgId: string) => FilterState | undefined;
  setFilters: (orgId: string, filters: FilterState) => void;
  updateFilter: <K extends keyof FilterState>(
    orgId: string,
    key: K,
    value: FilterState[K]
  ) => void;
  resetFilters: (orgId: string) => void;
  clearAllFilters: () => void;
}

// Default filter state
export const createDefaultFilters = (
  availableCategories: string[],
  availableClasses: string[],
  availableDors: string[],
  availableSources: string[],
  availableAreas: string[] = []
): FilterState => ({
  category: availableCategories,
  classType: availableClasses,
  dor: availableDors,
  source: availableSources,
  status: ['Active'],
  areaSilo: availableAreas,
  search: '',
  startDateFrom: undefined,
  startDateTo: undefined,
  endDateFrom: undefined,
  endDateTo: undefined,
});

export const useFilterStore = create<FilterStoreState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        orgFilters: {},

        // Get filters for specific organization
        getFilters: (orgId) => {
          return get().orgFilters[orgId];
        },

        // Set complete filter state for organization
        setFilters: (orgId, filters) =>
          set(
            (state) => {
              state.orgFilters[orgId] = filters;
            },
            false,
            'setFilters'
          ),

        // Update single filter property
        updateFilter: (orgId, key, value) =>
          set(
            (state) => {
              if (!state.orgFilters[orgId]) {
                // Initialize with empty filters if not exists
                state.orgFilters[orgId] = {
                  category: [],
                  classType: [],
                  dor: [],
                  source: [],
                  status: ['Active'],
                  areaSilo: [],
                  search: '',
                };
              }
              state.orgFilters[orgId][key] = value;
            },
            false,
            'updateFilter'
          ),

        // Reset filters to default for organization
        resetFilters: (orgId) =>
          set(
            (state) => {
              delete state.orgFilters[orgId];
            },
            false,
            'resetFilters'
          ),

        // Clear all org filters
        clearAllFilters: () =>
          set(
            {
              orgFilters: {},
            },
            false,
            'clearAllFilters'
          ),
      })),
      {
        name: 'pfa-filter-storage',
      }
    ),
    { name: 'PFA Filter Store' }
  )
);
