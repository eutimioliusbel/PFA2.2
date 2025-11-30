/**
 * TanStack Query Client Configuration
 *
 * Central configuration for React Query with optimized defaults for PFA Vanguard:
 * - 5-minute stale time (reduces unnecessary refetches)
 * - 10-minute cache time (keeps data in memory)
 * - Automatic retries with exponential backoff
 * - Optimistic updates enabled
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000,

      // Unused data is garbage collected after 10 minutes
      gcTime: 10 * 60 * 1000,

      // Retry failed requests 3 times with exponential backoff
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Don't refetch on window focus for large datasets (user-controlled refresh)
      refetchOnWindowFocus: false,

      // Refetch on mount if data is stale
      refetchOnMount: true,

      // Don't refetch on reconnect for draft data
      refetchOnReconnect: false,
    },
    mutations: {
      // Retry failed mutations once (avoid duplicate writes)
      retry: 1,

      // Mutations timeout after 30 seconds
      networkMode: 'online',
    },
  },
});
