/**
 * useOrgViewSettings Hook
 * Consolidates organization-specific view settings and filters
 * Phase 1B: Large File Refactoring
 *
 * Combines subscriptions from:
 * - viewSettingsStore: Per-org view preferences (scale, zoom, colors, etc.)
 * - filterStore: Per-org filter persistence
 *
 * Provides org-aware wrapper functions that automatically include organizationId
 */

import { useCallback } from 'react';
import { useViewSettingsStore } from '../stores/viewSettingsStore';
import { useFilterStore } from '../stores/filterStore';
import type { Scale, DisplayMetric, SeriesVisibility, GridColumn, ColorConfig, GroupingField } from '../types';
import { DEFAULT_COLUMNS } from '../constants/defaultConfigs';

export function useOrgViewSettings(organizationId: string) {
  // View Settings Store - Raw getters/setters
  const viewSettings = useViewSettingsStore((state) =>
    state.getOrgSettings(organizationId)
  );
  const _setScale = useViewSettingsStore((state) => state.setScale);
  const _setZoomLevel = useViewSettingsStore((state) => state.setZoomLevel);
  const _setBarDisplayMode = useViewSettingsStore(
    (state) => state.setBarDisplayMode
  );
  const _setVisibleSeries = useViewSettingsStore(
    (state) => state.setVisibleSeries
  );
  const _setGridColumns = useViewSettingsStore((state) => state.setGridColumns);
  const _setGrouping = useViewSettingsStore((state) => state.setGrouping);
  const _setColors = useViewSettingsStore((state) => state.setColors);
  const _setKpiCompact = useViewSettingsStore((state) => state.setKpiCompact);

  // Filter Store - Raw getters/setters
  const getOrgFilters = useFilterStore((state) => state.getFilters);
  const setOrgFilters = useFilterStore((state) => state.setFilters);
  const updateOrgFilter = useFilterStore((state) => state.updateFilter);

  // Org-aware wrapper functions
  const setScale = useCallback(
    (scale: Scale) => _setScale(organizationId, scale),
    [organizationId, _setScale]
  );

  const setZoomLevel = useCallback(
    (zoom: number | ((prev: number) => number)) => {
      const newZoom = typeof zoom === 'function' ? zoom(viewSettings.zoomLevel) : zoom;
      _setZoomLevel(organizationId, newZoom);
    },
    [organizationId, viewSettings.zoomLevel, _setZoomLevel]
  );

  const setBarDisplayMode = useCallback(
    (mode: DisplayMetric) => _setBarDisplayMode(organizationId, mode),
    [organizationId, _setBarDisplayMode]
  );

  const setVisibleSeries = useCallback(
    (series: SeriesVisibility) => _setVisibleSeries(organizationId, series),
    [organizationId, _setVisibleSeries]
  );

  const setGridColumns = useCallback(
    (columns: GridColumn[]) => _setGridColumns(organizationId, columns),
    [organizationId, _setGridColumns]
  );

  const setGrouping = useCallback(
    (grouping: GroupingField[]) => _setGrouping(organizationId, grouping),
    [organizationId, _setGrouping]
  );

  const setColors = useCallback(
    (colors: ColorConfig) => _setColors(organizationId, colors),
    [organizationId, _setColors]
  );

  const setKpiCompact = useCallback(
    (compact: boolean | ((prev: boolean) => boolean)) => {
      const newCompact = typeof compact === 'function' ? compact(viewSettings.kpiCompact) : compact;
      _setKpiCompact(organizationId, newCompact);
    },
    [organizationId, viewSettings.kpiCompact, _setKpiCompact]
  );

  // Destructured view settings for backward compatibility
  const scale = viewSettings.scale;
  const zoomLevel = viewSettings.zoomLevel;
  const barDisplayMode = viewSettings.barDisplayMode;
  const visibleSeries = viewSettings.visibleSeries;
  const gridColumns = viewSettings.gridColumns.length > 0
    ? viewSettings.gridColumns
    : DEFAULT_COLUMNS;
  const grouping = viewSettings.grouping;
  const colors = viewSettings.colors;
  const kpiCompact = viewSettings.kpiCompact;

  return {
    // Raw view settings values
    scale,
    zoomLevel,
    barDisplayMode,
    visibleSeries,
    gridColumns,
    grouping,
    colors,
    kpiCompact,

    // Setters (org-aware)
    setScale,
    setZoomLevel,
    setBarDisplayMode,
    setVisibleSeries,
    setGridColumns,
    setGrouping,
    setColors,
    setKpiCompact,

    // Filter functions (org-aware)
    getOrgFilters,
    setOrgFilters,
    updateOrgFilter,
  };
}
