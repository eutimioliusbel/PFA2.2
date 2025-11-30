/**
 * View Settings Store (Zustand)
 *
 * Manages per-organization view preferences including:
 * - Timeline scale (Day, Week, Month, Year)
 * - Zoom level
 * - Bar display mode (cost, duration, both, quantity)
 * - Series visibility (plan, forecast, actual)
 * - Grid columns configuration
 * - Color configuration
 * - Grouping settings
 *
 * Benefits:
 * - Settings persist across sessions
 * - Different settings per organization
 * - Components only re-render when their subscribed settings change
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  Scale,
  DisplayMetric,
  SeriesVisibility,
  ColorConfig,
  GridColumn,
  GroupingField,
} from '../types';

interface OrgViewSettings {
  scale: Scale;
  zoomLevel: number;
  barDisplayMode: DisplayMetric;
  visibleSeries: SeriesVisibility;
  gridColumns: GridColumn[];
  grouping: GroupingField[];
  colors: ColorConfig;
  kpiCompact: boolean;
}

interface ViewSettingsState {
  // Per-organization settings
  orgSettings: Record<string, OrgViewSettings>;

  // Get settings for specific org (with defaults)
  getOrgSettings: (orgId: string) => OrgViewSettings;

  // Update individual settings
  setScale: (orgId: string, scale: Scale) => void;
  setZoomLevel: (orgId: string, zoom: number) => void;
  setBarDisplayMode: (orgId: string, mode: DisplayMetric) => void;
  setVisibleSeries: (orgId: string, series: SeriesVisibility) => void;
  setGridColumns: (orgId: string, columns: GridColumn[]) => void;
  setGrouping: (orgId: string, grouping: GroupingField[]) => void;
  setColors: (orgId: string, colors: ColorConfig) => void;
  setKpiCompact: (orgId: string, compact: boolean) => void;

  // Bulk update
  updateOrgSettings: (
    orgId: string,
    settings: Partial<OrgViewSettings>
  ) => void;

  // Reset
  resetOrgSettings: (orgId: string) => void;
}

// Default view settings
const defaultOrgSettings: OrgViewSettings = {
  scale: 'Month',
  zoomLevel: 1.0,
  barDisplayMode: 'cost',
  visibleSeries: { plan: true, forecast: true, actual: true },
  gridColumns: [], // Will be populated from DEFAULT_COLUMNS in App.tsx
  grouping: ['category'],
  colors: {
    plan: '#e2e8f0',
    forecast: '#3b82f6',
    actual: '#22c55e',
  },
  kpiCompact: false,
};

export const useViewSettingsStore = create<ViewSettingsState>()(
  devtools(
    persist(
      immer((set, get) => ({
        orgSettings: {},

        getOrgSettings: (orgId) => {
          const settings = get().orgSettings[orgId];
          return settings || defaultOrgSettings;
        },

        setScale: (orgId, scale) =>
          set(
            (state) => {
              if (!state.orgSettings[orgId]) {
                state.orgSettings[orgId] = { ...defaultOrgSettings };
              }
              state.orgSettings[orgId].scale = scale;
            },
            false,
            'setScale'
          ),

        setZoomLevel: (orgId, zoom) =>
          set(
            (state) => {
              if (!state.orgSettings[orgId]) {
                state.orgSettings[orgId] = { ...defaultOrgSettings };
              }
              state.orgSettings[orgId].zoomLevel = zoom;
            },
            false,
            'setZoomLevel'
          ),

        setBarDisplayMode: (orgId, mode) =>
          set(
            (state) => {
              if (!state.orgSettings[orgId]) {
                state.orgSettings[orgId] = { ...defaultOrgSettings };
              }
              state.orgSettings[orgId].barDisplayMode = mode;
            },
            false,
            'setBarDisplayMode'
          ),

        setVisibleSeries: (orgId, series) =>
          set(
            (state) => {
              if (!state.orgSettings[orgId]) {
                state.orgSettings[orgId] = { ...defaultOrgSettings };
              }
              state.orgSettings[orgId].visibleSeries = series;
            },
            false,
            'setVisibleSeries'
          ),

        setGridColumns: (orgId, columns) =>
          set(
            (state) => {
              if (!state.orgSettings[orgId]) {
                state.orgSettings[orgId] = { ...defaultOrgSettings };
              }
              state.orgSettings[orgId].gridColumns = columns;
            },
            false,
            'setGridColumns'
          ),

        setGrouping: (orgId, grouping) =>
          set(
            (state) => {
              if (!state.orgSettings[orgId]) {
                state.orgSettings[orgId] = { ...defaultOrgSettings };
              }
              state.orgSettings[orgId].grouping = grouping;
            },
            false,
            'setGrouping'
          ),

        setColors: (orgId, colors) =>
          set(
            (state) => {
              if (!state.orgSettings[orgId]) {
                state.orgSettings[orgId] = { ...defaultOrgSettings };
              }
              state.orgSettings[orgId].colors = colors;
            },
            false,
            'setColors'
          ),

        setKpiCompact: (orgId, compact) =>
          set(
            (state) => {
              if (!state.orgSettings[orgId]) {
                state.orgSettings[orgId] = { ...defaultOrgSettings };
              }
              state.orgSettings[orgId].kpiCompact = compact;
            },
            false,
            'setKpiCompact'
          ),

        updateOrgSettings: (orgId, settings) =>
          set(
            (state) => {
              if (!state.orgSettings[orgId]) {
                state.orgSettings[orgId] = { ...defaultOrgSettings };
              }
              state.orgSettings[orgId] = {
                ...state.orgSettings[orgId],
                ...settings,
              };
            },
            false,
            'updateOrgSettings'
          ),

        resetOrgSettings: (orgId) =>
          set(
            (state) => {
              state.orgSettings[orgId] = { ...defaultOrgSettings };
            },
            false,
            'resetOrgSettings'
          ),
      })),
      {
        name: 'pfa-view-settings-storage',
      }
    ),
    { name: 'PFA View Settings Store' }
  )
);
