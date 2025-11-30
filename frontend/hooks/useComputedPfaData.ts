/**
 * useComputedPfaData Hook
 * Phase 4: Large File Refactoring
 *
 * Computes derived PFA data (live records with drag overrides, timeline bounds)
 */

import { useMemo } from 'react';
import type { PfaView, DragUpdate } from '../types';
import { getTimelineBounds, getDaysDiff } from '../utils';

interface UseComputedPfaDataProps {
  visiblePfaRecords: PfaView[];
  dragOverrides: Map<string, DragUpdate> | null;
}

interface UseComputedPfaDataReturn {
  livePfaRecords: PfaView[];
  bounds: { start: Date; end: Date; totalDays: number };
}

export function useComputedPfaData({
  visiblePfaRecords,
  dragOverrides,
}: UseComputedPfaDataProps): UseComputedPfaDataReturn {
  const livePfaRecords = useMemo(() => {
    if (!dragOverrides || dragOverrides.size === 0) return visiblePfaRecords;
    return visiblePfaRecords.map((a) => {
      const override = dragOverrides.get(a.id);
      if (override) {
        return override.layer === 'actual'
          ? { ...a, actualStart: override.start, actualEnd: override.end, hasActuals: true }
          : { ...a, forecastStart: override.start, forecastEnd: override.end };
      }
      return a;
    });
  }, [visiblePfaRecords, dragOverrides]);

  const bounds = useMemo(() => {
    if (!visiblePfaRecords.length) {
      return getTimelineBounds(
        new Date().toISOString(),
        new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString()
      );
    }
    let min = new Date(8640000000000000);
    let max = new Date(-8640000000000000);
    visiblePfaRecords.forEach((a) => {
      if (a.forecastStart < min) min = a.forecastStart;
      if (a.forecastEnd > max) max = a.forecastEnd;
    });
    const start = new Date(min);
    start.setMonth(start.getMonth() - 1);
    const end = new Date(max);
    end.setMonth(end.getMonth() + 1);
    return { start, end, totalDays: getDaysDiff(start, end) };
  }, [visiblePfaRecords]);

  return {
    livePfaRecords,
    bounds,
  };
}
