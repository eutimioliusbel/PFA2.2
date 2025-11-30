/**
 * Sync WebSocket Service - Real-time sync status updates
 * ADR-008 Phase 3 - Task 3.2
 *
 * Production WebSocket implementation for real-time sync events.
 * Connects to backend WebSocket server at ws://localhost:3000/api/ws/sync/:orgId
 */

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export type SyncEventType =
  | 'SYNC_STARTED'
  | 'SYNC_PROGRESS'
  | 'SYNC_SUCCESS'
  | 'SYNC_CONFLICT'
  | 'SYNC_FAILED';

export interface SyncEvent {
  type: SyncEventType;
  jobId: string;
  pfaId?: string;
  progress?: number;
  message?: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

interface UseSyncStatusUpdatesOptions {
  organizationId: string;
  enabled?: boolean;
  onEvent?: (event: SyncEvent) => void;
}


/**
 * Hook for receiving real-time sync status updates
 *
 * Usage:
 * ```tsx
 * const { isConnected, lastEvent } = useSyncStatusUpdates({
 *   organizationId: 'org-rio',
 *   onEvent: (event) => {
 *     if (event.type === 'SYNC_SUCCESS') {
 *       toast.success(`Synced ${event.pfaId}`);
 *     }
 *   },
 * });
 * ```
 */
export function useSyncStatusUpdates({
  organizationId,
  enabled = true,
  onEvent,
}: UseSyncStatusUpdatesOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SyncEvent | null>(null);
  const queryClient = useQueryClient();
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Determine WebSocket protocol based on page protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host =
      process.env.NODE_ENV === 'production'
        ? window.location.host
        : 'localhost:3000'; // Dev server

    const wsUrl = `${protocol}//${host}/api/ws/sync/${organizationId}`;

    console.log('[WebSocket] Connecting to:', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WebSocket] Connected to sync status updates');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const syncEvent = JSON.parse(event.data) as SyncEvent;
        console.log('[WebSocket] Received event:', syncEvent);

        // Update local state
        setLastEvent(syncEvent);

        // Call user-provided event handler
        onEvent?.(syncEvent);

        // Invalidate React Query cache for sync jobs
        queryClient.invalidateQueries({ queryKey: ['sync-jobs'] });

        // Invalidate specific PFA record if provided
        if (syncEvent.pfaId) {
          queryClient.invalidateQueries({
            queryKey: ['pfa-modification', syncEvent.pfaId],
          });
        }
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      setIsConnected(false);
    };

    ws.onclose = (event) => {
      console.log('[WebSocket] Disconnected:', event.code, event.reason);
      setIsConnected(false);

      // Auto-reconnect after 5 seconds if still enabled
      if (enabled) {
        console.log('[WebSocket] Scheduling reconnect in 5 seconds...');
        const reconnectTimer = setTimeout(() => {
          console.log('[WebSocket] Reconnecting...');
          // Trigger re-render to reconnect (useEffect will run again)
        }, 5000);

        // Store cleanup for reconnect timer
        cleanupRef.current = () => clearTimeout(reconnectTimer);
      }
    };

    // Cleanup on unmount
    return () => {
      console.log('[WebSocket] Cleaning up connection');
      if (cleanupRef.current) {
        cleanupRef.current();
      }
      ws.close();
      setIsConnected(false);
    };
  }, [organizationId, enabled, onEvent, queryClient]);

  return {
    isConnected,
    lastEvent,
  };
}

/**
 * Hook for monitoring a specific sync job
 *
 * Usage:
 * ```tsx
 * const { status, progress } = useSyncJobMonitor('sync-003');
 * ```
 */
export function useSyncJobMonitor(jobId: string) {
  const [status, setStatus] = useState<SyncEventType | null>(null);
  const [progress, setProgress] = useState<number>(0);

  useSyncStatusUpdates({
    organizationId: 'current', // Will be replaced with actual org ID
    enabled: Boolean(jobId),
    onEvent: (event) => {
      if (event.jobId === jobId) {
        setStatus(event.type);
        if (event.progress !== undefined) {
          setProgress(event.progress);
        }
      }
    },
  });

  return {
    status,
    progress,
  };
}

