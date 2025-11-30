/**
 * TanStack Query Hooks for PFA Data
 *
 * Custom hooks that wrap API client calls with React Query for:
 * - Automatic caching and background refetching
 * - Optimistic updates for better UX
 * - Built-in loading/error states
 * - Automatic retries and request deduplication
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import type { PfaView, PfaModificationDelta, FilterState } from '../types';

/**
 * Query key factory for type-safe query key management
 */
export const pfaKeys = {
  all: ['pfa'] as const,
  lists: () => [...pfaKeys.all, 'list'] as const,
  list: (orgId: string, filters?: FilterState) =>
    [...pfaKeys.lists(), orgId, filters] as const,
  details: () => [...pfaKeys.all, 'detail'] as const,
  detail: (id: string) => [...pfaKeys.details(), id] as const,
};

/**
 * Converts API response date strings to Date objects
 * Updated for Mirror + Delta architecture - handles PfaView with _metadata
 */
function convertApiDatesToObjects(record: any): PfaView {
  return {
    ...record,
    originalStart: new Date(record.originalStart),
    originalEnd: new Date(record.originalEnd),
    forecastStart: new Date(record.forecastStart),
    forecastEnd: new Date(record.forecastEnd),
    actualStart: new Date(record.actualStart),
    actualEnd: new Date(record.actualEnd),
    lastSyncedAt: record.lastSyncedAt ? new Date(record.lastSyncedAt) : undefined,
    modifiedAt: record.modifiedAt ? new Date(record.modifiedAt) : undefined,
    // Preserve _metadata from PfaView
    _metadata: record._metadata ? {
      ...record._metadata,
      modifiedAt: record._metadata.modifiedAt ? new Date(record._metadata.modifiedAt) : undefined
    } : undefined
  } as PfaView;
}

/**
 * Converts FilterState to API filters format
 */
function convertFiltersToApiFormat(filters?: FilterState) {
  if (!filters) {
    return {
      pageSize: 5000,
      sortBy: 'forecastStart',
      sortOrder: 'asc' as const,
    };
  }

  return {
    category: filters.category.length > 0 ? filters.category : undefined,
    class: filters.classType.length > 0 ? filters.classType : undefined,
    dor: filters.dor.length > 0 ? filters.dor : undefined,
    source: filters.source.length > 0 ? filters.source : undefined,
    forecastStartFrom: filters.startDateFrom,
    forecastStartTo: filters.startDateTo,
    forecastEndFrom: filters.endDateFrom,
    forecastEndTo: filters.endDateTo,
    pageSize: 5000,
    sortBy: 'forecastStart',
    sortOrder: 'asc' as const,
  };
}

/**
 * Hook to fetch PFA data for an organization with automatic caching
 * Updated for Mirror + Delta architecture - returns PfaView[]
 *
 * @param orgId - Organization ID to fetch data for
 * @param filters - Optional filter state to apply server-side
 * @param options - Additional query options
 *
 * @example
 * const { data: pfaRecords, isLoading, error } = usePfaData('RIO');
 */
export function usePfaData(
  orgId: string,
  filters?: FilterState,
  options?: {
    enabled?: boolean;
    select?: (data: PfaView[]) => PfaView[];
  }
) {
  return useQuery({
    queryKey: pfaKeys.list(orgId, filters),
    queryFn: async () => {
      const apiFilters = convertFiltersToApiFormat(filters);
      const response = await apiClient.getPfaData(orgId, apiFilters);

      if (!response.success) {
        throw new Error('Failed to load PFA data');
      }

      // Convert date strings to Date objects
      return response.data.map(convertApiDatesToObjects);
    },
    enabled: options?.enabled ?? !!orgId,
    select: options?.select,
  });
}

/**
 * Hook to save draft changes with optimistic updates
 * Updated for Mirror + Delta architecture - uses PfaModificationDelta
 *
 * @example
 * const { mutate: saveDraft } = useSavePfaDraft(orgId);
 * saveDraft({ pfaId: '123', delta: { forecastStart: newDate } });
 */
export function useSavePfaDraft(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      sessionId: string;
      modifications: Array<{ pfaId: string; delta: PfaModificationDelta; changeReason?: string }>;
    }) => {
      return apiClient.saveDraft(orgId, data.sessionId, data.modifications);
    },

    // Optimistic update - apply changes immediately for instant UI feedback
    onMutate: async (newData) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: pfaKeys.list(orgId) });

      // Snapshot previous data for rollback
      const previousData = queryClient.getQueryData<PfaView[]>(
        pfaKeys.list(orgId)
      );

      // Optimistically update cache
      if (previousData) {
        queryClient.setQueryData<PfaView[]>(pfaKeys.list(orgId), (old) => {
          if (!old) return old;

          const modificationsMap = new Map(
            newData.modifications.map((m) => [m.pfaId, m.delta])
          );

          return old.map((record) => {
            const delta = modificationsMap.get(record.id);
            return delta ? { ...record, ...delta } : record;
          });
        });
      }

      return { previousData };
    },

    // Rollback on error
    onError: (_err, _newData, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(pfaKeys.list(orgId), context.previousData);
      }
    },

    // Refetch on success to sync with server state
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pfaKeys.list(orgId) });
    },
  });
}

/**
 * Hook to commit changes to PEMS with optimistic updates
 * Updated for Mirror + Delta architecture - uses PfaModificationDelta
 *
 * @example
 * const { mutate: commitChanges } = useCommitPfaChanges(orgId);
 * commitChanges({ sessionId, modifications });
 */
export function useCommitPfaChanges(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      sessionId: string;
      modifications: Array<{ pfaId: string; delta: PfaModificationDelta; changeReason?: string }>;
    }) => {
      return apiClient.commitDrafts(orgId, { sessionId: data.sessionId });
    },

    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: pfaKeys.list(orgId) });

      const previousData = queryClient.getQueryData<PfaView[]>(
        pfaKeys.list(orgId)
      );

      if (previousData) {
        queryClient.setQueryData<PfaView[]>(pfaKeys.list(orgId), (old) => {
          if (!old) return old;

          const modificationsMap = new Map(
            newData.modifications.map((m) => [m.pfaId, m.delta])
          );

          return old.map((record) => {
            const delta = modificationsMap.get(record.id);
            return delta ? { ...record, ...delta } : record;
          });
        });
      }

      return { previousData };
    },

    onError: (_err, _newData, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(pfaKeys.list(orgId), context.previousData);
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pfaKeys.list(orgId) });
    },
  });
}

/**
 * Hook to refresh PFA data from PEMS
 *
 * @example
 * const { mutate: syncPems, isPending } = useSyncPems(orgId);
 * syncPems();
 */
export function useSyncPems(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return apiClient.syncPemsData(orgId, 'full');
    },

    onSuccess: () => {
      // Invalidate all PFA queries for this org to trigger refetch
      queryClient.invalidateQueries({ queryKey: pfaKeys.list(orgId) });
    },
  });
}
